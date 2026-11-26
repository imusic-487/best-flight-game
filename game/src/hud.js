// HUD and instruments: altitude, speed, heading, compass, attitude indicator,
// throttle and fuel gauges, mission objective, warnings and ring guidance.
// Everything is drawn in code; the instruments are lit, never just drawn lines.

import { PALETTE, WORLD } from './config.js';
import { knots, feet } from './flight.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function label(ctx, text, x, y, size = 11) {
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.font = `600 ${size}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function readout(ctx, text, x, y, size = 26, colour = '#ffffff') {
  ctx.fillStyle = colour;
  ctx.font = `700 ${size}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

export function drawHud(ctx, w, h, plane, mission, score, ringsPassed, timeLeft, message) {
  const pad = 14;

  // --- Top-left: ALT / SPD / HDG -------------------------------------------
  panel(ctx, pad, pad, 300, 86);
  label(ctx, 'ALT', pad + 14, pad + 20);
  readout(ctx, String(Math.round(feet(plane.alt))).padStart(4, '0'), pad + 14, pad + 50, 26,
    plane.alt < 30 && !plane.onGround ? PALETTE.hudRed : '#ffffff');
  label(ctx, 'FT', pad + 118, pad + 50, 11);

  label(ctx, 'SPD', pad + 150, pad + 20);
  readout(ctx, String(Math.round(knots(plane.speed))).padStart(3, '0'), pad + 150, pad + 50, 26,
    plane.stalled ? PALETTE.hudRed : PALETTE.hudGreen);
  label(ctx, 'KT', pad + 228, pad + 50, 11);

  label(ctx, 'HDG', pad + 14, pad + 78, 11);
  readout(ctx, `${String(Math.round(((plane.heading % 360) + 360) % 360)).padStart(3, '0')}°`, pad + 62, pad + 80, 16, PALETTE.hudAmber);
  label(ctx, 'V/S', pad + 150, pad + 78, 11);
  const vs = Math.round(feet(plane.verticalSpeed) * 60);
  readout(ctx, `${vs >= 0 ? '+' : ''}${vs}`, pad + 188, pad + 80, 16, vs < -500 ? PALETTE.hudRed : '#ffffff');
  label(ctx, 'FPM', pad + 262, pad + 80, 11);

  // --- Top-centre: compass strip --------------------------------------------
  drawCompass(ctx, w, h, plane);

  // --- Top-right: mission objective -----------------------------------------
  panel(ctx, w - pad - 250, pad, 250, 86);
  label(ctx, mission.name.toUpperCase(), w - pad - 236, pad + 20);
  readout(ctx, String(score), w - pad - 236, pad + 50, 26, PALETTE.hudAmber);
  label(ctx, 'SCORE', w - pad - 236, pad + 72, 11);
  const timeColour = timeLeft < 30 ? PALETTE.hudRed : '#ffffff';
  readout(ctx, formatTime(timeLeft), w - pad - 100, pad + 50, 26, timeColour);
  label(ctx, 'TIME', w - pad - 100, pad + 72, 11);
  label(ctx, `RINGS ${ringsPassed}/${mission.ringCount}`, w - pad - 100, pad + 20, 11);

  // --- Bottom-left: throttle + fuel ------------------------------------------
  panel(ctx, pad, h - pad - 118, 92, 118);
  label(ctx, 'THR', pad + 10, h - pad - 100, 11);
  drawVerticalGauge(ctx, pad + 16, h - pad - 88, 16, 66, plane.throttle, PALETTE.hudAmber);
  label(ctx, `${Math.round(plane.throttle * 100)}%`, pad + 40, h - pad - 52, 11);
  label(ctx, 'FUEL', pad + 10, h - pad - 30, 11);
  drawFuelBar(ctx, pad + 46, h - pad - 26, 36, plane.fuel);

  // --- Bottom-right: attitude indicator --------------------------------------
  drawAttitude(ctx, w - pad - 118, h - pad - 118, 118, plane);

  // --- Warnings ---------------------------------------------------------------
  let warnY = 118;
  if (plane.stalled) drawWarning(ctx, w, warnY, 'STALL — NOSE DOWN, FULL THROTTLE');
  if (plane.stalled) warnY += 34;
  if (plane.fuel < 20 && plane.fuel > 0) drawWarning(ctx, w, warnY, 'LOW FUEL — FIND A RUNWAY');
  if (plane.fuel < 20) warnY += 34;
  if (plane.damage > 50) drawWarning(ctx, w, warnY, 'AIRFRAME DAMAGE — FLY GENTLE');
  if (plane.damage > 50) warnY += 34;
  if (!plane.onGround && plane.alt < 40 && plane.verticalSpeed < -4) {
    drawWarning(ctx, w, warnY, 'TERRAIN — PULL UP');
  }

  // --- Centre message (takeoff prompt, ring passed, etc.) ----------------------
  if (message) {
    ctx.font = '700 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10, 18, 30, 0.6)';
    const tw = ctx.measureText(message).width;
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2 - 16, h * 0.30 - 30, tw + 32, 40, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.fillText(message, w / 2, h * 0.30);
  }

  // --- Damage vignette ----------------------------------------------------------
  if (plane.damage > 0) {
    const a = Math.min(0.45, plane.damage / 220);
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.75);
    grad.addColorStop(0, 'rgba(255, 40, 20, 0)');
    grad.addColorStop(1, `rgba(255, 40, 20, ${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawWarning(ctx, w, y, text) {
  ctx.font = '700 17px monospace';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(120, 10, 5, 0.75)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - tw / 2 - 14, y, tw + 28, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#ffd2c8';
  ctx.fillText(text, w / 2, y + 20);
}

function drawCompass(ctx, w, h, plane) {
  const cx = w / 2;
  const y = 14;
  const width = 360;
  const height = 52;
  panel(ctx, cx - width / 2, y, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, y, width, height, 8);
  ctx.clip();
  const pxPerDeg = 3.6;
  const range = 40;
  const heading = ((plane.heading % 360) + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  // Tick on absolute 5-degree headings so round numbers always line up,
  // whatever the current heading is.
  const firstDeg = Math.floor((heading - range) / 5) * 5;
  const lastDeg = Math.ceil((heading + range) / 5) * 5;
  for (let absDeg = firstDeg; absDeg <= lastDeg; absDeg += 5) {
    const d = absDeg - heading;
    if (Math.abs(d) > range) continue;
    const deg = ((absDeg % 360) + 360) % 360;
    const x = cx + d * pxPerDeg;
    const isCardinal = deg % 45 === 0;
    const isNumbered = deg % 30 === 0;
    const major = isCardinal || isNumbered;
    ctx.strokeStyle = isCardinal ? PALETTE.hudAmber : 'rgba(127, 227, 255, 0.6)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 34);
    ctx.lineTo(x, y + (major ? 14 : 24));
    ctx.stroke();
    // Labels only when they fit fully inside the strip.
    if (Math.abs(d) > range - 8) continue;
    ctx.textAlign = 'center';
    if (isCardinal) {
      ctx.fillStyle = PALETTE.hudAmber;
      ctx.font = '700 14px monospace';
      ctx.fillText(dirs[Math.round(deg / 45) % 8], x, y + 48);
    } else if (isNumbered) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '12px monospace';
      ctx.fillText(String(deg).padStart(3, '0'), x, y + 48);
    }
  }
  ctx.restore();
  // Centre lubber line.
  ctx.fillStyle = PALETTE.hudRed;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y);
  ctx.lineTo(cx + 6, y);
  ctx.lineTo(cx, y + 9);
  ctx.closePath();
  ctx.fill();
}

function drawVerticalGauge(ctx, x, y, w, h, frac, colour) {
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  const fh = h * Math.max(0, Math.min(1, frac));
  ctx.fillRect(x, y + h - fh, w, fh);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(x, y, w, h);
}

function drawFuelBar(ctx, x, y, w, fuel) {
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y, w, 12);
  ctx.fillStyle = fuel < 20 ? PALETTE.hudRed : PALETTE.hudGreen;
  ctx.fillRect(x, y, w * Math.max(0, fuel / 100), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(x, y, w, 12);
}

function drawAttitude(ctx, x, y, size, plane) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2 - 4;
  ctx.save();
  panel(ctx, x, y, size, size);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // Artificial horizon: sky above, ground below, rolled with bank.
  ctx.translate(cx, cy);
  ctx.rotate(-plane.bank * Math.PI / 180);
  const pitchPx = plane.pitch * 1.6;
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r - 2, -r - 2, (r + 2) * 2, r + 2);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r - 2, 0, (r + 2) * 2, r + 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  // Pitch ladder.
  ctx.lineWidth = 1;
  for (const deg of [-20, -10, 10, 20]) {
    const ly = -deg * 1.6;
    ctx.beginPath();
    ctx.moveTo(-14, ly);
    ctx.lineTo(14, ly);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings marker and bank pointer.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#ffd24d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r + 8, 0);
  ctx.lineTo(-8, 0);
  ctx.moveTo(8, 0);
  ctx.lineTo(r - 8, 0);
  ctx.stroke();
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  label(ctx, 'ATT', x + 8, y + 14, 10);
}

// Next-ring guidance: an arrow at the screen edge pointing at the next ring.
export function drawRingGuidance(ctx, w, h, plane, ring, view) {
  if (!ring) return;
  const p = ringScreenPosition(plane, ring, view);
  if (p && p.fwd > 0 && p.x > 60 && p.x < w - 60 && p.y > 80 && p.y < h - 140) {
    // Ring is on screen: draw a small diamond marker above it.
    ctx.strokeStyle = PALETTE.hudAmber;
    ctx.lineWidth = 2;
    const s = 10;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - p.radius - 18 - s);
    ctx.lineTo(p.x + s, p.y - p.radius - 18);
    ctx.lineTo(p.x, p.y - p.radius - 18 + s);
    ctx.lineTo(p.x - s, p.y - p.radius - 18);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = '700 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(p.fwd)}m`, p.x, p.y - p.radius - 30);
    return;
  }
  // Off screen or behind: arrow at the edge pointing toward it.
  const dx = ring.x - plane.x;
  const dz = ring.z - plane.z;
  const hRad = plane.heading * Math.PI / 180;
  const fwd = dx * Math.sin(hRad) + dz * Math.cos(hRad);
  const right = dx * Math.cos(hRad) - dz * Math.sin(hRad);
  const angle = Math.atan2(right, Math.max(20, fwd));
  const ax = w / 2 + Math.sin(angle) * (w / 2 - 90);
  const ay = h * 0.45 + -Math.cos(angle) * (h * 0.28);
  ctx.save();
  ctx.translate(Math.max(50, Math.min(w - 50, ax)), Math.max(90, Math.min(h - 160, ay)));
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(11, 10);
  ctx.lineTo(0, 4);
  ctx.lineTo(-11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = '700 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`NEXT RING ${Math.round(Math.hypot(dx, dz))}m`, w / 2, h - 24);
}

export function ringScreenPosition(plane, ring, view) {
  const hRad = plane.heading * Math.PI / 180;
  const dx = ring.x - plane.x;
  const dz = ring.z - plane.z;
  const fwd = dx * Math.sin(hRad) + dz * Math.cos(hRad);
  const right = dx * Math.cos(hRad) - dz * Math.sin(hRad);
  if (fwd < 8) return null;
  const scale = view.focal / fwd;
  const camAlt = plane.alt + 3;
  return {
    x: view.cx + right * scale,
    y: view.horizonY + (camAlt - ring.alt) * scale,
    radius: ring.radius * scale,
    fwd,
    scale,
  };
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
