// =============================================
// Reports Page Module
// =============================================

let reportDataCache = [];

async function initReports() {
  // Default date range: current month
  const today  = todayISO();
  const fromEl = document.getElementById('report-date-from');
  const toEl   = document.getElementById('report-date-to');
  if (fromEl && !fromEl.value) {
    // First day of current month
    fromEl.value = today.substring(0, 7) + '-01';
  }
  if (toEl && !toEl.value) {
    toEl.value = today;
  }
  generateReport();
}

async function generateReport() {
  const type     = document.getElementById('report-type')?.value || 'all';
  const dateFrom = document.getElementById('report-date-from')?.value || '';
  const dateTo   = document.getElementById('report-date-to')?.value   || '';

  const body  = document.getElementById('report-table-body');
  const count = document.getElementById('report-count');
  body.innerHTML = '<tr class="loading-row"><td colspan="22">Loading…</td></tr>';
  if (count) count.textContent = '…';

  try {
    const allLogs = await FirebaseService.getAllEntryLogs();

    let filtered = allLogs;

    // Date filter
    if (dateFrom) filtered = filtered.filter(r => r.entryDate >= dateFrom);
    if (dateTo)   filtered = filtered.filter(r => r.entryDate <= dateTo);

    // Type filter
    if (type === 'entries') {
      // All that have entry date (all records)
    } else if (type === 'exits') {
      filtered = filtered.filter(r => r.exitDate && r.exitTime);
    } else if (type !== 'all') {
      // Purpose filter
      filtered = filtered.filter(r => r.purpose === type);
    }

    reportDataCache = filtered;
    renderReportTable(filtered);

    if (count) count.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;

  } catch (e) {
    console.error('generateReport error:', e);
    body.innerHTML = '<tr><td colspan="22" class="empty-cell">Failed to load data</td></tr>';
    showToast('Could not generate report', 'error');
  }
}

function renderReportTable(data) {
  const body = document.getElementById('report-table-body');

  if (!data.length) {
    body.innerHTML = '<tr><td colspan="22" class="empty-cell">No data in selected range</td></tr>';
    return;
  }

  body.innerHTML = data.map(r => {
    const duration = calculateDuration(r.entryDate, r.entryTime, r.exitDate, r.exitTime);

    // Helper: format a document expiry cell with colour badge
    function expiryCell(dateVal) {
      if (!dateVal) return '<span style="color:var(--text-3)">—</span>';
      const res = checkDocumentStatus(dateVal);
      const display = formatDate(dateVal);
      return `<div>${display}</div><div style="font-size:0.68rem;font-weight:700;color:${res.color};margin-top:2px">${res.text}</div>`;
    }

    return `
    <tr>
      <td class="vnum-cell">${esc(r.vehicleNumber)}</td>
      <td>${purposeBadge(r.purpose)}</td>
      <td>${esc(r.driverName)}</td>
      <td>${esc(r.mobileNumber)}</td>
      <td>${esc(r.numberOfPersons)}</td>
      <td>${formatDate(r.entryDate)}</td>
      <td>${formatTime(r.entryTime)}</td>
      <td>${r.exitDate ? formatDate(r.exitDate) : '<span style="color:var(--text-3)">—</span>'}</td>
      <td>
        ${r.exitTime ? formatTime(r.exitTime) : '<span style="color:var(--text-3)">—</span>'}
        ${duration ? `<div style="font-size:0.72rem;color:var(--accent);margin-top:2px">Duration: ${duration}</div>` : ''}
      </td>
      <td>${esc(r.contactPerson)}</td>
      <td>${esc(r.shipmentMethod)}</td>
      <td>${esc(r.remarks)}</td>
      <td>${esc(r.drivingLicenseNumber)}</td>
      <td>${expiryCell(r.drivingLicenseExpiryDate)}</td>
      <td>${esc(r.insuranceNumber)}</td>
      <td>${expiryCell(r.insuranceExpiryDate)}</td>
      <td>${esc(r.pollutionCertificateNumber)}</td>
      <td>${expiryCell(r.pollutionCertificateExpiryDate)}</td>
      <td>${esc(r.vehiclePermitNumber)}</td>
      <td>${expiryCell(r.vehiclePermitExpiryDate)}</td>
      <td>${esc(r.vehicleRegistrationNumber)}</td>
      <td>${expiryCell(r.vehicleRegistrationExpiryDate)}</td>
    </tr>
  `;
  }).join('');
}

function exportExcel() {
  if (!reportDataCache.length) {
    showToast('Generate a report first', 'warning');
    return;
  }
  const type  = document.getElementById('report-type')?.value || 'all';
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  exportToExcel(reportDataCache, `VEMS_${label}_Report`);
}

function exportPDF() {
  if (!reportDataCache.length) {
    showToast('Generate a report first', 'warning');
    return;
  }
  const type  = document.getElementById('report-type')?.value || 'all';
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  exportToPDF(reportDataCache, `${label} Report`);
}
