// Static collision world: axis-aligned boxes in a uniform XZ hash grid.
// boxes: Float32Array of [minX,minY,minZ,maxX,maxY,maxZ] * n
export class CollisionWorld {
  constructor(boxes, width, depth, cell = 4) {
    this.b = boxes;
    this.n = boxes.length / 6;
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil(width / cell));
    this.rows = Math.max(1, Math.ceil(depth / cell));
    this.grid = Array.from({ length: this.cols * this.rows }, () => []);
    this.stamp = new Uint32Array(this.n);
    this.tick = 0;
    for (let i = 0; i < this.n; i++) {
      const o = i * 6;
      const c0 = this._c(boxes[o]), c1 = this._c(boxes[o + 3]);
      const r0 = this._r(boxes[o + 2]), r1 = this._r(boxes[o + 5]);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.grid[r * this.cols + c].push(i);
    }
  }
  _c(x) { const c = Math.floor(x / this.cell); return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c; }
  _r(z) { const r = Math.floor(z / this.cell); return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r; }

  // Collect indices of boxes whose grid cells touch the XZ rectangle.
  query(x0, z0, x1, z1, out) {
    out.length = 0;
    const t = ++this.tick;
    const c0 = this._c(x0), c1 = this._c(x1), r0 = this._r(z0), r1 = this._r(z1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const list = this.grid[r * this.cols + c];
        for (let k = 0; k < list.length; k++) {
          const i = list[k];
          if (this.stamp[i] !== t) { this.stamp[i] = t; out.push(i); }
        }
      }
    }
    return out;
  }

  overlaps(x0, y0, z0, x1, y1, z1) {
    const B = this.b, list = this.query(x0, z0, x1, z1, this._tmp || (this._tmp = []));
    for (let k = 0; k < list.length; k++) {
      const o = list[k] * 6;
      if (x1 > B[o] && x0 < B[o + 3] && y1 > B[o + 1] && y0 < B[o + 4] && z1 > B[o + 2] && z0 < B[o + 5]) return true;
    }
    return false;
  }

  // Ray vs all boxes (slab test). Returns distance to first hit, or maxT if clear.
  // Used for line-of-sight and bullets from Phase 2 onward.
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    const B = this.b;
    let best = maxT;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    for (let i = 0; i < this.n; i++) {
      const o = i * 6;
      let t0 = (B[o] - ox) * ix, t1 = (B[o + 3] - ox) * ix;
      let tmin = Math.min(t0, t1), tmax = Math.max(t0, t1);
      t0 = (B[o + 1] - oy) * iy; t1 = (B[o + 4] - oy) * iy;
      tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
      t0 = (B[o + 2] - oz) * iz; t1 = (B[o + 5] - oz) * iz;
      tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
      if (tmax >= Math.max(tmin, 0) && tmin < best && tmin >= 0) best = tmin;
    }
    return best;
  }
}
