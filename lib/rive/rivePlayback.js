const { Layout } = window.rive; // global Rive runtime (loaded via <script>)
import { createBundleAssetLoader } from './riveAssets.js';

/** Shared layout instance — must not allocate per render (reloads Rive). */
export const RIVE_PREVIEW_LAYOUT = new Layout({
  fit: 'contain',
  alignment: 'center',
});

const smNamesOf = (list) =>
  (list || []).map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean);

/**
 * Choose which artboard a record should actually render.
 *
 * The Rive runtime loads a file's default artboard. Most files have a single,
 * content-bearing artboard, so the default is correct. But some files keep an
 * empty, auto-named placeholder default ("Artboard", "Artboard 1", …) and put
 * the real scene (e.g. the trigger/cursor animation) on a separate, named
 * artboard — loading the default then renders nothing. When the default looks
 * like such a placeholder and a richer artboard exists, prefer the richest one.
 *
 * `artboards`: [{ name, animations: string[], stateMachines: (string|{name})[] }]
 * Returns the chosen artboard record, or null when there is no metadata.
 */
export function resolvePlaybackArtboard(artboards, defaultArtboardName) {
  if (!artboards || !artboards.length) return null;
  const name = (a) => String(a?.name || '');
  let chosen = artboards.find((a) => name(a) === String(defaultArtboardName || '')) || artboards[0];

  const isPlaceholder = /^artboard\s*\d*$/i.test(name(chosen).trim());
  if (artboards.length > 1 && isPlaceholder) {
    const score = (a) => (a.animations?.length || 0) + (a.stateMachines?.length || 0);
    const others = artboards.filter((a) => a !== chosen);
    const best = others.reduce((b, a) => (score(a) > score(b) ? a : b), others[0]);
    if (best && score(best) > score(chosen)) chosen = best;
  }
  return chosen;
}

/**
 * Pick state machine or timeline to play.
 *
 * When a specific artboard has been chosen (see resolvePlaybackArtboard), the
 * SM/timeline is taken from that artboard's own lists so the names match the
 * artboard we actually load. Otherwise it falls back to the record's flat
 * (default-artboard) lists for older records without per-artboard metadata.
 */
export function playbackConfigFromRecord(animation, chosenArtboard = null) {
  if (!animation) return {};
  const cfg = {};
  const ab = chosenArtboard || null;
  if (ab?.name) cfg.artboard = ab.name;

  const smName = ab ? smNamesOf(ab.stateMachines)[0] : smNamesOf(animation.stateMachines)[0];
  if (smName) { cfg.stateMachines = smName; return cfg; }

  const timeline = ab ? (ab.animations || [])[0] : animation.timelines?.[0];
  if (timeline) { cfg.animations = timeline; return cfg; }

  return cfg;
}

/**
 * Stable params object for useRive — pass result of this through useMemo.
 */
export function buildRiveHookParams(buffer, animation, extra = {}, chosenArtboard = null) {
  const assetLoader = createBundleAssetLoader(animation?.bundleAssets);
  if (!buffer) return null;

  return {
    buffer,
    ...playbackConfigFromRecord(animation, chosenArtboard),
    assetLoader,
    // Only auto-bind when the file actually exposes ViewModels — binding an
    // artboard without one makes the runtime log an error per instantiation.
    autoBind: (animation?.viewModels?.length || 0) > 0,
    // Allow CDN fallback when a bundled path does not match.
    enableRiveAssetCDN: true,
    layout: RIVE_PREVIEW_LAYOUT,
    shouldResizeCanvasToContainer: true,
    ...extra,
  };
}

export function getArtboardDimensions(rive) {
  if (!rive) return null;
  try {
    const ab = rive.contents?.artboards?.[0];
    if (ab?.width && ab?.height) {
      return { w: Math.round(ab.width), h: Math.round(ab.height) };
    }
  } catch (_) {}
  return null;
}

/** Best-effort duration from the active Rive instance. */
export function getPlaybackDuration(rive) {
  if (!rive) return 0;
  try {
    const durations = rive.durations;
    if (Array.isArray(durations) && durations.length > 0) {
      const valid = durations.filter((d) => typeof d === 'number' && d > 0 && isFinite(d));
      if (valid.length > 0) return Math.max(...valid);
    }
  } catch (_) {}
  return 0;
}

