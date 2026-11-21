// PATH: examples/js/performance-motion/0010-performance-motion.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const ipax = j0 && j0.get('ipax-backdrop');
	const common = j0 && j0.get('ipax-backdrop:perf-common');
	if (!ipax || !common) return;

	const presetSvc = j0.get('editor:presets');
	const PROFILES = (presetSvc && presetSvc.PROFILES) || {
		high: { backend: 'auto', performance: 0, minBudget: 65536, cellSize: 8, maxPixelScale: 2 },
		balanced: { backend: 'auto', performance: 60, minBudget: 65536, cellSize: 12, maxPixelScale: 2 },
		fast: { backend: 'auto', performance: 120, minBudget: 16384, cellSize: 24, maxPixelScale: 1 },
		cpu: { backend: 'cpu', performance: 30, minBudget: 16384, cellSize: 24, maxPixelScale: 1 }
	};

	const qs = (sel) => document.querySelector(sel);
	const qsa = (sel) => Array.from(document.querySelectorAll(sel));

	const stageEl = qs('[data-dyn-role="stage"]');
	const elBackend = qs('[data-dyn-role="backend"]');
	const elModeHint = qs('[data-dyn-role="mode-hint"]');
	const isolatedControls = qs('[data-dyn-role="isolated-controls"]');
	const customParamsBox = qs('[data-dyn-role="custom-params"]');
	const isolatedPresetSel = qs('[data-dyn-control="isolated-preset"]');

	const boxes = qsa('[data-dyn-box]').map((el, idx) => ({
		idx,
		el,
		presetSel: qs('[data-dyn-box-preset="' + idx + '"]'),
		badgeEl: qs('[data-dyn-box-backend="' + idx + '"]'),
		statsEl: qs('[data-dyn-box-stats="' + idx + '"]'),
		preset: el.getAttribute('data-dyn-preset') || 'balanced',
		samples: []
	}));

	const boxByEl = new Map(boxes.map((b) => [b.el, b]));

	const state = {
		mode: 'comparative',
		isolatedPreset: 'balanced',
		custom: Object.assign({}, PROFILES.balanced),
		fxBox: true,
		fxText: true,
		fxMode: 'case'
	};

	function syncHudBackendSummary() {
		if (!elBackend) return;
		if (state.mode === 'comparative') {
			let cpuCount = 0;
			for (let i = 0; i < boxes.length; i++) {
				const prof = PROFILES[boxes[i].preset] || PROFILES.balanced;
				if (prof.backend === 'cpu') cpuCount++;
			}
			const glCount = boxes.length - cpuCount;
			if (cpuCount === 0) elBackend.textContent = 'WEBGL (4)';
			else if (glCount === 0) elBackend.textContent = 'CPU (4)';
			else elBackend.textContent = 'MIXED (' + glCount + ' GL / ' + cpuCount + ' CPU)';
			return;
		}
		const active = typeof ipax.backend === 'function' ? ipax.backend() : '';
		elBackend.textContent = (active || ipax.config.backend || 'auto').toUpperCase();
	}

	function syncPipelineCss() {
		if (stageEl) {
			stageEl.classList.toggle('is-box-off', !state.fxBox);
			stageEl.classList.toggle('is-text-off', !state.fxText);
			stageEl.classList.toggle('is-mode-default', state.fxMode === 'default');
			stageEl.classList.toggle('is-mode-tricontrast', state.fxMode === 'tricontrast');
		}
		j0.bus.emit('ipax-backdrop:invalidate', { reason: 'pipeline-controls' });
	}

	function syncPresets() {
		if (state.mode === 'comparative') {
			Object.assign(ipax.config, PROFILES.balanced);
			for (let i = 0; i < boxes.length; i++) {
				const b = boxes[i];
				b.samples.length = 0;
				b.el.setAttribute('data-dyn-preset', b.preset);
				if (b.presetSel) {
					b.presetSel.disabled = false;
					b.presetSel.value = b.preset;
				}
			}
		} else {
			const prof = state.isolatedPreset === 'custom' ? state.custom : (PROFILES[state.isolatedPreset] || PROFILES.balanced);
			ipax.config.backend = prof.backend;
			ipax.config.performance = Number(prof.performance);
			ipax.config.minBudget = Number(prof.minBudget);
			ipax.config.cellSize = Number(prof.cellSize);
			ipax.config.maxPixelScale = Number(prof.maxPixelScale);

			for (let i = 0; i < boxes.length; i++) {
				const b = boxes[i];
				b.samples.length = 0;
				b.el.removeAttribute('data-dyn-preset');
				if (b.presetSel) {
					b.presetSel.value = state.isolatedPreset === 'custom' ? 'balanced' : state.isolatedPreset;
					b.presetSel.disabled = true;
				}
			}
		}
		j0.bus.emit('dyn:presets-changed', { mode: state.mode });
		syncHudBackendSummary();
		ipax.refresh();
	}

	function setMode(nextMode) {
		state.mode = nextMode;
		qsa('[data-dyn-mode]').forEach((btn) => btn.classList.toggle('is-active', btn.getAttribute('data-dyn-mode') === nextMode));
		if (isolatedControls) isolatedControls.hidden = (nextMode !== 'isolated');
		if (elModeHint) {
			elModeHint.textContent = nextMode === 'comparative'
				? 'Runs 4 boxes side-by-side, each bound to its own preset via CSS custom properties.'
				: 'Applies a single preset globally to ipax.config and all 4 boxes to measure true sustained FPS.';
		}
		syncPresets();
	}

	function syncCustomInputs() {
		const map = {
			'cfg-backend': state.custom.backend,
			'cfg-fps': state.custom.performance,
			'cfg-budget': state.custom.minBudget,
			'cfg-cellsize': state.custom.cellSize,
			'cfg-scale': state.custom.maxPixelScale
		};
		Object.entries(map).forEach(([ctrl, val]) => {
			const el = qs('[data-dyn-control="' + ctrl + '"]');
			if (el) el.value = String(val);
		});
	}

	j0.bus.on('ipax-backdrop:updated', (d) => {
		if (!d || !d.element) return;
		const b = boxByEl.get(d.element);
		if (!b) return;
		b.samples.push(d.ms);
		if (b.samples.length > 24) b.samples.shift();
		let avg = 0;
		for (let i = 0; i < b.samples.length; i++) avg += b.samples[i];
		avg /= b.samples.length;

		if (b.badgeEl) b.badgeEl.textContent = (d.backend || 'bypass').toUpperCase();
		if (b.statsEl) {
			if (d.budget) {
				const probes = d.resolver ? (d.resolver.probes + '/' + d.resolver.cells + 'p') : '';
				b.statsEl.textContent = d.ms.toFixed(1) + ' ms (avg ' + avg.toFixed(1) + ') \u2022 ' + d.budget.w + '\u00d7' + d.budget.h + ' \u2022 ' + d.budget.s.toFixed(2) + 'x ' + probes;
			} else {
				b.statsEl.textContent = d.ms.toFixed(1) + ' ms \u2022 bypass';
			}
		}
	});

	j0.bus.on('ipax-backdrop:backend', (d) => {
		if (!elBackend || !d) return;
		if (state.mode === 'isolated') elBackend.textContent = (d.backend || 'unknown').toUpperCase();
		else syncHudBackendSummary();
	});

	qsa('[data-dyn-mode]').forEach((btn) => btn.addEventListener('click', () => setMode(btn.getAttribute('data-dyn-mode'))));

	boxes.forEach((b) => {
		if (!b.presetSel) return;
		b.presetSel.addEventListener('change', () => {
			b.preset = b.presetSel.value;
			if (state.mode === 'comparative') {
				b.samples.length = 0;
				b.el.setAttribute('data-dyn-preset', b.preset);
				syncHudBackendSummary();
				j0.bus.emit('ipax-backdrop:invalidate', { reason: 'box-preset-change', target: b.el });
			}
		});
	});

	if (isolatedPresetSel) {
		isolatedPresetSel.addEventListener('change', () => {
			state.isolatedPreset = isolatedPresetSel.value;
			if (customParamsBox) customParamsBox.hidden = (state.isolatedPreset !== 'custom');
			if (state.isolatedPreset !== 'custom' && PROFILES[state.isolatedPreset]) {
				Object.assign(state.custom, PROFILES[state.isolatedPreset]);
				syncCustomInputs();
			}
			syncPresets();
		});
	}

	['cfg-backend', 'cfg-fps', 'cfg-budget', 'cfg-cellsize', 'cfg-scale'].forEach((ctrl) => {
		const el = qs('[data-dyn-control="' + ctrl + '"]');
		if (!el) return;
		el.addEventListener('change', () => {
			state.custom.backend = qs('[data-dyn-control="cfg-backend"]').value;
			state.custom.performance = Math.max(0, Number(qs('[data-dyn-control="cfg-fps"]').value) || 0);
			state.custom.minBudget = Math.max(1, Number(qs('[data-dyn-control="cfg-budget"]').value) || 1);
			state.custom.cellSize = Math.max(4, Number(qs('[data-dyn-control="cfg-cellsize"]').value) || 12);
			state.custom.maxPixelScale = Math.max(0.5, Number(qs('[data-dyn-control="cfg-scale"]').value) || 2);
			state.isolatedPreset = 'custom';
			if (isolatedPresetSel) isolatedPresetSel.value = 'custom';
			if (customParamsBox) customParamsBox.hidden = false;
			syncPresets();
		});
	});

	const bindCheck = (ctrl, key) => {
		const el = qs('[data-dyn-control="' + ctrl + '"]');
		if (el) el.addEventListener('change', () => { state[key] = el.checked; syncPipelineCss(); });
	};
	bindCheck('fx-box', 'fxBox');
	bindCheck('fx-text', 'fxText');

	const modeSel = qs('[data-dyn-control="fx-mode"]');
	if (modeSel) modeSel.addEventListener('change', () => { state.fxMode = modeSel.value; syncPipelineCss(); });

	if (customParamsBox) customParamsBox.hidden = true;
	syncCustomInputs();
	syncPipelineCss();
	setMode('comparative');

	j0.register('ipax-backdrop:dyn-controller', Object.freeze({ stageEl, boxes }));
})(typeof globalThis !== 'undefined' ? globalThis : window);