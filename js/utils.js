// =============================================
// Utils – Shared helper functions
// =============================================

// Configuration - set to 0 to count all unique vehicles as frequent
window.FREQUENT_VISITOR_THRESHOLD = 0;

// Helper to format Date string MH02 → DD-MM-YYYY
function formatToDDMMYYYY(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

// Helper to calculate stay duration (completed movements)
function calculateDuration(entryDate, entryTime, exitDate, exitTime) {
  if (!entryDate || !entryTime || !exitDate || !exitTime) return null;
  try {
    const entryDT = new Date(`${entryDate}T${entryTime}:00`);
    const exitDT = new Date(`${exitDate}T${exitTime}:00`);
    const diffMs = exitDT.getTime() - entryDT.getTime();
    if (isNaN(diffMs) || diffMs < 0) return null;

    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    const hrStr = hrs === 1 ? '1 Hour' : `${hrs} Hours`;
    const minStr = mins === 1 ? '1 Minute' : `${mins} Minutes`;

    if (hrs > 0 && mins > 0) {
      return `${hrStr} ${minStr}`;
    } else if (hrs > 0) {
      return hrStr;
    } else {
      return minStr;
    }
  } catch (e) {
    console.error('Duration calculation error:', e);
    return null;
  }
}

// ── Date / Time helpers ───────────────────────────────


function todayISO() {
  // Use LOCAL date (not UTC) to avoid timezone issues for India (UTC+5:30)
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nowTimeHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return dateStr; }
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  try {
    const [h, m] = timeStr.split(':');
    const hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const hr12 = hr % 12 || 12;
    return `${String(hr12).padStart(2,'0')}:${m} ${ampm}`;
  } catch { return timeStr; }
}

function formatDateTime(ts) {
  if (!ts) return '—';
  let d;
  if (ts && ts.toDate) d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else return '—';
  return d.toLocaleString('en-IN', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12: true
  });
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// ── Toast notifications ───────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info:    '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  toast.innerHTML = (icons[type] || icons.info) + `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ── Debounce ──────────────────────────────────────────

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Purpose badge color ───────────────────────────────

function purposeBadge(purpose) {
  const colors = {
    Pickup:   '#3b82f6',
    Delivery: '#22c55e',
    Canteen:  '#f59e0b',
    Others:   '#a855f7',
  };
  const color = colors[purpose] || '#64748b';
  return `<span style="background:${color}22;border:1px solid ${color}55;color:${color};padding:0.15rem 0.5rem;border-radius:4px;font-size:0.7rem;font-weight:600">${purpose || '—'}</span>`;
}

// ── Excel Export (using SheetJS) ──────────────────────

