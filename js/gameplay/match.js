// A running match: teams, bots, shooting and damage resolution, grenades, respawns, scoring.
// Phase 2 rules: team skirmish with respawns, first team to the kill limit (or ahead on time) wins.
import { input } from '../engine/input.js';
import { rayAABB } from '../engine/collision.js';
import { GRAVITY } from '../engine/physics.js';
import { sfx, setListener } from '../engine/audio.js';
import { clamp, rand } from '../engine/math.js';
import { Actor } from './actor.js';
import { WEAPONS, GRENADE, HEADSHOT_MULT } from './weapons.js';
import { BotBrain, DIFFICULTY } from './bot-ai.js';
import { drawActor, drawGrenade, drawViewModel } from './models.js';

const BOT_NAMES = ['Vargas', 'Kestrel', 'Brandt', 'Ogun', 'Halloran', 'Mirov', 'Tanaka', 'Reyes', 'Calder', 'Novak', 'Ibarra', 'Strand', 'Okafor', 'Lindqvist'];
const BOT_WEAPONS = { easy: [1, 1, 3, 3, 4], normal: [1, 2, 3, 3, 4, 5], hard: [2, 3, 3, 4, 5], expert: [2, 3, 3, 4, 5, 5] };
const KILL_LIMIT = { 7: 15, 15: 30, 25: 50 };
const RESPAWN = 4, MAX_STEP = 1 / 60, MAX_RANGE = 220;
export const TEAM_NAME = { att: 'INSURGENTS', def: 'TASK FORCE' };
const hit = { t: 0, actor: null, head: false };

export class Match {
  constructor({ map, cfg, player, fx, hud, renderer, onEnd }) {
    this.map = map; this.world = map.collision; this.cfg = cfg; this.player = player;
    this.fx = fx; this.hud = hud; this.renderer = renderer; this.onEnd = onEnd;
    this.actors = []; this.bots = []; this.grenades = [];
    this.score = { att: 0, def: 0 }; this.over = false;
  }

  start() {
    const cfg = this.cfg, pl = this.player;
    pl.team = cfg.team === 'auto' ? (Math.random() < 0.5 ? 'att' : 'def') : cfg.team;
    const other = pl.team === 'att' ? 'def' : 'att';
    pl.kills = pl.deaths = 0;
    this.actors = [pl]; this.bots = []; this.grenades.length = 0; this.fx.clear();
    this.score.att = this.score.def = 0; this.over = false;
    this.killLimit = KILL_LIMIT[cfg.matchLength] || 30;
    this.time = cfg.roundTime * 4;
    const P = DIFFICULTY[cfg.difficulty] || DIFFICULTY.normal;
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const mates = Math.floor(cfg.bots / 2), pool = BOT_WEAPONS[cfg.difficulty] || BOT_WEAPONS.normal;
    for (let i = 0; i < cfg.bots; i++) {
      const b = new Actor(names[i % names.length], false);
      b.team = i < mates ? pl.team : other;
      b.weaponIdx = pool[Math.floor(Math.random() * pool.length)];
      b.brain = new BotBrain(b, this, P, i * 131 + 7);
      this.actors.push(b); this.bots.push(b);
    }
    for (const a of this.actors) this.spawn(a);
    this.hud.clearFeed();
    this.hud.message(`${TEAM_NAME[pl.team]} — FIRST TO ${this.killLimit} KILLS`, 3.5);
  }

  // Respawn at the team spawn point that is furthest from any living enemy.
  spawn(a) {
    const list = this.map.spawns[a.team];
    let best = list[0], bd = -1;
    for (let k = 0; k < 5; k++) {
      const s = list[Math.floor(Math.random() * list.length)];
      let near = 1e9;
      for (const e of this.actors) {
        if (e === a || !e.alive) continue;
        const d = Math.hypot(e.body.pos[0] - s.x, e.body.pos[2] - s.z);
        if (e.team !== a.team) near = Math.min(near, d); else if (d < 1) near = 0;
      }
      if (near > bd) { bd = near; best = s; }
    }
    if (a.isPlayer) { a.spawn(best); a.inv.reset(3); }
    else { a.place(best); a.inv.reset(a.weaponIdx); a.brain.reset(); }
  }

  los(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d = Math.hypot(dx, dy, dz);
    return d < 0.01 || this.world.raycast(x0, y0, z0, dx / d, dy / d, dz / d, d) >= d - 0.02;
  }

