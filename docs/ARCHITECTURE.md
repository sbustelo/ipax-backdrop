# Architecture

## Overview

Every element that declares `--ipax-backdrop-*` is processed by the same pipeline, once per frame in which something changed:

```
 reader          CSS               -> params {ratio, mode, feather, color}
 reader-text     text runs         -> colors {base, runs}
 resolver        DOM below layer   -> est (canvas) + grid (unknown cells)
 kernel          lightness solve   -> source (ImageData | canvas) + stats
 compositor      paint into layer  -> <ipax-backdrop-layer> under the element
 orchestrator    schedule and order everything above
```

The stages do not know each other. The orchestrator (`0200`) calls them by name through the service registry.

## Rules for every file in `src/`

1. One IIFE per file with `'use strict'`. No `import` or `export`.
2. The only global is `window.j0` (the j0 kernel in `lib/j0-kernel`). A file publishes itself with `window.j0.register('ipax-backdrop:<name>', service)`.
3. A file never needs another file at **load** time. It looks services up with `window.j0.get()` when it is **called**. Hot loops copy the services they need into local constants first. This is why concatenating the files in any order would still work; the numeric order only serves readability.
4. Synchronous calls go through the registry. The bus carries notifications only (`ready`, `updated`, `backend`, `warning`, `error`, `image-loaded`, `invalidate`). It never moves data between stages.
5. Each file starts with a header comment stating its chapter, its service, and its contract.

## File numbering

Four digits, in the spirit of BASIC line numbers: tens inside a group, hundreds for a sub-chapter, thousands for a chapter. Files load in ascending order.

| Range | Chapter | Files |
|---|---|---|
| 0010 | Foundation | `0010-nucleo` constants, limits, config, bus contracts |
| 01xx | Utilities | `0100-util-color`, `0110-util-contrast` |
| 02xx | Orchestrator | `0200-orquestador` |
| 1xxx | Reader | `1000-lector` (CSS), `1100-lector-texto` (text colours) |
| 2xxx | Resolver | `2000-resolutor`, `2100-resolutor-capas`, `2200-resolutor-geometria` |
| 3xxx | Kernel | `3000-kernel` contract and backend choice, `3100-kernel-cpu`, `3200-kernel-webgl`, `3210-kernel-webgl-shaders` |
| 4xxx | Compositor | `4000-compositor` |
| 9xxx | Public API | `9000-api` |

A new file takes the next free number inside its group. A new chapter takes the next free thousand. `9000` stays last.

## Services

| Service (prefix `ipax-backdrop:`) | File | Methods |
|---|---|---|
| `names`, `limits`, `config` | 0010 | constants and mutable configuration |
| `color` | 0100 | `clamp01`, `smooth`, `LUT`, `toSrgb255`, `luminance`, `linToOklab`, `oklabToLin`, `parseCssColor` |
| `contrast` | 0110 | `ratio`, `parseContrast`, `solveRatio`, `prepareColor`, `band`, `bandVeil` |
| `orchestrator` | 0200 | `start`, `stop`, `refresh`, `schedule` |
| `reader` | 1000 | `scan`, `readParams` |
| `reader-text` | 1100 | `readColors` |
| `resolver` | 2000 | `resolve` |
| `layers` | 2100 | `layersOf`, `imageFor` |
| `css-geometry` | 2200 | `splitTop`, `parseLength`, `parseRepeat`, `backgroundGeometry`, `objectFitGeometry` |
| `kernel` | 3000 | `render`, `activeBackend` |
| `kernel-cpu` | 3100 | `available`, `render` |
| `kernel-webgl` | 3200 | `available`, `render`, `disable`, `reason`, `reset` |
| `webgl-shaders` | 3210 | `vertex`, `fragment(maxRuns)` |
| `compositor` | 4000 | `ensureStyle`, `attach`, `detachAll`, `recordFor`, `place`, `draw`, `clear`, `withHitTesting` |
| (no prefix) `ipax-backdrop` | 9000 | `version`, `config`, `start`, `stop`, `refresh`, `backend` |

## Data contracts

```
params   {ok, reason, ratio, mode: 'default'|'tricontrast', feather, color}
colors   {base: [r,g,b], runs: [{x0,y0,x1,y1,c:[r,g,b]}], truncated}
resolve  (rec, R, s, w, h, cell) -> {est, grid, why, stats}
           est   canvas w x h, the estimated backdrop (opaque)
           grid  {V, nx, ny, g}  V[j*nx+i] = 1 where the backdrop is unknown (already dilated one cell)
kernel   render({est, grid, w, h, s, W, H, params, colors}) -> {source, stats, tainted, backend}
           source   ImageData (CPU) or canvas (WebGL), w x h, straight or premultiplied alpha respectively
           stats    {min, under, nI, nV, inf} on CPU, null on WebGL
rec      {el, layer, cv, id, ready}   one per managed element, owned by the compositor
```

Coordinates: `R` and the run rectangles are in CSS pixels; `s` is working pixels per CSS pixel (the working canvas is capped at `config.maxPixels`).

## The kernel, in words

