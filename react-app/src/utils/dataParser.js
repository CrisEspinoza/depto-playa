import { findCategory, loadCategories } from '../config/categories';
import * as XLSX from 'xlsx';

/**
 * Parse CSV text into an array of transaction objects.
 * Accepts an optional categories array; if omitted, loads from localStorage.
 */
export const parseCSV = (csvText, categories) => {
  const lines = csvText.trim().split('\n');
  // headers line intentionally parsed but not used further (just consumed)
  lines[0].split(','); // consume header line
  const cats = categories || loadCategories();
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (values.length >= 6) {
      const transaction = {
        date: values[0],
        operationNumber: values[1],
        description: values[2],
        charges: parseFloat(values[3]) || 0,
        credits: parseFloat(values[4]) || 0,
        balance: parseFloat(values[5]) || 0
      };

      const category = findCategory(transaction.description, cats);
      transaction.category = category ? category.name : 'Uncategorized';
      transaction.categoryType = category ? category.type : null;

      transactions.push(transaction);
    }
  }

  return transactions;
};

/**
 * Parse a single CSV line handling quoted values
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

/**
 * Extract month and year from date string (YYYY-MM-DD format)
 */
export const getMonthYear = (dateString) => {
  if (!dateString) return null;
  const [year, month] = dateString.split('-');
  return `${year}-${month}`;
};

/**
 * Get unique months from transactions
 */
export const getUniqueMonths = (transactions) => {
  const months = new Set();
  
  transactions.forEach(transaction => {
    const monthYear = getMonthYear(transaction.date);
    if (monthYear) {
      months.add(monthYear);
    }
  });
  
  return Array.from(months).sort().reverse(); // Most recent first
};

/**
 * Format month string for display (YYYY-MM -> Month Year)
 */
export const formatMonth = (monthYear) => {
  if (!monthYear) return '';
  
  const [year, month] = monthYear.split('-');
  const date = new Date(year, parseInt(month) - 1);
  
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long' 
  });
};

/**
 * Filter transactions by month
 */
export const filterByMonth = (transactions, monthYear) => {
  if (!monthYear) return transactions;
  
  return transactions.filter(transaction => {
    return getMonthYear(transaction.date) === monthYear;
  });
};

/**
 * Group transactions by category
 */
export const groupByCategory = (transactions) => {
  const grouped = {};
  
  transactions.forEach(transaction => {
    const category = transaction.category;
    
    if (!grouped[category]) {
      grouped[category] = {
        name: category,
        type: transaction.categoryType,
        transactions: [],
        totalCharges: 0,
        totalCredits: 0
      };
    }
    
    grouped[category].transactions.push(transaction);
    grouped[category].totalCharges += transaction.charges;
    grouped[category].totalCredits += transaction.credits;
  });
  
  return Object.values(grouped);
};

/**
 * Get transactions that were not matched by any category
 */
export const getUncategorizedTransactions = (transactions) => {
  return transactions.filter(t => !t.categoryType);
};

/**
 * Calculate summary statistics.
 * @param {Array} transactions - parsed transaction objects
 * @param {Object} cuentasForMonth - optional map of fixed-expense name → amount for the selected month
 */
export const calculateSummary = (transactions, cuentasForMonth = {}) => {
  const summary = {
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    incomeCategories: [],
    expenseCategories: [],
    uncategorized: getUncategorizedTransactions(transactions)
  };
  
  const grouped = groupByCategory(transactions);
  
  grouped.forEach(category => {
    if (category.type === 'income') {
      summary.totalIncome += category.totalCredits;
      summary.incomeCategories.push(category);
    } else if (category.type === 'expense') {
      summary.totalExpenses += category.totalCharges;
      summary.expenseCategories.push(category);
    }
  });

  // Otros: los movimientos sin categoria se cuentan como "Otros Ingresos"/"Otros Gastos"
  let otrosIngresos = 0, otrosGastos = 0;
  summary.uncategorized.forEach(t => { otrosIngresos += t.credits || 0; otrosGastos += t.charges || 0; });
  if (otrosIngresos > 0) {
    summary.totalIncome += otrosIngresos;
    summary.incomeCategories.push({ name: 'Otros Ingresos', type: 'income', transactions: summary.uncategorized.filter(t => (t.credits || 0) > 0), totalCredits: otrosIngresos, totalCharges: 0 });
  }
  if (otrosGastos > 0) {
    summary.totalExpenses += otrosGastos;
    summary.expenseCategories.push({ name: 'Otros Gastos', type: 'expense', transactions: summary.uncategorized.filter(t => (t.charges || 0) > 0), totalCharges: otrosGastos, totalCredits: 0 });
  }

  // Add fixed expenses (Cuentas) as synthetic expense categories
  Object.entries(cuentasForMonth).forEach(([name, amount]) => {
    if (amount > 0) {
      summary.totalExpenses += amount;
      summary.expenseCategories.push({
        name,
        type: 'expense',
        transactions: [],
        totalCharges: amount,
        totalCredits: 0,
        isFixed: true,
      });
    }
  });
  
  summary.netIncome = summary.totalIncome - summary.totalExpenses;
  
  // Sort categories by total amount (descending)
  summary.incomeCategories.sort((a, b) => b.totalCredits - a.totalCredits);
  summary.expenseCategories.sort((a, b) => b.totalCharges - a.totalCharges);
  
  return summary;
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(amount);
};