function exportToExcel(data, filename = 'VEMS_Report') {
  if (!window.XLSX) { showToast('SheetJS not loaded', 'error'); return; }
  if (!data || data.length === 0) { showToast('No data to export', 'warning'); return; }

  const headers = [
    'Vehicle No','Purpose','Driver Name','Mobile','Persons',
    'Entry Date','Entry Time','Exit Date','Exit Time',
    'Contact Person','Shipment Method','Remarks',
    'DL No','DL Expiry','Insurance No','Insurance Expiry',
    'Pollution Cert No','Pollution Expiry',
    'Permit No','Permit Expiry','Reg No','Reg Expiry'
  ];

  const rows = data.map(r => [
    r.vehicleNumber      || '',
    r.purpose            || '',
    r.driverName         || '',
    r.mobileNumber       || '',
    r.numberOfPersons    || '',
    r.entryDate          || '',
    r.entryTime          || '',
    r.exitDate           || '',
    r.exitTime           || '',
    r.contactPerson      || '',
    r.shipmentMethod     || '',
    r.remarks            || '',
    r.drivingLicenseNumber       || '',
    r.drivingLicenseExpiryDate   || '',
    r.insuranceNumber            || '',
    r.insuranceExpiryDate        || '',
    r.pollutionCertificateNumber || '',
    r.pollutionCertificateExpiryDate || '',
    r.vehiclePermitNumber        || '',
    r.vehiclePermitExpiryDate    || '',
    r.vehicleRegistrationNumber  || '',
    r.vehicleRegistrationExpiryDate || ''
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${filename}_${todayISO()}.xlsx`);
  showToast('Excel exported successfully', 'success');
}

// ── PDF Export (using jsPDF + AutoTable) ─────────────

function exportToPDF(data, title = 'VEMS Report') {
  if (!window.jspdf) { showToast('jsPDF not loaded', 'error'); return; }
  if (!data || data.length === 0) { showToast('No data to export', 'warning'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(16);
  doc.setTextColor(0, 210, 216);
  doc.text('VEMS – Vehicle Entry Management System', 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${title}  ·  Generated: ${new Date().toLocaleString('en-IN')}`, 14, 23);

  // ── Page 1: Entry / Exit details ──
  const headers = [
    'Vehicle No','Purpose','Driver','Mobile','Persons',
    'Entry Date','Entry Time','Exit Date','Exit Time',
    'Contact','Shipment','Remarks'
  ];

  const rows = data.map(r => [
    r.vehicleNumber   || '',
    r.purpose         || '',
    r.driverName      || '',
    r.mobileNumber    || '',
    r.numberOfPersons || '',
    r.entryDate       || '',
    r.entryTime       || '',
    r.exitDate        || '',
    r.exitTime        || '',
    r.contactPerson   || '',
    r.shipmentMethod  || '',
    r.remarks         || ''
  ]);

  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 55, 80], textColor: [0, 210, 216], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [13, 21, 38] },
    bodyStyles: { textColor: [200, 215, 240] },
    theme: 'grid'
  });

  // ── Page 2: Document details ──
  const docHeaders = [
    'Vehicle No',
    'DL No.', 'DL Expiry',
    'Insurance No.', 'Insurance Expiry',
    'Pollution No.', 'Pollution Expiry',
    'Permit No.', 'Permit Expiry',
    'Reg. No.', 'Reg. Expiry'
  ];

  const docRows = data.map(r => [
    r.vehicleNumber || '',
    r.drivingLicenseNumber           || '—',
    r.drivingLicenseExpiryDate       || '—',
    r.insuranceNumber                || '—',
    r.insuranceExpiryDate            || '—',
    r.pollutionCertificateNumber     || '—',
    r.pollutionCertificateExpiryDate || '—',
    r.vehiclePermitNumber            || '—',
    r.vehiclePermitExpiryDate        || '—',
    r.vehicleRegistrationNumber      || '—',
    r.vehicleRegistrationExpiryDate  || '—'
  ]);

  doc.addPage();
  doc.setFontSize(13);
  doc.setTextColor(0, 210, 216);
  doc.text('Document Details', 14, 14);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${title}  ·  Generated: ${new Date().toLocaleString('en-IN')}`, 14, 21);

  doc.autoTable({
    head: [docHeaders],
    body: docRows,
    startY: 26,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [0, 55, 80], textColor: [0, 210, 216], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [13, 21, 38] },
    bodyStyles: { textColor: [200, 215, 240] },
    theme: 'grid'
  });

  doc.save(`VEMS_Report_${todayISO()}.pdf`);
  showToast('PDF exported successfully', 'success');
}

// ── Firebase connection status ────────────────────────

function setFirebaseStatus(connected, customLabel) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;
  if (connected) {
    dot.className = 'status-dot connected';
    text.textContent = customLabel || 'Firebase connected';
  } else if (customLabel === 'Local Mode') {
    dot.className = 'status-dot local-mode';
    text.textContent = 'Local Mode';
  } else {
    dot.className = 'status-dot error';
    text.textContent = customLabel || 'Disconnected';
  }
}

// ── Document and Risk Helpers ──────────────────────────

function checkDocumentStatus(expiryDateStr) {
  if (!expiryDateStr) return { status: 'Missing', text: 'Missing', color: '#64748b', bg: 'rgba(100,116,139,0.15)', daysLeft: null };
  try {
    const today = new Date(todayISO() + 'T00:00:00');
    const expiry = new Date(expiryDateStr + 'T00:00:00');
    const diffMs = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { status: 'Expired', text: 'Expired', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', daysLeft: diffDays };
    } else if (diffDays <= 30) {
      return { status: 'Expires Soon', text: `Expires in ${diffDays} Day${diffDays !== 1 ? 's' : ''}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', daysLeft: diffDays };
    } else {
      return { status: 'Valid', text: 'Valid', color: '#10b981', bg: 'rgba(16,185,129,0.12)', daysLeft: diffDays };
    }
  } catch (e) {
    return { status: 'Invalid', text: 'Invalid Date', color: '#64748b', bg: 'rgba(100,116,139,0.15)', daysLeft: null };
  }
}

function calculateRiskScore(vehicleDoc, logsToday) {
  const riskFactors = [];
  
  // 1. Expired documents check
  const docs = [
    vehicleDoc.drivingLicenseExpiryDate,
    vehicleDoc.insuranceExpiryDate,
    vehicleDoc.pollutionCertificateExpiryDate,
    vehicleDoc.vehiclePermitExpiryDate,
    vehicleDoc.vehicleRegistrationExpiryDate
  ];
  const hasExpired = docs.some(d => d && checkDocumentStatus(d).status === 'Expired');
  if (hasExpired) {
    riskFactors.push('Expired Documents');
  }

  // 2. Same day visits
  if (logsToday && logsToday.length > 3) {
    riskFactors.push('Frequent Same-Day Visits');
  }

  // 3. Missing contact details
  if (!vehicleDoc.mobileNumber) {
    riskFactors.push('Missing Contact Information');
  }

  let level = 'Low';
  let color = '#10b981'; // Green
  let bg = 'rgba(16,185,129,0.12)';
  if (riskFactors.length === 1) {
    level = 'Medium';
    color = '#f59e0b'; // Orange
    bg = 'rgba(245,158,11,0.12)';
  } else if (riskFactors.length > 1) {
    level = 'High';
    color = '#ef4444'; // Red
    bg = 'rgba(239,68,68,0.12)';
  }

  return { level, riskFactors, color, bg };
}

