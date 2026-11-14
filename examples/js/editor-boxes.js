(function () {
	'use strict';

	const { state, qs, emit, on, markDirty, refreshBackdrop } = window.EdCore;
	const stage = qs('[data-ed-role="stage"]');

	function cleanEmptyTextNode(textNode) {
		if (!textNode) return;
		if (textNode.textContent.trim() === '' && !textNode.querySelector('img')) textNode.innerHTML = '';
	}

	function removeBoxDom(box) {
		if (!box) return;
		if (box._state && box._state.bg && window.EdBg && window.EdBg.releaseBgImage) {
			window.EdBg.releaseBgImage(box._state.bg);
		}
		const prev = box.previousElementSibling;
		if (prev && prev.tagName && prev.tagName.toLowerCase() === 'ipax-backdrop-layer') prev.remove();
		box.remove();
	}

	function applyIpaxProps(box) {
		const glass = qs('.ed-glass', box);
		const ip = box._state.ipax;
		glass.style.setProperty('--ipax-backdrop-mode', ip.mode);
		glass.style.setProperty('--ipax-backdrop-contrast', String(ip.contrast));
		glass.style.setProperty('--ipax-backdrop-blur', `${ip.blur}px`);
		glass.style.setProperty('--ipax-backdrop-feather', `${ip.feather.t}px ${ip.feather.r}px ${ip.feather.b}px ${ip.feather.l}px`);
		refreshBackdrop();
	}

	function selectBox(box) {
		if (state.activeBox && state.activeBox !== box) {
			state.activeBox.classList.remove('is-selected');
			cleanEmptyTextNode(qs('.ed-box-text', state.activeBox));
		}
		state.activeBox = box;
		if (box) {
			box.classList.add('is-selected');
			box.style.zIndex = String(++state.zCounter);
		}
		emit('selection:changed', box);
	}

	function buildBoxElement(opts) {
		const box = document.createElement('div');
		box.className = 'ed-box';
		box.style.left = `${opts.left ?? 80}px`;
		box.style.top = `${opts.top ?? 80}px`;
		box.style.width = `${opts.width ?? 360}px`;
		box.style.height = `${opts.height ?? 140}px`;

		const fVal = opts.feather ?? 14;
		box._state = opts.clonedState || {
			fontInput: opts.font || 'system-ui, -apple-system, sans-serif',
			fontStatus: 'System font stack', fontError: false,
			padding: { t: 24, r: 24, b: 24, l: 24 },
			bg: { type: 'none', image: '', imgFit: 'cover', imgOpacity: 100, color: '#000000', colorAlpha: 40, gradC1: '#000000', gradA1: 60, gradC2: '#1a4fd6', gradA2: 30, gradAngle: 135 },
			ipax: { mode: 'default', contrast: opts.contrast ?? 4.5, blur: opts.blur ?? 8, feather: { t: fVal, r: fVal, b: fVal, l: fVal } }
		};

		const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((d) => `<span class="ed-handle" data-dir="${d}"></span>`).join('');
		box.innerHTML = `<div class="ed-glass" data-ipax-backdrop><div class="ed-box-bg"></div><div class="ed-box-text" contenteditable="true">${opts.html ?? (opts.text || '')}</div></div>${handles}`;

		const glass = qs('.ed-glass', box);
		glass.style.fontFamily = opts.fontFamily || box._state.fontInput;
		glass.style.fontSize = `${opts.fontSize ?? 32}px`;
		glass.style.lineHeight = opts.lineHeight || '1.25';
		glass.style.color = opts.color || '#ffffff';
		glass.style.textAlign = opts.textAlign || 'left';
		glass.style.justifyContent = opts.justifyContent || 'center';
		
		const p = box._state.padding;
		glass.style.padding = `${p.t}px ${p.r}px ${p.b}px ${p.l}px`;

		const textNode = qs('.ed-box-text', box);
		textNode.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); markDirty(); });
		textNode.addEventListener('input', () => { cleanEmptyTextNode(textNode); refreshBackdrop(); markDirty(); });
		textNode.addEventListener('blur', () => cleanEmptyTextNode(textNode));

		stage.appendChild(box);
		if (window.EdBg) window.EdBg.applyBgToLayer(box._state.bg, qs('.ed-box-bg', box), true);
		applyIpaxProps(box);
		return box;
	}

	function createBox(opts = {}) {
		const box = buildBoxElement(opts);
		selectBox(box);
		markDirty();
		if (opts.focusText) qs('.ed-box-text', box).focus();
		return box;
	}

	function cloneBox(sourceBox, overrideLeft, overrideTop, shouldSelect = true) {
		if (!sourceBox) return null;
		const srcGlass = qs('.ed-glass', sourceBox);
		const clonedState = JSON.parse(JSON.stringify(sourceBox._state));
		if (sourceBox._state.bg && sourceBox._state.bg._blob) {
			clonedState.bg._blob = sourceBox._state.bg._blob;
			clonedState.bg._fileName = sourceBox._state.bg._fileName || '';
		}
		const clone = buildBoxElement({
			left: overrideLeft ?? sourceBox.offsetLeft + 24, top: overrideTop ?? sourceBox.offsetTop + 24,
			width: sourceBox.offsetWidth, height: sourceBox.offsetHeight,
			clonedState,
			fontFamily: srcGlass.style.fontFamily, fontSize: parseFloat(srcGlass.style.fontSize) || 32,
			lineHeight: srcGlass.style.lineHeight || '1.25', color: srcGlass.style.color || '#ffffff',
			textAlign: srcGlass.style.textAlign || 'left', justifyContent: srcGlass.style.justifyContent || 'center',
			html: qs('.ed-box-text', sourceBox).innerHTML
		});
		clone.style.zIndex = String(++state.zCounter);
		if (shouldSelect) selectBox(clone);
		markDirty();
		return clone;
	}

	function deleteActiveBox(box) {
		const target = (box && box.nodeType === 1) ? box : state.activeBox;
		if (!target) return;
		removeBoxDom(target);
		if (state.activeBox === target) selectBox(null);
		markDirty();
		refreshBackdrop();
	}

	// Escuchamos en workspace para garantizar que un clic fuera de las cajas deseleccione,
	// incluso si el stage tuviera problemas de dimensiones.
	const workspace = qs('[data-ed-role="workspace"]');
	workspace.addEventListener('pointerdown', (e) => {
		const handle = e.target.closest('.ed-handle'), box = e.target.closest('.ed-box');
		
		if (!box) {
			selectBox(null);
			return;
		}
		
		selectBox(box);
		
		if (handle) {
			e.preventDefault();
			const dir = handle.dataset.dir, sx = e.clientX, sy = e.clientY;
			const sl = box.offsetLeft, st = box.offsetTop, sw = box.offsetWidth, sh = box.offsetHeight;
			const onMove = (me) => {
				const dx = me.clientX - sx, dy = me.clientY - sy;
				let nl = sl, nt = st, nw = sw, nh = sh;
				if (dir.includes('e')) nw = Math.max(80, sw + dx);
				if (dir.includes('s')) nh = Math.max(36, sh + dy);
				if (dir.includes('w')) { const cdx = Math.min(sw - 80, dx); nl = sl + cdx; nw = sw - cdx; }
				if (dir.includes('n')) { const cdy = Math.min(sh - 36, dy); nt = st + cdy; nh = sh - cdy; }
				box.style.left = `${nl}px`; box.style.top = `${nt}px`; box.style.width = `${nw}px`; box.style.height = `${nh}px`;
				refreshBackdrop(); markDirty();
			};
			const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
			window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
			return;
		}
		if (e.target.closest('.ed-box-text')) return;
		e.preventDefault();
		const sx = e.clientX, sy = e.clientY, originL = box.offsetLeft, originT = box.offsetTop;
		let altOriginClone = null, hasMoved = false;

		const syncAltClone = (isAltDown) => {
			if (isAltDown && hasMoved && !altOriginClone) {
				altOriginClone = cloneBox(box, originL, originT, false);
				box.style.zIndex = String(++state.zCounter);
				refreshBackdrop();
			} else if (!isAltDown && altOriginClone) {
				removeBoxDom(altOriginClone);
				altOriginClone = null;
				refreshBackdrop();
			}
		};
		const onKey = (ke) => { if (ke.key === 'Alt') { ke.preventDefault(); syncAltClone(ke.type === 'keydown'); } };
		const onDrag = (me) => {
			const dx = me.clientX - sx, dy = me.clientY - sy;
			if (!hasMoved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) hasMoved = true;
			syncAltClone(me.altKey);
			box.style.left = `${originL + dx}px`; box.style.top = `${originT + dy}px`;
			refreshBackdrop(); markDirty();
		};
		const onUp = () => {
			window.removeEventListener('pointermove', onDrag); window.removeEventListener('pointerup', onUp);
			window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
			refreshBackdrop();
		};
		window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
		window.addEventListener('pointermove', onDrag); window.addEventListener('pointerup', onUp);
	});

	on('box:request-select', selectBox);
	window.EdBoxes = { createBox, cloneBox, selectBox, deleteActiveBox, applyIpaxProps };
})();