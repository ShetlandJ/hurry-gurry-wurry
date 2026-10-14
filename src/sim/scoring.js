// Score out of 10 from a run result. Pure.
// Only a clean, on-time run is a 10; anything else is capped at 9.95 and
// shown floored, so it never rounds up to a 10.
// Bump SCORING_VERSION whenever a cost changes what a 10 means.
export const SCORING_VERSION = 1;

export const COSTS = {
  hit: 0.6,
  fall: 1.0, // on top of the hit
  brokenAtFinish: 1.2, // per item still broken on stage
  latePerSecond: 0.12,
};

export function scoreRun(r) {
  const perfect = r.hits === 0 && r.late === 0;
  let score =
    10 -
    r.hits * COSTS.hit -
    r.falls * COSTS.fall -
    r.broken.length * COSTS.brokenAtFinish -
    r.late * COSTS.latePerSecond;
  score = Math.max(0, Math.min(perfect ? 10 : 9.95, score));
  return {
    score,
    whole: Math.floor(score),
    tenths: Math.floor(score * 10) / 10,
    perfect,
    version: SCORING_VERSION,
  };
}
