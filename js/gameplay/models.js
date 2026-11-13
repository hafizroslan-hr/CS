// Procedural low-poly models drawn with the dynamic batch: soldiers and first-person weapons.
import { identity, translate, rotX, rotY, rotZ } from '../engine/math.js';

const M = new Float32Array(16), L = new Float32Array(16);
const SKIN = [0.78, 0.6, 0.47], GUN = [0.2, 0.2, 0.23], STEEL = [0.5, 0.51, 0.55], WOOD = [0.45, 0.29, 0.15];
const SLEEVE = [0.33, 0.36, 0.3], FLASH = [1, 0.86, 0.45];
const TEAM = {
  att: { torso: [0.56, 0.4, 0.24], legs: [0.3, 0.26, 0.2], gear: [0.55, 0.14, 0.1] },
  def: { torso: [0.2, 0.28, 0.4], legs: [0.15, 0.17, 0.22], gear: [0.22, 0.27, 0.24] }
};

export function drawActor(b, a) {
  const p = a.body.pos, c = TEAM[a.team];
  identity(M); translate(M, p[0], p[1], p[2]); rotY(M, a.yaw);
  if (!a.alive) rotX(M, a.fall * 1.5);                  // topple backwards
  const swing = a.alive ? Math.sin(a.walkPhase) * Math.min(a.speed / 4, 1) * 0.65 : 0;
  for (const s of [-1, 1]) {
    L.set(M); translate(L, s * 0.11, 0.85, 0); rotX(L, s * swing);
    b.box(L, 0, -0.425, 0, 0.17, 0.85, 0.19, c.legs);
    L.set(M); translate(L, s * 0.29, 1.4, 0); rotX(L, 1.25);
    b.box(L, 0, -0.26, 0, 0.12, 0.55, 0.12, c.torso);
  }
  b.box(M, 0, 1.15, 0, 0.46, 0.6, 0.25, c.torso);
  b.box(M, 0, 1.6, 0, 0.24, 0.26, 0.24, SKIN);
  b.box(M, 0, 1.73, 0, 0.27, 0.1, 0.27, c.gear);
  b.box(M, 0, 1.12, 0.15, 0.3, 0.36, 0.08, c.gear);      // backpack / plate
  const long = a.inv.def.id === 'pistol' || a.inv.def.id === 'revolver' ? 0.26 : 0.62;
  b.box(M, 0.12, 1.27, -0.3 - long / 2, 0.06, 0.1, long, GUN);
  if (a.flashT > 0) b.box(M, 0.12, 1.27, -0.36 - long, 0.2, 0.2, 0.06, FLASH, true);
}

export function drawGrenade(b, g) {
  identity(M); translate(M, g.x, g.y, g.z); rotY(M, g.spin); rotX(M, g.spin * 1.3);
  b.box(M, 0, 0, 0, 0.11, 0.14, 0.11, [0.2, 0.26, 0.16]);
  b.box(M, 0, 0.09, 0, 0.05, 0.05, 0.05, STEEL);
}

