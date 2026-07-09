/**
 * Filter logic + storage for the snake_case file-naming convention.
 *
 * File pattern (per the conventions doc):
 *   mds_rive_[animation_type][_<n>?]_[product?]_[sub_product?].riv
 *
 * Each option exposes both:
 *   - `value`  – snake_case token used for matching against file names
 *   - `label`  – human-readable display used in the UI
 *
 * Renaming model:
 *   - Every pill (built-in or custom) can be given a display label override.
 *   - Display labels are stored in `renames: { [categoryId]: { [value]: label } }`.
 *   - The canonical `value` is what the filter engine matches against file
 *     names, so existing selections never break when a pill is relabelled.
 *
 * Hidden built-ins:
 *   - Built-in tokens deleted by the user are stored in `hiddenBuiltins` and
 *     filtered out at merge time. Keeps storage tidy and reversible.
 */

export const STORAGE_KEY = 'riveRepo.customFilters.v2';

export const MAX_NAME_LENGTH = 30;

// Built-in categories from the (snake_case) naming conventions doc.
export const BUILTIN_CATEGORIES = [
  {
    id: 'animationType',
    label: 'Animation Type',
    options: [
      { value: 'ftux', label: 'FTUX' },
      { value: 'gtm_story', label: 'GTM Story' },
      { value: 'spot_hero', label: 'Spot Hero' },
      { value: 'spot', label: 'Spot' },
      { value: 'loader', label: 'Loader' },
      { value: 'interaction', label: 'Interaction' },
      { value: 'order_status', label: 'Order Status' },
      { value: 'icon', label: 'Icon' },
      { value: 'landing_page_hero', label: 'Landing Page Hero' },
      { value: 'hero', label: 'Hero' },
      { value: 'logo', label: 'Logo' },
    ],
  },
  {
    id: 'product',
    label: 'Product',
    options: [
      { value: 'stocks', label: 'Stocks' },
      { value: 'fno', label: 'FNO' },
      { value: 'charts', label: 'Charts' },
      { value: 'mf', label: 'MF' },
      { value: 'loans', label: 'Loans' },
    ],
  },
  {
    id: 'subProduct',
    label: 'Sub-product / Feature',
    options: [
      { value: 'mtf', label: 'MTF' },
      { value: 'intraday', label: 'Intraday' },
      { value: 'technicals', label: 'Technicals' },
    ],
  },
];

const BUILTIN_IDS = new Set(BUILTIN_CATEGORIES.map((c) => c.id));

/* ─────────────────────────── storage ──────────────────────────────────── */

/**
 * Shape persisted to localStorage:
 *   {
 *     customOptions:   { [categoryId]: string[] }                          // snake_case values
 *     customCategories: [{ id, label, options: string[] }]                 // values, not {value,label}
 *     renames:         { [categoryId]: { [canonical]: displayLabel } }
 *     hiddenBuiltins:  { [categoryId]: string[] }                          // canonical tokens
 *   }
 */
export function loadCustom() {
  if (typeof window === 'undefined') return blankCustom();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankCustom();
    const parsed = JSON.parse(raw);
    return {
      customOptions: parsed.customOptions || {},
      customCategories: Array.isArray(parsed.customCategories)
        ? parsed.customCategories
        : [],
      renames: parsed.renames || {},
      hiddenBuiltins: parsed.hiddenBuiltins || {},
    };
  } catch (_) {
    return blankCustom();
  }
}

export function saveCustom(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

function blankCustom() {
  return { customOptions: {}, customCategories: [], renames: {}, hiddenBuiltins: {} };
}

/* ─────────────────────────── derived categories ───────────────────────── */

/**
 * Merge built-ins with persisted custom options + custom categories into a
 * single ordered list the UI can render directly. Each option is exposed as
 * { value, display } where:
 *   - `value`   is the snake_case canonical token (used for matching)
 *   - `display` is the user-facing label (built-in label, custom slug
 *               humanized, or a user rename — whichever applies)
 */
export function buildCategories(custom) {
  const renamesByCat = custom.renames || {};
  const hiddenByCat = custom.hiddenBuiltins || {};

  const merged = BUILTIN_CATEGORIES.map((c) => {
    const hidden = new Set(hiddenByCat[c.id] || []);
    const visibleBuiltins = c.options
      .filter((o) => !hidden.has(o.value))
      .map((o) => ({
        value: o.value,
        display: renamesByCat[c.id]?.[o.value] || o.label,
      }));
    const customValues = custom.customOptions[c.id] || [];
    const customExpanded = customValues.map((v) => ({
      value: v,
      display: renamesByCat[c.id]?.[v] || humanize(v),
    }));
    return {
      ...c,
      isBuiltin: true,
      options: [...visibleBuiltins, ...customExpanded],
      visibleBuiltinCount: visibleBuiltins.length,
    };
  });

  for (const cat of custom.customCategories || []) {
    merged.push({
      id: cat.id,
      label: cat.label,
      isBuiltin: false,
      options: (cat.options || []).map((v) => ({
        value: v,
        display: renamesByCat[cat.id]?.[v] || humanize(v),
      })),
      visibleBuiltinCount: 0,
    });
  }
  return merged;
}

/* ─────────────────────────── filtering ────────────────────────────────── */

/**
 * Normalize a Rive file name for matching: strip the `.riv` extension and the
 * leading `mds_rive_` prefix, lowercase the rest. Used by `matchFile`.
 */
export function normalizeFileName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\.riv$/i, '')
    .replace(/^mds_rive_/, '');
}

/**
 * Parse a snake_case Rive file name into raw + token form. Kept for callers
 * that want to inspect the segments (the matcher itself just regex-tests the
 * cleaned string for proper word boundaries).
 */
