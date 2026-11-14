/**
 * ipax-backdrop / 0200-orquestador.js (v0.1.05)
 *
 * Optional keys in config (all have defaults):
 *   frameBudgetMs       12    time spent per frame before yielding to the browser
 *   partialThrottleMs   80    while scrolling, partially visible boxes are recomputed at most this often (0 = every frame)
 *   releaseAfterMs      4000  canvas memory of a box is freed after being out of view this long
 *   probeBlock          4     adaptive probing block (see 2000-resolutor.js; 1 = exact)
 *
 * Invalidation uses an EPOCH counter: invalidateAll() bumps it and every record is recomputed when it
 * is next visible, including records that were off-screen when the change happened (they used to keep
 * stale results). Image loads only invalidate the records that were drawn waiting for an image.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const bus = () => window.j0.bus;
	const emit = (name, payload) => bus().emit('ipax-backdrop:' + name, payload);

	let running = false, pending = false;
	let records = [], visibleRecords = new Set(), offs = [];
	let epoch = 0, lastScrollAt = 0;
	let imgTimer = null, throttleTimer = null, sweepTimer = null;
	const lastMessage = new WeakMap();
	const perfState = new WeakMap();
	let visibilityObserver = null;
	let domObserver = null;

	const clean = (rec) => rec.settled && rec.epoch === epoch;

	function warnOnce(el, message) {
		if (lastMessage.get(el) === message) return;
		lastMessage.set(el, message);
		console.warn('[ipax-backdrop]', message, el);
		emit('warning', { message });
	}

	function schedule() {
		if (!running || pending) return;
		pending = true;
		requestAnimationFrame(() => { pending = false; if (running) runAll(); });
	}

	function invalidateAll() {
		epoch++;
		schedule();
	}

	/** An image finished loading: only records that were drawn while waiting for one need a redo. */
	function onImageLoaded() {
		if (imgTimer) clearTimeout(imgTimer);
		imgTimer = setTimeout(() => {
			imgTimer = null;
			records.forEach((rec) => { if (rec.waitImg) rec.settled = false; });
			schedule();
		}, 50);
	}

	function onScroll() {
		lastScrollAt = performance.now();
		if (!running || pending) return;
		for (const rec of visibleRecords) {
			if (!clean(rec)) { schedule(); return; }
		}
	}

	/** z-index of the nearest ancestor that sets one. Ancestors are shared by many boxes, so they are cached per frame. */
	function zKey(n, cache) {
		if (!n || n.nodeType !== 1) return 0;
		let v = cache.get(n);
		if (v !== undefined) return v;
		const z = parseInt(getComputedStyle(n).zIndex, 10);
		v = isNaN(z) ? zKey(n.parentElement, cache) : z;
		cache.set(n, v);
		return v;
	}

	function runAll() {
		const compositor = svc('compositor'), cfg = svc('config'), Layers = svc('layers');
		const list = Array.from(visibleRecords);
		if (!list.length) return;

		// Phase 1 (all reads), phase 2 (all writes), phase 3 (reads): one layout instead of one per record.
		const geo = list.map((rec) => compositor.measure(rec));
		for (let i = 0; i < list.length; i++) compositor.apply(list[i], geo[i]);

		const vw = window.innerWidth, vh = window.innerHeight, centerY = vh / 2;
		const now = performance.now();
		const scrolling = now - lastScrollAt < 120;
		const thr = cfg.partialThrottleMs !== undefined ? cfg.partialThrottleMs : 80;
		const budget = cfg.frameBudgetMs || 12;
		const zc = new Map();
		const dirty = [];
		let throttled = false;

		for (const rec of list) {
			const R = rec.layer.getBoundingClientRect();
			if (R.width < 4 || R.height < 4) continue;
			if (R.bottom <= 0 || R.top >= vh || R.right <= 0 || R.left >= vw) continue;

			const fullyInView = R.top >= 0 && R.bottom <= vh && R.left >= 0 && R.right <= vw;
			// Strict rounding ignores sub-pixel fluctuations of the CSS engine
			const sizeChanged = Math.abs(Math.round(R.width) - Math.round(rec.lastW)) > 1 ||
				Math.abs(Math.round(R.height) - Math.round(rec.lastH)) > 1;

			if (clean(rec) && !sizeChanged) continue;

			// While scrolling, a box that is only partly visible would be recomputed every frame.
			// It already has a result for this epoch, so it is refreshed at a lower rate instead.
			if (!fullyInView && scrolling && thr > 0 && rec.ready && rec.epoch === epoch && !sizeChanged && now - rec.renderedAt < thr) {
				throttled = true;
				continue;
			}

			// Spatial priority queue: distance to the centre of the viewport
			dirty.push({ r: rec, R, fullyInView, z: zKey(rec.el, zc), distCenter: Math.abs(R.top + R.height / 2 - centerY) });
		}

		if (throttled && !throttleTimer) throttleTimer = setTimeout(() => { throttleTimer = null; schedule(); }, thr);
		if (!dirty.length) return;

		dirty.sort((a, b) => (a.z - b.z) || (a.distCenter - b.distCenter));
		const activeCount = dirty.length;

		// Time-budget queue: process in priority order until the frame budget is used, then yield.
		const t0 = performance.now();
		let processed = 0;
		Layers.beginFrame(); // descriptors and ancestor style queries are shared by every box of this frame
		try {
			for (let i = 0; i < dirty.length; i++) {
				const k = dirty[i];
				try { update(k.r, k.R, k.fullyInView, activeCount); }
				catch (err) {
					console.error('[ipax-backdrop] update error:', err);
					emit('error', { message: String(err && err.message || err) });
				}
				processed++;
				if (performance.now() - t0 > budget) break;
			}
		} finally { Layers.endFrame(); }

		if (processed < dirty.length) schedule();
	}

	function settle(rec, R, fullyInView, ep) {
		rec.lastW = R.width;
		rec.lastH = R.height;
		// update() only runs for records that are not clean, so a partly visible box stays unsettled
		// (it is completed when fully in view) even if it was settled in an older epoch.
		rec.settled = fullyInView;
		rec.epoch = ep;
		rec.renderedAt = performance.now();
	}

	function update(rec, R, fullyInView, activeCount) {
		const t0 = performance.now(), el = rec.el, cfg = svc('config'), ep = epoch;
		const compositor = svc('compositor');

		/*
		console.log('[ipax-backdrop:telemetry] update() ENTER:', {
			tag: el.tagName,
			className: el.className,
			id: el.id || null,
			epoch: ep,
			fullyInView,
			activeCount,
			rect: { left: Math.round(R.left), top: Math.round(R.top), width: Math.round(R.width), height: Math.round(R.height) }
		});
		*/

		const area = R.width * R.height;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const viewportArea = vw * vh;

		if (area > viewportArea) {
			compositor.clear(rec);
			warnOnce(el, 'Element area exceeds viewport area. Bypassing to protect performance.');
			settle(rec, R, true, ep);
			return;
		}

		if (el.querySelector('[' + svc('names').managedAttr + ']')) {
			compositor.clear(rec);
			warnOnce(el, 'Element contains other managed backdrop elements. Bypassing container to prevent recursive/massive evaluation.');
			settle(rec, R, true, ep);
			return;
		}

		const params = svc('reader').readParams(el);
		/*
		console.log('[ipax-backdrop:telemetry] update() PARAMS:', {
			className: el.className,
			text: (el.textContent || '').trim().slice(0, 24),
			ok: params.ok,
			ratio: params.ratio,
			blur: params.blur,
			mode: params.mode
		});
		*/
		if (!params.ok) { compositor.clear(rec); warnOnce(el, params.reason); settle(rec, R, true, ep); return; }
		lastMessage.delete(el);

		if (params.ratio <= 1.05 && params.blur === 0) {
			/* console.log('[ipax-backdrop:telemetry] update() EXIT -> BYPASS:', el.className); */
			compositor.clear(rec);
			settle(rec, R, fullyInView, ep);
			emit('updated', { element: el, ms: performance.now() - t0, backend: 'bypass', stats: null, resolver: null, tainted: false, params, budget: null });
			return;
		}

		const maxScale = Math.min(params.maxPixelScale, window.devicePixelRatio || 1);
		let s = maxScale;

		if (params.performance > 0) {
			let st = perfState.get(el);
			if (!st) { st = { fixedMs: 5.0, pxPerMs: 10000, warmedUp: false }; perfState.set(el, st); }

			let maxP = params.minBudget;

			if (st.warmedUp) {
				const frameBudgetMs = (1000 / params.performance) / (activeCount || 1);
				const availMs = Math.max(0, frameBudgetMs - st.fixedMs);
				const viewportPixels = viewportArea * maxScale * maxScale;
				maxP = Math.max(params.minBudget, Math.min(st.pxPerMs * availMs, viewportPixels));
			}
			s = Math.min(maxScale, Math.sqrt(maxP / area));
		}

		const w = Math.max(1, Math.ceil(R.width * s)), h = Math.max(1, Math.ceil(R.height * s));

		const colors = svc('reader-text').readColors(el, R, params.color);
		if (colors.truncated) warnOnce(el, 'More than ' + svc('limits').maxRuns + ' differently coloured text runs: the extra ones use the base colour.');

		const baseStep = Math.max(4, cfg.cellSize);
		const viewportCells = Math.ceil(vw / baseStep) * Math.ceil(vh / baseStep);
		const localStep = Math.max(baseStep, Math.ceil(Math.sqrt(area / viewportCells)));

		const tA = performance.now();
		const res = svc('resolver').resolve(rec, R, s, w, h, localStep);
		const tB = performance.now();
		/*
		console.log('[ipax-backdrop:telemetry] update() RESOLVED:', {
			className: el.className,
			text: (el.textContent || '').trim().slice(0, 24),
			stats: res.stats,
			why: Array.from(res.why || [])
		});
		*/
		// The record is passed so the blur reuses its output canvas.
		const estBlur = params.blur > 0 ? svc('blur').blur(res.est, w, h, params.blur * s, rec) : null;
		const tC = performance.now();

		const out = svc('kernel').render({ est: res.est, estBlur, grid: res.grid, w, h, s, W: R.width, H: R.height, params, colors });
		const tD = performance.now();
		compositor.draw(rec, w, h, out, params.blur);
		const tE = performance.now();

		// Drawn while an image was still loading: redo it when the image arrives.
		rec.waitImg = !!(res.why && res.why.has('image not loaded'));
		settle(rec, R, fullyInView, ep);

		const ms = tE - t0;
		if (params.performance > 0) {
			let st = perfState.get(el);
			const probeMs = (res.stats && res.stats.probeMs) ? res.stats.probeMs : 0;
			const fixedPart = probeMs > 0 ? probeMs : 5.0;

			if (!st.warmedUp) {
				st.fixedMs = fixedPart;
				st.warmedUp = true;
			} else {
				st.fixedMs = st.fixedMs * 0.8 + fixedPart * 0.2;
				const varMs = ms - fixedPart;
				if (varMs > 0.2) {
					const inst = (w * h) / varMs;
					st.pxPerMs = st.pxPerMs * 0.8 + inst * 0.2;
				}
			}
		}

		emit('updated', {
			element: el, ms, backend: out.backend, stats: out.stats, resolver: res.stats, tainted: !!out.tainted, params, budget: { s, w, h },
			stages: { resolve: tB - tA, blur: tC - tB, kernel: tD - tC, draw: tE - tD }
		});
	}

	function handleIntersection(entries) {
		let changed = false;
		entries.forEach((entry) => {
			const rec = svc('compositor').recordFor(entry.target);
			if (!rec) return;
			if (entry.isIntersecting) {
				if (!visibleRecords.has(rec)) {
					visibleRecords.add(rec);
					if (!clean(rec)) changed = true;
				}
			} else if (visibleRecords.has(rec)) {
				visibleRecords.delete(rec);
			}
		});
		if (changed && running) schedule();
	}

	function attachAll() {
		const compositor = svc('compositor');
		if (!visibilityObserver && typeof IntersectionObserver !== 'undefined') {
			visibilityObserver = new IntersectionObserver(handleIntersection, { rootMargin: '50px 0px' });
		}
		svc('reader').scan().forEach((el) => {
			const rec = compositor.attach(el);
			if (records.indexOf(rec) < 0) {
				rec.settled = false;
				rec.epoch = -1;
				rec.lastW = 0;
				rec.lastH = 0;
				rec.renderedAt = 0;
				rec.waitImg = false;
				records.push(rec);
				if (visibilityObserver) visibilityObserver.observe(el);
				else visibleRecords.add(rec);
			}
		});
	}

	function handleMutations(mutations) {
		if (!running) return;
		const N = svc('names');
		const layerTag = N.layerTag.toUpperCase();
		let dirtyAttr = false, dirtyTree = false;
		for (let i = 0; i < mutations.length; i++) {
			const m = mutations[i], t = m.target;
			if (!t || t.nodeType !== 1) continue;
			if (t.tagName === layerTag || (t.closest && t.closest(N.layerTag))) continue;
			if (m.type === 'attributes') {
				if (m.attributeName === N.managedAttr) continue;
				dirtyAttr = true;
			} else if (m.type === 'childList') {
				for (let j = 0; j < m.addedNodes.length; j++) {
					const n = m.addedNodes[j];
					if (n.nodeType === 1 && n.tagName !== layerTag && !n.hasAttribute('data-ipax-backdrop-style')) { dirtyTree = true; dirtyAttr = true; break; }
				}
				for (let j = 0; j < m.removedNodes.length; j++) {
					const n = m.removedNodes[j];
					if (n.nodeType === 1 && n.tagName !== layerTag) { dirtyTree = true; dirtyAttr = true; break; }
				}
			}
		}
		if (dirtyTree) attachAll();
		if (dirtyAttr) invalidateAll();
	}

	function start() {
		if (running) return;
		running = true;
		const cfg = svc('config');
		svc('compositor').ensureStyle();
		attachAll();
		offs = [bus().on('ipax-backdrop:invalidate', invalidateAll), bus().on('ipax-backdrop:image-loaded', onImageLoaded)];
		window.addEventListener('resize', invalidateAll);
		window.addEventListener('scroll', onScroll, { passive: true });
		if (!domObserver && typeof MutationObserver !== 'undefined' && document.body) {
			domObserver = new MutationObserver(handleMutations);
			domObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', svc('names').markerAttr] });
		}
		// If fonts are already loaded, 'ready' resolves at once and would only force a redundant pass.
		if (document.fonts && document.fonts.ready && document.fonts.status !== 'loaded') document.fonts.ready.then(invalidateAll);
		sweepTimer = setInterval(() => { svc('compositor').sweep(visibleRecords, cfg.releaseAfterMs || 4000); }, 2000);
		emit('ready', {});
		schedule();
	}

	function stop() {
		if (!running) return;
		running = false;
		offs.forEach((off) => off());
		offs = [];
		window.removeEventListener('resize', invalidateAll);
		window.removeEventListener('scroll', onScroll);
		if (domObserver) { domObserver.disconnect(); domObserver = null; }
		if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
		if (imgTimer) { clearTimeout(imgTimer); imgTimer = null; }
		if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
		svc('compositor').detachAll();
		records = [];
		visibleRecords.clear();
		if (visibilityObserver) { visibilityObserver.disconnect(); visibilityObserver = null; }
	}

	function refresh() {
		if (!running) { start(); return; }
		attachAll();
		invalidateAll();
	}

	window.j0.register('ipax-backdrop:orchestrator', { start, stop, refresh, schedule });
})();
