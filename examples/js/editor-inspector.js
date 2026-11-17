// PATH: examples/js/editor-inspector.js
(function () {
	'use strict';

	const { state, qs, qsa, on, emit, markDirty, bindSliderPair, setSliderPair } = window.EdCore;
	const { createBox, cloneBox, deleteActiveBox, applyIpaxProps } = window.EdBoxes;

	const stage = qs('[data-ed-role="stage"]');
	const panelProject = qs('[data-ed-panel="project"]');
	const boxPanels = qs('[data-ed-role="box-panels"]');

	const btnPrimary = qs('[data-ed-action="new-box"]');
	const btnDel = qs('[data-ed-action="delete-box"]');
	const btnEffect = qs('[data-ed-action="toggle-effect"]');

	const btnPadToggle = qs('[data-ed-action="toggle-padding"]');
	const padSubpanel = qs('[data-ed-subpanel="padding-trbl"]');
	const btnFeatherToggle = qs('[data-ed-action="toggle-feather"]');
	const featherSubpanel = qs('[data-ed-subpanel="feather-trbl"]');

	const modeSel = qs('[data-ed-control="ipax-mode"]');
	const chkBoxOn = qs('[data-ed-control="ipax-box-on"]');
	const chkTextOn = qs('[data-ed-control="ipax-text-on"]');
	const subBoxGroup = qs('[data-ed-subgroup="ipax-box"]');
	const subTextGroup = qs('[data-ed-subgroup="ipax-text"]');

	// Instant Delegated Tooltip (single singleton on document.body)
	if (!document.documentElement.dataset.edTipBound) {
		document.documentElement.dataset.edTipBound = '1';
		const existingTips = document.querySelectorAll('[data-ed-role="tooltip"]');
		const tipEl = existingTips[0] || document.createElement('div');
		for (let i = 1; i < existingTips.length; i++) existingTips[i].remove();
		tipEl.className = 'ed-tooltip';
		tipEl.setAttribute('data-ed-role', 'tooltip');
		tipEl.hidden = true;
		if (!tipEl.parentNode && document.body) document.body.appendChild(tipEl);

		let currentTipEl = null;
		const showTip = (host) => {
			const text = host.getAttribute('data-ed-tip');
			if (!text) return;
			if (!tipEl.parentNode && document.body) document.body.appendChild(tipEl);
			currentTipEl = host;
			tipEl.textContent = text;
			tipEl.hidden = false;
			const rect = host.getBoundingClientRect();
			const tw = tipEl.offsetWidth;
			const th = tipEl.offsetHeight;
			const left = Math.min(window.innerWidth - tw - 8, Math.max(8, rect.left + rect.width * 0.5 - tw * 0.5));
			const top = rect.top > th + 10 ? rect.top - th - 6 : rect.bottom + 6;
			tipEl.style.left = `${Math.round(left)}px`;
			tipEl.style.top = `${Math.round(top)}px`;
		};
		const hideTip = () => {
			currentTipEl = null;
			tipEl.hidden = true;
		};
		const trackHost = (e) => {
			const host = e.target && e.target.closest ? e.target.closest('[data-ed-tip]') : null;
			if (!host) {
				if (currentTipEl) hideTip();
				return;
			}
			if (host === currentTipEl) return;
			showTip(host);
		};
		document.addEventListener('pointermove', trackHost, true);
		document.addEventListener('mouseover', trackHost, true);
		document.addEventListener('pointerdown', hideTip, true);
		document.addEventListener('scroll', hideTip, true);
		document.documentElement.addEventListener('mouseleave', hideTip);
		window.addEventListener('blur', hideTip);
		document.addEventListener('focusin', (e) => {
			const host = e.target && e.target.closest ? e.target.closest('[data-ed-tip]') : null;
			if (host) showTip(host);
		});
		document.addEventListener('focusout', hideTip);
	}

	// Font Status Text -> Status Icon Sync
	const fontStatusText = qs('[data-ed-role="font-status"]');
	const fontStatusIcon = qs('[data-ed-role="font-status-icon"]');
	if (fontStatusText && fontStatusIcon) {
		const syncFontStatusIcon = () => {
			const msg = (fontStatusText.textContent || '').trim() || 'System font stack';
			const isError = fontStatusText.classList.contains('is-error') || /error|fail|not found/i.test(msg);
			const isGoogle = !isError && /google/i.test(msg);
			fontStatusIcon.textContent = isError ? 'error' : (isGoogle ? 'cloud_done' : 'computer');
			fontStatusIcon.classList.toggle('is-error', isError);
			fontStatusIcon.classList.toggle('is-google', isGoogle);
			fontStatusIcon.setAttribute('data-ed-tip', msg);
		};
		const fontObs = new MutationObserver(syncFontStatusIcon);
		fontObs.observe(fontStatusText, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
		syncFontStatusIcon();
	}

	// Horizontal Label Scrubbing
	document.addEventListener('pointerdown', (e) => {
		const scrub = e.target.closest('[data-ed-scrub]');
		if (!scrub || e.button !== 0) return;
		const key = scrub.dataset.edScrub;
		const input = qs(`[data-ed-num="${key}"]`) || qs(`[data-ed-control="${key}"]`);
		if (!input || input.disabled) return;
		e.preventDefault();
		const startX = e.clientX;
		const startVal = parseFloat(input.value) || 0;
		const step = parseFloat(input.step) || 1;
		const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
		const max = input.max !== '' ? parseFloat(input.max) : Infinity;
		const decimals = (String(step).split('.')[1] || '').length;

		const onMove = (me) => {
			const delta = Math.round((me.clientX - startX) / 3) * step;
			const next = Math.min(max, Math.max(min, +(startVal + delta).toFixed(decimals)));
			if (parseFloat(input.value) === next) return;
			input.value = String(next);
			input.dispatchEvent(new Event('input', { bubbles: true }));
			input.dispatchEvent(new Event('change', { bubbles: true }));
		};
		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	});

	// Panel & Subpanel Collapsible Carets
	qsa('[data-ed-action="toggle-panel"]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const panel = btn.closest('.ed-panel');
			const body = qs('[data-ed-role="panel-body"]', panel);
			const expanded = btn.getAttribute('aria-expanded') === 'true';
			btn.setAttribute('aria-expanded', String(!expanded));
			btn.innerHTML = !expanded ? '&#9662;' : '&#9656;';
			if (body) body.hidden = expanded;
		});
	});

	qsa('[data-ed-action="toggle-subpanel"]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const group = btn.closest('.ed-sub-group');
			const body = qs('[data-ed-role="sub-body"]', group);
			const expanded = btn.getAttribute('aria-expanded') === 'true';
			btn.setAttribute('aria-expanded', String(!expanded));
			btn.innerHTML = !expanded ? '&#9662;' : '&#9656;';
			if (body) body.hidden = expanded;
		});
	});

	// Project / Export Bindings
	qs('[data-ed-action="save-json"]').addEventListener('click', () => emit('action:save-json'));
	qs('[data-ed-action="save-png"]').addEventListener('click', () => emit('action:save-png'));
	qs('[data-ed-action="reset-project"]').addEventListener('click', () => emit('action:reset'));
	const fileProject = qs('[data-ed-control="project-file"]');
	qs('[data-ed-action="load-json"]').addEventListener('click', () => fileProject.click());
	fileProject.addEventListener('change', (e) => {
		if (e.target.files[0]) emit('action:load-json', e.target.files[0]);
		fileProject.value = '';
	});

	btnPrimary.addEventListener('click', () => {
		if (state.activeBox) { cloneBox(state.activeBox); return; }
		const count = qsa('.ed-box', stage).length;
		const offset = (count % 6) * 26;
		createBox({ left: 64 + offset, top: 64 + offset, width: 340, height: 130, contrast: 4.5, blur: 8, feather: 14, fontSize: 28, text: '', focusText: true });
	});

	btnDel.addEventListener('click', () => deleteActiveBox());

	btnEffect.addEventListener('click', () => {
		state.showEffect = !state.showEffect;
		stage.classList.toggle('is-raw', !state.showEffect);
		btnEffect.classList.toggle('is-active', state.showEffect);
		btnEffect.setAttribute('aria-pressed', String(state.showEffect));
	});

	// Disclosures
	btnPadToggle.addEventListener('click', () => {
		const expanded = btnPadToggle.getAttribute('aria-expanded') === 'true';
		btnPadToggle.setAttribute('aria-expanded', String(!expanded));
		btnPadToggle.innerHTML = !expanded ? '&#9662;' : '&#9656;';
		padSubpanel.hidden = expanded;
	});

	btnFeatherToggle.addEventListener('click', () => {
		const expanded = btnFeatherToggle.getAttribute('aria-expanded') === 'true';
		btnFeatherToggle.setAttribute('aria-expanded', String(!expanded));
		btnFeatherToggle.innerHTML = !expanded ? '&#9662;' : '&#9656;';
		featherSubpanel.hidden = expanded;
	});

	// Position (Single Row X Y W H)
	function syncGeomInputs(box) {
		if (!box) return;
		qs('[data-ed-num="box-x"]').value = String(Math.round(box.offsetLeft));
		qs('[data-ed-num="box-y"]').value = String(Math.round(box.offsetTop));
		qs('[data-ed-num="box-w"]').value = String(Math.round(box.offsetWidth));
		qs('[data-ed-num="box-h"]').value = String(Math.round(box.offsetHeight));
	}

	[
		['box-x', 'left', -Infinity],
		['box-y', 'top', -Infinity],
		['box-w', 'width', 80],
		['box-h', 'height', 36]
	].forEach(([key, prop, minVal]) => {
		const el = qs(`[data-ed-num="${key}"]`);
		if (!el) return;
		el.addEventListener('input', () => {
			if (!state.activeBox) return;
			const raw = parseFloat(el.value);
			if (isNaN(raw)) return;
			const val = Math.max(minVal, Math.round(raw));
			state.activeBox.style[prop] = `${val}px`;
			window.EdCore.refreshBackdrop();
			markDirty();
		});
	});

	on('box:geom', (box) => {
		if (box === state.activeBox) syncGeomInputs(box);
	});

	// Padding TRBL
	const applyPadding = () => {
		if (!state.activeBox) return;
		const p = state.activeBox._state.padding;
		qs('.ed-glass', state.activeBox).style.padding = `${p.t}px ${p.r}px ${p.b}px ${p.l}px`;
		window.EdCore.refreshBackdrop();
	};

	bindSliderPair('box-padding', (v) => {
		if (!state.activeBox) return;
		const p = state.activeBox._state.padding;
		p.t = p.r = p.b = p.l = v;
		['t', 'r', 'b', 'l'].forEach((side) => { qs(`[data-ed-num="box-pad-${side}"]`).value = String(v); });
		applyPadding();
	});

	['t', 'r', 'b', 'l'].forEach((side) => {
		const el = qs(`[data-ed-num="box-pad-${side}"]`);
		el.addEventListener('input', () => {
			if (!state.activeBox) return;
			const v = Math.max(0, Math.min(128, parseFloat(el.value) || 0));
			const p = state.activeBox._state.padding;
			p[side] = v;
			setSliderPair('box-padding', Math.round((p.t + p.r + p.b + p.l) / 4));
			applyPadding();
			markDirty();
		});
	});

	// Enable / Disable Subsections
	function setSubgroupEnabled(groupEl, enabled) {
		groupEl.classList.toggle('is-disabled', !enabled);
		const body = qs('[data-ed-role="sub-body"]', groupEl);
		if (!body) return;
		qsa('input, select', body).forEach((el) => { el.disabled = !enabled; });
	}

	chkBoxOn.addEventListener('change', () => {
		if (!state.activeBox) return;
		const on = chkBoxOn.checked;
		state.activeBox._state.ipax.boxEnabled = on;
		setSubgroupEnabled(subBoxGroup, on);
		applyIpaxProps(state.activeBox);
		markDirty();
	});

	chkTextOn.addEventListener('change', () => {
		if (!state.activeBox) return;
		const on = chkTextOn.checked;
		state.activeBox._state.ipax.textEnabled = on;
		setSubgroupEnabled(subTextGroup, on);
		applyIpaxProps(state.activeBox);
		markDirty();
	});

	// IPAX Props
	modeSel.addEventListener('change', () => {
		if (!state.activeBox) return;
		state.activeBox._state.ipax.mode = modeSel.value;
		applyIpaxProps(state.activeBox);
		markDirty();
	});

	bindSliderPair('ipax-contrast', (v) => {
		if (!state.activeBox) return;
		state.activeBox._state.ipax.contrast = v;
		applyIpaxProps(state.activeBox);
	});

	bindSliderPair('ipax-blur', (v) => {
		if (!state.activeBox) return;
		state.activeBox._state.ipax.blur = v;
		applyIpaxProps(state.activeBox);
	});

	bindSliderPair('ipax-feather', (v) => {
		if (!state.activeBox) return;
		const f = state.activeBox._state.ipax.feather;
		f.t = f.r = f.b = f.l = v;
		['t', 'r', 'b', 'l'].forEach((side) => { qs(`[data-ed-num="ipax-feather-${side}"]`).value = String(v); });
		applyIpaxProps(state.activeBox);
	});

	['t', 'r', 'b', 'l'].forEach((side) => {
		const el = qs(`[data-ed-num="ipax-feather-${side}"]`);
		el.addEventListener('input', () => {
			if (!state.activeBox) return;
			const v = Math.max(0, Math.min(128, parseFloat(el.value) || 0));
			const f = state.activeBox._state.ipax.feather;
			f[side] = v;
			setSliderPair('ipax-feather', Math.round((f.t + f.r + f.b + f.l) / 4));
			applyIpaxProps(state.activeBox);
			markDirty();
		});
	});

	const ensureTextState = (ip) => {
		if (!ip.text) ip.text = { contrast: 7, halo: 12, spread: 35, blur: 0, x: 0, y: 0 };
		return ip.text;
	};

	['contrast', 'halo', 'spread', 'blur', 'x', 'y'].forEach((prop) => {
		bindSliderPair(`ipax-text-${prop}`, (v) => {
			if (!state.activeBox) return;
			const t = ensureTextState(state.activeBox._state.ipax);
			t[prop] = v;
			applyIpaxProps(state.activeBox);
		});
	});

	on('selection:changed', (box) => {
		boxPanels.hidden = !box;
		panelProject.hidden = !!box;
		btnDel.disabled = !box;
		btnPrimary.textContent = box ? 'Duplicate' : '+ New box';
		btnPrimary.setAttribute('data-ed-tip', box ? 'Duplicate selected box' : 'Create new text box');
		if (!box) return;

		syncGeomInputs(box);

		const ip = box._state.ipax;
		const boxOn = ip.boxEnabled !== false;
		const textOn = !!ip.textEnabled;
		chkBoxOn.checked = boxOn;
		chkTextOn.checked = textOn;
		setSubgroupEnabled(subBoxGroup, boxOn);
		setSubgroupEnabled(subTextGroup, textOn);

		modeSel.value = ip.mode;
		setSliderPair('ipax-contrast', ip.contrast);
		setSliderPair('ipax-blur', ip.blur);
		setSliderPair('ipax-feather', Math.round((ip.feather.t + ip.feather.r + ip.feather.b + ip.feather.l) / 4));
		['t', 'r', 'b', 'l'].forEach((side) => { qs(`[data-ed-num="ipax-feather-${side}"]`).value = String(ip.feather[side]); });

		const t = ensureTextState(ip);
		['contrast', 'halo', 'spread', 'blur', 'x', 'y'].forEach((prop) => setSliderPair(`ipax-text-${prop}`, t[prop]));

		const pad = box._state.padding;
		setSliderPair('box-padding', Math.round((pad.t + pad.r + pad.b + pad.l) / 4));
		['t', 'r', 'b', 'l'].forEach((side) => { qs(`[data-ed-num="box-pad-${side}"]`).value = String(pad[side]); });
	});
})();