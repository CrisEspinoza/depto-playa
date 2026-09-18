import React, { useState } from 'react';
import { DEFAULT_CATEGORIES, saveCategories } from '../config/categories';

/**
 * CategoriesConfig Component
 * Lets the user view, add, edit, delete and save categories.
 * Changes are persisted to localStorage immediately on Save.
 */
const CategoriesConfig = ({ categories, onCategoriesChange, onSaveCategories }) => {
  const [editing, setEditing]   = useState(null); // index of row being edited
  const [draft,   setDraft]     = useState({});
  const [saved,   setSaved]     = useState(false);
  const [patternError, setPatternError] = useState('');
  const [saveError, setSaveError] = useState('');

  // ── helpers ──────────────────────────────────────────────────────────────

  const validatePattern = (pattern) => {
    try { new RegExp(pattern); return true; }
    catch { return false; }
  };

  const startEdit = (idx) => {
    setEditing(idx);
    setDraft({ ...categories[idx] });
    setPatternError('');
  };

  const startAdd = (type) => {
    const newCat = { name: '', type, pattern: '', description: '' };
    const newList = [...categories, newCat];
    onCategoriesChange(newList);
    setEditing(newList.length - 1);
    setDraft(newCat);
    setPatternError('');
  };

  const cancelEdit = () => {
    // If the row was brand-new and still empty, remove it
    const cat = categories[editing];
    if (cat && !cat.name && !cat.pattern) {
      const newList = categories.filter((_, i) => i !== editing);
      onCategoriesChange(newList);
    }
    setEditing(null);
    setDraft({});
  };

  const commitEdit = () => {
    if (!draft.name.trim()) return;
    if (!validatePattern(draft.pattern)) {
      setPatternError('Invalid regular expression');
      return;
    }
    setPatternError('');
    const newList = categories.map((cat, i) => i === editing ? { ...draft } : cat);
    onCategoriesChange(newList);
    setEditing(null);
    setDraft({});
  };

  const deleteRow = (idx) => {
    if (editing === idx) { setEditing(null); setDraft({}); }
    onCategoriesChange(categories.filter((_, i) => i !== idx));
  };

  const moveRow = (idx, dir) => {
    const newList = [...categories];
    const target = idx + dir;
    if (target < 0 || target >= newList.length) return;
    [newList[idx], newList[target]] = [newList[target], newList[idx]];
    if (editing === idx) setEditing(target);
    onCategoriesChange(newList);
  };

  const handleSave = async () => {
    setSaveError('');
    try {
      if (onSaveCategories) {
        await onSaveCategories(categories);
      } else {
        saveCategories(categories);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaved(false);
      setSaveError(error.message || 'Could not sync categories with the API server.');
    }
  };

  const handleReset = async () => {
    if (window.confirm('Reset to default categories? This will discard your customisations.')) {
      const defaults = DEFAULT_CATEGORIES.map(category => ({ ...category }));
      onCategoriesChange(defaults);
      setSaveError('');
      try {
        if (onSaveCategories) {
          await onSaveCategories(defaults);
        } else {
          saveCategories(defaults);
        }
      } catch (error) {
        setSaveError(error.message || 'Could not sync categories with the API server.');
      }
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const income  = categories.filter(c => c.type === 'income');
  const expense = categories.filter(c => c.type === 'expense');
  const ignore  = categories.filter(c => c.type === 'ignore');

  return (
    <div className="categories-config">
      <div className="config-header">
        <div>
          <h3>Category Configuration</h3>
          <p className="config-subtitle">
            Add, edit or delete categories. Patterns are <strong>case-insensitive</strong> regular expressions
            matched against the transaction description. Changes take effect immediately after saving.
          </p>
        </div>
        <div className="config-actions">
          <button className="action-btn" style={{background:'#f3f4f6',color:'#374151',border:'2px solid #e5e7eb'}} onClick={handleReset}>↺ Reset to defaults</button>
          <button className={`action-btn save-cat-btn ${saved ? 'saved' : ''}`} onClick={handleSave}>
            {saved ? '✓ Saved!' : '💾 Save'}
          </button>
        </div>
        {saveError && <p className="config-save-error">{saveError}</p>}
      </div>

      {['income', 'expense', 'ignore'].map(type => {
        const rows = type === 'income' ? income : (type === 'expense' ? expense : ignore);
        const label = type === 'income' ? '📈 Categorías de Ingreso' : (type === 'expense' ? '📉 Categorías de Egreso' : '🚫 Excluidas (no se cuentan: ya están en Cuentas o son internas)');
        return (
          <div key={type} className={`config-section config-section-${type}`}>
            <div className="config-section-header">
              <h4 className="config-section-label">{label} ({rows.length})</h4>
              <button className="action-btn add-cat-btn" onClick={() => startAdd(type)}>
                {type === 'income' ? '+ Agregar Ingreso' : (type === 'expense' ? '+ Agregar Egreso' : '+ Agregar Excluida')}
              </button>
            </div>
            <div className="config-table-wrapper">
              <table className="config-table">
                <thead>
                  <tr>
                    <th style={{width:32}}>#</th>
                    <th>Name</th>
                    <th>Regex Pattern</th>
                    <th>Description</th>
                    <th style={{width:120}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, globalIdx) => {
                    if (cat.type !== type) return null;
                    const isEditing = editing === globalIdx;

                    if (isEditing) {
                      return (
                        <tr key={globalIdx} className="config-row editing">
                          <td className="row-num">{globalIdx + 1}</td>
                          <td>
                            <input
                              className="config-input"
                              value={draft.name}
                              placeholder="Category name"
                              onChange={e => setDraft(d => ({...d, name: e.target.value}))}
                            />
                          </td>
                          <td>
                            <input
                              className={`config-input ${patternError ? 'input-error' : ''}`}
                              value={draft.pattern}
                              placeholder="regex|pattern"
                              onChange={e => {
                                setDraft(d => ({...d, pattern: e.target.value}));
                                setPatternError('');
                              }}
                            />
                            {patternError && <span className="input-error-msg">{patternError}</span>}
                          </td>
                          <td>
                            <input
                              className="config-input"
                              value={draft.description}
                              placeholder="Optional description"
                              onChange={e => setDraft(d => ({...d, description: e.target.value}))}
                            />
                          </td>
                          <td className="row-actions">
                            <button className="icon-btn ok-btn"    onClick={commitEdit}  title="Confirm">✓</button>
                            <button className="icon-btn cancel-btn" onClick={cancelEdit} title="Cancel">✕</button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={globalIdx} className="config-row">
                        <td className="row-num">{globalIdx + 1}</td>
                        <td className="cat-name">{cat.name}</td>
                        <td className="cat-pattern"><code>{cat.pattern}</code></td>
                        <td className="cat-desc">{cat.description}</td>
                        <td className="row-actions">
                          <button className="icon-btn edit-btn"   onClick={() => startEdit(globalIdx)} title="Edit">✏️</button>
                          <button className="icon-btn up-btn"     onClick={() => moveRow(globalIdx, -1)} title="Move up">↑</button>
                          <button className="icon-btn down-btn"   onClick={() => moveRow(globalIdx, +1)} title="Move down">↓</button>
                          <button className="icon-btn delete-btn" onClick={() => deleteRow(globalIdx)} title="Delete">🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={5} className="config-empty">No {type} categories. Click the add button for this section.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="config-tip">
        💡 <strong>Tip:</strong> Patterns are matched with <code>new RegExp(pattern, 'i')</code>.
        Use <code>|</code> to match multiple words, e.g. <code>airbnb|angon|radar</code>.
        Click <strong>Save</strong> to persist your changes across page reloads.
      </div>
    </div>
  );
};

export default CategoriesConfig;
