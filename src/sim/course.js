// Builds the obstacle course for a seed. Pure: no DOM, no Math.random.
// Every row leaves at least one lane passable (free, or clearable by jumping),
// and rows are spaced so a two-lane dodge is always possible at top speed.
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
};

const JUMPABLE = ['tv', 'bag', 'cone'];
const BLOCKERS = ['sofa', 'bin', 'aboard', 'gull', 'landlord', 'lounger'];

const LANES = [-1, 0, 1];

export function buildCourse(seed) {
  const rng = new Rng(`course:${seed}`);
  const obstacles = [];
  const pickups = [];
  const trams = [];

  const crossings = LANDMARKS.slice(1, -1).map((l) => l.s);
  const nearCrossing = (s) => crossings.some((c) => Math.abs(c - s) < 9);

  let s = 48;
  let tramUntil = -1;
  let nextTram = rng.range(150, 200);
  let nextGlue = rng.range(110, 150);

  const add = (kind, lane, at) => {
    const o = { kind, lane, s: at };
    if (kind === 'aboard') o.lines = rng.pick(ABOARD_LINES);
    if (kind === 'landlord') o.s += 8; // he walks back into place
    obstacles.push(o);
  };

  while (s < ROUTE_LENGTH - 40) {
    const p = s / ROUTE_LENGTH;
    if (nearCrossing(s)) {
      s += 10;
      continue;
    }

    if (s >= nextTram && s < ROUTE_LENGTH - 150) {
      trams.push({ triggerS: s });
      tramUntil = s + TRAM_ZONE;
      nextTram = s + rng.range(170, 230);
    }

    let free; // lane we lay records along
    if (s < tramUntil) {
      // Tram coming down the middle: pavements only, and only jumpables, so
      // nobody is forced across the tracks.
      const side = rng.pick([-1, 1]);
      if (rng.chance(0.7)) add(rng.pick(JUMPABLE), side, s);
      free = rng.chance(0.5) ? -side : side;
      if (free === 0) free = -side;
    } else {
      const pattern = rng.weighted([
        { name: 'one', weight: 1.2 - p * 0.6 },
        { name: 'two', weight: 0.6 + p * 0.8 },
        { name: 'wall', weight: p > 0.2 ? 0.35 : 0 },
        { name: 'squeeze', weight: p > 0.35 ? 0.4 : 0 },
      ]).name;
      const order = rng.next() < 0.5 ? [...LANES] : [...LANES].reverse();
      // shuffle
      for (let i = order.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (pattern === 'one') {
        const lane = order[0];
        add(rng.chance(0.55) ? rng.pick(BLOCKERS) : rng.pick(JUMPABLE), lane, s);
        free = order[1];
      } else if (pattern === 'two') {
        add(rng.pick(BLOCKERS), order[0], s);
        add(rng.chance(0.5) ? rng.pick(BLOCKERS) : rng.pick(JUMPABLE), order[1], s);
        free = order[2];
      } else if (pattern === 'wall') {
        // Tram works: cones right across. Jump.
        for (const lane of LANES) add('cone', lane, s);
        free = order[0];
      } else {
        add(rng.pick(BLOCKERS), order[0], s);
        add(rng.pick(BLOCKERS), order[1], s);
        add(rng.pick(JUMPABLE), order[2], s);
        free = order[2];
      }
    }

    // Records lead into the free lane; a glue tube now and then.
    if (s >= nextGlue) {
      pickups.push({ kind: 'glue', lane: free, s: s - 4 });
      nextGlue = s + rng.range(120, 170);
    } else if (rng.chance(0.75)) {
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) pickups.push({ kind: 'record', lane: free, s: s - 6.5 + i * 2.2 });
    }

    const gap = 26 - p * 9;
    s += gap + rng.range(-2, 4);
  }

  obstacles.sort((a, b) => a.s - b.s);
  pickups.sort((a, b) => a.s - b.s);
  return {
    seed,
    obstacles,
    pickups,
    trams,
    recordsTotal: pickups.filter((p) => p.kind === 'record').length,
  };
}
