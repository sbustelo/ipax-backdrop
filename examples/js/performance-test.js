/* PATH: examples/js/performance-test.js */
(function () {
	'use strict';

	if (window.ExampleImages) window.ExampleImages.generateStylePool(16);

	const j0 = window.j0;
	const ipax = j0 && j0.get('ipax-backdrop');
	if (!ipax) return;

	ipax.config.backend = 'auto';
	ipax.config.performance = 60;
	ipax.config.minBudget = 65536;

	const gridEl = document.querySelector('[data-pt-role="grid"]');
	const elVisible = document.querySelector('[data-pt-role="visible"]');
	const elBackend = document.querySelector('[data-pt-role="backend"]');
	
	const elMs = document.querySelector('[data-pt-role="ms"]');
	const selFps = document.querySelector('[data-pt-control="fps"]');
	const chkEffect = document.querySelector('[data-pt-control="effect"]');
	const rngContrast = document.querySelector('[data-pt-control="contrast"]');
	const numContrast = document.querySelector('[data-pt-num="contrast"]');
	const rngBlur = document.querySelector('[data-pt-control="blur"]');
	const numBlur = document.querySelector('[data-pt-num="blur"]');
	const boxes = Array.from(document.querySelectorAll('[data-ipax-backdrop]'));

	const MAX_SAMPLES = 32;
	const recentMs = [];
	let hudPending = false;

	let currentContrast = 4.5;
	let currentBlur = 8;

	function countInViewport() {
		const vh = window.innerHeight;
		const vw = window.innerWidth;
		let count = 0;
		for (let i = 0; i < boxes.length; i++) {
			const r = boxes[i].getBoundingClientRect();
			if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) {
				count++;
			}
		}
		return count;
	}

	function flushHud() {
		hudPending = false;
		if (elVisible) elVisible.textContent = String(countInViewport());
		if (elMs && recentMs.length > 0) {
			let sum = 0;
			for (let i = 0; i < recentMs.length; i++) sum += recentMs[i];
			elMs.textContent = (sum / recentMs.length).toFixed(1);
		}
	}

	function scheduleHud() {
		if (hudPending) return;
		hudPending = true;
		requestAnimationFrame(flushHud);
	}

	function syncContrast(val, invalidate) {
		const parsed = parseFloat(val);
		if (isNaN(parsed)) return;
		currentContrast = Math.min(15, Math.max(1, parsed));
		if (rngContrast) rngContrast.value = String(currentContrast);
		if (numContrast) numContrast.value = String(currentContrast);
		if (gridEl) gridEl.style.setProperty('--pt-contrast', String(currentContrast));
		if (invalidate) window.j0.bus.emit('ipax-backdrop:invalidate', {});
	}

	function syncBlur(val, invalidate) {
		const parsed = parseFloat(val);
		if (isNaN(parsed)) return;
		currentBlur = Math.min(32, Math.max(0, parsed));
		if (rngBlur) rngBlur.value = String(currentBlur);
		if (numBlur) numBlur.value = String(currentBlur);
		if (gridEl) gridEl.style.setProperty('--pt-blur', currentBlur + 'px');
		if (invalidate) window.j0.bus.emit('ipax-backdrop:invalidate', {});
	}

	// Mutar CSS en drag ('input'), pero forzar repintado del motor solo al soltar ('change')
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
			if (chkEffect.checked) window.j0.bus.emit('ipax-backdrop:invalidate', {});
		});
	}

	j0.bus.on('ipax-backdrop:updated', (d) => {
		recentMs.push(d.ms);
		if (recentMs.length > MAX_SAMPLES) recentMs.shift();
		scheduleHud();
	});

	j0.bus.on('ipax-backdrop:backend', (d) => {
		if (elBackend) elBackend.textContent = d.backend;
	});

	window.addEventListener('scroll', scheduleHud, { passive: true });
	window.addEventListener('resize', scheduleHud, { passive: true });
	scheduleHud();
})();