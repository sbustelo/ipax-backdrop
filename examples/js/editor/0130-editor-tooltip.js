// PATH: examples/js/editor/0130-editor-tooltip.js
(function (global) {
	'use strict';

	if (document.documentElement.dataset.edTipBound) return;
	document.documentElement.dataset.edTipBound = '1';

	const existingTips = document.querySelectorAll('[data-ed-role="tooltip"]');
	const tipEl = existingTips[0] || document.createElement('div');
	for (let i = 1; i < existingTips.length; i++) existingTips[i].remove();
	tipEl.className = 'ed-tooltip';
	tipEl.setAttribute('data-ed-role', 'tooltip');
	tipEl.hidden = true;
	if (!tipEl.parentNode && document.body) document.body.appendChild(tipEl);

	let currentTipEl = null;

	function showTip(host) {
		const text = host.getAttribute('data-ed-tip');
		if (!text) return;
		if (!tipEl.parentNode && document.body) document.body.appendChild(tipEl);
		currentTipEl = host;
		tipEl.textContent = text;
		tipEl.hidden = false;
		const rect = host.getBoundingClientRect();
		const tw = tipEl.offsetWidth;
		const th = tipEl.offsetHeight;
		const left = Math.min(global.innerWidth - tw - 8, Math.max(8, rect.left + rect.width * 0.5 - tw * 0.5));
		const top = rect.top > th + 10 ? rect.top - th - 6 : rect.bottom + 6;
		tipEl.style.left = Math.round(left) + 'px';
		tipEl.style.top = Math.round(top) + 'px';
	}

	function hideTip() {
		currentTipEl = null;
		tipEl.hidden = true;
	}

	function trackHost(e) {
		const host = e.target && e.target.closest ? e.target.closest('[data-ed-tip]') : null;
		if (!host) {
			if (currentTipEl) hideTip();
			return;
		}
		if (host === currentTipEl) return;
		showTip(host);
	}

	document.addEventListener('pointermove', trackHost, true);
	document.addEventListener('mouseover', trackHost, true);
	document.addEventListener('pointerdown', hideTip, true);
	document.addEventListener('scroll', hideTip, true);
	document.documentElement.addEventListener('mouseleave', hideTip);
	global.addEventListener('blur', hideTip);
	document.addEventListener('focusin', (e) => {
		const host = e.target && e.target.closest ? e.target.closest('[data-ed-tip]') : null;
		if (host) showTip(host);
	});
	document.addEventListener('focusout', hideTip);
})(typeof globalThis !== 'undefined' ? globalThis : window);