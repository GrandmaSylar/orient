import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

export interface CustomDialogProps {
  isOpen: boolean;
  type: 'success' | 'warning' | 'error' | 'confirm';
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({
  isOpen,
  type,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={32} style={{ color: 'var(--accent-success)' }} />;
      case 'warning':
        return <AlertTriangle size={32} style={{ color: 'var(--accent-warning)' }} />;
      case 'error':
        return <XCircle size={32} style={{ color: 'var(--accent-danger)' }} />;
      case 'confirm':
        return <Info size={32} style={{ color: 'var(--accent-primary)' }} />;
    }
  };

  const getHeaderColor = () => {
    switch (type) {
      case 'success':
        return 'var(--accent-success-light)';
      case 'warning':
        return '#fef3c7'; // Amber Light
      case 'error':
        return 'var(--accent-danger-light)';
      case 'confirm':
        return 'var(--accent-primary-light)';
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10100, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
      <div 
        className="modal-content animate-scale-in" 
        style={{ 
          maxWidth: '400px', 
          width: '90%',
          borderRadius: '24px',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.16), 0 8px 24px -8px rgba(15, 23, 42, 0.05)',
          padding: '36px 30px',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          
          {/* Icon wrapper with iOS card style */}
          <div style={{
            display: 'inline-flex',
            padding: '14px',
            borderRadius: '16px',
            backgroundColor: getHeaderColor(),
            marginBottom: '20px',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
          }}>
            {getIcon()}
          </div>

          <h3 style={{ 
            fontSize: '1.3rem', 
            fontWeight: 750, 
            marginBottom: '8px', 
            color: 'var(--text-primary)', 
            letterSpacing: '-0.025em' 
          }}>
            {title}
          </h3>

          <p style={{ 
            fontSize: '0.9rem', 
            color: 'var(--text-secondary)', 
            lineHeight: 1.5, 
            marginBottom: '28px',
            letterSpacing: '-0.015em' 
          }}>
            {message}
          </p>

          {/* Action buttons (iOS pill style) */}
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            {type === 'confirm' && onCancel && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onCancel}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                {cancelText}
              </button>
            )}
            <button 
              type="button" 
              className={`btn ${type === 'error' ? 'btn-danger' : type === 'warning' ? 'btn-danger' : 'btn-primary'}`} 
              onClick={onConfirm}
              style={{ 
                flex: 1, 
                padding: '12px', 
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                boxShadow: type === 'confirm' || type === 'success' ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none'
              }}
            >
              {confirmText}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
