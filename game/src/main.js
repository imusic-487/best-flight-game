// Main: boot, the game loop, and the state machine (title → flying →
// paused → end). One job: own the frame and hand every other job to its file.

import { MISSIONS, GAME_NAME } from './config.js';
import { createInput } from './input.js';
import { createFlightState, updateFlight, terrainHeightAt } from './flight.js';
import { createValley } from './terrain.js';
import { buildRingCourse, nextRing, checkRingPass } from './rings.js';
import {
  createMissionRun, updateMission, scoreRing, scoreLanding, showMessage,
} from './missions.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { renderFrame, renderTitle, renderEndScreen } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const input = createInput(canvas);
const audio = createAudio();
const valley = createValley();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotMission = MISSIONS[0];

const game = {
  mode: 'title', // title | flying | paused | end | shot
  missions: MISSIONS,
  selectedMission: 0,
  plane: null,
  run: null,
  rings: [],
  valley,
  time: 0,
  prevZ: 0,
  paused: false,
};

function startMission(index) {
  const mission = MISSIONS[index];
  game.plane = createFlightState(mission);
  game.run = createMissionRun(mission.id);
  game.rings = buildRingCourse(mission);
  game.mode = 'flying';
  game.prevZ = game.plane.z;
  audio.start();
  audio.click();
  showMessage(game.run, 'FULL THROTTLE — W TO SPOOL UP', 3.5, 0);
  announce(`${GAME_NAME}: ${mission.name}. Full throttle to take off.`);
}

function backToTitle() {
  game.mode = 'title';
  game.plane = createFlightState(MISSIONS[game.selectedMission]);
  game.run = createMissionRun(MISSIONS[game.selectedMission].id);
  game.rings = buildRingCourse(MISSIONS[game.selectedMission]);
  announce(`${GAME_NAME} title screen. Choose a mission.`);
}

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

// Attract mode: the title screen flies itself down the valley.
function updateAttract(dt) {
  const plane = game.plane;
  plane.time += dt;
  plane.z += 42 * dt;
  if (plane.z > 6200) plane.z = 0;
  plane.alt = 95 + Math.sin(plane.time * 0.25) * 22;
  plane.heading = Math.sin(plane.time * 0.12) * 8;
  plane.bank = Math.sin(plane.time * 0.12 + 0.6) * 18;
  plane.pitch = Math.cos(plane.time * 0.25) * 3;
  plane.speed = 68;
  plane.throttle = 0.7;
  plane.fuel = 80;
}

function handleTitleKeys(pressed) {
  if (pressed.has('Enter') || pressed.has('Space') || pressed.has('MouseClick')) {
    startMission(game.selectedMission);
    return;
  }
  if (pressed.has('Digit1')) game.selectedMission = 0;
  if (pressed.has('Digit2')) game.selectedMission = 1;
  if (pressed.has('Digit3')) game.selectedMission = 2;
  if (pressed.has('ArrowLeft') || pressed.has('KeyA')) {
    game.selectedMission = (game.selectedMission + 2) % 3;
  }
  if (pressed.has('ArrowRight') || pressed.has('KeyD')) {
    game.selectedMission = (game.selectedMission + 1) % 3;
  }
}

function handleFlyingKeys(pressed) {
  if (pressed.has('KeyP') || pressed.has('Escape')) {
    game.paused = !game.paused;
    announce(game.paused ? 'Paused.' : 'Flying.');
    return;
  }
  if (pressed.has('KeyM')) {
    audio.setMuted(!audio.muted);
    showMessage(game.run, audio.muted ? 'SOUND OFF' : 'SOUND ON', 1.2, game.run.elapsed);
  }
  if (pressed.has('KeyR')) startMission(game.selectedMission);
}

function handleEndKeys(pressed) {
  if (pressed.has('KeyR')) startMission(game.selectedMission);
  if (pressed.has('KeyM') || pressed.has('Escape') || pressed.has('Enter')) backToTitle();
}

