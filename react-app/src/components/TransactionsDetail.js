import React from 'react';
import { formatDate, formatCurrency, exportTransactionsToCSV } from '../utils/dataParser';

/**
 * Muestra TODOS los movimientos del período seleccionado, en detalle.
 */
const TransactionsDetail = ({ transactions, selectedMonth }) => {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="uncategorized-empty">
        <div className="uncategorized-empty-icon">📭</div>
        <h3>No hay movimientos en este período</h3>
        <p>Selecciona otro mes o sube una cartola.</p>
      </div>
    );
  }

  const totalCargos = transactions.reduce((s, t) => s + (t.charges || 0), 0);
  const totalAbonos = transactions.reduce((s, t) => s + (t.credits || 0), 0);

  const handleExport = () => {
    const label = selectedMonth || 'todos';
    exportTransactionsToCSV(transactions, `movimientos_${label}.csv`);
  };

  return (
    <div className="transaction-list">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h4 style={{ margin: 0 }}>Movimientos ({transactions.length})</h4>
        <button className="action-btn export-btn" onClick={handleExport}>⬇ Exportar CSV</button>
      </div>
      <div className="table-container">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th className="amount-column">Cargos</th>
              <th className="amount-column">Abonos</th>
              <th className="amount-column">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, i) => (
              <tr key={`${t.operationNumber}-${i}`}>
                <td className="date-column">{formatDate(t.date)}</td>
                <td className="description-column">{t.description}</td>
                <td>{t.category && t.category !== 'Uncategorized'
                  ? t.category
                  : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                <td className="amount-column charges">{t.charges > 0 ? formatCurrency(t.charges) : '-'}</td>
                <td className="amount-column credits">{t.credits > 0 ? formatCurrency(t.credits) : '-'}</td>
                <td className="amount-column">{formatCurrency(t.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>
              <td colSpan={3} style={{ textAlign: 'right' }}>Totales:</td>
              <td className="amount-column charges">{formatCurrency(totalCargos)}</td>
              <td className="amount-column credits">{formatCurrency(totalAbonos)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TransactionsDetail;
