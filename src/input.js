// Keyboard, swipes and the glue button, folded into one input frame per sim
// step: presses (lane, jump) are latched until the sim consumes them, glue is held.
export class Input {
  constructor(surface, glueButton) {
    this.pending = { lane: 0, jump: false };
    this.keyGlue = false;
    this.touchGlue = false;
    this.keys = new Set();
    this.onPause = null;
    this.onMute = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      if (k === 'ArrowLeft' || k === 'KeyA') this.pending.lane = -1;
      else if (k === 'ArrowRight' || k === 'KeyD') this.pending.lane = 1;
      else if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') this.pending.jump = true;
      else if (k === 'ArrowDown' || k === 'KeyS' || k === 'KeyG') this.keyGlue = true;
      else if (k === 'KeyP' || k === 'Escape') this.onPause?.();
      else if (k === 'KeyM') this.onMute?.();
      else return;
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      if (['ArrowDown', 'KeyS', 'KeyG'].includes(e.code)) this.keyGlue = false;
    });
    window.addEventListener('blur', () => {
      this.keyGlue = false;
      this.touchGlue = false;
    });

    // Swipe left/right to change lane, up to jump. A quick tap on the left or
    // right third also changes lane; a tap in the middle jumps. Swipes fire as
    // soon as they pass the threshold, not on release.
    let start = null;
    surface.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), used: false };
    });
    surface.addEventListener('pointermove', (e) => {
      if (!start || start.used) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const th = 24;
      if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) {
        this.pending.lane = Math.sign(dx);
        start.used = true;
      } else if (dy < -th && -dy > Math.abs(dx)) {
        this.pending.jump = true;
        start.used = true;
      }
    });
    surface.addEventListener('pointerup', (e) => {
      if (!start) return;
      if (!start.used && performance.now() - start.t < 300) {
        const w = surface.clientWidth;
        const x = e.clientX - surface.getBoundingClientRect().left;
        if (x < w / 3) this.pending.lane = -1;
        else if (x > (w * 2) / 3) this.pending.lane = 1;
        else this.pending.jump = true;
      }
      start = null;
    });
    surface.addEventListener('pointercancel', () => (start = null));

    const press = (on) => (e) => {
      e.preventDefault();
      this.touchGlue = on;
    };
    glueButton.addEventListener('pointerdown', press(true));
    glueButton.addEventListener('pointerup', press(false));
    glueButton.addEventListener('pointerleave', press(false));
    glueButton.addEventListener('pointercancel', press(false));
    glueButton.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // The input frame for one sim step; presses are consumed.
  take() {
    const f = { lane: this.pending.lane, jump: this.pending.jump, glue: this.keyGlue || this.touchGlue };
    this.pending.lane = 0;
    this.pending.jump = false;
    return f;
  }

  clear() {
    this.pending.lane = 0;
    this.pending.jump = false;
  }
}
