# CSS API

ipax-backdrop is configured with CSS custom properties. The library reads them with `getComputedStyle`, so the normal cascade, inheritance, media queries and inline styles all apply.

```css
.glass {
  --ipax-backdrop-contrast: 4.5;
  --ipax-backdrop-feather: 14px;
  --ipax-backdrop-blur: 6px;           /* integrated gradual blur */
  --ipax-backdrop-mode: default;
}
```

## Properties

| Property | Values | Default | Meaning |
|---|---|---|---|
| `--ipax-backdrop-contrast` | number, `1` to `15` | `4.5` | Minimum WCAG 2.x contrast ratio between the text and the corrected backdrop. Set to `1` to bypass lightness adaptation. |
| `--ipax-backdrop-blur` | length (`px` or unitless) | `0` | Internal spatial blur applied to the known backdrop, fading in gradually alongside the feather mask. |
| `--ipax-backdrop-feather` | 1 to 4 lengths (`px` or unitless) | `0` | Soft edge shorthand following CSS TRBL convention (top, right, bottom, left). Contrast is guaranteed only where fully applied; keep element padding larger than feather. |
| `--ipax-backdrop-feather-top` | length (`px` or unitless) | inherited | Directional override for top edge feathering. Overrules shorthand. |
| `--ipax-backdrop-feather-right` | length (`px` or unitless) | inherited | Directional override for right edge feathering. Overrules shorthand. |
| `--ipax-backdrop-feather-bottom` | length (`px` or unitless) | inherited | Directional override for bottom edge feathering. Overrules shorthand. |
| `--ipax-backdrop-feather-left` | length (`px` or unitless) | inherited | Directional override for left edge feathering. Overrules shorthand. |
| `--ipax-backdrop-mode` | `default`, `tricontrast` | `default` | See below. |

### Configuration Properties

| Property | Values | Default | Meaning |
|---|---|---|---|
| `--ipax-backdrop-backend` | `auto`, `webgl`, `cpu` | `auto` | Kernel backend selection (`auto` uses WebGL 1 and falls back to CPU). Can be overridden per element. |
| `--ipax-backdrop-cellsize` | length (`px` or unitless) | `12` | Probe grid resolution in CSS pixels for sampling elements underneath. |
| `--ipax-backdrop-performance` | number (`0` or target FPS) | `60` | Target FPS for the dynamic frame budget (`0` disables throttling for an unlimited budget). |
| `--ipax-backdrop-budget-min` | number (pixels) | `65536` | Minimum working pixel budget guaranteed per element. |
| `--ipax-backdrop-maxpixelscale` | number | `2` | Ceiling for HiDPI (`devicePixelRatio`) working resolution scale. |

### Feather Shorthand & Longhands

`--ipax-backdrop-feather` accepts 1, 2, 3, or 4 values, space- or comma-separated, adhering to the standard CSS box model:

```css
/* 1 value:  all four edges */
--ipax-backdrop-feather: 14px;

/* 2 values: top/bottom | right/left */
--ipax-backdrop-feather: 10px 20px;

/* 3 values: top | right/left | bottom */
--ipax-backdrop-feather: 10px 20px 30px;

/* 4 values: top | right | bottom | left */
--ipax-backdrop-feather: 10px 20px 30px 40px;

/* Shorthand + Longhand directional override */
--ipax-backdrop-feather: 14px;
--ipax-backdrop-feather-right: 0; /* clean cut on the right, soft on all other edges */
```

### Modes

- **`default`**: for the text colour of the element, move the backdrop lightness (L in OKLab) toward the extreme that contrasts more, only as far as needed. Text runs with another colour (a `<b>` or `<span>` with its own colour) get their own correction, blended smoothly with their neighbours.
- **`tricontrast`**: keep the backdrop inside the luminance band where **both white and black text** reach the ratio, so text of both colours can share one box. The band exists only up to about 4.54:1; at 4.5:1 it is almost a single grey and the picture flattens. Above that the element is reported as unreachable.
- **Bypass (Linear Blur)**: While not technically a `mode` value, setting `--ipax-backdrop-contrast: 1` short-circuits the lightness solver entirely. When combined with `--ipax-backdrop-blur` and `--ipax-backdrop-feather`, this transforms the engine into a high-performance directional gradual blur utility. Note: the default contrast is `4.5`, so you must explicitly declare `1` to trigger the bypass. If `--ipax-backdrop-blur` is also `0` (and the contrast is at most 1.05) there is nothing to compute and the layer is left empty.

## Declaring which elements are managed

The library scans the readable stylesheets for rules that declare any `--ipax-backdrop-*` property and manages every element they match. You can also opt in explicitly with an attribute:

```html
<h1 data-ipax-backdrop>Title</h1>
```

The attribute is required when the declaring stylesheet cannot be read: cross-origin without CORS, or any linked file opened from `file://`. Call `refresh()` after adding elements or rules.

## What the library adds to the page

For every managed element it inserts, immediately **before** it, a click-through sibling:

```html
<ipax-backdrop-layer aria-hidden="true"><canvas></canvas></ipax-backdrop-layer>
```

and sets `data-ipax-backdrop-managed` on the element. It also injects one small stylesheet that gives managed elements `position: relative` through `:where()` (specificity 0), so any `position` you declare wins. A managed element must be a box (block, inline-block, flex or grid item); do not use it on table cells, `display: contents` or inline text that wraps.

The element keeps everything it had: its own background, gradient, `::before` / `::after`, `text-shadow` and `backdrop-filter`. Because the layer is a sibling underneath, your `backdrop-filter` blurs the corrected backdrop together with whatever is really behind. Overlays and gradients you add to the element sit **above** the corrected backdrop and are not seen by the solver. They only add contrast when they push in the same direction as the text needs.

