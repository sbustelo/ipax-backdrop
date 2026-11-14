/* PATH: examples/js/editor-performance.js */
(function () {
	'use strict';

	const { state, qs, on, markDirty, bindSliderPair, setSliderPair, refreshBackdrop } = window.EdCore;
	const { DEFAULT_PRESET, PROFILES } = window.EdPresets;

	const panelPerf = qs('[data-ed-panel="performance"]');
	const presetSel = qs('[data-ed-control="perf-preset"]');
	const customSubpanel = qs('[data-ed-subpanel="perf-custom"]');
	const backendSel = qs('[data-ed-control="perf-backend"]');
	const telemetryEl = qs('[data-ed-role="perf-telemetry"]');

	function getIpax() {
		return window.j0 && window.j0.get ? window.j0.get('ipax-backdrop') : null;
	}

	function applyConfig() {
		const p = state.performance;
		if (!p) return;
		const ipax = getIpax();
		if (ipax && ipax.config) {
			ipax.config.backend = p.backend;
			ipax.config.cellSize = Number(p.cellSize);
			ipax.config.performance = Number(p.performance);
			ipax.config.minBudget = Number(p.minBudget);
			ipax.config.maxPixelScale = Number(p.maxPixelScale);
		}
		refreshBackdrop();
	}

	function syncPanel() {
		const p = state.performance;
		if (!p || !presetSel) return;
		presetSel.value = p.preset || DEFAULT_PRESET;
		if (customSubpanel) customSubpanel.hidden = (presetSel.value !== 'custom');
		if (backendSel) backendSel.value = p.backend;
		setSliderPair('perf-cellsize', p.cellSize);
		setSliderPair('perf-fps', p.performance);
		setSliderPair('perf-budget', p.minBudget);
		setSliderPair('perf-scale', p.maxPixelScale);
	}

	function applyPreset(presetKey) {
		if (presetKey === 'custom') {
			if (!state.performance) {
				state.performance = Object.assign({ preset: 'custom' }, PROFILES[DEFAULT_PRESET]);
			} else {
				state.performance.preset = 'custom';
			}
			syncPanel();
			markDirty();
			return;
		}
		const resolved = PROFILES[presetKey] ? presetKey : DEFAULT_PRESET;
		state.performance = Object.assign({ preset: resolved }, PROFILES[resolved]);
		applyConfig();
		syncPanel();
		markDirty();
	}

	function switchToCustom() {
		if (!state.performance) return;
		state.performance.preset = 'custom';
		if (presetSel) presetSel.value = 'custom';
		if (customSubpanel) customSubpanel.hidden = false;
	}

	if (presetSel) {
		presetSel.addEventListener('change', () => applyPreset(presetSel.value));
	}

	if (backendSel) {
		backendSel.addEventListener('change', () => {
			if (!state.performance) return;
			state.performance.backend = backendSel.value;
			switchToCustom();
			applyConfig();
			markDirty();
		});
	}

	bindSliderPair('perf-cellsize', (v) => {
		if (!state.performance) return;
		state.performance.cellSize = v;
		switchToCustom();
		applyConfig();
	});

	bindSliderPair('perf-fps', (v) => {
		if (!state.performance) return;
		state.performance.performance = v;
		switchToCustom();
		applyConfig();
	});

	bindSliderPair('perf-budget', (v) => {
		if (!state.performance) return;
		state.performance.minBudget = v;
		switchToCustom();
		applyConfig();
	});

	bindSliderPair('perf-scale', (v) => {
		if (!state.performance) return;
		state.performance.maxPixelScale = v;
		switchToCustom();
		applyConfig();
	});

	on('selection:changed', (box) => {
		if (panelPerf) panelPerf.hidden = !!box;
		if (!box) syncPanel();
	});

	if (window.j0 && window.j0.bus) {
		window.j0.bus.on('ipax-backdrop:updated', (d) => {
			if (!telemetryEl || !d) return;
			const backend = (d.backend || 'unknown').toUpperCase();
			telemetryEl.textContent = `Engine: ${backend} \u2022 ${Number(d.ms).toFixed(1)} ms`;
		});
		window.j0.bus.on('ipax-backdrop:backend', (d) => {
			if (!telemetryEl || !d) return;
			const backend = (d.backend || 'unknown').toUpperCase();
			telemetryEl.textContent = `Engine: ${backend}`;
		});
		window.j0.bus.on('ipax-backdrop:ready', () => {
			if (!telemetryEl) return;
			const ipax = getIpax();
			const active = ipax && typeof ipax.backend === 'function' ? ipax.backend() : '';
			if (!active) telemetryEl.textContent = 'Engine: idle (0 layers)';
		});
	}

	window.EdPerf = { applyPreset, applyConfig, syncPanel };
})();