  // Nearest thing a ray hits: world geometry or an enemy of `a`. Walls always stop bullets.
  trace(a, ox, oy, oz, dx, dy, dz, max) {
    hit.t = this.world.raycast(ox, oy, oz, dx, dy, dz, max); hit.actor = null; hit.head = false;
    for (const e of this.actors) {
      if (e === a || !e.alive || e.team === a.team) continue;
      const p = e.body.pos, w = e.body.hw + 0.05;
      const t = rayAABB(ox, oy, oz, dx, dy, dz, p[0] - w, p[1], p[2] - w, p[0] + w, p[1] + e.body.h, p[2] + w);
      if (t < hit.t) { hit.t = t; hit.actor = e; hit.head = oy + dy * t > p[1] + e.body.h - 0.34; }
    }
    return hit;
  }

  // Fire the actor's current weapon. `dir` (unit vector) overrides the view direction (bots).
  fire(a, dir) {
    const inv = a.inv, def = inv.def, s = inv.slot, pl = a.isPlayer;
    if (!inv.ready() || !a.alive || this.over) return false;
    const p = a.body.pos, ex = p[0], ey = a.eyeY(), ez = p[2];
    let fx, fy, fz;
    if (dir) { fx = dir[0]; fy = dir[1]; fz = dir[2]; }
    else {
      const pitch = clamp(a.pitch + (a.kick || 0), -1.5, 1.5), cp = Math.cos(pitch);
      fx = -Math.sin(a.yaw) * cp; fy = Math.sin(pitch); fz = -Math.cos(a.yaw) * cp;
    }
    const hl = Math.hypot(fx, fz) || 1, rx = -fz / hl, rz = fx / hl;          // right
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;                  // up = right x forward

    if (def.melee) {
      inv.cool = def.interval;
      if (pl) { sfx.swing(); a.vm.swing = 1; } else sfx.swing(ex, ez);
      const h = this.trace(a, ex, ey, ez, fx, fy, fz, def.reach);
      if (h.t < def.reach) {
        const hx = ex + fx * h.t, hy = ey + fy * h.t, hz = ez + fz * h.t;
        if (pl) sfx.thud(); else sfx.thud(hx, hz);
        if (h.actor) { this.fx.blood(hx, hy, hz); this.damage(h.actor, def.damage, a, false, def); }
        else this.fx.impact(hx - fx * 0.05, hy, hz - fz * 0.05);
      }
      return true;
    }
    if (s.mag <= 0) {
      if (inv.startReload()) { if (pl) sfx.reload(def.reload); }
      else if (pl) { sfx.dry(); inv.cool = 0.3; }
      return false;
    }
    s.mag--; inv.cool = def.interval;

    let spread = def.spread;
    if (pl) {
      const aimed = a.aim > 0.6;
      if (def.aimSpread !== undefined) spread = aimed ? def.aimSpread : def.spread;
      else if (aimed) spread *= 0.55;
      spread = spread * (a.crouched ? 0.7 : 1) * (a.onGround ? 1 : 2.5) * (1 + a.speed / 5.4 * 0.8) + inv.bloom;
    }
    // muzzle position for tracers
    const mx = pl ? ex + rx * 0.14 + fx * 0.7 : ex + fx * 0.6, my = pl ? ey - 0.12 + fy * 0.7 : ey - 0.33, mz = pl ? ez + rz * 0.14 + fz * 0.7 : ez + fz * 0.6;
    for (let i = 0; i < def.pellets; i++) {
      const ang = Math.random() * 6.283, rad = Math.sqrt(Math.random()) * spread;
      const c = Math.cos(ang) * rad, sn = Math.sin(ang) * rad;
      let dx = fx + rx * c + ux * sn, dy = fy + uy * sn, dz = fz + rz * c + uz * sn;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const h = this.trace(a, ex, ey, ez, dx, dy, dz, MAX_RANGE);
      const hx = ex + dx * h.t, hy = ey + dy * h.t, hz = ez + dz * h.t;
      if (h.actor) {
        const fall = clamp(1 - (h.t - def.range) / def.range, 0.35, 1);
        this.fx.blood(hx, hy, hz);
        this.damage(h.actor, def.damage * fall * (h.head ? HEADSHOT_MULT : 1), a, h.head, def);
      } else if (h.t < MAX_RANGE) this.fx.impact(hx - dx * 0.06, hy - dy * 0.06, hz - dz * 0.06);
      if (i < 3) this.fx.tracer(mx, my, mz, hx, hy, hz);
    }
    a.flashT = 0.05;
    if (pl) {
      sfx.shot(def.sound);
      a.vm.flash = 0.045; a.vm.kick = 1; a.kick += def.recoil;
      inv.bloom = Math.min(0.03, inv.bloom + def.spread * 0.22);
    } else { sfx.shot(def.sound, ex, ez); this.fx.flash(mx, my, mz); }
    this.noise(a, ex, ez);
    return true;
  }

