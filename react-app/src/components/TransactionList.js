import React from 'react';
import { formatDate, formatCurrency } from '../utils/dataParser';

/**
 * TransactionList Component
 * Displays a list of transactions for a specific category
 */
const TransactionList = ({ transactions, categoryName }) => {
  if (!transactions || transactions.length === 0) {
    return <p className="no-transactions">No transactions found.</p>;
  }

  return (
    <div className="transaction-list">
      <h4>{categoryName} - Transactions ({transactions.length})</h4>
      <div className="table-container">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th className="amount-column">Charges</th>
              <th className="amount-column">Credits</th>
              <th className="amount-column">Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <tr key={`${transaction.operationNumber}-${index}`}>
                <td className="date-column">{formatDate(transaction.date)}</td>
                <td className="description-column">{transaction.description}</td>
                <td className="amount-column charges">
                  {transaction.charges > 0 ? formatCurrency(transaction.charges) : '-'}
                </td>
                <td className="amount-column credits">
                  {transaction.credits > 0 ? formatCurrency(transaction.credits) : '-'}
                </td>
                <td className="amount-column">{formatCurrency(transaction.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionList;
