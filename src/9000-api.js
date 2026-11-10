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
