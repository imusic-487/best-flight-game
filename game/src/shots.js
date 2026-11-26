// Screenshot scenes: ?shot=takeoff|rings|landing|end stages a frozen,
// reproducible frame of the game so each screenshot shows it at its best.
// The game still runs normally without the parameter.

import { createFlightState } from './flight.js';
import { buildRingCourse } from './rings.js';
import { createMissionRun, scoreRing, scoreLanding } from './missions.js';

// Returns a staged { plane, run, rings, frozen } or null for live play.
export function stageShot(shot, mission) {
  const run = createMissionRun(mission.id);
  const rings = buildRingCourse(mission);
  const plane = createFlightState(mission);
  const staged = { plane, run, rings, frozen: true, shot };

  if (shot === 'takeoff') {
    // Rolling down the home runway at rotation speed, throttle full.
    plane.z = 330;
    plane.alt = 0;
    plane.speed = 54;
    plane.throttle = 1;
    plane.pitch = 6;
    plane.onGround = true;
    return staged;
  }

  if (shot === 'rings') {
    // Mid-flight, banked toward the next ring, river and town below.
    plane.z = 2950;
    plane.x = -40;
    plane.alt = 92;
    plane.speed = 72;
    plane.throttle = 0.78;
    plane.pitch = 3;
    plane.bank = -24;
    plane.heading = 6;
    plane.onGround = false;
    plane.fuel = 71;
    rings[0].passed = true;
    rings[1].passed = true;
    rings[2].passed = true;
    run.ringsPassed = 3;
    run.score = 340;
    run.elapsed = 58;
    run.timeLeft = mission.timeLimit - 58;
    return staged;
  }

  if (shot === 'landing') {
    // Final approach: low, slow, lined up on the home runway.
    plane.z = -620;
    plane.x = 4;
    plane.alt = 46;
    plane.speed = 48;
    plane.throttle = 0.32;
    plane.pitch = -4;
    plane.bank = 2;
    plane.heading = -1;
    plane.onGround = false;
    plane.fuel = 54;
    plane.verticalSpeed = -3.4;
    rings[0].passed = true;
    rings[1].passed = true;
    run.ringsPassed = 2;
    run.score = 210;
    run.elapsed = 96;
    run.timeLeft = mission.timeLimit - 96;
    return staged;
  }

  if (shot === 'end') {
    // Mission-complete screen with a scored landing already on the books.
    plane.z = 240;
    plane.alt = 0;
    plane.speed = 0;
    plane.throttle = 0;
    plane.onGround = true;
    plane.fuel = 38;
    for (const ring of rings) ring.passed = true;
    run.ringsPassed = mission.ringCount;
    run.score = 1772; // rings 1220 + landing 212 + time bonus 340
    run.breakdown = [
      'Ring 1: +118', 'Ring 2: +124', 'Ring 3: +121', 'Ring 4: +129',
      'Ring 5: +117', 'Ring 6: +122', 'Ring 7: +126', 'Ring 8: +120',
      'Ring 9: +118', 'Ring 10: +125', 'Landing: +212', 'Time bonus: +340',
    ];
    run.landingQuality = { centreOffset: 3, sinkRate: 2.1, bonus: 212 };
    run.state = 'complete';
    run.headline = 'MISSION COMPLETE';
    run.timeLeft = 68;
    run.elapsed = mission.timeLimit - 68;
    return staged;
  }

  return null;
}
