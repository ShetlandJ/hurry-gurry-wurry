// Builds the obstacle course for a seed. Pure: no DOM, no Math.random.
//
// The Walk is laid out like a song: the same structure every run (a verse of
// ordinary rows, then a set piece, a tram, a claw...) with the details
// randomised. Every row leaves at least one lane passable (free, or clearable
// by jumping), and rows are spaced so a two-lane dodge is always possible.
import { Rng } from '../util/rng.js';
import { ROUTE_LENGTH, TRAM_ZONE, LANDMARKS, ABOARD_LINES } from '../config.js';

// w = width across the lane, len = depth along the street.
export const KINDS = {
  tv: { jump: true, w: 1.3, len: 0.8, label: 'a telly' },
  bag: { jump: true, w: 1.2, len: 0.9, label: 'a bin bag' },
  cone: { jump: true, w: 0.8, len: 0.8, label: 'a cone' },
  sofa: { jump: false, w: 2.3, len: 1.1, label: 'a loveseat' },
  bin: { jump: false, w: 2.0, len: 1.3, label: 'a communal bin' },
  aboard: { jump: false, w: 1.1, len: 0.8, label: 'an A-board' },
  gull: { jump: false, w: 1.2, len: 1.0, label: 'a gull' },
  landlord: { jump: false, w: 1.0, len: 0.7, label: 'a landlord', walks: 1.4 },
  lounger: { jump: false, w: 2.6, len: 1.2, label: 'a lounging thing' },
  barrier: { jump: false, w: 2.7, len: 0.6, label: 'a barrier' },
  plank: { jump: true, w: 2.9, len: 0.5, label: 'a works barrier' },
  fan: { jump: false, w: 2.4, len: 0.9, label: 'a football fan' },
  drunk: { jump: false, w: 1.0, len: 0.7, label: 'a man with a pint' },
};

const JUMPABLE = ['tv', 'bag', 'cone'];
const BLOCKERS = ['sofa', 'bin', 'aboard', 'gull', 'landlord', 'lounger'];
const LANES = [-1, 0, 1];

// The running order. Set pieces and claws sit at fixed points so every run
// has the same shape; `name` is announced on screen.
export const SET_PIECES = [
  { kind: 'works', from: 232, to: 300, name: 'Tram works', sub: 'jump, jump, jump' },
  { kind: 'parade', from: 408, to: 474, name: 'Champions parade', sub: 'champions bore me' },
  { kind: 'chucking', from: 648, to: 712, name: 'Chucking-out time', sub: 'Thursday evening' },
];
const TRAMS = [308, 545];
const CLAWS = [150, 488, 722];
const CLAW_CLEAR = [-6, 30]; // no obstacles this far around a claw

