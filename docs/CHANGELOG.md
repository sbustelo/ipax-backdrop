# Changelog

## 0.1.13 • 21/nov/2026

- **Unified `j0` architecture, static HTML export, and single-bundle assets (`examples/`, `tooling/`):**
  - Adopted the `j0` framework (`j0/api.php`) across tooling and examples to unify event handling (`j0.bus`), service lookup (`j0.registry`), and client storage (`j0.vfs`) under one shared architecture, removing custom event buses, globals, and bespoke IndexedDB code.
  - Each `.php` example now exports an up-to-date sibling `.html` file whenever any PHP, JS, or CSS source changes, so anyone downloading the repository can open and run the examples directly without a PHP server.
  - Page scripts and styles are automatically concatenated and minified into a single `.min.js` and `.min.css` per example (`?debug=1` bypasses the cache and serves individual unminified files).
  - Uploaded images in the Lucid Glass editor are stored in `j0.vfs` and deduplicated by SHA-256 hash, pruning unused blobs on save and reset.
- **Examples and benchmarks technical debt cleanup:**
  - Replaced prototype shortcuts across the editor and benchmarks with declarative `<template>` cloning, CSS custom properties, and `data-*` hooks.
- **Free `z-index` interleaving and nested glass backgrounds:**
  - Managed backdrop layers are now placed directly before their own wrapper instead of inside a single shared container, allowing glass boxes and normal page elements to interleave at any `z-index`.
  - Stacked glass boxes now capture the internal background of lower glass boxes instead of cutting through to the page background, and raising a box in `z-index` clears stale backdrop footprints underneath.
- **Headless unit test blur coverage:**
  - Added 2D `drawImage()` resampling to the Node canvas harness (`tests/unit.js`) so adaptive downsampled blur (`sigma >= 4`) passes without a browser.

## 0.1.12 • 18/nov/2026

- **Alpha-Aware Stack Cut for Images (`2100-resolutor-capas.js`):**
  - Image layers (`<img>` and `background-image`) now carry `nocut` unless the format is JPEG, read from the file extension or the `data:image/<subtype>` prefix. Previously every image layer with element opacity 1 cut the layer stack below it, so the transparent pixels of PNG, WebP, SVG or GIF were composited over the page base color instead of the content actually underneath. A URL with no extension (e.g. `/photo?id=3`) counts as non-JPEG.
- **Veil for Animated GIF (`2100-resolutor-capas.js`):**
  - A `.gif` file (or `data:image/gif`) used as `<img>` or `background-image` is now marked unknown with reason `animated image`, so it receives the translucent veil. Previously the engine drew only its first frame. Not detected: GIFs served from `blob:` URLs without an extension, animated PNG, animated WebP and animated AVIF.
- **Veil for `<video>` (`2100-resolutor-capas.js`):**
  - A `<video>` element is now marked unknown with reason `video`. Previously it was ignored and the engine rendered whatever was behind it.


## 0.1.11 • 17/nov/2026

- **Fair frame scheduling under heavy animation:**
  - Dirty elements are now ordered by last render timestamp while preserving local `z-index` and DOM paint order between overlapping boxes. Previously, continuous animations that exceeded the 12 ms frame budget could starve lower-order boxes.
  - Elements waiting on a high-resolution image (`waitImg`) jump to the front of the queue as soon as the image decodes.
- **Per-element probe resolution via CSS:**
  - Added `--ipax-backdrop-cellsize` support so individual elements can override the global DOM probe grid step through CSS custom properties.
- **Motion and long-page benchmark suite (`examples/`):**
  - Renamed the 400-element stress test to `examples/performance-longpage.php` with optional background panning and image swapping, and added `examples/performance-motion.php` to measure isolated vs. simultaneous presets, text mutations, box motion, and CSS cross-fade desync.
  - Both benchmarks share a live HUD and a `<dialog>` background pool manager supporting procedural textures and local user images via `blob:` URLs.


## 0.1.10 • 16-17/nov/2026
_The jump in version number reflects the depth of rendering and API changes_
- **Independent container and glyph-contour CSS API (`--ipax-backdrop`, `--ipax-text`, `--ipax-mode`):**
  - Split container contrast/blur (`--ipax-backdrop`) and text-contour contrast/blur (`--ipax-text`) into separate CSS families with shorthand and longhand cascade support, sharing `--ipax-mode` (`default` and `tricontrast`).
  - Added APCA `Lc` input parsing (`90Lc` or bare numbers `> 15`), emitting a `warning` and mapping to an equivalent WCAG 2 ratio (`1..15:1`) until native APCA licensing is enabled.
