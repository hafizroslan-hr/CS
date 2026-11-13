// CLASSIC STRIKE — application entry point and main loop.
import { settings, matchConfig } from './storage.js';
import { Renderer } from './engine/renderer.js';
import { Camera } from './engine/camera.js';
import { input, initInput, requestLock, releaseLock } from './engine/input.js';
import { unlockAudio, applyVolume, suspendAudio } from './engine/audio.js';
import { loadMap } from './maps/map-loader.js';
import { getMapDef } from './maps/index.js';
import { Player } from './gameplay/player.js';
import { Match, TEAM_NAME } from './gameplay/match.js';
import { Effects } from './gameplay/effects.js';
import { Menu } from './ui/menu.js';
import { Hud } from './ui/hud.js';
import { TouchControls } from './ui/controls.js';

const canvas = document.getElementById('gl');
const body = document.body;

function fatal(msg) {
  const el = document.getElementById('fatal');
  el.textContent = msg; el.classList.remove('hidden');
}

let renderer;
try {
  renderer = new Renderer(canvas, settings.quality);
} catch (e) {
  fatal(e.message === 'WEBGL2_UNAVAILABLE'
    ? 'This device or browser does not support WebGL 2. Classic Strike needs iOS 15+ Safari or a current Chrome, Firefox or Edge.'
    : 'Graphics initialisation failed: ' + e.message);
  throw e;
}

const camera = new Camera();
const player = new Player();
const hud = new Hud();
const fx = new Effects();
let map = null, match = null;
let state = 'menu';            // menu | playing | paused | result
let isTouch = window.matchMedia('(pointer: coarse)').matches;
const portrait = window.matchMedia('(orientation: portrait)');

function setMap(id) {
  const def = getMapDef(id);
  if (map && map.id === def.id) return;
  map = loadMap(def);
  renderer.loadWorld(map);
}

function setState(s) {
  state = s;
  const playing = s === 'playing';
  body.classList.toggle('ingame', playing || s === 'paused');
  body.classList.toggle('touch', isTouch);
  input.enabled = playing;
  if (!playing) input.clear();
  hud.show(playing || s === 'paused');
  touch.show(playing && isTouch);
  suspendAudio(s === 'paused');
}

const touch = new TouchControls(document.getElementById('touch'), { onPause: () => pause() });

function startMatch() {
  unlockAudio();
  setMap(matchConfig.map);
  match = new Match({ map, cfg: matchConfig, player, fx, hud, renderer, onEnd: r => {
    releaseLock();
    setTimeout(() => { if (match && match.over) { setState('result'); menu.showResult(r, TEAM_NAME); } }, 1800);
  } });
  match.start();
  menu.hide(); setState('playing');
  if (!isTouch) requestLock(canvas);
}

const menu = new Menu({
  onStart: startMatch,
  onResume() { resume(); },
  onRespawn() { if (match) match.spawn(player); resume(); },
  onQuit() { releaseLock(); match = null; setState('menu'); menu.open('main'); },
  onSettingsChanged(key) {
    if (key === 'quality' || key === '*') renderer.setQuality(settings.quality);
    applyVolume();
  },
  onEditLayout() {
    menu.suspend(true);
    touch.setEditing(true, () => { menu.suspend(false); touch.show(false); });
  }
});

function pause() {
  if (state !== 'playing') return;
  releaseLock();
  setState('paused'); menu.open('pause');
}
function resume() {
  if (state !== 'paused') return;
  menu.hide(); setState('playing');
  if (!isTouch) requestLock(canvas);
}

initInput(canvas, {
  onEscape() {
    if (touch.editing) return;
    if (state === 'playing') pause();
    else if (state === 'paused' && menu.current === 'pause') resume();
    else if (menu.current && !['main', 'pause', 'result'].includes(menu.current)) menu.back();
  },
  onLockLost() { pause(); }
});

// ---- browser behaviour: audio unlock, no scroll / zoom / double-tap during play -------------
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlockAudio, { passive: true });
document.addEventListener('touchmove', e => {
  if (state === 'playing' || touch.editing) e.preventDefault();
}, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', () => { if (isTouch) touch.release(); });
window.addEventListener('touchstart', () => {
  if (isTouch) return;
  isTouch = true; body.classList.add('touch');
  if (state === 'playing') { releaseLock(); touch.show(true); }
}, { passive: true });
portrait.addEventListener('change', () => touch.release());
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pause(); });
canvas.addEventListener('webglcontextrestored', () => location.reload());

// ---- main loop -----------------------------------------------------------------------------
let last = performance.now(), fps = 60, lowTime = 0, highTime = 0, menuT = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  if (dt > 0) fps += (1 / dt - fps) * 0.08;

  if (match && state === 'playing' && !(isTouch && portrait.matches)) {
    match.update(dt, camera);
    hud.tick(dt);

    // adaptive resolution: drop render scale if we stay under 28 fps, restore slowly above 55
    if (fps < 28) { lowTime += dt; highTime = 0; } else if (fps > 55) { highTime += dt; lowTime = 0; } else lowTime = highTime = 0;
    if (lowTime > 2.5 && renderer.scale > 0.55) { renderer.scale -= 0.15; lowTime = 0; }
    if (highTime > 12 && renderer.scale < 1) { renderer.scale = Math.min(1, renderer.scale + 0.15); highTime = 0; }

    hud.setZone(map.name, map.zoneAt(camera.pos[0], camera.pos[2]));
    hud.setHint(!isTouch && !input.pointerLocked ? 'CLICK TO CAPTURE MOUSE  ·  WASD MOVE  ·  CLICK FIRE  ·  R RELOAD  ·  1-6 WEAPONS  ·  G GRENADE' : '');
  } else if (state === 'menu' || state === 'result') {
    // slow fly-over of the selected map behind the menus
    menuT += dt * 0.06;
    const cx = map.width / 2, cz = map.depth / 2;
    camera.pos[0] = cx + Math.sin(menuT) * map.width * 0.55;
    camera.pos[1] = 30;
    camera.pos[2] = cz + Math.cos(menuT) * map.depth * 0.6;
    camera.fovY = 58 * Math.PI / 180;
    camera.lookAt(cx, 0, cz);
  }
  if (match && state !== 'menu' && state !== 'result') match.draw(camera);
  renderer.render(camera);
  hud.setFps(settings.showFps && (state === 'playing' || state === 'paused'), fps, renderer.scale);
}

setMap(matchConfig.map);
setState('menu');
menu.open('main');
requestAnimationFrame(frame);

// small debug handle (used by automated tests; harmless in production)
window.__cs = { player, camera, input, get map() { return map; }, get match() { return match; }, get state() { return state; }, renderer };
