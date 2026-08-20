import React, { useState, useEffect } from 'react';
import { ShieldCheck, Copy, Check, Lock, AlertTriangle } from 'lucide-react';
import { FloatingBackground } from './FloatingBackground';

interface ActivationProps {
  onSuccess: () => void;
}

export const Activation: React.FC<ActivationProps> = ({ onSuccess }) => {
  const [machineId, setMachineId] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMachineId();
  }, []);

  const fetchMachineId = async () => {
    try {
      const res = await window.electronAPI.invoke('lic-get-machine-id');
      if (res.success && res.machineId) {
        setMachineId(res.machineId);
      } else {
        setError(res.error || 'Failed to query machine ID.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred fetching hardware ID.');
    }
  };

  const handleCopyMachineId = () => {
    if (!machineId) return;
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setError('Please enter a valid license key.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await window.electronAPI.invoke('lic-activate-online', {
        licenseKey: licenseKey.trim()
      });

      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Activation failed. Invalid license key or workstation limit reached.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
        background: 'radial-gradient(circle at top, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <FloatingBackground />

      <div style={{
        width: '100%',
        maxWidth: '440px',
        padding: '40px 36px',
        borderRadius: '24px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 25px 50px -12px rgba(7, 25, 30, 0.08), 0 8px 24px -8px rgba(7, 25, 30, 0.03)',
        position: 'relative',
        zIndex: 1
      }} className="animate-scale-in">
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: 'var(--accent-primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)'
          }}>
            <Lock size={28} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.03em' }}>
            Activate License Key
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.45 }}>
            Enter your purchased license activation key to register this workstation and unlock the Orient Fees Tracker system.
          </p>
        </div>

        <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              License Activation Key
            </label>
            <input 
              type="text" 
              className="form-control" 
              value={licenseKey} 
              onChange={(e) => setLicenseKey(e.target.value)} 
              required 
              placeholder="e.g. X89H2P9L3K5M7W1"
              disabled={loading}
              style={{ borderRadius: '10px', padding: '12px 14px', fontSize: '0.95rem', width: '100%', outline: 'none', letterSpacing: '0.5px' }}
            />
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'var(--accent-danger-light)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--accent-danger)',
              fontSize: '0.85rem',
              textAlign: 'left',
              lineHeight: 1.4
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '14px', 
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <ShieldCheck size={18} />
            {loading ? 'Registering Workstation...' : 'Verify & Activate'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                Local Hardware Fingerprint
              </span>
              <code style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                {machineId || 'Loading...'}
              </code>
            </div>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={handleCopyMachineId}
              style={{ padding: '6px', minWidth: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Copy ID"
            >
              {copied ? <Check size={14} style={{ color: 'var(--accent-success)' }} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
