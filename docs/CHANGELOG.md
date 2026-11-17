# Changelog

## 0.1.11 • 17/nov/2026

- **Starvation-Free Round-Robin Frame Scheduler (`0200-orquestador.js`):**
  - Orders dirty records by last render timestamp (`renderedAt`) while preserving `z-index` and DOM paint order locally between overlapping boxes (`rectsOverlap`), preventing lower-order visible boxes from starving when continuous animations invalidate more elements than fit within `config.frameBudgetMs` (`12 ms`).
  - Resets `renderedAt = 0` when `image-loaded` reopens records flagged with `rec.waitImg`, prioritizing freshly decoded high-resolution images on the next frame.
- **Per-Element `--ipax-backdrop-cellsize` Wiring (`0200-orquestador.js`):**
  - Uses each element's resolved `params.cellSize` (falling back to `config.cellSize`) when computing the adaptive DOM probe grid step, enabling independent probe granularity overrides via CSS custom properties.
- **Performance Benchmark Suite (`examples/performance-longpage.php`, `examples/performance-motion.html`):**
  - Renamed the existing 400-element stress test (`performance-test.php`) to `examples/performance-longpage.php`, introducing optional background panning and image swapping workloads.
  - Adds a new benchmark (`examples/performance-motion.html`) testing simultaneous vs. isolated presets, text mutations, box motion, and CSS cross-fade desync behavior.
  - Shared HUD telemetry, pan/swap timing, an extensible top-level benchmark selector, and a native `<dialog>` background image pool manager (`examples/js/performance-common.js`) supporting both generated textures and local user-uploaded images via zero-copy `blob:` URLs.


## 0.1.10 • 16-17/nov/2026

- **Decoupled Dual-Family CSS API (`--ipax-backdrop`, `--ipax-text`, `--ipax-mode`):**
  - Splits container contrast/blur (`--ipax-backdrop`) and glyph-contour contrast/blur (`--ipax-text`) into independent, composable CSS families with shorthand + longhand cascade support and a shared `--ipax-mode` (`default | tricontrast`) property.
  - Supports explicit WCAG ratios (`4.5` or `4.5:1`) as well as APCA `Lc` inputs (`90Lc` or bare numbers `> 15`), emitting a `warning` and applying a perceptual power-law WCAG fallback (`1..15:1`, anchored to `#272727` black-level saturation) until APCA licensing is enabled.
- **Calibrated Per-Word Glyph Contour Mask (`--ipax-text`):**
  - Replaces the rectangular line-box halo of `0.1.06` with a glyph-fitted mask rasterized per word via `Range.getClientRects()`, `TextMetrics` width/baseline calibration, and `devicePixelRatio` scaling, eliminating hard boxes around text.
  - Supports `x` and `y` offsets, `halo` diffusion radius, dual-unit `spread` (`%` internal plateau within `halo` or `px` additive dilation outside `halo` like `box-shadow`), and per-glyph background image `blur`.
- **Unified Single-Pass Blur & Sequential OKLab Composition:**
  - Composes container mask $M_b$ and glyph mask $M_g$ via screen union $M_{\text{screen}} = M_b + M_g - M_b M_g$, executes a single background blur pass at $R_{\max} = \max(\text{box-blur}, \text{text-blur})$, and transitions lightness continuously $L_0 \xrightarrow{M_{\text{screen}}} L_1 \xrightarrow{M_g} L_2$ across both CPU (`3100`) and WebGL (`3200`/`3210`) kernels.
  - Short-circuits container distance math and outside-glyph pixel work when `--ipax-backdrop` is inactive (`--ipax-text`-only mode).
- **Coarse-to-Fine 3×3 Hierarchical Probing & Scroll Convergence (`2000-resolutor.js`, `0200-orquestador.js`):**
  - Evaluates a 3×3 coarse grid (9 samples) across the active region before subdividing into `probeBlock` × `probeBlock` blocks (using 4 shared corner probes per block instead of 5), scales `localStep` smoothly on large elements, and memoizes `ownerRecord` and `position: fixed` ancestor checks per resolve.
  - Excludes `position: fixed` overlays above the element's `z-index` from hit-testing and adds a 130 ms `scrollEndTimer` flush so throttled boxes converge cleanly once scrolling stops.
