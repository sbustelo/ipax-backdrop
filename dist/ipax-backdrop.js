/*! IPAX Backdrop • ipax.bustelo.com.ar • Build: 2026-11-11 */

/* --- lib/j0-kernel/01-bus-j0kernel.js --- */
/* j0 framework kernel 0.4.01 • 11/nov/2026
 * Santiago Bustelo, https://bustelo.com.ar/ 
 * Apache License, Version 2.0 */

(function () {
    'use strict';

    window.j0 = window.j0 || {};
    if (window.j0.EventChannel) return;

    window.j0.EventChannel = class EventChannel {
        constructor(name) {
            this.name = name;
            this._handlers = new Map();
        }

        emit(action, payload = {}) {
            if (window.j0 && window.j0.QA && window.j0.bus && window.j0.bus.schema) {
                const contract = window.j0.bus.schema[action];
                if (contract) {
                    for (const [key, expectedType] of Object.entries(contract)) {
                        const actualType = typeof payload[key];
                        if (actualType !== expectedType) {
                            const msg = `[J0_BUS_SCHEMA] Payload inválido en evento '${action}': '${key}' debe ser '${expectedType}', recibido '${actualType}'.`;
                            if (window.j0?.logger) window.j0.logger.error(msg);
                            else console.error(msg);
                            throw new Error(msg);
                        }
                    }
                }
            }

            const set = this._handlers.get(action);
            if (!set || set.size === 0) return;
            
            new Set(set).forEach(fn => {
                try { 
                    fn(payload); 
                } catch (e) { 
                    const fnSource = fn.toString().substring(0, 50) + "...";
                    if (window.j0 && window.j0.logger) {
                        window.j0.logger.error(`[TELEMETRÍA] CRASH en Bus '${this.name}' evento '${action}'. Handler: ${fnSource}`, e);
                    } else {
                        console.error(`[TELEMETRÍA] CRASH en Bus '${this.name}' evento '${action}':`, e);
                    }
                }
            });
        }

        on(action, handler) {
            if (!this._handlers.has(action)) this._handlers.set(action, new Set());
            this._handlers.get(action).add(handler);
            return () => {
                const set = this._handlers.get(action);
                if (set) {
                    set.delete(handler);
                    if (set.size === 0) this._handlers.delete(action);
                }
            };
        }
    };
})();
;

/* --- lib/j0-kernel/02-core-j0kernel.js --- */
/* j0 framework kernel 0.4.01 (sans manifest, logger, i18n, M helper) • 11/nov/2026
 * Santiago Bustelo, https://bustelo.com.ar/ 
 * Apache License, Version 2.0 */

 (function () {
	"use strict";
	
	if (window.j0 && window.j0.registry) return;

	window.j0 = window.j0 || {};
	
	// [!] Instanciación real del Bus de Eventos.
	window.j0.bus = window.j0.bus || new window.j0.EventChannel("global");
	window.j0.bus.schema = window.j0.bus.schema || {};

	window.j0.registry = window.j0.registry || new Map();

	/* 
	// [IPAX-BACKDROP EXCLUSIONS]
	// The following features belong to the full j0 UI framework and are 
	// safely commented out here to reduce the standalone ipax-backdrop footprint:
	// - manifest
	// - logger (with its 3-second timeout)
	// - i18n (dictionary and DOM updater)
	// - helpers (M translation function)

	window.j0.manifest = window.j0.manifest || { bases: {}, tpl_bases: {} };

    window.j0.logger = window.j0.logger || {
        _bootQueue: [],
        _isBroken: false,
        _flushNative: function() {
            this._bootQueue.forEach(item => {
                const out = \`[J0:PRE-BOOT] [\${item.type}] \${item.msg}\`;
                if (item.type === 'ERROR') console.error(out, item.data || '');
                else if (item.type === 'WARN') console.warn(out, item.data || '');
                else console.log(out, item.data || '');
            });
            this._bootQueue = [];
            this._isBroken = true;
        },
        log: function(msg, data) { 
            if (this._isBroken) console.log(\`[J0:PRE-BOOT] [INFO] \${msg}\`, data || '');
            else this._bootQueue.push({ type: 'INFO', msg, data }); 
        },
        warn: function(msg, data) { 
            if (this._isBroken) console.warn(\`[J0:PRE-BOOT] [WARN] \${msg}\`, data || '');
            else this._bootQueue.push({ type: 'WARN', msg, data }); 
        },
        error: function(msg, data) { 
            this._bootQueue.push({ type: 'ERROR', msg, data });
            this._flushNative();
        }
    };

    setTimeout(() => {
        if (window.j0.logger && window.j0.logger._bootQueue && window.j0.logger._bootQueue.length > 0) {
            console.error("[j0:Kernel] TIMEOUT: El OS j0ui no logró instanciarse. Volcando bitácora de arranque:");
            window.j0.logger._flushNative();
        }
    }, 3000);

	window.j0.i18n = {
		dicts: {},
		stringsEmitted: new Set(),
        isReady: false,
		slugify: function(text) {
			if (!text) return '';
			return text
				.replace(/<[^>]*>/g, '')
				.normalize("NFD")
				.replace(/[\\u0300-\\u036f]/g, "")
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "")
				.substring(0, 40);
		},
		add: function(lang, translations) {
			if (!this.dicts[lang]) this.dicts[lang] = {};
			for (const [key, value] of Object.entries(translations)) {
				if (window.j0.env === 'local' && this.dicts[lang][key] && this.dicts[lang][key] !== value) {
					if (window.j0.logger) window.j0.logger.warn(\`[i18n:Collision] La llave '\${key}' ('\${this.dicts[lang][key]}') fue pisada por '\${value}'.\`);
				}
				this.dicts[lang][key] = value;
			}
			if (window.j0.bus) window.j0.bus.emit('j0:i18n:dictionary-updated', { lang });
		},
        updateDOM: function(forceFallback = false) {
            const lang = window.j0.lang || document.documentElement.lang || 'en';
            const dict = this.dicts[lang] || {};

            document.querySelectorAll('.j0ui-text-spinner[data-j0-i18n-key]').forEach(el => {
                const key = el.getAttribute('data-j0-i18n-key');
                let resolvedText = null;
                
                if (!forceFallback && dict[key] !== undefined) {
                    resolvedText = dict[key];
                } else {
                    const delNode = el.querySelector('del');
                    resolvedText = delNode ? delNode.textContent : key;
                }

                el.innerHTML = resolvedText;
                el.removeAttribute('aria-busy');
                el.removeAttribute('aria-label');
                el.classList.remove('j0ui-text-spinner');
                el.removeAttribute('data-j0-i18n-key');
            });

            document.querySelectorAll('[data-j0-i18n-attr]').forEach(el => {
                try {
                    const map = JSON.parse(el.getAttribute('data-j0-i18n-attr'));
                    let updated = false;
                    Object.entries(map).forEach(([attr, key]) => {
                        if (!forceFallback && dict[key] !== undefined) {
                            el.setAttribute(attr, dict[key]);
                            delete map[attr];
                            updated = true;
                        } else if (forceFallback) {
                            delete map[attr];
                            updated = true;
                        }
                    });
                    if (updated) {
                        if (Object.keys(map).length === 0) el.removeAttribute('data-j0-i18n-attr');
                        else el.setAttribute('data-j0-i18n-attr', JSON.stringify(map));
                    }
                } catch (e) {}
            });
        }
	};

	window.j0.helpers = window.j0.helpers || {};

	window.j0.helpers.M = function(text) {
		if (!text) return '';
		const lang = window.j0.lang || document.documentElement.lang || 'en';
		const key = window.j0.i18n.slugify(text);
		const dict = window.j0.i18n.dicts[lang] || {};
		
        if (window.j0.i18n.isReady) {
            const resolvedValue = dict[key] !== undefined ? dict[key] : text;
            window.j0.i18n.stringsEmitted.add(resolvedValue);
            return resolvedValue;
        }

		if (dict[key] !== undefined) {
            const resolvedValue = dict[key];
            window.j0.i18n.stringsEmitted.add(resolvedValue);
			if (window.j0.bus) window.j0.bus.emit('j0:i18n:string-emitted', { resolved: resolvedValue, key, original: text });
            return resolvedValue;
        }

        return \`<span class="j0ui-text-spinner" data-j0-i18n-key="\${key}" aria-busy="true" aria-label="Loading..."><del aria-hidden="true" style="visibility:hidden;pointer-events:none;">\${text}</del></span>\`;
	};
	*/

	window.j0.register = (name, instance) => {
		window.j0.registry.set(name, instance);
		if (window.j0.bus) window.j0.bus.emit("module:registered", { name });
	};

	window.j0.get = (name) => window.j0.registry.get(name);
})();
;

