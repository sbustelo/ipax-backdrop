/**
 * ipax-backdrop / 3100-kernel-cpu.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL, CPU backend. Reference implementation paired with 3210-kernel-webgl-shaders.js.
 *
 * Composition pipeline per pixel:
 *   1. Mb       box mask (Euclidean feather inside box, 0 outside)
 *      Mh       calibrated glyph contour mask (0 without --ipax-text)
 *      mScreen  screen(Mb, Mh) = Mb + Mh - Mb * Mh
 *   2. Blur     single-pass estBlur mixed by mScreen (if boxBlur === textBlur)
 *               or max(Mb * boxBlur / maxBlur, Mh * textBlur / maxBlur)
 *   3. OKLab    continuous sequential lightness adaptation: L0 --(mScreen)--> L1 --(Mh)--> L2
 *   4. Veil     worst-case contrast veil weighted by max(mScreen * alBox, Mh * alText)
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

	function maskAt(m, rx, ry) {
		const data = m.data, mw = m.mw, mh = m.mh, cs = m.cs;
		let fx = rx / cs - 0.5, fy = ry / cs - 0.5;
		if (fx < 0) fx = 0; else if (fx > mw - 1) fx = mw - 1;
		if (fy < 0) fy = 0; else if (fy > mh - 1) fy = mh - 1;
		const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j;
		const i1 = i + 1 < mw ? i + 1 : i, j1 = j + 1 < mh ? j + 1 : j;
		const a = data[j * mw + i], b = data[j * mw + i1], c = data[j1 * mw + i], d = data[j1 * mw + i1];
		return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) / 255;
	}

	function render(input) {
		const C = svc('color'), K = svc('contrast');
		const LUT = C.LUT, clamp01 = C.clamp01, smooth = C.smooth, lum = C.luminance, toSrgb = C.toSrgb255, cr = K.ratio;
		const { est, estBlur, grid, w, h, s, W, H, params, colors } = input;
		const ox = input.ox || 0, oy = input.oy || 0;
		const halo = input.halo && input.halo.mask ? input.halo : null, haloOn = !!halo;
		const boxCover = input.boxCover !== false;
		const infl = input.infl > 6 ? input.infl : 6;
		const eps = 1 / s;

		let pix = null, blurPix = null, tainted = false;
		if (est) {
			try {
				pix = est.getContext('2d').getImageData(0, 0, w, h).data;
				if (estBlur) blurPix = estBlur.getContext('2d').getImageData(0, 0, w, h).data;
			} catch (e) { tainted = true; }
		}

		const out = new Uint8ClampedArray(w * h * 4);
		const triB = params.mode === 'tricontrast';
		const ratio = params.ratio, rS = K.solveRatio(ratio), bypassB = K.isBypass(ratio);
		const rH = haloOn ? halo.ratio : ratio, rSH = K.solveRatio(rH), bypassH = !haloOn || K.isBypass(rH);
		const triH = haloOn ? ((halo.mode || params.mode) === 'tricontrast') : triB;
		const shared = haloOn && !!halo.shared;

		const boxBlur = input.boxBlur !== undefined ? input.boxBlur : (params.blur || 0);
		const textBlur = input.textBlur !== undefined ? input.textBlur : (haloOn ? (halo.blur || 0) : 0);
		const maxBlur = input.maxBlur !== undefined ? input.maxBlur : Math.max(boxBlur, textBlur);
		const boxBlurRatio = maxBlur > 0 ? boxBlur / maxBlur : 0;
		const textBlurRatio = maxBlur > 0 ? textBlur / maxBlur : 0;
		const sameBlur = Math.abs(boxBlur - textBlur) < 1e-4;

		const fParam = params.feather;
		const f = (typeof fParam === 'object' && fParam !== null)
			? fParam
			: (typeof fParam === 'number' ? { top: fParam, right: fParam, bottom: fParam, left: fParam } : { top: 0, right: 0, bottom: 0, left: 0 });
		const fT = f.top > 0 ? f.top : 0, fR = f.right > 0 ? f.right : 0, fB = f.bottom > 0 ? f.bottom : 0, fL = f.left > 0 ? f.left : 0;
		const hasFeather = fT > 0 || fR > 0 || fB > 0 || fL > 0;

		const runs = colors.runs.slice(0, svc('limits').maxRuns);
		const pcs = [K.prepareColor(colors.base, rS)].concat(runs.map((r) => K.prepareColor(r.c, rS)));
		const pcsH = (haloOn && !shared) ? [K.prepareColor(colors.base, rSH)].concat(runs.map((r) => K.prepareColor(r.c, rSH))) : pcs;
		const band = K.band(ratio), tv = K.bandVeil(band);
		const bandH = haloOn ? K.band(rH) : band, tvH = haloOn ? K.bandVeil(bandH) : tv;
		const ok = [0, 0, 0], lin = [0, 0, 0];

		const defL = (L0, A, B, fr, fg, fb, pc, rs) => {
			if (cr(pc.yT, lum(fr, fg, fb)) >= rs) return L0;
			C.oklabToLin(pc.pkL, A, B, lin);
			if (cr(pc.yT, lum(lin[0], lin[1], lin[2])) < rs) return pc.pkL;
			let lo = L0, hi = pc.pkL;
			for (let n = 0; n < 9; n++) {
				const mid = (lo + hi) / 2;
				C.oklabToLin(mid, A, B, lin);
				if (cr(pc.yT, lum(lin[0], lin[1], lin[2])) >= rs) hi = mid; else lo = mid;
			}
			return hi;
		};

		const triL = (L0, A, B, Y0, bd) => {
			if (Y0 >= bd.lo && Y0 <= bd.hi) return L0;
			const up = Y0 < bd.lo, target = up ? bd.lo : bd.hi;
			let lo = up ? L0 : 0, hi = up ? 1 : L0;
			for (let n = 0; n < 13; n++) {
				const mid = (lo + hi) / 2;
				C.oklabToLin(mid, A, B, lin);
				if (lum(lin[0], lin[1], lin[2]) < target) lo = mid; else hi = mid;
			}
			return (lo + hi) / 2;
		};

		const solve = (L0, A, B, fr, fg, fb, rs, bd, isTri, pcList, kk, wk) => {
			if (isTri) return triL(L0, A, B, lum(fr, fg, fb), bd);
			let Lt = defL(L0, A, B, fr, fg, fb, pcList[0], rs);
			if (kk >= 0) Lt += wk * (defL(L0, A, B, fr, fg, fb, pcList[kk + 1], rs) - Lt);
			return Lt;
		};

		let minV = Infinity, under = 0, nI = 0, nV = 0;
		for (let y = 0; y < h; y++) {
			const ry = (y + 0.5) / s, by = ry - oy;
			const inY = by > -eps && by < H + eps;
			const uY = (inY && hasFeather) ? Math.max(
				fT > 0 ? (fT - by) / fT : 0,
				fB > 0 ? (by - (H - fB)) / fB : 0,
				0
			) : 0;

			for (let x = 0; x < w; x++) {
				const q = (y * w + x) * 4, rx = (x + 0.5) / s, bx = rx - ox;
				const inBox = inY && bx > -eps && bx < W + eps;
				let Mb = 0;
				if (inBox && boxCover) {
					if (hasFeather) {
						const uX = Math.max(
							fL > 0 ? (fL - bx) / fL : 0,
							fR > 0 ? (bx - (W - fR)) / fR : 0,
							0
						);
						const r = (uX > 0 && uY > 0) ? Math.sqrt(uX * uX + uY * uY) : (uX > uY ? uX : uY);
						Mb = smooth(clamp01(1 - r));
					} else {
						Mb = 1;
					}
				}
				const Mh = haloOn ? maskAt(halo.mask, rx, ry) : 0;
				const covers = inBox && boxCover;
				if (!covers && Mh <= 0) continue;
				const cov = covers ? 1 : Mh;
				const mScreen = Mb + Mh - Mb * Mh;
				const known = pix ? 1 - veilFrac(grid, rx, ry) : 0;

				let wk = 0, kk = -1;
				if (!triB || !triH) {
					for (let k = 0; k < runs.length; k++) {
						const r = runs[k];
						const d = Math.hypot(Math.max(r.x0 - rx, 0, rx - r.x1), Math.max(r.y0 - ry, 0, ry - r.y1));
						const wg = smooth(clamp01(1 - d / infl));
						if (wg > wk) { wk = wg; kk = k; }
					}
				}

				let ir = 0, ig = 0, ib = 0;
				if (known > 0) {
					let fr = LUT[pix[q]], fg = LUT[pix[q + 1]], fb = LUT[pix[q + 2]];

					if (blurPix && maxBlur > 0) {
						const mBlur = sameBlur ? mScreen : Math.max(Mb * boxBlurRatio, Mh * textBlurRatio);
						if (mBlur > 0) {
							const br = LUT[blurPix[q]], bg = LUT[blurPix[q + 1]], bb = LUT[blurPix[q + 2]];
							fr = fr + mBlur * (br - fr);
							fg = fg + mBlur * (bg - fg);
							fb = fb + mBlur * (bb - fb);
						}
					}

					if (bypassB && bypassH) {
						ir = toSrgb(fr); ig = toSrgb(fg); ib = toSrgb(fb);
					} else {
						C.linToOklab(fr, fg, fb, ok);
						const L0 = ok[0], A = ok[1], B = ok[2];
						let L1 = L0;
						if (!bypassB && mScreen > 0) {
							const LtB = solve(L0, A, B, fr, fg, fb, rS, band, triB, pcs, kk, wk);
							L1 = clamp01(L0 + mScreen * (LtB - L0));
						}
						let L2 = L1;
						if (!bypassH && Mh > 0) {
							C.oklabToLin(L1, A, B, lin);
							const LtH = solve(L1, A, B, lin[0], lin[1], lin[2], rSH, bandH, triH, pcsH, kk, wk);
							const hk = covers ? Mh : 1;
							L2 = clamp01(L1 + hk * (LtH - L1));
						}
						C.oklabToLin(L2, A, B, lin);
						ir = toSrgb(lin[0]); ig = toSrgb(lin[1]); ib = toSrgb(lin[2]);
						if (Mb >= 0.999 && known >= 0.999 && !bypassB) {
							const Y = lum(lin[0], lin[1], lin[2]);
							const v = triB ? Math.min(cr(1, Y), cr(0, Y)) : cr(pcs[wk > 0.5 ? kk + 1 : 0].yT, Y);
							if (v < minV) minV = v;
							if (v < ratio - 1e-6) under++;
							nI++;
						}
					}
				} else if (Mb >= 0.999) nV++;

				const vi = wk > 0.5 ? kk + 1 : 0;
				let wB = 0, vB = 0, wH = 0, vH = 0;
				if (!bypassB && mScreen > 0) { const pv = triB ? tv : pcs[vi]; wB = mScreen * pv.al; vB = pv.vc; }
				if (!bypassH && Mh > 0) { const pv = triH ? tvH : pcsH[vi]; wH = Mh * pv.al; vH = pv.vc; }
				const wm = wH > wB ? wH : wB, vcv = wH > wB ? vH : vB;
				const wV = (1 - known) * wm;
				const kc = known * cov;
				const aO = kc + wV;
				if (aO <= 0) continue;
				out[q] = (kc * ir + wV * vcv) / aO;
				out[q + 1] = (kc * ig + wV * vcv) / aO;
				out[q + 2] = (kc * ib + wV * vcv) / aO;
				out[q + 3] = aO * 255;
			}
		}
		const inf = triB ? !band.ok : pcs[0].pkR < ratio;
		return { source: new ImageData(out, w, h), stats: { min: nI ? minV : null, under, nI, nV, inf }, tainted };
	}

	window.j0.register('ipax-backdrop:kernel-cpu', { available: () => true, render });
})();