// Procedural low-poly models drawn with the dynamic batch: soldiers and first-person weapons.
import { identity, translate, rotX, rotY, rotZ } from '../engine/math.js';

const M = new Float32Array(16), L = new Float32Array(16);
const SKIN = [0.78, 0.6, 0.47], GUN = [0.2, 0.2, 0.23], STEEL = [0.5, 0.51, 0.55], WOOD = [0.45, 0.29, 0.15];
const SLEEVE = [0.33, 0.36, 0.3], FLASH = [1, 0.86, 0.45];
const BLACK = [0.07, 0.07, 0.08];
// Original faction looks: masked irregulars in earth tones vs. helmeted unit in dark blue.
const TEAM = {
  att: { cloth: [0.44, 0.38, 0.26], pants: [0.27, 0.25, 0.2], vest: [0.3, 0.21, 0.13], gear: [0.22, 0.16, 0.1], head: [0.19, 0.17, 0.15], boots: [0.13, 0.1, 0.08], glove: [0.2, 0.17, 0.14] },
  def: { cloth: [0.18, 0.24, 0.35], pants: [0.14, 0.18, 0.27], vest: [0.1, 0.11, 0.14], gear: [0.15, 0.17, 0.2], head: [0.13, 0.15, 0.18], boots: [0.06, 0.06, 0.07], glove: [0.08, 0.08, 0.09] }
};
const U = new Float32Array(16), G = new Float32Array(16);

