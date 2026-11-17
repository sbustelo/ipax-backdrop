## Procedural Backdrop Generator (`examples/js/example-images.js`)

`examples/js/example-images.js` is a standalone, zero-dependency procedural image generator used by the examples, stress tests, and showcase cards. It renders off-screen `<canvas>` textures and exports them as same-origin `data:image/jpeg` URLs, avoiding external asset dependencies and cross-origin (`tainted` canvas) restrictions in both the WebGL and CPU kernels.

### How It Works

1. **Curated Harmonic Palettes (`PALETTES`):** Bundles 65 multi-stop color palettes (previewing the *IPAX Color System Builder*).
2. **Polymorphic Palette Resolution:** Resolves colors from a custom hex array, a direct integer index, a normalized `[0, 1)` float, `'rand'`, or any string identifier (hashed deterministically via 32-bit FNV-1a).
3. **Deterministic Geometry PRNG:** Paints a diagonal linear gradient across the resolved colors and layers 90 translucent circles (`alpha` `0.35–0.80`, radius scaled to `min(width, height) / 6`) driven by a Park–Miller Lehmer PRNG (`seed = (seed * 16807) % 2147483647`). Separating `palette` from `patternSeed` lets you vary colors and geometry independently.

### Public API (`window.ExampleImages`)

#### `ExampleImages.generate(width, height, palette = 'rand', options = {})`
Generates a texture and returns a `data:image/jpeg` URL string.

* **`width` / `height`** (`number`, default `640` / `480`): Output dimensions in pixels.
* **`palette`** (`string[] | number | string`, default `'rand'`):
  * `string[]` (e.g. `['#8E51FB', '#006277']`): Uses the exact hex colors provided.
  * `number` (integer, e.g. `0`, `14`): Selects a palette by index (wrapped modularly across `paletteCount()`).
  * `number` (float in `[0, 1)`, e.g. `0.42` or `Math.random()`): Maps `Math.floor(value * paletteCount())` onto the catalog.
  * `'rand'`: Picks a random palette internally.
  * `string` (any other string, e.g. `'hero-bg'`): Hashes the string deterministically to always pick the same palette.
* **`options`** (`object`, optional):
  * `colors` (`number | [number, number]`): Limits how many colors are taken from the resolved palette (exact count `N` or random count within `[min, max]`). Defaults to all colors in the palette.
  * `colorOrder` (`'sequential' | 'random'`): Controls whether colors are taken in catalog order or shuffled. Defaults to `'random'` when `palette` is `'rand'` or a `[0, 1)` float, and `'sequential'` otherwise.
  * `patternSeed` (`number | 'rand' | string`, default `'rand'`): Controls the gradient and circle layout independently of color selection. Accepts an integer, a `[0, 1)` float, `'rand'`, or a string hash.
  * `quality` (`number` in `(0, 1]`, default `0.82`): JPEG compression quality passed to `canvas.toDataURL()`.

#### `ExampleImages.paletteCount()`
Returns the total number of palettes in the built-in catalog (`number`).

#### `ExampleImages.getPalette(index)`
Returns a defensive copy (`string[]`) of the palette at `index` (normalized with modular arithmetic).

#### `ExampleImages.generateStylePool(count)`
Generates `count` random `640×480` textures (2–8 shuffled colors each) and injects `.pt-bg-0` through `.pt-bg-{count-1}` CSS rules into `<head>` for high-density grids such as `examples/performance-test.php`.

#### `ExampleImages.paintImage(seed, w, h, cols, quality = 0.82)`
Low-level canvas painter preserved for backwards compatibility.

### Usage Examples

```javascript
// 1. Fully random texture (random palette + random geometry)
const url = ExampleImages.generate(640, 480, 'rand');
element.style.backgroundImage = `url("${url}")`;

// 2. Random palette, capped to 2–6 colors
const cardUrl = ExampleImages.generate(640, 480, 'rand', {
	colors: [2, 6],
	colorOrder: 'random',
	patternSeed: 'rand'
});

// 3. Index-based selection using catalog count
const total = ExampleImages.paletteCount();
const indexedUrl = ExampleImages.generate(800, 400, 12 % total, {
	colors: 4,
	colorOrder: 'sequential',
	patternSeed: 101
});

// 4. Deterministic texture from a semantic key
const stableUrl = ExampleImages.generate(640, 480, 'card-contrast', {
	patternSeed: 'card-contrast'
});

// 5. Custom brand palette with randomized geometry
const customUrl = ExampleImages.generate(640, 480, ['#00364C', '#006277', '#8E51FB']);
```

---

_IPAX Backdrop v0.1.10 • 2026-11-17 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_