/* --- src/0010-nucleo.js --- */
/**
 * ipax-backdrop / 0010-nucleo.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 0 - FOUNDATION
 *
 * Shared constants, default configuration and bus event contracts.
 * This file talks to the j0 kernel (lib/j0-kernel) and to nothing else.
 *
 * Architecture rules (valid for every file in src/):
 *   1. One IIFE per file, 'use strict'. No import / export.
 *   2. The only global is window.j0. Each module publishes itself with
 *      window.j0.register('ipax-backdrop:<name>', service).
 *   3. A module never needs another one at LOAD time. It looks services up
 *      with window.j0.get() when it is CALLED. Files are loaded by ascending
 *      numeric prefix, but that order only matters for readability.
 *   4. Synchronous calls go through the registry. The bus is only used for
 *      notifications; it never carries data between pipeline stages.
 *
 * Services registered here:
 *   'ipax-backdrop:names'   frozen constants (CSS property prefix, tag names).
 *   'ipax-backdrop:limits'  frozen hard limits shared by both kernels.
 *   'ipax-backdrop:config'  mutable runtime configuration (see docs/CSS-API.md).
 *
 * Bus events (all prefixed 'ipax-backdrop:'):
 *   ready         {}                                  after start()
 *   updated       {element, ms, backend, ...}         one element was recomputed
 *   backend       {backend, reason}                   the kernel backend changed
 *   warning       {message}                           recoverable problem
 *   error         {message}                           an update failed
 *   image-loaded  {}                                  a background image finished loading
 *   invalidate    {reason}                            geometry changed, a refresh is needed
 */
(function () {
	'use strict';

	if (!window.j0 || !window.j0.register || !window.j0.bus) {
		console.error('[ipax-backdrop] The j0 kernel was not found. Load lib/j0-kernel/01-bus-j0kernel.js and 02-core-j0kernel.js before src/.');
		return;
	}
	const j0 = window.j0;

	const names = Object.freeze({
		propPrefix: '--ipax-backdrop-',          // CSS custom properties read by the reader
		layerTag: 'ipax-backdrop-layer',         // element created under every managed element
		managedAttr: 'data-ipax-backdrop-managed', // set by the compositor on managed elements
		markerAttr: 'data-ipax-backdrop'         // optional opt-in marker set by the page author
	});

	const limits = Object.freeze({
		maxRuns: 7 // differently coloured text runs per element (uniform array size in the shader)
	});

	/** Mutable. Change before start() or at any time; read on every update. */
	const config = {
		backend: 'auto',   // 'auto' | 'webgl' | 'cpu'
		cellSize: 12,      // CSS px; resolution of the "what is underneath" probe grid
		maxPixels: 60000,  // working resolution cap (pixels) per managed element
		autoStart: true    // start on DOMContentLoaded
	};

	// Payload contracts, checked by the j0 bus when window.j0.QA is truthy.
	const S = j0.bus.schema;
	S['ipax-backdrop:ready'] = {};
	S['ipax-backdrop:updated'] = { element: 'object', ms: 'number', backend: 'string' };
	S['ipax-backdrop:backend'] = { backend: 'string', reason: 'string' };
	S['ipax-backdrop:warning'] = { message: 'string' };
	S['ipax-backdrop:error'] = { message: 'string' };
	S['ipax-backdrop:image-loaded'] = {};
	S['ipax-backdrop:invalidate'] = { reason: 'string' };

	j0.register('ipax-backdrop:names', names);
	j0.register('ipax-backdrop:limits', limits);
	j0.register('ipax-backdrop:config', config);
})();
;

/* --- src/0100-util-color.js --- */
/**
 * ipax-backdrop / 0100-util-color.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 0 - UTILITIES: colour math. Pure functions, no DOM, no state.
 *
 * Service 'ipax-backdrop:color':
 *   clamp01(x), smooth(m)            helpers
 *   LUT                              Float32Array(256): sRGB 8-bit -> linear light
 *   toSrgb255(l)                     linear light -> sRGB 0..255 (float, not rounded)
 *   luminance(r, g, b)               WCAG relative luminance from linear RGB
 *   linToOklab(r, g, b, out)         linear RGB -> OKLab, written into out[0..2]
 *   oklabToLin(L, a, b, out)         OKLab -> linear RGB, CLIPPED to the sRGB gamut
 *   parseCssColor(str)               'rgb()/rgba()/transparent' -> [r, g, b, a] | null
 *
 * Gamut note: oklabToLin clips channels to [0, 1]. When the adjusted lightness
 * leaves the sRGB gamut for a saturated colour, hue shifts slightly. A chroma
 * reduction strategy is a possible future improvement.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
	const smooth = (m) => m * m * (3 - 2 * m);

	const LUT = new Float32Array(256);
	for (let i = 0; i < 256; i++) {
		const c = i / 255;
		LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	}

	const toSrgb255 = (l) => {
		l = clamp01(l);
		return 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
	};

	const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

	function linToOklab(r, g, b, out) {
		const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
		const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
		const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
		out[0] = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
		out[1] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
		out[2] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
	}

	function oklabToLin(L, a, b, out) {
		let l = L + 0.3963377774 * a + 0.2158037573 * b; l = l * l * l;
		let m = L - 0.1055613458 * a - 0.0638541728 * b; m = m * m * m;
		let s = L - 0.0894841775 * a - 1.2914855480 * b; s = s * s * s;
		out[0] = clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
		out[1] = clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
		out[2] = clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
	}

	function parseCssColor(str) {
		if (!str) return null;
		if (str === 'transparent') return [0, 0, 0, 0];
		const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+)(%?))?\s*\)/.exec(str);
		if (!m) return null;
		let a = m[4] === undefined ? 1 : +m[4];
		if (m[5]) a /= 100;
		return [+m[1], +m[2], +m[3], a];
	}

	window.j0.register('ipax-backdrop:color', { clamp01, smooth, LUT, toSrgb255, luminance, linToOklab, oklabToLin, parseCssColor });
})();
;

/* --- src/0110-util-contrast.js --- */
/**
 * ipax-backdrop / 0110-util-contrast.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 0 - UTILITIES: contrast model (WCAG 2.x only). Pure functions.
 *
 * This is the single place that knows how contrast is measured. Both kernels
 * (CPU and WebGL) receive their per-colour parameters from here, so they can
 * never disagree about the maths.
 *
 * Service 'ipax-backdrop:contrast':
 *   MAX_WCAG_RATIO                   15. Larger numbers are read as APCA Lc (unsupported).
 *   ratio(yA, yB)                    WCAG contrast ratio of two relative luminances.
 *   parseContrast(raw)               CSS value -> {ok, ratio} | {ok:false, reason}
 *   solveRatio(ratio)                ratio the solver aims for (see SAFETY)
 *   isBypass(ratio)                  true when ratio <= 1: every colour pair already meets it, so the
 *                                    kernels skip the solve and the veil (blur-only mode)
 *   prepareColor(rgb255, solveR)     per text colour: {yT, pkL, pkR, al, vc}
 *   band(ratio)                      tricontrast luminance band {lo, hi, ok}
 *   bandVeil(band)                   translucent grey veil that lands in the band {al, vc}
 *
 * SAFETY: the output is rounded to 8 bits per channel. Solving exactly at the
 * threshold would leave up to ~0.6% of pixels slightly below it after
 * rounding. A 1.2% margin (default mode) and a small guard on the band
 * (tricontrast mode) absorb that. Both were measured, see docs.
 *
 * Direction ("pk"): for a given text colour the best background is the
 * extreme (black or white) that contrasts more. pkL = 1 means "lighten the
 * background", pkL = 0 means "darken it".
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const MAX_WCAG_RATIO = 15;
	const SAFETY = 1.012;

	const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
	const solveRatio = (r) => r * SAFETY;
	/** WCAG ratios are never below 1, so ratio <= 1 asks for nothing. */
	const isBypass = (r) => r <= 1;

	function parseContrast(raw) {
		const s = (raw || '').trim();
		if (s === '') return { ok: true, ratio: 4.5 };
		if (/lc$/i.test(s)) return { ok: false, reason: 'APCA Lc contrast is not supported in this version (got "' + s + '"). Use a WCAG ratio up to 15.' };
		const v = parseFloat(s);
		if (!(v > 0)) return { ok: false, reason: 'Invalid --ipax-backdrop-contrast value "' + s + '".' };
		if (v > MAX_WCAG_RATIO) return { ok: false, reason: 'Values above 15 are read as APCA Lc, which is not supported in this version (got "' + s + '").' };
		return { ok: true, ratio: v };
	}

	/**
	 * Default mode parameters for one text colour.
	 * al / vc: alpha and grey level (0..255) of the translucent veil that
	 * guarantees the ratio against the worst possible backdrop.
	 */
	function prepareColor(rgb, solveR) {
		const C = svc('color'), LUT = C.LUT;
		const yT = C.luminance(LUT[rgb[0] | 0], LUT[rgb[1] | 0], LUT[rgb[2] | 0]);
		const rW = 1.05 / (yT + 0.05), rB = (yT + 0.05) / 0.05, pkL = rW >= rB ? 1 : 0;
		const Yq = pkL ? solveR * (yT + 0.05) - 0.05 : (yT + 0.05) / solveR - 0.05;
		let al;
		if (pkL === 0) { if (Yq <= 0) al = 1; else if (Yq >= 1) al = 0; else al = 1 - C.toSrgb255(Yq) / 255; }
		else if (Yq > 1) al = 1; else if (Yq <= 0) al = 0; else al = C.toSrgb255(Yq) / 255;
		return { yT, pkL, pkR: Math.max(rW, rB), al: Math.min(1, al + 0.004), vc: pkL ? 255 : 0 };
	}

	/**
	 * Tricontrast: luminance band where BOTH white and black text reach the ratio.
	 * Exists only up to ~4.58:1; the guard shrinks it a little further.
	 */
	function band(r) {
		const G = r < 4.4 ? 0.003 : 0.002;
		let lo = Math.max(0, 0.05 * r - 0.05) + G, hi = Math.min(1, 1.05 / r - 0.05) - G;
		const ok = lo <= hi;
		if (!ok) lo = hi = (lo + hi) / 2;
		return { lo, hi, ok };
	}

	function bandVeil(b) {
		const C = svc('color');
		const vlo = C.toSrgb255(b.lo) / 255, vhi = C.toSrgb255(b.hi) / 255, w = vhi - vlo;
		if (!b.ok || w <= 0) return { al: 1, vc: Math.round(vlo * 255) };
		const al = C.clamp01(1 - w);
		return { al: Math.min(1, al + 0.004), vc: C.clamp01(vlo / al) * 255 };
	}

	window.j0.register('ipax-backdrop:contrast', { MAX_WCAG_RATIO, ratio, parseContrast, solveRatio, isBypass, prepareColor, band, bandVeil });
})();
;

