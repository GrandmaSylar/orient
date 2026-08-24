import React, { useState, useEffect } from 'react';
import { 
  UserPlus, UserCheck, UserX, KeyRound, Wrench
} from 'lucide-react';

interface UserAccount {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface SettingsProps {
  onResetDbConfig: () => void;
  currentUser: { id: number; username: string; role: string };
  showDialog: (
    type: 'success' | 'warning' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onResetDbConfig, currentUser, showDialog }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_success, setSuccess] = useState<string | null>(null);

  // Modal forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('TELLER');
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Org Config settings states
  const [orgName, setOrgName] = useState('GRACE BAPTIST CREDIT UNION');
  const [orgLocation, setOrgLocation] = useState('AMAKOM-KUMASI');
  const [orgPhone, setOrgPhone] = useState('TEL: 0244757447/0207447016');
  const [schoolName, setSchoolName] = useState('Space Academy');
  const [logoUrl, setLogoUrl] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);

  // DB Diagnostics states
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [dbStrength, setDbStrength] = useState<string>('Checking...');
  const [dbLatency, setDbLatency] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchOrgConfig();
    fetchDbDiagnostics();
  }, []);

  const fetchOrgConfig = async () => {
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'SELECT org_name, location, telephone, school_name, logo_url FROM org_config WHERE id = 1'
      });
      if (res.success && res.recordset && res.recordset.length > 0) {
        const c = res.recordset[0];
        setOrgName(c.org_name);
        setOrgLocation(c.location);
        setOrgPhone(c.telephone);
        setSchoolName(c.school_name);
        setLogoUrl(c.logo_url || '');
      }
    } catch (err) {
      console.error('Failed to load org config', err);
    }
  };

  const fetchDbDiagnostics = async () => {
    try {
      const infoRes = await window.electronAPI.invoke('db-get-connection-info');
      if (infoRes.success && infoRes.config) {
        setDbInfo(infoRes.config);
        const testRes = await window.electronAPI.invoke('db-test-connection', infoRes.config);
        if (testRes.success) {
          setDbStrength(testRes.strength || 'Unknown');
          setDbLatency(testRes.latency || 0);
        } else {
          setDbStrength('Connection Unreachable');
          setDbLatency(null);
        }
      } else {
        setDbStrength('Not Configured');
      }
    } catch (err) {
      console.error('Failed to query connection info diagnostics', err);
      setDbStrength('Error checking status');
    }
  };

  const handleSaveOrgConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    showDialog(
      'confirm', 
      'Save Branding Config', 
      'Are you sure you want to update the organization and school branding? This will affect all generated fee receipts.',
      async () => {
        setSavingOrg(true);
        try {
          const res = await window.electronAPI.invoke('db-query', {
            query: `
              UPDATE org_config 
              SET org_name = @name, location = @loc, telephone = @phone, school_name = @school, logo_url = @logo 
              WHERE id = 1
            `,
            params: [
              { name: 'name', value: orgName },
              { name: 'loc', value: orgLocation },
              { name: 'phone', value: orgPhone },
              { name: 'school', value: schoolName },
              { name: 'logo', value: logoUrl || null }
            ]
          });
          if (res.success) {
            showDialog('success', 'Settings Saved', 'Organization profile updated successfully.');
          } else {
            showDialog('error', 'Database Error', res.error || 'Failed to update organization details.');
          }
        } catch (err: any) {
          showDialog('error', 'System Error', err.message || 'Error saving settings.');
        } finally {
          setSavingOrg(false);
        }
      }
    );
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'SELECT id, username, role, is_active, created_at FROM users ORDER BY username ASC'
      });
      if (res.success && res.recordset) {
        setUsers(res.recordset);
      }
    } catch (err) {
      console.error('Error fetching users', err);
    } finally {
      setLoading(false);
    }
  };

  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const passHash = await hashPassword(newPassword);

      const res = await window.electronAPI.invoke('db-query', {
        query: `
          INSERT INTO users (username, password_hash, role, is_active)
          VALUES (@username, @password_hash, @role, 1)
        `,
        params: [
          { name: 'username', value: newUsername.toLowerCase().trim() },
          { name: 'password_hash', value: passHash },
          { name: 'role', value: newRole }
        ]
      });

      if (res.success) {
        await window.electronAPI.invoke('db-query', {
          query: 'INSERT INTO audit_logs (user_id, action, details) VALUES (@user, \'CREATE_USER\', @details)',
          params: [
            { name: 'user', value: currentUser.id },
            { name: 'details', value: `Created user ${newUsername} with role ${newRole}` }
          ]
        });

        setShowAddModal(false);
        setNewUsername('');
        setNewPassword('');
        setNewRole('TELLER');
        fetchUsers();
        showDialog('success', 'User Created', `Account for ${newUsername} has been registered successfully.`);
      } else {
        setError(res.error || 'Failed to create user. Username may already exist.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred saving user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !resetPasswordVal.trim()) return;
    if (selectedUser.role === 'DEV' && currentUser.role !== 'DEV') {
      showDialog('error', 'Action Refused', 'You do not have permission to modify a developer account.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const passHash = await hashPassword(resetPasswordVal);
      const res = await window.electronAPI.invoke('db-query', {
        query: 'UPDATE users SET password_hash = @password_hash WHERE id = @id',
        params: [
          { name: 'id', value: selectedUser.id },
          { name: 'password_hash', value: passHash }
        ]
      });

      if (res.success) {
        await window.electronAPI.invoke('db-query', {
          query: 'INSERT INTO audit_logs (user_id, action, details) VALUES (@user, \'RESET_PASSWORD\', @details)',
          params: [
            { name: 'user', value: currentUser.id },
            { name: 'details', value: `Reset password for user ${selectedUser.username}` }
          ]
        });

        setShowResetModal(false);
        setResetPasswordVal('');
        showDialog('success', 'Password Changed', `Operator ${selectedUser.username} password updated successfully.`);
      } else {
        setError(res.error || 'Failed to reset password.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred resetting password.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: UserAccount) => {
    if (user.role === 'DEV' && currentUser.role !== 'DEV') {
      showDialog('error', 'Action Refused', 'You do not have permission to modify a developer account.');
      return;
    }
    if (user.id === currentUser.id) {
      showDialog('warning', 'Action Refused', 'You cannot deactivate your own logged-in account.');
      return;
    }

    const nextStatus = !user.is_active;
    const confirmMsg = nextStatus
      ? `Are you sure you want to activate the account for ${user.username}?`
      : `Are you sure you want to deactivate the account for ${user.username}? They will no longer be able to log in.`;

    showDialog('confirm', 'Confirm Action', confirmMsg, async () => {
      try {
        const res = await window.electronAPI.invoke('db-query', {
          query: 'UPDATE users SET is_active = @is_active WHERE id = @id',
          params: [
            { name: 'id', value: user.id },
            { name: 'is_active', value: nextStatus }
          ]
        });

        if (res.success) {
          await window.electronAPI.invoke('db-query', {
            query: 'INSERT INTO audit_logs (user_id, action, details) VALUES (@user, \'TOGGLE_USER_STATUS\', @details)',
            params: [
              { name: 'user', value: currentUser.id },
              { name: 'details', value: `Toggled user ${user.username} status to ${nextStatus ? 'Active' : 'Inactive'}` }
            ]
          });

          fetchUsers();
          showDialog('success', 'Status Updated', `Operator status changed successfully.`);
        } else {
          showDialog('error', 'Database Error', res.error || 'Failed to update user status.');
        }
      } catch (err: any) {
        showDialog('error', 'System Error', err.message || 'Error toggling user status.');
      }
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
      <div className="panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>System Operators (Users)</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setError(null); setSuccess(null); setShowAddModal(true); }}>
            <UserPlus size={16} /> Add Operator
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                    <td><strong>{u.username}</strong> {u.id === currentUser.id && <em style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>(You)</em>}</td>
                    <td>{u.role}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '4px',
                        backgroundColor: u.is_active ? 'var(--accent-success-light)' : 'var(--accent-danger-light)',
                        color: u.is_active ? 'var(--accent-success-hover)' : 'var(--accent-danger)'
                      }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {(u.role !== 'DEV' || currentUser.role === 'DEV') && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setError(null); setSuccess(null); setSelectedUser(u); setResetPasswordVal(''); setShowResetModal(true); }}
                            style={{ padding: '4px 6px' }}
                            title="Reset Password"
                          >
                            <KeyRound size={12} />
                          </button>
                        )}
                        {u.id !== currentUser.id && (u.role !== 'DEV' || currentUser.role === 'DEV') && (
                          <button
                            className={`btn ${u.is_active ? 'btn-danger' : 'btn-success'} btn-sm`}
                            onClick={() => toggleUserStatus(u)}
                            style={{ padding: '4px 6px' }}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {u.is_active ? <UserX size={12} /> : <UserCheck size={12} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* ORGANIZATION CONFIGURATION PANEL */}
        {currentUser.role === 'ADMIN' && (
          <div className="panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Organization Branding</h3>
            
            <form onSubmit={handleSaveOrgConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Credit Union / Org Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={orgName} 
                  onChange={(e) => setOrgName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location / Address</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={orgLocation} 
                  onChange={(e) => setOrgLocation(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Telephone Numbers</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={orgPhone} 
                  onChange={(e) => setOrgPhone(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Associated School Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={schoolName} 
                  onChange={(e) => setSchoolName(e.target.value)} 
                  required 
                  placeholder="e.g. Space Academy"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Header Logo Image</label>
                <input 
                  type="file" 
                  accept="image/*"
                  className="form-control" 
                  onChange={handleLogoChange}
                  style={{ padding: '4px' }}
                />
                {logoUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                    <img src={logoUrl} alt="Logo preview" style={{ height: '36px', maxWidth: '100px', objectFit: 'contain' }} />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLogoUrl('')} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>Remove</button>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingOrg} style={{ marginTop: '4px' }}>
                {savingOrg ? 'Saving details...' : 'Save Branding Config'}
              </button>
            </form>
          </div>
        )}

        <div className="panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>System Diagnostics</h3>

          {dbInfo ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '16px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-primary)',
              marginBottom: '16px',
              fontSize: '0.88rem',
              textAlign: 'left'
            }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '4px', color: 'var(--accent-primary)' }}>
                Active Database Connection
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Server Host:</span>
                <strong>{dbInfo.server}:{dbInfo.port || 1433}</strong>
                
                <span style={{ color: 'var(--text-secondary)' }}>Database:</span>
                <strong>{dbInfo.database}</strong>

                <span style={{ color: 'var(--text-secondary)' }}>Username:</span>
                <strong>{dbInfo.user}</strong>
                
                <span style={{ color: 'var(--text-secondary)' }}>Connection Status:</span>
                <span style={{ 
                  color: dbStrength.includes('Excellent') 
                    ? 'var(--accent-success-hover)' 
                    : dbStrength.includes('Good')
                      ? 'var(--accent-primary)' 
                      : 'var(--accent-danger)',
                  fontWeight: 700
                }}>
                  {dbStrength} {dbLatency !== null && `(${dbLatency}ms)`}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)', marginBottom: '16px', fontSize: '0.88rem' }}>
              Retrieving active connection statistics...
            </div>
          )}
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.45 }}>
            If your database server IP address, LAN routing, or credentials change, you can trigger a re-configuration of the main connection pool.
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-primary)'
          }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Wrench size={16} /> Database Connection Wizard
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              This will log you out, tear down current connection pools, and prompt for credentials on next boot.
            </p>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                showDialog('confirm', 'Reset Database?', 'This will close active SQL connections and restart configuration. Continue?', onResetDbConfig);
              }}
              style={{ width: '100%', padding: '8px' }}
            >
              Reset Database Configuration
            </button>
          </div>
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Add Operator User</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
            
            <form onSubmit={handleAddUser} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newUsername} 
                  onChange={(e) => setNewUsername(e.target.value)} 
                  required 
                  placeholder="e.g. cashier1"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Access Level</label>
                <select
                  className="form-control"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  required
                >
                  <option value="TELLER">TELLER (Post deposits, same-day voids, view reports)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Post, void history, view analytics, bulk imports)</option>
                  <option value="ADMIN">ADMIN (Full super-user permissions, settings, audit trails)</option>
                  {currentUser.role === 'DEV' && (
                    <option value="DEV">DEV (Elevated System Developer with unrestricted access)</option>
                  )}
                </select>
              </div>

              {error && (
                <div style={{ padding: '10px', color: 'var(--accent-danger)', backgroundColor: 'var(--accent-danger-light)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Reset Password</h3>
              <button className="btn btn-secondary" onClick={() => setShowResetModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
            
            <form onSubmit={handleResetPassword} style={{ padding: '24px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Type a new password for account operator <strong>{selectedUser.username}</strong>:
              </p>
              
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={resetPasswordVal} 
                  onChange={(e) => setResetPasswordVal(e.target.value)} 
                  required 
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div style={{ padding: '10px', color: 'var(--accent-danger)', backgroundColor: 'var(--accent-danger-light)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !resetPasswordVal.trim()}>
                  {submitting ? 'Resetting...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