export function parseRiveFileName(fileName) {
  const cleaned = normalizeFileName(fileName);
  return {
    raw: fileName,
    cleaned,
    tokens: cleaned ? cleaned.split('_') : [],
  };
}

/**
 * Strict, segment-aware matching.
 *
 * File names follow `mds_rive_[animation_type][_<n>?]_[product?]_[sub_product?]`.
 * Matching is done on whole `_`-delimited segments rather than raw substrings,
 * so a pill matches only files of exactly that token — e.g. selecting "Spot"
 * (`spot`) no longer also returns "Spot Hero" (`spot_hero`) files, and the
 * "MF" product (`mf`) no longer matches a "MTF" sub-product (`mtf`).
 *
 * The animation type is the leading segment, so it is matched by longest-prefix
 * detection: a `mds_rive_spot_hero_…` file resolves to type `spot_hero`, and the
 * shorter `spot` / suffix `hero` pills therefore do not match it.
 */

// Built-in animation-type token lists, longest first, for leading-type detection.
const ANIMATION_TYPE_TOKEN_LISTS = (
  BUILTIN_CATEGORIES.find((c) => c.id === 'animationType')?.options || []
)
  .map((o) => o.value.split('_'))
  .sort((a, b) => b.length - a.length);

function tokensOf(value) {
  return slugify(value).split('_').filter(Boolean);
}

/** Expand legacy compound tokens so filters match real shipped file names. */
function expandLegacyTokens(tokens) {
  const out = [];
  for (const t of tokens) {
    if (t === 'gtmstory') { out.push('gtm', 'story'); continue; }
    out.push(t);
  }
  return out;
}

function isTokenPrefix(tokens, needle) {
  if (needle.length === 0 || needle.length > tokens.length) return false;
  return needle.every((t, i) => tokens[i] === t);
}

function containsTokenRun(tokens, needle) {
  if (needle.length === 0) return false;
  for (let start = 0; start + needle.length <= tokens.length; start++) {
    if (needle.every((t, j) => tokens[start + j] === t)) return true;
  }
  return false;
}

function detectAnimationType(tokens) {
  for (const typeTokens of ANIMATION_TYPE_TOKEN_LISTS) {
    if (isTokenPrefix(tokens, typeTokens)) return typeTokens.join('_');
  }
  return null;
}

export function fileMatchesFilters(fileName, activeFilters) {
  if (!activeFilters) return true;
  const tokens = expandLegacyTokens(
    slugify(normalizeFileName(fileName)).split('_').filter(Boolean)
  );
  if (tokens.length === 0) return false;

  const leadingType = detectAnimationType(tokens);

  for (const [categoryId, selectedValues] of Object.entries(activeFilters)) {
    if (!selectedValues || selectedValues.length === 0) continue;

    let matchesAny;
    if (categoryId === 'animationType') {
      // Match the file's single resolved leading type. Fall back to a prefix
      // check for custom types not present in the built-in set.
      matchesAny = selectedValues.some(
        (v) =>
          slugify(v) === leadingType ||
          (leadingType === null && isTokenPrefix(tokens, tokensOf(v)))
      );
    } else {
      // Product / sub-product / custom: match a whole contiguous segment run.
      matchesAny = selectedValues.some((v) => containsTokenRun(tokens, tokensOf(v)));
    }

    if (!matchesAny) return false;
  }
  return true;
}

/**
 * Apply active filters to a list of animations. AND across categories,
 * OR within a single category. Categories with no selection are ignored.
 */
export function filterAnimations(animations, activeFilters) {
  if (!activeFilters) return animations;
  const anyActive = Object.values(activeFilters).some(
    (v) => Array.isArray(v) && v.length > 0
  );
  if (!anyActive) return animations;
  return animations.filter((a) => fileMatchesFilters(a.fileName, activeFilters));
}

/* ─────────────────────────── helpers ──────────────────────────────────── */

export function isBuiltinCategoryId(id) {
  return BUILTIN_IDS.has(id);
}

export function sanitizeCustomName(raw) {
  const trimmed = String(raw || '').trim();
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

/**
 * Convert arbitrary user input into a snake_case canonical token.
 *   "Order Confirmation"  →  "order_confirmation"
 *   "p&l chart"           →  "p_l_chart"
 */
export function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Convert a snake_case token back to a Title Case display label. Used as the
 * default display label for user-added custom options.
 *   "gtm_story"  →  "Gtm Story"
 *   "mtf"        →  "Mtf"
 */
export function humanize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function slugifyCategoryId(label) {
  const base = slugify(label);
  return `custom-${base || Math.random().toString(36).slice(2, 8)}-${Date.now().toString(
    36
  )}`;
}

/**
 * Clean up activeFilters when custom options/categories disappear.
 * Returns a new activeFilters object if anything changed; otherwise the same
 * reference (so callers can compare cheaply).
 */
export function pruneActiveFilters(activeFilters, categories) {
  if (!activeFilters) return activeFilters;
  const allowed = new Map(
    categories.map((c) => [c.id, new Set(c.options.map((o) => o.value))])
  );
  let changed = false;
  const next = {};
  for (const [catId, selected] of Object.entries(activeFilters)) {
    if (!allowed.has(catId)) {
      changed = true;
      continue;
    }
    const allowedSet = allowed.get(catId);
    const kept = selected.filter((o) => allowedSet.has(o));
    if (kept.length !== selected.length) changed = true;
    if (kept.length > 0) next[catId] = kept;
  }
  return changed ? next : activeFilters;
}

export function countActiveFilters(activeFilters) {
  if (!activeFilters) return 0;
  return Object.values(activeFilters).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );
}
