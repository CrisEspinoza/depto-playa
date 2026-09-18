import React from 'react';
import { formatCurrency, formatMonth } from '../utils/dataParser';

/**
 * Shows payment history for fixed cuentas from uploaded cuentas workbook.
 */
const FixedCuentaDetails = ({
  cuentasNames,
  selectedCuenta,
  onSelectCuenta,
  detailRows,
  selectedMonth,
}) => {
  if (!cuentasNames || cuentasNames.length === 0) {
    return null;
  }

  const total = detailRows.reduce((sum, row) => sum + (row.amount || 0), 0);

  return (
    <section className="fixed-cuentas-panel">
      <div className="fixed-cuentas-header">
        <h3>Fixed Cuenta Payments</h3>
        <p>
          {selectedMonth
            ? `Showing payments for ${formatMonth(selectedMonth)}`
            : 'Showing payments for all months'}
        </p>
      </div>

      <div className="fixed-cuentas-controls">
        <label htmlFor="fixed-cuenta-select">Cuenta</label>
        <select
          id="fixed-cuenta-select"
          className="fixed-cuentas-dropdown"
          value={selectedCuenta}
          onChange={(e) => onSelectCuenta(e.target.value)}
        >
          {cuentasNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="fixed-cuentas-summary">
        <span>Total paid:</span>
        <strong>{formatCurrency(total)}</strong>
      </div>

      {detailRows.length === 0 ? (
        <p className="no-data">No payments found for this cuenta in the selected period.</p>
      ) : (
        <div className="table-container">
          <table className="transactions-table fixed-cuentas-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Month</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row, idx) => (
                <tr key={`${row.date}-${row.amount}-${idx}`}>
                  <td className="date-column">{row.date}</td>
                  <td>{formatMonth(row.month)}</td>
                  <td className="amount-column charges">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default FixedCuentaDetails;