- **Per-word glyph contour mask (`--ipax-text`):**
  - Replaced the rectangular line-box halo of `0.1.06` with a glyph-fitted mask measured per word via `Range.getClientRects()` and `TextMetrics`, eliminating hard boxes around text.
  - Supports `x`/`y` offsets, `halo` diffusion radius, dual-unit `spread` (`%` plateau inside `halo` or `px` dilation outside `halo`), and per-glyph background `blur`.
- **Single-pass blur and sequential OKLab solving:**
  - Container mask `M_b` and glyph mask `M_g` combine via screen union (`M_b + M_g - M_b * M_g`), run one shared blur pass at `max(box-blur, text-blur)`, and transition lightness `L0 -> L1 -> L2` across both CPU and WebGL backends.
  - Short-circuits container math and outside-glyph pixel work when `--ipax-backdrop` is inactive (`--ipax-text`-only mode).
- **Coarse-to-fine DOM probing and scroll convergence:**
  - Evaluates a 3×3 coarse grid across the active region before subdividing into blocks, ignores `position: fixed` overlays above the element's `z-index`, and flushes throttled boxes 130 ms after scrolling stops.
- **Lucid Glass editor inspector updates:**
  - Added a `Position` (`X`, `Y`, `W`, `H`) panel, collapsible sections, independent toggles for `--ipax-backdrop` and `--ipax-text`, font load-source status icons, horizontal label scrubbing, and delegated tooltips.

## 0.1.06 • 15/nov/2026

- **Initial Text-Halo Prototype & Euclidean Feathering:**
  - Introduced an early line-box `--ipax-backdrop-text-halo` prototype (superseded in `0.1.10` by the glyph-calibrated `--ipax-text` contour engine).
- **Performance & Local Text Invalidation:**
  - Skips DOM probing and kernel solving on cells/pixels outside both the element box and the active halo mask.
  - Extends `MutationObserver` to `characterData` so editing text inside an existing box invalidates only that element locally instead of bumping the global epoch.
  - Packs WebGL shader uniforms into `vec4` arrays to reduce uniform slot consumption, and adds `stages.read` and `halo: { ext, reach }` to the `ipax-backdrop:updated` payload.
- **Euclidean Box Feathering:**
  - Replaces the L∞ (`min`) edge ramp calculation in both CPU (`3100`) and WebGL (`3210`) kernels with normalized Euclidean distance, eliminating diagonal diamond ridges and producing smooth circular/elliptical corner falloffs while preserving sharp 90° edges on sides with `feather: 0`.
- **Viewport-Edge Probe Fix:**
  - Clamps DOM probe coordinates at viewport boundaries so elements positioned slightly past an edge (e.g. `y = -1`) do not mark boundary cells as unknown and bleed a dark gradient veil into the visible area.

## 0.1.05 • 14/nov/2026

- **Startup & Invalidation Overhaul (fewer redundant passes):**
  - `ResizeObserver` no longer emits `invalidate` for its mandatory initial notification, nor for sub-pixel changes (threshold: 0.5 px). Previously every managed element was recomputed twice at startup.
  - Replaces the per-record "unsettle" loop with an **epoch counter**. `invalidate`, `resize`, `refresh()` and font loads bump the epoch, and any record whose epoch is stale is recomputed the next time it is visible. This fixes a bug where boxes that were off-screen during a change (e.g. a contrast slider) kept their old result when scrolled back into view.
  - `image-loaded` now invalidates only the records that were drawn while an image was still loading (`rec.waitImg`), instead of every record.
  - `document.fonts.ready` only triggers an invalidation if fonts were actually still loading.
  - A partially visible box now stays unsettled until it is fully in view, even if it had settled in an older epoch (otherwise the veil over its previously clipped area could persist).
  - Records bypassed for oversize, nested managed elements or invalid parameters now settle instead of being re-evaluated on every scroll frame.
- **Adaptive DOM Probing:**
  - The resolver splits the probe grid into blocks of `probeBlock` × `probeBlock` cells (default 4). The four corners and the centre of each block are probed; if all five see the same layer stack the block is filled without further calls, otherwise every cell is probed as before.
  - By construction, a uniform block costs about 2 probes per 16 cells instead of 16 (block corners are shared with the neighbouring blocks).
  - Trade-off: a feature smaller than a block (48 px with the default cell size) that touches none of the five samples can be missed. `config.probeBlock = 1` restores exact per-cell probing.
  - Identical consecutive rows are merged, so a uniform box is painted as one rectangle instead of one per row.
  - `stats.probes` reports the number of `elementsFromPoint` calls per resolve.
- **Layout Thrashing Elimination:**
  - `compositor.place()` is split into `measure(rec)` (read) and `apply(rec, m)` (write). The orchestrator runs all reads, then all writes, then all reads, forcing one layout per frame instead of one per record. `apply()` skips style writes when geometry did not change. `place()` remains as a shortcut.
  - `clear()` and `draw()` only touch `backdropFilter` when the value changes.
