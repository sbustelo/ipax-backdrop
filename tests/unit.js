// PATH: tests/unit.js
/**
 * ipax-backdrop / tests/unit.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * Node unit and CPU/GPU parity tests for v0.1.10.
 * Run: node tests/unit.js
 */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

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
			clearRect() {},
			fillRect() {}
		};
		if (type !== 'webgl' || !glFactory) return null;
		if (!c.gl) {
			c.gl = glFactory(c._w, c._h, { preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: true });
			if (!c.gl) return null;
			c.ext = c.gl.getExtension('STACKGL_resize_drawingbuffer');
			const real = c.gl.texImage2D.bind(c.gl);
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

const W = 60, H = 60, NX = 5, NY = 5;
function makeEst(seed, saturated) {
	const r = rnd(seed), a = new Uint8ClampedArray(W * H * 4);
	for (let i = 0; i < W * H; i++) { const g = r() * 255; a[i * 4] = saturated ? r() * 255 : g; a[i * 4 + 1] = saturated ? r() * 255 : g; a[i * 4 + 2] = saturated ? r() * 255 : g; a[i * 4 + 3] = 255; }
	const c = makeCanvas(); c.width = W; c.height = H; c.__rgba = a; return c;
}
function makeInput(est, mode, ratio, base, runs, feather, unknown, blurSigma, extra = {}) {
	const V = new Uint8Array(NX * NY);
	if (unknown === true) { const r = rnd(77); for (let i = 0; i < V.length; i++) V[i] = r() < 0.3 ? 1 : 0; }
	else if (unknown === 'all') V.fill(1);
	const boxBlur = blurSigma || 0;
	const textBlur = extra.textBlur || 0;
	const maxBlur = Math.max(boxBlur, textBlur);
	return Object.assign({
		est,
		estBlur: est && maxBlur > 0 ? S('blur').blur(est, W, H, maxBlur) : null,
		grid: { V, nx: NX, ny: NY, g: 12 },
		w: W, h: H, s: 1, W, H, ox: 0, oy: 0,
		boxCover: extra.boxCover !== undefined ? extra.boxCover : true,
		boxBlur, textBlur, maxBlur,
		halo: extra.halo || null,
		infl: 6,
		params: { ratio, mode, feather, blur: boxBlur },
		colors: { base, runs }
	}, extra);
}
const cpuRender = (inp) => S('kernel-cpu').render(inp).source.data;
const LUT = S('color').LUT, lum = S('color').luminance, cr = S('contrast').ratio;
const yOf = (r, g, b) => lum(LUT[Math.round(r)], LUT[Math.round(g)], LUT[Math.round(b)]);

/* ---------- T1 colour ---------- */
{
	const C = S('color'); let worst = 0; const o = [0, 0, 0], b = [0, 0, 0], r = rnd(5);
	for (let i = 0; i < 2000; i++) { const lin = [r() ** 2, r() ** 2, r() ** 2]; C.linToOklab(lin[0], lin[1], lin[2], o); C.oklabToLin(o[0], o[1], o[2], b); worst = Math.max(worst, Math.abs(b[0] - lin[0]), Math.abs(b[1] - lin[1]), Math.abs(b[2] - lin[2])); }
	ok(worst < 1e-5, 'oklab roundtrip ' + worst);
	ok(Math.abs(cr(1, 0) - 21) < 1e-9, 'white/black is 21:1');
	console.log('T1 colour ok');
}

/* ---------- T2 contrast parsing, :1 suffix, APCA Lc fallback and bypass ---------- */
{
	const K = S('contrast');
	ok(K.parseContrast('4.5').ratio === 4.5, '4.5');
	ok(K.parseContrast('4.5:1').ratio === 4.5 && K.parseContrast('4.5:1').warning === null, '4.5:1');
	ok(K.parseContrast('').ratio === 4.5, 'default 4.5');
	ok(K.parseContrast('15').ok && K.parseContrast('15:1').ok, '15 ok');

	const apca60 = K.parseContrast('60Lc');
	ok(apca60.ok && apca60.system === 'apca' && Math.abs(apca60.ratio - 3.0) < 0.05 && !!apca60.warning, '60Lc -> ~3.0:1 fallback');

	const apcaNeg90 = K.parseContrast('-90lc');
	ok(apcaNeg90.ok && apcaNeg90.system === 'apca' && apcaNeg90.ratio > 7 && apcaNeg90.ratio <= 15, '-90lc -> WCAG AAA fallback');

	const apca106 = K.parseContrast('106Lc');
	ok(apca106.ok && Math.abs(apca106.ratio - 15.0) < 1e-6, '106Lc -> 15:1 ceiling');

	const inferred = K.parseContrast('75');
	ok(inferred.ok && inferred.system === 'apca' && inferred.ratio > 4.4 && inferred.ratio < 4.9, '75 inferred as Lc');

	ok(!K.parseContrast('abc').ok, 'nan rejected');
	ok(!K.parseContrast('0').ok, 'zero rejected');
	ok(K.parseContrast('1').ok && K.parseContrast('1:1').ok, '1 accepted');
	ok(K.isBypass(1) && K.isBypass(0.5) && !K.isBypass(1.01), 'isBypass');
	console.log('T2 contrast parse (:1, Lc fallback, >15 inferred) + bypass ok');
}

/* ---------- T3 geometry ---------- */
{
	const G = S('css-geometry');
	const g = G.backgroundGeometry(200, 100, { x: 10, y: 20, w: 100, h: 100 }, 'cover', '50% 50%', { rx: false, ry: false });
	ok(Math.abs(g.dw - 200) < 1e-9 && Math.abs(g.dh - 100) < 1e-9, 'cover');
	console.log('T3 geometry ok');
}

/* ---------- T4 CPU contrast guarantee ---------- */
for (const [mode, ratios] of [['default', [3, 4.5, 7]], ['tricontrast', [2, 3, 4, 4.4, 4.5, 4.53]]]) {
	for (const base of (mode === 'default' ? [[255, 255, 255], [0, 0, 0]] : [[255, 255, 255]])) {
		for (const ratio of ratios) for (const unknown of [false, true]) {
			const inp = makeInput(makeEst(3, true), mode, ratio, base, [], 0, unknown ? 'all' : false);
			const o = cpuRender(inp), ty = yOf(base[0], base[1], base[2]); let bad = 0;
			for (let i = 0; i < W * H; i++) {
				const q = i * 4; let v;
				if (!unknown) { const y = yOf(o[q], o[q + 1], o[q + 2]); v = mode === 'tricontrast' ? Math.min(cr(1, y), cr(0, y)) : cr(ty, y); }
				else { const a = o[q + 3] / 255; v = 1e9; for (const X of [0, 255]) { const y = yOf(o[q] * a + X * (1 - a), o[q + 1] * a + X * (1 - a), o[q + 2] * a + X * (1 - a)); v = Math.min(v, mode === 'tricontrast' ? Math.min(cr(1, y), cr(0, y)) : cr(ty, y)); } }
				if (v < ratio - 1e-6) bad++;
			}
			ok(bad === 0, `cpu ${mode} ${ratio}: ${bad} under`);
		}
	}
}
console.log('T4 cpu contrast guarantees ok');

/* ---------- T5 --ipax-text mask, spread (% vs px) and text-only short-circuit ---------- */
{
	const Halo = S('halo');
	const pctReach = Halo.reachOf({ halo: 12, spread: { v: 50, unit: '%' } });
	ok(pctReach.s === 6 && pctReach.f === 6 && pctReach.reach === 12, 'spread % is internal');

	const pxReach = Halo.reachOf({ halo: 12, spread: { v: 4, unit: 'px' } });
	ok(pxReach.s === 4 && pxReach.f === 12 && pxReach.reach === 16, 'spread px is additive');

	const texts = [{ x0: 20, y0: 20, x1: 40, y1: 40, fs: 16, word: 'Hi' }];
	const tp = { x: 0, y: 0, halo: 8, spread: { v: 4, unit: 'px' }, ratio: 7, blur: 4, mode: 'default' };
	const mk = Halo.mask(null, texts, tp, W, H, 1);
	const est = makeEst(9, true);
	const textOnly = makeInput(est, 'default', 1, [255, 255, 255], [], 0, false, 0, {
		boxCover: false,
		textBlur: 4,
		halo: { ratio: 7, mode: 'default', blur: 4, shared: false, mask: mk }
	});
	const out = cpuRender(textOnly);
	ok(out[3] === 0, 'text-only mode leaves corner pixel transparent (alpha 0)');
	const centerIdx = (30 * W + 30) * 4;
	const cY = yOf(out[centerIdx], out[centerIdx + 1], out[centerIdx + 2]);
	ok(out[centerIdx + 3] === 255 && cr(1, cY) >= 7 - 1e-6, 'text-only mode guarantees 7:1 behind glyph');
	console.log('T5 --ipax-text reach, mask fallback, and text-only short-circuit ok');
}

/* ---------- T6 CPU vs WebGL parity ---------- */
const GL = S('kernel-webgl'), avail = !!glFactory && GL.available();
console.log('webgl for parity tests:', avail ? 'available (headless-gl)' : 'SKIPPED (' + (glFactory ? GL.reason() : 'no gl package') + ')');
function compare(name, inp) {
	const cpu = cpuRender(inp), res = GL.render(inp), gl = res.source.gl, buf = new Uint8Array(W * H * 4);
	gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
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
	const e1 = makeEst(11, true), e2 = makeEst(12, true);
	compare('default 4.5 white, no feather', makeInput(e1, 'default', 4.5, [255, 255, 255], [], 0, false));
	compare('tricontrast 3 + feather 10 + unknown', makeInput(e1, 'tricontrast', 3, [255, 255, 255], [], 10, true));
	const texts = [{ x0: 15, y0: 15, x1: 45, y1: 45, fs: 16, word: 'Test' }];
	const tp = { x: 0, y: 0, halo: 10, spread: { v: 35, unit: '%' }, ratio: 7, blur: 6, mode: 'default' };
	const mk = S('halo').mask(null, texts, tp, W, H, 1);
	compare('box 3:1 + blur 3 + --ipax-text 7:1 + blur 6', makeInput(e2, 'default', 3, [255, 255, 255], [], 12, false, 3, {
		boxCover: true,
		textBlur: 6,
		halo: { ratio: 7, mode: 'default', blur: 6, shared: false, mask: mk }
	}));
	compare('text-only 7:1 + blur 6 (box inactive)', makeInput(e2, 'default', 1, [255, 255, 255], [], 0, false, 0, {
		boxCover: false,
		textBlur: 6,
		halo: { ratio: 7, mode: 'default', blur: 6, shared: false, mask: mk }
	}));
}

console.log(fails ? ('FAILURES: ' + fails) : 'ALL OK');
process.exit(fails ? 1 : 0);