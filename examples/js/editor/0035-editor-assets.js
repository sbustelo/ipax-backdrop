// PATH: examples/js/editor/0035-editor-assets.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	const DEFAULT_BG = Object.freeze({
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
	});

	const MIME_BY_EXT = Object.freeze({
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		webp: 'image/webp',
		gif: 'image/gif',
		svg: 'image/svg+xml'
	});

	const EXT_BY_MIME = Object.freeze({
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/webp': 'webp',
		'image/gif': 'gif',
		'image/svg+xml': 'svg'
	});

	function sanitizeAssetName(fileName, blobType, index) {
		const base = (fileName || '').split(/[\\/]/).pop().trim();
		const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
		const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(cleaned);
		const ext = EXT_BY_MIME[blobType] || 'png';
		const finalName = cleaned ? (hasExt ? cleaned : cleaned + '.' + ext) : 'image.' + ext;
		const prefix = String(index).padStart(2, '0');
		return 'img/' + prefix + '-' + finalName;
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
				hydrated._fileName = 'embedded.' + ext;
			}
		}
		return hydrated;
	}

	function createBgSerializer(blobsOut) {
		const blobToPath = new Map();
		let assetIndex = 0;

		return function serializeBg(bg) {
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
						blobsOut[imageRef] = bg._blob;
					}
				}
				return { type: 'image', image: imageRef, imgFit: bg.imgFit || 'cover', imgOpacity: bg.imgOpacity ?? 100 };
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
		};
	}

	j0.register('editor:assets', Object.freeze({ inferMimeFromPath, hydrateBg, createBgSerializer }));
})(typeof globalThis !== 'undefined' ? globalThis : window);