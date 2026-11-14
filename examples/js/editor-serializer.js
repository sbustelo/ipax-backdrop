/* PATH: examples/js/editor-serializer.js */
(function () {
	'use strict';

	const { state, qsa, qs, refreshBackdrop } = window.EdCore;
	const stage = qs('[data-ed-role="stage"]');

	const DEFAULT_BG = {
		type: 'none',
		image: '',
		imgFit: 'cover',
		imgOpacity: 100,
		color: '#000000',
		colorAlpha: 40,
		gradC1: '#000000',
		gradA1: 60,
		gradC2: '#1a4fd6',
		gradA2: 30,
		gradAngle: 135
	};

	const MIME_BY_EXT = {
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		webp: 'image/webp',
		gif: 'image/gif',
		svg: 'image/svg+xml'
	};

	const EXT_BY_MIME = {
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/webp': 'webp',
		'image/gif': 'gif',
		'image/svg+xml': 'svg'
	};

	function sanitizeAssetName(fileName, blobType, index) {
		const base = (fileName || '').split(/[\\/]/).pop().trim();
		const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
		const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(cleaned);
		const ext = EXT_BY_MIME[blobType] || 'png';
		const finalName = cleaned ? (hasExt ? cleaned : `${cleaned}.${ext}`) : `image.${ext}`;
		const prefix = String(index).padStart(2, '0');
		return `img/${prefix}-${finalName}`;
	}

	function inferMimeFromPath(path) {
		const ext = (path.split('.').pop() || '').toLowerCase();
		return MIME_BY_EXT[ext] || 'application/octet-stream';
	}

	function dataUrlToBlob(dataUrl) {
		const parts = dataUrl.split(',');
		const mimeMatch = parts[0].match(/:(.*?);/);
		const mime = mimeMatch ? mimeMatch[1] : 'image/png';
		const binStr = atob(parts[1] || '');
		const bytes = new Uint8Array(binStr.length);
		for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
		return new Blob([bytes], { type: mime });
	}

	function hydrateBg(bg, assetMap) {
		const hydrated = Object.assign({}, DEFAULT_BG, bg || {}, { _blob: null, _fileName: '' });
		if (hydrated.type === 'image' && hydrated.image) {
			if (assetMap && assetMap.has(hydrated.image)) {
				const asset = assetMap.get(hydrated.image);
				hydrated.image = asset.url;
				hydrated._blob = asset.blob;
				hydrated._fileName = asset.fileName;
			} else if (hydrated.image.startsWith('data:image/')) {
				const blob = dataUrlToBlob(hydrated.image);
				const ext = EXT_BY_MIME[blob.type] || 'png';
				hydrated.image = URL.createObjectURL(blob);
				hydrated._blob = blob;
				hydrated._fileName = `embedded.${ext}`;
			}
		}
		return hydrated;
	}

	function buildSnapshot() {
		const blobToPath = new Map();
		const blobs = {};
		let assetIndex = 0;

		function serializeBg(bg) {
			if (!bg || bg.type === 'none') return { type: 'none' };
			if (bg.type === 'image') {
				let imageRef = bg.image || '';
				if (bg._blob instanceof Blob) {
					if (blobToPath.has(bg._blob)) {
						imageRef = blobToPath.get(bg._blob);
					} else {
						assetIndex += 1;
						imageRef = sanitizeAssetName(bg._fileName, bg._blob.type, assetIndex);
						blobToPath.set(bg._blob, imageRef);
						blobs[imageRef] = bg._blob;
					}
				}
				return {
					type: 'image',
					image: imageRef,
					imgFit: bg.imgFit || 'cover',
					imgOpacity: bg.imgOpacity ?? 100
				};
			}
			if (bg.type === 'color') {
				return { type: 'color', color: bg.color || '#000000', colorAlpha: bg.colorAlpha ?? 40 };
			}
			if (bg.type === 'gradient') {
				return {
					type: 'gradient',
					gradC1: bg.gradC1 || '#000000',
					gradA1: bg.gradA1 ?? 60,
					gradC2: bg.gradC2 || '#1a4fd6',
					gradA2: bg.gradA2 ?? 30,
					gradAngle: bg.gradAngle ?? 135
				};
			}
			return { type: 'none' };
		}

		const boxes = qsa('.ed-box', stage).map((b) => {
			const glass = qs('.ed-glass', b);
			return {
				geom: { left: b.style.left, top: b.style.top, width: b.style.width, height: b.style.height, zIndex: b.style.zIndex },
				state: {
					fontInput: b._state.fontInput,
					fontStatus: b._state.fontStatus,
					fontError: b._state.fontError,
					padding: Object.assign({}, b._state.padding),
					bg: serializeBg(b._state.bg),
					ipax: Object.assign({}, b._state.ipax, { feather: Object.assign({}, b._state.ipax.feather) })
				},
				styles: {
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
			if (data.version !== 1) return false;

			if (window.EdBg && window.EdBg.releaseBgImage) {
				window.EdBg.releaseBgImage(state.stageBg);
			}
			qsa('.ed-box', stage).forEach((b) => window.EdBoxes.deleteActiveBox(b));

			state.stageBg = hydrateBg(data.stageBg, assetMap);
			if (window.EdBg) window.EdBg.applyBgToLayer(state.stageBg, qs('[data-ed-role="stage-bg"]'), false);

			state.showBorders = !!data.showBorders;
			stage.classList.toggle('show-borders', state.showBorders);

			let maxZ = 10;
			const fontTasks = [];

			data.boxes.forEach((bData) => {
				const hydratedState = Object.assign({}, bData.state, {
					padding: Object.assign({ t: 24, r: 24, b: 24, l: 24 }, bData.state && bData.state.padding),
					bg: hydrateBg(bData.state && bData.state.bg, assetMap),
					ipax: Object.assign({ mode: 'default', contrast: 4.5, blur: 8 }, bData.state && bData.state.ipax, {
						feather: Object.assign({ t: 14, r: 14, b: 14, l: 14 }, bData.state && bData.state.ipax && bData.state.ipax.feather)
					})
				});
				const b = window.EdBoxes.createBox({
					left: parseFloat(bData.geom.left), top: parseFloat(bData.geom.top),
					width: parseFloat(bData.geom.width), height: parseFloat(bData.geom.height),
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
				window.EdBoxes.applyIpaxProps(b);

				if (window.EdFonts && window.EdFonts.loadFontForBox && b._state.fontInput) {
					fontTasks.push(window.EdFonts.loadFontForBox(b, b._state.fontInput, { silent: true }));
				}
			});

			if (data.performance && typeof data.performance === 'object') {
				const presets = window.EdPresets;
				const fallback = presets ? presets.PROFILES[presets.DEFAULT_PRESET] : { backend: 'auto', performance: 0, minBudget: 60000, cellSize: 12, maxPixelScale: 2 };
				state.performance = Object.assign({ preset: 'custom' }, fallback, data.performance);
			} else if (state.performance === null && window.EdPresets) {
				const defKey = window.EdPresets.DEFAULT_PRESET;
				state.performance = Object.assign({ preset: defKey }, window.EdPresets.PROFILES[defKey]);
			}

			if (window.EdPerf) {
				window.EdPerf.applyConfig();
				window.EdPerf.syncPanel();
			}

			state.zCounter = maxZ;
			window.EdBoxes.selectBox(null);

			if (fontTasks.length > 0) {
				Promise.allSettled(fontTasks).then(() => {
					if (document.fonts && document.fonts.ready) {
						document.fonts.ready.then(refreshBackdrop);
					} else {
						refreshBackdrop();
					}
				});
			}

			return true;
		} catch (e) {
			console.error('[EdSerializer] Corrupt project data', e);
			return false;
		}
	}

	window.EdSerializer = { hydrateBg, buildSnapshot, serializeProject, restoreProject, inferMimeFromPath };
})();