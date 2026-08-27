import React, { useState, useEffect } from 'react';
import { 
  Search, User, CreditCard, Printer, Trash2, 
  CheckCircle, Info, RefreshCw
} from 'lucide-react';

interface Student {
  id: number;
  student_id: string;
  full_name: string;
  grade_class: string;
  guardian_phone: string;
  is_active: boolean;
}

interface Product {
  id: number;
  name: string;
}

interface Term {
  id: number;
  academic_year: string;
  term_name: string;
}

interface Transaction {
  id: number;
  receipt_number: string;
  student_name: string;
  student_id_code: string;
  product_name: string;
  amount: number;
  paid_by: string;
  narration: string;
  student_class_snapshot: string;
  guardian_phone_snapshot: string;
  status: string;
  void_reason: string;
  created_at: string;
  username: string; // teller who created it
  voided_by_username?: string;
  voided_at?: string;
  term_name?: string;
  academic_year?: string;
}

interface TransactionsProps {
  user: { id: number; username: string; role: string };
  showDialog: (
    type: 'success' | 'warning' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => void;
}

export const Transactions: React.FC<TransactionsProps> = ({ user, showDialog }) => {
  const [activeTab, setActiveTab] = useState<'post' | 'history'>('post');
  
  // Posting Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchClass, setSearchClass] = useState('ALL');
  const [classes, setClasses] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTerm, setActiveTerm] = useState<Term | null>(null);
  
