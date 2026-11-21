// PATH: examples/js/editor/0050-editor-export-png.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	if (!core) return;

	const { state, qs } = core;
	const stage = qs('[data-ed-role="stage"]');
	const warnEl = qs('[data-ed-role="png-warning"]');

	const hasRegionCapture = typeof global.CropTarget !== 'undefined' && typeof global.CropTarget.fromElement === 'function';
	if (!hasRegionCapture && warnEl) {
		warnEl.hidden = false;
	}

	j0.bus.on('editor:action:save-png', async () => {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
			const msg = 'PNG export requires HTTPS or localhost (Screen Capture API).';
			j0.logger.error('[editor:export-png] ' + msg);
			j0.bus.emit('editor:status:message', { text: msg, level: 'error' });
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
					const cropTarget = await global.CropTarget.fromElement(stage);
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

			const video = document.createElement('video');
			video.muted = true;
			video.playsInline = true;
			video.srcObject = stream;

			await new Promise((resolve) => {
				video.onloadedmetadata = () => {
					video.play().then(() => setTimeout(resolve, 150)).catch(resolve);
				};
				video.onerror = resolve;
			});

			const cvs = document.createElement('canvas');
			if (cropped) {
				cvs.width = video.videoWidth;
				cvs.height = video.videoHeight;
				cvs.getContext('2d').drawImage(video, 0, 0);
			} else {
				const rect = stage.getBoundingClientRect();
				const dpr = global.devicePixelRatio || 1;
				cvs.width = rect.width * dpr;
				cvs.height = rect.height * dpr;
				cvs.getContext('2d').drawImage(video, rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr, 0, 0, cvs.width, cvs.height);
			}

			if (active) active.classList.add('is-selected');
			if (wasBorders) stage.classList.add('show-borders');
			track.stop();
			video.srcObject = null;

			const a = document.createElement('a');
			a.href = cvs.toDataURL('image/png');
			a.download = 'lucid-glass-stage.png';
			a.click();
			j0.bus.emit('editor:status:message', { text: 'Exported lucid-glass-stage.png', level: 'info' });
		} catch (e) {
			j0.logger.warn('[editor:export-png] Capture cancelled or unsupported', e);
		}
	});
})(typeof globalThis !== 'undefined' ? globalThis : window);