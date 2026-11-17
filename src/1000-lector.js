// PATH: src/1000-lector.js
/**
 * ipax-backdrop / 1000-lector.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 1 - READER: turns CSS custom properties into solver parameters.
 *
 * Supports two independent, composable CSS families plus shared mode:
 *   Container: --ipax-backdrop (shorthand) & --ipax-backdrop-{contrast,blur,feather,feather-*,mode}
 *   Text:      --ipax-text (shorthand)     & --ipax-text-{x,y,halo,spread,contrast,blur,mode}
 *   Shared:    --ipax-mode (default | tricontrast)
 *
 * Service 'ipax-backdrop:reader':
 *   scan()         -> Element[]
 *   readParams(el) -> {ok, reason, warnings, ratio, mode, feather, blur, text, color, ...}
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const MODES = new Set(['default', 'tricontrast']);

	function scan() {
		const N = svc('names'), sels = new Set();
		let unreadable = 0;
		const hasProp = (txt) => (
			txt.indexOf(N.boxShorthand) >= 0 ||
			txt.indexOf(N.textShorthand) >= 0 ||
			txt.indexOf(N.modeProp) >= 0
		);
		const walk = (rules) => {
			for (const r of rules) {
				if (r.cssRules && !r.selectorText) walk(r.cssRules);
				else if (r.selectorText && hasProp(r.cssText)) sels.add(r.selectorText);
			}
		};
		for (const sh of document.styleSheets) {
			try { walk(sh.cssRules); } catch (e) { unreadable++; }
		}
		const found = new Set();
		sels.forEach((s) => { try { document.querySelectorAll(s).forEach((e) => found.add(e)); } catch (e) { /* invalid selector */ } });
		document.querySelectorAll('[' + N.markerAttr + '], [' + N.textMarkerAttr + ']').forEach((e) => found.add(e));
		if (unreadable) window.j0.bus.emit('ipax-backdrop:warning', { message: unreadable + ' stylesheet(s) could not be read (cross-origin or file://). Elements declared only there need ' + N.markerAttr + ' or ' + N.textMarkerAttr + '.' });
		return Array.from(found).filter((el) => el.parentNode && !el.closest(N.layerTag));
	}

	function parseLengthPx(raw, rootFontPx) {
		const s = String(raw || '').trim();
		if (s === '0') return 0;
		const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem|em)$/i.exec(s);
		if (!m) return null;
		const n = parseFloat(m[1]);
		const u = m[2].toLowerCase();
		if (u === 'px') return n;
		return n * (rootFontPx || 16);
	}

	function parseLengthOrBarePx(raw, rootFontPx) {
		const len = parseLengthPx(raw, rootFontPx);
		if (len !== null) return len;
		const s = String(raw || '').trim();
		if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);
		return null;
	}

	function expandSides(vals) {
		if (!vals.length) return { top: 0, right: 0, bottom: 0, left: 0 };
		if (vals.length === 1) return { top: vals[0], right: vals[0], bottom: vals[0], left: vals[0] };
		if (vals.length === 2) return { top: vals[0], right: vals[1], bottom: vals[0], left: vals[1] };
		if (vals.length === 3) return { top: vals[0], right: vals[1], bottom: vals[2], left: vals[1] };
		return { top: vals[0], right: vals[1], bottom: vals[2], left: vals[3] };
	}

	function parsePerf(s, def) {
		if (!s) return def;
		const v = s.toLowerCase();
		if (v === 'infinite' || v === 'none' || v === '0' || v === '0fps') return 0;
		const m = /^([\d.]+)(?:fps)?$/.exec(v);
		return m ? Math.max(0, parseFloat(m[1])) : def;
	}

	function parseNum(s, def) {
		if (!s) return def;
		const v = parseFloat(s);
		return isNaN(v) ? def : Math.max(0, v);
	}

	function parseBoxParams(cs, sharedMode, rootFontPx, hasTextDecl) {
		const N = svc('names'), K = svc('contrast');
		const get = (n) => cs.getPropertyValue(N.propPrefix + n).trim();
		const sh = cs.getPropertyValue(N.boxShorthand).trim();
		const cLong = get('contrast');
		const bLong = get('blur');
		const fLong = get('feather');
		const ftLong = get('feather-top'), frLong = get('feather-right'), fbLong = get('feather-bottom'), flLong = get('feather-left');
		const mLong = get('mode').toLowerCase();

		const hasBoxDecl = !!(sh || cLong || bLong || fLong || ftLong || frLong || fbLong || flLong);
		const warnings = [];
		let ok = true, reason = '';
		let ratio = (!hasBoxDecl && hasTextDecl) ? 1 : 4.5;
		let blur = 0;
		let feather = { top: 0, right: 0, bottom: 0, left: 0 };
		let mode = sharedMode;

		if (sh) {
			ratio = 4.5;
			const lengths = [];
			for (const tok of sh.split(/[\s,]+/).filter(Boolean)) {
				const low = tok.toLowerCase();
				if (MODES.has(low)) { mode = low; continue; }
				const len = parseLengthPx(tok, rootFontPx);
				if (len !== null) { lengths.push(Math.max(0, len)); continue; }
				const c = K.parseContrast(tok, 4.5);
				if (!c.ok) { ok = false; reason = c.reason; }
				else {
					ratio = c.ratio;
					if (c.warning) warnings.push(c.warning);
				}
			}
			if (lengths.length >= 1) blur = lengths[0];
			if (lengths.length >= 2) feather = expandSides(lengths.slice(1, 5));
		}

		if (cLong) {
			const c = K.parseContrast(cLong, 4.5);
			if (!c.ok) { ok = false; reason = c.reason; }
			else {
				ratio = c.ratio;
				if (c.warning) warnings.push(c.warning);
			}
		}

		if (bLong) {
			const b = parseLengthOrBarePx(bLong, rootFontPx);
			if (b !== null) blur = Math.max(0, b);
		}

		if (fLong) {
			const sides = [];
			for (const tok of fLong.split(/[\s,]+/).filter(Boolean)) {
				const v = parseLengthOrBarePx(tok, rootFontPx);
				if (v !== null) sides.push(Math.max(0, v));
			}
			if (sides.length) feather = expandSides(sides.slice(0, 4));
		}

		const overrideSide = (raw, cur) => {
			if (!raw) return cur;
			const v = parseLengthOrBarePx(raw, rootFontPx);
			return (v !== null && v >= 0) ? v : cur;
		};
		feather.top = overrideSide(ftLong, feather.top);
		feather.right = overrideSide(frLong, feather.right);
		feather.bottom = overrideSide(fbLong, feather.bottom);
		feather.left = overrideSide(flLong, feather.left);

		if (MODES.has(mLong)) mode = mLong;

		return { ok, reason, warnings, ratio, blur, feather, mode };
	}

	function parseTextParams(cs, sharedMode, rootFontPx) {
		const N = svc('names'), K = svc('contrast');
		const get = (n) => cs.getPropertyValue(N.textPrefix + n).trim();
		const sh = cs.getPropertyValue(N.textShorthand).trim();
		const xLong = get('x'), yLong = get('y'), hLong = get('halo'), sLong = get('spread');
		const cLong = get('contrast'), bLong = get('blur'), mLong = get('mode').toLowerCase();

		const hasDecl = !!(sh || xLong || yLong || hLong || sLong || cLong || bLong || mLong);
		const warnings = [];
		let ok = true, reason = '';
		const out = {
			on: false,
			x: 0,
			y: 0,
			halo: 0,
			spread: { v: 0, unit: 'px' },
			ratio: 1,
			blur: 0,
			mode: sharedMode
		};

		if (sh) {
			const preLengths = [], postLengths = [];
			let seenContrast = false;
			for (const tok of sh.split(/[\s,]+/).filter(Boolean)) {
				const low = tok.toLowerCase();
				if (MODES.has(low)) { out.mode = low; continue; }
				const mPct = /^([+-]?(?:\d+\.?\d*|\.\d+))%$/.exec(tok);
				if (mPct) {
					out.spread = { v: Math.max(0, Math.min(100, parseFloat(mPct[1]))), unit: '%' };
					continue;
				}
				const len = parseLengthPx(tok, rootFontPx);
				if (len !== null) {
					if (!seenContrast) preLengths.push(len);
					else postLengths.push(Math.max(0, len));
					continue;
				}
				const c = K.parseContrast(tok, 1);
				seenContrast = true;
				if (!c.ok) { ok = false; reason = '--ipax-text: ' + c.reason; }
				else {
					out.ratio = c.ratio;
					if (c.warning) warnings.push(c.warning);
				}
			}
			if (preLengths.length >= 1) out.x = preLengths[0];
			if (preLengths.length >= 2) out.y = preLengths[1];
			if (preLengths.length >= 3) out.halo = Math.max(0, preLengths[2]);
			if (postLengths.length >= 1) out.blur = postLengths[0];
			if (postLengths.length >= 2) out.spread = { v: postLengths[1], unit: 'px' };
		}

		const xv = parseLengthOrBarePx(xLong, rootFontPx);
		if (xv !== null) out.x = xv;
		const yv = parseLengthOrBarePx(yLong, rootFontPx);
		if (yv !== null) out.y = yv;
		const hv = parseLengthOrBarePx(hLong, rootFontPx);
		if (hv !== null) out.halo = Math.max(0, hv);
		const bv = parseLengthOrBarePx(bLong, rootFontPx);
		if (bv !== null) out.blur = Math.max(0, bv);

		if (cLong) {
			const c = K.parseContrast(cLong, 1);
			if (!c.ok) { ok = false; reason = '--ipax-text-contrast: ' + c.reason; }
			else {
				out.ratio = c.ratio;
				if (c.warning) warnings.push(c.warning);
			}
		}

		if (sLong) {
			const mPct = /^([+-]?(?:\d+\.?\d*|\.\d+))%$/.exec(sLong);
			if (mPct) {
				out.spread = { v: Math.max(0, Math.min(100, parseFloat(mPct[1]))), unit: '%' };
			} else {
				const sv = parseLengthOrBarePx(sLong, rootFontPx);
				if (sv !== null) out.spread = { v: Math.max(0, sv), unit: 'px' };
			}
		}

		if (MODES.has(mLong)) out.mode = mLong;
		out.on = hasDecl && (out.ratio > 1 || out.blur > 0);

		return { ok, reason, warnings, spec: out, hasDecl };
	}

	function readParams(el) {
		const N = svc('names'), cs = getComputedStyle(el), cfg = svc('config');
		const get = (n) => cs.getPropertyValue(N.propPrefix + n).trim();
		const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		const rawSharedMode = cs.getPropertyValue(N.modeProp).trim().toLowerCase();
		const sharedMode = MODES.has(rawSharedMode) ? rawSharedMode : 'default';

		const txt = parseTextParams(cs, sharedMode, rootFontPx);
		const box = parseBoxParams(cs, sharedMode, rootFontPx, txt.hasDecl);

		return {
			ok: box.ok && txt.ok,
			reason: box.reason || txt.reason,
			warnings: box.warnings.concat(txt.warnings),
			ratio: box.ratio,
			mode: box.mode,
			feather: box.feather,
			blur: box.blur,
			text: txt.spec,
			color: cs.color,
			performance: parsePerf(get('performance'), cfg.performance),
			minBudget: parseNum(get('budget-min'), cfg.minBudget),
			backend: get('backend').toLowerCase() || cfg.backend,
			cellSize: parseNum(get('cellsize'), cfg.cellSize),
			maxPixelScale: parseNum(get('maxpixelscale'), cfg.maxPixelScale)
		};
	}

	window.j0.register('ipax-backdrop:reader', { scan, readParams });
})();