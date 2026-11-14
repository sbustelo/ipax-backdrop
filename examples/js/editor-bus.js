(function () {
	'use strict';

	const root = document.querySelector('[data-ed-app]');
	const ipax = window.j0 && window.j0.get ? window.j0.get('ipax-backdrop') : null;

	const state = {
		activeBox: null,
		zCounter: 10,
		showBorders: false,
		performance: null,
		stageBg: {
			type: 'none',
			image: '',
			imgFit: 'cover',
			imgOpacity: 100,
			color: '#1a1a1a',
			colorAlpha: 100,
			gradC1: '#1a1a1a',
			gradA1: 100,
			gradC2: '#1a4fd6',
			gradA2: 100,
			gradAngle: 135
		}
	};

	const listeners = new Map();
	let dirtyTimer = null;

	function emit(topic, payload) {
		const list = listeners.get(topic);
		if (list) list.forEach((fn) => fn(payload));
	}

	function on(topic, fn) {
		if (!listeners.has(topic)) listeners.set(topic, []);
		listeners.get(topic).push(fn);
	}

	function qs(selector, scope = root) {
		return scope ? scope.querySelector(selector) : null;
	}

	function qsa(selector, scope = root) {
		return scope ? Array.from(scope.querySelectorAll(selector)) : [];
	}

	function hexToRgba(hex, alphaPct) {
		const clean = (hex || '#000000').replace('#', '');
		const r = parseInt(clean.substring(0, 2), 16) || 0;
		const g = parseInt(clean.substring(2, 4), 16) || 0;
		const b = parseInt(clean.substring(4, 6), 16) || 0;
		const a = Math.max(0, Math.min(1, Number(alphaPct) / 100));
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}

	function rgbToHex(rgbStr) {
		const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(rgbStr || '');
		if (!m) return '#ffffff';
		const hex = (n) => Number(n).toString(16).padStart(2, '0');
		return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
	}

	function markDirty() {
		clearTimeout(dirtyTimer);
		dirtyTimer = setTimeout(() => emit('project:dirty'), 300);
	}

	function bindSliderPair(controlKey, onChange) {
		const rangeEl = qs(`[data-ed-control="${controlKey}"]`);
		const numEl = qs(`[data-ed-num="${controlKey}"]`);
		if (!rangeEl || !numEl) return;
		rangeEl.addEventListener('input', () => {
			numEl.value = rangeEl.value;
			onChange(Number(rangeEl.value));
			markDirty();
		});
		numEl.addEventListener('input', () => {
			rangeEl.value = numEl.value;
			onChange(Number(numEl.value));
			markDirty();
		});
	}

	function setSliderPair(controlKey, value) {
		const rangeEl = qs(`[data-ed-control="${controlKey}"]`);
		const numEl = qs(`[data-ed-num="${controlKey}"]`);
		if (rangeEl) rangeEl.value = value;
		if (numEl) numEl.value = value;
	}

	function clearInlineTextOverrides(textNode, styleProp) {
		if (!textNode) return;
		qsa('font', textNode).forEach((fontEl) => {
			const parent = fontEl.parentNode;
			while (fontEl.firstChild) parent.insertBefore(fontEl.firstChild, fontEl);
			parent.removeChild(fontEl);
		});
		qsa('*', textNode).forEach((el) => {
			el.style[styleProp] = '';
			if (el.getAttribute('style') === '') el.removeAttribute('style');
			if (el.tagName === 'SPAN' && el.attributes.length === 0) {
				const parent = el.parentNode;
				while (el.firstChild) parent.insertBefore(el.firstChild, el);
				parent.removeChild(el);
			}
		});
	}

	function refreshBackdrop() {
		if (ipax && typeof ipax.refresh === 'function') ipax.refresh();
	}

	window.EdCore = {
		root, state, emit, on, qs, qsa, markDirty,
		hexToRgba, rgbToHex, bindSliderPair, setSliderPair,
		clearInlineTextOverrides, refreshBackdrop
	};
})();