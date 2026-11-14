(function () {
	'use strict';

	const { state, qs, on, markDirty, clearInlineTextOverrides, refreshBackdrop } = window.EdCore;

	const PRESETS = [
		{ label: 'System UI Stack', value: 'system-ui, -apple-system, sans-serif', tag: 'Stack' },
		{ label: 'Neo-Grotesque Stack', value: "'Helvetica Neue', Arial, sans-serif", tag: 'Stack' },
		{ label: 'Classic Serif Stack', value: "Georgia, 'Times New Roman', serif", tag: 'Stack' },
		{ label: 'Monospace Stack', value: "ui-monospace, 'SFMono-Regular', monospace", tag: 'Stack' },
		{ label: 'Inter', value: 'Inter', tag: 'Google' },
		{ label: 'Roboto', value: 'Roboto', tag: 'Google' },
		{ label: 'Montserrat', value: 'Montserrat', tag: 'Google' },
		{ label: 'Playfair Display', value: 'Playfair Display', tag: 'Google' },
		{ label: 'Lora', value: 'Lora', tag: 'Google' },
		{ label: 'JetBrains Mono', value: 'JetBrains Mono', tag: 'Google' }
	];

	const combo = qs('[data-ed-role="font-combo"]');
	const input = qs('[data-ed-control="char-font"]');
	const toggleBtn = qs('[data-ed-action="toggle-font-menu"]');
	const menu = qs('[data-ed-role="font-menu"]');
	const statusEl = qs('[data-ed-role="font-status"]');

	const metricCtx = document.createElement('canvas').getContext('2d');
	const fontPromises = new Map();

	function isSystemFontInstalled(name) {
		const sample = 'mmmmmmmmmmlli10O@';
		metricCtx.font = '72px monospace';
		const monoW = metricCtx.measureText(sample).width;
		metricCtx.font = '72px serif';
		const serifW = metricCtx.measureText(sample).width;

		metricCtx.font = `72px "${name}", monospace`;
		const testMono = metricCtx.measureText(sample).width;
		metricCtx.font = `72px "${name}", serif`;
		const testSerif = metricCtx.measureText(sample).width;

		return testMono !== monoW || testSerif !== serifW;
	}

	function setStatus(box, msg, isError) {
		box._state.fontStatus = msg;
		box._state.fontError = isError;
		if (state.activeBox === box) {
			statusEl.textContent = msg;
			statusEl.classList.toggle('is-error', isError);
		}
	}

	function applyFamilyToBox(box, familyCss, silent) {
		const glass = qs('.ed-glass', box);
		glass.style.fontFamily = familyCss;
		clearInlineTextOverrides(qs('.ed-box-text', box), 'fontFamily');
		refreshBackdrop();
		if (!silent) markDirty();
	}

	function ensureGoogleFont(clean) {
		const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-');
		if (fontPromises.has(slug)) return fontPromises.get(slug);

		const promise = new Promise((resolve, reject) => {
			const selector = `link[data-ed-gfont="${slug}"]`;
			let link = document.head.querySelector(selector);
			if (link && link.dataset.loaded === '1') return resolve();
			if (link && link.dataset.failed === '1') return reject(new Error('Failed'));
			if (!link) {
				link = document.createElement('link');
				link.rel = 'stylesheet';
				link.dataset.edGfont = slug;
				link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean)}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
				document.head.appendChild(link);
			}
			link.addEventListener('load', () => { link.dataset.loaded = '1'; resolve(); }, { once: true });
			link.addEventListener('error', () => { link.dataset.failed = '1'; fontPromises.delete(slug); reject(new Error('404')); }, { once: true });
		}).then(async () => {
			await document.fonts.load(`16px "${clean}"`);
			if (!document.fonts.check(`16px "${clean}"`)) {
				fontPromises.delete(slug);
				throw new Error('Not available');
			}
		});

		fontPromises.set(slug, promise);
		return promise;
	}

	async function loadFontForBox(box, raw, opts = {}) {
		if (!box) return;
		const silent = Boolean(opts.silent);
		const clean = (raw || '').trim();
		if (!clean) return;

		box._state.fontInput = clean;
		if (state.activeBox === box) input.value = clean;
		if (!silent) markDirty();

		const generics = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
		if (clean.includes(',') || generics.includes(clean.toLowerCase())) {
			applyFamilyToBox(box, clean, silent);
			setStatus(box, 'System font stack', false);
			return;
		}

		if (isSystemFontInstalled(clean)) {
			applyFamilyToBox(box, `"${clean}", sans-serif`, silent);
			setStatus(box, 'Applied system font', false);
			return;
		}

		setStatus(box, 'Loading from Google Fonts...', false);
		try {
			await ensureGoogleFont(clean);
			applyFamilyToBox(box, `"${clean}", sans-serif`, silent);
			setStatus(box, 'Loaded from Google Fonts', false);
		} catch (err) {
			applyFamilyToBox(box, 'sans-serif', silent);
			setStatus(box, '⚠️ Could not load requested system or Google font', true);
		}
	}

	function resolveAndApplyFont(raw) {
		return loadFontForBox(state.activeBox, raw, { silent: false });
	}

	PRESETS.forEach((item) => {
		const li = document.createElement('li');
		li.className = 'ed-combo-item';
		li.innerHTML = `<span>${item.label}</span><span class="ed-combo-tag">${item.tag}</span>`;
		li.addEventListener('mousedown', (e) => {
			e.preventDefault();
			menu.hidden = true;
			resolveAndApplyFont(item.value);
		});
		menu.appendChild(li);
	});

	toggleBtn.addEventListener('click', () => { menu.hidden = !menu.hidden; });
	input.addEventListener('focus', () => { menu.hidden = false; });
	input.addEventListener('change', () => { menu.hidden = true; resolveAndApplyFont(input.value); });
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') { e.preventDefault(); menu.hidden = true; resolveAndApplyFont(input.value); }
		if (e.key === 'Escape') menu.hidden = true;
	});
	document.addEventListener('pointerdown', (e) => {
		if (!combo.contains(e.target)) menu.hidden = true;
	});

	on('selection:changed', (box) => {
		if (!box) return;
		input.value = box._state.fontInput;
		statusEl.textContent = box._state.fontStatus;
		statusEl.classList.toggle('is-error', box._state.fontError);
	});

	window.EdFonts = { loadFontForBox };
})();