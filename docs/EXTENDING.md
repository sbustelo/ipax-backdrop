# Extending

Everything goes through the j0 registry and bus, so nothing needs to be edited in `src/` to listen, observe or replace a stage.

## Listen to events

```js
const bus = window.j0.bus;

bus.on('ipax-backdrop:updated', (d) => {
  // d.element, d.ms, d.backend, d.stats (null on WebGL), d.resolver, d.tainted, d.params
});
bus.on('ipax-backdrop:warning', (d) => console.warn(d.message));
bus.on('ipax-backdrop:backend', (d) => console.log('kernel backend:', d.backend, d.reason));
```

`bus.on` returns a function that removes the handler. Event names and payloads are listed in [CSS-API.md](CSS-API.md).

## Control the library

```js
const ipax = window.j0.get('ipax-backdrop');
ipax.config.autoStart = false;   // set before DOMContentLoaded
ipax.config.backend = 'cpu';     // 'auto' | 'webgl' | 'cpu'
ipax.start();
ipax.refresh();                  // after adding elements or rules
```

## Replace a service

Services are looked up by name at call time, so registering a service under an existing name replaces it for every caller. Register after the library has loaded:

```js
window.j0.register('ipax-backdrop:kernel', {
  render(input) { /* ... */ return { source, stats, tainted, backend: 'mine' }; },
  activeBackend: () => 'mine'
});
```

Keep the contract of the stage you replace (see "Data contracts" in [ARCHITECTURE.md](ARCHITECTURE.md)). Typical uses: a different dispatcher (for example forcing a backend by element), a resolver that knows your page's structure, or a compositor that places the layer differently.

The contrast model (`ipax-backdrop:contrast`) is **not** meant to be replaced in 0.1.0: both kernels depend on its exact outputs, and the shader receives them as uniforms.

## Add a file to `src/`

1. Pick the next free number in the right group (see the numbering table in [ARCHITECTURE.md](ARCHITECTURE.md)).
2. Use this skeleton:

```js
/**
 * ipax-backdrop / 2300-example.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER: one line saying what this file does.
 *
 * Service 'ipax-backdrop:example': method(args) -> result
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n); // look services up when called, never at load

	function method(args) {
		const Color = svc('color');
		/* ... */
	}

	window.j0.register('ipax-backdrop:example', { method });
})();
```

3. Add the `<script>` line to your HTML in numeric order.
4. If it emits a new bus event, declare its payload in `window.j0.bus.schema` (see `0010-nucleo.js`). The j0 bus validates payload types when `window.j0.QA` is truthy.

## Keep the two kernels equal

If you change anything in `3100-kernel-cpu.js` that is not just a call to `0110-util-contrast.js`, make the same change in `3210-kernel-webgl-shaders.js`, then compare both backends on the same input: pixel values must agree within 1 level per channel (rounding) once the WebGL result, which is premultiplied, is compared with the CPU one premultiplied. The table of paired pieces is in [ARCHITECTURE.md](ARCHITECTURE.md).

---

_IPAX Backdrop v0.1.02 • 2026-11-10 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_