/*! IPAX Backdrop • ipax.bustelo.com.ar • Build: 2026-11-18 */

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
		propPrefix: '--ipax-backdrop-',          // CSS custom properties for container backdrop
		textPrefix: '--ipax-text-',              // CSS custom properties for glyph-contour effect
		boxShorthand: '--ipax-backdrop',         // shorthand property for container
		textShorthand: '--ipax-text',            // shorthand property for glyph contour
		modeProp: '--ipax-mode',                 // shared OKLab solver mode
		layerTag: 'ipax-backdrop-layer',         // element created under every managed element
		managedAttr: 'data-ipax-backdrop-managed', // set by the compositor on managed elements
		markerAttr: 'data-ipax-backdrop',        // optional opt-in marker for container
		textMarkerAttr: 'data-ipax-text'         // optional opt-in marker for glyph contour
	});

	const limits = Object.freeze({
		maxRuns: 7 // differently coloured text runs per element (uniform array size in the shader)
	});

	/** Mutable. Change before start() or at any time; read on every update. */
	const config = {
		backend: 'auto',    // 'auto' | 'webgl' | 'cpu' (CSS: --ipax-backdrop-backend)
		cellSize: 12,       // CSS px; probe grid resolution (CSS: --ipax-backdrop-cellsize)
		performance: 60,    // target FPS; 0 = infinite budget (CSS: --ipax-backdrop-performance)
		minBudget: 65536,   // minimum working pixel budget per element (CSS: --ipax-backdrop-budget-min)
		maxPixelScale: 2,   // Retina/HiDPI pixel scale ceiling (CSS: --ipax-backdrop-maxpixelscale)
		autoStart: true     // start on DOMContentLoaded
	};

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
  *   MAX_WCAG_RATIO                   15. Ceiling corresponding to perceptual black-level saturation (~106 Lc).
 *   ratio(yA, yB)                    WCAG contrast ratio of two relative luminances.
 *   lcToWcagFallback(lc)             Perceptual power-law mapping from |Lc| (0..106) to WCAG ratio (1..15).
 *   parseContrast(raw, defaultRatio) CSS value -> {ok, ratio, system, warning} | {ok:false, reason}
 *   solveRatio(ratio)                ratio the solver aims for (with 8-bit rounding safety margin)
 *   isBypass(ratio)                  true when ratio <= 1
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
	const isBypass = (r) => r <= 1;

	function lcToWcagFallback(lc) {
		const u = Math.min(1, Math.max(0, Math.abs(lc) / 106));
		const yEq = 0.02 + 0.98 * Math.pow(1 - u, 1.5);
		return 1.05 / (yEq + 0.05);
	}

	function parseContrast(raw, defaultRatio = 4.5) {
		const s = (raw || '').trim();
		if (s === '') return { ok: true, ratio: defaultRatio, system: 'wcag', warning: null };

		const mWcag = /^([+-]?(?:\d+\.?\d*|\.\d+)):1$/i.exec(s);
		if (mWcag) {
			const v = parseFloat(mWcag[1]);
			if (!(v >= 1)) return { ok: false, reason: 'WCAG contrast must be >= 1:1 (got "' + s + '").' };
			return {
				ok: true,
				ratio: Math.min(MAX_WCAG_RATIO, v),
				system: 'wcag',
				warning: v > MAX_WCAG_RATIO ? 'WCAG contrast ' + s + ' clamped to ' + MAX_WCAG_RATIO + ':1.' : null
			};
		}

		const mApca = /^([+-]?(?:\d+\.?\d*|\.\d+))lc$/i.exec(s);
		if (mApca) {
			const lc = parseFloat(mApca[1]);
			if (!isFinite(lc)) return { ok: false, reason: 'Invalid APCA Lc contrast value "' + s + '".' };
			const eq = lcToWcagFallback(lc);
			return {
				ok: true,
				ratio: eq,
				system: 'apca',
				warning: 'APCA contrast (' + s + ') is not enabled yet due to licensing; applying WCAG ' + eq.toFixed(2) + ':1 fallback.'
			};
		}

		if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)) {
			const v = parseFloat(s);
			if (!(v >= 1)) return { ok: false, reason: 'Invalid contrast value "' + s + '" (must be >= 1).' };
			if (v > MAX_WCAG_RATIO) {
				const eq = lcToWcagFallback(v);
				return {
					ok: true,
					ratio: eq,
					system: 'apca',
					warning: 'Contrast ' + s + ' (> 15) inferred as APCA Lc; applying WCAG ' + eq.toFixed(2) + ':1 fallback.'
				};
			}
			return { ok: true, ratio: v, system: 'wcag', warning: null };
		}

		return { ok: false, reason: 'Invalid contrast value "' + s + '".' };
	}

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

	window.j0.register('ipax-backdrop:contrast', {
		MAX_WCAG_RATIO, ratio, lcToWcagFallback, parseContrast, solveRatio, isBypass, prepareColor, band, bandVeil
	});
})();
;

