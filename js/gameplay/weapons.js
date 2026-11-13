// Weapon definitions and per-actor inventory. Everyone carries the whole arsenal (slots 1-6)
// plus hand grenades. All numbers are gameplay values, tuned by feel:
//   damage per pellet · interval between shots (s) · spread/recoil in radians · range = full-damage distance (m)
export const WEAPONS = [
  { id: 'prybar',   name: 'PRY BAR',      slot: 1, melee: true, damage: 45, interval: 0.42, reach: 2.2, sound: 'swing', ideal: 1.5 },
  { id: 'pistol',   name: 'P9 PISTOL',    slot: 2, damage: 24,  pellets: 1, interval: 0.19,  mag: 17, reserve: 85,  reload: 1.5, spread: 0.011, recoil: 0.014, range: 30,  sound: 'pistol',   ideal: 15 },
  { id: 'revolver', name: '.44 REVOLVER', slot: 3, damage: 78,  pellets: 1, interval: 0.7,   mag: 6,  reserve: 30,  reload: 2.4, spread: 0.005, recoil: 0.06,  range: 55,  sound: 'revolver', ideal: 22 },
  { id: 'smg',      name: 'SMG-45',       slot: 4, damage: 17,  pellets: 1, interval: 0.085, mag: 40, reserve: 160, reload: 1.9, spread: 0.022, recoil: 0.009, range: 24,  sound: 'smg',      ideal: 13 },
  { id: 'shotgun',  name: 'PUMP SHOTGUN', slot: 5, damage: 13,  pellets: 8, interval: 0.85,  mag: 8,  reserve: 40,  reload: 2.6, spread: 0.07,  recoil: 0.07,  range: 9,   sound: 'shotgun',  ideal: 7 },
  { id: 'rifle',    name: 'BOLT RIFLE',   slot: 6, damage: 115, pellets: 1, interval: 1.3,   mag: 5,  reserve: 25,  reload: 2.8, spread: 0.03, aimSpread: 0.0012, recoil: 0.08, range: 150, sound: 'rifle', ideal: 36, zoom: 3.4 }
];
export const GRENADE = { count: 3, fuse: 2.3, radius: 7.5, damage: 130, speed: 17 };
export const HEADSHOT_MULT = 2.5;

export class Inventory {
  constructor(infinite = false) { this.infinite = infinite; this.reset(1); }
  reset(cur) {
    this.slots = WEAPONS.map(w => ({ def: w, mag: w.mag || 0, reserve: w.reserve || 0 }));
    this.cur = cur; this.grenades = GRENADE.count;
    this.cool = 0; this.reloadT = 0; this.switchT = 0; this.bloom = 0;
  }
  get slot() { return this.slots[this.cur]; }
  get def() { return this.slots[this.cur].def; }
  ready() { return this.cool <= 0 && this.reloadT <= 0 && this.switchT <= 0; }
  select(i) {
    if (i === this.cur || i < 0 || i >= this.slots.length) return false;
    this.cur = i; this.reloadT = 0; this.switchT = 0.4; this.bloom = 0;
    return true;
  }
  startReload() {
    const s = this.slot, d = s.def;
    if (d.melee || this.reloadT > 0 || this.switchT > 0 || s.mag >= d.mag || (s.reserve <= 0 && !this.infinite)) return false;
    this.reloadT = d.reload;
    return true;
  }
  update(dt) {
    this.cool -= dt; this.switchT -= dt;
    this.bloom *= Math.exp(-dt * 5);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const s = this.slot, n = this.infinite ? s.def.mag - s.mag : Math.min(s.def.mag - s.mag, s.reserve);
        s.mag += n; if (!this.infinite) s.reserve -= n;
      }
    }
  }
}
