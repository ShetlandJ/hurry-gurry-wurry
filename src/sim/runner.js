// One run down Leith Walk. Pure and deterministic: fed one input frame per
// SIM_DT step, no DOM, no Date, no Math.random. Things worth showing (breaks,
// pickups, the tram bell) are pushed onto `events` for the game to drain.
import {
  LANE_W,
  LANE_SPEED,
  ROUTE_LENGTH,
  SPEED_START,
  SPEED_END,
  ACCEL,
  STAGE_TIME,
  JUMP_TIME,
  JUMP_HEIGHT,
  JUMP_CLEAR,
  ITEMS,
  BROKEN_SLOWDOWN,
  HIT_SPEED_KEEP,
  FALL_TIME,
  INVULN_TIME,
  GLUE_TIME,
  GLUE_START,
  GLUE_MAX,
  TRAM_LEAD,
  TRAM_SPEED,
  TRAM_LEN,
  TRAM_W,
  CREATURE_KNOCKBACK,
  RECORD_BOOST,
  BOOST_MAX,
  BOOST_DECAY,
  CLAW_WARN,
  CLAW_SLAM,
  CLAW_W,
} from '../config.js';
import { KINDS } from './course.js';

// Distance covered by a clean run at time t, sampled every 0.1s. The Glue
// creature runs this profile delayed so it reaches the stage at STAGE_TIME.
const CLEAN = (() => {
  const out = [0];
  let s = 0;
  let v = SPEED_START;
  for (let i = 1; s < ROUTE_LENGTH * 1.5; i++) {
    const target = SPEED_START + (SPEED_END - SPEED_START) * Math.min(1, s / ROUTE_LENGTH);
    v += Math.sign(target - v) * Math.min(Math.abs(target - v), ACCEL * 0.1);
    s += v * 0.1;
    out.push(s);
  }
  return out;
})();
const CLEAN_TIME = CLEAN.findIndex((s) => s >= ROUTE_LENGTH) / 10;
function cleanS(t) {
  if (t <= 0) return SPEED_START * t;
  const i = Math.min(CLEAN.length - 2, Math.floor(t * 10));
  const f = t * 10 - i;
  return CLEAN[i] + (CLEAN[i + 1] - CLEAN[i]) * f;
}

const PLAYER_W = 0.8;
const PLAYER_LEN = 0.5;
const PICKUP_R = 1.1;

export class Runner {
  constructor(course) {
    this.course = course;
    this.t = 0;
    this.s = 0;
    this.v = SPEED_START;
    this.boost = 0;
    this.creatureBack = 0;
    this.lane = -1;
    this.x = -LANE_W;
    this.z = 0;
    this.jumpT = -1;
    this.broken = [];
    this.glue = GLUE_START;
    this.glueProgress = 0;
    this.hits = 0;
    this.falls = 0;
    this.records = 0;
    this.glued = 0;
    this.fallT = 0;
    this.invulnT = 0;
    this.finished = false;
    this.finishTime = null;
    this.events = [];
    this.obstacles = course.obstacles.map((o) => ({ ...o, x: o.lane * LANE_W, hit: false, ...KINDS[o.kind] }));
    this.pickups = course.pickups.map((p) => ({ ...p, x: p.lane * LANE_W, taken: false }));
    this.claws = course.claws.map((c) => ({ ...c, state: 'idle', lane: 0, t0: 0, hit: false }));
    this.trams = course.trams.map((tr) => ({ ...tr, s: tr.triggerS + TRAM_LEAD, active: false, hit: false }));
  }

  get progress() {
    return Math.min(1, this.s / ROUTE_LENGTH);
  }

  // Where the Glue creature is. It runs a clean run's pace, starting late
  // enough to reach the stage exactly at STAGE_TIME, minus however far it's
  // been knocked back after biting.
  get creatureS() {
    return cleanS(this.t - (STAGE_TIME - CLEAN_TIME)) - this.creatureBack;
  }

  get late() {
    return Math.max(0, (this.finishTime ?? this.t) - STAGE_TIME);
  }

