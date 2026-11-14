/* PATH: examples/js/editor-export-png.js */
(function () {
	'use strict';

	const { state, qs, on } = window.EdCore;
	const stage = qs('[data-ed-role="stage"]');
	const warnEl = qs('[data-ed-role="png-warning"]');

	const hasRegionCapture = typeof window.CropTarget !== 'undefined' && typeof window.CropTarget.fromElement === 'function';
	if (!hasRegionCapture && warnEl) {
		warnEl.hidden = false;
	}

	on('action:save-png', async () => {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
			const msg = 'Export as PNG requires a secure context (HTTPS or localhost) to access the Screen Capture API.';
			console.error(msg);
			alert(msg);
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: { displaySurface: 'browser' },
				audio: false,
				preferCurrentTab: true,
				selfBrowserSurface: 'include'
			});
			const track = stream.getVideoTracks()[0];

			let cropped = false;
			if (hasRegionCapture && typeof track.cropTo === 'function') {
				try {
					const cropTarget = await window.CropTarget.fromElement(stage);
					await track.cropTo(cropTarget);
					cropped = true;
				} catch (cropErr) {
					cropped = false;
				}
			}

			const wasBorders = stage.classList.contains('show-borders');
			const active = state.activeBox;
			if (active) active.classList.remove('is-selected');
			stage.classList.remove('show-borders');

			// Universal cross-browser frame grab via invisible <video>
			const video = document.createElement('video');
			video.muted = true;
			video.playsInline = true;
			video.srcObject = stream;

			await new Promise((resolve) => {
				video.onloadedmetadata = () => {
					video.play().then(() => {
						// Safari sometimes needs an extra tick after play() to render the first frame
						setTimeout(resolve, 150);
					}).catch(resolve);
				};
			});

			const cvs = document.createElement('canvas');
			if (cropped) {
				cvs.width = video.videoWidth;
				cvs.height = video.videoHeight;
				const ctx = cvs.getContext('2d');
				ctx.drawImage(video, 0, 0);
			} else {
				const rect = stage.getBoundingClientRect();
				const dpr = window.devicePixelRatio || 1;
				cvs.width = rect.width * dpr;
				cvs.height = rect.height * dpr;
				const ctx = cvs.getContext('2d');
				ctx.drawImage(video, rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr, 0, 0, cvs.width, cvs.height);
			}

			if (active) active.classList.add('is-selected');
			if (wasBorders) stage.classList.add('show-borders');
			track.stop();
			video.srcObject = null;

			const a = document.createElement('a');
			a.href = cvs.toDataURL('image/png');
			a.download = 'lucid-glass-stage.png';
			a.click();
		} catch (e) {
			console.warn('[EdExportPng] Capture cancelled or unsupported', e);
		}
	});
})();