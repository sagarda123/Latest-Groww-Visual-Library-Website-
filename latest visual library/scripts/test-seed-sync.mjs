import assert from 'node:assert/strict';
import { planSampleSeedChanges } from '../lib/rive/seed.js';

const manifestItems = [
  {
    name: 'GTM Story 1',
    src: 'animations/mds_rive_gtmstory_1_stocks_technicals.riv',
    tags: ['gtm', 'stocks'],
  },
  {
    name: 'Checkbox Interaction',
    src: 'animations/mds_rive_interaction_checkbox.riv',
    tags: ['interaction', 'checkbox'],
  },
  {
    name: 'Trigger Order GTM',
    src: 'animations/mds_rive_interaction_trigger_order.riv',
    tags: ['interaction', 'trigger'],
  },
];

const existing = [
  {
    id: 'sample-mds_rive_gtmstory_1_stocks_technicals',
    fileName: 'mds_rive_gtmstory_1_stocks_technicals',
    uploadedBy: 'Sample Library',
    sampleOrder: 8,
    uploadedAt: '2024-01-01T00:00:00.000Z',
    tags: ['old'],
    description: 'Old description',
  },
  {
    id: 'sample-checkbox_legacy',
    fileName: 'Checkbox Legacy',
    uploadedBy: 'Sample Library',
  },
  {
    id: 'user-custom-animation',
    fileName: 'custom_upload',
    uploadedBy: 'Designer',
  },
];

const plan = planSampleSeedChanges(existing, manifestItems, [
  'sample-mds_rive_interaction_trigger_order',
]);

assert.deepEqual(plan.legacyIds, ['sample-checkbox_legacy']);
assert.deepEqual(
  plan.missingItems.map((entry) => entry.id),
  [
    'sample-mds_rive_interaction_checkbox',
  ],
);
assert.deepEqual(
  plan.missingItems.map((entry) => entry.index),
  [1],
);
assert.equal(plan.normalizedRecords.length, 1);
assert.equal(plan.normalizedRecords[0].sampleOrder, 0);
assert.deepEqual(plan.normalizedRecords[0].tags, ['gtm', 'stocks']);
assert.equal(plan.normalizedRecords[0].description, 'GTM Story 1');

console.log('seed sync tests passed');
