/**
 * ipax-backdrop example page: draggable boxes, controls, photo upload and report.
 * It only talks to the library through its public API, CSS variables and bus events.
 * SPDX-License-Identifier: Apache-2.0
 */
(function () {
	'use strict';

	const j0 = window.j0;
	const ipax = j0 && j0.get('ipax-backdrop');
	const root = document.querySelector('[data-ref="root"]');
	const ref = (n) => root.querySelector('[data-ref="' + n + '"]');
	const stage = ref('stage'), report = ref('report'), status = ref('status'), hero = ref('hero');

	if (!ipax) {
		status.textContent = 'ipax-backdrop did not load. Check the script paths in index.html (and the browser console).';
		return;
	}

	let z = 20, drag = null;
	const lines = {}, notes = [];

	const setBg = (el, url) => { el.style.backgroundImage = 'url("' + url + '")'; ipax.refresh(); };

	/* ---------- Boxes: drag anywhere, resize from the corner, raise on touch ---------- */
	stage.querySelectorAll('[data-box]').forEach((b) => {
		b.style.left = b.dataset.x + 'px'; b.style.top = b.dataset.y + 'px';
		b.style.width = b.dataset.w + 'px'; b.style.height = b.dataset.h + 'px';
		b.style.zIndex = b.dataset.z;
	});
	stage.addEventListener('pointerdown', (e) => {
		const b = e.target.closest('[data-box]');
		if (!b || !stage.contains(b)) return;
		if (!('noraise' in b.dataset)) b.style.zIndex = ++z;
		drag = { b, grip: !!e.target.closest('[data-grip]'), x: e.clientX, y: e.clientY, l: b.offsetLeft, t: b.offsetTop, ww: b.offsetWidth, hh: b.offsetHeight };
		b.setPointerCapture(e.pointerId);
		ipax.refresh();
	});
	stage.addEventListener('pointermove', (e) => {
		if (!drag) return;
		const dx = e.clientX - drag.x, dy = e.clientY - drag.y, b = drag.b;
		if (drag.grip) { b.style.width = Math.max(70, drag.ww + dx) + 'px'; b.style.height = Math.max(50, drag.hh + dy) + 'px'; }
		else {
			b.style.left = Math.min(stage.clientWidth - 40, Math.max(40 - b.offsetWidth, drag.l + dx)) + 'px';
			b.style.top = Math.min(stage.clientHeight - 30, Math.max(30 - b.offsetHeight, drag.t + dy)) + 'px';
		}
		ipax.refresh();
	});
	const endDrag = () => { drag = null; };
	stage.addEventListener('pointerup', endDrag);
	stage.addEventListener('pointercancel', endDrag);

	/* ---------- Controls: they only write CSS custom properties and classes ---------- */
	root.addEventListener('input', (e) => {
		const c = e.target.closest('[data-ctl]');
		if (!c) return;

		const row = c.closest('.ex-row');
		if (row) {
			const partner = row.querySelector(c.type === 'range' ? 'input[type="number"]' : 'input[type="range"]');
			if (partner && partner !== c) partner.value = c.value;
		}

		const k = c.dataset.ctl;
		const applyProp = (prop, val) => stage.querySelectorAll('.ex-glass').forEach(g => g.style.setProperty(prop, val));

		if (k === 'mode') applyProp('--ipax-backdrop-mode', c.value);
		else if (k === 'contrast') applyProp('--ipax-backdrop-contrast', c.value);
		else if (k === 'backend') document.documentElement.style.setProperty('--ipax-backdrop-backend', c.value);
		else if (k === 'performance') {
			const v = c.value === '0' ? '0' : c.value + 'fps';
			document.documentElement.style.setProperty('--ipax-backdrop-performance', v);
		}
		else if (k === 'feather') {
			['top', 'right', 'bottom', 'left'].forEach(s => applyProp('--ipax-backdrop-feather-' + s, ''));
			applyProp('--ipax-backdrop-feather', c.value + 'px');
			['top', 'right', 'bottom', 'left'].forEach(side => {
				root.querySelectorAll('[data-ctl="feather-' + side + '"]').forEach(input => input.value = c.value);
			});
		} else if (k.indexOf('feather-') === 0) {
			const side = k.replace('feather-', '');
			applyProp('--ipax-backdrop-feather-' + side, c.value + 'px');
			const sides = ['top', 'right', 'bottom', 'left'];
			const vals = sides.map(s => { const el = root.querySelector('input[data-ctl="feather-' + s + '"]'); return el ? el.value : null; });
			if (vals.every(v => v !== null && v === vals[0])) {
				root.querySelectorAll('[data-ctl="feather"]').forEach(el => el.value = vals[0]);
				sides.forEach(s => applyProp('--ipax-backdrop-feather-' + s, ''));
				applyProp('--ipax-backdrop-feather', vals[0] + 'px');
			}
		} else if (k === 'blur') {
			stage.style.setProperty('--ex-blur', c.value + 'px');
			stage.querySelectorAll('.ex-glass, .example-hero-block').forEach(g => g.style.setProperty('--ipax-backdrop-blur', c.value + 'px'));
		} else if (k === 'overlay') stage.classList.toggle('ex-s-overlay', c.checked);
		else if (k === 'grad') stage.classList.toggle('ex-s-grad', c.checked);
		else if (k === 'master-toggle' || k === 'effect-hero') hero.classList.toggle('ex-raw', !c.checked);
		else if (k === 'raw' || k === 'effect-stage') stage.classList.toggle('ex-raw', !c.checked);
		else if (k === 'textcolor') stage.style.setProperty('--ex-custom-color', c.value);

		ipax.refresh();
	});

	/* ---------- Upload: read, downscale, store as a data URL ---------- */
	root.addEventListener('change', (e) => {
		const sel = e.target.closest('[data-ctl="imgTarget"]');
		if (sel) {
			if (sel.value) {
				const fInput = ref('file');
				fInput.dataset.target = sel.value;
				fInput.click();
				sel.value = "";
			}
			return;
		}

		const f = e.target.closest('[data-ref="file"]');
		if (!f || !f.files[0]) return;
		
		const key = f.dataset.target;
		const dst = key === 'hero' ? hero : key === 'stage' ? stage : stage.querySelector('[data-img="' + key + '"]');
		const fr = new FileReader();
		fr.onload = () => {
			const img = new Image();
			img.onload = () => {
				const k = Math.min(1, 720 / Math.max(img.width, img.height)), c = document.createElement('canvas');
				c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
				const g = c.getContext('2d');
				g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
				g.drawImage(img, 0, 0, c.width, c.height);
				setBg(dst, c.toDataURL('image/jpeg', 0.82));
				f.value = '';
				if (key === 'hero') hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
			};
			img.src = fr.result;
		};
		fr.readAsDataURL(f.files[0]);
	});

	/* ---------- Library events -> report ---------- */
	j0.bus.on('ipax-backdrop:updated', (d) => {
		const host = d.element.closest('[data-label]');
		if (!host) return;
		const r = d.resolver, s = d.stats, b = d.budget;
		lines[host.dataset.label] = host.dataset.label + ': ' + d.backend + ', ' + d.params.mode + ' ' + d.params.ratio + ':1'
			+ (b ? ' [Scale: ' + b.s.toFixed(2) + ']' : '') + ', unknown ' + (r.cells ? Math.round(100 * r.unknown / r.cells) : 0) + '%'
			+ (s ? ', min ' + (s.min === null ? 'n/a' : s.min.toFixed(2) + ':1') + ' (' + s.under + ' px under target)' + (s.inf ? ', ratio unreachable' : '') : ', contrast stats: CPU backend only')
			+ (d.tainted ? ', cross-origin image' : '') + ', ' + d.ms.toFixed(0) + ' ms';
		report.textContent = Object.keys(lines).map((k) => lines[k]).join('\n');
	});
	const note = (text) => { notes.push(text); if (notes.length > 4) notes.shift(); status.textContent = notes.join('\n'); };
	j0.bus.on('ipax-backdrop:backend', (d) => note('Backend: ' + d.backend + ' (' + d.reason + ')'));
	j0.bus.on('ipax-backdrop:warning', (d) => note('Warning: ' + d.message));
	j0.bus.on('ipax-backdrop:error', (d) => note('Error: ' + d.message));

	
	
	/* ---------- Initial photos ---------- */
	if (window.ExampleImages) {
		const total = window.ExampleImages.paletteCount();
		const idx1 = Math.floor(Math.random() * total);
		const idx2 = (idx1 + 1 + Math.floor(Math.random() * (total - 1))) % total;
		setBg(stage.querySelector('[data-img="a"]'), window.ExampleImages.generate(420, 380, idx1, { patternSeed: 'rand' }));
		setBg(stage, window.ExampleImages.generate(700, 600, idx2, { patternSeed: 'rand' }));
	}
})();