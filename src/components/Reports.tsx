import React, { useState, useEffect } from 'react';
import { Calendar, Printer, FileText, RefreshCw } from 'lucide-react';

interface ReportTx {
  id: number;
  receipt_number: string;
  amount: number;
  paid_by: string;
  created_at: string;
  student_class_snapshot: string;
  student_name: string;
  student_id_code: string;
  product_name: string;
  cashier_username: string;
  academic_year?: string;
  term_name?: string;
}

interface ClassGroup {
  className: string;
  transactions: ReportTx[];
  subtotal: number;
}

interface ProductGroup {
  productName: string;
  classes: { [className: string]: ClassGroup };
  productTotal: number;
}

interface ReportsProps {
  showDialog: (
    type: 'success' | 'warning' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => void;
}

export const Reports: React.FC<ReportsProps> = ({ showDialog }) => {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawTransactions, setRawTransactions] = useState<ReportTx[]>([]);
  const [filterProduct, setFilterProduct] = useState('ALL');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterCashier, setFilterCashier] = useState('ALL');

  // Preview Modal States
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [reportFontSize, setReportFontSize] = useState<number>(8.5);
  const [reportFontBold, setReportFontBold] = useState<boolean>(true);

  const [orgConfig, setOrgConfig] = useState<any>({
    org_name: 'CO-OPERATIVE CREDIT UNION',
    location: 'OFFICIAL RECEIPT',
    telephone: 'TEL: 0244757447/0207447016',
    school_name: 'Space Academy',
    logo_url: ''
  });

  useEffect(() => {
    setFilterProduct('ALL');
    setFilterClass('ALL');
    setFilterCashier('ALL');
    fetchReportData();
    fetchOrgConfig();
  }, [reportDate]);

  const fetchOrgConfig = async () => {
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'SELECT org_name, location, telephone, school_name, logo_url FROM org_config WHERE id = 1'
      });
      if (res.success && res.recordset && res.recordset.length > 0) {
        setOrgConfig(res.recordset[0]);
      }
    } catch (err) {
      console.error('Failed to load org config in reports', err);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: `
          SELECT t.id, t.receipt_number, t.amount, t.paid_by, t.created_at, t.student_class_snapshot,
                 s.full_name as student_name, s.student_id as student_id_code,
                 p.name as product_name, u.username as cashier_username,
                 atm.term_name, atm.academic_year
          FROM transactions t
          JOIN students s ON t.student_id = s.id
          JOIN products p ON t.product_id = p.id
          JOIN academic_terms atm ON t.term_id = atm.id
          JOIN users u ON t.created_by = u.id
          WHERE CAST(t.created_at AS DATE) = @date AND t.status = 'POSTED'
          ORDER BY p.name ASC, t.student_class_snapshot ASC, t.created_at ASC
        `,
        params: [{ name: 'date', value: reportDate }]
      });

      if (res.success && res.recordset) {
        setRawTransactions(res.recordset);
      } else {
        setError(res.error || 'Failed to fetch report data.');
        showDialog('error', 'Report Error', res.error || 'Failed to fetch report data.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred generating report.');
      showDialog('error', 'Report Error', err.message || 'Failed to compile report.');
    } finally {
      setLoading(false);
    }
  };

  // Derive unique lists for dropdown selectors
  const products = React.useMemo(() => {
    return Array.from(new Set(rawTransactions.map(tx => tx.product_name))).sort();
  }, [rawTransactions]);

  const classes = React.useMemo(() => {
    return Array.from(new Set(rawTransactions.map(tx => tx.student_class_snapshot.toUpperCase()))).sort();
  }, [rawTransactions]);

  const cashiers = React.useMemo(() => {
    return Array.from(new Set(rawTransactions.map(tx => tx.cashier_username))).sort();
  }, [rawTransactions]);

  // Apply active client-side filters
  const filteredTransactions = React.useMemo(() => {
    return rawTransactions.filter(tx => {
      const matchProduct = filterProduct === 'ALL' || tx.product_name === filterProduct;
      const matchClass = filterClass === 'ALL' || tx.student_class_snapshot.toUpperCase() === filterClass;
      const matchCashier = filterCashier === 'ALL' || tx.cashier_username === filterCashier;
      return matchProduct && matchClass && matchCashier;
    });
  }, [rawTransactions, filterProduct, filterClass, filterCashier]);

  // Group filtered transactions by Product -> Class -> List
  const { productGroups, grandTotal, txCount } = React.useMemo(() => {
    const groups: { [prodName: string]: ProductGroup } = {};
    let runningGrandTotal = 0;

    filteredTransactions.forEach((tx) => {
      const pName = tx.product_name;
      const cName = tx.student_class_snapshot.toUpperCase();

      if (!groups[pName]) {
        groups[pName] = {
          productName: pName,
          classes: {},
          productTotal: 0
        };
      }

      if (!groups[pName].classes[cName]) {
        groups[pName].classes[cName] = {
          className: cName,
          transactions: [],
          subtotal: 0
        };
      }

      groups[pName].classes[cName].transactions.push(tx);
      groups[pName].classes[cName].subtotal += tx.amount;
      groups[pName].productTotal += tx.amount;
      runningGrandTotal += tx.amount;
    });

    return {
      productGroups: groups,
      grandTotal: runningGrandTotal,
      txCount: filteredTransactions.length
    };
  }, [filteredTransactions]);

  const generateReportHtml = (fontSize: number, isBold: boolean) => {
    if (txCount === 0) return '';
    
    // Parse term/academic details from first transaction
    const firstTx = rawTransactions[0];
    const academicYear = firstTx?.academic_year || '2025/2026';
    const termName = firstTx?.term_name || 'Term 1';

    const formattedDate = new Date(reportDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const printDate = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let tableSectionsHtml = '';
    let globalIndex = 1; // Running row number sequential index across all classes

    Object.values(productGroups).forEach((prodGroup) => {
      const classEntries = Object.values(prodGroup.classes);

      tableSectionsHtml += `
        <div class="product-section">
          <div class="product-header">${prodGroup.productName}</div>
          <table class="report-table">
            <thead>
              <tr class="table-header-row">
                <th style="width: 7%">R/N</th>
                <th style="width: 20%">Admission No</th>
                <th style="width: 43%">Student Name</th>
                <th style="width: 18%; text-align: right;">Amount(Gh¢)</th>
                <th style="width: 12%; text-align: right;">Cashier</th>
              </tr>
            </thead>
            <tbody>
      `;

      classEntries.forEach((classGroup) => {
        tableSectionsHtml += `
          <tr class="class-header-row">
            <td colspan="5">CLASS: ${classGroup.className}</td>
          </tr>
        `;

        classGroup.transactions.forEach((tx) => {
          tableSectionsHtml += `
            <tr class="tx-row">
              <td style="font-weight: var(--font-weight-bold);">${globalIndex}</td>
              <td style="font-family: 'Courier New', monospace; font-weight: var(--font-weight-bold);">${tx.student_id_code}</td>
              <td style="font-weight: var(--font-weight-bold);">${tx.student_name}</td>
              <td style="text-align: right; font-weight: var(--font-weight-heavy);">${tx.amount.toFixed(2)}</td>
              <td style="text-align: right; font-weight: var(--font-weight-bold);">${tx.cashier_username}</td>
            </tr>
          `;
          globalIndex++;
        });

        tableSectionsHtml += `
          <tr class="subtotal-tr">
            <td colspan="3" style="text-align: right; font-weight: var(--font-weight-heavy);">Subtotal (${classGroup.className}):</td>
            <td style="text-align: right; font-weight: var(--font-weight-heavy); border-top: 1px solid #000; border-bottom: 2px double #000;">${classGroup.subtotal.toFixed(2)}</td>
            <td></td>
          </tr>
        `;
      });

      if (classEntries.length > 1) {
        tableSectionsHtml += `
          <tr class="product-total-tr">
            <td colspan="3" style="text-align: right; font-weight: var(--font-weight-heavy);">TOTAL ${prodGroup.productName}:</td>
            <td style="text-align: right; font-weight: var(--font-weight-heavy); border-top: 1.5px solid #000; border-bottom: 3px double #000;">${prodGroup.productTotal.toFixed(2)}</td>
            <td></td>
          </tr>
        `;
      }

      tableSectionsHtml += `
            </tbody>
          </table>
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Transactions Ledger</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          *, *:before, *:after {
            box-sizing: border-box;
          }
          :root {
            --base-font-size: ${fontSize}pt;
            --font-weight-normal: ${isBold ? '700' : '600'};
            --font-weight-bold: ${isBold ? '800' : '700'};
            --font-weight-heavy: ${isBold ? '900' : '800'};
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #000;
            font-size: var(--base-font-size);
            line-height: 1.15;
            font-weight: var(--font-weight-normal);
            background-color: white;
            position: relative;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-25deg);
            font-size: 40pt;
            font-weight: 900;
            color: rgba(203, 213, 225, 0.18);
            z-index: -1;
            white-space: nowrap;
            pointer-events: none;
            text-transform: uppercase;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 3px;
          }
          .header-logo {
            width: 50px;
            vertical-align: middle;
            text-align: center;
          }
          .header-text {
            text-align: center;
            vertical-align: middle;
          }
          .header-text h2 {
            margin: 0;
            font-size: calc(var(--base-font-size) * 1.35);
            font-weight: var(--font-weight-heavy);
            color: #000;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            line-height: 1.1;
          }
          .header-text p {
            margin: 1px 0 0 0;
            font-size: calc(var(--base-font-size) * 0.95);
            font-weight: var(--font-weight-bold);
            color: #1e293b;
          }
          .divider {
            border-top: 1.5px solid #000;
            margin: 3px 0 4px 0;
          }
          .report-header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 3px 8px;
            margin-bottom: 6px;
            border-radius: 2px;
            font-size: calc(var(--base-font-size) * 0.95);
          }
          .report-title {
            font-size: calc(var(--base-font-size) * 1.15);
            font-weight: var(--font-weight-heavy);
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #000;
          }
          .report-meta-item {
            font-weight: var(--font-weight-normal);
          }
          .report-meta-item strong {
            font-weight: var(--font-weight-heavy);
            color: #000;
          }
          .product-section {
            margin-bottom: 8px;
          }
          .product-header {
            font-size: calc(var(--base-font-size) * 1.1);
            font-weight: var(--font-weight-heavy);
            color: #000;
            padding: 2px 6px;
            margin-bottom: 3px;
            text-transform: uppercase;
            background-color: #e2e8f0;
            border: 1px solid #cbd5e1;
            border-bottom: none;
            letter-spacing: 0.3px;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
            table-layout: fixed;
          }
          .report-table tr {
            page-break-inside: avoid;
          }
          .table-header-row th {
            color: #000;
            font-weight: var(--font-weight-heavy);
            padding: 2.5px 5px;
            border: 1px solid #475569;
            background-color: #f1f5f9;
            text-align: left;
            font-size: calc(var(--base-font-size) * 0.95);
          }
          .class-header-row td {
            background-color: #f8fafc;
            font-weight: var(--font-weight-heavy);
            font-size: calc(var(--base-font-size) * 0.95);
            padding: 2px 5px;
            border: 1px solid #64748b;
            text-transform: uppercase;
            color: #0f172a;
            letter-spacing: 0.2px;
          }
          .tx-row td {
            padding: 2px 5px;
            border: 1px solid #94a3b8;
            color: #000;
            font-size: var(--base-font-size);
          }
          .subtotal-tr td {
            padding: 2.5px 5px;
            font-size: calc(var(--base-font-size) * 0.95);
            background-color: #fafafa;
          }
          .product-total-tr td {
            padding: 3px 5px;
            font-size: calc(var(--base-font-size) * 1.0);
            background-color: #f1f5f9;
          }
          .grand-total-box {
            border-top: 1.5px solid #000;
            border-bottom: 3px double #000;
            padding: 4px 8px;
            font-size: calc(var(--base-font-size) * 1.15);
            font-weight: var(--font-weight-heavy);
            color: #000;
            margin-top: 8px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
            background-color: #f8fafc;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 14px;
            page-break-inside: avoid;
          }
          .sig-box {
            width: 180px;
            text-align: center;
            font-size: calc(var(--base-font-size) * 0.9);
            font-weight: var(--font-weight-bold);
            color: #000;
          }
          .sig-line {
            border-top: 1.5px solid #000;
            margin-top: 16px;
            padding-top: 2px;
            font-weight: var(--font-weight-heavy);
          }
          .stamp-box {
            width: 90px;
            height: 32px;
            border: 1.5px dashed #dc2626;
            border-radius: 3px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #dc2626;
            font-size: calc(var(--base-font-size) * 0.85);
            font-weight: var(--font-weight-heavy);
            transform: rotate(-3deg);
            margin-bottom: -10px;
            opacity: 0.9;
          }
          .footer-container {
            font-size: calc(var(--base-font-size) * 0.85);
            font-weight: var(--font-weight-normal);
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #cbd5e1;
            padding-top: 2px;
            margin-top: 8px;
          }
          @media print {
            body {
              padding: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="watermark">${orgConfig.org_name}</div>
        
        <table class="header-table">
          <tr>
            <td class="header-logo">
              ${orgConfig.logo_url ? `<img src="${orgConfig.logo_url}" style="max-height: 42px; max-width: 50px; object-fit: contain;" />` : `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 36px; height: 36px; color: #000;">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  <path d="M2 12h20M12 2v20" />
                </svg>
              `}
            </td>
            <td class="header-text">
              <h2>${orgConfig.org_name}</h2>
              <p>${orgConfig.location} &bull; ${orgConfig.telephone}</p>
            </td>
          </tr>
        </table>
        
        <div class="divider"></div>
        
        <div class="report-header-bar">
          <div class="report-title">Daily Fees Collection Ledger</div>
          <div class="report-meta-item">Academic Year: <strong>${academicYear}</strong></div>
          <div class="report-meta-item">Term: <strong>${termName}</strong></div>
          <div class="report-meta-item">Date: <strong>${formattedDate}</strong></div>
        </div>

        ${tableSectionsHtml}

        <div class="grand-total-box">
          <span>GRAND TOTAL DEPOSITS:</span>
          <span>Gh¢ ${grandTotal.toFixed(2)}</span>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="stamp-box">
              MANAGER
            </div>
            <div class="sig-line">Manager's Sign</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Sch Account Sign (Bursar)</div>
          </div>
        </div>

        <div class="footer-container">
          <span>Printed on ${printDate}</span>
          <span>Page 1 of 1</span>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintReport = async () => {
    if (txCount === 0) return;
    setShowPreviewModal(true);
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        backgroundColor: 'var(--bg-secondary)',
        padding: '16px 20px',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
          <span className="form-label" style={{ marginBottom: 0 }}>Select Date:</span>
          <input
            type="date"
            className="form-control"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            style={{ width: '180px' }}
          />
          <button className="btn btn-secondary" onClick={fetchReportData} style={{ padding: '8px 12px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={handlePrintReport} 
          disabled={txCount === 0 || loading}
          style={{ display: 'inline-flex', gap: '6px' }}
        >
          <Printer size={16} /> Print Report (A4)
        </button>
      </div>

      {/* FILTER OPTIONS */}
      {rawTransactions.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)',
          padding: '16px 20px',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '24px',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Product:</span>
            <select
              className="form-control"
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              style={{ width: '180px', padding: '4px 8px', height: '32px', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Products</option>
              {products.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Class:</span>
            <select
              className="form-control"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              style={{ width: '150px', padding: '4px 8px', height: '32px', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Classes</option>
              {classes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Cashier:</span>
            <select
              className="form-control"
              value={filterCashier}
              onChange={(e) => setFilterCashier(e.target.value)}
              style={{ width: '150px', padding: '4px 8px', height: '32px', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Cashiers</option>
              {cashiers.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: '32px', textAlign: 'left' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-danger)' }}>
            {error}
          </div>
        ) : txCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
            <FileText size={44} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
            <h3>No Deposits Recorded</h3>
            <p>There are no posted transactions recorded matching the selected filters on {new Date(reportDate).toLocaleDateString('en-GB')}.</p>
          </div>
        ) : (
          <div className="animate-scale-in">
            <div style={{ textAlign: 'center', borderBottom: '2px solid var(--text-primary)', paddingBottom: '16px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{orgConfig.org_name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{orgConfig.school_name ? `${orgConfig.school_name} - ` : ''}School Fees Summary Collection Ledger</p>
            </div>

            {Object.values(productGroups).map((prodGroup) => (
              <div key={prodGroup.productName} style={{ marginBottom: '32px' }}>
                <div style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--accent-primary-light)',
                  color: 'var(--accent-primary)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {prodGroup.productName}
                </div>

                {Object.values(prodGroup.classes).map((classGroup) => (
                  <div key={classGroup.className} style={{ marginBottom: '20px', paddingLeft: '8px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                      Class: {classGroup.className}
                    </h4>
                    
                    <div className="table-container" style={{ border: 'none' }}>
                      <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '8%' }}>R/N</th>
                            <th style={{ width: '22%' }}>Admission No</th>
                            <th style={{ width: '45%' }}>Student Name</th>
                            <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                            <th style={{ width: '10%', textAlign: 'right' }}>Cashier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classGroup.transactions.map((tx, idx) => (
                            <tr key={tx.id}>
                              <td>{idx + 1}</td>
                              <td style={{ fontFamily: 'monospace' }}>{tx.student_id_code}</td>
                              <td style={{ fontWeight: 600 }}>{tx.student_name}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>Gh¢ {tx.amount.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>{tx.cashier_username}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                      padding: '8px 16px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      marginTop: '6px',
                      fontSize: '0.88rem'
                    }}>
                      <span>Subtotal ({classGroup.className}):</span>
                      <span>Gh¢ {classGroup.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ))}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 800,
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color-focus)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.95rem',
                  marginTop: '12px'
                }}>
                  <span>Product Total ({prodGroup.productName}):</span>
                  <span>Gh¢ {prodGroup.productTotal.toFixed(2)}</span>
                </div>
              </div>
            ))}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 800,
              fontSize: '1.25rem',
              padding: '16px 24px',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              marginTop: '40px',
              marginBottom: '40px'
            }}>
              <span>GRAND TOTAL DEPOSITS:</span>
              <span>Gh¢ {grandTotal.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginTop: '60px', padding: '0 20px' }}>
              <div style={{ width: '40%', borderTop: '2px solid var(--text-primary)', textAlign: 'center', paddingTop: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
                Manager's Sign
              </div>
              <div style={{ width: '40%', borderTop: '2px solid var(--text-primary)', textAlign: 'center', paddingTop: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
                Sch Account Sign
              </div>
            </div>
          </div>
        )}
      </div>

      {/* REPORT PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="modal-overlay" style={{ zIndex: 10300 }}>
          <div className="modal-content animate-scale-in" style={{ maxWidth: '720px', width: '90%', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Daily Report Preview (A4 Portrait)</h3>
              <button className="btn btn-secondary" onClick={() => setShowPreviewModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>

            {/* Font Styling Controls */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Font Size (pt):</span>
                <input
                  type="range"
                  min="7"
                  max="15"
                  value={reportFontSize}
                  onChange={(e) => setReportFontSize(parseInt(e.target.value))}
                  style={{ width: '120px', cursor: 'pointer' }}
                />
                <input
                  type="number"
                  min="7"
                  max="15"
                  value={reportFontSize}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) setReportFontSize(Math.min(15, Math.max(7, val)));
                  }}
                  className="form-control"
                  style={{ width: '55px', padding: '4px 6px', textAlign: 'center', height: '30px', display: 'inline-block' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #cbd5e1', paddingLeft: '16px' }}>
                <input
                  type="checkbox"
                  id="report-bold-toggle"
                  checked={reportFontBold}
                  onChange={(e) => setReportFontBold(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="report-bold-toggle" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                  Bold Text
                </label>
              </div>
            </div>

            {/* A4 page scaled to fit preview window with scroll */}
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-sm)', 
              backgroundColor: '#f1f5f9',
              display: 'flex',
              justifyContent: 'center',
              padding: '16px 0',
              maxHeight: '480px',
              overflowY: 'auto'
            }}>
              <iframe
                title="Daily Report Preview"
                srcDoc={generateReportHtml(reportFontSize, reportFontBold)}
                style={{
                  width: '210mm',
                  height: '297mm',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  backgroundColor: 'white',
                  transform: 'scale(0.72)',
                  transformOrigin: 'top center',
                  marginBottom: '-83mm' // Offset bottom space due to scaling shrink
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
                  const printHtml = generateReportHtml(reportFontSize, reportFontBold);
                  await window.electronAPI.invoke('print-receipt', printHtml, { pageSize: 'A4' });
                }}
                style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
              >
                <Printer size={16} /> Print Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
