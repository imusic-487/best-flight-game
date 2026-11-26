// Rings: the course itself — where each ring hangs, how it is drawn, and
// whether the aircraft just flew through it.

import { mulberry32 } from './terrain.js';
import { ringScreenPosition } from './hud.js';
import { WORLD } from './config.js';

// Build the ring course for a mission. Rings snake down the valley so the
// pilot has to bank, climb and descend — never just fly straight.
export function buildRingCourse(mission, seed = 777) {
  const random = mulberry32(seed + mission.ringCount * 131);
  const rings = [];
  const span = mission.id === 'landing' ? 2400 : WORLD.farAirfieldZ - 900;
  for (let i = 0; i < mission.ringCount; i++) {
    const t = (i + 1) / (mission.ringCount + 1);
    const z = 700 + t * span;
    const lateral = Math.sin(t * Math.PI * 2.2) * 150 + (random() - 0.5) * 90;
    const alt = 55 + Math.sin(t * Math.PI * 3.1) * 42 + random() * 30;
    rings.push({
      index: i,
      x: Math.max(-260, Math.min(260, lateral)),
      z,
      alt: Math.max(28, Math.min(190, alt)),
      radius: 24,
      passed: false,
    });
  }
  return rings;
}

// The next ring the pilot must fly through, or null when the course is done.
export function nextRing(rings) {
  return rings.find((ring) => !ring.passed) ?? null;
}

// Check whether the aircraft crossed the ring plane this frame.
// prevZ / z bracket the ring's z; lateral and vertical offsets must be inside.
export function checkRingPass(ring, plane, prevZ) {
  if (!ring || ring.passed) return false;
  const crossed = prevZ < ring.z && plane.z >= ring.z;
  if (!crossed) return false;
  const dx = plane.x - ring.x;
  const dy = plane.alt - ring.alt;
  const dist = Math.hypot(dx, dy);
  if (dist <= ring.radius) {
    ring.passed = true;
    return true;
  }
  return false;
}

// Draw every unpassed ring ahead of the aircraft, nearest last.
export function drawRings(ctx, plane, rings, view, time) {
  const upcoming = rings.filter((ring) => !ring.passed && ring.z > plane.z - 20);
  upcoming.sort((a, b) => b.z - a.z); // far first, near paints over
  const target = nextRing(rings);
  for (const ring of upcoming) {
    drawRing(ctx, plane, ring, view, time, ring === target);
  }
}

function drawRing(ctx, plane, ring, view, time, isNext) {
  const p = ringScreenPosition(plane, ring, view);
  if (!p || p.radius < 3) return;
  const pulse = 0.75 + 0.25 * Math.sin(time * 3 + ring.index);
  const glowColour = isNext ? '255, 179, 71' : '127, 227, 255';

  // Outer glow halo.
  ctx.strokeStyle = `rgba(${glowColour}, ${0.35 * pulse})`;
  ctx.lineWidth = Math.max(2, p.radius * 0.22);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, p.radius, p.radius * 0.92, 0, 0, Math.PI * 2);
  ctx.stroke();

  // The ring itself: two-tone chequered band.
  const segments = 16;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? '#ffcf5e' : '#ffffff';
    ctx.lineWidth = Math.max(2, p.radius * 0.13);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.radius, p.radius * 0.92, 0, a0, a1);
    ctx.stroke();
  }

  // Ring number, floating above the ring (never a giant when close).
  // The next ring gets the guidance diamond instead, so skip its number.
  if (p.radius > 14 && p.radius < 110 && !isNext) {
    ctx.fillStyle = isNext ? '#ffcf5e' : '#dff6ff';
    ctx.font = `700 ${Math.max(12, Math.min(26, p.radius * 0.5))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(String(ring.index + 1), p.x, p.y - p.radius - 10);
  }
}
