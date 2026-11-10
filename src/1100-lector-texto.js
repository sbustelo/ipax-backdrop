/**
 * ipax-backdrop / 1100-lector-texto.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 1 - READER (text): which colours does the text inside the element have?
 *
 * Service 'ipax-backdrop:reader-text':
 *   readColors(el, rect, baseColorStr) -> {base:[r,g,b], runs:[{x0,y0,x1,y1,c}], truncated}
 *
 * The base colour is the computed `color` of the element. A "run" is a text
 * node whose colour differs from the base (for example a <b> or <span> with
 * another colour). Run rectangles are relative to `rect` (the element box),
 * in CSS pixels, one rectangle per line box. Only limits.maxRuns rectangles
 * are kept; `truncated` tells the orchestrator when some were dropped.
 *
 * Why runs matter: white text needs a darker backdrop and black text a lighter
 * one. Each run asks for its own correction, blended smoothly with its
 * neighbours by the kernel.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	function readColors(el, rect, baseStr) {
		const C = svc('color'), max = svc('limits').maxRuns;
		const toRgb = (str) => { const c = C.parseCssColor(str); return c ? [c[0], c[1], c[2]] : [255, 255, 255]; };
		const base = toRgb(baseStr), runs = [];
		let truncated = false;
		const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
		let node;
		while ((node = tw.nextNode())) {
			if (!node.nodeValue.trim()) continue;
			const c = toRgb(getComputedStyle(node.parentElement).color);
			if (Math.abs(c[0] - base[0]) + Math.abs(c[1] - base[1]) + Math.abs(c[2] - base[2]) < 24) continue;
			range.selectNodeContents(node);
			for (const r of range.getClientRects()) {
				if (r.width <= 0 || r.height <= 0) continue;
				if (runs.length >= max) { truncated = true; continue; }
				runs.push({ x0: r.left - rect.left, y0: r.top - rect.top, x1: r.right - rect.left, y1: r.bottom - rect.top, c });
			}
		}
		return { base, runs, truncated };
	}

	window.j0.register('ipax-backdrop:reader-text', { readColors });
})();
