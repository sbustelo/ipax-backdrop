# Changelog

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
