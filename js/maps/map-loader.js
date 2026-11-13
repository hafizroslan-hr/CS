// Turns an ASCII map definition into render geometry, collision boxes,
// a baked sun-shadow height map, spawn points, bomb sites and callout zones.
import { MeshBuilder } from '../engine/mesh.js';
import { LAYER } from '../engine/textures.js';
import { CollisionWorld } from '../engine/collision.js';

export const CELL = 2;
const WALL_H = 5, LOW_H = 1, CEIL_Y = 3.5, ROOF_Y = 3.8, LINTEL_Y = 3.0;
const TPM = 8;   // shadow map texels per metre

// crate stacks per character: [inset from cell edge, y0, y1, extra z inset]
const CRATES = {
  c: [[0.375, 0, 1.25, 0]],
  C: [[0.25, 0, 1.5, 0]],
  k: [[0.375, 0, 1.25, 0], [0.5, 1.25, 2.0, 0.125]]
};

// Greedy-merge grid cells with equal values into rectangles.
function mergeRects(cols, rows, val) {
  const used = new Uint8Array(cols * rows), out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (used[r * cols + c]) continue;
    const v = val(c, r);
    if (v == null) continue;
    let c1 = c;
    while (c1 + 1 < cols && !used[r * cols + c1 + 1] && val(c1 + 1, r) === v) c1++;
    let r1 = r;
    grow: while (r1 + 1 < rows) {
      for (let x = c; x <= c1; x++) if (used[(r1 + 1) * cols + x] || val(x, r1 + 1) !== v) break grow;
      r1++;
    }
    for (let y = r; y <= r1; y++) for (let x = c; x <= c1; x++) used[y * cols + x] = 1;
    out.push({ c0: c, r0: r, c1, r1, v });
  }
  return out;
}

