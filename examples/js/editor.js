/* === SOURCE: j0010-vfs-core.js === */
// PATH: ai0/j0/src/vfs/j0010-vfs-core.js
(function () {
    'use strict';

    if (!window.j0 || !window.j0.register || !window.j0.bus) {
        return;
    }
    if (window.j0.vfs && window.j0.vfs.kv) {
        return;
    }

    const j0 = window.j0;
    const drivers = new Map();
    const uiSyncMap = new Map();
    const memoryFallback = new Map();
    let activeMode = 'local';

    function readUiCookie() {
        const match = document.cookie.match(/(?:^|;\s*)j0_ui=([^;]+)/);
        if (!match) {
            return {};
        }
        const decoded = decodeURIComponent(match[1]);
        const state = {};
        decoded.split('|').forEach((pair) => {
            const idx = pair.indexOf(':');
            if (idx <= 0) {
                return;
            }
            const shortKey = pair.slice(0, idx);
            const rawVal = pair.slice(idx + 1);
            uiSyncMap.forEach((spec, fullKey) => {
                if (spec.shortKey === shortKey) {
                    state[fullKey] = spec.decode(rawVal);
                }
            });
        });
        return state;
    }

    function writeUiCookie() {
        const parts = [];
        uiSyncMap.forEach((spec, fullKey) => {
            const val = kv.get(fullKey, null);
            if (val !== null) {
                const encoded = spec.encode(val);
                if (encoded !== null && encoded !== undefined && encoded !== '') {
                    parts.push(`${spec.shortKey}:${encoded}`);
                }
            }
        });
        const base = j0.basePath || '/';
        const maxAge = parts.length > 0 ? 31536000 : 0;
        document.cookie = `j0_ui=${encodeURIComponent(parts.join('|'))}; path=${base}; max-age=${maxAge}; SameSite=Lax`;
    }

    function reconcileUiSync() {
        const cookieValues = readUiCookie();
        Object.entries(cookieValues).forEach(([fullKey, val]) => {
            if (kv.get(fullKey, null) !== val) {
                try {
                    window.localStorage.setItem(fullKey, String(val));
                } catch (e) {
                    memoryFallback.set(fullKey, String(val));
                }
            }
        });
    }

    const kv = {
        get(key, defaultValue = null, maxAgeMs = 0) {
            try {
                if (maxAgeMs > 0) {
                    const tsRaw = window.localStorage.getItem('__j0t_' + key);
                    if (tsRaw && Date.now() - parseInt(tsRaw, 10) > maxAgeMs) {
                        kv.remove(key);
                        return defaultValue;
                    }
                }
                const val = window.localStorage.getItem(key);
                return val !== null ? val : defaultValue;
            } catch (e) {
                return memoryFallback.has(key) ? memoryFallback.get(key) : defaultValue;
            }
        },

        set(key, value, options = {}) {
            const strVal = String(value);
            try {
                window.localStorage.setItem(key, strVal);
                window.localStorage.setItem('__j0t_' + key, String(Date.now()));
            } catch (e) {
                memoryFallback.set(key, strVal);
                if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
                    j0.bus.emit('j0:vfs:quota-exceeded', { key });
                }
            }
            if (options.profile === 'ui-sync' || uiSyncMap.has(key)) {
                writeUiCookie();
            }
            j0.bus.emit('j0:vfs:changed', { scope: 'kv', key });
            return true;
        },

        remove(key) {
            try {
                window.localStorage.removeItem(key);
                window.localStorage.removeItem('__j0t_' + key);
            } catch (e) {
                memoryFallback.delete(key);
            }
            if (uiSyncMap.has(key)) {
                writeUiCookie();
            }
            j0.bus.emit('j0:vfs:changed', { scope: 'kv', key });
        }
    };

    const vfs = {
        kv,
        get: (key, def = null, maxAgeMs = 0) => kv.get(key, def, maxAgeMs),
        set: (key, val, opts = {}) => kv.set(key, val, opts),
        remove: (key) => kv.remove(key),

        registerUiSync(key, spec) {
            if (!key || !spec || !spec.shortKey) {
                return;
            }
            uiSyncMap.set(key, {
                shortKey: String(spec.shortKey),
                encode: typeof spec.encode === 'function' ? spec.encode : (v) => String(v),
                decode: typeof spec.decode === 'function' ? spec.decode : (v) => String(v)
            });
            reconcileUiSync();
        },

        registerDriver(name, driver) {
            drivers.set(name, driver);
            j0.bus.emit('j0:vfs:driver-registered', { name });
        },

        getDriver(name) {
            return drivers.get(name) ?? null;
        },

        mode() {
            return activeMode;
        },

        setMode(nextMode) {
            if (activeMode === nextMode) {
                return;
            }
            activeMode = nextMode;
            j0.bus.emit('j0:vfs:mode-changed', { mode: activeMode });
        }
    };

    j0.bus.schema['j0:vfs:changed'] = { scope: 'string', key: 'string' };
    j0.bus.schema['j0:vfs:quota-exceeded'] = { key: 'string' };
    j0.bus.schema['j0:vfs:driver-registered'] = { name: 'string' };
    j0.bus.schema['j0:vfs:mode-changed'] = { mode: 'string' };

    j0.vfs = vfs;
    j0.register('vfs', vfs);
})();
;
/* === SOURCE: j0020-vfs-idb.js === */
// PATH: ai0/j0/src/vfs/j0020-vfs-idb.js
(function () {
    'use strict';

    if (!window.j0 || !window.j0.vfs) {
        return;
    }

    const DB_NAME = 'j0_vfs_store_v1';
    const DB_VERSION = 1;
    const STORE_BLOBS = 'blobs';
    const STORE_DOCS = 'docs';
    let dbPromise = null;

    function openDb() {
        if (dbPromise) {
            return dbPromise;
        }
        dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB unavailable'));
                return;
            }
            const req = window.indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (ev) => {
                const db = ev.target.result;
                if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                    db.createObjectStore(STORE_BLOBS, { keyPath: 'hash' });
                }
                if (!db.objectStoreNames.contains(STORE_DOCS)) {
                    const docsStore = db.createObjectStore(STORE_DOCS, { keyPath: 'pk' });
                    docsStore.createIndex('by_collection', 'collection', { unique: false });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    async function hashBlob(blob) {
        const buf = await blob.arrayBuffer();
        if (window.crypto && window.crypto.subtle) {
            const digest = await window.crypto.subtle.digest('SHA-256', buf);
            return Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
        }
        const bytes = new Uint8Array(buf);
        let h = 2166136261;
        for (let i = 0; i < bytes.length; i++) {
            h ^= bytes[i];
            h = Math.imul(h, 16777619);
        }
        return 'fnv1a_' + (h >>> 0).toString(16).padStart(8, '0') + '_' + bytes.length;
    }

    const idbDriver = {
        async putBlob(blob) {
            const hash = await hashBlob(blob);
            const db = await openDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_BLOBS, 'readwrite');
                const store = tx.objectStore(STORE_BLOBS);
                const check = store.get(hash);
                check.onsuccess = () => {
                    if (!check.result) {
                        store.put({
                            hash,
                            blob,
                            type: blob.type || 'application/octet-stream',
                            size: blob.size || 0,
                            createdAt: Date.now()
                        });
                    }
                };
                tx.oncomplete = () => resolve(hash);
                tx.onerror = () => reject(tx.error);
            });
        },

        async getBlob(hash) {
            const db = await openDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_BLOBS, 'readonly');
                const req = tx.objectStore(STORE_BLOBS).get(hash);
                req.onsuccess = () => resolve(req.result ? req.result.blob : null);
                req.onerror = () => reject(req.error);
            });
        },

        async removeBlob(hash) {
            const db = await openDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_BLOBS, 'readwrite');
                tx.objectStore(STORE_BLOBS).delete(hash);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
            });
        },

        async listBlobs() {
            const db = await openDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_BLOBS, 'readonly');
                const req = tx.objectStore(STORE_BLOBS).getAllKeys();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        },

        async listDocs(collection) {
            const db = await openDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_DOCS, 'readonly');
                const idx = tx.objectStore(STORE_DOCS).index('by_collection');
                const req = idx.getAll(IDBKeyRange.only(collection));
                req.onsuccess = () => {
                    const rows = (req.result || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    resolve(rows);
                };
                req.onerror = () => reject(req.error);
            });
        },

        async getDoc(collection, id) {
            const db = await openDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_DOCS, 'readonly');
                const req = tx.objectStore(STORE_DOCS).get(`${collection}:${id}`);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        },

        async saveDoc(collection, doc) {
            const db = await openDb();
            const record = {
                pk: `${collection}:${doc.id}`,
                collection,
                id: doc.id,
                title: doc.title || 'Untitled',
                preview: doc.preview || '',
                meta: doc.meta || {},
                data: doc.data ?? null,
                blobs: Array.isArray(doc.blobs) ? doc.blobs : [],
                updatedAt: doc.updatedAt || Date.now(),
                dirty: Boolean(doc.dirty)
            };
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_DOCS, 'readwrite');
                tx.objectStore(STORE_DOCS).put(record);
                tx.oncomplete = () => resolve(record);
                tx.onerror = () => reject(tx.error);
            });
        },

        async removeDoc(collection, id) {
            const db = await openDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_DOCS, 'readwrite');
                tx.objectStore(STORE_DOCS).delete(`${collection}:${id}`);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
            });
        }
    };

    window.j0.vfs.registerDriver('idb', idbDriver);
})();
;
/* === SOURCE: j0030-vfs-docs.js === */
// PATH: ai0/j0/src/vfs/j0030-vfs-docs.js
(function () {
    'use strict';

    if (!window.j0 || !window.j0.vfs || !window.j0.bus) {
        return;
    }

    const j0 = window.j0;
    const vfs = j0.vfs;
    const memBlobs = new Map();
    const memDocs = new Map();

    function localDriver() {
        return vfs.getDriver('idb');
    }

    function remoteDriver() {
        return vfs.mode() === 'hybrid-sync' ? vfs.getDriver('remote') : null;
    }

    function generateId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    vfs.blobs = {
        async put(blob) {
            const idb = localDriver();
            const hash = idb ? await idb.putBlob(blob) : ('mem_' + Date.now() + '_' + memBlobs.size);
            if (!idb) {
                memBlobs.set(hash, blob);
            }
            j0.bus.emit('j0:vfs:changed', { scope: 'blobs', key: hash });
            return hash;
        },

        async get(hash) {
            const idb = localDriver();
            if (idb) {
                return idb.getBlob(hash);
            }
            return memBlobs.get(hash) ?? null;
        },

        async has(hash) {
            return (await vfs.blobs.get(hash)) !== null;
        },

        async remove(hash) {
            const idb = localDriver();
            const ok = idb ? await idb.removeBlob(hash) : memBlobs.delete(hash);
            j0.bus.emit('j0:vfs:changed', { scope: 'blobs', key: hash });
            return ok;
        },

        async list() {
            const idb = localDriver();
            return idb ? idb.listBlobs() : Array.from(memBlobs.keys());
        }
    };

    vfs.docs = {
        async list(collection = 'default') {
            const idb = localDriver();
            const localList = idb
                ? await idb.listDocs(collection)
                : Array.from(memDocs.values()).filter((d) => d.collection === collection);

            const remote = remoteDriver();
            if (!remote) {
                return localList;
            }
            return remote.mergeList(collection, localList);
        },

        async get(collection, id) {
            const idb = localDriver();
            const localDoc = idb ? await idb.getDoc(collection, id) : (memDocs.get(`${collection}:${id}`) ?? null);
            const remote = remoteDriver();
            if (localDoc || !remote) {
                return localDoc;
            }
            const fetched = await remote.get(collection, id);
            if (fetched && idb) {
                await idb.saveDoc(collection, Object.assign({}, fetched, { dirty: false }));
            }
            return fetched;
        },

        async save(collection, doc) {
            const id = doc.id || generateId();
            const remote = remoteDriver();
            const draft = Object.assign({}, doc, {
                id,
                updatedAt: Date.now(),
                dirty: Boolean(remote)
            });

            const idb = localDriver();
            const saved = idb
                ? await idb.saveDoc(collection, draft)
                : (() => {
                    memDocs.set(`${collection}:${id}`, Object.assign({ collection }, draft));
                    return memDocs.get(`${collection}:${id}`);
                })();

            j0.bus.emit('j0:vfs:changed', { scope: 'docs', key: `${collection}:${id}` });

            if (remote) {
                remote.push(collection, saved).catch(() => {});
            }
            return saved;
        },

        async remove(collection, id) {
            const idb = localDriver();
            if (idb) {
                await idb.removeDoc(collection, id);
            } else {
                memDocs.delete(`${collection}:${id}`);
            }
            j0.bus.emit('j0:vfs:changed', { scope: 'docs', key: `${collection}:${id}` });

            const remote = remoteDriver();
            if (remote) {
                await remote.remove(collection, id);
            }
            return true;
        },

        async exportJson(collection, id) {
            const doc = await vfs.docs.get(collection, id);
            if (!doc) {
                return null;
            }
            const embeddedBlobs = {};
            for (const hash of (doc.blobs || [])) {
                const blob = await vfs.blobs.get(hash);
                if (blob) {
                    embeddedBlobs[hash] = await blobToDataUrl(blob);
                }
            }
            return { version: 1, collection, doc, blobs: embeddedBlobs };
        },

        async importJson(collection, payload) {
            const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
            if (!parsed || !parsed.doc) {
                throw new Error('Invalid VFS document payload.');
            }
            const hashMap = {};
            if (parsed.blobs && typeof parsed.blobs === 'object') {
                for (const [oldHash, dataUrl] of Object.entries(parsed.blobs)) {
                    const res = await fetch(String(dataUrl));
                    const blob = await res.blob();
                    hashMap[oldHash] = await vfs.blobs.put(blob);
                }
            }
            const remappedBlobs = (parsed.doc.blobs || []).map((h) => hashMap[h] || h);
            return vfs.docs.save(collection, Object.assign({}, parsed.doc, {
                id: parsed.doc.id || generateId(),
                blobs: remappedBlobs
            }));
        },

        async syncOrphans(collection = 'default') {
            const allHashes = await vfs.blobs.list();
            const docs = await vfs.docs.list(collection);
            const used = new Set();
            docs.forEach((d) => (d.blobs || []).forEach((h) => used.add(h)));
            return allHashes.filter((h) => !used.has(h));
        }
    };
})();
;
/* === SOURCE: 0010-example-palettes.js === */
// PATH: examples/js/common/0010-example-palettes.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	const PALETTES = Object.freeze([
		['#8E51FB', '#5A46B5', '#006277', '#00364C', '#262D00', '#2A2439', '#330066', '#05020A'],
		['#FFB8C8', '#FFAD85', '#FA82B2', '#EE7AA8', '#BC579C', '#933477', '#7F2F83', '#482282'],
		['#F9D5D9', '#E0C5BB', '#C5A5B0', '#BB9CA6', '#BC579C', '#6D5764', '#624F62', '#403B4E'],
		['#9BD3FF', '#00D490', '#D8A486', '#BC579C', '#008EB3', '#408158', '#890050', '#294F00'],
		['#BECBEE', '#9CC5E2', '#C1A7B0', '#B89DA6', '#BC579C', '#937888', '#6A5963', '#1C414E'],
		['#9AD5DC', '#57B5BC', '#007B8E', '#004D57', '#00313B'],
		['#FFC265', '#FBA51A', '#F7831E', '#00313B'],
		['#79634A', '#676767', '#651E00', '#393939', '#00313B', '#001100', '#0F0504', '#03000F'],
		['#C0D719', '#D7A419', '#94BC57', '#4A944E', '#168857', '#0C622E'],
		['#D7A419', '#D719A4', '#9449C2', '#810083', '#521458'],
		['#FF0000', '#BB003F', '#8A0031', '#5D0027'],
		['#00FF00', '#F78000', '#E54F34', '#FF0000'],
		['#00FF00', '#00DAFF', '#FF949B', '#00BAFF', '#00BA7A', '#FF0000', '#00769A', '#A000C5'],
		['#F4E757', '#00FF00', '#FF0000', '#C7294A', '#BC003B'],
		['#9e897b', '#916f72', '#ff2e26', '#994e53', '#2873ad', '#f3140d', '#564f56', '#bc0600', '#681f23', '#8b0b0a', '#332a2d', '#13283f', '#6c0202', '#4b0e13', '#120e10'],
		['#fac436', '#fdaa56', '#aaafc0', '#aea883', '#9499a5', '#9b8d78', '#a08d0f', '#f83e43', '#777671', '#856647', '#f4283e', '#5e540d', '#db0d23', '#47421a', '#b60819', '#770419'],
		['#a9d486', '#a9d16b', '#9da857', '#81b151', '#80a32e', '#5c960f', '#75746d', '#5f892f', '#f23631', '#ee2110', '#346904', '#4f530f', '#b60306', '#133d02', '#57090b', '#161905'],
		['#356700', '#0a1e00', '#fe190b', '#284600', '#626913', '#c80000'],
		['#709f02', '#283200', '#bc5f05', '#be0000', '#0a0a00', '#466400'],
		['#5b782c', '#0a0a00', '#e63123', '#283214', '#89733b', '#3c3246'],
		['#c4a65f', '#c4c9d5', '#5a4628', '#aaaaaa', '#b48c50', '#281e14'],
		['#e25804', '#c8beb4', '#b10a26', '#fafafa', '#d29696', '#e6d2dc'],
		['#f79122', '#b4641e', '#1e0a00', '#501e00', '#f0b46e', '#d28c28'],
		['#a07939', '#0a0a00', '#2a2c1f', '#463c28', '#786446', '#d2c8be'],
		['#6d8944', '#a51f50', '#324614', '#95993a', '#828c78', '#5a001e'],
		['#f6c812', '#000000', '#463200', '#fadc6e', '#966e00', '#6e5000'],
		['#b4aa44', '#1e1e28', '#64ae6a', '#3c463c', '#786e28', '#aabe6e'],
		['#37442f', '#000a00', '#d2d2d2', '#282828', '#6e6e6e', '#505050'],
		['#e89a01', '#8a9caa', '#e6e6e6', '#bec8c8', '#5a6947', '#fab478'],
		['#a4946a', '#e6dcd2', '#192116', '#0a0a00', '#505630', '#8c320a'],
		['#4e7ea5', '#000000', '#dee011', '#1e1e1e', '#6b5346', '#3c3c00'],
		['#ae9460', '#0a0a00', '#d2c8be', '#b4aa96', '#f0e6e6', '#32321e'],
		['#cebf00', '#3c3200', '#af0f0a', '#826e00', '#141400', '#8c0000'],
		['#637e15', '#0a1400', '#323c00', '#f0dcbe', '#be1e00'],
		['#87ac80', '#f0f0f0', '#eab4aa', '#0a1e1e', '#78966e', '#d0a5ac'],
		['#94ae1d', '#0a0a00', '#b48744', '#3c3c3c', '#324600', '#5a7800'],
		['#021929', '#00000a', '#a38273', '#6e8282', '#503228', '#785a50'],
		['#92725c', '#0a0a00', '#535741', '#dcdcdc', '#3c3c32', '#b4b4b4'],
		['#938252', '#0a0a00', '#535936', '#dcdcd2', '#28281e'],
		['#112505', '#e4b28d', '#322828', '#504646', '#464600', '#be2800'],
		['#1bd7cc', '#001414', '#900405', '#00323c', '#361e52', '#005a5a'],
		['#c6c9d3', '#fafafa', '#df882f', '#dcdcdc', '#a0a0aa', '#82828c'],
		['#b2897b', '#0a0000', '#47576e', '#503228', '#1f1d26', '#828282'],
		['#99552d', '#462814', '#785032', '#1e0a00', '#aa7864', '#aa968c'],
		['#98b008', '#64780a', '#6fb9d6', '#78823c', '#3c500a', '#aaa046'],
		['#799741', '#0a0a00', '#8d95e6', '#f0f0fa', '#3c501e', '#bec8f0'],
		['#dd9f7e', '#0a0000', '#406679', '#d2beaa', '#8c5a3c', '#aa826e'],
		['#75b9de', '#00000a', '#64aac8', '#14283c', '#5a8296'],
		['#ce8039', '#1e1e14', '#6d772e', '#3c461e', '#b4beb4', '#82501e'],
		['#042a30', '#000a0a', '#bc896a', '#aaaaaa', '#c9cbd5', '#f1f0f7'],
		['#ebc680', '#001428', '#6178a9', '#283c46', '#0b2d44', '#f0e6d2'],
		['#b27c58', '#1e140a', '#c8beb4', '#e6dcdc', '#a08c82', '#3c3228'],
		['#c98f4f', '#0a0a0a', '#c5cad5', '#462814', '#786e6e', '#beaa96'],
		['#d1a37c', '#0a0a00', '#c8c8be', '#5a463c', '#32281e', '#826e64'],
		['#3879e0', '#0a1e3c', '#78a0dc', '#b4c8f0', '#324664'],
		['#f9ce9d', '#c8b4a0', '#335c75', '#000a0a', '#fae6b4', '#6e8282'],
		['#c48f4d', '#001e32', '#faf0dc', '#dcd2be', '#5a463c', '#283c46'],
		['#c99267', '#0a0a00', '#c8c8be', '#645046', '#32281e', '#826e64'],
		['#679f2e', '#1e1e1e', '#a3623a', '#3c3c3c', '#000000', '#655809'],
		['#bd7872', '#e6e6e6', '#bfb6c6', '#000000', '#c8a096', '#c3d1da'],
		['#997054', '#0a0000', '#768358', '#968278', '#b4aaa0', '#32281e'],
		['#679cc6', '#000a1e', '#1e506e', '#96bed2', '#003250'],
		['#ddab9e', '#dcdcdc', '#bebebe', '#a0a0a0', '#000000', '#828282'],
		['#fc8509', '#fad296', '#5f83b9', '#321400', '#2b9b83', '#f0963c'],
		['#99552d', '#3c1e0a', '#785032', '#0a0000', '#aa826e', '#463c32']
	]);

	j0.register('example:palettes', PALETTES);
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0020-example-images.js === */
// PATH: examples/js/common/0020-example-images.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	const PALETTES = (j0.get && j0.get('example:palettes')) || [
		['#8E51FB', '#5A46B5', '#006277', '#00364C']
	];

	function hashString(str) {
		let h = 2166136261;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}

	function shuffleArray(arr) {
		for (let j = arr.length - 1; j > 0; j--) {
			const k = Math.floor(Math.random() * (j + 1));
			const tmp = arr[j];
			arr[j] = arr[k];
			arr[k] = tmp;
		}
		return arr;
	}

	function paletteCount() {
		return PALETTES.length;
	}

	function getPalette(index) {
		const n = PALETTES.length;
		const i = ((Math.floor(Number(index) || 0) % n) + n) % n;
		return PALETTES[i].slice();
	}

	function resolveColors(palette, options) {
		let cols;
		let defaultOrder = 'sequential';

		if (Array.isArray(palette)) {
			cols = palette.length ? palette.slice() : PALETTES[0].slice();
		} else if (typeof palette === 'number' && isFinite(palette)) {
			if (Number.isInteger(palette)) {
				cols = getPalette(palette);
			} else {
				const t = palette <= 0 ? 0 : (palette >= 1 ? 0.999999999 : palette);
				cols = getPalette(Math.floor(t * PALETTES.length));
				defaultOrder = 'random';
			}
		} else if (typeof palette === 'string' && palette !== '' && palette !== 'rand') {
			cols = getPalette(hashString(palette));
		} else {
			cols = getPalette(Math.floor(Math.random() * PALETTES.length));
			defaultOrder = 'random';
		}

		const order = options.colorOrder || defaultOrder;
		if (order === 'random') shuffleArray(cols);

		const limit = options.colors;
		if (Array.isArray(limit)) {
			const minC = Math.max(1, Math.floor(Number(limit[0]) || 1));
			const maxC = Math.max(minC, Math.floor(Number(limit[1]) || minC));
			const count = Math.min(cols.length, minC + Math.floor(Math.random() * (maxC - minC + 1)));
			cols = cols.slice(0, count);
		} else if (typeof limit === 'number' && isFinite(limit) && limit > 0) {
			cols = cols.slice(0, Math.min(cols.length, Math.floor(limit)));
		}

		return cols;
	}

	function resolvePatternSeed(patternSeed) {
		if (typeof patternSeed === 'number' && isFinite(patternSeed)) {
			if (Number.isInteger(patternSeed)) {
				const norm = Math.abs(Math.trunc(patternSeed));
				return norm === 0 ? 1 : ((norm - 1) % 2147483646) + 1;
			}
			const t = patternSeed <= 0 ? 0 : (patternSeed >= 1 ? 0.999999999 : patternSeed);
			return Math.floor(t * 2147483646) + 1;
		}
		if (typeof patternSeed === 'string' && patternSeed !== '' && patternSeed !== 'rand') {
			return (hashString(patternSeed) % 2147483646) + 1;
		}
		return Math.floor(Math.random() * 2147483646) + 1;
	}

	function hexToRgb(hex) {
		const n = parseInt(hex.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}

	function renderCanvas(seed, w, h, cols) {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const g = c.getContext('2d');
		const gr = g.createLinearGradient(0, 0, w, h);
		cols.forEach((k, i) => gr.addColorStop(i / Math.max(1, cols.length - 1), k));
		g.fillStyle = gr;
		g.fillRect(0, 0, w, h);
		const rgbs = cols.map(hexToRgb);
		let sd = resolvePatternSeed(seed);
		const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
		for (let i = 0; i < 90; i++) {
			const rgb = rgbs[Math.floor(rnd() * rgbs.length)];
			const alpha = (0.35 + rnd() * 0.45).toFixed(2);
			g.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
			g.beginPath();
			g.arc(rnd() * w, rnd() * h, 6 + rnd() * Math.min(w, h) / 6, 0, 6.283);
			g.fill();
		}
		return c;
	}

	function paintImage(seed, w, h, cols, quality) {
		const c = renderCanvas(seed, w, h, cols);
		const q = (typeof quality === 'number' && quality > 0 && quality <= 1) ? quality : 0.82;
		return c.toDataURL('image/jpeg', q);
	}

	function generate(width, height, palette, options) {
		const opts = options || {};
		const w = Math.max(1, Math.round(Number(width) || 640));
		const h = Math.max(1, Math.round(Number(height) || 480));
		const cols = resolveColors(palette === undefined ? 'rand' : palette, opts);
		const seed = resolvePatternSeed(opts.patternSeed);
		return paintImage(seed, w, h, cols, opts.quality);
	}

	function generateBlob(width, height, palette, options) {
		const opts = options || {};
		const w = Math.max(1, Math.round(Number(width) || 640));
		const h = Math.max(1, Math.round(Number(height) || 480));
		const cols = resolveColors(palette === undefined ? 'rand' : palette, opts);
		const seed = resolvePatternSeed(opts.patternSeed);
		const c = renderCanvas(seed, w, h, cols);
		const q = (typeof opts.quality === 'number' && opts.quality > 0 && opts.quality <= 1) ? opts.quality : 0.82;
		return new Promise((resolve) => c.toBlob((blob) => resolve(blob), 'image/jpeg', q));
	}

	j0.register('example:images', Object.freeze({
		paletteCount,
		getPalette,
		generate,
		generateBlob,
		paintImage,
		PALETTES
	}));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0030-editor-presets.js === */
// PATH: examples/js/common/0030-editor-presets.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

	const DEFAULT_PRESET = 'balanced';

	const PROFILES = Object.freeze({
		high: Object.freeze({
			label: 'High Quality',
			backend: 'auto',
			performance: 0,
			minBudget: 65536,
			cellSize: 8,
			maxPixelScale: 2
		}),
		balanced: Object.freeze({
			label: 'Balanced',
			backend: 'auto',
			performance: 60,
			minBudget: 65536,
			cellSize: 12,
			maxPixelScale: 2
		}),
		fast: Object.freeze({
			label: 'Fast',
			backend: 'auto',
			performance: 120,
			minBudget: 16384,
			cellSize: 24,
			maxPixelScale: 1
		}),
		cpu: Object.freeze({
			label: 'CPU Fallback',
			backend: 'cpu',
			performance: 30,
			minBudget: 16384,
			cellSize: 24,
			maxPixelScale: 1
		})
	});

	j0.register('editor:presets', Object.freeze({ DEFAULT_PRESET, PROFILES }));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0010-editor-core.js === */
// PATH: examples/js/editor/0010-editor-core.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register || !j0.bus) return;

	const root = document.querySelector('[data-ed-app]');

	const state = {
		activeBox: null,
		zCounter: 10,
		showEffect: true,
		performance: null,
		stageBg: {
			type: 'none',
			image: '',
			imgFit: 'cover',
			imgOpacity: 100,
			color: '#1a1a1a',
			colorAlpha: 100,
			gradC1: '#1a1a1a',
			gradA1: 100,
			gradC2: '#1a4fd6',
			gradA2: 100,
			gradAngle: 135
		}
	};

	let dirtyTimer = null;

	function qs(selector, scope = root) {
		return scope ? scope.querySelector(selector) : null;
	}

	function qsa(selector, scope = root) {
		return scope ? Array.from(scope.querySelectorAll(selector)) : [];
	}

	function hexToRgba(hex, alphaPct) {
		const clean = (hex || '#000000').replace('#', '');
		const r = parseInt(clean.substring(0, 2), 16) || 0;
		const g = parseInt(clean.substring(2, 4), 16) || 0;
		const b = parseInt(clean.substring(4, 6), 16) || 0;
		const a = Math.max(0, Math.min(1, Number(alphaPct) / 100));
		return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
	}

	function rgbToHex(rgbStr) {
		const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(rgbStr || '');
		if (!m) return '#ffffff';
		const hex = (n) => Number(n).toString(16).padStart(2, '0');
		return '#' + hex(m[1]) + hex(m[2]) + hex(m[3]);
	}

	function markDirty() {
		clearTimeout(dirtyTimer);
		dirtyTimer = setTimeout(() => j0.bus.emit('editor:project:dirty', {}), 300);
	}

	function bindSliderPair(controlKey, onChange) {
		const rangeEl = qs('[data-ed-control="' + controlKey + '"]');
		const numEl = qs('[data-ed-num="' + controlKey + '"]');
		if (!rangeEl || !numEl) return;
		rangeEl.addEventListener('input', () => {
			numEl.value = rangeEl.value;
			onChange(Number(rangeEl.value));
			markDirty();
		});
		numEl.addEventListener('input', () => {
			rangeEl.value = numEl.value;
			onChange(Number(numEl.value));
			markDirty();
		});
	}

	function setSliderPair(controlKey, value) {
		const rangeEl = qs('[data-ed-control="' + controlKey + '"]');
		const numEl = qs('[data-ed-num="' + controlKey + '"]');
		if (rangeEl) rangeEl.value = value;
		if (numEl) numEl.value = value;
	}

	function clearInlineTextOverrides(textNode, styleProp) {
		if (!textNode) return;
		qsa('font', textNode).forEach((fontEl) => {
			const parent = fontEl.parentNode;
			while (fontEl.firstChild) parent.insertBefore(fontEl.firstChild, fontEl);
			parent.removeChild(fontEl);
		});
		qsa('*', textNode).forEach((el) => {
			el.style[styleProp] = '';
			if (el.getAttribute('style') === '') el.removeAttribute('style');
			if (el.tagName === 'SPAN' && el.attributes.length === 0) {
				const parent = el.parentNode;
				while (el.firstChild) parent.insertBefore(el.firstChild, el);
				parent.removeChild(el);
			}
		});
	}

	function refreshBackdrop() {
		const ipax = j0.get('ipax-backdrop');
		if (ipax && typeof ipax.refresh === 'function') ipax.refresh();
	}

	j0.register('editor:core', Object.freeze({
		root, state, qs, qsa, markDirty,
		hexToRgba, rgbToHex, bindSliderPair, setSliderPair,
		clearInlineTextOverrides, refreshBackdrop
	}));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0020-editor-zip.js === */
// PATH: examples/js/editor/0020-editor-zip.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	if (!j0 || !j0.register) return;

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
			cv.setUint16(38, 0, true);
			cv.setUint32(42, offset, true);
			centralParts.push(centralHeader, nameBytes);

			offset += 30 + nameBytes.length + size;
		});

		const centralSize = centralParts.reduce((acc, part) => acc + (part.byteLength || part.length), 0);
		const eocd = new ArrayBuffer(22);
		const ev = new DataView(eocd);
		ev.setUint32(0, 0x06054b50, true);
		ev.setUint16(8, entries.length, true);
		ev.setUint16(10, entries.length, true);
		ev.setUint32(12, centralSize, true);
		ev.setUint32(16, offset, true);

		return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
	}

	function isZipBuffer(buffer) {
		if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 22) return false;
		const bytes = new Uint8Array(buffer);
		return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
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
		if (!isZipBuffer(buffer)) throw new Error('Invalid ZIP buffer');
		const bytes = new Uint8Array(buffer);
		const view = new DataView(buffer);
		const decoder = new TextDecoder();
		const minPos = Math.max(0, bytes.length - 65557);
		let eocdPos = -1;

		for (let i = bytes.length - 22; i >= minPos; i--) {
			if (view.getUint32(i, true) === 0x06054b50) { eocdPos = i; break; }
		}
		if (eocdPos < 0) throw new Error('Invalid ZIP archive: EOCD not found');

		const totalEntries = view.getUint16(eocdPos + 10, true);
		let cdPos = view.getUint32(eocdPos + 16, true);
		const files = new Map();

		for (let i = 0; i < totalEntries; i++) {
			if (cdPos + 46 > bytes.length || view.getUint32(cdPos, true) !== 0x02014b50) {
				throw new Error('Invalid ZIP Central Directory');
			}
			const method = view.getUint16(cdPos + 10, true);
			const compSize = view.getUint32(cdPos + 20, true);
			const nameLen = view.getUint16(cdPos + 28, true);
			const extraLen = view.getUint16(cdPos + 30, true);
			const commentLen = view.getUint16(cdPos + 32, true);
			const localOffset = view.getUint32(cdPos + 42, true);
			if (cdPos + 46 + nameLen + extraLen + commentLen > bytes.length) {
				throw new Error('Truncated ZIP Central Directory entry');
			}

			const rawName = decoder.decode(bytes.subarray(cdPos + 46, cdPos + 46 + nameLen)).replace(/\\/g, '/');
			cdPos += 46 + nameLen + extraLen + commentLen;

			if (rawName.endsWith('/') || rawName.indexOf('..') >= 0 || rawName.startsWith('/')) continue;
			if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
				throw new Error('Invalid ZIP Local Header');
			}

			const lNameLen = view.getUint16(localOffset + 26, true);
			const lExtraLen = view.getUint16(localOffset + 28, true);
			const dataStart = localOffset + 30 + lNameLen + lExtraLen;
			if (dataStart + compSize > bytes.length) throw new Error('Truncated ZIP entry payload');

			const slice = bytes.subarray(dataStart, dataStart + compSize);
			if (method === 0) files.set(rawName, new Uint8Array(slice));
			else if (method === 8 && typeof DecompressionStream !== 'undefined') files.set(rawName, await inflateRaw(slice));
			else throw new Error('Unsupported ZIP compression method: ' + method);
		}
		return files;
	}

	j0.register('editor:zip', Object.freeze({ createZip, readZip, isZipBuffer }));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0035-editor-assets.js === */
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
;
/* === SOURCE: 0040-editor-serializer.js === */
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
;
/* === SOURCE: 0050-editor-export-png.js === */
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
;
/* === SOURCE: 0060-editor-storage.js === */
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
;
/* === SOURCE: 0070-editor-performance.js === */
// PATH: examples/js/editor/0070-editor-performance.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	if (!core) return;

	const { state, qs, markDirty, bindSliderPair, setSliderPair, refreshBackdrop } = core;

	const panelPerf = qs('[data-ed-panel="performance"]');
	const presetSel = qs('[data-ed-control="perf-preset"]');
	const customSubpanel = qs('[data-ed-subpanel="perf-custom"]');
	const backendSel = qs('[data-ed-control="perf-backend"]');
	const telemetryEl = qs('[data-ed-role="perf-telemetry"]');

	function getPresets() {
		return j0.get('editor:presets') || {
			DEFAULT_PRESET: 'balanced',
			PROFILES: { balanced: { backend: 'auto', performance: 60, minBudget: 65536, cellSize: 12, maxPixelScale: 2 } }
		};
	}

	function applyConfig() {
		const p = state.performance;
		if (!p) return;
		const ipax = j0.get('ipax-backdrop');
		if (ipax && ipax.config) {
			ipax.config.backend = p.backend;
			ipax.config.cellSize = Number(p.cellSize);
			ipax.config.performance = Number(p.performance);
			ipax.config.minBudget = Number(p.minBudget);
			ipax.config.maxPixelScale = Number(p.maxPixelScale);
		}
		refreshBackdrop();
	}

	function syncPanel() {
		const p = state.performance;
		const presets = getPresets();
		if (!p || !presetSel) return;
		presetSel.value = p.preset || presets.DEFAULT_PRESET;
		if (customSubpanel) customSubpanel.hidden = (presetSel.value !== 'custom');
		if (backendSel) backendSel.value = p.backend;
		setSliderPair('perf-cellsize', p.cellSize);
		setSliderPair('perf-fps', p.performance);
		setSliderPair('perf-budget', p.minBudget);
		setSliderPair('perf-scale', p.maxPixelScale);
	}

	function applyPreset(presetKey) {
		const presets = getPresets();
		if (presetKey === 'custom') {
			if (!state.performance) state.performance = Object.assign({ preset: 'custom' }, presets.PROFILES[presets.DEFAULT_PRESET]);
			else state.performance.preset = 'custom';
			syncPanel();
			markDirty();
			return;
		}
		const resolved = presets.PROFILES[presetKey] ? presetKey : presets.DEFAULT_PRESET;
		state.performance = Object.assign({ preset: resolved }, presets.PROFILES[resolved]);
		applyConfig();
		syncPanel();
		markDirty();
	}

	function switchToCustom() {
		if (!state.performance) return;
		state.performance.preset = 'custom';
		if (presetSel) presetSel.value = 'custom';
		if (customSubpanel) customSubpanel.hidden = false;
	}

	if (presetSel) presetSel.addEventListener('change', () => applyPreset(presetSel.value));

	if (backendSel) {
		backendSel.addEventListener('change', () => {
			if (!state.performance) return;
			state.performance.backend = backendSel.value;
			switchToCustom();
			applyConfig();
			markDirty();
		});
	}

	bindSliderPair('perf-cellsize', (v) => { if (state.performance) { state.performance.cellSize = v; switchToCustom(); applyConfig(); } });
	bindSliderPair('perf-fps', (v) => { if (state.performance) { state.performance.performance = v; switchToCustom(); applyConfig(); } });
	bindSliderPair('perf-budget', (v) => { if (state.performance) { state.performance.minBudget = v; switchToCustom(); applyConfig(); } });
	bindSliderPair('perf-scale', (v) => { if (state.performance) { state.performance.maxPixelScale = v; switchToCustom(); applyConfig(); } });

	j0.bus.on('editor:selection:changed', (box) => {
		if (panelPerf) panelPerf.hidden = !!box;
		if (!box) syncPanel();
	});

	j0.bus.on('ipax-backdrop:updated', (d) => {
		if (!telemetryEl || !d) return;
		const backend = (d.backend || 'unknown').toUpperCase();
		telemetryEl.textContent = 'Engine: ' + backend + ' \u2022 ' + Number(d.ms).toFixed(1) + ' ms';
	});
	j0.bus.on('ipax-backdrop:backend', (d) => {
		if (!telemetryEl || !d) return;
		telemetryEl.textContent = 'Engine: ' + (d.backend || 'unknown').toUpperCase();
	});

	const initialIpax = j0.get('ipax-backdrop');
	if (telemetryEl && initialIpax && typeof initialIpax.backend === 'function' && !initialIpax.backend()) {
		telemetryEl.textContent = 'Engine: idle (0 layers)';
	}

	j0.register('editor:perf', Object.freeze({ applyPreset, applyConfig, syncPanel }));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0080-editor-background.js === */