  // Gunfire is heard by enemy bots within their hearing range.
  noise(a, x, z) {
    for (const b of this.bots) {
      if (b.team === a.team || !b.alive) continue;
      if (Math.hypot(b.body.pos[0] - x, b.body.pos[2] - z) < b.brain.P.hear) b.brain.hear(x, z);
    }
  }
  // Team coordination: a bot that spots an enemy calls nearby team-mates over.
  alert(bot, enemy) {
    const r = bot.brain.P.coord;
    if (!r) return;
    for (const b of this.bots) {
      if (b === bot || b.team !== bot.team || !b.alive) continue;
      if (Math.hypot(b.body.pos[0] - bot.body.pos[0], b.body.pos[2] - bot.body.pos[2]) < r) b.brain.hear(enemy.body.pos[0], enemy.body.pos[2]);
    }
  }

  damage(v, amount, att, head, def) {
    if (!v.alive || this.over) return;
    v.health -= amount;
    if (v.isPlayer) { this.hud.damageFlash(); sfx.hurt(); } else v.brain.onDamaged(att);
    if (att && att.isPlayer && att !== v) { this.hud.hitMarker(head); sfx.hit(); }
    if (v.health > 0) return;
    v.health = 0; v.alive = false; v.deaths++; v.respawnT = RESPAWN; v.fall = 0;
    if (att && att !== v) { att.kills++; this.score[att.team]++; if (att.isPlayer) sfx.kill(); }
    this.hud.addKill(att && att !== v ? att : null, v, def.name, head, this.player);
    if (v.isPlayer) { v.deathT = 0; this.hud.message(att && att !== v ? `KILLED BY ${att.name.toUpperCase()}` : 'KILLED', RESPAWN); }
    if (att && this.score[att.team] >= this.killLimit) this.end(att.team);
  }

  end(winner) {
    if (this.over) return;
    this.over = true;
    sfx.result(winner === this.player.team);
    this.onEnd({ winner, playerTeam: this.player.team, score: this.score, kills: this.player.kills, deaths: this.player.deaths });
  }

  throwGrenade(a) {
    if (!a.alive || a.inv.grenades <= 0) return;
    a.inv.grenades--;
    const cp = Math.cos(a.pitch), fx = -Math.sin(a.yaw) * cp, fy = Math.sin(a.pitch), fz = -Math.cos(a.yaw) * cp;
    const p = a.body.pos;
    this.grenades.push({ x: p[0] + fx * 0.4, y: a.eyeY() - 0.1, z: p[2] + fz * 0.4,
      v: [fx * GRENADE.speed + a.vel[0], fy * GRENADE.speed + 3, fz * GRENADE.speed + a.vel[2]], t: GRENADE.fuse, owner: a, spin: 0 });
    sfx.swing();
  }

