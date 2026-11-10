# Changelog

## 0.1.02

- Directional feathering: `--ipax-backdrop-feather` now behaves as a standard CSS TRBL shorthand (supporting 1, 2, 3, and 4 values).
- Added directional longhands: `--ipax-backdrop-feather-top`, `--ipax-backdrop-feather-right`, `--ipax-backdrop-feather-bottom`, and `--ipax-backdrop-feather-left` with strict cascade override precedence.
- Updated CPU kernel and WebGL shaders to enforce full mathematical parity on independent edge feathering.
- Updated example: sliders are synchronized to number inputs, and the grouped "feather" syncs with the 4 independent ones.

## 0.1.01

- Added /tooling: `build-ipax-backdrop-js.php`. Concatenates and minifies JS in lib/ and src/ , exports in dist/ ipax-backdrop.js and (if everything goes right) ipax-backdrop.min.js.
- Fixed banding on Chrome and Firefox.
- examples/ uses minified JS.

## 0.1.0 (initial release)

- CSS API: `--ipax-backdrop-contrast`, `--ipax-backdrop-feather`, `--ipax-backdrop-mode` (`default` and `tricontrast`).
- WCAG 2.x contrast only. APCA is deliberately not part of this version.
- Pipeline in five stages (reader, resolver, kernel, compositor, orchestrator), each a service registered in the j0 kernel registry.
- Two interchangeable kernel backends: WebGL 1 (one shared context) and CPU, with automatic fallback.
- Estimation of what is underneath an element from colour backgrounds, `url()` background images, `<img>` elements and other managed layers. Anything it cannot reproduce is flagged unknown and covered by a translucent veil computed for the worst case.
- Text runs with another colour get their own correction, blended with their neighbours.
- Events on the j0 bus: `ready`, `updated`, `backend`, `warning`, `error`, `image-loaded`, `invalidate`.
- Example page with draggable boxes and photo upload.
- Verified so far: unit checks of the pure services and of the CPU kernel (including contrast on 8-bit output), CPU versus WebGL parity on a headless WebGL 1 context (maximum difference of 1 level per channel), and the example page running in Chromium. No automated test suite is in the repository yet.

---

## Future / Planned Architecture

- **Integrated Gradual Blur:**
  - Internalize spatial blur into the rendering pipeline rather than solely relying on global CSS `backdrop-filter: blur(...)`.
  - Modulate blur radius with the directional feather mask ($M$) to allow smooth gradual defocus towards edges.
  - Add bypass mode on `--ipax-backdrop-contrast: 1` to skip OKLab lightness solving, transforming the engine into a zero-cost gradual/linear blur utility.
  - Multi-pass FBO ping-pong pipeline planned for WebGL to preserve high framerates during variable convolution.

- **Unified CPU/GPU Mathematical Kernel via JSOL:**
  - Create a target for GLSL ES 1.00 (`targets/glsl`) in the JSOL compiler ecosystem.
  - Migrate OKLab color conversions, contrast evaluation, and binary search solvers to a single `.jsol` SSOT.
  - Transpile deterministically to JavaScript (for `3100-kernel-cpu.js`) and GLSL fragment functions (for `3210-kernel-webgl-shaders.js`), eliminating mathematical drift between backends.
---

_IPAX Backdrop v0.1.02 • 2026-11-10 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_