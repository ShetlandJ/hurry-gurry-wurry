// Sound effects are synthesised with WebAudio. Music is Gurry's own: tracks
// from Glue dropped into public/music/ (see TRACKS in config.js). If none are
// there, a wonky little synth loop stands in.
//
// Every breakage detunes the music a bit (tape-wobble playbackRate) and glue
// puts it back, so the song itself sounds as broken as his kit.
import { TRACKS } from './config.js';

const EXTS = ['mp3', 'm4a', 'ogg'];

function load(key, fallback) {
  try {
    const v = localStorage.getItem(`hgw:${key}`);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function save(key, v) {
  try {
    localStorage.setItem(`hgw:${key}`, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = load('muted', false);
    this.available = []; // tracks whose file exists: [{ ...track, url }]
    this.el = null;
    this.synth = null;
    this.rate = 1;
  }

  // Look for music files. Vite's dev server answers missing files with
  // index.html, so check the content type, not just the status.
  async probe() {
    const base = import.meta.env.BASE_URL;
    const found = await Promise.all(
      TRACKS.map(async (tr) => {
        for (const ext of EXTS) {
          const url = `${base}music/${tr.file}.${ext}`;
          try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.ok && /audio|octet/.test(res.headers.get('content-type') || '')) return { ...tr, url };
          } catch {
            /* not there */
          }
        }
        return null;
      }),
    );
    this.available = found.filter(Boolean);
    return this.available;
  }

  // Must be called from a user gesture (iOS).
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // Instagram's in-app browser on a silenced iPhone mutes Web Audio unless
    // the session is 'playback'.
    if (navigator.audioSession) {
      try {
        navigator.audioSession.type = 'playback';
      } catch {
        /* older WebKit */
      }
    }
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.7;
    this.sfx.connect(this.master);
    this.noise = this._noiseBuffer();
    this._loadCrowd();
  }

  // Optional recording of football fans for the Champions parade:
  // public/audio/crowd.mp3 (or .m4a). Missing is fine; the parade is just quieter.
  async _loadCrowd() {
    for (const ext of ['mp3', 'm4a']) {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}audio/crowd.${ext}`);
        if (!res.ok || !/audio|octet/.test(res.headers.get('content-type') || '')) continue;
        this.crowdBuf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        return;
      } catch {
        /* not there */
      }
    }
  }

  crowd(on) {
    if (!this.ctx || !this.crowdBuf) return;
    const t = this.ctx.currentTime;
    if (on && !this.crowdSrc) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.crowdBuf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.9, t + 0.6);
      src.connect(g).connect(this.master);
      src.start(t);
      this.crowdSrc = { src, g };
    } else if (!on && this.crowdSrc) {
      const { src, g } = this.crowdSrc;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 1.5);
      src.stop(t + 1.6);
      this.crowdSrc = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    save('muted', this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    if (this.el) this.el.muted = this.muted;
    return this.muted;
  }

  // ------------------------------------------------------------ music

  // Call from the tap that starts the run so iOS lets the <audio> play.
  startMusic(track) {
    this.stopMusic();
    this.rate = this.damageRate = this.flipRate = 1;
    if (track?.url) {
      const el = (this.el = new window.Audio(track.url));
      el.loop = true;
      el.preservesPitch = false;
      el.webkitPreservesPitch = false;
      el.muted = this.muted;
      el.volume = 0.85;
      el.currentTime = track.start || 0;
      el.play().catch(() => {});
    } else if (this.ctx) {
      this.synth = new WonkyLoop(this.ctx, this.master);
      this.synth.start();
    }
  }

  stopMusic(fade = 0) {
    if (this.el) {
      const el = this.el;
      this.el = null;
      if (fade) {
        const v0 = el.volume;
        const t0 = performance.now();
        const step = () => {
          const k = (performance.now() - t0) / (fade * 1000);
          if (k >= 1) return el.pause();
          el.volume = v0 * (1 - k);
          requestAnimationFrame(step);
        };
        step();
      } else el.pause();
    }
    if (this.synth) {
      this.synth.stop(fade);
      this.synth = null;
    }
  }

  pauseMusic(paused) {
    if (this.el) paused ? this.el.pause() : this.el.play().catch(() => {});
    if (this.synth) this.synth.paused = paused;
  }

  // brokenCount 0..3 sets how out of tune it sounds; wobble() is a one-off sag.
  setDamage(brokenCount) {
    this.damageRate = 1 - brokenCount * 0.035;
    this._applyRate();
  }

  // Past Pilrig everything goes woozy: slowed-tape music.
  setFlip(on) {
    this.flipRate = on ? 0.8 : 1;
    this._applyRate();
  }

  _applyRate() {
    this.rate = (this.damageRate ?? 1) * (this.flipRate ?? 1);
    if (this.el) this.el.playbackRate = this.rate;
    if (this.synth) this.synth.detune = this.rate;
  }

  wobble() {
    const target = this.el || this.synth;
    if (!target) return;
    const t0 = performance.now();
    const step = () => {
      const k = (performance.now() - t0) / 600;
      const r = this.rate * (1 - 0.18 * Math.sin(Math.min(1, k) * Math.PI));
      if (this.el) this.el.playbackRate = r;
      if (this.synth) this.synth.detune = r;
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  // ------------------------------------------------------------ sfx

  _env(node, t, peak, attack, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _tone(type, f0, f1, dur, peak = 0.3, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this._env(g, t, peak, 0.005, dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise(dur, freq, q, peak, type = 'bandpass', delay = 0, sweepTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t, peak, 0.005, dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 1.5, dur + 0.1);
  }

  jump() {
    this._tone('square', 260, 620, 0.14, 0.12);
  }
  land() {
    this._noise(0.06, 300, 1, 0.25, 'lowpass');
  }
  lane() {
    this._noise(0.05, 2500, 2, 0.08);
  }
  record() {
    this._tone('triangle', 880, 880, 0.08, 0.2);
    this._tone('triangle', 1320, 1320, 0.12, 0.2, 0.06);
  }
  glueTube() {
    this._tone('sine', 300, 900, 0.18, 0.25);
    this._noise(0.15, 1200, 3, 0.15, 'bandpass', 0.05, 400);
  }
  squelch() {
    // glue going on
    this._noise(0.12, 900, 6, 0.35, 'bandpass', 0, 250);
  }
  glued() {
    this._noise(0.2, 400, 4, 0.4, 'bandpass', 0, 1600);
    this._tone('triangle', 523, 523, 0.1, 0.2, 0.05);
    this._tone('triangle', 784, 784, 0.18, 0.2, 0.13);
  }
  crash() {
    this._noise(0.35, 1800, 0.8, 0.7, 'bandpass', 0, 300);
    this._tone('sine', 140, 50, 0.3, 0.6);
    // boing
    this._tone('triangle', 180, 420, 0.25, 0.2, 0.08);
  }
  growl() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.6);
    lfo.frequency.value = 23;
    lg.gain.value = 20;
    lfo.connect(lg).connect(o.frequency);
    this._env(g, t, 0.5, 0.03, 0.6);
    o.connect(g).connect(this.sfx);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.7);
    lfo.stop(t + 0.7);
  }
  clawWarn() {
    // a rising scrape from below
    this._noise(0.8, 300, 3, 0.35, 'bandpass', 0, 2400);
    this._tone('sawtooth', 55, 110, 0.8, 0.12);
  }
  clawSlam() {
    this._tone('sine', 90, 35, 0.35, 0.8);
    this._noise(0.25, 900, 0.7, 0.6, 'lowpass', 0, 200);
  }
  tapeStop() {
    // the record slowing under your finger
    this._tone('sawtooth', 440, 60, 0.9, 0.18);
    this._tone('square', 660, 90, 0.9, 0.08);
  }
  fall() {
    this._tone('sine', 1200, 180, 0.7, 0.25);
    this._noise(0.4, 500, 1, 0.5, 'lowpass', 0.6);
  }
  bell() {
    for (const [d, f] of [
      [0, 1568],
      [0.28, 1568],
    ]) {
      this._tone('sine', f, f, 0.6, 0.25, d);
      this._tone('sine', f * 2.76, f * 2.76, 0.3, 0.08, d);
    }
  }
  beep(high = false) {
    this._tone('square', high ? 1046 : 523, high ? 1046 : 523, high ? 0.35 : 0.12, 0.15);
  }
  cheer() {
    if (!this.ctx) return;
    // crowd: a swell of band-limited noise with clap crackle on top
    this._noise(2.4, 900, 0.6, 0.35, 'bandpass', 0, 1400);
    for (let i = 0; i < 26; i++) this._noise(0.03, 2200 + Math.random() * 1500, 2, 0.25, 'bandpass', 0.1 + Math.random() * 2);
  }

  _noiseBuffer() {
    const len = this.ctx.sampleRate * 2;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
}

// Stand-in music: a lopsided organ-and-bass shuffle that plays until the real
// tracks are dropped in. Detune follows the damage like the real thing.
class WonkyLoop {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.22;
    this.out.connect(out);
    this.detune = 1;
    this.paused = false;
    this.step = 0;
    this.bpm = 128;
  }
  start() {
    this.next = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this._schedule(), 50);
  }
  stop(fade = 0) {
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, fade ? fade / 3 : 0.02);
    setTimeout(() => this.out.disconnect(), (fade + 0.3) * 1000);
  }
  _schedule() {
    const spb = 60 / this.bpm / 2; // eighth notes
    while (this.next < this.ctx.currentTime + 0.15) {
      if (!this.paused) this._play(this.step, this.next, spb);
      this.next += spb;
      this.step++;
    }
  }
  _play(step, t, spb) {
    const bar = Math.floor(step / 8) % 4;
    const i = step % 8;
    const roots = [110, 98, 123.5, 82.4];
    const d = this.detune;
    const r = roots[bar] * d;
    const ctx = this.ctx;
    const note = (type, f, dur, peak, dest = this.out) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    // bass: root, octave bounce, a wrong-ish note on the 7
    const bass = [1, 0, 2, 1, 0, 1, 1.5, 0][i];
    if (bass) note('triangle', r * (bass === 1.5 ? 1.335 : bass === 2 ? 2 : 1), spb * 0.9, 0.6);
    // organ stabs on the off-beats, a cheap combo-organ chord
    if (i % 2 === 1) for (const m of [2, 2.52, 3]) note('square', r * m * 2 * (1 + (i === 7 ? 0.015 : 0)), spb * 0.5, 0.05);
    // drums
    if (i === 0 || i === 4 || (i === 5 && bar === 3)) note('sine', 120 * d, 0.12, 0.8);
    if (i === 2 || i === 6) {
      const src = ctx.createBufferSource();
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const dd = b.getChannelData(0);
      for (let k = 0; k < dd.length; k++) dd[k] = (Math.random() * 2 - 1) * (1 - k / dd.length);
      src.buffer = b;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      src.connect(g).connect(this.out);
      src.start(t);
    }
  }
}