export function buildCourse(seed) {
  const rng = new Rng(`course:${seed}`);
  const obstacles = [];
  const pickups = [];
  const trams = [];
  const claws = [];

  const crossings = LANDMARKS.slice(1, -1).map((l) => l.s);
  const nearCrossing = (s) => crossings.some((c) => Math.abs(c - s) < 9);

  const add = (kind, lane, at, extra = {}) => {
    const o = { kind, lane, s: at, ...extra };
    if (kind === 'aboard') o.lines = rng.pick(ABOARD_LINES);
    if (kind === 'landlord') o.s += 8; // he walks back into place
    obstacles.push(o);
    return o;
  };
  const records = (lane, s0, n, gap = 2.2) => {
    for (let i = 0; i < n; i++) pickups.push({ kind: 'record', lane, s: s0 + i * gap });
  };
  const shuffled = () => {
    const order = [...LANES];
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  };

  // ---- fixed events, slightly jittered
  for (const at of TRAMS) trams.push({ triggerS: at + rng.range(-4, 4) });
  for (const at of CLAWS) claws.push({ s: at + rng.range(-3, 3) });
  const tramZones = trams.map((t) => [t.triggerS, t.triggerS + TRAM_ZONE]);
  const reserved = [
    ...SET_PIECES.map((p) => [p.from - 8, p.to + 6]),
    ...claws.map((c) => [c.s + CLAW_CLEAR[0], c.s + CLAW_CLEAR[1]]),
  ];
  const inside = (s, ranges) => ranges.some(([a, b]) => s >= a && s <= b);

  // ---- set pieces
  for (const p of SET_PIECES) {
    if (p.kind === 'works') {
      // Low works barriers right across to hop in rhythm; every third row is
      // tall barriers but for one low one you have to get to.
      let i = 0;
      for (let s = p.from + 3; s <= p.to; s += 10.5, i++) {
        if (i % 3 === 2) {
          const open = rng.pick(LANES);
          for (const lane of LANES) add(lane === open ? 'plank' : 'barrier', lane, s);
          records(open, s - 1.5, 2, 3);
        } else {
          for (const lane of LANES) add('plank', lane, s);
          pickups.push({ kind: 'record', lane: rng.pick(LANES), s });
        }
      }
    } else if (p.kind === 'parade') {
      // Fans fill two lanes; the gap weaves one lane at a time.
      let free = rng.pick(LANES);
      for (let a = p.from; a + 12 <= p.to; a += 16) {
        for (let s = a; s <= a + 12; s += 2.4) for (const lane of LANES) if (lane !== free) add('fan', lane, s);
        records(free, a + 1, 5, 2.4);
        const options = LANES.filter((l) => Math.abs(l - free) === 1);
        free = rng.pick(options);
      }
    } else if (p.kind === 'chucking') {
      // Men with pints swaying across two lanes; the other side is clear.
      for (let s = p.from; s <= p.to; s += 13) {
        const side = rng.pick([-1, 1]);
        add('drunk', side, s, {
          sway: { from: side, to: 0, period: rng.range(1.5, 2.1), phase: rng.range(0, Math.PI * 2) },
        });
        records(-side, s - 4, 3);
      }
    }
  }

  // ---- ordinary rows in between
  let s = 48;
  let nextGlue = rng.range(110, 140);
  while (s < ROUTE_LENGTH - 40) {
    const p = s / ROUTE_LENGTH;
    if (nearCrossing(s) || inside(s, reserved)) {
      s += 4;
      continue;
    }

    let free; // lane we lay records along
    if (inside(s, tramZones)) {
      // Tram coming down the middle: pavements only, and only jumpables, so
      // nobody is forced across the tracks.
      const side = rng.pick([-1, 1]);
      if (rng.chance(0.75)) add(rng.pick(JUMPABLE), side, s);
      free = rng.chance(0.5) ? -side : side;
    } else {
      const pattern = rng.weighted([
        { name: 'one', weight: 1.2 - p * 0.6 },
        { name: 'two', weight: 0.6 + p * 0.8 },
        { name: 'squeeze', weight: p > 0.3 ? 0.4 : 0 },
      ]).name;
      const order = shuffled();
      if (pattern === 'one') {
        add(rng.chance(0.55) ? rng.pick(BLOCKERS) : rng.pick(JUMPABLE), order[0], s);
        free = order[1];
      } else if (pattern === 'two') {
        add(rng.pick(BLOCKERS), order[0], s);
        add(rng.chance(0.5) ? rng.pick(BLOCKERS) : rng.pick(JUMPABLE), order[1], s);
        free = order[2];
      } else {
        add(rng.pick(BLOCKERS), order[0], s);
        add(rng.pick(BLOCKERS), order[1], s);
        add(rng.pick(JUMPABLE), order[2], s);
        free = order[2];
      }
    }

    if (s >= nextGlue) {
      pickups.push({ kind: 'glue', lane: free, s: s - 4 });
      nextGlue = s + rng.range(110, 150);
    } else if (rng.chance(0.75)) {
      records(free, s - 6.5, rng.int(2, 4));
    }

    const gap = 24 - p * 8;
    s += gap + rng.range(-2, 4);
  }

  obstacles.sort((a, b) => a.s - b.s);
  pickups.sort((a, b) => a.s - b.s);
  return {
    seed,
    obstacles,
    pickups,
    trams,
    claws,
    recordsTotal: pickups.filter((p) => p.kind === 'record').length,
  };
}
