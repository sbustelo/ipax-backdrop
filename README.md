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


## Online example

The example is published at the IPAX Project website:
https://ipax.bustelo.com.ar/?m=lucid-glass


## Quick start

Load `dist/ipax-backdrop.js`, which is built from all files from lib/ and src/ in alphabetical order.


Then declare the properties on any element that sits over a photo. The library starts by itself on `DOMContentLoaded`. See `examples/index.html` for a working page.

If the rule that declares the properties lives in a stylesheet the browser will not let scripts read (cross-origin, or a linked file opened from `file://`), add the attribute `data-ipax-backdrop` to the element.

## Documentation

- [docs/CSS-API.md](docs/CSS-API.md): properties, modes, what the library adds to the page, events, configuration, limits.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the layers, the file numbering convention, the data contracts and how the two kernels are kept equal.
- [docs/EXTENDING.md](docs/EXTENDING.md): listening to events, replacing a service, adding a file.

## Repository layout

```
dist/            single-file version of the script (contains all from lib/ and src/)
lib/j0-kernel/   bus and registry (kernel of the j0 framework, used unchanged)
src/             the library, one IIFE per file, loaded by ascending numeric prefix
example/         sample page with draggable boxes (HTML, CSS and JS in separate files)
docs/            documentation
```

## Status

Version 0.1.0, pre-release.

Verified: 
- unit checks of the pure services and the CPU kernel (contrast measured on 8-bit output),
- CPU versus WebGL parity on a headless WebGL 1 context (maximum difference of 1 level per channel), 
- example page in Chrome Version 156.0.8078.80, Firefox 159.0.1 (aarch64), Safari Version 26.2 (20623.1.14.18.4) on macOS 15.7.3 (24G419).

To be done: test performance on more  mobile browsers, hardware GPUs and performance on phones. There is no automated test suite in the repository yet; a CPU versus GPU parity test is the first one planned.

Out of scope for this version: APCA (Lc) contrast, as the GPU shader cannot depend on (or faithfully reproduce) the licensed reference implementation.

Contrast values above 15 or with an `lc` unit are rejected with a `warning` event. (WCAG allows up to 21:1, but a contrast > 15:1 over an image makes little sense. I thought it was better to reserve values above 15 for APCA Lc contrast, if a future license change allows).

## License

Apache License 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). The j0 kernel in `lib/j0-kernel` is by Santiago Bustelo.

---

_IPAX Backdrop v0.1.02 • 2026-11-10 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_