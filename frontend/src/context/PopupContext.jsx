import React, { createContext, useContext, useState, useCallback } from 'react';

const PopupContext = createContext(null);

export function PopupProvider({ children }) {
  // Confirm dialog state
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDanger: false,
    resolver: null
  });

  // Alert dialog state
  const [alertState, setAlertState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    resolver: null
  });

  // Floating toasts state
  const [toasts, setToasts] = useState([]);

  // Trigger custom confirmation dialog (returns Promise<boolean>)
  const showConfirm = useCallback(({ title = 'Confirmation', message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        isDanger,
        resolver: resolve
      });
    });
  }, []);

  const handleConfirmAction = (result) => {
    if (confirmState.resolver) {
      confirmState.resolver(result);
    }
    setConfirmState(prev => ({ ...prev, isOpen: false, resolver: null }));
  };

  // Trigger custom alert dialog (returns Promise<void>)
  const showAlert = useCallback(({ title = 'Notice', message, type = 'info' }) => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        title,
        message,
        type,
        resolver: resolve
      });
    });
  }, []);

  const handleAlertClose = () => {
    if (alertState.resolver) {
      alertState.resolver();
    }
    setAlertState(prev => ({ ...prev, isOpen: false, resolver: null }));
  };

  // Trigger floating toast notification
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <PopupContext.Provider value={{ showConfirm, showAlert, showToast }}>
      {children}

      {/* Floating Toast Container */}
      <div className="popup-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`popup-toast toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'danger' && '✕'}
              {toast.type === 'info' && 'ℹ'}
              {toast.type === 'warning' && '⚠️'}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="toast-close-btn">&times;</button>
          </div>
        ))}
      </div>

      {/* Custom Confirm Modal */}
      {confirmState.isOpen && (
        <div className="popup-overlay" onClick={() => handleConfirmAction(false)}>
          <div className="popup-modal-card" onClick={e => e.stopPropagation()}>
            <div className="popup-modal-header">
              <div className={`popup-icon-badge ${confirmState.isDanger ? 'badge-danger-glow' : 'badge-blue-glow'}`}>
                {confirmState.isDanger ? '⚠️' : '❓'}
              </div>
              <h3 className="popup-modal-title">{confirmState.title}</h3>
            </div>
            <div className="popup-modal-body">
              <p className="popup-modal-desc">{confirmState.message}</p>
            </div>
            <div className="popup-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleConfirmAction(false)}
              >
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                className={`btn ${confirmState.isDanger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => handleConfirmAction(true)}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertState.isOpen && (
        <div className="popup-overlay" onClick={handleAlertClose}>
          <div className="popup-modal-card" onClick={e => e.stopPropagation()}>
            <div className="popup-modal-header">
              <div className={`popup-icon-badge ${alertState.type === 'danger' ? 'badge-danger-glow' : alertState.type === 'success' ? 'badge-green-glow' : 'badge-blue-glow'}`}>
                {alertState.type === 'danger' ? '✕' : alertState.type === 'success' ? '✓' : 'ℹ'}
              </div>
              <h3 className="popup-modal-title">{alertState.title}</h3>
            </div>
            <div className="popup-modal-body">
              <p className="popup-modal-desc">{alertState.message}</p>
            </div>
            <div className="popup-modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAlertClose}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
}

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  return context;
};