  // input: { lane: -1|0|1 (press this frame), jump: bool (press), glue: bool (held) }
  step(dt, input = {}) {
    if (this.finished) return;
    this.t += dt;
    const down = this.fallT > 0;

    if (input.lane && !down) {
      const nl = Math.max(-1, Math.min(1, this.lane + input.lane));
      if (nl !== this.lane) {
        this.lane = nl;
        this.events.push({ type: 'lane' });
      }
    }
    const tx = this.lane * LANE_W;
    const dx = tx - this.x;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), LANE_SPEED * dt);

    if (input.jump && this.jumpT < 0 && !down) {
      this.jumpT = 0;
      this.events.push({ type: 'jump' });
    }
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const u = this.jumpT / JUMP_TIME;
      if (u >= 1) {
        this.jumpT = -1;
        this.z = 0;
        this.events.push({ type: 'land' });
      } else {
        this.z = JUMP_HEIGHT * 4 * u * (1 - u);
      }
    }

    // Glue: hold to fix the most recent breakage.
    if (input.glue && this.broken.length && this.glue > 0 && !down) {
      this.glueProgress += dt / GLUE_TIME;
      if (this.glueProgress >= 1) {
        const item = this.broken.pop();
        this.glue--;
        this.glued++;
        this.glueProgress = 0;
        this.events.push({ type: 'glued', item });
      }
    } else {
      this.glueProgress = Math.max(0, this.glueProgress - dt * 2);
    }

    if (this.fallT > 0) {
      this.fallT -= dt;
      this.v = 0;
      if (this.fallT <= 0) {
        this.v = SPEED_START * 0.6;
        this.events.push({ type: 'up' });
      }
    } else {
      const target = (SPEED_START + (SPEED_END - SPEED_START) * this.progress) * (1 - BROKEN_SLOWDOWN * this.broken.length);
      const dv = target - this.v;
      this.v += Math.sign(dv) * Math.min(Math.abs(dv), ACCEL * dt);
    }
    this.boost = Math.max(0, this.boost - BOOST_DECAY * dt);
    this.s += (this.v + (this.fallT > 0 ? 0 : this.boost)) * dt;
    if (this.invulnT > 0) this.invulnT -= dt;

    if (this.creatureS >= this.s && this.invulnT <= 0 && this.fallT <= 0) {
      this.creatureBack += CREATURE_KNOCKBACK;
      this.events.push({ type: 'bitten' });
      this._hit('creature');
    }

    for (const o of this.obstacles) {
      if (o.walks && o.s - this.s < 30) o.s -= o.walks * dt;
      if (o.sway) {
        const k = 0.5 + 0.5 * Math.sin((2 * Math.PI * this.t) / o.sway.period + o.sway.phase);
        o.x = LANE_W * (o.sway.from + (o.sway.to - o.sway.from) * k);
      }
    }
    this._claws();
    for (const tr of this.trams) {
      if (!tr.active && this.s >= tr.triggerS) {
        tr.active = true;
        this.events.push({ type: 'bell' });
      }
      if (tr.active) tr.s -= TRAM_SPEED * dt;
    }

    this._collide();

    if (this.s >= ROUTE_LENGTH) {
      this.s = ROUTE_LENGTH;
      this.finished = true;
      this.finishTime = this.t;
      this.events.push({ type: 'finish' });
    }
  }

  _collide() {
    const ps0 = this.s - PLAYER_LEN / 2;
    const ps1 = this.s + PLAYER_LEN / 2;
    const overlapX = (x, w) => Math.abs(this.x - x) < (PLAYER_W + w) / 2;

    for (const p of this.pickups) {
      if (p.taken || p.s > this.s + 3) continue;
      if (Math.abs(p.s - this.s) < PICKUP_R && Math.abs(p.x - this.x) < PICKUP_R) {
        p.taken = true;
        if (p.kind === 'record') {
          this.records++;
          this.boost = Math.min(BOOST_MAX, this.boost + RECORD_BOOST);
        }
        else this.glue = Math.min(GLUE_MAX, this.glue + 1);
        this.events.push({ type: 'pickup', kind: p.kind });
      }
    }

    if (this.invulnT > 0 || this.fallT > 0) return;

    for (const o of this.obstacles) {
      if (o.hit || o.s > ps1 + 2) continue;
      if (o.s + o.len / 2 < ps0 || o.s - o.len / 2 > ps1) continue;
      if (!overlapX(o.x, o.w)) continue;
      if (o.jump && this.z > JUMP_CLEAR) continue;
      o.hit = true;
      this._hit(o.kind);
      return;
    }

    for (const tr of this.trams) {
      if (!tr.active || tr.hit) continue;
      if (tr.s > ps1 || tr.s + TRAM_LEN < ps0) continue;
      if (!overlapX(0, TRAM_W)) continue;
      tr.hit = true;
      // Bounced off onto the nearer pavement.
      this.lane = this.x <= 0 ? -1 : 1;
      this._hit('tram');
      return;
    }
  }

  // The creature reaches up the lane Gurry is in when it triggers.
  _claws() {
    for (const c of this.claws) {
      if (c.state === 'idle' && this.s >= c.s) {
        c.state = 'warn';
        c.lane = this.lane;
        c.t0 = this.t;
        this.events.push({ type: 'clawWarn', lane: c.lane });
      }
      const age = this.t - c.t0;
      if (c.state === 'warn' && age >= CLAW_WARN) {
        c.state = 'slam';
        this.events.push({ type: 'claw', lane: c.lane });
      }
      if (c.state === 'slam') {
        const over = Math.abs(this.x - c.lane * LANE_W) < (PLAYER_W + CLAW_W) / 2;
        if (!c.hit && over && this.invulnT <= 0 && this.fallT <= 0) {
          c.hit = true;
          this.events.push({ type: 'bitten' });
          this._hit('creature');
        }
        if (age >= CLAW_WARN + CLAW_SLAM) c.state = 'done';
      }
    }
  }

  _hit(by) {
    this.hits++;
    this.boost = 0;
    this.invulnT = INVULN_TIME;
    if (this.broken.length < ITEMS.length) {
      const item = ITEMS.find((i) => !this.broken.includes(i.key)).key;
      this.broken.push(item);
      this.v *= HIT_SPEED_KEEP;
      this.events.push({ type: 'break', item, by });
    } else if (by === 'creature') {
      this.v *= HIT_SPEED_KEEP;
      this.events.push({ type: 'gnawed', by });
    } else {
      this.falls++;
      this.fallT = FALL_TIME;
      this.v = 0;
      this.jumpT = -1;
      this.z = 0;
      this.events.push({ type: 'fall', by });
    }
  }

  // Plain JSON for the end card, localStorage and a future leaderboard.
  result() {
    return {
      seed: this.course.seed,
      time: this.finishTime,
      late: this.late,
      hits: this.hits,
      falls: this.falls,
      broken: [...this.broken],
      glued: this.glued,
      records: this.records,
      recordsTotal: this.course.recordsTotal,
    };
  }
}