/* --- src/0200-orquestador.js --- */
/**
 * ipax-backdrop / 0200-orquestador.js (v0.1.10)
 *
 * CHAPTER 0 - ORCHESTRATOR: schedules and runs the per-frame pipeline.
 *
 * Optional keys in config:
 *   frameBudgetMs       12    time spent per frame before yielding to the browser
 *   partialThrottleMs   80    while scrolling, partially visible boxes are recomputed at most this often
 *   releaseAfterMs      4000  canvas memory of a box is freed after being out of view this long
 *   probeBlock          4     adaptive probing block (see 2000-resolutor.js; 1 = exact)
 *   haloMaxExtend       400   how far (CSS px, per side) --ipax-text may grow the layer beyond the box
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const bus = () => window.j0.bus;
	const emit = (name, payload) => bus().emit('ipax-backdrop:' + name, payload);

	const ZERO_RECT = { left: 0, top: 0 };
	const ZERO_EXT = { l: 0, t: 0, r: 0, b: 0 };

	let running = false, pending = false;
	let records = [], visibleRecords = new Set(), offs = [];
	let epoch = 0, lastScrollAt = 0;
	let imgTimer = null, throttleTimer = null, scrollEndTimer = null, sweepTimer = null;
	const lastMessage = new WeakMap();
	const perfState = new WeakMap();
	let visibilityObserver = null;
	let domObserver = null;

	const clean = (rec) => rec.settled && rec.epoch === epoch;

	const rectsOverlap = (a, b) => !!(
		a && b &&
		a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
		a.left < b.right && a.right > b.left &&
		a.top < b.bottom && a.bottom > b.top
	);

	const copyRect = (r) => ({
		left: r.left,
		top: r.top,
		right: r.right,
		bottom: r.bottom,
		width: r.width,
		height: r.height
	});

	function compareOrder(a, b) {
		if (a.z !== b.z) return a.z - b.z;
		return a.domOrder - b.domOrder;
	}

	function warnOnce(el, message) {
		if (lastMessage.get(el) === message) return;
		lastMessage.set(el, message);
		console.warn('[ipax-backdrop]', message, el);
		emit('warning', { message });
	}

	function schedule() {
		if (!running || pending) return;
		pending = true;
		requestAnimationFrame(() => { pending = false; if (running) runAll(); });
	}

	function unsettleRecord(rec) {
		rec.settled = false;
	}

	function unsettleOverlapping(rect, minZ) {
		let hit = false;
		for (let i = 0; i < records.length; i++) {
			const rec = records[i];
			if (minZ !== undefined && rec.z < minZ) continue;
			if (rectsOverlap(rect, rec.rect) || rectsOverlap(rect, rec.prevRect)) {
				rec.settled = false;
				hit = true;
			}
		}
		return hit;
	}

	function invalidateAll(payload) {
		const compositor = svc('compositor');
		if (payload && payload.target && compositor && compositor.recordsForTarget) {
			const affected = compositor.recordsForTarget(payload.target);
			if (affected.length) {
				for (let i = 0; i < affected.length; i++) affected[i].settled = false;
				schedule();
				return;
			}
		}
		epoch++;
		schedule();
	}

	function onImageLoaded() {
		if (imgTimer) clearTimeout(imgTimer);
		imgTimer = setTimeout(() => {
			imgTimer = null;
			records.forEach((rec) => {
				if (rec.waitImg) {
					rec.settled = false;
					rec.renderedAt = 0;
				}
			});
			schedule();
		}, 50);
	}

	function onScroll() {
		lastScrollAt = performance.now();
		if (!running) return;
		if (scrollEndTimer) clearTimeout(scrollEndTimer);
		scrollEndTimer = setTimeout(() => {
			scrollEndTimer = null;
			if (!running) return;
			for (const rec of visibleRecords) {
				if (!clean(rec)) { schedule(); return; }
			}
		}, 130);
		if (pending) return;
		for (const rec of visibleRecords) {
			if (!clean(rec)) { schedule(); return; }
		}
	}

	function runAll() {
		const compositor = svc('compositor'), cfg = svc('config'), Layers = svc('layers');
		const list = Array.from(visibleRecords);
		if (!list.length) return;

		const geo = list.map((rec) => compositor.measure(rec));
		for (let i = 0; i < list.length; i++) compositor.apply(list[i], geo[i]);

		const vw = window.innerWidth, vh = window.innerHeight;
		const now = performance.now();
		const scrolling = now - lastScrollAt < 120;
		const thr = cfg.partialThrottleMs !== undefined ? cfg.partialThrottleMs : 80;
		const budget = cfg.frameBudgetMs || 12;
		const entries = [];
		const dirtySet = new Set();
		let throttled = false;

		for (let i = 0; i < list.length; i++) {
			const rec = list[i];
			const R = rec.layer.getBoundingClientRect();
			if (R.width < 4 || R.height < 4) continue;
			if (R.bottom <= 0 || R.top >= vh || R.right <= 0 || R.left >= vw) continue;

			const fullyInView = R.top >= 0 && R.bottom <= vh && R.left >= 0 && R.right <= vw;
			const sizeChanged = Math.abs(Math.round(R.width) - Math.round(rec.lastW)) > 1 ||
				Math.abs(Math.round(R.height) - Math.round(rec.lastH)) > 1;
			const posChanged = Math.abs(R.left - rec.lastL) > 0.5 ||
				Math.abs(R.top - rec.lastT) > 0.5;
			const zChanged = geo[i].z !== rec.z;

			rec.z = geo[i].z;
			const item = { r: rec, R, fullyInView, z: rec.z, domOrder: rec.domOrder, zChanged };
			entries.push(item);

			const isDirty = !clean(rec) || sizeChanged || posChanged || zChanged;
			if (!isDirty) {
				rec.rect = copyRect(R);
				continue;
			}

			if (!fullyInView && scrolling && thr > 0 && rec.ready && rec.epoch === epoch && !sizeChanged && !posChanged && !zChanged && now - rec.renderedAt < thr) {
				throttled = true;
				continue;
			}

			rec.settled = false;
			dirtySet.add(rec);
		}

		if (throttled && !throttleTimer) throttleTimer = setTimeout(() => { throttleTimer = null; schedule(); }, thr);
		if (!dirtySet.size) return;

		entries.sort(compareOrder);

		for (let i = 0; i < entries.length; i++) {
			const src = entries[i];
			if (!dirtySet.has(src.r)) continue;
			const rOld = src.r.prevRect || src.r.rect;
			const rNew = src.R;
			for (let j = i + 1; j < entries.length; j++) {
				const upper = entries[j];
				if (dirtySet.has(upper.r)) continue;
				if (rectsOverlap(rOld, upper.R) || rectsOverlap(rNew, upper.R)) {
					upper.r.settled = false;
					dirtySet.add(upper.r);
				}
			}
			if (src.zChanged) {
				for (let j = 0; j < i; j++) {
					const lower = entries[j];
					if (dirtySet.has(lower.r)) continue;
					if (rectsOverlap(rOld, lower.R) || rectsOverlap(rNew, lower.R)) {
						lower.r.settled = false;
						dirtySet.add(lower.r);
					}
				}
			}
		}

		const dirty = entries.filter((item) => dirtySet.has(item.r));
		if (dirty.length > 1) {
			dirty.sort((a, b) => (a.r.renderedAt - b.r.renderedAt) || compareOrder(a, b));
			for (let i = 1; i < dirty.length; i++) {
				const cur = dirty[i];
				let insertAt = i;
				for (let j = 0; j < i; j++) {
					const prev = dirty[j];
					if (compareOrder(cur, prev) < 0 && rectsOverlap(cur.R, prev.R)) {
						insertAt = j;
						break;
					}
				}
				if (insertAt < i) {
					dirty.splice(i, 1);
					dirty.splice(insertAt, 0, cur);
				}
			}
		}
		const activeCount = dirty.length;

		const t0 = performance.now();
		let processed = 0;
		Layers.beginFrame();
		try {
			for (let i = 0; i < dirty.length; i++) {
				const k = dirty[i];
				try { update(k.r, k.R, k.fullyInView, activeCount); }
				catch (err) {
					console.error('[ipax-backdrop] update error:', err);
					emit('error', { message: String(err && err.message || err) });
				}
				processed++;
				if (performance.now() - t0 > budget) break;
			}
		} finally { Layers.endFrame(); }

		if (processed < dirty.length) schedule();
	}

	function settle(rec, R, fullyInView, ep) {
		rec.lastL = R.left;
		rec.lastT = R.top;
		rec.lastW = R.width;
		rec.lastH = R.height;
		const snap = copyRect(R);
		rec.rect = snap;
		rec.prevRect = snap;
		rec.settled = fullyInView;
		rec.epoch = ep;
		rec.renderedAt = performance.now();
	}

	function update(rec, R, fullyInView, activeCount) {
		const t0 = performance.now(), el = rec.el, cfg = svc('config'), ep = epoch;
		const compositor = svc('compositor'), Halo = svc('halo');

		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const viewportArea = vw * vh;

		if (R.width * R.height > viewportArea) {
			compositor.clear(rec);
			warnOnce(el, 'Element area exceeds viewport area. Bypassing to protect performance.');
			settle(rec, R, true, ep);
			return;
		}

		if (el.querySelector('[' + svc('names').managedAttr + ']')) {
			compositor.clear(rec);
			warnOnce(el, 'Element contains other managed backdrop elements. Bypassing container to prevent recursive/massive evaluation.');
			settle(rec, R, true, ep);
			return;
		}

		const params = svc('reader').readParams(el);
		if (!params.ok) { compositor.clear(rec); warnOnce(el, params.reason); settle(rec, R, true, ep); return; }
		if (params.warnings && params.warnings.length) warnOnce(el, params.warnings.join(' '));
		else lastMessage.delete(el);

		const reExt = (ext) => { if (compositor.setExt(rec, ext)) R = rec.layer.getBoundingClientRect(); };

		const tp = params.text;
		const textOn = tp && tp.on && (tp.ratio > 1 || tp.blur > 0);
		const boxCover = params.ratio > 1 || params.blur > 0;

		if (!textOn && params.ratio <= 1.05 && params.blur === 0) {
			reExt(ZERO_EXT);
			compositor.clear(rec);
			settle(rec, R, fullyInView, ep);
			emit('updated', { element: el, ms: performance.now() - t0, backend: 'bypass', stats: null, resolver: null, tainted: false, params, budget: null });
			return;
		}

		const tH0 = performance.now();
		const colors = svc('reader-text').readColors(el, ZERO_RECT, params.color, textOn);
		if (colors.truncated) warnOnce(el, 'More than ' + svc('limits').maxRuns + ' differently coloured text runs: the extra ones use the base colour.');

		let reach = 0;
		if (textOn) {
			const x = rec.ext;
			const E = { left: R.left + x.l, top: R.top + x.t, right: R.right - x.r, bottom: R.bottom - x.b };
			const ext = Halo.extent(colors.texts, tp, E, cfg.haloMaxExtend || 400, x);
			reach = ext.reach;
			reExt(ext);
			if (R.width * R.height > viewportArea) {
				compositor.clear(rec);
				warnOnce(el, 'Element area plus its --ipax-text reach exceeds viewport area. Bypassing to protect performance.');
				settle(rec, R, true, ep);
				return;
			}
			if (tp.mode === 'tricontrast' && tp.ratio > 1 && !svc('contrast').band(tp.ratio).ok) {
				if (!rec.bandWarned) { rec.bandWarned = true; warnOnce(el, '--ipax-text contrast ' + tp.ratio.toFixed(1) + ' is above the tricontrast limit (about 4.5): the text contour cannot reach it in this mode.'); }
			} else rec.bandWarned = false;
		} else reExt(ZERO_EXT);

		const dx = -R.left, dy = -R.top;
		for (const r of colors.runs) { r.x0 += dx; r.x1 += dx; r.y0 += dy; r.y1 += dy; }
		if (colors.texts) for (const t of colors.texts) { t.x0 += dx; t.x1 += dx; t.y0 += dy; t.y1 += dy; }
		const ox = rec.ext.l, oy = rec.ext.t, bw = R.width - rec.ext.l - rec.ext.r, bh = R.height - rec.ext.t - rec.ext.b;

		const area = R.width * R.height;
		const maxScale = Math.min(params.maxPixelScale, window.devicePixelRatio || 1);
		let s = maxScale;

		if (params.performance > 0) {
			let st = perfState.get(el);
			if (!st) { st = { fixedMs: 5.0, pxPerMs: 10000, warmedUp: false }; perfState.set(el, st); }

			let maxP = params.minBudget;
			if (st.warmedUp) {
				const frameBudgetMs = (1000 / params.performance) / (activeCount || 1);
				const availMs = Math.max(0, frameBudgetMs - st.fixedMs);
				const viewportPixels = viewportArea * maxScale * maxScale;
				maxP = Math.max(params.minBudget, Math.min(st.pxPerMs * availMs, viewportPixels));
			}
			s = Math.min(maxScale, Math.sqrt(maxP / area));
		}

		const w = Math.max(1, Math.ceil(R.width * s)), h = Math.max(1, Math.ceil(R.height * s));

		const baseStep = Math.max(4, params.cellSize || cfg.cellSize);
		const viewportCells = Math.ceil(vw / baseStep) * Math.ceil(vh / baseStep);
		const areaStep = Math.min(baseStep * 2, Math.round(Math.sqrt(area) / 22));
		const localStep = Math.max(baseStep, areaStep, Math.ceil(Math.sqrt(area / viewportCells)));

		let haloIn = null, active;
		if (textOn) {
			const mask = Halo.mask(rec, colors.texts, tp, R.width, R.height, s);
			haloIn = {
				ratio: tp.ratio,
				mode: tp.mode,
				blur: tp.blur,
				shared: tp.ratio === params.ratio && tp.mode === params.mode,
				mask
			};
			const nx = Math.ceil(R.width / localStep), ny = Math.ceil(R.height / localStep);
			active = Halo.activeCells(colors.texts, tp, ox, oy, bw, bh, nx, ny, localStep, boxCover);
		}

		const tA = performance.now();
		const res = svc('resolver').resolve(rec, R, s, w, h, localStep, active);
		const tB = performance.now();

		const boxBlur = boxCover ? params.blur : 0;
		const textBlur = textOn ? tp.blur : 0;
		const maxBlur = Math.max(boxBlur, textBlur);
		const estBlur = maxBlur > 0 ? svc('blur').blur(res.est, w, h, maxBlur * s, rec) : null;
		const tC = performance.now();

		const out = svc('kernel').render({
			est: res.est, estBlur, grid: res.grid, w, h, s, W: bw, H: bh, ox, oy, params, colors,
			halo: haloIn, boxCover, boxBlur, textBlur, maxBlur, infl: Math.max(6, reach)
		});
		const tD = performance.now();
		compositor.draw(rec, w, h, out, boxBlur);
		const tE = performance.now();

		rec.waitImg = !!(res.why && res.why.has('image not loaded'));
		settle(rec, R, fullyInView, ep);

		const ms = tE - t0;
		if (params.performance > 0) {
			let st = perfState.get(el);
			const probeMs = (res.stats && res.stats.probeMs) ? res.stats.probeMs : 0;
			const fixedPart = probeMs > 0 ? probeMs : 5.0;

			if (!st.warmedUp) {
				st.fixedMs = fixedPart;
				st.warmedUp = true;
			} else {
				st.fixedMs = st.fixedMs * 0.8 + fixedPart * 0.2;
				const varMs = ms - fixedPart;
				if (varMs > 0.2) {
					const inst = (w * h) / varMs;
					st.pxPerMs = st.pxPerMs * 0.8 + inst * 0.2;
				}
			}
		}

		emit('updated', {
			element: el, ms, backend: out.backend, stats: out.stats, resolver: res.stats, tainted: !!out.tainted, params, budget: { s, w, h },
			halo: textOn ? { ext: { l: rec.ext.l, t: rec.ext.t, r: rec.ext.r, b: rec.ext.b }, reach } : null,
			stages: { read: tA - tH0, resolve: tB - tA, blur: tC - tB, kernel: tD - tC, draw: tE - tD }
		});
	}

	function handleIntersection(entries) {
		let changed = false;
		entries.forEach((entry) => {
			const rec = svc('compositor').recordFor(entry.target);
			if (!rec) return;
			if (entry.isIntersecting) {
				if (!visibleRecords.has(rec)) {
					visibleRecords.add(rec);
					if (!clean(rec)) changed = true;
				}
			} else if (visibleRecords.has(rec)) {
				visibleRecords.delete(rec);
			}
		});
		if (changed && running) schedule();
	}

	function attachAll() {
		const compositor = svc('compositor');
		const removed = compositor.pruneDisconnected ? compositor.pruneDisconnected() : [];
		if (removed.length) {
			records = records.filter((r) => removed.indexOf(r) < 0);
			for (let i = 0; i < removed.length; i++) {
				visibleRecords.delete(removed[i]);
				if (removed[i].prevRect) unsettleOverlapping(removed[i].prevRect, removed[i].z);
			}
		}
		if (!visibilityObserver && typeof IntersectionObserver !== 'undefined') {
			visibilityObserver = new IntersectionObserver(handleIntersection, { rootMargin: '50px 0px' });
		}
		svc('reader').scan().forEach((el) => {
			const rec = compositor.attach(el);
			if (records.indexOf(rec) < 0) {
				rec.settled = false;
				rec.epoch = -1;
				rec.lastL = 0;
				rec.lastT = 0;
				rec.lastW = 0;
				rec.lastH = 0;
				rec.rect = null;
				rec.prevRect = null;
				rec.z = 0;
				rec.domOrder = 0;
				rec.renderedAt = 0;
				rec.waitImg = false;
				records.push(rec);
				if (visibilityObserver) visibilityObserver.observe(el);
				else visibleRecords.add(rec);
			}
		});
		if (compositor.refreshOrder) compositor.refreshOrder();
	}

	function handleMutations(mutations) {
		if (!running) return;
		const N = svc('names'), comp = svc('compositor');
		const layerTag = N.layerTag.toUpperCase(), planeTag = (N.planeTag || 'ipax-backdrop-plane').toUpperCase();
		const hostSel = '[' + N.managedAttr + ']';
		let dirtyGlobal = false, dirtyTree = false, local = false;

		for (let i = 0; i < mutations.length; i++) {
			const m = mutations[i], t = m.target;
			if (!t) continue;

			if (m.type === 'characterData') {
				const pe = t.parentElement;
				if (!pe || pe.closest(N.layerTag) || pe.closest(planeTag)) continue;
				const host = pe.closest(hostSel), rec = host && comp.recordFor(host);
				if (rec) { unsettleRecord(rec); local = true; }
				continue;
			}

			if (t.nodeType !== 1) continue;
			if (t.tagName === layerTag || t.tagName === planeTag || (t.closest && (t.closest(N.layerTag) || t.closest(planeTag)))) continue;

			if (m.type === 'attributes') {
				if (m.attributeName === N.managedAttr) continue;
				const affected = comp.recordsForTarget ? comp.recordsForTarget(t) : [];
				if (affected.length) {
					for (let j = 0; j < affected.length; j++) unsettleRecord(affected[j]);
					local = true;
					continue;
				}
				if (t === document.documentElement || t === document.body) {
					dirtyGlobal = true;
					continue;
				}
				const tr = t.getBoundingClientRect();
				if (tr.width > 0 && tr.height > 0 && unsettleOverlapping(tr)) local = true;
			} else if (m.type === 'childList') {
				const host = t.closest(hostSel), rec = host && comp.recordFor(host);
				if (rec) { unsettleRecord(rec); local = true; continue; }
				for (let j = 0; j < m.addedNodes.length; j++) {
					const n = m.addedNodes[j];
					if (n.nodeType === 1 && n.tagName !== layerTag && n.tagName !== planeTag && !n.hasAttribute('data-ipax-backdrop-style')) {
						dirtyTree = true;
						break;
					}
				}
				for (let j = 0; j < m.removedNodes.length; j++) {
					const n = m.removedNodes[j];
					if (n.nodeType === 1 && n.tagName !== layerTag && n.tagName !== planeTag) {
						dirtyTree = true;
						break;
					}
				}
				if (!dirtyTree && t !== document.documentElement && t !== document.body) {
					const tr = t.getBoundingClientRect();
					if (tr.width > 0 && tr.height > 0 && unsettleOverlapping(tr)) local = true;
				}
			}
		}
		if (dirtyTree) { attachAll(); local = true; }
		if (dirtyGlobal) invalidateAll();
		else if (local) schedule();
	}

	function start() {
		if (running) return;
		running = true;
		const cfg = svc('config');
		svc('compositor').ensureStyle();
		attachAll();
		offs = [bus().on('ipax-backdrop:invalidate', invalidateAll), bus().on('ipax-backdrop:image-loaded', onImageLoaded)];
		window.addEventListener('resize', invalidateAll);
		window.addEventListener('scroll', onScroll, { passive: true });
		if (!domObserver && typeof MutationObserver !== 'undefined' && document.body) {
			domObserver = new MutationObserver(handleMutations);
			domObserver.observe(document.body, {
				subtree: true,
				childList: true,
				characterData: true,
				attributes: true,
				attributeFilter: ['style', 'class', svc('names').markerAttr, svc('names').textMarkerAttr]
			});
		}
		if (document.fonts && document.fonts.ready && document.fonts.status !== 'loaded') document.fonts.ready.then(invalidateAll);
		sweepTimer = setInterval(() => { svc('compositor').sweep(visibleRecords, cfg.releaseAfterMs || 4000); }, 2000);
		emit('ready', {});
		schedule();
	}

	function stop() {
		if (!running) return;
		running = false;
		offs.forEach((off) => off());
		offs = [];
		window.removeEventListener('resize', invalidateAll);
		window.removeEventListener('scroll', onScroll);
		if (domObserver) { domObserver.disconnect(); domObserver = null; }
		if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
		if (imgTimer) { clearTimeout(imgTimer); imgTimer = null; }
		if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
		if (scrollEndTimer) { clearTimeout(scrollEndTimer); scrollEndTimer = null; }
		svc('compositor').detachAll();
		records = [];
		visibleRecords.clear();
		if (visibilityObserver) { visibilityObserver.disconnect(); visibilityObserver = null; }
	}

	function refresh() {
		if (!running) { start(); return; }
		attachAll();
		invalidateAll();
	}

	window.j0.register('ipax-backdrop:orchestrator', { start, stop, refresh, schedule });
})();
;

/* --- src/1000-lector.js --- */
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
;

