// PATH: examples/js/index/0010-index-controls.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const root = document.querySelector('[data-ex-ref="root"]');
	if (!j0 || !root) return;

	const ref = (name) => root.querySelector('[data-ex-ref="' + name + '"]');
	const stage = ref('stage');
	const hero = ref('hero');
	if (!stage || !hero) return;

	const textState = { contrast: 7, halo: 12, spread: 35, blur: 6 };

	function syncTextProps() {
		const boxC = stage.querySelector('.ex-text-only');
		if (!boxC) return;
		const spec = '0 2px ' + textState.halo + 'px ' + textState.spread + '% ' + textState.contrast + ':1 ' + textState.blur + 'px';
		boxC.style.setProperty('--ipax-text', spec);
	}

	function applyBoxProp(prop, val) {
		stage.querySelectorAll('.ex-glass').forEach((g) => g.style.setProperty(prop, val));
	}

	root.querySelectorAll('[data-ex-stop-summary]').forEach((el) => {
		['click', 'pointerdown', 'change'].forEach((evt) => {
			el.addEventListener(evt, (e) => e.stopPropagation());
		});
	});

	root.addEventListener('input', (e) => {
		const c = e.target.closest('[data-ex-ctl]');
		if (!c) return;

		const row = c.closest('.ex-row');
		if (row) {
			const partner = row.querySelector(c.type === 'range' ? 'input[type="number"]' : 'input[type="range"]');
			if (partner && partner !== c) partner.value = c.value;
		}

		const k = c.getAttribute('data-ex-ctl');
		if (k === 'effect-mode') {
			hero.classList.toggle('ex-use-overlays', c.value === 'overlays');
			hero.classList.toggle('ex-effect-none', c.value === 'none');
		} else if (k === 'mode') {
			stage.querySelectorAll('.ex-glass, .ex-text-only').forEach((g) => g.style.setProperty('--ipax-mode', c.value));
		} else if (k === 'contrast') {
			applyBoxProp('--ipax-backdrop-contrast', c.value);
		} else if (k === 'backend') {
			document.documentElement.style.setProperty('--ipax-backdrop-backend', c.value);
		} else if (k === 'feather') {
			['top', 'right', 'bottom', 'left'].forEach((s) => applyBoxProp('--ipax-backdrop-feather-' + s, ''));
			applyBoxProp('--ipax-backdrop-feather', c.value + 'px');
			['top', 'right', 'bottom', 'left'].forEach((side) => {
				root.querySelectorAll('[data-ex-ctl="feather-' + side + '"]').forEach((inp) => { inp.value = c.value; });
			});
		} else if (k.indexOf('feather-') === 0) {
			const side = k.replace('feather-', '');
			applyBoxProp('--ipax-backdrop-feather-' + side, c.value + 'px');
			const sides = ['top', 'right', 'bottom', 'left'];
			const vals = sides.map((s) => {
				const el = root.querySelector('input[data-ex-ctl="feather-' + s + '"]');
				return el ? el.value : null;
			});
			if (vals.every((v) => v !== null && v === vals[0])) {
				root.querySelectorAll('[data-ex-ctl="feather"]').forEach((el) => { el.value = vals[0]; });
				sides.forEach((s) => applyBoxProp('--ipax-backdrop-feather-' + s, ''));
				applyBoxProp('--ipax-backdrop-feather', vals[0] + 'px');
			}
		} else if (k === 'blur') {
			stage.style.setProperty('--ex-blur', c.value + 'px');
			stage.querySelectorAll('.ex-glass, .example-hero-block').forEach((g) => g.style.setProperty('--ipax-backdrop-blur', c.value + 'px'));
		} else if (k === 'text-contrast') {
			textState.contrast = parseFloat(c.value) || 1;
			syncTextProps();
		} else if (k === 'text-halo') {
			textState.halo = parseFloat(c.value) || 0;
			syncTextProps();
		} else if (k === 'text-spread') {
			textState.spread = parseFloat(c.value) || 0;
			syncTextProps();
		} else if (k === 'text-blur') {
			textState.blur = parseFloat(c.value) || 0;
			syncTextProps();
		} else if (k === 'overlay') {
			stage.classList.toggle('ex-s-overlay', c.checked);
		} else if (k === 'grad') {
			stage.classList.toggle('ex-s-grad', c.checked);
		} else if (k === 'effect-stage') {
			stage.classList.toggle('ex-raw', !c.checked);
		} else if (k === 'textcolor') {
			stage.style.setProperty('--ex-custom-color', c.value);
		}

		j0.bus.emit('ex:refresh', {});
	});
})(typeof globalThis !== 'undefined' ? globalThis : window);