export function loadMap(def) {
  const rows = def.rows.length, cols = def.rows[0].length;
  def.rows.forEach((row, i) => { if (row.length !== cols) throw new Error(`${def.id}: row ${i} has length ${row.length}, expected ${cols}`); });
  const th = def.theme;
  const L = { wall: LAYER[th.wall], floor: LAYER[th.floor], paving: LAYER[th.paving], interior: LAYER[th.interior],
    block: LAYER[th.block], crate: LAYER[th.crate], ceiling: LAYER[th.ceiling] };
  const ch = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows) ? '#' : def.rows[r][c];

  // --- per-cell classification -------------------------------------------------
  const solidH = (c, r) => {
    const k = ch(c, r);
    if (k === '#') return WALL_H;
    if (k === '=') return LOW_H;
    if (k >= '1' && k <= '4') return (k.charCodeAt(0) - 48) * 0.5;
    return 0;
  };
  const floorType = new Array(cols * rows).fill(null);   // 'floor' | 'paving' | 'interior' | null (solid)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = ch(c, r);
    if (solidH(c, r) > 0) continue;
    let t;
    if (k === '.' || k === 't' || k === 'd') t = 'floor';
    else if (k === ',' || k === 'A' || k === 'B') t = 'paving';
    else if (k === ':') t = 'interior';
    else t = (c > 0 && floorType[r * cols + c - 1]) || 'floor';   // props inherit the floor to their left
    floorType[r * cols + c] = t;
  }
  const isInterior = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && floorType[r * cols + c] === 'interior';
  const isOpenAir = (c, r) => { const t = c >= 0 && r >= 0 && c < cols && r < rows && floorType[r * cols + c]; return t && t !== 'interior'; };

  const mb = new MeshBuilder();
  const boxes = [];
  const addBox = (x0, y0, z0, x1, y1, z1) => boxes.push(x0, y0, z0, x1, y1, z1);
  const width = cols * CELL, depth = rows * CELL;

  // --- floors ------------------------------------------------------------------
  addBox(0, -2, 0, width, 0, depth);
  mb.face('py', -300, -1, -300, width + 300, -0.05, depth + 300, L.floor);   // terrain beyond the walls
  for (const q of mergeRects(cols, rows, (c, r) => floorType[r * cols + c])) {
    mb.face('py', q.c0 * CELL, -1, q.r0 * CELL, (q.c1 + 1) * CELL, 0, (q.r1 + 1) * CELL, L[q.v]);
  }

  // --- walls, low walls, platforms ----------------------------------------------
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const h = solidH(c, r);
    if (!h) continue;
    const layer = ch(c, r) === '#' ? L.wall : L.block;
    const x0 = c * CELL, z0 = r * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
    const sides = [['px', c + 1, r], ['nx', c - 1, r], ['pz', c, r + 1], ['nz', c, r - 1]];
    for (const [dir, nc, nr] of sides) {
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;   // outer boundary faces are never seen
      const nh = solidH(nc, nr);
      if (nh < h) mb.face(dir, x0, nh, z0, x1, h, z1, layer);
    }
  }
  for (const q of mergeRects(cols, rows, (c, r) => solidH(c, r) || null)) {
    const x0 = q.c0 * CELL, z0 = q.r0 * CELL, x1 = (q.c1 + 1) * CELL, z1 = (q.r1 + 1) * CELL;
    addBox(x0, 0, z0, x1, q.v, z1);
    mb.face('py', x0, 0, z0, x1, q.v, z1, q.v === WALL_H ? L.wall : L.block);
  }

  // --- interiors: ceiling, roof, door lintels ------------------------------------
  for (const q of mergeRects(cols, rows, (c, r) => isInterior(c, r) ? 1 : null)) {
    const x0 = q.c0 * CELL, z0 = q.r0 * CELL, x1 = (q.c1 + 1) * CELL, z1 = (q.r1 + 1) * CELL;
    addBox(x0, CEIL_Y, z0, x1, ROOF_Y, z1);
    mb.face('ny', x0, CEIL_Y, z0, x1, ROOF_Y, z1, L.ceiling);
    mb.face('py', x0, CEIL_Y, z0, x1, ROOF_Y, z1, L.block);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!isInterior(c, r)) continue;
    const x0 = c * CELL, z0 = r * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
    // header above each doorway between interior and open air (drawn from both sides)
    if (isOpenAir(c + 1, r)) { mb.face('px', x0, LINTEL_Y, z0, x1, ROOF_Y, z1, L.wall); mb.face('nx', x1, LINTEL_Y, z0, x1 + 1, ROOF_Y, z1, L.wall); addBox(x1 - 0.1, LINTEL_Y, z0, x1, ROOF_Y, z1); }
    if (isOpenAir(c - 1, r)) { mb.face('nx', x0, LINTEL_Y, z0, x1, ROOF_Y, z1, L.wall); mb.face('px', x0 - 1, LINTEL_Y, z0, x0, ROOF_Y, z1, L.wall); addBox(x0, LINTEL_Y, z0, x0 + 0.1, ROOF_Y, z1); }
    if (isOpenAir(c, r + 1)) { mb.face('pz', x0, LINTEL_Y, z0, x1, ROOF_Y, z1, L.wall); mb.face('nz', x0, LINTEL_Y, z1, x1, ROOF_Y, z1 + 1, L.wall); addBox(x0, LINTEL_Y, z1 - 0.1, x1, ROOF_Y, z1); }
    if (isOpenAir(c, r - 1)) { mb.face('nz', x0, LINTEL_Y, z0, x1, ROOF_Y, z1, L.wall); mb.face('pz', x0, LINTEL_Y, z0 - 1, x1, ROOF_Y, z0, L.wall); addBox(x0, LINTEL_Y, z0, x1, ROOF_Y, z0 + 0.1); }
  }

  // --- crates, spawns, sites ------------------------------------------------------
  const crateBoxes = [];
  const spawns = { att: [], def: [] };
  const siteCells = { A: [], B: [] };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = ch(c, r), x0 = c * CELL, z0 = r * CELL;
    if (CRATES[k]) {
      for (const [inset, y0, y1, zi] of CRATES[k]) {
        const b = [x0 + inset, y0, z0 + inset + zi, x0 + CELL - inset, y1, z0 + CELL - inset + zi];
        crateBoxes.push(b); addBox(...b);
        mb.box(b[0], b[1], b[2], b[3], b[4], b[5], L.crate, L.crate, true);
      }
    } else if (k === 't') spawns.att.push({ x: x0 + 1, z: z0 + 1, yaw: 0 });
    else if (k === 'd') spawns.def.push({ x: x0 + 1, z: z0 + 1, yaw: Math.PI });
    else if (k === 'A' || k === 'B') siteCells[k].push([c, r]);
  }
  const sites = {};
  for (const id of ['A', 'B']) {
    const cells = siteCells[id];
    if (!cells.length) continue;
    const c0 = Math.min(...cells.map(p => p[0])), c1 = Math.max(...cells.map(p => p[0])) + 1;
    const r0 = Math.min(...cells.map(p => p[1])), r1 = Math.max(...cells.map(p => p[1])) + 1;
    const s = { id, x0: c0 * CELL, z0: r0 * CELL, x1: c1 * CELL, z1: r1 * CELL };
    s.x = (s.x0 + s.x1) / 2; s.z = (s.z0 + s.z1) / 2;
    sites[id] = s;
    mb.face('py', s.x - 2.5, -1, s.z - 2.5, s.x + 2.5, 0.02, s.z + 2.5, LAYER['site' + id], true);
  }

  // --- baked sun shadow height map -----------------------------------------------
  const sw = cols * CELL * TPM, sh = rows * CELL * TPM;
  const H = new Float32Array(sw * sh);
  const fill = (x0, z0, x1, z1, h) => {
    const a = Math.round(x0 * TPM), b = Math.round(x1 * TPM), cz = Math.round(z0 * TPM), dz = Math.round(z1 * TPM);
    for (let z = cz; z < dz; z++) for (let x = a; x < b; x++) { const i = z * sw + x; if (H[i] < h) H[i] = h; }
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const h = solidH(c, r) || (isInterior(c, r) ? ROOF_Y : 0);
    if (h) fill(c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL, h);
  }
  for (const b of crateBoxes) fill(b[0], b[2], b[3], b[5], b[4]);
  const sun = th.sunDir, sl = Math.hypot(sun[0], sun[1], sun[2]);
  const sunDir = [sun[0] / sl, sun[1] / sl, sun[2] / sl];
  const hl = Math.hypot(sunDir[0], sunDir[2]);
  const dx = sunDir[0] / hl, dz = sunDir[2] / hl, drop = (sunDir[1] / hl) / TPM;
  const steps = Math.ceil(WALL_H / drop);
  const S = new Float32Array(sw * sh);
  for (let z = 0; z < sh; z++) for (let x = 0; x < sw; x++) {
    let best = H[z * sw + x];
    for (let k = 1; k <= steps; k++) {
      const px = Math.round(x + dx * k), pz = Math.round(z + dz * k);
      if (px < 0 || pz < 0 || px >= sw || pz >= sh) break;
      const v = H[pz * sw + px] - k * drop;
      if (v > best) best = v;
    }
    S[z * sw + x] = best;
  }

  const boxArr = new Float32Array(boxes);
  const zoneAt = (x, z) => {
    const c = Math.floor(x / CELL), r = Math.floor(z / CELL), k = ch(c, r);
    if (k === 'A' || k === 'B') return 'BOMBSITE ' + k;
    for (const q of def.zones || []) if (c >= q[0] && c <= q[2] && r >= q[1] && r <= q[3]) return q[4];
    return '';
  };

  return {
    id: def.id, name: def.name, def, cols, rows, width, depth,
    mesh: mb.build(),
    collision: new CollisionWorld(boxArr, width, depth),
    shadow: { data: S, w: sw, h: sh, tpm: TPM },
    spawns, sites, zoneAt,
    theme: Object.assign({}, th, { sunDir })
  };
}
