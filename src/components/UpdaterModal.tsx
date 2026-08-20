import React, { useState, useEffect } from 'react';
import { ArrowUpCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const UpdaterModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'available' | 'downloading' | 'downloaded' | 'error'>('available');
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Listen for updates from Main IPC
    const removeListener = window.electronAPI.on('updater-message', (data: any) => {
      console.log('Updater message received:', data);

      if (data.status === 'available') {
        setVersion(data.version || '');
        setChangelog(data.releaseNotes || 'Security enhancements and bug fixes.');
        setStatus('available');
        setVisible(true);
      } else if (data.status === 'downloading') {
        setStatus('downloading');
        setProgress(data.progressPercent || 0);
      } else if (data.status === 'downloaded') {
        setStatus('downloaded');
      } else if (data.status === 'error') {
        setStatus('error');
        setErrorMsg(data.text || 'Failed to download update.');
        setTimeout(() => setVisible(false), 5000); // Hide after error
      }
    });

    return () => {
      removeListener();
    };
  }, []);

  const handleStartDownload = async () => {
    setStatus('downloading');
    setProgress(0);
    try {
      const res = await window.electronAPI.invoke('upd-download');
      if (!res.success) {
        setStatus('error');
        setErrorMsg(res.error || 'Failed to initialize download.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Network timeout.');
    }
  };

  const handleInstallNow = () => {
    window.electronAPI.invoke('upd-install');
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(7, 25, 30, 0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10400,
      padding: '24px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        padding: '36px',
        width: '100%',
        maxWidth: '460px',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.15)',
        textAlign: 'center',
        position: 'relative'
      }} className="animate-scale-in">
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          {status === 'error' ? (
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'var(--accent-danger-light)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--accent-danger)' }}>
              <ShieldAlert size={28} />
            </div>
          ) : status === 'downloaded' ? (
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'var(--accent-success-light)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--accent-success-hover)' }}>
              <CheckCircle2 size={28} />
            </div>
          ) : (
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'var(--accent-primary-light)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
              <ArrowUpCircle size={28} />
            </div>
          )}
        </div>

        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '8px' }}>
          {status === 'available' && `New Update v${version} Available`}
          {status === 'downloading' && 'Downloading System Update...'}
          {status === 'downloaded' && 'System Update Ready'}
          {status === 'error' && 'Update Failed'}
        </h3>

        {status === 'available' && (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.45, marginBottom: '20px' }}>
              A new version of Orient Fees Tracker is ready. Please download and install now to access new features.
            </p>
            
            <div style={{
              textAlign: 'left',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '28px',
              maxHeight: '140px',
              overflowY: 'auto'
            }}>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Summary of Changes:
              </h4>
              <div 
                style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: changelog }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setVisible(false)}
                style={{ flex: 1, padding: '12px' }}
              >
                Later
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleStartDownload}
                style={{ flex: 2, padding: '12px' }}
              >
                Download & Install Now
              </button>
            </div>
          </>
        )}

        {status === 'downloading' && (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '24px' }}>
              Fetching update blocks from server. Do not shut down the application.
            </p>

            <div style={{ marginBottom: '12px' }}>
              <div style={{
                height: '8px',
                width: '100%',
                backgroundColor: 'var(--border-color)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: 'var(--accent-primary)',
                  borderRadius: '4px',
                  transition: 'width 0.2s ease'
                }} />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              <span>Downloading files...</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </>
        )}

        {status === 'downloaded' && (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.45, marginBottom: '28px' }}>
              The update files have been successfully verified. The application will close, apply changes, and relaunch.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={handleInstallNow}
              style={{ width: '100%', padding: '12px' }}
            >
              Restart & Install Update
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <p style={{ color: 'var(--accent-danger)', fontSize: '0.88rem', lineHeight: 1.45, marginBottom: '8px' }}>
              {errorMsg}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              The updater will retry during the next application launch.
            </p>
          </>
        )}

      </div>
    </div>
  );
};
