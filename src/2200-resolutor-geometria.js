/**
 * ipax-backdrop / 2200-resolutor-geometria.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER (geometry): where is a background image drawn?
 *
 * Reproduces the CSS rules for background-size / -position / -repeat (and
 * object-fit for <img>) so the resolver can paint a faithful copy of what the
 * browser paints. Anything it cannot reproduce returns null and the caller
 * marks the area as "unknown".
 *
 * Service 'ipax-backdrop:css-geometry':
 *   splitTop(str)                              split a CSS list at top-level commas (memoised)
 *   parseLength(token, ref)                    '12px' | '50%' -> px (percent of ref) | null
 *   parseRepeat(str)                           -> {rx, ry} | null
 *   backgroundGeometry(iw, ih, pa, size, pos, rep)
 *   objectFitGeometry(iw, ih, pa, fit, pos)    -> geometry | null
 *
 * A geometry is {x, y, dw, dh, rx, ry}: top-left of the first tile and tile
 * size in client px, plus whether it repeats on each axis. `pa` is the
 * positioning area {x, y, w, h} (the padding box).
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const splitCache = new Map();

	function splitTop(s) {
		const hit = splitCache.get(s);
		if (hit) return hit;
		const out = [];
		let d = 0, cur = '';
		for (const ch of s) {
			if (ch === '(') d++; else if (ch === ')') d--;
			if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
		}
		if (cur.trim()) out.push(cur.trim());
		if (splitCache.size > 30) splitCache.clear(); // data: URLs make keys large
		splitCache.set(s, out);
		return out;
	}

	function parseLength(token, ref) {
		const v = parseFloat(token);
		if (isNaN(v)) return null;
		return token.endsWith('%') ? v / 100 * ref : v;
	}

	function parseRepeat(s) {
		const t = s.trim().split(/\s+/);
		if (t[0] === 'repeat-x') return { rx: true, ry: false };
		if (t[0] === 'repeat-y') return { rx: false, ry: true };
		const a = t[0], b = t[1] || t[0], ok = (v) => v === 'repeat' || v === 'no-repeat';
		return ok(a) && ok(b) ? { rx: a === 'repeat', ry: b === 'repeat' } : null;
	}

	function backgroundGeometry(iw, ih, pa, size, pos, rep) {
		if (!iw || !ih || pa.w <= 0 || pa.h <= 0) return null;
		let dw, dh;
		const sz = size.trim().split(/\s+/);
		if (sz[0] === 'cover') { const k = Math.max(pa.w / iw, pa.h / ih); dw = iw * k; dh = ih * k; }
		else if (sz[0] === 'contain') { const k = Math.min(pa.w / iw, pa.h / ih); dw = iw * k; dh = ih * k; }
		else {
			dw = sz[0] === 'auto' ? null : parseLength(sz[0], pa.w);
			dh = (sz[1] === undefined || sz[1] === 'auto') ? null : parseLength(sz[1], pa.h);
			if (sz[0] !== 'auto' && dw === null) return null;
			if (dw === null && dh === null) { dw = iw; dh = ih; }
			else if (dw === null) dw = dh * iw / ih;
			else if (dh === null) dh = dw * ih / iw;
		}
		const p = pos.trim().split(/\s+/);
		const px = parseLength(p[0], pa.w - dw), py = parseLength(p[1] || '50%', pa.h - dh);
		if (px === null || py === null || dw < 2 || dh < 2) return null;
		return { x: pa.x + px, y: pa.y + py, dw, dh, rx: rep.rx, ry: rep.ry };
	}

	function objectFitGeometry(iw, ih, pa, fit, pos) {
		if (fit === 'fill') return { x: pa.x, y: pa.y, dw: pa.w, dh: pa.h, rx: false, ry: false };
		if (fit === 'cover' || fit === 'contain') return backgroundGeometry(iw, ih, pa, fit, pos, { rx: false, ry: false });
		return null;
	}

	window.j0.register('ipax-backdrop:css-geometry', { splitTop, parseLength, parseRepeat, backgroundGeometry, objectFitGeometry });
})();