- **Per-Frame Style Cache:**
  - New `layers.beginFrame()` / `endFrame()`. Inside a frame, `layersOf()` descriptors of non-managed elements and the inherited-risk chain (transform, filter, blend mode, backdrop-filter, opacity) of every ancestor are computed once and shared by all boxes. Managed elements are never cached.
  - The orchestrator also caches `z-index` lookups per frame.
- **Memory & Allocation:**
  - The estimate canvas is reused per record (`rec.est`) and the blur output canvas is reused per record (`rec.blurCv`) instead of being created on every update. The blur function takes the record as an optional fifth argument.
  - The layer signature is built incrementally, without `map().join()` per cell.
  - New `compositor.release(rec)` and `compositor.sweep(visibleSet, ttlMs)` free the canvases of boxes that have been out of view longer than `releaseAfterMs`. A released record is recomputed when it returns.
- **Blur Pipeline:**
  - Adaptive downsampling: large blurs run on an image reduced by k = 2, 4 or 8 (chosen so the reduced sigma stays ≥ 2 px) and are scaled back with bilinear filtering, so the blur passes touch k² times fewer pixels (16× fewer for k = 4). Sigmas under 4 px run at full resolution as before.
  - Scratch planes are `Uint8Array` instead of `Uint32Array` (4× less memory traffic), and the per-pixel division is replaced by a fixed-point multiply and shift.
  - New `blur.factor(sigma)` exposes the downsampling factor.
- **WebGL Backend (no reallocation while sizes vary):**
  - The shared drawing buffer only grows (rounded up to 64 px). Each render uses the lower-left `w × h` corner and returns `result.srcRect`, and `compositor.draw()` copies only that rectangle. This needs the 4000 compositor from this version.
  - Estimate, blur and grid textures only grow and are filled with `texSubImage2D`. The shader receives their allocated sizes through the new `uTexSize` and `uGridTex` uniforms.
  - The unknown grid is uploaded directly as 0/1 bytes, with no per-render copy.
  - Samplers, vertex attribute, pixel-store state and the program are set once, and uniform arrays are preallocated.
  - `gl.getError()` is a synchronous GPU round trip, so it now runs on the first renders and then every 16th. Context loss is still handled through its event.
  - Rejects working sizes above `MAX_TEXTURE_SIZE` / `MAX_VIEWPORT_DIMS` explicitly, and the dispatcher falls back to the CPU kernel.
- **Scroll Scheduling:**
  - While scrolling, partially visible boxes that already have a result for the current epoch are refreshed at most every `partialThrottleMs` (default 80 ms) instead of every frame.
  - The frame time budget is configurable with `config.frameBudgetMs` (default 12 ms).
- **Diagnostics:**
  - The `ipax-backdrop:updated` payload now includes `stages: { resolve, blur, kernel, draw }` in ms, and `resolver.probes`.
- **Backend Parity:**
  - The WebGL shader decides bypass with the same test as the CPU kernel (`contrast.isBypass`, ratio ≤ 1) through a new `uBypass` uniform. Before, WebGL applied a 1.05 threshold on the solver ratio, so ratios between 1 and ~1.037 differed between backends.
- **New JavaScript configuration keys** (not CSS properties): `probeBlock` (4), `partialThrottleMs` (80), `frameBudgetMs` (12), `releaseAfterMs` (4000).
- **Upgrade notes:**
  - Deploy `0200`, `2000`, `2100`, `2300`, `3200`, `3210` and `4000` together. The WebGL backend returns a canvas larger than the result plus `result.srcRect`, which only the new compositor understands, and the orchestrator uses `layers.beginFrame()`, `compositor.measure()` / `apply()` and the new `blur` signature.
  - A custom kernel that returns a canvas larger than `w × h` must provide `srcRect`. Kernels that return exactly `w × h` need no change.
  - `resolver.resolve()` returns a reused canvas: consume `est` before the next call for the same record.
  - The default `probeBlock = 4` can miss a feature smaller than 48 px that none of the five samples of a block touches. Set `config.probeBlock = 1` for the previous behaviour.


## 0.1.04 • 13/nov/2026

- **Adaptive resolution controller:**
  - Replaced the static `maxPixels` cap with a per-element resolution scaler driven by `--ipax-backdrop-performance` (target FPS) and `--ipax-backdrop-budget-min` (minimum pixel floor, default 65536). Working resolution scales up toward `devicePixelRatio` while staying within frame budget, tracking fixed DOM probe time separately from pixel throughput.
- **Viewport-aware scheduling:**
  - Replaced the global scroll listener with an `IntersectionObserver` so off-screen elements do not consume frame budget.
- **CSS custom property configuration:**
  - Added `--ipax-backdrop-performance`, `--ipax-backdrop-budget-min`, `--ipax-backdrop-backend`, `--ipax-backdrop-cellsize`, and `--ipax-backdrop-maxpixelscale` so engine settings follow the CSS cascade per element.
