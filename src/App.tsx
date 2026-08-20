import { useState, useEffect } from 'react';
import { DbWizard } from './components/DbWizard';
import { Login } from './components/Login';
import { Activation } from './components/Activation';
import { UpdaterModal } from './components/UpdaterModal';
import { Dashboard } from './components/Dashboard';
import { StudentManager } from './components/StudentManager';
import { ProductSetup } from './components/ProductSetup';
import { Transactions } from './components/Transactions';
import { Reports } from './components/Reports';
import { Onboarding } from './components/Onboarding';
import { AuditLogs } from './components/AuditLogs';
import { Settings } from './components/Settings';
import { CustomDialog } from './components/CustomDialog';
import { 
  ShieldAlert, Landmark, 
  ShieldCheck, Wrench, LayoutDashboard, DollarSign, 
  Users, FileSpreadsheet, Settings as SettingsIcon, TrendingUp, UploadCloud, Box 
} from 'lucide-react';

type AppState = 'CONNECTING' | 'SETUP_WIZARD' | 'LICENSE_REQUIRED' | 'LOGIN' | 'DASHBOARD' | 'MODULE';

interface UserSession {
  id: number;
  username: string;
  role: string;
}

function App() {
  const [appState, setAppState] = useState<AppState>('CONNECTING');
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  
  // Splash Screen States
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFadeOut, setSplashFadeOut] = useState(false);

  const getTitleBarContent = () => {
    if (appState === 'LOGIN') {
      return {
        icon: <ShieldCheck size={14} style={{ color: 'var(--accent-primary)', display: 'inline-block' }} />,
        text: 'Orient Fees Tracker - Sign In'
      };
    }
    if (appState === 'LICENSE_REQUIRED') {
      return {
        icon: <ShieldAlert size={14} style={{ color: 'var(--accent-warning)', display: 'inline-block' }} />,
        text: 'Product Activation Required'
      };
    }
    if (appState === 'SETUP_WIZARD') {
      return {
        icon: <Wrench size={14} style={{ color: 'var(--accent-primary)', display: 'inline-block' }} />,
        text: 'System Setup Wizard'
      };
    }
    if (appState === 'DASHBOARD') {
      return {
        icon: <LayoutDashboard size={14} style={{ color: 'var(--accent-primary)', display: 'inline-block' }} />,
        text: 'Console Dashboard'
      };
    }
    if (appState === 'MODULE' && activeModule) {
      const moduleMeta: { [key: string]: { text: string; icon: any } } = {
        transactions: { text: 'Post Deposits', icon: <DollarSign size={14} style={{ color: 'var(--accent-primary)' }} /> },
        students: { text: 'Student Directory', icon: <Users size={14} style={{ color: 'var(--accent-primary)' }} /> },
        reports: { text: 'Daily Ledger Reports', icon: <FileSpreadsheet size={14} style={{ color: 'var(--accent-primary)' }} /> },
        products: { text: 'Products Setup', icon: <SettingsIcon size={14} style={{ color: 'var(--accent-primary)' }} /> },
        analytics: { text: 'Analytics Dashboard', icon: <TrendingUp size={14} style={{ color: 'var(--accent-primary)' }} /> },
        onboarding: { text: 'Data Onboarding', icon: <UploadCloud size={14} style={{ color: 'var(--accent-primary)' }} /> },
        audit_logs: { text: 'System Audit Logs', icon: <ShieldAlert size={14} style={{ color: 'var(--accent-primary)' }} /> },
        settings: { text: 'System Settings', icon: <ShieldCheck size={14} style={{ color: 'var(--accent-primary)' }} /> }
      };
      const meta = moduleMeta[activeModule] || { text: 'Module View', icon: <Box size={14} style={{ color: 'var(--accent-primary)' }} /> };
      return {
        icon: meta.icon,
        text: `Orient Fees Tracker > ${meta.text}`
      };
    }
    return {
      icon: <Landmark size={14} style={{ color: 'var(--accent-primary)', display: 'inline-block' }} />,
      text: 'Orient Fees Tracker'
    };
  };

  // Global custom dialog state
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: 'success' | 'warning' | 'error' | 'confirm';
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showDialog = (
    type: 'success' | 'warning' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    setDialog({
      isOpen: true,
      type,
      title,
      message,
      onConfirm: () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm();
      },
      onCancel: onCancel ? () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        onCancel();
      } : (type === 'confirm' ? () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
      } : undefined)
    });
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const licCheck = await window.electronAPI.invoke('lic-check-active');
      const configExists = await window.electronAPI.invoke('db-check-config');
      
      setTimeout(() => {
        setSplashFadeOut(true);
        setTimeout(() => {
          setSplashVisible(false);
          if (!licCheck.active) {
            setAppState('LICENSE_REQUIRED');
          } else if (configExists) {
            setAppState('LOGIN');
          } else {
            setAppState('SETUP_WIZARD');
          }
        }, 600);
      }, 2200);
    } catch (err: any) {
      console.error('Check configuration/license failed', err);
      setSplashFadeOut(true);
      setTimeout(() => {
        setSplashVisible(false);
        setAppState('LICENSE_REQUIRED');
      }, 600);
    }
  };

  const handleActivationSuccess = async () => {
    showDialog('success', 'License Activated', 'Workstation licensed successfully.');
    const configExists = await window.electronAPI.invoke('db-check-config');
    if (configExists) {
      setAppState('LOGIN');
    } else {
      setAppState('SETUP_WIZARD');
    }
  };

  const handleDbWizardSuccess = () => {
    showDialog('success', 'Database Initialized', 'Connection established and tables verified.');
    setAppState('LOGIN');
  };

  const handleLoginSuccess = (loggedInUser: UserSession) => {
    setUser(loggedInUser);
    setAppState('DASHBOARD');
  };

  const handleLogout = () => {
    showDialog(
      'confirm',
      'Sign Out',
      'Are you sure you want to sign out of your operator session?',
      () => {
        setUser(null);
        setAppState('LOGIN');
      }
    );
  };

  const handleResetConfig = async () => {
    setAppState('SETUP_WIZARD');
  };

  const handleNavigate = (module: string) => {
    setActiveModule(module);
    setAppState('MODULE');
  };

  const handleBackToDashboard = () => {
    setActiveModule(null);
    setAppState('DASHBOARD');
  };

  const handleExitApp = () => {
    showDialog(
      'confirm',
      'Exit Application',
      'Are you sure you want to exit Orient Fees Tracker?',
      () => {
        window.electronAPI.invoke('win-close');
      }
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. Custom Frameless Title Bar */}
      <div className="app-title-bar no-print">
        <div className="app-title-logo">
          {getTitleBarContent().icon}
          <span>{getTitleBarContent().text}</span>
        </div>
        <div className="app-control-box">
          <button className="app-control-dot minimize" title="Minimize" onClick={() => window.electronAPI.invoke('win-minimize')} />
          <button className="app-control-dot maximize" title="Maximize" onClick={() => window.electronAPI.invoke('win-maximize')} />
          <button className="app-control-dot close" title="Close" onClick={handleExitApp} />
        </div>
      </div>

      {/* 2. Global Custom Dialog Render */}
      <CustomDialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />

      {/* 3. Subtle & Calm Splash Screen Overlay */}
      {splashVisible && (
        <div style={{
          position: 'fixed',
          top: '30px', // sit nicely under the title bar
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--bg-primary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          opacity: splashFadeOut ? 0 : 1,
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: splashFadeOut ? 'none' : 'auto'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: splashFadeOut ? 'scale(0.88)' : 'scale(1)',
            transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* The brand rings icon (aligns dynamically to Login page logo layout) */}
            <div style={{
              position: 'relative',
              width: '96px',
              height: '96px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              animation: 'pulseLogo 2.5s ease-in-out infinite'
            }}>
              <svg width="80" height="80" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="22" cy="30" r="16" stroke="var(--accent-primary)" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="60 10" />
                <circle cx="38" cy="30" r="16" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="50 15" style={{ mixBlendMode: 'multiply' }} />
                <path d="M30 18C32 21 32 26 30 30C28 34 28 39 30 42" stroke="var(--accent-primary)" strokeWidth="4.5" strokeLinecap="round" style={{ opacity: 0.15 }} />
              </svg>
            </div>
            
            <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.035em' }}>
              Orient Fees Tracker
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', letterSpacing: '-0.01em' }}>
              Securing ledger nodes and connections...
            </p>
          </div>

          <style>{`
            @keyframes pulseLogo {
              0% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(0,0,0,0)); }
              50% { transform: scale(1.04); filter: drop-shadow(0 4px 20px rgba(0, 184, 117, 0.25)); }
              100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(0,0,0,0)); }
            }
          `}</style>
        </div>
      )}

      {/* Main app flow views */}
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {appState === 'CONNECTING' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            gap: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border-color)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ color: 'var(--text-secondary)' }}>Checking database configuration...</p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {appState === 'SETUP_WIZARD' && (
          <DbWizard onSuccess={handleDbWizardSuccess} />
        )}

        {appState === 'LICENSE_REQUIRED' && (
          <Activation onSuccess={handleActivationSuccess} />
        )}

        {appState === 'LOGIN' && (
          <Login onSuccess={handleLoginSuccess} onResetConfig={handleResetConfig} />
        )}

        {appState === 'DASHBOARD' && user && (
          <Dashboard user={user} onNavigate={handleNavigate} onLogout={handleLogout} />
        )}

        {appState === 'MODULE' && user && activeModule && (
          <div className="animate-fade-in" style={{ padding: '30px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>
                  {activeModule.charAt(0).toUpperCase() + activeModule.slice(1).replace('_', ' ')}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Credit Union Fees Console &gt; {activeModule}
                </p>
              </div>
              <button className="btn btn-secondary" onClick={handleBackToDashboard}>
                Back to Home
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              {activeModule === 'transactions' && <Transactions user={user} showDialog={showDialog} />}
              {activeModule === 'students' && <StudentManager showDialog={showDialog} />}
              {activeModule === 'products' && <ProductSetup showDialog={showDialog} />}
              {activeModule === 'reports' && <Reports showDialog={showDialog} />}
              {activeModule === 'onboarding' && <Onboarding user={user} showDialog={showDialog} />}
              {activeModule === 'audit_logs' && <AuditLogs />}
              {activeModule === 'settings' && <Settings currentUser={user} onResetDbConfig={handleResetConfig} showDialog={showDialog} />}
              {activeModule !== 'transactions' && activeModule !== 'students' && activeModule !== 'products' && activeModule !== 'reports' && activeModule !== 'onboarding' && activeModule !== 'audit_logs' && activeModule !== 'settings' && (
                <div className="panel" style={{ textAlign: 'center', padding: '60px 24px' }}>
                  <ShieldAlert size={48} style={{ color: 'var(--accent-warning)', marginBottom: '16px' }} />
                  <h3 style={{ marginBottom: '8px' }}>Module Under Construction</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
                    The dynamic database backend queries and layouts for the <strong>{activeModule}</strong> component are currently being coded.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Global Updater Modal checking Releases */}
      <UpdaterModal />
    </div>
  );
}

export default App;
