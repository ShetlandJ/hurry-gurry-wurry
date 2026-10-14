// Draws Leith Walk around the runner: pavements, tram line, tenement roofs,
// then the upright sprites back to front, the Glue creature and paper grain.
import { RED, RED_DK, INK, CREAM, CREAM_DK, OLIVE, PINK, TEAL, STONE, FONT } from './palette.js';
import { drawGurry, drawObstacle, drawPickup, drawTram, drawCreature, drawVenue, drawClaw, drawClawShadow } from './sprites.js';
import { LANDMARKS, ROUTE_LENGTH, SHOP_SIGNS, TRAM_LEN, TRAM_W, CREATURE_SHOW, VENUE, CLAW_WARN, CLAW_SLAM, CLAW_W, LANE_W } from '../config.js';
import { hashSeed } from '../util/rng.js';

const KERB = 1.6;
const SHOPFRONT = 4.8;
const FASCIA = 0.65;
const CROSS_HALF = 4.5;

const CROSSINGS = LANDMARKS.slice(1, -1).map((l) => l.s);
const FASCIA_COLOURS = [RED, OLIVE, INK, PINK, TEAL, RED_DK];

// Tenement blocks either side, broken by the cross streets. Fixed, not seeded:
// it's the same street every run.
const BLOCKS = (() => {
  const out = [];
  for (const side of [-1, 1]) {
    let s = -80;
    let i = 0;
    while (s < ROUTE_LENGTH + 6) {
      const len = 11 + (hashSeed(`len${side}${i}`) % 9);
      let s1 = Math.min(s + len, ROUTE_LENGTH + 6);
      const c = CROSSINGS.find((c) => c - CROSS_HALF < s1 && c + CROSS_HALF > s);
      if (c !== undefined) {
        if (c - CROSS_HALF > s + 2) out.push(block(side, s, c - CROSS_HALF, i++));
        s = c + CROSS_HALF;
        continue;
      }
      out.push(block(side, s, s1, i++));
      s = s1;
    }
  }
  return out;
})();

function block(side, s0, s1, i) {
  const h = hashSeed(`b${side}:${i}`);
  return {
    side,
    s0,
    s1,
    colour: FASCIA_COLOURS[h % FASCIA_COLOURS.length],
    sign: SHOP_SIGNS[(h >>> 4) % SHOP_SIGNS.length],
    chimneys: 1 + ((h >>> 8) % 2),
  };
}

