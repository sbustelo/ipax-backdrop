// PATH: examples/js/performance-common.js
// REEMPLAZAR ARCHIVO COMPLETO EN examples/js/performance-common.js
(function () {
	'use strict';

	const SPEEDS = Object.freeze({
		slow: Object.freeze({ label: 'Slow', panHz: 0.08, swapMs: 6000 }),
		medium: Object.freeze({ label: 'Medium', panHz: 0.22, swapMs: 3000 }),
		fast: Object.freeze({ label: 'Fast', panHz: 0.55, swapMs: 1200 })
	});

	const BENCHMARKS = Object.freeze([
		{ id: 'longpage', label: 'Long Page (400 Boxes)', href: 'performance-longpage.php' },
		{ id: 'motion', label: 'Motion & Presets', href: 'performance-motion.html' }
	]);

	function panPosition(phase) {
		const x = 50 + Math.sin(phase) * 48;
		const y = 50 + Math.cos(phase * 0.78) * 48;
		return {
			x,
			y,
			css: `${x.toFixed(1)}% ${y.toFixed(1)}%`
		};
	}

	function bindHudMetrics(opts) {
		const j0 = window.j0;
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

		if (j0 && j0.bus) {
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

	function createPoolManager(opts) {
		const count = opts.defaultCount || 16;
		const width = opts.width || 640;
		const height = opts.height || 480;
		const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};

		let items = [];
		let sourceType = 'random';

		const dlg = document.querySelector('[data-perf-modal="bg"]');
		const gridEl = dlg ? dlg.querySelector('[data-perf-role="pool-grid"]') : null;
		const summaryEl = dlg ? dlg.querySelector('[data-perf-role="pool-summary"]') : null;
		const fileInput = dlg ? dlg.querySelector('[data-perf-control="pool-files"]') : null;
		const dropEl = dlg ? dlg.querySelector('[data-perf-role="pool-drop"]') : null;

		function revokeAll() {
			for (let i = 0; i < items.length; i++) {
				if (items[i].isBlob) URL.revokeObjectURL(items[i].url);
			}
		}

		function updateTriggers() {
			const label = `\ud83d\uddbc\ufe0f Backgrounds (${items.length})`;
			document.querySelectorAll('[data-perf-action="open-bg-modal"]').forEach((btn) => {
				btn.textContent = label;
			});
			if (summaryEl) {
				summaryEl.textContent = `${items.length} ${sourceType === 'local' ? 'local' : 'generated'} image(s)`;
			}
		}

		function renderGrid() {
			if (!gridEl) return;
			gridEl.textContent = '';
			for (let i = 0; i < items.length; i++) {
				const cell = document.createElement('div');
				cell.className = 'perf-modal-item';

				const img = document.createElement('img');
				img.src = items[i].url;
				img.alt = items[i].name;
				img.loading = 'lazy';

				const rm = document.createElement('button');
				rm.type = 'button';
				rm.className = 'perf-modal-rm';
				rm.setAttribute('data-perf-remove', String(i));
				rm.setAttribute('aria-label', 'Remove image');
				rm.textContent = '\u00d7';

				cell.appendChild(img);
				cell.appendChild(rm);
				gridEl.appendChild(cell);
			}
			updateTriggers();
		}

		function emitChange() {
			renderGrid();
			onChange(items.map((it) => it.url), { sourceType, count: items.length });
		}

		function generateRandom() {
			revokeAll();
			items = [];
			sourceType = 'random';
			if (window.ExampleImages) {
				const baseOffset = Math.floor(Math.random() * window.ExampleImages.paletteCount());
				for (let i = 0; i < count; i++) {
					const palIndex = (baseOffset + i * 11) % window.ExampleImages.paletteCount();
					const url = window.ExampleImages.generate(width, height, palIndex, {
						colors: [2, 8],
						colorOrder: 'random',
						patternSeed: 'rand'
					});
					items.push({ url, name: `Generated #${i + 1}`, isBlob: false });
				}
			}
			emitChange();
		}

		function loadFiles(fileList) {
			const files = Array.from(fileList || []).filter((f) => f && f.type && f.type.startsWith('image/'));
			if (!files.length) return;
			if (sourceType !== 'local') {
				revokeAll();
				items = [];
				sourceType = 'local';
			}
			for (let i = 0; i < files.length; i++) {
				items.push({
					url: URL.createObjectURL(files[i]),
					name: files[i].name,
					isBlob: true
				});
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
				if (e.target === dlg) {
					dlg.close();
					return;
				}
				const act = e.target.closest('[data-perf-action]');
				if (act) {
					const name = act.getAttribute('data-perf-action');
					if (name === 'pool-close') dlg.close();
					else if (name === 'pool-random') generateRandom();
					return;
				}
				const rm = e.target.closest('[data-perf-remove]');
				if (rm) {
					removeAt(Number(rm.getAttribute('data-perf-remove')));
				}
			});
		}

		if (fileInput) {
			fileInput.addEventListener('change', () => {
				loadFiles(fileInput.files);
				fileInput.value = '';
			});
		}

		if (dropEl) {
			dropEl.addEventListener('dragover', (e) => {
				e.preventDefault();
				dropEl.classList.add('is-dragover');
			});
			dropEl.addEventListener('dragleave', () => {
				dropEl.classList.remove('is-dragover');
			});
			dropEl.addEventListener('drop', (e) => {
				e.preventDefault();
				dropEl.classList.remove('is-dragover');
				if (e.dataTransfer) loadFiles(e.dataTransfer.files);
			});
		}

		document.addEventListener('click', (e) => {
			const trigger = e.target.closest('[data-perf-action="open-bg-modal"]');
			if (trigger && dlg && typeof dlg.showModal === 'function') {
				dlg.showModal();
			}
		});

		generateRandom();

		return {
			getUrls: () => items.map((it) => it.url),
			generateRandom,
			openModal: () => { if (dlg && typeof dlg.showModal === 'function') dlg.showModal(); }
		};
	}

	function mountBenchmarkNav(selector) {
		const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
		if (!host) return '';
		const path = window.location.pathname;
		const isDyn = host.closest('.dyn-hud') !== null;

		const wrap = document.createElement('label');
		wrap.className = isDyn ? 'dyn-field dyn-field-nav' : 'pt-hud-group';

		const span = document.createElement('span');
		span.className = isDyn ? 'dyn-nav-label' : 'pt-hud-nav-label';
		span.textContent = 'Test:';

		const sel = document.createElement('select');
		sel.className = isDyn ? 'dyn-select dyn-select-compact' : 'pt-hud-select';
		sel.setAttribute('aria-label', 'Select performance benchmark');

		let matchedId = '';
		BENCHMARKS.forEach((b) => {
			const opt = document.createElement('option');
			opt.value = b.href;
			opt.textContent = b.label;
			if (path.indexOf(b.href) >= 0) {
				opt.selected = true;
				matchedId = b.id;
			}
			sel.appendChild(opt);
		});

		sel.addEventListener('change', () => {
			window.location.href = sel.value;
		});

		wrap.appendChild(span);
		wrap.appendChild(sel);
		host.appendChild(wrap);
		return matchedId;
	}

	window.PerfCommon = Object.freeze({
		SPEEDS,
		BENCHMARKS,
		panPosition,
		bindHudMetrics,
		createPoolManager,
		mountBenchmarkNav
	});
})();