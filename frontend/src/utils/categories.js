export const SKILL_CATEGORIES = [
  { value: 'cloud_devops',   label: 'Cloud & DevOps' },
  { value: 'programming',    label: 'Programming' },
  { value: 'language',       label: 'Language' },
  { value: 'data_ai',        label: 'Data & AI' },
  { value: 'certification',  label: 'Certification' },
  { value: 'design',         label: 'Design' },
  { value: 'business',       label: 'Business' },
  { value: 'soft_skills',    label: 'Soft Skills' },
  { value: 'creative',       label: 'Creative' },
  { value: 'health_fitness', label: 'Health & Fitness' },
  { value: 'other',          label: 'Other' },
];

/**
 * Returns the human-readable label for a category value or legacy label string.
 * Handles existing DB entries stored as labels ("certification") or old values ("coding").
 */
export const getCategoryLabel = (value) => {
  if (!value) return 'Other';
  const cat = SKILL_CATEGORIES.find(
    c => c.value === value || c.label.toLowerCase() === value.toLowerCase()
  );
  if (cat) return cat.label;
  // Fallback: capitalise first letter for unknown legacy values
  return value.charAt(0).toUpperCase() + value.slice(1);
};

/**
 * Maps a stored category (could be old value, label, or new value) to a valid
 * SKILL_CATEGORIES value so the edit form select renders correctly.
 */
export const normalizeCategory = (value) => {
  if (!value) return 'other';
  // Exact value match
  if (SKILL_CATEGORIES.find(c => c.value === value)) return value;
  // Label match (case-insensitive)
  const byLabel = SKILL_CATEGORIES.find(
    c => c.label.toLowerCase() === value.toLowerCase()
  );
  if (byLabel) return byLabel.value;
  // Legacy value mappings
  const legacyMap = { coding: 'programming', instrument: 'creative' };
  if (legacyMap[value.toLowerCase()]) return legacyMap[value.toLowerCase()];
  return 'other';
};
