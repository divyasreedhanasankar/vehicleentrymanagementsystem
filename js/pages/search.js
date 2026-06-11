// =============================================
// Search Page Module
// =============================================

let searchDebounceTimer = null;
let searchResultsCache  = [];

function initSearch() {
  // Load all logs for searching
  performSearch();
}

// Debounced search triggered on keyup
function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(performSearch, 400);
}

async function performSearch() {
  const query    = (document.getElementById('search-query')?.value   || '').trim();
  const purpose  = document.getElementById('search-purpose')?.value  || '';
  const category = document.getElementById('search-category')?.value || '';
  const dateFrom = document.getElementById('search-date-from')?.value || '';
  const dateTo   = document.getElementById('search-date-to')?.value   || '';

  setSearchLoading(true);

  try {
    const allLogs = await FirebaseService.getAllEntryLogs();
    const filtered = FirebaseService.filterLogs(allLogs, { query, purpose, dateFrom, dateTo, category });

    searchResultsCache = filtered;
    renderSearchResults(filtered);
  } catch (e) {
    console.error('performSearch error:', e);
    showToast('Search failed – check connection', 'error');
    setSearchLoading(false);
  }
}

function setSearchLoading(loading) {
  const body  = document.getElementById('search-results-body');
  const count = document.getElementById('search-count');
  if (loading) {
    body.innerHTML = '<tr class="loading-row"><td colspan="8">Searching…</td></tr>';
    if (count) count.textContent = '…';
  }
}

function renderSearchResults(results) {
  const body  = document.getElementById('search-results-body');
  const count = document.getElementById('search-count');

  if (count) count.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;

  if (!results.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty-cell">No matching records found</td></tr>';
    return;
  }

  body.innerHTML = results.map(r => {
    const isInside = !r.exitDate && !r.exitTime;
    const duration = calculateDuration(r.entryDate, r.entryTime, r.exitDate, r.exitTime);
    return `
      <tr>
        <td class="vnum-cell">${esc(r.vehicleNumber)}</td>
        <td>${purposeBadge(r.purpose)}</td>
        <td>${esc(r.driverName)}</td>
        <td>${esc(r.mobileNumber)}</td>
        <td>${formatDate(r.entryDate)} ${r.entryTime ? formatTime(r.entryTime) : ''}</td>
        <td>
          ${r.exitDate ? `${formatDate(r.exitDate)} ${formatTime(r.exitTime)}` : '<span style="color:var(--text-3)">—</span>'}
          ${duration ? `<div style="font-size:0.75rem;color:var(--accent);margin-top:2px">Duration: ${duration}</div>` : ''}
        </td>
        <td>
          ${isInside
            ? '<span class="status-inside">Inside</span>'
            : '<span class="status-exited">Exited</span>'}
        </td>
        <td>
          <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
            ${isInside
              ? `<button class="btn btn-outline btn-sm btn-table" onclick="openExitModal('${r.id}','${esc(r.vehicleNumber)}')">Exit</button>`
              : `<button class="btn btn-outline btn-sm btn-table btn-clear-exit" onclick="clearExit('${r.id}','${esc(r.vehicleNumber)}')">Clear Exit</button>`}
            <button class="btn btn-outline btn-sm btn-table" onclick="viewVehicleHistory('${esc(r.vehicleNumber)}')">History</button>
            <button class="btn btn-danger btn-sm btn-table" onclick="confirmDeleteLog('${r.id}')">Del</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function clearSearch() {
  const ids = ['search-query','search-purpose','search-category','search-date-from','search-date-to'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  performSearch();
}

function viewVehicleHistory(vnum) {
  navigateTo('history');
  setTimeout(() => {
    const filterEl = document.getElementById('history-filter');
    if (filterEl) { filterEl.value = vnum; filterHistory(vnum); }
  }, 200);
}

async function confirmDeleteLog(id) {
  if (!confirm('Delete this entry log? This cannot be undone.')) return;
  try {
    await FirebaseService.deleteEntryLog(id);
    showToast('Entry deleted', 'success');
    performSearch();
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

// Escape HTML
function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
