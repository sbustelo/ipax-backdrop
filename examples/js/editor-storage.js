/* PATH: examples/js/editor-storage.js */
(function () {
	'use strict';

	const { state, qsa, qs, on } = window.EdCore;
	const { get: idbGet, set: idbSet, del: idbDelete, formatBytes, setStatus } = window.EdIdb;
	const { hydrateBg, buildSnapshot, serializeProject, restoreProject, inferMimeFromPath } = window.EdSerializer;

	const RECORD_KEY = 'current';
	const DEFAULT_JSON_URL = 'js/editor-default.json';
	const stage = qs('[data-ed-role="stage"]');

	let saveTimer = null;
	let isDirty = false;
	let isHydrating = false;
	let hasUserInteracted = false;

	['pointerdown', 'keydown', 'input', 'change', 'drop'].forEach((evt) => {
		window.addEventListener(evt, (e) => {
			if (e.isTrusted && !isHydrating) hasUserInteracted = true;
		}, true);
	});

	function resetDirtyState() {
		clearTimeout(saveTimer);
		isDirty = false;
		hasUserInteracted = false;
	}

	function runHydration(jsonStr, assetMap) {
		isHydrating = true;
		try {
			return restoreProject(jsonStr, assetMap);
		} finally {
			isHydrating = false;
			resetDirtyState();
		}
	}

	async function persistNow() {
		clearTimeout(saveTimer);
		isDirty = false;
		try {
			const snapshot = buildSnapshot();
			await idbSet(RECORD_KEY, snapshot);
			setStatus(`Saved state (IndexedDB: ${formatBytes(snapshot.byteSize)})`);
		} catch (e) {
			console.error('[EdStorage] IndexedDB write failed', e);
			setStatus('Storage error (IndexedDB)');
		}
	}

	function scheduleSave() {
		if (isHydrating || !hasUserInteracted) return;
		isDirty = true;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(persistNow, 300);
	}

	async function loadDefaultProject() {
		isHydrating = true;
		try {
			const res = await fetch(DEFAULT_JSON_URL, { cache: 'no-cache' });
			if (res.ok) {
				const jsonText = await res.text();
				if (restoreProject(jsonText)) return true;
			}
		} catch (e) {
			console.warn('[EdStorage] Could not fetch js/editor-default.json, using fallback.', e);
		} finally {
			isHydrating = false;
			resetDirtyState();
		}
		if (window.EdBg && window.EdBg.releaseBgImage) window.EdBg.releaseBgImage(state.stageBg);
		qsa('.ed-box', stage).forEach((b) => window.EdBoxes.deleteActiveBox(b));
		state.stageBg = hydrateBg({ type: 'none' });
		if (window.EdBg) window.EdBg.applyBgToLayer(state.stageBg, qs('[data-ed-role="stage-bg"]'), false);
		window.EdBoxes.createBox({ left: 80, top: 80, width: 420, height: 150, text: 'Lucid Glass' });
		if (state.performance === null && window.EdPresets) {
			const defKey = window.EdPresets.DEFAULT_PRESET;
			state.performance = Object.assign({ preset: defKey }, window.EdPresets.PROFILES[defKey]);
		}
		if (window.EdPerf) {
			window.EdPerf.applyConfig();
			window.EdPerf.syncPanel();
		}
		resetDirtyState();
		return true;
	}

	async function purgeDb() {
		if (!window.confirm('Purge saved state from IndexedDB? Your current canvas will remain open until you make a new change.')) return;
		resetDirtyState();
		try {
			await idbDelete(RECORD_KEY);
			setStatus('Purged state (IndexedDB: 0 bytes)');
		} catch (e) {
			console.error('[EdStorage] IndexedDB purge failed', e);
		}
	}

	on('project:dirty', scheduleSave);
	on('action:purge-db', purgeDb);
	window.addEventListener('pagehide', () => { if (isDirty && !isHydrating && hasUserInteracted) persistNow(); });
	document.addEventListener('click', (e) => { if (e.target.closest('[data-ed-action="purge-db"]')) purgeDb(); });

	window.addEventListener('DOMContentLoaded', async () => {
		let restored = false;
		try {
			const record = await idbGet(RECORD_KEY);
			if (record && record.projectJson) {
				const assetMap = new Map();
				if (record.blobs) {
					Object.entries(record.blobs).forEach(([path, blob]) => {
						if (blob instanceof Blob) {
							assetMap.set(path, {
								url: URL.createObjectURL(blob),
								blob,
								fileName: path.split('/').pop().replace(/^\d+-/, '')
							});
						}
					});
				}
				restored = runHydration(record.projectJson, assetMap);
				if (restored) setStatus(`Saved state (IndexedDB: ${formatBytes(record.byteSize || 0)})`);
			}
		} catch (e) {
			console.warn('[EdStorage] IndexedDB read failed, booting default project.', e);
		}

		if (!restored) {
			await loadDefaultProject();
			if (window.EdBg) window.EdBg.syncBackgroundPanel();
			resetDirtyState();
			setStatus('Clean state (IndexedDB: 0 bytes)');
		}
	});

	on('action:reset', async () => {
		if (!window.confirm('Reset project to default and purge IndexedDB? All unsaved changes will be lost.')) return;
		resetDirtyState();
		try { await idbDelete(RECORD_KEY); } catch (e) { console.warn('[EdStorage] IndexedDB clear warning', e); }
		await loadDefaultProject();
		if (window.EdBg) window.EdBg.syncBackgroundPanel();
		resetDirtyState();
		setStatus('Purged state (IndexedDB: 0 bytes)');
	});

	on('action:save-json', async () => {
		const snapshot = buildSnapshot();
		const entries = [{ name: 'project.json', data: new TextEncoder().encode(snapshot.projectJson) }];
		for (const [path, blob] of Object.entries(snapshot.blobs)) {
			entries.push({ name: path, data: new Uint8Array(await blob.arrayBuffer()) });
		}
		const zipBlob = window.EdZip.createZip(entries);
		const url = URL.createObjectURL(zipBlob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'lucid-glass-project.zip';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	});

	on('action:load-json', async (file) => {
		try {
			const buf = await file.arrayBuffer();
			if (window.EdZip && window.EdZip.isZipBuffer(buf)) {
				const zipFiles = await window.EdZip.readZip(buf);
				let jsonBytes = zipFiles.get('project.json');
				if (!jsonBytes) {
					for (const [name, data] of zipFiles.entries()) {
						if (name.toLowerCase().endsWith('.json')) { jsonBytes = data; break; }
					}
				}
				if (!jsonBytes) throw new Error('No project.json found inside archive');

				const jsonStr = new TextDecoder().decode(jsonBytes);
				const assetMap = new Map();
				for (const [name, data] of zipFiles.entries()) {
					if (name === 'project.json' || name.toLowerCase().endsWith('.json')) continue;
					const blob = new Blob([data], { type: inferMimeFromPath(name) });
					assetMap.set(name, {
						url: URL.createObjectURL(blob),
						blob,
						fileName: name.split('/').pop().replace(/^\d+-/, '')
					});
				}
				if (runHydration(jsonStr, assetMap)) {
					if (window.EdBg) window.EdBg.syncBackgroundPanel();
					await persistNow();
				}
			} else {
				const jsonStr = new TextDecoder().decode(buf);
				if (runHydration(jsonStr)) {
					if (window.EdBg) window.EdBg.syncBackgroundPanel();
					await persistNow();
				}
			}
		} catch (e) {
			console.error('[EdStorage] Failed to load project file', e);
			alert('Could not load project file. Check console for details.');
		}
	});

	window.EdStorage = { serializeProject, restoreProject };
})();