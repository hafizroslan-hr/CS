// In-game HUD (Phase 1: callout, crosshair, FPS counter, desktop hint).
export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.zone = document.getElementById('hud-zone');
    this.fps = document.getElementById('hud-fps');
    this.hint = document.getElementById('hud-hint');
    this._zone = null; this._fps = -1; this._hint = null;
  }
  show(on) { this.root.classList.toggle('hidden', !on); }
  setZone(mapName, zone) {
    const t = zone ? `${mapName} // ${zone}` : mapName;
    if (t !== this._zone) { this._zone = t; this.zone.textContent = t; }
  }
  setFps(on, fps, scale) {
    this.fps.classList.toggle('hidden', !on);
    if (!on) return;
    const v = Math.round(fps);
    if (v !== this._fps) { this._fps = v; this.fps.textContent = `${v} FPS` + (scale < 1 ? ` · ${Math.round(scale * 100)}% RES` : ''); }
  }
  setHint(text) {
    if (text === this._hint) return;
    this._hint = text;
    this.hint.classList.toggle('hidden', !text);
    this.hint.textContent = text || '';
  }
}
