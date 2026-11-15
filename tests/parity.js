/**
 * ipax-backdrop / test/parity.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser parity test: the CPU kernel and the WebGL kernel must give the same picture.
 * It uses the real services from src/ through the j0 registry, with real canvases.
 * Open test/parity.html (any browser, file:// works). The outcome is also stored in
 * window.__parityResult = {pass, skipped, env, rows, guarantees} for automation.
 */
(function () {
	'use strict';

	const j0 = window.j0;
	const S = (n) => j0.get('ipax-backdrop:' + n);
	const root = document.querySelector('[data-ref="root"]');
	const ref = (n) => root.querySelector('[data-ref="' + n + '"]');

	S('config').autoStart = false; // this page tests the kernels, it does not need the page scanner

	/* ---------- fixtures: odd sizes on purpose (texture alignment), a gradient plus noise (orientation) ---------- */
	const W = 97, H = 61, CELL = 12, NX = Math.ceil(W / CELL), NY = Math.ceil(H / CELL);
	const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

	function makeEst(seed, saturated) {
		const r = rng(seed), cv = document.createElement('canvas');
		cv.width = W; cv.height = H;
		const ctx = cv.getContext('2d'), id = ctx.createImageData(W, H);
		for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
			const q = (y * W + x) * 4, base = 40 + 170 * (x / W) * 0.6 + 170 * (y / H) * 0.4;
			for (let k = 0; k < 3; k++) id.data[q + k] = Math.max(0, Math.min(255, (saturated ? base * (0.4 + 1.2 * r()) : base) + (r() - 0.5) * 30));
			id.data[q + 3] = 255;
		}
		ctx.putImageData(id, 0, 0);
		return cv;
	}
	function makeInput(est, mode, ratio, base, runs, feather, unknown, sigma) {
		const V = new Uint8Array(NX * NY);
		if (unknown === true) { const r = rng(77); for (let i = 0; i < V.length; i++) V[i] = r() < 0.3 ? 1 : 0; }
		else if (unknown === 'all') V.fill(1);
		const estBlur = est && sigma ? S('blur').blur(est, W, H, sigma) : null;
		return { est, estBlur, grid: { V, nx: NX, ny: NY, g: CELL }, w: W, h: H, s: 1, W, H, params: { ratio, mode, feather, blur: sigma || 0 }, colors: { base, runs } };
	}

	const E1 = makeEst(11, true), E2 = makeEst(12, true), E3 = makeEst(31, true);
	const SCENARIOS = [
		['default 4.5, white text, no feather', makeInput(E1, 'default', 4.5, [255, 255, 255], [], 0, false)],
		['default 4.5 + black run + feather 14 + unknown cells', makeInput(E1, 'default', 4.5, [255, 255, 255], [{ x0: 10, y0: 10, x1: 50, y1: 30, c: [0, 0, 0] }], 14, true)],
		['default 7, black text, two runs, unknown cells', makeInput(E2, 'default', 7, [0, 0, 0], [{ x0: 5, y0: 5, x1: 30, y1: 25, c: [255, 255, 255] }, { x0: 40, y0: 30, x1: 90, y1: 50, c: [255, 214, 86] }], 8, true)],
		['tricontrast 3, feather 10, unknown cells', makeInput(E1, 'tricontrast', 3, [255, 255, 255], [], 10, true)],
		['tricontrast 4.5', makeInput(E1, 'tricontrast', 4.5, [255, 255, 255], [], 0, false)],
		['no estimate (cross-origin image): veil only', makeInput(null, 'default', 4.5, [255, 255, 255], [], 12, 'all')],
		['directional feather {top 30, left 10} + unknown + run', makeInput(E3, 'default', 4.5, [255, 255, 255], [{ x0: 10, y0: 12, x1: 60, y1: 32, c: [0, 0, 0] }], { top: 30, right: 0, bottom: 0, left: 10 }, true)],
		['directional feather, four different values, tricontrast 3', makeInput(E3, 'tricontrast', 3, [255, 255, 255], [], { top: 5, right: 20, bottom: 12, left: 30 }, true)],
		['blur sigma 3 + feather 14', makeInput(E3, 'default', 4.5, [255, 255, 255], [], 14, false, 3)],
		['blur sigma 5 + directional feather + unknown + run', makeInput(E1, 'default', 4.5, [255, 255, 255], [{ x0: 8, y0: 8, x1: 40, y1: 28, c: [0, 0, 0] }], { top: 25, right: 0, bottom: 10, left: 0 }, true, 5)],
		['bypass (ratio 1), no blur', makeInput(E1, 'default', 1, [255, 255, 255], [], 14, true)],
		['bypass (ratio 1) + blur 4 + feather top 30: progressive blur', makeInput(E2, 'default', 1, [255, 255, 255], [], { top: 30, right: 0, bottom: 0, left: 0 }, false, 4)],
		['bypass + blur + unknown cells', makeInput(E2, 'default', 0.5, [0, 0, 0], [], 10, true, 3)]
	];
	// Contrast guarantee checks on the GPU output (white text; measured over both worst-case backdrops)
	const GUARANTEES = [
		['default 4.5', makeInput(makeEst(3, true), 'default', 4.5, [255, 255, 255], [], 0, false), 'default', 4.5],
		['default 4.5 + blur 3', makeInput(makeEst(3, true), 'default', 4.5, [255, 255, 255], [], 0, false, 3), 'default', 4.5],
		['default 4.5, all cells unknown (veil)', makeInput(makeEst(3, true), 'default', 4.5, [255, 255, 255], [], 0, 'all'), 'default', 4.5],
		['tricontrast 3', makeInput(makeEst(3, true), 'tricontrast', 3, [255, 255, 255], [], 0, false), 'tricontrast', 3],
		['tricontrast 4.5', makeInput(makeEst(3, true), 'tricontrast', 4.5, [255, 255, 255], [], 0, false), 'tricontrast', 4.5]
	];

	/* ---------- helpers ---------- */
	function compositeOver(result, bg) { // returns RGBA pixels of `result` drawn over a flat backdrop
		const cv = document.createElement('canvas');
		cv.width = W; cv.height = H;
		const ctx = cv.getContext('2d');
		ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
		const sr = result.srcRect;
		if (sr) ctx.drawImage(result.source, sr.x, sr.y, sr.w, sr.h, 0, 0, W, H);
		else ctx.drawImage(result.source, 0, 0);
		return ctx.getImageData(0, 0, W, H).data;
	}
	function cpuCanvas(imageData) {
		const cv = document.createElement('canvas');
		cv.width = W; cv.height = H;
		cv.getContext('2d').putImageData(imageData, 0, 0);
		return cv;
	}
	/** Render both backends and composite each over black and white. The WebGL canvas is only valid until the next render. */
	function renderBoth(input) {
		const cpu = S('kernel-cpu').render(input);
		const cpuCv = cpuCanvas(cpu.source);
		const gpu = S('kernel-webgl').render(input);
		const out = { cpu: {}, gpu: {} };
		for (const [name, bg] of [['black', '#000'], ['white', '#fff']]) { out.gpu[name] = compositeOver(gpu, bg); out.cpu[name] = compositeOver({ source: cpuCv }, bg); }
		return out;
	}
	function compare(input) {
		const r = renderBoth(input);
		let max = 0, o2 = 0, o8 = 0, tot = 0;
		for (const bg of ['black', 'white']) {
			const a = r.cpu[bg], b = r.gpu[bg];
			for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) { const d = Math.abs(a[i + k] - b[i + k]); if (d > max) max = d; if (d > 2) o2++; if (d > 8) o8++; tot++; }
		}
		return { max, o2, o8, tot, pass: o8 === 0 && o2 / tot < 0.01 };
	}
	function guarantee(input, mode, target) {
		const C = S('color'), K = S('contrast'), r = renderBoth(input), g = r.gpu;
		let min = Infinity, bad = 0;
		for (let i = 0; i < g.black.length; i += 4) {
			let worst = Infinity;
			for (const bg of ['black', 'white']) {
				const y = C.luminance(C.LUT[g[bg][i]], C.LUT[g[bg][i + 1]], C.LUT[g[bg][i + 2]]);
				worst = Math.min(worst, mode === 'tricontrast' ? Math.min(K.ratio(1, y), K.ratio(0, y)) : K.ratio(1, y));
			}
			if (worst < min) min = worst;
			if (worst < target - 1e-6) bad++;
		}
		return { min, bad, pass: bad === 0 };
	}

	/* ---------- page ---------- */
	function cell(text, cls) { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; return td; }
	function environment() {
		let renderer = 'unknown';
		try {
			const gl = document.createElement('canvas').getContext('webgl'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
			if (gl) renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
		} catch (e) { /* ignore */ }
		return { userAgent: navigator.userAgent, renderer, devicePixelRatio: window.devicePixelRatio };
	}

	function run() {
		const banner = ref('banner'), rows = ref('rows'), grows = ref('grows');
		rows.textContent = ''; grows.textContent = '';
		const env = environment(), GL = S('kernel-webgl');
		ref('env').textContent = env.userAgent + ' | WebGL renderer: ' + env.renderer + ' | DPR ' + env.devicePixelRatio;
		const result = { pass: false, skipped: false, env, rows: [], guarantees: [] };
		if (!GL.available()) {
			banner.textContent = 'SKIPPED: WebGL is not available (' + GL.reason() + '). Nothing to compare.';
			banner.className = 'pt-banner pt-banner-skip';
			result.skipped = true; window.__parityResult = result; return;
		}
		let allPass = true;
		for (const [name, input] of SCENARIOS) {
			const r = compare(input); allPass = allPass && r.pass; result.rows.push({ name, max: r.max, o2: r.o2, o8: r.o8, tot: r.tot, pass: r.pass });
			const tr = document.createElement('tr');
			tr.append(cell(name), cell(String(r.max), 'pt-num'), cell(r.o2 + ' / ' + r.tot, 'pt-num'), cell(String(r.o8), 'pt-num'), cell(r.pass ? 'pass' : 'FAIL', r.pass ? 'pt-pass' : 'pt-fail'));
			rows.append(tr);
		}
		for (const [name, input, mode, target] of GUARANTEES) {
			const g = guarantee(input, mode, target); allPass = allPass && g.pass; result.guarantees.push({ name, target, min: g.min, bad: g.bad, pass: g.pass });
			const tr = document.createElement('tr');
			tr.append(cell(name), cell(target + ':1', 'pt-num'), cell(g.min.toFixed(3) + ':1', 'pt-num'), cell(String(g.bad), 'pt-num'), cell(g.pass ? 'pass' : 'FAIL', g.pass ? 'pt-pass' : 'pt-fail'));
			grows.append(tr);
		}
		result.pass = allPass;
		banner.textContent = allPass ? 'PASS: CPU and GPU agree on every scenario, and the contrast guarantee holds on the GPU output.' : 'FAIL: see the rows marked FAIL.';
		banner.className = 'pt-banner ' + (allPass ? 'pt-banner-pass' : 'pt-banner-fail');
		window.__parityResult = result;
	}

	root.addEventListener('click', (e) => { if (e.target.closest('[data-ref="again"]')) run(); });
	run();
})();
