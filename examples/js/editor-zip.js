/* PATH: examples/js/editor-zip.js */
(function () {
	'use strict';

	const CRC_TABLE = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
		CRC_TABLE[i] = c >>> 0;
	}

	function crc32(bytes) {
		let crc = 0xffffffff;
		for (let i = 0; i < bytes.length; i++) {
			crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
		}
		return (crc ^ 0xffffffff) >>> 0;
	}

	function getDosDateTime(date = new Date()) {
		const year = Math.max(1980, date.getFullYear());
		const dosTime = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
		const dosDate = (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
		return { dosTime, dosDate };
	}

	function createZip(entries) {
		const encoder = new TextEncoder();
		const { dosTime, dosDate } = getDosDateTime();
		const localParts = [];
		const centralParts = [];
		let offset = 0;

		entries.forEach((entry) => {
			const nameBytes = encoder.encode(entry.name);
			const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
			const crc = crc32(data);
			const size = data.length;

			const localHeader = new ArrayBuffer(30);
			const lv = new DataView(localHeader);
			lv.setUint32(0, 0x04034b50, true);
			lv.setUint16(4, 20, true);
			lv.setUint16(6, 0x0800, true);
			lv.setUint16(8, 0, true);
			lv.setUint16(10, dosTime, true);
			lv.setUint16(12, dosDate, true);
			lv.setUint32(14, crc, true);
			lv.setUint32(18, size, true);
			lv.setUint32(22, size, true);
			lv.setUint16(26, nameBytes.length, true);
			lv.setUint16(28, 0, true);

			localParts.push(localHeader, nameBytes, data);

			const centralHeader = new ArrayBuffer(46);
			const cv = new DataView(centralHeader);
			cv.setUint32(0, 0x02014b50, true);
			cv.setUint16(4, 20, true);
			cv.setUint16(6, 20, true);
			cv.setUint16(8, 0x0800, true);
			cv.setUint16(10, 0, true);
			cv.setUint16(12, dosTime, true);
			cv.setUint16(14, dosDate, true);
			cv.setUint32(16, crc, true);
			cv.setUint32(20, size, true);
			cv.setUint32(24, size, true);
			cv.setUint16(28, nameBytes.length, true);
			cv.setUint16(30, 0, true);
			cv.setUint16(32, 0, true);
			cv.setUint16(34, 0, true);
			cv.setUint16(36, 0, true);
			cv.setUint32(38, 0, true);
			cv.setUint32(42, offset, true);

			centralParts.push(centralHeader, nameBytes);
			offset += 30 + nameBytes.length + size;
		});

		const centralSize = centralParts.reduce((acc, part) => acc + (part.byteLength || part.length), 0);
		const eocd = new ArrayBuffer(22);
		const ev = new DataView(eocd);
		ev.setUint32(0, 0x06054b50, true);
		ev.setUint16(4, 0, true);
		ev.setUint16(6, 0, true);
		ev.setUint16(8, entries.length, true);
		ev.setUint16(10, entries.length, true);
		ev.setUint32(12, centralSize, true);
		ev.setUint32(16, offset, true);
		ev.setUint16(20, 0, true);

		return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
	}

	function isZipBuffer(buffer) {
		const bytes = new Uint8Array(buffer);
		return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
	}

	async function inflateRaw(bytes) {
		const ds = new DecompressionStream('deflate-raw');
		const writer = ds.writable.getWriter();
		writer.write(bytes);
		writer.close();
		const out = await new Response(ds.readable).arrayBuffer();
		return new Uint8Array(out);
	}

	async function readZip(buffer) {
		const bytes = new Uint8Array(buffer);
		const view = new DataView(buffer);
		const decoder = new TextDecoder();
		const minPos = Math.max(0, bytes.length - 65557);
		let eocdPos = -1;

		for (let i = bytes.length - 22; i >= minPos; i--) {
			if (view.getUint32(i, true) === 0x06054b50) {
				eocdPos = i;
				break;
			}
		}
		if (eocdPos < 0) throw new Error('Invalid ZIP archive: EOCD not found');

		const totalEntries = view.getUint16(eocdPos + 10, true);
		let cdPos = view.getUint32(eocdPos + 16, true);
		const files = new Map();

		for (let i = 0; i < totalEntries; i++) {
			if (view.getUint32(cdPos, true) !== 0x02014b50) throw new Error('Invalid ZIP Central Directory');
			const method = view.getUint16(cdPos + 10, true);
			const compSize = view.getUint32(cdPos + 20, true);
			const nameLen = view.getUint16(cdPos + 28, true);
			const extraLen = view.getUint16(cdPos + 30, true);
			const commentLen = view.getUint16(cdPos + 32, true);
			const localOffset = view.getUint32(cdPos + 42, true);

			const rawName = decoder.decode(bytes.subarray(cdPos + 46, cdPos + 46 + nameLen)).replace(/\\/g, '/');
			cdPos += 46 + nameLen + extraLen + commentLen;

			if (rawName.endsWith('/')) continue;
			if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Invalid ZIP Local Header');

			const lNameLen = view.getUint16(localOffset + 26, true);
			const lExtraLen = view.getUint16(localOffset + 28, true);
			const dataStart = localOffset + 30 + lNameLen + lExtraLen;
			const slice = bytes.subarray(dataStart, dataStart + compSize);

			if (method === 0) {
				files.set(rawName, new Uint8Array(slice));
			} else if (method === 8 && typeof DecompressionStream !== 'undefined') {
				files.set(rawName, await inflateRaw(slice));
			} else {
				throw new Error(`Unsupported ZIP compression method: ${method}`);
			}
		}

		return files;
	}

	window.EdZip = { createZip, readZip, isZipBuffer };
})();