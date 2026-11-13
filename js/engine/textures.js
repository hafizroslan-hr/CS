// Procedural texture generation (no image assets to download).
// Every texture is a SIZE x SIZE canvas; the renderer packs them into one texture array.
export const TEX_SIZE = 128;
export const LAYERS = ['sand', 'sandstone', 'paving', 'concrete', 'stone', 'crate', 'plaster', 'siteA', 'siteB'];
export const LAYER = Object.fromEntries(LAYERS.map((n, i) => [n, i]));

function hash(x, y, seed) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
// Tileable value noise: `period` lattice cells across the texture.
function vnoise(x, y, period, seed) {
  const S = TEX_SIZE, fx = x / S * period, fy = y / S * period;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const x1 = (ix + 1) % period, y1 = (iy + 1) % period;
  const a = hash(ix, iy, seed), b = hash(x1, iy, seed), c = hash(ix, y1, seed), d = hash(x1, y1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function pixels(fn) {
  const S = TEX_SIZE, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const rgb = fn(x, y), o = (y * S + x) * 4;
    d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
const scale = (rgb, k) => [rgb[0] * k, rgb[1] * k, rgb[2] * k];

const GEN = {
  sand: () => pixels((x, y) => {
    const n = 0.55 * vnoise(x, y, 4, 1) + 0.3 * vnoise(x, y, 16, 2) + 0.15 * hash(x, y, 3);
    return mix([178, 142, 90], [224, 192, 134], n);
  }),
  sandstone: () => pixels((x, y) => {
    const row = y >> 5, bx = (x + (row & 1) * 32) & 63;
    const n = 0.5 * vnoise(x, y, 4, 5) + 0.3 * vnoise(x, y, 32, 6) + 0.2 * hash(x, y, 7);
    const tint = 0.9 + 0.14 * hash((x + (row & 1) * 32) >> 6, row, 8);
    let c = scale(mix([164, 128, 84], [206, 172, 120], n), tint);
    if ((y & 31) < 2 || bx < 2) c = scale(c, 0.68);
    return c;
  }),
  paving: () => pixels((x, y) => {
    const n = 0.5 * vnoise(x, y, 8, 11) + 0.25 * vnoise(x, y, 32, 12) + 0.25 * hash(x, y, 13);
    const tint = 0.9 + 0.16 * hash(x >> 6, y >> 6, 14);
    let c = scale(mix([124, 114, 98], [164, 154, 136], n), tint);
    if ((x & 63) < 2 || (y & 63) < 2) c = scale(c, 0.6);
    return c;
  }),
  concrete: () => pixels((x, y) => {
    const n = 0.45 * vnoise(x, y, 4, 21) + 0.25 * vnoise(x, y, 16, 22) + 0.3 * hash(x, y, 23);
    let c = mix([92, 92, 90], [130, 129, 124], n);
    if ((x & 127) < 1 || (y & 127) < 1) c = scale(c, 0.7);
    return c;
  }),
  stone: () => pixels((x, y) => {
    const row = y >> 5, bx = (x + (row & 1) * 32) & 63;
    const n = 0.5 * vnoise(x, y, 8, 31) + 0.2 * vnoise(x, y, 32, 32) + 0.3 * hash(x, y, 33);
    const tint = 0.86 + 0.2 * hash((x + (row & 1) * 32) >> 6, row, 34);
    let c = scale(mix([132, 122, 104], [176, 166, 146], n), tint);
    if ((y & 31) < 2 || bx < 2) c = scale(c, 0.62);
    return c;
  }),
  crate: () => {
    const c = pixels((x, y) => {
      const plank = x >> 4;
      const n = 0.6 * vnoise(x * 4, y, 16, 41 + plank) + 0.4 * hash(x, y >> 2, 43);
      let col = scale(mix([112, 78, 40], [160, 118, 66], n), 0.9 + 0.16 * hash(plank, 0, 44));
      if ((x & 15) < 1) col = scale(col, 0.6);
      return col;
    });
    const ctx = c.getContext('2d'), S = TEX_SIZE;
    ctx.strokeStyle = 'rgba(70,46,22,.95)'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, S - 12, S - 12);
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(12, S - 12); ctx.lineTo(S - 12, 12); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,150,96,.35)'; ctx.lineWidth = 1; ctx.strokeRect(12.5, 12.5, S - 25, S - 25);
    return c;
  },
  plaster: () => pixels((x, y) => {
    const n = 0.5 * vnoise(x, y, 4, 51) + 0.2 * vnoise(x, y, 16, 52) + 0.3 * hash(x, y, 53);
    return mix([96, 88, 74], [124, 116, 100], n);
  }),
  siteA: () => siteDecal('A'),
  siteB: () => siteDecal('B')
};

function siteDecal(letter) {
  // transparent background: the world shader discards texels with alpha < 0.5
  const S = TEX_SIZE, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgb(196,62,40)'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 10, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgb(196,62,40)';
  ctx.font = 'bold 76px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(letter, S / 2, S / 2 + 5);
  return c;
}

export function generateTextures() {
  return LAYERS.map(name => GEN[name]());
}
