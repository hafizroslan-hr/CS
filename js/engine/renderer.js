import { WORLD_VS, WORLD_FS, SKY_VS, SKY_FS, DYN_VS, DYN_FS } from './shaders.js';
import { Batch } from './batch.js';
import { perspective } from './math.js';
import { generateTextures, TEX_SIZE } from './textures.js';
import { VERT_SIZE } from './mesh.js';

const QUALITY = {
  low:    { dpr: 1.0, shadows: false },
  medium: { dpr: 1.5, shadows: true },
  high:   { dpr: 2.0, shadows: true }
};

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export class Renderer {
  constructor(canvas, quality) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: quality === 'high', alpha: false, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false
    });
    if (!gl) throw new Error('WEBGL2_UNAVAILABLE');
    this.gl = gl;
    this.quality = QUALITY[quality] || QUALITY.medium;
    this.scale = 1;             // adaptive resolution multiplier
    this.world = null;
    this.theme = null;

    this.worldProg = program(gl, WORLD_VS, WORLD_FS);
    this.skyProg = program(gl, SKY_VS, SKY_FS);
    this.skyVao = gl.createVertexArray();
    this.dynProg = program(gl, DYN_VS, DYN_FS);
    this.solid = new Batch(gl, 9000);   // characters, grenades (world space, lit)
    this.fx = new Batch(gl, 1200);      // particles, tracers (world space, alpha blended)
    this.vm = new Batch(gl, 400);       // first-person weapon (view space)
    this.vmProj = new Float32Array(16);
    this.vmLight = 1;                   // how much sun reaches the player (0..1)

    // texture array with all procedural surface textures
    const layers = generateTextures();
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(TEX_SIZE) + 1, gl.RGBA8, TEX_SIZE, TEX_SIZE, layers.length);
    layers.forEach((cv, i) => {
      const data = cv.getContext('2d').getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, TEX_SIZE, TEX_SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array(data.buffer));
    });
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));

    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LEQUAL);
    this.resize();
  }

  setQuality(name) { this.quality = QUALITY[name] || QUALITY.medium; this.scale = 1; this.resize(); }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dpr) * this.scale;
    const w = Math.max(2, Math.round(c.clientWidth * dpr)), h = Math.max(2, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  // Upload a loaded map (see maps/map-loader.js). Frees the previous one.
  loadWorld(map) {
    const gl = this.gl;
    if (this.world) {
      gl.deleteVertexArray(this.world.vao); gl.deleteBuffer(this.world.vbo); gl.deleteBuffer(this.world.ibo);
      gl.deleteTexture(this.world.shadowTex);
    }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, map.mesh.vertices, gl.STATIC_DRAW);
    const stride = VERT_SIZE * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 32);
    const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, map.mesh.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    const sh = map.shadow;
    const shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, sh.w, sh.h, 0, gl.RED, gl.FLOAT, sh.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.world = { vao, vbo, ibo, shadowTex, count: map.mesh.indices.length,
      shadowP: [1 / map.width, 1 / map.depth, 1 / sh.tpm] };
    this.theme = map.theme;
  }

  render(cam) {
    const gl = this.gl, c = this.canvas, th = this.theme;
    this.resize();
    gl.viewport(0, 0, c.width, c.height);
    if (!this.world) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    cam.update(c.width / c.height);

    // sky
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    let pr = this.skyProg; gl.useProgram(pr.p);
    gl.uniform3fv(pr.u.uRight, cam.right); gl.uniform3fv(pr.u.uUp, cam.up); gl.uniform3fv(pr.u.uFwd, cam.fwd);
    const ty = Math.tan(cam.fovY / 2);
    gl.uniform2f(pr.u.uTan, ty * cam.aspect, ty);
    gl.uniform3fv(pr.u.uSunDir, th.sunDir); gl.uniform3fv(pr.u.uZenith, th.zenith);
    gl.uniform3fv(pr.u.uHorizon, th.horizon); gl.uniform3fv(pr.u.uSunCol, th.sunColor);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // world
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    pr = this.worldProg; gl.useProgram(pr.p);
    gl.uniformMatrix4fv(pr.u.uVP, false, cam.viewProj);
    gl.uniform3fv(pr.u.uSunDir, th.sunDir); gl.uniform3fv(pr.u.uSunCol, th.sunColor);
    gl.uniform3fv(pr.u.uAmb, th.ambient); gl.uniform3fv(pr.u.uFogCol, th.horizon);
    gl.uniform3fv(pr.u.uCam, cam.pos); gl.uniform1f(pr.u.uFogD, th.fogDensity);
    const sp = this.world.shadowP;
    gl.uniform4f(pr.u.uShadowP, sp[0], sp[1], sp[2], this.quality.shadows ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex); gl.uniform1i(pr.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.world.shadowTex); gl.uniform1i(pr.u.uShadow, 1);
    gl.bindVertexArray(this.world.vao);
    gl.drawElements(gl.TRIANGLES, this.world.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);

    // dynamic geometry
    pr = this.dynProg; gl.useProgram(pr.p);
    gl.uniformMatrix4fv(pr.u.uVP, false, cam.viewProj);
    gl.uniform3fv(pr.u.uSunDir, th.sunDir); gl.uniform3fv(pr.u.uSunCol, th.sunColor);
    gl.uniform3fv(pr.u.uAmb, th.ambient); gl.uniform3fv(pr.u.uFogCol, th.horizon);
    gl.uniform3fv(pr.u.uCam, cam.pos); gl.uniform1f(pr.u.uFogD, th.fogDensity);
    gl.uniform1f(pr.u.uSunScale, 1);
    gl.uniform4f(pr.u.uShadowP, sp[0], sp[1], sp[2], 1);
    gl.uniform1i(pr.u.uShadow, 1);
    this.solid.draw();
    if (this.fx.n) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false); gl.disable(gl.CULL_FACE);
      this.fx.draw();
      gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
    }
    if (this.vm.n) {
      // weapon view model: own projection, drawn over the world in view space
      gl.clear(gl.DEPTH_BUFFER_BIT);
      perspective(this.vmProj, 1.15, cam.aspect, 0.02, 10);
      gl.uniformMatrix4fv(pr.u.uVP, false, this.vmProj);
      gl.uniform3f(pr.u.uSunDir, 0.35, 0.8, 0.48); gl.uniform3f(pr.u.uCam, 0, 0, 0);
      gl.uniform1f(pr.u.uFogD, 0); gl.uniform1f(pr.u.uSunScale, this.vmLight);
      gl.uniform4f(pr.u.uShadowP, 0, 0, 0, 0);
      this.vm.draw();
    }
    this.solid.reset(); this.fx.reset(); this.vm.reset();
  }
}