// parts: [cx, cy, cz, sx, sy, sz, colour]; gun space has the barrel along -Z
const HAND = [0, -0.05, 0.012, 0.056, 0.078, 0.072, SKIN], ARM = [0.025, -0.1, 0.19, 0.075, 0.075, 0.32, SLEEVE];
const VM = {
  pistol: { muzzle: -0.2, parts: [[0, 0.03, -0.08, 0.034, 0.046, 0.21, GUN], [0, -0.04, 0, 0.03, 0.09, 0.046, [0.09, 0.09, 0.1]], HAND, ARM] },
  revolver: { muzzle: -0.26, parts: [[0, 0.036, -0.14, 0.027, 0.03, 0.22, STEEL], [0, 0.026, -0.01, 0.052, 0.052, 0.062, STEEL],
    [0, 0.045, 0.03, 0.02, 0.03, 0.03, GUN], [0, -0.04, 0.03, 0.03, 0.09, 0.046, WOOD], HAND, ARM] },
  smg: { muzzle: -0.42, parts: [[0, 0.02, -0.1, 0.05, 0.07, 0.34, GUN], [0, 0.026, -0.33, 0.024, 0.024, 0.15, [0.2, 0.2, 0.22]],
    [0, -0.075, -0.1, 0.03, 0.13, 0.042, [0.09, 0.09, 0.1]], [0, -0.05, 0.04, 0.03, 0.08, 0.04, GUN], [0, 0.012, 0.17, 0.035, 0.05, 0.19, GUN],
    [0, 0.065, -0.1, 0.012, 0.02, 0.06, GUN], HAND, ARM, [-0.02, -0.035, -0.21, 0.055, 0.055, 0.075, SKIN], [-0.09, -0.07, -0.12, 0.07, 0.07, 0.24, SLEEVE]] },
  shotgun: { muzzle: -0.58, parts: [[0, 0.03, -0.27, 0.036, 0.036, 0.6, [0.2, 0.2, 0.22]], [0, -0.008, -0.3, 0.05, 0.046, 0.17, WOOD],
    [0, 0.02, 0.03, 0.05, 0.072, 0.2, GUN], [0, -0.012, 0.2, 0.04, 0.07, 0.2, WOOD], HAND, ARM,
    [-0.02, -0.04, -0.3, 0.055, 0.055, 0.075, SKIN], [-0.09, -0.075, -0.2, 0.07, 0.07, 0.26, SLEEVE]] },
  rifle: { muzzle: -0.72, parts: [[0, 0.032, -0.38, 0.024, 0.024, 0.68, [0.2, 0.2, 0.22]], [0, 0.004, -0.06, 0.045, 0.06, 0.5, WOOD],
    [0, 0.088, -0.06, 0.036, 0.036, 0.24, GUN], [0, 0.06, -0.06, 0.014, 0.03, 0.05, GUN], [0, -0.01, 0.24, 0.04, 0.08, 0.2, WOOD], HAND, ARM,
    [-0.02, -0.04, -0.26, 0.055, 0.055, 0.075, SKIN], [-0.09, -0.075, -0.16, 0.07, 0.07, 0.26, SLEEVE]] },
  prybar: { muzzle: 0, parts: [[0, 0, -0.2, 0.024, 0.024, 0.56, [0.24, 0.3, 0.4]], [0, 0.03, -0.47, 0.024, 0.08, 0.024, [0.24, 0.3, 0.4]],
    [0, 0, 0.02, 0.056, 0.07, 0.085, SKIN], [0.02, -0.04, 0.2, 0.075, 0.075, 0.32, SLEEVE]] }
};

// vm: { kick, lower, flash, swing }, aim 0..1, bob in metres. Drawn in view space.
export function drawViewModel(b, id, vm, aim, bobX, bobY) {
  const m = VM[id];
  const k = 1 - aim;
  identity(M);
  translate(M, 0.2 * k + bobX * k, -0.2 * k - 0.105 * aim + bobY * k - vm.lower * 0.35, -0.62 + vm.kick * 0.08 + 0.1 * aim);
  rotX(M, vm.kick * 0.22 - vm.lower * 0.9);
  rotY(M, 0.035 * k);
  if (id === 'prybar') { rotX(M, 0.85 - vm.swing * 1.7); rotZ(M, -0.3 + vm.swing * 0.5); }
  for (const q of m.parts) b.box(M, q[0], q[1], q[2], q[3], q[4], q[5], q[6]);
  if (vm.flash > 0 && m.muzzle) {
    const s = 0.07 + Math.random() * 0.06;
    b.box(M, 0, 0.03, m.muzzle - 0.03, s, s, 0.02, FLASH, true);
    b.box(M, 0, 0.03, m.muzzle - 0.08, s * 0.5, s * 0.5, 0.1, [1, 0.95, 0.8], true);
  }
}
