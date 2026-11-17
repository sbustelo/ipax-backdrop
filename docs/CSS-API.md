# CSS API

ipax-backdrop is configured with CSS custom properties read via `getComputedStyle`, honoring the standard CSS cascade, inheritance, media queries, and inline styles.

```css
/* Container backdrop + glyph-contour protection */
.card {
  --ipax-mode: default;                    /* shared solver mode: default | tricontrast */
  --ipax-backdrop: 3:1 8px 16px;           /* container: contrast | blur | feather */
  --ipax-text: 0px 1px 12px 35% 7:1 6px;   /* glyphs: offset-x | offset-y | halo | spread | contrast | blur */
}

/* Standalone headline directly over a photo (no container box) */
.hero-title {
  --ipax-text: 0px 0px 14px 7:1 6px;       /* offset-x | offset-y | halo | contrast | blur */
}
```

## 1. Container Properties (`--ipax-backdrop`)

Provides selective OKLab lightness adaptation, background blur, and directional inward edge feathering on an underlying sibling layer (`<ipax-backdrop-layer>`), eliminating the need for solid `background` overlays or uniform `backdrop-filter` boxes while leaving any author-declared `background` or `backdrop-filter` untouched.

| Property | Values | Default | Meaning |
|---|---|---|---|
| `--ipax-backdrop` | `<contrast> && [ <blur> <feather>{1,4}? ]? && <mode>?` | none | Shorthand for container contrast, background blur, inward TRBL feathering, and mode. |
| `--ipax-backdrop-contrast` | `<number>` (`1..15`), `<number>:1`, or `<number>Lc` (fallback) | `4.5` (or `1` if only `--ipax-text` is set) | Minimum WCAG 2.x contrast ratio inside the container. Set to `1` to bypass lightness adaptation. |
| `--ipax-backdrop-blur` | `<length>` (`px`, `em`, `rem`, or unitless) | `0px` | Gaussian defocus applied to the underlying image, modulated by `screen(Mb, Mg)`. |
| `--ipax-backdrop-feather` | `1` to `4` `<length>` values (TRBL) | `0px` | Soft inward edge ramp from the element border using Euclidean corner distance. |
| `--ipax-backdrop-feather-top` | `<length>` | inherited | Directional override for top edge feathering. |
| `--ipax-backdrop-feather-right` | `<length>` | inherited | Directional override for right edge feathering. |
| `--ipax-backdrop-feather-bottom` | `<length>` | inherited | Directional override for bottom edge feathering. |
| `--ipax-backdrop-feather-left` | `<length>` | inherited | Directional override for left edge feathering. |
| `--ipax-backdrop-mode` | `default`, `tricontrast` | inherits `--ipax-mode` | Local solver mode override for the container. |

## 2. Glyph-Contour Properties (`--ipax-text`)

Applies a calibrated mask fitted to each rendered word's glyph contours—compressing competing highlights/shadows and defocusing high-frequency background detail behind the letters—as a contrast-driven alternative to `text-shadow` without overriding author-declared text shadows.

| Property | Values | Default | Meaning |
|---|---|---|---|
| `--ipax-text` | `<x> <y> <halo> [<spread%>] && <contrast> && [ <blur> [<spread-px>] ]? && <mode>?` | none | Shorthand for glyph-contour contrast and background defocus. |
| `--ipax-text-x` | `<length>` | `0px` | Horizontal offset of the glyph mask. |
| `--ipax-text-y` | `<length>` | `0px` | Vertical offset of the glyph mask. |
| `--ipax-text-halo` | `<length>` | `0px` | Soft diffusion radius around the glyph contour. |
| `--ipax-text-spread` | `<percentage>` (`0%..100%`) or `<length>` (`px`, `em`, `rem`) | `0px` | `%` reserves an inner plateau within `halo`; `<length>` dilates the solid glyph stroke outward before `halo` fades (`box-shadow` semantics). |
| `--ipax-text-contrast` | `<number>` (`1..15`), `<number>:1`, or `<number>Lc` (fallback) | `1` | Minimum WCAG 2.x contrast ratio along the glyph contour. |
| `--ipax-text-blur` | `<length>` | `0px` | Gaussian defocus applied to the underlying image behind the glyph mask. |
| `--ipax-text-mode` | `default`, `tricontrast` | inherits `--ipax-mode` | Local solver mode override for the glyph contour. |

