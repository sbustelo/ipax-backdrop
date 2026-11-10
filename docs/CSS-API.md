# CSS API

ipax-backdrop is configured with CSS custom properties. The library reads them with `getComputedStyle`, so the normal cascade, inheritance, media queries and inline styles all apply.

```css
.glass {
  backdrop-filter: blur(6px);          /* the blur is yours: plain CSS */
  --ipax-backdrop-contrast: 4.5;
  --ipax-backdrop-feather: 14px;
  --ipax-backdrop-mode: default;
}
```

## Properties

| Property | Values | Default | Meaning |
|---|---|---|---|
| `--ipax-backdrop-contrast` | number, `1` to `15` | `4.5` | Minimum WCAG 2.x contrast ratio between the text and the corrected backdrop. |
| `--ipax-backdrop-feather` | length in `px` | `0` | Soft edge of the effect, from the element border **inward**. Contrast is only guaranteed where the effect is fully applied, so keep the element padding at least as large as the feather. |
| `--ipax-backdrop-mode` | `default`, `tricontrast` | `default` | See below. |

Values above `15`, or any value with an `lc` unit, are read as APCA Lc. **APCA is not supported in this version**: the element is left untouched and a `warning` event is emitted.

### Modes

- **`default`**: for the text colour of the element, move the backdrop lightness (L in OKLab) toward the extreme that contrasts more, only as far as needed. Text runs with another colour (a `<b>` or `<span>` with its own colour) get their own correction, blended smoothly with their neighbours.
- **`tricontrast`**: keep the backdrop inside the luminance band where **both white and black text** reach the ratio, so text of both colours can share one box. The band exists only up to about 4.54:1; at 4.5:1 it is almost a single grey and the photo flattens. Above that the element is reported as unreachable.

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
ipax.config.backend   = 'auto';   // 'auto' | 'webgl' | 'cpu'
ipax.config.cellSize  = 12;       // px, resolution of the underneath probe
ipax.config.maxPixels = 60000;    // working resolution cap per element
ipax.config.autoStart = true;     // set false BEFORE DOMContentLoaded to start manually
ipax.start(); ipax.stop(); ipax.refresh(); ipax.backend();
```

`'auto'` uses WebGL 1 when it is available and falls back to the CPU kernel for good if it is not, or if it fails. Contrast statistics (`stats`) are only produced by the CPU backend.

## Events

Listen with `window.j0.bus.on('ipax-backdrop:<name>', handler)`.

| Event | Payload | When |
|---|---|---|
| `ready` | `{}` | after `start()` |
| `updated` | `{element, ms, backend, stats, resolver, tainted, params}` | one element was recomputed |
| `backend` | `{backend, reason}` | the active kernel backend changed |
| `warning` | `{message}` | recoverable problem (unsupported value, unreadable stylesheet, too many text colours) |
| `error` | `{message}` | an update failed |
| `image-loaded` | `{}` | a background image finished loading |
| `invalidate` | `{reason}` | geometry changed, a refresh is needed |

## Limits

- Up to 7 differently coloured text runs per element; extra runs use the base colour.
- WCAG 2.x contrast only. APCA is deliberately out of this version.
- Colours that leave the sRGB gamut after the lightness change are clipped, which can shift their hue slightly.
- Output is 8 bits per channel; the solver keeps a small safety margin so rounding never drops a pixel under the requested ratio.
