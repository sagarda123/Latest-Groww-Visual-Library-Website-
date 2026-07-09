export const MAX_ZIP_FILE_COUNT = 500;
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
export const ZIP_SKIP_PATH = /(^|\/)(__MACOSX|\.git|\.DS_Store|Thumbs\.db)(\/|$)/i;

const normPath = (path) => String(path ?? '').replace(/\\/g, '/').replace(/^\/+/, '');

function declaredUncompressedSize(entry) {
  const raw = entry?._data?.uncompressedSize;
  return Number.isFinite(raw) && raw >= 0 ? raw : null;
}

export function collectSafeZipEntries(files, options = {}) {
  const maxFiles = options.maxFiles ?? MAX_ZIP_FILE_COUNT;
  const maxEntryBytes = options.maxEntryBytes ?? MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES;
  const entries = [];
  let declaredTotal = 0;

  for (const file of files || []) {
    const path = normPath(file?.name);
    if (!path || file?.dir || ZIP_SKIP_PATH.test(path)) continue;

    const size = declaredUncompressedSize(file);
    if (size != null) {
      if (size > maxEntryBytes) throw new Error(`${path} is too large after extraction`);
      declaredTotal += size;
      if (declaredTotal > maxTotalBytes) throw new Error('ZIP expands to too much data');
    }

    entries.push(file);
    if (entries.length > maxFiles) throw new Error('ZIP contains too many files');
  }

  return entries;
}

export function assertInflatedZipEntrySize(path, byteLength, runningTotal, options = {}) {
  const maxEntryBytes = options.maxEntryBytes ?? MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES;

  if (byteLength > maxEntryBytes) throw new Error(`${path} is too large after extraction`);
  const nextTotal = runningTotal + byteLength;
  if (nextTotal > maxTotalBytes) throw new Error('ZIP expands to too much data');
  return nextTotal;
}
