export const GLOBAL_THEME_KEY = 'rive-theme';
export const LEGACY_ILLU_THEME_KEY = 'gh.illuMode';

export function normalizeTheme(value) {
  return value === 'dark' || value === 'light' ? value : null;
}

export function resolveInitialTheme({ stored, legacy, prefersDark = false } = {}) {
  return normalizeTheme(stored)
    || normalizeTheme(legacy)
    || (prefersDark ? 'dark' : 'light');
}

export function nextTheme(theme) {
  return normalizeTheme(theme) === 'dark' ? 'light' : 'dark';
}

export function themeUiState(theme) {
  const value = normalizeTheme(theme) || 'light';
  const isDark = value === 'dark';
  return {
    value,
    isDark,
    pressed: String(isDark),
    label: isDark ? 'Dark' : 'Light',
    actionLabel: `Switch to ${isDark ? 'light' : 'dark'} mode`,
  };
}
