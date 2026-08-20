import React from 'react';
import { 
  DollarSign, Users, FileSpreadsheet, Settings, 
  TrendingUp, UploadCloud, ShieldAlert, LogOut, ShieldCheck 
} from 'lucide-react';
import { FloatingBackground } from './FloatingBackground';

interface DashboardProps {
  user: { id: number; username: string; role: string };
  onNavigate: (module: string) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate, onLogout }) => {
  const isSupervisorOrAdmin = user.role === 'SUPERVISOR' || user.role === 'ADMIN';
  const isAdmin = user.role === 'ADMIN';

  const menuItems = [
    {
      id: 'transactions',
      title: 'Post Transactions',
      description: 'Record credit union teller deposits, assign ledger categories, and print A5 operator receipts.',
      icon: DollarSign,
      color: '#00b875',
      bgColor: '#e2f9f0',
      allowed: true
    },
    {
      id: 'students',
      title: 'Student Directory',
      description: 'Search admissions rosters, check ledger balances, and log parents/guardians contacts.',
      icon: Users,
      color: '#2563eb',
      bgColor: '#dbeafe',
      allowed: true
    },
    {
      id: 'reports',
      title: 'Daily Reports',
      description: 'Review collection transactions log and view total daily audit summaries.',
      icon: FileSpreadsheet,
      color: '#10b981',
      bgColor: '#d1fae5',
      allowed: true
    },
    {
      id: 'products',
      title: 'Products Setup',
      description: 'Manage credit union fee parameters, customize payment codes, and adjust limits.',
      icon: Settings,
      color: '#f59e0b',
      bgColor: '#fef3c7',
      allowed: isSupervisorOrAdmin
    },
    {
      id: 'analytics',
      title: 'Analytics Dashboard',
      description: 'Graph payment trends, track collection targets, and monitor teller totals.',
      icon: TrendingUp,
      color: '#8b5cf6',
      bgColor: '#ede9fe',
      allowed: isSupervisorOrAdmin
    },
    {
      id: 'onboarding',
      title: 'Data Onboarding',
      description: 'Import student rosters from Excel templates and map CSV properties.',
      icon: UploadCloud,
      color: '#ec4899',
      bgColor: '#fce7f3',
      allowed: isAdmin
    },
    {
      id: 'audit_logs',
      title: 'System Audit Logs',
      description: 'Monitor operator sign-ins, audit schema updates, and view action logs.',
      icon: ShieldAlert,
      color: '#6b7280',
      bgColor: '#f3f4f6',
      allowed: isAdmin
    },
    {
      id: 'settings',
      title: 'System Settings',
      description: 'Configure local SQL Server connections, teller parameters, and receipt layout brands.',
      icon: ShieldCheck,
      color: '#0d9488',
      bgColor: '#ccfbf1',
      allowed: isSupervisorOrAdmin
    }
  ];

  return (
    <div className="animate-fade-in" style={{ 
      position: 'relative', 
      minHeight: 'calc(100vh - 36px)', 
      width: '100%', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Animated Subtle Background Icons */}
      <FloatingBackground />

      <div style={{ 
        padding: '24px', 
        maxWidth: '1200px', 
        margin: '0 auto', 
        width: '100%', 
        position: 'relative', 
        zIndex: 1, 
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        {/* Header Panel */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div>
            <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.03em' }}>
              Orient Fees Tracker
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', letterSpacing: '-0.01em' }}>
              Welcome back, <strong style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{user.username}</strong> (<span style={{ textTransform: 'lowercase', opacity: 0.8 }}>{user.role}</span>)
            </p>
          </div>

          <button 
            onClick={onLogout} 
            className="btn btn-secondary"
            style={{ display: 'inline-flex', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        {/* Grid Menu */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '18px',
          flexGrow: 1,
          alignContent: 'center'
        }}>
          {menuItems.filter(item => item.allowed).map((item) => {
            const IconComponent = item.icon;
            return (
              <div 
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
                  boxShadow: 'var(--shadow-sm)',
                  padding: '20px',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  zIndex: 2
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.015)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg), var(--shadow-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div style={{
                  display: 'inline-flex',
                  padding: '10px',
                  borderRadius: '12px',
                  backgroundColor: item.bgColor,
                  color: item.color,
                  marginBottom: '12px',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
                }}>
                  <IconComponent size={20} />
                </div>
                
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {item.title}
                </h3>
                
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, letterSpacing: '-0.015em' }}>
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
