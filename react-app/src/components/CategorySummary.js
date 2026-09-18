import React, { useState } from 'react';
import { formatCurrency } from '../utils/dataParser';
import TransactionList from './TransactionList';

/**
 * CategorySummary Component
 * Displays summary of categories with their totals and expandable transaction details
 */
const CategorySummary = ({ categories, type, title }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);

  const toggleCategory = (categoryName) => {
    setExpandedCategory(expandedCategory === categoryName ? null : categoryName);
  };

  if (!categories || categories.length === 0) {
    return (
      <div className={`category-summary ${type}`}>
        <h3>{title}</h3>
        <p className="no-data">No {type} categories found.</p>
      </div>
    );
  }

  const total = categories.reduce((sum, cat) => {
    return sum + (type === 'income' ? cat.totalCredits : cat.totalCharges);
  }, 0);

  return (
    <div className={`category-summary ${type}`}>
      <h3>{title}</h3>
      <div className="categories-list">
        {categories.map(category => {
          const amount = type === 'income' ? category.totalCredits : category.totalCharges;
          const isExpanded = expandedCategory === category.name;
          
          return (
            <div key={category.name} className="category-item">
              <div 
                className="category-header"
                onClick={() => !category.isFixed && toggleCategory(category.name)}
                style={category.isFixed ? { cursor: 'default' } : {}}
              >
                <div className="category-info">
                  <span className="category-name">{category.name}</span>
                  <span className="category-count">
                    {category.isFixed
                      ? '🏠 Fixed'
                      : `(${category.transactions.length} transaction${category.transactions.length !== 1 ? 's' : ''})`}
                  </span>
                </div>
                <div className="category-amount">
                  <span className={`amount ${type}`}>
                    {formatCurrency(amount)}
                  </span>
                  {!category.isFixed && (
                    <span className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>
                      ▼
                    </span>
                  )}
                </div>
              </div>
              
              {isExpanded && !category.isFixed && (
                <div className="category-details">
                  <TransactionList 
                    transactions={category.transactions}
                    categoryName={category.name}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="category-total">
        <strong>Total {title}:</strong>
        <span className={`amount ${type}`}>{formatCurrency(total)}</span>
      </div>
    </div>
  );
};

export default CategorySummary;
