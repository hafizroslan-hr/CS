// Grid navigation for bots: one node per 2 m map cell, 8-connected A*.
export class NavGrid {
  constructor(cols, rows, cell, walk, height) {
    this.cols = cols; this.rows = rows; this.cell = cell;
    this.walk = walk;         // Uint8Array: 1 = walkable
    this.height = height;     // Float32Array: floor height of the cell
    const n = cols * rows;
    this.g = new Float32Array(n); this.f = new Float32Array(n);
    this.from = new Int32Array(n); this.mark = new Uint32Array(n); this.closed = new Uint32Array(n);
    this.run = 0;
    this.open = [];
    this.walkable = [];
    for (let i = 0; i < n; i++) if (walk[i]) this.walkable.push(i);
  }
  index(x, z) {
    const c = Math.floor(x / this.cell), r = Math.floor(z / this.cell);
    return (c < 0 || r < 0 || c >= this.cols || r >= this.rows) ? -1 : r * this.cols + c;
  }
  center(i, out) { out.x = (i % this.cols + 0.5) * this.cell; out.z = (Math.floor(i / this.cols) + 0.5) * this.cell; return out; }
  canStep(a, b) { return this.walk[b] === 1 && Math.abs(this.height[a] - this.height[b]) <= 0.5; }
  randomCell() { return this.walkable[Math.floor(Math.random() * this.walkable.length)]; }

  // Snap to a walkable cell (bots can end up overlapping a prop cell).
  nearest(i) {
    if (i >= 0 && this.walk[i]) return i;
    const c0 = i % this.cols, r0 = Math.floor(i / this.cols);
    let best = -1, bd = 1e9;
    for (let r = Math.max(0, r0 - 2); r <= Math.min(this.rows - 1, r0 + 2); r++)
      for (let c = Math.max(0, c0 - 2); c <= Math.min(this.cols - 1, c0 + 2); c++) {
        const j = r * this.cols + c, d = (c - c0) * (c - c0) + (r - r0) * (r - r0);
        if (this.walk[j] && d < bd) { bd = d; best = j; }
      }
    return best;
  }

  // A* from world (x0,z0) to (x1,z1). `jitter` > 0 randomises cell costs so bots vary their routes (flanking).
  // Returns an array of {x,z} waypoints (cell centres) or null.
  findPath(x0, z0, x1, z1, jitter = 0, seed = 0) {
    const start = this.nearest(this.index(x0, z0)), goal = this.nearest(this.index(x1, z1));
    if (start < 0 || goal < 0) return null;
    const cols = this.cols, run = ++this.run, open = this.open;
    const gc = goal % cols, gr = Math.floor(goal / cols);
    const h = i => { const dc = Math.abs(i % cols - gc), dr = Math.abs(Math.floor(i / cols) - gr); return Math.max(dc, dr) + 0.414 * Math.min(dc, dr); };
    open.length = 0;
    this.g[start] = 0; this.f[start] = h(start); this.from[start] = -1; this.mark[start] = run;
    open.push(start);
    while (open.length) {
      // small grids: a linear scan for the best node is cheaper than maintaining a heap
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (this.f[open[k]] < this.f[open[bi]]) bi = k;
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) break;
      if (this.closed[cur] === run) continue;
      this.closed[cur] = run;
      const c = cur % cols, r = Math.floor(cur / cols);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
        const nb = nr * cols + nc;
        if (!this.canStep(cur, nb) || this.closed[nb] === run) continue;
        if (dr && dc && !(this.canStep(cur, r * cols + nc) && this.canStep(cur, nr * cols + c))) continue;   // no corner cutting
        let cost = dr && dc ? 1.414 : 1;
        if (jitter) cost *= 1 + jitter * (((Math.imul(nb + 1, 2654435761) ^ Math.imul(seed + 7, 40503)) >>> 8 & 255) / 255);
        const g = this.g[cur] + cost;
        if (this.mark[nb] === run && g >= this.g[nb]) continue;
        this.mark[nb] = run; this.g[nb] = g; this.f[nb] = g + h(nb); this.from[nb] = cur;
        open.push(nb);
      }
    }
    if (this.mark[goal] !== run) return null;
    const path = [];
    for (let i = goal; i !== start && i >= 0; i = this.from[i]) path.push(this.center(i, {}));
    return path.reverse();
  }
}
