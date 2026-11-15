# ipax-backdrop (Lucid Glass)

A vanilla JavaScript & WebGL backdrop-filter to get legible text over any picture, without solid overlays, gradients or drop shadows.

**ipax-backdrop** is a CSS-declared effect that corrects the picture behind a piece of text, pixel by pixel, so the text reaches the WCAG contrast you ask for.  
The backdrop stays a picture, only as far changed as the contrast needs, and the text is guaranteed to be readable: the opposite of the illegible _liquid glass_ look.

```css
.glass {
  --ipax-backdrop-contrast: 4.5;     /* WCAG ratio */
  --ipax-backdrop-feather: 14px;     /* optional. Default: 0 */
  --ipax-backdrop-blur: 6px;         /* integrated gradual blur */
  --ipax-backdrop-mode: default;     /* or tricontrast */
}
```

Additional CSS custom properties for fine-tuning performance, frame budgets, and backend selection are documented in [docs/CSS-API.md](docs/CSS-API.md).

## Why

WCAG was designed for flat colours. Over a picture, the background changes under every letter, so no single ratio holds. ipax-backdrop copies the pixels behind the text, moves their lightness (L in OKLab) just far enough to reach the requested ratio, and puts the result in a layer under the element. Where it cannot know what is underneath, it lays a translucent veil whose alpha guarantees the ratio against the worst possible backdrop.


## Online example

The example is published at the IPAX Project website:
https://ipax.bustelo.com.ar/?m=lucid-glass


## Quick start

Load `dist/ipax-backdrop.min.js` or `dist/ipax-backdrop.js`, which are built from all files from lib/ and src/ in alphabetical order.


Then declare the properties on any element that sits over a picture. The library starts by itself on `DOMContentLoaded`. See `examples/index.html` for a working page.

If the rule that declares the properties lives in a stylesheet the browser will not let scripts read (cross-origin, or a linked file opened from `file://`), add the attribute `data-ipax-backdrop` to the element.

### Linear / Gradual Blur (Bypass mode)

If you only want a directional, gradual blur without lightness adaptation, set `--ipax-backdrop-contrast: 1`. This short-circuits the OKLab solver, using the `--ipax-backdrop-feather` mask to smoothly fade the `--ipax-backdrop-blur` effect.

## Performance

Each managed element is recomputed only when something changed, and only while it is in or near the viewport. The work per frame is capped by a time budget (`config.frameBudgetMs`), the working resolution adapts to the target frame rate (`--ipax-backdrop-performance`), and the probing of the DOM below each element is adaptive (`config.probeBlock`). The keys are in [docs/CSS-API.md](docs/CSS-API.md) and the scheduling is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

`examples/performance-test.php` renders 400 boxes over 16 generated backgrounds with a live HUD, to stress the engine on your own hardware.

## Documentation

- [docs/CSS-API.md](docs/CSS-API.md): properties, modes, what the library adds to the page, events, configuration, limits.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the layers, the file numbering convention, the data contracts and how the two kernels are kept equal.
- [docs/EXTENDING.md](docs/EXTENDING.md): listening to events, replacing a service, adding a file.

## Repository layout

```
dist/            single-file version of the script (contains all from lib/ and src/)
lib/j0-kernel/   bus and registry (kernel of the j0 framework)
src/             the library, one IIFE per file, loaded by ascending numeric prefix
examples/        sample pages: draggable boxes, the editor and the stress test (HTML, CSS and JS in separate files)
tooling/         build script (concatenates and minifies lib/ and src/ into dist/)
tests/           unit and CPU/GPU parity tests 
docs/            documentation
```

## Status

Version 0.1.05, pre-release. The API can change without notice.

Tested on Chrome, Firefox and Safari (macOS 15.7.3 on MacBook Pro M3), and Safari and Chrome (iOS 18.6.2 on iPhone 15 Pro Max).

To be done: test performance on more mobile browsers, hardware GPUs and phones.
Out of scope for this version: APCA (Lc) contrast, as the GPU shader cannot depend on the licensed reference implementation.

Contrast values above 15 or with an `lc` unit are rejected with a `warning` event. (WCAG allows up to 21:1, but a contrast > 15:1 over an image makes little sense. I thought it was better to reserve values above 15 for APCA Lc contrast, if a future license change allows).

## License

The architecture is [documented openly under CC BY 4.0, while the engine is released under Apache 2.0](LICENSE).

## ☕ Say thanks

IPAX Backdrop is developed and maintained independently as an open-source project.

If you find it useful, you can [buy me a coffee](https://cafecito.bustelo.com.ar/).

Entirely optional, never required.

---

_IPAX Backdrop v0.1.05 • 2026-11-14 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_