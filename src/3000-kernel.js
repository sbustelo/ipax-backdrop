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