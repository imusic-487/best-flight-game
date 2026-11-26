// Aircraft: the plane itself, drawn in code as a built-looking machine seen
// from behind and slightly above — fuselage, wings, tail, canopy and lights.
// One job: given the flight state, paint the aircraft at its screen spot.

import { PALETTE } from './config.js';

// Draw the aircraft centred at (cx, cy) with the given pixel width.
// bank rotates the airframe, pitch nudges it, throttle drives the exhaust glow.
export function drawAircraft(ctx, cx, cy, width, plane, time) {
  const scale = width / 240;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * Math.PI / 180 * 0.9);
  ctx.translate(0, -plane.pitch * scale * 0.9);

  // Soft shadow on the ground below (only when low).
  // (Drawn by the caller via drawAircraftShadow when the plane is airborne.)

  // Exhaust glow at full throttle.
  if (plane.throttle > 0.55 && !plane.onGround) {
    const glow = ctx.createRadialGradient(0, 34 * scale, 2, 0, 34 * scale, 26 * scale);
    glow.addColorStop(0, `rgba(255, 180, 80, ${0.5 * plane.throttle})`);
    glow.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 34 * scale, 26 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Main wings: swept, with aileron seams and tip lights.
  drawWing(ctx, scale, -1);
  drawWing(ctx, scale, 1);

  // Tailplane (horizontal stabiliser) and fin, tucked against the fuselage.
  ctx.fillStyle = '#c65a2e';
  ctx.beginPath();
  ctx.moveTo(-32 * scale, 22 * scale);
  ctx.lineTo(-56 * scale, 38 * scale);
  ctx.lineTo(-50 * scale, 44 * scale);
  ctx.lineTo(-18 * scale, 32 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(32 * scale, 22 * scale);
  ctx.lineTo(56 * scale, 38 * scale);
  ctx.lineTo(50 * scale, 44 * scale);
  ctx.lineTo(18 * scale, 32 * scale);
  ctx.closePath();
  ctx.fill();

  // Vertical fin with the valley stripe.
  ctx.fillStyle = '#e8703a';
  ctx.beginPath();
  ctx.moveTo(-7 * scale, 30 * scale);
  ctx.lineTo(-10 * scale, 2 * scale);
  ctx.lineTo(-2 * scale, -12 * scale);
  ctx.lineTo(8 * scale, -10 * scale);
  ctx.lineTo(7 * scale, 30 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(-8 * scale, 12 * scale, 15 * scale, 3.5 * scale);

  // Fuselage: tapered body with a cream top and orange belly.
  const body = ctx.createLinearGradient(0, -14 * scale, 0, 40 * scale);
  body.addColorStop(0, '#ffe9b8');
  body.addColorStop(0.45, '#f2a54a');
  body.addColorStop(1, '#c65a2e');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-13 * scale, -14 * scale);
  ctx.quadraticCurveTo(-17 * scale, 12 * scale, -9 * scale, 40 * scale);
  ctx.quadraticCurveTo(0, 46 * scale, 9 * scale, 40 * scale);
  ctx.quadraticCurveTo(17 * scale, 12 * scale, 13 * scale, -14 * scale);
  ctx.quadraticCurveTo(0, -22 * scale, -13 * scale, -14 * scale);
  ctx.closePath();
  ctx.fill();

  // Canopy: dark glass with a sky highlight.
  ctx.fillStyle = '#1d3a52';
  ctx.beginPath();
  ctx.ellipse(0, -2 * scale, 9 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 230, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(-3 * scale, -6 * scale, 3.5 * scale, 6 * scale, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Panel lines and rivets along the fuselage.
  ctx.strokeStyle = 'rgba(120, 50, 10, 0.5)';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(-11 * scale, 8 * scale);
  ctx.lineTo(11 * scale, 8 * scale);
  ctx.moveTo(-10 * scale, 24 * scale);
  ctx.lineTo(10 * scale, 24 * scale);
  ctx.stroke();

  // Navigation lights: red left, green right, white tail strobe.
  drawNavLight(ctx, -118 * scale, 6 * scale, '#ff4d3d', time, 0);
  drawNavLight(ctx, 118 * scale, 6 * scale, '#39ff7a', time, 0.5);
  const strobe = (time % 1.2) < 0.12;
  if (strobe) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(0, 46 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wingtip vortices: faint trailing wisps when the pilot banks hard.
  if (Math.abs(plane.bank) > 28 && !plane.onGround) {
    const strength = (Math.abs(plane.bank) - 28) / 34;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * strength})`;
    ctx.lineWidth = 2.5 * scale;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 116 * scale, 8 * scale);
      ctx.quadraticCurveTo(
        side * 128 * scale, 26 * scale,
        side * (116 + Math.sin(time * 2 + side) * 6) * scale, 44 * scale,
      );
      ctx.stroke();
    }
  }

  // Damage smoke: thin grey puffs from the engine when hurt.
  if (plane.damage > 25) {
    const puffs = Math.floor((plane.damage - 25) / 25);
    ctx.fillStyle = `rgba(60, 60, 60, ${0.25 + plane.damage / 300})`;
    for (let i = 0; i < puffs; i++) {
      const t = (time * 0.7 + i * 0.33) % 1;
      const px = Math.sin(i * 7.3 + time) * 8 * scale;
      ctx.beginPath();
      ctx.arc(px, (40 - t * 46) * scale, (4 + t * 14) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawWing(ctx, scale, side) {
  // side: -1 left, +1 right. Wings sweep slightly back toward the tail.
  ctx.fillStyle = side < 0 ? '#e8703a' : '#f07a42';
  ctx.beginPath();
  ctx.moveTo(10 * side * scale, -6 * scale);
  ctx.lineTo(116 * side * scale, 2 * scale);
  ctx.lineTo(120 * side * scale, 12 * scale);
  ctx.lineTo(14 * side * scale, 16 * scale);
  ctx.closePath();
  ctx.fill();
  // Aileron seam.
  ctx.strokeStyle = 'rgba(120, 50, 10, 0.45)';
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(96 * side * scale, 4 * scale);
  ctx.lineTo(98 * side * scale, 12 * scale);
  ctx.stroke();
  // Wingtip stripe.
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.moveTo(108 * side * scale, 2.5 * scale);
  ctx.lineTo(116 * side * scale, 3.5 * scale);
  ctx.lineTo(117 * side * scale, 10 * scale);
  ctx.lineTo(109 * side * scale, 9 * scale);
  ctx.closePath();
  ctx.fill();
}

function drawNavLight(ctx, x, y, colour, time, phase) {
  const pulse = 0.65 + 0.35 * Math.sin(time * 4 + phase * Math.PI * 2);
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 12);
  glow.addColorStop(0, colour);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = pulse;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

// A soft ellipse on the ground under the aircraft, so low flight reads as height.
export function drawAircraftShadow(ctx, plane, project, view) {
  if (plane.alt > 160) return;
  const ground = project(plane, { x: plane.x, z: plane.z + 6, alt: 0 }, view);
  if (!ground) return;
  const alpha = Math.max(0, 0.28 * (1 - plane.alt / 160));
  ctx.fillStyle = `rgba(20, 30, 20, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, 60 * ground.scale, 12 * ground.scale, 0, 0, Math.PI * 2);
  ctx.fill();
}
