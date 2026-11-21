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
/* === SOURCE: 0010-performance-common.js === */
// PATH: examples/js/performance-common/0010-performance-common.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	const SPEEDS = Object.freeze({
		slow: Object.freeze({ label: 'Slow', panHz: 0.08, swapMs: 6000 }),
		medium: Object.freeze({ label: 'Medium', panHz: 0.22, swapMs: 3000 }),
		fast: Object.freeze({ label: 'Fast', panHz: 0.55, swapMs: 1200 })
	});

	function panPosition(phase) {
		const x = 50 + Math.sin(phase) * 48;
		const y = 50 + Math.cos(phase * 0.78) * 48;
		return {
			x,
			y,
			css: x.toFixed(1) + '% ' + y.toFixed(1) + '%'
		};
	}

	function bindHudMetrics(opts) {
		const elFps = opts.elFps || null;
		const elFrameMs = opts.elFrameMs || null;
		const elRenderMs = opts.elRenderMs || null;
		const elBackend = opts.elBackend || null;
		const maxSamples = opts.maxSamples || 32;

		const renderSamples = [];
		let rafFrames = 0;
		let rafWindowStart = performance.now();
		let rafLastFrame = performance.now();
		let smoothedFrameMs = 16.7;

		function flushRenderMs() {
			if (!elRenderMs || !renderSamples.length) return;
			let sum = 0;
			for (let i = 0; i < renderSamples.length; i++) sum += renderSamples[i];
			elRenderMs.textContent = (sum / renderSamples.length).toFixed(1);
		}

		if (j0.bus) {
			j0.bus.on('ipax-backdrop:updated', (d) => {
				if (!d || typeof d.ms !== 'number') return;
				renderSamples.push(d.ms);
				if (renderSamples.length > maxSamples) renderSamples.shift();
				flushRenderMs();
			});

			if (elBackend) {
				j0.bus.on('ipax-backdrop:backend', (d) => {
					if (d && d.backend) elBackend.textContent = d.backend;
				});
			}
		}

		function tickFrame(now) {
			const dtMs = now - rafLastFrame;
			rafLastFrame = now;
			smoothedFrameMs = smoothedFrameMs * 0.85 + dtMs * 0.15;
			rafFrames++;

			if (now - rafWindowStart >= 400) {
				const fps = (rafFrames * 1000) / (now - rafWindowStart);
				if (elFps) elFps.textContent = fps.toFixed(0);
				if (elFrameMs) elFrameMs.textContent = smoothedFrameMs.toFixed(1);
				rafFrames = 0;
				rafWindowStart = now;
			}
			return dtMs;
		}

		function resetSamples() {
			renderSamples.length = 0;
		}

		return { tickFrame, resetSamples };
	}

	function bindBenchmarkNav() {
		const sel = document.querySelector('[data-perf-control="benchmark-nav"]');
		if (!sel) return;
		sel.addEventListener('change', () => {
			if (sel.value) global.location.href = sel.value;
		});
	}

	bindBenchmarkNav();

	j0.register('ipax-backdrop:perf-common', Object.freeze({
		SPEEDS,
		panPosition,
		bindHudMetrics,
		bindBenchmarkNav
	}));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0020-performance-pool.js === */
