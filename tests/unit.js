/**
 * ipax-backdrop / test/unit.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * Node tests. They load the REAL files (lib/j0-kernel and src/*.js in numeric order) and run them;
 * nothing is copied. Only what Node lacks is faked: a canvas, ImageData and, optionally, WebGL.
 *
 *   node test/unit.js
 *
 * Always run (no dependencies): colour maths, contrast parsing, CSS geometry, the CPU kernel
 * (contrast guarantee measured on 8-bit output, feather, bypass), the blur service.
 *
 * CPU versus GPU parity runs only if the optional package `gl` (headless WebGL 1) is installed:
 *   npm install gl            (from the repo root)
 * On Linux it needs a display: xvfb-run node test/unit.js
 * On macOS or Windows the native package can be awkward to install: use test/parity.html instead,
 * which runs the same comparison in your browser on your real GPU.
 */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* ---------- what Node lacks ---------- */
let glFactory = null;
try { glFactory = require('gl'); } catch (e) { /* optional */ }
global.window = global;
global.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
function makeCanvas() {
	const c = { _w: 1, _h: 1, gl: null, ext: null, __rgba: null };
	const resize = () => { if (c.gl && c.ext) c.ext.resize(c._w, c._h); };
	Object.defineProperty(c, 'width', { get() { return c._w; }, set(v) { c._w = v; resize(); } });
	Object.defineProperty(c, 'height', { get() { return c._h; }, set(v) { c._h = v; resize(); } });
	c.addEventListener = () => {};
	c.getContext = (type) => {
		if (type === '2d') return {
			putImageData(id) { c.__rgba = id.data; },
			getImageData() { return { data: c.__rgba }; },
			clearRect() {}
		};
		if (type !== 'webgl' || !glFactory) return null;
		if (!c.gl) {
			c.gl = glFactory(c._w, c._h, { preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: true });
			if (!c.gl) return null;
			c.ext = c.gl.getExtension('STACKGL_resize_drawingbuffer');
			const real = c.gl.texImage2D.bind(c.gl); // WebGL accepts a canvas as a texture source; headless-gl needs raw pixels
			c.gl.texImage2D = function (...a) { if (a.length === 6) { const s = a[5]; return real(a[0], a[1], a[2], s.width, s.height, 0, a[3], a[4], s.__rgba); } return real(...a); };
		}
		return c.gl;
	};
	return c;
}
global.document = { readyState: 'loading', addEventListener() {}, createElement: (t) => (t === 'canvas' ? makeCanvas() : {}) };

const files = ['lib/j0-kernel/01-bus-j0kernel.js', 'lib/j0-kernel/02-core-j0kernel.js']
	.concat(fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/' + f));
for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });

const j0 = window.j0, S = (n) => j0.get('ipax-backdrop:' + n);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } };
const rnd = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

/* ---------- fixtures ---------- */
const W = 60, H = 60, NX = 5, NY = 5;
function makeEst(seed, saturated) {
	const r = rnd(seed), a = new Uint8ClampedArray(W * H * 4);
	for (let i = 0; i < W * H; i++) { const g = r() * 255; a[i * 4] = saturated ? r() * 255 : g; a[i * 4 + 1] = saturated ? r() * 255 : g; a[i * 4 + 2] = saturated ? r() * 255 : g; a[i * 4 + 3] = 255; }
	const c = makeCanvas(); c.width = W; c.height = H; c.__rgba = a; return c;
}
function makeInput(est, mode, ratio, base, runs, feather, unknown, blurSigma) {
	const V = new Uint8Array(NX * NY);
	if (unknown === true) { const r = rnd(77); for (let i = 0; i < V.length; i++) V[i] = r() < 0.3 ? 1 : 0; }
	else if (unknown === 'all') V.fill(1);
	return { est, estBlur: blurSigma ? S('blur').blur(est, W, H, blurSigma) : null, grid: { V, nx: NX, ny: NY, g: 12 }, w: W, h: H, s: 1, W, H, params: { ratio, mode, feather, blur: blurSigma || 0 }, colors: { base, runs } };
}
const cpuRender = (inp) => S('kernel-cpu').render(inp).source.data;
const LUT = S('color').LUT, lum = S('color').luminance, cr = S('contrast').ratio;
const yOf = (r, g, b) => lum(LUT[Math.round(r)], LUT[Math.round(g)], LUT[Math.round(b)]);