/* --- src/0200-orquestador.js --- */
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
		// elementsFromPoint only answers inside the viewport: skip what is entirely outside it. The scroll
		// listener recomputes the element when it comes into view.
		if (R.bottom < 0 || R.top > window.innerHeight || R.right < 0 || R.left > window.innerWidth) return;

		const params = svc('reader').readParams(el);
		if (!params.ok) { compositor.clear(rec); warnOnce(el, params.reason); return; }
		lastMessage.delete(el);

		const s = Math.min(1, Math.sqrt(cfg.maxPixels / (R.width * R.height)));
		const w = Math.max(1, Math.ceil(R.width * s)), h = Math.max(1, Math.ceil(R.height * s));

		const colors = svc('reader-text').readColors(el, R, params.color);
		if (colors.truncated) warnOnce(el, 'More than ' + svc('limits').maxRuns + ' differently coloured text runs: the extra ones use the base colour.');

		const res = svc('resolver').resolve(rec, R, s, w, h, Math.max(4, cfg.cellSize));
		const estBlur = params.blur > 0 ? svc('blur').blur(res.est, w, h, params.blur * s) : null;
		
		const out = svc('kernel').render({ est: res.est, estBlur, grid: res.grid, w, h, s, W: R.width, H: R.height, params, colors });
		compositor.draw(rec, w, h, out, params.blur); // must happen right away: a WebGL result is only valid until the next render

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
		window.addEventListener('scroll', schedule, { passive: true });
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
		window.removeEventListener('scroll', schedule);
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
;

/* --- src/1000-lector.js --- */
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
;

