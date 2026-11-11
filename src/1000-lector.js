/**
 * ipax-backdrop / 1000-lector.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 1 - READER: turns CSS into parameters. It never touches pixels.
 *
 * Service 'ipax-backdrop:reader':
 *   scan()            -> Element[]   elements that declare --ipax-backdrop-* in a
 *                                    style rule, plus elements carrying the
 *                                    data-ipax-backdrop attribute.
 *   readParams(el)    -> {ok, reason, ratio, mode, feather, color}
 *
 * Values are read with getComputedStyle, so the normal CSS cascade, media
 * queries, inheritance and inline styles all apply.
 *
 * Stylesheets that cannot be read (cross-origin without CORS, or any linked
 * file opened from file://) are skipped with a warning. Their elements are
 * still found if they carry the data-ipax-backdrop attribute.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	function scan() {
		const N = svc('names'), sels = new Set();
		let unreadable = 0;
		const walk = (rules) => {
			for (const r of rules) {
				if (r.cssRules && !r.selectorText) walk(r.cssRules); // @media, @supports, @layer...
				else if (r.selectorText && r.cssText.indexOf(N.propPrefix) >= 0) sels.add(r.selectorText);
			}
		};
		for (const sh of document.styleSheets) {
			try { walk(sh.cssRules); } catch (e) { unreadable++; }
		}
		const found = new Set();
		sels.forEach((s) => { try { document.querySelectorAll(s).forEach((e) => found.add(e)); } catch (e) { /* invalid selector */ } });
		document.querySelectorAll('[' + N.markerAttr + ']').forEach((e) => found.add(e));
		if (unreadable) window.j0.bus.emit('ipax-backdrop:warning', { message: unreadable + ' stylesheet(s) could not be read (cross-origin or file://). Elements declared only there need the ' + N.markerAttr + ' attribute.' });
		return Array.from(found).filter((el) => el.parentNode && !el.closest(N.layerTag));
	}

	function parseFeather(shorthand, topStr, rightStr, bottomStr, leftStr) {
		let t = 0, r = 0, b = 0, l = 0;
		if (shorthand) {
			const tokens = shorthand.split(/[\s,]+/).filter(Boolean);
			const vals = [];
			for (let i = 0; i < tokens.length; i++) {
				const num = parseFloat(tokens[i]);
				if (!isNaN(num)) vals.push(Math.max(0, num));
			}
			if (vals.length === 1) {
				t = r = b = l = vals[0];
			} else if (vals.length === 2) {
				t = b = vals[0];
				r = l = vals[1];
			} else if (vals.length === 3) {
				t = vals[0];
				r = l = vals[1];
				b = vals[2];
			} else if (vals.length >= 4) {
				t = vals[0];
				r = vals[1];
				b = vals[2];
				l = vals[3];
			}
		}

		const override = (valStr, current) => {
			if (!valStr) return current;
			const num = parseFloat(valStr);
			return (!isNaN(num) && num >= 0) ? num : current;
		};

		return {
			top: override(topStr, t),
			right: override(rightStr, r),
			bottom: override(bottomStr, b),
			left: override(leftStr, l)
		};
	}

	function readParams(el) {
		const N = svc('names'), cs = getComputedStyle(el);
		const get = (n) => cs.getPropertyValue(N.propPrefix + n).trim();
		const c = svc('contrast').parseContrast(get('contrast'));
		const feather = parseFeather(
			get('feather'),
			get('feather-top'),
			get('feather-right'),
			get('feather-bottom'),
			get('feather-left')
		);
		const b = parseFloat(get('blur'));
		return {
			ok: c.ok,
			reason: c.reason || '',
			ratio: c.ratio || 4.5,
			mode: get('mode').toLowerCase() === 'tricontrast' ? 'tricontrast' : 'default',
			feather,
			blur: b > 0 ? b : 0,
			color: cs.color
		};
	}

	window.j0.register('ipax-backdrop:reader', { scan, readParams });
})();
