// Synthesised sound effects (Web Audio API). No audio files are downloaded.
// The context is created on the first user gesture to satisfy autoplay rules.
import { settings } from '../storage.js';

let ctx = null, master = null, noiseBuf = null;
const listener = { x: 0, z: 0, yaw: 0 };

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolume();
  return true;
}
export function unlockAudio() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
}
export function applyVolume() {
  if (master) master.gain.value = settings.masterVol * settings.sfxVol;
}
export function suspendAudio(on) {
  if (!ctx) return;
  if (on) ctx.suspend(); else ctx.resume();
}
export function setListener(x, z, yaw) { listener.x = x; listener.z = z; listener.yaw = yaw; }

// Output node for a sound at world position (x,z); null position = at the listener.
function out(vol, x, z, range) {
  let pan = 0;
  if (x !== undefined) {
    const dx = x - listener.x, dz = z - listener.z, d = Math.hypot(dx, dz);
    if (d > range) return null;
    vol *= Math.pow(1 - d / range, 2);
    if (d > 0.5) pan = (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / d * 0.8;
  }
  if (vol < 0.004) return null;
  const g = ctx.createGain(); g.gain.value = vol;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p); p.connect(master);
  } else g.connect(master);
  return g;
}

function noise(dest, t, dur, freq, type, vol, q = 0.8, endFreq) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
function tone(dest, t, dur, f0, f1, type, vol) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}

// per-weapon gunshot recipes: [crack freq, crack dur, body freq, body dur, thump f0, thump dur, level]
const SHOTS = {
  pistol:   [2600, 0.07, 900, 0.14, 180, 0.09, 0.55],
  revolver: [1800, 0.10, 600, 0.30, 140, 0.18, 0.85],
  smg:      [3000, 0.05, 1100, 0.10, 200, 0.07, 0.45],
  shotgun:  [1400, 0.12, 420, 0.38, 100, 0.25, 0.95],
  rifle:    [2200, 0.09, 520, 0.50, 120, 0.22, 0.95]
};

export const sfx = {
  shot(kind, x, z) {
    if (!ctx) return;
    const r = SHOTS[kind] || SHOTS.pistol, d = out(r[6], x, z, 110);
    if (!d) return;
    const t = ctx.currentTime;
    noise(d, t, r[1], r[0], 'highpass', 0.9);
    noise(d, t, r[3], r[2], 'lowpass', 1.0, 0.7, r[2] * 0.3);
    tone(d, t, r[5], r[4], r[4] * 0.35, 'sine', 0.9);
  },
  swing(x, z) {
    if (!ctx) return; const d = out(0.35, x, z, 20); if (!d) return;
    noise(d, ctx.currentTime, 0.16, 500, 'bandpass', 0.8, 1.5, 1800);
  },
  thud(x, z) {
    if (!ctx) return; const d = out(0.6, x, z, 25); if (!d) return;
    const t = ctx.currentTime; tone(d, t, 0.1, 160, 60, 'sine', 1); noise(d, t, 0.06, 1200, 'lowpass', 0.6);
  },
  step(x, z, vol = 0.22) {
    if (!ctx) return; const d = out(vol, x, z, 22); if (!d) return;
    const t = ctx.currentTime;
    noise(d, t, 0.07, 650 + Math.random() * 250, 'lowpass', 0.9);
    tone(d, t, 0.05, 110, 60, 'sine', 0.5);
  },
  land() { if (!ctx) return; const d = out(0.4); const t = ctx.currentTime; noise(d, t, 0.12, 500, 'lowpass', 1); tone(d, t, 0.1, 90, 45, 'sine', 0.8); },
  click(f = 1800, vol = 0.3, delay = 0) {
    if (!ctx) return; const d = out(vol); if (!d) return;
    const t = ctx.currentTime + delay;
    noise(d, t, 0.03, f, 'bandpass', 1, 4); tone(d, t, 0.02, f * 0.5, f * 0.3, 'square', 0.25);
  },
  reload(dur) { this.click(1300, 0.35, 0.1); this.click(900, 0.35, dur * 0.55); this.click(2100, 0.4, dur - 0.15); },
  switchWeapon() { this.click(1100, 0.25); this.click(1700, 0.2, 0.09); },
  dry() { this.click(2600, 0.25); },
  hit() { if (!ctx) return; const d = out(0.25); tone(d, ctx.currentTime, 0.05, 1500, 900, 'triangle', 1); },
  kill() { if (!ctx) return; const d = out(0.3); const t = ctx.currentTime; tone(d, t, 0.07, 900, 900, 'triangle', 1); tone(d, t + 0.08, 0.12, 1350, 1350, 'triangle', 1); },
  hurt() { if (!ctx) return; const d = out(0.5); const t = ctx.currentTime; tone(d, t, 0.14, 220, 70, 'sawtooth', 0.6); noise(d, t, 0.08, 700, 'lowpass', 0.7); },
  explosion(x, z) {
    if (!ctx) return; const d = out(1.3, x, z, 140); if (!d) return;
    const t = ctx.currentTime;
    noise(d, t, 1.1, 900, 'lowpass', 1.2, 0.7, 80); noise(d, t, 0.15, 2500, 'highpass', 0.7);
    tone(d, t, 0.6, 90, 28, 'sine', 1.2);
  },
  bounce(x, z) { if (!ctx) return; const d = out(0.25, x, z, 25); if (!d) return; tone(d, ctx.currentTime, 0.04, 900, 500, 'square', 0.5); },
  result(win) {
    if (!ctx) return; const d = out(0.35); const t = ctx.currentTime;
    const notes = win ? [392, 494, 587, 784] : [392, 330, 262, 196];
    notes.forEach((f, i) => tone(d, t + i * 0.16, 0.3, f, f, 'triangle', 0.8));
  }
};
