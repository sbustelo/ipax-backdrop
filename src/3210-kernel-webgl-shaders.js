/**
 * ipax-backdrop / 3210-kernel-webgl-shaders.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL, WebGL backend: shader sources. No logic, only text.
 *
 * GLSL ES 1.00 (WebGL 1) on purpose: the kernel needs no WebGL 2 feature and
 * WebGL 1 is available everywhere. The fragment shader is a line-by-line port
 * of 3100-kernel-cpu.js; keep both in sync. Loops have constant bounds, and
 * uniform arrays are only indexed by loop counters, as GLSL ES 1.00 requires.
 *
 * Per-colour parameters (luminance, direction, veil alpha and level) are
 * computed on the CPU by 0110-util-contrast.js and passed as uniforms, so the
 * contrast maths has a single source of truth.
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

uniform sampler2D uEst;     // estimated backdrop (RGBA8, row 0 = top)
uniform sampler2D uEstBlur; // blurred estimated backdrop (RGBA8)
uniform float uHasBlur;     // 1.0 if uEstBlur is bound and active
uniform sampler2D uGrid;    // unknown cells (LUMINANCE, 1.0 = unknown)
uniform vec2  uSize;        // working size in px
uniform vec2  uDim;         // element size in CSS px
uniform float uScale;       // working px per CSS px
uniform vec4  uFeather;     // CSS px: top, right, bottom, left
uniform vec3  uGridInfo;    // nx, ny, cell size (CSS px)
uniform float uHasEst;      // 0.0 when the estimate could not be uploaded
uniform float uTri;         // 1.0 = tricontrast
uniform float uRatioS;      // ratio the solver aims for (with safety margin)
uniform vec2  uBand;        // tricontrast band: lo, hi (luminance)
uniform vec2  uTriVeil;     // tricontrast veil: alpha, level 0..1
uniform int   uRunCount;
uniform vec4  uRun[MAXRUNS];  // x0, y0, x1, y1 in CSS px relative to the element
uniform float uYT[MAXC];      // text luminance; index 0 = base colour, 1.. = runs
uniform float uPk[MAXC];      // 1.0 = lighten the backdrop, 0.0 = darken it
uniform float uAl[MAXC];      // veil alpha
uniform float uVc[MAXC];      // veil level 0..1

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

void colorOf(int idx, out float yT, out float pk, out float al, out float vc) {
  yT = uYT[0]; pk = uPk[0]; al = uAl[0]; vc = uVc[0];
  for (int k = 1; k < MAXC; k++) {
    if (k == idx) { yT = uYT[k]; pk = uPk[k]; al = uAl[k]; vc = uVc[k]; }
  }
}

float gridAt(float i, float j) {
  float nx = uGridInfo.x; float ny = uGridInfo.y;
  float ci = clamp(i, 0.0, nx - 1.0); float cj = clamp(j, 0.0, ny - 1.0);
  return texture2D(uGrid, vec2((ci + 0.5) / nx, (cj + 0.5) / ny)).r;
}

float veilFrac(float rx, float ry) {
  float g = uGridInfo.z;
  float fx = rx / g - 0.5; float fy = ry / g - 0.5;
  float ci = floor(fx); float cj = floor(fy);
  float tx = fx - ci; float ty = fy - cj;
  return (gridAt(ci, cj) * (1.0 - tx) + gridAt(ci + 1.0, cj) * tx) * (1.0 - ty)
       + (gridAt(ci, cj + 1.0) * (1.0 - tx) + gridAt(ci + 1.0, cj + 1.0) * tx) * ty;
}

float defL(float L0, float A, float B, vec3 lin0, float yT, float pk) {
  if (cr(yT, lum(lin0)) >= uRatioS) return L0;
  if (cr(yT, lum(okToLin(pk, A, B))) < uRatioS) return pk;
  float lo = L0; float hi = pk;
  for (int n = 0; n < 9; n++) {
    float mid = (lo + hi) * 0.5;
    if (cr(yT, lum(okToLin(mid, A, B))) >= uRatioS) hi = mid; else lo = mid;
  }
  return hi;
}

float triL(float L0, float A, float B, float Y0) {
  if (Y0 >= uBand.x && Y0 <= uBand.y) return L0;
  bool up = Y0 < uBand.x;
  float target = up ? uBand.x : uBand.y;
  float lo = up ? L0 : 0.0; float hi = up ? 1.0 : L0;
  for (int n = 0; n < 13; n++) {
    float mid = (lo + hi) * 0.5;
    if (lum(okToLin(mid, A, B)) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) * 0.5;
}

void main() {
  // Pixel centre in working px, y measured from the top like the CPU path.
  vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  float rx = px.x / uScale;
  float ry = px.y / uScale;

  float M = 1.0;
  float mT = uFeather.x > 0.0 ? clamp(ry / uFeather.x, 0.0, 1.0) : 1.0;
  float mR = uFeather.y > 0.0 ? clamp((uDim.x - rx) / uFeather.y, 0.0, 1.0) : 1.0;
  float mB = uFeather.z > 0.0 ? clamp((uDim.y - ry) / uFeather.z, 0.0, 1.0) : 1.0;
  float mL = uFeather.w > 0.0 ? clamp(rx / uFeather.w, 0.0, 1.0) : 1.0;
  M = sm(min(min(mT, mR), min(mB, mL)));

  float known = 0.0;
  if (uHasEst > 0.5) known = 1.0 - veilFrac(rx, ry);






  float wk = 0.0;
  int kk = -1;
  if (uTri < 0.5) {
    for (int k = 0; k < MAXRUNS; k++) {
      if (k >= uRunCount) break;
      vec4 r = uRun[k];
      float dx = max(max(r.x - rx, 0.0), rx - r.z);
      float dy = max(max(r.y - ry, 0.0), ry - r.w);
      float wg = sm(clamp(1.0 - sqrt(dx * dx + dy * dy) / 6.0, 0.0, 1.0));
      if (wg > wk) { wk = wg; kk = k; }
    }
  }

  vec3 img = vec3(0.0);
  if (known > 0.0) {
    vec2 uv = vec2(px.x / uSize.x, px.y / uSize.y);
    vec4 e = texture2D(uEst, uv);
    vec3 lin0 = vec3(toLin(e.r), toLin(e.g), toLin(e.b));
    
    if (uHasBlur > 0.5) {
      vec4 eb = texture2D(uEstBlur, uv);
      vec3 blin = vec3(toLin(eb.r), toLin(eb.g), toLin(eb.b));
      lin0 = lin0 + M * (blin - lin0);
    }
    
    if (uRatioS <= 1.05) {
      img = vec3(toSrgb(lin0.r), toSrgb(lin0.g), toSrgb(lin0.b));
    } else {
      vec3 ok = linToOk(lin0);
      float Lt;
      if (uTri > 0.5) Lt = triL(ok.x, ok.y, ok.z, lum(lin0));
      else {
        float yT; float pk; float al; float vc;
        colorOf(0, yT, pk, al, vc);
        Lt = defL(ok.x, ok.y, ok.z, lin0, yT, pk);
        if (kk >= 0) {
          colorOf(kk + 1, yT, pk, al, vc);
          Lt = Lt + wk * (defL(ok.x, ok.y, ok.z, lin0, yT, pk) - Lt);
        }
      }
      vec3 o = okToLin(ok.x + M * (Lt - ok.x), ok.y, ok.z);
      img = vec3(toSrgb(o.r), toSrgb(o.g), toSrgb(o.b));
    }
  }

  float pAl; float pVc;
  if (uTri > 0.5) { pAl = uTriVeil.x; pVc = uTriVeil.y; }
  else { float yT2; float pk2; colorOf(wk > 0.5 ? kk + 1 : 0, yT2, pk2, pAl, pVc); }

  float wV = (1.0 - known) * pAl * M;
  float aO = known + wV;
  if (aO <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 col = (known * img + wV * vec3(pVc)) / aO;
  gl_FragColor = vec4(col * aO, aO); // premultiplied alpha
}
`;
/* glsl-minifier-end */

	function fragment(maxRuns) {
		return FRAGMENT.replace('__MAXRUNS__', String(maxRuns)).replace('__MAXC__', String(maxRuns + 1));
	}

	window.j0.register('ipax-backdrop:webgl-shaders', { vertex, fragment });
})();
