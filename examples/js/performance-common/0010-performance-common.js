// PATH: examples/js/performance-common/0010-performance-common.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	const SPEEDS = Object.freeze({
		slow: Object.freeze({ label: 'Slow', panHz: 0.08, swapMs: 6000 }),
		medium: Object.freeze({ label: 'Medium', panHz: 0.22, swapMs: 3000 }),
		fast: Object.freeze({ label: 'Fast', panHz: 0.55, swapMs: 1200 })
	});

	function panPosition(phase) {
		const x = 50 + Math.sin(phase) * 48;
		const y = 50 + Math.cos(phase * 0.78) * 48;
		return {
			x,
			y,
			css: x.toFixed(1) + '% ' + y.toFixed(1) + '%'
		};
	}

	function bindHudMetrics(opts) {
		const elFps = opts.elFps || null;
		const elFrameMs = opts.elFrameMs || null;
		const elRenderMs = opts.elRenderMs || null;
		const elBackend = opts.elBackend || null;
		const maxSamples = opts.maxSamples || 32;

		const renderSamples = [];
		let rafFrames = 0;
		let rafWindowStart = performance.now();
		let rafLastFrame = performance.now();
		let smoothedFrameMs = 16.7;

		function flushRenderMs() {
			if (!elRenderMs || !renderSamples.length) return;
			let sum = 0;
			for (let i = 0; i < renderSamples.length; i++) sum += renderSamples[i];
			elRenderMs.textContent = (sum / renderSamples.length).toFixed(1);
		}

		if (j0.bus) {
			j0.bus.on('ipax-backdrop:updated', (d) => {
				if (!d || typeof d.ms !== 'number') return;
				renderSamples.push(d.ms);
				if (renderSamples.length > maxSamples) renderSamples.shift();
				flushRenderMs();
			});

			if (elBackend) {
				j0.bus.on('ipax-backdrop:backend', (d) => {
					if (d && d.backend) elBackend.textContent = d.backend;
				});
			}
		}

		function tickFrame(now) {
			const dtMs = now - rafLastFrame;
			rafLastFrame = now;
			smoothedFrameMs = smoothedFrameMs * 0.85 + dtMs * 0.15;
			rafFrames++;

			if (now - rafWindowStart >= 400) {
				const fps = (rafFrames * 1000) / (now - rafWindowStart);
				if (elFps) elFps.textContent = fps.toFixed(0);
				if (elFrameMs) elFrameMs.textContent = smoothedFrameMs.toFixed(1);
				rafFrames = 0;
				rafWindowStart = now;
			}
			return dtMs;
		}

		function resetSamples() {
			renderSamples.length = 0;
		}

		return { tickFrame, resetSamples };
	}

	function bindBenchmarkNav() {
		const sel = document.querySelector('[data-perf-control="benchmark-nav"]');
		if (!sel) return;
		sel.addEventListener('change', () => {
			if (sel.value) global.location.href = sel.value;
		});
	}

	bindBenchmarkNav();

	j0.register('ipax-backdrop:perf-common', Object.freeze({
		SPEEDS,
		panPosition,
		bindHudMetrics,
		bindBenchmarkNav
	}));
})(typeof globalThis !== 'undefined' ? globalThis : window);