# CLAUDE.md

Hurry, Gurry Wurry!: a 2D canvas + Vite browser runner for Gurry Wurry (Dave King, Leith avant-pop musician), made by James to promote his album *Glue* (Bandcamp: https://gurrywurry.bandcamp.com/album/glue). Gurry runs down Leith Walk to his launch gig at Leith Theatre, dodging trams, landlords and loveseats while the horned creature from the Glue sleeve chases him. It goes out to his Instagram audience, so most players are on phones in portrait.

Gurry has given permission to use any of his songs, but James hasn't yet cleared publishing the MP3s: `public/music/*` is gitignored, so the live site plays the chiptune. Don't commit audio until James says so.

## Commands

```bash
npm run dev     # vite --host; add ?touch to force touch UI, ?seed=x to fix the course
npm test        # scripts/test.mjs: bot plays 40 seeds through the real sim + scoring checks
npm run build   # dist/ (base './' so it works under a GitHub Pages subpath)
```

Run `npm test` after touching `src/sim/` or `src/config.js`. The bot must get a clean 10 on every seed: that's the guarantee every course is fair. It also checks a clean run finishes 3–10s before `STAGE_TIME`, so speed changes need `STAGE_TIME` re-tuning.

## Coordinates

- `s` = metres along Leith Walk from Elm Row, increasing **up** the screen. `x` = metres, positive right.
- Lanes: `-1` left pavement, `0` tram line, `1` right pavement, `LANE_W` apart. Gurry starts on the left.
- Renderer: `u` = pixels per metre; sprites are anchored at their feet; heights squashed by `K` (high three-quarter view). Trams are top-down with the nose at the low-`s` end.

## Architecture

- `src/sim/` is pure and deterministic (no DOM, `Date` or `Math.random`): `course.js` builds obstacles/pickups/trams from a seed, `runner.js` steps one run at `SIM_DT` (120Hz) from input frames, `scoring.js` turns a result into a score, `quips.js` picks Gurry's line by seed.
- Course rules: every row leaves a passable lane; after a tram rings (`TRAM_ZONE`) only jumpables on the pavements, so no one is forced across the tracks.
- Hits break kit in order heart → keyboard → mic and slow him `BROKEN_SLOWDOWN` each; holding glue (`GLUE_TIME`) fixes the latest. A hit with everything broken knocks him down (`FALL_TIME`).
- The Glue creature runs a clean run's speed profile delayed so it reaches the stage at exactly `STAGE_TIME`. It rises from the bottom of the screen as it closes in (`CREATURE_SHOW`); when it catches him, he's late. It's purely visual and never ends the run.
- Scores: only clean and on time is 10; anything else capped at 9.95 and shown floored. Bump `SCORING_VERSION` if costs change what a 10 means. Results are plain JSON (console + last 10 in localStorage under `hgw:`).
- `src/main.js` is the loop/state machine (title → countdown → play → outro → end) and DOM HUD. `src/render/` is canvas only.

## Music

- Glue tracks go in `public/music/<file>.mp3` using the slugs in `TRACKS` (`src/config.js`); `start` skips into the song. Found tracks plus the "8-Bit Wonk" chiptune (the synth `WonkyLoop` in `audio.js`) are cycled by the Soundtrack chip on the title. Default is Like A Landlord (James's pick).
- `Audio.probe()` checks content-type because Vite dev serves index.html for missing files.
- Breakages detune the music (`setDamage`, `playbackRate` with `preservesPitch = false`) and wobble it; glue restores it.

## Style

The Glue / Happy For Now sleeves: linocut print look, flat vermilion, ink black, paper cream, olive, faded pink, with paper grain multiplied over the canvas. Anton for display and DM Serif Display for prose. Gurry's look comes from his photos: long dark hair, a pink/teal/mustard 80s windbreaker and a teal toy keyboard. Shop signs and quips are puns on Glue track titles. No purple, no emojis, no gradients.
