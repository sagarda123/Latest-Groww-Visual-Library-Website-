const TS_RE = /themeswitcher/i;
const THEME_RE = /theme|dark|light|mode|appearance|color/i;
const DARK_RE = /dark|night|moon/i;
const LIGHT_RE = /light|day|sun/i;

function typeString(raw) {
  return String(raw ?? '').toLowerCase();
}

function isBooleanLike(input) {
  return input?.type === 59 || typeString(input?.type) === '59' || typeString(input?.type) === 'boolean' ||
    (input?.type !== 58 && typeof input?.value === 'boolean');
}

function isTriggerLike(input) {
  return input?.type === 58 || typeString(input?.type) === '58' || typeString(input?.type) === 'trigger' ||
    typeof input?.fire === 'function' || typeof input?.trigger === 'function';
}

function themeScore(name) {
  const raw = String(name || '');
  if (!raw) return 0;
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  let score = 0;
  if (DARK_RE.test(raw)) score += 70;
  if (THEME_RE.test(raw)) score += 25;
  if (compact === 'isdark' || compact === 'darkmode' || compact === 'isdarkmode' || compact === 'darktheme') score += 40;
  return score;
}

function lightScore(name) {
  const raw = String(name || '');
  if (!raw) return 0;
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  let score = 0;
  if (LIGHT_RE.test(raw)) score += 70;
  if (THEME_RE.test(raw)) score += 25;
  if (compact === 'lightmode' || compact === 'setlighttheme' || compact === 'lighttheme') score += 40;
  return score;
}

