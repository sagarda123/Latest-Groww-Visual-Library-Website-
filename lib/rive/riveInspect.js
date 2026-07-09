/**
 * Inspect a .riv file by loading it through the Rive runtime and extracting
 * a normalised metadata object the rest of the app can rely on.
 *
 * Shape returned (all fields always present; empty arrays when nothing found):
 *   {
 *     artboards:        [{ name, index, animations: string[], stateMachines: string[] }],
 *     stateMachines:    [{ name, artboard }],
 *     animations:       [{ name }],
 *     viewModels:       [{ name, properties: [{ name, type }], instanceCount, instances: string[] }],
 *     instances:        { vm: [{ name, viewModel }], sm: [], artboard: [] },
 *     inputs:           [{ name, type, stateMachine }],
 *     defaultArtboard:  string | null,
 *     duration:         number | null,
 *   }
 *
 * Best-effort: any individual API may be missing across runtime versions —
 * each section is wrapped in its own try/catch so a single failure never
 * blocks the rest of the extraction. Extraction failure of the whole file
 * resolves with the empty shape and never rejects, so callers can treat
 * extraction as advisory.
 */
const { Rive } = window.rive; // global Rive runtime (loaded via <script>)
import { createBundleAssetLoader } from './riveAssets.js';

const TIMEOUT_MS = 5000;

export function emptyMetadata() {
  return {
    artboards: [],
    stateMachines: [],
    animations: [],
    viewModels: [],
    instances: { vm: [], sm: [], artboard: [] },
    inputs: [],
    defaultArtboard: null,
    duration: null,
  };
}

export async function inspectRive(blob, options = {}) {
  const { bundleAssets } = options;
  const assetLoader = createBundleAssetLoader(bundleAssets);
  const buffer = await blob.arrayBuffer();

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    let resolved = false;
    const done = (result) => {
      if (resolved) return;
      resolved = true;
      try { rive?.cleanup(); } catch (_) {}
      resolve(result);
    };

    const fallback = setTimeout(() => done(emptyMetadata()), TIMEOUT_MS);

    let rive;
    try {
      rive = new Rive({
        buffer,
        canvas,
        autoplay: false,
        assetLoader,
        enableRiveAssetCDN: true,
        onLoad: () => {
          clearTimeout(fallback);
          try {
            done(parseRiveInstance(rive));
          } catch (err) {
            console.warn('Rive metadata parse failed:', err);
            done(emptyMetadata());
          }
        },
        onLoadError: (err) => {
          clearTimeout(fallback);
          console.warn('Rive load failed:', err);
          done(emptyMetadata());
        },
      });
    } catch (err) {
      clearTimeout(fallback);
      console.warn('Rive instance creation failed:', err);
      done(emptyMetadata());
    }
  });
}

