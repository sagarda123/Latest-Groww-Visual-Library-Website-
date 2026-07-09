import assert from 'node:assert/strict';

const { metadataSummary, animationTileBadges } = await import('../lib/rive/animationInsights.js');

assert.equal(metadataSummary(null), 'Metadata pending');
assert.equal(metadataSummary({ artboards: [{}], stateMachines: [{}, {}], animations: [{}], viewModels: [], inputs: [{}, {}] }), '6 metadata items');
assert.equal(metadataSummary({ artboards: [], stateMachines: [], animations: [], viewModels: [], inputs: [] }), 'No metadata');

{
  const badges = animationTileBadges({
    origin: 'repo-manifest',
    uploadedBy: 'Sample Library',
    metadata: { artboards: [{}], stateMachines: [], animations: [{}], viewModels: [], inputs: [] },
    bundleAssets: [{}, {}],
  }, { isThemeSwitcher: true });

  assert.deepEqual(badges.map((badge) => badge.label), [
    'Sample',
    '2 metadata',
    '2 assets',
    'Theme',
  ]);
}

{
  const badges = animationTileBadges({
    origin: 'user-upload',
    inspectedAt: '2026-06-20T00:00:00.000Z',
    metadata: { artboards: [], stateMachines: [], animations: [], viewModels: [], inputs: [] },
    bundleAssets: [],
  });

  assert.deepEqual(badges.map((badge) => badge.label), ['Uploaded', 'No metadata']);
  assert.equal(badges[1].tone, 'muted');
}

console.log('animation insight tests passed');
