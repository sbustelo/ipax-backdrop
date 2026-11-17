/**
 * ipax-backdrop / 0200-orquestador.js (v0.1.10)
 *
 * CHAPTER 0 - ORCHESTRATOR: schedules and runs the per-frame pipeline.
 *
 * Optional keys in config:
 *   frameBudgetMs       12    time spent per frame before yielding to the browser
 *   partialThrottleMs   80    while scrolling, partially visible boxes are recomputed at most this often
 *   releaseAfterMs      4000  canvas memory of a box is freed after being out of view this long
 *   probeBlock          4     adaptive probing block (see 2000-resolutor.js; 1 = exact)
 *   haloMaxExtend       400   how far (CSS px, per side) --ipax-text may grow the layer beyond the box
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const bus = () => window.j0.bus;
	const emit = (name, payload) => bus().emit('ipax-backdrop:' + name, payload);

	const ZERO_RECT = { left: 0, top: 0 };
	const ZERO_EXT = { l: 0, t: 0, r: 0, b: 0 };

	let running = false, pending = false;
	let records = [], visibleRecords = new Set(), offs = [];
	let epoch = 0, lastScrollAt = 0;
	let imgTimer = null, throttleTimer = null, scrollEndTimer = null, sweepTimer = null;
	const lastMessage = new WeakMap();
	const perfState = new WeakMap();
	let visibilityObserver = null;
	let domObserver = null;

	const clean = (rec) => rec.settled && rec.epoch === epoch;

	const rectsOverlap = (a, b) => !!(
		a && b &&
		a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
		a.left < b.right && a.right > b.left &&
		a.top < b.bottom && a.bottom > b.top
	);

	const copyRect = (r) => ({
		left: r.left,
		top: r.top,
		right: r.right,
		bottom: r.bottom,
		width: r.width,
		height: r.height
	});

	function compareOrder(a, b) {
		if (a.z !== b.z) return a.z - b.z;
		return a.domOrder - b.domOrder;
	}

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

	function unsettleRecord(rec) {
		rec.settled = false;
	}

	function unsettleOverlapping(rect, minZ) {
		let hit = false;
		for (let i = 0; i < records.length; i++) {
			const rec = records[i];
			if (minZ !== undefined && rec.z < minZ) continue;
			if (rectsOverlap(rect, rec.rect) || rectsOverlap(rect, rec.prevRect)) {
				rec.settled = false;
				hit = true;
			}
		}
		return hit;
	}

	function invalidateAll(payload) {
		const compositor = svc('compositor');
		if (payload && payload.target && compositor && compositor.recordsForTarget) {
			const affected = compositor.recordsForTarget(payload.target);
			if (affected.length) {
				for (let i = 0; i < affected.length; i++) affected[i].settled = false;
				schedule();
				return;
			}
		}
		epoch++;
		schedule();
	}

	function onImageLoaded() {
		if (imgTimer) clearTimeout(imgTimer);
		imgTimer = setTimeout(() => {
			imgTimer = null;
			records.forEach((rec) => {
				if (rec.waitImg) {
					rec.settled = false;
					rec.renderedAt = 0;
				}
			});
			schedule();
		}, 50);
	}

	function onScroll() {
		lastScrollAt = performance.now();
		if (!running) return;
		if (scrollEndTimer) clearTimeout(scrollEndTimer);
		scrollEndTimer = setTimeout(() => {
			scrollEndTimer = null;
			if (!running) return;
			for (const rec of visibleRecords) {
				if (!clean(rec)) { schedule(); return; }
			}
		}, 130);
		if (pending) return;
		for (const rec of visibleRecords) {
			if (!clean(rec)) { schedule(); return; }
		}
	}

	function runAll() {
		const compositor = svc('compositor'), cfg = svc('config'), Layers = svc('layers');
		const list = Array.from(visibleRecords);
		if (!list.length) return;

		const geo = list.map((rec) => compositor.measure(rec));
		for (let i = 0; i < list.length; i++) compositor.apply(list[i], geo[i]);

		const vw = window.innerWidth, vh = window.innerHeight;
		const now = performance.now();
		const scrolling = now - lastScrollAt < 120;
		const thr = cfg.partialThrottleMs !== undefined ? cfg.partialThrottleMs : 80;
		const budget = cfg.frameBudgetMs || 12;
		const entries = [];
		const dirtySet = new Set();
		let throttled = false;

		for (let i = 0; i < list.length; i++) {
			const rec = list[i];
			const R = rec.layer.getBoundingClientRect();
			if (R.width < 4 || R.height < 4) continue;
			if (R.bottom <= 0 || R.top >= vh || R.right <= 0 || R.left >= vw) continue;

			const fullyInView = R.top >= 0 && R.bottom <= vh && R.left >= 0 && R.right <= vw;
			const sizeChanged = Math.abs(Math.round(R.width) - Math.round(rec.lastW)) > 1 ||
				Math.abs(Math.round(R.height) - Math.round(rec.lastH)) > 1;
			const posChanged = Math.abs(R.left - rec.lastL) > 0.5 ||
				Math.abs(R.top - rec.lastT) > 0.5;
			const zChanged = geo[i].z !== rec.z;

			rec.z = geo[i].z;
			const item = { r: rec, R, fullyInView, z: rec.z, domOrder: rec.domOrder, zChanged };
			entries.push(item);

			const isDirty = !clean(rec) || sizeChanged || posChanged || zChanged;
			if (!isDirty) {
				rec.rect = copyRect(R);
				continue;
			}

			if (!fullyInView && scrolling && thr > 0 && rec.ready && rec.epoch === epoch && !sizeChanged && !posChanged && !zChanged && now - rec.renderedAt < thr) {
				throttled = true;
				continue;
			}

			rec.settled = false;
			dirtySet.add(rec);
		}

		if (throttled && !throttleTimer) throttleTimer = setTimeout(() => { throttleTimer = null; schedule(); }, thr);
		if (!dirtySet.size) return;

		entries.sort(compareOrder);

		for (let i = 0; i < entries.length; i++) {
			const src = entries[i];
			if (!dirtySet.has(src.r)) continue;
			const rOld = src.r.prevRect || src.r.rect;
			const rNew = src.R;
			for (let j = i + 1; j < entries.length; j++) {
				const upper = entries[j];
				if (dirtySet.has(upper.r)) continue;
				if (rectsOverlap(rOld, upper.R) || rectsOverlap(rNew, upper.R)) {
					upper.r.settled = false;
					dirtySet.add(upper.r);
				}
			}
			if (src.zChanged) {
				for (let j = 0; j < i; j++) {
					const lower = entries[j];
					if (dirtySet.has(lower.r)) continue;
					if (rectsOverlap(rOld, lower.R) || rectsOverlap(rNew, lower.R)) {
						lower.r.settled = false;
						dirtySet.add(lower.r);
					}
				}
			}
		}

		const dirty = entries.filter((item) => dirtySet.has(item.r));
		if (dirty.length > 1) {
			dirty.sort((a, b) => (a.r.renderedAt - b.r.renderedAt) || compareOrder(a, b));
			for (let i = 1; i < dirty.length; i++) {
				const cur = dirty[i];
				let insertAt = i;
				for (let j = 0; j < i; j++) {
					const prev = dirty[j];
					if (compareOrder(cur, prev) < 0 && rectsOverlap(cur.R, prev.R)) {
						insertAt = j;
						break;
					}
				}
				if (insertAt < i) {
					dirty.splice(i, 1);
					dirty.splice(insertAt, 0, cur);
				}
			}
		}
		const activeCount = dirty.length;

		const t0 = performance.now();
		let processed = 0;
		Layers.beginFrame();
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
		rec.lastL = R.left;
		rec.lastT = R.top;
		rec.lastW = R.width;
		rec.lastH = R.height;
		const snap = copyRect(R);
		rec.rect = snap;
		rec.prevRect = snap;
		rec.settled = fullyInView;
		rec.epoch = ep;
		rec.renderedAt = performance.now();
	}

	function update(rec, R, fullyInView, activeCount) {
		const t0 = performance.now(), el = rec.el, cfg = svc('config'), ep = epoch;
		const compositor = svc('compositor'), Halo = svc('halo');

		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const viewportArea = vw * vh;

		if (R.width * R.height > viewportArea) {
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
		if (!params.ok) { compositor.clear(rec); warnOnce(el, params.reason); settle(rec, R, true, ep); return; }
		if (params.warnings && params.warnings.length) warnOnce(el, params.warnings.join(' '));
		else lastMessage.delete(el);

		const reExt = (ext) => { if (compositor.setExt(rec, ext)) R = rec.layer.getBoundingClientRect(); };

		const tp = params.text;
		const textOn = tp && tp.on && (tp.ratio > 1 || tp.blur > 0);
		const boxCover = params.ratio > 1 || params.blur > 0;

		if (!textOn && params.ratio <= 1.05 && params.blur === 0) {
			reExt(ZERO_EXT);
			compositor.clear(rec);
			settle(rec, R, fullyInView, ep);
			emit('updated', { element: el, ms: performance.now() - t0, backend: 'bypass', stats: null, resolver: null, tainted: false, params, budget: null });
			return;
		}

		const tH0 = performance.now();
		const colors = svc('reader-text').readColors(el, ZERO_RECT, params.color, textOn);
		if (colors.truncated) warnOnce(el, 'More than ' + svc('limits').maxRuns + ' differently coloured text runs: the extra ones use the base colour.');

		let reach = 0;
		if (textOn) {
			const x = rec.ext;
			const E = { left: R.left + x.l, top: R.top + x.t, right: R.right - x.r, bottom: R.bottom - x.b };
			const ext = Halo.extent(colors.texts, tp, E, cfg.haloMaxExtend || 400, x);
			reach = ext.reach;
			reExt(ext);
			if (R.width * R.height > viewportArea) {
				compositor.clear(rec);
				warnOnce(el, 'Element area plus its --ipax-text reach exceeds viewport area. Bypassing to protect performance.');
				settle(rec, R, true, ep);
				return;
			}
			if (tp.mode === 'tricontrast' && tp.ratio > 1 && !svc('contrast').band(tp.ratio).ok) {
				if (!rec.bandWarned) { rec.bandWarned = true; warnOnce(el, '--ipax-text contrast ' + tp.ratio.toFixed(1) + ' is above the tricontrast limit (about 4.5): the text contour cannot reach it in this mode.'); }
			} else rec.bandWarned = false;
		} else reExt(ZERO_EXT);

		const dx = -R.left, dy = -R.top;
		for (const r of colors.runs) { r.x0 += dx; r.x1 += dx; r.y0 += dy; r.y1 += dy; }
		if (colors.texts) for (const t of colors.texts) { t.x0 += dx; t.x1 += dx; t.y0 += dy; t.y1 += dy; }
		const ox = rec.ext.l, oy = rec.ext.t, bw = R.width - rec.ext.l - rec.ext.r, bh = R.height - rec.ext.t - rec.ext.b;

		const area = R.width * R.height;
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

		const baseStep = Math.max(4, params.cellSize || cfg.cellSize);
		const viewportCells = Math.ceil(vw / baseStep) * Math.ceil(vh / baseStep);
		const areaStep = Math.min(baseStep * 2, Math.round(Math.sqrt(area) / 22));
		const localStep = Math.max(baseStep, areaStep, Math.ceil(Math.sqrt(area / viewportCells)));

		let haloIn = null, active;
		if (textOn) {
			const mask = Halo.mask(rec, colors.texts, tp, R.width, R.height, s);
			haloIn = {
				ratio: tp.ratio,
				mode: tp.mode,
				blur: tp.blur,
				shared: tp.ratio === params.ratio && tp.mode === params.mode,
				mask
			};
			const nx = Math.ceil(R.width / localStep), ny = Math.ceil(R.height / localStep);
			active = Halo.activeCells(colors.texts, tp, ox, oy, bw, bh, nx, ny, localStep, boxCover);
		}

		const tA = performance.now();
		const res = svc('resolver').resolve(rec, R, s, w, h, localStep, active);
		const tB = performance.now();

		const boxBlur = boxCover ? params.blur : 0;
		const textBlur = textOn ? tp.blur : 0;
		const maxBlur = Math.max(boxBlur, textBlur);
		const estBlur = maxBlur > 0 ? svc('blur').blur(res.est, w, h, maxBlur * s, rec) : null;
		const tC = performance.now();

		const out = svc('kernel').render({
			est: res.est, estBlur, grid: res.grid, w, h, s, W: bw, H: bh, ox, oy, params, colors,
			halo: haloIn, boxCover, boxBlur, textBlur, maxBlur, infl: Math.max(6, reach)
		});
		const tD = performance.now();
		compositor.draw(rec, w, h, out, boxBlur);
		const tE = performance.now();

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
			halo: textOn ? { ext: { l: rec.ext.l, t: rec.ext.t, r: rec.ext.r, b: rec.ext.b }, reach } : null,
			stages: { read: tA - tH0, resolve: tB - tA, blur: tC - tB, kernel: tD - tC, draw: tE - tD }
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
		const removed = compositor.pruneDisconnected ? compositor.pruneDisconnected() : [];
		if (removed.length) {
			records = records.filter((r) => removed.indexOf(r) < 0);
			for (let i = 0; i < removed.length; i++) {
				visibleRecords.delete(removed[i]);
				if (removed[i].prevRect) unsettleOverlapping(removed[i].prevRect, removed[i].z);
			}
		}
		if (!visibilityObserver && typeof IntersectionObserver !== 'undefined') {
			visibilityObserver = new IntersectionObserver(handleIntersection, { rootMargin: '50px 0px' });
		}
		svc('reader').scan().forEach((el) => {
			const rec = compositor.attach(el);
			if (records.indexOf(rec) < 0) {
				rec.settled = false;
				rec.epoch = -1;
				rec.lastL = 0;
				rec.lastT = 0;
				rec.lastW = 0;
				rec.lastH = 0;
				rec.rect = null;
				rec.prevRect = null;
				rec.z = 0;
				rec.domOrder = 0;
				rec.renderedAt = 0;
				rec.waitImg = false;
				records.push(rec);
				if (visibilityObserver) visibilityObserver.observe(el);
				else visibleRecords.add(rec);
			}
		});
		if (compositor.refreshOrder) compositor.refreshOrder();
	}

	function handleMutations(mutations) {
		if (!running) return;
		const N = svc('names'), comp = svc('compositor');
		const layerTag = N.layerTag.toUpperCase(), planeTag = (N.planeTag || 'ipax-backdrop-plane').toUpperCase();
		const hostSel = '[' + N.managedAttr + ']';
		let dirtyGlobal = false, dirtyTree = false, local = false;

		for (let i = 0; i < mutations.length; i++) {
			const m = mutations[i], t = m.target;
			if (!t) continue;

			if (m.type === 'characterData') {
				const pe = t.parentElement;
				if (!pe || pe.closest(N.layerTag) || pe.closest(planeTag)) continue;
				const host = pe.closest(hostSel), rec = host && comp.recordFor(host);
				if (rec) { unsettleRecord(rec); local = true; }
				continue;
			}

			if (t.nodeType !== 1) continue;
			if (t.tagName === layerTag || t.tagName === planeTag || (t.closest && (t.closest(N.layerTag) || t.closest(planeTag)))) continue;

			if (m.type === 'attributes') {
				if (m.attributeName === N.managedAttr) continue;
				const affected = comp.recordsForTarget ? comp.recordsForTarget(t) : [];
				if (affected.length) {
					for (let j = 0; j < affected.length; j++) unsettleRecord(affected[j]);
					local = true;
					continue;
				}
				if (t === document.documentElement || t === document.body) {
					dirtyGlobal = true;
					continue;
				}
				const tr = t.getBoundingClientRect();
				if (tr.width > 0 && tr.height > 0 && unsettleOverlapping(tr)) local = true;
			} else if (m.type === 'childList') {
				const host = t.closest(hostSel), rec = host && comp.recordFor(host);
				if (rec) { unsettleRecord(rec); local = true; continue; }
				for (let j = 0; j < m.addedNodes.length; j++) {
					const n = m.addedNodes[j];
					if (n.nodeType === 1 && n.tagName !== layerTag && n.tagName !== planeTag && !n.hasAttribute('data-ipax-backdrop-style')) {
						dirtyTree = true;
						break;
					}
				}
				for (let j = 0; j < m.removedNodes.length; j++) {
					const n = m.removedNodes[j];
					if (n.nodeType === 1 && n.tagName !== layerTag && n.tagName !== planeTag) {
						dirtyTree = true;
						break;
					}
				}
				if (!dirtyTree && t !== document.documentElement && t !== document.body) {
					const tr = t.getBoundingClientRect();
					if (tr.width > 0 && tr.height > 0 && unsettleOverlapping(tr)) local = true;
				}
			}
		}
		if (dirtyTree) { attachAll(); local = true; }
		if (dirtyGlobal) invalidateAll();
		else if (local) schedule();
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
			domObserver.observe(document.body, {
				subtree: true,
				childList: true,
				characterData: true,
				attributes: true,
				attributeFilter: ['style', 'class', svc('names').markerAttr, svc('names').textMarkerAttr]
			});
		}
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
		if (scrollEndTimer) { clearTimeout(scrollEndTimer); scrollEndTimer = null; }
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