/* --- src/1100-lector-texto.js --- */
// PATH: src/1100-lector-texto.js
/**
 * ipax-backdrop / 1100-lector-texto.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 1 - READER (text): text colour runs and calibrated per-word glyph boxes.
 *
 * Service 'ipax-backdrop:reader-text':
 *   readColors(el, rect, baseColorStr, wantTexts)
 *     -> {base:[r,g,b], runs:[{x0,y0,x1,y1,c}], truncated, texts}
 *
 * When `wantTexts` is true (--ipax-text active), `texts` records per-word line rects
 * along with the computed font stack, letter-spacing and text-transform so the glyph
 * mask rasterizer (2400-resolutor-halo.js) aligns 1:1 with browser glyph rendering.
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	function readColors(el, rect, baseStr, wantTexts) {
		const C = svc('color'), max = svc('limits').maxRuns;
		const toRgb = (str) => { const c = C.parseCssColor(str); return c ? [c[0], c[1], c[2]] : [255, 255, 255]; };
		const base = toRgb(baseStr), runs = [], texts = wantTexts ? [] : null;
		let truncated = false;
		const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
		let node;

		while ((node = tw.nextNode())) {
			const raw = node.nodeValue;
			if (!raw || !raw.trim()) continue;
			const cs = getComputedStyle(node.parentElement);
			const c = toRgb(cs.color);
			const differs = Math.abs(c[0] - base[0]) + Math.abs(c[1] - base[1]) + Math.abs(c[2] - base[2]) >= 24;
			if (!differs && !wantTexts) continue;

			if (differs) {
				range.selectNodeContents(node);
				for (const r of range.getClientRects()) {
					if (r.width <= 0 || r.height <= 0) continue;
					if (runs.length >= max) { truncated = true; break; }
					runs.push({
						x0: r.left - rect.left,
						y0: r.top - rect.top,
						x1: r.right - rect.left,
						y1: r.bottom - rect.top,
						c
					});
				}
			}

			if (wantTexts) {
				const fs = parseFloat(cs.fontSize) || 16;
				const fontStyle = cs.fontStyle || 'normal';
				const fontWeight = cs.fontWeight || '400';
				const fontFamily = cs.fontFamily || 'sans-serif';
				const ls = parseFloat(cs.letterSpacing);
				const letterSpacing = isNaN(ls) ? 0 : ls;
				const textTransform = cs.textTransform || 'none';

				const re = /\S+/g;
				let m;
				while ((m = re.exec(raw))) {
					range.setStart(node, m.index);
					range.setEnd(node, m.index + m[0].length);
					const rects = range.getClientRects();
					for (let i = 0; i < rects.length; i++) {
						const r = rects[i];
						if (r.width <= 0 || r.height <= 0) continue;
						texts.push({
							x0: r.left - rect.left,
							y0: r.top - rect.top,
							x1: r.right - rect.left,
							y1: r.bottom - rect.top,
							word: m[0],
							fs,
							fontStyle,
							fontWeight,
							fontFamily,
							letterSpacing,
							textTransform
						});
					}
				}
			}
		}
		return { base, runs, truncated, texts };
	}

	window.j0.register('ipax-backdrop:reader-text', { readColors });
})();
;

/* --- src/2000-resolutor.js --- */
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
			if (hostParent && e !== hostParent && hostParent.contains(e)) {
				let cur = e;
				while (cur && cur.parentElement !== hostParent) cur = cur.parentElement;
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
					if (minZ !== null && BL.z <= minZ) break;
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
						// Child content inside a lower managed element is skipped; its own background and corrected canvas still compose.
						if (owner.el.contains(e) && e !== owner.el) continue;
					}

					const ez = elemZ(e);
					if (isFixed(e) && ez > rec.z) continue;
					if (hostParent && hostParent.contains(e) && e !== hostParent) {
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
;

/* --- src/2100-resolutor-capas.js --- */
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
 * color, object-fit, video, animated image (.gif by extension).
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

	/** Image format from a URL: the subtype of a data: URL, else the file extension (lowercase, '' if none). */
	const imgKind = (u) => {
		const s = String(u || '');
		if (/^data:/i.test(s)) { const m = /^data:image\/([a-z0-9.+-]+)/i.exec(s.slice(0, 40)); return m ? m[1].toLowerCase() : ''; }
		const m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(s);
		return m ? m[1].toLowerCase() : '';
	};
	/** Only JPEG is known to be opaque. Any other format may carry alpha, so its layer must not cut the stack below it. */
	const isOpaqueKind = (k) => k === 'jpg' || k === 'jpeg';

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
			const kind = imgKind(e.currentSrc || e.src);
			if (kind === 'gif') out.push(mk({ k: 'unk', why: 'animated image' }));
			else if (!(e.complete && e.naturalWidth)) out.push(mk({ k: 'unk', why: 'image not loaded' }));
			else {
				const g = G.objectFitGeometry(e.naturalWidth, e.naturalHeight, pa, cs.objectFit, cs.objectPosition);
				out.push(g ? mk({ k: 'img', img: e, g, a: risk.op, nocut: !isOpaqueKind(kind), tainted: isTainted(e.currentSrc), r }) : mk({ k: 'unk', why: 'object-fit' }));
			}
		}

		if (e.tagName === 'VIDEO') out.push(mk({ k: 'unk', why: 'video' }));

		const list = cs.backgroundImage === 'none' ? [] : G.splitTop(cs.backgroundImage);
		const sizes = G.splitTop(cs.backgroundSize), poss = G.splitTop(cs.backgroundPosition), reps = G.splitTop(cs.backgroundRepeat);
		const orgs = G.splitTop(cs.backgroundOrigin), atts = G.splitTop(cs.backgroundAttachment);
		list.forEach((s, i) => {
			const at = (a) => a[i % a.length]; // CSS repeats shorter lists to match the image count
			const m = /^url\(["']?(.*?)["']?\)$/.exec(s);
			if (!m) { out.push(mk({ k: 'unk', why: /gradient/.test(s) ? 'gradient' : 'unsupported background' })); return; }
			const kind = imgKind(m[1]);
			if (kind === 'gif') { out.push(mk({ k: 'unk', why: 'animated image' })); return; }
			if (at(atts) === 'fixed' || at(orgs) !== 'padding-box') { out.push(mk({ k: 'unk', why: 'attachment/origin' })); return; }
			const img = imageFor(m[1]);
			if (!img) { out.push(mk({ k: 'unk', why: 'image not loaded' })); return; }
			const rp = G.parseRepeat(at(reps)), g = rp && G.backgroundGeometry(img.naturalWidth, img.naturalHeight, pa, at(sizes), at(poss), rp);
			if (!g) { out.push(mk({ k: 'unk', why: 'geometry' })); return; }
			out.push(mk({ k: 'img', img, g, a: risk.op, nocut: !isOpaqueKind(kind), tainted: isTainted(m[1]), r }));
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
				if (selfRec && (d === selfRec.el || d === selfRec.wrapper)) continue;
				const dRec = Comp.recordFor(d) || (Comp.isWrapper && Comp.isWrapper(d) ? Comp.ownerRecord(d) : null);
				if (dRec && selfRec && Comp.isAbove && Comp.isAbove(dRec, selfRec)) continue;
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
 * 1. Persistent scratchpads (bufA, bufB, outBuf) to eliminate frame-drop allocations.
 *    The planes are Uint8Array (values are 0..255): 4x less memory traffic than Uint32.
 * 2. Planar RGB extraction to process channels continuously.
 * 3. 1D Box Blur commutative transposing: H, H, H -> Transpose -> H, H, H.
 *    Vertical passes are done horizontally in memory to maximize CPU L1/L2 cache hits.
 * 4. Pure integer arithmetic: the per-pixel division is a multiply and a shift
 *    (16-bit fixed point, rounded up so a flat 255 field stays 255).
 * 5. ADAPTIVE DOWNSAMPLING. A Gaussian-like blur is low frequency, so for a large
 *    sigma the work is done on a reduced image (factor k = 1, 2, 4 or 8, chosen so
 *    the reduced sigma stays >= 2 px) and scaled back up with bilinear filtering.
 *    Cost drops by k^2 (k = 4 -> 16x). Small sigmas (< 4 px) run at full size, as before.
 * 6. The output canvas is reused: pass the compositor record as `store` and the
 *    canvas lives in store.blurCv. The result is consumed synchronously by the
 *    kernel, so a single canvas per record is enough.
 *
 * Service 'ipax-backdrop:blur':
 *   blur(est, w, h, sigma, store?) -> HTMLCanvasElement | null
 *   boxRadius(sigma)
 *   factor(sigma)                  downsampling factor that blur() would pick
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	let bufA = new Uint8Array(0);
	let bufB = new Uint8Array(0);
	let outBuf = new Uint8ClampedArray(0);
	let smallCv = null;       // shared scratch canvas for the reduced image (always used synchronously)
	let sharedOut = null;     // output canvas when the caller passes no store

	const boxRadius = (sigma) => Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));

	/** Largest k in {1,2,4,8} that keeps the reduced sigma >= 2 px. */
	function factor(sigma) {
		let k = 1;
		while (k < 8 && sigma / (k * 2) >= 2) k *= 2;
		return k;
	}

	/** Optimized 1D Box Blur with edge clamping and a fixed-point multiplier instead of a division. */
	function pass1D(s, d, len, count, r) {
		const diam = 2 * r + 1;
		const inv = Math.ceil(65536 / diam); // acc <= 255 * diam, so acc * inv stays below 2^31 for diam < 257
		const last = len - 1;
		for (let j = 0; j < count; j++) {
			const base = j * len;
			let acc = s[base] * (r + 1);
			for (let i = 1; i <= r; i++) {
				acc += s[base + (i < len ? i : last)];
			}
			for (let i = 0; i < len; i++) {
				d[base + i] = (acc * inv) >>> 16;
				const right = i + r + 1;
				const left = i - r;
				acc += s[base + (right < len ? right : last)] - s[base + (left >= 0 ? left : 0)];
			}
		}
	}

	/** Blur an RGBA buffer (w x h) with 3 box passes per axis. Result goes to outBuf as opaque RGBA. */
	function boxBlurRGBA(data, w, h, r) {
		const n = w * h;
		const reqSpace = n * 3;

		// Grow scratchpads if needed, adding a margin to avoid reallocation jitter
		if (bufA.length < reqSpace) {
			const newLen = reqSpace + 180000;
			bufA = new Uint8Array(newLen);
			bufB = new Uint8Array(newLen);
		}
		if (outBuf.length < n * 4) outBuf = new Uint8ClampedArray(n * 4 + 240000);

		// 1. Extract interleaved RGBA into planar contiguous R, G, B
		for (let i = 0; i < n; i++) {
			const q = i * 4;
			bufA[i] = data[q];
			bufA[i + n] = data[q + 1];
			bufA[i + n * 2] = data[q + 2];
		}

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
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const outIdx = (y * w + x) * 4;
				const inIdx = x * h + y;
				outBuf[outIdx] = bufB[inIdx];
				outBuf[outIdx + 1] = bufB[inIdx + n];
				outBuf[outIdx + 2] = bufB[inIdx + n * 2];
				outBuf[outIdx + 3] = 255;
			}
		}
	}

	function blur(est, w, h, sigma, store) {
		if (!est || !(sigma >= 0.3)) return null;

		const k = factor(sigma);
		const sw = k > 1 ? Math.max(1, Math.ceil(w / k)) : w;
		const sh = k > 1 ? Math.max(1, Math.ceil(h / k)) : h;
		const sg = sigma / k;

		// Source of the pixels to blur: the estimate itself, or a reduced copy of it.
		let srcCtx, smallCtx = null;
		if (k > 1) {
			if (!smallCv) smallCv = document.createElement('canvas');
			if (smallCv.width !== sw || smallCv.height !== sh) { smallCv.width = sw; smallCv.height = sh; }
			smallCtx = smallCv.getContext('2d', { willReadFrequently: true });
			smallCtx.imageSmoothingEnabled = true;
			smallCtx.imageSmoothingQuality = 'high';
			smallCtx.drawImage(est, 0, 0, w, h, 0, 0, sw, sh);
			srcCtx = smallCtx;
		} else {
			srcCtx = est.getContext('2d', { willReadFrequently: true });
		}

		let data;
		try { data = srcCtx.getImageData(0, 0, sw, sh).data; } catch (e) { return null; } // tainted canvas

		boxBlurRGBA(data, sw, sh, boxRadius(sg));

		// Output canvas: reused per record when a store is given.
		let cv = store ? store.blurCv : sharedOut;
		if (!cv) { cv = document.createElement('canvas'); if (store) store.blurCv = cv; else sharedOut = cv; }
		if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
		const octx = cv.getContext('2d', { willReadFrequently: true });

		const img = new ImageData(outBuf.subarray(0, sw * sh * 4), sw, sh);
		if (k === 1) {
			octx.putImageData(img, 0, 0);
		} else {
			smallCtx.putImageData(img, 0, 0);
			octx.imageSmoothingEnabled = true;
			octx.imageSmoothingQuality = 'low'; // plain bilinear is enough for a smooth image
			octx.drawImage(smallCv, 0, 0, sw, sh, 0, 0, w, h);
		}
		return cv;
	}

	window.j0.register('ipax-backdrop:blur', { blur, boxRadius, factor });
})();
;

