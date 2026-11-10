/**
 * ipax-backdrop / 0100-util-color.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 0 - UTILITIES: colour math. Pure functions, no DOM, no state.
 *
 * Service 'ipax-backdrop:color':
 *   clamp01(x), smooth(m)            helpers
 *   LUT                              Float32Array(256): sRGB 8-bit -> linear light
 *   toSrgb255(l)                     linear light -> sRGB 0..255 (float, not rounded)
 *   luminance(r, g, b)               WCAG relative luminance from linear RGB
 *   linToOklab(r, g, b, out)         linear RGB -> OKLab, written into out[0..2]
 *   oklabToLin(L, a, b, out)         OKLab -> linear RGB, CLIPPED to the sRGB gamut
 *   parseCssColor(str)               'rgb()/rgba()/transparent' -> [r, g, b, a] | null
 *
 * Gamut note: oklabToLin clips channels to [0, 1]. When the adjusted lightness
 * leaves the sRGB gamut for a saturated colour, hue shifts slightly. A chroma
 * reduction strategy is a possible future improvement.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
	const smooth = (m) => m * m * (3 - 2 * m);

	const LUT = new Float32Array(256);
	for (let i = 0; i < 256; i++) {
		const c = i / 255;
		LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	}

	const toSrgb255 = (l) => {
		l = clamp01(l);
		return 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
	};

	const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

	function linToOklab(r, g, b, out) {
		const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
		const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
		const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
		out[0] = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
		out[1] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
		out[2] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
	}

	function oklabToLin(L, a, b, out) {
		let l = L + 0.3963377774 * a + 0.2158037573 * b; l = l * l * l;
		let m = L - 0.1055613458 * a - 0.0638541728 * b; m = m * m * m;
		let s = L - 0.0894841775 * a - 1.2914855480 * b; s = s * s * s;
		out[0] = clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
		out[1] = clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
		out[2] = clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
	}

	function parseCssColor(str) {
		if (!str) return null;
		if (str === 'transparent') return [0, 0, 0, 0];
		const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+)(%?))?\s*\)/.exec(str);
		if (!m) return null;
		let a = m[4] === undefined ? 1 : +m[4];
		if (m[5]) a /= 100;
		return [+m[1], +m[2], +m[3], a];
	}

	window.j0.register('ipax-backdrop:color', { clamp01, smooth, LUT, toSrgb255, luminance, linToOklab, oklabToLin, parseCssColor });
})();
