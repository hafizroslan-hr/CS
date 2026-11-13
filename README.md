# CLASSIC STRIKE

An original, single-player, offline tactical FPS for mobile browsers (iPhone Safari first).
Native **WebGL 2 + vanilla JavaScript ES modules + CSS**. No engine, no framework, no build step, no backend.

> **Status: Phase 1 (Foundation) complete.** You can launch the game, deploy onto the first map
> (DUST FRONT) and move around with touch or keyboard/mouse. Combat, bots and rounds are *not* implemented yet
> (see the roadmap).

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
| Look | Drag on the right side | Mouse (click to capture) |
| Jump | JUMP | Space |
| Crouch | CROUCH (toggle) | C / Ctrl (hold) |
| Pause | II | Esc |

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
  collision.js        AABB world in a uniform hash grid, overlap and ray queries
  physics.js          axis-swept kinematic movement with automatic step-up
  input.js            unified keyboard / mouse / touch input state
js/gameplay/player.js movement, jumping, crouching, view smoothing
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
| 2 Combat | weapons, firing/reload, damage, health/armour, bot models, basic AI | next |
| 3 Tactical | teams, team AI, bomb plant/defuse, rounds, scoring, buy menu, economy | |
| 4 Maps & difficulty | four more maps, four difficulty levels, better navigation | |
| 5 Polish | full HUD, audio, animations, effects, performance | |
| 6 Deployment | service worker / offline cache, PWA verification, iPhone testing | |

### Known gaps in Phase 1

- Match-setup options other than MAP and TEAM are saved but have no gameplay effect yet.
- No service worker yet (added in Phase 6 so caching does not interfere with development); the game needs
  a connection each time it loads.
- No audio, weapons, bots, bomb logic or rounds yet.
- Only DUST FRONT is playable; the other four maps are listed as "in development".
- Verified in desktop Chromium and an emulated iPhone viewport with multi-touch; **not yet verified on a
  physical iPhone**.

## Credits

All code, maps and procedural art are original to this project. No third-party assets or libraries.
