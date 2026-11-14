(function () {
	'use strict';

	const { state, qs, qsa, on, emit, markDirty, bindSliderPair, setSliderPair } = window.EdCore;
	const { createBox, cloneBox, deleteActiveBox, applyIpaxProps } = window.EdBoxes;

	const stage = qs('[data-ed-role="stage"]');
	const panelProject = qs('[data-ed-panel="project"]');
	const boxPanels = qs('[data-ed-role="box-panels"]');
	
	const btnPrimary = qs('[data-ed-action="new-box"]');
	const btnDel = qs('[data-ed-action="delete-box"]');
	const btnBorders = qs('[data-ed-action="toggle-borders"]');
	
	const btnPadToggle = qs('[data-ed-action="toggle-padding"]');
	const padSubpanel = qs('[data-ed-subpanel="padding-trbl"]');
	const btnFeatherToggle = qs('[data-ed-action="toggle-feather"]');
	const featherSubpanel = qs('[data-ed-subpanel="feather-trbl"]');
	
	const modeSel = qs('[data-ed-control="ipax-mode"]');

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

	btnBorders.addEventListener('click', () => {
		state.showBorders = !state.showBorders;
		stage.classList.toggle('show-borders', state.showBorders);
		btnBorders.setAttribute('aria-pressed', String(state.showBorders));
		markDirty();
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
		['t', 'r', 'b', 'l'].forEach(side => setSliderPair(`box-pad-${side}`, v));
		applyPadding();
	});

	['t', 'r', 'b', 'l'].forEach((side) => {
		bindSliderPair(`box-pad-${side}`, (v) => {
			if (!state.activeBox) return;
			const p = state.activeBox._state.padding;
			p[side] = v;
			setSliderPair('box-padding', Math.round((p.t + p.r + p.b + p.l) / 4));
			applyPadding();
		});
	});

	// IPAX Props
	modeSel.addEventListener('change', () => {
		if (!state.activeBox) return;
		state.activeBox._state.ipax.mode = modeSel.value;
		applyIpaxProps(state.activeBox); markDirty();
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
		['t', 'r', 'b', 'l'].forEach(side => setSliderPair(`ipax-feather-${side}`, v));
		applyIpaxProps(state.activeBox);
	});

	['t', 'r', 'b', 'l'].forEach((side) => {
		bindSliderPair(`ipax-feather-${side}`, (v) => {
			if (!state.activeBox) return;
			const f = state.activeBox._state.ipax.feather;
			f[side] = v;
			setSliderPair('ipax-feather', Math.round((f.t + f.r + f.b + f.l) / 4));
			applyIpaxProps(state.activeBox);
		});
	});

	on('selection:changed', (box) => {
		boxPanels.hidden = !box;
		panelProject.hidden = !!box; // Oculto cuando hay caja seleccionada
		btnDel.disabled = !box;
		btnPrimary.textContent = box ? 'Duplicate' : '+ New box';
		btnPrimary.title = box ? 'Duplicate selected box' : 'Create new text box';
		if (!box) return;

		const ip = box._state.ipax;
		modeSel.value = ip.mode;
		setSliderPair('ipax-contrast', ip.contrast);
		setSliderPair('ipax-blur', ip.blur);
		setSliderPair('ipax-feather', Math.round((ip.feather.t + ip.feather.r + ip.feather.b + ip.feather.l) / 4));
		['t', 'r', 'b', 'l'].forEach(side => setSliderPair(`ipax-feather-${side}`, ip.feather[side]));

		const pad = box._state.padding;
		setSliderPair('box-padding', Math.round((pad.t + pad.r + pad.b + pad.l) / 4));
		['t', 'r', 'b', 'l'].forEach(side => setSliderPair(`box-pad-${side}`, pad[side]));
	});
})();