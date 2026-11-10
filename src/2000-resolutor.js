/**
 * ipax-backdrop / 2000-resolutor.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER: estimate what is underneath a layer.
 *
 * The browser does not expose the pixels painted behind an element. The
 * resolver rebuilds an estimate: it probes a grid of points with
 * document.elementsFromPoint, takes the elements BELOW the layer (paint
 * order), asks 'layers' what each one paints, and paints a copy of that onto
 * an off-screen canvas. Areas it cannot reproduce are flagged "unknown".
 *
 * Service 'ipax-backdrop:resolver':
 *   resolve(rec, R, s, w, h, cell) -> {est, grid, why, stats}
 *     rec    compositor record of the managed element
 *     R      layer rect in client px
 *     s      working scale (working px per client px)
 *     w, h   working canvas size in px
 *     cell   probe cell size in client px
 *   est    HTMLCanvasElement w x h, the estimated backdrop (opaque)
 *   grid   {V, nx, ny, g}: V[j*nx+i] = 1 for cells that are unknown. V is
 *          already dilated by one cell so a mixed boundary falls on the
 *          unknown side (never trusts a half-known cell).
 *   why    Set of reasons found for unknown areas
 *   stats  {cells, unknown, tainted, baseReal, ms}
 *
 * Opaque cut: layers below the first fully opaque known layer are invisible
 * and are ignored, together with anything unknown below them.
 *
 * Known limits: elementsFromPoint is a point sample (default every 12 px);
 * elements with pointer-events:none are not listed by the browser, so they
 * are invisible to the resolver (other managed layers are handled through the
 * compositor registry instead).
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	const covers = (L, x, y) => {
		if (L.k === 'col') return true;
		if (L.k === 'lay') return x >= L.r.left && x <= L.r.right && y >= L.r.top && y <= L.r.bottom;
		const g = L.g;
		if (!g.rx && (x < g.x || x > g.x + g.dw)) return false;
		if (!g.ry && (y < g.y || y > g.y + g.dh)) return false;
		return true;
	};

	/** Paint one layer, clipped to the rectangle C (client px). */
	function paintLayer(ctx, L, C) {
		if (L.k === 'col') {
			ctx.fillStyle = 'rgba(' + L.c[0] + ',' + L.c[1] + ',' + L.c[2] + ',' + L.a + ')';
			ctx.fillRect(C.x, C.y, C.w, C.h);
			return;
		}
		ctx.save();
		ctx.beginPath(); ctx.rect(C.x, C.y, C.w, C.h); ctx.clip();
		if (L.k === 'lay') ctx.drawImage(L.cv, L.r.left, L.r.top, L.r.width, L.r.height);
		else {
			const g = L.g, xs = [], ys = [];
			if (g.rx) for (let t = g.x + Math.floor((C.x - g.x) / g.dw) * g.dw; t < C.x + C.w; t += g.dw) xs.push(t); else xs.push(g.x);
			if (g.ry) for (let t = g.y + Math.floor((C.y - g.y) / g.dh) * g.dh; t < C.y + C.h; t += g.dh) ys.push(t); else ys.push(g.y);
			ctx.globalAlpha = L.a;
			for (const ty of ys) for (const tx of xs) ctx.drawImage(L.img, tx, ty, g.dw, g.dh);
		}
		ctx.restore();
	}

	function resolve(rec, R, s, w, h, g) {
		const t0 = performance.now();
		const Layers = svc('layers'), Color = svc('color'), Comp = svc('compositor');
		const layerTag = svc('names').layerTag.toUpperCase();

		const est = document.createElement('canvas');
		est.width = w; est.height = h;
		const ec = est.getContext('2d');
		ec.setTransform(s, 0, 0, s, -R.left * s, -R.top * s); // draw in client coordinates

		// Page background: body, else html, else assume white.
		let base = [255, 255, 255, 1], baseReal = false;
		for (const n of [document.body, document.documentElement]) {
			const c = Color.parseCssColor(getComputedStyle(n).backgroundColor);
			if (c && c[3] > 0) { base = c; baseReal = true; break; }
		}
		ec.fillStyle = '#fff'; ec.fillRect(R.left, R.top, R.width, R.height);
		ec.fillStyle = 'rgba(' + base[0] + ',' + base[1] + ',' + base[2] + ',' + base[3] + ')';
		ec.fillRect(R.left, R.top, R.width, R.height);

		const nx = Math.ceil(R.width / g), ny = Math.ceil(R.height / g);
		const V = new Uint8Array(nx * ny), cache = new Map(), why = new Set(), taint = new Set();

		Comp.withHitTesting(rec, () => {
			for (let j = 0; j < ny; j++) {
				let runSig = null, runStart = 0, runStack = null;
				// Neighbouring cells with the same layer stack are painted as one rectangle.
				const flush = (iEnd) => {
					if (runSig === null) return;
					const C = { x: R.left + runStart * g, y: R.top + j * g, w: Math.min((iEnd - runStart) * g, R.width - runStart * g), h: Math.min(g, R.height - j * g) };
					for (let k = runStack.length - 1; k >= 0; k--) paintLayer(ec, runStack[k], C);
				};
				for (let i = 0; i < nx; i++) {
					const px = Math.min(R.left + (i + 0.5) * g, R.right - 0.01), py = Math.min(R.top + (j + 0.5) * g, R.bottom - 0.01);
					const list = document.elementsFromPoint(px, py), idx = list.indexOf(rec.layer);
					const stack = [];
					let unk = false, cut = false;
					if (idx < 0) { unk = true; why.add('out of view'); }
					else {
						for (let k = idx + 1; k < list.length && !cut; k++) {
							const e = list[k];
							if (e === document.documentElement || e === document.body || e.tagName === layerTag || (e.parentElement && e.parentElement.tagName === layerTag)) continue;
							let Ls = cache.get(e);
							if (!Ls) { Ls = Layers.layersOf(e, rec); cache.set(e, Ls); }
							for (const L of Ls) {
								if (L.k === 'unk') { unk = true; why.add(L.why); continue; }
								if (!covers(L, px, py)) continue;
								stack.push(L);
								if (L.tainted) taint.add(L.id);
								if (L.a >= 0.999 && !L.nocut) { cut = true; break; }
							}
						}
					}
					V[j * nx + i] = unk ? 1 : 0;
					const sig = stack.map((L) => L.id).join(',') + (unk ? 'u' : '');
					if (sig !== runSig) { flush(i); runSig = sig; runStart = i; runStack = stack; }
				}
				flush(nx);
			}
		});

		const V2 = new Uint8Array(nx * ny);
		let unknown = 0;
		for (let k = 0; k < V.length; k++) unknown += V[k];
		for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
			let v = 0;
			for (let dj = -1; dj <= 1 && !v; dj++) for (let di = -1; di <= 1; di++) {
				const ii = i + di, jj = j + dj;
				if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && V[jj * nx + ii]) { v = 1; break; }
			}
			V2[j * nx + i] = v;
		}
		return { est, grid: { V: V2, nx, ny, g }, why, stats: { cells: V.length, unknown, tainted: taint.size, baseReal, ms: performance.now() - t0 } };
	}

	window.j0.register('ipax-backdrop:resolver', { resolve });
})();
