const METADATA_KEYS = ['artboards', 'stateMachines', 'animations', 'viewModels', 'inputs'];

export function metadataItemCount(meta) {
  if (!meta) return null;
  return METADATA_KEYS.reduce((sum, key) => sum + (Array.isArray(meta[key]) ? meta[key].length : 0), 0);
}

export function metadataSummary(meta) {
  const count = metadataItemCount(meta);
  if (count == null) return 'Metadata pending';
  if (count === 0) return 'No metadata';
  return `${count} metadata ${count === 1 ? 'item' : 'items'}`;
}

export function animationTileBadges(animation, options = {}) {
  const badges = [];
  const isSample = animation?.origin === 'repo-manifest' || animation?.uploadedBy === 'Sample Library';
  badges.push({
    label: isSample ? 'Sample' : 'Uploaded',
    tone: isSample ? 'neutral' : 'accent',
    title: isSample ? 'Repository sample' : 'Uploaded asset',
  });

  const metadataCount = metadataItemCount(animation?.metadata);
  if (metadataCount == null && !animation?.inspectedAt) {
    badges.push({ label: 'Needs inspect', tone: 'muted', title: 'Metadata will appear after inspection' });
  } else if (metadataCount > 0) {
    badges.push({
      label: `${metadataCount} metadata`,
      tone: 'neutral',
      title: metadataSummary(animation.metadata),
    });
  } else {
    badges.push({ label: 'No metadata', tone: 'muted', title: 'No artboards, timelines, state machines, inputs, or view models detected' });
  }

  const assetCount = Array.isArray(animation?.bundleAssets) ? animation.bundleAssets.length : 0;
  if (assetCount > 0) {
    badges.push({
      label: `${assetCount} ${assetCount === 1 ? 'asset' : 'assets'}`,
      tone: 'neutral',
      title: 'Bundled supporting assets',
    });
  }

  if (options.isThemeSwitcher) {
    badges.push({ label: 'Theme', tone: 'accent', title: 'Supports light and dark theme switching' });
  }

  return badges;
}
