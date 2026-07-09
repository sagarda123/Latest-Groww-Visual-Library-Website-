// Minimal raw-IndexedDB shim exposing the subset of the `idb` API that db.js uses:
//   openDB(name, version, { upgrade(db) })  ->  { getAll, get, put, delete, clear }
// Each op resolves on request success (readwrite txns auto-commit on success).

export function openDB(name, version, { upgrade } = {}) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => {
      try {
        if (upgrade) upgrade(req.result, e.oldVersion, e.newVersion, req.transaction);
      } catch (err) {
        reject(err);
        // Abort the version-change transaction so a half-applied upgrade never
        // commits (onsuccess would otherwise still fire with a broken schema).
        try { req.transaction?.abort(); } catch (_) {}
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(wrap(db));
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function wrap(db) {
  const run = (store, mode, make) =>
    new Promise((resolve, reject) => {
      const r = make(db.transaction(store, mode).objectStore(store));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  return {
    getAll: (store) => run(store, 'readonly', (s) => s.getAll()),
    get: (store, id) => run(store, 'readonly', (s) => s.get(id)),
    put: (store, rec) => run(store, 'readwrite', (s) => s.put(rec)),
    delete: (store, id) => run(store, 'readwrite', (s) => s.delete(id)),
    clear: (store) => run(store, 'readwrite', (s) => s.clear()),
  };
}