  updateGrenades(dt) {
    const w = this.world, r = 0.07;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i], v = g.v;
      v[1] -= GRAVITY * dt; g.spin += dt * 9;
      for (let ax = 0; ax < 3; ax++) {
        const key = ax === 0 ? 'x' : ax === 1 ? 'y' : 'z', prev = g[key];
        g[key] += v[ax] * dt;
        if (w.overlaps(g.x - r, g.y - r, g.z - r, g.x + r, g.y + r, g.z + r)) {
          g[key] = prev;
          if (Math.abs(v[ax]) > 2) sfx.bounce(g.x, g.z);
          v[ax] *= -0.4; v[(ax + 1) % 3] *= 0.78; v[(ax + 2) % 3] *= 0.78;
        }
      }
      g.t -= dt;
      if (g.t > 0) continue;
      this.grenades.splice(i, 1);
      this.fx.explosion(g.x, g.y, g.z); sfx.explosion(g.x, g.z);
      for (const e of this.actors) {
        if (!e.alive || (e.team === g.owner.team && e !== g.owner)) continue;
        const p = e.body.pos, cy = p[1] + e.body.h * 0.6, d = Math.hypot(p[0] - g.x, cy - g.y, p[2] - g.z);
        if (d < GRENADE.radius && this.los(g.x, g.y + 0.25, g.z, p[0], cy, p[2]))
          this.damage(e, GRENADE.damage * (1 - d / GRENADE.radius), g.owner, false, { name: 'GRENADE' });
      }
      this.noise(g.owner, g.x, g.z);
    }
  }

  select(i) {
    const inv = this.player.inv, n = inv.slots.length;
    if (inv.select((i + n) % n)) { sfx.switchWeapon(); this.player.vm.lower = 1; this.hud.showSlots(inv); }
  }

  update(dt, cam) {
    const pl = this.player, inv = pl.inv, world = this.world;

    // ---- player ----
    if (pl.alive && !this.over) {
      pl.applyLook();
      let rem = Math.min(dt, 0.1);
      while (rem > 1e-5) {
        const s = Math.min(rem, MAX_STEP); pl.update(s, world); rem -= s;
        if (pl.landed) sfx.land();
      }
      if (pl.stepSound) { sfx.step(); pl.stepSound = false; }
      for (const act of input.actions) {
        if (act === 'reload') { if (inv.startReload()) sfx.reload(inv.def.reload); }
        else if (act === 'next') this.select(inv.cur + 1);
        else if (act === 'prev') this.select(inv.cur - 1);
        else if (act === 'grenade') this.throwGrenade(pl);
        else if (act.startsWith('slot')) this.select(+act.slice(4) - 1);
      }
      if (input.fire()) this.fire(pl);
    } else pl.deathT += dt;
    input.actions.length = 0;

    // ---- bots ----
    const bdt = Math.min(dt, 0.05);
    for (const b of this.bots) {
      if (b.alive && !this.over) {
        b.brain.update(bdt, world);
        if (b.stepSound) { sfx.step(b.body.pos[0], b.body.pos[2], 0.2); b.stepSound = false; }
      }
    }

    // ---- shared timers, respawns ----
    for (const a of this.actors) {
      a.inv.update(dt); a.flashT -= dt;
      if (!a.alive) {
        a.fall = Math.min(1, a.fall + dt / 0.45);
        a.respawnT -= dt;
        if (a.respawnT <= 0 && !this.over) this.spawn(a);
      }
    }
    this.updateGrenades(dt);
    this.fx.update(dt);
    if (!this.over) { this.time -= dt; if (this.time <= 0) this.end(this.score.att === this.score.def ? 'draw' : this.score.att > this.score.def ? 'att' : 'def'); }

    // ---- first-person weapon animation ----
    const vm = pl.vm;
    vm.kick *= Math.exp(-dt * 14); vm.flash -= dt; vm.swing *= Math.exp(-dt * 9);
    const lowerTarget = inv.switchT > 0 ? inv.switchT / 0.4 : inv.reloadT > 0 ? Math.min(1, Math.min(inv.reloadT, inv.def.reload - inv.reloadT) * 6) * 0.6 : 0;
    vm.lower += (lowerTarget - vm.lower) * Math.min(1, dt * 16);

    // ---- camera, audio listener, HUD ----
    pl.applyToCamera(cam);
    setListener(cam.pos[0], cam.pos[2], cam.yaw);
    const hud = this.hud, d = inv.def;
    hud.setVitals(pl.health, pl.armor);
    hud.setAmmo(d, inv.slot, inv.grenades, inv.reloadT > 0);
    hud.setScore(this.score, this.killLimit, this.time, pl.team);
    const scoped = !!d.zoom && pl.aim > 0.75 && pl.alive;
    hud.setScope(scoped);
    hud.setCrosshair(pl.alive && !scoped, (d.melee ? 0.004 : (d.aimSpread !== undefined && pl.aim < 0.6 ? d.spread : d.spread * (1 - pl.aim * 0.45))) * (1 + pl.speed / 5.4 * 0.8) + inv.bloom);
    this.scoped = scoped;
  }

  draw(cam) {
    const r = this.renderer, pl = this.player;
    for (const a of this.actors) {
      if (a === pl) continue;
      drawActor(r.solid, a);
      if (a.alive && a.team === pl.team) {      // team-mate marker
        const p = a.body.pos, s = 0.07;
        r.fx.quad(p[0], p[1] + 2.05, p[2], cam.right[0] * s, 0, cam.right[2] * s, 0, s, 0, 0.35, 0.9, 0.45, 0.85);
      }
    }
    for (const g of this.grenades) drawGrenade(r.solid, g);
    this.fx.draw(r.fx, cam);
    if (pl.alive && !this.scoped) {
      const sway = Math.min(pl.speed / 5.4, 1) * (pl.onGround ? 1 : 0);
      drawViewModel(r.vm, pl.inv.def.id, pl.vm, pl.aim, Math.cos(pl.walkPhase) * 0.008 * sway, Math.abs(Math.sin(pl.walkPhase)) * -0.01 * sway);
    }
    const p = pl.body.pos;
    r.vmLight += (this.map.sunAt(p[0], p[1] + 1, p[2]) - r.vmLight) * 0.15;
  }
}