## 3. Shared Mode & Engine Properties

| Property | Values | Default | Meaning |
|---|---|---|---|
| `--ipax-mode` | `default`, `tricontrast` | `default` | Shared OKLab solver mode for both `--ipax-backdrop` and `--ipax-text` unless overridden locally. |
| `--ipax-backdrop-backend` | `auto`, `webgl`, `cpu` | `auto` | Kernel backend selection (`auto` uses WebGL 1 and falls back to CPU). |
| `--ipax-backdrop-cellsize` | `<length>` (`px` or unitless) | `12` | Probe grid resolution in CSS pixels for sampling elements underneath. |
| `--ipax-backdrop-performance` | `<number>` (`0` or target FPS) | `60` | Target FPS for the dynamic frame budget (`0` disables throttling). |
| `--ipax-backdrop-budget-min` | `<number>` (pixels) | `65536` | Minimum working pixel budget guaranteed per element. |
| `--ipax-backdrop-maxpixelscale` | `<number>` | `2` | Ceiling for HiDPI (`devicePixelRatio`) working resolution scale. |

## Contrast Units & APCA Fallback

- **WCAG 2.x (`1` to `15`, or `1:1` to `15:1`):** Native contrast target. Above `15:1` (`#272727` vs `#ffffff`), perceptual contrast saturates at `106 Lc` while higher WCAG ratios collapse image chrominance toward pure black/white.
- **APCA (`<number>Lc` or unitless `> 15`):** Accepted in CSS for forward compatibility. While APCA is disabled due to licensing, the reader emits a `warning` event and converts `|Lc|` (`0..106`) to an equivalent WCAG ratio (`1..15:1`) via perceptual luminance inversion:
  $$u = \min(1, |L_c| / 106), \quad Y_{\text{eq}} = 0.02 + 0.98(1 - u)^{1.5}, \quad R_{\text{eq}} = \frac{1.05}{Y_{\text{eq}} + 0.05}$$

## 4. Detailed Examples

### Container Backdrop: Longhands vs. Shorthand

```css
/* Explicit longhands (recommended when overriding individual properties in cascade) */
.panel-explicit {
  --ipax-backdrop-contrast: 4.5;     /* WCAG 2.x target ratio (1..15, or 4.5:1) */
  --ipax-backdrop-blur: 10px;        /* underlying backdrop blur radius (default: 0px) */
  --ipax-backdrop-feather: 14px;     /* inward edge ramp from border in px (default: 0px) */
  --ipax-backdrop-mode: default;     /* default | tricontrast */
}

/* Equivalent shorthand */
.panel-shorthand {
  /* contrast | blur | feather | mode */
  --ipax-backdrop: 4.5:1 10px 14px default;
}

/* Minimal shorthand (contrast only; blur and feather default to 0px) */
.panel-contrast-only {
  --ipax-backdrop: 4.5:1;
}
```

### Directional Feathering (TRBL Shorthand & Cascade Overrides)

`--ipax-backdrop-feather` accepts 1 to 4 lengths following standard CSS TRBL order (`top`, `right`, `bottom`, `left`), and directional longhands override individual edges:

```css
/* 1 value: all four edges */
.feather-all {
  --ipax-backdrop-feather: 16px;
}

/* 2 values: top/bottom | right/left */
.feather-axes {
  --ipax-backdrop-feather: 12px 24px;
}

/* 3 values: top | right/left | bottom */
.feather-three {
  --ipax-backdrop-feather: 8px 20px 48px;
}

/* 4 values: top | right | bottom | left */
.feather-four {
  --ipax-backdrop-feather: 8px 16px 32px 16px;
}

/* Shorthand + directional longhand override */
.hero-top-bar {
  --ipax-backdrop-contrast: 3.5;
  --ipax-backdrop-blur: 12px;
  --ipax-backdrop-feather: 0px;          /* sharp top, left, and right edges */
  --ipax-backdrop-feather-bottom: 96px;  /* smooth 96px fade along the bottom edge */
}

.sidebar-drawer {
  --ipax-backdrop: 4.5:1 8px 20px;       /* 20px feather on all sides */
  --ipax-backdrop-feather-left: 0px;     /* flush hard cut against the left viewport edge */
}
```

