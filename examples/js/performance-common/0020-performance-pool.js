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