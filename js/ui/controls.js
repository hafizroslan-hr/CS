// Touch controls: virtual joystick, look-drag area and buttons.
// Every control can be repositioned and resized (layout stored in settings.layout).
import { input } from '../engine/input.js';
import { settings, saveSettings } from '../storage.js';

const DEFAULT_LAYOUT = {
  stick:   { x: 14, y: 66, s: 1 },
  fire:    { x: 86, y: 58, s: 1 },
  aim:     { x: 95, y: 34, s: 0.85 },
  reload:  { x: 74, y: 70, s: 0.85 },
  weapon:  { x: 84, y: 30, s: 0.85 },
  grenade: { x: 73, y: 44, s: 0.85 },
  jump:    { x: 94, y: 84, s: 0.9 },
  crouch:  { x: 82, y: 88, s: 0.85 },
  pause:   { x: 96, y: 9, s: 1 }
};
const DEFS = [
  { id: 'stick', type: 'stick' },
  { id: 'fire', type: 'btn', label: 'FIRE', cls: 'fire' },
  { id: 'aim', type: 'btn', label: 'AIM' },
  { id: 'reload', type: 'btn', label: 'RELOAD' },
  { id: 'weapon', type: 'btn', label: 'WEAPON' },
  { id: 'grenade', type: 'btn', label: 'GREN' },
  { id: 'jump', type: 'btn', label: 'JUMP' },
  { id: 'crouch', type: 'btn', label: 'CROUCH' },
  { id: 'pause', type: 'btn', label: 'II', small: true }
];
const TOUCH_LOOK = 0.0052;   // radians per CSS pixel at sensitivity 1
const DEADZONE = 0.12;

export class TouchControls {
  constructor(layer, { onPause }) {
    this.layer = layer; this.onPause = onPause;
    this.els = {}; this.ptr = new Map();
    this.stickPtr = null; this.lookPtr = null;
    this.editing = false; this.sel = null; this.onDone = null;

    for (const d of DEFS) {
      const el = document.createElement('div');
      el.className = 'tc ' + (d.type === 'stick' ? 'tc-stick' : 'tc-btn' + (d.small ? ' small' : '') + (d.cls ? ' ' + d.cls : ''));
      el.dataset.id = d.id;
      if (d.type === 'stick') el.innerHTML = '<div class="tc-knob"></div>'; else el.textContent = d.label;
      layer.appendChild(el); this.els[d.id] = el;
    }
    const bar = document.createElement('div');
    bar.className = 'tc-toolbar';
    bar.innerHTML = '<span>DRAG TO MOVE</span><button data-act="smaller">SIZE −</button><button data-act="bigger">SIZE +</button><button data-act="reset">RESET</button><button data-act="done">DONE</button>';
    bar.addEventListener('click', e => { const a = e.target.dataset.act; if (a) this.toolbar(a); });
    layer.appendChild(bar);

    layer.addEventListener('pointerdown', e => this.down(e));
    layer.addEventListener('pointermove', e => this.move(e));
    layer.addEventListener('pointerup', e => this.up(e));
    layer.addEventListener('pointercancel', e => this.up(e));
    layer.addEventListener('contextmenu', e => e.preventDefault());
    this.applyLayout();
  }

  pos(id) { return Object.assign({}, DEFAULT_LAYOUT[id], settings.layout[id]); }

  applyLayout() {
    for (const id in this.els) {
      const p = this.pos(id), el = this.els[id];
      el.style.left = p.x + '%'; el.style.top = p.y + '%';
      el.style.transform = `translate(-50%,-50%) scale(${p.s})`;
    }
  }

  show(on) {
    this.layer.classList.toggle('hidden', !on && !this.editing);
    if (!on) this.release();
  }

  // drop every active touch (pause, blur, orientation change)
  release() {
    this.ptr.clear(); this.stickPtr = this.lookPtr = null;
    input.stickX = input.stickY = 0; input.touchJump = input.touchFire = false;
    this.els.aim.classList.toggle('latched', input.aimToggle); this.els.crouch.classList.toggle('latched', input.crouchToggle);
    this.els.stick.firstChild.style.transform = '';
    for (const id in this.els) this.els[id].classList.remove('on');
    this.applyLayout();
  }

