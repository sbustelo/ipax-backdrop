// PATH: src/1100-lector-texto.js
/**
 * ipax-backdrop / 1100-lector-texto.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 1 - READER (text): text colour runs and calibrated per-word glyph boxes.
 *
 * Service 'ipax-backdrop:reader-text':
 *   readColors(el, rect, baseColorStr, wantTexts)
 *     -> {base:[r,g,b], runs:[{x0,y0,x1,y1,c}], truncated, texts}
 *
 * When `wantTexts` is true (--ipax-text active), `texts` records per-word line rects
 * along with the computed font stack, letter-spacing and text-transform so the glyph
 * mask rasterizer (2400-resolutor-halo.js) aligns 1:1 with browser glyph rendering.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	function readColors(el, rect, baseStr, wantTexts) {
		const C = svc('color'), max = svc('limits').maxRuns;
		const toRgb = (str) => { const c = C.parseCssColor(str); return c ? [c[0], c[1], c[2]] : [255, 255, 255]; };
		const base = toRgb(baseStr), runs = [], texts = wantTexts ? [] : null;
		let truncated = false;
		const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
		let node;

		while ((node = tw.nextNode())) {
			const raw = node.nodeValue;
			if (!raw || !raw.trim()) continue;
			const cs = getComputedStyle(node.parentElement);
			const c = toRgb(cs.color);
			const differs = Math.abs(c[0] - base[0]) + Math.abs(c[1] - base[1]) + Math.abs(c[2] - base[2]) >= 24;
			if (!differs && !wantTexts) continue;

			if (differs) {
				range.selectNodeContents(node);
				for (const r of range.getClientRects()) {
					if (r.width <= 0 || r.height <= 0) continue;
					if (runs.length >= max) { truncated = true; break; }
					runs.push({
						x0: r.left - rect.left,
						y0: r.top - rect.top,
						x1: r.right - rect.left,
						y1: r.bottom - rect.top,
						c
					});
				}
			}

			if (wantTexts) {
				const fs = parseFloat(cs.fontSize) || 16;
				const fontStyle = cs.fontStyle || 'normal';
				const fontWeight = cs.fontWeight || '400';
				const fontFamily = cs.fontFamily || 'sans-serif';
				const ls = parseFloat(cs.letterSpacing);
				const letterSpacing = isNaN(ls) ? 0 : ls;
				const textTransform = cs.textTransform || 'none';

				const re = /\S+/g;
				let m;
				while ((m = re.exec(raw))) {
					range.setStart(node, m.index);
					range.setEnd(node, m.index + m[0].length);
					const rects = range.getClientRects();
					for (let i = 0; i < rects.length; i++) {
						const r = rects[i];
						if (r.width <= 0 || r.height <= 0) continue;
						texts.push({
							x0: r.left - rect.left,
							y0: r.top - rect.top,
							x1: r.right - rect.left,
							y1: r.bottom - rect.top,
							word: m[0],
							fs,
							fontStyle,
							fontWeight,
							fontFamily,
							letterSpacing,
							textTransform
						});
					}
				}
			}
		}
		return { base, runs, truncated, texts };
	}

	window.j0.register('ipax-backdrop:reader-text', { readColors });
})();