# ipax-backdrop (Lucid Glass)

A vanilla JavaScript & WebGL backdrop-filter to get legible text over any picture, without solid overlays, gradients or drop shadows.

**ipax-backdrop** provides two independent, composable CSS effects rendered on an underlying sibling layer (`<ipax-backdrop-layer>`) without overriding author-declared `background`, `backdrop-filter`, or `text-shadow` rules:
- **`--ipax-backdrop`**: Adaptive container contrast and feathered background blur (eliminating the need for translucent overlays or uniform `backdrop-filter`).
- **`--ipax-text`**: Glyph-fitted contrast and background defocus around individual letterforms (eliminating the need for `text-shadow`).

```css
/* 1. Container protection — explicit longhands */
.glass-card {
  --ipax-backdrop-contrast: 4.5;   /* minimum WCAG 2.x contrast ratio (1..15, or 4.5:1) */
  --ipax-backdrop-blur: 8px;       /* background blur radius in px (optional, default: 0px) */
  --ipax-backdrop-feather: 16px;   /* soft inward edge ramp in px, TRBL shorthand (default: 0px) */
  --ipax-backdrop-mode: default;   /* solver mode: default | tricontrast */
}

/* 2. Container protection — equivalent shorthand */
.glass-card-shorthand {
  /* contrast | blur | feather (1..4 TRBL values) | mode */
  --ipax-backdrop: 4.5:1 8px 16px default;
}

/* 3. Text-only glyph contour directly over a photo (no container box) */
.hero-headline {
  /* offset-x | offset-y | halo radius | spread plateau | contrast | glyph blur */
  --ipax-text: 0px 1px 14px 35% 7:1 6px;
}

/* 4. Combined container + glyph contour + directional edge override */
.hero-banner {
  --ipax-mode: default;                    /* shared solver mode for both families */
  --ipax-backdrop: 3:1 10px 24px;          /* subtle container contrast + blur + 24px edge feather */
  --ipax-backdrop-feather-bottom: 128px;   /* cascade override: fade smoothly 128px from bottom edge */
  --ipax-text: 0px 0px 12px 30% 7:1 4px;   /* crisp 7:1 contrast + 4px defocus right behind letters */
}
```

Full syntax, longhands, TRBL cascade rules, APCA `Lc` fallback, and performance tuning keys are documented with detailed examples in [docs/CSS-API.md](docs/CSS-API.md).

## Why

WCAG was designed for flat colours. Over a picture, the background changes under every letter, so no single ratio holds. ipax-backdrop copies the pixels behind the text, moves their lightness (L in OKLab) just far enough to reach the requested ratio, and puts the result in a layer under the element. Where it cannot know what is underneath, it lays a translucent veil whose alpha guarantees the ratio against the worst possible backdrop.


## Online example

The example is published at the IPAX Project website:
https://ipax.bustelo.com.ar/?m=lucid-glass

## Quick Start

Load `dist/ipax-backdrop.min.js` (or `dist/ipax-backdrop.js`) and declare `--ipax-backdrop`, `--ipax-text`, or `--ipax-mode` in CSS. The engine auto-starts on `DOMContentLoaded`. For cross-origin or `file://` stylesheets, mark elements with `data-ipax-backdrop` or `data-ipax-text`.

### Linear / Gradual Blur (Bypass mode)

If you only want a directional, gradual blur without lightness adaptation, set `--ipax-backdrop-contrast: 1`. This short-circuits the OKLab solver, using the `--ipax-backdrop-feather` mask to smoothly fade the `--ipax-backdrop-blur` effect.

## Performance

Each managed element is recomputed only when something changed, and only while it is in or near the viewport. The work per frame is capped by a time budget (`config.frameBudgetMs`), the working resolution adapts to the target frame rate (`--ipax-backdrop-performance`), and DOM probing uses a two-level coarse-to-fine strategy (`3×3` grid pre-pass + `config.probeBlock` shared-corner blocks). The keys are in [docs/CSS-API.md](docs/CSS-API.md) and the scheduling is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

`examples/performance-test.php` renders 400 boxes over 16 generated backgrounds with a live HUD, to stress the engine on your own hardware.


## Documentation

- [docs/CSS-API.md](docs/CSS-API.md): Shorthands, longhands, contrast units, modes, events, and configuration.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): Pipeline stages, dual-mask composition, and CPU/WebGL parity.
- [docs/EXTENDING.md](docs/EXTENDING.md): Listening to bus events and replacing services.
- [docs/CHANGELOG.md](docs/CHANGELOG.md): Release history.

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

Version `0.1.10`, pre-release. Tested on Chrome, Firefox, and Safari (macOS and iOS).

## License

The architecture is [documented openly under CC BY 4.0, while the engine is released under Apache 2.0](LICENSE).

## ☕ Say thanks

IPAX Backdrop is developed and maintained independently as an open-source project.

If you find it useful, you can [buy me a coffee](https://cafecito.bustelo.com.ar/).

Entirely optional, never required.


---

_IPAX Backdrop v0.1.10 • 2026-11-17 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_