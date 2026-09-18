import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { apiFetch } from './api';
import Login from './components/Login';
import MonthSelector from './components/MonthSelector';
import CategorySummary from './components/CategorySummary';
import UncategorizedTransactions from './components/UncategorizedTransactions';
import TransactionsDetail from './components/TransactionsDetail';
import CategoriesConfig from './components/CategoriesConfig';
import FixedCuentaDetails from './components/FixedCuentaDetails';
import {
  getUniqueMonths,
  filterByMonth,
  calculateSummary,
  formatCurrency,
  formatMonth,
  exportTransactionsToCSV,
  exportStructuredSummary,
  exportHistoricalSummaryXLSX,
} from './utils/dataParser';
import { findCategory } from './config/categories';
import './App.css';

const NOW = new Date();
const CURRENT_MONTH_DASH = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`;

// ── Raíz: decide login vs app ────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(undefined); // undefined = cargando, null = fuera

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <div className="loading">Cargando…</div>;
  if (!user) return <Login />;
  return <Dashboard user={user} />;
}

// ── App autenticada ──────────────────────────────────────────────────────────
function Dashboard({ user }) {
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [summary, setSummary] = useState(null);

  const [cuentasData, setCuentasData] = useState(null);
  const [cuentasDetails, setCuentasDetails] = useState(null);
  const [cuentasSource, setCuentasSource] = useState(null);
  const [selectedCuenta, setSelectedCuenta] = useState('');

  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  // Mapea filas del backend a la forma que usa la UI, categorizando en cliente.
  const mapTx = useCallback((rows, cats) => rows.map((r) => {
    const description = r.Movimientos || '';
    const cat = findCategory(description, cats);
    return {
      date: r.Fecha || '',
      operationNumber: r.Operacion || '',
      description,
      charges: Number(r.Cargos || 0),
      credits: Number(r.Abonos || 0),
      balance: Number(r.Saldo || 0),
      category: cat ? cat.name : 'Uncategorized',
      categoryType: cat ? cat.type : null,
    };
  }), []);

  const applyTransactions = useCallback((parsed) => {
    setTransactions(parsed);
    const parsedMonths = getUniqueMonths(parsed);
    const monthsWithCurrent = parsedMonths.includes(CURRENT_MONTH_DASH)
      ? parsedMonths
      : [CURRENT_MONTH_DASH, ...parsedMonths].sort().reverse();
    setMonths(monthsWithCurrent);
    setSelectedMonth((prev) => prev
      || (monthsWithCurrent.includes(CURRENT_MONTH_DASH) ? CURRENT_MONTH_DASH : (monthsWithCurrent[0] || '')));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [catRes, txRes, cuRes] = await Promise.all([
        apiFetch('/api/categories'),
        apiFetch('/api/transactions'),
        apiFetch('/api/cuentas'),
      ]);
      if (catRes.status === 403) {
        setError('Tu cuenta no está autorizada para usar esta aplicación.');
        setLoading(false);
        return;
      }
      const cats = catRes.ok ? ((await catRes.json()).categories || []) : [];
      setCategories(cats);
      const txData = txRes.ok ? await txRes.json() : { transactions: [] };
      applyTransactions(mapTx(txData.transactions || [], cats));
      if (cuRes.ok) {
        const cu = await cuRes.json();
        setCuentasData(cu.cuentas || null);
        setCuentasDetails(cu.cuentasDetails || null);
        setCuentasSource(cu.source || null);
      }
    } catch {
      setError('No se pudo conectar con el servidor. ¿Está el backend en línea?');
    }
    setLoading(false);
  }, [applyTransactions, mapTx]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const reloadTransactions = useCallback(async (cats) => {
    const res = await apiFetch('/api/transactions');
    if (res.ok) {
      const d = await res.json();
      applyTransactions(mapTx(d.transactions || [], cats || categories));
    }
  }, [applyTransactions, mapTx, categories]);

  // Recalcula el resumen al cambiar transacciones/mes/cuentas
  useEffect(() => {
    if (transactions.length > 0) {
      const filtered = filterByMonth(transactions, selectedMonth);
      const cuentasForMonth = {};
      if (cuentasData) {
        Object.entries(cuentasData).forEach(([name, monthly]) => {
          if (selectedMonth) {
            const v = monthly[selectedMonth];
            if (v) cuentasForMonth[name] = v;
          } else {
            const t = Object.values(monthly).reduce((s, v) => s + (v || 0), 0);
            if (t) cuentasForMonth[name] = t;
          }
        });
      }
      setSummary(calculateSummary(filtered, cuentasForMonth));
    } else {
      setSummary(null);
    }
  }, [transactions, selectedMonth, cuentasData]);

  // ── Subir cartola bancaria ──
  const handleUploadCartola = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch('/api/transactions/upload', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || `Error ${res.status}`);
      setMsg({ ok: true, text: `✅ ${file.name}: ${d.stored} movimientos guardados` });
      await reloadTransactions();
    } catch (err) {
      setMsg({ ok: false, text: `❌ ${err.message}` });
    }
    setBusy(false);
    e.target.value = '';
  };

  // ── Subir cuentas fijas (xlsx) ──
  const handleUploadCuentas = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch('/api/cuentas/upload', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || `Error ${res.status}`);
      setCuentasData(d.cuentas || null);
      setCuentasDetails(d.cuentasDetails || null);
      setCuentasSource(d.source || file.name);
      setMsg({ ok: true, text: `✅ Cuentas cargadas: ${d.source || file.name}` });
    } catch (err) {
      setMsg({ ok: false, text: `❌ ${err.message}` });
    }
    setBusy(false);
    e.target.value = '';
  };

  // ── Categorías: cambio en vivo (recategoriza en cliente) ──
  const handleCategoriesChange = (newCats) => {
    setCategories(newCats);
    setTransactions((prev) => prev.map((t) => {
      const cat = findCategory(t.description, newCats);
      return { ...t, category: cat ? cat.name : 'Uncategorized', categoryType: cat ? cat.type : null };
    }));
  };

  // ── Categorías: guardar en backend (Firestore) ──
  const handleSaveCategories = async (newCats) => {
    const res = await apiFetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: newCats }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.detail || 'No se pudieron guardar las categorías');
    }
    setCategories(newCats);
    await reloadTransactions(newCats);
  };

  // ── Exportaciones ──
  const handleExportStructured = () => {
    if (!selectedMonth) {
      exportHistoricalSummaryXLSX(transactions, categories, cuentasData || {}, 'summary_historical.xlsx');
    } else {
      const year = selectedMonth.split('-')[0];
      exportStructuredSummary(transactions, categories, cuentasData || {}, year, `summary_${year}.csv`);
    }
  };

  const handleExportMonthly = () => {
    if (!summary) return;
    const allFiltered = filterByMonth(transactions, selectedMonth);
    const label = selectedMonth ? formatMonth(selectedMonth).replace(/\s/g, '_') : 'all';
    exportTransactionsToCSV(allFiltered, `transactions_${label}.csv`);
  };

  // ── Cuentas fijas: detalle ──
  const cuentasNames = useMemo(
    () => (cuentasDetails ? Object.keys(cuentasDetails).sort() : []),
    [cuentasDetails]
  );

  useEffect(() => {
    if (cuentasNames.length === 0) { setSelectedCuenta(''); return; }
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

  const uncategorizedForMonth = summary?.uncategorized || [];
  const monthTransactions = filterByMonth(transactions, selectedMonth);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div>
            <h1>Beach Accounting</h1>
            <p className="subtitle">Contabilidad del departamento de playa</p>
          </div>
          <div className="header-actions">
            <label htmlFor="cartola-upload" className={`action-btn run-btn ${busy ? 'running' : ''}`} title="Subir cartola del banco (.xls/.xlsx)">
              {busy ? '⏳ Procesando…' : '⬆ Subir cartola'}
            </label>
            <input id="cartola-upload" type="file" accept=".xls,.xlsx" onChange={handleUploadCartola} disabled={busy} style={{ display: 'none' }} />

            <label htmlFor="cuentas-upload" className="action-btn upload-btn" style={{ background: '#fef9c3', color: '#854d0e', borderColor: '#fde047' }} title="Subir cuentas fijas (Luz, Agua, Dividendo, etc.)">
              📊 Subir Cuentas
            </label>
            <input id="cuentas-upload" type="file" accept=".xlsx,.xls" onChange={handleUploadCuentas} disabled={busy} style={{ display: 'none' }} />

            <button className="action-btn export-btn" onClick={handleExportStructured} title="Exportar resumen anual">⬇ Exportar Resumen</button>
            <button className="action-btn export-btn" onClick={handleExportMonthly} disabled={!summary} style={{ background: '#764ba2' }} title="Exportar transacciones del mes">⬇ Exportar Movimientos</button>

            <span className="active-file-badge" title={user.email}>👤 {user.email}</span>
            <button className="action-btn" style={{ background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb' }} onClick={() => signOut(auth)}>Cerrar sesión</button>
          </div>
        </div>

        {cuentasSource && (
          <div className="cuentas-badge">
            📊 Cuentas cargadas: <strong>{cuentasSource}</strong>
            {cuentasData && (
              <span className="cuentas-sheets">
                {Object.keys(cuentasData).map((s) => (
                  <span key={s} className="cuentas-sheet-tag">{s}</span>
                ))}
              </span>
            )}
          </div>
        )}

        {msg && (
          <div className={`script-msg ${msg.ok ? 'ok' : 'fail'}`}>
            {msg.text}
            <button className="script-msg-close" onClick={() => setMsg(null)}>✕</button>
          </div>
        )}
      </header>

      <main className="app-main">
        {loading ? (
          <div className="loading">Cargando datos…</div>
        ) : error ? (
          <div className="error-container"><p className="error">{error}</p></div>
        ) : (
          <>
            {activeTab !== 'categories' && (
              <div className="controls">
                <MonthSelector months={months} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
              </div>
            )}

            <div className="tabs">
              <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>📊 Resumen</button>
              <button className={`tab-btn ${activeTab === 'uncategorized' ? 'active' : ''}`} onClick={() => setActiveTab('uncategorized')}>
                ❓ Sin categorizar
                {uncategorizedForMonth.length > 0 && <span className="tab-badge">{uncategorizedForMonth.length}</span>}
              </button>
              <button className={`tab-btn ${activeTab === 'movimientos' ? 'active' : ''}`} onClick={() => setActiveTab('movimientos')}>📋 Movimientos</button>
              <button className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>⚙️ Categorías</button>
            </div>

            {activeTab === 'summary' && summary && (
              <>
                <div className="summary-overview">
                  <div className="overview-card income">
                    <h3>Ingresos</h3>
                    <div className="amount">{formatCurrency(summary.totalIncome)}</div>
                  </div>
                  <div className="overview-card expense">
                    <h3>Egresos</h3>
                    <div className="amount">{formatCurrency(summary.totalExpenses)}</div>
                  </div>
                  <div className="overview-card net">
                    <h3>Neto</h3>
                    <div className={`amount ${summary.netIncome >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(summary.netIncome)}</div>
                  </div>
                </div>

                <div className="categories-container">
                  <CategorySummary categories={summary.incomeCategories} type="income" title="Categorías de Ingreso" />
                  <CategorySummary categories={summary.expenseCategories} type="expense" title="Categorías de Egreso" />
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

            {activeTab === 'uncategorized' && (
              <UncategorizedTransactions transactions={uncategorizedForMonth} selectedMonth={selectedMonth} selectedFile={cuentasSource} />
            )}

            {activeTab === 'movimientos' && (
              <TransactionsDetail transactions={monthTransactions} selectedMonth={selectedMonth} />
            )}

            {activeTab === 'categories' && (
              <CategoriesConfig categories={categories} onCategoriesChange={handleCategoriesChange} onSaveCategories={handleSaveCategories} />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Beach Accounting © 2026 &nbsp;|&nbsp; Movimientos: {transactions.length}
          {selectedMonth && ` | Mostrando: ${formatMonth(selectedMonth)}`}
        </p>
      </footer>
    </div>
  );
}

export default App;
