// PATH: src/2100-resolutor-capas.js
/**
 * ipax-backdrop / 2100-resolutor-capas.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER (layers): what does ONE element paint?
 *
 * Turns an element's computed style into a list of paint layers (top to
 * bottom) the resolver can reproduce on a canvas. Supported:
 *   'col'  background-color, with alpha and inherited opacity
 *   'img'  url() background images and <img> elements (size, position, repeat)
 * Everything else becomes an 'unk' layer carrying the reason. The resolver
 * answers "unknown" for any area where an 'unk' layer is visible, and the
 * kernel covers that area with a translucent veil instead of guessing.
 *
 * Already-computed managed layers ('lay') are composed directly by
 * 2000-resolutor.js via compositor.layersBelow(), so container scans never
 * depend on per-box state and can be cached across all boxes in the frame.
 *
 * Unknown reasons: transform, filter, mix-blend-mode, backdrop-filter (on a
 * non-managed element), pseudo-element with a background, gradient,
 * unsupported background, attachment/origin, image not loaded, geometry,
 * color, object-fit.
 *
 * FRAME CACHE (v0.1.05+): between beginFrame() and endFrame() the descriptors of
 * every NON-managed element, and the inherited-risk chain of every ancestor, are
 * computed once and shared by all managed elements. Subtrees belonging to managed
 * elements or their stacking wrappers are pruned during pointer-events:none scans.
 *
 * Service 'ipax-backdrop:layers':
 *   layersOf(el, selfRec)   -> descriptor[]   (selfRec is skipped as "own layer")
 *   imageFor(url)           -> HTMLImageElement | null (null while loading; emits
 *                              'image-loaded' when ready)
 *   beginFrame(), endFrame()   open / close the frame cache
 *
 * Images must be same-origin (or CORS-enabled) so the canvas stays readable.
 * Descriptors flag `tainted` for cross-origin URLs.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const images = new Map();
	const NO_RISK = { unk: null, op: 1 };
	let uid = 0;
	let frame = null, riskCache = null;

	function beginFrame() { frame = new Map(); riskCache = new Map(); }
	function endFrame() { frame = null; riskCache = null; }

	function imageFor(url) {
		let e = images.get(url);
		if (!e) {
			e = { img: new Image(), ok: false };
			e.img.onload = () => { e.ok = true; window.j0.bus.emit('ipax-backdrop:image-loaded', {}); };
			e.img.src = url;
			images.set(url, e);
		}
		return e.ok ? e.img : null;
	}

	const isTainted = (u) => {
		try { const x = new URL(u, location.href); return !(x.protocol === 'blob:' || x.protocol === 'data:' || x.origin === location.origin); }
		catch (e) { return true; }
	};

	/** Pure 2D scale/translation matrix (no rotation or skew) used by zoomed stage containers. */
	function isPureScaleTransform(tr) {
		if (!tr || tr === 'none') return true;
		const m = /^matrix\(\s*([-\d.e+]+)\s*,\s*([-\d.e+]+)\s*,\s*([-\d.e+]+)\s*,\s*([-\d.e+]+)\s*,/.exec(tr);
		if (!m) return false;
		const a = +m[1], b = +m[2], c = +m[3], d = +m[4];
		return Math.abs(b) < 1e-6 && Math.abs(c) < 1e-6 && a > 0 && d > 0;
	}

	/** Effects that cannot be reproduced, plus the opacity accumulated through ancestors (cached per frame). */
	function riskOf(n) {
		if (!n || n.nodeType !== 1) return NO_RISK;
		let r = riskCache && riskCache.get(n);
		if (r) return r;
		const Comp = svc('compositor');
		const c = getComputedStyle(n), parent = riskOf(n.parentElement);
		let unk = null;
		if (c.transform !== 'none') {
			const stageZoom = Comp.isStageOrAncestor && Comp.isStageOrAncestor(n) && isPureScaleTransform(c.transform);
			if (!stageZoom) unk = 'transform';
		}
		if (!unk && c.filter !== 'none') unk = 'filter';
		else if (!unk && c.mixBlendMode !== 'normal') unk = 'mix-blend-mode';
		// A managed element is expected to have the author's backdrop-filter (that is the glass blur).
		else if (!unk && (c.backdropFilter || c.webkitBackdropFilter || 'none') !== 'none' && !Comp.recordFor(n)) unk = 'backdrop-filter';
		// The nearest ancestor that carries an effect wins, as before.
		r = { unk: unk || parent.unk, op: (+c.opacity) * parent.op };
		if (riskCache) riskCache.set(n, r);
		return r;
	}

	function build(e) {
		const G = svc('css-geometry'), Color = svc('color');
		const out = [], risk = riskOf(e), mk = (o) => { o.id = ++uid; return o; };
		if (risk.unk) return [mk({ k: 'unk', why: risk.unk })];

		for (const p of ['::before', '::after']) {
			const ps = getComputedStyle(e, p);
			if (ps.content !== 'none' && ps.content !== 'normal') {
				const c = Color.parseCssColor(ps.backgroundColor);
				if ((c && c[3] > 0) || ps.backgroundImage !== 'none') out.push(mk({ k: 'unk', why: 'pseudo-element' }));
			}
		}

		const cs = getComputedStyle(e), r = e.getBoundingClientRect();
		const ow = e.offsetWidth, oh = e.offsetHeight;
		const sx = ow > 0 ? r.width / ow : 1, sy = oh > 0 ? r.height / oh : 1;
		const pa = {
			x: r.left + e.clientLeft * sx,
			y: r.top + e.clientTop * sy,
			w: e.clientWidth * sx,
			h: e.clientHeight * sy
		};

		if (e.tagName === 'IMG') {
			if (!(e.complete && e.naturalWidth)) out.push(mk({ k: 'unk', why: 'image not loaded' }));
			else {
				const g = G.objectFitGeometry(e.naturalWidth, e.naturalHeight, pa, cs.objectFit, cs.objectPosition);
				out.push(g ? mk({ k: 'img', img: e, g, a: risk.op, tainted: isTainted(e.currentSrc), r }) : mk({ k: 'unk', why: 'object-fit' }));
			}
		}

		const list = cs.backgroundImage === 'none' ? [] : G.splitTop(cs.backgroundImage);
		const sizes = G.splitTop(cs.backgroundSize), poss = G.splitTop(cs.backgroundPosition), reps = G.splitTop(cs.backgroundRepeat);
		const orgs = G.splitTop(cs.backgroundOrigin), atts = G.splitTop(cs.backgroundAttachment);
		list.forEach((s, i) => {
			const at = (a) => a[i % a.length]; // CSS repeats shorter lists to match the image count
			const m = /^url\(["']?(.*?)["']?\)$/.exec(s);
			if (!m) { out.push(mk({ k: 'unk', why: /gradient/.test(s) ? 'gradient' : 'unsupported background' })); return; }
			if (at(atts) === 'fixed' || at(orgs) !== 'padding-box') { out.push(mk({ k: 'unk', why: 'attachment/origin' })); return; }
			const img = imageFor(m[1]);
			if (!img) { out.push(mk({ k: 'unk', why: 'image not loaded' })); return; }
			const rp = G.parseRepeat(at(reps)), g = rp && G.backgroundGeometry(img.naturalWidth, img.naturalHeight, pa, at(sizes), at(poss), rp);
			if (!g) { out.push(mk({ k: 'unk', why: 'geometry' })); return; }
			out.push(mk({ k: 'img', img, g, a: risk.op, tainted: isTainted(m[1]), r }));
		});

		const c = Color.parseCssColor(cs.backgroundColor);
		if (!c) out.push(mk({ k: 'unk', why: 'color' }));
		else if (c[3] > 0) out.push(mk({ k: 'col', c, a: c[3] * risk.op, r }));

		return out;
	}

	function layersOf(e, selfRec) {
		const Comp = svc('compositor'), N = svc('names');
		const layerTag = N.layerTag.toUpperCase();
		const planeTag = (N.planeTag || 'ipax-backdrop-plane').toUpperCase();
		const isAncestor = !!(selfRec && e.contains(selfRec.el));
		const isManaged = !!Comp.recordFor(e);
		const isWrap = !!(Comp.isWrapper && Comp.isWrapper(e));
		const cacheable = frame !== null && !isManaged && !isWrap && !isAncestor;
		if (cacheable) { const hit = frame.get(e); if (hit) return hit; }

		const out = [];
		const scanPointerNone = (root) => {
			for (let d = root.firstElementChild; d; d = d.nextElementSibling) {
				if (d.tagName === layerTag || d.tagName === planeTag) continue;
				if (Comp.recordFor(d) || (Comp.isWrapper && Comp.isWrapper(d))) continue;
				const cs = getComputedStyle(d);
				if (cs.display === 'none' || parseFloat(cs.opacity) <= 0) continue;
				scanPointerNone(d);
				if (cs.pointerEvents === 'none') {
					const items = build(d);
					for (let i = 0; i < items.length; i++) out.push(items[i]);
				}
			}
		};

		if (!isAncestor) {
			try { scanPointerNone(e); } catch (err) {}
		}

		const own = build(e);
		for (let i = 0; i < own.length; i++) out.push(own[i]);
		if (cacheable) frame.set(e, out);
		return out;
	}

	window.j0.register('ipax-backdrop:layers', { layersOf, imageFor, beginFrame, endFrame });
})();