function parseRiveInstance(rive) {
  const out = emptyMetadata();

  // Artboards (via the documented `contents` API — exposes name + animations
  // + state machines for *every* artboard, not just the active one).
  try {
    const contents = rive.contents;
    if (contents?.artboards?.length) {
      out.artboards = contents.artboards.map((a, i) => ({
        name: a.name,
        index: i,
        animations: a.animations || [],
        stateMachines: (a.stateMachines || []).map((sm) => sm.name),
      }));
    }
  } catch (err) {
    console.warn('Artboard extraction skipped:', err);
  }

  // Default / active artboard — the one whose state machines & animations
  // are surfaced via the top-level Rive API.
  try {
    out.defaultArtboard = rive.activeArtboard || out.artboards[0]?.name || null;
  } catch (_) {}

  // Flat lists for the active artboard.
  let activeSmNames = [];
  try { activeSmNames = rive.stateMachineNames || []; } catch (_) {}
  out.stateMachines = activeSmNames.map((name) => ({ name, artboard: out.defaultArtboard }));

  try {
    const animNames = rive.animationNames || [];
    out.animations = animNames.map((name) => ({ name }));
  } catch (_) {}

  // State machine inputs — one entry per input per state machine.
  for (const smName of activeSmNames) {
    try {
      const inputs = rive.stateMachineInputs?.(smName) || [];
      for (const input of inputs) {
        out.inputs.push({
          name: input.name,
          type: stringifyInputType(input.type),
          stateMachine: smName,
        });
      }
    } catch (err) {
      console.warn(`Inputs extraction skipped for state machine "${smName}":`, err);
    }
  }

  // View models + properties + instances.
  try {
    out.viewModels = extractViewModels(rive);
    for (const vm of out.viewModels) {
      for (const instanceName of vm.instances || []) {
        out.instances.vm.push({ name: instanceName, viewModel: vm.name });
      }
    }
  } catch (err) {
    console.warn('View models extraction skipped:', err);
  }

  // Best-effort duration from the loaded instance's reported durations.
  // (`contents.artboards[].animations` is a string[] of names, not objects,
  // so it can't supply a duration — read the runtime `durations` instead.)
  try {
    const durations = rive.durations;
    if (Array.isArray(durations)) {
      const valid = durations.filter((d) => typeof d === 'number' && d > 0 && isFinite(d));
      if (valid.length) out.duration = Math.max(...valid);
    }
  } catch (_) {}

  return out;
}

function extractViewModels(rive) {
  const viewModels = [];
  let count = 0;
  try {
    count = typeof rive.viewModelCount === 'function'
      ? rive.viewModelCount()
      : (rive.viewModelCount ?? 0);
  } catch (_) {
    return viewModels;
  }

  for (let i = 0; i < count; i++) {
    let vm;
    try { vm = rive.viewModelByIndex(i); } catch (_) { continue; }
    if (!vm) continue;

    // Properties — older runtimes expose a `properties` getter; newer ones
    // expose `propertyCount` + `propertyByIndex(i)`. Support both.
    const properties = [];
    try {
      if (Array.isArray(vm.properties) && vm.properties.length) {
        for (const p of vm.properties) {
          properties.push({ name: p.name, type: String(p.type || '') });
        }
      } else {
        const propCount = vm.propertyCount ?? 0;
        for (let j = 0; j < propCount; j++) {
          const prop = vm.propertyByIndex?.(j);
          if (prop) properties.push({ name: prop.name, type: String(prop.type || '') });
        }
      }
    } catch (err) {
      console.warn('View model property extraction skipped:', err);
    }

    // Instances. The documented source of per-instance names is the
    // `ViewModel.instanceNames` getter — a `ViewModelInstance` returned by
    // `instanceByIndex` has no `.name` getter (only `viewModelName`), so the
    // previous index loop always produced an empty list.
    const instances = [];
    try {
      const names = Array.isArray(vm.instanceNames) ? vm.instanceNames : [];
      for (const n of names) if (n) instances.push(n);
    } catch (err) {
      console.warn('View model instance extraction skipped:', err);
    }

    viewModels.push({
      name: vm.name || `ViewModel${i}`,
      properties,
      instanceCount: instances.length,
      instances,
    });
  }
  return viewModels;
}

// Rive runtime exposes input types as small enums (Number = 56, Trigger = 58,
// Boolean = 59) or sometimes as strings depending on version. Normalise to
// the lowercase string forms the UI uses.
function stringifyInputType(raw) {
  if (typeof raw === 'string') return raw.toLowerCase();
  if (raw === 56) return 'number';
  if (raw === 58) return 'trigger';
  if (raw === 59) return 'boolean';
  return String(raw ?? 'unknown').toLowerCase();
}

/**
 * Total count of items across every section — useful for UI summaries
 * ("4 sections detected · 17 items").
 */
export function totalMetadataItems(meta) {
  if (!meta) return 0;
  return (
    (meta.artboards?.length || 0) +
    (meta.stateMachines?.length || 0) +
    (meta.animations?.length || 0) +
    (meta.viewModels?.length || 0) +
    (meta.inputs?.length || 0)
  );
}
