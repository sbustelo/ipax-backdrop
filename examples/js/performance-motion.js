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
/* === SOURCE: 0010-performance-motion.js === */
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
;
/* === SOURCE: 0020-performance-motion-anim.js === */
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
