import assert from 'node:assert/strict';
import {
  resolveInitialTheme,
  nextTheme,
  themeUiState,
} from '../lib/theme/globalTheme.mjs';

assert.equal(
  resolveInitialTheme({ stored: 'dark', legacy: 'light', prefersDark: false }),
  'dark',
  'stored global theme should win over legacy illustration mode and system preference',
);

assert.equal(
  resolveInitialTheme({ stored: null, legacy: 'dark', prefersDark: false }),
  'dark',
  'legacy illustration mode should migrate when no global theme exists',
);

assert.equal(
  resolveInitialTheme({ stored: 'sepia', legacy: 'midnight', prefersDark: true }),
  'dark',
  'invalid stored values should fall back to system preference',
);

assert.equal(nextTheme('light'), 'dark', 'light should toggle to dark');
assert.equal(nextTheme('dark'), 'light', 'dark should toggle to light');
assert.equal(nextTheme('unknown'), 'dark', 'invalid values should toggle from the light default');

assert.deepEqual(
  themeUiState('dark'),
  {
    value: 'dark',
    isDark: true,
    pressed: 'true',
    label: 'Dark',
    actionLabel: 'Switch to light mode',
  },
  'dark theme UI state should expose accessible toggle metadata',
);

console.log('global theme tests passed');
