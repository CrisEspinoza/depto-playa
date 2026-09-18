/**
 * Categories Configuration
 *
 * Default categories are used as the seed value the first time the app loads.
 * After that, the user's saved categories (from localStorage) take precedence.
 * Each category: { name, type ('income'|'expense'), pattern (regex string), description }
 */

export const DEFAULT_CATEGORIES = [
  // Income
  { name: 'Airbnb',                  type: 'income',  pattern: 'angon|iol|radar|proveedor|airbnb|aibnb',   description: 'Income from Airbnb rentals' },
  { name: 'External Rent',           type: 'income',  pattern: 'guzman|jesus|deposito en efectivo',          description: 'Income from external rentals' },
  // Expenses
  { name: 'Cleaning Services (Old)', type: 'expense', pattern: 'vidal',                                      description: 'Old cleaning service expenses' },
  { name: 'Admin Services',          type: 'expense', pattern: 'yuvi|yuviana|moreno|rentals',                description: 'Administrative service expenses' },
  { name: 'Admin Monthly Account',   type: 'expense', pattern: 'protecc',                                    description: 'Monthly account protection expenses' },
  { name: 'Transfers to Cristian',   type: 'expense', pattern: 'cristian',                                   description: 'Transfers to Cristian' },
  { name: 'Transfers to Keyla',      type: 'expense', pattern: 'keyla',                                      description: 'Transfers to Keyla' },
  { name: 'Key Lock',                type: 'expense', pattern: 'smart',                                      description: 'Smart lock expenses' },
];

const STORAGE_KEY = 'beach-accounting-categories';

const getPatternSpecificity = (pattern) => {
  if (!pattern) return 0;
  return String(pattern)
    .split('|')
    .map(part => part.trim().length)
    .reduce((max, length) => Math.max(max, length), 0);
};

/** Load categories from localStorage, falling back to defaults. */
export const loadCategories = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_CATEGORIES;
};

/** Save categories to localStorage. */
export const saveCategories = (categories) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch { /* ignore */ }
};

/** Find category for a description using a provided category list. */
export const findCategory = (description, categories) => {
  if (!description) return null;
  const list = [...(categories || loadCategories())].sort(
    (left, right) => getPatternSpecificity(right.pattern) - getPatternSpecificity(left.pattern)
  );
  for (const cat of list) {
    try {
      if (new RegExp(cat.pattern, 'i').test(description)) return cat;
    } catch { /* bad regex – skip */ }
  }
  return null;
};

export const getIncomeCategories  = (cats) => (cats || loadCategories()).filter(c => c.type === 'income');
export const getExpenseCategories = (cats) => (cats || loadCategories()).filter(c => c.type === 'expense');

// Keep backward-compatible named export
export const CATEGORIES = DEFAULT_CATEGORIES;
