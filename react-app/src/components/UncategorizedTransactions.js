import React from 'react';
import { formatDate, formatCurrency, exportTransactionsToCSV } from '../utils/dataParser';

/**
 * UncategorizedTransactions Component
 * Shows all transactions that were not matched by any category rule,
 * and provides a button to export them as CSV.
 */
const UncategorizedTransactions = ({ transactions, selectedMonth, selectedFile }) => {
  const handleExport = () => {
    const month = selectedMonth || 'all';
    const base  = selectedFile ? selectedFile.replace('.csv', '') : 'transactions';
    exportTransactionsToCSV(transactions, `uncategorized_${month}_${base}.csv`);
  };

  if (!transactions || transactions.length === 0) {
    return (
      <div className="uncategorized-empty">
        <div className="uncategorized-empty-icon">✅</div>
        <h3>All transactions are categorized!</h3>
        <p>No uncategorized transactions found for the selected period.</p>
      </div>
    );
  }

  const totalCharges = transactions.reduce((s, t) => s + (t.charges || 0), 0);
  const totalCredits = transactions.reduce((s, t) => s + (t.credits || 0), 0);

  return (
    <div className="uncategorized-container">
      <div className="uncategorized-header">
        <div className="uncategorized-header-info">
          <h3>Uncategorized Transactions</h3>
          <p className="uncategorized-subtitle">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} not matched by any category rule
          </p>
        </div>
        <button className="action-btn export-btn" onClick={handleExport}>
          ⬇ Export CSV
        </button>
      </div>

      <div className="uncategorized-totals">
        <div className="uncat-total-card charges">
          <span className="uncat-total-label">Uncategorized Charges</span>
          <span className="uncat-total-amount">{formatCurrency(totalCharges)}</span>
        </div>
        <div className="uncat-total-card credits">
          <span className="uncat-total-label">Uncategorized Credits</span>
          <span className="uncat-total-amount">{formatCurrency(totalCredits)}</span>
        </div>
        <div className="uncat-total-card count">
          <span className="uncat-total-label">Transactions</span>
          <span className="uncat-total-amount">{transactions.length}</span>
        </div>
      </div>

      <div className="table-container">
        <table className="transactions-table uncategorized-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Operation #</th>
              <th>Description</th>
              <th className="amount-column">Charges</th>
              <th className="amount-column">Credits</th>
              <th className="amount-column">Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, idx) => (
              <tr key={`${t.operationNumber || idx}-${idx}`}>
                <td className="date-column">{formatDate(t.date)}</td>
                <td className="op-column">{t.operationNumber || '-'}</td>
                <td className="description-column">{t.description}</td>
                <td className="amount-column charges">
                  {t.charges > 0 ? formatCurrency(t.charges) : '-'}
                </td>
                <td className="amount-column credits">
                  {t.credits > 0 ? formatCurrency(t.credits) : '-'}
                </td>
                <td className="amount-column">{formatCurrency(t.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UncategorizedTransactions;
