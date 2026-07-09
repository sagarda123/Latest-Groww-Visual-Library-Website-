import assert from 'node:assert/strict';
import {
  buildAnimationEvent,
  deletedIdSetFromEvents,
  sanitizeAnimationForEvent,
} from '../lib/rive/db.js';

const fileBlob = new Blob(['riv-bytes'], { type: 'application/octet-stream' });
const assetBlob = new Blob(['png-bytes'], { type: 'image/png' });

const record = {
  id: 'sample-mds_rive_demo',
  fileName: 'mds_rive_demo',
  fileBlob,
  fileSize: 128,
  uploadedAt: '2026-06-20T10:00:00.000Z',
  uploadedBy: 'Designer',
  origin: 'repo-manifest',
  bundleAssets: [
    {
      name: 'cursor.png',
      kind: 'image',
      fileBlob: assetBlob,
      size: assetBlob.size,
    },
  ],
};

const snapshot = sanitizeAnimationForEvent(record);
assert.equal(snapshot.fileName, 'mds_rive_demo');
assert.equal(snapshot.fileBlob, undefined);
assert.equal(snapshot.bundleAssets[0].fileBlob, undefined);
assert.equal(snapshot.bundleAssets[0].name, 'cursor.png');

const uploaded = buildAnimationEvent('uploaded', record, {
  id: 'evt-uploaded',
  createdAt: '2026-06-20T10:01:00.000Z',
  source: 'test',
});
assert.equal(uploaded.animationId, record.id);
assert.equal(uploaded.type, 'uploaded');
assert.equal(uploaded.snapshot.fileName, record.fileName);

const deleted = buildAnimationEvent('deleted', record, {
  id: 'evt-deleted',
  createdAt: '2026-06-20T10:02:00.000Z',
  reason: 'user-delete',
});

assert.deepEqual(
  [...deletedIdSetFromEvents([uploaded, deleted])],
  ['sample-mds_rive_demo'],
);

assert.deepEqual(
  [...deletedIdSetFromEvents([deleted, { ...uploaded, createdAt: '2026-06-20T10:03:00.000Z' }])],
  [],
);

console.log('animation ledger tests passed');