Per pixel: a feather mask `M` (0 at the element border, 1 `feather` pixels inside); a "known" weight `C` (1 where the backdrop estimate can be trusted, falling to 0 inside unknown cells); where `C > 0` the lightness of the estimated pixel (OKLab L, with a and b kept) is moved just far enough to reach the ratio, then mixed with the original by `M`; where `C < 1` a translucent flat veil is added whose alpha guarantees the ratio against the worst possible backdrop.

- `default`: push toward the extreme (black or white) that contrasts more with the text colour, with a binary search for the first crossing so the change is minimal.
- `tricontrast`: clamp into the luminance band where white and black text both reach the ratio.

Margins: the output is 8 bits per channel, so solving exactly at the threshold would leave about 0.6% of pixels slightly below it after rounding. Default mode solves for `ratio * 1.012`; tricontrast shrinks its band by a small guard. These numbers live in `0110-util-contrast.js`.

## Two kernels, one behaviour

The CPU kernel (`3100`, JavaScript) and the WebGL kernel (`3210`, GLSL) are two implementations of the same algorithm. A GPU cannot run the JavaScript one, so the duplication is unavoidable.

| Piece | JS | GLSL |
|---|---|---|
| sRGB transfer curve, OKLab conversions | `0100-util-color` | `3210` (`toLin`, `toSrgb`, `linToOk`, `okToLin`) |
| default solve | `defL` in `3100` | `defL` in `3210` |
| tricontrast solve | `triL` in `3100` | `triL` in `3210` |
| unknown-cell interpolation | `veilFrac` in `3100` | `veilFrac` in `3210` |
| run weights, feather mask, final composite | `render` in `3100` | `main` in `3210` |

Not duplicated: everything that depends on the text colour or the ratio (luminance, direction, veil alpha and level, tricontrast band) is computed once in `0110-util-contrast.js` and passed to the shader as uniforms.

Rule: **if you change one implementation, change the other and compare them.** Measured so far, the two agree within 1 level per channel (rounding) across default and tricontrast, with runs, feather, unknown cells and a missing estimate. A CPU versus GPU parity test in `test/` is planned for exactly this.

## WebGL notes

- GLSL ES 1.00 (WebGL 1). The kernel needs no WebGL 2 feature and WebGL 1 is available everywhere. Loops have constant bounds, and uniform arrays are only indexed by loop counters, as that version requires.
- One shared context. Browsers cap contexts per page, so every element renders in turn into one hidden canvas and the compositor copies the result into the element's own layer canvas **immediately** (`orchestrator.update`). A WebGL result is only valid until the next render.
- Orientation: textures are uploaded with row 0 at the top (`UNPACK_FLIP_Y_WEBGL` false) and the shader measures `y` from the top (`uSize.y - gl_FragCoord.y`).
- Output is premultiplied alpha (`premultipliedAlpha: true`). The CPU path produces straight alpha; both look identical once composited.
- The unknown-cell grid is a `LUMINANCE` texture, uploaded with `UNPACK_ALIGNMENT` 1.
- Availability: context creation (`failIfMajorPerformanceCaveat` refuses software renderers), `highp` floats in fragment shaders, shader compilation and linking, any GL error after a draw, and context loss. Any failure marks the backend unavailable, and the dispatcher (`3000`) falls back to CPU and emits `backend`. A restored context makes WebGL available again.
- Nothing is read back from the GPU, so there are no contrast statistics on this backend.

## Design decisions

- **Layer as a sibling, before the element.** The element keeps its own background, gradient, pseudo-elements and `backdrop-filter`, and that filter blurs the corrected layer together with what is really behind. A child layer would paint over the element's own background and would not be blurred by its `backdrop-filter`.
- **`position: relative` through `:where()`.** A positioned element paints above a static one regardless of DOM order, so a static element's text would end up under the absolute layer. `:where()` has specificity 0, so any `position` the author declares wins.
- **Estimate plus veil, not capture.** The browser exposes no pixels behind an element. The resolver rebuilds an estimate of what it can reproduce and treats the rest as unknown. The veil makes the guarantee hold without knowing the content.
- **Registry for calls, bus for events.** Data in a per-frame pipeline must be synchronous and traceable. The bus would make the flow implicit and asynchronous.
- **j0 kernel as the only dependency.** Bus and registry come from `lib/j0-kernel`, used unchanged. The library never uses `window.j0.logger.log` or `warn`: that logger queues them and prints a misleading timeout after 3 seconds. Warnings travel as `ipax-backdrop:warning`.
- **No APCA.** Not as a plugin either. A JavaScript plugin could not run on the GPU, and the contrast model would then differ between backends.

## Known limits

- The resolver probes a point grid (12 px by default): thin elements between probes can be missed.
- Elements with `pointer-events: none` are invisible to `elementsFromPoint`, so the resolver cannot see them. Other managed layers are handled through the compositor registry instead.
- Up to 7 differently coloured text runs per element.
- Colours leaving the sRGB gamut after the lightness change are clipped, which can shift hue slightly.
- Stacked managed elements are processed lowest first by `z-index` and DOM order; exotic stacking contexts can break that order.

---

_IPAX Backdrop v0.1.02 • 2026-11-10 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_