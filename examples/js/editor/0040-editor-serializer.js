// PATH: examples/js/editor/0040-editor-serializer.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	const assets = j0 && j0.get('editor:assets');
	if (!core || !assets) return;

	const { state, qsa, qs, refreshBackdrop } = core;
	const { inferMimeFromPath, hydrateBg, createBgSerializer } = assets;
	const stage = qs('[data-ed-role="stage"]');

	function buildSnapshot() {
		const blobs = {};
		const serializeBg = createBgSerializer(blobs);

		const boxes = qsa('.ed-box', stage).map((b) => {
			const glass = qs('.ed-glass', b);
			const gState = b._state.geom;
			const sState = b._state.styles;
			return {
				geom: gState ? Object.assign({}, gState) : {
					left: b.style.left,
					top: b.style.top,
					width: b.style.width,
					height: b.style.height,
					zIndex: b.style.zIndex
				},
				state: {
					fontInput: b._state.fontInput,
					fontStatus: b._state.fontStatus,
					fontError: b._state.fontError,
					padding: Object.assign({}, b._state.padding),
					bg: serializeBg(b._state.bg),
					ipax: Object.assign({}, b._state.ipax, {
						boxEnabled: b._state.ipax.boxEnabled !== false,
						textEnabled: !!b._state.ipax.textEnabled,
						feather: Object.assign({}, b._state.ipax.feather),
						text: Object.assign({ contrast: 7, halo: 12, spread: 35, blur: 0, x: 0, y: 0 }, b._state.ipax.text)
					})
				},
				styles: sState ? Object.assign({}, sState) : {
					fontFamily: glass.style.fontFamily,
					fontSize: glass.style.fontSize,
					lineHeight: glass.style.lineHeight,
					color: glass.style.color,
					textAlign: glass.style.textAlign,
					justifyContent: glass.style.justifyContent,
					padding: glass.style.padding
				},
				html: qs('.ed-box-text', b).innerHTML
			};
		});

		const projectJson = JSON.stringify({
			version: 1,
			performance: state.performance ? Object.assign({}, state.performance) : null,
			stageBg: serializeBg(state.stageBg),
			showBorders: state.showBorders,
			boxes
		});

		let byteSize = new TextEncoder().encode(projectJson).length;
		Object.values(blobs).forEach((blob) => { byteSize += blob.size; });

		return { projectJson, blobs, byteSize };
	}

	function serializeProject() {
		return buildSnapshot().projectJson;
	}

	function restoreProject(jsonStr, assetMap) {
		try {
			const data = JSON.parse(jsonStr);
			if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.boxes)) return false;

			const bgApi = j0.get('editor:bg');
			const boxesApi = j0.get('editor:boxes');
			const fontsApi = j0.get('editor:fonts');
			const perfApi = j0.get('editor:perf');
			const presets = j0.get('editor:presets') || global.EdPresets;

			if (bgApi && bgApi.releaseBgImage) bgApi.releaseBgImage(state.stageBg);
			if (boxesApi) qsa('.ed-box', stage).forEach((b) => boxesApi.deleteActiveBox(b));

			state.stageBg = hydrateBg(data.stageBg, assetMap);
			if (bgApi) bgApi.applyBgToLayer(state.stageBg, qs('[data-ed-role="stage-bg"]'), false);

			state.showBorders = !!data.showBorders;
			stage.classList.toggle('show-borders', state.showBorders);

			let maxZ = 10;
			const fontTasks = [];

			data.boxes.forEach((bData) => {
				if (!bData || !bData.geom || !bData.styles || !boxesApi) return;
				const rawIpax = (bData.state && bData.state.ipax) || {};
				const rawText = Object.assign({ contrast: 7, halo: 12, spread: 35, blur: 0, x: 0, y: 0 }, rawIpax.text);
				const inferredTextOn = rawIpax.textEnabled !== undefined ? !!rawIpax.textEnabled : (rawText.contrast > 1 || rawText.blur > 0);
				const hydratedState = Object.assign({}, bData.state, {
					geom: Object.assign({}, bData.geom),
					styles: Object.assign({}, bData.styles),
					padding: Object.assign({ t: 24, r: 24, b: 24, l: 24 }, bData.state && bData.state.padding),
					bg: hydrateBg(bData.state && bData.state.bg, assetMap),
					ipax: Object.assign({ mode: 'default', contrast: 4.5, blur: 8 }, rawIpax, {
						boxEnabled: rawIpax.boxEnabled !== undefined ? !!rawIpax.boxEnabled : true,
						textEnabled: inferredTextOn,
						feather: Object.assign({ t: 14, r: 14, b: 14, l: 14 }, rawIpax.feather),
						text: rawText
					})
				});
				const b = boxesApi.createBox({
					left: parseFloat(bData.geom.left),
					top: parseFloat(bData.geom.top),
					width: parseFloat(bData.geom.width),
					height: parseFloat(bData.geom.height),
					clonedState: hydratedState,
					html: bData.html
				});
				b.style.zIndex = bData.geom.zIndex;
				maxZ = Math.max(maxZ, parseInt(bData.geom.zIndex, 10) || 10);

				const glass = qs('.ed-glass', b);
				glass.style.fontFamily = bData.styles.fontFamily;
				glass.style.fontSize = bData.styles.fontSize;
				glass.style.lineHeight = bData.styles.lineHeight;
				glass.style.color = bData.styles.color;
				glass.style.textAlign = bData.styles.textAlign;
				glass.style.justifyContent = bData.styles.justifyContent || 'center';
				glass.style.padding = bData.styles.padding;
				boxesApi.applyIpaxProps(b);

				if (fontsApi && fontsApi.loadFontForBox && b._state.fontInput) {
					fontTasks.push(fontsApi.loadFontForBox(b, b._state.fontInput, { silent: true }));
				}
			});

			if (data.performance && typeof data.performance === 'object') {
				const fallback = presets ? presets.PROFILES[presets.DEFAULT_PRESET] : { backend: 'auto', performance: 0, minBudget: 65536, cellSize: 12, maxPixelScale: 2 };
				state.performance = Object.assign({ preset: 'custom' }, fallback, data.performance);
			} else if (state.performance === null && presets) {
				const defKey = presets.DEFAULT_PRESET;
				state.performance = Object.assign({ preset: defKey }, presets.PROFILES[defKey]);
			}

			if (perfApi) {
				perfApi.applyConfig();
				perfApi.syncPanel();
			}

			state.zCounter = maxZ;
			if (boxesApi) boxesApi.selectBox(null);

			if (fontTasks.length > 0) {
				Promise.allSettled(fontTasks).then(() => {
					if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshBackdrop);
					else refreshBackdrop();
				});
			}
			return true;
		} catch (e) {
			j0.logger.error('[editor:serializer] Corrupt project data', e);
			return false;
		}
	}

	j0.register('editor:serializer', Object.freeze({ hydrateBg, buildSnapshot, serializeProject, restoreProject, inferMimeFromPath }));
})(typeof globalThis !== 'undefined' ? globalThis : window);