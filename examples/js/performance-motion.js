// PATH: examples/js/dynamic-presets-test.js
(function () {
	'use strict';

	const j0 = window.j0;
	const ipax = j0 && j0.get('ipax-backdrop');
	const common = window.PerfCommon;
	if (!ipax || !common) return;

	const BASE_PROFILES = (window.EdPresets && window.EdPresets.PROFILES) || {
		high: { label: 'High Quality', backend: 'auto', performance: 0, minBudget: 65536, cellSize: 8, maxPixelScale: 2 },
		balanced: { label: 'Balanced', backend: 'auto', performance: 60, minBudget: 65536, cellSize: 12, maxPixelScale: 2 },
		fast: { label: 'Fast', backend: 'auto', performance: 120, minBudget: 1, cellSize: 24, maxPixelScale: 1 }
	};

	const PROFILES = Object.freeze(Object.assign({}, BASE_PROFILES, {
		fast: Object.freeze(Object.assign({}, BASE_PROFILES.fast, {
			minBudget: 16384
		})),
		cpu: Object.freeze({
			label: 'CPU Fallback',
			backend: 'cpu',
			performance: 30,
			minBudget: 16384,
			cellSize: 24,
			maxPixelScale: 1
		})
	}));

	const CASE_VARIANTS = [
		[
			{
				title: 'Editorial Card Overlay',
				copy: 'Combines container contrast with ',
				accent: '7:1 glyph halos',
				tail: ' for multi-color body copy.',
				darkInk: false
			},
			{
				title: 'Inverted Card Polarity',
				copy: 'Adapts OKLab lightness upward for ',
				accent: 'dark ink legibility',
				tail: ' over bright highlights.',
				darkInk: true
			},
			{
				title: 'Feathered Container Edge',
				copy: 'Smooth 18px Euclidean ramp blends ',
				accent: '4.5:1 box contrast',
				tail: ' into moving imagery.',
				darkInk: false
			}
		],
		[
			{
				title: 'Standalone Photo Headline',
				copy: 'Protects individual letterforms directly over imagery with ',
				accent: 'zero container veil',
				tail: '.',
				darkInk: false
			},
			{
				title: 'Dark Glyph Contour Mask',
				copy: 'Word-fitted halos lift luminance behind ',
				accent: 'black typography',
				tail: ' without a card box.',
				darkInk: true
			},
			{
				title: 'Sub-Pixel Range Calibration',
				copy: 'Aligns per-word glyph masks across ',
				accent: 'multi-line wrapping',
				tail: ' in real time.',
				darkInk: false
			}
		],
		[
			{
				title: 'White Title + Dark Copy',
				copy: 'Dual-polarity solver clamps the backdrop so light and dark text share 4.5:1 simultaneously.',
				accent: '',
				tail: '',
				darkInk: false
			},
			{
				title: 'Simultaneous Contrast Band',
				copy: 'Both #ffffff headlines and #0b0d11 body copy remain legible inside one shared container.',
				accent: '',
				tail: '',
				darkInk: false
			},
			{
				title: 'Coarse Grid Tricontrast',
				copy: 'Evaluates 24px probe cells while holding middle-luminance equilibrium across panning textures.',
				accent: '',
				tail: '',
				darkInk: false
			}
		],
		[
			{
				title: 'Frosted Blur + Glyph Solver',
				copy: 'Container runs pure spatial blur while ',
				accent: 'OKLab text solver',
				tail: ' locks 7:1 contrast.',
				darkInk: false
			},
			{
				title: 'Software Kernel Parity',
				copy: 'Reference CPU pipeline matches ',
				accent: 'WebGL shader output',
				tail: ' on dark ink runs.',
				darkInk: true
			},
			{
				title: 'Bypass Contrast + Defocus',
				copy: 'Short-circuits box lightness (1:1) and applies ',
				accent: 'per-glyph contrast',
				tail: ' only around words.',
				darkInk: false
			}
		]
	];

	let bgUrls = [];

	const qs = (sel) => document.querySelector(sel);
	const qsa = (sel) => Array.from(document.querySelectorAll(sel));

	const stageEl = qs('[data-dyn-role="stage"]');
	const bg1El = qs('[data-dyn-role="stage-bg-1"]');
	const bg2El = qs('[data-dyn-role="stage-bg-2"]');
	let activeBgLayer = 1;
	const elRafFps = qs('[data-dyn-role="raf-fps"]');
	const elRafMs = qs('[data-dyn-role="raf-ms"]');
	const elRenderMs = qs('[data-dyn-role="render-ms"]');
	const elBackend = qs('[data-dyn-role="backend"]');
	const elModeHint = qs('[data-dyn-role="mode-hint"]');
	const isolatedControls = qs('[data-dyn-role="isolated-controls"]');
	const customParamsBox = qs('[data-dyn-role="custom-params"]');
	const isolatedPresetSel = qs('[data-dyn-control="isolated-preset"]');
	const speedLabel = qs('[data-dyn-role="speed-label"]');

	const boxes = qsa('[data-dyn-box]').map((el, idx) => ({
		idx,
		el,
		presetSel: qs(`[data-dyn-box-preset="${idx}"]`),
		badgeEl: qs(`[data-dyn-box-backend="${idx}"]`),
		titleEl: qs(`[data-dyn-box-title="${idx}"]`),
		copyEl: qs(`[data-dyn-box-copy="${idx}"]`),
		statsEl: qs(`[data-dyn-box-stats="${idx}"]`),
		preset: ['high', 'balanced', 'fast', 'cpu'][idx] || 'balanced',
		samples: [],
		lastStats: null
	}));

	const boxByEl = new Map(boxes.map((b) => [b.el, b]));

	const state = {
		mode: 'comparative',
		isolatedPreset: 'balanced',
		custom: {
			backend: 'auto',
			performance: 60,
			minBudget: 65536,
			cellSize: 12,
			maxPixelScale: 2
		},
		wlText: false,
		wlTextRate: '2500',
		wlBg: true,
		wlBgRate: '5000',
		wlBgFade: '500',
		wlBgPan: true,
		wlAnim: false,
		wlAnimPattern: 'orbit',
		wlAnimSpeed: 0.25,
		fxBox: true,
		fxText: true,
		fxMode: 'case',
		textTick: 0,
		bgIndex: 0,
		animPhase: 0
	};

	const hud = common.bindHudMetrics({
		elFps: elRafFps,
		elFrameMs: elRafMs,
		elRenderMs: elRenderMs,
		maxSamples: 48
	});
	let lastTextAt = 0;
	let lastBgAt = 0;

	function applyProfileToElement(el, prof) {
		el.style.setProperty('--ipax-backdrop-backend', prof.backend);
		el.style.setProperty('--ipax-backdrop-performance', String(prof.performance));
		el.style.setProperty('--ipax-backdrop-budget-min', String(prof.minBudget));
		el.style.setProperty('--ipax-backdrop-cellsize', String(prof.cellSize));
		el.style.setProperty('--ipax-backdrop-maxpixelscale', String(prof.maxPixelScale));
	}

	function clearElementProfileOverrides(el) {
		el.style.removeProperty('--ipax-backdrop-backend');
		el.style.removeProperty('--ipax-backdrop-performance');
		el.style.removeProperty('--ipax-backdrop-budget-min');
		el.style.removeProperty('--ipax-backdrop-cellsize');
		el.style.removeProperty('--ipax-backdrop-maxpixelscale');
	}

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
			else elBackend.textContent = `MIXED (${glCount} GL / ${cpuCount} CPU)`;
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
			ipax.config.backend = 'auto';
			ipax.config.performance = 60;
			ipax.config.minBudget = 65536;
			ipax.config.cellSize = 12;
			ipax.config.maxPixelScale = 2;

			for (let i = 0; i < boxes.length; i++) {
				const b = boxes[i];
				b.samples.length = 0;
				if (b.presetSel) {
					b.presetSel.disabled = false;
					b.presetSel.value = b.preset;
				}
				applyProfileToElement(b.el, PROFILES[b.preset] || PROFILES.balanced);
			}
		} else {
			const prof = state.isolatedPreset === 'custom'
				? state.custom
				: (PROFILES[state.isolatedPreset] || PROFILES.balanced);

			ipax.config.backend = prof.backend;
			ipax.config.performance = Number(prof.performance);
			ipax.config.minBudget = Number(prof.minBudget);
			ipax.config.cellSize = Number(prof.cellSize);
			ipax.config.maxPixelScale = Number(prof.maxPixelScale);

			for (let i = 0; i < boxes.length; i++) {
				const b = boxes[i];
				b.samples.length = 0;
				clearElementProfileOverrides(b.el);
				if (b.presetSel) {
					b.presetSel.value = state.isolatedPreset === 'custom' ? 'balanced' : state.isolatedPreset;
					b.presetSel.disabled = true;
				}
			}
		}
		hud.resetSamples();
		syncHudBackendSummary();
		ipax.refresh();
	}

	function setMode(nextMode) {
		state.mode = nextMode;
		qsa('[data-dyn-mode]').forEach((btn) => {
			btn.classList.toggle('is-active', btn.getAttribute('data-dyn-mode') === nextMode);
		});
		if (isolatedControls) isolatedControls.hidden = (nextMode !== 'isolated');
		if (elModeHint) {
			elModeHint.textContent = nextMode === 'comparative'
				? 'Runs 4 boxes side-by-side, each bound to its own preset via CSS custom properties.'
				: 'Applies a single preset globally to ipax.config and all 4 boxes to measure true sustained FPS.';
		}
		syncPresets();
	}

	function mutateText() {
		state.textTick++;
		for (let i = 0; i < boxes.length; i++) {
			const b = boxes[i];
			const list = CASE_VARIANTS[i] || CASE_VARIANTS[0];
			const sc = list[state.textTick % list.length];
			b.el.classList.toggle('is-dark-ink', sc.darkInk);
			if (b.titleEl) b.titleEl.textContent = sc.title;
			if (b.copyEl) {
				if (sc.accent) {
					b.copyEl.innerHTML = `${sc.copy}<span class="dyn-accent">${sc.accent}</span>${sc.tail}`;
				} else {
					b.copyEl.textContent = sc.copy;
				}
			}
		}
	}

	function swapBackground() {
		if (!bg1El || !bg2El || !bgUrls.length) return;
		state.bgIndex = (state.bgIndex + 1) % bgUrls.length;
		const nextUrl = bgUrls[state.bgIndex];
		const fadeMs = Number(state.wlBgFade) || 0;
		const transitionStr = fadeMs > 0 ? `opacity ${fadeMs}ms ease-in-out` : 'none';

		if (activeBgLayer === 1) {
			bg2El.style.transition = 'none';
			bg2El.style.backgroundImage = `url("${nextUrl}")`;
			void bg2El.offsetWidth;
			bg2El.style.transition = transitionStr;
			bg1El.style.transition = transitionStr;
			bg2El.style.opacity = '1';
			bg1El.style.opacity = '0';
			activeBgLayer = 2;
		} else {
			bg1El.style.transition = 'none';
			bg1El.style.backgroundImage = `url("${nextUrl}")`;
			void bg1El.offsetWidth;
			bg1El.style.transition = transitionStr;
			bg2El.style.transition = transitionStr;
			bg1El.style.opacity = '1';
			bg2El.style.opacity = '0';
			activeBgLayer = 1;
		}
	}

	function resetPositions() {
		state.animPhase = 0;
		for (let i = 0; i < boxes.length; i++) {
			const el = boxes[i].el;
			el.style.removeProperty('--dyn-x');
			el.style.removeProperty('--dyn-y');
			el.style.removeProperty('--dyn-w');
			el.style.removeProperty('--dyn-h');
		}
		j0.bus.emit('ipax-backdrop:invalidate', { reason: 'reset-layout' });
	}

	function stepAnimation(dtSec) {
		if (!stageEl) return;
		const sw = stageEl.clientWidth;
		const sh = stageEl.clientHeight;
		if (sw < 100 || sh < 100) return;

		state.animPhase += dtSec * state.wlAnimSpeed;
		const t = state.animPhase;

		if (state.wlBgPan && bg1El && bg2El) {
			const px = 50 + Math.sin(t * 0.7) * 45;
			const py = 50 + Math.cos(t * 0.55) * 45;
			const posStr = `${px.toFixed(1)}% ${py.toFixed(1)}%`;
			bg1El.style.backgroundPosition = posStr;
			bg2El.style.backgroundPosition = posStr;
		}

		if (!state.wlAnim) return;

		const baseW = Math.min(340, Math.max(240, Math.floor((sw - 96) / 2)));
		const baseH = 190;
		const maxX = Math.max(24, sw - baseW - 24);
		const maxY = Math.max(24, sh - baseH - 24);
		const cx = maxX * 0.5;
		const cy = maxY * 0.5;

		for (let i = 0; i < boxes.length; i++) {
			const el = boxes[i].el;
			const angle = t * 1.1 + (i * Math.PI) / 2;
			let x = cx;
			let y = cy;
			let w = baseW;
			let h = baseH;

			if (state.wlAnimPattern === 'orbit') {
				x = cx + Math.cos(angle) * (cx * 0.72);
				y = cy + Math.sin(angle) * (cy * 0.72);
			} else if (state.wlAnimPattern === 'cross') {
				const wave = Math.sin(t * 1.4 + i * 0.85);
				x = cx + wave * (cx * 0.75) * (i % 2 === 0 ? 1 : -1);
				y = cy + Math.cos(t * 1.15 + i * 0.7) * (cy * 0.65);
			} else if (state.wlAnimPattern === 'pulse') {
				const col = i % 2;
				const row = (i / 2) | 0;
				const scaleWave = 0.8 + 0.35 * Math.sin(t * 1.8 + i * 1.1);
				w = Math.round(baseW * scaleWave);
				h = Math.round(baseH * (0.85 + 0.25 * Math.cos(t * 1.5 + i)));
				x = 28 + col * (sw * 0.46);
				y = 28 + row * (sh * 0.46);
			}

			el.style.setProperty('--dyn-x', `${Math.round(x)}px`);
			el.style.setProperty('--dyn-y', `${Math.round(y)}px`);
			el.style.setProperty('--dyn-w', `${w}px`);
			el.style.setProperty('--dyn-h', `${h}px`);
		}
	}

	function tick(now) {
		const dtMs = hud.tickFrame(now);

		if (state.wlText) {
			if (state.wlTextRate === 'frame') {
				mutateText();
			} else {
				const interval = Number(state.wlTextRate) || 450;
				if (now - lastTextAt >= interval) {
					lastTextAt = now;
					mutateText();
				}
			}
		}

		if (state.wlBg) {
			const bgInterval = Number(state.wlBgRate) || 1500;
			if (now - lastBgAt >= bgInterval) {
				lastBgAt = now;
				swapBackground();
			}
		}

		stepAnimation(Math.min(0.1, dtMs / 1000));
		requestAnimationFrame(tick);
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

		const bk = (d.backend || 'bypass').toUpperCase();
		if (b.badgeEl) b.badgeEl.textContent = bk;
		if (b.statsEl) {
			if (d.budget) {
				const probes = d.resolver ? `${d.resolver.probes}/${d.resolver.cells}p` : '';
				b.statsEl.textContent = `${d.ms.toFixed(1)} ms (avg ${avg.toFixed(1)}) • ${d.budget.w}×${d.budget.h} • ${d.budget.s.toFixed(2)}x ${probes}`;
			} else {
				b.statsEl.textContent = `${d.ms.toFixed(1)} ms • bypass`;
			}
		}
	});

	j0.bus.on('ipax-backdrop:backend', (d) => {
		if (!elBackend || !d) return;
		if (state.mode === 'isolated') {
			elBackend.textContent = (d.backend || 'unknown').toUpperCase();
		} else {
			syncHudBackendSummary();
		}
	});

	qsa('[data-dyn-mode]').forEach((btn) => {
		btn.addEventListener('click', () => setMode(btn.getAttribute('data-dyn-mode')));
	});

	boxes.forEach((b) => {
		if (!b.presetSel) return;
		b.presetSel.addEventListener('change', () => {
			b.preset = b.presetSel.value;
			if (state.mode === 'comparative') {
				b.samples.length = 0;
				applyProfileToElement(b.el, PROFILES[b.preset] || PROFILES.balanced);
				syncHudBackendSummary();
				j0.bus.emit('ipax-backdrop:invalidate', { target: b.el });
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

	function syncCustomInputs() {
		const map = {
			'cfg-backend': state.custom.backend,
			'cfg-fps': state.custom.performance,
			'cfg-budget': state.custom.minBudget,
			'cfg-cellsize': state.custom.cellSize,
			'cfg-scale': state.custom.maxPixelScale
		};
		Object.entries(map).forEach(([ctrl, val]) => {
			const el = qs(`[data-dyn-control="${ctrl}"]`);
			if (el) el.value = String(val);
		});
	}

	['cfg-backend', 'cfg-fps', 'cfg-budget', 'cfg-cellsize', 'cfg-scale'].forEach((ctrl) => {
		const el = qs(`[data-dyn-control="${ctrl}"]`);
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

	const bindCheck = (ctrl, key, onChange) => {
		const el = qs(`[data-dyn-control="${ctrl}"]`);
		if (!el) return;
		el.addEventListener('change', () => {
			state[key] = el.checked;
			if (onChange) onChange(el.checked);
		});
	};

	bindCheck('wl-text', 'wlText');
	bindCheck('wl-bg', 'wlBg');
	bindCheck('wl-bg-pan', 'wlBgPan');
	bindCheck('wl-anim', 'wlAnim');
	bindCheck('fx-box', 'fxBox', syncPipelineCss);
	bindCheck('fx-text', 'fxText', syncPipelineCss);

	const bindSelect = (ctrl, key, onChange) => {
		const el = qs(`[data-dyn-control="${ctrl}"]`);
		if (!el) return;
		el.addEventListener('change', () => {
			state[key] = el.value;
			if (onChange) onChange(el.value);
		});
	};

	bindSelect('wl-text-rate', 'wlTextRate');
	bindSelect('wl-bg-rate', 'wlBgRate');
	bindSelect('wl-bg-fade', 'wlBgFade');
	bindSelect('wl-anim-pattern', 'wlAnimPattern');
	bindSelect('fx-mode', 'fxMode', syncPipelineCss);

	const speedRange = qs('[data-dyn-control="wl-anim-speed"]');
	if (speedRange) {
		speedRange.addEventListener('input', () => {
			state.wlAnimSpeed = Number(speedRange.value) || 1;
			if (speedLabel) speedLabel.textContent = `${state.wlAnimSpeed.toFixed(2)}x`;
		});
	}

	const chkEffect = qs('[data-dyn-control="effect"]');
	if (chkEffect && stageEl) {
		chkEffect.addEventListener('change', () => {
			stageEl.classList.toggle('is-raw', !chkEffect.checked);
			if (chkEffect.checked) j0.bus.emit('ipax-backdrop:invalidate', { reason: 'toggle-effect' });
		});
	}

	const btnStep = qs('[data-dyn-action="step-once"]');
	if (btnStep) {
		btnStep.addEventListener('click', () => {
			mutateText();
			swapBackground();
			stepAnimation(0.25);
		});
	}

	const btnReset = qs('[data-dyn-action="reset-layout"]');
	if (btnReset) {
		btnReset.addEventListener('click', resetPositions);
	}

	common.createPoolManager({
		defaultCount: 10,
		width: 1280,
		height: 800,
		onChange: (urls) => {
			bgUrls = urls;
			state.bgIndex = 0;
			if (bg1El && bg2El && bgUrls.length) {
				bg1El.style.transition = 'none';
				bg2El.style.transition = 'none';
				bg1El.style.backgroundImage = `url("${bgUrls[0]}")`;
				bg1El.style.opacity = '1';
				bg2El.style.opacity = '0';
				activeBgLayer = 1;
				j0.bus.emit('ipax-backdrop:invalidate', { reason: 'pool-updated' });
			}
		}
	});

	common.mountBenchmarkNav('[data-perf-nav="host"]');

	if (customParamsBox) customParamsBox.hidden = true;
	syncCustomInputs();
	syncPipelineCss();
	setMode('comparative');
	requestAnimationFrame(tick);
})();
