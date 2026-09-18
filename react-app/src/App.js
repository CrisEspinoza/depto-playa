import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MonthSelector from './components/MonthSelector';
import CategorySummary from './components/CategorySummary';
import FileList from './components/FileList';
import UncategorizedTransactions from './components/UncategorizedTransactions';
import CategoriesConfig from './components/CategoriesConfig';
import FixedCuentaDetails from './components/FixedCuentaDetails';
import {
  parseCSV,
  getUniqueMonths,
  filterByMonth,
  calculateSummary,
  formatCurrency,
  formatMonth,
  exportTransactionsToCSV,
  exportStructuredSummary,
  exportHistoricalSummaryXLSX,
} from './utils/dataParser';
import { loadCategories, saveCategories } from './config/categories';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5050';

const NOW = new Date();
const CURRENT_MONTH_UNDERSCORE = `${NOW.getFullYear()}_${String(NOW.getMonth() + 1).padStart(2, '0')}`;
const CURRENT_MONTH_DASH       = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`;

function App() {
  // ── Categories (persisted) ───────────────────────────────────────────────
  const [categories, setCategories] = useState(() => loadCategories());

  const handleCategoriesChange = (newCats) => {
    setCategories(newCats);
    // Re-parse current transactions with new categories
    if (rawCSVText) {
      applyTransactions(parseCSV(rawCSVText, newCats));
    }
  };

  // ── Data state ───────────────────────────────────────────────────────────
  const [transactions,   setTransactions]   = useState([]);
  const [rawCSVText,     setRawCSVText]     = useState('');
  const [selectedMonth,  setSelectedMonth]  = useState('');
  const [months,         setMonths]         = useState([]);
  const [summary,        setSummary]        = useState(null);

  // ── Cuentas state ────────────────────────────────────────────────────────
  const [cuentasData,    setCuentasData]    = useState(null);   // { Luz: { "2025-01": 123 }, ... }
  const [cuentasDetails, setCuentasDetails] = useState(null);   // { Luz: [{date, month, amount}], ... }
  const [cuentasSource,  setCuentasSource]  = useState(null);
  const [selectedCuenta, setSelectedCuenta] = useState('');

  // ── File state ───────────────────────────────────────────────────────────
  const [outputFiles,    setOutputFiles]    = useState([]);
  const [historialFiles, setHistorialFiles] = useState([]);
  const [selectedFile,   setSelectedFile]   = useState('');
  const [filesLoading,   setFilesLoading]   = useState(true);
  const [showFiles,      setShowFiles]      = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState('summary');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [scriptRunning, setScriptRunning] = useState(false);
  const [scriptMsg,     setScriptMsg]     = useState(null);

  const syncCategoriesToAPI = useCallback(async (newCategories) => {
    const res = await fetch(`${API}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: newCategories }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Server error: ${res.status}`);
    }
  }, []);

  // ── Fetch file lists ─────────────────────────────────────────────────────
  const fetchFileLists = useCallback(async () => {
    setFilesLoading(true);
    try {
      const [outRes, histRes] = await Promise.all([
        fetch(`${API}/api/files`),
        fetch(`${API}/api/historial`),
      ]);
      if (outRes.ok)  setOutputFiles((await outRes.json()).files || []);
      if (histRes.ok) setHistorialFiles((await histRes.json()).files || []);
    } catch { /* API not available */ }
    setFilesLoading(false);
  }, []);

  // ── Fetch cuentas data on startup ────────────────────────────────────────
  const fetchCuentas = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cuentas`);
      if (res.ok) {
        const data = await res.json();
        setCuentasData(data.cuentas || null);
        setCuentasDetails(data.cuentasDetails || null);
        setCuentasSource(data.source || null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchFileLists();
    fetchCuentas();
  }, [fetchFileLists, fetchCuentas]);

  useEffect(() => {
    syncCategoriesToAPI(loadCategories()).catch(() => {});
  }, [syncCategoriesToAPI]);

  // ── Load transactions from API ───────────────────────────────────────────
  const loadFromAPI = useCallback(async (filename) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/transactions?file=${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const { transactions: rows } = await res.json();
      const parsed = rows.map(r => ({
        date:            r.Fecha || r.date || '',
        operationNumber: r.Operacion || r.operationNumber || '',
        description:     r.Movimientos || r.description || '',
        charges:         Number(r.Cargos  ?? r.charges ?? 0),
        credits:         Number(r.Abonos  ?? r.credits ?? 0),
        balance:         Number(r.Saldo   ?? r.balance  ?? 0),
        category:        r.category || 'Uncategorized',
        categoryType:    r.category && r.category !== 'Uncategorized' ? guessType(r.category, categories) : null,
      }));
      applyTransactions(parsed);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFallback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/summary_12_2025.csv');
      if (!res.ok) throw new Error('Failed to load bundled CSV');
      const text = await res.text();
      setRawCSVText(text);
      applyTransactions(parseCSV(text, categories));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!filesLoading) {
      if (outputFiles.length > 0) {
        const first = outputFiles[outputFiles.length - 1].name;
        setSelectedFile(first);
        loadFromAPI(first);
      } else {
        loadFallback();
      }
    }
  }, [filesLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTransactions = (parsed) => {
    setTransactions(parsed);
    const parsedMonths = getUniqueMonths(parsed);
    const monthsWithCurrent = parsedMonths.includes(CURRENT_MONTH_DASH)
      ? parsedMonths
      : [CURRENT_MONTH_DASH, ...parsedMonths].sort().reverse();

    setMonths(monthsWithCurrent);
    if (monthsWithCurrent.length > 0) {
      // Prefer the current month when available so the UI reflects the active period.
      setSelectedMonth(
        monthsWithCurrent.includes(CURRENT_MONTH_DASH)
          ? CURRENT_MONTH_DASH
          : monthsWithCurrent[0]
      );
    }
  };

  const guessType = (catName, cats) => {
    const found = cats.find(c => c.name === catName);
    return found ? found.type : 'expense';
  };

  // ── Recompute summary ─────────────────────────────────────────────────────
  useEffect(() => {
    if (transactions.length > 0) {
      const filtered = filterByMonth(transactions, selectedMonth);
      const cuentasForMonth = {};
      if (cuentasData) {
        Object.entries(cuentasData).forEach(([name, monthly]) => {
          if (selectedMonth) {
            // Single month: use that month's value
            const val = monthly[selectedMonth];
            if (val) cuentasForMonth[name] = val;
          } else {
            // All months: sum every month
            const total = Object.values(monthly).reduce((s, v) => s + (v || 0), 0);
            if (total) cuentasForMonth[name] = total;
          }
        });
      }
      setSummary(calculateSummary(filtered, cuentasForMonth));
    } else {
      setSummary(null);
    }
  }, [transactions, selectedMonth, cuentasData]);

  // ── File selection ────────────────────────────────────────────────────────
  const handleSelectFile = (filename) => {
    setSelectedFile(filename);
    loadFromAPI(filename);
  };

  // ── Manual CSV upload ─────────────────────────────────────────────────────
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        setRawCSVText(text);
        applyTransactions(parseCSV(text, categories));
        setSelectedFile(file.name);
        setError(null);
      } catch (err) {
        setError('Failed to parse CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // ── Cuentas xlsx upload ───────────────────────────────────────────────────
  const handleCuentasUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API}/api/upload-cuentas`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCuentasData(data.cuentas || null);
      setCuentasDetails(data.cuentasDetails || null);
      setCuentasSource(data.source || file.name);
      setScriptMsg({ ok: true, text: `✅ Cuentas loaded from ${data.source || file.name}` });
    } catch (err) {
      setScriptMsg({ ok: false, text: `❌ Cuentas upload failed: ${err.message}` });
    }
    // reset input so the same file can be re-uploaded
    event.target.value = '';
  };

  // ── Run summary script ────────────────────────────────────────────────────
  const handleRunScript = async () => {
    setScriptRunning(true);
    setScriptMsg(null);
    try {
      const res = await fetch(`${API}/api/run-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: CURRENT_MONTH_UNDERSCORE, categories }),
      });
      const data = await res.json();
      setScriptMsg({
        ok: data.success,
        text: data.success
          ? `✅ Generated ${data.outputFile}`
          : `❌ Error: ${data.message}`,
      });
      if (data.success) {
        await fetchFileLists();
        handleSelectFile(data.outputFile);
      }
    } catch {
      setScriptMsg({ ok: false, text: '❌ Could not reach API server. Is server.py running?' });
    }
    setScriptRunning(false);
  };

  // ── Export: structured annual summary ────────────────────────────────────
  const handleExportStructured = () => {
    if (!selectedMonth) {
      // All Months: export one sheet per year as .xlsx
      exportHistoricalSummaryXLSX(
        transactions,
        categories,
        cuentasData || {},
        'summary_historical.xlsx'
      );
    } else {
      // Single month selected: export that year's CSV as before
      const year = selectedMonth.split('-')[0];
      exportStructuredSummary(
        transactions,
        categories,
        cuentasData || {},
        year,
        `summary_${year}.csv`
      );
    }
  };

  // ── Export: raw monthly transactions ─────────────────────────────────────
  const handleExportMonthly = () => {
    if (!summary) return;
    const allFiltered = filterByMonth(transactions, selectedMonth);
    const label = selectedMonth ? formatMonth(selectedMonth).replace(/\s/g, '_') : 'all';
    exportTransactionsToCSV(allFiltered, `transactions_${label}.csv`);
  };

  // ── Save categories & re-apply ────────────────────────────────────────────
  const handleCategoriesSave = useCallback(async (newCats) => {
    saveCategories(newCats);
    await syncCategoriesToAPI(newCats);
  }, [syncCategoriesToAPI]);

  // ── Fixed cuentas detail helpers ────────────────────────────────────────
  const cuentasNames = useMemo(
    () => (cuentasDetails ? Object.keys(cuentasDetails).sort() : []),
    [cuentasDetails]
  );

  useEffect(() => {
    if (cuentasNames.length === 0) {
      setSelectedCuenta('');
      return;
    }
    if (!selectedCuenta || !cuentasNames.includes(selectedCuenta)) {
      setSelectedCuenta(cuentasNames[0]);
    }
  }, [cuentasNames, selectedCuenta]);

  const selectedCuentaDetails = (cuentasDetails && selectedCuenta)
    ? (cuentasDetails[selectedCuenta] || [])
    : [];

  const filteredCuentaDetails = selectedMonth
    ? selectedCuentaDetails.filter((row) => row.month === selectedMonth)
    : selectedCuentaDetails;

  // ── Render ────────────────────────────────────────────────────────────────
  const uncategorizedForMonth = summary?.uncategorized || [];

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-top">
          <div>
            <h1>Beach Accounting</h1>
            <p className="subtitle">Expense and Income Tracker</p>
          </div>
          <div className="header-actions">
            <button
              className={`action-btn run-btn ${scriptRunning ? 'running' : ''}`}
              onClick={handleRunScript}
              disabled={scriptRunning}
              title={`python3 summary_app.py ./movement_historial -o ./output/summary_${CURRENT_MONTH_UNDERSCORE}.csv`}
            >
              {scriptRunning ? '⏳ Running…' : `▶ Generate ${CURRENT_MONTH_DASH}`}
            </button>

            <button
              className="action-btn export-btn"
              onClick={handleExportStructured}
              title="Export structured annual summary CSV"
            >
              ⬇ Export Summary
            </button>

            <button
              className="action-btn export-btn"
              onClick={handleExportMonthly}
              disabled={!summary}
              style={{ background: '#764ba2' }}
              title="Export raw transactions for selected month"
            >
              ⬇ Export Transactions
            </button>

            <button
              className={`action-btn files-btn ${showFiles ? 'active' : ''}`}
              onClick={() => setShowFiles(v => !v)}
            >
              📂 Files {showFiles ? '▲' : '▼'}
            </button>

            {/* Transactions CSV upload */}
            <label htmlFor="csv-upload" className="action-btn upload-btn" title="Upload transactions CSV">
              📁 Upload CSV
            </label>
            <input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />

            {/* Cuentas xlsx upload */}
            <label
              htmlFor="cuentas-upload"
              className="action-btn upload-btn"
              style={{ background: '#fef9c3', color: '#854d0e', borderColor: '#fde047' }}
              title="Upload Cuentas xlsx (Luz, Agua, Dividendo, Gastos Comunes, Internet)"
            >
              📊 Upload Cuentas
            </label>
            <input id="cuentas-upload" type="file" accept=".xlsx,.xls" onChange={handleCuentasUpload} style={{ display: 'none' }} />
          </div>
        </div>

        {cuentasSource && (
          <div className="cuentas-badge">
            📊 Cuentas loaded: <strong>{cuentasSource}</strong>
            {cuentasData && (
              <span className="cuentas-sheets">
                {Object.keys(cuentasData).map(s => (
                  <span key={s} className="cuentas-sheet-tag">{s}</span>
                ))}
              </span>
            )}
          </div>
        )}

        {scriptMsg && (
          <div className={`script-msg ${scriptMsg.ok ? 'ok' : 'fail'}`}>
            {scriptMsg.text}
            <button className="script-msg-close" onClick={() => setScriptMsg(null)}>✕</button>
          </div>
        )}
      </header>

      {/* ── File Panel ── */}
      {showFiles && (
        <FileList
          outputFiles={outputFiles}
          historialFiles={historialFiles}
          selectedFile={selectedFile}
          onSelectFile={handleSelectFile}
          loading={filesLoading}
        />
      )}

      {/* ── Main ── */}
      <main className="app-main">
        {loading ? (
          <div className="loading">Loading data…</div>
        ) : error ? (
          <div className="error-container"><p className="error">{error}</p></div>
        ) : (
          <>
            {/* Controls (only for data tabs) */}
            {activeTab !== 'categories' && (
              <div className="controls">
                <MonthSelector months={months} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
                {selectedFile && <span className="active-file-badge">📋 {selectedFile}</span>}
              </div>
            )}

            {/* Tabs */}
            <div className="tabs">
              <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
                📊 Summary
              </button>
              <button className={`tab-btn ${activeTab === 'uncategorized' ? 'active' : ''}`} onClick={() => setActiveTab('uncategorized')}>
                ❓ Uncategorized
                {uncategorizedForMonth.length > 0 && (
                  <span className="tab-badge">{uncategorizedForMonth.length}</span>
                )}
              </button>
              <button className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
                ⚙️ Categories
              </button>
            </div>

            {/* Tab: Summary */}
            {activeTab === 'summary' && summary && (
              <>
                <div className="summary-overview">
                  <div className="overview-card income">
                    <h3>Total Income</h3>
                    <div className="amount">{formatCurrency(summary.totalIncome)}</div>
                  </div>
                  <div className="overview-card expense">
                    <h3>Total Expenses</h3>
                    <div className="amount">{formatCurrency(summary.totalExpenses)}</div>
                  </div>
                  <div className="overview-card net">
                    <h3>Net Income</h3>
                    <div className={`amount ${summary.netIncome >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(summary.netIncome)}
                    </div>
                  </div>
                </div>

                <div className="categories-container">
                  <CategorySummary categories={summary.incomeCategories}  type="income"  title="Income Categories" />
                  <CategorySummary categories={summary.expenseCategories} type="expense" title="Expense Categories" />
                </div>

                <FixedCuentaDetails
                  cuentasNames={cuentasNames}
                  selectedCuenta={selectedCuenta}
                  onSelectCuenta={setSelectedCuenta}
                  detailRows={filteredCuentaDetails}
                  selectedMonth={selectedMonth}
                />
              </>
            )}

            {/* Tab: Uncategorized */}
            {activeTab === 'uncategorized' && (
              <UncategorizedTransactions
                transactions={uncategorizedForMonth}
                selectedMonth={selectedMonth}
                selectedFile={selectedFile}
              />
            )}

            {/* Tab: Categories */}
            {activeTab === 'categories' && (
              <CategoriesConfig
                categories={categories}
                onCategoriesChange={handleCategoriesChange}
                onSaveCategories={handleCategoriesSave}
              />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Beach Accounting © 2026 &nbsp;|&nbsp; Total Transactions: {transactions.length}
          {selectedMonth && ` | Showing: ${formatMonth(selectedMonth)}`}
        </p>
      </footer>
    </div>
  );
}

export default App;
