/**
 * ipax-backdrop / 2400-resolutor-halo.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER (glyph contour mask): calibrated mask for --ipax-text.
 *
 * Builds a low-resolution single-channel mask Mg(x, y) in [0..255] fitted to the
 * actual rendered glyphs (calibrated per word via Range.getClientRects + TextMetrics),
 * dilated by `spread` (px additive or % internal) and diffused by `halo` (Gaussian/smoothstep).
 *
 * Service 'ipax-backdrop:halo':
 *   reachOf(tp)                                -> {s, f, reach} in CSS px
 *   extent(texts, tp, E, cap, cur)             -> {l, t, r, b, reach}
 *   mask(rec, texts, tp, W, H, scale?)         -> {sig, data:Uint8Array, mw, mh, cs}
 *   activeCells(texts, tp, ox, oy, bw, bh, nx, ny, g, includeBox) -> Uint8Array(nx*ny)
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const MAX_CELLS = 262144; // up to 512 x 512 mask texels

	function applyTransform(word, tf) {
		if (tf === 'uppercase') return word.toUpperCase();
		if (tf === 'lowercase') return word.toLowerCase();
		if (tf === 'capitalize') return word.replace(/\b\w/g, (ch) => ch.toUpperCase());
		return word;
	}

	function reachOf(tp) {
		const haloPx = Math.max(0, tp.halo || 0);
		const isPct = tp.spread && tp.spread.unit === '%';
		const rawSpread = tp.spread ? Math.max(0, tp.spread.v || 0) : 0;
		const s = isPct ? haloPx * (rawSpread / 100) : rawSpread;
		const f = isPct ? Math.max(0, haloPx - s) : haloPx;
		return { s, f, reach: s + f };
	}

	function extent(texts, tp, E, cap, cur) {
		const q = reachOf(tp), d = q.reach;
		const ox = tp.x || 0, oy = tp.y || 0;
		let l = 0, t = 0, r = 0, b = 0;
		for (let i = 0; i < texts.length; i++) {
			const T = texts[i];
			const a = E.left - (T.x0 + ox - d); if (a > l) l = a;
			const c = (T.x1 + ox + d) - E.right; if (c > r) r = c;
			const e = E.top - (T.y0 + oy - d); if (e > t) t = e;
			const f = (T.y1 + oy + d) - E.bottom; if (f > b) b = f;
		}
		const fit = (v, old) => {
			const n = Math.min(cap, Math.max(0, Math.ceil(v - 0.05)));
			return (old >= n && old - n <= 1) ? old : n;
		};
		return { l: fit(l, cur.l), t: fit(t, cur.t), r: fit(r, cur.r), b: fit(b, cur.b), reach: d };
	}

	function signature(texts, tp, W, H, effScale) {
		const q = reachOf(tp);
		let s = Math.round(W) + 'x' + Math.round(H) + '@' + effScale.toFixed(3) +
			'|' + (tp.x || 0) + ',' + (tp.y || 0) + ',' + q.s.toFixed(2) + ',' + q.f.toFixed(2);
		for (let i = 0; i < texts.length; i++) {
			const t = texts[i];
			s += '|' + Math.round(t.x0) + ',' + Math.round(t.y0) + ',' + Math.round(t.x1) + ',' + Math.round(t.y1) + ':' + (t.word || '');
		}
		return s;
	}

	function buildEuclideanFallback(texts, tp, mw, mh, cs) {
		const smooth = svc('color').smooth;
		const q = reachOf(tp), s = q.s, f = q.f, r = q.reach;
		const ox = tp.x || 0, oy = tp.y || 0;
		const data = new Uint8Array(mw * mh);
		if (!(r > 0)) return data;

		for (let n = 0; n < texts.length; n++) {
			const T = texts[n];
			const x0 = T.x0 + ox, x1 = T.x1 + ox, y0 = T.y0 + oy, y1 = T.y1 + oy;
			const j0 = Math.max(0, Math.floor((y0 - r) / cs - 0.5)), j1 = Math.min(mh - 1, Math.ceil((y1 + r) / cs - 0.5));
			const i0 = Math.max(0, Math.floor((x0 - r) / cs - 0.5)), i1 = Math.min(mw - 1, Math.ceil((x1 + r) / cs - 0.5));
			for (let j = j0; j <= j1; j++) {
				const cy = (j + 0.5) * cs, dy = cy < y0 ? y0 - cy : (cy > y1 ? cy - y1 : 0);
				if (dy > r) continue;
				const dy2 = dy * dy, row = j * mw;
				for (let i = i0; i <= i1; i++) {
					const cx = (i + 0.5) * cs, dx = cx < x0 ? x0 - cx : (cx > x1 ? cx - x1 : 0);
					const d = Math.sqrt(dx * dx + dy2);
					let m;
					if (d <= s) m = 1;
					else if (f > 0 && d < r) m = smooth(1 - (d - s) / f);
					else continue;
					const v = (m * 255 + 0.5) | 0;
					if (v > data[row + i]) data[row + i] = v;
				}
			}
		}
		return data;
	}

	function mask(rec, texts, tp, W, H, scale) {
		const reqScale = Math.min(2, Math.max(0.5, scale || 1));
		let mw = Math.max(1, Math.ceil(W * reqScale));
		let mh = Math.max(1, Math.ceil(H * reqScale));
		while (mw * mh > MAX_CELLS) {
			mw = Math.max(1, Math.floor(mw * 0.8));
			mh = Math.max(1, Math.floor(mh * 0.8));
		}
		const effScale = W > 0 ? mw / W : 1;
		const cs = W > 0 ? W / mw : 1;

		const sig = signature(texts, tp, W, H, effScale);
		if (rec && rec.halo && rec.halo.sig === sig) return rec.halo;

		const q = reachOf(tp);
		const cv = document.createElement('canvas');
		cv.width = mw;
		cv.height = mh;
		const ctx = cv.getContext ? cv.getContext('2d', { willReadFrequently: true }) : null;

		if (!ctx || typeof ctx.fillText !== 'function' || typeof ctx.measureText !== 'function') {
			const fb = { sig, data: buildEuclideanFallback(texts, tp, mw, mh, cs), mw, mh, cs };
			if (rec) rec.halo = fb;
			return fb;
		}

		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, mw, mh);
		ctx.fillStyle = '#fff';
		ctx.strokeStyle = '#fff';
		ctx.lineJoin = 'round';
		ctx.miterLimit = 2;

		const ox = (tp.x || 0) * effScale;
		const oy = (tp.y || 0) * effScale;
		const spreadPx = q.s * effScale;
		const fadePx = q.f * effScale;

		for (let i = 0; i < texts.length; i++) {
			const T = texts[i];
			if (!T.word) continue;
			const domX = T.x0 * effScale;
			const domY = T.y0 * effScale;
			const domW = (T.x1 - T.x0) * effScale;
			const domH = (T.y1 - T.y0) * effScale;
			if (domW <= 0 || domH <= 0) continue;

			const fontSizePx = (T.fs || 16) * effScale;
			ctx.font = (T.fontStyle || 'normal') + ' ' + (T.fontWeight || '400') + ' ' + fontSizePx + 'px ' + (T.fontFamily || 'sans-serif');
			if ('letterSpacing' in ctx) {
				ctx.letterSpacing = ((T.letterSpacing || 0) * effScale) + 'px';
			}

			const word = applyTransform(T.word, T.textTransform);
			const tm = ctx.measureText(word);
			const cvW = tm && tm.width ? tm.width : domW;
			const scaleX = (cvW > 0 && Math.abs(cvW - domW) > 0.25) ? (domW / cvW) : 1;
			const asc = (tm && (tm.fontBoundingBoxAscent || tm.actualBoundingBoxAscent)) || domH * 0.78;
			const desc = (tm && (tm.fontBoundingBoxDescent || tm.actualBoundingBoxDescent)) || domH * 0.22;
			const baseY = domY + (domH - (asc + desc)) * 0.5 + asc;

			ctx.save();
			ctx.translate(domX + ox, baseY + oy);
			if (scaleX !== 1) ctx.scale(scaleX, 1);
			if (spreadPx > 0.05) {
				ctx.lineWidth = (spreadPx * 2) / scaleX;
				ctx.strokeText(word, 0, 0);
			}
			ctx.fillText(word, 0, 0);
			ctx.restore();
		}

		let rgba;
		const sigma = fadePx * 0.5;
		if (sigma > 0.25) {
			const blurCv = document.createElement('canvas');
			blurCv.width = mw;
			blurCv.height = mh;
			const bctx = blurCv.getContext('2d', { willReadFrequently: true });
			bctx.filter = 'blur(' + sigma.toFixed(2) + 'px)';
			bctx.drawImage(cv, 0, 0);
			rgba = bctx.getImageData(0, 0, mw, mh).data;
		} else {
			rgba = ctx.getImageData(0, 0, mw, mh).data;
		}

		const data = new Uint8Array(mw * mh);
		for (let p = 0, n = data.length; p < n; p++) data[p] = rgba[p * 4];

		const out = { sig, data, mw, mh, cs };
		if (rec) rec.halo = out;
		return out;
	}

	function activeCells(texts, tp, ox, oy, bw, bh, nx, ny, g, includeBox) {
		const a = new Uint8Array(nx * ny);
		const mark = (x0, y0, x1, y1) => {
			const i0 = Math.max(0, Math.floor(x0 / g)), i1 = Math.min(nx - 1, Math.floor(x1 / g));
			const j0 = Math.max(0, Math.floor(y0 / g)), j1 = Math.min(ny - 1, Math.floor(y1 / g));
			for (let j = j0; j <= j1; j++) { const row = j * nx; for (let i = i0; i <= i1; i++) a[row + i] = 1; }
		};
		if (includeBox) mark(ox, oy, ox + bw, oy + bh);
		const r = reachOf(tp).reach;
		const tx = tp.x || 0, ty = tp.y || 0;
		for (let n = 0; n < texts.length; n++) {
			const T = texts[n];
			mark(T.x0 + tx - r, T.y0 + ty - r, T.x1 + tx + r, T.y1 + ty + r);
		}
		return a;
	}

	window.j0.register('ipax-backdrop:halo', { reachOf, extent, mask, activeCells });
})();