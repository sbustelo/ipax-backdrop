# Architecture

## Overview

Every element that declares `--ipax-backdrop-*` is processed by the same pipeline, once per frame in which something changed:

```
 reader          CSS               -> params {ratio, mode, feather, blur, color, ...}
 reader-text     text runs         -> colors {base, runs}
 resolver        DOM below layer   -> est (canvas) + grid (unknown cells)
 blur            est               -> estBlur (canvas) or null
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
| 2xxx | Resolver | `2000-resolutor`, `2100-resolutor-capas`, `2200-resolutor-geometria`, `2300-resolutor-desenfoque` (blur) |
| 3xxx | Kernel | `3000-kernel` contract and backend choice, `3100-kernel-cpu`, `3200-kernel-webgl`, `3210-kernel-webgl-shaders` |
| 4xxx | Compositor | `4000-compositor` |
| 9xxx | Public API | `9000-api` |

A new file takes the next free number inside its group. A new chapter takes the next free thousand. `9000` stays last.

## Services

| Service (prefix `ipax-backdrop:`) | File | Methods |
|---|---|---|
| `names`, `limits`, `config` | 0010 | constants and mutable configuration |
| `color` | 0100 | `clamp01`, `smooth`, `LUT`, `toSrgb255`, `luminance`, `linToOklab`, `oklabToLin`, `parseCssColor` |
| `contrast` | 0110 | `MAX_WCAG_RATIO`, `ratio`, `parseContrast`, `solveRatio`, `isBypass`, `prepareColor`, `band`, `bandVeil` |
| `orchestrator` | 0200 | `start`, `stop`, `refresh`, `schedule` |
| `reader` | 1000 | `scan`, `readParams` |
| `reader-text` | 1100 | `readColors` |
| `resolver` | 2000 | `resolve` |
| `layers` | 2100 | `layersOf`, `imageFor`, `beginFrame`, `endFrame` |
| `css-geometry` | 2200 | `splitTop`, `parseLength`, `parseRepeat`, `backgroundGeometry`, `objectFitGeometry` |
| `blur` | 2300 | `blur`, `boxRadius`, `factor` |
| `kernel` | 3000 | `render`, `activeBackend` |
| `kernel-cpu` | 3100 | `available`, `render` |
| `kernel-webgl` | 3200 | `available`, `render`, `disable`, `reason`, `reset` |
| `webgl-shaders` | 3210 | `vertex`, `fragment(maxRuns)` |
| `compositor` | 4000 | `ensureStyle`, `attach`, `detachAll`, `recordFor`, `measure`, `apply`, `place`, `draw`, `clear`, `release`, `sweep`, `withHitTesting` |
| (no prefix) `ipax-backdrop` | 9000 | `version`, `config`, `start`, `stop`, `refresh`, `backend` |

## Data contracts

```
params   {ok, reason, ratio, mode: 'default'|'tricontrast', feather: {top,right,bottom,left}, blur, color,
          performance, minBudget, backend, cellSize, maxPixelScale}
colors   {base: [r,g,b], runs: [{x0,y0,x1,y1,c:[r,g,b]}], truncated}
resolve  (rec, R, s, w, h, cell) -> {est, grid, why, stats}
           est   canvas w x h, the estimated backdrop (opaque). REUSED: it lives in rec.est and the next
                 resolve() of the same record overwrites it, so it must be consumed synchronously
           grid  {V, nx, ny, g}  V[j*nx+i] = 1 where the backdrop is unknown (already dilated one cell)
           stats {cells, probes, unknown, tainted, baseReal, probeMs, ms}
blur     blur(est, w, h, sigma, store?) -> canvas w x h | null   (store = rec: the output canvas is kept in rec.blurCv)
kernel   render({est, estBlur, grid, w, h, s, W, H, params, colors}) -> {source, srcRect?, stats, tainted, backend}
           source   ImageData (CPU, straight alpha) or canvas (WebGL, premultiplied alpha)
           srcRect  WebGL only: {x, y, w, h}, the part of `source` that holds the result. The shared canvas is
                    larger than w x h (it only grows), so the consumer must copy just this rectangle
           stats    {min, under, nI, nV, inf} on CPU, null on WebGL
