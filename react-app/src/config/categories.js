/**
 * Categories Configuration
 *
 * Default categories are used as the seed value the first time the app loads.
 * After that, the user's saved categories (from localStorage) take precedence.
 * Each category: { name, type ('income'|'expense'), pattern (regex string), description }
 */

export const DEFAULT_CATEGORIES = [
  // Ingresos
  { name: 'Airbnb', type: 'income', pattern: 'angon|iol|radar|proveedor|airbnb|aibnb', description: 'Ingresos Airbnb' },
  { name: 'External Rent', type: 'income', pattern: 'guzman|jesus|deposito en efectivo', description: 'Arriendos externos' },
  { name: 'Aporte Michael', type: 'income', pattern: 'de michael', description: 'Recibido de Michael' },
  { name: 'Cristian income', type: 'income', pattern: 'de cristian', description: 'Recibido de Cristian' },
  // Egresos
  { name: 'Administracion', type: 'expense', pattern: 'yuvi|yuviana|moreno|rentals', description: 'Administracion' },
  { name: 'Admin Monthly Account', type: 'expense', pattern: 'protecc', description: 'Cuenta admin mensual' },
  { name: 'Transferencia a Cristian', type: 'expense', pattern: 'a cristian', description: 'Enviado a Cristian' },
  { name: 'Transferencia a Keyla', type: 'expense', pattern: 'a keyla', description: 'Enviado a Keyla' },
  { name: 'Transferencia a Michael', type: 'expense', pattern: 'a michael', description: 'Enviado a Michael' },
  { name: 'Tarjeta de Credito', type: 'expense', pattern: 'tarjeta de credito|tarjeta credito|deuda inter|pago automat', description: 'Pago de tarjeta' },
  { name: 'Key Lock', type: 'expense', pattern: 'smart', description: 'Cerradura inteligente' },
  { name: 'Aseo', type: 'expense', pattern: 'vidal', description: 'Aseo' },
  // Excluidas (no se cuentan: ya estan en Cuentas o son internas)
  { name: 'Servicios (en Cuentas)', type: 'ignore', pattern: 'chilquinta|esval|movistar|aguas', description: 'Luz/Agua/Internet: van del Excel de Cuentas' },
  { name: 'Deposito a Plazo (DAP)', type: 'ignore', pattern: 'inversion dap|pago dap|deposito a plazo', description: 'Ahorro interno, no es gasto ni ingreso' },
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