### Gradual Linear Blur Without Lightness Change (Bypass Mode)

Setting `--ipax-backdrop-contrast: 1` (or `1:1`) short-circuits the OKLab contrast solver so the engine acts purely as a feathered spatial blur:

```css
.frosted-vignette {
  --ipax-backdrop-contrast: 1;       /* bypass lightness adaptation */
  --ipax-backdrop-blur: 16px;        /* Gaussian blur radius */
  --ipax-backdrop-feather: 32px;     /* blur fades smoothly to 0px at the element border */
}
```

### Glyph-Contour Protection (`--ipax-text`): Longhands & Shorthand

```css
/* Explicit longhands for per-word glyph contour protection */
.caption-explicit {
  --ipax-text-x: 0px;                /* horizontal mask offset */
  --ipax-text-y: 1px;                /* vertical mask offset */
  --ipax-text-halo: 14px;            /* soft diffusion radius around each glyph */
  --ipax-text-spread: 35%;           /* inner full-strength plateau inside halo (0%..100%) */
  --ipax-text-contrast: 7;           /* WCAG 2.x ratio along glyph contours (7:1 = AAA) */
  --ipax-text-blur: 6px;             /* background defocus behind the glyph mask */
  --ipax-text-mode: default;         /* default | tricontrast */
}

/* Equivalent shorthand */
.caption-shorthand {
  /* offset-x | offset-y | halo | spread | contrast | blur | mode */
  --ipax-text: 0px 1px 14px 35% 7:1 6px default;
}

/* Outward stroke dilation using a px spread instead of % */
.headline-bold-contour {
  /* offset-x | offset-y | halo | contrast | blur | spread-px */
  --ipax-text: 0px 0px 10px 7:1 4px 3px;   /* 3px solid contour dilation + 10px soft falloff */
}
```

### Combined Container + Glyph Contour & Tricontrast Mode

```css
/* Two-stage protection: gentle container lift + high-contrast glyph contour */
.editorial-overlay {
  --ipax-mode: default;
  --ipax-backdrop: 2.5:1 6px 20px;         /* preserves photo vibrancy across the card */
  --ipax-text: 0px 1px 12px 30% 7:1 8px;   /* guarantees AAA legibility right around text */
}

/* Mixed light and dark text inside the same container */
.mixed-polarity-badge {
  --ipax-mode: tricontrast;                /* clamps background into the dual-polarity luminance band */
  --ipax-backdrop: 4.5:1 8px 12px;         /* both #000 and #fff glyphs reach 4.5:1 simultaneously */
}
```

### APCA `Lc` Fallback & Per-Element Performance Tuning

```css
.high-density-tile {
  /* APCA Lc input (converted to equivalent WCAG ratio with a console warning until APCA is enabled) */
  --ipax-backdrop-contrast: 75Lc;

  /* Per-element engine overrides */
  --ipax-backdrop-performance: 60;         /* target 60 fps adaptive budget (0 = full resolution) */
  --ipax-backdrop-budget-min: 65536;       /* minimum working pixels (256x256) */
  --ipax-backdrop-cellsize: 12px;          /* DOM probe grid step in CSS pixels */
  --ipax-backdrop-maxpixelscale: 1.5;      /* cap HiDPI working scale at 1.5x */
  --ipax-backdrop-backend: auto;           /* auto | webgl | cpu */
}
```

## Declaring Managed Elements

The library scans readable stylesheets for rules declaring `--ipax-backdrop*`, `--ipax-text*`, or `--ipax-mode`. When rules live in unreadable cross-origin or `file://` stylesheets, add `data-ipax-backdrop` or `data-ipax-text` on the element and call `refresh()` after dynamic DOM changes.

---

_IPAX Backdrop & IPAX Text (Lucid Glass) v0.1.11 • 2026-11-17 • Santiago Bustelo • [Apache 2.0 / CC BY 4.0 License](LICENSE)_