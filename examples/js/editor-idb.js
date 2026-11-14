/* PATH: examples/js/editor-idb.js */
(function () {
	'use strict';

	const { qs } = window.EdCore;
	const DB_NAME = 'ipax-backdrop-editor-db';
	const DB_VERSION = 1;
	const STORE_NAME = 'projects';
	let dbPromise = null;

	function formatBytes(bytes) {
		if (!bytes || bytes <= 0) return '0 bytes';
		if (bytes < 1024) return `${bytes} bytes`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function setStatus(label) {
		const el = qs('[data-ed-role="storage-status"]');
		if (el) el.textContent = label;
	}

	function openDb() {
		if (dbPromise) return dbPromise;
		dbPromise = new Promise((resolve, reject) => {
			if (!window.indexedDB) {
				reject(new Error('IndexedDB not supported'));
				return;
			}
			const req = window.indexedDB.open(DB_NAME, DB_VERSION);
			req.onupgradeneeded = (e) => {
				const db = e.target.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME);
				}
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		return dbPromise;
	}

	async function get(key) {
		const db = await openDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const req = tx.objectStore(STORE_NAME).get(key);
			req.onsuccess = () => resolve(req.result || null);
			req.onerror = () => reject(req.error);
		});
	}

	async function set(key, value) {
		const db = await openDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			tx.objectStore(STORE_NAME).put(value, key);
			tx.oncomplete = () => resolve(true);
			tx.onerror = () => reject(tx.error);
		});
	}

	async function del(key) {
		const db = await openDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			tx.objectStore(STORE_NAME).delete(key);
			tx.oncomplete = () => resolve(true);
			tx.onerror = () => reject(tx.error);
		});
	}

	window.EdIdb = { get, set, del, formatBytes, setStatus };
})();