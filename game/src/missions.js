// Missions: the sortie state machine — objectives, timer, scoring and the
// end screens (mission complete, crashed, out of fuel). One job: decide what
// a flight means and what it is worth.

import { MISSIONS, WORLD } from './config.js';
import { nextRing } from './rings.js';
import { isOnRunway } from './flight.js';

export function createMissionRun(missionId) {
  const mission = MISSIONS.find((m) => m.id === missionId) ?? MISSIONS[0];
  return {
    mission,
    score: 0,
    ringsPassed: 0,
    timeLeft: mission.timeLimit,
    elapsed: 0,
    state: 'flying', // flying | complete | crashed | out-of-fuel | timed-out
    landingQuality: null, // { centreOffset, sinkRate, bonus } on a scored landing
    breakdown: [],
    message: '',
    messageUntil: 0,
  };
}

export function showMessage(run, text, seconds, now) {
  run.message = text;
  run.messageUntil = now + seconds;
}

// Called every frame while flying. Returns an end state when the sortie ends.
export function updateMission(run, plane, rings, dt) {
  if (run.state !== 'flying') return run.state;
  run.elapsed += dt;
  run.timeLeft = run.mission.timeLimit - run.elapsed;
  if (run.timeLeft <= 0) {
    run.timeLeft = 0;
    return endRun(run, 'timed-out', 'TIME UP — THE VALLEY KEEPS ITS SECRETS');
  }
  // Out of fuel: the pilot may still glide. The sortie ends on the ground —
  // a runway means a dead-stick landing, a field means a forced landing.
  if (plane.fuel <= 0 && plane.onGround) {
    if (isOnRunway(plane.x, plane.z)) {
      return endRun(run, 'complete', 'DEAD-STICK LANDING — YOU MADE IT');
    }
    return endRun(run, 'out-of-fuel', 'OUT OF FUEL — FORCED LANDING IN A FIELD');
  }
  if (plane.damage >= 100) {
    return endRun(run, 'crashed', 'AIRFRAME LOST');
  }
  // All rings done: the sortie is won once the pilot lands on a runway.
  if (nextRing(rings) === null && run.mission.ringCount > 0) {
    if (plane.onGround && isOnRunway(plane.x, plane.z)) {
      return endRun(run, 'complete', 'MISSION COMPLETE');
    }
    if (run.mission.id === 'rings' && !run.allRingsAnnounced) {
      run.allRingsAnnounced = true;
      showMessage(run, 'ALL RINGS — NOW LAND ON THE RUNWAY', 4, run.elapsed);
    }
  }
  // Mail Run: reaching the far airfield ends the flight on landing.
  if (run.mission.id === 'mail' && plane.onGround && plane.z > WORLD.farAirfieldZ) {
    return endRun(run, 'complete', 'MAIL DELIVERED');
  }
  // Precision Landing: any landing on the home runway ends the sortie.
  if (run.mission.id === 'landing' && plane.onGround && plane.z > 40 && plane.speed < 5) {
    return endRun(run, 'complete', 'TOUCHDOWN — LET US SEE THE NUMBERS');
  }
  return 'flying';
}

// Score a ring pass: flat points plus a speed bonus for threading it fast.
export function scoreRing(run, plane) {
  run.ringsPassed += 1;
  const speedBonus = Math.round(Math.max(0, plane.speed - 45));
  const points = run.mission.scoring.ring + speedBonus;
  run.score += points;
  run.breakdown.push(`Ring ${run.ringsPassed}: +${points}`);
  showMessage(run, `RING ${run.ringsPassed}  +${points}`, 1.6, run.elapsed);
}

// Score a landing: centreline accuracy and softness decide the bonus.
export function scoreLanding(run, plane, sinkRate) {
  const centreOffset = Math.abs(plane.x);
  const centreScore = Math.max(0, 1 - centreOffset / WORLD.runwayHalfWidth);
  const softScore = Math.max(0, 1 - sinkRate / 11);
  const quality = (centreScore * 0.6 + softScore * 0.4);
  const bonus = Math.round(run.mission.scoring.landingBonus * quality);
  run.landingQuality = { centreOffset: Math.round(centreOffset), sinkRate: Math.round(sinkRate * 10) / 10, bonus };
  run.score += bonus;
  run.breakdown.push(`Landing: +${bonus} (centre ${Math.round(centreOffset)}m, sink ${sinkRate.toFixed(1)} m/s)`);
  return bonus;
}

function endRun(run, state, headline) {
  run.state = state;
  // Time bonus for finishing with time to spare.
  if (state === 'complete' && run.timeLeft > 0) {
    const bonus = Math.round(run.timeLeft * run.mission.scoring.timeBonusPerSecond);
    run.score += bonus;
    run.breakdown.push(`Time bonus: +${bonus}`);
  }
  run.headline = headline;
  return state;
}

// Rank the flight for the end screen: S / A / B / C by score share.
export function gradeFor(run) {
  const maxPossible = run.mission.ringCount * 160
    + run.mission.scoring.landingBonus
    + run.mission.timeLimit * run.mission.scoring.timeBonusPerSecond;
  const ratio = run.score / Math.max(1, maxPossible);
  if (ratio >= 0.85) return 'S';
  if (ratio >= 0.65) return 'A';
  if (ratio >= 0.4) return 'B';
  return 'C';
}
