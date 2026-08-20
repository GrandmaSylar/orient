import React, { useState } from 'react';
import { Database, Server, User, Lock, Activity, ShieldCheck } from 'lucide-react';

interface DbWizardProps {
  onSuccess: () => void;
}

export const DbWizard: React.FC<DbWizardProps> = ({ onSuccess }) => {
  const [server, setServer] = useState('');
  const [port, setPort] = useState('1433');
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [encrypt, setEncrypt] = useState(true);
  const [trustCert, setTrustCert] = useState(true);

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const getFormConfig = (): DbConfig => ({
    server,
    port,
    database,
    user,
    password,
    encrypt,
    trustServerCertificate: trustCert
  });

  const testConnection = async () => {
    setTesting(true);
    setMessage({ text: 'Testing database connection...', type: 'info' });
    try {
      const res = await window.electronAPI.invoke('db-test-connection', getFormConfig());
      if (res.success) {
        setMessage({ text: 'Connection successful! SQL Server is reachable.', type: 'success' });
      } else {
        setMessage({ text: `Connection failed: ${res.error}`, type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const saveAndInitialize = async () => {
    setSaving(true);
    setMessage({ text: 'Saving configuration and establishing connection pool...', type: 'info' });
    try {
      // 1. Save config and verify pool connection
      const saveRes = await window.electronAPI.invoke('db-save-config', getFormConfig());
      if (!saveRes.success) {
        throw new Error(saveRes.error || 'Failed to save database configuration.');
      }

      setMessage({ text: 'Initializing database tables and seeding defaults...', type: 'info' });
      
      // 2. Initialize DB tables
      const initRes = await window.electronAPI.invoke('db-initialize');
      if (!initRes.success) {
        throw new Error(initRes.error || 'Schema migration failed.');
      }

      setMessage({ text: 'Database initialized successfully! Loading system...', type: 'success' });
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setMessage({ text: err.message || 'An unexpected error occurred.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div className="panel animate-scale-in" style={{ width: '100%', maxWidth: '520px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            padding: '12px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary-light)',
            color: 'var(--accent-primary)',
            marginBottom: '16px'
          }}>
            <Database size={32} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '6px' }}>Database Setup Wizard</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Configure your Microsoft SQL Server database connection. Supports Cloud VPS and Local LAN deployments.
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Server size={14} /> SQL Server Host IP / Name
                </span>
              </label>
              <input 
                type="text" 
                className="form-control" 
                value={server} 
                onChange={(e) => setServer(e.target.value)} 
                required 
                placeholder="e.g. 192.168.1.100 or localhost"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Port</label>
              <input 
                type="text" 
                className="form-control" 
                value={port} 
                onChange={(e) => setPort(e.target.value)} 
                required 
                placeholder="e.g. 1433"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Database Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={database} 
              onChange={(e) => setDatabase(e.target.value)} 
              required 
              placeholder="e.g. school_fees_db"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <User size={14} /> Username
                </span>
              </label>
              <input 
                type="text" 
                className="form-control" 
                value={user} 
                onChange={(e) => setUser(e.target.value)} 
                required 
                placeholder="e.g. sa"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={14} /> Password
                </span>
              </label>
              <input 
                type="password" 
                className="form-control" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '6px 0' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={encrypt} 
                onChange={(e) => setEncrypt(e.target.checked)} 
              />
              <span>Use TLS/SSL Encryption</span>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={trustCert} 
                onChange={(e) => setTrustCert(e.target.checked)} 
              />
              <span>Trust Server Certificate (Recommended for LAN/VPN)</span>
            </label>
          </div>

          {message && (
            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              textAlign: 'left',
              border: '1px solid',
              backgroundColor: message.type === 'success' 
                ? 'var(--accent-success-light)' 
                : message.type === 'error' 
                  ? 'var(--accent-danger-light)' 
                  : 'var(--accent-primary-light)',
              borderColor: message.type === 'success' 
                ? 'var(--accent-success)' 
                : message.type === 'error' 
                  ? 'var(--accent-danger)' 
                  : 'var(--accent-primary)',
              color: message.type === 'success' 
                ? 'var(--accent-success-hover)' 
                : message.type === 'error' 
                  ? 'var(--accent-danger)' 
                  : 'var(--accent-primary-hover)'
            }}>
              {message.text}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={testConnection} 
              disabled={testing || saving}
              style={{ display: 'inline-flex', gap: '6px' }}
            >
              <Activity size={16} /> Test Connection
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={saveAndInitialize} 
              disabled={testing || saving}
              style={{ display: 'inline-flex', gap: '6px' }}
            >
              <ShieldCheck size={16} /> Connect & Setup
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
