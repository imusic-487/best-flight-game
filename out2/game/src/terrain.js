// Terrain: the valley itself — sky, mountain ridges, fields, river, town and
// both runways, all projected from world space into the chase view.
// Deterministic: one seeded generator, so the same valley shows every run.

import { PALETTE, WORLD } from './config.js';

const DEG = Math.PI / 180;

// Small seeded RNG (mulberry32) so the valley never changes between runs.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// River centreline meanders down the valley.
export function riverXAt(z) {
  return Math.sin(z * 0.0011) * 130 + Math.sin(z * 0.00037 + 1.7) * 90;
}

// Field strip colour for a lateral band at a given distance.
// Deterministic hash of band+row so the same field is the same colour every frame.
function fieldColour(x, z) {
  const band = Math.floor((x + 2000) / 130);
  const row = Math.floor(z / 260);
  let n = (band * 374761393 + row * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  const pick = ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  if (pick < 0.34) return PALETTE.fieldGreen;
  if (pick < 0.55) return PALETTE.fieldGold;
  if (pick < 0.78) return PALETTE.fieldDark;
  return PALETTE.fieldPlough;
}

export function createValley(seed = 20261126) {
  const random = mulberry32(seed);
  // Town houses: fixed positions around z = 3500, east of the river.
  const houses = [];
  for (let i = 0; i < 42; i++) {
    houses.push({
      x: 60 + random() * 260,
      z: 3300 + random() * 420,
      w: 14 + random() * 16,
      d: 12 + random() * 12,
      h: 8 + random() * 10,
    });
  }
  // Mountain ridge peaks for the two background layers.
  const ridgeFar = [];
  const ridgeNear = [];
  for (let i = 0; i < 26; i++) ridgeFar.push(0.35 + random() * 0.65);
  for (let i = 0; i < 20; i++) ridgeNear.push(0.25 + random() * 0.75);
  // Clouds: fixed sky positions.
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    clouds.push({
      x: random() * 2 - 1, // -1..1 across the sky
      y: 0.05 + random() * 0.3, // fraction down from the top
      s: 0.6 + random() * 1.1,
      speed: 0.004 + random() * 0.008,
    });
  }
  return { houses, ridgeFar, ridgeNear, clouds, random };
}

// Project a world point into screen space. Returns null when behind the camera.
export function project(plane, point, view) {
  const hRad = plane.heading * DEG;
  const dx = point.x - plane.x;
  const dz = point.z - plane.z;
  const fwd = dx * Math.sin(hRad) + dz * Math.cos(hRad);
  const right = dx * Math.cos(hRad) - dz * Math.sin(hRad);
  if (fwd < 6) return null;
  const scale = view.focal / fwd;
  const camAlt = plane.alt + 3;
  return {
    x: view.cx + right * scale,
    y: view.horizonY + (camAlt - point.alt) * scale,
    scale,
    fwd,
  };
}

export function drawSky(ctx, w, h, plane, valley, time) {
  const horizonY = h * 0.42 - plane.pitch * 6;
  const grad = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, PALETTE.skyMid);
  grad.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, horizonY + 2);

  // Sun, low and warm, drifting slowly with heading.
  const sunX = w * 0.72 - plane.heading * 6;
  const sunY = h * 0.16;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
  sunGrad.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
  sunGrad.addColorStop(0.25, 'rgba(255, 220, 150, 0.55)');
  sunGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(sunX - 100, sunY - 100, 200, 200);
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
  ctx.fill();

  // Clouds drift with heading and time. Each puff is its own fill so the
  // overlapping ellipses merge into one soft shape.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  for (const cloud of valley.clouds) {
    const cx = ((cloud.x - plane.heading * 0.004 + time * cloud.speed) % 2 + 2) % 2;
    const px = cx * w;
    const py = cloud.y * h;
    const s = cloud.s * w / 22;
    ctx.beginPath();
    ctx.ellipse(px, py, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px - s * 0.7, py + s * 0.1, s * 0.6, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + s * 0.7, py + s * 0.08, s * 0.65, s * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mountain ridges: silhouettes that slide with heading (parallax).
  drawRidge(ctx, w, h, horizonY, valley.ridgeFar, plane.heading, 0.35, PALETTE.mountainFar, 0.16);
  drawRidge(ctx, w, h, horizonY, valley.ridgeNear, plane.heading, 0.8, PALETTE.mountainNear, 0.1);
  return horizonY;
}

