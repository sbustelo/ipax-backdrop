/**
 * ipax-backdrop / 2300-resolutor-desenfoque.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 2 - RESOLVER (blur): a blurred copy of the backdrop estimate.
 *
 * The kernels mix the sharp and the blurred estimate with the feather mask,
 * so the blur fades in from the element edge exactly like the contrast
 * correction does. It is done ONCE, here, in JavaScript, and handed to both
 * kernels as a second image.
 *
 * ARCHITECTURE OPTIMIZATIONS (Zero GC, Zero Cache-Miss):
 * 1. Persistent scratchpads (bufA, bufB, outBuf) to eliminate frame-drop allocations.
 *    The planes are Uint8Array (values are 0..255): 4x less memory traffic than Uint32.
 * 2. Planar RGB extraction to process channels continuously.
 * 3. 1D Box Blur commutative transposing: H, H, H -> Transpose -> H, H, H.
 *    Vertical passes are done horizontally in memory to maximize CPU L1/L2 cache hits.
 * 4. Pure integer arithmetic: the per-pixel division is a multiply and a shift
 *    (16-bit fixed point, rounded up so a flat 255 field stays 255).
 * 5. ADAPTIVE DOWNSAMPLING. A Gaussian-like blur is low frequency, so for a large
 *    sigma the work is done on a reduced image (factor k = 1, 2, 4 or 8, chosen so
 *    the reduced sigma stays >= 2 px) and scaled back up with bilinear filtering.
 *    Cost drops by k^2 (k = 4 -> 16x). Small sigmas (< 4 px) run at full size, as before.
 * 6. The output canvas is reused: pass the compositor record as `store` and the
 *    canvas lives in store.blurCv. The result is consumed synchronously by the
 *    kernel, so a single canvas per record is enough.
 *
 * Service 'ipax-backdrop:blur':
 *   blur(est, w, h, sigma, store?) -> HTMLCanvasElement | null
 *   boxRadius(sigma)
 *   factor(sigma)                  downsampling factor that blur() would pick
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	let bufA = new Uint8Array(0);
	let bufB = new Uint8Array(0);
	let outBuf = new Uint8ClampedArray(0);
	let smallCv = null;       // shared scratch canvas for the reduced image (always used synchronously)
	let sharedOut = null;     // output canvas when the caller passes no store

	const boxRadius = (sigma) => Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));

	/** Largest k in {1,2,4,8} that keeps the reduced sigma >= 2 px. */
	function factor(sigma) {
		let k = 1;
		while (k < 8 && sigma / (k * 2) >= 2) k *= 2;
		return k;
	}

	/** Optimized 1D Box Blur with edge clamping and a fixed-point multiplier instead of a division. */
	function pass1D(s, d, len, count, r) {
		const diam = 2 * r + 1;
		const inv = Math.ceil(65536 / diam); // acc <= 255 * diam, so acc * inv stays below 2^31 for diam < 257
		const last = len - 1;
		for (let j = 0; j < count; j++) {
			const base = j * len;
			let acc = s[base] * (r + 1);
			for (let i = 1; i <= r; i++) {
				acc += s[base + (i < len ? i : last)];
			}
			for (let i = 0; i < len; i++) {
				d[base + i] = (acc * inv) >>> 16;
				const right = i + r + 1;
				const left = i - r;
				acc += s[base + (right < len ? right : last)] - s[base + (left >= 0 ? left : 0)];
			}
		}
	}

	/** Blur an RGBA buffer (w x h) with 3 box passes per axis. Result goes to outBuf as opaque RGBA. */
	function boxBlurRGBA(data, w, h, r) {
		const n = w * h;
		const reqSpace = n * 3;

		// Grow scratchpads if needed, adding a margin to avoid reallocation jitter
		if (bufA.length < reqSpace) {
			const newLen = reqSpace + 180000;
			bufA = new Uint8Array(newLen);
			bufB = new Uint8Array(newLen);
		}
		if (outBuf.length < n * 4) outBuf = new Uint8ClampedArray(n * 4 + 240000);

		// 1. Extract interleaved RGBA into planar contiguous R, G, B
		for (let i = 0; i < n; i++) {
			const q = i * 4;
			bufA[i] = data[q];
			bufA[i + n] = data[q + 1];
			bufA[i + n * 2] = data[q + 2];
		}

		// 2. Horizontal passes (3 passes, approximating Gaussian)
		pass1D(bufA, bufB, w, h * 3, r);
		pass1D(bufB, bufA, w, h * 3, r);
		pass1D(bufA, bufB, w, h * 3, r);

		// 3. Transpose image to process vertical blur horizontally
		for (let c = 0; c < 3; c++) {
			const offC = c * n;
			for (let y = 0; y < h; y++) {
				let offS = offC + y * w;
				let offD = offC + y;
				for (let x = 0; x < w; x++) {
					bufA[offD] = bufB[offS++];
					offD += h;
				}
			}
		}

		// 4. Vertical passes (now running horizontally in RAM)
		// Note: transposed image has lines of length 'h', and 'w' lines per channel
		pass1D(bufA, bufB, h, w * 3, r);
		pass1D(bufB, bufA, h, w * 3, r);
		pass1D(bufA, bufB, h, w * 3, r);

		// 5. Transpose back and interleave directly into RGBA output
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const outIdx = (y * w + x) * 4;
				const inIdx = x * h + y;
				outBuf[outIdx] = bufB[inIdx];
				outBuf[outIdx + 1] = bufB[inIdx + n];
				outBuf[outIdx + 2] = bufB[inIdx + n * 2];
				outBuf[outIdx + 3] = 255;
			}
		}
	}

	function blur(est, w, h, sigma, store) {
		if (!est || !(sigma >= 0.3)) return null;

		const k = factor(sigma);
		const sw = k > 1 ? Math.max(1, Math.ceil(w / k)) : w;
		const sh = k > 1 ? Math.max(1, Math.ceil(h / k)) : h;
		const sg = sigma / k;

		// Source of the pixels to blur: the estimate itself, or a reduced copy of it.
		let srcCtx, smallCtx = null;
		if (k > 1) {
			if (!smallCv) smallCv = document.createElement('canvas');
			if (smallCv.width !== sw || smallCv.height !== sh) { smallCv.width = sw; smallCv.height = sh; }
			smallCtx = smallCv.getContext('2d', { willReadFrequently: true });
			smallCtx.imageSmoothingEnabled = true;
			smallCtx.imageSmoothingQuality = 'high';
			smallCtx.drawImage(est, 0, 0, w, h, 0, 0, sw, sh);
			srcCtx = smallCtx;
		} else {
			srcCtx = est.getContext('2d', { willReadFrequently: true });
		}

		let data;
		try { data = srcCtx.getImageData(0, 0, sw, sh).data; } catch (e) { return null; } // tainted canvas

		boxBlurRGBA(data, sw, sh, boxRadius(sg));

		// Output canvas: reused per record when a store is given.
		let cv = store ? store.blurCv : sharedOut;
		if (!cv) { cv = document.createElement('canvas'); if (store) store.blurCv = cv; else sharedOut = cv; }
		if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
		const octx = cv.getContext('2d', { willReadFrequently: true });

		const img = new ImageData(outBuf.subarray(0, sw * sh * 4), sw, sh);
		if (k === 1) {
			octx.putImageData(img, 0, 0);
		} else {
			smallCtx.putImageData(img, 0, 0);
			octx.imageSmoothingEnabled = true;
			octx.imageSmoothingQuality = 'low'; // plain bilinear is enough for a smooth image
			octx.drawImage(smallCv, 0, 0, sw, sh, 0, 0, w, h);
		}
		return cv;
	}

	window.j0.register('ipax-backdrop:blur', { blur, boxRadius, factor });
})();
