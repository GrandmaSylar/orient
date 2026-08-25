import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit2, UserX, UserCheck, Calendar, Phone, 
  User, BookOpen, AlertCircle, History, Printer
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
  received_by?: string;
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
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Selected student for edit/profile
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudentTxs, setSelectedStudentTxs] = useState<StudentTx[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txStartDate, setTxStartDate] = useState('');
  const [txEndDate, setTxEndDate] = useState('');

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
    setTxStartDate('');
    setTxEndDate('');
    setShowProfileModal(true);
    setTxLoading(true);
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: `
          SELECT t.id, t.receipt_number, t.amount, t.paid_by, t.created_at, 
                 p.name as product_name, term.term_name, term.academic_year,
                 u.username as received_by
          FROM transactions t 
          JOIN products p ON t.product_id = p.id 
          JOIN academic_terms term ON t.term_id = term.id 
          LEFT JOIN users u ON t.created_by = u.id
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

  const amountToWords = (numStr: string): string => {
    const num = parseFloat(numStr);
    if (isNaN(num) || num < 0) return '';
    if (num === 0) return 'Zero Ghana Cedis Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const helper = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + helper(n % 100) : '');
      if (n < 1000000) return helper(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + helper(n % 1000) : '');
      return helper(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 !== 0 ? ' ' + helper(n % 1000000) : '');
    };

    const cediVal = Math.floor(num);
    const pesewaVal = Math.round((num - cediVal) * 100);

    let cediWords = '';
    if (cediVal > 0) {
      cediWords = helper(cediVal) + (cediVal === 1 ? ' Ghana Cedi' : ' Ghana Cedis');
    }

    let pesewaWords = '';
    if (pesewaVal > 0) {
      pesewaWords = (cediVal > 0 ? ' and ' : '') + helper(pesewaVal) + (pesewaVal === 1 ? ' Pesewa' : ' Pesewas');
    }

    return (cediWords + pesewaWords + ' Only').replace(/\s+/g, ' ').trim();
  };

  const generateReceiptHtml = (data: any, orgConfig: any, pageSize = 'A4', orientation = 'portrait') => {
    const isThermal = pageSize === '80mm' || pageSize === '58mm';
    
    let sizeStyle = 'A4 portrait';
    let bodyDimensions = 'width: 210mm; height: 297mm; padding: 10mm;';
    
    if (pageSize === 'A5') {
      if (orientation === 'landscape') {
        sizeStyle = 'A5 landscape';
        bodyDimensions = 'width: 210mm; height: 148mm; padding: 6mm;';
      } else {
        sizeStyle = 'A5 portrait';
        bodyDimensions = 'width: 148mm; height: 210mm; padding: 6mm;';
      }
    } else if (pageSize === 'A4') {
      if (orientation === 'landscape') {
        sizeStyle = 'A4 landscape';
        bodyDimensions = 'width: 297mm; height: 210mm; padding: 10mm;';
      } else {
        sizeStyle = 'A4 portrait';
        bodyDimensions = 'width: 210mm; height: 297mm; padding: 10mm;';
      }
    } else if (pageSize === 'A6') {
      if (orientation === 'landscape') {
        sizeStyle = 'A6 landscape';
        bodyDimensions = 'width: 148mm; height: 105mm; padding: 4mm;';
      } else {
        sizeStyle = 'A6 portrait';
        bodyDimensions = 'width: 105mm; height: 148mm; padding: 4mm;';
      }
    } else if (pageSize === '80mm') {
      sizeStyle = '80mm 200mm';
      bodyDimensions = 'width: 80mm; padding: 4mm;';
    } else if (pageSize === '58mm') {
      sizeStyle = '58mm 180mm';
      bodyDimensions = 'width: 58mm; padding: 2mm;';
    }

    if (isThermal) {
      const thermalClass = pageSize === '80mm' ? 'thermal-80' : 'thermal-58';
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt</title>
          <style>
            @page {
              size: ${sizeStyle};
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              margin: 0;
              ${bodyDimensions}
              color: #000;
              background-color: #fff;
              box-sizing: border-box;
            }
            .thermal-container {
              width: 100%;
              box-sizing: border-box;
            }
            .header-logo-centered {
              text-align: center;
              margin-bottom: 6px;
            }
            .thermal-header-text {
              text-align: center;
              margin-bottom: 8px;
            }
            .thermal-header-text h2 {
              font-size: 10.5pt;
              font-weight: bold;
              margin: 0;
              text-transform: uppercase;
            }
            .thermal-header-text p {
              font-size: 8pt;
              margin: 2px 0 0 0;
              font-weight: bold;
            }
            .thermal-divider {
              border-top: 1px dashed #000;
              margin: 6px 0;
            }
            .thermal-title {
              text-align: center;
              font-weight: bold;
              font-size: 9.5pt;
              text-transform: uppercase;
            }
            .thermal-title-sub {
              text-align: center;
              font-size: 8.5pt;
              font-weight: bold;
              margin-top: 2px;
            }
            .thermal-details {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
            }
            .thermal-details td {
              padding: 2.5px 0;
              font-size: 8.5pt;
              vertical-align: top;
            }
            .thermal-58 .thermal-details td {
              font-size: 7.5pt;
            }
            .right {
              text-align: right;
            }
            .bold {
              font-weight: bold;
            }
            .thermal-amount-container {
              text-align: center;
              padding: 8px 0;
              margin: 6px 0;
              border: 1px solid #000;
            }
            .thermal-amount-label {
              font-size: 8pt;
              font-weight: bold;
            }
            .thermal-amount-value {
              font-size: 13pt;
              font-weight: bold;
              margin-top: 2px;
            }
            .thermal-58 .thermal-amount-value {
              font-size: 11pt;
            }
            .thermal-words {
              font-size: 8pt;
              text-transform: uppercase;
              text-align: center;
              font-style: italic;
              margin: 6px 0;
              line-height: 1.3;
            }
            .thermal-signature-section {
              margin-top: 30px;
              text-align: center;
            }
            .thermal-sig-line {
              border-top: 1px solid #000;
              width: 130px;
              margin: 0 auto;
              padding-top: 4px;
              font-size: 8pt;
              font-weight: bold;
            }
            .thermal-footer {
              text-align: center;
              font-size: 7.5pt;
              margin-top: 20px;
              line-height: 1.4;
            }
          </style>
        </head>
        <body>
          <div class="thermal-container ${thermalClass}">
            <div class="header-logo-centered">
              ${orgConfig.logo_url ? `<img src="${orgConfig.logo_url}" style="max-height: 48px; max-width: 58px; object-fit: contain;" />` : `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 32px; height: 32px; color: #000;">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  <path d="M2 12h20M12 2v20" />
                </svg>
              `}
            </div>
            
            <div class="thermal-header-text">
              <h2>${orgConfig.org_name}</h2>
              <p>${orgConfig.location}</p>
              <p>${orgConfig.telephone}</p>
            </div>
            
            <div class="thermal-divider"></div>
            
            <div class="thermal-title">${orgConfig.school_name}</div>
            <div class="thermal-title-sub">FEES COLLECTION RECEIPT</div>
            
            <div class="thermal-divider"></div>
            
            <table class="thermal-details">
              <tr><td style="width: 40%;">Receipt No:</td><td class="bold right">${data.receiptNo}</td></tr>
              <tr><td>Date:</td><td class="right bold">${data.date}</td></tr>
              <tr><td>Student ID:</td><td class="right">${data.studentId}</td></tr>
              <tr><td>Student Name:</td><td class="right bold">${data.studentName}</td></tr>
              <tr><td>Class:</td><td class="right">${data.studentClass}</td></tr>
              <tr><td>Term:</td><td class="right">${data.termName}</td></tr>
              <tr><td>Academic Year:</td><td class="right">${data.year}</td></tr>
              <tr><td>Paid By:</td><td class="right">${data.paidBy}</td></tr>
            </table>
            
            <div class="thermal-divider"></div>
            
            <div class="thermal-amount-container">
              <div class="thermal-amount-label">AMOUNT PAID</div>
              <div class="thermal-amount-value">GHC ${data.amount.toFixed(2)}</div>
            </div>
            
            <div class="thermal-words">${data.amountWords}</div>
            
            <div class="thermal-divider"></div>
            
            <table class="thermal-details">
              <tr><td style="width: 45%;">Guardian Number:</td><td class="right">${data.guardianPhone || 'N/A'}</td></tr>
              <tr><td>Received By:</td><td class="right">${data.receivedBy}</td></tr>
            </table>
            
            <div class="thermal-divider"></div>
            
            <div class="thermal-signature-section">
              <div class="thermal-sig-line">Cashier Signature</div>
            </div>
            
            <div class="thermal-footer">
              Thank you for choosing our Credit Union.<br>
              Generated at: ${new Date().toLocaleTimeString()}
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Standard Layout (A5 / A4)
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          @page {
            size: ${sizeStyle};
            margin: 0;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            ${bodyDimensions}
            color: #1e293b;
            font-size: 10pt;
            box-sizing: border-box;
            background-color: #fff;
          }
          .receipt-box {
            border: 2px solid #0f172a;
            padding: 12px;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            box-sizing: border-box;
            background: radial-gradient(circle, rgba(248,250,252,0.6) 0%, rgba(255,255,255,1) 100%);
            position: relative;
          }
          .watermark {
            position: absolute;
            top: 55%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-15deg);
            font-size: 38pt;
            font-weight: 900;
            color: rgba(226, 232, 240, 0.4);
            z-index: 0;
            white-space: nowrap;
            pointer-events: none;
            text-transform: uppercase;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
            z-index: 1;
            position: relative;
          }
          .header-logo {
            width: 70px;
            vertical-align: middle;
            text-align: center;
          }
          .header-text {
            text-align: center;
            vertical-align: middle;
          }
          .header-text h2 {
            margin: 0;
            font-size: 13pt;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .header-text p {
            margin: 2px 0 0 0;
            font-size: 9pt;
            font-weight: 600;
            color: #475569;
          }
          .divider {
            border-top: 2px solid #0f172a;
            margin: 4px 0;
            z-index: 1;
            position: relative;
          }
          .receipt-title {
            text-align: center;
            font-size: 11pt;
            font-weight: 800;
            margin: 4px 0 6px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
            text-decoration: underline;
            z-index: 1;
            position: relative;
          }
          .details-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            z-index: 1;
            position: relative;
          }
          .details-grid td {
            padding: 4px 6px;
            vertical-align: middle;
            font-size: 9.5pt;
          }
          .label {
            font-weight: bold;
            color: #334155;
            width: 15%;
          }
          .value {
            border-bottom: 1.5px solid #0f172a;
            color: #0f172a;
            font-weight: 700;
          }
          .amount-row {
            background-color: #f8fafc;
            border: 1.5px solid #0f172a;
            padding: 6px 10px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11pt;
            font-weight: bold;
            z-index: 1;
            position: relative;
          }
          .signatures-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 16px;
            padding-top: 4px;
            z-index: 1;
            position: relative;
          }
          .sig-box {
            width: 180px;
            text-align: center;
            font-size: 8.5pt;
          }
          .sig-line {
            border-top: 1.5px solid #0f172a;
            margin-top: 22px;
            padding-top: 4px;
          }
          .stamp-box {
            width: 120px;
            height: 48px;
            border: 2px dashed #0284c7;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #0284c7;
            font-size: 8.5pt;
            font-weight: 800;
            transform: rotate(-5deg);
            opacity: 0.8;
          }
          .footer {
            font-size: 8pt;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px dashed #e2e8f0;
            padding-top: 4px;
            margin-top: 12px;
            z-index: 1;
            position: relative;
          }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="watermark">${orgConfig.org_name}</div>
          
          <table class="header-table">
            <tr>
              <td class="header-logo">
                ${orgConfig.logo_url ? `<img src="${orgConfig.logo_url}" style="max-height: 52px; max-width: 62px; object-fit: contain;" />` : `
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 44px; height: 44px; color: #0f172a;">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    <path d="M2 12h20M12 2v20" />
                  </svg>
                `}
              </td>
              <td class="header-text">
                <h2>${orgConfig.org_name}</h2>
                <p>${orgConfig.location}</p>
                <p style="font-size: 8pt; font-weight: normal; margin-top: 1px;">${orgConfig.telephone}</p>
              </td>
            </tr>
          </table>
          
          <div class="divider"></div>
          
          <div class="receipt-title">${orgConfig.school_name} School Fee Payment Details</div>
          
          <table class="details-grid">
            <tr>
              <td class="label">Student No.:</td>
              <td class="value" style="width: 35%;">${data.studentId}</td>
              <td class="label" style="width: 15%;">Term:</td>
              <td class="value">${data.termName}</td>
            </tr>
            <tr>
              <td class="label">Name:</td>
              <td class="value">${data.studentName}</td>
              <td class="label">Academic Year:</td>
              <td class="value">${data.year}</td>
            </tr>
            <tr>
              <td class="label">Class:</td>
              <td class="value" colspan="3">${data.studentClass}</td>
            </tr>
          </table>
          
          <div class="amount-row">
            <span>Amount (Gh¢): Gh¢ ${data.amount.toFixed(2)}</span>
            <span style="font-size: 8.5pt; font-weight: bold; color: #0f172a;">Date of Payment: ${data.date}</span>
          </div>
          
          <table class="details-grid">
            <tr>
              <td class="label" style="width: 18%;">Amount In Words:</td>
              <td class="value" colspan="3" style="text-transform: uppercase;">${data.amountWords}</td>
            </tr>
            <tr>
              <td class="label">Guardian Number:</td>
              <td class="value" style="width: 32%;">${data.guardianPhone || 'N/A'}</td>
              <td class="label" style="width: 12%;">Paid By:</td>
              <td class="value">${data.paidBy}</td>
            </tr>
          </table>
          
          <div class="signatures-row">
            <div class="stamp-box">
              CREDIT UNION
            </div>
            
            <div style="display: flex; gap: 24px;">
              <div class="sig-box">
                <p style="margin: 0; font-weight: bold; border-bottom: 1px dotted #94a3b8; height: 18px;">${data.receivedBy}</p>
                <div class="sig-line" style="margin-top: 6px;">Received By</div>
              </div>
              <div class="sig-box">
                <div class="sig-line">Recipient Sign / Stamp</div>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <span>Thank you for choosing our Credit Union.</span>
            <span>Generated at: ${new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintPastReceipt = async (tx: StudentTx) => {
    if (!selectedStudent) return;
    try {
      const orgRes = await window.electronAPI.invoke('db-query', {
        query: 'SELECT org_name, location, telephone, school_name, logo_url FROM org_config WHERE id = 1'
      });
      const orgConfig = (orgRes.success && orgRes.recordset?.[0]) || {
        org_name: 'CO-OPERATIVE CREDIT UNION',
        location: 'OFFICIAL RECEIPT',
        telephone: 'TEL: 0244757447/0207447016',
        school_name: 'Space Academy',
        logo_url: ''
      };

      const printData = {
        receiptNo: tx.receipt_number,
        studentName: selectedStudent.full_name,
        studentId: selectedStudent.student_id,
        studentClass: selectedStudent.grade_class,
        termName: tx.term_name,
        year: tx.academic_year,
        amount: tx.amount,
        amountWords: amountToWords(tx.amount.toString()),
        date: new Date(tx.created_at).toLocaleDateString('en-GB'),
        guardianPhone: selectedStudent.guardian_phone,
        paidBy: tx.paid_by,
        receivedBy: tx.received_by || 'Teller'
      };

      const printHtml = generateReceiptHtml(printData, orgConfig, 'A4', 'portrait');

      await window.electronAPI.invoke('print-receipt', printHtml, {
        pageSize: 'A4',
        landscape: false
      });
    } catch (err) {
      console.error('Failed to print past transaction receipt', err);
      showDialog('error', 'Print Error', 'Could not generate or print receipt.');
    }
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = 
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === 'ALL' || s.grade_class.toUpperCase() === filterClass;
    return matchSearch && matchClass;
  });

  const filteredTxs = selectedStudentTxs.filter(tx => {
    if (!tx.created_at) return true;
    const txDate = new Date(tx.created_at).toISOString().split('T')[0];
    if (txStartDate && txDate < txStartDate) return false;
    if (txEndDate && txDate > txEndDate) return false;
    return true;
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
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
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
            onChange={(e) => { setFilterClass(e.target.value); setCurrentPage(1); }}
            style={{ width: '160px' }}
          >
            <option value="ALL">All Classes</option>
            {classes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap'
          }}>
            Total: {filteredStudents.length} {filteredStudents.length === 1 ? 'Student' : 'Students'}
          </div>
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
                {filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((student) => (
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

            {/* Pagination Controls */}
            {filteredStudents.length > pageSize && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                fontSize: '0.85rem'
              }}>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Showing <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredStudents.length)}</strong> to <strong>{Math.min(currentPage * pageSize, filteredStudents.length)}</strong> of <strong>{filteredStudents.length}</strong> students
                </div>
                
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{ padding: '6px 12px', fontWeight: 600 }}
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: Math.ceil(filteredStudents.length / pageSize) }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const totalPages = Math.ceil(filteredStudents.length / pageSize);
                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          className={`btn ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                          onClick={() => setCurrentPage(pageNum)}
                          style={{ padding: '6px 10px', minWidth: '32px', fontWeight: 600 }}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (
                      (pageNum === 2 && currentPage > 3) ||
                      (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                    ) {
                      return <span key={pageNum} style={{ alignSelf: 'center', padding: '0 4px', color: 'var(--text-tertiary)' }}>...</span>;
                    }
                    return null;
                  })}
                  
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === Math.ceil(filteredStudents.length / pageSize)}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredStudents.length / pageSize)))}
                    style={{ padding: '6px 12px', fontWeight: 600 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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

                {/* Date Filters */}
                {selectedStudentTxs.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    marginBottom: '16px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-secondary)' }}>From Date</span>
                      <input
                        type="date"
                        className="form-control"
                        value={txStartDate}
                        onChange={(e) => setTxStartDate(e.target.value)}
                        style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-secondary)' }}>To Date</span>
                      <input
                        type="date"
                        className="form-control"
                        value={txEndDate}
                        onChange={(e) => setTxEndDate(e.target.value)}
                        style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                      />
                    </div>
                    {(txStartDate || txEndDate) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setTxStartDate(''); setTxEndDate(''); }}
                        style={{ alignSelf: 'flex-end', padding: '6px 10px', fontSize: '0.8rem' }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
                
                {txLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="skeleton" style={{ height: '30px', width: '100%' }} />
                    <div className="skeleton" style={{ height: '30px', width: '100%' }} />
                    <div className="skeleton" style={{ height: '30px', width: '100%' }} />
                  </div>
                ) : filteredTxs.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {selectedStudentTxs.length > 0 ? 'No deposits match the selected date filters.' : 'No deposits have been made for this student yet.'}
                    </p>
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
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTxs.map((tx) => (
                          <tr key={tx.id}>
                            <td style={{ fontFamily: 'monospace' }}>{tx.receipt_number}</td>
                            <td>{tx.product_name}</td>
                            <td>{tx.term_name} ({tx.academic_year})</td>
                            <td>{tx.paid_by}</td>
                            <td style={{ textAlign: 'right', fontWeight: 650 }}>Gh¢ {tx.amount.toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handlePrintPastReceipt(tx)}
                                style={{ padding: '4px 6px' }}
                                title="Print Receipt"
                              >
                                <Printer size={12} />
                              </button>
                            </td>
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