// PATH: examples/js/editor/0080-editor-background.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	if (!core) return;

	const { state, qs, qsa, markDirty, hexToRgba, bindSliderPair, setSliderPair, refreshBackdrop } = core;

	const stageBgEl = qs('[data-ed-role="stage-bg"]');
	const targetLabel = qs('[data-ed-role="bg-target-label"]');
	const typeSel = qs('[data-ed-control="bg-type"]');
	const subImage = qs('[data-ed-subpanel="bg-image"]');
	const subColor = qs('[data-ed-subpanel="bg-color"]');
	const subGrad = qs('[data-ed-subpanel="bg-gradient"]');
	const imgPreview = qs('[data-ed-action="pick-bg-image"]');
	const imgFile = qs('[data-ed-control="bg-file"]');
	const imgFitSel = qs('[data-ed-control="bg-img-fit"]');
	const imgOpacityRow = qs('[data-ed-role="bg-img-opacity-row"]');
	const btnDelBg = qs('[data-ed-action="delete-bg"]');

	function getTargetBgState() {
		return state.activeBox ? state.activeBox._state.bg : state.stageBg;
	}

	function getTargetDomLayer() {
		return state.activeBox ? qs('.ed-box-bg', state.activeBox) : stageBgEl;
	}

	function applyBgToLayer(bgState, layerEl, isBoxLayer) {
		if (!layerEl) return;
		if (bgState.type === 'none') {
			layerEl.style.backgroundImage = '';
			layerEl.style.backgroundColor = 'transparent';
			layerEl.style.opacity = '1';
		} else if (bgState.type === 'image') {
			layerEl.style.backgroundColor = 'transparent';
			layerEl.style.backgroundImage = bgState.image ? 'url("' + bgState.image + '")' : '';
			layerEl.style.backgroundSize = bgState.imgFit || 'cover';
			layerEl.style.opacity = isBoxLayer ? String((bgState.imgOpacity ?? 100) / 100) : '1';
		} else if (bgState.type === 'color') {
			layerEl.style.backgroundImage = '';
			layerEl.style.backgroundColor = hexToRgba(bgState.color, bgState.colorAlpha);
			layerEl.style.opacity = '1';
		} else if (bgState.type === 'gradient') {
			const c1 = hexToRgba(bgState.gradC1, bgState.gradA1);
			const c2 = hexToRgba(bgState.gradC2, bgState.gradA2);
			layerEl.style.backgroundColor = 'transparent';
			layerEl.style.backgroundImage = 'linear-gradient(' + bgState.gradAngle + 'deg, ' + c1 + ', ' + c2 + ')';
			layerEl.style.opacity = '1';
		}
		refreshBackdrop();
	}

	function syncBackgroundPanel() {
		const isBox = Boolean(state.activeBox);
		const bg = getTargetBgState();
		targetLabel.textContent = isBox ? 'Selected Box' : 'Stage';
		typeSel.value = bg.type;

		subImage.hidden = bg.type !== 'image';
		subColor.hidden = bg.type !== 'color';
		subGrad.hidden = bg.type !== 'gradient';

		if (bg.type === 'image') {
			imgPreview.style.backgroundImage = bg.image ? 'url("' + bg.image + '")' : '';
			imgPreview.classList.toggle('has-image', Boolean(bg.image));
			btnDelBg.disabled = !bg.image;
			imgFitSel.value = bg.imgFit || 'cover';
			imgOpacityRow.hidden = !isBox;
			const opRange = qs('input[type="range"][data-ed-control="bg-img-opacity"]');
			if (opRange) opRange.hidden = !isBox;
			if (isBox) setSliderPair('bg-img-opacity', bg.imgOpacity ?? 100);
		} else if (bg.type === 'color') {
			qs('[data-ed-control="bg-color-val"]').value = bg.color;
			setSliderPair('bg-color-alpha', bg.colorAlpha);
		} else if (bg.type === 'gradient') {
			qs('[data-ed-control="bg-grad-c1"]').value = bg.gradC1;
			setSliderPair('bg-grad-a1', bg.gradA1);
			qs('[data-ed-control="bg-grad-c2"]').value = bg.gradC2;
			setSliderPair('bg-grad-a2', bg.gradA2);
			setSliderPair('bg-grad-angle', bg.gradAngle);
		}
	}

	function isBlobUrlStillReferenced(url, excludeBg) {
		if (!url || !url.startsWith('blob:')) return false;
		if (state.stageBg !== excludeBg && state.stageBg.image === url) return true;
		return qsa('.ed-box', qs('[data-ed-role="stage"]')).some((box) => {
			const boxBg = box._state && box._state.bg;
			return boxBg && boxBg !== excludeBg && boxBg.image === url;
		});
	}

	function releaseBgImage(bg) {
		if (!bg) return;
		const oldUrl = bg.image;
		bg.image = '';
		bg._blob = null;
		bg._fileName = '';
		if (oldUrl && oldUrl.startsWith('blob:') && !isBlobUrlStillReferenced(oldUrl, bg)) {
			URL.revokeObjectURL(oldUrl);
		}
	}

	function loadFileIntoTarget(file, explicitBox) {
		if (!file || !file.type.startsWith('image/')) return;
		if (explicitBox && state.activeBox !== explicitBox) j0.bus.emit('editor:box:request-select', explicitBox);
		const isBox = Boolean(state.activeBox);
		const bg = getTargetBgState();
		releaseBgImage(bg);
		bg.type = 'image';
		bg.image = URL.createObjectURL(file);
		bg._blob = file;
		bg._fileName = file.name || 'image.png';
		if (isBox && bg.imgOpacity === undefined) bg.imgOpacity = 100;
		if (!bg.imgFit) bg.imgFit = 'cover';
		applyBgToLayer(bg, getTargetDomLayer(), isBox);
		syncBackgroundPanel();
		markDirty();
	}

	function updateActiveBg() {
		applyBgToLayer(getTargetBgState(), getTargetDomLayer(), Boolean(state.activeBox));
		markDirty();
	}

	typeSel.addEventListener('change', () => {
		const bg = getTargetBgState();
		if (typeSel.value !== 'image') releaseBgImage(bg);
		bg.type = typeSel.value;
		updateActiveBg();
		syncBackgroundPanel();
	});
	imgFitSel.addEventListener('change', () => { getTargetBgState().imgFit = imgFitSel.value; updateActiveBg(); });
	imgPreview.addEventListener('click', () => imgFile.click());
	imgFile.addEventListener('change', (e) => { loadFileIntoTarget(e.target.files[0], null); imgFile.value = ''; });
	btnDelBg.addEventListener('click', () => { releaseBgImage(getTargetBgState()); updateActiveBg(); syncBackgroundPanel(); });

	['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => global.addEventListener(evt, (e) => e.preventDefault()));
	['dragenter', 'dragover'].forEach((evt) => imgPreview.addEventListener(evt, () => imgPreview.classList.add('is-dragover')));
	['dragleave', 'drop'].forEach((evt) => imgPreview.addEventListener(evt, () => imgPreview.classList.remove('is-dragover')));
	imgPreview.addEventListener('drop', (e) => loadFileIntoTarget(e.dataTransfer && e.dataTransfer.files[0], null));
	qs('[data-ed-role="stage"]').addEventListener('drop', (e) => {
		const dropBox = e.target.closest('.ed-box');
		if (!dropBox && state.activeBox) j0.bus.emit('editor:box:request-select', null);
		loadFileIntoTarget(e.dataTransfer && e.dataTransfer.files[0], dropBox);
	});

	bindSliderPair('bg-img-opacity', (v) => { getTargetBgState().imgOpacity = v; updateActiveBg(); });
	qs('[data-ed-control="bg-color-val"]').addEventListener('input', (e) => { getTargetBgState().color = e.target.value; updateActiveBg(); });
	bindSliderPair('bg-color-alpha', (v) => { getTargetBgState().colorAlpha = v; updateActiveBg(); });
	qs('[data-ed-control="bg-grad-c1"]').addEventListener('input', (e) => { getTargetBgState().gradC1 = e.target.value; updateActiveBg(); });
	bindSliderPair('bg-grad-a1', (v) => { getTargetBgState().gradA1 = v; updateActiveBg(); });
	qs('[data-ed-control="bg-grad-c2"]').addEventListener('input', (e) => { getTargetBgState().gradC2 = e.target.value; updateActiveBg(); });
	bindSliderPair('bg-grad-a2', (v) => { getTargetBgState().gradA2 = v; updateActiveBg(); });
	bindSliderPair('bg-grad-angle', (v) => { getTargetBgState().gradAngle = v; updateActiveBg(); });

	j0.bus.on('editor:selection:changed', syncBackgroundPanel);
	j0.register('editor:bg', Object.freeze({ applyBgToLayer, syncBackgroundPanel, releaseBgImage }));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0090-editor-boxes.js === */
// PATH: examples/js/editor/0090-editor-boxes.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	if (!core) return;

	const { state, qs, markDirty, refreshBackdrop } = core;
	const stage = qs('[data-ed-role="stage"]');
	const boxTpl = document.querySelector('[data-ed-tpl="box"]');

	function cleanEmptyTextNode(textNode) {
		if (!textNode) return;
		if (textNode.textContent.trim() === '' && !textNode.querySelector('img')) textNode.textContent = '';
	}

	function removeBoxDom(box) {
		if (!box) return;
		const bgApi = j0.get('editor:bg');
		if (box._state && box._state.bg && bgApi && bgApi.releaseBgImage) {
			bgApi.releaseBgImage(box._state.bg);
		}
		const prev = box.previousElementSibling;
		if (prev && prev.tagName && prev.tagName.toLowerCase() === 'ipax-backdrop-layer') prev.remove();
		box.remove();
	}

	function setBoxGeom(box, patch) {
		if (!box) return;
		if (!box._state.geom) box._state.geom = {};
		Object.entries(patch).forEach(([prop, val]) => {
			box.style[prop] = val;
			box._state.geom[prop] = val;
		});
	}

	function applyIpaxProps(box) {
		const glass = qs('.ed-glass', box);
		const ip = box._state.ipax;
		glass.style.setProperty('--ipax-mode', ip.mode);

		if (ip.boxEnabled !== false) {
			glass.style.setProperty('--ipax-backdrop-contrast', String(ip.contrast));
			glass.style.setProperty('--ipax-backdrop-blur', ip.blur + 'px');
			glass.style.setProperty('--ipax-backdrop-feather', ip.feather.t + 'px ' + ip.feather.r + 'px ' + ip.feather.b + 'px ' + ip.feather.l + 'px');
		} else {
			glass.style.setProperty('--ipax-backdrop-contrast', '1');
			glass.style.setProperty('--ipax-backdrop-blur', '0px');
			glass.style.setProperty('--ipax-backdrop-feather', '0px');
		}

		const t = ip.text || { contrast: 7, halo: 12, spread: 35, blur: 0, x: 0, y: 0 };
		if (ip.textEnabled && (t.contrast > 1 || t.blur > 0)) {
			glass.style.setProperty('--ipax-text', t.x + 'px ' + t.y + 'px ' + t.halo + 'px ' + t.spread + '% ' + t.contrast + ':1 ' + t.blur + 'px');
		} else {
			glass.style.removeProperty('--ipax-text');
		}
		refreshBackdrop();
	}

	function selectBox(box) {
		if (state.activeBox && state.activeBox !== box) {
			state.activeBox.classList.remove('is-selected');
			cleanEmptyTextNode(qs('.ed-box-text', state.activeBox));
		}
		state.activeBox = box;
		if (box) {
			box.classList.add('is-selected');
			setBoxGeom(box, { zIndex: String(++state.zCounter) });
		}
		j0.bus.emit('editor:selection:changed', box);
	}

	function insertPlainText(textNode, plainText) {
		const sel = global.getSelection();
		if (sel && sel.rangeCount > 0 && textNode.contains(sel.anchorNode)) {
			const range = sel.getRangeAt(0);
			range.deleteContents();
			const node = document.createTextNode(plainText);
			range.insertNode(node);
			range.setStartAfter(node);
			range.collapse(true);
			sel.removeAllRanges();
			sel.addRange(range);
		} else {
			textNode.appendChild(document.createTextNode(plainText));
		}
	}

	function buildBoxElement(opts) {
		const box = boxTpl.content.firstElementChild.cloneNode(true);
		const fVal = opts.feather ?? 14;
		box._state = opts.clonedState || {
			fontInput: opts.font || 'system-ui, -apple-system, sans-serif',
			fontStatus: 'System font stack',
			fontError: false,
			padding: { t: 24, r: 24, b: 24, l: 24 },
			bg: { type: 'none', image: '', imgFit: 'cover', imgOpacity: 100, color: '#000000', colorAlpha: 40, gradC1: '#000000', gradA1: 60, gradC2: '#1a4fd6', gradA2: 30, gradAngle: 135 },
			ipax: {
				mode: 'default',
				boxEnabled: true,
				contrast: opts.contrast ?? 4.5,
				blur: opts.blur ?? 8,
				feather: { t: fVal, r: fVal, b: fVal, l: fVal },
				textEnabled: false,
				text: { contrast: 7, halo: 12, spread: 35, blur: 0, x: 0, y: 0 }
			}
		};

		setBoxGeom(box, {
			left: (opts.left ?? 80) + 'px',
			top: (opts.top ?? 80) + 'px',
			width: (opts.width ?? 360) + 'px',
			height: (opts.height ?? 140) + 'px',
			zIndex: box._state.geom ? (box._state.geom.zIndex || String(state.zCounter)) : String(state.zCounter)
		});

		const p = box._state.padding;
		const st = Object.assign({
			fontFamily: opts.fontFamily || box._state.fontInput,
			fontSize: (opts.fontSize ?? 32) + 'px',
			lineHeight: opts.lineHeight || '1.25',
			color: opts.color || '#ffffff',
			textAlign: opts.textAlign || 'left',
			justifyContent: opts.justifyContent || 'center',
			padding: p.t + 'px ' + p.r + 'px ' + p.b + 'px ' + p.l + 'px'
		}, box._state.styles || {});
		box._state.styles = st;

		const glass = qs('.ed-glass', box);
		Object.assign(glass.style, st);

		const textNode = qs('.ed-box-text', box);
		if (opts.html !== undefined) textNode.innerHTML = opts.html;
		else textNode.textContent = opts.text || '';

		textNode.addEventListener('paste', (e) => {
			e.preventDefault();
			const raw = (e.clipboardData || global.clipboardData).getData('text/plain');
			insertPlainText(textNode, raw);
			markDirty();
		});
		textNode.addEventListener('input', () => { cleanEmptyTextNode(textNode); refreshBackdrop(); markDirty(); });
		textNode.addEventListener('blur', () => cleanEmptyTextNode(textNode));

		stage.appendChild(box);
		const bgApi = j0.get('editor:bg');
		if (bgApi) bgApi.applyBgToLayer(box._state.bg, qs('.ed-box-bg', box), true);
		applyIpaxProps(box);
		return box;
	}

	function createBox(opts = {}) {
		const box = buildBoxElement(opts);
		selectBox(box);
		markDirty();
		if (opts.focusText) qs('.ed-box-text', box).focus();
		return box;
	}

	function cloneBox(sourceBox, overrideLeft, overrideTop, shouldSelect = true) {
		if (!sourceBox) return null;
		const clonedState = JSON.parse(JSON.stringify(sourceBox._state));
		if (sourceBox._state.bg && sourceBox._state.bg._blob) {
			clonedState.bg._blob = sourceBox._state.bg._blob;
			clonedState.bg._fileName = sourceBox._state.bg._fileName || '';
		}
		const clone = buildBoxElement({
			left: overrideLeft ?? sourceBox.offsetLeft + 24,
			top: overrideTop ?? sourceBox.offsetTop + 24,
			width: sourceBox.offsetWidth,
			height: sourceBox.offsetHeight,
			clonedState,
			html: qs('.ed-box-text', sourceBox).innerHTML
		});
		setBoxGeom(clone, { zIndex: String(++state.zCounter) });
		if (shouldSelect) selectBox(clone);
		markDirty();
		return clone;
	}

	function deleteActiveBox(box) {
		const target = (box && box.nodeType === 1) ? box : state.activeBox;
		if (!target) return;
		removeBoxDom(target);
		if (state.activeBox === target) selectBox(null);
		markDirty();
		refreshBackdrop();
	}

	j0.bus.on('editor:box:request-select', selectBox);
	j0.register('editor:boxes', Object.freeze({ createBox, cloneBox, selectBox, deleteActiveBox, applyIpaxProps, removeBoxDom, setBoxGeom }));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0095-editor-drag.js === */
// PATH: examples/js/editor/0095-editor-drag.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	const boxesApi = j0 && j0.get('editor:boxes');
	if (!core || !boxesApi) return;

	const { state, qs, markDirty, refreshBackdrop } = core;
	const { selectBox, cloneBox, removeBoxDom, setBoxGeom } = boxesApi;

	const workspace = qs('[data-ed-role="workspace"]');
	if (!workspace) return;

	workspace.addEventListener('pointerdown', (e) => {
		const handle = e.target.closest('.ed-handle');
		const box = e.target.closest('.ed-box');

		if (!box) {
			selectBox(null);
			return;
		}

		selectBox(box);

		if (handle) {
			e.preventDefault();
			const dir = handle.dataset.dir;
			const sx = e.clientX;
			const sy = e.clientY;
			const sl = box.offsetLeft;
			const st = box.offsetTop;
			const sw = box.offsetWidth;
			const sh = box.offsetHeight;

			const onMove = (me) => {
				const dx = me.clientX - sx;
				const dy = me.clientY - sy;
				let nl = sl, nt = st, nw = sw, nh = sh;
				if (dir.includes('e')) nw = Math.max(80, sw + dx);
				if (dir.includes('s')) nh = Math.max(36, sh + dy);
				if (dir.includes('w')) { const cdx = Math.min(sw - 80, dx); nl = sl + cdx; nw = sw - cdx; }
				if (dir.includes('n')) { const cdy = Math.min(sh - 36, dy); nt = st + cdy; nh = sh - cdy; }
				setBoxGeom(box, { left: nl + 'px', top: nt + 'px', width: nw + 'px', height: nh + 'px' });
				j0.bus.emit('editor:box:geom', box);
				refreshBackdrop();
				markDirty();
			};
			const onUp = () => {
				global.removeEventListener('pointermove', onMove);
				global.removeEventListener('pointerup', onUp);
			};
			global.addEventListener('pointermove', onMove);
			global.addEventListener('pointerup', onUp);
			return;
		}

		if (e.target.closest('.ed-box-text')) return;
		e.preventDefault();
		const sx = e.clientX;
		const sy = e.clientY;
		const originL = box.offsetLeft;
		const originT = box.offsetTop;
		let altOriginClone = null;
		let hasMoved = false;

		const syncAltClone = (isAltDown) => {
			if (isAltDown && hasMoved && !altOriginClone) {
				altOriginClone = cloneBox(box, originL, originT, false);
				setBoxGeom(box, { zIndex: String(++state.zCounter) });
				refreshBackdrop();
			} else if (!isAltDown && altOriginClone) {
				removeBoxDom(altOriginClone);
				altOriginClone = null;
				refreshBackdrop();
			}
		};

		const onKey = (ke) => {
			if (ke.key === 'Alt') { ke.preventDefault(); syncAltClone(ke.type === 'keydown'); }
		};
		const onDrag = (me) => {
			const dx = me.clientX - sx;
			const dy = me.clientY - sy;
			if (!hasMoved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) hasMoved = true;
			syncAltClone(me.altKey);
			setBoxGeom(box, { left: (originL + dx) + 'px', top: (originT + dy) + 'px' });
			j0.bus.emit('editor:box:geom', box);
			refreshBackdrop();
			markDirty();
		};
		const onUp = () => {
			global.removeEventListener('pointermove', onDrag);
			global.removeEventListener('pointerup', onUp);
			global.removeEventListener('keydown', onKey);
			global.removeEventListener('keyup', onKey);
			refreshBackdrop();
		};
		global.addEventListener('keydown', onKey);
		global.addEventListener('keyup', onKey);
		global.addEventListener('pointermove', onDrag);
		global.addEventListener('pointerup', onUp);
	});
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0100-editor-fonts.js === */
// PATH: examples/js/editor/0100-editor-fonts.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	if (!core) return;

	const { state, qs, markDirty, clearInlineTextOverrides, refreshBackdrop } = core;

	const PRESETS = Object.freeze([
		{ label: 'System UI Stack', value: 'system-ui, -apple-system, sans-serif', tag: 'Stack' },
		{ label: 'Neo-Grotesque Stack', value: "'Helvetica Neue', Arial, sans-serif", tag: 'Stack' },
		{ label: 'Classic Serif Stack', value: "Georgia, 'Times New Roman', serif", tag: 'Stack' },
		{ label: 'Monospace Stack', value: "ui-monospace, 'SFMono-Regular', monospace", tag: 'Stack' },
		{ label: 'Inter', value: 'Inter', tag: 'Google' },
		{ label: 'Roboto', value: 'Roboto', tag: 'Google' },
		{ label: 'Montserrat', value: 'Montserrat', tag: 'Google' },
		{ label: 'Playfair Display', value: 'Playfair Display', tag: 'Google' },
		{ label: 'Lora', value: 'Lora', tag: 'Google' },
		{ label: 'JetBrains Mono', value: 'JetBrains Mono', tag: 'Google' }
	]);

	const combo = qs('[data-ed-role="font-combo"]');
	const input = qs('[data-ed-control="char-font"]');
	const toggleBtn = qs('[data-ed-action="toggle-font-menu"]');
	const menu = qs('[data-ed-role="font-menu"]');
	const itemTpl = document.querySelector('[data-ed-tpl="font-item"]');

	const metricCtx = document.createElement('canvas').getContext('2d');
	const fontPromises = new Map();

	function isSystemFontInstalled(name) {
		const sample = 'mmmmmmmmmmlli10O@';
		metricCtx.font = '72px monospace';
		const monoW = metricCtx.measureText(sample).width;
		metricCtx.font = '72px serif';
		const serifW = metricCtx.measureText(sample).width;

		metricCtx.font = '72px "' + name + '", monospace';
		const testMono = metricCtx.measureText(sample).width;
		metricCtx.font = '72px "' + name + '", serif';
		const testSerif = metricCtx.measureText(sample).width;

		return testMono !== monoW || testSerif !== serifW;
	}

	function setStatus(box, msg, isError, source) {
		box._state.fontStatus = msg;
		box._state.fontError = Boolean(isError);
		box._state.fontSource = source || (isError ? 'error' : 'system');
		j0.bus.emit('editor:font:status', { box, msg, isError: Boolean(isError), source: box._state.fontSource });
	}

	function applyFamilyToBox(box, familyCss, silent) {
		const glass = qs('.ed-glass', box);
		glass.style.fontFamily = familyCss;
		if (box._state.styles) box._state.styles.fontFamily = familyCss;
		clearInlineTextOverrides(qs('.ed-box-text', box), 'fontFamily');
		refreshBackdrop();
		if (!silent) markDirty();
	}

	function ensureGoogleFont(clean) {
		const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-');
		if (fontPromises.has(slug)) return fontPromises.get(slug);

		const promise = new Promise((resolve, reject) => {
			const selector = 'link[data-ed-gfont="' + slug + '"]';
			let link = document.head.querySelector(selector);
			if (link && link.dataset.loaded === '1') return resolve();
			if (link && link.dataset.failed === '1') return reject(new Error('Failed'));
			if (!link) {
				link = document.createElement('link');
				link.rel = 'stylesheet';
				link.dataset.edGfont = slug;
				link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(clean) + ':ital,wght@0,400;0,700;1,400;1,700&display=swap';
				document.head.appendChild(link);
			}
			link.addEventListener('load', () => { link.dataset.loaded = '1'; resolve(); }, { once: true });
			link.addEventListener('error', () => { link.dataset.failed = '1'; fontPromises.delete(slug); reject(new Error('404')); }, { once: true });
		}).then(async () => {
			await document.fonts.load('16px "' + clean + '"');
			if (!document.fonts.check('16px "' + clean + '"')) {
				fontPromises.delete(slug);
				throw new Error('Not available');
			}
		});

		fontPromises.set(slug, promise);
		return promise;
	}

	async function loadFontForBox(box, raw, opts = {}) {
		if (!box) return;
		const silent = Boolean(opts.silent);
		const clean = (raw || '').trim();
		if (!clean) return;

		box._state.fontInput = clean;
		if (state.activeBox === box) input.value = clean;
		if (!silent) markDirty();

		const generics = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
		if (clean.includes(',') || generics.includes(clean.toLowerCase())) {
			applyFamilyToBox(box, clean, silent);
			setStatus(box, 'System font stack', false, 'system');
			return;
		}

		if (isSystemFontInstalled(clean)) {
			applyFamilyToBox(box, '"' + clean + '", sans-serif', silent);
			setStatus(box, 'Applied system font', false, 'system');
			return;
		}

		setStatus(box, 'Loading from Google Fonts...', false, 'google');
		try {
			await ensureGoogleFont(clean);
			applyFamilyToBox(box, '"' + clean + '", sans-serif', silent);
			setStatus(box, 'Loaded from Google Fonts', false, 'google');
		} catch (err) {
			applyFamilyToBox(box, 'sans-serif', silent);
			setStatus(box, 'Could not load requested system or Google font', true, 'error');
		}
	}

	function resolveAndApplyFont(raw) {
		return loadFontForBox(state.activeBox, raw, { silent: false });
	}

	if (menu && itemTpl) {
		const frag = document.createDocumentFragment();
		PRESETS.forEach((item) => {
			const li = itemTpl.content.firstElementChild.cloneNode(true);
			const lbl = li.querySelector('[data-ed-role="font-label"]');
			const tag = li.querySelector('[data-ed-role="font-tag"]');
			if (lbl) lbl.textContent = item.label;
			if (tag) tag.textContent = item.tag;
			li.addEventListener('mousedown', (e) => {
				e.preventDefault();
				menu.hidden = true;
				resolveAndApplyFont(item.value);
			});
			frag.appendChild(li);
		});
		menu.appendChild(frag);
	}

	toggleBtn.addEventListener('click', () => { menu.hidden = !menu.hidden; });
	input.addEventListener('focus', () => { menu.hidden = false; });
	input.addEventListener('change', () => { menu.hidden = true; resolveAndApplyFont(input.value); });
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') { e.preventDefault(); menu.hidden = true; resolveAndApplyFont(input.value); }
		if (e.key === 'Escape') menu.hidden = true;
	});
	document.addEventListener('pointerdown', (e) => {
		if (!combo.contains(e.target)) menu.hidden = true;
	});

	j0.bus.on('editor:selection:changed', (box) => {
		if (!box) return;
		input.value = box._state.fontInput;
		const isError = Boolean(box._state.fontError);
		const msg = box._state.fontStatus || 'System font stack';
		const source = box._state.fontSource || (isError ? 'error' : (/google/i.test(msg) ? 'google' : 'system'));
		j0.bus.emit('editor:font:status', { box, msg, isError, source });
	});

	j0.register('editor:fonts', Object.freeze({ loadFontForBox }));
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0110-editor-richtext.js === */
// PATH: examples/js/editor/0110-editor-richtext.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	if (!core) return;

	const { state, qs, qsa, rgbToHex, markDirty, clearInlineTextOverrides, refreshBackdrop } = core;

	const sizeInput = qs('[data-ed-control="char-size"]');
	const leadingInput = qs('[data-ed-control="char-leading"]');
	const colorInput = qs('[data-ed-control="char-color"]');
	const formatBtns = qsa('[data-ed-format]');
	const alignHSel = qs('[data-ed-control="char-align-h"]');
	const alignVSel = qs('[data-ed-control="char-align-v"]');

	let savedRange = null;

	function getSelectionRangeIn(textNode) {
		const sel = global.getSelection();
		if (sel && sel.rangeCount > 0) {
			const r = sel.getRangeAt(0);
			if (!r.collapsed && textNode.contains(r.commonAncestorContainer)) {
				savedRange = r.cloneRange();
				return r;
			}
		}
		if (savedRange && !savedRange.collapsed && textNode.contains(savedRange.commonAncestorContainer)) {
			return savedRange;
		}
		return null;
	}

	function toggleInlineCommand(cmd) {
		if (!state.activeBox) return;
		const textNode = qs('.ed-box-text', state.activeBox);
		const existingRange = getSelectionRangeIn(textNode);

		textNode.focus();
		const sel = global.getSelection();
		sel.removeAllRanges();

		if (existingRange) {
			sel.addRange(existingRange);
			document.execCommand(cmd, false, null);
			if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
		} else {
			if (textNode.textContent.trim() === '') return;
			const fullRange = document.createRange();
			fullRange.selectNodeContents(textNode);
			sel.addRange(fullRange);
			document.execCommand(cmd, false, null);
			sel.removeAllRanges();
			savedRange = null;
		}

		syncFormatButtons();
		refreshBackdrop();
		markDirty();
	}

	function syncFormatButtons() {
		if (!state.activeBox) return;
		const textNode = qs('.ed-box-text', state.activeBox);
		const sel = global.getSelection();
		const activeInBox = sel && sel.rangeCount > 0 && textNode.contains(sel.anchorNode);

		const tagForCmd = (cmd) => {
			if (cmd === 'bold') return 'b, strong';
			if (cmd === 'italic') return 'i, em';
			if (cmd === 'underline') return 'u';
			if (cmd === 'strikeThrough') return 's, strike';
			return '';
		};

		formatBtns.forEach((btn) => {
			const cmd = btn.dataset.edFormat;
			const isOn = activeInBox ? document.queryCommandState(cmd) : Boolean(textNode.querySelector(tagForCmd(cmd)));
			btn.classList.toggle('is-active', isOn);
		});
	}

	function syncCharacterPanel(box) {
		savedRange = null;
		if (!box) return;
		const glass = qs('.ed-glass', box);
		const cs = getComputedStyle(glass);
		sizeInput.value = String(Math.round(parseFloat(cs.fontSize)) || 32);
		leadingInput.value = glass.style.lineHeight || '1.25';
		colorInput.value = rgbToHex(cs.color);

		alignHSel.value = glass.style.textAlign || 'left';
		alignVSel.value = glass.style.justifyContent || 'center';
		syncFormatButtons();
	}

	function setBoxStyle(prop, value) {
		if (!state.activeBox) return;
		qs('.ed-glass', state.activeBox).style[prop] = value;
		if (state.activeBox._state.styles) state.activeBox._state.styles[prop] = value;
	}

	sizeInput.addEventListener('input', () => {
		if (!state.activeBox) return;
		const val = Math.max(8, Number(sizeInput.value) || 16);
		setBoxStyle('fontSize', val + 'px');
		clearInlineTextOverrides(qs('.ed-box-text', state.activeBox), 'fontSize');
		refreshBackdrop();
		markDirty();
	});

	leadingInput.addEventListener('input', () => {
		if (!state.activeBox) return;
		const val = Math.max(0.5, Number(leadingInput.value) || 1.2);
		setBoxStyle('lineHeight', String(val));
		clearInlineTextOverrides(qs('.ed-box-text', state.activeBox), 'lineHeight');
		refreshBackdrop();
		markDirty();
	});

	colorInput.addEventListener('input', () => {
		if (!state.activeBox) return;
		setBoxStyle('color', colorInput.value);
		clearInlineTextOverrides(qs('.ed-box-text', state.activeBox), 'color');
		refreshBackdrop();
		markDirty();
	});

	formatBtns.forEach((btn) => {
		btn.addEventListener('mousedown', (e) => e.preventDefault());
		btn.addEventListener('click', () => toggleInlineCommand(btn.dataset.edFormat));
	});

	alignHSel.addEventListener('change', () => {
		setBoxStyle('textAlign', alignHSel.value);
		refreshBackdrop();
		markDirty();
	});

	alignVSel.addEventListener('change', () => {
		setBoxStyle('justifyContent', alignVSel.value);
		refreshBackdrop();
		markDirty();
	});

	document.addEventListener('selectionchange', () => {
		if (!state.activeBox) return;
		const textNode = qs('.ed-box-text', state.activeBox);
		const sel = global.getSelection();
		if (sel && sel.rangeCount > 0 && textNode.contains(sel.anchorNode)) {
			const r = sel.getRangeAt(0);
			savedRange = r.collapsed ? null : r.cloneRange();
			syncFormatButtons();
		}
	});

	j0.bus.on('editor:selection:changed', syncCharacterPanel);
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0120-editor-inspector.js === */
// PATH: examples/js/editor/0120-editor-inspector.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	const boxesApi = j0 && j0.get('editor:boxes');
	if (!core || !boxesApi) return;

	const { state, qs, qsa, markDirty, bindSliderPair, setSliderPair, refreshBackdrop } = core;
	const { createBox, cloneBox, deleteActiveBox, applyIpaxProps, setBoxGeom } = boxesApi;

	const stage = qs('[data-ed-role="stage"]');
	const panelProject = qs('[data-ed-panel="project"]');
	const boxPanels = qs('[data-ed-role="box-panels"]');
	const btnPrimary = qs('[data-ed-action="new-box"]');
	const btnDel = qs('[data-ed-action="delete-box"]');
	const btnEffect = qs('[data-ed-action="toggle-effect"]');
	const fontStatusIcon = qs('[data-ed-role="font-status-icon"]');
	const modeSel = qs('[data-ed-control="ipax-mode"]');
	const chkBoxOn = qs('[data-ed-control="ipax-box-on"]');
	const chkTextOn = qs('[data-ed-control="ipax-text-on"]');
	const subBoxGroup = qs('[data-ed-subgroup="ipax-box"]');
	const subTextGroup = qs('[data-ed-subgroup="ipax-text"]');

	j0.bus.on('editor:font:status', (d) => {
		if (!fontStatusIcon || !d || d.box !== state.activeBox) return;
		fontStatusIcon.textContent = d.isError ? 'error' : (d.source === 'google' ? 'cloud_done' : 'computer');
		fontStatusIcon.classList.toggle('is-error', Boolean(d.isError));
		fontStatusIcon.classList.toggle('is-google', !d.isError && d.source === 'google');
		fontStatusIcon.setAttribute('data-ed-tip', d.msg || 'System font stack');
	});

	function bindDisclosure(btn, targetEl) {
		if (!btn || !targetEl) return;
		btn.addEventListener('click', () => {
			const expanded = btn.getAttribute('aria-expanded') === 'true';
			btn.setAttribute('aria-expanded', String(!expanded));
			targetEl.hidden = expanded;
		});
	}

	qsa('[data-ed-action="toggle-panel"]').forEach((btn) => {
		bindDisclosure(btn, qs('[data-ed-role="panel-body"]', btn.closest('.ed-panel')));
	});
	qsa('[data-ed-action="toggle-subpanel"]').forEach((btn) => {
		bindDisclosure(btn, qs('[data-ed-role="sub-body"]', btn.closest('.ed-sub-group')));
	});
	bindDisclosure(qs('[data-ed-action="toggle-padding"]'), qs('[data-ed-subpanel="padding-trbl"]'));
	bindDisclosure(qs('[data-ed-action="toggle-feather"]'), qs('[data-ed-subpanel="feather-trbl"]'));

	qs('[data-ed-action="save-json"]').addEventListener('click', () => j0.bus.emit('editor:action:save-json', {}));
	qs('[data-ed-action="save-png"]').addEventListener('click', () => j0.bus.emit('editor:action:save-png', {}));
	qs('[data-ed-action="reset-project"]').addEventListener('click', () => j0.bus.emit('editor:action:reset', {}));
	const fileProject = qs('[data-ed-control="project-file"]');
	qs('[data-ed-action="load-json"]').addEventListener('click', () => fileProject.click());
	fileProject.addEventListener('change', (e) => { if (e.target.files[0]) j0.bus.emit('editor:action:load-json', e.target.files[0]); fileProject.value = ''; });

	btnPrimary.addEventListener('click', () => {
		if (state.activeBox) { cloneBox(state.activeBox); return; }
		const offset = (qsa('.ed-box', stage).length % 6) * 26;
		createBox({ left: 64 + offset, top: 64 + offset, width: 340, height: 130, contrast: 4.5, blur: 8, feather: 14, fontSize: 28, text: '', focusText: true });
	});
	btnDel.addEventListener('click', () => deleteActiveBox());
	btnEffect.addEventListener('click', () => {
		state.showEffect = !state.showEffect;
		stage.classList.toggle('is-raw', !state.showEffect);
		btnEffect.classList.toggle('is-active', state.showEffect);
		btnEffect.setAttribute('aria-pressed', String(state.showEffect));
	});

	function syncGeomInputs(box) {
		if (!box) return;
		qs('[data-ed-num="box-x"]').value = String(Math.round(box.offsetLeft));
		qs('[data-ed-num="box-y"]').value = String(Math.round(box.offsetTop));
		qs('[data-ed-num="box-w"]').value = String(Math.round(box.offsetWidth));
		qs('[data-ed-num="box-h"]').value = String(Math.round(box.offsetHeight));
	}

	[['box-x', 'left', -Infinity], ['box-y', 'top', -Infinity], ['box-w', 'width', 80], ['box-h', 'height', 36]].forEach(([key, prop, minVal]) => {
		const el = qs('[data-ed-num="' + key + '"]');
		if (!el) return;
		el.addEventListener('input', () => {
			const raw = parseFloat(el.value);
			if (!state.activeBox || isNaN(raw)) return;
			setBoxGeom(state.activeBox, { [prop]: Math.max(minVal, Math.round(raw)) + 'px' });
			refreshBackdrop();
			markDirty();
		});
	});
	j0.bus.on('editor:box:geom', (box) => { if (box === state.activeBox) syncGeomInputs(box); });

	const applyPadding = () => {
		if (!state.activeBox) return;
		const p = state.activeBox._state.padding;
		const padCss = p.t + 'px ' + p.r + 'px ' + p.b + 'px ' + p.l + 'px';
		qs('.ed-glass', state.activeBox).style.padding = padCss;
		if (state.activeBox._state.styles) state.activeBox._state.styles.padding = padCss;
		refreshBackdrop();
	};
	bindSliderPair('box-padding', (v) => {
		if (!state.activeBox) return;
		const p = state.activeBox._state.padding;
		p.t = p.r = p.b = p.l = v;
		['t', 'r', 'b', 'l'].forEach((side) => { qs('[data-ed-num="box-pad-' + side + '"]').value = String(v); });
		applyPadding();
	});
	['t', 'r', 'b', 'l'].forEach((side) => {
		qs('[data-ed-num="box-pad-' + side + '"]').addEventListener('input', (e) => {
			if (!state.activeBox) return;
			const p = state.activeBox._state.padding;
			p[side] = Math.max(0, Math.min(128, parseFloat(e.target.value) || 0));
			setSliderPair('box-padding', Math.round((p.t + p.r + p.b + p.l) / 4));
			applyPadding();
			markDirty();
		});
	});

	function setSubgroupEnabled(groupEl, enabled) {
		groupEl.classList.toggle('is-disabled', !enabled);
		qsa('input, select', qs('[data-ed-role="sub-body"]', groupEl)).forEach((el) => { el.disabled = !enabled; });
	}
	chkBoxOn.addEventListener('change', () => { if (state.activeBox) { state.activeBox._state.ipax.boxEnabled = chkBoxOn.checked; setSubgroupEnabled(subBoxGroup, chkBoxOn.checked); applyIpaxProps(state.activeBox); markDirty(); } });
	chkTextOn.addEventListener('change', () => { if (state.activeBox) { state.activeBox._state.ipax.textEnabled = chkTextOn.checked; setSubgroupEnabled(subTextGroup, chkTextOn.checked); applyIpaxProps(state.activeBox); markDirty(); } });
	modeSel.addEventListener('change', () => { if (state.activeBox) { state.activeBox._state.ipax.mode = modeSel.value; applyIpaxProps(state.activeBox); markDirty(); } });

	bindSliderPair('ipax-contrast', (v) => { if (state.activeBox) { state.activeBox._state.ipax.contrast = v; applyIpaxProps(state.activeBox); } });
	bindSliderPair('ipax-blur', (v) => { if (state.activeBox) { state.activeBox._state.ipax.blur = v; applyIpaxProps(state.activeBox); } });
	bindSliderPair('ipax-feather', (v) => {
		if (!state.activeBox) return;
		const f = state.activeBox._state.ipax.feather;
		f.t = f.r = f.b = f.l = v;
		['t', 'r', 'b', 'l'].forEach((side) => { qs('[data-ed-num="ipax-feather-' + side + '"]').value = String(v); });
		applyIpaxProps(state.activeBox);
	});
	['t', 'r', 'b', 'l'].forEach((side) => {
		qs('[data-ed-num="ipax-feather-' + side + '"]').addEventListener('input', (e) => {
			if (!state.activeBox) return;
			const f = state.activeBox._state.ipax.feather;
			f[side] = Math.max(0, Math.min(128, parseFloat(e.target.value) || 0));
			setSliderPair('ipax-feather', Math.round((f.t + f.r + f.b + f.l) / 4));
			applyIpaxProps(state.activeBox);
			markDirty();
		});
	});
	['contrast', 'halo', 'spread', 'blur', 'x', 'y'].forEach((prop) => {
		bindSliderPair('ipax-text-' + prop, (v) => {
			if (!state.activeBox) return;
			if (!state.activeBox._state.ipax.text) state.activeBox._state.ipax.text = { contrast: 7, halo: 12, spread: 35, blur: 0, x: 0, y: 0 };
			state.activeBox._state.ipax.text[prop] = v;
			applyIpaxProps(state.activeBox);
		});
	});

	j0.bus.on('editor:selection:changed', (box) => {
		boxPanels.hidden = !box;
		panelProject.hidden = !!box;
		btnDel.disabled = !box;
		btnPrimary.textContent = box ? 'Duplicate' : '+ New box';
		btnPrimary.setAttribute('data-ed-tip', box ? 'Duplicate selected box' : 'Create new text box');
		if (!box) return;
		syncGeomInputs(box);
		const ip = box._state.ipax;
		chkBoxOn.checked = ip.boxEnabled !== false;
		chkTextOn.checked = !!ip.textEnabled;
		setSubgroupEnabled(subBoxGroup, chkBoxOn.checked);
		setSubgroupEnabled(subTextGroup, chkTextOn.checked);
		modeSel.value = ip.mode;
		setSliderPair('ipax-contrast', ip.contrast);
		setSliderPair('ipax-blur', ip.blur);
		setSliderPair('ipax-feather', Math.round((ip.feather.t + ip.feather.r + ip.feather.b + ip.feather.l) / 4));
		['t', 'r', 'b', 'l'].forEach((side) => { qs('[data-ed-num="ipax-feather-' + side + '"]').value = String(ip.feather[side]); });
		const t = ip.text || { contrast: 7, halo: 12, spread: 35, blur: 0, x: 0, y: 0 };
		['contrast', 'halo', 'spread', 'blur', 'x', 'y'].forEach((prop) => setSliderPair('ipax-text-' + prop, t[prop]));
		const pad = box._state.padding;
		setSliderPair('box-padding', Math.round((pad.t + pad.r + pad.b + pad.l) / 4));
		['t', 'r', 'b', 'l'].forEach((side) => { qs('[data-ed-num="box-pad-' + side + '"]').value = String(pad[side]); });
	});
})(typeof globalThis !== 'undefined' ? globalThis : window);
;
/* === SOURCE: 0130-editor-tooltip.js === */
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
;
/* === SOURCE: 0140-editor-scrub.js === */
// PATH: examples/js/editor/0140-editor-scrub.js
(function (global) {
	'use strict';

	const j0 = global.j0;
	const core = j0 && j0.get('editor:core');
	if (!core) return;

	const { qs } = core;

	document.addEventListener('pointerdown', (e) => {
		const scrub = e.target.closest('[data-ed-scrub]');
		if (!scrub || e.button !== 0) return;

		const key = scrub.dataset.edScrub;
		const input = qs('[data-ed-num="' + key + '"]') || qs('[data-ed-control="' + key + '"]');
		if (!input || input.disabled) return;

		e.preventDefault();
		const startX = e.clientX;
		const startVal = parseFloat(input.value) || 0;
		const step = parseFloat(input.step) || 1;
		const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
		const max = input.max !== '' ? parseFloat(input.max) : Infinity;
		const decimals = (String(step).split('.')[1] || '').length;

		const onMove = (me) => {
			const delta = Math.round((me.clientX - startX) / 3) * step;
			const next = Math.min(max, Math.max(min, +(startVal + delta).toFixed(decimals)));
			if (parseFloat(input.value) === next) return;
			input.value = String(next);
			input.dispatchEvent(new Event('input', { bubbles: true }));
			input.dispatchEvent(new Event('change', { bubbles: true }));
		};

		const onUp = () => {
			global.removeEventListener('pointermove', onMove);
			global.removeEventListener('pointerup', onUp);
		};

		global.addEventListener('pointermove', onMove);
		global.addEventListener('pointerup', onUp);
	});
})(typeof globalThis !== 'undefined' ? globalThis : window);
