# ipax-backdrop (Lucid Glass)

A vanilla JavaScript & WebGL backdrop-filter to get accessible frosted glass. 

**ipax-backdrop** is A CSS-declared effect that corrects the photo behind a piece of text, pixel by pixel, so the text reaches the contrast you ask for. It is the opposite of the illegible glass look: the backdrop stays a photo, only as far changed as the contrast needs.

```css
.glass {
  --ipax-backdrop-contrast: 4.5;     /* WCAG ratio */
  --ipax-backdrop-feather: 14px;     /* optional. Default: 0 */
  --ipax-backdrop-mode: default;     /* or tricontrast */
  backdrop-filter: blur(6px);        /* adding standard CSS blur removes residual high-frequency detail that "fights" text */
}
```

## Why

WCAG was designed for flat colours. Over a photo, the background changes under every letter, so no single ratio holds. ipax-backdrop copies the pixels behind the text, moves their lightness (L in OKLab) just far enough to reach the requested ratio, and puts the result in a layer under the element. Where it cannot know what is underneath, it lays a translucent veil whose alpha guarantees the ratio against the worst possible backdrop.

## Quick start

Load all files from lib/ , then from src/ , in alphabetical order.

```html
<script src="lib/j0-kernel/01-bus-j0kernel.js"></script>
<script src="lib/j0-kernel/02-core-j0kernel.js"></script>
<script src="src/0010-nucleo.js"></script>
<script src="src/0100-util-color.js"></script>
<script src="src/0110-util-contrast.js"></script>
<script src="src/0200-orquestador.js"></script>
<script src="src/1000-lector.js"></script>
<script src="src/1100-lector-texto.js"></script>
<script src="src/2000-resolutor.js"></script>
<script src="src/2100-resolutor-capas.js"></script>
<script src="src/2200-resolutor-geometria.js"></script>
<script src="src/3000-kernel.js"></script>
<script src="src/3100-kernel-cpu.js"></script>
<script src="src/3200-kernel-webgl.js"></script>
<script src="src/3210-kernel-webgl-shaders.js"></script>
<script src="src/4000-compositor.js"></script>
<script src="src/9000-api.js"></script>
```

Then declare the properties on any element that sits over a photo. The library starts by itself on `DOMContentLoaded`. See `examples/index.html` for a working page.

If the rule that declares the properties lives in a stylesheet the browser will not let scripts read (cross-origin, or a linked file opened from `file://`), add the attribute `data-ipax-backdrop` to the element.

## Documentation

- [docs/CSS-API.md](docs/CSS-API.md): properties, modes, what the library adds to the page, events, configuration, limits.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the layers, the file numbering convention, the data contracts and how the two kernels are kept equal.
- [docs/EXTENDING.md](docs/EXTENDING.md): listening to events, replacing a service, adding a file.

## Repository layout

```
lib/j0-kernel/   bus and registry (kernel of the j0 framework, used unchanged)
src/             the library, one IIFE per file, loaded by ascending numeric prefix
example/         a page with draggable boxes (HTML, CSS and JS in separate files)
docs/            documentation
```

## Status

Version 0.1.0, pre-release.

Verified: unit checks of the pure services and the CPU kernel (contrast measured on 8-bit output), CPU versus WebGL parity on a headless WebGL 1 context (maximum difference of 1 level per channel), and the example page in Chromium.

Not verified: Safari, Firefox, mobile browsers, hardware GPUs and performance on phones. There is no automated test suite in the repository yet; a CPU versus GPU parity test is the first one planned.

Out of scope for this version: APCA (Lc) contrast. Values above 15 or with an `lc` unit are rejected with a `warning` event.

## License

Apache License 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). The j0 kernel in `lib/j0-kernel` is by Santiago Bustelo.
