// Flat, print-style sprites drawn straight onto the 2D canvas. Every sprite is
// anchored at its feet: (x, y) is the ground point in screen pixels and u is
// pixels per metre. Heights are squashed by K for the high three-quarter view.
import { RED, RED_DK, INK, CREAM, CREAM_DK, OLIVE, OLIVE_DK, PINK, TEAL, MUSTARD, ORANGE, FONT } from './palette.js';

export const K = 0.8;

function shadow(ctx, x, y, rx, ry, a = 0.22) {
  ctx.fillStyle = `rgba(23,19,15,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function poly(ctx, pts, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function line(ctx, x0, y0, x1, y1, color, w, cap = 'round') {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function rrect(ctx, x, y, w, h, r, fill, stroke, lw) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- Gurry

function keyboard(ctx, x, y, u, broken, t) {
  const w = 0.78 * u;
  const h = 0.22 * u;
  const draw = (x0, w0, rot, cx) => {
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(rot);
    rrect(ctx, x0, -h / 2, w0, h, 0.04 * u, TEAL, INK, 0.035 * u);
    ctx.fillStyle = CREAM;
    const keys = Math.round(w0 / (0.075 * u));
    for (let i = 0; i < keys; i++) ctx.fillRect(x0 + 0.03 * u + i * 0.075 * u, -h / 2 + 0.07 * u, 0.05 * u, h * 0.55);
    ctx.restore();
  };
  if (!broken) {
    draw(-w / 2, w, -0.12, x);
  } else {
    const wob = Math.sin(t * 14) * 0.08;
    draw(-w * 0.5, w * 0.48, -0.35 + wob, x - 0.06 * u);
    draw(0, w * 0.48, 0.3 - wob, x + 0.1 * u);
    // the crack
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.025 * u;
    ctx.beginPath();
    ctx.moveTo(x + 0.02 * u, y - h);
    ctx.lineTo(x - 0.03 * u, y - h * 0.3);
    ctx.lineTo(x + 0.04 * u, y + h * 0.2);
    ctx.stroke();
  }
}

export function drawGurry(ctx, x, y, u, st) {
  const { phase, z, fallen, broken, glueing, flash, t } = st;
  shadow(ctx, x, y, 0.42 * u * (1 - z * 0.25), 0.15 * u * (1 - z * 0.25));
  if (flash && Math.floor(t * 18) % 2) return;

  if (fallen) {
    drawGurryFallen(ctx, x, y, u, t);
    return;
  }

  const y0 = y - z * u * K;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const bob = Math.abs(c) * 0.05 * u * (z > 0 ? 0 : 1);
  const hip = y0 - 0.86 * u * K - bob;
  const sh = y0 - 1.5 * u * K - bob;

  // legs
  const legW = 0.17 * u;
  const lift = (p) => (z > 0 ? 0.18 * u : Math.max(0, p) * 0.28 * u);
  for (const side of [-1, 1]) {
    const p = side < 0 ? s : -s;
    const fx = x + side * 0.13 * u;
    const fy = y0 - lift(p);
    line(ctx, x + side * 0.1 * u, hip, fx, fy - 0.06 * u, INK, legW, 'butt');
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(fx, fy - 0.03 * u, 0.1 * u, 0.06 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.03 * u;
    ctx.stroke();
  }

  // swinging right arm (behind the body when it swings back)
  const armSwing = s * 0.22 * u;
  line(ctx, x + 0.28 * u, sh + 0.08 * u, x + 0.38 * u, sh + 0.5 * u * K + armSwing * 0.4, INK, 0.17 * u);
  line(ctx, x + 0.28 * u, sh + 0.08 * u, x + 0.38 * u, sh + 0.5 * u * K + armSwing * 0.4, PINK, 0.12 * u);

  // windbreaker
  const jw = 0.34 * u;
  poly(ctx, [x - jw, sh + 0.04 * u, x + jw, sh + 0.04 * u, x + jw * 0.92, hip + 0.06 * u, x - jw * 0.92, hip + 0.06 * u], PINK, INK, 0.04 * u);
  // teal yoke and mustard flash, very 1988
  poly(ctx, [x - jw, sh + 0.04 * u, x + jw, sh + 0.04 * u, x + jw * 0.98, sh + 0.2 * u, x - jw * 0.98, sh + 0.28 * u], TEAL);
  poly(ctx, [x - jw * 0.97, sh + 0.34 * u, x + jw * 0.97, sh + 0.22 * u, x + jw * 0.96, sh + 0.3 * u, x - jw * 0.96, sh + 0.42 * u], MUSTARD);
  line(ctx, x, sh + 0.3 * u, x, hip + 0.04 * u, RED_DK, 0.02 * u);
  rrect(ctx, x - jw * 0.92, hip - 0.02 * u, jw * 1.84, 0.08 * u, 0.02 * u, TEAL, INK, 0.03 * u);

  // left arm hugging the keyboard
  const kx = x - 0.36 * u;
  const ky = hip - 0.12 * u;
  keyboard(ctx, kx, ky, u, broken.has('keyboard'), t);
  line(ctx, x - 0.28 * u, sh + 0.08 * u, kx + 0.05 * u, ky - 0.04 * u, INK, 0.17 * u);
  line(ctx, x - 0.28 * u, sh + 0.08 * u, kx + 0.05 * u, ky - 0.04 * u, PINK, 0.12 * u);

  // the hair: long, dark, blown back
  const hy = sh - 0.2 * u;
  const sway = Math.sin(phase * 0.5 + 0.6) * 0.05 * u;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - 0.17 * u, hy - 0.06 * u);
  ctx.quadraticCurveTo(x - 0.24 * u, hy - 0.32 * u, x, hy - 0.33 * u);
  ctx.quadraticCurveTo(x + 0.24 * u, hy - 0.32 * u, x + 0.18 * u, hy - 0.06 * u);
  ctx.quadraticCurveTo(x + 0.3 * u + sway, hy + 0.18 * u, x + 0.24 * u + sway * 1.6, hy + 0.42 * u);
  ctx.lineTo(x + 0.12 * u + sway, hy + 0.36 * u);
  ctx.lineTo(x + 0.04 * u + sway * 1.8, hy + 0.47 * u);
  ctx.lineTo(x - 0.06 * u + sway, hy + 0.36 * u);
  ctx.lineTo(x - 0.16 * u + sway * 1.6, hy + 0.45 * u);
  ctx.quadraticCurveTo(x - 0.3 * u + sway, hy + 0.18 * u, x - 0.17 * u, hy - 0.06 * u);
  ctx.fill();
  // carved highlight strands, like the cut marks on the sleeve
  ctx.strokeStyle = CREAM_DK;
  ctx.lineWidth = 0.018 * u;
  ctx.beginPath();
  ctx.moveTo(x - 0.06 * u, hy - 0.26 * u);
  ctx.quadraticCurveTo(x - 0.14 * u, hy + 0.02 * u, x - 0.1 * u + sway, hy + 0.3 * u);
  ctx.moveTo(x + 0.07 * u, hy - 0.24 * u);
  ctx.quadraticCurveTo(x + 0.15 * u, hy + 0.04 * u, x + 0.13 * u + sway, hy + 0.26 * u);
  ctx.stroke();

  if (glueing > 0) {
    // glue going on: cream dribbles round the broken thing
    ctx.fillStyle = CREAM;
    for (let i = 0; i < 5; i++) {
      const a = t * 9 + i * 1.3;
      ctx.beginPath();
      ctx.arc(kx + Math.cos(a) * 0.28 * u, ky + Math.sin(a) * 0.14 * u - 0.1 * u, 0.045 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGurryFallen(ctx, x, y, u, t) {
  // flat on his front, hair everywhere, keyboard skidded off
  const yb = y - 0.12 * u;
  rrect(ctx, x - 0.55 * u, yb - 0.18 * u, 0.7 * u, 0.36 * u, 0.12 * u, PINK, INK, 0.04 * u);
  line(ctx, x + 0.15 * u, yb - 0.08 * u, x + 0.6 * u, yb - 0.12 * u, INK, 0.16 * u);
  line(ctx, x + 0.15 * u, yb + 0.08 * u, x + 0.6 * u, yb + 0.14 * u, INK, 0.16 * u);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x - 0.7 * u, yb, 0.3 * u, 0.24 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  keyboard(ctx, x - 0.2 * u, yb - 0.5 * u, u, true, t);
  // stars
  ctx.fillStyle = MUSTARD;
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i * Math.PI * 2) / 3;
    star(ctx, x - 0.7 * u + Math.cos(a) * 0.4 * u, yb - 0.45 * u + Math.sin(a) * 0.12 * u, 0.09 * u);
  }
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------- obstacles

export function drawObstacle(ctx, o, x, y, u, t) {
  switch (o.kind) {
    case 'tv':
      return tv(ctx, x, y, u, t);
    case 'bag':
      return bag(ctx, x, y, u);
    case 'cone':
      return cone(ctx, x, y, u);
    case 'sofa':
      return sofa(ctx, x, y, u);
    case 'bin':
      return bin(ctx, x, y, u);
    case 'aboard':
      return aboard(ctx, x, y, u, o.lines);
    case 'gull':
      return gull(ctx, x, y, u, t + o.s);
    case 'landlord':
      return landlord(ctx, x, y, u, t, o.s);
    case 'lounger':
      return lounger(ctx, x, y, u, t);
    case 'barrier':
      return barrier(ctx, x, y, u);
    case 'plank':
      return barrier(ctx, x, y, u, true);
    case 'fan':
      return fans(ctx, x, y, u, t, o.s);
    case 'drunk':
      return drunk(ctx, x, y, u, t, o);
  }
}

// Red-and-cream striped works barrier; `low` is the knee-high one you hop.
function barrier(ctx, x, y, u, low = false) {
  shadow(ctx, x, y, 1.4 * u, 0.18 * u);
  const w = (low ? 3.0 : 2.6) * u;
  const h = (low ? 0.5 : 1.15) * u * K;
  for (const side of [-1, 1]) {
    line(ctx, x + side * w * 0.42, y, x + side * w * 0.42, y - h, INK, 0.1 * u, 'butt');
    rrect(ctx, x + side * w * 0.42 - 0.2 * u, y - 0.08 * u, 0.4 * u, 0.1 * u, 0.02 * u, INK);
  }
  const bh = (low ? 0.3 : 0.42) * u;
  const by = y - h;
  if (!low) {
    // a second rail and a ROAD CLOSED plate
    rrect(ctx, x - 0.55 * u, by + bh + 0.04 * u, 1.1 * u, 0.3 * u, 0.02 * u, CREAM, INK, 0.03 * u);
    ctx.fillStyle = RED;
    ctx.font = `${0.19 * u}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ROAD CLOSED', x, by + bh + 0.2 * u);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w / 2, by, w, bh);
  ctx.clip();
  ctx.fillStyle = CREAM;
  ctx.fillRect(x - w / 2, by, w, bh);
  ctx.fillStyle = RED;
  for (let i = -2; i < 12; i++) {
    const sx = x - w / 2 + i * 0.5 * u;
    ctx.beginPath();
    ctx.moveTo(sx, by + bh);
    ctx.lineTo(sx + 0.25 * u, by + bh);
    ctx.lineTo(sx + 0.25 * u + bh, by);
    ctx.lineTo(sx + bh, by);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.05 * u;
  ctx.strokeRect(x - w / 2, by, w, bh);
  if (low) return;
  // the flashing lamp
  ctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? MUSTARD : ORANGE;
  ctx.beginPath();
  ctx.arc(x + w * 0.42, by - 0.12 * u, 0.1 * u, 0, Math.PI * 2);
  ctx.fill();
}

// Two fans abreast, olive tops, scarves up, bouncing.
function fans(ctx, x, y, u, t, seed) {
  shadow(ctx, x, y, 1.25 * u, 0.2 * u);
  for (const k of [-1, 1]) {
    const fx = x + k * 0.6 * u;
    const bounce = Math.abs(Math.sin(t * 7 + seed + k)) * 0.12 * u;
    const fy = y - bounce;
    const hip = fy - 0.8 * u * K;
    const sh = fy - 1.45 * u * K;
    line(ctx, fx - 0.09 * u, hip, fx - 0.11 * u, fy, INK, 0.15 * u, 'butt');
    line(ctx, fx + 0.09 * u, hip, fx + 0.11 * u, fy, INK, 0.15 * u, 'butt');
    poly(ctx, [fx - 0.27 * u, sh, fx + 0.27 * u, sh, fx + 0.25 * u, hip + 0.04 * u, fx - 0.25 * u, hip + 0.04 * u], OLIVE, INK, 0.035 * u);
    // collar and sleeves
    poly(ctx, [fx - 0.1 * u, sh, fx + 0.1 * u, sh, fx, sh + 0.12 * u], CREAM);
    // arms up holding the scarf
    const sway = Math.sin(t * 3.5 + seed) * 0.1 * u;
    line(ctx, fx - 0.24 * u, sh + 0.05 * u, fx - 0.36 * u + sway, sh - 0.55 * u, OLIVE, 0.12 * u);
    line(ctx, fx + 0.24 * u, sh + 0.05 * u, fx + 0.36 * u + sway, sh - 0.55 * u, OLIVE, 0.12 * u);
    ctx.save();
    ctx.translate(fx + sway, sh - 0.6 * u);
    ctx.fillStyle = CREAM;
    ctx.fillRect(-0.42 * u, -0.08 * u, 0.84 * u, 0.16 * u);
    ctx.fillStyle = OLIVE_DK;
    for (let i = 0; i < 4; i++) ctx.fillRect(-0.38 * u + i * 0.22 * u, -0.08 * u, 0.1 * u, 0.16 * u);
    ctx.restore();
    // head, mouth open mid-chant
    ctx.fillStyle = PINK;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.03 * u;
    ctx.beginPath();
    ctx.arc(fx, sh - 0.18 * u, 0.17 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(fx, sh - 0.12 * u, 0.05 * u, 0.04 * u + Math.abs(Math.sin(t * 8 + k)) * 0.03 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(fx - 0.08 * u, sh - 0.24 * u, 0.04 * u, 0.03 * u);
    ctx.fillRect(fx + 0.04 * u, sh - 0.24 * u, 0.04 * u, 0.03 * u);
  }
}

// Leaning into the sway, pint held level against all the odds.
function drunk(ctx, x, y, u, t, o) {
  shadow(ctx, x, y, 0.45 * u, 0.14 * u);
  const lean = o.sway ? Math.cos((2 * Math.PI * t) / o.sway.period + o.sway.phase) * 0.35 * (o.sway.to - o.sway.from) : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  const hip = -0.82 * u * K;
  const sh = -1.42 * u * K;
  line(ctx, -0.09 * u, hip, -0.14 * u, 0, INK, 0.15 * u, 'butt');
  line(ctx, 0.09 * u, hip, 0.16 * u, 0, INK, 0.15 * u, 'butt');
  poly(ctx, [-0.27 * u, sh, 0.27 * u, sh, 0.29 * u, hip + 0.05 * u, -0.29 * u, hip + 0.05 * u], TEAL, INK, 0.035 * u);
  line(ctx, -0.24 * u, sh + 0.06 * u, -0.34 * u, hip, TEAL, 0.12 * u);
  line(ctx, 0.24 * u, sh + 0.06 * u, 0.48 * u, sh - 0.12 * u, TEAL, 0.12 * u);
  ctx.restore();
  // the pint stays upright whatever the man does
  const px = x + Math.cos(lean) * 0.5 * u - Math.sin(lean) * sh;
  const py = y + Math.sin(lean) * 0.5 * u + Math.cos(lean) * (sh - 0.16 * u);
  poly(ctx, [px - 0.11 * u, py - 0.3 * u, px + 0.11 * u, py - 0.3 * u, px + 0.08 * u, py, px - 0.08 * u, py], MUSTARD, INK, 0.025 * u);
  ctx.fillStyle = CREAM;
  ctx.fillRect(px - 0.11 * u, py - 0.34 * u, 0.22 * u, 0.08 * u);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.fillStyle = PINK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.03 * u;
  ctx.beginPath();
  ctx.arc(0, sh - 0.2 * u, 0.18 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(0, sh - 0.17 * u, 0.05 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  for (const sx of [-0.08, 0.08]) {
    ctx.beginPath();
    ctx.moveTo((sx - 0.035) * u, sh - 0.26 * u);
    ctx.lineTo((sx + 0.035) * u, sh - 0.24 * u);
    ctx.stroke();
  }
  ctx.restore();
}

// A claw coming up the lane from the bottom of the screen. phase 'warn' draws
// the shadow it's about to land in; 'slam' draws the arm, `ext` 0..1.
export function drawClawShadow(ctx, x, yTop, H, u, w, t) {
  ctx.save();
  ctx.globalAlpha = 0.28 + 0.18 * Math.sin(t * 30);
  ctx.fillStyle = INK;
  ctx.fillRect(x - w / 2, yTop, w, H - yTop);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.rect(x - w / 2, yTop, w, H - yTop);
  ctx.clip();
  for (let k = -2; k < (H - yTop) / (0.9 * u) + 2; k++) {
    const sy = yTop + k * 0.9 * u + ((t * 6 * u) % (0.9 * u));
    ctx.beginPath();
    ctx.moveTo(x - w / 2, sy);
    ctx.lineTo(x + w / 2, sy - w * 0.5);
    ctx.lineTo(x + w / 2, sy - w * 0.5 + 0.3 * u);
    ctx.lineTo(x - w / 2, sy + 0.3 * u);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawClaw(ctx, x, yTip, H, u, ext) {
  if (ext <= 0) return;
  const tip = H + (yTip - H) * ext;
  const aw = 1.6 * u;
  const arm = () => {
    ctx.beginPath();
    ctx.moveTo(x - aw * 0.7, H + 10);
    ctx.quadraticCurveTo(x - aw * 0.75, (tip + H) / 2, x - aw * 0.55, tip + 0.5 * u);
    ctx.lineTo(x + aw * 0.55, tip + 0.5 * u);
    ctx.quadraticCurveTo(x + aw * 0.75, (tip + H) / 2, x + aw * 0.7, H + 10);
    ctx.closePath();
    ctx.moveTo(x + aw * 0.8, tip + 0.45 * u);
    ctx.ellipse(x, tip + 0.45 * u, aw * 0.8, 0.6 * u, 0, 0, Math.PI * 2);
  };
  // cream rim first so it reads on the black tram line too
  arm();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 0.22 * u;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = INK;
  arm();
  ctx.fill();
  // three cream talons
  for (const k of [-1, 0, 1]) {
    const bx = x + k * 0.55 * u;
    const by = tip + 0.15 * u;
    ctx.beginPath();
    ctx.moveTo(bx - 0.13 * u, by);
    ctx.quadraticCurveTo(bx - 0.1 * u + k * 0.1 * u, by - 0.6 * u, bx + k * 0.25 * u, by - 0.85 * u);
    ctx.quadraticCurveTo(bx + 0.05 * u + k * 0.05 * u, by - 0.45 * u, bx + 0.13 * u, by);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - 0.06 * u, by - 0.05 * u);
    ctx.quadraticCurveTo(bx - 0.05 * u + k * 0.1 * u, by - 0.55 * u, bx + k * 0.22 * u, by - 0.75 * u);
    ctx.quadraticCurveTo(bx + 0.02 * u + k * 0.05 * u, by - 0.42 * u, bx + 0.07 * u, by - 0.05 * u);
    ctx.closePath();
    ctx.fillStyle = CREAM;
    ctx.fill();
  }
  // cream eye-slits on the back of the paw, like the sleeve
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.ellipse(x - 0.3 * u, tip + 0.55 * u, 0.15 * u, 0.09 * u, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 0.3 * u, tip + 0.55 * u, 0.15 * u, 0.09 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(x - 0.32 * u, tip + 0.47 * u, 0.04 * u, 0.16 * u);
  ctx.fillRect(x + 0.28 * u, tip + 0.47 * u, 0.04 * u, 0.16 * u);
}

function tv(ctx, x, y, u, t) {
  shadow(ctx, x, y, 0.7 * u, 0.18 * u);
  const w = 1.05 * u;
  const h = 0.8 * u * K;
  rrect(ctx, x - w / 2, y - h, w, h, 0.08 * u, INK);
  // static
  const sx = x - w / 2 + 0.1 * u;
  const sy = y - h + 0.1 * u;
  const sw = w * 0.68;
  const sh = h - 0.2 * u;
  rrect(ctx, sx, sy, sw, sh, 0.1 * u, CREAM);
  ctx.fillStyle = INK;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const r = Math.sin(t * 40 + i * 7.1) * 0.5 + 0.5;
    ctx.fillRect(sx + r * sw * 0.6, sy + (i + 0.3) * (sh / n), sw * 0.35, sh / n / 3);
  }
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(x + w * 0.36, y - h * 0.6, 0.06 * u, 0, Math.PI * 2);
  ctx.arc(x + w * 0.36, y - h * 0.3, 0.06 * u, 0, Math.PI * 2);
  ctx.fill();
  line(ctx, x, y - h, x - 0.25 * u, y - h - 0.35 * u, INK, 0.03 * u);
  line(ctx, x, y - h, x + 0.2 * u, y - h - 0.4 * u, INK, 0.03 * u);
}

function bag(ctx, x, y, u) {
  shadow(ctx, x, y, 0.6 * u, 0.17 * u);
  const h = 0.75 * u * K;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - 0.5 * u, y);
  ctx.quadraticCurveTo(x - 0.62 * u, y - h * 0.7, x - 0.12 * u, y - h * 0.86);
  ctx.lineTo(x - 0.2 * u, y - h * 1.1);
  ctx.lineTo(x + 0.02 * u, y - h * 0.95);
  ctx.lineTo(x + 0.18 * u, y - h * 1.12);
  ctx.lineTo(x + 0.12 * u, y - h * 0.86);
  ctx.quadraticCurveTo(x + 0.62 * u, y - h * 0.7, x + 0.5 * u, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = CREAM_DK;
  ctx.lineWidth = 0.03 * u;
  ctx.beginPath();
  ctx.moveTo(x - 0.3 * u, y - h * 0.6);
  ctx.quadraticCurveTo(x - 0.38 * u, y - h * 0.3, x - 0.25 * u, y - h * 0.12);
  ctx.stroke();
}

function cone(ctx, x, y, u) {
  shadow(ctx, x, y, 0.45 * u, 0.14 * u);
  rrect(ctx, x - 0.38 * u, y - 0.08 * u, 0.76 * u, 0.1 * u, 0.02 * u, INK);
  const h = 0.85 * u * K;
  poly(ctx, [x - 0.28 * u, y - 0.06 * u, x + 0.28 * u, y - 0.06 * u, x + 0.06 * u, y - h, x - 0.06 * u, y - h], RED, INK, 0.03 * u);
  poly(ctx, [x - 0.2 * u, y - h * 0.4, x + 0.2 * u, y - h * 0.4, x + 0.15 * u, y - h * 0.58, x - 0.15 * u, y - h * 0.58], CREAM);
}

function sofa(ctx, x, y, u) {
  shadow(ctx, x, y, 1.25 * u, 0.22 * u);
  const w = 2.2 * u;
  const h = 1.0 * u * K;
  rrect(ctx, x - w / 2 + 0.15 * u, y - h, w - 0.3 * u, h * 0.62, 0.12 * u, OLIVE, INK, 0.04 * u); // back
  rrect(ctx, x - w / 2 + 0.15 * u, y - h * 0.45, w - 0.3 * u, h * 0.32, 0.06 * u, MUSTARD, INK, 0.035 * u); // seat
  rrect(ctx, x - w / 2, y - h * 0.72, 0.3 * u, h * 0.72, 0.1 * u, OLIVE_DK, INK, 0.04 * u);
  rrect(ctx, x + w / 2 - 0.3 * u, y - h * 0.72, 0.3 * u, h * 0.72, 0.1 * u, OLIVE_DK, INK, 0.04 * u);
  line(ctx, x, y - h * 0.44, x, y - h * 0.14, INK, 0.03 * u);
  rrect(ctx, x - w / 2 + 0.2 * u, y - h * 0.13, w - 0.4 * u, h * 0.13, 0, INK);
  // the For Free sign
  ctx.save();
  ctx.translate(x + 0.35 * u, y - h * 0.72);
  ctx.rotate(-0.12);
  rrect(ctx, -0.32 * u, -0.14 * u, 0.64 * u, 0.28 * u, 0.02 * u, CREAM, INK, 0.025 * u);
  ctx.fillStyle = INK;
  ctx.font = `${0.17 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FREE', 0, 0.01 * u);
  ctx.restore();
}

function bin(ctx, x, y, u) {
  shadow(ctx, x, y, 1.1 * u, 0.22 * u);
  const w = 1.9 * u;
  const h = 1.35 * u * K;
  rrect(ctx, x - w / 2, y - h, w, h, 0.06 * u, '#3c3a35', INK, 0.04 * u);
  rrect(ctx, x - w / 2 - 0.05 * u, y - h - 0.12 * u, w + 0.1 * u, 0.18 * u, 0.04 * u, INK);
  // bag poking out from under the lid
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x + 0.4 * u, y - h - 0.1 * u, 0.3 * u, 0.15 * u, -0.2, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.font = `${0.2 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NON-RECYCLABLE', x, y - h * 0.5);
  rrect(ctx, x - w / 2 + 0.1 * u, y - 0.12 * u, 0.22 * u, 0.12 * u, 0.06 * u, INK);
  rrect(ctx, x + w / 2 - 0.32 * u, y - 0.12 * u, 0.22 * u, 0.12 * u, 0.06 * u, INK);
}

function aboard(ctx, x, y, u, lines = ['OPEN']) {
  shadow(ctx, x, y, 0.65 * u, 0.16 * u);
  const w = 1.0 * u;
  const h = 1.2 * u * K;
  poly(ctx, [x - w / 2, y, x + w / 2, y, x + w * 0.4, y - h, x - w * 0.4, y - h], INK);
  poly(ctx, [x - w * 0.42, y - 0.08 * u, x + w * 0.42, y - 0.08 * u, x + w * 0.34, y - h + 0.08 * u, x - w * 0.34, y - h + 0.08 * u], CREAM);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fs = Math.min(0.24, 0.7 / lines.length) * u;
  ctx.font = `${fs}px ${FONT}`;
  lines.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? RED : INK;
    ctx.fillText(l, x, y - h + 0.2 * u + (i + 0.5) * ((h - 0.32 * u) / lines.length));
  });
}

function gull(ctx, x, y, u, t) {
  shadow(ctx, x, y, 0.6 * u, 0.15 * u);
  // chip paper
  poly(ctx, [x - 0.5 * u, y - 0.02 * u, x + 0.45 * u, y - 0.08 * u, x + 0.4 * u, y + 0.08 * u, x - 0.45 * u, y + 0.1 * u], CREAM, INK, 0.025 * u);
  ctx.fillStyle = MUSTARD;
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 0.3 * u + i * 0.16 * u, y - 0.06 * u, 0.06 * u, 0.12 * u);
  const hover = (Math.sin(t * 6) * 0.05 + 0.35) * u;
  const by = y - hover - 0.4 * u * K;
  const flap = Math.sin(t * 16);
  // wings
  for (const side of [-1, 1]) {
    poly(ctx, [x + side * 0.12 * u, by - 0.05 * u, x + side * 0.75 * u, by - 0.1 * u - flap * 0.32 * u, x + side * 0.55 * u, by + 0.08 * u - flap * 0.15 * u], CREAM, INK, 0.03 * u);
    poly(ctx, [x + side * 0.75 * u, by - 0.1 * u - flap * 0.32 * u, x + side * 0.6 * u, by - 0.02 * u - flap * 0.25 * u, x + side * 0.66 * u, by + 0.02 * u - flap * 0.2 * u], INK);
  }
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.03 * u;
  ctx.beginPath();
  ctx.ellipse(x, by, 0.2 * u, 0.26 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, by - 0.3 * u, 0.14 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // evil eye and the red-spot beak
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x - 0.05 * u, by - 0.33 * u, 0.03 * u, 0, Math.PI * 2);
  ctx.arc(x + 0.05 * u, by - 0.33 * u, 0.03 * u, 0, Math.PI * 2);
  ctx.fill();
  poly(ctx, [x - 0.05 * u, by - 0.25 * u, x + 0.05 * u, by - 0.25 * u, x, by - 0.08 * u], MUSTARD, INK, 0.02 * u);
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(x, by - 0.14 * u, 0.025 * u, 0, Math.PI * 2);
  ctx.fill();
}

function landlord(ctx, x, y, u, t, seed) {
  shadow(ctx, x, y, 0.4 * u, 0.14 * u);
  const ph = t * 7 + seed;
  const s = Math.sin(ph);
  const hip = y - 0.85 * u * K;
  const sh = y - 1.5 * u * K;
  for (const side of [-1, 1]) {
    const p = side < 0 ? s : -s;
    line(ctx, x + side * 0.1 * u, hip, x + side * 0.12 * u, y - Math.max(0, p) * 0.12 * u, INK, 0.16 * u, 'butt');
  }
  poly(ctx, [x - 0.3 * u, sh, x + 0.3 * u, sh, x + 0.27 * u, hip + 0.05 * u, x - 0.27 * u, hip + 0.05 * u], INK);
  poly(ctx, [x - 0.08 * u, sh, x + 0.08 * u, sh, x, sh + 0.25 * u], CREAM);
  poly(ctx, [x - 0.03 * u, sh + 0.03 * u, x + 0.03 * u, sh + 0.03 * u, x + 0.04 * u, sh + 0.3 * u, x, sh + 0.36 * u, x - 0.04 * u, sh + 0.3 * u], RED);
  // the rent demand, waved
  const wave = Math.sin(t * 9 + seed) * 0.1;
  ctx.save();
  ctx.translate(x + 0.4 * u, sh - 0.05 * u);
  ctx.rotate(wave);
  line(ctx, -0.12 * u, 0.15 * u, 0, 0, INK, 0.12 * u);
  rrect(ctx, -0.2 * u, -0.42 * u, 0.42 * u, 0.36 * u, 0.02 * u, CREAM, INK, 0.025 * u);
  ctx.fillStyle = RED;
  ctx.font = `${0.13 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RENT', 0, -0.31 * u);
  ctx.fillStyle = INK;
  ctx.fillText('DUE', 0, -0.17 * u);
  ctx.restore();
  // big bald head, tiny frown
  const hy = sh - 0.22 * u;
  ctx.fillStyle = PINK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.03 * u;
  ctx.beginPath();
  ctx.ellipse(x, hy, 0.2 * u, 0.22 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(x - 0.1 * u, hy - 0.03 * u, 0.06 * u, 0.025 * u);
  ctx.fillRect(x + 0.04 * u, hy - 0.03 * u, 0.06 * u, 0.025 * u);
  ctx.beginPath();
  ctx.arc(x, hy + 0.14 * u, 0.06 * u, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
}

// The Happy For Now thing, sprawled across the pavement: black lump, cream
// stick limbs, claw fingers.
function lounger(ctx, x, y, u, t) {
  shadow(ctx, x, y, 1.35 * u, 0.22 * u);
  const limb = (pts) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.11 * u;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 0.055 * u;
    ctx.stroke();
  };
  const claw = (cx, cy, dir) => {
    for (let i = -1; i <= 1; i++) limb([cx, cy, cx + dir * 0.16 * u, cy + i * 0.08 * u - 0.02 * u]);
  };
  const tap = Math.max(0, Math.sin(t * 5)) * 0.06 * u;
  // back leg, knee up
  limb([x + 0.2 * u, y - 0.3 * u, x + 0.75 * u, y - 0.95 * u * K, x + 1.05 * u, y - 0.05 * u - tap]);
  claw(x + 1.05 * u, y - 0.05 * u - tap, 1);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - 0.75 * u, y - 0.05 * u);
  ctx.quadraticCurveTo(x - 0.9 * u, y - 1.0 * u * K, x - 0.35 * u, y - 1.05 * u * K);
  ctx.quadraticCurveTo(x + 0.1 * u, y - 0.75 * u * K, x + 0.55 * u, y - 0.3 * u);
  ctx.quadraticCurveTo(x + 0.6 * u, y, x + 0.2 * u, y);
  ctx.closePath();
  ctx.fill();
  // head
  const hx = x - 0.45 * u;
  const hy = y - 1.2 * u * K;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 0.3 * u, 0.27 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = MUSTARD;
    ctx.beginPath();
    ctx.ellipse(hx + side * 0.12 * u, hy - 0.02 * u, 0.07 * u, 0.06 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(hx + side * 0.12 * u + 0.02 * u, hy - 0.02 * u, 0.03 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = MUSTARD;
  ctx.lineWidth = 0.025 * u;
  ctx.beginPath();
  ctx.moveTo(hx - 0.07 * u, hy + 0.13 * u);
  ctx.lineTo(hx + 0.08 * u, hy + 0.12 * u);
  ctx.stroke();
  // arm propped up behind the head, arm on the ground
  limb([x - 0.15 * u, y - 0.8 * u * K, x + 0.05 * u, y - 1.5 * u * K, x + 0.12 * u, y - 1.75 * u * K]);
  limb([x + 0.12 * u, y - 1.75 * u * K, x + 0.02 * u, y - 1.86 * u * K]);
  limb([x + 0.12 * u, y - 1.75 * u * K, x + 0.22 * u, y - 1.85 * u * K]);
  limb([x - 0.65 * u, y - 0.45 * u * K, x - 1.0 * u, y - 0.25 * u * K, x - 1.12 * u, y - 0.04 * u]);
  claw(x - 1.12 * u, y - 0.04 * u, -1);
}

// ---------------------------------------------------------------- pickups

export function drawPickup(ctx, p, x, y, u, t) {
  const bob = (Math.sin(t * 4 + p.s) * 0.08 + 0.35) * u;
  shadow(ctx, x, y, 0.3 * u, 0.1 * u, 0.15);
  if (p.kind === 'record') {
    const spin = Math.abs(Math.cos(t * 3 + p.s * 0.7));
    const r = 0.36 * u;
    const cy = y - bob - r * K;
    ctx.fillStyle = ORANGE;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.035 * u;
    ctx.beginPath();
    ctx.ellipse(x, cy, r * Math.max(0.12, spin), r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x, cy, r * 0.35 * Math.max(0.12, spin), r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // a tube of glue
    const cy = y - bob - 0.45 * u * K;
    ctx.save();
    ctx.translate(x, cy);
    ctx.rotate(Math.sin(t * 3) * 0.25);
    ctx.strokeStyle = 'rgba(239,227,198,0.9)';
    ctx.lineWidth = 0.05 * u;
    ctx.beginPath();
    ctx.arc(0, 0, (0.55 + Math.sin(t * 8) * 0.05) * u, 0, Math.PI * 2);
    ctx.stroke();
    poly(ctx, [-0.2 * u, -0.32 * u, 0.2 * u, -0.32 * u, 0.24 * u, 0.3 * u, -0.24 * u, 0.3 * u], CREAM, INK, 0.035 * u);
    rrect(ctx, -0.1 * u, 0.3 * u, 0.2 * u, 0.16 * u, 0.03 * u, RED, INK, 0.03 * u);
    ctx.fillStyle = RED;
    ctx.font = `${0.17 * u}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GLUE', 0, 0);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- tram

// Top-down: the nose is at (x, yFront), the body runs up the screen.
export function drawTram(ctx, x, yFront, u, len, w) {
  const L = len * u;
  const W = w * u;
  ctx.fillStyle = 'rgba(23,19,15,0.25)';
  ctx.fillRect(x - W / 2 + 0.25 * u, yFront - L + 0.3 * u, W, L);
  rrect(ctx, x - W / 2, yFront - L, W, L, [0.4 * u, 0.4 * u, 0.9 * u, 0.9 * u], CREAM, INK, 0.06 * u);
  // red skirts
  ctx.fillStyle = RED;
  ctx.fillRect(x - W / 2 + 0.03 * u, yFront - L + 0.4 * u, 0.18 * u, L - 1.3 * u);
  ctx.fillRect(x + W / 2 - 0.21 * u, yFront - L + 0.4 * u, 0.18 * u, L - 1.3 * u);
  // section joints and roof kit
  ctx.fillStyle = INK;
  const sections = 5;
  for (let i = 1; i < sections; i++) ctx.fillRect(x - W / 2, yFront - (L * i) / sections - 0.15 * u, W, 0.3 * u);
  for (let i = 0; i < sections; i++) {
    const cy = yFront - (L * (i + 0.5)) / sections;
    rrect(ctx, x - W * 0.25, cy - 1.0 * u, W * 0.5, 2.0 * u, 0.15 * u, CREAM_DK, INK, 0.04 * u);
  }
  // pantograph
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.08 * u;
  ctx.beginPath();
  const py = yFront - L * 0.5;
  ctx.moveTo(x - 0.8 * u, py - 1.2 * u);
  ctx.lineTo(x + 0.6 * u, py - 0.4 * u);
  ctx.lineTo(x - 0.6 * u, py + 0.4 * u);
  ctx.lineTo(x + 0.8 * u, py + 1.2 * u);
  ctx.stroke();
  // nose and windscreen
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x - W / 2 + 0.1 * u, yFront - 1.2 * u, W - 0.2 * u, 1.1 * u, [0.1 * u, 0.1 * u, 0.85 * u, 0.85 * u]);
  ctx.fill();
  ctx.fillStyle = MUSTARD;
  ctx.beginPath();
  ctx.arc(x - W * 0.32, yFront - 0.35 * u, 0.12 * u, 0, Math.PI * 2);
  ctx.arc(x + W * 0.32, yFront - 0.35 * u, 0.12 * u, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- the Glue creature

// The sleeve's horned black thing rising from the bottom edge. `rise` 0..1,
// `look` -1..1 shifts the slit pupils toward Gurry.
// It never climbs past Gurry's feet (floor), so the road ahead stays visible.
export function drawCreature(ctx, W, H, rise, look, t, floor = H * 0.8) {
  if (rise <= 0) return;
  rise = Math.min(1, rise);
  const s = Math.min(W * 0.95, H * 0.5);
  const cx = W * 0.5 + Math.sin(t * 1.3) * W * 0.03;
  // fully hidden (horn tips included) at rise 0; at rise 1 the eyes sit
  // between his feet and the bottom edge
  const eyesAt1 = floor + (H - floor) * 0.45;
  const top = H + 0.45 * s - rise * (H + 0.45 * s - (eyesAt1 - 0.22 * s));
  ctx.save();
  ctx.translate(cx, top);
  const breathe = 1 + Math.sin(t * 3) * 0.015;
  ctx.scale(breathe, breathe);

  // horns: ink outline with cream inside, swept up and out like the cover
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.1, s * 0.14);
    ctx.quadraticCurveTo(side * s * 0.22, -s * 0.16, side * s * 0.42, -s * 0.4);
    ctx.quadraticCurveTo(side * s * 0.38, -s * 0.08, side * s * 0.36, s * 0.14);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(side * s * 0.15, s * 0.1);
    ctx.quadraticCurveTo(side * s * 0.25, -s * 0.12, side * s * 0.39, -s * 0.31);
    ctx.quadraticCurveTo(side * s * 0.34, -s * 0.06, side * s * 0.31, s * 0.1);
    ctx.closePath();
    ctx.fillStyle = CREAM;
    ctx.fill();
  }
  // head: broad skull narrowing to a heavy snout, ear flick on the left
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, s * 0.9);
  ctx.quadraticCurveTo(-s * 0.48, s * 0.25, -s * 0.36, s * 0.18);
  ctx.quadraticCurveTo(-s * 0.56, s * 0.22, -s * 0.62, s * 0.34);
  ctx.quadraticCurveTo(-s * 0.6, s * 0.12, -s * 0.36, s * 0.07);
  ctx.quadraticCurveTo(-s * 0.2, -s * 0.02, 0, s * 0.0);
  ctx.quadraticCurveTo(s * 0.32, -s * 0.02, s * 0.42, s * 0.16);
  ctx.quadraticCurveTo(s * 0.52, s * 0.4, s * 0.6, s * 0.9);
  ctx.closePath();
  ctx.fill();
  // eyes: cream almonds with slit pupils
  for (const side of [-1, 1]) {
    const ex = side * s * 0.17;
    const ey = s * 0.22;
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(ex, ey, s * 0.085, s * 0.06, side * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillRect(ex + look * s * 0.035 - s * 0.009, ey - s * 0.055, s * 0.018, s * 0.11);
  }
  ctx.restore();
}

// Venue frontage at the Foot of the Walk; base at y, spans the street.
export function drawVenue(ctx, cx, y, u, W, name, open) {
  const h = 8 * u * K;
  // the town carries on behind it: roofs to the top of the screen
  ctx.fillStyle = '#3a3631';
  ctx.fillRect(0, 0, W, y - h);
  ctx.fillStyle = RED;
  ctx.fillRect(0, y - h, W, h);
  ctx.fillStyle = RED_DK;
  for (let i = 0; i < 6; i++) ctx.fillRect(cx + (i - 2.5) * 2.4 * u - 0.25 * u, y - h, 0.5 * u, h);
  ctx.fillStyle = INK;
  ctx.fillRect(0, y - h, W, 0.5 * u);
  ctx.fillRect(0, y - 0.25 * u, W, 0.25 * u);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CREAM;
  ctx.font = `${0.9 * u}px ${FONT}`;
  ctx.fillText(name.toUpperCase(), cx, y - h + 1.2 * u);
  // marquee
  const mw = 7.4 * u;
  const my = y - h + 2.0 * u;
  rrect(ctx, cx - mw / 2, my, mw, 1.8 * u, 0.1 * u, CREAM, INK, 0.12 * u);
  ctx.fillStyle = INK;
  ctx.font = `${0.42 * u}px ${FONT}`;
  ctx.fillText('TONIGHT', cx, my + 0.4 * u);
  ctx.font = `${0.62 * u}px ${FONT}`;
  const a = 'GURRY WURRY ';
  const b = '“GLUE”';
  const wa = ctx.measureText(a).width;
  const wb = ctx.measureText(b).width;
  ctx.textAlign = 'left';
  ctx.fillText(a, cx - (wa + wb) / 2, my + 1.15 * u);
  ctx.fillStyle = RED;
  ctx.fillText(b, cx - (wa + wb) / 2 + wa, my + 1.15 * u);
  // doors
  const dw = 2.4 * u;
  const dh = 2.5 * u * K;
  ctx.fillStyle = open ? MUSTARD : INK;
  ctx.fillRect(cx - dw / 2, y - dh, dw, dh);
  ctx.fillStyle = INK;
  if (open) {
    ctx.fillRect(cx - dw / 2, y - dh, 0.3 * u, dh);
    ctx.fillRect(cx + dw / 2 - 0.3 * u, y - dh, 0.3 * u, dh);
  } else {
    ctx.fillStyle = CREAM_DK;
    ctx.fillRect(cx - 0.03 * u, y - dh, 0.06 * u, dh);
  }
}
