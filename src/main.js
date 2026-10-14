import { SIM_DT, LANE_W, ROUTE_LENGTH, STAGE_TIME, ITEMS, LANDMARKS, VENUE, FLIP_FROM, FLIP_TO } from './config.js';
import { buildCourse, SET_PIECES } from './sim/course.js';
import { Runner } from './sim/runner.js';
import { scoreRun, SCORING_VERSION } from './sim/scoring.js';
import { quipFor } from './sim/quips.js';
import { randomSeed } from './util/rng.js';
import { Scene } from './render/scene.js';
import { INK, CREAM, RED, TEAL, ORANGE, MUSTARD, PINK } from './render/palette.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

// The synth loop in audio.js; no file, so startMusic falls back to it.
const CHIPTUNE = { file: 'chiptune', title: '8-Bit Wonk' };

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
if (params.has('touch') || matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

function store(key, fallback) {
  try {
    const v = localStorage.getItem(`hgw:${key}`);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function keep(key, v) {
  try {
    localStorage.setItem(`hgw:${key}`, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

class Game {
  constructor() {
    this.scene = new Scene($('c'));
    this.audio = new Audio();
    this.input = new Input($('c'), $('glue-btn'));
    this.input.onPause = () => (this.state === 'play' ? this.pause() : this.state === 'paused' && this.resume());
    this.input.onMute = () => this.toggleMute();
    this.state = 'title';
    this.run = null;
    this.t = 0;
    this.acc = 0;
    this.last = performance.now();
    this.track = null;
    this.toastTimer = 0;
    this.tramTimer = 0;
    this.landmarkIdx = 0;
    this.squelchT = 0;

    window.addEventListener('resize', () => this.scene.resize());
    document.addEventListener('visibilitychange', () => document.hidden && this.state === 'play' && this.pause());
    $('play-btn').addEventListener('click', () => this.start());
    $('again-btn').addEventListener('click', () => this.start());
    $('share-btn').addEventListener('click', () => this.share());
    $('resume-btn').addEventListener('click', () => this.resume());
    $('quit-btn').addEventListener('click', () => this.toTitle());
    $('track-chip').addEventListener('click', () => this.nextTrack());
    for (const b of document.querySelectorAll('[data-action]')) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.dataset.action === 'mute') this.toggleMute();
        else this.pause();
      });
    }
    document.querySelector('[data-action=mute]').classList.toggle('muted', this.audio.muted);
    this._showBest();

    // Whatever Glue tracks are in public/music/, plus the chiptune loop.
    this.tracks = [CHIPTUNE];
    this.track = CHIPTUNE;
    this.audio.probe().then((found) => {
      this.tracks = [...found, CHIPTUNE];
      const saved = params.get('track') || store('track', 'like-a-landlord');
      this.track = this.tracks.find((t) => t.file === saved) || this.tracks[0];
      $('track-name').textContent = this.track.title;
      $('track-chip').hidden = this.tracks.length < 2;
    });

    window.__game = this;
    requestAnimationFrame((t) => this.frame(t));
  }

  nextTrack() {
    const list = this.tracks;
    this.track = list[(list.indexOf(this.track) + 1) % list.length];
    $('track-name').textContent = this.track.title;
    keep('track', this.track.file);
  }

  toggleMute() {
    const m = this.audio.toggleMute();
    document.querySelector('[data-action=mute]').classList.toggle('muted', m);
  }

  start() {
    this.audio.unlock();
    this.seed = params.get('seed') || randomSeed();
    this.run = new Runner(buildCourse(this.seed));
    this.state = 'countdown';
    this.countdown = 3;
    this.lastBeep = 4;
    this.acc = 0;
    this.landmarkIdx = 1;
    this.pieceIdx = 0;
    this._setFlip(false);
    this.outroT = 0;
    this.input.clear();
    this.audio.setDamage(0);
    this.audio.startMusic(this.track);
    $('title').hidden = true;
    $('end').hidden = true;
    $('paused').hidden = true;
    $('hud').hidden = false;
    $('tram-warn').hidden = true;
    $('toast').hidden = true;
    this._hudKit();
    const np = $('now-playing');
    const credited = !!this.track.url;
    np.hidden = !credited;
    if (credited) {
      np.innerHTML = `Now playing <b>${this.track.title}</b> by Gurry Wurry`;
      np.style.animation = 'none';
      void np.offsetWidth;
      np.style.animation = '';
    }
  }

  pause() {
    if (this.state !== 'play' && this.state !== 'countdown') return;
    this.prevState = this.state;
    this.state = 'paused';
    this.audio.pauseMusic(true);
    $('paused').hidden = false;
  }

  resume() {
    this.state = this.prevState || 'play';
    this.last = performance.now();
    this.audio.pauseMusic(false);
    $('paused').hidden = true;
  }

  toTitle() {
    this.audio.stopMusic(0.4);
    this._setFlip(false);
    this.state = 'title';
    this.run = null;
    $('paused').hidden = true;
    $('end').hidden = true;
    $('hud').hidden = true;
    $('title').hidden = false;
    this._showBest();
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const run = this.run;

    if (this.state === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n < this.lastBeep && n > 0) {
        this.lastBeep = n;
        this.audio.beep(false);
        this._countdown(String(n));
      }
      if (this.countdown <= 0) {
        this.audio.beep(true);
        this._countdown('HURRY!', true);
        setTimeout(() => ($('countdown').hidden = true), 700);
        this.state = 'play';
      }
    } else if (this.state === 'play') {
      this.acc += dt;
      while (this.acc >= SIM_DT && !run.finished) {
        run.step(SIM_DT, this.input.take());
        this.acc -= SIM_DT;
      }
      this._events();
      if (run.glueProgress > 0) {
        this.squelchT -= dt;
        if (this.squelchT <= 0) {
          this.audio.squelch();
          this.squelchT = 0.14;
        }
      }
      if (run.finished) {
        this.state = 'outro';
        this.outroT = 0;
      }
    } else if (this.state === 'outro') {
      this.outroT += dt;
      if (this.outroT > 1.9 && $('end').hidden) this._end();
    }

    this._render(dt);
    this._hud(dt);
    requestAnimationFrame((t) => this.frame(t));
  }

  _render(dt) {
    const run = this.run;
    const t = this.t;
    if (!run) {
      // Title: Gurry waiting at Elm Row, the thing peering up behind him.
      this.scene.render(null, {
        s: -2,
        px: -LANE_W,
        extra: 2,
        rise: 0.85,
        look: Math.sin(t * 0.7),
        t,
        dt,
        gurry: { phase: Math.sin(t * 2) * 0.2, z: 0, fallen: false, broken: new Set(), glueing: 0, flash: false, t },
      });
      return;
    }
    let px = run.x;
    let extra = 0;
    if (this.state === 'outro') {
      // trot into the doors
      const k = Math.min(1, this.outroT / 1.2);
      px = run.x * (1 - k);
      extra = k * 3.5;
    }
    const rise = this.state === 'outro' ? Math.max(0, this.scene.creatureRise(run) - this.outroT) : this.scene.creatureRise(run);
    const moving = this.state === 'play' || this.state === 'outro';
    this.scene.render(run, {
      s: run.s,
      px,
      extra,
      rise,
      look: Math.max(-1, Math.min(1, run.x / LANE_W)),
      t,
      dt: this.state === 'paused' ? 0 : dt,
      venueOpen: this.state === 'outro' || this.state === 'end',
      speedLines: moving ? Math.min(1, Math.max(0, (run.v + run.boost - 11) / 2)) : 0,
      gurry:
        this.state === 'outro' && this.outroT > 1.25
          ? null
          : {
              phase: moving ? run.s * 1.35 + (this.state === 'outro' ? this.outroT * 10 : 0) : 0,
              z: run.z,
              fallen: run.fallT > 0,
              broken: new Set(run.broken),
              glueing: run.glueProgress,
              flash: run.invulnT > 0 && run.fallT <= 0,
              t,
            },
    });
  }

  _gurryScreen() {
    const s = this.scene;
    return { x: s.W / 2 + this.run.x * s.u, y: s.playerY - 1.1 * s.u };
  }

  _events() {
    const run = this.run;
    for (const e of run.events) {
      const p = this._gurryScreen();
      switch (e.type) {
        case 'jump':
          this.audio.jump();
          break;
        case 'land':
          this.audio.land();
          break;
        case 'lane':
          this.audio.lane();
          break;
        case 'pickup':
          if (e.kind === 'record') {
            this.audio.record();
            this.scene.burst(p.x, p.y - 10, [ORANGE, INK], 5, 120);
          } else {
            this.audio.glueTube();
            this._toast('+1 glue', 'small');
          }
          break;
        case 'break': {
          const item = ITEMS.find((i) => i.key === e.item);
          this.audio.crash();
          this.audio.wobble();
          this.audio.setDamage(run.broken.length);
          this.scene.shake = 1;
          this.scene.burst(p.x, p.y, [INK, CREAM, RED, TEAL, PINK], 18, 260);
          this._toast(e.by === 'creature' ? `Bitten! ${item.label} broke` : item.broke, 'bad');
          if (run.glue > 0 && !this.taughtGlue) {
            this.taughtGlue = true;
            setTimeout(() => this.state === 'play' && run.broken.length && this._toast('Hold GLUE to fix it', 'small'), 900);
          }
          if (navigator.vibrate) navigator.vibrate(60);
          break;
        }
        case 'fall':
          this.audio.crash();
          this.audio.fall();
          this.audio.wobble();
          this.scene.shake = 1.4;
          this.scene.burst(p.x, p.y, [INK, CREAM, MUSTARD], 22, 300);
          this._toast(e.by === 'creature' ? 'Bitten. Down he goes' : 'Down he goes', 'bad');
          if (navigator.vibrate) navigator.vibrate([60, 40, 90]);
          break;
        case 'up':
          break;
        case 'clawWarn':
          this.audio.clawWarn();
          break;
        case 'claw':
          this.audio.clawSlam();
          this.scene.shake = 0.7;
          break;
        case 'bitten':
          this.audio.growl();
          this.scene.shake = 0.8;
          break;
        case 'gnawed':
          this.audio.crash();
          this.audio.wobble();
          this._toast('Bitten!', 'bad');
          break;
        case 'glued':
          this.audio.glued();
          this.audio.setDamage(run.broken.length);
          this.scene.burst(p.x, p.y, [CREAM, MUSTARD], 12, 160);
          this._toast(`${ITEMS.find((i) => i.key === e.item).label}: glued`, 'small');
          {
            const el = document.querySelector(`.kit-item[data-item=${e.item}]`);
            el.classList.add('fixed');
            setTimeout(() => el.classList.remove('fixed'), 450);
          }
          break;
        case 'bell':
          this.audio.bell();
          $('tram-warn').hidden = false;
          this.tramTimer = 2.4;
          break;
        case 'finish':
          this.audio.cheer();
          this.scene.burst(p.x, p.y - 40, [RED, CREAM, INK, MUSTARD, PINK], 40, 380);
          break;
      }
    }
    run.events.length = 0;

    // cross streets
    const lm = LANDMARKS[this.landmarkIdx];
    if (lm && run.s >= lm.s && lm.s < ROUTE_LENGTH) {
      if (lm.s !== FLIP_FROM) this._toast(lm.name, 'small');
      this.landmarkIdx++;
    }
    // set pieces get announced just before they arrive
    const piece = SET_PIECES[this.pieceIdx];
    if (piece && run.s >= piece.from - 28) {
      this._banner(piece.name, piece.sub);
      this.pieceIdx++;
    }
    // Pilrig: over the old border into Leith, and into the negative
    const flip = run.s >= FLIP_FROM && run.s < FLIP_TO;
    if (flip !== this.flipped) {
      this._setFlip(flip);
      if (flip) {
        this.audio.tapeStop();
        this._banner('Welcome to Leith', 'Pilrig St: the old border');
      } else {
        this._toast('Back to normal. Ish.', 'small');
      }
    }
  }

  _toast(text, kind = '') {
    const el = $('toast');
    el.textContent = text;
    el.className = `toast ${kind}`;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    this.toastTimer = kind === 'small' ? 1.0 : 1.3;
  }

  _banner(title, sub) {
    const el = $('banner');
    el.querySelector('b').textContent = title;
    el.querySelector('small').textContent = sub;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => (el.hidden = true), 2200);
  }

  _setFlip(on) {
    this.flipped = on;
    $('app').classList.toggle('flipped', on);
    this.audio.setFlip(on);
  }

  _countdown(text, go = false) {
    const el = $('countdown');
    el.hidden = false;
    el.textContent = text;
    el.className = `countdown${go ? ' go' : ''}`;
  }

  _hudKit() {
    const run = this.run;
    for (const el of document.querySelectorAll('.kit-item')) el.classList.toggle('broken', run.broken.includes(el.dataset.item));
  }

  _hud(dt) {
    const run = this.run;
    if (!run || this.state === 'title') return;
    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) $('toast').hidden = true;
    if (this.tramTimer > 0 && (this.tramTimer -= dt) <= 0) $('tram-warn').hidden = true;

    const p = run.progress;
    $('route-fill').style.width = `${p * 100}%`;
    $('route-gurry').style.left = `${p * 100}%`;
    $('route-creature').style.left = `${Math.max(0, Math.min(1, run.creatureS / ROUTE_LENGTH)) * 100}%`;
    const next = LANDMARKS.find((l) => l.s > run.s) || LANDMARKS[LANDMARKS.length - 1];
    $('landmark').textContent = run.finished ? VENUE : next.name;

    const left = STAGE_TIME - (run.finishTime ?? run.t);
    const clock = $('clock');
    const fmt = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
    clock.classList.toggle('late', left < 0);
    clock.classList.toggle('tight', left >= 0 && this.scene.creatureRise(run) > 0.4);
    clock.querySelector('small').textContent = left < 0 ? 'Late by' : 'On stage in';
    clock.querySelector('b').textContent = left < 0 ? `+${fmt(-left)}` : fmt(Math.max(0, Math.ceil(left)));

    this._hudKit();
    $('glue-count').textContent = run.glue;
    const btn = $('glue-btn');
    btn.classList.toggle('ready', run.broken.length > 0 && run.glue > 0);
    btn.classList.toggle('empty', run.glue === 0);
    $('glue-progress').style.strokeDashoffset = String(276.5 * (1 - run.glueProgress));
  }

  _end() {
    const r = this.run.result();
    const sc = scoreRun(r);
    const quip = quipFor(sc.whole, r.seed);
    this.result = { ...r, ...sc, quip, scoringVersion: SCORING_VERSION, at: new Date().toISOString() };
    console.log('[hurry] run result', this.result);
    const runs = store('runs', []);
    runs.unshift(this.result);
    keep('runs', runs.slice(0, 10));
    const best = store('best', null);
    if (!best || sc.score > best.score) keep('best', { score: sc.score, whole: sc.whole });

    this.state = 'end';
    this.audio.stopMusic(2.5);
    $('hud').hidden = true;
    const head = $('end-head');
    head.textContent = r.late > 0 ? `Late by ${r.late.toFixed(1)}s` : `Made it to ${VENUE}`;
    head.classList.toggle('late', r.late > 0);
    $('end-score').textContent = sc.whole;
    $('end-score').parentElement.classList.toggle('perfect', sc.perfect);
    $('end-tenths').textContent = sc.perfect ? '10' : sc.tenths.toFixed(1);
    $('end-quip').textContent = quip;
    const m = Math.floor(r.time / 60);
    $('st-time').textContent = `${m}:${(r.time % 60).toFixed(1).padStart(4, '0')}`;
    $('st-hits').textContent = r.hits;
    $('st-records').textContent = `${r.records}/${r.recordsTotal}`;
    $('st-glued').textContent = r.glued;
    $('end').hidden = false;
  }

  async share() {
    const r = this.result;
    const url = location.origin + location.pathname;
    const text = `I got Gurry Wurry down Leith Walk to his album launch: ${r.perfect ? '10' : r.tenths.toFixed(1)} out of 10. “${r.quip}”`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Hurry, Gurry Wurry!', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      $('share-btn').textContent = 'COPIED';
      setTimeout(() => ($('share-btn').textContent = 'SHARE'), 1500);
    } catch {
      /* cancelled */
    }
  }

  _showBest() {
    const best = store('best', null);
    $('best').hidden = !best;
    if (best) $('best').textContent = `Your best: ${best.whole} out of 10`;
  }
}

new Game();
