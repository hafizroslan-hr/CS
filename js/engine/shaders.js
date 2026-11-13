export const WORLD_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in vec2 aLayerShade;
uniform mat4 uVP;
out vec3 vPos; out vec3 vN; out vec2 vUV; out float vLayer; out float vShade;
void main(){
  vPos = aPos; vN = aNormal; vUV = aUV; vLayer = aLayerShade.x; vShade = aLayerShade.y;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

// Sun shadows use a baked "shadow height" map: for each XZ texel it stores the height
// below which a point is occluded from the sun. One texture fetch shadows every surface.
export const WORLD_FS = `#version 300 es
precision highp float;
precision mediump sampler2DArray;
uniform sampler2DArray uTex;
uniform highp sampler2D uShadow;
uniform vec3 uSunDir, uSunCol, uAmb, uFogCol, uCam;
uniform vec4 uShadowP;   // xy: 1/world size, z: texel size (m), w: enabled
uniform float uFogD;
in vec3 vPos; in vec3 vN; in vec2 vUV; in float vLayer; in float vShade;
out vec4 frag;
void main(){
  vec4 tex = texture(uTex, vec3(vUV, floor(vLayer + 0.5)));
  if (tex.a < 0.5) discard;
  vec3 albedo = tex.rgb;
  vec3 n = normalize(vN);
  float ndl = max(dot(n, uSunDir), 0.0);
  float lit = 1.0;
  if (uShadowP.w > 0.5) {
    vec2 suv = (vPos.xz + n.xz * uShadowP.z) * uShadowP.xy;
    if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) {
      float hs = texture(uShadow, suv).r;
      lit = 1.0 - smoothstep(0.04, 0.32, hs - vPos.y);
    }
  }
  vec3 light = uAmb * (0.8 + 0.2 * n.y) + uSunCol * ndl * lit;
  vec3 col = albedo * light * vShade;
  float d = distance(vPos, uCam);
  float fog = 1.0 - exp(-d * uFogD);
  frag = vec4(mix(col, uFogCol, fog), 1.0);
}`;

export const SKY_VS = `#version 300 es
out vec2 vNdc;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  vNdc = p;
  gl_Position = vec4(p, 1.0, 1.0);
}`;

export const SKY_FS = `#version 300 es
precision highp float;
uniform vec3 uRight, uUp, uFwd, uSunDir, uZenith, uHorizon, uSunCol;
uniform vec2 uTan;
in vec2 vNdc;
out vec4 frag;
void main(){
  vec3 dir = normalize(uFwd + uRight * (vNdc.x * uTan.x) + uUp * (vNdc.y * uTan.y));
  float t = pow(clamp(dir.y, 0.0, 1.0), 0.45);
  vec3 col = mix(uHorizon, uZenith, t);
  if (dir.y < 0.0) col = mix(uHorizon, uHorizon * 0.7, clamp(-dir.y * 3.0, 0.0, 1.0));
  float s = max(dot(dir, uSunDir), 0.0);
  col += uSunCol * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.18);
  frag = vec4(col, 1.0);
}`;

// Dynamic geometry (characters, weapons, particles): per-vertex colour, no texture.
// A zero normal marks an unlit vertex (particles, muzzle flash).
export const DYN_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aColor;
uniform mat4 uVP;
out vec3 vPos; out vec3 vN; out vec4 vColor;
void main(){ vPos = aPos; vN = aNormal; vColor = aColor; gl_Position = uVP * vec4(aPos, 1.0); }`;

export const DYN_FS = `#version 300 es
precision highp float;
uniform highp sampler2D uShadow;
uniform vec3 uSunDir, uSunCol, uAmb, uFogCol, uCam;
uniform vec4 uShadowP;
uniform float uFogD, uSunScale;
in vec3 vPos; in vec3 vN; in vec4 vColor;
out vec4 frag;
void main(){
  if (dot(vN, vN) < 0.01) { frag = vColor; return; }
  vec3 n = normalize(vN);
  float lit = uSunScale;
  if (uShadowP.w > 0.5) {
    vec2 suv = vPos.xz * uShadowP.xy;
    if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0)
      lit *= 1.0 - smoothstep(0.04, 0.32, texture(uShadow, suv).r - vPos.y);
  }
  vec3 light = uAmb * (0.8 + 0.2 * n.y) + uSunCol * max(dot(n, uSunDir), 0.0) * lit;
  vec3 col = vColor.rgb * light;
  float fog = 1.0 - exp(-distance(vPos, uCam) * uFogD);
  frag = vec4(mix(col, uFogCol, fog), 1.0);
}`;