- **Lucid Glass Editor Inspector Refinement (`examples/editor.html`):**
  - Adds a single-row `Position` (`X`, `Y`, `W`, `H`) panel, collapsible panel carets, independent enable/collapse toggles for `Container (--ipax-backdrop)` and `Glyph Contour (--ipax-text)`, Material Symbols iconography with font load-source status, horizontal label scrubbing, and instant delegated tooltips.

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

- **Dynamic Performance-Driven Frame Budget (Dual-Clock Controller):**
  - Replaces the static pixel cap (maxPixels: 60000) with an adaptive per-element resolution controller.
  - Authors set the minimum acceptable pixel floor via --ipax-backdrop-budget-min (or config.minBudget, default 65536), and the orchestrator dynamically stretches working resolution up to min(maxPixelScale, devicePixelRatio) to maximize visual quality within the target frame time (1000 / performance) / visibleCount.
  - Tracks fixed DOM probing time (probeMs in resolver) and variable pixel throughput (px/ms) via separate exponential moving averages (EMAs), preventing fixed DOM overhead from collapsing resolution down to minBudget.
  - Exposes the resolved per-frame budget { s, w, h } in the ipax-backdrop:updated event payload.
- **Viewport-Aware Scheduling (IntersectionObserver):**
  - Replaces the global scroll listener with an IntersectionObserver, processing and dividing the frame time budget strictly across elements visible in or approaching the viewport.
- **Expanded CSS Configuration API:** Engine configuration can now be controlled and overridden per element via CSS custom properties honoring the cascade:
  - --ipax-backdrop-performance: target frame rate in fps (e.g., 60fps, 60, or 0 / none / infinite to disable adaptive scaling; default 60).
  - --ipax-backdrop-budget-min: minimum pixel budget floor (default 65536: 256 x 256).
  - --ipax-backdrop-backend: per-element rendering backend override (auto, webgl, cpu).
  - --ipax-backdrop-cellsize: DOM probe grid step in pixels (default 12).
  - --ipax-backdrop-maxpixelscale: upper pixel scale multiplier relative to devicePixelRatio (default 2).
- **Resolver, Blur & CPU Kernel Parity Improvements:**
  - Snaps canvas translation to integer coordinates (-Math.round(R.left), -Math.round(R.top)) when rendering at native 1:1 scale (s === 1) to avoid sub-pixel resampling blur.
  - Configures willReadFrequently: true on internal 2D estimation and blur canvases to accelerate frequent getImageData readbacks.
  - Fixes kernel-cpu bypass mode (contrast <= 1) to zero out unknown-area veil opacity, matching WebGL shader output in pure linear-blur mode.
- **Lucid Glass Editor (examples/editor.html) & Stress Test:**
  - Complete visual editor built on a modular JS/CSS architecture with a contextual inspector.
  - Multi-box layout controls: create, drag, 8-handle resize, Alt+Drag / button duplication, z-index stacking, and border guides toggle.
  - Real-time per-box controls for mode (default / tricontrast), contrast, blur, and grouped/individual TRBL feathering.
  - Unified Stage and Box background system supporting Solid Colors, Gradients, and Images (drag-and-drop, fit modes, box opacity).
  - Inline rich-text formatting, horizontal/vertical alignment, TRBL padding, system font stacks, and on-demand Google Fonts loading (restored automatically with saved projects).
  - Zero-Base64 binary image pipeline (Blob + ObjectURL deduplication), IndexedDB auto-save with storage footprint footer (Purge / Reset), .zip project packaging, and PNG stage export (lucid-glass-stage.png, with Region Capture detection and non-Chromium warning).
  - Added 400-element viewport stress test (examples/performance-test.php with static HTML caching and shared texture pool in examples/js/example-images.js) and live telemetry HUD.
  - **Examples**: Harmonic palettes used for procedural texture generation preview the upcoming *IPAX Color System Builder* project.

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

_IPAX Backdrop & IPAX Text (Lucid Glass) v0.1.11 • 2026-11-17 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_