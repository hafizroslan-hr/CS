// Unified input state shared by keyboard/mouse (here) and touch controls (ui/controls.js).
import { settings } from '../storage.js';

export const input = {
  keys: new Set(),
  stickX: 0, stickY: 0,        // touch joystick, -1..1 (Y: forward positive)
  lookX: 0, lookY: 0,          // accumulated look delta in radians
  touchJump: false,
  crouchToggle: false,
  pointerLocked: false,
  enabled: false,              // gameplay input accepted

  move(out) {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.stickX;
    let z = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + this.stickY;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    out.x = x; out.z = z;
    return out;
  },
  jump() { return this.keys.has('Space') || this.touchJump; },
  crouch() { return this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.crouchToggle; },
  clear() {
    this.keys.clear(); this.stickX = this.stickY = 0; this.lookX = this.lookY = 0;
    this.touchJump = false;
  }
};

export function initInput(canvas, { onEscape, onLockLost }) {
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape') { onEscape(); return; }
    if (!input.enabled) return;
    input.keys.add(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', e => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('click', () => {
    if (input.enabled && !input.pointerLocked) requestLock(canvas);
  });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    const was = input.pointerLocked;
    input.pointerLocked = locked;
    if (was && !locked) onLockLost();
  });
  document.addEventListener('mousemove', e => {
    if (!input.pointerLocked || !input.enabled) return;
    const k = 0.0022 * settings.mouseSens;
    input.lookX += e.movementX * k;
    input.lookY += e.movementY * k;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

export function requestLock(canvas) {
  try {
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* not available (iOS) */ }
}
export function releaseLock() {
  if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
}