  const [amount, setAmount] = useState('');
  const [productId, setProductId] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [narration, setNarration] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Void Modal State
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [selectedTxForVoid, setSelectedTxForVoid] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  // Success Modal & Receipt Preview State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [postedTxData, setPostedTxData] = useState<any | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [receiptSize, setReceiptSize] = useState<'A5' | 'A4' | 'A6' | '80mm' | '58mm'>('A4');
  const [receiptOrientation, setReceiptOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [receiptFontSize, setReceiptFontSize] = useState<number>(10);
  const [receiptFontBold, setReceiptFontBold] = useState<boolean>(true);

  const [orgConfig, setOrgConfig] = useState<any>({
    org_name: 'CO-OPERATIVE CREDIT UNION',
    location: 'OFFICIAL RECEIPT',
    telephone: 'TEL: 0244757447/0207447016',
    school_name: 'Space Academy',
    logo_url: ''
  });

  useEffect(() => {
    fetchActiveProductsAndTerms();
    fetchClasses();
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, dateFilter, statusFilter]);

  // Debounced real-time student search trigger
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const delayDebounce = setTimeout(() => {
        performDynamicSearch();
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]);
      setSelectedStudent(null);
    }
  }, [searchQuery, searchClass]);

  const fetchActiveProductsAndTerms = async () => {
    try {
      const pRes = await window.electronAPI.invoke('db-query', {
        query: 'SELECT id, name FROM products WHERE is_active = 1 ORDER BY name ASC'
      });
      if (pRes.success && pRes.recordset) {
        setProducts(pRes.recordset);
      }

      const tRes = await window.electronAPI.invoke('db-query', {
        query: 'SELECT id, academic_year, term_name FROM academic_terms WHERE is_active = 1'
      });
      if (tRes.success && tRes.recordset && tRes.recordset.length > 0) {
        setActiveTerm(tRes.recordset[0]);
      }

      const orgRes = await window.electronAPI.invoke('db-query', {
        query: 'SELECT org_name, location, telephone, school_name, logo_url FROM org_config WHERE id = 1'
      });
      if (orgRes.success && orgRes.recordset && orgRes.recordset.length > 0) {
        setOrgConfig(orgRes.recordset[0]);
      }
    } catch (err) {
      console.error('Error fetching products/terms/org', err);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'SELECT DISTINCT grade_class FROM students WHERE is_active = 1'
      });
      if (res.success && res.recordset) {
        setClasses(res.recordset.map((r: any) => r.grade_class.toUpperCase()));
      }
    } catch (err) {
      console.error('Error loading classes', err);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      let query = `
        SELECT t.id, t.receipt_number, t.amount, t.paid_by, t.narration, 
               t.student_class_snapshot, t.guardian_phone_snapshot, t.status, t.void_reason,
               t.created_at, t.voided_at, s.full_name as student_name, s.student_id as student_id_code,
               p.name as product_name, u.username, uv.username as voided_by_username,
               atm.term_name, atm.academic_year
        FROM transactions t
        JOIN students s ON t.student_id = s.id
        JOIN products p ON t.product_id = p.id
        JOIN academic_terms atm ON t.term_id = atm.id
        JOIN users u ON t.created_by = u.id
        LEFT JOIN users uv ON t.voided_by = uv.id
        WHERE CAST(t.created_at AS DATE) = @date
      `;
      
      const params: any[] = [{ name: 'date', value: dateFilter }];
      
      if (statusFilter !== 'ALL') {
        query += ' AND t.status = @status';
        params.push({ name: 'status', value: statusFilter });
      }
      
      query += ' ORDER BY t.created_at DESC';

      const res = await window.electronAPI.invoke('db-query', { query, params });
      if (res.success && res.recordset) {
        setTransactions(res.recordset);
      }
    } catch (err) {
      console.error('Error reading transactions history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const performDynamicSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      let query = `
        SELECT id, student_id, full_name, grade_class, guardian_phone, is_active 
        FROM students 
        WHERE (full_name LIKE @search OR student_id LIKE @search) AND is_active = 1
      `;
      const params: any[] = [{ name: 'search', value: `%${searchQuery}%` }];

      if (searchClass !== 'ALL') {
        query += ' AND grade_class = @class';
        params.push({ name: 'class', value: searchClass });
      }

      const res = await window.electronAPI.invoke('db-query', { query, params });
      if (res.success && res.recordset) {
        setSearchResults(res.recordset);
      }
    } catch (err) {
      console.error('Student dynamic search failed', err);
    }
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

  const handlePostTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !activeTerm) return;
    setError(null);

    const amtFloat = parseFloat(amount);
    if (isNaN(amtFloat) || amtFloat <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    const confirmMsg = `Are you sure you want to post a deposit of Gh¢ ${amtFloat.toFixed(2)} for ${selectedStudent.full_name}?`;

    showDialog('confirm', 'Confirm Transaction', confirmMsg, async () => {
      setPosting(true);
      try {
        const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
        const receiptNo = `REC-${dateCode}-${uniqueSuffix}`;

        const res = await window.electronAPI.invoke('db-query', {
          query: `
            INSERT INTO transactions (
              receipt_number, student_id, product_id, term_id, amount, paid_by, narration,
              student_class_snapshot, guardian_phone_snapshot, status, created_by
            )
            VALUES (
              @receipt, @student, @product, @term, @amount, @paid_by, @narration,
              @class, @phone, 'POSTED', @user
            )
          `,
          params: [
            { name: 'receipt', value: receiptNo },
            { name: 'student', value: selectedStudent.id },
            { name: 'product', value: parseInt(productId) },
            { name: 'term', value: activeTerm.id },
            { name: 'amount', value: amtFloat },
            { name: 'paid_by', value: paidBy },
            { name: 'narration', value: narration || 'Deposit' },
            { name: 'class', value: selectedStudent.grade_class },
            { name: 'phone', value: selectedStudent.guardian_phone },
            { name: 'user', value: user.id }
          ]
        });

        if (res.success) {
          await window.electronAPI.invoke('db-query', {
            query: 'INSERT INTO audit_logs (user_id, action, details) VALUES (@user, \'POST_TRANSACTION\', @details)',
            params: [
              { name: 'user', value: user.id },
              { name: 'details', value: `Receipt ${receiptNo} for student ${selectedStudent.full_name} amount Gh¢ ${amtFloat}` }
            ]
          });

          // Set data for the print preview & success modal instead of auto-printing
          setPostedTxData({
            receiptNo,
            studentName: selectedStudent.full_name,
            studentId: selectedStudent.student_id,
            studentClass: selectedStudent.grade_class,
            termName: activeTerm.term_name,
            year: activeTerm.academic_year,
            amount: amtFloat,
            amountWords: amountToWords(amount),
            date: new Date().toLocaleDateString('en-GB'),
            guardianPhone: selectedStudent.guardian_phone,
            paidBy,
            receivedBy: user.username
          });

          setShowSuccessModal(true);
        } else {
          setError(res.error || 'Failed to post transaction.');
        }
      } catch (err: any) {
        setError(err.message || 'Error occurred during transaction posting.');
      } finally {
        setPosting(false);
      }
    });
  };

  const handleOpenVoid = (tx: Transaction) => {
    setSelectedTxForVoid(tx);
    setVoidReason('');
    setShowVoidModal(true);
  };

  const handleConfirmVoid = async () => {
    if (!selectedTxForVoid || !voidReason.trim()) return;
    setVoiding(true);

    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: `
          UPDATE transactions 
          SET status = 'VOIDED', void_reason = @reason, voided_by = @user, voided_at = GETDATE()
          WHERE id = @id
        `,
        params: [
          { name: 'id', value: selectedTxForVoid.id },
          { name: 'reason', value: voidReason },
          { name: 'user', value: user.id }
        ]
      });

      if (res.success) {
        await window.electronAPI.invoke('db-query', {
          query: 'INSERT INTO audit_logs (user_id, action, details) VALUES (@user, \'VOID_TRANSACTION\', @details)',
          params: [
            { name: 'user', value: user.id },
            { name: 'details', value: `Voided Receipt ${selectedTxForVoid.receipt_number}. Reason: ${voidReason}` }
          ]
        });

        setShowVoidModal(false);
        fetchHistory();
        showDialog('success', 'Transaction Voided', `Receipt ${selectedTxForVoid.receipt_number} has been voided.`);
      } else {
        showDialog('error', 'Database Error', res.error || 'Failed to void transaction.');
      }
    } catch (err: any) {
      showDialog('error', 'System Error', err.message || 'Error voiding transaction.');
    } finally {
      setVoiding(false);
    }
  };

  const canVoid = (tx: Transaction) => {
    if (tx.status === 'VOIDED') return false;
    if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') return true;
    
    const today = new Date().toISOString().split('T')[0];
    const txDate = new Date(tx.created_at).toISOString().split('T')[0];
    return txDate === today && tx.username === user.username;
  };

  const generateReceiptHtml = (data: any, pageSize = 'A4', orientation = 'portrait', customFontSize = 10, isBold = true) => {
    const isThermal = pageSize === '80mm' || pageSize === '58mm';
    
    let sizeStyle = 'A4 portrait';
    let maxBoxWidth = '185mm';
    let bodyPadding = '12mm 15mm';
    
    if (pageSize === 'A4') {
      if (orientation === 'landscape') {
        sizeStyle = 'A4 landscape';
        maxBoxWidth = '260mm';
        bodyPadding = '12mm 15mm';
      } else {
        sizeStyle = 'A4 portrait';
        maxBoxWidth = '185mm';
        bodyPadding = '12mm 15mm';
      }
    } else if (pageSize === 'A5') {
      if (orientation === 'landscape') {
        sizeStyle = 'A5 landscape';
        maxBoxWidth = '185mm';
        bodyPadding = '8mm 10mm';
      } else {
        sizeStyle = 'A5 portrait';
        maxBoxWidth = '130mm';
        bodyPadding = '8mm 10mm';
      }
    } else if (pageSize === 'A6') {
      if (orientation === 'landscape') {
        sizeStyle = 'A6 landscape';
        maxBoxWidth = '135mm';
        bodyPadding = '4mm 6mm';
      } else {
        sizeStyle = 'A6 portrait';
        maxBoxWidth = '95mm';
        bodyPadding = '4mm 6mm';
      }
    } else if (pageSize === '80mm') {
      sizeStyle = '80mm 200mm';
    } else if (pageSize === '58mm') {
      sizeStyle = '58mm 180mm';
    }

    if (isThermal) {
      const thermalClass = pageSize === '80mm' ? 'thermal-80' : 'thermal-58';
      const maxThermalWidth = pageSize === '80mm' ? '74mm' : '52mm';
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
            *, *:before, *:after {
              box-sizing: border-box;
            }
            :root {
              --base-font-size: ${customFontSize}pt;
              --font-weight-normal: ${isBold ? '800' : '500'};
              --font-weight-bold: ${isBold ? '900' : '700'};
              --font-weight-heavy: ${isBold ? '900' : '900'};
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              margin: 0 auto;
              color: #000;
              font-size: calc(var(--base-font-size) * 0.9);
              font-weight: var(--font-weight-normal);
              background-color: #fff;
              box-sizing: border-box;
              display: flex;
              justify-content: center;
              padding: 4mm 2mm;
            }
            .thermal-container {
              width: 100%;
              max-width: ${maxThermalWidth};
              margin: 0 auto;
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
              font-size: calc(var(--base-font-size) * 1.1);
              font-weight: var(--font-weight-heavy);
              margin: 0;
              color: #000;
              text-transform: uppercase;
            }
            .thermal-header-text p {
              font-size: calc(var(--base-font-size) * 0.85);
              margin: 2px 0 0 0;
              font-weight: var(--font-weight-bold);
              color: #000;
            }
            .thermal-divider {
              border-top: 1.5px dashed #000;
              margin: 6px 0;
            }
            .thermal-title {
              text-align: center;
              font-weight: var(--font-weight-heavy);
              font-size: var(--base-font-size);
              color: #000;
              text-transform: uppercase;
            }
            .thermal-title-sub {
              text-align: center;
              font-size: calc(var(--base-font-size) * 0.9);
              font-weight: var(--font-weight-heavy);
              color: #000;
              margin-top: 2px;
            }
            .thermal-details {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
            }
            .thermal-details td {
              padding: 2.5px 0;
              font-size: calc(var(--base-font-size) * 0.9);
              font-weight: var(--font-weight-normal);
              color: #000;
              vertical-align: top;
            }
            .thermal-58 .thermal-details td {
              font-size: calc(var(--base-font-size) * 0.8);
            }
            .right {
              text-align: right;
            }
            .bold {
              font-weight: var(--font-weight-heavy);
            }
            .thermal-amount-container {
              text-align: center;
              padding: 8px 0;
              margin: 6px 0;
              border: 2px solid #000;
            }
            .thermal-amount-label {
              font-size: calc(var(--base-font-size) * 0.85);
              font-weight: var(--font-weight-bold);
              color: #000;
            }
            .thermal-amount-value {
              font-size: calc(var(--base-font-size) * 1.3);
              font-weight: var(--font-weight-heavy);
              color: #000;
              margin-top: 2px;
            }
            .thermal-58 .thermal-amount-value {
              font-size: calc(var(--base-font-size) * 1.15);
            }
            .thermal-words {
              font-size: calc(var(--base-font-size) * 0.85);
              text-transform: uppercase;
              text-align: center;
              font-weight: var(--font-weight-bold);
              color: #000;
              margin: 6px 0;
              line-height: 1.3;
            }
            .thermal-signature-section {
              margin-top: 26px;
              text-align: center;
            }
            .thermal-sig-line {
              border-top: 1.5px solid #000;
              width: 140px;
              margin: 0 auto;
              padding-top: 4px;
              font-size: calc(var(--base-font-size) * 0.85);
              font-weight: var(--font-weight-bold);
              color: #000;
            }
            .thermal-footer {
              text-align: center;
              font-size: calc(var(--base-font-size) * 0.8);
              font-weight: var(--font-weight-normal);
              color: #000;
              margin-top: 18px;
              line-height: 1.4;
            }
            @media print {
              body {
                padding: 2mm !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="thermal-container ${thermalClass}">
            <div class="header-logo-centered">
              ${orgConfig.logo_url ? `<img src="${orgConfig.logo_url}" style="max-height: 50px; max-width: 60px; object-fit: contain;" />` : `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 34px; height: 34px; color: #000;">
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
              <tr><td style="width: 40%; font-weight: var(--font-weight-bold);">Receipt No:</td><td class="bold right">${data.receiptNo}</td></tr>
              <tr><td style="font-weight: var(--font-weight-bold);">Date:</td><td class="right bold">${data.date}</td></tr>
              <tr><td style="font-weight: var(--font-weight-bold);">Student ID:</td><td class="right bold">${data.studentId}</td></tr>
              <tr><td style="font-weight: var(--font-weight-bold);">Student Name:</td><td class="right bold">${data.studentName}</td></tr>
              <tr><td style="font-weight: var(--font-weight-bold);">Class:</td><td class="right bold">${data.studentClass}</td></tr>
              <tr><td style="font-weight: var(--font-weight-bold);">Term:</td><td class="right bold">${data.termName}</td></tr>
              <tr><td style="font-weight: var(--font-weight-bold);">Academic Year:</td><td class="right bold">${data.year}</td></tr>
              <tr><td style="font-weight: var(--font-weight-bold);">Paid By:</td><td class="right bold">${data.paidBy}</td></tr>
            </table>
            
            <div class="thermal-divider"></div>
            
            <div class="thermal-amount-container">
              <div class="thermal-amount-label">AMOUNT PAID</div>
              <div class="thermal-amount-value">GHC ${data.amount.toFixed(2)}</div>
            </div>
            
            <div class="thermal-words">${data.amountWords}</div>
            
            <div class="thermal-divider"></div>
            
            <table class="thermal-details">
              <tr><td style="width: 45%; font-weight: var(--font-weight-bold);">Guardian Number:</td><td class="right bold">${data.guardianPhone || 'N/A'}</td></tr>
              <tr><td style="font-weight: var(--font-weight-bold);">Received By:</td><td class="right bold">${data.receivedBy}</td></tr>
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

    // Standard Layout (A5 / A4 / A6)
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
          *, *:before, *:after {
            box-sizing: border-box;
          }
          :root {
            --base-font-size: ${customFontSize}pt;
            --font-weight-normal: ${isBold ? '800' : '500'};
            --font-weight-bold: ${isBold ? '900' : '700'};
            --font-weight-heavy: ${isBold ? '900' : '900'};
          }
          html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0 auto;
            padding: ${bodyPadding};
            color: #000;
            font-size: var(--base-font-size);
            font-weight: var(--font-weight-normal);
            box-sizing: border-box;
            background-color: #fff;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
            min-height: 100vh;
          }
          .receipt-box {
            border: 2.5px solid #000;
            border-radius: 4px;
            padding: 14px 18px;
            width: 100%;
            max-width: ${maxBoxWidth};
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            box-sizing: border-box;
            background: #ffffff;
            position: relative;
          }
          .watermark {
            position: absolute;
            top: 55%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-15deg);
            font-size: 36pt;
            font-weight: 900;
            color: rgba(148, 163, 184, 0.22);
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
            font-size: calc(var(--base-font-size) * 1.4);
            font-weight: var(--font-weight-heavy);
            color: #000;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .header-text p {
            margin: 2px 0 0 0;
            font-size: calc(var(--base-font-size) * 0.95);
            font-weight: var(--font-weight-bold);
            color: #000;
          }
          .divider {
            border-top: 2px solid #000;
            margin: 4px 0;
            z-index: 1;
            position: relative;
          }
          .receipt-title {
            text-align: center;
            font-size: calc(var(--base-font-size) * 1.2);
            font-weight: var(--font-weight-heavy);
            margin: 4px 0 6px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #000;
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
            font-size: var(--base-font-size);
            color: #000;
            font-weight: var(--font-weight-normal);
          }
          .label {
            font-weight: var(--font-weight-bold);
            color: #000;
            width: 16%;
          }
          .value {
            border-bottom: 2px solid #000;
            color: #000;
            font-weight: var(--font-weight-bold);
          }
          .amount-row {
            background-color: #f8fafc;
            border: 2px solid #000;
            padding: 6px 10px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: calc(var(--base-font-size) * 1.2);
            font-weight: var(--font-weight-heavy);
            color: #000;
            z-index: 1;
            position: relative;
          }
          .signatures-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 14px;
            padding-top: 4px;
            z-index: 1;
            position: relative;
          }
          .sig-box {
            width: 180px;
            text-align: center;
            font-size: calc(var(--base-font-size) * 0.9);
            font-weight: var(--font-weight-bold);
            color: #000;
          }
          .sig-line {
            border-top: 2px solid #000;
            margin-top: 20px;
            padding-top: 4px;
            font-weight: var(--font-weight-bold);
          }
          .stamp-box {
            width: 120px;
            height: 46px;
            border: 2px dashed #0284c7;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #0284c7;
            font-size: calc(var(--base-font-size) * 0.9);
            font-weight: var(--font-weight-heavy);
            transform: rotate(-5deg);
            opacity: 0.85;
          }
          .footer {
            font-size: calc(var(--base-font-size) * 0.85);
            color: #334155;
            font-weight: var(--font-weight-bold);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1.5px dashed #cbd5e1;
            padding-top: 4px;
            margin-top: 10px;
            z-index: 1;
            position: relative;
          }
          @media print {
            @page {
              size: ${sizeStyle};
              margin: 0;
            }
            html, body {
              width: 100% !important;
              height: 100% !important;
              margin: 0 auto !important;
              padding: 0 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: flex-start !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              padding: ${bodyPadding} !important;
            }
            .receipt-box {
              margin: 0 auto !important;
            }
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
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 44px; height: 44px; color: #000;">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    <path d="M2 12h20M12 2v20" />
                  </svg>
                `}
              </td>
              <td class="header-text">
                <h2>${orgConfig.org_name}</h2>
                <p>${orgConfig.location}</p>
                <p style="font-size: calc(var(--base-font-size) * 0.9); font-weight: var(--font-weight-bold); margin-top: 1px;">${orgConfig.telephone}</p>
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
            <span style="font-size: calc(var(--base-font-size) * 0.95); font-weight: var(--font-weight-heavy); color: #000;">Date of Payment: ${data.date}</span>
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
                <p style="margin: 0; font-weight: var(--font-weight-heavy); border-bottom: 1.5px dotted #000; height: 18px;">${data.receivedBy}</p>
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

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('post')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'post' ? '2px solid var(--accent-primary)' : 'none',
            color: activeTab === 'post' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: 650,
            cursor: 'pointer'
          }}
        >
          Post Deposit Transaction
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--accent-primary)' : 'none',
            color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: 650,
            cursor: 'pointer'
          }}
        >
          Transaction History & Voids
        </button>
      </div>

      {activeTab === 'post' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
          <div className="panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} /> New Deposit Form
            </h3>

            {activeTerm ? (
              <div style={{
                padding: '8px 12px',
                backgroundColor: 'var(--accent-primary-light)',
                color: 'var(--accent-primary-hover)',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                marginBottom: '20px'
              }}>
                Active Term: {activeTerm.term_name} ({activeTerm.academic_year})
              </div>
            ) : (
              <div style={{
                padding: '8px 12px',
                backgroundColor: 'var(--accent-danger-light)',
                color: 'var(--accent-danger)',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                marginBottom: '20px'
              }}>
                Warning: No active academic term defined. Admin must configure this in Onboarding first.
              </div>
            )}

            <form onSubmit={handlePostTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Search & Select Student</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type student name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flexGrow: 2 }}
                  />
                  <select
                    className="form-control"
                    value={searchClass}
                    onChange={(e) => setSearchClass(e.target.value)}
                    style={{ width: '140px' }}
                  >
                    <option value="ALL">All Classes</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {searchResults.length > 0 && !selectedStudent && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 99,
                    border: '1px solid var(--accent-primary)',
                    borderRadius: 'var(--radius-sm)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    backgroundColor: '#f1f5f9',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    marginTop: '4px'
                  }}>
                    {searchResults.map(s => (
                      <div
                        key={s.id}
                        onClick={() => { setSelectedStudent(s); setPaidBy(s.full_name); }}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          fontSize: '0.9rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background-color var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                          e.currentTarget.style.borderLeft = '3px solid var(--accent-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderLeft = 'none';
                        }}
                      >
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>{s.full_name}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>({s.grade_class})</span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px' }}>
                          ID: {s.student_id}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Payment Date (Today)</label>
                <input
                  type="text"
                  className="form-control"
                  value={new Date().toLocaleDateString('en-GB')}
                  disabled
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Deposit Amount (Gh¢)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    disabled={!selectedStudent}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fee Product</label>
                  <select
                    className="form-control"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    required
                    disabled={!selectedStudent}
                  >
                    <option value="">-- Select Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {amount && (
                <div style={{
                  fontSize: '0.85rem',
                  fontStyle: 'italic',
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                  marginTop: '-8px'
                }}>
                  <strong>Words:</strong> {amountToWords(amount)}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Paid By (Depositor)</label>
                <input
                  type="text"
                  className="form-control"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  required
                  placeholder="Person physically handing over money"
                  disabled={!selectedStudent}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Narration / Memo</label>
                <input
                  type="text"
                  className="form-control"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="e.g. Balance payment for first term"
                  disabled={!selectedStudent}
                />
              </div>

              {error && (
                <div style={{ padding: '12px', color: 'var(--accent-danger)', backgroundColor: 'var(--accent-danger-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', textAlign: 'left' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={posting || !selectedStudent || !activeTerm}
                style={{ marginTop: '8px', padding: '12px' }}
              >
                {posting ? 'Posting deposit...' : 'Submit'}
              </button>
            </form>
          </div>

          <div className="panel" style={{ minHeight: '380px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} /> Selected Student Profile
            </h3>

            {selectedStudent ? (
              <div className="animate-scale-in" style={{ textAlign: 'left' }}>
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {selectedStudent.full_name}
                  </h4>
                  <p style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    ID: {selectedStudent.student_id}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.95rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>CLASS:</span>
                    <strong style={{ marginLeft: '8px', color: 'var(--text-primary)' }}>{selectedStudent.grade_class}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>GUARDIAN PHONE:</span>
                    <strong style={{ marginLeft: '8px', color: 'var(--text-primary)' }}>{selectedStudent.guardian_phone}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>STATUS:</span>
                    <span style={{
                      marginLeft: '8px',
                      display: 'inline-flex',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: '4px',
                      backgroundColor: 'var(--accent-success-light)',
                      color: 'var(--accent-success-hover)'
                    }}>
                      Active / Eligible
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                height: '220px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-tertiary)',
                border: '1px dashed var(--border-color)',
                borderRadius: 'var(--radius-sm)'
              }}>
                <Search size={32} style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '0.95rem', maxWidth: '240px', margin: '0 auto' }}>
                  Search for a student using the input form to display details here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-primary)'
          }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span className="form-label" style={{ marginBottom: 0 }}>Date Filter:</span>
              <input
                type="date"
                className="form-control"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ width: '180px' }}
              />
              
              <span className="form-label" style={{ marginBottom: 0 }}>Status:</span>
              <select
                className="form-control"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '140px' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="POSTED">POSTED</option>
                <option value="VOIDED">VOIDED</option>
              </select>
            </div>
            
            <button 
              className="btn btn-secondary btn-sm"
              onClick={fetchHistory}
              style={{ padding: '8px 12px' }}
            >
              <RefreshCw size={14} /> Refresh Logs
            </button>
          </div>

          {historyLoading ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Info size={40} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
              <h3>No Transactions Today</h3>
              <p>Change the filter date above to inspect past receipts.</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th>Receipt No</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Product</th>
                    <th>Paid By</th>
                    <th>Amount</th>
                    <th>Cashier</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} style={{ opacity: tx.status === 'VOIDED' ? 0.5 : 1 }}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{tx.receipt_number}</td>
                      <td>
                        <strong>{tx.student_name}</strong>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {tx.student_id_code}
                        </span>
                      </td>
                      <td>{tx.student_class_snapshot}</td>
                      <td>{tx.product_name}</td>
                      <td>{tx.paid_by}</td>
                      <td style={{ fontWeight: 650 }}>Gh¢ {tx.amount.toFixed(2)}</td>
                      <td>{tx.username}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          borderRadius: '4px',
                          backgroundColor: tx.status === 'POSTED' ? 'var(--accent-success-light)' : 'var(--accent-danger-light)',
                          color: tx.status === 'POSTED' ? 'var(--accent-success-hover)' : 'var(--accent-danger)'
                        }}>
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setPostedTxData({
                                receiptNo: tx.receipt_number,
                                studentName: tx.student_name,
                                studentId: tx.student_id_code,
                                studentClass: tx.student_class_snapshot,
                                termName: tx.term_name || 'Reprint',
                                year: tx.academic_year || 'Original',
                                amount: tx.amount,
                                amountWords: amountToWords(tx.amount.toString()),
                                date: new Date(tx.created_at).toLocaleDateString('en-GB'),
                                guardianPhone: tx.guardian_phone_snapshot,
                                paidBy: tx.paid_by,
                                receivedBy: tx.username
                              });
                              setShowPreviewModal(true);
                            }}
                            title="Reprint A5"
                            style={{ padding: '6px 8px' }}
                          >
                            <Printer size={14} />
                          </button>
                          
                          {canVoid(tx) && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleOpenVoid(tx)}
                              title="Void Transaction"
                              style={{ padding: '6px 8px' }}
                            >
                              <Trash2 size={14} />
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
      )}

      {/* VOID CONFIRMATION MODAL */}
      {showVoidModal && selectedTxForVoid && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-danger)' }}>Void Posted Transaction</h3>
              <button className="btn btn-secondary" onClick={() => setShowVoidModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '0.95rem', marginBottom: '16px' }}>
                You are about to void receipt <strong>{selectedTxForVoid.receipt_number}</strong> for student <strong>{selectedTxForVoid.student_name}</strong> (Gh¢ {selectedTxForVoid.amount.toFixed(2)}). 
              </p>
              
              <div className="form-group">
                <label className="form-label">Reason for Voiding</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={voidReason} 
                  onChange={(e) => setVoidReason(e.target.value)} 
                  required 
                  placeholder="e.g. Wrong student selected / wrong amount typed"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVoidModal(false)}>Cancel</button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  disabled={voiding || !voidReason.trim()}
                  onClick={handleConfirmVoid}
                >
                  {voiding ? 'Voiding...' : 'Confirm Void'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION SUCCESS / RECEIPT GENERATOR PREVIEW MODAL */}
      {showSuccessModal && postedTxData && (
        <div className="modal-overlay" style={{ zIndex: 10200 }}>
          <div className="modal-content animate-scale-in" style={{ maxWidth: '440px', padding: '28px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              padding: '14px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-success-light)',
              color: 'var(--accent-success-hover)',
              marginBottom: '16px'
            }}>
              <CheckCircle size={36} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>Transaction Saved</h3>
            
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '24px' }}>
              The deposit of <strong>Gh¢ {postedTxData.amount.toFixed(2)}</strong> for student <strong>{postedTxData.studentName}</strong> has been successfully recorded.
              <br />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>Receipt: {postedTxData.receiptNo}</span>
            </p>

            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowSuccessModal(false);
                  setPostedTxData(null);
                  // Reset form fields
                  setSelectedStudent(null);
                  setSearchResults([]);
                  setAmount('');
                  setProductId('');
                  setPaidBy('');
                  setNarration('');
                }}
                style={{ flex: 1, padding: '10px' }}
              >
                Close
              </button>
              
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setShowPreviewModal(true)}
                style={{ flex: 1, padding: '10px', display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}
              >
                <Printer size={16} /> View Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT PREVIEW MODAL */}
      {showPreviewModal && postedTxData && (
        <div className="modal-overlay" style={{ zIndex: 10300 }}>
          <div className="modal-content animate-scale-in" style={{ maxWidth: '920px', width: '95%', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                Receipt Preview ({receiptSize} {receiptSize !== '80mm' && receiptSize !== '58mm' ? receiptOrientation.charAt(0).toUpperCase() + receiptOrientation.slice(1) : ''})
              </h3>
              <button className="btn btn-secondary" onClick={() => setShowPreviewModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>

            {/* Sizing, Orientation & Font Controls */}
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              marginBottom: '16px', 
              padding: '12px', 
              backgroundColor: '#f8fafc', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--border-color)',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '8px' }}>Paper Size:</label>
                <select
                  value={receiptSize}
                  onChange={(e) => {
                    const size = e.target.value as any;
                    setReceiptSize(size);
                    if (size === '80mm' || size === '58mm') {
                      setReceiptOrientation('portrait');
                    }
                  }}
                  className="form-control"
                  style={{ width: '150px', display: 'inline-block', padding: '6px 10px', height: 'auto' }}
                >
                  <option value="A4">A4 (Full Page)</option>
                  <option value="A5">A5 (Standard)</option>
                  <option value="A6">A6</option>
                  <option value="80mm">Thermal 80mm</option>
                  <option value="58mm">Thermal 58mm</option>
                </select>
              </div>

              {(receiptSize === 'A5' || receiptSize === 'A4' || receiptSize === 'A6') && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '8px' }}>Orientation:</label>
                  <select
                    value={receiptOrientation}
                    onChange={(e) => setReceiptOrientation(e.target.value as any)}
                    className="form-control"
                    style={{ width: '120px', display: 'inline-block', padding: '6px 10px', height: 'auto' }}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #cbd5e1', paddingLeft: '16px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Font Size (pt):</span>
                <input
                  type="range"
                  min="8"
                  max="18"
                  value={receiptFontSize}
                  onChange={(e) => setReceiptFontSize(parseInt(e.target.value))}
                  style={{ width: '100px', cursor: 'pointer' }}
                />
                <input
                  type="number"
                  min="8"
                  max="18"
                  value={receiptFontSize}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) setReceiptFontSize(Math.min(18, Math.max(8, val)));
                  }}
                  className="form-control"
                  style={{ width: '55px', padding: '4px 6px', textAlign: 'center', height: '30px', display: 'inline-block' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #cbd5e1', paddingLeft: '16px' }}>
                <input
                  type="checkbox"
                  id="receipt-bold-toggle"
                  checked={receiptFontBold}
                  onChange={(e) => setReceiptFontBold(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="receipt-bold-toggle" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                  Bold Text
                </label>
              </div>
            </div>

            {/* Receipt iframe preview scaled & centered */}
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-sm)', 
              backgroundColor: '#e2e8f0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '24px 16px',
              maxHeight: '65vh',
              overflow: 'auto'
            }}>
              <iframe
                title="Receipt Preview"
                srcDoc={generateReceiptHtml(postedTxData, receiptSize, receiptOrientation, receiptFontSize, receiptFontBold)}
                style={{
                  width: receiptSize === 'A5' 
                    ? (receiptOrientation === 'landscape' ? '210mm' : '148mm')
                    : receiptSize === 'A4'
                    ? (receiptOrientation === 'landscape' ? '297mm' : '210mm')
                    : receiptSize === 'A6'
                    ? (receiptOrientation === 'landscape' ? '148mm' : '105mm')
                    : receiptSize === '80mm'
                    ? '80mm'
                    : '58mm',
                  height: receiptSize === 'A5'
                    ? (receiptOrientation === 'landscape' ? '148mm' : '210mm')
                    : receiptSize === 'A4'
                    ? (receiptOrientation === 'landscape' ? '210mm' : '297mm')
                    : receiptSize === 'A6'
                    ? (receiptOrientation === 'landscape' ? '105mm' : '148mm')
                    : receiptSize === '80mm'
                    ? '180mm'
                    : '150mm',
                  maxWidth: '100%',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  backgroundColor: 'white',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowPreviewModal(false)}
              >
                Close Preview
              </button>
              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  const printHtml = generateReceiptHtml(postedTxData, receiptSize, receiptOrientation, receiptFontSize, receiptFontBold);
                  await window.electronAPI.invoke('print-receipt', printHtml, {
                    pageSize: receiptSize,
                    landscape: receiptOrientation === 'landscape'
                  });
                }}
                style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