function drawRidge(ctx, w, h, horizonY, peaks, heading, parallax, colour, heightFrac) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(-4, horizonY + 2);
  const step = w / (peaks.length - 1);
  for (let i = 0; i < peaks.length; i++) {
    const px = i * step - ((heading * parallax * 8) % (w * 0.6));
    const py = horizonY - peaks[i] * h * heightFrac;
    ctx.lineTo(px, py);
    ctx.lineTo(px + step / 2, horizonY - peaks[i] * h * heightFrac * 0.55);
  }
  ctx.lineTo(w + 4, horizonY + 2);
  ctx.closePath();
  ctx.fill();
  // Snow caps on the far ridge.
  if (colour === PALETTE.mountainFar) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < peaks.length; i += 2) {
      const px = i * step - ((heading * parallax * 8) % (w * 0.6));
      const py = horizonY - peaks[i] * h * heightFrac;
      ctx.beginPath();
      ctx.moveTo(px - 14, py + 12);
      ctx.lineTo(px, py - 2);
      ctx.lineTo(px + 14, py + 12);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function drawGround(ctx, w, h, plane, valley, horizonY) {
  const view = { cx: w / 2, horizonY, focal: 900 };
  const groundTop = horizonY;
  // Base ground colour below the horizon.
  ctx.fillStyle = PALETTE.fieldDark;
  ctx.fillRect(0, groundTop, w, h - groundTop);

  const step = 120; // metres per ground slice
  const far = 3200;
  const startZ = Math.max(-200, Math.floor((plane.z - 80) / step) * step);
  // Draw far to near so near slices paint over far ones.
  for (let z = plane.z + far; z >= startZ; z -= step) {
    drawGroundSlice(ctx, plane, view, z, z + step, valley, w, h);
  }
  // Town houses and runway lights sit on top of the ground slices.
  drawHouses(ctx, plane, view, valley);
  drawRunway(ctx, plane, view, 0, 'SKYLINE');
  drawRunway(ctx, plane, view, WORLD.farAirfieldZ, 'VALLEY');
}

function drawGroundSlice(ctx, plane, view, z0, z1, valley, w, h) {
  const pNear0 = project(plane, { x: -WORLD.valleyHalfWidth - 160, z: z0, alt: 0 }, view);
  const pFar0 = project(plane, { x: -WORLD.valleyHalfWidth - 160, z: z1, alt: 0 }, view);
  if (!pNear0 || !pFar0) return;
  // Lateral bands: left hills, left fields, river, right fields, right hills.
  const bands = [
    { x0: -WORLD.valleyHalfWidth - 160, x1: -WORLD.valleyHalfWidth, colour: PALETTE.mountainNear },
    { x0: -WORLD.valleyHalfWidth, x1: riverXAt(z0) - 26, colour: null }, // fields
    { x0: riverXAt(z0) - 26, x1: riverXAt(z0) + 26, colour: PALETTE.river },
    { x0: riverXAt(z0) + 26, x1: WORLD.valleyHalfWidth, colour: null }, // fields
    { x0: WORLD.valleyHalfWidth, x1: WORLD.valleyHalfWidth + 160, colour: PALETTE.mountainNear },
  ];
  for (const band of bands) {
    const a = project(plane, { x: band.x0, z: z0, alt: 0 }, view);
    const b = project(plane, { x: band.x1, z: z0, alt: 0 }, view);
    const c = project(plane, { x: band.x1, z: z1, alt: 0 }, view);
    const d = project(plane, { x: band.x0, z: z1, alt: 0 }, view);
    if (!a || !b || !c || !d) continue;
    let colour = band.colour;
    if (!colour) colour = fieldColour((band.x0 + band.x1) / 2, z0);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }
  // Field hedgerows: a thin dark line along the slice edge.
  const e0 = project(plane, { x: -WORLD.valleyHalfWidth, z: z0, alt: 0 }, view);
  const e1 = project(plane, { x: WORLD.valleyHalfWidth, z: z0, alt: 0 }, view);
  if (e0 && e1 && e0.y < h) {
    ctx.strokeStyle = 'rgba(30, 60, 25, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e0.x, e0.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.stroke();
  }
}

function drawHouses(ctx, plane, view, valley) {
  for (const house of valley.houses) {
    const base = project(plane, { x: house.x, z: house.z, alt: 0 }, view);
    if (!base || base.fwd > 2600) continue;
    const s = base.scale;
    const wpx = house.w * s;
    const hpx = house.h * s;
    if (wpx < 2) continue;
    ctx.fillStyle = PALETTE.townWall;
    ctx.fillRect(base.x - wpx / 2, base.y - hpx, wpx, hpx);
    ctx.fillStyle = PALETTE.townRoof;
    ctx.beginPath();
    ctx.moveTo(base.x - wpx / 2 - 2, base.y - hpx);
    ctx.lineTo(base.x, base.y - hpx - wpx * 0.45);
    ctx.lineTo(base.x + wpx / 2 + 2, base.y - hpx);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRunway(ctx, plane, view, zStart, label) {
  const zEnd = zStart + WORLD.runwayLength;
  if (plane.z > zEnd + 60) return; // behind us
  const step = 65;
  for (let z = Math.max(zStart, plane.z - 60); z < zEnd; z += step) {
    const z1 = Math.min(z + step, zEnd);
    const a = project(plane, { x: -WORLD.runwayHalfWidth, z, alt: 0 }, view);
    const b = project(plane, { x: WORLD.runwayHalfWidth, z, alt: 0 }, view);
    const c = project(plane, { x: WORLD.runwayHalfWidth, z: z1, alt: 0 }, view);
    const d = project(plane, { x: -WORLD.runwayHalfWidth, z: z1, alt: 0 }, view);
    if (!a || !b || !c || !d) continue;
    ctx.fillStyle = PALETTE.runway;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes.
    const m0 = project(plane, { x: -1.5, z: z + step * 0.15, alt: 0 }, view);
    const m1 = project(plane, { x: 1.5, z: z + step * 0.15, alt: 0 }, view);
    const m2 = project(plane, { x: 1.5, z: z + step * 0.55, alt: 0 }, view);
    const m3 = project(plane, { x: -1.5, z: z + step * 0.55, alt: 0 }, view);
    if (m0 && m1 && m2 && m3) {
      ctx.fillStyle = PALETTE.runwayMark;
      ctx.beginPath();
      ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.lineTo(m3.x, m3.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Threshold chevrons at the near end.
  const t = project(plane, { x: 0, z: zStart + 8, alt: 0 }, view);
  if (t && t.fwd < 2400) {
    ctx.fillStyle = PALETTE.runwayMark;
    ctx.font = `bold ${Math.max(10, t.scale * 9)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, t.x, t.y - t.scale * 4);
  }
  // Edge lights: small glowing dots along both edges, only at a distance
  // where they read as lights rather than blobs.
  for (let z = zStart + 20; z < zEnd; z += 90) {
    for (const side of [-1, 1]) {
      const p = project(plane, { x: side * (WORLD.runwayHalfWidth + 3), z, alt: 0 }, view);
      if (!p || p.fwd > 2600 || p.fwd < 150) continue;
      ctx.fillStyle = 'rgba(255, 220, 120, 0.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, Math.min(4, p.scale * 0.9)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
