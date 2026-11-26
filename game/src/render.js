// Render: one job, compose a frame — sky, ground, rings, aircraft shadow,
// aircraft, HUD — in the right order, with the camera banked with the plane.

import { drawSky, drawGround, project } from './terrain.js';
import { drawAircraft, drawAircraftShadow } from './aircraft.js';
import { drawRings, nextRing } from './rings.js';
import { drawHud, drawRingGuidance } from './hud.js';
import { gradeFor } from './missions.js';
import { PALETTE } from './config.js';

export function renderFrame(ctx, w, h, game) {
  const { plane, valley, rings, run, time } = game;
  const horizonY = h * 0.42 - plane.pitch * 6;
  const view = { cx: w / 2, horizonY, focal: 900 };

  ctx.save();
  // The camera rolls gently with the bank so the world feels alive.
  ctx.translate(w / 2, h * 0.5);
  ctx.rotate(-plane.bank * Math.PI / 180 * 0.12);
  ctx.translate(-w / 2, -h * 0.5);

  drawSky(ctx, w, h, plane, valley, time);
  drawGround(ctx, w, h, plane, valley, horizonY);
  drawRings(ctx, plane, rings, view, time);
  drawAircraftShadow(ctx, plane, project, view);
  ctx.restore();

  // Aircraft and HUD are drawn unrotated so the pilot can always read them.
  const planeY = h * 0.66;
  const planeWidth = Math.min(300, w * 0.24);
  drawAircraft(ctx, w / 2, planeY, planeWidth, plane, time);

  if (game.mode === 'flying' || game.mode === 'shot') {
    const target = nextRing(rings);
    drawRingGuidance(ctx, w, h, plane, target, view);
    const message = run.message && time < run.messageUntil ? run.message : '';
    drawHud(ctx, w, h, plane, run.mission, run.score, run.ringsPassed, run.timeLeft, message);
  }
}

// Title screen: the game world flies itself behind the menu (attract mode).
export function renderTitle(ctx, w, h, game) {
  const { plane, valley, rings, time } = game;
  const horizonY = h * 0.42 - plane.pitch * 6;
  const view = { cx: w / 2, horizonY, focal: 900 };
  drawSky(ctx, w, h, plane, valley, time);
  drawGround(ctx, w, h, plane, valley, horizonY);
  drawRings(ctx, plane, rings, view, time);
  drawAircraft(ctx, w / 2, h * 0.66, Math.min(300, w * 0.24), plane, time);

  // Dim the world so the menu reads.
  ctx.fillStyle = 'rgba(8, 16, 28, 0.45)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3c4';
  ctx.font = '700 64px Georgia, serif';
  ctx.fillText('SKYLINE VALLEY', w / 2, h * 0.22);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = '700 26px monospace';
  ctx.fillText('— RING RUNNER —', w / 2, h * 0.22 + 44);

  ctx.fillStyle = '#eaf6ff';
  ctx.font = '17px monospace';
  ctx.fillText('Fly the valley. Thread the rings. Bring her home.', w / 2, h * 0.22 + 84);

  // Mission cards.
  const cardW = 300;
  const cardH = 118;
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const startX = (w - totalW) / 2;
  const cardY = h * 0.44;
  game.missions.forEach((mission, i) => {
    const x = startX + i * (cardW + gap);
    const selected = i === game.selectedMission;
    ctx.fillStyle = selected ? 'rgba(255, 179, 71, 0.22)' : 'rgba(10, 18, 30, 0.62)';
    ctx.strokeStyle = selected ? PALETTE.hudAmber : PALETTE.panelEdge;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, cardY, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = '700 20px monospace';
    ctx.fillText(`${mission.key} · ${mission.name}`, w / 2 + (x + cardW / 2 - w / 2), cardY + 34);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '14px monospace';
    wrapText(ctx, mission.blurb, x + cardW / 2, cardY + 62, cardW - 28, 20);
    ctx.fillStyle = 'rgba(234, 246, 255, 0.75)';
    ctx.font = '13px monospace';
    ctx.fillText(
      `${mission.ringCount} rings · ${Math.floor(mission.timeLimit / 60)}:${String(mission.timeLimit % 60).padStart(2, '0')} · fuel ${mission.fuelStart}`,
      x + cardW / 2, cardY + 100,
    );
  });

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 18px monospace';
  const blink = Math.floor(time * 1.4) % 2 === 0;
  if (blink) ctx.fillText('PRESS ENTER OR CLICK TO FLY', w / 2, cardY + cardH + 52);
  ctx.fillStyle = 'rgba(234, 246, 255, 0.85)';
  ctx.font = '14px monospace';
  ctx.fillText('↑↓ pitch · ←→ bank · W/S throttle · mouse steers · SPACE airbrake · P pause · M mute', w / 2, cardY + cardH + 84);
  ctx.fillText('Take off from the runway, fly the rings in order, land back on the runway for the score.', w / 2, cardY + cardH + 108);
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, ly);
      line = word;
      ly += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, cx, ly);
}

// End screens: mission complete, crashed, out of fuel, timed out.
export function renderEndScreen(ctx, w, h, game) {
  const { run } = game;
  // Keep the last frame of the world behind the panel.
  renderFrame(ctx, w, h, { ...game, mode: 'flying' });
  ctx.fillStyle = 'rgba(8, 16, 28, 0.55)';
  ctx.fillRect(0, 0, w, h);

  const panelW = 560;
  const panelH = 430;
  const x = (w - panelW) / 2;
  const y = (h - panelH) / 2;
  ctx.fillStyle = 'rgba(10, 18, 30, 0.88)';
  ctx.strokeStyle = run.state === 'complete' ? PALETTE.hudAmber : PALETTE.hudRed;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, panelW, panelH, 14);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = run.state === 'complete' ? PALETTE.hudAmber : PALETTE.hudRed;
  ctx.font = '700 34px monospace';
  ctx.fillText(run.headline || 'SORTIE OVER', w / 2, y + 56);

  if (run.state === 'complete') {
    ctx.fillStyle = '#fff3c4';
    ctx.font = '700 58px Georgia, serif';
    ctx.fillText(`GRADE ${gradeFor(run)}`, w / 2, y + 122);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 30px monospace';
  ctx.fillText(`SCORE  ${run.score}`, w / 2, y + 168);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#cfe8ff';
  ctx.font = '15px monospace';
  let ly = y + 208;
  for (const line of run.breakdown.slice(-8)) {
    ctx.fillText(line, x + 40, ly);
    ly += 24;
  }
  if (run.landingQuality) {
    ctx.fillStyle = PALETTE.hudGreen;
    ctx.fillText(
      `Landing: ${run.landingQuality.centreOffset}m off centre, sink ${run.landingQuality.sinkRate} m/s — bonus ${run.landingQuality.bonus}`,
      x + 40, ly + 4,
    );
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 17px monospace';
  const blink = Math.floor(game.time * 1.4) % 2 === 0;
  if (blink) ctx.fillText('R — FLY AGAIN    M — CHANGE MISSION', w / 2, y + panelH - 28);
}
