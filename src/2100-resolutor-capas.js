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
 *   'lay'  the already-computed layer of ANOTHER managed element
 * Everything else becomes an 'unk' layer carrying the reason. The resolver
 * answers "unknown" for any area where an 'unk' layer is visible, and the
 * kernel covers that area with a translucent veil instead of guessing.
 *
 * Unknown reasons: transform, filter, mix-blend-mode, backdrop-filter (on a
 * non-managed element), pseudo-element with a background, gradient,
 * unsupported background, attachment/origin, image not loaded, geometry,
 * color, object-fit.
 *
 * Service 'ipax-backdrop:layers':
 *   layersOf(el, selfRec)   -> descriptor[]   (selfRec is skipped as "own layer")
 *   imageFor(url)           -> HTMLImageElement | null (null while loading; emits
 *                              'image-loaded' when ready)
 *
 * Images must be same-origin (or CORS-enabled) so the canvas stays readable.
 * Descriptors flag `tainted` for cross-origin URLs.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const images = new Map();
	let uid = 0;

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

	/** Effects that cannot be reproduced, plus the opacity accumulated through ancestors. */
	function inheritedRisk(e) {
		const Comp = svc('compositor');
		let unk = null, op = 1;
		for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
			const c = getComputedStyle(n);
			if (c.transform !== 'none') unk = unk || 'transform';
			else if (c.filter !== 'none') unk = unk || 'filter';
			else if (c.mixBlendMode !== 'normal') unk = unk || 'mix-blend-mode';
			// A managed element is expected to have the author's backdrop-filter (that is the glass blur).
			else if ((c.backdropFilter || c.webkitBackdropFilter || 'none') !== 'none' && !Comp.recordFor(n)) unk = unk || 'backdrop-filter';
			op *= +c.opacity;
		}
		return { unk, op };
	}

	function layersOf(e, selfRec) {
		const G = svc('css-geometry'), Color = svc('color'), Comp = svc('compositor');
		const out = [], risk = inheritedRisk(e), mk = (o) => { o.id = ++uid; return o; };
		if (risk.unk) return [mk({ k: 'unk', why: risk.unk })];

		for (const p of ['::before', '::after']) {
			const ps = getComputedStyle(e, p);
			if (ps.content !== 'none' && ps.content !== 'normal') {
				const c = Color.parseCssColor(ps.backgroundColor);
				if ((c && c[3] > 0) || ps.backgroundImage !== 'none') out.push(mk({ k: 'unk', why: 'pseudo-element' }));
			}
		}

		const cs = getComputedStyle(e), r = e.getBoundingClientRect();
		const pa = { x: r.left + e.clientLeft, y: r.top + e.clientTop, w: e.clientWidth, h: e.clientHeight };

		if (e.tagName === 'IMG') {
			if (!(e.complete && e.naturalWidth)) out.push(mk({ k: 'unk', why: 'image not loaded' }));
			else {
				const g = G.objectFitGeometry(e.naturalWidth, e.naturalHeight, pa, cs.objectFit, cs.objectPosition);
				out.push(g ? mk({ k: 'img', img: e, g, a: risk.op, tainted: isTainted(e.currentSrc) }) : mk({ k: 'unk', why: 'object-fit' }));
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
			out.push(mk({ k: 'img', img, g, a: risk.op, tainted: isTainted(m[1]) }));
		});

		const c = Color.parseCssColor(cs.backgroundColor);
		if (!c) out.push(mk({ k: 'unk', why: 'color' }));
		else if (c[3] > 0) out.push(mk({ k: 'col', c, a: c[3] * risk.op }));

		// The layer a managed element has underneath itself paints below its own background.
		const rg = Comp.recordFor(e);
		if (rg && rg.ready && rg !== selfRec) out.push({ id: 1e6 + rg.id, k: 'lay', cv: rg.cv, r: rg.layer.getBoundingClientRect(), a: 1, nocut: true });
		return out;
	}

	window.j0.register('ipax-backdrop:layers', { layersOf, imageFor });
})();
