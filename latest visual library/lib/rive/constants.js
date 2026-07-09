export const CATEGORIES = [
  'All',
  'Loaders',
  'Empty States',
  'Success/Error',
  'Onboarding',
];

// Categories that can be assigned to an animation (excludes "All")
export const ASSIGNABLE_CATEGORIES = CATEGORIES.filter((c) => c !== 'All');

export const PLATFORMS = ['All', 'Mobile', 'Web'];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // warn at 5MB
