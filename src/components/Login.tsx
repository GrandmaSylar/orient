import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { FloatingBackground } from './FloatingBackground';

interface LoginProps {
  onSuccess: (user: { id: number; username: string; role: string }) => void;
  onResetConfig: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, onResetConfig: _onResetConfig }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await window.electronAPI.invoke('auth-login', { username, password });
      if (res.success && res.user) {
        onSuccess(res.user);
      } else {
        setError(res.error || 'Invalid credentials or connection error.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
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
      {/* Animated Subtle Background Icons */}
      <FloatingBackground />



      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '48px 40px',
        borderRadius: '24px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 25px 50px -12px rgba(7, 25, 30, 0.08), 0 8px 24px -8px rgba(7, 25, 30, 0.03)',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }} className="animate-scale-in">
        
        {/* Modern Geometric Logo Block */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <div style={{
            position: 'relative',
            width: '64px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Geometric interlocking rings representing trust & co-operation */}
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="22" cy="30" r="16" stroke="var(--accent-primary)" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="60 10" />
              <circle cx="38" cy="30" r="16" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="50 15" style={{ mixBlendMode: 'multiply' }} />
              <path d="M30 18C32 21 32 26 30 30C28 34 28 39 30 42" stroke="#2563eb" strokeWidth="4.5" strokeLinecap="round" style={{ opacity: 0.15 }} />
            </svg>
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.035em' }}>
            Orient Fees Tracker
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.45, letterSpacing: '-0.01em' }}>
            Enter your teller credentials to access fee collections and management tools.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.72rem', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '0.06em', 
              color: 'var(--text-secondary)', 
              marginBottom: '6px' 
            }}>
              Operator Username
            </label>
            <input 
              type="text" 
              className="form-control" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              placeholder="e.g. teller1"
              autoFocus
              disabled={loading}
              style={{
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid var(--border-color)',
                fontSize: '0.95rem',
                width: '100%',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.72rem', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '0.06em', 
              color: 'var(--text-secondary)', 
              marginBottom: '6px' 
            }}>
              Security Password
            </label>
            <input 
              type="password" 
              className="form-control" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
              disabled={loading}
              style={{
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid var(--border-color)',
                fontSize: '0.95rem',
                width: '100%',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
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
              fontSize: '0.88rem',
              textAlign: 'left',
              lineHeight: 1.4
            }}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
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
              marginTop: '10px',
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
