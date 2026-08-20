import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit2, UserX, UserCheck, Calendar, Phone, 
  User, BookOpen, AlertCircle, History
} from 'lucide-react';

interface Student {
  id: number;
  student_id: string;
  full_name: string;
  dob: string; // ISO date string or formatted date
  grade_class: string;
  guardian_phone: string;
  is_active: boolean;
}

interface StudentTx {
  id: number;
  receipt_number: string;
  amount: number;
  paid_by: string;
  created_at: string;
  product_name: string;
  term_name: string;
  academic_year: string;
}

interface StudentManagerProps {
  showDialog: (
    type: 'success' | 'warning' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => void;
}

export const StudentManager: React.FC<StudentManagerProps> = ({ showDialog }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Selected student for edit/profile
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudentTxs, setSelectedStudentTxs] = useState<StudentTx[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // Form states
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gradeClass, setGradeClass] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'SELECT id, student_id, full_name, dob, grade_class, guardian_phone, is_active FROM students ORDER BY full_name ASC'
      });
      
      if (res.success && res.recordset) {
        const formatted = res.recordset.map((s: any) => ({
          ...s,
          dob: s.dob ? new Date(s.dob).toISOString().split('T')[0] : ''
        }));
        setStudents(formatted);
        
        const uniqueClasses: string[] = Array.from(
          new Set(formatted.map((s: Student) => s.grade_class.toUpperCase()))
        ).sort() as string[];
        setClasses(uniqueClasses);
      } else {
        setError(res.error || 'Failed to query student database.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred fetching students.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setStudentId('');
    setFullName('');
    setDob('');
    setGradeClass('');
    setGuardianPhone('');
    setError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (student: Student) => {
    setSelectedStudent(student);
    setStudentId(student.student_id);
    setFullName(student.full_name);
    setDob(student.dob);
    setGradeClass(student.grade_class);
    setGuardianPhone(student.guardian_phone);
    setError(null);
    setShowEditModal(true);
  };

  const handleOpenProfile = async (student: Student) => {
    setSelectedStudent(student);
    setShowProfileModal(true);
    setTxLoading(true);
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: `
          SELECT t.id, t.receipt_number, t.amount, t.paid_by, t.created_at, 
                 p.name as product_name, term.term_name, term.academic_year 
          FROM transactions t 
          JOIN products p ON t.product_id = p.id 
          JOIN academic_terms term ON t.term_id = term.id 
          WHERE t.student_id = @student_id AND t.status = 'POSTED'
          ORDER BY t.created_at DESC
        `,
        params: [{ name: 'student_id', value: student.id }]
      });
      if (res.success && res.recordset) {
        setSelectedStudentTxs(res.recordset);
      }
    } catch (err) {
      console.error('Error fetching student transactions', err);
    } finally {
      setTxLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: `
          INSERT INTO students (student_id, full_name, dob, grade_class, guardian_phone, is_active)
          VALUES (@student_id, @full_name, @dob, @grade_class, @guardian_phone, 1)
        `,
        params: [
          { name: 'student_id', value: studentId },
          { name: 'full_name', value: fullName },
          { name: 'dob', value: dob || null },
          { name: 'grade_class', value: gradeClass.toUpperCase() },
          { name: 'guardian_phone', value: guardianPhone }
        ]
      });

      if (res.success) {
        setShowAddModal(false);
        fetchStudents();
        showDialog('success', 'Student Created', `Account for ${fullName} registered successfully.`);
      } else {
        setError(res.error || 'Failed to create student.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred adding student.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: `
          UPDATE students 
          SET student_id = @student_id, full_name = @full_name, dob = @dob, 
              grade_class = @grade_class, guardian_phone = @guardian_phone
          WHERE id = @id
        `,
        params: [
          { name: 'id', value: selectedStudent.id },
          { name: 'student_id', value: studentId },
          { name: 'full_name', value: fullName },
          { name: 'dob', value: dob || null },
          { name: 'grade_class', value: gradeClass.toUpperCase() },
          { name: 'guardian_phone', value: guardianPhone }
        ]
      });

      if (res.success) {
        setShowEditModal(false);
        fetchStudents();
        showDialog('success', 'Details Saved', `Record for ${fullName} updated successfully.`);
      } else {
        setError(res.error || 'Failed to update student details.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred updating student.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStudentStatus = async (student: Student) => {
    const nextStatus = !student.is_active;
    const confirmMsg = nextStatus
      ? `Are you sure you want to activate ${student.full_name}?`
      : `Are you sure you want to deactivate ${student.full_name}? Deactivated students cannot make payments.`;

    showDialog('confirm', 'Confirm Action', confirmMsg, async () => {
      try {
        const res = await window.electronAPI.invoke('db-query', {
          query: 'UPDATE students SET is_active = @is_active WHERE id = @id',
          params: [
            { name: 'id', value: student.id },
            { name: 'is_active', value: nextStatus }
          ]
        });

        if (res.success) {
          fetchStudents();
          showDialog('success', 'Status Updated', `${student.full_name} status updated successfully.`);
        } else {
          showDialog('error', 'Database Error', res.error || 'Failed to update student status.');
        }
      } catch (err: any) {
        showDialog('error', 'System Error', err.message || 'Error occurred toggling student status.');
      }
    });
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = 
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === 'ALL' || s.grade_class.toUpperCase() === filterClass;
    return matchSearch && matchClass;
  });

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Controls Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: '12px', flexGrow: 1, maxWidth: '600px' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by Name or Student ID..."
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
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="ALL">All Classes</option>
            {classes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={18} /> Add Student
        </button>
      </div>

      {/* Main Table Panel */}
      <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <AlertCircle size={40} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
            <h3>No Students Found</h3>
            <p>Try resetting filters or add a new student using the button above.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Full Name</th>
                  <th>Class / Grade</th>
                  <th>D.O.B</th>
                  <th>Guardian Phone</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} style={{ opacity: student.is_active ? 1 : 0.6 }}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{student.student_id}</strong>
                    </td>
                    <td>
                      <span 
                        onClick={() => handleOpenProfile(student)}
                        style={{ cursor: 'pointer', fontWeight: 650, color: 'var(--accent-primary)', textDecoration: 'underline' }}
                      >
                        {student.full_name}
                      </span>
                    </td>
                    <td>{student.grade_class}</td>
                    <td>{student.dob}</td>
                    <td>{student.guardian_phone}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: '4px',
                        backgroundColor: student.is_active ? 'var(--accent-success-light)' : 'var(--accent-danger-light)',
                        color: student.is_active ? 'var(--accent-success-hover)' : 'var(--accent-danger)'
                      }}>
                        {student.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(student)}
                          style={{ padding: '6px 8px' }}
                          title="Edit Student"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className={`btn ${student.is_active ? 'btn-danger' : 'btn-success'} btn-sm`}
                          onClick={() => toggleStudentStatus(student)}
                          style={{ padding: '6px 8px' }}
                          title={student.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {student.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Add Individual Student</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
            
            <form onSubmit={handleAddStudent} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">Student ID (Admission No)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={studentId} 
                  onChange={(e) => setStudentId(e.target.value)} 
                  required 
                  placeholder="e.g. STU1004"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  required 
                  placeholder="e.g. John Kojo Smith"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={dob} 
                    onChange={(e) => setDob(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Class / Grade</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={gradeClass} 
                    onChange={(e) => setGradeClass(e.target.value)} 
                    required 
                    placeholder="e.g. JH1A"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Guardian Phone Number</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={guardianPhone} 
                  onChange={(e) => setGuardianPhone(e.target.value)} 
                  required 
                  placeholder="e.g. +233 24 000 0000"
                />
              </div>

              {error && (
                <div style={{ padding: '10px', color: 'var(--accent-danger)', backgroundColor: 'var(--accent-danger-light)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Edit Student Details</h3>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
            
            <form onSubmit={handleEditStudent} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">Student ID (Admission No)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={studentId} 
                  onChange={(e) => setStudentId(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={dob} 
                    onChange={(e) => setDob(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Class / Grade</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={gradeClass} 
                    onChange={(e) => setGradeClass(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Guardian Phone Number</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={guardianPhone} 
                  onChange={(e) => setGuardianPhone(e.target.value)} 
                  required 
                />
              </div>

              {error && (
                <div style={{ padding: '10px', color: 'var(--accent-danger)', backgroundColor: 'var(--accent-danger-light)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROFILE DETAIL MODAL */}
      {showProfileModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '650px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={20} /> Student Profile
              </h3>
              <button className="btn btn-secondary" onClick={() => setShowProfileModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 650, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Student Name</p>
                  <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedStudent.full_name}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 650, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Admission Number</p>
                  <p style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'monospace' }}>{selectedStudent.student_id}</p>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <p style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                    <BookOpen size={14} /> Class: <strong>{selectedStudent.grade_class}</strong>
                  </p>
                  <p style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <Calendar size={14} /> D.O.B: <strong>{selectedStudent.dob}</strong>
                  </p>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <p style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                    <Phone size={14} /> Guardian: <strong>{selectedStudent.guardian_phone}</strong>
                  </p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <History size={16} /> Payment History (Deposits)
                </h4>
                
                {txLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="skeleton" style={{ height: '30px', width: '100%' }} />
                    <div className="skeleton" style={{ height: '30px', width: '100%' }} />
                    <div className="skeleton" style={{ height: '30px', width: '100%' }} />
                  </div>
                ) : selectedStudentTxs.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No deposits have been made for this student yet.</p>
                  </div>
                ) : (
                  <div className="table-container" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '0.88rem' }}>
                      <thead>
                        <tr>
                          <th>Receipt No</th>
                          <th>Product</th>
                          <th>Term</th>
                          <th>Paid By</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudentTxs.map((tx) => (
                          <tr key={tx.id}>
                            <td style={{ fontFamily: 'monospace' }}>{tx.receipt_number}</td>
                            <td>{tx.product_name}</td>
                            <td>{tx.term_name} ({tx.academic_year})</td>
                            <td>{tx.paid_by}</td>
                            <td style={{ textAlign: 'right', fontWeight: 650 }}>Gh¢ {tx.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>Close Profile</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
