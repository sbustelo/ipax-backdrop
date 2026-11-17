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