- **Sub-pixel alignment and bypass parity:**
  - Snapped canvas translation to integer coordinates at 1:1 scale to prevent resampling softness, enabled `willReadFrequently: true` on 2D canvases, and zeroed out the unknown-area veil in CPU bypass mode (`contrast <= 1`) to match WebGL.
- **Lucid Glass editor and 400-box stress test (`examples/`):**
  - Added the visual editor with multi-box layout, TRBL feathering, rich text, Google Fonts loading, binary image deduplication in IndexedDB, `.zip` project export/import, and PNG stage capture.
  - Added the 400-element viewport stress test with static HTML caching and procedural textures previewing the upcoming *IPAX Color System Builder* palettes.

## 0.1.03 • 11/nov/2026

- **Integrated feathered blur:** `--ipax-backdrop-blur` defines a spatial blur to be applied by the rendering pipeline. Blur radius is modulated by the directional feather mask ($M$) to allow smooth gradual defocus towards edges. Contrast 1 bypasses OKLab solving, transforming the engine into a _linear blur utility._
- **Global Scope Isolation:** Refactored 01-bus-j0kernel.js (EventChannel) and 02-core-j0kernel.js to prevent fatal collision errors when using multiple concatenated bundles of the library.
- **Build-time GLSL minification**: Added a micro-parser to build-ipax-backdrop-js.php that minifies the WebGL shader string (stripping comments and collapsing whitespace while preserving preprocessor directives). The bundler safely targets the GLSL template literal by looking for the /* glsl-minifier-start */ and /* glsl-minifier-end */ markers inside 3210-kernel-webgl-shaders.js.
- Improved examples.

## 0.1.02 • 10/nov/2026

- Directional feathering: `--ipax-backdrop-feather` now behaves as a standard CSS TRBL shorthand (supporting 1, 2, 3, and 4 values).
- Added directional longhands: `--ipax-backdrop-feather-top`, `--ipax-backdrop-feather-right`, `--ipax-backdrop-feather-bottom`, and `--ipax-backdrop-feather-left` with strict cascade override precedence.
- Updated CPU kernel and WebGL shaders to enforce full mathematical parity on independent edge feathering.
- Updated example: sliders are synchronized to number inputs, and the grouped "feather" syncs with the 4 independent ones.

## 0.1.01 • 10/nov/2026

- Added /tooling: `build-ipax-backdrop-js.php`. Concatenates and minifies JS in lib/ and src/ , exports in dist/ ipax-backdrop.js and (if everything goes right) ipax-backdrop.min.js.
- Fixed banding on Chrome and Firefox.
- examples/ uses minified JS.

## 0.1.0 (initial release) • 9/nov/2026

- CSS API: `--ipax-backdrop-contrast`, `--ipax-backdrop-feather`, `--ipax-backdrop-mode` (`default` and `tricontrast`).
- WCAG 2.x contrast only. APCA is deliberately not part of this version.
- Pipeline in five stages (reader, resolver, kernel, compositor, orchestrator), each a service registered in the j0 kernel registry.
- Two interchangeable kernel backends: WebGL 1 (one shared context) and CPU, with automatic fallback.
- Estimation of what is underneath an element from colour backgrounds, `url()` background images, `<img>` elements and other managed layers. Anything it cannot reproduce is flagged unknown and covered by a translucent veil computed for the worst case.
- Text runs with another colour get their own correction, blended with their neighbours.
- Events on the j0 bus: `ready`, `updated`, `backend`, `warning`, `error`, `image-loaded`, `invalidate`.
- Example page with draggable boxes and picture upload.
- Verified so far: unit checks of the pure services and of the CPU kernel (including contrast on 8-bit output), CPU versus WebGL parity on a headless WebGL 1 context (maximum difference of 1 level per channel), and the example page running in Chromium. No automated test suite is in the repository yet.

---

## Future / Planned Architecture

- **Unified CPU/GPU Mathematical Kernel via JSOL:**
  - Create a target for GLSL ES 1.00 (`targets/glsl`) in the JSOL compiler ecosystem.
  - Migrate OKLab color conversions, contrast evaluation, and binary search solvers to a single `.jsol` SSOT.
  - Transpile deterministically to JavaScript (for `3100-kernel-cpu.js`) and GLSL fragment functions (for `3210-kernel-webgl-shaders.js`), eliminating mathematical drift between backends.
- **Blur on the GPU:**
  - Move the box blur to two separable WebGL passes, which also removes the `getImageData` readback of the estimate on the GPU path.
- **CPU versus GPU parity test (`test/`):**
  - Include consecutive renders of different sizes to cover the growing GL buffer and textures.

---

_IPAX Backdrop & IPAX Text (Lucid Glass) v0.1.13 • 2026-11-21 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_