/* ---------- T1 colour ---------- */
{
	const C = S('color'); let worst = 0; const o = [0, 0, 0], b = [0, 0, 0], r = rnd(5);
	for (let i = 0; i < 2000; i++) { const lin = [r() ** 2, r() ** 2, r() ** 2]; C.linToOklab(lin[0], lin[1], lin[2], o); C.oklabToLin(o[0], o[1], o[2], b); worst = Math.max(worst, Math.abs(b[0] - lin[0]), Math.abs(b[1] - lin[1]), Math.abs(b[2] - lin[2])); }
	ok(worst < 1e-5, 'oklab roundtrip ' + worst);
	ok(C.parseCssColor('rgba(10, 20, 30, 0.5)').join() === '10,20,30,0.5', 'parse rgba');
	ok(C.parseCssColor('rgb(1 2 3 / 50%)')[3] === 0.5, 'parse space syntax');
	ok(C.parseCssColor('transparent')[3] === 0, 'transparent');
	ok(C.parseCssColor('oklch(1 0 0)') === null, 'unparsable gives null');
	// fixed reference values, independent of the library maths: white on black is 21:1, #767676 on white is 4.54:1
	ok(Math.abs(cr(1, 0) - 21) < 1e-9, 'white/black is 21:1');
	ok(Math.abs(cr(1, yOf(118, 118, 118)) - 4.54) < 0.01, '#767676 on white is 4.54:1 (' + cr(1, yOf(118, 118, 118)).toFixed(3) + ')');
	console.log('T1 colour ok');
}
/* ---------- T2 contrast parsing and bypass ---------- */
{
	const K = S('contrast');
	ok(K.parseContrast('4.5').ratio === 4.5, '4.5'); ok(K.parseContrast('').ratio === 4.5, 'default 4.5');
	ok(K.parseContrast('15').ok, '15 ok'); ok(!K.parseContrast('15.5').ok, '>15 rejected'); ok(!K.parseContrast('60lc').ok, 'lc rejected');
	ok(!K.parseContrast('abc').ok, 'nan rejected'); ok(!K.parseContrast('0').ok, 'zero rejected'); ok(K.parseContrast('1').ok, '1 accepted');
	ok(K.isBypass(1) && K.isBypass(0.5) && !K.isBypass(1.01), 'isBypass');
	console.log('T2 contrast parse + bypass rule ok');
}
/* ---------- T3 geometry ---------- */
{
	const G = S('css-geometry');
	const g = G.backgroundGeometry(200, 100, { x: 10, y: 20, w: 100, h: 100 }, 'cover', '50% 50%', { rx: false, ry: false });
	ok(Math.abs(g.dw - 200) < 1e-9 && Math.abs(g.dh - 100) < 1e-9 && Math.abs(g.x + 40) < 1e-9 && g.y === 20, 'cover ' + JSON.stringify(g));
	const c = G.backgroundGeometry(200, 100, { x: 0, y: 0, w: 100, h: 100 }, 'contain', '50% 50%', { rx: false, ry: false }); ok(c.dw === 100 && c.dh === 50 && c.y === 25, 'contain');
	const a = G.backgroundGeometry(40, 20, { x: 0, y: 0, w: 100, h: 100 }, '50px auto', '10px 0%', { rx: true, ry: true }); ok(a.dw === 50 && a.dh === 25 && a.x === 10 && a.y === 0, 'px/auto');
	ok(G.backgroundGeometry(0, 0, { x: 0, y: 0, w: 1, h: 1 }, 'cover', '0 0', { rx: false, ry: false }) === null, 'zero image');
	const sp = G.splitTop('url(data:a,b), linear-gradient(red, blue)'); ok(sp.length === 2 && sp[0] === 'url(data:a,b)', 'splitTop nested commas');
	ok(G.parseRepeat('repeat-x').rx && !G.parseRepeat('repeat-x').ry, 'repeat-x'); ok(G.parseRepeat('space') === null, 'repeat space unsupported');
	ok(G.objectFitGeometry(10, 10, { x: 0, y: 0, w: 5, h: 5 }, 'scale-down', '0 0') === null, 'object-fit scale-down unsupported');
	console.log('T3 geometry ok');
}
/* ---------- T4 CPU contrast guarantee, measured on the 8-bit output ---------- */
for (const [mode, ratios] of [['default', [3, 4.5, 7]], ['tricontrast', [2, 3, 4, 4.4, 4.5, 4.53]]]) {
	for (const base of (mode === 'default' ? [[255, 255, 255], [0, 0, 0]] : [[255, 255, 255]])) {
		for (const ratio of ratios) for (const unknown of [false, true]) {
			const inp = makeInput(makeEst(3, true), mode, ratio, base, [], 0, unknown ? 'all' : false);
			const o = cpuRender(inp), ty = yOf(base[0], base[1], base[2]); let bad = 0, min = 1e9;
			for (let i = 0; i < W * H; i++) {
				const q = i * 4; let v;
				if (!unknown) { const y = yOf(o[q], o[q + 1], o[q + 2]); v = mode === 'tricontrast' ? Math.min(cr(1, y), cr(0, y)) : cr(ty, y); }
				else { const a = o[q + 3] / 255; v = 1e9; for (const X of [0, 255]) { const y = yOf(o[q] * a + X * (1 - a), o[q + 1] * a + X * (1 - a), o[q + 2] * a + X * (1 - a)); v = Math.min(v, mode === 'tricontrast' ? Math.min(cr(1, y), cr(0, y)) : cr(ty, y)); } }
				min = Math.min(min, v); if (v < ratio - 1e-6) bad++;
			}
			ok(bad === 0, `cpu ${mode} ${ratio} base ${base} ${unknown ? 'veil' : 'image'}: ${bad} under, min ${min.toFixed(3)}`);
		}
	}
}
console.log('T4 cpu contrast guarantees (default 3/4.5/7 both polarities, tricontrast 2..4.53, image and veil, 8-bit output)');
/* ---------- T5 feather ---------- */
{
	const est = makeEst(21, false), cpu = (f) => cpuRender(makeInput(est, 'default', 4.5, [255, 255, 255], [], f, false));
	const same = (a, b) => a.every((v, i) => v === b[i]);
	ok(same(cpu(14), cpu({ top: 14, right: 14, bottom: 14, left: 14 })), 'number feather equals uniform object');
	ok(same(cpu(0), cpu({ top: 0, right: 0, bottom: 0, left: 0 })), 'zero feather equals zero object');
	const d = cpu({ top: 30, right: 0, bottom: 0, left: 10 }), px = (x, y) => [0, 1, 2].map((k) => d[(y * W + x) * 4 + k]), orig = (x, y) => [0, 1, 2].map((k) => est.__rgba[(y * W + x) * 4 + k]);
	const eq = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 1);
	ok(eq(px(30, 0), orig(30, 0)), 'top edge untouched (feather-top)'); ok(eq(px(0, 30), orig(0, 30)), 'left edge untouched (feather-left)');
	let cb = 0, cr2 = 0; for (let x = 15; x < 45; x++) if (!eq(px(x, H - 1), orig(x, H - 1))) cb++; for (let y = 35; y < 55; y++) if (!eq(px(W - 1, y), orig(W - 1, y))) cr2++;
	ok(cb > 10, 'bottom edge corrected, no feather-bottom: ' + cb + '/30'); ok(cr2 > 5, 'right edge corrected, no feather-right: ' + cr2 + '/20');
	const r2 = S('kernel-cpu').render(makeInput(est, 'default', 15, [128, 128, 128], [], 0, false));
	ok(!r2.source.data.some((v) => Number.isNaN(v)), 'no NaN on unreachable ratio'); ok(r2.stats.inf === true, 'inf flag for unreachable ratio');
	console.log('T5 feather: compatibility, edges, directional, unreachable ratio ok');
}
/* ---------- T6 blur service ---------- */
{
	const B = S('blur'), flat = makeCanvas(); flat.width = W; flat.height = H; flat.__rgba = new Uint8ClampedArray(W * H * 4).fill(120);
	const bf = B.blur(flat, W, H, 4); ok(bf && bf.__rgba.every((v, i) => (i % 4 === 3 ? v === 255 : Math.abs(v - 120) <= 1)), 'blur keeps a flat image flat (clamped edges)');
	const est = makeEst(8, false), bl = B.blur(est, W, H, 3), mean = (a) => { let s = 0; for (let i = 0; i < W * H; i++) s += a[i * 4]; return s / (W * H); };
	const vari = (a) => { const m = mean(a); let s = 0; for (let i = 0; i < W * H; i++) s += (a[i * 4] - m) ** 2; return s / (W * H); };
	ok(Math.abs(mean(bl.__rgba) - mean(est.__rgba)) < 2, 'blur preserves the mean'); ok(vari(bl.__rgba) < vari(est.__rgba) * 0.25, 'blur reduces variance a lot: ' + vari(bl.__rgba).toFixed(0) + ' vs ' + vari(est.__rgba).toFixed(0));
	ok(B.blur(est, W, H, 0.1) === null, 'tiny sigma returns null'); ok(B.blur(null, W, H, 3) === null, 'no estimate returns null');
	const bad = { getContext: () => ({ getImageData() { throw new Error('tainted'); } }) }; ok(B.blur(bad, W, H, 3) === null, 'unreadable estimate returns null');
	ok(B.boxRadius(2) >= 1 && B.boxRadius(8) > B.boxRadius(2), 'box radius grows with sigma');
	console.log('T6 blur service ok');
}
/* ---------- T7 bypass (contrast <= 1) and blur mixing, CPU ---------- */
{
	const est = makeEst(14, true), eq3 = (a, b, q, tol) => [0, 1, 2].every((k) => Math.abs(a[q + k] - b[q + k]) <= tol);
	let o = cpuRender(makeInput(est, 'default', 1, [128, 128, 128], [], 0, false)); let same = 0; for (let i = 0; i < W * H; i++) if (eq3(o, est.__rgba, i * 4, 1)) same++;
	ok(same === W * H, 'bypass without blur: known pixels equal the estimate (' + same + '/' + W * H + ')');
	const veil = cpuRender(makeInput(est, 'default', 1, [128, 128, 128], [], 0, 'all')); ok(veil.every((v, i) => i % 4 !== 3 || v === 0), 'bypass: unknown cells get NO veil (alpha 0)');
	const r = S('kernel-cpu').render(makeInput(est, 'default', 1, [128, 128, 128], [], 0, 'all')); ok(r.stats.inf === false, 'bypass is never unreachable');
	ok(!cpuRender(makeInput(est, 'default', 1.01, [128, 128, 128], [], 0, 'all')).every((v, i) => i % 4 !== 3 || v === 0), 'ratio just above 1 does use the veil');
	// blur mixing: no feather means M = 1 everywhere, so with bypass the output IS the blurred estimate
	const bi = makeInput(est, 'default', 1, [255, 255, 255], [], 0, false, 3); o = cpuRender(bi); let sameB = 0; for (let i = 0; i < W * H; i++) if (eq3(o, bi.estBlur.__rgba, i * 4, 1)) sameB++;
	ok(sameB === W * H, 'bypass + blur + no feather equals the blurred estimate (' + sameB + '/' + W * H + ')');
	// with a feather the edge stays sharp and the interior is blurred
	const fi = makeInput(est, 'default', 1, [255, 255, 255], [], 20, false, 3); o = cpuRender(fi);
	ok(eq3(o, est.__rgba, (0 * W + 30) * 4, 1), 'feather: edge pixel is the sharp estimate'); ok(eq3(o, fi.estBlur.__rgba, (30 * W + 30) * 4, 1), 'feather: deep interior pixel is the blurred estimate');
	// with blur, the contrast guarantee still holds on the 8-bit output
	const gi = makeInput(makeEst(3, true), 'default', 4.5, [255, 255, 255], [], 0, false, 3); o = cpuRender(gi); let badG = 0; for (let i = 0; i < W * H; i++) if (cr(1, yOf(o[i * 4], o[i * 4 + 1], o[i * 4 + 2])) < 4.5 - 1e-6) badG++;
	ok(badG === 0, 'blur + default 4.5: ' + badG + ' pixels under target');
	console.log('T7 bypass and blur mixing ok');
}
/* ---------- T8 CPU versus WebGL parity ---------- */
const GL = S('kernel-webgl'), avail = !!glFactory && GL.available();
console.log('webgl for the parity tests:', avail ? 'available (headless-gl)' : 'SKIPPED (' + (glFactory ? GL.reason() : 'optional package "gl" is not installed; use test/parity.html in a browser') + ')');
function compare(name, inp) {
	const cpu = cpuRender(inp), res = GL.render(inp), gl = res.source.gl, buf = new Uint8Array(W * H * 4);
	gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); // rows come bottom-up, premultiplied
	let max = 0, o2 = 0, o8 = 0, tot = 0;
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
		const g = ((H - 1 - y) * W + x) * 4, c = (y * W + x) * 4, a = cpu[c + 3] / 255;
		for (let k = 0; k < 3; k++) { const d = Math.abs(buf[g + k] - Math.round(cpu[c + k] * a)); max = Math.max(max, d); if (d > 2) o2++; if (d > 8) o8++; tot++; }
		const da = Math.abs(buf[g + 3] - cpu[c + 3]); max = Math.max(max, da); if (da > 2) o2++; if (da > 8) o8++; tot++;
	}
	console.log(`  ${name}: max diff ${max}, >2: ${o2}/${tot}, >8: ${o8}`);
	ok(o8 === 0 && o2 / tot < 0.01, 'parity ' + name);
}
if (avail) {
	const e1 = makeEst(11, true), e2 = makeEst(12, true), e3 = makeEst(31, true);
	compare('default 4.5 white, no runs, no feather', makeInput(e1, 'default', 4.5, [255, 255, 255], [], 0, false));
	compare('default 4.5 white + black run + feather 14 + unknown cells', makeInput(e1, 'default', 4.5, [255, 255, 255], [{ x0: 10, y0: 10, x1: 40, y1: 30, c: [0, 0, 0] }], 14, true));
	compare('default 7 black text, 2 runs, unknown cells', makeInput(e2, 'default', 7, [0, 0, 0], [{ x0: 5, y0: 5, x1: 25, y1: 25, c: [255, 255, 255] }, { x0: 30, y0: 30, x1: 55, y1: 50, c: [255, 214, 86] }], 8, true));
	compare('tricontrast 3', makeInput(e1, 'tricontrast', 3, [255, 255, 255], [], 10, true));
	compare('tricontrast 4.5', makeInput(e1, 'tricontrast', 4.5, [255, 255, 255], [], 0, false));
	const nest = makeInput(null, 'default', 4.5, [255, 255, 255], [], 12, 'all'); compare('no estimate (tainted): veil only', nest);
	compare('directional feather {top30,left10} + unknown + run', makeInput(e3, 'default', 4.5, [255, 255, 255], [{ x0: 10, y0: 12, x1: 45, y1: 32, c: [0, 0, 0] }], { top: 30, right: 0, bottom: 0, left: 10 }, true));
	compare('directional feather, four different values, tricontrast 3', makeInput(e3, 'tricontrast', 3, [255, 255, 255], [], { top: 5, right: 20, bottom: 12, left: 30 }, true));
	compare('blur sigma 3, feather 14', makeInput(e3, 'default', 4.5, [255, 255, 255], [], 14, false, 3));
	compare('blur sigma 5, directional feather, unknown cells, run', makeInput(e1, 'default', 4.5, [255, 255, 255], [{ x0: 8, y0: 8, x1: 30, y1: 28, c: [0, 0, 0] }], { top: 25, right: 0, bottom: 10, left: 0 }, true, 5));
	compare('bypass (ratio 1), no blur', makeInput(e1, 'default', 1, [255, 255, 255], [], 14, true));
	compare('bypass (ratio 1) + blur sigma 4 + feather: pure progressive blur', makeInput(e2, 'default', 1, [255, 255, 255], [], { top: 30, right: 0, bottom: 0, left: 0 }, false, 4));
	compare('bypass + blur + unknown cells', makeInput(e2, 'default', 0.5, [0, 0, 0], [], 10, true, 3));
	// contrast guarantee measured on the GPU output itself (known pixels, opaque)
	for (const [mode, ratio, sigma] of [['default', 4.5, 0], ['tricontrast', 4.5, 0], ['tricontrast', 3, 0], ['default', 4.5, 3]]) {
		const inp = makeInput(makeEst(3, true), mode, ratio, [255, 255, 255], [], 0, false, sigma), res = GL.render(inp), gl = res.source.gl, buf = new Uint8Array(W * H * 4);
		gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); let bad = 0, min = 1e9;
		for (let i = 0; i < W * H; i++) { const q = i * 4, y = yOf(buf[q], buf[q + 1], buf[q + 2]), v = mode === 'tricontrast' ? Math.min(cr(1, y), cr(0, y)) : cr(1, y); min = Math.min(min, v); if (v < ratio - 1e-6) bad++; }
		ok(bad === 0, `gpu ${mode} ${ratio}${sigma ? ' +blur' : ''} guarantee: ${bad} under, min ${min.toFixed(3)}`);
		console.log(`  gpu ${mode} ${ratio}${sigma ? ' +blur' : ''}: ${bad}/${W * H} under target, min ${min.toFixed(3)}`);
	}
}
/* ---------- T9 dispatcher and fallback ---------- */
{
	const events = []; j0.bus.on('ipax-backdrop:backend', (d) => events.push(d.backend + ':' + d.reason.slice(0, 40)));
	const cfg = S('config'), inp = () => makeInput(makeEst(4, false), 'default', 4.5, [255, 255, 255], [], 0, false);
	cfg.backend = 'auto'; let r = S('kernel').render(inp()); if (avail) ok(r.backend === 'webgl', 'auto picks webgl, got ' + r.backend); else ok(r.backend === 'cpu', 'auto falls back to cpu without webgl, got ' + r.backend);
	GL.disable('forced failure'); r = S('kernel').render(inp()); ok(r.backend === 'cpu', 'falls back to cpu after a failure, got ' + r.backend);
	cfg.backend = 'cpu'; r = S('kernel').render(inp()); ok(r.backend === 'cpu' && r.stats !== null, 'forced cpu keeps statistics');
	GL.reset(); cfg.backend = 'webgl'; r = S('kernel').render(inp()); if (avail) ok(r.backend === 'webgl', 'reset makes webgl available again');
	console.log('T9 dispatcher events:', events.join(' | '));
}

console.log(fails ? ('FAILURES: ' + fails) : 'ALL OK');
process.exit(fails ? 1 : 0);