/* --- src/1100-lector-texto.js --- */
/**
 * ipax-backdrop / 1100-lector-texto.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 1 - READER (text): which colours does the text inside the element have?
 *
 * Service 'ipax-backdrop:reader-text':
 *   readColors(el, rect, baseColorStr) -> {base:[r,g,b], runs:[{x0,y0,x1,y1,c}], truncated}
 *
 * The base colour is the computed `color` of the element. A "run" is a text
 * node whose colour differs from the base (for example a <b> or <span> with
 * another colour). Run rectangles are relative to `rect` (the element box),
 * in CSS pixels, one rectangle per line box. Only limits.maxRuns rectangles
 * are kept; `truncated` tells the orchestrator when some were dropped.
 *
 * Why runs matter: white text needs a darker backdrop and black text a lighter
 * one. Each run asks for its own correction, blended smoothly with its
 * neighbours by the kernel.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	function readColors(el, rect, baseStr) {
		const C = svc('color'), max = svc('limits').maxRuns;
		const toRgb = (str) => { const c = C.parseCssColor(str); return c ? [c[0], c[1], c[2]] : [255, 255, 255]; };
		const base = toRgb(baseStr), runs = [];
		let truncated = false;
		const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
		let node;
		while ((node = tw.nextNode())) {
			if (!node.nodeValue.trim()) continue;
			const c = toRgb(getComputedStyle(node.parentElement).color);
			if (Math.abs(c[0] - base[0]) + Math.abs(c[1] - base[1]) + Math.abs(c[2] - base[2]) < 24) continue;
			range.selectNodeContents(node);
			for (const r of range.getClientRects()) {
				if (r.width <= 0 || r.height <= 0) continue;
				if (runs.length >= max) { truncated = true; continue; }
				runs.push({ x0: r.left - rect.left, y0: r.top - rect.top, x1: r.right - rect.left, y1: r.bottom - rect.top, c });
			}
		}
		return { base, runs, truncated };
	}

	window.j0.register('ipax-backdrop:reader-text', { readColors });
})();
;

/* --- src/2000-resolutor.js --- */
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
		ec.setTransform(s, 0, 0, s, -R.left * s, -R.top * s); // from here on, draw in client coordinates

		const nx = Math.ceil(R.width / g), ny = Math.ceil(R.height / g);
		const V = new Uint8Array(nx * ny), cache = new Map(), why = new Set(), taint = new Set();

		Comp.withHitTesting(rec, () => {
			for (let j = 0; j < ny; j++) {
				let runSig = null, runStart = 0, runStack = null;
				// Neighbouring cells with the same layer stack are painted as one rectangle.
				// The rectangle edges are snapped to whole canvas pixels: a clip on a fractional edge is
				// antialiased, and two such clips side by side leave a seam that lets the base colour show
				// through (visible as light horizontal lines over a big photo). The last row and column
				// extend to the canvas edge.
				const flush = (iEnd) => {
					if (runSig === null) return;
					const x0 = Math.round(runStart * g * s), x1 = iEnd >= nx ? w : Math.round(iEnd * g * s);
					const y0 = Math.round(j * g * s), y1 = j + 1 >= ny ? h : Math.round((j + 1) * g * s);
					if (x1 <= x0 || y1 <= y0) return;
					const C = { x: R.left + x0 / s, y: R.top + y0 / s, w: (x1 - x0) / s, h: (y1 - y0) / s };
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
;

/* --- src/2100-resolutor-capas.js --- */
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
;

/* --- src/2200-resolutor-geometria.js --- */
/**
 * ipax-backdrop / 2200-resolutor-geometria.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER (geometry): where is a background image drawn?
 *
 * Reproduces the CSS rules for background-size / -position / -repeat (and
 * object-fit for <img>) so the resolver can paint a faithful copy of what the
 * browser paints. Anything it cannot reproduce returns null and the caller
 * marks the area as "unknown".
 *
 * Service 'ipax-backdrop:css-geometry':
 *   splitTop(str)                              split a CSS list at top-level commas (memoised)
 *   parseLength(token, ref)                    '12px' | '50%' -> px (percent of ref) | null
 *   parseRepeat(str)                           -> {rx, ry} | null
 *   backgroundGeometry(iw, ih, pa, size, pos, rep)
 *   objectFitGeometry(iw, ih, pa, fit, pos)    -> geometry | null
 *
 * A geometry is {x, y, dw, dh, rx, ry}: top-left of the first tile and tile
 * size in client px, plus whether it repeats on each axis. `pa` is the
 * positioning area {x, y, w, h} (the padding box).
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const splitCache = new Map();

	function splitTop(s) {
		const hit = splitCache.get(s);
		if (hit) return hit;
		const out = [];
		let d = 0, cur = '';
		for (const ch of s) {
			if (ch === '(') d++; else if (ch === ')') d--;
			if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
		}
		if (cur.trim()) out.push(cur.trim());
		if (splitCache.size > 30) splitCache.clear(); // data: URLs make keys large
		splitCache.set(s, out);
		return out;
	}

	function parseLength(token, ref) {
		const v = parseFloat(token);
		if (isNaN(v)) return null;
		return token.endsWith('%') ? v / 100 * ref : v;
	}

	function parseRepeat(s) {
		const t = s.trim().split(/\s+/);
		if (t[0] === 'repeat-x') return { rx: true, ry: false };
		if (t[0] === 'repeat-y') return { rx: false, ry: true };
		const a = t[0], b = t[1] || t[0], ok = (v) => v === 'repeat' || v === 'no-repeat';
		return ok(a) && ok(b) ? { rx: a === 'repeat', ry: b === 'repeat' } : null;
	}

	function backgroundGeometry(iw, ih, pa, size, pos, rep) {
		if (!iw || !ih || pa.w <= 0 || pa.h <= 0) return null;
		let dw, dh;
		const sz = size.trim().split(/\s+/);
		if (sz[0] === 'cover') { const k = Math.max(pa.w / iw, pa.h / ih); dw = iw * k; dh = ih * k; }
		else if (sz[0] === 'contain') { const k = Math.min(pa.w / iw, pa.h / ih); dw = iw * k; dh = ih * k; }
		else {
			dw = sz[0] === 'auto' ? null : parseLength(sz[0], pa.w);
			dh = (sz[1] === undefined || sz[1] === 'auto') ? null : parseLength(sz[1], pa.h);
			if (sz[0] !== 'auto' && dw === null) return null;
			if (dw === null && dh === null) { dw = iw; dh = ih; }
			else if (dw === null) dw = dh * iw / ih;
			else if (dh === null) dh = dw * ih / iw;
		}
		const p = pos.trim().split(/\s+/);
		const px = parseLength(p[0], pa.w - dw), py = parseLength(p[1] || '50%', pa.h - dh);
		if (px === null || py === null || dw < 2 || dh < 2) return null;
		return { x: pa.x + px, y: pa.y + py, dw, dh, rx: rep.rx, ry: rep.ry };
	}

	function objectFitGeometry(iw, ih, pa, fit, pos) {
		if (fit === 'fill') return { x: pa.x, y: pa.y, dw: pa.w, dh: pa.h, rx: false, ry: false };
		if (fit === 'cover' || fit === 'contain') return backgroundGeometry(iw, ih, pa, fit, pos, { rx: false, ry: false });
		return null;
	}

	window.j0.register('ipax-backdrop:css-geometry', { splitTop, parseLength, parseRepeat, backgroundGeometry, objectFitGeometry });
})();
;

/* --- src/2300-resolutor-desenfoque.js --- */
/**
 * ipax-backdrop / 2300-resolutor-desenfoque.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER (blur): a blurred copy of the backdrop estimate.
 *
 * The kernels mix the sharp and the blurred estimate with the feather mask,
 * so the blur fades in from the element edge exactly like the contrast
 * correction does. It is done ONCE, here, in JavaScript, and handed to both
 * kernels as a second image.
 *
 * ARCHITECTURE OPTIMIZATIONS (Zero GC, Zero Cache-Miss):
 * 1. Persistent scratchpads (bufA, bufB) to eliminate frame-drop allocations.
 * 2. Planar RGB extraction to process channels continuously.
 * 3. 1D Box Blur commutative transposing: H, H, H -> Transpose -> H, H, H.
 *    Vertical passes are done horizontally in memory to maximize CPU L1/L2 cache hits.
 * 4. Pure integer arithmetic.
 *
 * Service 'ipax-backdrop:blur':
 *   blur(est, w, h, sigma) -> HTMLCanvasElement | null
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	let bufA = new Uint32Array(0);
	let bufB = new Uint32Array(0);

	const boxRadius = (sigma) => Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));

	/** Optimized 1D Box Blur with clamping and integer division */
	function pass1D(s, d, len, count, r) {
		const diam = 2 * r + 1;
		for (let j = 0; j < count; j++) {
			const base = j * len;
			let acc = s[base] * (r + 1);
			for (let i = 1; i <= r; i++) {
				acc += s[base + (i < len ? i : len - 1)];
			}
			for (let i = 0; i < len; i++) {
				d[base + i] = (acc / diam) | 0;
				const right = i + r + 1;
				const left = i - r;
				acc += s[base + (right < len ? right : len - 1)] - s[base + (left >= 0 ? left : 0)];
			}
		}
	}

	function blur(est, w, h, sigma) {
		if (!est || !(sigma >= 0.3)) return null;
		let data;
		try { data = est.getContext('2d').getImageData(0, 0, w, h).data; } catch (e) { return null; }

		const n = w * h;
		const reqSpace = n * 3;
		
		// Grow scratchpads if needed, adding a 60k margin to avoid reallocation jitter
		if (bufA.length < reqSpace) {
			const newLen = reqSpace + 180000;
			bufA = new Uint32Array(newLen);
			bufB = new Uint32Array(newLen);
		}

		// 1. Extract interleaved RGBA into planar contiguous R, G, B
		for (let i = 0; i < n; i++) {
			const q = i * 4;
			bufA[i] = data[q];
			bufA[i + n] = data[q + 1];
			bufA[i + n * 2] = data[q + 2];
		}

		const r = boxRadius(sigma);

		// 2. Horizontal passes (3 passes, approximating Gaussian)
		pass1D(bufA, bufB, w, h * 3, r);
		pass1D(bufB, bufA, w, h * 3, r);
		pass1D(bufA, bufB, w, h * 3, r);

		// 3. Transpose image to process vertical blur horizontally
		for (let c = 0; c < 3; c++) {
			const offC = c * n;
			for (let y = 0; y < h; y++) {
				let offS = offC + y * w;
				let offD = offC + y;
				for (let x = 0; x < w; x++) {
					bufA[offD] = bufB[offS++];
					offD += h;
				}
			}
		}

		// 4. Vertical passes (now running horizontally in RAM)
		// Note: transposed image has lines of length 'h', and 'w' lines per channel
		pass1D(bufA, bufB, h, w * 3, r);
		pass1D(bufB, bufA, h, w * 3, r);
		pass1D(bufA, bufB, h, w * 3, r);

		// 5. Transpose back and interleave directly into RGBA output
		const out = new Uint8ClampedArray(n * 4);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const outIdx = (y * w + x) * 4;
				const inIdx = x * h + y;
				
				out[outIdx] = bufB[inIdx];
				out[outIdx + 1] = bufB[inIdx + n];
				out[outIdx + 2] = bufB[inIdx + n * 2];
				out[outIdx + 3] = 255;
			}
		}

		const cv = document.createElement('canvas');
		cv.width = w; cv.height = h;
		cv.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
		return cv;
	}

	window.j0.register('ipax-backdrop:blur', { blur, boxRadius });
})();
;

