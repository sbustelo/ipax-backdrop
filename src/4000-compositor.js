/**
 * ipax-backdrop / 4000-compositor.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 4 - COMPOSITOR: where the result lives in the page.
 *
 * Automatic two-level layer stacking (zero CSS plane configuration required):
 *
 *   Level 1 (Direct siblings / shared stacking context):
 *     <ipax-backdrop-layer aria-hidden="true" style="z-index: 0">...</ipax-backdrop-layer>
 *     <h1 style="...">The managed element (z-index: 1 via :where(), specificity 0)</h1>
 *     Every managed element stays above every sibling backdrop layer while preserving
 *     author z-index overrides, own background, gradients, ::before/::after and text-shadow.
 *
 *   Level 2 (Managed elements enclosed in stacking-context wrappers, e.g. .ed-box[z-index]):
 *     When a managed element sits inside a private stacking-context wrapper, its
 *     <ipax-backdrop-layer> is placed in the wrapper's parent container immediately before
 *     the wrapper (above background elements and any sibling with a lower z-index, and
 *     immediately behind its own wrapper at the same stack level), mirroring wrapper
 *     z-index / opacity / visibility / display.
 *
 * The CSS blur fallback (backdrop-filter, used where the backdrop is unknown) lives on
 * <div data-ipax-backdrop-bf>, which always covers the BOX only, so a halo that goes
 * outside the box never blurs the real page. <canvas> is positioned above it so the
 * kernel's feather-masked blur governs known pixels.
 *
 * PERFORMANCE NOTES (v0.1.05+)
 *   - Placement is split in two phases so a caller that handles many records
 *     can READ all geometry first and WRITE it afterwards (no layout thrashing):
 *       const m = records.map(measure);  records.forEach((r, i) => apply(r, m[i]));
 *     apply() skips style writes when nothing changed (rec.placed cache).
 *   - draw() accepts result.srcRect {x, y, w, h}: a sub-rectangle of a source
 *     canvas that is larger than the target (shared WebGL canvas kept at its
 *     maximum size). Without srcRect the whole source is used.
 *   - release() / sweep() free the canvas memory of layers that have been out
 *     of view for a while.
 *
 * Service 'ipax-backdrop:compositor':
 *   ensureStyle()                    inject the internal stylesheet (idempotent)
 *   attach(el) -> rec                create the layer {el, layer, cv, bf, id, ready, ext, ...}
 *   detach(el)                       remove one layer
 *   detachAll()                      remove every layer and observer
 *   pruneDisconnected() -> rec[]     detach records whose elements were removed from DOM
 *   refreshOrder()                   recompute DOM paint order across all active records
 *   recordFor(el) -> rec | undefined
 *   ownerRecord(el) -> rec | undefined
 *   isWrapper(el) -> boolean
 *   isStageOrAncestor(el) -> boolean
 *   recordsForTarget(el) -> rec[]
 *   layersBelow(rec, R) -> descriptor[]
 *   isAbove(a, b) -> boolean
 *   measure(rec) -> geometry         READ phase
 *   apply(rec, m)                    WRITE phase
 *   setExt(rec, ext) -> boolean
 *   place(rec)
 *   draw(rec, w, h, result, blurPx)
 *   clear(rec)
 *   release(rec)
 *   sweep(visibleSet, ttlMs)
 *   withHitTesting(rec, fn)
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const records = new Map();
	const wrapperToRec = new Map();
	let nextId = 0, observer = null, styleEl = null;

	/**
	 * INTERNAL STYLESHEET (the only CSS this library injects).
	 *   rule 1  managed elements are positioned at z-index 1 (specificity 0, author wins)
	 *   rule 2  the layer is an absolutely positioned, click-through box at z-index 0
	 *   rule 3  the blur element is an absolutely positioned box (covers the element box)
	 *   rule 4  the canvas sits above the blur fallback element and fills the layer
	 */
	function cssText() {
		const N = svc('names');
		return [
			':where([' + N.managedAttr + ']){position:relative;z-index:1}',
			N.layerTag + '{position:absolute;display:block;pointer-events:none;margin:0;padding:0;z-index:0}',
			N.layerTag + '>[data-ipax-backdrop-bf]{position:absolute;display:block;pointer-events:none;margin:0;padding:0;border-radius:inherit}',
			N.layerTag + '>canvas{position:relative;display:block;width:100%;height:100%}'
		].join('\n');
	}

	function ensureStyle() {
		if (styleEl && styleEl.isConnected) return;
		styleEl = document.createElement('style');
		styleEl.setAttribute('data-ipax-backdrop-style', '');
		styleEl.textContent = cssText();
		document.head.appendChild(styleEl);
	}

	function createsStackingContext(el) {
		if (!el || el.nodeType !== 1) return false;
		const cs = getComputedStyle(el);
		if (cs.position !== 'static' && cs.zIndex !== 'auto') return true;
		if (cs.isolation === 'isolate') return true;
		if (parseFloat(cs.opacity) < 1) return true;
		if (cs.transform !== 'none') return true;
		return false;
	}

	/**
	 * Finds the outermost stacking-context wrapper around `el` that contains no other
	 * managed elements. Returns null if `el` participates directly in a shared context.
	 */
	function findWrapper(el) {
		const N = svc('names');
		const managedSel = '[' + N.managedAttr + ']';
		let wrapper = null;
		let curr = el.parentElement;
		while (curr && curr !== document.body && curr !== document.documentElement) {
			const allManaged = curr.querySelectorAll(managedSel);
			if (allManaged.length > 1) break;
			if (createsStackingContext(curr)) wrapper = curr;
			curr = curr.parentElement;
		}
		return wrapper;
	}

	function placeLayer(rec) {
		if (rec.wrapper && rec.stageEl && rec.stageEl.isConnected) {
			if (rec.layer.parentNode !== rec.stageEl || rec.layer.nextSibling !== rec.wrapper) {
				rec.stageEl.insertBefore(rec.layer, rec.wrapper);
			}
			return;
		}
		if (rec.el.parentNode && (rec.layer.parentNode !== rec.el.parentNode || rec.layer.nextSibling !== rec.el)) {
			rec.el.parentNode.insertBefore(rec.layer, rec.el);
		}
		rec.layer.style.zIndex = '';
		rec.layer.style.opacity = '';
		rec.layer.style.visibility = '';
		rec.layer.style.display = '';
	}

	// A ResizeObserver always delivers one notification right after observe(). Treating it as a resize
	// invalidated every record at startup and made the first pass run twice. Only real size changes count.
	const roSizes = new WeakMap();

	function observeTarget(target) {
		if (!target || typeof ResizeObserver === 'undefined') return;
		if (!observer) {
			observer = new ResizeObserver((entries) => {
				for (const en of entries) {
					const r = en.contentRect, prev = roSizes.get(en.target);
					if (!prev) { roSizes.set(en.target, { w: r.width, h: r.height }); continue; } // first notification: baseline only
					if (Math.abs(prev.w - r.width) > 0.5 || Math.abs(prev.h - r.height) > 0.5) {
						prev.w = r.width; prev.h = r.height;
						window.j0.bus.emit('ipax-backdrop:invalidate', { reason: 'resize', target: en.target });
					}
				}
			});
		}
		observer.observe(target);
	}

	function attach(el) {
		const known = records.get(el);
		if (known) return known;
		const N = svc('names');
		el.setAttribute(N.managedAttr, '');
		const layer = document.createElement(N.layerTag), cv = document.createElement('canvas'), bf = document.createElement('div');
		layer.setAttribute('aria-hidden', 'true');
		bf.setAttribute('data-ipax-backdrop-bf', '');
		layer.appendChild(bf);
		layer.appendChild(cv);
		el.parentNode.insertBefore(layer, el);

		const bindWrapper = (targetRec) => {
			const w = findWrapper(targetRec.el);
			const st = w ? w.parentElement : null;
			targetRec.wrapper = w;
			targetRec.stageEl = st;
			if (w && st) {
				wrapperToRec.set(w, targetRec);
				observeTarget(w);
				observeTarget(st);
			}
			placeLayer(targetRec);
		};

		// If an earlier sibling claimed an ancestor of `el` as its private wrapper before `el` was marked,
		// release that stale wrapper binding so both elements resolve against their actual stacking wrappers.
		const displaced = [];
		for (let anc = el.parentElement; anc && anc !== document.body && anc !== document.documentElement; anc = anc.parentElement) {
			const prevRec = wrapperToRec.get(anc);
			if (prevRec && prevRec.el !== el) {
				wrapperToRec.delete(anc);
				prevRec.wrapper = null;
				prevRec.stageEl = null;
				prevRec.placed = null;
				prevRec.settled = false;
				displaced.push(prevRec);
			}
		}

		const rec = {
			el, layer, cv, bf, id: ++nextId, ready: false, placed: null, m: null,
			ext: { l: 0, t: 0, r: 0, b: 0 }, blurPx: 0, hiddenAt: 0,
			est: null, blurCv: null, halo: null,
			wrapper: null, stageEl: null, z: 0, domOrder: 0
		};
		records.set(el, rec);
		observeTarget(el);
		if (el.parentElement) observeTarget(el.parentElement);

		for (let i = 0; i < displaced.length; i++) bindWrapper(displaced[i]);
		bindWrapper(rec);

		return rec;
	}

	function detach(el) {
		const rec = records.get(el);
		if (!rec) return;
		const N = svc('names');
		rec.layer.remove();
		rec.el.removeAttribute(N.managedAttr);
		records.delete(el);
		if (rec.wrapper) wrapperToRec.delete(rec.wrapper);
	}

	function pruneDisconnected() {
		const removed = [];
		records.forEach((rec, el) => {
			if (!el.isConnected) removed.push(rec);
		});
		for (let i = 0; i < removed.length; i++) detach(removed[i].el);
		return removed;
	}

	function detachAll() {
		const N = svc('names');
		records.forEach((rec) => { rec.layer.remove(); rec.el.removeAttribute(N.managedAttr); });
		records.clear();
		wrapperToRec.clear();
		if (observer) { observer.disconnect(); observer = null; }
	}

	function refreshOrder() {
		const list = Array.from(records.values());
		list.sort((a, b) => {
			if (a.el === b.el) return 0;
			const pos = a.el.compareDocumentPosition(b.el);
			return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
		});
		for (let i = 0; i < list.length; i++) list[i].domOrder = i;
	}

	function ownerRecord(el) {
		let curr = el;
		while (curr && curr !== document.body && curr !== document.documentElement) {
			const r = records.get(curr) || wrapperToRec.get(curr);
			if (r) return r;
			curr = curr.parentElement;
		}
		return undefined;
	}

	function isWrapper(el) {
		return wrapperToRec.has(el);
	}

	function isStageOrAncestor(el) {
		if (!el || el.nodeType !== 1) return false;
		for (const rec of records.values()) {
			const st = rec.stageEl;
			if (st && (st === el || el.contains(st))) return true;
		}
		return false;
	}

	function recordsForTarget(target) {
		if (!target || target.nodeType !== 1) return [];
		const direct = records.get(target) || wrapperToRec.get(target);
		if (direct) return [direct];
		const N = svc('names');
		const host = target.closest && target.closest('[' + N.managedAttr + ']');
		if (host && records.has(host)) return [records.get(host)];
		const out = [];
		records.forEach((rec) => {
			if (target.contains(rec.el)) out.push(rec);
		});
		return out;
	}

	function isAbove(a, b) {
		if (a.z !== b.z) return a.z > b.z;
		return a.domOrder > b.domOrder;
	}

	function layersBelow(rec, R) {
		const out = [];
		records.forEach((other) => {
			if (other === rec || !other.ready || other.cv.width <= 0 || other.cv.height <= 0) return;
			if (other.layer.parentNode !== rec.layer.parentNode) return;
			if (other.z > rec.z || (other.z === rec.z && other.domOrder >= rec.domOrder)) return;
			const or = other.layer.getBoundingClientRect();
			if (or.width <= 0 || or.height <= 0) return;
			if (or.left >= R.right || or.right <= R.left || or.top >= R.bottom || or.bottom <= R.top) return;
			out.push({
				id: 1e6 + other.id,
				k: 'lay',
				cv: other.cv,
				r: or,
				a: 1,
				nocut: true,
				z: other.z,
				domOrder: other.domOrder
			});
		});
		out.sort((a, b) => (a.z - b.z) || (a.domOrder - b.domOrder));
		return out;
	}

	/** READ phase. Touches layout; call it for every record BEFORE any apply(). */
	function measure(rec) {
		const e = rec.el;

		if (rec.wrapper && rec.stageEl) {
			const er = e.getBoundingClientRect();
			const sr = rec.stageEl.getBoundingClientRect();
			const sw = rec.stageEl.offsetWidth, sh = rec.stageEl.offsetHeight;
			const sx = sw > 0 ? sr.width / sw : 1;
			const sy = sh > 0 ? sr.height / sh : 1;
			const padL = rec.stageEl.clientLeft * sx;
			const padT = rec.stageEl.clientTop * sy;
			const wcs = getComputedStyle(rec.wrapper);
			const wz = parseInt(wcs.zIndex, 10);
			const z = !isNaN(wz) ? wz : 0;
			return {
				l: (er.left - sr.left - padL) / sx,
				t: (er.top - sr.top - padT) / sy,
				w: er.width / sx,
				h: er.height / sy,
				z,
				wz,
				op: wcs.opacity,
				vis: wcs.visibility,
				disp: wcs.display
			};
		}

		const ecs = getComputedStyle(e);
		const ez = parseInt(ecs.zIndex, 10);
		return {
			l: e.offsetLeft,
			t: e.offsetTop,
			w: e.offsetWidth,
			h: e.offsetHeight,
			z: !isNaN(ez) ? ez : 0,
			wz: NaN,
			op: '',
			vis: '',
			disp: ''
		};
	}

	/** WRITE phase. Writes styles only when the geometry or stacking really changed. */
	function apply(rec, m) {
		rec.m = m;
		rec.z = m.z;
		placeLayer(rec);

		const isWrapped = !!(rec.wrapper && rec.stageEl);
		const x = rec.ext, l = m.l - x.l, t = m.t - x.t, w = m.w + x.l + x.r, h = m.h + x.t + x.b;
		const zStr = isWrapped ? (isNaN(m.wz) ? '' : String(m.wz)) : '';
		const opStr = isWrapped ? m.op : '';
		const visStr = isWrapped ? m.vis : '';
		const dispStr = isWrapped ? (m.disp === 'none' ? 'none' : '') : '';

		const p = rec.placed;
		if (
			p &&
			p.l === l && p.t === t && p.w === w && p.h === h &&
			p.bl === x.l && p.bt === x.t && p.bw === m.w && p.bh === m.h &&
			p.z === zStr && p.op === opStr && p.vis === visStr && p.disp === dispStr
		) {
			return;
		}

		const s = rec.layer.style;
		s.left = l + 'px'; s.top = t + 'px';
		s.width = w + 'px'; s.height = h + 'px';
		if (isWrapped) {
			if (s.zIndex !== zStr) s.zIndex = zStr;
			if (s.opacity !== opStr) s.opacity = opStr;
			if (s.visibility !== visStr) s.visibility = visStr;
			if (s.display !== dispStr) s.display = dispStr;
		}

		const b = rec.bf.style; // the blur element covers the box only
		b.left = x.l + 'px'; b.top = x.t + 'px';
		b.width = m.w + 'px'; b.height = m.h + 'px';

		rec.placed = { l, t, w, h, bl: x.l, bt: x.t, bw: m.w, bh: m.h, z: zStr, op: opStr, vis: visStr, disp: dispStr };
	}

	/** Change how far the layer grows beyond the box. Returns true if it changed (the layer rect must be re-read). */
	function setExt(rec, ext) {
		const x = rec.ext;
		if (x.l === ext.l && x.t === ext.t && x.r === ext.r && x.b === ext.b) return false;
		rec.ext = { l: ext.l, t: ext.t, r: ext.r, b: ext.b };
		if (rec.m) apply(rec, rec.m);
		return true;
	}

	function place(rec) { apply(rec, measure(rec)); }

	function resetBlurStyle(rec) {
		if (!rec.blurPx) return;
		rec.bf.style.backdropFilter = '';
		rec.bf.style.webkitBackdropFilter = '';
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
				rec.bf.style.backdropFilter = b;
				rec.bf.style.webkitBackdropFilter = b;
			} else {
				rec.bf.style.backdropFilter = '';
				rec.bf.style.webkitBackdropFilter = '';
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
		rec.halo = null;
		rec.ready = false;
		rec.settled = false;
		rec.lastW = 0; rec.lastH = 0;
		resetBlurStyle(rec);
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
		return fn();
	}

	window.j0.register('ipax-backdrop:compositor', {
		ensureStyle, attach, detach, detachAll, pruneDisconnected, refreshOrder,
		recordFor: (el) => records.get(el), ownerRecord, isWrapper, isStageOrAncestor,
		recordsForTarget, layersBelow, isAbove,
		measure, apply, setExt, place, draw, clear, release, sweep, withHitTesting
	});
})();