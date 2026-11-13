// Static geometry builder. Vertex layout (10 floats):
// position(3) normal(3) uv(2) textureLayer(1) shade(1)
export const VERT_SIZE = 10;
const UV_SCALE = 0.5;                       // one texture tile per 2 metres
const sideShade = y => 0.74 + 0.26 * Math.min(y / 3, 1);  // cheap ambient-occlusion gradient

export class MeshBuilder {
  constructor() { this.v = []; this.i = []; this.count = 0; }

  // Emit one face of the axis-aligned box [x0..x1, y0..y1, z0..z1].
  // dir: 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'. fit=true stretches the texture once over the face.
  face(dir, x0, y0, z0, x1, y1, z1, layer, fit = false) {
    let a, b, c, d, n;
    switch (dir) {
      case 'py': a = [x0, y1, z1]; b = [x1, y1, z1]; c = [x1, y1, z0]; d = [x0, y1, z0]; n = [0, 1, 0]; break;
      case 'ny': a = [x0, y0, z0]; b = [x1, y0, z0]; c = [x1, y0, z1]; d = [x0, y0, z1]; n = [0, -1, 0]; break;
      case 'px': a = [x1, y0, z1]; b = [x1, y0, z0]; c = [x1, y1, z0]; d = [x1, y1, z1]; n = [1, 0, 0]; break;
      case 'nx': a = [x0, y0, z0]; b = [x0, y0, z1]; c = [x0, y1, z1]; d = [x0, y1, z0]; n = [-1, 0, 0]; break;
      case 'pz': a = [x0, y0, z1]; b = [x1, y0, z1]; c = [x1, y1, z1]; d = [x0, y1, z1]; n = [0, 0, 1]; break;
      default:   a = [x1, y0, z0]; b = [x0, y0, z0]; c = [x0, y1, z0]; d = [x1, y1, z0]; n = [0, 0, -1];
    }
    const horizontal = dir === 'py' || dir === 'ny';
    const fitUV = [[0, 1], [1, 1], [1, 0], [0, 0]];
    const pts = [a, b, c, d];
    for (let k = 0; k < 4; k++) {
      const p = pts[k];
      let u, v;
      if (fit) { u = fitUV[k][0]; v = fitUV[k][1]; }
      else if (horizontal) { u = p[0] * UV_SCALE; v = p[2] * UV_SCALE; }
      else if (dir === 'px' || dir === 'nx') { u = p[2] * UV_SCALE; v = -p[1] * UV_SCALE; }
      else { u = p[0] * UV_SCALE; v = -p[1] * UV_SCALE; }
      const shade = horizontal ? (dir === 'ny' ? 0.8 : 1) : sideShade(p[1]);
      this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], u, v, layer, shade);
    }
    const s = this.count;
    this.i.push(s, s + 1, s + 2, s, s + 2, s + 3);
    this.count += 4;
  }

  box(x0, y0, z0, x1, y1, z1, sideLayer, topLayer, fit = false) {
    this.face('px', x0, y0, z0, x1, y1, z1, sideLayer, fit);
    this.face('nx', x0, y0, z0, x1, y1, z1, sideLayer, fit);
    this.face('pz', x0, y0, z0, x1, y1, z1, sideLayer, fit);
    this.face('nz', x0, y0, z0, x1, y1, z1, sideLayer, fit);
    this.face('py', x0, y0, z0, x1, y1, z1, topLayer, fit);
    if (y0 > 0.01) this.face('ny', x0, y0, z0, x1, y1, z1, sideLayer, fit);
  }

  build() {
    return { vertices: new Float32Array(this.v), indices: new Uint32Array(this.i) };
  }
}
