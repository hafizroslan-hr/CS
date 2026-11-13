// Menu screens: main, match setup, map selection, settings, controls, about, pause.
import { settings, matchConfig, saveSettings, saveMatch, resetSettings } from '../storage.js';
import { MAPS } from '../maps/index.js';

const SETUP = [
  { key: 'mode', label: 'GAME MODE', values: [['defusal', 'BOMB DEFUSAL'], ['tdm', 'TEAM DEATHMATCH'], ['elim', 'ELIMINATION']] },
  { key: 'map', label: 'MAP', values: MAPS.filter(m => m.available).map(m => [m.id, m.name]) },
  { key: 'team', label: 'TEAM', values: [['auto', 'AUTO ASSIGN'], ['att', 'INSURGENTS'], ['def', 'TASK FORCE']] },
  { key: 'difficulty', label: 'BOT DIFFICULTY', values: [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD'], ['expert', 'EXPERT']] },
  { key: 'bots', label: 'BOTS', values: [[3, '3 (2 v 2)'], [5, '5 (3 v 3)'], [7, '7 (4 v 4)'], [9, '9 (5 v 5)']] },
  { key: 'roundTime', label: 'ROUND TIME', values: [[90, '1:30'], [120, '2:00'], [150, '2:30'], [180, '3:00']] },
  { key: 'startMoney', label: 'START MONEY', values: [[800, '$800'], [1600, '$1600'], [4000, '$4000'], [8000, '$8000'], [16000, '$16000']] },
  { key: 'matchLength', label: 'MATCH LENGTH', values: [[7, 'BEST OF 7'], [15, 'BEST OF 15'], [25, 'BEST OF 25']] }
];
const ONOFF = [[false, 'OFF'], [true, 'ON']];
const SETTINGS = [
  { key: 'quality', label: 'GRAPHICS', values: [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']] },
  { key: 'lookSens', label: 'CAMERA SENS. (TOUCH)', range: [0.3, 3, 0.1] },
  { key: 'stickSens', label: 'JOYSTICK SENS.', range: [0.5, 2, 0.1] },
  { key: 'mouseSens', label: 'MOUSE SENS.', range: [0.3, 3, 0.1] },
  { key: 'invertY', label: 'INVERT LOOK Y', values: ONOFF },
  { key: 'showFps', label: 'FPS COUNTER (DEV)', values: ONOFF }
];

function buildOptions(container, schema, store, onChange) {
  container.innerHTML = '';
  for (const o of schema) {
    const row = document.createElement('div');
    row.className = 'opt' + (o.range ? ' range' : '');
    const label = `<span class="opt-label">${o.label}</span>`;
    if (o.range) {
      row.innerHTML = `${label}<input type="range" min="${o.range[0]}" max="${o.range[1]}" step="${o.range[2]}"><span class="opt-val"></span>`;
      const inp = row.querySelector('input'), val = row.querySelector('.opt-val');
      inp.value = store[o.key]; val.textContent = (+store[o.key]).toFixed(1);
      inp.addEventListener('input', () => { store[o.key] = +inp.value; val.textContent = (+inp.value).toFixed(1); onChange(o.key); });
    } else {
      row.innerHTML = `${label}<button aria-label="previous">◀</button><span class="opt-val"></span><button aria-label="next">▶</button>`;
      const val = row.querySelector('.opt-val'), btns = row.querySelectorAll('button');
      let idx = Math.max(0, o.values.findIndex(v => v[0] === store[o.key]));
      const set = d => {
        idx = (idx + d + o.values.length) % o.values.length;
        store[o.key] = o.values[idx][0]; val.textContent = o.values[idx][1];
        if (d) onChange(o.key);
      };
      set(0);
      btns[0].addEventListener('click', () => set(-1));
      btns[1].addEventListener('click', () => set(1));
    }
    container.appendChild(row);
  }
}

function drawMinimap(cv, def) {
  const rows = def.rows, w = rows[0].length, h = rows.length, ctx = cv.getContext('2d');
  cv.width = w; cv.height = h;
  const col = { '#': '#5d4a30', '=': '#8a7350', ':': '#4a4c50', ',': '#9b8f7c', A: '#c8452f', B: '#c8452f', t: '#e0a030', d: '#5aa0d8',
    c: '#6f4d24', C: '#6f4d24', k: '#6f4d24' };
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const k = rows[r][c];
    ctx.fillStyle = col[k] || (k >= '1' && k <= '4' ? '#857a66' : '#c9a56b');
    ctx.fillRect(c, r, 1, 1);
  }
}

export class Menu {
  constructor(handlers) {
    this.h = handlers;
    this.root = document.getElementById('screens');
    this.stack = [];
    this.current = null;

    this.root.addEventListener('click', e => {
      const go = e.target.closest('[data-go]');
      if (go) { this.push(go.dataset.go); return; }
      if (e.target.closest('[data-back]')) this.back();
    });
    document.getElementById('btn-start').addEventListener('click', () => handlers.onStart());
    document.getElementById('btn-resume').addEventListener('click', () => handlers.onResume());
    document.getElementById('btn-respawn').addEventListener('click', () => handlers.onRespawn());
    document.getElementById('btn-quit').addEventListener('click', () => handlers.onQuit());
    document.getElementById('btn-edit-layout').addEventListener('click', () => handlers.onEditLayout());
    document.getElementById('btn-edit-layout2').addEventListener('click', () => handlers.onEditLayout());
    document.getElementById('btn-reset-settings').addEventListener('click', () => {
      resetSettings(); this.buildSettings(); handlers.onSettingsChanged('*');
    });

    buildOptions(document.getElementById('setup-options'), SETUP, matchConfig, () => { saveMatch(); this.buildMaps(); });
    this.buildSettings();
    this.buildMaps();
  }

  buildSettings() {
    buildOptions(document.getElementById('settings-options'), SETTINGS, settings, key => { saveSettings(); this.h.onSettingsChanged(key); });
  }

  buildMaps() {
    const list = document.getElementById('map-list');
    list.innerHTML = '';
    for (const m of MAPS) {
      const card = document.createElement('button');
      card.className = 'map-card' + (m.available ? '' : ' locked') + (m.id === matchConfig.map ? ' selected' : '');
      card.innerHTML = `<canvas></canvas><b>${m.name}</b><small>${m.desc}</small><span class="tag">${
        m.available ? (m.id === matchConfig.map ? 'SELECTED' : 'TAP TO SELECT') : 'IN DEVELOPMENT — PHASE 4'}</span>`;
      if (m.available) {
        drawMinimap(card.querySelector('canvas'), m);
        card.addEventListener('click', () => {
          matchConfig.map = m.id; saveMatch();
          buildOptions(document.getElementById('setup-options'), SETUP, matchConfig, () => { saveMatch(); this.buildMaps(); });
          this.buildMaps();
        });
      } else card.disabled = true;
      list.appendChild(card);
    }
  }

  _show(name) {
    this.current = name;
    for (const s of this.root.querySelectorAll('.screen')) s.classList.toggle('hidden', s.dataset.screen !== name);
    this.root.classList.toggle('hidden', !name);
  }
  // open a root screen ('main' or 'pause'), clearing history
  open(name) { this.stack = []; this._show(name); }
  push(name) { this.stack.push(this.current); this._show(name); }
  back() { this._show(this.stack.pop() || 'main'); }
  hide() { this.stack = []; this._show(null); }
  // temporarily hide/show without losing the navigation stack (layout editor)
  suspend(on) { this.root.classList.toggle('hidden', on); }
}
