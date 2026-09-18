import React from 'react';
import { formatMonth } from '../utils/dataParser';

/**
 * MonthSelector Component
 * Allows users to select a specific month to view transactions
 */
const MonthSelector = ({ months, selectedMonth, onMonthChange }) => {
  return (
    <div className="month-selector">
      <label htmlFor="month-select">
        <strong>Select Month:</strong>
      </label>
      <select
        id="month-select"
        value={selectedMonth}
        onChange={(e) => onMonthChange(e.target.value)}
        className="month-dropdown"
      >
        <option value="">All Months</option>
        {months.map(month => (
          <option key={month} value={month}>
            {formatMonth(month)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MonthSelector;
