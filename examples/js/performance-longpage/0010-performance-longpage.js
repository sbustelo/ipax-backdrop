// PATH: examples/js/performance-longpage/0010-performance-longpage.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const ipax = j0 && j0.get('ipax-backdrop');
	const common = j0 && j0.get('ipax-backdrop:perf-common');
	const poolSvc = j0 && j0.get('ipax-backdrop:perf-pool');
	if (!ipax || !common || !poolSvc) return;

	ipax.config.backend = 'auto';
	ipax.config.performance = 60;
	ipax.config.minBudget = 65536;

	const gridEl = document.querySelector('[data-pt-role="grid"]');
	const elVisible = document.querySelector('[data-pt-role="visible"]');
	const elBackend = document.querySelector('[data-pt-role="backend"]');
	const elMs = document.querySelector('[data-pt-role="ms"]');
	const elRafFps = document.querySelector('[data-pt-role="raf-fps"]');

	const selFps = document.querySelector('[data-pt-control="fps"]');
	const chkEffect = document.querySelector('[data-pt-control="effect"]');
	const rngContrast = document.querySelector('[data-pt-control="contrast"]');
	const numContrast = document.querySelector('[data-pt-num="contrast"]');
	const rngBlur = document.querySelector('[data-pt-control="blur"]');
	const numBlur = document.querySelector('[data-pt-num="blur"]');

	const chkBgMotion = document.querySelector('[data-pt-control="bg-motion"]');
	const chkBgSwap = document.querySelector('[data-pt-control="bg-swap"]');
	const selBgSpeed = document.querySelector('[data-pt-control="bg-speed"]');

	const cells = Array.from(document.querySelectorAll('[data-pt-cell]'));
	const boxes = Array.from(document.querySelectorAll('[data-ipax-backdrop]'));

	let poolUrls = [];
	let swapOffset = 0;
	let motionPhase = 0;
	let lastSwapAt = performance.now();
	let visiblePending = false;

	function applyCellBackgrounds() {
		const len = poolUrls.length;
		if (!len) return;
		for (let i = 0; i < cells.length; i++) {
			const url = poolUrls[(i + swapOffset) % len];
			cells[i].style.setProperty('--pt-bg', 'url("' + url + '")');
		}
	}

	poolSvc.createPoolManager({
		defaultCount: 16,
		width: 640,
		height: 480,
		onChange: (urls) => {
			poolUrls = urls;
			swapOffset = 0;
			applyCellBackgrounds();
			j0.bus.emit('ipax-backdrop:invalidate', { reason: 'pool-updated' });
		}
	});

	const hud = common.bindHudMetrics({
		elFps: elRafFps,
		elRenderMs: elMs,
		elBackend,
		maxSamples: 32
	});

	function countInViewport() {
		const vh = global.innerHeight;
		const vw = global.innerWidth;
		let count = 0;
		for (let i = 0; i < boxes.length; i++) {
			const r = boxes[i].getBoundingClientRect();
			if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) count++;
		}
		return count;
	}

	function scheduleVisibleCount() {
		if (visiblePending) return;
		visiblePending = true;
		requestAnimationFrame(() => {
			visiblePending = false;
			if (elVisible) elVisible.textContent = String(countInViewport());
		});
	}

	function syncContrast(val, invalidate) {
		const parsed = parseFloat(val);
		if (isNaN(parsed)) return;
		const clamped = Math.min(15, Math.max(1, parsed));
		if (rngContrast) rngContrast.value = String(clamped);
		if (numContrast) numContrast.value = String(clamped);
		if (gridEl) gridEl.style.setProperty('--pt-contrast', String(clamped));
		if (invalidate) j0.bus.emit('ipax-backdrop:invalidate', { reason: 'contrast-slider' });
	}

	function syncBlur(val, invalidate) {
		const parsed = parseFloat(val);
		if (isNaN(parsed)) return;
		const clamped = Math.min(32, Math.max(0, parsed));
		if (rngBlur) rngBlur.value = String(clamped);
		if (numBlur) numBlur.value = String(clamped);
		if (gridEl) gridEl.style.setProperty('--pt-blur', clamped + 'px');
		if (invalidate) j0.bus.emit('ipax-backdrop:invalidate', { reason: 'blur-slider' });
	}

	function syncBgControls() {
		const motionOn = !!(chkBgMotion && chkBgMotion.checked);
		const swapOn = !!(chkBgSwap && chkBgSwap.checked);
		if (selBgSpeed) selBgSpeed.disabled = (!motionOn && !swapOn);
		if (gridEl) {
			gridEl.classList.toggle('is-bg-motion', motionOn);
			if (!motionOn) {
				gridEl.style.removeProperty('--pt-bg-x');
				gridEl.style.removeProperty('--pt-bg-y');
			}
		}
		j0.bus.emit('ipax-backdrop:invalidate', { reason: 'bg-animation-toggle' });
	}

	function tick(now) {
		const dtMs = hud.tickFrame(now);
		const speedKey = (selBgSpeed && selBgSpeed.value) || 'medium';
		const speedCfg = common.SPEEDS[speedKey] || common.SPEEDS.medium;
		let dirty = false;

		if (chkBgMotion && chkBgMotion.checked && gridEl) {
			motionPhase += (dtMs / 1000) * speedCfg.panHz * Math.PI * 2;
			const pos = common.panPosition(motionPhase);
			gridEl.style.setProperty('--pt-bg-x', pos.x.toFixed(1) + '%');
			gridEl.style.setProperty('--pt-bg-y', pos.y.toFixed(1) + '%');
			dirty = true;
		}

		if (chkBgSwap && chkBgSwap.checked && poolUrls.length && now - lastSwapAt >= speedCfg.swapMs) {
			lastSwapAt = now;
			swapOffset = (swapOffset + 1) % poolUrls.length;
			applyCellBackgrounds();
			dirty = true;
		}

		if (dirty) j0.bus.emit('ipax-backdrop:invalidate', { reason: 'bg-animation-tick' });
		requestAnimationFrame(tick);
	}

	if (rngContrast) {
		rngContrast.addEventListener('input', () => syncContrast(rngContrast.value, false));
		rngContrast.addEventListener('change', () => syncContrast(rngContrast.value, true));
	}
	if (numContrast) numContrast.addEventListener('input', () => syncContrast(numContrast.value, true));

	if (rngBlur) {
		rngBlur.addEventListener('input', () => syncBlur(rngBlur.value, false));
		rngBlur.addEventListener('change', () => syncBlur(rngBlur.value, true));
	}
	if (numBlur) numBlur.addEventListener('input', () => syncBlur(numBlur.value, true));

	if (selFps) {
		selFps.addEventListener('change', () => {
			ipax.config.performance = Number(selFps.value);
			ipax.refresh();
		});
	}

	if (chkEffect) {
		chkEffect.addEventListener('change', () => {
			if (gridEl) gridEl.classList.toggle('pt-raw', !chkEffect.checked);
			if (chkEffect.checked) j0.bus.emit('ipax-backdrop:invalidate', { reason: 'toggle-effect' });
		});
	}

	if (chkBgMotion) chkBgMotion.addEventListener('change', syncBgControls);
	if (chkBgSwap) {
		chkBgSwap.addEventListener('change', () => {
			lastSwapAt = performance.now();
			syncBgControls();
		});
	}

	global.addEventListener('scroll', scheduleVisibleCount, { passive: true });
	global.addEventListener('resize', scheduleVisibleCount, { passive: true });
	scheduleVisibleCount();
	requestAnimationFrame(tick);
})(typeof globalThis !== 'undefined' ? globalThis : window);