// Soldier: rounded, tapered limbs with knee and elbow joints, shouldered weapon, team gear.
export function drawActor(b, a) {
  const p = a.body.pos, c = TEAM[a.team];
  identity(M); translate(M, p[0], p[1], p[2]); rotY(M, a.yaw);
  if (!a.alive) rotX(M, a.fall * 1.5);                  // topple backwards
  const amp = a.alive ? Math.min(a.speed / 4, 1) : 0, ph = a.walkPhase;

  // legs: hip swing + knee bend on the recovering leg
  for (const s of [-1, 1]) {
    const sw = Math.sin(ph) * s;
    L.set(M); translate(L, s * 0.095, 0.93, 0); rotX(L, sw * 0.45 * amp + 0.05);
    b.cyl(L, 0, -0.46, 0, 0, 0.072, 0.08, 0.098, 0.105, c.pants);
    b.ball(L, 0, -0.46, 0, 0.072, 0.072, 0.08, c.pants, -Math.PI / 2, 3);
    translate(L, 0, -0.46, 0); rotX(L, -(0.1 + 0.85 * amp * Math.max(0, -sw)));
    b.cyl(L, 0, -0.4, 0, 0, 0.052, 0.058, 0.07, 0.078, c.pants);
    b.box(L, 0, -0.43, -0.035, 0.1, 0.1, 0.25, c.boots);
  }
  b.cyl(M, 0, 0.82, 0.98, 0, 0.15, 0.105, 0.165, 0.11, c.pants);
  b.cyl(M, 0, 0.93, 0.99, 0, 0.172, 0.118, 0.172, 0.118, c.gear);       // belt

  // upper body leans slightly into the weapon
  U.set(M); translate(U, 0, 0.93, 0); rotX(U, -0.1 - amp * 0.05);
  b.cyl(U, 0, 0, 0.5, 0, 0.165, 0.105, 0.2, 0.118, c.cloth, true);
  b.cyl(U, 0, 0.1, 0.45, 0, 0.185, 0.128, 0.212, 0.136, c.vest, true, true);
  b.box(U, -0.075, 0.2, -0.14, 0.085, 0.11, 0.05, c.gear);                // pouches
  b.box(U, 0.03, 0.2, -0.14, 0.085, 0.11, 0.05, c.gear);
  b.box(U, 0, 0.29, 0.15, 0.25, 0.3, 0.09, c.gear);                        // pack
  b.cyl(U, 0, 0.48, 0.58, 0, 0.05, 0.052, 0.048, 0.05, a.team === 'att' ? c.head : SKIN);
  if (a.team === 'att') {
    b.ball(U, 0, 0.675, -0.005, 0.094, 0.115, 0.102, c.head);              // balaclava
    b.box(U, 0, 0.695, -0.082, 0.125, 0.034, 0.045, SKIN);                  // eye slit
    b.cyl(U, 0, 0.5, 0.56, 0.01, 0.075, 0.08, 0.065, 0.07, [0.45, 0.14, 0.1]);   // scarf
  } else {
    b.ball(U, 0, 0.675, -0.005, 0.09, 0.112, 0.098, SKIN);
    b.ball(U, 0, 0.69, 0.006, 0.108, 0.115, 0.122, c.head, -0.45, 4);        // helmet
    b.box(U, 0, 0.7, -0.092, 0.135, 0.042, 0.03, BLACK);                    // goggles
    b.box(U, 0, 0.62, -0.085, 0.09, 0.05, 0.03, c.head);                    // mask
  }

  // arms: right hand on the grip, left hand forward on the handguard
  const pistol = a.inv.def.id === 'pistol' || a.inv.def.id === 'revolver' || a.inv.def.melee;
  for (const s of [-1, 1]) {
    L.set(U); translate(L, s * 0.215, 0.44, 0);
    b.ball(L, 0, 0, 0, 0.066, 0.066, 0.07, c.cloth, -Math.PI / 2, 3);
    if (s > 0) { rotY(L, 0.25); rotX(L, pistol ? 0.75 : 0.35); } else { rotY(L, pistol ? -0.5 : -0.68); rotX(L, pistol ? 0.85 : 0.95); }
    b.cyl(L, 0, -0.28, 0, 0, 0.044, 0.046, 0.058, 0.06, c.cloth);
    translate(L, 0, -0.28, 0); rotX(L, s > 0 ? (pistol ? 0.85 : 1.65) : (pistol ? 0.75 : 0.65));
    b.ball(L, 0, 0, 0, 0.045, 0.045, 0.047, c.cloth, -Math.PI / 2, 3);
    b.cyl(L, 0, -0.25, 0, 0, 0.036, 0.038, 0.044, 0.046, c.cloth);
    b.ball(L, 0, -0.285, 0, 0.04, 0.05, 0.042, c.glove, -Math.PI / 2, 3);
  }

  // weapon
  G.set(U); translate(G, 0.125, 0.33, 0);
  let muzzle;
  if (pistol) {
    b.box(G, 0, -0.02, -0.5, 0.03, 0.045, 0.17, GUN);
    b.box(G, 0, -0.07, -0.44, 0.028, 0.08, 0.04, BLACK);
    muzzle = -0.6;
  } else {
    const wood = a.inv.def.id === 'shotgun' || a.inv.def.id === 'rifle';
    b.box(G, 0, 0, -0.33, 0.045, 0.07, 0.3, GUN);                           // receiver
    b.box(G, 0, 0.012, -0.64, 0.022, 0.022, 0.34, BLACK);                   // barrel
    b.box(G, 0, -0.005, -0.54, 0.04, 0.045, 0.2, wood ? WOOD : GUN);        // handguard
    b.box(G, 0, -0.012, -0.09, 0.035, 0.065, 0.2, wood ? WOOD : GUN);       // stock
    b.box(G, 0, -0.065, -0.24, 0.03, 0.075, 0.035, BLACK);                  // grip
    if (!wood) b.box(G, 0, -0.085, -0.37, 0.028, 0.12, 0.05, BLACK);        // magazine
    b.box(G, 0, 0.048, -0.3, 0.012, 0.022, 0.06, BLACK);                    // sight
    muzzle = -0.83;
  }
  if (a.flashT > 0) b.box(G, 0, 0.01, muzzle, 0.18, 0.18, 0.05, FLASH, true);
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
  if (id === 'prybar') { rotX(M, 0.55 - vm.swing * 1.5); rotZ(M, -0.5 + vm.swing * 0.6); }
  for (const q of m.parts) b.box(M, q[0], q[1], q[2], q[3], q[4], q[5], q[6]);
  if (vm.flash > 0 && m.muzzle) {
    const s = 0.07 + Math.random() * 0.06;
    b.box(M, 0, 0.03, m.muzzle - 0.03, s, s, 0.02, FLASH, true);
    b.box(M, 0, 0.03, m.muzzle - 0.08, s * 0.5, s * 0.5, 0.1, [1, 0.95, 0.8], true);
  }
}
