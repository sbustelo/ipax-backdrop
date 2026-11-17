// PATH: src/2000-resolutor.js
/**
 * ipax-backdrop / 2000-resolutor.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER: estimate what is underneath a layer.
 *
 * The browser does not expose the pixels painted behind an element. The
 * resolver rebuilds an estimate: it probes a grid of points with
 * document.elementsFromPoint, takes the elements BELOW the element/wrapper
 * (paint order), merges already-computed managed layers below it directly
 * from the compositor registry, asks 'layers' what each DOM element paints,
 * and paints a copy onto an off-screen canvas. Areas it cannot reproduce are
 * flagged "unknown".
 *
 * Service 'ipax-backdrop:resolver':
 *   resolve(rec, R, s, w, h, cell, active?) -> {est, grid, why, stats}
 *     rec    compositor record of the managed element
 *     R      layer rect in client px
 *     s      working scale (working px per client px)
 *     w, h   working canvas size in px
 *     cell   probe cell size in client px
 *     active Uint8Array(nx*ny) | undefined   cells that can influence the output (1 = probe and paint).
 *            Cells with 0 are not probed and nothing is painted there (used by the text halo, whose
 *            layer is larger than the box). nx = ceil(R.width / cell), ny = ceil(R.height / cell).
 *   est    HTMLCanvasElement w x h, the estimated backdrop (opaque).
 *          REUSED: stored in rec.est and overwritten by the next resolve() of
 *          the same record. Callers must consume it synchronously (the pipeline
 *          does). compositor.release(rec) drops it.
 *   grid   {V, nx, ny, g}: V[j*nx+i] = 1 for cells that are unknown. V is
 *          already dilated by one cell so a mixed boundary falls on the
 *          unknown side (never trusts a half-known cell).
 *   why    Set of reasons found for unknown areas
 *   stats  {cells, probes, unknown, tainted, baseReal, probeMs, ms}
 *          probeMs = probing + painting (the part that does not depend on the kernel)
 *
 * ADAPTIVE PROBING (v0.1.05, config.probeBlock, default 4, 1 = probe every cell)
 *   The cell grid is split into blocks of B x B cells. The four corners and the
 *   centre of each block are probed; when all five see the same layer stack the
 *   block is filled without further probing, otherwise every cell is probed as
 *   before. On uniform backgrounds this removes about 85% of the elementsFromPoint
 *   calls (B = 4). Cost: a feature smaller than a block (B * cell = 48 px by
 *   default) that touches none of the five samples can be missed. Set
 *   config.probeBlock = 1 for the exact previous behaviour.
 *
 * Opaque cut: layers below the first fully opaque known layer are invisible
 * and are ignored, together with anything unknown below them.
 *
 * Viewport edge: cells outside the viewport are estimated from the nearest visible point of the
 * layer (edge replication), not marked unknown. They are only "out of view" (unknown) when the whole
 * layer is outside the viewport.
 *
 * Known limits: elementsFromPoint is a point sample; elements with
 * pointer-events:none are not listed by the browser, so they are handled by
 * scanning non-managed subtrees in 2100-resolutor-capas.js and through the
 * compositor layer registry.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	const covers = (L, x, y) => {
		if (L.r && (x < L.r.left || x > L.r.right || y < L.r.top || y > L.r.bottom)) return false;
		if (L.k === 'col' || L.k === 'lay') return true;
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

	function sameRuns(a, b) {
		if (a.length !== b.length) return false;
		for (let k = 0; k < a.length; k++) {
			if (a[k].i0 !== b[k].i0 || a[k].i1 !== b[k].i1 || a[k].sig !== b[k].sig) return false;
		}
		return true;
	}

	function resolve(rec, R, s, w, h, g, active) {
		const t0 = performance.now();
		const Layers = svc('layers'), Color = svc('color'), Comp = svc('compositor');
		const N_NAMES = svc('names');
		const layerTag = N_NAMES.layerTag.toUpperCase();
		const planeTag = (N_NAMES.planeTag || 'ipax-backdrop-plane').toUpperCase();
		const cfg = svc('config');

		// Reuse the estimate canvas of this record. Assigning width/height reallocates the backing
		// store and resets the context, so it is only done when the size really changed.
		let est = rec && rec.est;
		if (!est) { est = document.createElement('canvas'); if (rec) rec.est = est; }
		if (est.width !== w || est.height !== h) { est.width = w; est.height = h; }
		const ec = est.getContext('2d', { willReadFrequently: true });
		ec.setTransform(1, 0, 0, 1, 0, 0); // a reused context still carries the previous transform

		// Page background: body, else html, else assume white.
		let base = [255, 255, 255, 1], baseReal = false;
		for (const n of [document.body, document.documentElement]) {
			const c = Color.parseCssColor(getComputedStyle(n).backgroundColor);
			if (c && c[3] > 0) { base = c; baseReal = true; break; }
		}
		// Fill the WHOLE canvas, in canvas pixels. The canvas is ceil(size * s) pixels, so filling the
		// element rectangle would leave the last row and column partly transparent (a light line at the edge).
		ec.fillStyle = '#fff'; ec.fillRect(0, 0, w, h);
		ec.fillStyle = 'rgba(' + base[0] + ',' + base[1] + ',' + base[2] + ',' + base[3] + ')';
		ec.fillRect(0, 0, w, h);

		if (s === 1) {
			ec.setTransform(1, 0, 0, 1, -Math.round(R.left), -Math.round(R.top));
		} else {
			ec.setTransform(s, 0, 0, s, -R.left * s, -R.top * s); // from here on, draw in client coordinates
		}

		const nx = Math.ceil(R.width / g), ny = Math.ceil(R.height / g), N = nx * ny;
		const V = new Uint8Array(N), done = new Uint8Array(N), sigs = new Array(N), stacks = new Array(N);
		const cache = new Map(), zCache = new Map(), ownerCache = new WeakMap(), fixedCache = new WeakMap(), why = new Set(), taint = new Set();
		const B = Math.max(1, Math.min(8, Math.floor(cfg.probeBlock === undefined ? 4 : cfg.probeBlock) || 1));
		let probes = 0;

		// Already-computed managed layers strictly below this record (sorted bottom-to-top).
		const below = Comp.layersBelow ? Comp.layersBelow(rec, R) : [];
		const selfRoot = rec.wrapper || rec.el;
		const stageRoot = rec.plane ? rec.plane.parentElement : null;
		const hostParent = selfRoot.parentElement;
		const ownerOf = (e) => {
			if (!Comp.ownerRecord) return null;
			if (ownerCache.has(e)) return ownerCache.get(e);
			const o = Comp.ownerRecord(e) || null;
			ownerCache.set(e, o);
			return o;
		};
		const isFixed = (e) => {
			if (!e || e.nodeType !== 1 || e === document.body || e === document.documentElement) return false;
			if (fixedCache.has(e)) return fixedCache.get(e);
			const res = getComputedStyle(e).position === 'fixed' || isFixed(e.parentElement);
			fixedCache.set(e, res);
			return res;
		};

		const elemZ = (e) => {
			if (!e || e.nodeType !== 1) return 0;
			let v = zCache.get(e);
			if (v !== undefined) return v;
			if (stageRoot && e !== stageRoot && stageRoot.contains(e)) {
				let cur = e;
				while (cur && cur.parentElement !== stageRoot) cur = cur.parentElement;
				if (cur) {
					const z = parseInt(getComputedStyle(cur).zIndex, 10);
					v = isNaN(z) ? 0 : z;
					zCache.set(e, v);
					return v;
				}
			}
			const z = parseInt(getComputedStyle(e).zIndex, 10);
			v = isNaN(z) ? elemZ(e.parentElement) : z;
			zCache.set(e, v);
			return v;
		};

		// elementsFromPoint returns nothing outside the viewport. A cell whose centre is outside it borrows the
		// nearest visible point of the layer instead of being "unknown": otherwise the unknown mark (dilated one cell
		// and interpolated by the kernel) leaks into the visible area as a dark veil at the edge of the screen.
		const vw1 = document.documentElement.clientWidth - 0.5, vh1 = document.documentElement.clientHeight - 0.5;
		const act = active && active.length === N ? active : null; // cells that can influence the output (null = all)
		const NOSTACK = [];

		// Probe one cell: layer stack, "unknown" flag and a signature (ids of the stacked layers).
		const probe = (i, j) => {
			const k = j * nx + i;
			if (done[k]) return;
			if (act && !act[k]) { done[k] = 1; sigs[k] = ''; stacks[k] = NOSTACK; V[k] = 0; return; } // not needed: no probe, nothing painted
			probes++;
			const px = Math.max(0, Math.min(R.left + (i + 0.5) * g, R.right - 0.01, vw1)), py = Math.max(0, Math.min(R.top + (j + 0.5) * g, R.bottom - 0.01, vh1));
			const list = document.elementsFromPoint(px, py);

			const stack = [];
			let sig = '', unk = false, cut = false;
			let bi = below.length - 1; // iterate below layers top-to-bottom

			const flushBelowAbove = (minZ) => {
				while (bi >= 0 && !cut) {
					const BL = below[bi];
					if (minZ !== null && BL.z < minZ) break;
					bi--;
					if (!covers(BL, px, py)) continue;
					stack.push(BL);
					sig += BL.id + ',';
				}
			};

			if (!list.length) {
				unk = true;
				why.add('out of view');
			} else {
				for (let m = 0; m < list.length && !cut; m++) {
					const e = list[m];
					if (e === document.documentElement || e === document.body) continue;
					if (e.tagName === layerTag || e.tagName === planeTag || (e.parentElement && (e.parentElement.tagName === layerTag || e.parentElement.tagName === planeTag))) continue;
					if (e === selfRoot || selfRoot.contains(e)) continue;

					const owner = ownerOf(e);
					if (owner && owner !== rec) {
						if (Comp.isAbove && Comp.isAbove(owner, rec)) continue;
						// Managed elements sit above the layer plane; their corrected canvas is merged via `below`.
						if (e === owner.el || owner.el.contains(e)) continue;
					}

					const ez = elemZ(e);
					if (isFixed(e) && ez > rec.z) continue;
					if (stageRoot && stageRoot.contains(e) && e !== stageRoot && ez > rec.z) continue;
					if (!stageRoot && hostParent && hostParent.contains(e) && e !== hostParent) {
						let sib = e;
						while (sib && sib.parentElement !== hostParent) sib = sib.parentElement;
						if (sib && sib !== selfRoot && sib.tagName !== layerTag) {
							const sz = elemZ(sib);
							if (sz > rec.z || (sz === rec.z && (selfRoot.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_FOLLOWING))) continue;
						}
					}

					flushBelowAbove(ez);
					if (cut) break;

					let Ls = cache.get(e);
					if (!Ls) { Ls = Layers.layersOf(e, rec); cache.set(e, Ls); }
					for (const L of Ls) {
						if (L.k === 'unk') { unk = true; why.add(L.why); continue; }
						if (!covers(L, px, py)) continue;
						stack.push(L);
						sig += L.id + ',';
						if (L.tainted) taint.add(L.id);
						if (L.a >= 0.999 && !L.nocut) { cut = true; break; }
					}
				}
				if (!cut) flushBelowAbove(null);
			}
			if (unk) sig += 'u';
			V[k] = unk ? 1 : 0; sigs[k] = sig; stacks[k] = stack; done[k] = 1;
		};

		const fill = (i0, j0, i1, j1, k0) => {
			for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
				const k = j * nx + i;
				if (done[k]) continue;
				if (act && !act[k]) { done[k] = 1; sigs[k] = ''; stacks[k] = NOSTACK; V[k] = 0; continue; }
				sigs[k] = sigs[k0]; stacks[k] = stacks[k0]; V[k] = V[k0]; done[k] = 1;
			}
		};

		if (B === 1) {
			for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) probe(i, j);
		} else {
			let ai0 = 0, aj0 = 0, ai1 = nx - 1, aj1 = ny - 1;
			if (act) {
				ai0 = nx; aj0 = ny; ai1 = -1; aj1 = -1;
				for (let j = 0; j < ny; j++) {
					const row = j * nx;
					for (let i = 0; i < nx; i++) {
						if (!act[row + i]) continue;
						if (i < ai0) ai0 = i;
						if (i > ai1) ai1 = i;
						if (j < aj0) aj0 = j;
						if (j > aj1) aj1 = j;
					}
				}
			}

			let coarseDone = false;
			if (ai1 < ai0 || aj1 < aj0) {
				fill(0, 0, nx, ny, 0);
				coarseDone = true;
			} else {
				const ci = [ai0, (ai0 + ai1) >> 1, ai1];
				const cj = [aj0, (aj0 + aj1) >> 1, aj1];
				let k0 = -1, uniform = true;
				for (let qj = 0; qj < 3; qj++) {
					for (let qi = 0; qi < 3; qi++) {
						const ii = ci[qi], jj = cj[qj], k = jj * nx + ii;
						if (act && !act[k]) continue;
						probe(ii, jj);
						if (k0 < 0) k0 = k;
						else if (sigs[k] !== sigs[k0]) uniform = false;
					}
				}
				if (uniform) {
					fill(0, 0, nx, ny, k0 >= 0 ? k0 : 0);
					coarseDone = true;
				}
			}

			if (!coarseDone) {
				for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
					const ie = Math.min(bi + B, nx), je = Math.min(bj + B, ny);
					const i1 = Math.min(bi + B, nx - 1), j1 = Math.min(bj + B, ny - 1);
					if (act) {
						let any = false;
						for (let j = bj; j < je && !any; j++) for (let i = bi; i < ie; i++) if (act[j * nx + i]) { any = true; break; }
						if (!any) { fill(bi, bj, ie, je, bj * nx + bi); continue; }
					}
					const ks = [bj * nx + bi, bj * nx + i1, j1 * nx + bi, j1 * nx + i1];
					let k0 = -1, uniform = true;
					for (let q = 0; q < 4; q++) {
						const k = ks[q];
						if (act && !act[k]) continue;
						probe(k % nx, (k / nx) | 0);
						if (k0 < 0) k0 = k; else if (sigs[k] !== sigs[k0]) uniform = false;
					}
					if (uniform && k0 >= 0) fill(bi, bj, ie, je, k0);
					else for (let j = bj; j < je; j++) for (let i = bi; i < ie; i++) probe(i, j);
				}
			}
		}

		// Painting. Neighbouring cells with the same layer stack are painted as one rectangle, and identical
		// consecutive rows are merged vertically (a uniform box becomes ONE rectangle instead of one per row).
		// The rectangle edges are snapped to whole canvas pixels: a clip on a fractional edge is
		// antialiased, and two such clips side by side leave a seam that lets the base colour show
		// through (visible as light horizontal lines over a big photo). The last row and column
		// extend to the canvas edge.
		const rowRuns = (j) => {
			const runs = [], row = j * nx;
			let start = 0, sig = sigs[row];
			for (let i = 1; i <= nx; i++) {
				const cur = i < nx ? sigs[row + i] : null;
				if (cur !== sig) { runs.push({ i0: start, i1: i, sig, stack: stacks[row + start] }); start = i; sig = cur; }
			}
			return runs;
		};
		const paintRows = (runs, jA, jB) => {
			const y0 = Math.round(jA * g * s), y1 = jB >= ny ? h : Math.round(jB * g * s);
			if (y1 <= y0) return;
			for (const run of runs) {
				const x0 = Math.round(run.i0 * g * s), x1 = run.i1 >= nx ? w : Math.round(run.i1 * g * s);
				if (x1 <= x0) continue;
				const C = { x: R.left + x0 / s, y: R.top + y0 / s, w: (x1 - x0) / s, h: (y1 - y0) / s };
				for (let k = run.stack.length - 1; k >= 0; k--) paintLayer(ec, run.stack[k], C);
			}
		};
		let open = null, openFrom = 0;
		for (let j = 0; j < ny; j++) {
			const runs = rowRuns(j);
			if (open && sameRuns(open, runs)) continue;
			if (open) paintRows(open, openFrom, j);
			open = runs; openFrom = j;
		}
		if (open) paintRows(open, openFrom, ny);

		const probeMs = performance.now() - t0;

		const V2 = new Uint8Array(N);
		let unknown = 0;
		for (let k = 0; k < N; k++) unknown += V[k];
		for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
			let v = 0;
			for (let dj = -1; dj <= 1 && !v; dj++) for (let di = -1; di <= 1; di++) {
				const ii = i + di, jj = j + dj;
				if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && V[jj * nx + ii]) { v = 1; break; }
			}
			V2[j * nx + i] = v;
		}
		return { est, grid: { V: V2, nx, ny, g }, why, stats: { cells: N, probes, unknown, tainted: taint.size, baseReal, probeMs, ms: performance.now() - t0 } };
	}

	window.j0.register('ipax-backdrop:resolver', { resolve });
})();