/* --- src/2400-resolutor-halo.js --- */
/**
 * ipax-backdrop / 2400-resolutor-halo.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER (glyph contour mask): calibrated mask for --ipax-text.
 *
 * Builds a low-resolution single-channel mask Mg(x, y) in [0..255] fitted to the
 * actual rendered glyphs (calibrated per word via Range.getClientRects + TextMetrics),
 * dilated by `spread` (px additive or % internal) and diffused by `halo` (Gaussian/smoothstep).
 *
 * Service 'ipax-backdrop:halo':
 *   reachOf(tp)                                -> {s, f, reach} in CSS px
 *   extent(texts, tp, E, cap, cur)             -> {l, t, r, b, reach}
 *   mask(rec, texts, tp, W, H, scale?)         -> {sig, data:Uint8Array, mw, mh, cs}
 *   activeCells(texts, tp, ox, oy, bw, bh, nx, ny, g, includeBox) -> Uint8Array(nx*ny)
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const MAX_CELLS = 262144; // up to 512 x 512 mask texels

	function applyTransform(word, tf) {
		if (tf === 'uppercase') return word.toUpperCase();
		if (tf === 'lowercase') return word.toLowerCase();
		if (tf === 'capitalize') return word.replace(/\b\w/g, (ch) => ch.toUpperCase());
		return word;
	}

	function reachOf(tp) {
		const haloPx = Math.max(0, tp.halo || 0);
		const isPct = tp.spread && tp.spread.unit === '%';
		const rawSpread = tp.spread ? Math.max(0, tp.spread.v || 0) : 0;
		const s = isPct ? haloPx * (rawSpread / 100) : rawSpread;
		const f = isPct ? Math.max(0, haloPx - s) : haloPx;
		return { s, f, reach: s + f };
	}

	function extent(texts, tp, E, cap, cur) {
		const q = reachOf(tp), d = q.reach;
		const ox = tp.x || 0, oy = tp.y || 0;
		let l = 0, t = 0, r = 0, b = 0;
		for (let i = 0; i < texts.length; i++) {
			const T = texts[i];
			const a = E.left - (T.x0 + ox - d); if (a > l) l = a;
			const c = (T.x1 + ox + d) - E.right; if (c > r) r = c;
			const e = E.top - (T.y0 + oy - d); if (e > t) t = e;
			const f = (T.y1 + oy + d) - E.bottom; if (f > b) b = f;
		}
		const fit = (v, old) => {
			const n = Math.min(cap, Math.max(0, Math.ceil(v - 0.05)));
			return (old >= n && old - n <= 1) ? old : n;
		};
		return { l: fit(l, cur.l), t: fit(t, cur.t), r: fit(r, cur.r), b: fit(b, cur.b), reach: d };
	}

	function signature(texts, tp, W, H, effScale) {
		const q = reachOf(tp);
		let s = Math.round(W) + 'x' + Math.round(H) + '@' + effScale.toFixed(3) +
			'|' + (tp.x || 0) + ',' + (tp.y || 0) + ',' + q.s.toFixed(2) + ',' + q.f.toFixed(2);
		for (let i = 0; i < texts.length; i++) {
			const t = texts[i];
			s += '|' + Math.round(t.x0) + ',' + Math.round(t.y0) + ',' + Math.round(t.x1) + ',' + Math.round(t.y1) + ':' + (t.word || '');
		}
		return s;
	}

	function buildEuclideanFallback(texts, tp, mw, mh, cs) {
		const smooth = svc('color').smooth;
		const q = reachOf(tp), s = q.s, f = q.f, r = q.reach;
		const ox = tp.x || 0, oy = tp.y || 0;
		const data = new Uint8Array(mw * mh);
		if (!(r > 0)) return data;

		for (let n = 0; n < texts.length; n++) {
			const T = texts[n];
			const x0 = T.x0 + ox, x1 = T.x1 + ox, y0 = T.y0 + oy, y1 = T.y1 + oy;
			const j0 = Math.max(0, Math.floor((y0 - r) / cs - 0.5)), j1 = Math.min(mh - 1, Math.ceil((y1 + r) / cs - 0.5));
			const i0 = Math.max(0, Math.floor((x0 - r) / cs - 0.5)), i1 = Math.min(mw - 1, Math.ceil((x1 + r) / cs - 0.5));
			for (let j = j0; j <= j1; j++) {
				const cy = (j + 0.5) * cs, dy = cy < y0 ? y0 - cy : (cy > y1 ? cy - y1 : 0);
				if (dy > r) continue;
				const dy2 = dy * dy, row = j * mw;
				for (let i = i0; i <= i1; i++) {
					const cx = (i + 0.5) * cs, dx = cx < x0 ? x0 - cx : (cx > x1 ? cx - x1 : 0);
					const d = Math.sqrt(dx * dx + dy2);
					let m;
					if (d <= s) m = 1;
					else if (f > 0 && d < r) m = smooth(1 - (d - s) / f);
					else continue;
					const v = (m * 255 + 0.5) | 0;
					if (v > data[row + i]) data[row + i] = v;
				}
			}
		}
		return data;
	}

	function mask(rec, texts, tp, W, H, scale) {
		const reqScale = Math.min(2, Math.max(0.5, scale || 1));
		let mw = Math.max(1, Math.ceil(W * reqScale));
		let mh = Math.max(1, Math.ceil(H * reqScale));
		while (mw * mh > MAX_CELLS) {
			mw = Math.max(1, Math.floor(mw * 0.8));
			mh = Math.max(1, Math.floor(mh * 0.8));
		}
		const effScale = W > 0 ? mw / W : 1;
		const cs = W > 0 ? W / mw : 1;

		const sig = signature(texts, tp, W, H, effScale);
		if (rec && rec.halo && rec.halo.sig === sig) return rec.halo;

		const q = reachOf(tp);
		const cv = document.createElement('canvas');
		cv.width = mw;
		cv.height = mh;
		const ctx = cv.getContext ? cv.getContext('2d', { willReadFrequently: true }) : null;

		if (!ctx || typeof ctx.fillText !== 'function' || typeof ctx.measureText !== 'function') {
			const fb = { sig, data: buildEuclideanFallback(texts, tp, mw, mh, cs), mw, mh, cs };
			if (rec) rec.halo = fb;
			return fb;
		}

		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, mw, mh);
		ctx.fillStyle = '#fff';
		ctx.strokeStyle = '#fff';
		ctx.lineJoin = 'round';
		ctx.miterLimit = 2;

		const ox = (tp.x || 0) * effScale;
		const oy = (tp.y || 0) * effScale;
		const spreadPx = q.s * effScale;
		const fadePx = q.f * effScale;

		for (let i = 0; i < texts.length; i++) {
			const T = texts[i];
			if (!T.word) continue;
			const domX = T.x0 * effScale;
			const domY = T.y0 * effScale;
			const domW = (T.x1 - T.x0) * effScale;
			const domH = (T.y1 - T.y0) * effScale;
			if (domW <= 0 || domH <= 0) continue;

			const fontSizePx = (T.fs || 16) * effScale;
			ctx.font = (T.fontStyle || 'normal') + ' ' + (T.fontWeight || '400') + ' ' + fontSizePx + 'px ' + (T.fontFamily || 'sans-serif');
			if ('letterSpacing' in ctx) {
				ctx.letterSpacing = ((T.letterSpacing || 0) * effScale) + 'px';
			}

			const word = applyTransform(T.word, T.textTransform);
			const tm = ctx.measureText(word);
			const cvW = tm && tm.width ? tm.width : domW;
			const scaleX = (cvW > 0 && Math.abs(cvW - domW) > 0.25) ? (domW / cvW) : 1;
			const asc = (tm && (tm.fontBoundingBoxAscent || tm.actualBoundingBoxAscent)) || domH * 0.78;
			const desc = (tm && (tm.fontBoundingBoxDescent || tm.actualBoundingBoxDescent)) || domH * 0.22;
			const baseY = domY + (domH - (asc + desc)) * 0.5 + asc;

			ctx.save();
			ctx.translate(domX + ox, baseY + oy);
			if (scaleX !== 1) ctx.scale(scaleX, 1);
			if (spreadPx > 0.05) {
				ctx.lineWidth = (spreadPx * 2) / scaleX;
				ctx.strokeText(word, 0, 0);
			}
			ctx.fillText(word, 0, 0);
			ctx.restore();
		}

		let rgba;
		const sigma = fadePx * 0.5;
		if (sigma > 0.25) {
			const blurCv = document.createElement('canvas');
			blurCv.width = mw;
			blurCv.height = mh;
			const bctx = blurCv.getContext('2d', { willReadFrequently: true });
			bctx.filter = 'blur(' + sigma.toFixed(2) + 'px)';
			bctx.drawImage(cv, 0, 0);
			rgba = bctx.getImageData(0, 0, mw, mh).data;
		} else {
			rgba = ctx.getImageData(0, 0, mw, mh).data;
		}

		const data = new Uint8Array(mw * mh);
		for (let p = 0, n = data.length; p < n; p++) data[p] = rgba[p * 4];

		const out = { sig, data, mw, mh, cs };
		if (rec) rec.halo = out;
		return out;
	}

	function activeCells(texts, tp, ox, oy, bw, bh, nx, ny, g, includeBox) {
		const a = new Uint8Array(nx * ny);
		const mark = (x0, y0, x1, y1) => {
			const i0 = Math.max(0, Math.floor(x0 / g)), i1 = Math.min(nx - 1, Math.floor(x1 / g));
			const j0 = Math.max(0, Math.floor(y0 / g)), j1 = Math.min(ny - 1, Math.floor(y1 / g));
			for (let j = j0; j <= j1; j++) { const row = j * nx; for (let i = i0; i <= i1; i++) a[row + i] = 1; }
		};
		if (includeBox) mark(ox, oy, ox + bw, oy + bh);
		const r = reachOf(tp).reach;
		const tx = tp.x || 0, ty = tp.y || 0;
		for (let n = 0; n < texts.length; n++) {
			const T = texts[n];
			mark(T.x0 + tx - r, T.y0 + ty - r, T.x1 + tx + r, T.y1 + ty + r);
		}
		return a;
	}

	window.j0.register('ipax-backdrop:halo', { reachOf, extent, mask, activeCells });
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
 *     est       HTMLCanvasElement  estimated backdrop (w x h), from the resolver
 *     estBlur   HTMLCanvasElement | null   single-pass blurred estimate at maxBlur * s
 *     grid      {V, nx, ny, g}     unknown cells, from the resolver
 *     w, h      working size in px
 *     s         working px per CSS px
 *     W, H      BOX size in CSS px
 *     ox, oy    origin of the box inside the layer, CSS px
 *     halo      null | {ratio, mode, blur, shared, mask:{data:Uint8Array, mw, mh, cs}}
 *     boxCover  boolean            false = container inactive; only --ipax-text paints
 *     boxBlur   number             container image blur in CSS px
 *     textBlur  number             glyph-contour image blur in CSS px
 *     maxBlur   number             Math.max(boxBlur, textBlur)
 *     infl      number             influence radius (CSS px) of a coloured text run, >= 6
 *     params    {ratio, mode, feather, blur}
 *     colors    {base:[r,g,b], runs:[{x0,y0,x1,y1,c}]}
 *   }
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
		const mode = (input.params && input.params.backend) || svc('config').backend;
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
 * CHAPTER 3 - KERNEL, CPU backend. Reference implementation paired with 3210-kernel-webgl-shaders.js.
 *
 * Composition pipeline per pixel:
 *   1. Mb       box mask (Euclidean feather inside box, 0 outside)
 *      Mh       calibrated glyph contour mask (0 without --ipax-text)
 *      mScreen  screen(Mb, Mh) = Mb + Mh - Mb * Mh
 *   2. Blur     single-pass estBlur mixed by mScreen (if boxBlur === textBlur)
 *               or max(Mb * boxBlur / maxBlur, Mh * textBlur / maxBlur)
 *   3. OKLab    continuous sequential lightness adaptation: L0 --(mScreen)--> L1 --(Mh)--> L2
 *   4. Veil     worst-case contrast veil weighted by max(mScreen * alBox, Mh * alText)
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

	function maskAt(m, rx, ry) {
		const data = m.data, mw = m.mw, mh = m.mh, cs = m.cs;
		let fx = rx / cs - 0.5, fy = ry / cs - 0.5;
		if (fx < 0) fx = 0; else if (fx > mw - 1) fx = mw - 1;
		if (fy < 0) fy = 0; else if (fy > mh - 1) fy = mh - 1;
		const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j;
		const i1 = i + 1 < mw ? i + 1 : i, j1 = j + 1 < mh ? j + 1 : j;
		const a = data[j * mw + i], b = data[j * mw + i1], c = data[j1 * mw + i], d = data[j1 * mw + i1];
		return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) / 255;
	}

	function render(input) {
		const C = svc('color'), K = svc('contrast');
		const LUT = C.LUT, clamp01 = C.clamp01, smooth = C.smooth, lum = C.luminance, toSrgb = C.toSrgb255, cr = K.ratio;
		const { est, estBlur, grid, w, h, s, W, H, params, colors } = input;
		const ox = input.ox || 0, oy = input.oy || 0;
		const halo = input.halo && input.halo.mask ? input.halo : null, haloOn = !!halo;
		const boxCover = input.boxCover !== false;
		const infl = input.infl > 6 ? input.infl : 6;
		const eps = 1 / s;

		let pix = null, blurPix = null, tainted = false;
		if (est) {
			try {
				pix = est.getContext('2d').getImageData(0, 0, w, h).data;
				if (estBlur) blurPix = estBlur.getContext('2d').getImageData(0, 0, w, h).data;
			} catch (e) { tainted = true; }
		}

		const out = new Uint8ClampedArray(w * h * 4);
		const triB = params.mode === 'tricontrast';
		const ratio = params.ratio, rS = K.solveRatio(ratio), bypassB = K.isBypass(ratio);
		const rH = haloOn ? halo.ratio : ratio, rSH = K.solveRatio(rH), bypassH = !haloOn || K.isBypass(rH);
		const triH = haloOn ? ((halo.mode || params.mode) === 'tricontrast') : triB;
		const shared = haloOn && !!halo.shared;

		const boxBlur = input.boxBlur !== undefined ? input.boxBlur : (params.blur || 0);
		const textBlur = input.textBlur !== undefined ? input.textBlur : (haloOn ? (halo.blur || 0) : 0);
		const maxBlur = input.maxBlur !== undefined ? input.maxBlur : Math.max(boxBlur, textBlur);
		const boxBlurRatio = maxBlur > 0 ? boxBlur / maxBlur : 0;
		const textBlurRatio = maxBlur > 0 ? textBlur / maxBlur : 0;
		const sameBlur = Math.abs(boxBlur - textBlur) < 1e-4;

		const fParam = params.feather;
		const f = (typeof fParam === 'object' && fParam !== null)
			? fParam
			: (typeof fParam === 'number' ? { top: fParam, right: fParam, bottom: fParam, left: fParam } : { top: 0, right: 0, bottom: 0, left: 0 });
		const fT = f.top > 0 ? f.top : 0, fR = f.right > 0 ? f.right : 0, fB = f.bottom > 0 ? f.bottom : 0, fL = f.left > 0 ? f.left : 0;
		const hasFeather = fT > 0 || fR > 0 || fB > 0 || fL > 0;

		const runs = colors.runs.slice(0, svc('limits').maxRuns);
		const pcs = [K.prepareColor(colors.base, rS)].concat(runs.map((r) => K.prepareColor(r.c, rS)));
		const pcsH = (haloOn && !shared) ? [K.prepareColor(colors.base, rSH)].concat(runs.map((r) => K.prepareColor(r.c, rSH))) : pcs;
		const band = K.band(ratio), tv = K.bandVeil(band);
		const bandH = haloOn ? K.band(rH) : band, tvH = haloOn ? K.bandVeil(bandH) : tv;
		const ok = [0, 0, 0], lin = [0, 0, 0];

		const defL = (L0, A, B, fr, fg, fb, pc, rs) => {
			if (cr(pc.yT, lum(fr, fg, fb)) >= rs) return L0;
			C.oklabToLin(pc.pkL, A, B, lin);
			if (cr(pc.yT, lum(lin[0], lin[1], lin[2])) < rs) return pc.pkL;
			let lo = L0, hi = pc.pkL;
			for (let n = 0; n < 9; n++) {
				const mid = (lo + hi) / 2;
				C.oklabToLin(mid, A, B, lin);
				if (cr(pc.yT, lum(lin[0], lin[1], lin[2])) >= rs) hi = mid; else lo = mid;
			}
			return hi;
		};

		const triL = (L0, A, B, Y0, bd) => {
			if (Y0 >= bd.lo && Y0 <= bd.hi) return L0;
			const up = Y0 < bd.lo, target = up ? bd.lo : bd.hi;
			let lo = up ? L0 : 0, hi = up ? 1 : L0;
			for (let n = 0; n < 13; n++) {
				const mid = (lo + hi) / 2;
				C.oklabToLin(mid, A, B, lin);
				if (lum(lin[0], lin[1], lin[2]) < target) lo = mid; else hi = mid;
			}
			return (lo + hi) / 2;
		};

		const solve = (L0, A, B, fr, fg, fb, rs, bd, isTri, pcList, kk, wk) => {
			if (isTri) return triL(L0, A, B, lum(fr, fg, fb), bd);
			let Lt = defL(L0, A, B, fr, fg, fb, pcList[0], rs);
			if (kk >= 0) Lt += wk * (defL(L0, A, B, fr, fg, fb, pcList[kk + 1], rs) - Lt);
			return Lt;
		};

		let minV = Infinity, under = 0, nI = 0, nV = 0;
		for (let y = 0; y < h; y++) {
			const ry = (y + 0.5) / s, by = ry - oy;
			const inY = by > -eps && by < H + eps;
			const uY = (inY && hasFeather) ? Math.max(
				fT > 0 ? (fT - by) / fT : 0,
				fB > 0 ? (by - (H - fB)) / fB : 0,
				0
			) : 0;

			for (let x = 0; x < w; x++) {
				const q = (y * w + x) * 4, rx = (x + 0.5) / s, bx = rx - ox;
				const inBox = inY && bx > -eps && bx < W + eps;
				let Mb = 0;
				if (inBox && boxCover) {
					if (hasFeather) {
						const uX = Math.max(
							fL > 0 ? (fL - bx) / fL : 0,
							fR > 0 ? (bx - (W - fR)) / fR : 0,
							0
						);
						const r = (uX > 0 && uY > 0) ? Math.sqrt(uX * uX + uY * uY) : (uX > uY ? uX : uY);
						Mb = smooth(clamp01(1 - r));
					} else {
						Mb = 1;
					}
				}
				const Mh = haloOn ? maskAt(halo.mask, rx, ry) : 0;
				const covers = inBox && boxCover;
				if (!covers && Mh <= 0) continue;
				const cov = covers ? 1 : Mh;
				const mScreen = Mb + Mh - Mb * Mh;
				const known = pix ? 1 - veilFrac(grid, rx, ry) : 0;

				let wk = 0, kk = -1;
				if (!triB || !triH) {
					for (let k = 0; k < runs.length; k++) {
						const r = runs[k];
						const d = Math.hypot(Math.max(r.x0 - rx, 0, rx - r.x1), Math.max(r.y0 - ry, 0, ry - r.y1));
						const wg = smooth(clamp01(1 - d / infl));
						if (wg > wk) { wk = wg; kk = k; }
					}
				}

				let ir = 0, ig = 0, ib = 0;
				if (known > 0) {
					let fr = LUT[pix[q]], fg = LUT[pix[q + 1]], fb = LUT[pix[q + 2]];

					if (blurPix && maxBlur > 0) {
						const mBlur = sameBlur ? mScreen : Math.max(Mb * boxBlurRatio, Mh * textBlurRatio);
						if (mBlur > 0) {
							const br = LUT[blurPix[q]], bg = LUT[blurPix[q + 1]], bb = LUT[blurPix[q + 2]];
							fr = fr + mBlur * (br - fr);
							fg = fg + mBlur * (bg - fg);
							fb = fb + mBlur * (bb - fb);
						}
					}

					if (bypassB && bypassH) {
						ir = toSrgb(fr); ig = toSrgb(fg); ib = toSrgb(fb);
					} else {
						C.linToOklab(fr, fg, fb, ok);
						const L0 = ok[0], A = ok[1], B = ok[2];
						let L1 = L0;
						if (!bypassB && mScreen > 0) {
							const LtB = solve(L0, A, B, fr, fg, fb, rS, band, triB, pcs, kk, wk);
							L1 = clamp01(L0 + mScreen * (LtB - L0));
						}
						let L2 = L1;
						if (!bypassH && Mh > 0) {
							C.oklabToLin(L1, A, B, lin);
							const LtH = solve(L1, A, B, lin[0], lin[1], lin[2], rSH, bandH, triH, pcsH, kk, wk);
							const hk = covers ? Mh : 1;
							L2 = clamp01(L1 + hk * (LtH - L1));
						}
						C.oklabToLin(L2, A, B, lin);
						ir = toSrgb(lin[0]); ig = toSrgb(lin[1]); ib = toSrgb(lin[2]);
						if (Mb >= 0.999 && known >= 0.999 && !bypassB) {
							const Y = lum(lin[0], lin[1], lin[2]);
							const v = triB ? Math.min(cr(1, Y), cr(0, Y)) : cr(pcs[wk > 0.5 ? kk + 1 : 0].yT, Y);
							if (v < minV) minV = v;
							if (v < ratio - 1e-6) under++;
							nI++;
						}
					}
				} else if (Mb >= 0.999) nV++;

				const vi = wk > 0.5 ? kk + 1 : 0;
				let wB = 0, vB = 0, wH = 0, vH = 0;
				if (!bypassB && mScreen > 0) { const pv = triB ? tv : pcs[vi]; wB = mScreen * pv.al; vB = pv.vc; }
				if (!bypassH && Mh > 0) { const pv = triH ? tvH : pcsH[vi]; wH = Mh * pv.al; vH = pv.vc; }
				const wm = wH > wB ? wH : wB, vcv = wH > wB ? vH : vB;
				const wV = (1 - known) * wm;
				const kc = known * cov;
				const aO = kc + wV;
				if (aO <= 0) continue;
				out[q] = (kc * ir + wV * vcv) / aO;
				out[q + 1] = (kc * ig + wV * vcv) / aO;
				out[q + 2] = (kc * ib + wV * vcv) / aO;
				out[q + 3] = aO * 255;
			}
		}
		const inf = triB ? !band.ok : pcs[0].pkR < ratio;
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
 * CHAPTER 3 - KERNEL, WebGL backend. Paired with 3100-kernel-cpu.js and 3210-kernel-webgl-shaders.js.
 *
 * Service 'ipax-backdrop:kernel-webgl': available(), render(input),
 *   disable(reason), reason(), reset()
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const UNIFORMS = [
		'uEst', 'uEstBlur', 'uHasBlur', 'uBlurRatios',
		'uGrid', 'uHalo', 'uSize', 'uTexSize', 'uGridTex',
		'uHaloTex', 'uHaloInfo', 'uHaloOn', 'uHaloShared',
		'uBox', 'uDim', 'uScale', 'uFeather', 'uGridInfo',
		'uHasEst', 'uTri', 'uTriH', 'uRatioS', 'uRatioSH',
		'uBypass', 'uBypassH', 'uBoxCover',
		'uBand', 'uBandH', 'uTriVeil', 'uTriVeilH',
		'uInfl', 'uRunCount', 'uRun', 'uCol', 'uColH'
	];
	const ALIGN = 64;
	const up = (v, a) => Math.ceil(v / (a || ALIGN)) * (a || ALIGN);

	function freshState() {
		return {
			canvas: null, gl: null, prog: null, loc: null, texEst: null, texGrid: null, texBlur: null, texHalo: null, buf: null, aPos: -1,
			broken: false, why: '',
			cw: 0, ch: 0,
			tw: 0, th: 0,
			bw: 0, bh: 0,
			gw: 0, gh: 0,
			hw: 0, hh: 0,
			maxDim: 0, n: 0,
			col: null, colH: null, rect: null,
			srcRect: { x: 0, y: 0, w: 0, h: 0 }
		};
	}
	const state = freshState();

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

	function makeTexture(gl, linear) {
		const t = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, t);
		const filter = linear ? gl.LINEAR : gl.NEAREST;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
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

			const Sh = svc('webgl-shaders'), maxRuns = svc('limits').maxRuns, maxC = maxRuns + 1;
			const prog = gl.createProgram();
			gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, Sh.vertex));
			gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, Sh.fragment(maxRuns)));
			gl.linkProgram(prog);
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('program link failed: ' + gl.getProgramInfoLog(prog));

			const loc = {};
			UNIFORMS.forEach((n) => { loc[n] = gl.getUniformLocation(prog, n) || gl.getUniformLocation(prog, n + '[0]'); });

			gl.useProgram(prog);
			gl.uniform1i(loc.uEst, 0);
			gl.uniform1i(loc.uGrid, 1);
			gl.uniform1i(loc.uEstBlur, 2);
			gl.uniform1i(loc.uHalo, 3);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

			const buf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
			const aPos = gl.getAttribLocation(prog, 'aPos');
			gl.enableVertexAttribArray(aPos);
			gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

			canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('WebGL context lost'); }, false);
			canvas.addEventListener('webglcontextrestored', () => { state.broken = false; state.why = ''; state.canvas = null; state.gl = null; }, false);

			state.cw = state.ch = state.tw = state.th = state.bw = state.bh = state.gw = state.gh = state.hw = state.hh = 0;
			const mvd = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
			state.maxDim = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), mvd[0], mvd[1]);
			state.col = new Float32Array(maxC * 4); state.colH = new Float32Array(maxC * 4);
			state.rect = new Float32Array(maxRuns * 4);

			state.canvas = canvas; state.gl = gl; state.prog = prog; state.loc = loc; state.buf = buf; state.aPos = aPos;
			gl.activeTexture(gl.TEXTURE0); state.texEst = makeTexture(gl);
			gl.activeTexture(gl.TEXTURE1); state.texGrid = makeTexture(gl);
			gl.activeTexture(gl.TEXTURE2); state.texBlur = makeTexture(gl);
			gl.activeTexture(gl.TEXTURE3); state.texHalo = makeTexture(gl, true);
			return true;
		} catch (err) {
			return fail(String(err && err.message || err));
		}
	}

	function render(input) {
		if (!init()) throw new Error(state.why || 'WebGL unavailable');
		const K = svc('contrast'), maxRuns = svc('limits').maxRuns;
		const { est, estBlur, grid, w, h, s, W, H, params, colors } = input;
		const halo = input.halo && input.halo.mask ? input.halo : null;
		const gl = state.gl, L = state.loc, maxDim = state.maxDim;
		if (w > maxDim || h > maxDim || grid.nx > maxDim || grid.ny > maxDim) throw new Error('working size ' + w + 'x' + h + ' exceeds the GPU limit ' + maxDim);

		if (w > state.cw || h > state.ch) {
			state.cw = Math.min(maxDim, Math.max(state.cw, up(w)));
			state.ch = Math.min(maxDim, Math.max(state.ch, up(h)));
			state.canvas.width = state.cw; state.canvas.height = state.ch;
		}
		gl.viewport(0, 0, w, h);

		if (w > state.tw || h > state.th) {
			state.tw = Math.min(maxDim, Math.max(state.tw, up(w)));
			state.th = Math.min(maxDim, Math.max(state.th, up(h)));
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, state.texEst);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, state.tw, state.th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			state.bw = 0; state.bh = 0;
		}
		let hasEst = 0, tainted = false;
		if (est) {
			try {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, state.texEst);
				gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, est);
				hasEst = 1;
			} catch (e) { tainted = true; }
		}

		let hasBlur = 0;
		if (estBlur && !tainted) {
			try {
				gl.activeTexture(gl.TEXTURE2);
				gl.bindTexture(gl.TEXTURE_2D, state.texBlur);
				if (state.bw !== state.tw || state.bh !== state.th) {
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, state.tw, state.th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
					state.bw = state.tw; state.bh = state.th;
				}
				gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, estBlur);
				hasBlur = 1;
			} catch (e) { }
		}

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, state.texGrid);
		if (grid.nx > state.gw || grid.ny > state.gh) {
			state.gw = Math.min(maxDim, Math.max(state.gw, up(grid.nx, 16)));
			state.gh = Math.min(maxDim, Math.max(state.gh, up(grid.ny, 16)));
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, state.gw, state.gh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
		}
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, grid.nx, grid.ny, gl.LUMINANCE, gl.UNSIGNED_BYTE, grid.V);

		let hmw = 1, hmh = 1, hcs = 1;
		if (halo) {
			const mk = halo.mask;
			hmw = mk.mw; hmh = mk.mh; hcs = mk.cs;
			if (hmw > maxDim || hmh > maxDim) throw new Error('halo mask ' + hmw + 'x' + hmh + ' exceeds the GPU limit ' + maxDim);
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, state.texHalo);
			if (hmw > state.hw || hmh > state.hh) {
				state.hw = Math.min(maxDim, Math.max(state.hw, up(hmw, 16)));
				state.hh = Math.min(maxDim, Math.max(state.hh, up(hmh, 16)));
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, state.hw, state.hh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
			}
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, hmw, hmh, gl.LUMINANCE, gl.UNSIGNED_BYTE, mk.data);
		}

		const rS = K.solveRatio(params.ratio), triB = params.mode === 'tricontrast';
		const rH = halo ? halo.ratio : params.ratio, rSH = K.solveRatio(rH);
		const triH = halo ? ((halo.mode || params.mode) === 'tricontrast') : triB;
		const shared = !!(halo && halo.shared);
		const bypassB = K.isBypass(params.ratio);
		const bypassH = !halo || K.isBypass(rH);

		const boxBlur = input.boxBlur !== undefined ? input.boxBlur : (params.blur || 0);
		const textBlur = input.textBlur !== undefined ? input.textBlur : (halo ? (halo.blur || 0) : 0);
		const maxBlur = input.maxBlur !== undefined ? input.maxBlur : Math.max(boxBlur, textBlur);
		const boxBlurRatio = maxBlur > 0 ? boxBlur / maxBlur : 0;
		const textBlurRatio = maxBlur > 0 ? textBlur / maxBlur : 0;

		const runs = colors.runs.length > maxRuns ? colors.runs.slice(0, maxRuns) : colors.runs;
		const pcs = [K.prepareColor(colors.base, rS)];
		for (let i = 0; i < runs.length; i++) pcs.push(K.prepareColor(runs[i].c, rS));
		let pcsH = pcs;
		if (halo && !shared) {
			pcsH = [K.prepareColor(colors.base, rSH)];
			for (let i = 0; i < runs.length; i++) pcsH.push(K.prepareColor(runs[i].c, rSH));
		}
		const col = state.col, colH = state.colH, rect = state.rect;
		for (let i = 0; i < pcs.length; i++) {
			const p = pcs[i], q = pcsH[i];
			col[i * 4] = p.yT; col[i * 4 + 1] = p.pkL; col[i * 4 + 2] = p.al; col[i * 4 + 3] = p.vc / 255;
			colH[i * 4] = q.yT; colH[i * 4 + 1] = q.pkL; colH[i * 4 + 2] = q.al; colH[i * 4 + 3] = q.vc / 255;
		}
		for (let i = 0; i < runs.length; i++) { const r = runs[i]; rect[i * 4] = r.x0; rect[i * 4 + 1] = r.y0; rect[i * 4 + 2] = r.x1; rect[i * 4 + 3] = r.y1; }
		const band = K.band(params.ratio), tv = K.bandVeil(band);
		const bandH = halo ? K.band(rH) : band, tvH = halo ? K.bandVeil(bandH) : tv;

		gl.uniform1f(L.uHasBlur, hasBlur);
		gl.uniform2f(L.uBlurRatios, boxBlurRatio, textBlurRatio);
		gl.uniform2f(L.uSize, w, h);
		gl.uniform2f(L.uTexSize, state.tw, state.th);
		gl.uniform2f(L.uGridTex, state.gw, state.gh);
		gl.uniform2f(L.uHaloTex, state.hw || 1, state.hh || 1);
		gl.uniform3f(L.uHaloInfo, hmw, hmh, hcs);
		gl.uniform1f(L.uHaloOn, halo ? 1 : 0);
		gl.uniform1f(L.uHaloShared, shared ? 1 : 0);
		gl.uniform2f(L.uBox, input.ox || 0, input.oy || 0);
		gl.uniform2f(L.uDim, W, H);
		gl.uniform1f(L.uScale, s);
		const fParam = params.feather;
		const f = (typeof fParam === 'number')
			? { top: fParam, right: fParam, bottom: fParam, left: fParam }
			: (fParam || { top: 0, right: 0, bottom: 0, left: 0 });
		gl.uniform4f(L.uFeather, f.top || 0, f.right || 0, f.bottom || 0, f.left || 0);
		gl.uniform3f(L.uGridInfo, grid.nx, grid.ny, grid.g);
		gl.uniform1f(L.uHasEst, hasEst);
		gl.uniform1f(L.uTri, triB ? 1 : 0);
		gl.uniform1f(L.uTriH, triH ? 1 : 0);
		gl.uniform1f(L.uRatioS, rS);
		gl.uniform1f(L.uRatioSH, rSH);
		gl.uniform1f(L.uBypass, bypassB ? 1 : 0);
		gl.uniform1f(L.uBypassH, bypassH ? 1 : 0);
		gl.uniform1f(L.uBoxCover, input.boxCover === false ? 0 : 1);
		gl.uniform2f(L.uBand, band.lo, band.hi);
		gl.uniform2f(L.uBandH, bandH.lo, bandH.hi);
		gl.uniform2f(L.uTriVeil, tv.al, tv.vc / 255);
		gl.uniform2f(L.uTriVeilH, tvH.al, tvH.vc / 255);
		gl.uniform1f(L.uInfl, input.infl > 6 ? input.infl : 6);
		gl.uniform1i(L.uRunCount, runs.length);
		gl.uniform4fv(L.uRun, rect);
		gl.uniform4fv(L.uCol, col);
		gl.uniform4fv(L.uColH, colH);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		if (state.n++ < 4 || (state.n & 15) === 0) {
			const err = gl.getError();
			if (err !== gl.NO_ERROR) throw new Error('WebGL error 0x' + err.toString(16));
		}

		const sr = state.srcRect;
		sr.x = 0; sr.y = state.ch - h; sr.w = w; sr.h = h;
		return { source: state.canvas, srcRect: sr, stats: null, tainted };
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
 * CHAPTER 3 - KERNEL, WebGL backend: shader sources (GLSL ES 1.00).
 * Line-by-line port of 3100-kernel-cpu.js.
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
uniform sampler2D uEst; uniform sampler2D uEstBlur; uniform float uHasBlur; uniform vec2 uBlurRatios; uniform sampler2D uGrid; uniform sampler2D uHalo; uniform vec2 uSize; uniform vec2 uTexSize; uniform vec2 uGridTex; uniform vec2 uHaloTex; uniform vec3 uHaloInfo; uniform float uHaloOn; uniform float uHaloShared; uniform vec2 uBox; uniform vec2 uDim; uniform float uScale; uniform vec4 uFeather; uniform vec3 uGridInfo; uniform float uHasEst; uniform float uTri; uniform float uTriH; uniform float uRatioS; uniform float uRatioSH; uniform float uBypass; uniform float uBypassH; uniform float uBoxCover; uniform vec2 uBand; uniform vec2 uBandH; uniform vec2 uTriVeil; uniform vec2 uTriVeilH; uniform float uInfl; uniform int uRunCount; uniform vec4 uRun[MAXRUNS]; uniform vec4 uCol[MAXC]; uniform vec4 uColH[MAXC]; float sm(float m) { return m * m * (3.0 - 2.0 * m); } float toLin(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); } float toSrgb(float l) { l = clamp(l, 0.0, 1.0); return l <= 0.0031308 ? 12.92 * l : 1.055 * pow(l, 1.0 / 2.4) - 0.055; } float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); } float cr(float a, float b) { return (max(a, b) + 0.05) / (min(a, b) + 0.05); } float cbrt(float x) { return x <= 0.0 ? 0.0 : pow(x, 1.0 / 3.0); } vec3 linToOk(vec3 c) { float l = cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b); float m = cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b); float s = cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b); return vec3( 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s); } vec3 okToLin(float L, float a, float b) { float l = L + 0.3963377774 * a + 0.2158037573 * b; l = l * l * l; float m = L - 0.1055613458 * a - 0.0638541728 * b; m = m * m * m; float s = L - 0.0894841775 * a - 1.2914855480 * b; s = s * s * s; return clamp(vec3( 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0.0, 1.0); } vec4 colOf(int idx) { vec4 c = uCol[0]; for (int k = 1; k < MAXC; k++) { if (k == idx) c = uCol[k]; } return c; } vec4 colHOf(int idx) { vec4 c = uColH[0]; for (int k = 1; k < MAXC; k++) { if (k == idx) c = uColH[k]; } return c; } float gridAt(float i, float j) { float nx = uGridInfo.x; float ny = uGridInfo.y; float ci = clamp(i, 0.0, nx - 1.0); float cj = clamp(j, 0.0, ny - 1.0); return min(texture2D(uGrid, vec2((ci + 0.5) / uGridTex.x, (cj + 0.5) / uGridTex.y)).r * 255.0, 1.0); } float veilFrac(float rx, float ry) { float g = uGridInfo.z; float fx = rx / g - 0.5; float fy = ry / g - 0.5; float ci = floor(fx); float cj = floor(fy); float tx = fx - ci; float ty = fy - cj; return (gridAt(ci, cj) * (1.0 - tx) + gridAt(ci + 1.0, cj) * tx) * (1.0 - ty) + (gridAt(ci, cj + 1.0) * (1.0 - tx) + gridAt(ci + 1.0, cj + 1.0) * tx) * ty; } float haloAt(float rx, float ry) { vec2 t = clamp(vec2(rx, ry) / uHaloInfo.z, vec2(0.5), uHaloInfo.xy - vec2(0.5)); return texture2D(uHalo, t / uHaloTex).r; } float defL(float L0, float A, float B, vec3 lin0, float yT, float pk, float rs) { if (cr(yT, lum(lin0)) >= rs) return L0; if (cr(yT, lum(okToLin(pk, A, B))) < rs) return pk; float lo = L0; float hi = pk; for (int n = 0; n < 9; n++) { float mid = (lo + hi) * 0.5; if (cr(yT, lum(okToLin(mid, A, B))) >= rs) hi = mid; else lo = mid; } return hi; } float triL(float L0, float A, float B, float Y0, vec2 bd) { if (Y0 >= bd.x && Y0 <= bd.y) return L0; bool up = Y0 < bd.x; float target = up ? bd.x : bd.y; float lo = up ? L0 : 0.0; float hi = up ? 1.0 : L0; for (int n = 0; n < 13; n++) { float mid = (lo + hi) * 0.5; if (lum(okToLin(mid, A, B)) < target) lo = mid; else hi = mid; } return (lo + hi) * 0.5; } float solveBoxL(vec3 ok, vec3 lin0, int kk, float wk, float rs, vec2 bd, float isTri) { if (isTri > 0.5) return triL(ok.x, ok.y, ok.z, lum(lin0), bd); vec4 c = colOf(0); float Lt = defL(ok.x, ok.y, ok.z, lin0, c.x, c.y, rs); if (kk >= 0) { vec4 c2 = colOf(kk + 1); Lt = Lt + wk * (defL(ok.x, ok.y, ok.z, lin0, c2.x, c2.y, rs) - Lt); } return Lt; } float solveTextL(vec3 ok, vec3 lin0, int kk, float wk, float rs, vec2 bd, float isTri) { if (isTri > 0.5) return triL(ok.x, ok.y, ok.z, lum(lin0), bd); vec4 c = colHOf(0); float Lt = defL(ok.x, ok.y, ok.z, lin0, c.x, c.y, rs); if (kk >= 0) { vec4 c2 = colHOf(kk + 1); Lt = Lt + wk * (defL(ok.x, ok.y, ok.z, lin0, c2.x, c2.y, rs) - Lt); } return Lt; } void main() { vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y); float rx = px.x / uScale; float ry = px.y / uScale; float bx = rx - uBox.x; float by = ry - uBox.y; float eps = 1.0 / uScale; bool inBox = bx > -eps && bx < uDim.x + eps && by > -eps && by < uDim.y + eps; bool covers = inBox && uBoxCover > 0.5; float Mb = 0.0; if (covers) { float uT = uFeather.x > 0.0 ? (uFeather.x - by) / uFeather.x : 0.0; float uR = uFeather.y > 0.0 ? (bx - (uDim.x - uFeather.y)) / uFeather.y : 0.0; float uB = uFeather.z > 0.0 ? (by - (uDim.y - uFeather.z)) / uFeather.z : 0.0; float uL = uFeather.w > 0.0 ? (uFeather.w - bx) / uFeather.w : 0.0; float ux = max(max(uL, uR), 0.0); float uy = max(max(uT, uB), 0.0); float r = (ux > 0.0 && uy > 0.0) ? sqrt(ux * ux + uy * uy) : max(ux, uy); Mb = sm(clamp(1.0 - r, 0.0, 1.0)); } float Mh = 0.0; if (uHaloOn > 0.5) Mh = haloAt(rx, ry); if (!covers && Mh <= 0.0) { gl_FragColor = vec4(0.0); return; } float cov = covers ? 1.0 : Mh; float mScreen = Mb + Mh - Mb * Mh; float known = 0.0; if (uHasEst > 0.5) known = 1.0 - veilFrac(rx, ry); float wk = 0.0; int kk = -1; if (uTri < 0.5 || uTriH < 0.5) { for (int k = 0; k < MAXRUNS; k++) { if (k >= uRunCount) break; vec4 r = uRun[k]; float dx = max(max(r.x - rx, 0.0), rx - r.z); float dy = max(max(r.y - ry, 0.0), ry - r.w); float wg = sm(clamp(1.0 - sqrt(dx * dx + dy * dy) / uInfl, 0.0, 1.0)); if (wg > wk) { wk = wg; kk = k; } } } vec3 img = vec3(0.0); if (known > 0.0) { vec2 uv = px / uTexSize; vec4 e = texture2D(uEst, uv); vec3 lin0 = vec3(toLin(e.r), toLin(e.g), toLin(e.b)); if (uHasBlur > 0.5) { float mBlur = abs(uBlurRatios.x - uBlurRatios.y) < 0.0001 ? mScreen : max(Mb * uBlurRatios.x, Mh * uBlurRatios.y); if (mBlur > 0.0) { vec4 eb = texture2D(uEstBlur, uv); vec3 blin = vec3(toLin(eb.r), toLin(eb.g), toLin(eb.b)); lin0 = lin0 + mBlur * (blin - lin0); } } if (uBypass > 0.5 && uBypassH > 0.5) { img = vec3(toSrgb(lin0.r), toSrgb(lin0.g), toSrgb(lin0.b)); } else { vec3 ok = linToOk(lin0); float L1 = ok.x; if (uBypass < 0.5 && mScreen > 0.0) { float LtB = solveBoxL(ok, lin0, kk, wk, uRatioS, uBand, uTri); L1 = clamp(ok.x + mScreen * (LtB - ok.x), 0.0, 1.0); } float L2 = L1; if (uBypassH < 0.5 && Mh > 0.0) { vec3 lin1 = okToLin(L1, ok.y, ok.z); float LtH = solveTextL(vec3(L1, ok.y, ok.z), lin1, kk, wk, uRatioSH, uBandH, uTriH); float hk = covers ? Mh : 1.0; L2 = clamp(L1 + hk * (LtH - L1), 0.0, 1.0); } vec3 o = okToLin(L2, ok.y, ok.z); img = vec3(toSrgb(o.r), toSrgb(o.g), toSrgb(o.b)); } } int vi = wk > 0.5 ? kk + 1 : 0; float wB = 0.0; float vB = 0.0; if (uBypass < 0.5 && mScreen > 0.0) { if (uTri > 0.5) { wB = mScreen * uTriVeil.x; vB = uTriVeil.y; } else { vec4 cb = colOf(vi); wB = mScreen * cb.z; vB = cb.w; } } float wH = 0.0; float vH = 0.0; if (uBypassH < 0.5 && Mh > 0.0) { if (uTriH > 0.5) { wH = Mh * uTriVeilH.x; vH = uTriVeilH.y; } else { vec4 ch = colHOf(vi); wH = Mh * ch.z; vH = ch.w; } } float wm = wH > wB ? wH : wB; float vcv = wH > wB ? vH : vB; float wV = (1.0 - known) * wm; float kc = known * cov; float aO = kc + wV; if (aO <= 0.0) { gl_FragColor = vec4(0.0); return; } vec3 col = (kc * img + wV * vec3(vcv)) / aO; gl_FragColor = vec4(col * aO, aO); }`;
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
 * Automatic two-level layer stacking (zero CSS plane configuration required):
 *
 *   Level 1 (Direct siblings / shared stacking context):
 *     <ipax-backdrop-layer aria-hidden="true" style="z-index: 0">...</ipax-backdrop-layer>
 *     <h1 style="...">The managed element (z-index: 1 via :where(), specificity 0)</h1>
 *     Every managed element stays above every sibling backdrop layer while preserving
 *     author z-index overrides, own background, gradients, ::before/::after and text-shadow.
 *
 *   Level 2 (Managed elements enclosed in stacking-context wrappers, e.g. .ed-box[z-index]):
 *     When a managed element sits inside a private stacking-context wrapper, its
 *     <ipax-backdrop-layer> is placed in the wrapper's parent container immediately before
 *     the wrapper (above background elements and any sibling with a lower z-index, and
 *     immediately behind its own wrapper at the same stack level), mirroring wrapper
 *     z-index / opacity / visibility / display.
 *
 * The CSS blur fallback (backdrop-filter, used where the backdrop is unknown) lives on
 * <div data-ipax-backdrop-bf>, which always covers the BOX only, so a halo that goes
 * outside the box never blurs the real page. <canvas> is positioned above it so the
 * kernel's feather-masked blur governs known pixels.
 *
 * PERFORMANCE NOTES (v0.1.05+)
 *   - Placement is split in two phases so a caller that handles many records
 *     can READ all geometry first and WRITE it afterwards (no layout thrashing):
 *       const m = records.map(measure);  records.forEach((r, i) => apply(r, m[i]));
 *     apply() skips style writes when nothing changed (rec.placed cache).
 *   - draw() accepts result.srcRect {x, y, w, h}: a sub-rectangle of a source
 *     canvas that is larger than the target (shared WebGL canvas kept at its
 *     maximum size). Without srcRect the whole source is used.
 *   - release() / sweep() free the canvas memory of layers that have been out
 *     of view for a while.
 *
 * Service 'ipax-backdrop:compositor':
 *   ensureStyle()                    inject the internal stylesheet (idempotent)
 *   attach(el) -> rec                create the layer {el, layer, cv, bf, id, ready, ext, ...}
 *   detach(el)                       remove one layer
 *   detachAll()                      remove every layer and observer
 *   pruneDisconnected() -> rec[]     detach records whose elements were removed from DOM
 *   refreshOrder()                   recompute DOM paint order across all active records
 *   recordFor(el) -> rec | undefined
 *   ownerRecord(el) -> rec | undefined
 *   isWrapper(el) -> boolean
 *   isStageOrAncestor(el) -> boolean
 *   recordsForTarget(el) -> rec[]
 *   layersBelow(rec, R) -> descriptor[]
 *   isAbove(a, b) -> boolean
 *   measure(rec) -> geometry         READ phase
 *   apply(rec, m)                    WRITE phase
 *   setExt(rec, ext) -> boolean
 *   place(rec)
 *   draw(rec, w, h, result, blurPx)
 *   clear(rec)
 *   release(rec)
 *   sweep(visibleSet, ttlMs)
 *   withHitTesting(rec, fn)
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const records = new Map();
	const wrapperToRec = new Map();
	let nextId = 0, observer = null, styleEl = null;

	/**
	 * INTERNAL STYLESHEET (the only CSS this library injects).
	 *   rule 1  managed elements are positioned at z-index 1 (specificity 0, author wins)
	 *   rule 2  the layer is an absolutely positioned, click-through box at z-index 0
	 *   rule 3  the blur element is an absolutely positioned box (covers the element box)
	 *   rule 4  the canvas sits above the blur fallback element and fills the layer
	 */
	function cssText() {
		const N = svc('names');
		return [
			':where([' + N.managedAttr + ']){position:relative;z-index:1}',
			N.layerTag + '{position:absolute;display:block;pointer-events:none;margin:0;padding:0;z-index:0}',
			N.layerTag + '>[data-ipax-backdrop-bf]{position:absolute;display:block;pointer-events:none;margin:0;padding:0;border-radius:inherit}',
			N.layerTag + '>canvas{position:relative;display:block;width:100%;height:100%}'
		].join('\n');
	}

	function ensureStyle() {
		if (styleEl && styleEl.isConnected) return;
		styleEl = document.createElement('style');
		styleEl.setAttribute('data-ipax-backdrop-style', '');
		styleEl.textContent = cssText();
		document.head.appendChild(styleEl);
	}

	function createsStackingContext(el) {
		if (!el || el.nodeType !== 1) return false;
		const cs = getComputedStyle(el);
		if (cs.position !== 'static' && cs.zIndex !== 'auto') return true;
		if (cs.isolation === 'isolate') return true;
		if (parseFloat(cs.opacity) < 1) return true;
		if (cs.transform !== 'none') return true;
		return false;
	}

	/**
	 * Finds the outermost stacking-context wrapper around `el` that contains no other
	 * managed elements. Returns null if `el` participates directly in a shared context.
	 */
	function findWrapper(el) {
		const N = svc('names');
		const managedSel = '[' + N.managedAttr + ']';
		let wrapper = null;
		let curr = el.parentElement;
		while (curr && curr !== document.body && curr !== document.documentElement) {
			const allManaged = curr.querySelectorAll(managedSel);
			if (allManaged.length > 1) break;
			if (createsStackingContext(curr)) wrapper = curr;
			curr = curr.parentElement;
		}
		return wrapper;
	}

	function placeLayer(rec) {
		if (rec.wrapper && rec.stageEl && rec.stageEl.isConnected) {
			if (rec.layer.parentNode !== rec.stageEl || rec.layer.nextSibling !== rec.wrapper) {
				rec.stageEl.insertBefore(rec.layer, rec.wrapper);
			}
			return;
		}
		if (rec.el.parentNode && (rec.layer.parentNode !== rec.el.parentNode || rec.layer.nextSibling !== rec.el)) {
			rec.el.parentNode.insertBefore(rec.layer, rec.el);
		}
		rec.layer.style.zIndex = '';
		rec.layer.style.opacity = '';
		rec.layer.style.visibility = '';
		rec.layer.style.display = '';
	}

	// A ResizeObserver always delivers one notification right after observe(). Treating it as a resize
	// invalidated every record at startup and made the first pass run twice. Only real size changes count.
	const roSizes = new WeakMap();

	function observeTarget(target) {
		if (!target || typeof ResizeObserver === 'undefined') return;
		if (!observer) {
			observer = new ResizeObserver((entries) => {
				for (const en of entries) {
					const r = en.contentRect, prev = roSizes.get(en.target);
					if (!prev) { roSizes.set(en.target, { w: r.width, h: r.height }); continue; } // first notification: baseline only
					if (Math.abs(prev.w - r.width) > 0.5 || Math.abs(prev.h - r.height) > 0.5) {
						prev.w = r.width; prev.h = r.height;
						window.j0.bus.emit('ipax-backdrop:invalidate', { reason: 'resize', target: en.target });
					}
				}
			});
		}
		observer.observe(target);
	}

	function attach(el) {
		const known = records.get(el);
		if (known) return known;
		const N = svc('names');
		el.setAttribute(N.managedAttr, '');
		const layer = document.createElement(N.layerTag), cv = document.createElement('canvas'), bf = document.createElement('div');
		layer.setAttribute('aria-hidden', 'true');
		bf.setAttribute('data-ipax-backdrop-bf', '');
		layer.appendChild(bf);
		layer.appendChild(cv);
		el.parentNode.insertBefore(layer, el);

		const bindWrapper = (targetRec) => {
			const w = findWrapper(targetRec.el);
			const st = w ? w.parentElement : null;
			targetRec.wrapper = w;
			targetRec.stageEl = st;
			if (w && st) {
				wrapperToRec.set(w, targetRec);
				observeTarget(w);
				observeTarget(st);
			}
			placeLayer(targetRec);
		};

		// If an earlier sibling claimed an ancestor of `el` as its private wrapper before `el` was marked,
		// release that stale wrapper binding so both elements resolve against their actual stacking wrappers.
		const displaced = [];
		for (let anc = el.parentElement; anc && anc !== document.body && anc !== document.documentElement; anc = anc.parentElement) {
			const prevRec = wrapperToRec.get(anc);
			if (prevRec && prevRec.el !== el) {
				wrapperToRec.delete(anc);
				prevRec.wrapper = null;
				prevRec.stageEl = null;
				prevRec.placed = null;
				prevRec.settled = false;
				displaced.push(prevRec);
			}
		}

		const rec = {
			el, layer, cv, bf, id: ++nextId, ready: false, placed: null, m: null,
			ext: { l: 0, t: 0, r: 0, b: 0 }, blurPx: 0, hiddenAt: 0,
			est: null, blurCv: null, halo: null,
			wrapper: null, stageEl: null, z: 0, domOrder: 0
		};
		records.set(el, rec);
		observeTarget(el);
		if (el.parentElement) observeTarget(el.parentElement);

		for (let i = 0; i < displaced.length; i++) bindWrapper(displaced[i]);
		bindWrapper(rec);

		return rec;
	}

	function detach(el) {
		const rec = records.get(el);
		if (!rec) return;
		const N = svc('names');
		rec.layer.remove();
		rec.el.removeAttribute(N.managedAttr);
		records.delete(el);
		if (rec.wrapper) wrapperToRec.delete(rec.wrapper);
	}

	function pruneDisconnected() {
		const removed = [];
		records.forEach((rec, el) => {
			if (!el.isConnected) removed.push(rec);
		});
		for (let i = 0; i < removed.length; i++) detach(removed[i].el);
		return removed;
	}

	function detachAll() {
		const N = svc('names');
		records.forEach((rec) => { rec.layer.remove(); rec.el.removeAttribute(N.managedAttr); });
		records.clear();
		wrapperToRec.clear();
		if (observer) { observer.disconnect(); observer = null; }
	}

	function refreshOrder() {
		const list = Array.from(records.values());
		list.sort((a, b) => {
			if (a.el === b.el) return 0;
			const pos = a.el.compareDocumentPosition(b.el);
			return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
		});
		for (let i = 0; i < list.length; i++) list[i].domOrder = i;
	}

	function ownerRecord(el) {
		let curr = el;
		while (curr && curr !== document.body && curr !== document.documentElement) {
			const r = records.get(curr) || wrapperToRec.get(curr);
			if (r) return r;
			curr = curr.parentElement;
		}
		return undefined;
	}

	function isWrapper(el) {
		return wrapperToRec.has(el);
	}

	function isStageOrAncestor(el) {
		if (!el || el.nodeType !== 1) return false;
		for (const rec of records.values()) {
			const st = rec.stageEl;
			if (st && (st === el || el.contains(st))) return true;
		}
		return false;
	}

	function recordsForTarget(target) {
		if (!target || target.nodeType !== 1) return [];
		const direct = records.get(target) || wrapperToRec.get(target);
		if (direct) return [direct];
		const N = svc('names');
		const host = target.closest && target.closest('[' + N.managedAttr + ']');
		if (host && records.has(host)) return [records.get(host)];
		const out = [];
		records.forEach((rec) => {
			if (target.contains(rec.el)) out.push(rec);
		});
		return out;
	}

	function isAbove(a, b) {
		if (a.z !== b.z) return a.z > b.z;
		return a.domOrder > b.domOrder;
	}

	function layersBelow(rec, R) {
		const out = [];
		records.forEach((other) => {
			if (other === rec || !other.ready || other.cv.width <= 0 || other.cv.height <= 0) return;
			if (other.layer.parentNode !== rec.layer.parentNode) return;
			if (other.z > rec.z || (other.z === rec.z && other.domOrder >= rec.domOrder)) return;
			const or = other.layer.getBoundingClientRect();
			if (or.width <= 0 || or.height <= 0) return;
			if (or.left >= R.right || or.right <= R.left || or.top >= R.bottom || or.bottom <= R.top) return;
			out.push({
				id: 1e6 + other.id,
				k: 'lay',
				cv: other.cv,
				r: or,
				a: 1,
				nocut: true,
				z: other.z,
				domOrder: other.domOrder
			});
		});
		out.sort((a, b) => (a.z - b.z) || (a.domOrder - b.domOrder));
		return out;
	}

	/** READ phase. Touches layout; call it for every record BEFORE any apply(). */
	function measure(rec) {
		const e = rec.el;

		if (rec.wrapper && rec.stageEl) {
			const er = e.getBoundingClientRect();
			const sr = rec.stageEl.getBoundingClientRect();
			const sw = rec.stageEl.offsetWidth, sh = rec.stageEl.offsetHeight;
			const sx = sw > 0 ? sr.width / sw : 1;
			const sy = sh > 0 ? sr.height / sh : 1;
			const padL = rec.stageEl.clientLeft * sx;
			const padT = rec.stageEl.clientTop * sy;
			const wcs = getComputedStyle(rec.wrapper);
			const wz = parseInt(wcs.zIndex, 10);
			const z = !isNaN(wz) ? wz : 0;
			return {
				l: (er.left - sr.left - padL) / sx,
				t: (er.top - sr.top - padT) / sy,
				w: er.width / sx,
				h: er.height / sy,
				z,
				wz,
				op: wcs.opacity,
				vis: wcs.visibility,
				disp: wcs.display
			};
		}

		const ecs = getComputedStyle(e);
		const ez = parseInt(ecs.zIndex, 10);
		return {
			l: e.offsetLeft,
			t: e.offsetTop,
			w: e.offsetWidth,
			h: e.offsetHeight,
			z: !isNaN(ez) ? ez : 0,
			wz: NaN,
			op: '',
			vis: '',
			disp: ''
		};
	}

	/** WRITE phase. Writes styles only when the geometry or stacking really changed. */
	function apply(rec, m) {
		rec.m = m;
		rec.z = m.z;
		placeLayer(rec);

		const isWrapped = !!(rec.wrapper && rec.stageEl);
		const x = rec.ext, l = m.l - x.l, t = m.t - x.t, w = m.w + x.l + x.r, h = m.h + x.t + x.b;
		const zStr = isWrapped ? (isNaN(m.wz) ? '' : String(m.wz)) : '';
		const opStr = isWrapped ? m.op : '';
		const visStr = isWrapped ? m.vis : '';
		const dispStr = isWrapped ? (m.disp === 'none' ? 'none' : '') : '';

		const p = rec.placed;
		if (
			p &&
			p.l === l && p.t === t && p.w === w && p.h === h &&
			p.bl === x.l && p.bt === x.t && p.bw === m.w && p.bh === m.h &&
			p.z === zStr && p.op === opStr && p.vis === visStr && p.disp === dispStr
		) {
			return;
		}

		const s = rec.layer.style;
		s.left = l + 'px'; s.top = t + 'px';
		s.width = w + 'px'; s.height = h + 'px';
		if (isWrapped) {
			if (s.zIndex !== zStr) s.zIndex = zStr;
			if (s.opacity !== opStr) s.opacity = opStr;
			if (s.visibility !== visStr) s.visibility = visStr;
			if (s.display !== dispStr) s.display = dispStr;
		}

		const b = rec.bf.style; // the blur element covers the box only
		b.left = x.l + 'px'; b.top = x.t + 'px';
		b.width = m.w + 'px'; b.height = m.h + 'px';

		rec.placed = { l, t, w, h, bl: x.l, bt: x.t, bw: m.w, bh: m.h, z: zStr, op: opStr, vis: visStr, disp: dispStr };
	}

	/** Change how far the layer grows beyond the box. Returns true if it changed (the layer rect must be re-read). */
	function setExt(rec, ext) {
		const x = rec.ext;
		if (x.l === ext.l && x.t === ext.t && x.r === ext.r && x.b === ext.b) return false;
		rec.ext = { l: ext.l, t: ext.t, r: ext.r, b: ext.b };
		if (rec.m) apply(rec, rec.m);
		return true;
	}

	function place(rec) { apply(rec, measure(rec)); }

	function resetBlurStyle(rec) {
		if (!rec.blurPx) return;
		rec.bf.style.backdropFilter = '';
		rec.bf.style.webkitBackdropFilter = '';
		rec.blurPx = 0;
	}

	function clear(rec) {
		if (rec.ready && rec.cv.width > 0) rec.cv.getContext('2d').clearRect(0, 0, rec.cv.width, rec.cv.height);
		resetBlurStyle(rec);
		rec.ready = false;
	}

	function draw(rec, w, h, result, blurPx = 0) {
		if (rec.cv.width !== w || rec.cv.height !== h) { rec.cv.width = w; rec.cv.height = h; }
		const ctx = rec.cv.getContext('2d');
		if (result.source instanceof ImageData) ctx.putImageData(result.source, 0, 0);
		else {
			ctx.clearRect(0, 0, w, h);
			const sr = result.srcRect;
			if (sr) ctx.drawImage(result.source, sr.x, sr.y, sr.w, sr.h, 0, 0, w, h);
			else ctx.drawImage(result.source, 0, 0, w, h);
		}

		// Fallback CSS blur for unknown areas or veil coverage (style is only touched when it changes)
		if (blurPx !== rec.blurPx) {
			if (blurPx > 0) {
				const b = 'blur(' + blurPx + 'px)';
				rec.bf.style.backdropFilter = b;
				rec.bf.style.webkitBackdropFilter = b;
			} else {
				rec.bf.style.backdropFilter = '';
				rec.bf.style.webkitBackdropFilter = '';
			}
			rec.blurPx = blurPx;
		}

		rec.ready = true;
		rec.hiddenAt = 0;
	}

	/**
	 * Free the memory held by a record: layer backing store and the scratch
	 * canvases kept by the resolver (rec.est) and the blur (rec.blurCv).
	 * The record is flagged unsettled, so the orchestrator redraws it when it
	 * becomes visible again.
	 */
	function release(rec) {
		rec.cv.width = 0; rec.cv.height = 0;
		rec.est = null;
		rec.blurCv = null;
		rec.halo = null;
		rec.ready = false;
		rec.settled = false;
		rec.lastW = 0; rec.lastH = 0;
		resetBlurStyle(rec);
	}

	/** Release every record that is not in visibleSet and has been hidden longer than ttlMs. Returns how many. */
	function sweep(visibleSet, ttlMs) {
		const now = performance.now();
		let freed = 0;
		records.forEach((rec) => {
			if (visibleSet.has(rec)) { rec.hiddenAt = 0; return; }
			if (!rec.hiddenAt) { rec.hiddenAt = now; return; }
			if (now - rec.hiddenAt >= ttlMs && (rec.cv.width > 0 || rec.est || rec.blurCv)) { release(rec); freed++; }
		});
		return freed;
	}

	function withHitTesting(rec, fn) {
		return fn();
	}

	window.j0.register('ipax-backdrop:compositor', {
		ensureStyle, attach, detach, detachAll, pruneDisconnected, refreshOrder,
		recordFor: (el) => records.get(el), ownerRecord, isWrapper, isStageOrAncestor,
		recordsForTarget, layersBelow, isAbove,
		measure, apply, setExt, place, draw, clear, release, sweep, withHitTesting
	});
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
 *   api.version      '0.1.10'
 *   api.config       live configuration object
 *   api.start()      scan the page and start (done automatically unless config.autoStart is false)
 *   api.stop()       remove every layer and stop
 *   api.refresh()    re-scan (new elements or rules) and recompute
 *   api.backend()    'webgl' | 'cpu' | '' (empty until the first render)
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);

	const api = {
		version: '0.1.11',
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

