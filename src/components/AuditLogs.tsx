import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, RefreshCw } from 'lucide-react';

interface AuditLog {
  id: number;
  action: string;
  details: string;
  ip_address: string | null;
  created_at: string;
  username: string | null;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [actionsList, setActionsList] = useState<string[]>([]);
  
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: `
          SELECT a.id, a.action, a.details, a.ip_address, a.created_at, u.username 
          FROM audit_logs a 
          LEFT JOIN users u ON a.user_id = u.id 
          ORDER BY a.created_at DESC
        `
      });

      if (res.success && res.recordset) {
        setLogs(res.recordset);
        
        // Extract unique actions list
        const uniqueActions = Array.from(
          new Set(res.recordset.map((l: AuditLog) => l.action))
        ) as string[];
        setActionsList(uniqueActions);
      }
    } catch (err) {
      console.error('Error loading audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchSearch = 
      (log.username && log.username.toLowerCase().includes(search.toLowerCase())) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase());
    
    const matchAction = actionFilter === 'ALL' || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexGrow: 1, maxWidth: '600px' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search logs by user, action, details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
            <Search 
              size={18} 
              style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-tertiary)' }} 
            />
          </div>
          
          <select
            className="form-control"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="ALL">All Actions</option>
            {actionsList.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>

        <button className="btn btn-secondary" onClick={fetchLogs} style={{ display: 'inline-flex', gap: '6px' }}>
          <RefreshCw size={14} /> Refresh Logs
        </button>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading audit trails...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ShieldAlert size={40} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
            <h3>No Audit Logs Found</h3>
            <p>Try clearing filters or search query.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="custom-table" style={{ fontSize: '0.88rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>Timestamp</th>
                  <th style={{ width: '15%' }}>User</th>
                  <th style={{ width: '20%' }}>Action Type</th>
                  <th style={{ width: '47%' }}>Description Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {new Date(log.created_at).toLocaleString('en-GB')}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{log.username || 'SYSTEM'}</strong>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'monospace'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ lineHeight: 1.4, color: 'var(--text-secondary)' }}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
