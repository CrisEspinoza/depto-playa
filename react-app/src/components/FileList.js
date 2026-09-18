import React from 'react';

/**
 * FileList Component
 * Displays the source files (movement_historial) and output CSV files
 * that are considered for calculations.
 */
const FileList = ({ outputFiles, historialFiles, selectedFile, onSelectFile, loading }) => {
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="file-list-panel">
      {/* Source Files */}
      <div className="file-section">
        <h3 className="file-section-title">
          <span className="file-section-icon">📂</span>
          Source Files <span className="file-count">({historialFiles.length})</span>
        </h3>
        {loading ? (
          <p className="file-loading">Loading files…</p>
        ) : historialFiles.length === 0 ? (
          <p className="file-empty">No source files found in movement_historial/</p>
        ) : (
          <ul className="file-items">
            {historialFiles.map((f) => (
              <li key={f.name} className="file-item source-file">
                <span className="file-icon">📄</span>
                <span className="file-name">{f.name}</span>
                <span className="file-meta">{formatSize(f.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Output CSV Files */}
      <div className="file-section">
        <h3 className="file-section-title">
          <span className="file-section-icon">📊</span>
          Summary Files <span className="file-count">({outputFiles.length})</span>
        </h3>
        {loading ? (
          <p className="file-loading">Loading files…</p>
        ) : outputFiles.length === 0 ? (
          <p className="file-empty">No summary files found in output/</p>
        ) : (
          <ul className="file-items">
            {outputFiles.map((f) => (
              <li
                key={f.name}
                className={`file-item output-file ${selectedFile === f.name ? 'selected' : ''}`}
                onClick={() => onSelectFile(f.name)}
                title={`Last modified: ${formatDate(f.modified)}`}
              >
                <span className="file-icon">📋</span>
                <div className="file-info">
                  <span className="file-name">{f.name}</span>
                  <span className="file-modified">{formatDate(f.modified)}</span>
                </div>
                <span className="file-meta">{formatSize(f.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FileList;
