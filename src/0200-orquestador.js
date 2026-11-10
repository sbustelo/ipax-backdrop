/**
 * ipax-backdrop / 0200-orquestador.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 0 - ORCHESTRATOR
 *
 * Owns the life cycle and the per-frame schedule. It contains no pixel maths
 * and no DOM probing: it only decides WHEN to run and in WHAT ORDER, and it
 * wires the stages together through the service registry.
 *
 * Pipeline for every managed element (each stage is a registered service):
 *
 *   compositor.place   geometry of the layer under the element
 *   reader             CSS parameters   -> {ratio, mode, feather, color}
 *   reader-text        text colours     -> {base, runs}
 *   resolver           what is beneath  -> {est (canvas), grid (unknown cells)}
 *   kernel             solve lightness  -> {source (ImageData | canvas), stats}
 *   compositor.draw    paint the result into the layer
 *
 * Elements are processed in paint order (lowest first), because a managed
 * element can sit on top of another managed element's layer and must see its
 * already-computed result as part of "what is beneath".
 *
 * Service 'ipax-backdrop:orchestrator': start(), stop(), refresh(), schedule().
 * Events emitted: ready, updated, warning, error (see 0010-nucleo.js).
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const bus = () => window.j0.bus;
	const emit = (name, payload) => bus().emit('ipax-backdrop:' + name, payload);

	let running = false, pending = false, records = [], offs = [];
	const lastMessage = new WeakMap();

	/** Emit a warning once per element and message (avoids one event per frame). */
	function warnOnce(el, message) {
		if (lastMessage.get(el) === message) return;
		lastMessage.set(el, message);
		emit('warning', { message });
	}

	function schedule() {
		if (!running || pending) return;
		pending = true;
		requestAnimationFrame(() => { pending = false; if (running) runAll(); });
	}

	/** z-index of the nearest ancestor (or self) that has a numeric one. */
	function zKey(el) {
		for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
			const z = parseInt(getComputedStyle(n).zIndex, 10);
			if (!isNaN(z)) return z;
		}
		return 0;
	}

	function runAll() {
		const keyed = records.map((r) => ({ r, z: zKey(r.el) }));
		keyed.sort((a, b) => (a.z - b.z) || (a.r.el.compareDocumentPosition(b.r.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
		keyed.forEach((k) => {
			try { update(k.r); }
			catch (err) { emit('error', { message: String(err && err.message || err) }); }
		});
	}

	function update(rec) {
		const t0 = performance.now(), el = rec.el, cfg = svc('config');
		const compositor = svc('compositor');

		compositor.place(rec);
		const R = rec.layer.getBoundingClientRect();
		if (R.width < 4 || R.height < 4) return; // hidden or collapsed

		const params = svc('reader').readParams(el);
		if (!params.ok) { compositor.clear(rec); warnOnce(el, params.reason); return; }
		lastMessage.delete(el);

		const s = Math.min(1, Math.sqrt(cfg.maxPixels / (R.width * R.height)));
		const w = Math.max(1, Math.ceil(R.width * s)), h = Math.max(1, Math.ceil(R.height * s));

		const colors = svc('reader-text').readColors(el, R, params.color);
		if (colors.truncated) warnOnce(el, 'More than ' + svc('limits').maxRuns + ' differently coloured text runs: the extra ones use the base colour.');

		const res = svc('resolver').resolve(rec, R, s, w, h, Math.max(4, cfg.cellSize));
		const out = svc('kernel').render({ est: res.est, grid: res.grid, w, h, s, W: R.width, H: R.height, params, colors });
		compositor.draw(rec, w, h, out); // must happen right away: a WebGL result is only valid until the next render

		emit('updated', { element: el, ms: performance.now() - t0, backend: out.backend, stats: out.stats, resolver: res.stats, tainted: !!out.tainted, params });
	}

	function attachAll() {
		const compositor = svc('compositor');
		svc('reader').scan().forEach((el) => { const rec = compositor.attach(el); if (records.indexOf(rec) < 0) records.push(rec); });
	}

	function start() {
		if (running) return;
		running = true;
		svc('compositor').ensureStyle();
		attachAll();
		offs = [bus().on('ipax-backdrop:invalidate', schedule), bus().on('ipax-backdrop:image-loaded', schedule)];
		window.addEventListener('resize', schedule);
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
		emit('ready', {});
		schedule();
	}

	function stop() {
		if (!running) return;
		running = false;
		offs.forEach((off) => off());
		offs = [];
		window.removeEventListener('resize', schedule);
		svc('compositor').detachAll();
		records = [];
	}

	/** Re-scan the page (new elements, new rules) and recompute. */
	function refresh() {
		if (!running) { start(); return; }
		attachAll();
		schedule();
	}

	window.j0.register('ipax-backdrop:orchestrator', { start, stop, refresh, schedule });
})();
