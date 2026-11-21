/* === SOURCE: 0010-example-palettes.js === */
// PATH: examples/js/common/0010-example-palettes.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	const PALETTES = Object.freeze([
		['#8E51FB', '#5A46B5', '#006277', '#00364C', '#262D00', '#2A2439', '#330066', '#05020A'],
		['#FFB8C8', '#FFAD85', '#FA82B2', '#EE7AA8', '#BC579C', '#933477', '#7F2F83', '#482282'],
		['#F9D5D9', '#E0C5BB', '#C5A5B0', '#BB9CA6', '#BC579C', '#6D5764', '#624F62', '#403B4E'],
		['#9BD3FF', '#00D490', '#D8A486', '#BC579C', '#008EB3', '#408158', '#890050', '#294F00'],
		['#BECBEE', '#9CC5E2', '#C1A7B0', '#B89DA6', '#BC579C', '#937888', '#6A5963', '#1C414E'],
		['#9AD5DC', '#57B5BC', '#007B8E', '#004D57', '#00313B'],
		['#FFC265', '#FBA51A', '#F7831E', '#00313B'],
		['#79634A', '#676767', '#651E00', '#393939', '#00313B', '#001100', '#0F0504', '#03000F'],
		['#C0D719', '#D7A419', '#94BC57', '#4A944E', '#168857', '#0C622E'],
		['#D7A419', '#D719A4', '#9449C2', '#810083', '#521458'],
		['#FF0000', '#BB003F', '#8A0031', '#5D0027'],
		['#00FF00', '#F78000', '#E54F34', '#FF0000'],
		['#00FF00', '#00DAFF', '#FF949B', '#00BAFF', '#00BA7A', '#FF0000', '#00769A', '#A000C5'],
		['#F4E757', '#00FF00', '#FF0000', '#C7294A', '#BC003B'],
		['#9e897b', '#916f72', '#ff2e26', '#994e53', '#2873ad', '#f3140d', '#564f56', '#bc0600', '#681f23', '#8b0b0a', '#332a2d', '#13283f', '#6c0202', '#4b0e13', '#120e10'],
		['#fac436', '#fdaa56', '#aaafc0', '#aea883', '#9499a5', '#9b8d78', '#a08d0f', '#f83e43', '#777671', '#856647', '#f4283e', '#5e540d', '#db0d23', '#47421a', '#b60819', '#770419'],
		['#a9d486', '#a9d16b', '#9da857', '#81b151', '#80a32e', '#5c960f', '#75746d', '#5f892f', '#f23631', '#ee2110', '#346904', '#4f530f', '#b60306', '#133d02', '#57090b', '#161905'],
		['#356700', '#0a1e00', '#fe190b', '#284600', '#626913', '#c80000'],
		['#709f02', '#283200', '#bc5f05', '#be0000', '#0a0a00', '#466400'],
		['#5b782c', '#0a0a00', '#e63123', '#283214', '#89733b', '#3c3246'],
		['#c4a65f', '#c4c9d5', '#5a4628', '#aaaaaa', '#b48c50', '#281e14'],
		['#e25804', '#c8beb4', '#b10a26', '#fafafa', '#d29696', '#e6d2dc'],
		['#f79122', '#b4641e', '#1e0a00', '#501e00', '#f0b46e', '#d28c28'],
		['#a07939', '#0a0a00', '#2a2c1f', '#463c28', '#786446', '#d2c8be'],
		['#6d8944', '#a51f50', '#324614', '#95993a', '#828c78', '#5a001e'],
		['#f6c812', '#000000', '#463200', '#fadc6e', '#966e00', '#6e5000'],
		['#b4aa44', '#1e1e28', '#64ae6a', '#3c463c', '#786e28', '#aabe6e'],
		['#37442f', '#000a00', '#d2d2d2', '#282828', '#6e6e6e', '#505050'],
		['#e89a01', '#8a9caa', '#e6e6e6', '#bec8c8', '#5a6947', '#fab478'],
		['#a4946a', '#e6dcd2', '#192116', '#0a0a00', '#505630', '#8c320a'],
		['#4e7ea5', '#000000', '#dee011', '#1e1e1e', '#6b5346', '#3c3c00'],
		['#ae9460', '#0a0a00', '#d2c8be', '#b4aa96', '#f0e6e6', '#32321e'],
		['#cebf00', '#3c3200', '#af0f0a', '#826e00', '#141400', '#8c0000'],
		['#637e15', '#0a1400', '#323c00', '#f0dcbe', '#be1e00'],
		['#87ac80', '#f0f0f0', '#eab4aa', '#0a1e1e', '#78966e', '#d0a5ac'],
		['#94ae1d', '#0a0a00', '#b48744', '#3c3c3c', '#324600', '#5a7800'],
		['#021929', '#00000a', '#a38273', '#6e8282', '#503228', '#785a50'],
		['#92725c', '#0a0a00', '#535741', '#dcdcdc', '#3c3c32', '#b4b4b4'],
		['#938252', '#0a0a00', '#535936', '#dcdcd2', '#28281e'],
		['#112505', '#e4b28d', '#322828', '#504646', '#464600', '#be2800'],
		['#1bd7cc', '#001414', '#900405', '#00323c', '#361e52', '#005a5a'],
		['#c6c9d3', '#fafafa', '#df882f', '#dcdcdc', '#a0a0aa', '#82828c'],
		['#b2897b', '#0a0000', '#47576e', '#503228', '#1f1d26', '#828282'],
		['#99552d', '#462814', '#785032', '#1e0a00', '#aa7864', '#aa968c'],
		['#98b008', '#64780a', '#6fb9d6', '#78823c', '#3c500a', '#aaa046'],
		['#799741', '#0a0a00', '#8d95e6', '#f0f0fa', '#3c501e', '#bec8f0'],
		['#dd9f7e', '#0a0000', '#406679', '#d2beaa', '#8c5a3c', '#aa826e'],
		['#75b9de', '#00000a', '#64aac8', '#14283c', '#5a8296'],
		['#ce8039', '#1e1e14', '#6d772e', '#3c461e', '#b4beb4', '#82501e'],
		['#042a30', '#000a0a', '#bc896a', '#aaaaaa', '#c9cbd5', '#f1f0f7'],
		['#ebc680', '#001428', '#6178a9', '#283c46', '#0b2d44', '#f0e6d2'],
		['#b27c58', '#1e140a', '#c8beb4', '#e6dcdc', '#a08c82', '#3c3228'],
		['#c98f4f', '#0a0a0a', '#c5cad5', '#462814', '#786e6e', '#beaa96'],
		['#d1a37c', '#0a0a00', '#c8c8be', '#5a463c', '#32281e', '#826e64'],
		['#3879e0', '#0a1e3c', '#78a0dc', '#b4c8f0', '#324664'],
		['#f9ce9d', '#c8b4a0', '#335c75', '#000a0a', '#fae6b4', '#6e8282'],
		['#c48f4d', '#001e32', '#faf0dc', '#dcd2be', '#5a463c', '#283c46'],
		['#c99267', '#0a0a00', '#c8c8be', '#645046', '#32281e', '#826e64'],
		['#679f2e', '#1e1e1e', '#a3623a', '#3c3c3c', '#000000', '#655809'],
		['#bd7872', '#e6e6e6', '#bfb6c6', '#000000', '#c8a096', '#c3d1da'],
		['#997054', '#0a0000', '#768358', '#968278', '#b4aaa0', '#32281e'],
		['#679cc6', '#000a1e', '#1e506e', '#96bed2', '#003250'],
		['#ddab9e', '#dcdcdc', '#bebebe', '#a0a0a0', '#000000', '#828282'],
		['#fc8509', '#fad296', '#5f83b9', '#321400', '#2b9b83', '#f0963c'],
		['#99552d', '#3c1e0a', '#785032', '#0a0000', '#aa826e', '#463c32']
	]);

	j0.register('example:palettes', PALETTES);
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0020-example-images.js === */
// PATH: examples/js/common/0020-example-images.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	const PALETTES = (j0.get && j0.get('example:palettes')) || [
		['#8E51FB', '#5A46B5', '#006277', '#00364C']
	];

	function hashString(str) {
		let h = 2166136261;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}

	function shuffleArray(arr) {
		for (let j = arr.length - 1; j > 0; j--) {
			const k = Math.floor(Math.random() * (j + 1));
			const tmp = arr[j];
			arr[j] = arr[k];
			arr[k] = tmp;
		}
		return arr;
	}

	function paletteCount() {
		return PALETTES.length;
	}

	function getPalette(index) {
		const n = PALETTES.length;
		const i = ((Math.floor(Number(index) || 0) % n) + n) % n;
		return PALETTES[i].slice();
	}

	function resolveColors(palette, options) {
		let cols;
		let defaultOrder = 'sequential';

		if (Array.isArray(palette)) {
			cols = palette.length ? palette.slice() : PALETTES[0].slice();
		} else if (typeof palette === 'number' && isFinite(palette)) {
			if (Number.isInteger(palette)) {
				cols = getPalette(palette);
			} else {
				const t = palette <= 0 ? 0 : (palette >= 1 ? 0.999999999 : palette);
				cols = getPalette(Math.floor(t * PALETTES.length));
				defaultOrder = 'random';
			}
		} else if (typeof palette === 'string' && palette !== '' && palette !== 'rand') {
			cols = getPalette(hashString(palette));
		} else {
			cols = getPalette(Math.floor(Math.random() * PALETTES.length));
			defaultOrder = 'random';
		}

		const order = options.colorOrder || defaultOrder;
		if (order === 'random') shuffleArray(cols);

		const limit = options.colors;
		if (Array.isArray(limit)) {
			const minC = Math.max(1, Math.floor(Number(limit[0]) || 1));
			const maxC = Math.max(minC, Math.floor(Number(limit[1]) || minC));
			const count = Math.min(cols.length, minC + Math.floor(Math.random() * (maxC - minC + 1)));
			cols = cols.slice(0, count);
		} else if (typeof limit === 'number' && isFinite(limit) && limit > 0) {
			cols = cols.slice(0, Math.min(cols.length, Math.floor(limit)));
		}

		return cols;
	}

	function resolvePatternSeed(patternSeed) {
		if (typeof patternSeed === 'number' && isFinite(patternSeed)) {
			if (Number.isInteger(patternSeed)) {
				const norm = Math.abs(Math.trunc(patternSeed));
				return norm === 0 ? 1 : ((norm - 1) % 2147483646) + 1;
			}
			const t = patternSeed <= 0 ? 0 : (patternSeed >= 1 ? 0.999999999 : patternSeed);
			return Math.floor(t * 2147483646) + 1;
		}
		if (typeof patternSeed === 'string' && patternSeed !== '' && patternSeed !== 'rand') {
			return (hashString(patternSeed) % 2147483646) + 1;
		}
		return Math.floor(Math.random() * 2147483646) + 1;
	}

	function hexToRgb(hex) {
		const n = parseInt(hex.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}

	function renderCanvas(seed, w, h, cols) {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const g = c.getContext('2d');
		const gr = g.createLinearGradient(0, 0, w, h);
		cols.forEach((k, i) => gr.addColorStop(i / Math.max(1, cols.length - 1), k));
		g.fillStyle = gr;
		g.fillRect(0, 0, w, h);
		const rgbs = cols.map(hexToRgb);
		let sd = resolvePatternSeed(seed);
		const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
		for (let i = 0; i < 90; i++) {
			const rgb = rgbs[Math.floor(rnd() * rgbs.length)];
			const alpha = (0.35 + rnd() * 0.45).toFixed(2);
			g.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
			g.beginPath();
			g.arc(rnd() * w, rnd() * h, 6 + rnd() * Math.min(w, h) / 6, 0, 6.283);
			g.fill();
		}
		return c;
	}

	function paintImage(seed, w, h, cols, quality) {
		const c = renderCanvas(seed, w, h, cols);
		const q = (typeof quality === 'number' && quality > 0 && quality <= 1) ? quality : 0.82;
		return c.toDataURL('image/jpeg', q);
	}

	function generate(width, height, palette, options) {
		const opts = options || {};
		const w = Math.max(1, Math.round(Number(width) || 640));
		const h = Math.max(1, Math.round(Number(height) || 480));
		const cols = resolveColors(palette === undefined ? 'rand' : palette, opts);
		const seed = resolvePatternSeed(opts.patternSeed);
		return paintImage(seed, w, h, cols, opts.quality);
	}

	function generateBlob(width, height, palette, options) {
		const opts = options || {};
		const w = Math.max(1, Math.round(Number(width) || 640));
		const h = Math.max(1, Math.round(Number(height) || 480));
		const cols = resolveColors(palette === undefined ? 'rand' : palette, opts);
		const seed = resolvePatternSeed(opts.patternSeed);
		const c = renderCanvas(seed, w, h, cols);
		const q = (typeof opts.quality === 'number' && opts.quality > 0 && opts.quality <= 1) ? opts.quality : 0.82;
		return new Promise((resolve) => c.toBlob((blob) => resolve(blob), 'image/jpeg', q));
	}

	j0.register('example:images', Object.freeze({
		paletteCount,
		getPalette,
		generate,
		generateBlob,
		paintImage,
		PALETTES
	}));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0030-editor-presets.js === */
// PATH: examples/js/common/0030-editor-presets.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	const DEFAULT_PRESET = 'balanced';

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
			minBudget: 16384,
			cellSize: 24,
			maxPixelScale: 1
		}),
		cpu: Object.freeze({
			label: 'CPU Fallback',
			backend: 'cpu',
			performance: 30,
			minBudget: 16384,
			cellSize: 24,
			maxPixelScale: 1
		})
	});

	j0.register('editor:presets', Object.freeze({ DEFAULT_PRESET, PROFILES }));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0010-index-controls.js === */
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
;
/* === SOURCE: 0020-index-example.js === */
// PATH: examples/js/index/0020-index-example.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const ipax = j0 && j0.get('ipax-backdrop');
	const root = document.querySelector('[data-ex-ref="root"]');
	if (!root) return;

	const ref = (name) => root.querySelector('[data-ex-ref="' + name + '"]');
	const stage = ref('stage');
	const report = ref('report');
	const status = ref('status');
	const hero = ref('hero');

	if (!ipax) {
		if (status) status.textContent = 'ipax-backdrop did not load. Check the script paths in index.html.';
		return;
	}

	let z = 20;
	let drag = null;
	const lines = {};
	const notes = [];
	const activeBlobs = new Map();

	function setBg(el, url, isBlob) {
		if (!el) return;
		const prev = activeBlobs.get(el);
		if (prev && prev !== url) URL.revokeObjectURL(prev);
		if (isBlob) activeBlobs.set(el, url);
		else activeBlobs.delete(el);
		el.style.setProperty('--ex-bg-img', 'url("' + url + '")');
		ipax.refresh();
	}

	function setBoxVar(box, prop, val) {
		box.style.setProperty(prop, val);
	}

	stage.querySelectorAll('[data-ex-box]').forEach((b) => {
		setBoxVar(b, '--ex-x', b.getAttribute('data-ex-x') + 'px');
		setBoxVar(b, '--ex-y', b.getAttribute('data-ex-y') + 'px');
		setBoxVar(b, '--ex-w', b.getAttribute('data-ex-w') + 'px');
		setBoxVar(b, '--ex-h', b.getAttribute('data-ex-h') + 'px');
		setBoxVar(b, '--ex-z', b.getAttribute('data-ex-z'));
	});

	stage.addEventListener('pointerdown', (e) => {
		const b = e.target.closest('[data-ex-box]');
		if (!b || !stage.contains(b)) return;
		if (!b.hasAttribute('data-ex-noraise')) setBoxVar(b, '--ex-z', String(++z));
		drag = {
			b,
			grip: !!e.target.closest('[data-ex-grip]'),
			x: e.clientX,
			y: e.clientY,
			l: b.offsetLeft,
			t: b.offsetTop,
			ww: b.offsetWidth,
			hh: b.offsetHeight
		};
		b.setPointerCapture(e.pointerId);
		ipax.refresh();
	});

	stage.addEventListener('pointermove', (e) => {
		if (!drag) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		const b = drag.b;
		if (drag.grip) {
			setBoxVar(b, '--ex-w', Math.max(70, drag.ww + dx) + 'px');
			setBoxVar(b, '--ex-h', Math.max(50, drag.hh + dy) + 'px');
		} else {
			const nx = Math.min(stage.clientWidth - 40, Math.max(40 - b.offsetWidth, drag.l + dx));
			const ny = Math.min(stage.clientHeight - 30, Math.max(30 - b.offsetHeight, drag.t + dy));
			setBoxVar(b, '--ex-x', nx + 'px');
			setBoxVar(b, '--ex-y', ny + 'px');
		}
		ipax.refresh();
	});

	const endDrag = () => { drag = null; };
	stage.addEventListener('pointerup', endDrag);
	stage.addEventListener('pointercancel', endDrag);

	root.addEventListener('change', (e) => {
		const sel = e.target.closest('[data-ex-ctl="imgTarget"]');
		if (sel) {
			if (sel.value) {
				const fInput = ref('file');
				if (fInput) {
					fInput.setAttribute('data-ex-target', sel.value);
					fInput.click();
				}
				sel.value = '';
			}
			return;
		}

		const f = e.target.closest('[data-ex-ref="file"]');
		if (!f || !f.files || !f.files[0]) return;
		const file = f.files[0];
		if (!file.type || !file.type.startsWith('image/')) return;

		const key = f.getAttribute('data-ex-target');
		const dst = key === 'hero' ? hero : (key === 'stage' ? stage : stage.querySelector('[data-ex-img="' + key + '"]'));
		const blobUrl = URL.createObjectURL(file);
		setBg(dst, blobUrl, true);
		f.value = '';
		if (key === 'hero' && hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});

	j0.bus.on('ex:refresh', () => ipax.refresh());

	j0.bus.on('ipax-backdrop:updated', (d) => {
		const host = d.element.closest('[data-ex-label]');
		if (!host || !report) return;
		const r = d.resolver;
		const s = d.stats;
		const b = d.budget;
		const lbl = host.getAttribute('data-ex-label');
		const unkPct = r.cells ? Math.round(100 * r.unknown / r.cells) : 0;
		const minStr = s
			? ', min ' + (s.min === null ? 'n/a' : s.min.toFixed(2) + ':1') + ' (' + s.under + ' px under target)' + (s.inf ? ', ratio unreachable' : '')
			: ', contrast stats: CPU backend only';
		lines[lbl] = lbl + ': ' + d.backend + ', ' + d.params.mode + ' ' + d.params.ratio + ':1'
			+ (b ? ' [Scale: ' + b.s.toFixed(2) + ']' : '') + ', unknown ' + unkPct + '%'
			+ minStr + (d.tainted ? ', cross-origin image' : '') + ', ' + d.ms.toFixed(0) + ' ms';
		report.textContent = Object.keys(lines).map((k) => lines[k]).join('\n');
	});

	const note = (text) => {
		notes.push(text);
		if (notes.length > 4) notes.shift();
		if (status) status.textContent = notes.join('\n');
	};
	j0.bus.on('ipax-backdrop:backend', (d) => note('Backend: ' + d.backend + ' (' + d.reason + ')'));
	j0.bus.on('ipax-backdrop:warning', (d) => note('Warning: ' + d.message));
	j0.bus.on('ipax-backdrop:error', (d) => note('Error: ' + d.message));

	global.addEventListener('pagehide', () => {
		activeBlobs.forEach((url) => URL.revokeObjectURL(url));
		activeBlobs.clear();
	});

	const images = j0.get('example:images');
	if (images) {
		const total = images.paletteCount();
		const idx1 = Math.floor(Math.random() * total);
		const idx2 = (idx1 + 1 + Math.floor(Math.random() * (total - 1))) % total;
		setBg(stage.querySelector('[data-ex-img="a"]'), images.generate(420, 380, idx1, { patternSeed: 'rand' }), false);
		setBg(stage, images.generate(700, 600, idx2, { patternSeed: 'rand' }), false);
	}
})(typeof globalThis !== 'undefined' ? globalThis : window);
