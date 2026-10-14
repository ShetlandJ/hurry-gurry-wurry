// Drives the real sim with a scripted bot and checks the scoring.
// 1. Every course is beatable cleanly (a bot gets a 10 on every seed).
// 2. Same seed + same inputs = same result.
// 3. Scoring edge cases.
import assert from 'node:assert/strict';
import { buildCourse } from '../src/sim/course.js';
import { Runner } from '../src/sim/runner.js';
import { scoreRun } from '../src/sim/scoring.js';
import { quipFor } from '../src/sim/quips.js';
import { SIM_DT, LANE_W, JUMP_TIME, TRAM_SPEED, TRAM_LEN, STAGE_TIME } from '../src/config.js';

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}

// Looks ahead per lane and dodges or jumps.
function bot(r) {
  const horizon = r.v * 1.0 + 5;
  const threat = (lane) => {
    let block = Infinity;
    let jump = Infinity;
    for (const o of r.obstacles) {
      const lanes = o.sway ? [o.sway.from, o.sway.to] : [o.lane];
      if (o.hit || !lanes.includes(lane)) continue;
      const d = o.s - o.len / 2 - r.s;
      if (d < -1 || d > horizon) continue;
      if (o.jump) jump = Math.min(jump, d);
      else block = Math.min(block, d);
    }
    if (lane === 0) {
      for (const tr of r.trams) {
        if (!tr.active || tr.s + TRAM_LEN < r.s - 1) continue;
        const d = tr.s - r.s;
        if (d / (r.v + TRAM_SPEED) < 2.0) block = Math.min(block, Math.max(0, d));
      }
    }
    for (const c of r.claws) if ((c.state === 'warn' || c.state === 'slam') && c.lane === lane) block = 0;
    return { block, jump };
  };

  const input = { lane: 0, jump: false, glue: r.broken.length > 0 };
  const settled = Math.abs(r.x - r.lane * LANE_W) < 0.05;
  const here = threat(r.lane);
  if (here.block < Infinity && settled) {
    const options = [-1, 0, 1]
      .filter((l) => l !== r.lane)
      .map((l) => ({ l, t: threat(l), via: Math.abs(l - r.lane) === 2 ? threat(0) : null }))
      .filter((o) => o.t.block === Infinity && (!o.via || o.via.block > 3))
      .sort((a, b) => Math.abs(a.l - r.lane) - Math.abs(b.l - r.lane) || (a.t.jump === Infinity ? -1 : 1));
    if (options.length) input.lane = Math.sign(options[0].l - r.lane);
  }
  if (here.jump < Infinity && here.jump <= r.v * JUMP_TIME * 0.35 && here.jump >= 0) input.jump = true;
  return input;
}

function play(seed, driver = bot) {
  const r = new Runner(buildCourse(seed));
  let guard = 0;
  while (!r.finished && guard++ < 120 * 300) r.step(SIM_DT, driver(r));
  assert.ok(r.finished, 'run never finished');
  return r;
}

console.log('courses');
const SEEDS = Array.from({ length: 40 }, (_, i) => `seed${i}`);
const times = [];
check('a careful bot gets a clean 10 on 40 seeds', () => {
  const bad = [];
  for (const seed of SEEDS) {
    const r = play(seed);
    times.push(r.finishTime);
    const sc = scoreRun(r.result());
    if (!sc.perfect) bad.push(`${seed}: hits ${r.hits} late ${r.late.toFixed(1)}`);
  }
  assert.deepEqual(bad, []);
});
check(`clean runs finish with a few seconds spare (stage at ${STAGE_TIME}s)`, () => {
  const worst = Math.max(...times);
  console.log(`       clean times ${Math.min(...times).toFixed(1)}–${worst.toFixed(1)}s`);
  assert.ok(STAGE_TIME - worst > 3 && STAGE_TIME - worst < 10, `worst ${worst.toFixed(1)}s`);
});
check('every course has records, glue and at least two trams', () => {
  for (const seed of SEEDS) {
    const c = buildCourse(seed);
    assert.ok(c.recordsTotal > 20, `${seed} records ${c.recordsTotal}`);
    assert.ok(c.pickups.some((p) => p.kind === 'glue'), `${seed} no glue`);
    assert.ok(c.trams.length >= 2, `${seed} trams ${c.trams.length}`);
  }
});
check('every claw fires; the bot dodges them and a player who stands still gets clawed', () => {
  const r = play('seed5');
  assert.equal(r.claws.length, 3);
  assert.ok(r.claws.every((c) => c.state === 'done' && !c.hit), JSON.stringify(r.claws));
  const lazy = play('seed5', () => ({ glue: true }));
  assert.ok(lazy.claws.some((c) => c.hit), 'no claw ever landed');
});
check('set pieces are on the course', () => {
  const kinds = new Set(buildCourse('seed1').obstacles.map((o) => o.kind));
  for (const k of ['barrier', 'fan', 'drunk']) assert.ok(kinds.has(k), `missing ${k}`);
});
check('same seed, same result', () => {
  assert.deepEqual(play('repeat').result(), play('repeat').result());
});

console.log('hits and glue');
check('running straight up the middle hits things, breaks kit and ends late', () => {
  const r = play('seed3', () => ({}));
  assert.ok(r.hits >= 3, `hits ${r.hits}`);
  assert.ok(r.falls >= 1, `falls ${r.falls}`);
  assert.equal(r.broken.length, 3);
  const sc = scoreRun(r.result());
  assert.ok(sc.whole < 5, `scored ${sc.tenths}`);
});
check('holding glue fixes breakages and uses tubes', () => {
  const r = play('seed3', () => ({ glue: true }));
  assert.ok(r.glued >= 1, `glued ${r.glued}`);
  assert.ok(r.glue === 0 || r.broken.length === 0, 'tubes left over with kit still broken');
});

console.log('scoring');
const base = { hits: 0, falls: 0, broken: [], late: 0 };
check('clean and on time is exactly 10', () => assert.equal(scoreRun(base).score, 10));
check('one hit, glued, is a 9', () => assert.equal(scoreRun({ ...base, hits: 1 }).whole, 9));
check('late but clean is capped below 10', () => {
  const sc = scoreRun({ ...base, late: 0.01 });
  assert.equal(sc.whole, 9);
  assert.equal(sc.perfect, false);
});
check('never below zero', () => assert.equal(scoreRun({ hits: 30, falls: 20, broken: ['a', 'b', 'c'], late: 60 }).score, 0));
check('quips are deterministic', () => assert.equal(quipFor(7, 'x'), quipFor(7, 'x')));

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
