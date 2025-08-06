import React from 'react';

const UnsavedChangesPopup = ({ 
  isVisible, 
  message = "You have unsaved changes. Are you sure you want to leave?", 
  type = "warning",
  onSave, 
  onDiscard, 
  onCancel 
}) => {
  if (!isVisible) return null;

  return (
    <div className={`unsaved-changes-popup ${type}`}>
      <div className="unsaved-changes-message">
        {message}
      </div>
      <div className="unsaved-changes-actions">
        {onSave && (
          <button 
            className="unsaved-changes-btn primary" 
            onClick={onSave}
          >
            Save
          </button>
        )}
        {onDiscard && (
          <button 
            className="unsaved-changes-btn danger" 
            onClick={onDiscard}
          >
            Discard
          </button>
        )}
        {onCancel && (
          <button 
            className="unsaved-changes-btn secondary" 
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default UnsavedChangesPopup;