// PATH: examples/js/performance-common/0020-performance-pool.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	function createPoolManager(opts) {
		const count = opts.defaultCount || 16;
		const width = opts.width || 640;
		const height = opts.height || 480;
		const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};

		let items = [];
		let sourceType = 'random';

		const dlg = document.querySelector('[data-perf-modal="bg"]');
		const gridEl = dlg ? dlg.querySelector('[data-perf-role="pool-grid"]') : null;
		const itemTpl = dlg ? dlg.querySelector('[data-perf-tpl="pool-item"]') : null;
		const summaryEl = dlg ? dlg.querySelector('[data-perf-role="pool-summary"]') : null;
		const fileInput = dlg ? dlg.querySelector('[data-perf-control="pool-files"]') : null;
		const dropEl = dlg ? dlg.querySelector('[data-perf-role="pool-drop"]') : null;

		function revokeList(list) {
			for (let i = 0; i < list.length; i++) {
				if (list[i].isBlob) URL.revokeObjectURL(list[i].url);
			}
		}

		function updateTriggers() {
			const label = '\ud83d\uddbc\ufe0f Backgrounds (' + items.length + ')';
			document.querySelectorAll('[data-perf-action="open-bg-modal"]').forEach((btn) => {
				btn.textContent = label;
			});
			if (summaryEl) {
				summaryEl.textContent = items.length + ' ' + (sourceType === 'local' ? 'local' : 'generated') + ' image(s)';
			}
		}

		function renderGrid() {
			if (!gridEl || !itemTpl) return;
			gridEl.textContent = '';
			const frag = document.createDocumentFragment();
			for (let i = 0; i < items.length; i++) {
				const clone = itemTpl.content.firstElementChild.cloneNode(true);
				const img = clone.querySelector('img');
				const rm = clone.querySelector('[data-perf-remove]');
				if (img) {
					img.src = items[i].url;
					img.alt = items[i].name;
				}
				if (rm) rm.setAttribute('data-perf-remove', String(i));
				frag.appendChild(clone);
			}
			gridEl.appendChild(frag);
			updateTriggers();
		}

		function emitChange() {
			renderGrid();
			const urls = items.map((it) => it.url);
			onChange(urls, { sourceType, count: items.length });
			if (j0.bus) j0.bus.emit('perf:pool-changed', { urls, sourceType, count: items.length });
		}

		function generateRandom() {
			const gen = j0.get('example:images');
			if (!gen) return;

			revokeList(items);
			items = [];
			sourceType = 'random';

			const totalPalettes = gen.paletteCount();
			const baseOffset = Math.floor(Math.random() * totalPalettes);
			for (let i = 0; i < count; i++) {
				const palIndex = (baseOffset + i * 11) % totalPalettes;
				const url = gen.generate(width, height, palIndex, {
					colors: [2, 8],
					colorOrder: 'random',
					patternSeed: 'rand'
				});
				items.push({ url: url, name: 'Generated #' + (i + 1), isBlob: false });
			}
			emitChange();
		}

		function loadFiles(fileList) {
			const files = Array.from(fileList || []).filter((f) => f && f.type && f.type.startsWith('image/'));
			if (!files.length) return;
			if (sourceType !== 'local') {
				revokeList(items);
				items = [];
				sourceType = 'local';
			}
			for (let i = 0; i < files.length; i++) {
				items.push({ url: URL.createObjectURL(files[i]), name: files[i].name, isBlob: true });
			}
			emitChange();
		}

		function removeAt(idx) {
			if (idx < 0 || idx >= items.length) return;
			if (items.length === 1) {
				generateRandom();
				return;
			}
			const [removed] = items.splice(idx, 1);
			if (removed && removed.isBlob) URL.revokeObjectURL(removed.url);
			emitChange();
		}

		if (dlg) {
			dlg.addEventListener('click', (e) => {
				if (e.target === dlg) { dlg.close(); return; }
				const act = e.target.closest('[data-perf-action]');
				if (act) {
					const name = act.getAttribute('data-perf-action');
					if (name === 'pool-close') dlg.close();
					else if (name === 'pool-random') generateRandom();
					return;
				}
				const rm = e.target.closest('[data-perf-remove]');
				if (rm) removeAt(Number(rm.getAttribute('data-perf-remove')));
			});
		}

		if (fileInput) {
			fileInput.addEventListener('change', () => {
				loadFiles(fileInput.files);
				fileInput.value = '';
			});
		}

		if (dropEl) {
			dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.classList.add('is-dragover'); });
			dropEl.addEventListener('dragleave', () => dropEl.classList.remove('is-dragover'));
			dropEl.addEventListener('drop', (e) => {
				e.preventDefault();
				dropEl.classList.remove('is-dragover');
				if (e.dataTransfer) loadFiles(e.dataTransfer.files);
			});
		}

		document.addEventListener('click', (e) => {
			const trigger = e.target.closest('[data-perf-action="open-bg-modal"]');
			if (trigger && dlg && typeof dlg.showModal === 'function') dlg.showModal();
		});

		global.addEventListener('pagehide', () => revokeList(items));
		generateRandom();

		return {
			getUrls: () => items.map((it) => it.url),
			generateRandom,
			openModal: () => { if (dlg && typeof dlg.showModal === 'function') dlg.showModal(); }
		};
	}

	j0.register('ipax-backdrop:perf-pool', Object.freeze({ createPoolManager }));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0010-performance-longpage.js === */
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