let grain = null;
function grainPattern(ctx) {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const r = Math.random();
    const v = r < 0.5 ? 255 : 200 + r * 55;
    img.data[i] = v;
    img.data[i + 1] = v * 0.97;
    img.data[i + 2] = v * 0.9;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // a few fibres
  g.strokeStyle = 'rgba(120,100,70,0.25)';
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const a = Math.random() * Math.PI;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
    g.stroke();
  }
  grain = ctx.createPattern(c, 'repeat');
  return grain;
}

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.shake = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.dpr = dpr;
    this.u = Math.max(18, Math.min(this.W / 11.5, this.H / 19));
    this.playerY = this.H * 0.8;
  }

  burst(x, y, colours, n = 14, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.5,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 14,
        size: 3 + Math.random() * 6,
        colour: colours[i % colours.length],
        life: 0.7 + Math.random() * 0.5,
      });
    }
  }

  // view: { s, px, extra, rise, look, t, gurry (draw state or null), venueOpen, dt }
  render(run, view) {
    const { ctx, W, H, u, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 12 : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 12 : 0;
    this.shake = Math.max(0, this.shake - view.dt * 2.5);
    ctx.save();
    ctx.translate(shx, shy);

    const cx = W / 2;
    const cam = view.s;
    const sy = (s) => this.playerY - (s - cam) * u;
    const sx = (x) => cx + x * u;
    const sMin = cam - (H - this.playerY) / u - 2;
    const sMax = cam + this.playerY / u + 8;

    this._ground(sy, sx, sMin, sMax, view.t);

    // trams sit on the road, under everything upright
    if (run) {
      for (const tr of run.trams) {
        if (!tr.active || tr.s > sMax + 2 || tr.s + TRAM_LEN < sMin) continue;
        drawTram(ctx, sx(0), sy(tr.s), u, TRAM_LEN, TRAM_W);
      }
    }

    if (ROUTE_LENGTH + 3 < sMax + 10) drawVenue(ctx, cx, sy(ROUTE_LENGTH + 3), u, W, VENUE, view.venueOpen);

    // The creature goes under the sprites so its horns never hide Gurry or
    // what's coming at him.
    drawCreature(ctx, W, H, view.rise, view.look, view.t, this.playerY + 0.3 * u);

    // claw shadows on the ground, under everything upright
    if (run) {
      for (const c of run.claws) {
        if (c.state === 'warn') drawClawShadow(ctx, sx(c.lane * LANE_W), this.playerY - 2.2 * u, H, u, CLAW_W * u, view.t);
      }
    }

    const sprites = [];
    if (run) {
      for (const o of run.obstacles) if (o.s > sMin && o.s < sMax && !(o.hit && o.kind === 'cone')) sprites.push(o);
      for (const p of run.pickups) if (!p.taken && p.s > sMin && p.s < sMax) sprites.push(p);
    }
    sprites.sort((a, b) => b.s - a.s);
    const gs = cam + (view.extra || 0);
    let drewGurry = !view.gurry;
    for (const o of sprites) {
      if (!drewGurry && o.s < gs) {
        drawGurry(ctx, sx(view.px), sy(gs), u, view.gurry);
        drewGurry = true;
      }
      if (o.kind === 'record' || o.kind === 'glue') drawPickup(ctx, o, sx(o.x), sy(o.s), u, view.t);
      else drawObstacle(ctx, o, sx(o.x), sy(o.s), u, view.t);
    }
    if (!drewGurry) drawGurry(ctx, sx(view.px), sy(gs), u, view.gurry);

    if (run) {
      for (const c of run.claws) {
        if (c.state !== 'slam' && !(c.state === 'done' && run.t - c.t0 < CLAW_WARN + CLAW_SLAM + 0.25)) continue;
        const p = (run.t - c.t0 - CLAW_WARN) / (CLAW_SLAM + 0.25);
        const ext = p < 0.2 ? p / 0.2 : p > 0.65 ? Math.max(0, (1 - p) / 0.35) : 1;
        drawClaw(ctx, sx(c.lane * LANE_W), this.playerY - 1.8 * u, H, u, ext);
      }
    }

    this._particles(view.dt);

    // speed lines once he's flying
    if (view.speedLines > 0) {
      ctx.strokeStyle = `rgba(23,19,15,${0.25 * view.speedLines})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const k = hashSeed(`sl${i}`) / 4294967296;
        const x = i % 2 ? W * (0.03 + k * 0.08) : W * (0.89 + k * 0.08);
        const y = ((view.t * 900 + k * H * 3) % (H + 200)) - 100;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 60 + k * 80);
        ctx.stroke();
      }
    }
    ctx.restore();

    // paper grain over everything, like ink on card
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  _ground(sy, sx, sMin, sMax, t) {
    const { ctx, W, H, u } = this;
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, W, H);

    // pavement slabs
    ctx.strokeStyle = CREAM_DK;
    ctx.lineWidth = Math.max(1, u * 0.05);
    ctx.beginPath();
    for (let s = Math.floor(sMin / 1.6) * 1.6; s < sMax; s += 1.6) {
      const y = sy(s);
      ctx.moveTo(sx(-SHOPFRONT), y);
      ctx.lineTo(sx(-KERB), y);
      ctx.moveTo(sx(KERB), y);
      ctx.lineTo(sx(SHOPFRONT), y);
    }
    ctx.stroke();

    // road and tram rails
    ctx.fillStyle = INK;
    ctx.fillRect(sx(-KERB), 0, KERB * 2 * u, H);
    ctx.fillStyle = STONE;
    for (const rx of [-0.72, 0.72]) ctx.fillRect(sx(rx) - u * 0.05, 0, u * 0.1, H);
    ctx.fillStyle = CREAM_DK;
    ctx.fillRect(sx(-KERB) - u * 0.14, 0, u * 0.14, H);
    ctx.fillRect(sx(KERB), 0, u * 0.14, H);

    // painted HURRY! at the start
    if (sMin < 14 && sMax > 6) {
      ctx.save();
      ctx.fillStyle = CREAM;
      ctx.font = `${1.1 * u}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HURRY!', sx(0), sy(9));
      ctx.restore();
      ctx.fillStyle = CREAM;
      for (let x = -KERB; x < KERB; x += 0.5) ctx.fillRect(sx(x), sy(1.5), u * 0.3, u * 0.25);
    }

    // cross streets: side road off both edges, zebra across the Walk
    for (const c of CROSSINGS) {
      if (c + CROSS_HALF < sMin || c - CROSS_HALF > sMax) continue;
      const y0 = sy(c + CROSS_HALF);
      const y1 = sy(c - CROSS_HALF);
      ctx.fillStyle = INK;
      ctx.fillRect(0, y0, sx(-SHOPFRONT), y1 - y0);
      ctx.fillRect(sx(SHOPFRONT), y0, W, y1 - y0);
      ctx.fillStyle = CREAM;
      for (let x = -KERB + 0.15; x < KERB - 0.3; x += 0.7) ctx.fillRect(sx(x), sy(c + 1.4), u * 0.4, u * 2.8);
      ctx.fillStyle = CREAM_DK;
      ctx.fillRect(0, sy(c + 0.06), sx(-SHOPFRONT), u * 0.12);
      ctx.fillRect(sx(SHOPFRONT), sy(c + 0.06), W, u * 0.12);
    }

    // tenements
    for (const b of BLOCKS) {
      if (b.s1 < sMin || b.s0 > sMax) continue;
      const yTop = sy(b.s1);
      const yBot = sy(b.s0);
      const inner = sx(b.side * SHOPFRONT);
      const outer = sx(b.side * (SHOPFRONT + FASCIA));
      const fx = Math.min(inner, outer);
      ctx.fillStyle = b.colour;
      ctx.fillRect(fx, yTop, Math.abs(outer - inner), yBot - yTop);
      ctx.fillStyle = '#3a3631';
      const rx0 = b.side < 0 ? 0 : outer;
      const rx1 = b.side < 0 ? outer : W;
      ctx.fillRect(rx0, yTop, rx1 - rx0, yBot - yTop);
      // ridge line and gutters
      ctx.fillStyle = '#4c4740';
      const ridge = sx(b.side * (SHOPFRONT + FASCIA + 2.2));
      ctx.fillRect(ridge - u * 0.06, yTop, u * 0.12, yBot - yTop);
      ctx.fillStyle = CREAM_DK;
      ctx.fillRect(rx0, yTop, rx1 - rx0, Math.max(1, u * 0.08));
      // chimney stacks with pots
      for (let k = 0; k < b.chimneys; k++) {
        const cs = b.s0 + ((k + 1) * (b.s1 - b.s0)) / (b.chimneys + 1);
        const ccx = sx(b.side * (SHOPFRONT + FASCIA + 1.2));
        const ccy = sy(cs);
        ctx.fillStyle = STONE;
        ctx.fillRect(ccx - u * 0.4, ccy - u * 0.9, u * 0.8, u * 1.8);
        ctx.fillStyle = RED;
        for (let p = 0; p < 3; p++) {
          ctx.beginPath();
          ctx.arc(ccx, ccy - u * 0.55 + p * u * 0.55, u * 0.17, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = INK;
        for (let p = 0; p < 3; p++) {
          ctx.beginPath();
          ctx.arc(ccx, ccy - u * 0.55 + p * u * 0.55, u * 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // shop sign along the fascia
      ctx.save();
      ctx.translate((inner + outer) / 2, (yTop + yBot) / 2);
      ctx.rotate(b.side < 0 ? -Math.PI / 2 : Math.PI / 2);
      ctx.fillStyle = b.colour === PINK ? INK : CREAM;
      ctx.font = `${FASCIA * u * 0.62}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = yBot - yTop - u * 0.8;
      let text = b.sign;
      if (ctx.measureText(text).width > maxW) text = text.split(' ').slice(0, 2).join(' ');
      if (ctx.measureText(text).width <= maxW) ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }

  _particles(dt) {
    const { ctx } = this;
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 700 * dt;
      p.rot += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
      ctx.restore();
    }
  }

  creatureRise(run) {
    const gap = run.s - run.creatureS;
    return Math.max(0, Math.min(1, (CREATURE_SHOW - gap) / CREATURE_SHOW));
  }
}
