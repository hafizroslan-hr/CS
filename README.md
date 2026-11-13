# CLASSIC STRIKE

An original, single-player, offline tactical FPS for mobile browsers (iPhone Safari first).
Native **WebGL 2 + vanilla JavaScript ES modules + CSS**. No engine, no framework, no build step, no backend.

> **Status: Phase 2 (Combat) complete.** Deploy onto DUST FRONT with a squad of bots and fight the enemy
> team: six weapons plus grenades, bot AI with four difficulty levels, sound, HUD and a win/lose result.
> Bomb objectives, rounds and economy are *not* implemented yet (see the roadmap).

## Play / deploy on GitHub Pages

1. Merge this branch into your default branch (or keep it on a branch of its own).
2. On GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**.
3. Choose the branch and the **/(root)** folder, then **Save**.
4. After a minute the game is live at `https://<user>.github.io/<repo>/`.
5. On iPhone: open the URL in Safari, rotate to landscape, and optionally **Share → Add to Home Screen**
   to run it full-screen without the Safari toolbars.

All paths are relative, so it works under any repository sub-path. `.nojekyll` disables Jekyll processing.

### Run locally

ES modules need HTTP (not `file://`). Any static server works:

```
python3 -m http.server 8000      # then open http://localhost:8000/
```

## Controls

| Action | Touch | Desktop |
|---|---|---|
| Move | Left virtual stick (or touch anywhere on the left 40 %) | W A S D |
| Look | Drag on the right side (also while holding FIRE) | Mouse (click to capture) |
| Shoot | FIRE (hold) | Left click |
| Aim / scope | AIM (toggle) | Right click (hold) |
| Reload | RELOAD | R |
| Change weapon | WEAPON (next) | 1–6, mouse wheel, Q |
| Grenade | GREN | G |
| Jump / crouch | JUMP / CROUCH (toggle) | Space / C or Ctrl |
| Pause | II | Esc |

## Gameplay (Phase 2)

Arsenal-style combat: every soldier carries all weapons at once and respawns a few seconds after dying.
The first team to the kill limit — or the team ahead when the clock runs out — wins.

| Slot | Weapon | Character |
|---|---|---|
| 1 | Pry bar | melee, silent to bots beyond arm's reach |
| 2 | P9 pistol | fast, accurate, 17 rounds |
| 3 | .44 revolver | heavy single shots, big recoil |
| 4 | SMG-45 | automatic, 40 rounds, spreads when held |
| 5 | Pump shotgun | 8 pellets, devastating up close, weak at range |
| 6 | Bolt rifle | scoped, one-shot power, inaccurate from the hip |
| G | Hand grenades ×3 | bounce, 2.3 s fuse, blast blocked by walls |

Headshots do 2.5× damage. Moving, jumping and sustained fire widen the spread (the crosshair shows it);
crouching and aiming tighten it.

**Bots** use an A* navigation grid and a state machine (idle, patrol, attack, chase, search, investigate
gunfire, retreat). They need range, field of view *and* an unobstructed line of sight to see you, and
bullets are stopped by walls. Difficulty changes reaction time, aim error, turn rate, field of view,
hearing range, team call-outs, burst discipline, strafing, route variation and retreating.

**Audio** is synthesised with the Web Audio API (no files): gunfire per weapon, reloads, footsteps, hits,
explosions. It starts on your first tap. On iPhone, the ring/silent switch mutes web audio.

Settings → **EDIT TOUCH LAYOUT** lets you drag every control and resize it; the layout, sensitivities and
graphics quality persist in LocalStorage.

## Architecture