rec      {el, layer, cv, id, ready, ...}   one per managed element, owned by the compositor
           placement   placed, blurPx, hiddenAt                       (compositor)
           scheduling  settled, epoch, lastW, lastH, renderedAt, waitImg   (orchestrator)
           scratch     est, blurCv                                    (resolver, blur)
```

Coordinates: `R` and the run rectangles are in CSS pixels; `s` is working pixels per CSS pixel (the working resolution is governed by the frame budget `performance` / `minBudget` and capped at `config.maxPixelScale`).

The record is the only per-element state the stages share, and it is the one place where they touch each other's data: the resolver and the blur keep their scratch canvases in it, the orchestrator keeps the scheduling flags, and the compositor releases everything when a box leaves the viewport. Each stage writes only its own fields.

## The kernel, in words

Per pixel: a feather mask `M` (0 at the element border, 1 `feather` pixels inside); a "known" weight `C` (1 where the backdrop estimate can be trusted, falling to 0 inside unknown cells); where `C > 0` the lightness of the estimated pixel (OKLab L, with a and b kept) is moved just far enough to reach the ratio, then mixed with the original by `M`; where `C < 1` a translucent flat veil is added whose alpha guarantees the ratio against the worst possible backdrop.

- `default`: push toward the extreme (black or white) that contrasts more with the text colour, with a binary search for the first crossing so the change is minimal.
- `tricontrast`: clamp into the luminance band where white and black text both reach the ratio.

Margins: the output is 8 bits per channel, so solving exactly at the threshold would leave about 0.6% of pixels slightly below it after rounding. Default mode solves for `ratio * 1.012`; tricontrast shrinks its band by a small guard. These numbers live in `0110-util-contrast.js`.

## Scheduling

- **Visible set.** An `IntersectionObserver` (`rootMargin: 50px 0px`) keeps the set of records in or near the viewport. Only those are measured and recomputed.
- **One layout per frame.** `runAll` runs in `requestAnimationFrame`: first every geometry read (`compositor.measure`), then every write (`compositor.apply`, skipped when nothing changed), then the `getBoundingClientRect` reads.
- **Epochs.** `invalidate`, window resize, `refresh()` and font loads bump a global epoch. A record is clean when it is settled and its epoch is current; otherwise it is recomputed the next time it is visible, even if it was off-screen when the change happened. Image loads only reopen the records that were drawn while waiting for an image (`rec.waitImg`). A record settles once it has been computed fully in view; partly visible boxes stay unsettled. The `ResizeObserver` only reports real size changes, never its initial notification.
- **Queue.** Dirty records are sorted by `z-index`, then by distance to the viewport centre, and processed until `config.frameBudgetMs` (12 ms) is used. The rest waits for the next frame.
- **Resolution.** For each element the working scale `s` is stretched between `minBudget` pixels and `min(maxPixelScale, devicePixelRatio)`, using two moving averages (fixed probing time and pixel throughput) and the frame time divided across the dirty records.
- **Scrolling.** A partly visible box that already has a result for the current epoch is refreshed at most every `config.partialThrottleMs` (80 ms) while the page scrolls.
- **Memory.** Every 2 s `compositor.sweep` frees the canvases of records that have been out of view longer than `config.releaseAfterMs` (4 s). A released record is unsettled, so it is recomputed when it returns.

## Resolver notes

- **Frame cache.** `runAll` wraps its loop in `layers.beginFrame()` / `endFrame()`. Inside it, the paint layers of non-managed elements and the inherited-risk chain (transform, filter, blend mode, backdrop-filter, opacity) of every ancestor are computed once and shared by all boxes. Managed elements are never cached, because their `'lay'` layer changes while the frame is processed.
- **Adaptive probing.** The cell grid is split into blocks of `config.probeBlock` x `config.probeBlock` cells (4 by default). The four corners and the centre of each block are probed; if all five see the same layer stack the block is filled without more calls, otherwise every cell is probed. `probeBlock = 1` probes every cell.
- **Painting.** Neighbouring cells with the same layer stack are painted as one rectangle and identical consecutive rows are merged. Edges are snapped to whole canvas pixels to avoid seams.
- **Reuse.** The estimate canvas lives in `rec.est` and the blur output in `rec.blurCv`. Both are consumed synchronously by the kernel.
- **Blur.** `blur` works on an image reduced by k = 1, 2, 4 or 8 (chosen so the reduced sigma stays at least 2 px), runs three box passes per axis with integer arithmetic, and scales the result back up with bilinear filtering.

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
- Orientation: textures are uploaded with row 0 at the top (`UNPACK_FLIP_Y_WEBGL` false) and the shader measures `y` from the top (`uSize.y - gl_FragCoord.y`). GL itself draws from the bottom-left, so the `w x h` result sits in the lower-left corner of the drawing buffer; in bitmap coordinates (origin top-left) that is `srcRect.y = canvasHeight - h`.
- Sizes: the drawing buffer and the estimate, blur and grid textures only grow (rounded up to 64 px, grid to 16), so nothing is reallocated while boxes of different sizes render in turn. Content goes in with `texSubImage2D`, and the shader scales its UVs with `uTexSize` and `uGridTex`. This is why the result must be copied through `srcRect`.
- Output is premultiplied alpha (`premultipliedAlpha: true`). The CPU path produces straight alpha; both look identical once composited.
- The unknown-cell grid is a `LUMINANCE` texture holding the raw 0/1 bytes of `grid.V` (no copy; the shader multiplies by 255), uploaded with `UNPACK_ALIGNMENT` 1.
- Availability: context creation (`failIfMajorPerformanceCaveat` refuses software renderers), `highp` floats in fragment shaders, shader compilation and linking, any GL error after a draw (checked on the first renders and then every 16th, because `getError` is a synchronous round trip), a working size above `MAX_TEXTURE_SIZE` or `MAX_VIEWPORT_DIMS`, and context loss. Any failure marks the backend unavailable, and the dispatcher (`3000`) falls back to CPU and emits `backend`. A restored context makes WebGL available again.
- Nothing is read back from the GPU, so there are no contrast statistics on this backend.

## Design decisions

- **Layer as a sibling, before the element.** The element keeps its own background, gradient, pseudo-elements and `backdrop-filter`, and that filter blurs the corrected layer together with what is really behind. A child layer would paint over the element's own background and would not be blurred by its `backdrop-filter`.
- **`position: relative` through `:where()`.** A positioned element paints above a static one regardless of DOM order, so a static element's text would end up under the absolute layer. `:where()` has specificity 0, so any `position` the author declares wins.
- **Estimate plus veil, not capture.** The browser exposes no pixels behind an element. The resolver rebuilds an estimate of what it can reproduce and treats the rest as unknown. The veil makes the guarantee hold without knowing the content.
- **Registry for calls, bus for events.** Data in a per-frame pipeline must be synchronous and traceable. The bus would make the flow implicit and asynchronous.
- **j0 kernel as the only dependency.** Bus and registry come from `lib/j0-kernel`, used unchanged. The library never uses `window.j0.logger.log` or `warn`: that logger queues them and prints a misleading timeout after 3 seconds. Warnings travel as `ipax-backdrop:warning`.
- **No APCA.** Not as a plugin either. A JavaScript plugin could not run on the GPU, and the contrast model would then differ between backends.

## Known limits

- The resolver probes a point grid (12 px by default), and on uniform areas only a few samples per block of `probeBlock` x `probeBlock` cells (48 px by default): thin elements between probes can be missed. `probeBlock = 1` restores per-cell probing.
- Elements with `pointer-events: none` are invisible to `elementsFromPoint`, so the resolver cannot see them. Other managed layers are handled through the compositor registry instead.
- Up to 7 differently coloured text runs per element.
- Colours leaving the sRGB gamut after the lightness change are clipped, which can shift hue slightly.
- Stacked managed elements are processed in `z-index` order and, inside the same `z-index`, by distance to the viewport centre (not DOM order). Exotic stacking contexts, or stacked boxes with equal `z-index`, can break the order the layers need.
- An element larger than the viewport, or one that contains other managed elements, is bypassed with a warning.
- The probe only sees the viewport: the part of a box outside it is unknown and gets the veil until the box is fully in view.

---

_IPAX Backdrop v0.1.05 • 2026-11-14 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_