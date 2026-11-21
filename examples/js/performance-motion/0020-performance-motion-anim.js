// PATH: examples/js/performance-motion/0020-performance-motion-anim.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const common = j0 && j0.get('ipax-backdrop:perf-common');
	const poolSvc = j0 && j0.get('ipax-backdrop:perf-pool');
	const ctrl = j0 && j0.get('ipax-backdrop:dyn-controller');
	if (!common || !poolSvc || !ctrl) return;

	const CASE_VARIANTS = [
		[
			{ title: 'Editorial Card Overlay', head: 'Combines container contrast with ', accent: '7:1 glyph halos', tail: ' for multi-color body copy.', darkInk: false },
			{ title: 'Inverted Card Polarity', head: 'Adapts OKLab lightness upward for ', accent: 'dark ink legibility', tail: ' over bright highlights.', darkInk: true },
			{ title: 'Feathered Container Edge', head: 'Smooth 18px Euclidean ramp blends ', accent: '4.5:1 box contrast', tail: ' into moving imagery.', darkInk: false }
		],
		[
			{ title: 'Standalone Photo Headline', head: 'Protects individual letterforms directly over imagery with ', accent: 'zero container veil', tail: '.', darkInk: false },
			{ title: 'Dark Glyph Contour Mask', head: 'Word-fitted halos lift luminance behind ', accent: 'black typography', tail: ' without a card box.', darkInk: true },
			{ title: 'Sub-Pixel Range Calibration', head: 'Aligns per-word glyph masks across ', accent: 'multi-line wrapping', tail: ' in real time.', darkInk: false }
		],
		[
			{ title: 'White Title + Dark Copy', head: 'Dual-polarity solver clamps the backdrop so light and dark text share 4.5:1 simultaneously.', accent: '', tail: '', darkInk: false },
			{ title: 'Simultaneous Contrast Band', head: 'Both #ffffff headlines and #0b0d11 body copy remain legible inside one shared container.', accent: '', tail: '', darkInk: false },
			{ title: 'Coarse Grid Tricontrast', head: 'Evaluates 24px probe cells while holding middle-luminance equilibrium across panning textures.', accent: '', tail: '', darkInk: false }
		],
		[
			{ title: 'Frosted Blur + Glyph Solver', head: 'Container runs pure spatial blur while ', accent: 'OKLab text solver', tail: ' locks 7:1 contrast.', darkInk: false },
			{ title: 'Software Kernel Parity', head: 'Reference CPU pipeline matches ', accent: 'WebGL shader output', tail: ' on dark ink runs.', darkInk: true },
			{ title: 'Bypass Contrast + Defocus', head: 'Short-circuits box lightness (1:1) and applies ', accent: 'per-glyph contrast', tail: ' only around words.', darkInk: false }
		]
	];

	const qs = (sel) => document.querySelector(sel);
	const stageEl = ctrl.stageEl;
	const bg1El = qs('[data-dyn-role="stage-bg-1"]');
	const bg2El = qs('[data-dyn-role="stage-bg-2"]');
	const speedLabel = qs('[data-dyn-role="speed-label"]');

	const textSlots = ctrl.boxes.map((b) => ({
		el: b.el,
		titleEl: qs('[data-dyn-box-title="' + b.idx + '"]'),
		copyHeadEl: b.el.querySelector('[data-dyn-role="copy-head"]'),
		copyAccentEl: b.el.querySelector('[data-dyn-role="copy-accent"]'),
		copyTailEl: b.el.querySelector('[data-dyn-role="copy-tail"]')
	}));

	let bgUrls = [];
	let activeBgLayer = 1;
	let lastTextAt = 0;
	let lastBgAt = 0;

	const anim = {
		wlText: false,
		wlTextRate: '2500',
		wlBg: true,
		wlBgRate: '5000',
		wlBgFade: '500',
		wlBgPan: true,
		wlAnim: false,
		wlAnimPattern: 'orbit',
		wlAnimSpeed: 0.25,
		textTick: 0,
		bgIndex: 0,
		phase: 0
	};

	const hud = common.bindHudMetrics({
		elFps: qs('[data-dyn-role="raf-fps"]'),
		elFrameMs: qs('[data-dyn-role="raf-ms"]'),
		elRenderMs: qs('[data-dyn-role="render-ms"]'),
		maxSamples: 48
	});

	j0.bus.on('dyn:presets-changed', () => hud.resetSamples());

	function mutateText() {
		anim.textTick++;
		for (let i = 0; i < textSlots.length; i++) {
			const slot = textSlots[i];
			const list = CASE_VARIANTS[i] || CASE_VARIANTS[0];
			const sc = list[anim.textTick % list.length];
			slot.el.classList.toggle('is-dark-ink', sc.darkInk);
			if (slot.titleEl) slot.titleEl.textContent = sc.title;
			if (slot.copyHeadEl) slot.copyHeadEl.textContent = sc.head;
			if (slot.copyAccentEl) slot.copyAccentEl.textContent = sc.accent;
			if (slot.copyTailEl) slot.copyTailEl.textContent = sc.tail;
		}
	}

	function swapBackground() {
		if (!bg1El || !bg2El || !bgUrls.length) return;
		anim.bgIndex = (anim.bgIndex + 1) % bgUrls.length;
		const nextUrl = bgUrls[anim.bgIndex];
		const incoming = activeBgLayer === 1 ? bg2El : bg1El;
		const outgoing = activeBgLayer === 1 ? bg1El : bg2El;

		incoming.classList.add('is-instant');
		incoming.style.setProperty('--dyn-bg-img', 'url("' + nextUrl + '")');
		void incoming.offsetWidth;
		incoming.classList.remove('is-instant');
		incoming.classList.add('is-active');
		outgoing.classList.remove('is-active');
		activeBgLayer = activeBgLayer === 1 ? 2 : 1;
	}

	function resetPositions() {
		anim.phase = 0;
		for (let i = 0; i < textSlots.length; i++) {
			const el = textSlots[i].el;
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

		anim.phase += dtSec * anim.wlAnimSpeed;
		const t = anim.phase;

		if (anim.wlBgPan) {
			const pos = common.panPosition(t * 0.7);
			stageEl.style.setProperty('--dyn-bg-x', pos.x.toFixed(1) + '%');
			stageEl.style.setProperty('--dyn-bg-y', pos.y.toFixed(1) + '%');
		}

		if (!anim.wlAnim) return;

		const baseW = Math.min(340, Math.max(240, Math.floor((sw - 96) / 2)));
		const baseH = 190;
		const maxX = Math.max(24, sw - baseW - 24);
		const maxY = Math.max(24, sh - baseH - 24);
		const cx = maxX * 0.5;
		const cy = maxY * 0.5;

		for (let i = 0; i < textSlots.length; i++) {
			const el = textSlots[i].el;
			const angle = t * 1.1 + (i * Math.PI) / 2;
			let x = cx;
			let y = cy;
			let w = baseW;
			let h = baseH;

			if (anim.wlAnimPattern === 'orbit') {
				x = cx + Math.cos(angle) * (cx * 0.72);
				y = cy + Math.sin(angle) * (cy * 0.72);
			} else if (anim.wlAnimPattern === 'cross') {
				const wave = Math.sin(t * 1.4 + i * 0.85);
				x = cx + wave * (cx * 0.75) * (i % 2 === 0 ? 1 : -1);
				y = cy + Math.cos(t * 1.15 + i * 0.7) * (cy * 0.65);
			} else if (anim.wlAnimPattern === 'pulse') {
				const col = i % 2;
				const row = Math.floor(i / 2);
				const scaleWave = 0.8 + 0.35 * Math.sin(t * 1.8 + i * 1.1);
				w = Math.round(baseW * scaleWave);
				h = Math.round(baseH * (0.85 + 0.25 * Math.cos(t * 1.5 + i)));
				x = 28 + col * (sw * 0.46);
				y = 28 + row * (sh * 0.46);
			}

			el.style.setProperty('--dyn-x', Math.round(x) + 'px');
			el.style.setProperty('--dyn-y', Math.round(y) + 'px');
			el.style.setProperty('--dyn-w', w + 'px');
			el.style.setProperty('--dyn-h', h + 'px');
		}
	}

	function tick(now) {
		const dtMs = hud.tickFrame(now);

		if (anim.wlText) {
			if (anim.wlTextRate === 'frame') mutateText();
			else if (now - lastTextAt >= (Number(anim.wlTextRate) || 450)) { lastTextAt = now; mutateText(); }
		}

		if (anim.wlBg && now - lastBgAt >= (Number(anim.wlBgRate) || 1500)) {
			lastBgAt = now;
			swapBackground();
		}

		stepAnimation(Math.min(0.1, dtMs / 1000));
		requestAnimationFrame(tick);
	}

	const bindCheck = (ctrlName, key) => {
		const el = qs('[data-dyn-control="' + ctrlName + '"]');
		if (el) el.addEventListener('change', () => { anim[key] = el.checked; });
	};
	bindCheck('wl-text', 'wlText');
	bindCheck('wl-bg', 'wlBg');
	bindCheck('wl-bg-pan', 'wlBgPan');
	bindCheck('wl-anim', 'wlAnim');

	const bindSelect = (ctrlName, key, onChange) => {
		const el = qs('[data-dyn-control="' + ctrlName + '"]');
		if (el) el.addEventListener('change', () => { anim[key] = el.value; if (onChange) onChange(el.value); });
	};
	bindSelect('wl-text-rate', 'wlTextRate');
	bindSelect('wl-bg-rate', 'wlBgRate');
	bindSelect('wl-bg-fade', 'wlBgFade', (v) => {
		if (stageEl) stageEl.style.setProperty('--dyn-bg-fade', (Number(v) || 0) + 'ms');
	});
	bindSelect('wl-anim-pattern', 'wlAnimPattern');

	const speedRange = qs('[data-dyn-control="wl-anim-speed"]');
	if (speedRange) {
		speedRange.addEventListener('input', () => {
			anim.wlAnimSpeed = Number(speedRange.value) || 1;
			if (speedLabel) speedLabel.textContent = anim.wlAnimSpeed.toFixed(2) + 'x';
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
	if (btnStep) btnStep.addEventListener('click', () => { mutateText(); swapBackground(); stepAnimation(0.25); });

	const btnReset = qs('[data-dyn-action="reset-layout"]');
	if (btnReset) btnReset.addEventListener('click', resetPositions);

	poolSvc.createPoolManager({
		defaultCount: 10,
		width: 1280,
		height: 800,
		onChange: (urls) => {
			bgUrls = urls;
			anim.bgIndex = 0;
			if (bg1El && bg2El && bgUrls.length) {
				bg1El.classList.add('is-instant');
				bg2El.classList.add('is-instant');
				bg1El.style.setProperty('--dyn-bg-img', 'url("' + bgUrls[0] + '")');
				bg1El.classList.add('is-active');
				bg2El.classList.remove('is-active');
				void bg1El.offsetWidth;
				bg1El.classList.remove('is-instant');
				bg2El.classList.remove('is-instant');
				activeBgLayer = 1;
				j0.bus.emit('ipax-backdrop:invalidate', { reason: 'pool-updated' });
			}
		}
	});

	requestAnimationFrame(tick);
})(typeof globalThis !== 'undefined' ? globalThis : window);