import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, Calendar, Plus, CheckCircle, AlertTriangle, Info 
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Term {
  id: number;
  academic_year: string;
  term_name: string;
  is_active: boolean;
}

interface OnboardingProps {
  user: { id: number; username: string; role: string };
  showDialog: (
    type: 'success' | 'warning' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ user, showDialog }) => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [activeTerm, setActiveTerm] = useState<Term | null>(null);
  const [termLoading, setTermLoading] = useState(false);

  // New Term Form
  const [newYear, setNewYear] = useState('');
  const [newName, setNewName] = useState('');
  const [termError, setTermError] = useState<string | null>(null);

  // Bulk Import State
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [deactivateLeavers, setDeactivateLeavers] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Pre-requisite school name configuration state
  const [schoolName, setSchoolName] = useState('Space Academy');
  const [savingSchoolName, setSavingSchoolName] = useState(false);

  useEffect(() => {
    fetchTerms();
    fetchSchoolName();
  }, []);

  const fetchSchoolName = async () => {
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'SELECT school_name FROM org_config WHERE id = 1'
      });
      if (res.success && res.recordset && res.recordset.length > 0) {
        setSchoolName(res.recordset[0].school_name);
      }
    } catch (err) {
      console.error('Failed to load pre-requisite school name', err);
    }
  };

  const handleSaveSchoolName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchoolName(true);
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'UPDATE org_config SET school_name = @school WHERE id = 1',
        params: [{ name: 'school', value: schoolName }]
      });
      if (res.success) {
        showDialog('success', 'Pre-requisite Setup Saved', `School Name locked to "${schoolName}". This will appear on all student fee receipts.`);
      } else {
        showDialog('error', 'Database Error', res.error || 'Failed to update school name.');
      }
    } catch (err: any) {
      showDialog('error', 'System Error', err.message || 'Error occurred.');
    } finally {
      setSavingSchoolName(false);
    }
  };

  const fetchTerms = async () => {
    setTermLoading(true);
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'SELECT id, academic_year, term_name, is_active FROM academic_terms ORDER BY created_at DESC'
      });
      if (res.success && res.recordset) {
        setTerms(res.recordset);
        const active = res.recordset.find((t: Term) => t.is_active);
        setActiveTerm(active || null);
      }
    } catch (err) {
      console.error('Error fetching terms', err);
    } finally {
      setTermLoading(false);
    }
  };

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    setTermError(null);

    if (!newYear.trim() || !newName.trim()) return;

    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: `
          INSERT INTO academic_terms (academic_year, term_name, is_active)
          VALUES (@year, @name, 0)
        `,
        params: [
          { name: 'year', value: newYear },
          { name: 'name', value: newName }
        ]
      });

      if (res.success) {
        setNewYear('');
        setNewName('');
        fetchTerms();
        showDialog('success', 'Term Created', `Term ${newName} added successfully.`);
      } else {
        setTermError(res.error || 'Failed to create academic term.');
      }
    } catch (err: any) {
      setTermError(err.message || 'Error occurred saving term.');
    }
  };

  const handleSetActiveTerm = async (id: number) => {
    const confirmMsg = 'Are you sure you want to change the active term? All future transactions will snapshot this new term.';
    
    showDialog('confirm', 'Change Active Term?', confirmMsg, async () => {
      try {
        await window.electronAPI.invoke('db-query', {
          query: 'UPDATE academic_terms SET is_active = 0'
        });

        const res = await window.electronAPI.invoke('db-query', {
          query: 'UPDATE academic_terms SET is_active = 1 WHERE id = @id',
          params: [{ name: 'id', value: id }]
        });

        if (res.success) {
          const target = terms.find(t => t.id === id);
          await window.electronAPI.invoke('db-query', {
            query: 'INSERT INTO audit_logs (user_id, action, details) VALUES (@user, \'ACTIVATE_TERM\', @details)',
            params: [
              { name: 'user', value: user.id },
              { name: 'details', value: `Activated term: ${target?.term_name} (${target?.academic_year})` }
            ]
          });

          fetchTerms();
          showDialog('success', 'Term Activated', 'Active academic term has been updated.');
        } else {
          showDialog('error', 'Database Error', res.error || 'Failed to change active term.');
        }
      } catch (err: any) {
        showDialog('error', 'System Error', err.message || 'Error setting active term.');
      }
    });
  };

  // Robust SheetJS Excel and CSV parser supporting flexible header mappings
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setCsvPreview([]);
    setParsedData([]);
    setImportError(null);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

        if (jsonData.length === 0) {
          setImportError('Excel sheet is empty.');
          return;
        }

        // Map flexible headers (case-insensitive, strips spaces, hyphens and underscores)
        const parsed = jsonData.map((row: any) => {
          const getVal = (possibleKeys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              possibleKeys.includes(k.toLowerCase().trim().replace(/[\s_-]/g, ''))
            );
            return foundKey ? String(row[foundKey]).trim() : '';
          };

          const studentId = getVal(['studentnumber', 'studentid', 'studentno', 'id', 'admissionno']);
          const fullName = getVal(['studentname', 'fullname', 'name']);
          const gradeClass = getVal(['class', 'grade', 'gradeclass']);
          const guardianPhone = getVal(['contact', 'phone', 'guardianphone', 'guardianno', 'phone_no']);
          const dobVal = getVal(['dateofbirth', 'dob', 'birthdate']);
          const dob = dobVal ? dobVal : null;

          return {
            student_id: studentId,
            full_name: fullName,
            dob: dob,
            grade_class: gradeClass,
            guardian_phone: guardianPhone
          };
        }).filter(s => s.student_id && s.full_name); // Filter out rows missing core info

        if (parsed.length === 0) {
          setImportError('Could not extract any valid student records. Ensure the Excel file columns include "StudentNumber", "StudentName", "Class", and "Contact".');
          return;
        }

        setParsedData(parsed);
        setCsvPreview(parsed.slice(0, 5));
      } catch (err: any) {
        setImportError(err.message || 'Failed to read Excel file structure.');
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleUploadImport = async () => {
    if (parsedData.length === 0) return;

    showDialog(
      'confirm',
      'Confirm Bulk Import',
      `Are you sure you want to write these ${parsedData.length} records to the database?`,
      async () => {
        setImportLoading(true);
        setImportError(null);
        setImportStatus(null);

        try {
          const res = await window.electronAPI.invoke('db-bulk-import-students', {
            studentsList: parsedData,
            deactivateLeavers,
            creatorId: user.id
          });

          if (res.success) {
            await window.electronAPI.invoke('db-query', {
              query: 'INSERT INTO audit_logs (user_id, action, details) VALUES (@user, \'BULK_IMPORT_STUDENTS\', @details)',
              params: [
                { name: 'user', value: user.id },
                { name: 'details', value: `Bulk imported ${parsedData.length} students. Added: ${res.added}, Updated: ${res.updated}, Leavers Deactivated: ${res.deactivated}` }
              ]
            });

            const successMsg = `Import succeeded! Added: ${res.added}, Updated: ${res.updated}, Inactive leavers: ${res.deactivated}`;
            setImportStatus(successMsg);
            showDialog('success', 'Import Succeeded', successMsg);
            setFile(null);
            setCsvPreview([]);
            setParsedData([]);
          } else {
            setImportError(res.error || 'Failed to complete transaction.');
          }
        } catch (err: any) {
          setImportError(err.message || 'Error occurred uploading data.');
        } finally {
          setImportLoading(false);
        }
      }
    );
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'start' }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* PRE-REQUISITE CONFIGURATION */}
        <div className="panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
             Pre-requisite Setup
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px', lineHeight: 1.45 }}>
            Define the general school profile to append to all transaction lists and receipts (defaults to <strong>Space Academy</strong>).
          </p>
          <form onSubmit={handleSaveSchoolName} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>School Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={schoolName} 
                onChange={(e) => setSchoolName(e.target.value)} 
                required 
                placeholder="e.g. Space Academy"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingSchoolName} style={{ padding: '8px' }}>
              {savingSchoolName ? 'Saving...' : 'Lock School Profile'}
            </button>
          </form>
        </div>

        <div className="panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Calendar size={18} /> Active Academic Term
          </h3>
          {activeTerm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                {activeTerm.term_name}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Academic Year: <strong>{activeTerm.academic_year}</strong>
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--accent-danger)', fontWeight: 650 }}>No term is set as active. Tellers cannot post receipts!</p>
          )}
        </div>

        <div className="panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Academic Terms List</h3>
          
          {termLoading ? (
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', maxHeight: '200px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Academic Year</th>
                    <th>Term Name</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.academic_year}</strong></td>
                      <td>{t.term_name}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          borderRadius: '4px',
                          backgroundColor: t.is_active ? 'var(--accent-success-light)' : 'var(--bg-tertiary)',
                          color: t.is_active ? 'var(--accent-success-hover)' : 'var(--text-secondary)'
                        }}>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!t.is_active && (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSetActiveTerm(t.id)}
                            style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={handleCreateTerm} style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              className="form-control" 
              value={newYear} 
              onChange={(e) => setNewYear(e.target.value)} 
              required 
              placeholder="e.g. 2026/2027"
              style={{ flexGrow: 1, minWidth: '100px', padding: '8px' }}
            />
            <input 
              type="text" 
              className="form-control" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              required 
              placeholder="e.g. Term 1"
              style={{ flexGrow: 1, minWidth: '100px', padding: '8px' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px' }}>
              <Plus size={16} /> Add Term
            </button>
          </form>
          {termError && (
            <p style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', marginTop: '6px' }}>{termError}</p>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <UploadCloud size={20} /> Bulk Onboard Students
        </h3>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.45 }}>
          Upload a comma-separated CSV or Excel spreadsheet (<code>.xlsx</code> / <code>.xls</code>) to perform student promotions and new admissions.
          Expected columns include: <strong>StudentNumber</strong>, <strong>StudentName</strong>, <strong>Class</strong>, and <strong>Contact</strong>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            border: '2px dashed var(--border-color)',
            padding: '24px',
            textAlign: 'center',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-primary)'
          }}>
            <input 
              type="file" 
              accept=".csv,.xlsx,.xls" 
              id="csvFileInput" 
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="csvFileInput" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={32} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontWeight: 650 }}>{file ? file.name : 'Select Student Spreadsheet'}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Supports .csv, .xlsx, .xls</span>
            </label>
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer', margin: '4px 0' }}>
            <input 
              type="checkbox" 
              checked={deactivateLeavers} 
              onChange={(e) => setDeactivateLeavers(e.target.checked)} 
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong>Deactivate Leavers</strong> (Soft-deactivate students missing from this list)
            </span>
          </label>

          {importError && (
            <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-danger-light)', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', display: 'flex', gap: '8px', fontSize: '0.9rem' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{importError}</span>
            </div>
          )}

          {importStatus && (
            <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-success-light)', border: '1px solid var(--accent-success)', color: 'var(--accent-success-hover)', display: 'flex', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle size={18} style={{ flexShrink: 0 }} />
              <span>{importStatus}</span>
            </div>
          )}

          {csvPreview.length > 0 && (
            <div className="animate-scale-in" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', textAlign: 'left' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                <Info size={14} /> Import Preview (First {csvPreview.length} rows of {parsedData.length})
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                {csvPreview.map((row, idx) => (
                  <div key={idx} style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9' }}>
                    [{row.student_id}] {row.full_name} | Class: {row.grade_class} | Phone: {row.guardian_phone}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            disabled={parsedData.length === 0 || importLoading}
            onClick={handleUploadImport}
            style={{ padding: '12px' }}
          >
            {importLoading ? 'Processing database transactions...' : `Commit ${parsedData.length} Records to Database`}
          </button>
        </div>
      </div>
    </div>
  );
};