/**
 * Format date for display
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Export an array of transaction objects to a CSV string and trigger a download
 */
export const exportTransactionsToCSV = (transactions, filename) => {
  if (!transactions || transactions.length === 0) return;

  const headers = ['date', 'operationNumber', 'description', 'charges', 'credits', 'balance', 'category'];
  const rows = transactions.map(t =>
    headers.map(h => {
      const val = t[h] ?? '';
      const str = String(val);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  triggerDownload(csvContent, filename);
};

/**
 * Helper: trigger a file download in the browser
 */
const triggerDownload = (content, filename) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// Month names in Spanish (index 0 = January)
const MONTH_NAMES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

/**
 * Build and download the structured annual summary CSV.
 *
 * Format (matching summary_structure.csv):
 *   Row 1: header  — blank, blank, Enero, Febrero … Diciembre
 *   Income rows    — "Ingresos", <category name>, [monthly totals × 12]
 *   Expense rows   — "Egresos",  <category name>, [monthly totals × 12]
 *   Special rows   — Luz, Agua, Dividendo, Gastos Comunes, Internet from cuentas
 *   Total row      — "Egresos",  "Total", [sums × 12]
 *
 * @param {Array}  transactions  - all transactions (all months)
 * @param {Array}  categories    - category config list
 * @param {Object} cuentasData   - { "Luz": {"2025-01": 123, ...}, "Agua": {...}, ... }
 * @param {string} year          - e.g. "2025"
 * @param {string} filename      - output filename
 */
export const exportStructuredSummary = (transactions, categories, cuentasData, year, filename) => {
  const incomeCategories  = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Build per-month totals for each transaction category
  // monthKey = "YYYY-MM"
  const incomeTotals  = {};   // categoryName → { "YYYY-MM": amount }
  const expenseTotals = {};

  incomeCategories.forEach(c  => { incomeTotals[c.name]  = {}; });
  expenseCategories.forEach(c => { expenseTotals[c.name] = {}; });

  transactions.forEach(t => {
    const mk = getMonthYear(t.date);
    if (!mk) return;
    if (t.categoryType === 'income' && incomeTotals[t.category] !== undefined) {
      incomeTotals[t.category][mk] = (incomeTotals[t.category][mk] || 0) + t.credits;
    } else if (t.categoryType === 'expense' && expenseTotals[t.category] !== undefined) {
      expenseTotals[t.category][mk] = (expenseTotals[t.category][mk] || 0) + t.charges;
    }
  });

  // Cuentas sheet names: derive dynamically from cuentasData so all pages are included
  const cuentasRows = cuentasData ? Object.keys(cuentasData) : [];

  // Months: if year provided restrict to that year; otherwise use all months found
  let months;
  if (year) {
    months = Array.from({length: 12}, (_, i) => `${year}-${String(i+1).padStart(2,'0')}`);
  } else {
    const allMonthsSet = new Set();
    transactions.forEach(t => { const mk = getMonthYear(t.date); if (mk) allMonthsSet.add(mk); });
    cuentasRows.forEach(name => {
      if (cuentasData && cuentasData[name]) Object.keys(cuentasData[name]).forEach(k => allMonthsSet.add(k));
    });
    months = Array.from(allMonthsSet).sort();
  }

  const csvRows = [];
  const q = (v) => String(v ?? '').includes(',') ? `"${v}"` : String(v ?? '');

  // Header row
  const headerMonths = months.map(mk => {
    const [, m] = mk.split('-');
    return MONTH_NAMES_ES[parseInt(m, 10) - 1] || mk;
  });
  csvRows.push(['', '', ...headerMonths].map(q).join(','));

  // Income rows
  incomeCategories.forEach((cat, idx) => {
    const sectionLabel = idx === 0 ? 'Ingresos' : '';
    const vals = months.map(mk => Math.round(incomeTotals[cat.name][mk] || 0));
    csvRows.push([sectionLabel, cat.name, ...vals].map(q).join(','));
  });

  // Blank row for "Otros Ingresos"
  csvRows.push(['', 'Otros Ingresos', ...months.map(() => '')].map(q).join(','));

  // Expense rows from transaction categories
  let expFirstRow = true;
  expenseCategories.forEach(cat => {
    const sectionLabel = expFirstRow ? 'Egresos' : '';
    expFirstRow = false;
    const vals = months.map(mk => Math.round(expenseTotals[cat.name][mk] || 0));
    csvRows.push([sectionLabel, cat.name, ...vals].map(q).join(','));
  });

  // Cuentas expense rows
  cuentasRows.forEach(name => {
    const monthlyData = (cuentasData && cuentasData[name]) || {};
    const sectionLabel = expFirstRow ? 'Egresos' : '';
    expFirstRow = false;
    const vals = months.map(mk => Math.round(monthlyData[mk] || 0));
    csvRows.push([sectionLabel, name, ...vals].map(q).join(','));
  });

  // Total row
  const totalExpenseByMonth = months.map(mk => {
    let tot = 0;
    expenseCategories.forEach(cat => { tot += (expenseTotals[cat.name][mk] || 0); });
    cuentasRows.forEach(name => {
      const md = (cuentasData && cuentasData[name]) || {};
      tot += (md[mk] || 0);
    });
    return Math.round(tot);
  });
  const grandTotal = totalExpenseByMonth.reduce((s, v) => s + v, 0);
  csvRows.push(['Egresos', 'Total', ...totalExpenseByMonth, grandTotal].map(q).join(','));

  triggerDownload(csvRows.join('\n'), filename);
};

/**
 * Build and download a historical summary as a multi-sheet .xlsx file.
 * Each year's data goes on its own sheet (tab).
 *
 * @param {Array}  transactions  - all transactions (all months / years)
 * @param {Array}  categories    - category config list
 * @param {Object} cuentasData   - { "Luz": {"2025-01": 123, ...}, ... }
 * @param {string} filename      - output filename (e.g. "summary_historical.xlsx")
 */
export const exportHistoricalSummaryXLSX = (transactions, categories, cuentasData, filename) => {
  const incomeCategories  = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');
  // Derive cuentas sheet names dynamically so all pages are included
  const cuentasRows = cuentasData ? Object.keys(cuentasData) : [];

  // Build per-month totals for transaction categories
  const incomeTotals  = {};
  const expenseTotals = {};
  incomeCategories.forEach(c  => { incomeTotals[c.name]  = {}; });
  expenseCategories.forEach(c => { expenseTotals[c.name] = {}; });

  transactions.forEach(t => {
    const mk = getMonthYear(t.date);
    if (!mk) return;
    if (t.categoryType === 'income' && incomeTotals[t.category] !== undefined) {
      incomeTotals[t.category][mk] = (incomeTotals[t.category][mk] || 0) + t.credits;
    } else if (t.categoryType === 'expense' && expenseTotals[t.category] !== undefined) {
      expenseTotals[t.category][mk] = (expenseTotals[t.category][mk] || 0) + t.charges;
    }
  });

  // Collect all years from transactions and cuentas
  const yearsSet = new Set();
  transactions.forEach(t => {
    const mk = getMonthYear(t.date);
    if (mk) yearsSet.add(mk.split('-')[0]);
  });
  if (cuentasData) {
    Object.values(cuentasData).forEach(monthly => {
      Object.keys(monthly).forEach(mk => yearsSet.add(mk.split('-')[0]));
    });
  }
  const years = Array.from(yearsSet).sort();

  const wb = XLSX.utils.book_new();

  years.forEach(year => {
    const months = Array.from({length: 12}, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const rows = [];

    // Header row
    rows.push(['', '', ...MONTH_NAMES_ES, 'Total']);

    // Income rows
    incomeCategories.forEach((cat, idx) => {
      const vals = months.map(mk => Math.round(incomeTotals[cat.name][mk] || 0));
      const total = vals.reduce((s, v) => s + v, 0);
      rows.push([idx === 0 ? 'Ingresos' : '', cat.name, ...vals, total]);
    });
    rows.push(['', 'Otros Ingresos', ...months.map(() => 0), 0]);

    // Expense rows from transaction categories
    expenseCategories.forEach((cat, idx) => {
      const vals = months.map(mk => Math.round(expenseTotals[cat.name][mk] || 0));
      const total = vals.reduce((s, v) => s + v, 0);
      rows.push([idx === 0 ? 'Egresos' : '', cat.name, ...vals, total]);
    });

    // Cuentas (fixed) expense rows
    cuentasRows.forEach(name => {
      const monthlyData = (cuentasData && cuentasData[name]) || {};
      const vals = months.map(mk => Math.round(monthlyData[mk] || 0));
      const total = vals.reduce((s, v) => s + v, 0);
      rows.push(['', name, ...vals, total]);
    });

    // Total expenses row
    const totalByMonth = months.map(mk => {
      let tot = 0;
      expenseCategories.forEach(cat => { tot += (expenseTotals[cat.name][mk] || 0); });
      cuentasRows.forEach(name => {
        const md = (cuentasData && cuentasData[name]) || {};
        tot += (md[mk] || 0);
      });
      return Math.round(tot);
    });
    const grandTotal = totalByMonth.reduce((s, v) => s + v, 0);
    rows.push(['Egresos', 'Total', ...totalByMonth, grandTotal]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, year);
  });

  XLSX.writeFile(wb, filename);
};
