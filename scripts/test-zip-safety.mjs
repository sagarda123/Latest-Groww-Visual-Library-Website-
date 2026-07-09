import assert from 'node:assert/strict';

const {
  collectSafeZipEntries,
  MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES,
  MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
} = await import('../lib/rive/zipSafety.js');

const entry = (name, uncompressedSize, dir = false) => ({
  name,
  dir,
  _data: { uncompressedSize },
});

{
  const entries = collectSafeZipEntries([
    entry('bundle/main.riv', 1024),
    entry('__MACOSX/._main.riv', 1024),
    entry('bundle/asset.png', 2048),
    entry('bundle/empty/', 0, true),
  ]);

  assert.deepEqual(entries.map((item) => item.name), ['bundle/main.riv', 'bundle/asset.png']);
}

assert.throws(
  () => collectSafeZipEntries([entry('huge.riv', MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES + 1)]),
  /too large/i,
);

assert.throws(
  () => collectSafeZipEntries(
    Array.from({ length: 5 }, (_, i) => entry(`chunk-${i}.riv`, Math.floor(MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES / 5) + 1)),
  ),
  /too much data/i,
);

assert.throws(
  () => collectSafeZipEntries(Array.from({ length: 501 }, (_, i) => entry(`file-${i}.riv`, 1))),
  /too many files/i,
);

console.log('zip safety tests passed');
