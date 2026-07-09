import { openDB } from './idb-shim.js';

const DB_NAME = 'rive-repo';
const DB_VERSION = 3;
const STORE = 'animations';
const EVENT_STORE = 'animationEvents';
// v3: user-uploaded icons/illustrations (static manifests stay read-only).
const ICON_STORE = 'icons';
const ILLU_STORE = 'illustrations';

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('uploadedAt', 'uploadedAt');
          store.createIndex('category', 'category');
        }
        if (!db.objectStoreNames.contains(EVENT_STORE)) {
          const events = db.createObjectStore(EVENT_STORE, { keyPath: 'id' });
          events.createIndex('animationId', 'animationId');
          events.createIndex('type', 'type');
          events.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(ICON_STORE)) {
          db.createObjectStore(ICON_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(ILLU_STORE)) {
          db.createObjectStore(ILLU_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/* ── uploaded icons / illustrations (v3 stores) ─────────────── */
const VISUAL_STORES = { icon: ICON_STORE, illustration: ILLU_STORE };

export async function getAllVisualAssets(kind) {
  const db = await getDB();
  return db.getAll(VISUAL_STORES[kind]);
}
export async function addVisualAsset(kind, record) {
  const db = await getDB();
  await db.put(VISUAL_STORES[kind], record);
  return record;
}
export async function deleteVisualAsset(kind, id) {
  const db = await getDB();
  await db.delete(VISUAL_STORES[kind], id);
}

function normalizeBundleAsset(asset) {
  if (!asset) return asset;
  let { fileBlob } = asset;
  if (fileBlob && !(fileBlob instanceof Blob)) {
    fileBlob = new Blob([fileBlob], {
      type: asset.mimeType || 'application/octet-stream',
    });
  }
  return { ...asset, fileBlob };
}

export function normalizeAnimationRecord(record) {
  if (!record) return record;
  const fileBlob =
    record.fileBlob && !(record.fileBlob instanceof Blob)
      ? new Blob([record.fileBlob], {
          type: record.mimeType || 'application/octet-stream',
        })
      : record.fileBlob;
  const bundleAssets = Array.isArray(record.bundleAssets)
    ? record.bundleAssets.map(normalizeBundleAsset)
    : [];
  return { ...record, fileBlob, bundleAssets };
}

export async function getAllAnimations() {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.map(normalizeAnimationRecord);
}

export async function getAnimation(id) {
  const db = await getDB();
  const row = await db.get(STORE, id);
  return normalizeAnimationRecord(row);
}

export function sanitizeAnimationForEvent(record) {
  if (!record) return null;
  const snapshot = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'fileBlob') continue;
    if (key === 'bundleAssets' && Array.isArray(value)) {
      snapshot.bundleAssets = value.map((asset) => {
        const copy = {};
        for (const [assetKey, assetValue] of Object.entries(asset || {})) {
          if (assetKey === 'fileBlob' || assetKey === 'bytes') continue;
          copy[assetKey] = assetValue;
        }
        return copy;
      });
      continue;
    }
    snapshot[key] = value;
  }
  return snapshot;
}

export function buildAnimationEvent(type, record, details = {}) {
  const createdAt = details.createdAt || new Date().toISOString();
  const animationId = record?.id || details.animationId;
  return {
    id: details.id || `event-${generateId()}`,
    type,
    animationId,
    fileName: record?.fileName || details.fileName || null,
    createdAt,
    source: details.source || 'local-indexeddb',
    reason: details.reason || null,
    actor: details.actor || null,
    snapshot: sanitizeAnimationForEvent(record),
  };
}

export function deletedIdSetFromEvents(events = []) {
  const deleted = new Set();
  const ordered = [...events].sort((a, b) => {
    const left = Date.parse(a?.createdAt || '') || 0;
    const right = Date.parse(b?.createdAt || '') || 0;
    return left - right;
  });
  for (const event of ordered) {
    if (!event?.animationId) continue;
    if (event.type === 'deleted') deleted.add(event.animationId);
    if (event.type === 'uploaded' || event.type === 'seeded' || event.type === 'restored') {
      deleted.delete(event.animationId);
    }
  }
  return deleted;
}

async function addAnimationEvent(type, record, details) {
  const db = await getDB();
  const event = buildAnimationEvent(type, record, details);
  await db.put(EVENT_STORE, event);
  return event;
}

export async function getAnimationEvents() {
  const db = await getDB();
  const all = await db.getAll(EVENT_STORE);
  return all.sort((a, b) => {
    const left = Date.parse(a?.createdAt || '') || 0;
    const right = Date.parse(b?.createdAt || '') || 0;
    return right - left;
  });
}

export async function getDeletedAnimationIds() {
  return deletedIdSetFromEvents(await getAnimationEvents());
}

export async function addAnimation(record, options = {}) {
  const db = await getDB();
  await db.put(STORE, record);
  if (options.eventType) {
    await addAnimationEvent(options.eventType, record, options.eventDetails || options);
  }
  return record;
}

export async function deleteAnimation(id, options = {}) {
  const db = await getDB();
  const existing = await db.get(STORE, id);
  await db.delete(STORE, id);
  if (options.recordEvent !== false && existing) {
    await addAnimationEvent('deleted', normalizeAnimationRecord(existing), {
      reason: options.reason || 'delete',
      actor: options.actor || null,
      source: options.source || 'local-indexeddb',
    });
  }
}

export async function clearAll(options = {}) {
  const db = await getDB();
  await db.clear(STORE);
  if (options.includeLedger) await db.clear(EVENT_STORE);
}

export function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