/* --- src/3000-kernel.js --- */
/**
 * ipax-backdrop / 3000-kernel.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL: contract and backend selection.
 *
 * The kernel solves the lightness of every pixel. It never touches the DOM
 * and has two interchangeable backends:
 *   'ipax-backdrop:kernel-cpu'    3100  always available, reference implementation
 *   'ipax-backdrop:kernel-webgl'  3200  GPU, one shared WebGL 1 context
 *
 * CONTRACT (both backends)
 *   render(input) -> {source, stats, tainted}
 *   input = {
 *     est      HTMLCanvasElement  estimated backdrop (w x h), from the resolver
 *     estBlur  HTMLCanvasElement | null   the same estimate blurred (2300). Mixed with `est` by the
 *                                 feather mask before the lightness solve; null = no blur
 *     grid     {V, nx, ny, g}     unknown cells, from the resolver
 *     w, h     working size in px
 *     s        working px per CSS px
 *     W, H     element size in CSS px
 *     params   {ratio, mode, feather, blur}   from the reader. ratio <= 1 (contrast.isBypass) skips the
 *                                 solve and the veil: the output is just the (blurred) estimate
 *     colors   {base:[r,g,b], runs:[{x0,y0,x1,y1,c}]}   from reader-text
 *   }
 *   source   ImageData (CPU) or HTMLCanvasElement (WebGL), w x h. Pixels are
 *            opaque where the backdrop is known and translucent veil where it
 *            is not. NOTE: a WebGL source is only valid until the next render,
 *            so the caller must paint it immediately.
 *   stats    {min, under, nI, nV, inf} measured contrast statistics (CPU only;
 *            null on WebGL, where nothing is read back from the GPU).
 *   tainted  true when the estimate could not be read (cross-origin image);
 *            the whole area then gets the veil.
 *
 * Selection (config.backend): 'auto' tries WebGL and falls back to CPU for
 * good if it is unavailable or throws; 'cpu' never tries WebGL; 'webgl' tries
 * WebGL first but still falls back, because a missing result is worse than a
 * slower one. Every change of backend emits 'ipax-backdrop:backend'.
 *
 * Service 'ipax-backdrop:kernel': render(input), activeBackend()
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	let active = '';

	function announce(backend, reason) {
		if (active === backend) return;
		active = backend;
		window.j0.bus.emit('ipax-backdrop:backend', { backend, reason });
	}

	function render(input) {
		const mode = svc('config').backend;
		if (mode !== 'cpu') {
			const gl = svc('kernel-webgl');
			if (gl && gl.available()) {
				try {
					const r = gl.render(input);
					announce('webgl', 'WebGL available');
					r.backend = 'webgl';
					return r;
				} catch (err) {
					gl.disable(String(err && err.message || err));
				}
			}
			announce('cpu', 'WebGL unavailable: ' + ((gl && gl.reason()) || 'not loaded'));
		} else announce('cpu', 'forced by config.backend');
		const r = svc('kernel-cpu').render(input);
		r.backend = 'cpu';
		return r;
	}

	window.j0.register('ipax-backdrop:kernel', { render, activeBackend: () => active });
})();
;

/* --- src/3100-kernel-cpu.js --- */
/**
 * ipax-backdrop / 3100-kernel-cpu.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL, CPU backend. The reference implementation: the WebGL
 * backend (3200) must produce the same pixels.
 *
 * Per pixel (see 3000-kernel.js for the input/output contract):
 *   1. M      feather mask, 0 at the element edge, 1 `feather` px inside.
 *   2. C      "known" weight: 1 where the backdrop estimate is trustworthy,
 *             falling to 0 inside unknown cells (bilinear over the grid).
 *   3. Image  where C > 0, move the lightness (L of OKLab, a and b fixed) of
 *             the estimated pixel just far enough to reach the contrast:
 *               default      push toward the extreme that contrasts more with
 *                            the text colour (binary search for the first
 *                            crossing, so the change is minimal);
 *               tricontrast  clamp into the luminance band where white AND
 *                            black text both pass.
 *             The result is mixed with the original by M.
 *   4. Veil   where C < 1 a translucent flat colour whose alpha guarantees the
 *             ratio against the WORST possible backdrop (black or white).
 *   Output = known image * C + veil * (1 - C), alpha-weighted.
 *
 * Text runs with another colour (colors.runs) each ask for their own
 * correction; the strongest run weight at a pixel blends the two solutions.
 *
 * Service 'ipax-backdrop:kernel-cpu': available(), render(input)
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	function veilFrac(grid, rx, ry) {
		const V = grid.V, nx = grid.nx, ny = grid.ny, g = grid.g;
		const gv = (i, j) => V[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
		const fx = rx / g - 0.5, fy = ry / g - 0.5, ci = Math.floor(fx), cj = Math.floor(fy), tx = fx - ci, ty = fy - cj;
		return (gv(ci, cj) * (1 - tx) + gv(ci + 1, cj) * tx) * (1 - ty) + (gv(ci, cj + 1) * (1 - tx) + gv(ci + 1, cj + 1) * tx) * ty;
	}

	function render(input) {
		const C = svc('color'), K = svc('contrast');
		const LUT = C.LUT, clamp01 = C.clamp01, smooth = C.smooth, lum = C.luminance, toSrgb = C.toSrgb255, cr = K.ratio;
		const { est, estBlur, grid, w, h, s, W, H, params, colors } = input;

		let pix = null, blurPix = null, tainted = false;
		if (est) { 
			try { 
				pix = est.getContext('2d').getImageData(0, 0, w, h).data; 
				if (estBlur) blurPix = estBlur.getContext('2d').getImageData(0, 0, w, h).data;
			} catch (e) { tainted = true; } 
		}

		const out = new Uint8ClampedArray(w * h * 4);
		const tri = params.mode === 'tricontrast', ratio = params.ratio, rS = K.solveRatio(ratio);
		const fParam = params.feather;
		const f = (typeof fParam === 'object' && fParam !== null)
			? fParam
			: (typeof fParam === 'number' ? { top: fParam, right: fParam, bottom: fParam, left: fParam } : { top: 0, right: 0, bottom: 0, left: 0 });
		const fT = f.top > 0 ? f.top : 0, fR = f.right > 0 ? f.right : 0, fB = f.bottom > 0 ? f.bottom : 0, fL = f.left > 0 ? f.left : 0;
		const hasFeather = fT > 0 || fR > 0 || fB > 0 || fL > 0;

		const runs = colors.runs.slice(0, svc('limits').maxRuns);
		const pcs = [K.prepareColor(colors.base, rS)].concat(runs.map((r) => K.prepareColor(r.c, rS)));
		const band = K.band(ratio), tv = K.bandVeil(band);
		const ok = [0, 0, 0], lin = [0, 0, 0];

		/** Default mode: lightness that reaches rS against text colour `pc`, minimal change. */
		const defL = (L0, A, B, fr, fg, fb, pc) => {
			if (cr(pc.yT, lum(fr, fg, fb)) >= rS) return L0;
			C.oklabToLin(pc.pkL, A, B, lin);
			if (cr(pc.yT, lum(lin[0], lin[1], lin[2])) < rS) return pc.pkL; // unreachable: pin at the extreme
			let lo = L0, hi = pc.pkL;
			for (let n = 0; n < 9; n++) {
				const mid = (lo + hi) / 2;
				C.oklabToLin(mid, A, B, lin);
				if (cr(pc.yT, lum(lin[0], lin[1], lin[2])) >= rS) hi = mid; else lo = mid;
			}
			return hi;
		};

		/** Tricontrast: lightness of the nearest band edge, or L0 if already inside. */
		const triL = (L0, A, B, Y0) => {
			if (Y0 >= band.lo && Y0 <= band.hi) return L0;
			const up = Y0 < band.lo, target = up ? band.lo : band.hi;
			let lo = up ? L0 : 0, hi = up ? 1 : L0;
			for (let n = 0; n < 13; n++) {
				const mid = (lo + hi) / 2;
				C.oklabToLin(mid, A, B, lin);
				if (lum(lin[0], lin[1], lin[2]) < target) lo = mid; else hi = mid;
			}
			return (lo + hi) / 2;
		};

		let minV = Infinity, under = 0, nI = 0, nV = 0;
		for (let y = 0; y < h; y++) {
			const ry = (y + 0.5) / s;
			const mY = hasFeather ? Math.min(
				fT > 0 ? clamp01(ry / fT) : 1,
				fB > 0 ? clamp01((H - ry) / fB) : 1
			) : 1;

			for (let x = 0; x < w; x++) {
				const q = (y * w + x) * 4, rx = (x + 0.5) / s;
				const M = hasFeather ? smooth(Math.min(
					mY,
					fL > 0 ? clamp01(rx / fL) : 1,
					fR > 0 ? clamp01((W - rx) / fR) : 1
				)) : 1;
				const known = pix ? 1 - veilFrac(grid, rx, ry) : 0;

				let wk = 0, kk = -1;
				if (!tri) {
					for (let k = 0; k < runs.length; k++) {
						const r = runs[k];
						const d = Math.hypot(Math.max(r.x0 - rx, 0, rx - r.x1), Math.max(r.y0 - ry, 0, ry - r.y1));
						const wg = smooth(clamp01(1 - d / 6));
						if (wg > wk) { wk = wg; kk = k; }
					}
				}

				let ir = 0, ig = 0, ib = 0;
				if (known > 0) {
					let fr = LUT[pix[q]], fg = LUT[pix[q + 1]], fb = LUT[pix[q + 2]];
					
					if (blurPix) {
						const br = LUT[blurPix[q]], bg = LUT[blurPix[q + 1]], bb = LUT[blurPix[q + 2]];
						fr = fr + M * (br - fr);
						fg = fg + M * (bg - fg);
						fb = fb + M * (bb - fb);
					}
					
					if (K.isBypass(ratio)) {
						ir = toSrgb(fr); ig = toSrgb(fg); ib = toSrgb(fb);
					} else {
						C.linToOklab(fr, fg, fb, ok);
						const L0 = ok[0], A = ok[1], B = ok[2];
						let Lt;
						if (tri) Lt = triL(L0, A, B, lum(fr, fg, fb));
						else {
							Lt = defL(L0, A, B, fr, fg, fb, pcs[0]);
							if (kk >= 0) Lt += wk * (defL(L0, A, B, fr, fg, fb, pcs[kk + 1]) - Lt);
						}
						C.oklabToLin(L0 + M * (Lt - L0), A, B, lin);
						ir = toSrgb(lin[0]); ig = toSrgb(lin[1]); ib = toSrgb(lin[2]);
						if (M >= 0.999 && known >= 0.999) {
							const Y = lum(lin[0], lin[1], lin[2]);
							const v = tri ? Math.min(cr(1, Y), cr(0, Y)) : cr(pcs[wk > 0.5 ? kk + 1 : 0].yT, Y);
							if (v < minV) minV = v;
							if (v < ratio - 1e-6) under++;
							nI++;
						}
					}
				} else if (M >= 0.999) nV++;

				const pv = tri ? tv : pcs[wk > 0.5 ? kk + 1 : 0];
				const wV = (1 - known) * pv.al * M, aO = known + wV;
				if (aO <= 0) continue;
				out[q] = (known * ir + wV * pv.vc) / aO;
				out[q + 1] = (known * ig + wV * pv.vc) / aO;
				out[q + 2] = (known * ib + wV * pv.vc) / aO;
				out[q + 3] = aO * 255;
			}
		}
		const inf = tri ? !band.ok : pcs[0].pkR < ratio;
		return { source: new ImageData(out, w, h), stats: { min: nI ? minV : null, under, nI, nV, inf }, tainted };
	}

	window.j0.register('ipax-backdrop:kernel-cpu', { available: () => true, render });
})();
;

