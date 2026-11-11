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
 * 1. Persistent scratchpads (bufA, bufB) to eliminate frame-drop allocations.
 * 2. Planar RGB extraction to process channels continuously.
 * 3. 1D Box Blur commutative transposing: H, H, H -> Transpose -> H, H, H.
 *    Vertical passes are done horizontally in memory to maximize CPU L1/L2 cache hits.
 * 4. Pure integer arithmetic.
 *
 * Service 'ipax-backdrop:blur':
 *   blur(est, w, h, sigma) -> HTMLCanvasElement | null
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	let bufA = new Uint32Array(0);
	let bufB = new Uint32Array(0);

	const boxRadius = (sigma) => Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));

	/** Optimized 1D Box Blur with clamping and integer division */
	function pass1D(s, d, len, count, r) {
		const diam = 2 * r + 1;
		for (let j = 0; j < count; j++) {
			const base = j * len;
			let acc = s[base] * (r + 1);
			for (let i = 1; i <= r; i++) {
				acc += s[base + (i < len ? i : len - 1)];
			}
			for (let i = 0; i < len; i++) {
				d[base + i] = (acc / diam) | 0;
				const right = i + r + 1;
				const left = i - r;
				acc += s[base + (right < len ? right : len - 1)] - s[base + (left >= 0 ? left : 0)];
			}
		}
	}

	function blur(est, w, h, sigma) {
		if (!est || !(sigma >= 0.3)) return null;
		let data;
		try { data = est.getContext('2d').getImageData(0, 0, w, h).data; } catch (e) { return null; }

		const n = w * h;
		const reqSpace = n * 3;
		
		// Grow scratchpads if needed, adding a 60k margin to avoid reallocation jitter
		if (bufA.length < reqSpace) {
			const newLen = reqSpace + 180000;
			bufA = new Uint32Array(newLen);
			bufB = new Uint32Array(newLen);
		}

		// 1. Extract interleaved RGBA into planar contiguous R, G, B
		for (let i = 0; i < n; i++) {
			const q = i * 4;
			bufA[i] = data[q];
			bufA[i + n] = data[q + 1];
			bufA[i + n * 2] = data[q + 2];
		}

		const r = boxRadius(sigma);

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
		const out = new Uint8ClampedArray(n * 4);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const outIdx = (y * w + x) * 4;
				const inIdx = x * h + y;
				
				out[outIdx] = bufB[inIdx];
				out[outIdx + 1] = bufB[inIdx + n];
				out[outIdx + 2] = bufB[inIdx + n * 2];
				out[outIdx + 3] = 255;
			}
		}

		const cv = document.createElement('canvas');
		cv.width = w; cv.height = h;
		cv.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
		return cv;
	}

	window.j0.register('ipax-backdrop:blur', { blur, boxRadius });
})();