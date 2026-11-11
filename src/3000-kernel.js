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