function bestByScore(list, scoreFn) {
  let best = null;
  let bestScore = 0;
  for (const item of list) {
    const score = scoreFn(item?.name);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return { item: best, score: bestScore };
}

function fireInput(input) {
  if (!input) return false;
  if (typeof input.fire === 'function') {
    input.fire();
    return true;
  }
  if (typeof input.trigger === 'function') {
    input.trigger();
    return true;
  }
  return false;
}

function collectNames(animation) {
  const out = [];
  // State machines — stored as strings or {name} objects
  for (const sm of animation?.stateMachines || [])
    out.push(typeof sm === 'string' ? sm : sm?.name);
  for (const sm of animation?.metadata?.stateMachines || [])
    out.push(sm?.name);
  // Artboards
  for (const ab of animation?.artboards || [])
    out.push(ab?.name);
  for (const ab of animation?.metadata?.artboards || [])
    out.push(ab?.name);
  // View models
  for (const vm of animation?.viewModels || [])
    out.push(typeof vm === 'string' ? vm : vm?.name);
  for (const vm of animation?.metadata?.viewModels || [])
    out.push(vm?.name);
  return out.filter(Boolean);
}

export function isThemeSwitcherAnimation(animation) {
  return !!animation && collectNames(animation).some((n) => TS_RE.test(n));
}

/**
 * Returns the name of the state machine that drives theme switching,
 * or null if none found.
 */
export function findThemeSwitcherSM(animation) {
  if (!animation) return null;

  // Prefer an exact "ThemeSwitcher" state machine name.
  for (const sm of animation?.metadata?.stateMachines || []) {
    if (sm?.name && TS_RE.test(sm.name)) return sm.name;
  }
  for (const sm of animation?.stateMachines || []) {
    const name = typeof sm === 'string' ? sm : sm?.name;
    if (name && TS_RE.test(name)) return name;
  }

  // ThemeSwitcher detected via artboard/VM name but no dedicated SM —
  // fall back to the first available state machine.
  if (collectNames(animation).some((n) => TS_RE.test(n))) {
    const first =
      animation?.metadata?.stateMachines?.[0] || animation?.stateMachines?.[0];
    if (first) return typeof first === 'string' ? first : first?.name;
  }

  return null;
}

/**
 * Locate the theme-controlling input on a live Rive instance.
 * Returns { input, kind: 'boolean' | 'trigger' | 'vm-boolean' | 'vm-trigger' } or null.
 *
 * Search order:
 *   1. State machine inputs — queries playing SMs first, using smName as a
 *      priority hint. Falls back to all stateMachineNames so callers with
 *      stale metadata still find the input.
 *   2. ViewModel instance properties (Boolean preferred, then Trigger)
 *      — covers VM-driven ThemeSwitcher files where the SM has no theme input
 *
 * Rive runtime type enum: Number=56, Trigger=58, Boolean=59.
 * ViewModel DataType strings: 'boolean', 'trigger' (String() coerced for WASM).
 */
export function resolveThemeInput(rive, smName) {
  if (!rive) return null;

  // Build ordered list of SM names to query: smName first (metadata hint),
  // then playing SMs, then all SMs — deduplicated.
  const candidates = [];
  if (smName) candidates.push(smName);
  try {
    for (const n of rive.playingStateMachineNames || [])
      if (!candidates.includes(n)) candidates.push(n);
  } catch (_) {}
  try {
    for (const n of rive.stateMachineNames || [])
      if (!candidates.includes(n)) candidates.push(n);
  } catch (_) {}

  // 1. State machine inputs (traditional approach)
  for (const name of candidates) {
    try {
      const inputs = rive.stateMachineInputs?.(name);
      if (!Array.isArray(inputs) || inputs.length === 0) continue;
      const booleans = inputs.filter(isBooleanLike);
      if (booleans.length) {
        const named = bestByScore(booleans, themeScore);
        return { input: named.item || booleans[0], kind: 'boolean' };
      }

      const triggers = inputs.filter(isTriggerLike);
      if (triggers.length) {
        const dark = bestByScore(triggers, themeScore);
        const light = bestByScore(triggers, lightScore);
        if (dark.item && light.item && dark.item !== light.item && dark.score > 0 && light.score > 0) {
          return { input: { dark: dark.item, light: light.item }, kind: 'trigger-pair' };
        }
        return { input: dark.item || triggers[0], kind: 'trigger' };
      }
    } catch (_) {}
  }

  // 2. ViewModel instance properties (VM-driven files use autoBind:true)
  // Use String() coercion because raw WASM DataType may be a numeric enum.
  try {
    const vmInst = rive.viewModelInstance;
    if (vmInst) {
      const props = vmInst.properties || [];
      const boolProps = props.filter(isBooleanLike);
      const boolProp = bestByScore(boolProps, themeScore).item || boolProps[0];
      if (boolProp) {
        const boolVal = vmInst.boolean(boolProp.name);
        if (boolVal != null) return { input: boolVal, kind: 'vm-boolean' };
      }

      const triggerProps = props.filter(isTriggerLike);
      if (triggerProps.length) {
        const dark = bestByScore(triggerProps, themeScore);
        const light = bestByScore(triggerProps, lightScore);
        if (dark.item && light.item && dark.item !== light.item && dark.score > 0 && light.score > 0) {
          const darkTrigger = vmInst.trigger(dark.item.name);
          const lightTrigger = vmInst.trigger(light.item.name);
          if (darkTrigger && lightTrigger) return { input: { dark: darkTrigger, light: lightTrigger }, kind: 'vm-trigger-pair' };
        }

        const triggerProp = dark.item || triggerProps[0];
        const triggerVal = vmInst.trigger(triggerProp.name);
        if (triggerVal != null) return { input: triggerVal, kind: 'vm-trigger' };
      }
    }
  } catch (_) {}

  return null;
}

export function applyThemeInput(resolved, isDark, options = {}) {
  if (!resolved) return false;
  const dark = !!isDark;
  switch (resolved.kind) {
    case 'boolean':
    case 'vm-boolean':
      resolved.input.value = dark;
      return true;
    case 'trigger-pair':
    case 'vm-trigger-pair':
      return fireInput(dark ? resolved.input.dark : resolved.input.light);
    case 'trigger':
    case 'vm-trigger':
      if (!options.commitToggle) return false;
      return fireInput(resolved.input);
    default:
      return false;
  }
}