/* --- src/3200-kernel-webgl.js --- */
/**
 * ipax-backdrop / 3200-kernel-webgl.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL, WebGL backend. Same contract as the CPU backend
 * (3000-kernel.js), computed by the fragment shader in 3210.
 *
 * ONE shared WebGL context: browsers cap contexts per page, so every managed
 * element renders in turn into the same hidden canvas, and the caller copies
 * the result into the element's own layer right away.
 *
 * What goes to the GPU: the backdrop estimate (texture), the unknown-cell grid
 * (texture) and a handful of uniforms. Nothing is read back, so there are no
 * contrast statistics on this backend (stats = null).
 *
 * Availability checks (any failure marks the backend unavailable and the
 * dispatcher falls back to the CPU kernel): context creation (software
 * renderers are refused), highp floats in fragment shaders, shader
 * compilation and linking, any GL error after a draw, and context loss.
 * A lost context that is later restored makes the backend available again.
 *
 * Service 'ipax-backdrop:kernel-webgl': available(), render(input),
 *   disable(reason), reason(), reset()
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const UNIFORMS = ['uEst', 'uEstBlur', 'uHasBlur', 'uGrid', 'uSize', 'uDim', 'uScale', 'uFeather', 'uGridInfo', 'uHasEst', 'uTri', 'uRatioS', 'uBand', 'uTriVeil', 'uRunCount', 'uRun', 'uYT', 'uPk', 'uAl', 'uVc'];
	const state = { canvas: null, gl: null, prog: null, loc: null, texEst: null, texGrid: null, texBlur: null, buf: null, aPos: -1, broken: false, why: '' };

	function fail(why) { state.broken = true; state.why = why; state.gl = null; return false; }

	function compile(gl, type, src) {
		const sh = gl.createShader(type);
		gl.shaderSource(sh, src);
		gl.compileShader(sh);
		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
			const log = gl.getShaderInfoLog(sh);
			gl.deleteShader(sh);
			throw new Error('shader compile failed: ' + log);
		}
		return sh;
	}

	function makeTexture(gl) {
		const t = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, t);
		// NPOT-safe settings: clamp, no mipmaps, nearest.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return t;
	}

	function init() {
		if (state.gl) return true;
		if (state.broken) return false;
		try {
			const canvas = document.createElement('canvas');
			canvas.width = 1; canvas.height = 1;
			const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: true });
			if (!gl) return fail('no WebGL context (unsupported or software renderer)');
			const pf = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
			if (!pf || pf.precision < 23) return fail('highp float is not supported in fragment shaders');

			const Sh = svc('webgl-shaders');
			const prog = gl.createProgram();
			gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, Sh.vertex));
			gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, Sh.fragment(svc('limits').maxRuns)));
			gl.linkProgram(prog);
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('program link failed: ' + gl.getProgramInfoLog(prog));

			const loc = {};
			UNIFORMS.forEach((n) => { loc[n] = gl.getUniformLocation(prog, n) || gl.getUniformLocation(prog, n + '[0]'); });
			const buf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

			canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('WebGL context lost'); }, false);
			canvas.addEventListener('webglcontextrestored', () => { state.broken = false; state.why = ''; state.canvas = null; state.gl = null; }, false);

			state.canvas = canvas; state.gl = gl; state.prog = prog; state.loc = loc; state.buf = buf;
			state.aPos = gl.getAttribLocation(prog, 'aPos');
			state.texEst = makeTexture(gl);
			state.texGrid = makeTexture(gl);
			state.texBlur = makeTexture(gl);
			return true;
		} catch (err) {
			return fail(String(err && err.message || err));
		}
	}

	function render(input) {
		if (!init()) throw new Error(state.why || 'WebGL unavailable');
		const K = svc('contrast'), maxRuns = svc('limits').maxRuns, maxC = maxRuns + 1;
		const { est, estBlur, grid, w, h, s, W, H, params, colors } = input;
		const gl = state.gl, L = state.loc;

		if (state.canvas.width !== w || state.canvas.height !== h) { state.canvas.width = w; state.canvas.height = h; }
		gl.viewport(0, 0, w, h);
		gl.useProgram(state.prog);

		// Estimated backdrop -> texture unit 0. A tainted canvas throws SecurityError: veil only.
		let hasEst = 0, tainted = false;
		if (est) {
			try {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, state.texEst);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
				gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, est);
				hasEst = 1;
			} catch (e) { tainted = true; }
		}

		// Blurred estimate -> texture unit 2.
		let hasBlur = 0;
		if (estBlur && !tainted) {
			try {
				gl.activeTexture(gl.TEXTURE2);
				gl.bindTexture(gl.TEXTURE_2D, state.texBlur);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
				gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, estBlur);
				hasBlur = 1;
			} catch (e) { } // silent fail, falls back to sharp
		}

		// Unknown cells -> texture unit 1.
		const bytes = new Uint8Array(grid.nx * grid.ny);
		for (let i = 0; i < bytes.length; i++) bytes[i] = grid.V[i] ? 255 : 0;
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, state.texGrid);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, grid.nx, grid.ny, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);

		// Per-colour parameters come from the shared contrast utilities.
		const rS = K.solveRatio(params.ratio), tri = params.mode === 'tricontrast';
		const runs = colors.runs.slice(0, maxRuns);
		const pcs = [K.prepareColor(colors.base, rS)].concat(runs.map((r) => K.prepareColor(r.c, rS)));
		const yT = new Float32Array(maxC), pk = new Float32Array(maxC), al = new Float32Array(maxC), vc = new Float32Array(maxC);
		pcs.forEach((p, i) => { yT[i] = p.yT; pk[i] = p.pkL; al[i] = p.al; vc[i] = p.vc / 255; });
		const rect = new Float32Array(maxRuns * 4);
		runs.forEach((r, i) => { rect[i * 4] = r.x0; rect[i * 4 + 1] = r.y0; rect[i * 4 + 2] = r.x1; rect[i * 4 + 3] = r.y1; });
		const band = K.band(params.ratio), tv = K.bandVeil(band);

		gl.uniform1i(L.uEst, 0);
		gl.uniform1i(L.uGrid, 1);
		gl.uniform1i(L.uEstBlur, 2);
		gl.uniform1f(L.uHasBlur, hasBlur);
		gl.uniform2f(L.uSize, w, h);
		gl.uniform2f(L.uDim, W, H);
		gl.uniform1f(L.uScale, s);
		const fParam = params.feather;
		const f = (typeof fParam === 'number')
			? { top: fParam, right: fParam, bottom: fParam, left: fParam }
			: (fParam || { top: 0, right: 0, bottom: 0, left: 0 });
		gl.uniform4f(L.uFeather, f.top || 0, f.right || 0, f.bottom || 0, f.left || 0);
		gl.uniform3f(L.uGridInfo, grid.nx, grid.ny, grid.g);
		gl.uniform1f(L.uHasEst, hasEst);
		gl.uniform1f(L.uTri, tri ? 1 : 0);
		gl.uniform1f(L.uRatioS, rS);
		gl.uniform2f(L.uBand, band.lo, band.hi);
		gl.uniform2f(L.uTriVeil, tv.al, tv.vc / 255);
		gl.uniform1i(L.uRunCount, runs.length);
		gl.uniform4fv(L.uRun, rect);
		gl.uniform1fv(L.uYT, yT);
		gl.uniform1fv(L.uPk, pk);
		gl.uniform1fv(L.uAl, al);
		gl.uniform1fv(L.uVc, vc);

		gl.bindBuffer(gl.ARRAY_BUFFER, state.buf);
		gl.enableVertexAttribArray(state.aPos);
		gl.vertexAttribPointer(state.aPos, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		const err = gl.getError();
		if (err !== gl.NO_ERROR) throw new Error('WebGL error 0x' + err.toString(16));
		return { source: state.canvas, stats: null, tainted };
	}

	window.j0.register('ipax-backdrop:kernel-webgl', {
		available: init,
		render,
		disable: fail,
		reason: () => state.why,
		reset: () => { state.broken = false; state.why = ''; state.gl = null; state.canvas = null; }
	});
})();
;

/* --- src/3210-kernel-webgl-shaders.js --- */
/**
 * ipax-backdrop / 3210-kernel-webgl-shaders.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL, WebGL backend: shader sources. No logic, only text.
 *
 * GLSL ES 1.00 (WebGL 1) on purpose: the kernel needs no WebGL 2 feature and
 * WebGL 1 is available everywhere. The fragment shader is a line-by-line port
 * of 3100-kernel-cpu.js; keep both in sync. Loops have constant bounds, and
 * uniform arrays are only indexed by loop counters, as GLSL ES 1.00 requires.
 *
 * Per-colour parameters (luminance, direction, veil alpha and level) are
 * computed on the CPU by 0110-util-contrast.js and passed as uniforms, so the
 * contrast maths has a single source of truth.
 *
 * Service 'ipax-backdrop:webgl-shaders': {vertex, fragment(maxRuns)}
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;








	const vertex = [
		'attribute vec2 aPos;',
		'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }'
	].join('\n');

/* glsl-minifier-start */
const FRAGMENT = `precision highp float;
#define MAXRUNS __MAXRUNS__
#define MAXC __MAXC__
uniform sampler2D uEst; uniform sampler2D uEstBlur; uniform float uHasBlur; uniform sampler2D uGrid; uniform vec2 uSize; uniform vec2 uDim; uniform float uScale; uniform vec4 uFeather; uniform vec3 uGridInfo; uniform float uHasEst; uniform float uTri; uniform float uRatioS; uniform vec2 uBand; uniform vec2 uTriVeil; uniform int uRunCount; uniform vec4 uRun[MAXRUNS]; uniform float uYT[MAXC]; uniform float uPk[MAXC]; uniform float uAl[MAXC]; uniform float uVc[MAXC]; float sm(float m) { return m * m * (3.0 - 2.0 * m); } float toLin(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); } float toSrgb(float l) { l = clamp(l, 0.0, 1.0); return l <= 0.0031308 ? 12.92 * l : 1.055 * pow(l, 1.0 / 2.4) - 0.055; } float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); } float cr(float a, float b) { return (max(a, b) + 0.05) / (min(a, b) + 0.05); } float cbrt(float x) { return x <= 0.0 ? 0.0 : pow(x, 1.0 / 3.0); } vec3 linToOk(vec3 c) { float l = cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b); float m = cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b); float s = cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b); return vec3( 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s); } vec3 okToLin(float L, float a, float b) { float l = L + 0.3963377774 * a + 0.2158037573 * b; l = l * l * l; float m = L - 0.1055613458 * a - 0.0638541728 * b; m = m * m * m; float s = L - 0.0894841775 * a - 1.2914855480 * b; s = s * s * s; return clamp(vec3( 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0.0, 1.0); } void colorOf(int idx, out float yT, out float pk, out float al, out float vc) { yT = uYT[0]; pk = uPk[0]; al = uAl[0]; vc = uVc[0]; for (int k = 1; k < MAXC; k++) { if (k == idx) { yT = uYT[k]; pk = uPk[k]; al = uAl[k]; vc = uVc[k]; } } } float gridAt(float i, float j) { float nx = uGridInfo.x; float ny = uGridInfo.y; float ci = clamp(i, 0.0, nx - 1.0); float cj = clamp(j, 0.0, ny - 1.0); return texture2D(uGrid, vec2((ci + 0.5) / nx, (cj + 0.5) / ny)).r; } float veilFrac(float rx, float ry) { float g = uGridInfo.z; float fx = rx / g - 0.5; float fy = ry / g - 0.5; float ci = floor(fx); float cj = floor(fy); float tx = fx - ci; float ty = fy - cj; return (gridAt(ci, cj) * (1.0 - tx) + gridAt(ci + 1.0, cj) * tx) * (1.0 - ty) + (gridAt(ci, cj + 1.0) * (1.0 - tx) + gridAt(ci + 1.0, cj + 1.0) * tx) * ty; } float defL(float L0, float A, float B, vec3 lin0, float yT, float pk) { if (cr(yT, lum(lin0)) >= uRatioS) return L0; if (cr(yT, lum(okToLin(pk, A, B))) < uRatioS) return pk; float lo = L0; float hi = pk; for (int n = 0; n < 9; n++) { float mid = (lo + hi) * 0.5; if (cr(yT, lum(okToLin(mid, A, B))) >= uRatioS) hi = mid; else lo = mid; } return hi; } float triL(float L0, float A, float B, float Y0) { if (Y0 >= uBand.x && Y0 <= uBand.y) return L0; bool up = Y0 < uBand.x; float target = up ? uBand.x : uBand.y; float lo = up ? L0 : 0.0; float hi = up ? 1.0 : L0; for (int n = 0; n < 13; n++) { float mid = (lo + hi) * 0.5; if (lum(okToLin(mid, A, B)) < target) lo = mid; else hi = mid; } return (lo + hi) * 0.5; } void main() { vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y); float rx = px.x / uScale; float ry = px.y / uScale; float M = 1.0; float mT = uFeather.x > 0.0 ? clamp(ry / uFeather.x, 0.0, 1.0) : 1.0; float mR = uFeather.y > 0.0 ? clamp((uDim.x - rx) / uFeather.y, 0.0, 1.0) : 1.0; float mB = uFeather.z > 0.0 ? clamp((uDim.y - ry) / uFeather.z, 0.0, 1.0) : 1.0; float mL = uFeather.w > 0.0 ? clamp(rx / uFeather.w, 0.0, 1.0) : 1.0; M = sm(min(min(mT, mR), min(mB, mL))); float known = 0.0; if (uHasEst > 0.5) known = 1.0 - veilFrac(rx, ry); float wk = 0.0; int kk = -1; if (uTri < 0.5) { for (int k = 0; k < MAXRUNS; k++) { if (k >= uRunCount) break; vec4 r = uRun[k]; float dx = max(max(r.x - rx, 0.0), rx - r.z); float dy = max(max(r.y - ry, 0.0), ry - r.w); float wg = sm(clamp(1.0 - sqrt(dx * dx + dy * dy) / 6.0, 0.0, 1.0)); if (wg > wk) { wk = wg; kk = k; } } } vec3 img = vec3(0.0); if (known > 0.0) { vec2 uv = vec2(px.x / uSize.x, px.y / uSize.y); vec4 e = texture2D(uEst, uv); vec3 lin0 = vec3(toLin(e.r), toLin(e.g), toLin(e.b)); if (uHasBlur > 0.5) { vec4 eb = texture2D(uEstBlur, uv); vec3 blin = vec3(toLin(eb.r), toLin(eb.g), toLin(eb.b)); lin0 = lin0 + M * (blin - lin0); } if (uRatioS <= 1.05) { img = vec3(toSrgb(lin0.r), toSrgb(lin0.g), toSrgb(lin0.b)); } else { vec3 ok = linToOk(lin0); float Lt; if (uTri > 0.5) Lt = triL(ok.x, ok.y, ok.z, lum(lin0)); else { float yT; float pk; float al; float vc; colorOf(0, yT, pk, al, vc); Lt = defL(ok.x, ok.y, ok.z, lin0, yT, pk); if (kk >= 0) { colorOf(kk + 1, yT, pk, al, vc); Lt = Lt + wk * (defL(ok.x, ok.y, ok.z, lin0, yT, pk) - Lt); } } vec3 o = okToLin(ok.x + M * (Lt - ok.x), ok.y, ok.z); img = vec3(toSrgb(o.r), toSrgb(o.g), toSrgb(o.b)); } } float pAl; float pVc; if (uTri > 0.5) { pAl = uTriVeil.x; pVc = uTriVeil.y; } else { float yT2; float pk2; colorOf(wk > 0.5 ? kk + 1 : 0, yT2, pk2, pAl, pVc); } float wV = (1.0 - known) * pAl * M; float aO = known + wV; if (aO <= 0.0) { gl_FragColor = vec4(0.0); return; } vec3 col = (known * img + wV * vec3(pVc)) / aO; gl_FragColor = vec4(col * aO, aO); }`;
/* glsl-minifier-end */

	function fragment(maxRuns) {
		return FRAGMENT.replace('__MAXRUNS__', String(maxRuns)).replace('__MAXC__', String(maxRuns + 1));
	}

	window.j0.register('ipax-backdrop:webgl-shaders', { vertex, fragment });
})();
;

