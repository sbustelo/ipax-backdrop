// PATH: examples/js/editor/0060-editor-storage.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	const serializer = j0 && j0.get('editor:serializer');
	const zipApi = j0 && j0.get('editor:zip');
	const vfs = j0 && j0.vfs;
	if (!core || !serializer || !vfs) return;

	const { state, qsa, qs } = core;
	const { hydrateBg, buildSnapshot, serializeProject, restoreProject, inferMimeFromPath } = serializer;

	const COLLECTION = 'lucid-glass-editor';
	const DOC_ID = 'current';
	const DEFAULT_JSON_URL = 'js/editor-default.json';
	const stage = qs('[data-ed-role="stage"]');
	const statusEl = qs('[data-ed-role="storage-status"]');
	const btnPurge = qs('[data-ed-action="purge-db"]');
	const btnReset = qs('[data-ed-action="reset-project"]');

	let saveTimer = null;
	let isDirty = false;
	let isHydrating = false;
	let hasUserInteracted = false;
	const armTimers = new WeakMap();

	function formatBytes(bytes) {
		if (!bytes || bytes <= 0) return '0 bytes';
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
	}

	function setStatus(text) {
		if (statusEl) statusEl.textContent = text;
	}

	['pointerdown', 'keydown', 'input', 'change', 'drop'].forEach((evt) => {
		global.addEventListener(evt, (e) => {
			if (e.isTrusted && !isHydrating) hasUserInteracted = true;
		}, true);
	});

	function confirmTwoStep(btn, idleLabel, armedLabel) {
		if (!btn) return true;
		if (btn.dataset.edArmed === '1') {
			clearTimeout(armTimers.get(btn));
			delete btn.dataset.edArmed;
			btn.textContent = idleLabel;
			return true;
		}
		btn.dataset.edArmed = '1';
		btn.textContent = armedLabel;
		const timer = setTimeout(() => {
			delete btn.dataset.edArmed;
			btn.textContent = idleLabel;
		}, 3000);
		armTimers.set(btn, timer);
		return false;
	}

	function resetDirtyState() {
		clearTimeout(saveTimer);
		isDirty = false;
		hasUserInteracted = false;
	}

	function runHydration(jsonStr, assetMap) {
		isHydrating = true;
		try {
			const ok = restoreProject(jsonStr, assetMap);
			if (!ok && assetMap) assetMap.forEach((entry) => { if (entry && entry.url) URL.revokeObjectURL(entry.url); });
			return ok;
		} finally {
			isHydrating = false;
			resetDirtyState();
		}
	}

	async function pruneOrphanBlobs() {
		if (!vfs.docs || !vfs.blobs) return;
		const orphans = await vfs.docs.syncOrphans(COLLECTION);
		for (const hash of orphans) await vfs.blobs.remove(hash);
	}

	async function persistNow() {
		clearTimeout(saveTimer);
		isDirty = false;
		try {
			const snapshot = buildSnapshot();
			const assetHashes = {};
			const blobHashes = [];
			for (const [path, blob] of Object.entries(snapshot.blobs)) {
				const hash = await vfs.blobs.put(blob);
				assetHashes[path] = hash;
				blobHashes.push(hash);
			}
			await vfs.docs.save(COLLECTION, {
				id: DOC_ID,
				title: 'Lucid Glass Project',
				data: {
					projectJson: snapshot.projectJson,
					assetHashes,
					byteSize: snapshot.byteSize
				},
				blobs: blobHashes
			});
			await pruneOrphanBlobs();
			setStatus('Saved state (VFS: ' + formatBytes(snapshot.byteSize) + ')');
		} catch (e) {
			j0.logger.error('[editor:storage] VFS write failed', e);
			setStatus('Storage error (VFS)');
		}
	}

	function scheduleSave() {
		if (isHydrating || !hasUserInteracted) return;
		isDirty = true;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(persistNow, 300);
	}

	async function loadDefaultProject() {
		const bgApi = j0.get('editor:bg');
		const boxesApi = j0.get('editor:boxes');
		const perfApi = j0.get('editor:perf');
		const presets = j0.get('editor:presets') || global.EdPresets;

		isHydrating = true;
		try {
			const res = await fetch(DEFAULT_JSON_URL, { cache: 'no-cache' });
			if (res.ok && restoreProject(await res.text())) return true;
		} catch (e) {
			j0.logger.warn('[editor:storage] Could not fetch js/editor-default.json, using fallback.', e);
		} finally {
			isHydrating = false;
			resetDirtyState();
		}
		if (bgApi && bgApi.releaseBgImage) bgApi.releaseBgImage(state.stageBg);
		if (boxesApi) qsa('.ed-box', stage).forEach((b) => boxesApi.deleteActiveBox(b));
		state.stageBg = hydrateBg({ type: 'none' });
		if (bgApi) bgApi.applyBgToLayer(state.stageBg, qs('[data-ed-role="stage-bg"]'), false);
		if (boxesApi) boxesApi.createBox({ left: 80, top: 80, width: 420, height: 150, text: 'Lucid Glass' });
		if (state.performance === null && presets) {
			const defKey = presets.DEFAULT_PRESET;
			state.performance = Object.assign({ preset: defKey }, presets.PROFILES[defKey]);
		}
		if (perfApi) { perfApi.applyConfig(); perfApi.syncPanel(); }
		resetDirtyState();
		return true;
	}

	async function purgeVfs() {
		if (!confirmTwoStep(btnPurge, 'Purge', 'Confirm?')) return;
		resetDirtyState();
		try {
			await vfs.docs.remove(COLLECTION, DOC_ID);
			await pruneOrphanBlobs();
			setStatus('Purged state (VFS: 0 bytes)');
		} catch (e) {
			j0.logger.error('[editor:storage] VFS purge failed', e);
			setStatus('Storage purge error');
		}
	}

	j0.bus.on('editor:project:dirty', scheduleSave);
	j0.bus.on('editor:status:message', (d) => { if (d && d.text) setStatus(d.text); });
	if (btnPurge) btnPurge.addEventListener('click', purgeVfs);
	global.addEventListener('pagehide', () => { if (isDirty && !isHydrating && hasUserInteracted) persistNow(); });

	global.addEventListener('DOMContentLoaded', async () => {
		const bgApi = j0.get('editor:bg');
		let restored = false;
		try {
			const doc = await vfs.docs.get(COLLECTION, DOC_ID);
			if (doc && doc.data && doc.data.projectJson) {
				const assetMap = new Map();
				const assetHashes = doc.data.assetHashes || {};
				for (const [path, hash] of Object.entries(assetHashes)) {
					const blob = await vfs.blobs.get(hash);
					if (blob instanceof Blob) {
						assetMap.set(path, { url: URL.createObjectURL(blob), blob, fileName: path.split('/').pop().replace(/^\d+-/, '') });
					}
				}
				restored = runHydration(doc.data.projectJson, assetMap);
				if (restored) setStatus('Saved state (VFS: ' + formatBytes(doc.data.byteSize || 0) + ')');
			}
		} catch (e) {
			j0.logger.warn('[editor:storage] VFS read failed, booting default project.', e);
		}
		if (!restored) {
			await loadDefaultProject();
			if (bgApi) bgApi.syncBackgroundPanel();
			resetDirtyState();
			setStatus('Clean state (VFS: 0 bytes)');
		}
	});

	j0.bus.on('editor:action:reset', async () => {
		const bgApi = j0.get('editor:bg');
		if (!confirmTwoStep(btnReset, 'Reset', 'Confirm?')) return;
		resetDirtyState();
		try {
			await vfs.docs.remove(COLLECTION, DOC_ID);
			await pruneOrphanBlobs();
		} catch (e) {
			j0.logger.warn('[editor:storage] VFS clear warning', e);
		}
		await loadDefaultProject();
		if (bgApi) bgApi.syncBackgroundPanel();
		resetDirtyState();
		setStatus('Purged state (VFS: 0 bytes)');
	});

	j0.bus.on('editor:action:save-json', async () => {
		if (!zipApi) return;
		const snapshot = buildSnapshot();
		const entries = [{ name: 'project.json', data: new TextEncoder().encode(snapshot.projectJson) }];
		for (const [path, blob] of Object.entries(snapshot.blobs)) {
			entries.push({ name: path, data: new Uint8Array(await blob.arrayBuffer()) });
		}
		const zipBlob = zipApi.createZip(entries);
		const url = URL.createObjectURL(zipBlob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'lucid-glass-project.zip';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	});

	j0.bus.on('editor:action:load-json', async (file) => {
		const bgApi = j0.get('editor:bg');
		try {
			const buf = await file.arrayBuffer();
			if (zipApi && zipApi.isZipBuffer(buf)) {
				const zipFiles = await zipApi.readZip(buf);
				let jsonBytes = zipFiles.get('project.json');
				if (!jsonBytes) {
					for (const [name, data] of zipFiles.entries()) {
						if (name.toLowerCase().endsWith('.json')) { jsonBytes = data; break; }
					}
				}
				if (!jsonBytes) throw new Error('No project.json found inside archive');
				const assetMap = new Map();
				for (const [name, data] of zipFiles.entries()) {
					if (name === 'project.json' || name.toLowerCase().endsWith('.json')) continue;
					const blob = new Blob([data], { type: inferMimeFromPath(name) });
					assetMap.set(name, { url: URL.createObjectURL(blob), blob, fileName: name.split('/').pop().replace(/^\d+-/, '') });
				}
				if (runHydration(new TextDecoder().decode(jsonBytes), assetMap)) {
					if (bgApi) bgApi.syncBackgroundPanel();
					await persistNow();
				} else {
					setStatus('Error: Invalid project archive');
				}
			} else if (runHydration(new TextDecoder().decode(buf))) {
				if (bgApi) bgApi.syncBackgroundPanel();
				await persistNow();
			} else {
				setStatus('Error: Invalid project JSON');
			}
		} catch (e) {
			j0.logger.error('[editor:storage] Failed to load project file', e);
			setStatus('Error: Could not load project file');
		}
	});

	j0.register('editor:storage', Object.freeze({ serializeProject, restoreProject }));
})(typeof globalThis !== 'undefined' ? globalThis : window);