## How it decides what is underneath

The browser does not expose the pixels behind an element, so the library rebuilds an estimate from the elements below the layer: colour backgrounds (with alpha and opacity), `url()` background images (size, position, repeat) and `<img>` elements, plus the already-corrected layers of other managed elements. Anything else is **unknown** and gets a translucent veil whose alpha guarantees the ratio against the worst possible backdrop:

`transform`, `filter`, `mix-blend-mode`, `backdrop-filter` on other elements, pseudo-elements with a background, gradients, `background-attachment: fixed`, images still loading, and elements with `pointer-events: none` (the browser does not report them to the probe).

Images must be same-origin or served with CORS; otherwise the canvas cannot be read and the whole element gets the veil.

## Configuration

```js
const ipax = window.j0.get('ipax-backdrop');
ipax.config.backend       = 'auto';   // 'auto' | 'webgl' | 'cpu' (CSS: --ipax-backdrop-backend)
ipax.config.cellSize      = 12;       // px, resolution of the underneath probe (CSS: --ipax-backdrop-cellsize)
ipax.config.performance   = 60;       // target FPS; 0 = infinite budget (CSS: --ipax-backdrop-performance)
ipax.config.minBudget     = 65536;    // minimum working pixel budget per element (CSS: --ipax-backdrop-budget-min)
ipax.config.maxPixelScale = 2;        // Retina/HiDPI pixel scale ceiling (CSS: --ipax-backdrop-maxpixelscale)
ipax.config.autoStart     = true;     // set false BEFORE DOMContentLoaded to start manually

// JavaScript-only keys (no CSS property)
ipax.config.probeBlock        = 4;      // adaptive probing block, in cells (1 = probe every cell)
ipax.config.partialThrottleMs = 80;     // while scrolling, partly visible boxes refresh at most this often (0 = every frame)
ipax.config.frameBudgetMs     = 12;     // time spent per frame before yielding to the browser
ipax.config.releaseAfterMs    = 4000;   // free a box's canvases after this long out of view
ipax.start(); ipax.stop(); ipax.refresh(); ipax.backend();
```

`'auto'` uses WebGL 1 when it is available and falls back to the CPU kernel for good if it is not, or if it fails. Contrast statistics (`stats`) are only produced by the CPU backend.

The four JavaScript-only keys tune performance:

| Key | Default | Meaning |
|---|---|---|
| `probeBlock` | `4` | The probe grid is split into blocks of `probeBlock` x `probeBlock` cells. The four corners and the centre of each block are probed, and when all five see the same layers the block is filled without more calls. This makes the probe much cheaper on uniform backgrounds. A feature smaller than a block (48 px with the default `cellsize`) that none of the five samples touches can be missed. `1` probes every cell. |
| `partialThrottleMs` | `80` | While the page scrolls, a box that is only partly visible and already has a result is recomputed at most this often. Newly revealed areas keep the veil until then. `0` recomputes on every frame. |
| `frameBudgetMs` | `12` | Time the orchestrator spends per frame before yielding to the browser. The remaining boxes continue on the next frame. |
| `releaseAfterMs` | `4000` | The canvases of a box that has been out of view this long are freed. The box is recomputed when it returns. |

## Events

Listen with `window.j0.bus.on('ipax-backdrop:<name>', handler)`.

| Event | Payload | When |
|---|---|---|
| `ready` | `{}` | after `start()` |
| `updated` | `{element, ms, backend, stats, resolver, tainted, params, budget, stages}` | one element was recomputed |
| `backend` | `{backend, reason}` | the active kernel backend changed |
| `warning` | `{message}` | recoverable problem (unsupported value, unreadable stylesheet, too many text colours) |
| `error` | `{message}` | an update failed |
| `image-loaded` | `{}` | a background image finished loading |
| `invalidate` | `{reason}` | geometry changed, a refresh is needed |

Details of `updated`: `budget` is `{s, w, h}`, the working scale and canvas size chosen by the frame budget; `stages` is `{resolve, blur, kernel, draw}` in milliseconds; `resolver` holds the resolver statistics (`cells`, `probes` = number of `elementsFromPoint` calls, `unknown`, `tainted`, `probeMs`, `ms`); `stats` is `null` on WebGL. An element in bypass (contrast at most 1.05 and no blur) reports `backend: 'bypass'` with `resolver: null` and `budget: null`, and has no `stages`.

`invalidate` is also an input: emit it yourself to force every managed element to be recomputed, for example after changing a custom property from script:

```js
window.j0.bus.emit('ipax-backdrop:invalidate', { reason: 'manual' });
```

Elements that are off-screen when you do this are recomputed when they come back into view.

## Limits

- Up to 7 differently coloured text runs per element; extra runs use the base colour.
- WCAG 2.x contrast only. APCA is deliberately out of this version.
- Colours that leave the sRGB gamut after the lightness change are clipped, which can shift their hue slightly.
- Output is 8 bits per channel; the solver keeps a small safety margin so rounding never drops a pixel under the requested ratio.
- An element whose area is larger than the viewport is bypassed with a warning, and so is an element that contains other managed elements.
- The probe only sees what is inside the viewport. The part of a box outside it is unknown and gets the veil until the box is fully in view; while scrolling this can last up to `partialThrottleMs`.
- With the default `probeBlock`, the effective probe resolution on uniform areas is 4 cells (48 px by default). Set `probeBlock` to `1` if you rely on very thin elements being detected.

---

_IPAX Backdrop v0.1.05 • 2026-11-14 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_