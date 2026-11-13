// In-game HUD. DOM is only touched when a displayed value actually changes.
import { WEAPONS } from '../gameplay/weapons.js';

const $ = id => document.getElementById(id);
function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
const fmtTime = t => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

export class Hud {
  constructor() {
    this.root = $('hud'); this.zone = $('hud-zone'); this.fps = $('hud-fps'); this.hint = $('hud-hint');
    this.health = $('hud-health'); this.armor = $('hud-armor');
    this.wname = $('hud-wname'); this.ammo = $('hud-ammo'); this.reserve = $('hud-reserve'); this.gren = $('hud-gren');
    this.own = $('score-own'); this.enemy = $('score-enemy'); this.timer = $('hud-timer');
    this.feed = $('hud-feed'); this.msg = $('hud-msg'); this.slots = $('hud-slots');
    this.cross = $('crosshair'); this.hm = $('hitmarker'); this.dmg = $('hud-damage'); this.scope = $('scope');
    this.c = {};          // cache of last rendered values
    this.msgT = 0; this.slotT = 0;
  }
  show(on) { this.root.classList.toggle('hidden', !on); }
  set(el, key, text) { if (this.c[key] !== text) { this.c[key] = text; el.textContent = text; } }

  setZone(mapName, zone) { this.set(this.zone, 'zone', zone ? `${mapName} // ${zone}` : mapName); }
  setFps(on, fps, scale) {
    this.fps.classList.toggle('hidden', !on);
    if (on) this.set(this.fps, 'fps', `${Math.round(fps)} FPS` + (scale < 1 ? ` · ${Math.round(scale * 100)}% RES` : ''));
  }
  setHint(text) {
    if (text === this.c.hint) return;
    this.c.hint = text; this.hint.classList.toggle('hidden', !text); this.hint.textContent = text || '';
  }
  setVitals(health, armor) {
    const h = Math.ceil(health);
    if (this.c.health !== h) { this.c.health = h; this.health.textContent = h; this.health.classList.toggle('low', h <= 30); }
    this.set(this.armor, 'armor', Math.ceil(armor));
  }
  setAmmo(def, slot, grenades, reloading) {
    this.set(this.wname, 'wname', def.name + (reloading ? ' — RELOADING' : ''));
    const a = def.melee ? '—' : slot.mag;
    if (this.c.ammo !== a) { this.c.ammo = a; this.ammo.textContent = a; this.ammo.classList.toggle('low', !def.melee && slot.mag <= def.mag * 0.25); }
    this.set(this.reserve, 'reserve', def.melee ? '' : '/ ' + slot.reserve);
    this.set(this.gren, 'gren', 'GRENADES ' + grenades);
  }
  setScore(score, limit, time, team) {
    const other = team === 'att' ? 'def' : 'att';
    this.set(this.own, 'own', `YOU ${score[team]}`);
    this.set(this.enemy, 'enemy', `${score[other]} ENEMY`);
    this.set(this.timer, 'timer', `${fmtTime(time)} · ${limit}`);
  }
  setCrosshair(on, spread) {
    const gap = on ? Math.round(3 + spread * 420) : -1;
    if (this.c.gap === gap) return;
    this.c.gap = gap;
    this.cross.style.display = on ? '' : 'none';
    if (on) this.cross.style.setProperty('--gap', gap + 'px');
  }
  setScope(on) { if (this.c.scope !== on) { this.c.scope = on; this.scope.classList.toggle('hidden', !on); } }
  hitMarker(head) { this.hm.classList.toggle('head', !!head); restart(this.hm, 'show'); }
  damageFlash() { restart(this.dmg, 'show'); }

  message(text, secs) { this.msg.textContent = text; this.msg.classList.remove('hidden'); this.msgT = secs; }
  clearFeed() { this.feed.innerHTML = ''; this.msg.classList.add('hidden'); this.msgT = 0; }
  addKill(att, victim, weapon, head, player) {
    const cls = a => a.team === player.team ? 'own' : 'enemy';
    const row = document.createElement('div');
    if (att === player || victim === player) row.className = 'me';
    row.innerHTML = (att ? `<span class="${cls(att)}">${att.name}</span>` : '') +
      `<em>${weapon}${head ? ' ✛' : ''}</em><span class="${cls(victim)}">${victim.name}</span>`;
    row.dataset.t = performance.now();
    this.feed.appendChild(row);
    while (this.feed.children.length > 4) this.feed.firstChild.remove();
  }
  showSlots(inv) {
    this.slots.innerHTML = inv.slots.map((s, i) =>
      `<div class="${i === inv.cur ? 'cur' : ''}${!s.def.melee && s.mag + s.reserve <= 0 ? ' empty' : ''}"><b>${i + 1}</b><span>${s.def.name}</span></div>`).join('');
    this.slots.classList.remove('hidden'); this.slotT = 1.6;
  }
  // timers for transient elements
  tick(dt) {
    if (this.msgT > 0 && (this.msgT -= dt) <= 0) this.msg.classList.add('hidden');
    if (this.slotT > 0 && (this.slotT -= dt) <= 0) this.slots.classList.add('hidden');
    const first = this.feed.firstChild;
    if (first && performance.now() - first.dataset.t > 6000) first.remove();
  }
}
export { WEAPONS };
