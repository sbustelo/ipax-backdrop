// PATH: examples/js/performance-longpage.js
(function () {
	'use strict';

	const j0 = window.j0;
	const ipax = j0 && j0.get('ipax-backdrop');
	const common = window.PerfCommon;
	if (!ipax || !common) return;

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

	let poolStyleEl = null;
	let poolSize = 16;
	let swapOffset = 0;
	let motionPhase = 0;
	let lastSwapAt = performance.now();
	let visiblePending = false;

	function applyPoolStyles(urls) {
		if (!poolStyleEl) {
			poolStyleEl = document.createElement('style');
			poolStyleEl.setAttribute('data-pt-pool', '');
			document.head.appendChild(poolStyleEl);
		}
		poolSize = Math.max(1, urls.length);
		let css = '';
		for (let i = 0; i < urls.length; i++) {
			css += `.pt-bg-${i} { background-image: url("${urls[i]}"); }\n`;
		}
		poolStyleEl.textContent = css;
		assignCellClasses();
		j0.bus.emit('ipax-backdrop:invalidate', { reason: 'pool-updated' });
	}

	function assignCellClasses() {
		for (let i = 0; i < cells.length; i++) {
			const cell = cells[i];
			const prevIdx = cell.getAttribute('data-pt-bg-idx');
			if (prevIdx !== null) cell.classList.remove(`pt-bg-${prevIdx}`);
			const nextIdx = (i + swapOffset) % poolSize;
			cell.classList.add(`pt-bg-${nextIdx}`);
			cell.setAttribute('data-pt-bg-idx', String(nextIdx));
		}
	}

	common.mountBenchmarkNav('[data-perf-nav="host"]');

	common.createPoolManager({
		defaultCount: 16,
		width: 640,
		height: 480,
		onChange: applyPoolStyles
	});

	const hud = common.bindHudMetrics({

		elFps: elRafFps,
		elRenderMs: elMs,
		elBackend,
		maxSamples: 32
	});

	function countInViewport() {
		const vh = window.innerHeight;
		const vw = window.innerWidth;
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
		if (invalidate) j0.bus.emit('ipax-backdrop:invalidate', {});
	}

	function syncBlur(val, invalidate) {
		const parsed = parseFloat(val);
		if (isNaN(parsed)) return;
		const clamped = Math.min(32, Math.max(0, parsed));
		if (rngBlur) rngBlur.value = String(clamped);
		if (numBlur) numBlur.value = String(clamped);
		if (gridEl) gridEl.style.setProperty('--pt-blur', clamped + 'px');
		if (invalidate) j0.bus.emit('ipax-backdrop:invalidate', {});
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
			gridEl.style.setProperty('--pt-bg-x', `${pos.x.toFixed(1)}%`);
			gridEl.style.setProperty('--pt-bg-y', `${pos.y.toFixed(1)}%`);
			dirty = true;
		}

		if (chkBgSwap && chkBgSwap.checked && now - lastSwapAt >= speedCfg.swapMs) {
			lastSwapAt = now;
			swapOffset = (swapOffset + 1) % poolSize;
			assignCellClasses();
			dirty = true;
		}

		if (dirty) {
			j0.bus.emit('ipax-backdrop:invalidate', { reason: 'bg-animation-tick' });
		}

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
			if (chkEffect.checked) j0.bus.emit('ipax-backdrop:invalidate', {});
		});
	}

	if (chkBgMotion) chkBgMotion.addEventListener('change', syncBgControls);
	if (chkBgSwap) {
		chkBgSwap.addEventListener('change', () => {
			lastSwapAt = performance.now();
			syncBgControls();
		});
	}

	window.addEventListener('scroll', scheduleVisibleCount, { passive: true });
	window.addEventListener('resize', scheduleVisibleCount, { passive: true });
	scheduleVisibleCount();
	requestAnimationFrame(tick);
})();