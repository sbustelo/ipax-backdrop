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
 * PERFORMANCE NOTES (v0.1.05)
 *   - Placement is split in two phases so a caller that handles many records
 *     can READ all geometry first and WRITE it afterwards (no layout thrashing):
 *       const m = records.map(measure);  records.forEach((r, i) => apply(r, m[i]));
 *     apply() skips the style writes when nothing changed (rec.placed cache).
 *   - draw() accepts result.srcRect {x, y, w, h}: a sub-rectangle of a source
 *     canvas that is larger than the target (shared WebGL canvas kept at its
 *     maximum size). Without srcRect the whole source is used (old behaviour).
 *   - release() / sweep() free the canvas memory of layers that have been out
 *     of view for a while. A released record is flagged unsettled so it is
 *     recomputed when it comes back.
 *
 * Service 'ipax-backdrop:compositor':
 *   ensureStyle()                 inject the internal stylesheet (idempotent)
 *   attach(el) -> rec             create the layer {el, layer, cv, id, ready}
 *   detachAll()                   remove every layer and observer
 *   recordFor(el) -> rec | undefined
 *   measure(rec) -> {l, t, w, h}  READ phase: element geometry (touches layout)
 *   apply(rec, m)                 WRITE phase: copy geometry to the layer (cached)
 *   place(rec)                    measure + apply (kept for compatibility)
 *   draw(rec, w, h, result, blurPx)  paint a kernel result into the layer canvas
 *   clear(rec)                    empty the layer
 *   release(rec)                  free canvas memory (backing store, scratch canvases)
 *   sweep(visibleSet, ttlMs)      release records hidden for longer than ttlMs
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

	// A ResizeObserver always delivers one notification right after observe(). Treating it as a resize
	// invalidated every record at startup and made the first pass run twice. Only real size changes count.
	const roSizes = new WeakMap();
	function observe(el) {
		if (typeof ResizeObserver === 'undefined') return;
		if (!observer) {
			observer = new ResizeObserver((entries) => {
				let changed = false;
				for (const en of entries) {
					const r = en.contentRect, prev = roSizes.get(en.target);
					if (!prev) { roSizes.set(en.target, { w: r.width, h: r.height }); continue; } // first notification: baseline only
					if (Math.abs(prev.w - r.width) > 0.5 || Math.abs(prev.h - r.height) > 0.5) { prev.w = r.width; prev.h = r.height; changed = true; }
				}
				if (changed) window.j0.bus.emit('ipax-backdrop:invalidate', { reason: 'resize' });
			});
		}
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
		const rec = { el, layer, cv, id: ++nextId, ready: false, placed: null, blurPx: 0, hiddenAt: 0, est: null, blurCv: null };
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

	/** READ phase. Touches layout; call it for every record BEFORE any apply(). */
	function measure(rec) {
		const e = rec.el;
		return { l: e.offsetLeft, t: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight };
	}

	/** WRITE phase. Writes styles only when the geometry really changed. */
	function apply(rec, m) {
		const p = rec.placed;
		if (p && p.l === m.l && p.t === m.t && p.w === m.w && p.h === m.h) return;
		const s = rec.layer.style;
		s.left = m.l + 'px'; s.top = m.t + 'px';
		s.width = m.w + 'px'; s.height = m.h + 'px';
		
		// Auditoría de geometría y radio asignado
		/*
		console.log('[ipax-backdrop:debug] apply geometry:', {
			el: rec.el.className,
			geometry: m,
			computedRadius: getComputedStyle(rec.layer).borderRadius
		});
		*/
		
		rec.placed = m;
	}

	function place(rec) { apply(rec, measure(rec)); }

	function resetBlurStyle(rec) {
		if (!rec.blurPx) return;
		rec.cv.style.backdropFilter = '';
		rec.cv.style.webkitBackdropFilter = '';
		rec.blurPx = 0;
	}

	function clear(rec) {
		if (rec.ready && rec.cv.width > 0) rec.cv.getContext('2d').clearRect(0, 0, rec.cv.width, rec.cv.height);
		resetBlurStyle(rec);
		rec.ready = false;
	}

	function draw(rec, w, h, result, blurPx = 0) {
		if (rec.cv.width !== w || rec.cv.height !== h) { rec.cv.width = w; rec.cv.height = h; }
		const ctx = rec.cv.getContext('2d');
		if (result.source instanceof ImageData) ctx.putImageData(result.source, 0, 0);
		else {
			ctx.clearRect(0, 0, w, h);
			const sr = result.srcRect;
			if (sr) ctx.drawImage(result.source, sr.x, sr.y, sr.w, sr.h, 0, 0, w, h);
			else ctx.drawImage(result.source, 0, 0, w, h);
		}

		// Fallback CSS blur for unknown areas or veil coverage (style is only touched when it changes)
		if (blurPx !== rec.blurPx) {
			if (blurPx > 0) {
				const b = 'blur(' + blurPx + 'px)';
				rec.cv.style.backdropFilter = b;
				rec.cv.style.webkitBackdropFilter = b;
			} else {
				rec.cv.style.backdropFilter = '';
				rec.cv.style.webkitBackdropFilter = '';
			}
			rec.blurPx = blurPx;
		}

		rec.ready = true;
		rec.hiddenAt = 0;
	}

	/**
	 * Free the memory held by a record: layer backing store and the scratch
	 * canvases kept by the resolver (rec.est) and the blur (rec.blurCv).
	 * The record is flagged unsettled, so the orchestrator redraws it when it
	 * becomes visible again.
	 */
	function release(rec) {
		rec.cv.width = 0; rec.cv.height = 0;
		rec.est = null;
		rec.blurCv = null;
		rec.ready = false;
		rec.settled = false;
		rec.lastW = 0; rec.lastH = 0;
		rec.blurPx = 0;
		rec.cv.style.backdropFilter = '';
		rec.cv.style.webkitBackdropFilter = '';
	}

	/** Release every record that is not in visibleSet and has been hidden longer than ttlMs. Returns how many. */
	function sweep(visibleSet, ttlMs) {
		const now = performance.now();
		let freed = 0;
		records.forEach((rec) => {
			if (visibleSet.has(rec)) { rec.hiddenAt = 0; return; }
			if (!rec.hiddenAt) { rec.hiddenAt = now; return; }
			if (now - rec.hiddenAt >= ttlMs && (rec.cv.width > 0 || rec.est || rec.blurCv)) { release(rec); freed++; }
		});
		return freed;
	}

	function withHitTesting(rec, fn) {
		const st = rec.layer.style, prev = st.pointerEvents;
		st.pointerEvents = 'auto';
		try { return fn(); } finally { st.pointerEvents = prev; }
	}

	window.j0.register('ipax-backdrop:compositor', {
		ensureStyle, attach, detachAll, recordFor: (el) => records.get(el),
		measure, apply, place, draw, clear, release, sweep, withHitTesting
	});
})();
