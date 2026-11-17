/**
 * ipax-backdrop / 3210-kernel-webgl-shaders.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL, WebGL backend: shader sources (GLSL ES 1.00).
 * Line-by-line port of 3100-kernel-cpu.js.
 *
 * Service 'ipax-backdrop:webgl-shaders': {vertex, fragment(maxRuns)}
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const vertex = [
		'attribute vec2 aPos;',
		'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }'
	].join('\n');

/* glsl-minifier-start */
const FRAGMENT = `
precision highp float;
#define MAXRUNS __MAXRUNS__
#define MAXC __MAXC__

uniform sampler2D uEst;
uniform sampler2D uEstBlur;
uniform float uHasBlur;
uniform vec2  uBlurRatios;  // x = boxBlur / maxBlur, y = textBlur / maxBlur
uniform sampler2D uGrid;
uniform sampler2D uHalo;
uniform vec2  uSize;
uniform vec2  uTexSize;
uniform vec2  uGridTex;
uniform vec2  uHaloTex;
uniform vec3  uHaloInfo;
uniform float uHaloOn;
uniform float uHaloShared;
uniform vec2  uBox;
uniform vec2  uDim;
uniform float uScale;
uniform vec4  uFeather;
uniform vec3  uGridInfo;
uniform float uHasEst;
uniform float uTri;
uniform float uTriH;
uniform float uRatioS;
uniform float uRatioSH;
uniform float uBypass;
uniform float uBypassH;
uniform float uBoxCover;
uniform vec2  uBand;
uniform vec2  uBandH;
uniform vec2  uTriVeil;
uniform vec2  uTriVeilH;
uniform float uInfl;
uniform int   uRunCount;
uniform vec4  uRun[MAXRUNS];
uniform vec4  uCol[MAXC];
uniform vec4  uColH[MAXC];

float sm(float m) { return m * m * (3.0 - 2.0 * m); }
float toLin(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float toSrgb(float l) { l = clamp(l, 0.0, 1.0); return l <= 0.0031308 ? 12.92 * l : 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float cr(float a, float b) { return (max(a, b) + 0.05) / (min(a, b) + 0.05); }
float cbrt(float x) { return x <= 0.0 ? 0.0 : pow(x, 1.0 / 3.0); }

vec3 linToOk(vec3 c) {
  float l = cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
  float m = cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
  float s = cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}

vec3 okToLin(float L, float a, float b) {
  float l = L + 0.3963377774 * a + 0.2158037573 * b; l = l * l * l;
  float m = L - 0.1055613458 * a - 0.0638541728 * b; m = m * m * m;
  float s = L - 0.0894841775 * a - 1.2914855480 * b; s = s * s * s;
  return clamp(vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0.0, 1.0);
}

vec4 colOf(int idx) {
  vec4 c = uCol[0];
  for (int k = 1; k < MAXC; k++) {
    if (k == idx) c = uCol[k];
  }
  return c;
}

vec4 colHOf(int idx) {
  vec4 c = uColH[0];
  for (int k = 1; k < MAXC; k++) {
    if (k == idx) c = uColH[k];
  }
  return c;
}

float gridAt(float i, float j) {
  float nx = uGridInfo.x; float ny = uGridInfo.y;
  float ci = clamp(i, 0.0, nx - 1.0); float cj = clamp(j, 0.0, ny - 1.0);
  return min(texture2D(uGrid, vec2((ci + 0.5) / uGridTex.x, (cj + 0.5) / uGridTex.y)).r * 255.0, 1.0);
}

float veilFrac(float rx, float ry) {
  float g = uGridInfo.z;
  float fx = rx / g - 0.5; float fy = ry / g - 0.5;
  float ci = floor(fx); float cj = floor(fy);
  float tx = fx - ci; float ty = fy - cj;
  return (gridAt(ci, cj) * (1.0 - tx) + gridAt(ci + 1.0, cj) * tx) * (1.0 - ty)
       + (gridAt(ci, cj + 1.0) * (1.0 - tx) + gridAt(ci + 1.0, cj + 1.0) * tx) * ty;
}

float haloAt(float rx, float ry) {
  vec2 t = clamp(vec2(rx, ry) / uHaloInfo.z, vec2(0.5), uHaloInfo.xy - vec2(0.5));
  return texture2D(uHalo, t / uHaloTex).r;
}

float defL(float L0, float A, float B, vec3 lin0, float yT, float pk, float rs) {
  if (cr(yT, lum(lin0)) >= rs) return L0;
  if (cr(yT, lum(okToLin(pk, A, B))) < rs) return pk;
  float lo = L0; float hi = pk;
  for (int n = 0; n < 9; n++) {
    float mid = (lo + hi) * 0.5;
    if (cr(yT, lum(okToLin(mid, A, B))) >= rs) hi = mid; else lo = mid;
  }
  return hi;
}

float triL(float L0, float A, float B, float Y0, vec2 bd) {
  if (Y0 >= bd.x && Y0 <= bd.y) return L0;
  bool up = Y0 < bd.x;
  float target = up ? bd.x : bd.y;
  float lo = up ? L0 : 0.0; float hi = up ? 1.0 : L0;
  for (int n = 0; n < 13; n++) {
    float mid = (lo + hi) * 0.5;
    if (lum(okToLin(mid, A, B)) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) * 0.5;
}

float solveBoxL(vec3 ok, vec3 lin0, int kk, float wk, float rs, vec2 bd, float isTri) {
  if (isTri > 0.5) return triL(ok.x, ok.y, ok.z, lum(lin0), bd);
  vec4 c = colOf(0);
  float Lt = defL(ok.x, ok.y, ok.z, lin0, c.x, c.y, rs);
  if (kk >= 0) {
    vec4 c2 = colOf(kk + 1);
    Lt = Lt + wk * (defL(ok.x, ok.y, ok.z, lin0, c2.x, c2.y, rs) - Lt);
  }
  return Lt;
}

float solveTextL(vec3 ok, vec3 lin0, int kk, float wk, float rs, vec2 bd, float isTri) {
  if (isTri > 0.5) return triL(ok.x, ok.y, ok.z, lum(lin0), bd);
  vec4 c = colHOf(0);
  float Lt = defL(ok.x, ok.y, ok.z, lin0, c.x, c.y, rs);
  if (kk >= 0) {
    vec4 c2 = colHOf(kk + 1);
    Lt = Lt + wk * (defL(ok.x, ok.y, ok.z, lin0, c2.x, c2.y, rs) - Lt);
  }
  return Lt;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  float rx = px.x / uScale;
  float ry = px.y / uScale;
  float bx = rx - uBox.x;
  float by = ry - uBox.y;
  float eps = 1.0 / uScale;
  bool inBox = bx > -eps && bx < uDim.x + eps && by > -eps && by < uDim.y + eps;
  bool covers = inBox && uBoxCover > 0.5;

  float Mb = 0.0;
  if (covers) {
    float uT = uFeather.x > 0.0 ? (uFeather.x - by) / uFeather.x : 0.0;
    float uR = uFeather.y > 0.0 ? (bx - (uDim.x - uFeather.y)) / uFeather.y : 0.0;
    float uB = uFeather.z > 0.0 ? (by - (uDim.y - uFeather.z)) / uFeather.z : 0.0;
    float uL = uFeather.w > 0.0 ? (uFeather.w - bx) / uFeather.w : 0.0;
    float ux = max(max(uL, uR), 0.0);
    float uy = max(max(uT, uB), 0.0);
    float r = (ux > 0.0 && uy > 0.0) ? sqrt(ux * ux + uy * uy) : max(ux, uy);
    Mb = sm(clamp(1.0 - r, 0.0, 1.0));
  }
  float Mh = 0.0;
  if (uHaloOn > 0.5) Mh = haloAt(rx, ry);

  if (!covers && Mh <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float cov = covers ? 1.0 : Mh;
  float mScreen = Mb + Mh - Mb * Mh;

  float known = 0.0;
  if (uHasEst > 0.5) known = 1.0 - veilFrac(rx, ry);

  float wk = 0.0;
  int kk = -1;
  if (uTri < 0.5 || uTriH < 0.5) {
    for (int k = 0; k < MAXRUNS; k++) {
      if (k >= uRunCount) break;
      vec4 r = uRun[k];
      float dx = max(max(r.x - rx, 0.0), rx - r.z);
      float dy = max(max(r.y - ry, 0.0), ry - r.w);
      float wg = sm(clamp(1.0 - sqrt(dx * dx + dy * dy) / uInfl, 0.0, 1.0));
      if (wg > wk) { wk = wg; kk = k; }
    }
  }

  vec3 img = vec3(0.0);
  if (known > 0.0) {
    vec2 uv = px / uTexSize;
    vec4 e = texture2D(uEst, uv);
    vec3 lin0 = vec3(toLin(e.r), toLin(e.g), toLin(e.b));

    if (uHasBlur > 0.5) {
      float mBlur = abs(uBlurRatios.x - uBlurRatios.y) < 0.0001
        ? mScreen
        : max(Mb * uBlurRatios.x, Mh * uBlurRatios.y);
      if (mBlur > 0.0) {
        vec4 eb = texture2D(uEstBlur, uv);
        vec3 blin = vec3(toLin(eb.r), toLin(eb.g), toLin(eb.b));
        lin0 = lin0 + mBlur * (blin - lin0);
      }
    }

    if (uBypass > 0.5 && uBypassH > 0.5) {
      img = vec3(toSrgb(lin0.r), toSrgb(lin0.g), toSrgb(lin0.b));
    } else {
      vec3 ok = linToOk(lin0);
      float L1 = ok.x;
      if (uBypass < 0.5 && mScreen > 0.0) {
        float LtB = solveBoxL(ok, lin0, kk, wk, uRatioS, uBand, uTri);
        L1 = clamp(ok.x + mScreen * (LtB - ok.x), 0.0, 1.0);
      }
      float L2 = L1;
      if (uBypassH < 0.5 && Mh > 0.0) {
        vec3 lin1 = okToLin(L1, ok.y, ok.z);
        float LtH = solveTextL(vec3(L1, ok.y, ok.z), lin1, kk, wk, uRatioSH, uBandH, uTriH);
        float hk = covers ? Mh : 1.0;
        L2 = clamp(L1 + hk * (LtH - L1), 0.0, 1.0);
      }
      vec3 o = okToLin(L2, ok.y, ok.z);
      img = vec3(toSrgb(o.r), toSrgb(o.g), toSrgb(o.b));
    }
  }

  int vi = wk > 0.5 ? kk + 1 : 0;
  float wB = 0.0;
  float vB = 0.0;
  if (uBypass < 0.5 && mScreen > 0.0) {
    if (uTri > 0.5) { wB = mScreen * uTriVeil.x; vB = uTriVeil.y; }
    else { vec4 cb = colOf(vi); wB = mScreen * cb.z; vB = cb.w; }
  }
  float wH = 0.0;
  float vH = 0.0;
  if (uBypassH < 0.5 && Mh > 0.0) {
    if (uTriH > 0.5) { wH = Mh * uTriVeilH.x; vH = uTriVeilH.y; }
    else { vec4 ch = colHOf(vi); wH = Mh * ch.z; vH = ch.w; }
  }
  float wm = wH > wB ? wH : wB;
  float vcv = wH > wB ? vH : vB;
  float wV = (1.0 - known) * wm;
  float kc = known * cov;
  float aO = kc + wV;
  if (aO <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 col = (kc * img + wV * vec3(vcv)) / aO;
  gl_FragColor = vec4(col * aO, aO);
}
`;
/* glsl-minifier-end */

	function fragment(maxRuns) {
		return FRAGMENT.replace('__MAXRUNS__', String(maxRuns)).replace('__MAXC__', String(maxRuns + 1));
	}

	window.j0.register('ipax-backdrop:webgl-shaders', { vertex, fragment });
})();