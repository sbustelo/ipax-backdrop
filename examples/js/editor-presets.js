/* PATH: examples/js/editor-presets.js */
(function () {
	'use strict';

	const DEFAULT_PRESET = 'high';

	const PROFILES = Object.freeze({
		high: Object.freeze({
			label: 'High Quality',
			backend: 'auto',
			performance: 0,
			minBudget: 65536,
			cellSize: 8,
			maxPixelScale: 2
		}),
		balanced: Object.freeze({
			label: 'Balanced',
			backend: 'auto',
			performance: 60,
			minBudget: 65536,
			cellSize: 12,
			maxPixelScale: 2
		}),
		fast: Object.freeze({
			label: 'Fast',
			backend: 'auto',
			performance: 120,
			minBudget: 1,
			cellSize: 24,
			maxPixelScale: 1
		})
	});

	window.EdPresets = Object.freeze({ DEFAULT_PRESET, PROFILES });
})();