  // ---- gameplay -----------------------------------------------------------------
  down(e) {
    if (e.target.closest('.tc-toolbar')) return;
    e.preventDefault();
    try { this.layer.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    const tc = e.target.closest('.tc');
    if (this.editing) {
      if (tc) { this.select(tc.dataset.id); this.ptr.set(e.pointerId, { kind: 'drag', id: tc.dataset.id }); }
      return;
    }
    if (tc) {
      const id = tc.dataset.id;
      if (id === 'stick') { if (this.stickPtr === null) this.startStick(e, false); return; }
      tc.classList.add('on');
      this.ptr.set(e.pointerId, { kind: 'btn', id, x: e.clientX, y: e.clientY });
      if (id === 'jump') input.touchJump = true;
      else if (id === 'fire') input.touchFire = true;
      else if (id === 'aim') { input.aimToggle = !input.aimToggle; tc.classList.toggle('latched', input.aimToggle); }
      else if (id === 'reload') input.actions.push('reload');
      else if (id === 'weapon') input.actions.push('next');
      else if (id === 'grenade') input.actions.push('grenade');
      else if (id === 'crouch') { input.crouchToggle = !input.crouchToggle; tc.classList.toggle('latched', input.crouchToggle); }
      else if (id === 'pause') this.onPause();
      return;
    }
    const r = this.layer.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.4 && this.stickPtr === null) { this.startStick(e, true); return; }
    if (this.lookPtr === null) {
      this.lookPtr = e.pointerId;
      this.ptr.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY });
    }
  }

  startStick(e, floating) {
    const el = this.els.stick, lr = this.layer.getBoundingClientRect();
    if (floating) { el.style.left = (e.clientX - lr.left) + 'px'; el.style.top = (e.clientY - lr.top) + 'px'; }
    const r = el.getBoundingClientRect();
    const st = { kind: 'stick', ox: r.left + r.width / 2, oy: r.top + r.height / 2, rad: r.width / 2 };
    this.stickPtr = e.pointerId; this.ptr.set(e.pointerId, st);
    this.updateStick(st, e);
  }

  updateStick(st, e) {
    let dx = (e.clientX - st.ox) / st.rad, dy = (e.clientY - st.oy) / st.rad;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const el = this.els.stick, half = el.offsetWidth / 2;
    el.firstChild.style.transform = `translate(${dx * half * 0.6}px,${dy * half * 0.6}px)`;
    const l = Math.min(len, 1);
    if (l < DEADZONE) { input.stickX = input.stickY = 0; return; }
    const out = Math.min(1, (l - DEADZONE) / (1 - DEADZONE) * settings.stickSens) / l;
    input.stickX = dx * out; input.stickY = -dy * out;
  }

  move(e) {
    const st = this.ptr.get(e.pointerId);
    if (!st) return;
    e.preventDefault();
    if (st.kind === 'stick') this.updateStick(st, e);
    else if (st.kind === 'look' || (st.kind === 'btn' && st.id === 'fire')) {   // dragging from FIRE also aims
      const k = TOUCH_LOOK * settings.lookSens;
      input.lookX += (e.clientX - st.x) * k; input.lookY += (e.clientY - st.y) * k;
      st.x = e.clientX; st.y = e.clientY;
    } else if (st.kind === 'drag') {
      const r = this.layer.getBoundingClientRect(), p = this.pos(st.id);
      p.x = Math.min(97, Math.max(3, (e.clientX - r.left) / r.width * 100));
      p.y = Math.min(96, Math.max(4, (e.clientY - r.top) / r.height * 100));
      settings.layout[st.id] = p; this.applyLayout();
    }
  }

  up(e) {
    const st = this.ptr.get(e.pointerId);
    if (!st) return;
    this.ptr.delete(e.pointerId);
    if (st.kind === 'stick') {
      this.stickPtr = null; input.stickX = input.stickY = 0;
      this.els.stick.firstChild.style.transform = ''; this.applyLayout();
    } else if (st.kind === 'look') this.lookPtr = null;
    else if (st.kind === 'btn') {
      this.els[st.id].classList.remove('on');
      if (st.id === 'jump') input.touchJump = false;
      else if (st.id === 'fire') input.touchFire = false;
    } else if (st.kind === 'drag') saveSettings();
  }

  // ---- layout editor ---------------------------------------------------------------
  setEditing(on, onDone) {
    this.editing = on; this.onDone = onDone || null;
    this.release();
    this.layer.classList.toggle('editing', on);
    this.layer.classList.toggle('hidden', !on);
    this.select(on ? 'stick' : null);
  }
  select(id) {
    this.sel = id;
    for (const k in this.els) this.els[k].classList.toggle('sel', k === id);
  }
  toolbar(act) {
    if (act === 'done') { saveSettings(); const cb = this.onDone; this.setEditing(false); if (cb) cb(); return; }
    if (act === 'reset') { settings.layout = {}; }
    else if (this.sel) {
      const p = this.pos(this.sel);
      p.s = Math.min(1.8, Math.max(0.6, +(p.s + (act === 'bigger' ? 0.1 : -0.1)).toFixed(2)));
      settings.layout[this.sel] = p;
    }
    saveSettings(); this.applyLayout();
  }
}
