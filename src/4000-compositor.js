/**
 * ipax-backdrop / 4000-compositor.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 4 - COMPOSITOR: where the result lives in the page.
 *
 * Every managed element gets ONE sibling layer, inserted immediately BEFORE it:
 *
 *     <ipax-backdrop-layer aria-hidden="true"><canvas></canvas></ipax-backdrop-layer>
 *     <h1 style="...">The managed element</h1>
 *
 * Why a sibling and not a child: the element keeps its own background,
 * gradient, ::before / ::after, text-shadow and, above all, its own
 * `backdrop-filter`, which then blurs OUR layer together with the real
 * backdrop. A child would be painted on top of the element's own background
 * and would not be blurred by its backdrop-filter.
 *
 * Why the element must be positioned: a positioned element is painted above a
 * non-positioned one regardless of DOM order, so a static element's text would
 * end up UNDER our absolute layer. The internal stylesheet below gives managed
 * elements `position: relative` through `:where()` (specificity 0): any
 * `position` the author declares wins.
 *
 * Geometry: the layer copies offsetLeft / offsetTop / offsetWidth / offsetHeight
 * of the element. They share the same containing block because they are
 * siblings. Moving the parent moves both; size changes are watched with a
 * ResizeObserver (which emits 'ipax-backdrop:invalidate').
 *
 * Service 'ipax-backdrop:compositor':
 *   ensureStyle()                 inject the internal stylesheet (idempotent)
 *   attach(el) -> rec             create the layer {el, layer, cv, id, ready}
 *   detachAll()                   remove every layer and observer
 *   recordFor(el) -> rec | undefined
 *   place(rec)                    copy the element geometry to the layer
 *   draw(rec, w, h, result)       paint a kernel result into the layer canvas
 *   clear(rec)                    empty the layer
 *   withHitTesting(rec, fn)       run fn() with the layer reachable by
 *                                 elementsFromPoint (it is pointer-events:none otherwise)
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const records = new Map();
	let nextId = 0, observer = null, styleEl = null;

	/**
	 * INTERNAL STYLESHEET (the only CSS this library injects).
	 *   rule 1  managed elements are positioned (specificity 0, author wins)
	 *   rule 2  the layer is an absolutely positioned, click-through box
	 *   rule 3  its canvas fills it
	 */
	function cssText() {
		const N = svc('names');
		return [
			':where([' + N.managedAttr + ']){position:relative}',
			N.layerTag + '{position:absolute;display:block;pointer-events:none;margin:0;padding:0}',
			N.layerTag + '>canvas{display:block;width:100%;height:100%}'
		].join('\n');
	}

	function ensureStyle() {
		if (styleEl && styleEl.isConnected) return;
		styleEl = document.createElement('style');
		styleEl.setAttribute('data-ipax-backdrop-style', '');
		styleEl.textContent = cssText();
		document.head.appendChild(styleEl);
	}

	function observe(el) {
		if (typeof ResizeObserver === 'undefined') return;
		if (!observer) observer = new ResizeObserver(() => window.j0.bus.emit('ipax-backdrop:invalidate', { reason: 'resize' }));
		observer.observe(el);
		if (el.parentElement) observer.observe(el.parentElement);
	}

	function attach(el) {
		const known = records.get(el);
		if (known) return known;
		const N = svc('names');
		el.setAttribute(N.managedAttr, '');
		const layer = document.createElement(N.layerTag), cv = document.createElement('canvas');
		layer.setAttribute('aria-hidden', 'true');
		layer.appendChild(cv);
		el.parentNode.insertBefore(layer, el);
		const rec = { el, layer, cv, id: ++nextId, ready: false };
		records.set(el, rec);
		observe(el);
		return rec;
	}

	function detachAll() {
		const N = svc('names');
		records.forEach((rec) => { rec.layer.remove(); rec.el.removeAttribute(N.managedAttr); });
		records.clear();
		if (observer) { observer.disconnect(); observer = null; }
	}

	function place(rec) {
		const e = rec.el, s = rec.layer.style;
		s.left = e.offsetLeft + 'px'; s.top = e.offsetTop + 'px';
		s.width = e.offsetWidth + 'px'; s.height = e.offsetHeight + 'px';
	}

	function clear(rec) {
		rec.cv.getContext('2d').clearRect(0, 0, rec.cv.width, rec.cv.height);
		rec.cv.style.backdropFilter = '';
		rec.cv.style.webkitBackdropFilter = '';
		rec.ready = false;
	}

	function draw(rec, w, h, result, blurPx = 0) {
		if (rec.cv.width !== w || rec.cv.height !== h) { rec.cv.width = w; rec.cv.height = h; }
		const ctx = rec.cv.getContext('2d');
		if (result.source instanceof ImageData) ctx.putImageData(result.source, 0, 0);
		else { ctx.clearRect(0, 0, w, h); ctx.drawImage(result.source, 0, 0, w, h); }
		
		// Fallback CSS blur for unknown areas or veil coverage
		if (blurPx > 0) {
			const b = `blur(${blurPx}px)`;
			rec.cv.style.backdropFilter = b;
			rec.cv.style.webkitBackdropFilter = b;
		} else {
			rec.cv.style.backdropFilter = '';
			rec.cv.style.webkitBackdropFilter = '';
		}
		
		rec.ready = true;
	}

	function withHitTesting(rec, fn) {
		const st = rec.layer.style, prev = st.pointerEvents;
		st.pointerEvents = 'auto';
		try { return fn(); } finally { st.pointerEvents = prev; }
	}

	window.j0.register('ipax-backdrop:compositor', { ensureStyle, attach, detachAll, recordFor: (el) => records.get(el), place, draw, clear, withHitTesting });
})();
