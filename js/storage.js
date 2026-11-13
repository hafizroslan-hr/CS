// Persistent settings (LocalStorage). IndexedDB is reserved for match statistics (Phase 3+).
const SETTINGS_KEY = 'classicstrike.settings.v1';
const MATCH_KEY = 'classicstrike.match.v1';

export const DEFAULT_SETTINGS = {
  quality: 'medium',     // low | medium | high
  showFps: false,
  lookSens: 1,           // touch camera sensitivity
  stickSens: 1,          // joystick sensitivity
  mouseSens: 1,
  invertY: false,
  masterVol: 0.8,
  sfxVol: 1,
  layout: {}             // touch control overrides: id -> {x,y,s}
};

export const DEFAULT_MATCH = {
  mode: 'defusal', map: 'dust-front', team: 'auto', difficulty: 'normal',
  bots: 9, roundTime: 120, startMoney: 800, matchLength: 15
};

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
}
function write(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* private mode / quota */ }
}

export const settings = Object.assign({}, DEFAULT_SETTINGS, read(SETTINGS_KEY));
if (!settings.layout || typeof settings.layout !== 'object') settings.layout = {};
export const matchConfig = Object.assign({}, DEFAULT_MATCH, read(MATCH_KEY));

export function saveSettings() { write(SETTINGS_KEY, settings); }
export function saveMatch() { write(MATCH_KEY, matchConfig); }
export function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS, { layout: {} });
  saveSettings();
}
