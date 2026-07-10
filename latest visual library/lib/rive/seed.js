import {
  addAnimation,
  deleteAnimation,
  formatBytes,
  getAllAnimations,
  getDeletedAnimationIds,
} from './db.js';

const SAMPLE_UPLOADER = 'Sample Library';
const SAMPLE_SEED_EPOCH = Date.UTC(2026, 5, 19, 0, 0, 0);

// Seed the library from the local manifest (animations.json + animations/*.riv)
// instead of cdn.rive.app. fileName is the snake_case token name (basename) so
// the naming-convention filters work; tags come from the manifest.
const MANIFEST_URL = 'animations.json';

function baseFileName(src) {
  return String(src).split('/').pop().replace(/\.riv$/i, '');
}

function categoryFor(fileName) {
  if (/loader/i.test(fileName)) return 'Loaders';
  if (/interaction|trigger|checkbox/i.test(fileName)) return 'Success/Error';
  if (/spot|empty/i.test(fileName)) return 'Empty States';
  return 'Onboarding';
}

function sampleUploadedAt(index) {
  return new Date(SAMPLE_SEED_EPOCH - index * 1000).toISOString();
}

// Any sample fileName that satisfies the new snake_case convention. Used to
// detect whether a previously-seeded library was created before the rewrite.
const isLegacySampleName = (name) =>
  typeof name === 'string' && !name.startsWith('mds_rive_');

// Guard against concurrent invocation (double-init).
let seedInflight = null;
export function seedSamplesIfEmpty() {
  if (!seedInflight) {
    seedInflight = doSeedSamplesIfEmpty().finally(() => {
      seedInflight = null;
    });
  }
  return seedInflight;
}

async function doSeedSamplesIfEmpty() {
  const existing = await getAllAnimations();
  const deletedIds = await getDeletedAnimationIds();

  // One-time migration: drop legacy-named sample records.
  const initialPlan = planSampleSeedChanges(existing, []);
  if (initialPlan.legacyIds.length > 0) {
    await Promise.all(initialPlan.legacyIds.map((id) => deleteAnimation(id, { recordEvent: false })));
  }

  const afterMigration = await getAllAnimations();

  let items = [];
  try {
    const resp = await fetch(MANIFEST_URL);
    if (!resp.ok) throw new Error(`manifest ${resp.status}`);
    const data = await resp.json();
    items = Array.isArray(data.items) ? data.items : [];
  } catch (e) {
    console.warn('Could not load animations manifest:', e);
    return;
  }

  const plan = planSampleSeedChanges(afterMigration, items, deletedIds);
  await Promise.all(plan.normalizedRecords.map((record) => addAnimation(record)));

  await Promise.all(
    plan.missingItems.map(async ({ item, index, fileName, id }) => {
      try {
        const resp = await fetch(item.src);
        if (!resp.ok) throw new Error(`fetch ${item.src} → ${resp.status}`);
        const blob = await resp.blob();
        const record = {
          id,
          fileName,
          fileSize: blob.size,
          fileSizeReadable: formatBytes(blob.size),
          category: categoryFor(fileName),
          platform: 'Mobile',
          sampleOrder: index,
          tags: Array.isArray(item.tags) ? item.tags : [],
          description: item.name || '',
          uploadedAt: sampleUploadedAt(index),
          uploadedBy: SAMPLE_UPLOADER,
          origin: 'repo-manifest',
          storageBackend: 'indexeddb-cache',
          manifestSrc: item.src,
          duration: null,
          stateMachines: [],
          viewModels: [],
          fileBlob: blob,
          mimeType: blob.type || 'application/octet-stream',
          artboards: [],
          timelines: [],
        };
        await addAnimation(record, {
          eventType: 'seeded',
          reason: 'manifest-seed',
          source: 'repo-manifest',
        });
      } catch (e) {
        console.warn('Sample seed failed for', item.src, e);
      }
    })
  );
}

export function planSampleSeedChanges(existing, items, deletedAnimationIds = []) {
  const deletedIds = new Set(deletedAnimationIds);
  const sampleById = new Map(
    existing
      .filter((record) => record.uploadedBy === SAMPLE_UPLOADER)
      .map((record) => [record.id, record])
  );
  const existingIds = new Set(existing.map((record) => record.id));
  const legacyIds = existing
    .filter((record) => record.uploadedBy === SAMPLE_UPLOADER && isLegacySampleName(record.fileName))
    .map((record) => record.id);
  const normalizedRecords = [];
  const missingItems = [];

  items.forEach((item, index) => {
    const fileName = baseFileName(item.src);
    const id = `sample-${fileName}`;
    if (deletedIds.has(id)) return;
    const record = sampleById.get(id);
    if (!record) {
      if (!existingIds.has(id)) missingItems.push({ item, index, fileName, id });
      return;
    }

    const next = {
      ...record,
      sampleOrder: index,
      uploadedAt: sampleUploadedAt(index),
      category: record.category || categoryFor(fileName),
      platform: record.platform || 'Mobile',
      origin: record.origin || 'repo-manifest',
      storageBackend: record.storageBackend || 'indexeddb-cache',
      manifestSrc: record.manifestSrc || item.src,
      tags: Array.isArray(item.tags) ? item.tags : (record.tags || []),
      description: item.name || record.description || '',
    };

    if (
      record.sampleOrder !== next.sampleOrder ||
      record.uploadedAt !== next.uploadedAt ||
      record.origin !== next.origin ||
      record.storageBackend !== next.storageBackend ||
      record.manifestSrc !== next.manifestSrc ||
      record.description !== next.description ||
      JSON.stringify(record.tags || []) !== JSON.stringify(next.tags || [])
    ) {
      normalizedRecords.push(next);
    }
  });

  return { legacyIds, normalizedRecords, missingItems };
}