function updateFlying(dt) {
  const { plane, run, rings } = game;
  const prevZ = plane.z;
  const prevVs = plane.verticalSpeed;
  const event = updateFlight(plane, input, dt, run.mission);

  // Ring passes: check the ring we are flying toward.
  const target = nextRing(rings);
  if (target && checkRingPass(target, plane, prevZ)) {
    scoreRing(run, plane);
    audio.ringChime();
    announce(`Ring ${run.ringsPassed} of ${run.mission.ringCount}.`);
  }

  // Flight events and their sounds.
  if (event === 'takeoff') {
    audio.takeoff();
    showMessage(run, 'AIRBORNE — GEAR UP, FLY THE RINGS', 2.5, run.elapsed);
  } else if (event === 'touchdown') {
    audio.touchdown();
    const bonus = scoreLanding(run, plane, Math.abs(prevVs));
    showMessage(run, `TOUCHDOWN  +${bonus}`, 2.5, run.elapsed);
  } else if (event === 'hard-landing') {
    audio.hardLanding();
    const bonus = scoreLanding(run, plane, Math.abs(prevVs));
    showMessage(run, `HARD LANDING  +${bonus} — DAMAGE TAKEN`, 2.5, run.elapsed);
  } else if (event === 'field-landing') {
    audio.hardLanding();
    showMessage(run, 'DOWN IN A FIELD — THROTTLE UP TO TRY AGAIN', 3, run.elapsed);
  } else if (event === 'crash') {
    audio.crash();
    game.mode = 'end';
  } else if (event === 'out-of-fuel' && !plane.onGround) {
    showMessage(run, 'OUT OF FUEL — GLIDE HER DOWN', 3, run.elapsed);
  }

  const endState = updateMission(run, plane, rings, dt);
  if (endState !== 'flying') {
    if (endState === 'crashed') audio.crash();
    if (endState === 'complete') audio.ringChime();
    game.mode = 'end';
    announce(`${run.headline}. Score ${run.score}.`);
  }

  audio.update(plane);
  game.prevZ = plane.z;
}

let lastNow = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  game.time += dt;
  const pressed = input.consumePressed();

  const w = window.innerWidth;
  const h = window.innerHeight;

  if (game.mode === 'title') {
    handleTitleKeys(pressed);
    if (game.mode === 'title') updateAttract(dt);
  } else if (game.mode === 'flying') {
    handleFlyingKeys(pressed);
    if (!game.paused) updateFlying(dt);
  } else if (game.mode === 'end') {
    handleEndKeys(pressed);
  }

  // --- Draw ---------------------------------------------------------------
  if (game.mode === 'title') {
    renderTitle(ctx, w, h, game);
  } else if (game.mode === 'end') {
    renderEndScreen(ctx, w, h, game);
  } else {
    renderFrame(ctx, w, h, game);
    if (game.paused) {
      ctx.fillStyle = 'rgba(8, 16, 28, 0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 40px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', w / 2, h / 2);
      ctx.font = '16px monospace';
      ctx.fillText('P to resume · R to restart · M for menu', w / 2, h / 2 + 36);
    }
  }

  requestAnimationFrame(frame);
}

// --- Boot -------------------------------------------------------------------
// A staged screenshot scene freezes the simulation for a reproducible frame.
if (shotName) {
  const staged = stageShot(shotName, shotMission);
  if (staged) {
    game.plane = staged.plane;
    game.run = staged.run;
    game.rings = staged.rings;
    game.mode = 'shot';
    // One frozen render; no loop needed, but keep the loop harmless.
    renderFrame(ctx, window.innerWidth, window.innerHeight, game);
    document.title = `${GAME_NAME} — ${shotName}`;
    // Keep rendering the same frozen frame so the shot is stable.
    requestAnimationFrame(function frozen() {
      renderFrame(ctx, window.innerWidth, window.innerHeight, game);
      requestAnimationFrame(frozen);
    });
  }
} else {
  backToTitle();
  requestAnimationFrame(frame);
}
