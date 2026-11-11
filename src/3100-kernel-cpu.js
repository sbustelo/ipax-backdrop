/**
 * ipax-backdrop / 3100-kernel-cpu.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL, CPU backend. The reference implementation: the WebGL
 * backend (3200) must produce the same pixels.
 *
 * Per pixel (see 3000-kernel.js for the input/output contract):
 *   1. M      feather mask, 0 at the element edge, 1 `feather` px inside.
 *   2. C      "known" weight: 1 where the backdrop estimate is trustworthy,
 *             falling to 0 inside unknown cells (bilinear over the grid).
 *   3. Image  where C > 0, move the lightness (L of OKLab, a and b fixed) of
 *             the estimated pixel just far enough to reach the contrast:
 *               default      push toward the extreme that contrasts more with
 *                            the text colour (binary search for the first
 *                            crossing, so the change is minimal);
 *               tricontrast  clamp into the luminance band where white AND
 *                            black text both pass.
 *             The result is mixed with the original by M.
 *   4. Veil   where C < 1 a translucent flat colour whose alpha guarantees the
 *             ratio against the WORST possible backdrop (black or white).
 *   Output = known image * C + veil * (1 - C), alpha-weighted.
 *
 * Text runs with another colour (colors.runs) each ask for their own
 * correction; the strongest run weight at a pixel blends the two solutions.
 *
 * Service 'ipax-backdrop:kernel-cpu': available(), render(input)
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	function veilFrac(grid, rx, ry) {
		const V = grid.V, nx = grid.nx, ny = grid.ny, g = grid.g;
		const gv = (i, j) => V[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
		const fx = rx / g - 0.5, fy = ry / g - 0.5, ci = Math.floor(fx), cj = Math.floor(fy), tx = fx - ci, ty = fy - cj;
		return (gv(ci, cj) * (1 - tx) + gv(ci + 1, cj) * tx) * (1 - ty) + (gv(ci, cj + 1) * (1 - tx) + gv(ci + 1, cj + 1) * tx) * ty;
	}

	function render(input) {
		const C = svc('color'), K = svc('contrast');
		const LUT = C.LUT, clamp01 = C.clamp01, smooth = C.smooth, lum = C.luminance, toSrgb = C.toSrgb255, cr = K.ratio;
		const { est, estBlur, grid, w, h, s, W, H, params, colors } = input;

		let pix = null, blurPix = null, tainted = false;
		if (est) { 
			try { 
				pix = est.getContext('2d').getImageData(0, 0, w, h).data; 
				if (estBlur) blurPix = estBlur.getContext('2d').getImageData(0, 0, w, h).data;
			} catch (e) { tainted = true; } 
		}

		const out = new Uint8ClampedArray(w * h * 4);
		const tri = params.mode === 'tricontrast', ratio = params.ratio, rS = K.solveRatio(ratio);
		const fParam = params.feather;
		const f = (typeof fParam === 'object' && fParam !== null)
			? fParam
			: (typeof fParam === 'number' ? { top: fParam, right: fParam, bottom: fParam, left: fParam } : { top: 0, right: 0, bottom: 0, left: 0 });
		const fT = f.top > 0 ? f.top : 0, fR = f.right > 0 ? f.right : 0, fB = f.bottom > 0 ? f.bottom : 0, fL = f.left > 0 ? f.left : 0;
		const hasFeather = fT > 0 || fR > 0 || fB > 0 || fL > 0;

		const runs = colors.runs.slice(0, svc('limits').maxRuns);
		const pcs = [K.prepareColor(colors.base, rS)].concat(runs.map((r) => K.prepareColor(r.c, rS)));
		const band = K.band(ratio), tv = K.bandVeil(band);
		const ok = [0, 0, 0], lin = [0, 0, 0];

		/** Default mode: lightness that reaches rS against text colour `pc`, minimal change. */
		const defL = (L0, A, B, fr, fg, fb, pc) => {
			if (cr(pc.yT, lum(fr, fg, fb)) >= rS) return L0;
			C.oklabToLin(pc.pkL, A, B, lin);
			if (cr(pc.yT, lum(lin[0], lin[1], lin[2])) < rS) return pc.pkL; // unreachable: pin at the extreme
			let lo = L0, hi = pc.pkL;
			for (let n = 0; n < 9; n++) {
				const mid = (lo + hi) / 2;
				C.oklabToLin(mid, A, B, lin);
				if (cr(pc.yT, lum(lin[0], lin[1], lin[2])) >= rS) hi = mid; else lo = mid;
			}
			return hi;
		};

		/** Tricontrast: lightness of the nearest band edge, or L0 if already inside. */
		const triL = (L0, A, B, Y0) => {
			if (Y0 >= band.lo && Y0 <= band.hi) return L0;
			const up = Y0 < band.lo, target = up ? band.lo : band.hi;
			let lo = up ? L0 : 0, hi = up ? 1 : L0;
			for (let n = 0; n < 13; n++) {
				const mid = (lo + hi) / 2;
				C.oklabToLin(mid, A, B, lin);
				if (lum(lin[0], lin[1], lin[2]) < target) lo = mid; else hi = mid;
			}
			return (lo + hi) / 2;
		};

		let minV = Infinity, under = 0, nI = 0, nV = 0;
		for (let y = 0; y < h; y++) {
			const ry = (y + 0.5) / s;
			const mY = hasFeather ? Math.min(
				fT > 0 ? clamp01(ry / fT) : 1,
				fB > 0 ? clamp01((H - ry) / fB) : 1
			) : 1;

			for (let x = 0; x < w; x++) {
				const q = (y * w + x) * 4, rx = (x + 0.5) / s;
				const M = hasFeather ? smooth(Math.min(
					mY,
					fL > 0 ? clamp01(rx / fL) : 1,
					fR > 0 ? clamp01((W - rx) / fR) : 1
				)) : 1;
				const known = pix ? 1 - veilFrac(grid, rx, ry) : 0;

				let wk = 0, kk = -1;
				if (!tri) {
					for (let k = 0; k < runs.length; k++) {
						const r = runs[k];
						const d = Math.hypot(Math.max(r.x0 - rx, 0, rx - r.x1), Math.max(r.y0 - ry, 0, ry - r.y1));
						const wg = smooth(clamp01(1 - d / 6));
						if (wg > wk) { wk = wg; kk = k; }
					}
				}

				let ir = 0, ig = 0, ib = 0;
				if (known > 0) {
					let fr = LUT[pix[q]], fg = LUT[pix[q + 1]], fb = LUT[pix[q + 2]];
					
					if (blurPix) {
						const br = LUT[blurPix[q]], bg = LUT[blurPix[q + 1]], bb = LUT[blurPix[q + 2]];
						fr = fr + M * (br - fr);
						fg = fg + M * (bg - fg);
						fb = fb + M * (bb - fb);
					}
					
					if (K.isBypass(ratio)) {
						ir = toSrgb(fr); ig = toSrgb(fg); ib = toSrgb(fb);
					} else {
						C.linToOklab(fr, fg, fb, ok);
						const L0 = ok[0], A = ok[1], B = ok[2];
						let Lt;
						if (tri) Lt = triL(L0, A, B, lum(fr, fg, fb));
						else {
							Lt = defL(L0, A, B, fr, fg, fb, pcs[0]);
							if (kk >= 0) Lt += wk * (defL(L0, A, B, fr, fg, fb, pcs[kk + 1]) - Lt);
						}
						C.oklabToLin(L0 + M * (Lt - L0), A, B, lin);
						ir = toSrgb(lin[0]); ig = toSrgb(lin[1]); ib = toSrgb(lin[2]);
						if (M >= 0.999 && known >= 0.999) {
							const Y = lum(lin[0], lin[1], lin[2]);
							const v = tri ? Math.min(cr(1, Y), cr(0, Y)) : cr(pcs[wk > 0.5 ? kk + 1 : 0].yT, Y);
							if (v < minV) minV = v;
							if (v < ratio - 1e-6) under++;
							nI++;
						}
					}
				} else if (M >= 0.999) nV++;

				const pv = tri ? tv : pcs[wk > 0.5 ? kk + 1 : 0];
				const wV = (1 - known) * pv.al * M, aO = known + wV;
				if (aO <= 0) continue;
				out[q] = (known * ir + wV * pv.vc) / aO;
				out[q + 1] = (known * ig + wV * pv.vc) / aO;
				out[q + 2] = (known * ib + wV * pv.vc) / aO;
				out[q + 3] = aO * 255;
			}
		}
		const inf = tri ? !band.ok : pcs[0].pkR < ratio;
		return { source: new ImageData(out, w, h), stats: { min: nI ? minV : null, under, nI, nV, inf }, tainted };
	}

	window.j0.register('ipax-backdrop:kernel-cpu', { available: () => true, render });
})();