```
index.html            app shell, menu markup
manifest.json         PWA manifest (home-screen install)
css/                  main (base, rotate overlay) · menu · hud · mobile (touch controls)
js/main.js            state machine (menu / playing / paused) and requestAnimationFrame loop
js/storage.js         persisted settings and match configuration
js/engine/
  renderer.js         WebGL 2 renderer: one batched world draw call + procedural sky
  shaders.js          GLSL ES 3.0 sources
  textures.js         procedural textures packed into a TEXTURE_2D_ARRAY
  mesh.js             static geometry builder
  camera.js math.js   first-person camera, matrices
  batch.js            dynamic geometry batch (characters, weapons, particles)
  audio.js            synthesised sound effects (Web Audio)
  nav.js              navigation grid and A* path finding
  collision.js        AABB world in a uniform hash grid, overlap and ray queries
  physics.js          axis-swept kinematic movement with automatic step-up
  input.js            unified keyboard / mouse / touch input state
js/gameplay/
  actor.js            shared body / movement / vitals for player and bots
  player.js           input-driven movement, aiming, camera
  weapons.js          weapon table and inventory (ammo, reload, switching)
  match.js            teams, shooting and damage, grenades, respawns, scoring
  bot-ai.js           bot state machine and difficulty parameters
  models.js           procedural soldier and first-person weapon models
  effects.js          pooled particles and tracers
js/maps/
  map-loader.js       ASCII map → geometry, colliders, baked shadows, spawns, sites, callouts
  dust-front.js       map 1 (original layout)
  index.js            map registry
js/ui/                menu.js · hud.js · controls.js (touch controls and layout editor)
```

Maps are authored as ASCII grids of 2 m cells. The same grid drives rendering, collision, the baked shadow
map and (from Phase 2) the bots' A* navigation grid, so they can never disagree with each other.

## Technical review: limits of native WebGL 2 + vanilla JS

- **Everything is hand-built.** No engine means no editor, physics library, animation system or asset
  pipeline. Maps and models are procedural/low-poly boxes by design; there are no skinned characters.
- **Lighting is cheap by design.** One sun, ambient, fog, and a baked "shadow height map" (one texture
  fetch shadows all static geometry). Dynamic objects (bots, weapons) will not cast real shadows; they will
  get blob shadows.
- **iOS Safari constraints.** No pointer lock, no true fullscreen API and no orientation lock on iPhone —
  hence touch look, the rotate overlay and "Add to Home Screen" for full-screen play. WebGL 2 requires
  iOS 15+. Audio can only start after a user gesture.
- **Performance budget.** Phone GPUs are fill-rate bound: the render resolution is capped per quality level
  and drops automatically if the frame rate stays under 28 FPS.
- **Collision is AABB-only.** Walls, crates, stairs and platforms are axis-aligned boxes; no slopes or
  rotated geometry. This keeps physics and bot navigation fast and predictable.
- **No multiplayer, by requirement.** All other players will be bots.

## Roadmap

| Phase | Scope | State |
|---|---|---|
| 1 Foundation | structure, menus, match setup, renderer, map 1, movement, touch controls | **done** |
| 2 Combat | weapons, firing/reload, damage, health, bot models, bot AI, sound | **done** |
| 3 Tactical | bomb plant/defuse, rounds, objectives AI, scoreboard, economy | next |
| 4 Maps & difficulty | four more maps, four difficulty levels, better navigation | |
| 5 Polish | full HUD, audio, animations, effects, performance | |
| 6 Deployment | service worker / offline cache, PWA verification, iPhone testing | |

### Known gaps after Phase 2

- Every game mode currently plays as the team skirmish above; bomb defusal, elimination rounds, money and
  the buy menu are Phase 3. ROUND TIME sets the match clock (×4) and MATCH LENGTH the kill limit.
- Armour is displayed but always 0 (no pickups or purchases yet). Bots do not throw grenades.
- Soldiers do not collide with each other. Bots do not crouch or use cover deliberately yet.
- No menu music yet; no service worker / offline cache yet (Phase 6).
- Only DUST FRONT is playable.
- Verified in desktop Chromium and an emulated iPhone viewport with multi-touch; **not yet verified on a
  physical iPhone**, and audio could not be listened to in the automated environment.

## Credits

All code, maps and procedural art are original to this project. No third-party assets or libraries.
