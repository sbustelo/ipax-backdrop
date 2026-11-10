/**
 * ipax-backdrop example page: draggable boxes, controls, photo upload and report.
 * It only talks to the library through its public API and bus events.
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

	/* ---------- Generate test images ---------- */
	function paintImage(seed, w, h, cols) {
		const c = document.createElement('canvas');
		c.width = w; c.height = h;
		const g = c.getContext('2d');
		const gr = g.createLinearGradient(0, 0, w, h);
		cols.forEach((k, i) => gr.addColorStop(i / (cols.length - 1), k));
		g.fillStyle = gr; g.fillRect(0, 0, w, h);
		let sd = seed;
		const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
		for (let i = 0; i < 90; i++) {
			g.fillStyle = 'hsla(' + (rnd() * 360) + ',' + (30 + rnd() * 50) + '%,' + (15 + rnd() * 70) + '%,0.6)';
			g.beginPath(); g.arc(rnd() * w, rnd() * h, 6 + rnd() * Math.min(w, h) / 6, 0, 6.283); g.fill();
		}
		return c.toDataURL('image/jpeg', 0.8); // data: URLs keep the canvas readable
	}
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

		// Bidirectional synchronization between range and number inputs inside the same row
		const row = c.closest('.ex-row');
		if (row) {
			const partner = row.querySelector(c.type === 'range' ? 'input[type="number"]' : 'input[type="range"]');
			if (partner && partner !== c) partner.value = c.value;
		}

		const k = c.dataset.ctl;

		if (k === 'mode') {
			stage.querySelectorAll('.ex-glass').forEach((g) => g.style.setProperty('--ipax-backdrop-mode', c.value));
		} else if (k === 'contrast') {
			stage.querySelectorAll('.ex-glass').forEach((g) => g.style.setProperty('--ipax-backdrop-contrast', c.value));
		} else if (k === 'feather') {
			// Master feather: set shorthand and clear directional overrides
			stage.querySelectorAll('.ex-glass').forEach((g) => {
				['top', 'right', 'bottom', 'left'].forEach((s) => g.style.removeProperty('--ipax-backdrop-feather-' + s));
				g.style.setProperty('--ipax-backdrop-feather', c.value + 'px');
			});
			['top', 'right', 'bottom', 'left'].forEach((side) => {
				root.querySelectorAll('[data-ctl="feather-' + side + '"]').forEach((input) => {
					input.value = c.value;
				});
			});
		} else if (k.indexOf('feather-') === 0) {
			const side = k.replace('feather-', '');
			stage.querySelectorAll('.ex-glass').forEach((g) => g.style.setProperty('--ipax-backdrop-feather-' + side, c.value + 'px'));

			// If all 4 directional inputs match, reconcile back to shorthand
			const sides = ['top', 'right', 'bottom', 'left'];
			const vals = sides.map((s) => {
				const el = root.querySelector('input[data-ctl="feather-' + s + '"]');
				return el ? el.value : null;
			});
			const allEqual = vals.every((v) => v !== null && v === vals[0]);
			if (allEqual) {
				root.querySelectorAll('[data-ctl="feather"]').forEach((el) => { el.value = vals[0]; });
				stage.querySelectorAll('.ex-glass').forEach((g) => {
					sides.forEach((s) => g.style.removeProperty('--ipax-backdrop-feather-' + s));
					g.style.setProperty('--ipax-backdrop-feather', vals[0] + 'px');
				});
			}
		} else if (k === 'blur') {
			stage.style.setProperty('--ex-blur', c.value + 'px');
		} else if (k === 'backend') {
			ipax.config.backend = c.value;
		} else if (k === 'overlay') {
			stage.classList.toggle('ex-s-overlay', c.checked);
		} else if (k === 'grad') {
			stage.classList.toggle('ex-s-grad', c.checked);
		} else if (k === 'raw') {
			stage.classList.toggle('ex-raw', c.checked);
		}

		ipax.refresh();
	});

	/* ---------- Upload: read, downscale, store as a data URL ---------- */
	root.addEventListener('change', (e) => {
		const f = e.target.closest('[data-ref="file"]');
		if (!f || !f.files[0]) return;
		const key = ref('imgTarget').value;
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
			};
			img.src = fr.result;
		};
		fr.readAsDataURL(f.files[0]);
	});

	/* ---------- Library events -> report ---------- */
	j0.bus.on('ipax-backdrop:updated', (d) => {
		const host = d.element.closest('[data-label]');
		if (!host) return;
		const r = d.resolver, s = d.stats;
		lines[host.dataset.label] = host.dataset.label + ': ' + d.backend + ', ' + d.params.mode + ' ' + d.params.ratio + ':1, unknown ' + (r.cells ? Math.round(100 * r.unknown / r.cells) : 0) + '%'
			+ (s ? ', min ' + (s.min === null ? 'n/a' : s.min.toFixed(2) + ':1') + ' (' + s.under + ' px under target)' + (s.inf ? ', ratio unreachable' : '') : ', contrast stats: CPU backend only')
			+ (d.tainted ? ', cross-origin image' : '') + ', ' + d.ms.toFixed(0) + ' ms';
		report.textContent = Object.keys(lines).map((k) => lines[k]).join('\n');
	});
	const note = (text) => { notes.push(text); if (notes.length > 4) notes.shift(); status.textContent = notes.join('\n'); };
	j0.bus.on('ipax-backdrop:backend', (d) => note('Backend: ' + d.backend + ' (' + d.reason + ')'));
	j0.bus.on('ipax-backdrop:warning', (d) => note('Warning: ' + d.message));
	j0.bus.on('ipax-backdrop:error', (d) => note('Error: ' + d.message));

	/* ---------- Initial photos ---------- */
	// setBg(hero, paintImage(7, 800, 300, ['#2f5d8a', '#8a8f55', '#d9a35b']));
	setBg(stage.querySelector('[data-img="a"]'), paintImage(21, 420, 380, ['#a23b5a', '#e8c26b', '#2c6e6a']));
	//setBg(stage.querySelector('[data-img="b"]'), paintImage(55, 380, 340, ['#2b3a67', '#7aa36b', '#d9d2c5']));
	setBg(stage, paintImage(99, 700, 600, ['#3b3f6b', '#c98b5a', '#6fa8a0']));
})();