/**
 * Start the animation if not already playing, then fire trigger inputs.
 *
 * Uses playingStateMachineNames (only currently-running SMs) to detect what's
 * active. Falls back to stateMachineNames[0] only if nothing is playing yet.
 *
 * skipTriggers: pass true for ThemeSwitcher animations — their toggle owns
 * all trigger/boolean inputs and must not be pre-fired here.
 */
export function ensurePlaybackStarted(rive, skipTriggers = false) {
  if (!rive) return;
  try {
    // Prefer SMs that are already loaded/playing; fall back to first available.
    const playingSMs = rive.playingStateMachineNames;
    const allSMs = rive.stateMachineNames;

    let activeSM = null;
    if (playingSMs?.length) {
      activeSM = playingSMs[0];
    } else if (allSMs?.length) {
      activeSM = allSMs[0];
      rive.play(activeSM);
    }

    if (activeSM) {
      if (!skipTriggers) {
        // Fire ViewModel trigger properties for VM-driven animations.
        // Do NOT fire SM trigger inputs — those are for user interaction and
        // firing them on load advances animations past their intended loop state.
        try {
          const vmInst = rive.viewModelInstance;
          if (vmInst) {
            for (const prop of vmInst.properties || []) {
              if (String(prop.type) === 'trigger') {
                try { vmInst.trigger(prop.name)?.trigger(); } catch (_) {}
              }
            }
          }
        } catch (_) {}
      }
      return;
    }

    // No SMs — try timeline animations.
    const playingAnims = rive.playingAnimationNames;
    const allAnims = rive.animationNames;
    if (playingAnims?.length) return; // already playing
    if (allAnims?.length) {
      rive.play(allAnims[0]);
      return;
    }
    // Last resort.
    rive.play();
  } catch (_) {
    try { rive.play(); } catch (_) {}
  }
}

function scrubPlaybackToFirstFrame(rive) {
  if (!rive) return;
  try {
    const anims = rive.animationNames;
    const sms = rive.stateMachineNames;
    const duration = getPlaybackDuration(rive);
    if (anims?.length) {
      rive.scrub(anims[0], 0);
    } else if (duration && sms?.length) {
      rive.scrub(sms[0], 0);
    }
  } catch (_) {}
}

/**
 * Reset on mouse-leave back to a paused first frame.
 *
 * isThemeSwitcher: pass true for ThemeSwitcher tiles — their toggle owns all
 * inputs, so triggers must not be re-fired. For normal animations we re-fire
 * safe ViewModel triggers after the reset so VM-driven layers (text, cursor)
 * stay visible at frame 0 instead of disappearing until the next hover.
 */
export function resetPlaybackToFirstFrame(rive, isThemeSwitcher = false) {
  if (!rive) return;

  try {
    if (typeof rive.reset === 'function') {
      rive.reset({ autoplay: false });
    }
  } catch (_) {}

  // Re-prime VM-driven layers (skipped for ThemeSwitcher animations).
  try { ensurePlaybackStarted(rive, isThemeSwitcher); } catch (_) {}

  scrubPlaybackToFirstFrame(rive);

  try { rive.pause(); } catch (_) {}
  try { rive.resizeDrawingSurfaceToCanvas(); } catch (_) {}
}

/**
 * Prime a tile to a paused, representative first frame before any hover.
 *
 * isThemeSwitcher: pass true for ThemeSwitcher tiles to skip trigger firing
 * (their toggle owns the inputs). For normal animations we fire safe
 * ViewModel triggers so text/cursor layers are visible in the resting preview
 * — matching what hover playback would show — then scrub to frame 0 and pause.
 */
export function primePausedPlaybackPreview(rive, isThemeSwitcher = false) {
  if (!rive) return;
  try { ensurePlaybackStarted(rive, isThemeSwitcher); } catch (_) {}
  scrubPlaybackToFirstFrame(rive);
  try { rive.pause(); } catch (_) {}
  try { rive.resizeDrawingSurfaceToCanvas(); } catch (_) {}
}

export function scrubRive(rive, progress, duration) {
  if (!rive || !duration) return;
  try {
    const sms = rive.stateMachineNames;
    const anims = rive.animationNames;
    const t = progress * duration;
    if (sms?.length) {
      rive.scrub(sms[0], t);
    } else if (anims?.length) {
      rive.scrub(anims[0], t);
    }
  } catch (_) {}
}