/* --- src/4000-compositor.js --- */
/**
 * ipax-backdrop / 4000-compositor.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 4 - COMPOSITOR: where the result lives in the page.
 *
 * Every managed element gets ONE sibling layer, inserted immediately BEFORE it:
 *
 *     <ipax-backdrop-layer aria-hidden="true"><canvas></canvas></ipax-backdrop-layer>
 *     <h1 style="...">The managed element</h1>
 *
 * Why a sibling and not a child: the element keeps its own background,
 * gradient, ::before / ::after, text-shadow and, above all, its own
 * `backdrop-filter`, which then blurs OUR layer together with the real
 * backdrop. A child would be painted on top of the element's own background
 * and would not be blurred by its backdrop-filter.
 *
 * Why the element must be positioned: a positioned element is painted above a
 * non-positioned one regardless of DOM order, so a static element's text would
 * end up UNDER our absolute layer. The internal stylesheet below gives managed
 * elements `position: relative` through `:where()` (specificity 0): any
 * `position` the author declares wins.
 *
 * Geometry: the layer copies offsetLeft / offsetTop / offsetWidth / offsetHeight
 * of the element. They share the same containing block because they are
 * siblings. Moving the parent moves both; size changes are watched with a
 * ResizeObserver (which emits 'ipax-backdrop:invalidate').
 *
 * Service 'ipax-backdrop:compositor':
 *   ensureStyle()                 inject the internal stylesheet (idempotent)
 *   attach(el) -> rec             create the layer {el, layer, cv, id, ready}
 *   detachAll()                   remove every layer and observer
 *   recordFor(el) -> rec | undefined
 *   place(rec)                    copy the element geometry to the layer
 *   draw(rec, w, h, result)       paint a kernel result into the layer canvas
 *   clear(rec)                    empty the layer
 *   withHitTesting(rec, fn)       run fn() with the layer reachable by
 *                                 elementsFromPoint (it is pointer-events:none otherwise)
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const records = new Map();
	let nextId = 0, observer = null, styleEl = null;

	/**
	 * INTERNAL STYLESHEET (the only CSS this library injects).
	 *   rule 1  managed elements are positioned (specificity 0, author wins)
	 *   rule 2  the layer is an absolutely positioned, click-through box
	 *   rule 3  its canvas fills it
	 */
	function cssText() {
		const N = svc('names');
		return [
			':where([' + N.managedAttr + ']){position:relative}',
			N.layerTag + '{position:absolute;display:block;pointer-events:none;margin:0;padding:0}',
			N.layerTag + '>canvas{display:block;width:100%;height:100%}'
		].join('\n');
	}

	function ensureStyle() {
		if (styleEl && styleEl.isConnected) return;
		styleEl = document.createElement('style');
		styleEl.setAttribute('data-ipax-backdrop-style', '');
		styleEl.textContent = cssText();
		document.head.appendChild(styleEl);
	}

	function observe(el) {
		if (typeof ResizeObserver === 'undefined') return;
		if (!observer) observer = new ResizeObserver(() => window.j0.bus.emit('ipax-backdrop:invalidate', { reason: 'resize' }));
		observer.observe(el);
		if (el.parentElement) observer.observe(el.parentElement);
	}

	function attach(el) {
		const known = records.get(el);
		if (known) return known;
		const N = svc('names');
		el.setAttribute(N.managedAttr, '');
		const layer = document.createElement(N.layerTag), cv = document.createElement('canvas');
		layer.setAttribute('aria-hidden', 'true');
		layer.appendChild(cv);
		el.parentNode.insertBefore(layer, el);
		const rec = { el, layer, cv, id: ++nextId, ready: false };
		records.set(el, rec);
		observe(el);
		return rec;
	}

	function detachAll() {
		const N = svc('names');
		records.forEach((rec) => { rec.layer.remove(); rec.el.removeAttribute(N.managedAttr); });
		records.clear();
		if (observer) { observer.disconnect(); observer = null; }
	}

	function place(rec) {
		const e = rec.el, s = rec.layer.style;
		s.left = e.offsetLeft + 'px'; s.top = e.offsetTop + 'px';
		s.width = e.offsetWidth + 'px'; s.height = e.offsetHeight + 'px';
	}

	function clear(rec) {
		rec.cv.getContext('2d').clearRect(0, 0, rec.cv.width, rec.cv.height);
		rec.cv.style.backdropFilter = '';
		rec.cv.style.webkitBackdropFilter = '';
		rec.ready = false;
	}

	function draw(rec, w, h, result, blurPx = 0) {
		if (rec.cv.width !== w || rec.cv.height !== h) { rec.cv.width = w; rec.cv.height = h; }
		const ctx = rec.cv.getContext('2d');
		if (result.source instanceof ImageData) ctx.putImageData(result.source, 0, 0);
		else { ctx.clearRect(0, 0, w, h); ctx.drawImage(result.source, 0, 0, w, h); }
		
		// Fallback CSS blur for unknown areas or veil coverage
		if (blurPx > 0) {
			const b = `blur(${blurPx}px)`;
			rec.cv.style.backdropFilter = b;
			rec.cv.style.webkitBackdropFilter = b;
		} else {
			rec.cv.style.backdropFilter = '';
			rec.cv.style.webkitBackdropFilter = '';
		}
		
		rec.ready = true;
	}

	function withHitTesting(rec, fn) {
		const st = rec.layer.style, prev = st.pointerEvents;
		st.pointerEvents = 'auto';
		try { return fn(); } finally { st.pointerEvents = prev; }
	}

	window.j0.register('ipax-backdrop:compositor', { ensureStyle, attach, detachAll, recordFor: (el) => records.get(el), place, draw, clear, withHitTesting });
})();
;

/* --- src/9000-api.js --- */
/**
 * ipax-backdrop / 9000-api.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 9 - PUBLIC API. The only service meant for library users.
 *
 *   const api = window.j0.get('ipax-backdrop');
 *   api.version      '0.1.0'
 *   api.config       live configuration object (backend, cellSize, maxPixels, autoStart)
 *   api.start()      scan the page and start (done automatically unless config.autoStart is false)
 *   api.stop()       remove every layer and stop
 *   api.refresh()    re-scan (new elements or rules) and recompute
 *   api.backend()    'webgl' | 'cpu' | '' (empty until the first render)
 *
 * Listen to events with window.j0.bus.on('ipax-backdrop:updated', fn), etc.
 * (list in 0010-nucleo.js).
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	const api = {
		version: '0.1.0',
		start: () => svc('orchestrator').start(),
		stop: () => svc('orchestrator').stop(),
		refresh: () => svc('orchestrator').refresh(),
		backend: () => svc('kernel').activeBackend()
	};
	Object.defineProperty(api, 'config', { get: () => svc('config'), enumerable: true });

	window.j0.register('ipax-backdrop', api);

	const boot = () => { if (svc('config').autoStart) api.start(); };
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})();
;

