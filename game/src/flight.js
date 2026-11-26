// Flight model: throttle, pitch, bank, speed, altitude, fuel, damage and wind.
// Pure state update — no drawing here. Units: metres, seconds, degrees, knots
// only appear at the HUD. Speed is m/s internally.

import { FLIGHT, WORLD, WIND } from './config.js';

const DEG = Math.PI / 180;

export function createFlightState(mission) {
  return {
    x: 0, // lateral metres from the valley centreline
    z: mission.startZ, // distance down the valley
    alt: 0, // metres above the valley floor
    heading: 0, // degrees, 0 = straight down the valley
    pitch: 0, // degrees, + = nose up
    bank: 0, // degrees, + = right wing down
    speed: 0, // m/s
    throttle: 0, // 0..1
    fuel: mission.fuelStart,
    damage: 0, // 0..100; 100 = airframe lost
    verticalSpeed: 0,
    onGround: true,
    stalled: false,
    windX: 0, // current lateral wind, m/s
    time: 0,
  };
}

export function windAt(time) {
  // Slow gusts: a base westerly plus a sine gust that shifts direction.
  const gust = Math.sin(time / WIND.gustPeriod * Math.PI * 2) * WIND.gustAmplitude;
  const slow = Math.sin(time / 61) * 3;
  return WIND.baseSpeed + gust + slow;
}

export function terrainHeightAt(x, z) {
  // Valley floor is flat; hills rise steeply beyond the field edges.
  const edge = Math.max(0, Math.abs(x) - WORLD.valleyHalfWidth);
  const hills = edge * edge * 0.012;
  // Gentle undulation along the valley so the floor is not a dead plane.
  const ripple = Math.sin(z * 0.004) * 2 + Math.sin(z * 0.0013 + 2) * 3;
  return hills + Math.max(0, ripple) * 0.2;
}

export function isOnRunway(x, z) {
  const home = z >= -40 && z <= WORLD.runwayLength;
  const far = z >= WORLD.farAirfieldZ && z <= WORLD.farAirfieldZ + WORLD.runwayLength;
  return Math.abs(x) <= WORLD.runwayHalfWidth && (home || far);
}

