// Global Rive runtime (loaded via <script> in index.html).
const decodeImage = (b) => window.rive.decodeImage(b);
const decodeFont = (b) => window.rive.decodeFont(b);
const decodeAudio = (b) => window.rive.decodeAudio(b);

function normalizeKey(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase();
}

function basename(path) {
  const norm = normalizeKey(path);
  const i = norm.lastIndexOf('/');
  return i >= 0 ? norm.slice(i + 1) : norm;
}

/**
 * Build a lookup map for bundled ZIP assets (path + file name keys).
 */
export function buildBundleAssetLookup(bundleAssets) {
  const map = new Map();
  if (!Array.isArray(bundleAssets)) return map;

  for (const entry of bundleAssets) {
    if (!entry) continue;
    const keys = new Set([
      entry.path,
      entry.name,
      basename(entry.path),
      basename(entry.name),
    ]);
    for (const key of keys) {
      const norm = normalizeKey(key);
      if (norm) map.set(norm, entry);
    }
  }
  return map;
}

function resolveBundleEntry(asset, lookup) {
  const candidates = [
    asset.uniqueFilename,
    asset.name,
    asset.fileExtension
      ? `${asset.name}.${asset.fileExtension}`
      : asset.name,
  ].filter(Boolean);

  for (const c of candidates) {
    const hit = lookup.get(normalizeKey(c)) || lookup.get(basename(c));
    if (hit) return hit;
  }

  const unique = normalizeKey(asset.uniqueFilename || asset.name);
  for (const [path, entry] of lookup) {
    if (path === unique || path.endsWith(`/${unique}`)) return entry;
  }
  return null;
}

const loaderCache = new Map();
const LOADER_CACHE_MAX = 50;

/**
 * @deprecated Use buildRiveHookParams + useStableRiveParams instead.
 */
export function riveParamsFromBuffer(buffer, bundleAssets, extra = {}) {
  const assetLoader = createBundleAssetLoader(bundleAssets);
  if (!buffer) return null;
  return {
    buffer,
    assetLoader,
    enableRiveAssetCDN: true,
    ...extra,
  };
}

/**
 * Rive assetLoader that resolves referenced assets from a ZIP bundle.
 * Returns false when no match so Rive CDN can load hosted assets.
 */
export function createBundleAssetLoader(bundleAssets) {
  const lookup = buildBundleAssetLookup(bundleAssets);
  if (lookup.size === 0) return undefined;

  const cacheKey = [...lookup.keys()].sort().join('\0');
  if (loaderCache.has(cacheKey)) return loaderCache.get(cacheKey);

  const loader = (asset, bytes) => {
    const entry = resolveBundleEntry(asset, lookup);
    if (!entry?.fileBlob) return false;

    (async () => {
      try {
        const data = new Uint8Array(await entry.fileBlob.arrayBuffer());
        if (asset.isImage) {
          // decode* wrappers hold a native reference; once the asset has taken
          // its own reference via the setter we must unref() to avoid leaking
          // the decoded image/font/audio on the WASM heap.
          const image = await decodeImage(data);
          asset.setRenderImage(image);
          image.unref?.();
        } else if (asset.isFont) {
          const font = await decodeFont(data);
          asset.setFont(font);
          font.unref?.();
        } else if (asset.isAudio) {
          const audio = await decodeAudio(data);
          asset.setAudioSource(audio);
          audio.unref?.();
        } else if (typeof asset.decode === 'function') {
          asset.decode(data.length ? data : bytes);
        }
      } catch {
        // Fall back to embedded bytes or CDN by returning false on next load;
        // here we only try embedded placeholder bytes.
        try {
          if (typeof asset.decode === 'function' && bytes?.length) asset.decode(bytes);
        } catch (_) {}
      }
    })();

    return true;
  };

  if (loaderCache.size >= LOADER_CACHE_MAX) {
    loaderCache.delete(loaderCache.keys().next().value);
  }
  loaderCache.set(cacheKey, loader);
  return loader;
}
