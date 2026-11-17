/**
 * ipax-backdrop / 0110-util-contrast.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 0 - UTILITIES: contrast model (WCAG 2.x only). Pure functions.
 *
 * This is the single place that knows how contrast is measured. Both kernels
 * (CPU and WebGL) receive their per-colour parameters from here, so they can
 * never disagree about the maths.
 *
 * Service 'ipax-backdrop:contrast':
  *   MAX_WCAG_RATIO                   15. Ceiling corresponding to perceptual black-level saturation (~106 Lc).
 *   ratio(yA, yB)                    WCAG contrast ratio of two relative luminances.
 *   lcToWcagFallback(lc)             Perceptual power-law mapping from |Lc| (0..106) to WCAG ratio (1..15).
 *   parseContrast(raw, defaultRatio) CSS value -> {ok, ratio, system, warning} | {ok:false, reason}
 *   solveRatio(ratio)                ratio the solver aims for (with 8-bit rounding safety margin)
 *   isBypass(ratio)                  true when ratio <= 1
 *   prepareColor(rgb255, solveR)     per text colour: {yT, pkL, pkR, al, vc}
 *   band(ratio)                      tricontrast luminance band {lo, hi, ok}
 *   bandVeil(band)                   translucent grey veil that lands in the band {al, vc}
 *
 * SAFETY: the output is rounded to 8 bits per channel. Solving exactly at the
 * threshold would leave up to ~0.6% of pixels slightly below it after
 * rounding. A 1.2% margin (default mode) and a small guard on the band
 * (tricontrast mode) absorb that. Both were measured, see docs.
 *
 * Direction ("pk"): for a given text colour the best background is the
 * extreme (black or white) that contrasts more. pkL = 1 means "lighten the
 * background", pkL = 0 means "darken it".
 */

(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const MAX_WCAG_RATIO = 15;
	const SAFETY = 1.012;

	const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
	const solveRatio = (r) => r * SAFETY;
	const isBypass = (r) => r <= 1;

	function lcToWcagFallback(lc) {
		const u = Math.min(1, Math.max(0, Math.abs(lc) / 106));
		const yEq = 0.02 + 0.98 * Math.pow(1 - u, 1.5);
		return 1.05 / (yEq + 0.05);
	}

	function parseContrast(raw, defaultRatio = 4.5) {
		const s = (raw || '').trim();
		if (s === '') return { ok: true, ratio: defaultRatio, system: 'wcag', warning: null };

		const mWcag = /^([+-]?(?:\d+\.?\d*|\.\d+)):1$/i.exec(s);
		if (mWcag) {
			const v = parseFloat(mWcag[1]);
			if (!(v >= 1)) return { ok: false, reason: 'WCAG contrast must be >= 1:1 (got "' + s + '").' };
			return {
				ok: true,
				ratio: Math.min(MAX_WCAG_RATIO, v),
				system: 'wcag',
				warning: v > MAX_WCAG_RATIO ? 'WCAG contrast ' + s + ' clamped to ' + MAX_WCAG_RATIO + ':1.' : null
			};
		}

		const mApca = /^([+-]?(?:\d+\.?\d*|\.\d+))lc$/i.exec(s);
		if (mApca) {
			const lc = parseFloat(mApca[1]);
			if (!isFinite(lc)) return { ok: false, reason: 'Invalid APCA Lc contrast value "' + s + '".' };
			const eq = lcToWcagFallback(lc);
			return {
				ok: true,
				ratio: eq,
				system: 'apca',
				warning: 'APCA contrast (' + s + ') is not enabled yet due to licensing; applying WCAG ' + eq.toFixed(2) + ':1 fallback.'
			};
		}

		if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)) {
			const v = parseFloat(s);
			if (!(v >= 1)) return { ok: false, reason: 'Invalid contrast value "' + s + '" (must be >= 1).' };
			if (v > MAX_WCAG_RATIO) {
				const eq = lcToWcagFallback(v);
				return {
					ok: true,
					ratio: eq,
					system: 'apca',
					warning: 'Contrast ' + s + ' (> 15) inferred as APCA Lc; applying WCAG ' + eq.toFixed(2) + ':1 fallback.'
				};
			}
			return { ok: true, ratio: v, system: 'wcag', warning: null };
		}

		return { ok: false, reason: 'Invalid contrast value "' + s + '".' };
	}

	function prepareColor(rgb, solveR) {
		const C = svc('color'), LUT = C.LUT;
		const yT = C.luminance(LUT[rgb[0] | 0], LUT[rgb[1] | 0], LUT[rgb[2] | 0]);
		const rW = 1.05 / (yT + 0.05), rB = (yT + 0.05) / 0.05, pkL = rW >= rB ? 1 : 0;
		const Yq = pkL ? solveR * (yT + 0.05) - 0.05 : (yT + 0.05) / solveR - 0.05;
		let al;
		if (pkL === 0) { if (Yq <= 0) al = 1; else if (Yq >= 1) al = 0; else al = 1 - C.toSrgb255(Yq) / 255; }
		else if (Yq > 1) al = 1; else if (Yq <= 0) al = 0; else al = C.toSrgb255(Yq) / 255;
		return { yT, pkL, pkR: Math.max(rW, rB), al: Math.min(1, al + 0.004), vc: pkL ? 255 : 0 };
	}

	function band(r) {
		const G = r < 4.4 ? 0.003 : 0.002;
		let lo = Math.max(0, 0.05 * r - 0.05) + G, hi = Math.min(1, 1.05 / r - 0.05) - G;
		const ok = lo <= hi;
		if (!ok) lo = hi = (lo + hi) / 2;
		return { lo, hi, ok };
	}

	function bandVeil(b) {
		const C = svc('color');
		const vlo = C.toSrgb255(b.lo) / 255, vhi = C.toSrgb255(b.hi) / 255, w = vhi - vlo;
		if (!b.ok || w <= 0) return { al: 1, vc: Math.round(vlo * 255) };
		const al = C.clamp01(1 - w);
		return { al: Math.min(1, al + 0.004), vc: C.clamp01(vlo / al) * 255 };
	}

	window.j0.register('ipax-backdrop:contrast', {
		MAX_WCAG_RATIO, ratio, lcToWcagFallback, parseContrast, solveRatio, isBypass, prepareColor, band, bandVeil
	});
})();