// Update one simulation step. Returns an event string for the game loop:
// 'takeoff' | 'touchdown' | 'hard-landing' | 'crash' | 'out-of-fuel' | null.
export function updateFlight(state, input, dt, mission) {
  state.time += dt;
  const prevAlt = state.alt;
  const prevVs = state.verticalSpeed;

  // --- Throttle -----------------------------------------------------------
  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.7);
  if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.7);
  // Mouse: holding the pointer high adds throttle, low cuts it (gentle).
  if (input.mouseActive && !input.throttleUp && !input.throttleDown) {
    state.throttle = Math.max(0, Math.min(1, state.throttle - input.mouseY * dt * 0.25));
  }

  // --- Pitch and bank ------------------------------------------------------
  const pitchRate = FLIGHT.pitchAuthority * (state.stalled ? 0.35 : 1);
  let pitchTarget = 0;
  if (input.pitchUp) pitchTarget = 1;
  if (input.pitchDown) pitchTarget = -1;
  if (input.mouseActive) pitchTarget += -input.mouseY * 0.8;
  state.pitch += Math.max(-1, Math.min(1, pitchTarget)) * pitchRate * dt;
  state.pitch = Math.max(-28, Math.min(30, state.pitch));

  let bankTarget = 0;
  if (input.bankLeft) bankTarget = -1;
  if (input.bankRight) bankTarget = 1;
  if (input.mouseActive) bankTarget += input.mouseX * 0.9;
  const bankRate = FLIGHT.bankAuthority * (state.stalled ? 0.4 : 1);
  state.bank += Math.max(-1, Math.min(1, bankTarget)) * bankRate * dt;
  state.bank = Math.max(-62, Math.min(62, state.bank));
  // Wings level themselves slowly when the pilot lets go.
  if (bankTarget === 0) state.bank *= Math.max(0, 1 - dt * 0.55);
  if (pitchTarget === 0 && state.onGround) state.pitch *= Math.max(0, 1 - dt * 2);

  // --- Speed ---------------------------------------------------------------
  const thrust = state.throttle * FLIGHT.maxThrottleAccel;
  const drag = FLIGHT.dragCoefficient * state.speed * state.speed;
  const pitchDrag = Math.abs(Math.sin(state.pitch * DEG)) * state.speed * 0.55;
  const brakeDrag = input.brake ? state.speed * 1.4 : 0;
  const groundDrag = state.onGround ? 6 : 0;
  state.speed += (thrust - drag - pitchDrag - brakeDrag - groundDrag) * dt;
  state.speed = Math.max(0, Math.min(WORLD.maxSpeed, state.speed));

  // --- Stall ----------------------------------------------------------------
  state.stalled = !state.onGround && state.speed < WORLD.stallSpeed;
  if (state.stalled) {
    state.pitch -= 14 * dt; // nose drops
    state.speed = Math.max(state.speed, 12);
  }

  // --- Turn ------------------------------------------------------------------
  const turnRate = FLIGHT.turnRateFactor * Math.tan(state.bank * DEG)
    * (60 / Math.max(30, state.speed));
  state.heading += turnRate * dt * 57.3;
  if (state.heading > 180) state.heading -= 360;
  if (state.heading < -180) state.heading += 360;

  // --- Climb / sink -----------------------------------------------------------
  const climbFromPitch = Math.sin(state.pitch * DEG) * state.speed * FLIGHT.climbEfficiency;
  const sinkFromStall = state.stalled ? -9 : 0;
  const ceilingSink = state.alt > WORLD.maxAltitude ? -(state.alt - WORLD.maxAltitude) * 0.12 : 0;
  state.verticalSpeed = climbFromPitch + sinkFromStall + ceilingSink;
  state.alt += state.verticalSpeed * dt;

  // --- Position ---------------------------------------------------------------
  const hRad = state.heading * DEG;
  const forward = state.speed * dt;
  state.z += Math.cos(hRad) * forward;
  state.x += Math.sin(hRad) * forward;
  // Wind pushes the airframe sideways; gusts are strongest low down.
  state.windX = windAt(state.time);
  const windEffect = state.alt < 120 ? 1 : 0.45;
  state.x += state.windX * windEffect * dt * 0.35;
  // Hills fence the valley: soft push back, hard damage if you fly into them.
  if (Math.abs(state.x) > WORLD.valleyHalfWidth + 60) {
    state.x = Math.sign(state.x) * (WORLD.valleyHalfWidth + 60);
    state.damage = Math.min(100, state.damage + 30 * dt);
  }

  // --- Fuel ---------------------------------------------------------------------
  let fuelEvent = null;
  if (state.throttle > 0 || state.speed > 0) {
    state.fuel -= (FLIGHT.fuelBurnBase + FLIGHT.fuelBurnThrottle * state.throttle * state.throttle) * dt;
  }
  if (state.fuel <= 0) {
    state.fuel = 0;
    state.throttle = 0;
    fuelEvent = 'out-of-fuel'; // keep flying the frame: a dead-stick landing is still possible
  }

  // --- Ground contact -------------------------------------------------------------
  const ground = terrainHeightAt(state.x, state.z);
  const wasAirborne = !state.onGround;
  if (state.alt <= ground) {
    state.alt = ground;
    const sinkRate = -prevVs;
    const runway = isOnRunway(state.x, state.z);
    if (wasAirborne) {
      if (runway && sinkRate < 6 && Math.abs(state.bank) < 18 && state.speed < 62) {
        state.onGround = true;
        state.verticalSpeed = 0;
        state.pitch = 0;
        return 'touchdown';
      }
      if (runway && sinkRate < 11) {
        state.onGround = true;
        state.damage = Math.min(100, state.damage + FLIGHT.damagePerHardHit * 0.5);
        state.verticalSpeed = 0;
        return 'hard-landing';
      }
      if (!runway && sinkRate < 6 && Math.abs(state.bank) < 18 && state.speed < 62) {
        // A gentle touchdown in a field: survivable, but the sortie is over
        // unless the pilot can get her rolling again.
        state.onGround = true;
        state.damage = Math.min(100, state.damage + FLIGHT.damagePerScrape);
        state.verticalSpeed = 0;
        return 'field-landing';
      }
      state.damage = 100;
      return 'crash';
    }
    state.onGround = true;
    state.verticalSpeed = 0;
    // Rolling on the ground: keep the nose level, bleed speed slowly.
    if (state.speed < 2) state.speed = 0;
  } else if (state.alt > ground + 0.5) {
    if (state.onGround && state.speed > 52 && state.pitch > 4) {
      state.onGround = false;
      return 'takeoff';
    }
    if (state.onGround && state.alt > ground + 2) state.onGround = false;
  }

  // Terrain scrape while low and fast over the hills.
  if (!state.onGround && state.alt - ground < 4 && state.speed > 40) {
    state.damage = Math.min(100, state.damage + FLIGHT.damagePerScrape * dt);
  }
  if (state.damage >= 100) return 'crash';

  // Keep the sortie inside the valley.
  if (state.z > WORLD.courseEndZ + 800) state.z = WORLD.courseEndZ + 800;
  if (state.z < -300) state.z = -300;
  return fuelEvent;
}

// Conversions the HUD uses.
export const knots = (ms) => ms * 1.94384;
export const feet = (m) => m * 3.28084;
