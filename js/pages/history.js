// =============================================
// History Page Module
// Grouped vehicle history from Firebase
// =============================================

let allHistoryLogs    = [];
let historyDebounceTimer = null;

async function initHistory() {
  const container = document.getElementById('history-container');
  container.innerHTML = `<div class="empty-state card-body" style="border-radius:12px;background:var(--surface)">Loading history…</div>`;

  try {
    allHistoryLogs = await FirebaseService.getAllEntryLogs();
    renderHistory(allHistoryLogs);
  } catch (e) {
    console.error('initHistory error:', e);
    container.innerHTML = `<div class="empty-state card-body" style="border-radius:12px;background:var(--surface)">Failed to load history. Check connection.</div>`;
    showToast('Could not load history', 'error');
  }
}

function debounceHistorySearch() {
  clearTimeout(historyDebounceTimer);
  historyDebounceTimer = setTimeout(() => {
    const val = (document.getElementById('history-filter')?.value || '').trim();
    filterHistory(val);
  }, 350);
}

function filterHistory(query) {
  if (!query) {
    renderHistory(allHistoryLogs);
    return;
  }
  const q = query.toUpperCase();
  const filtered = allHistoryLogs.filter(l =>
    (l.vehicleNumber || '').toUpperCase().includes(q) ||
    (l.driverName    || '').toLowerCase().includes(query.toLowerCase())
  );
  renderHistory(filtered);
}

function renderHistory(logs) {
  const container = document.getElementById('history-container');

  if (!logs || !logs.length) {
    container.innerHTML = `<div class="empty-state card-body" style="border-radius:12px;background:var(--surface)">No records found.</div>`;
    return;
  }

  // Group by vehicle number
  const grouped = {};
  logs.forEach(l => {
    const vnum = l.vehicleNumber || 'UNKNOWN';
    if (!grouped[vnum]) grouped[vnum] = [];
    grouped[vnum].push(l);
  });

  // Sort groups by most recent entry
  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const ta = latestTimestamp(a[1]);
    const tb = latestTimestamp(b[1]);
    return tb - ta;
  });

  container.innerHTML = sortedGroups.map(([vnum, entries]) => {
    const totalVisits  = entries.length;
    const lastEntry    = entries[0]; // already sorted desc
    const lastDate     = formatDate(lastEntry?.entryDate);
    const purposes     = [...new Set(entries.map(e => e.purpose).filter(Boolean))].join(', ');
    const isCurrentlyInside = entries.some(e => !e.exitDate && !e.exitTime);

    return `
      <div class="history-vehicle-card" id="hvc-${vnum}">
        <div class="history-vehicle-header" onclick="toggleVehicleHistory('${vnum}')">
          <div class="hv-left">
            <div>
              <div class="hv-vnum">${vnum}</div>
              <div class="hv-meta">${totalVisits} visit${totalVisits !== 1 ? 's' : ''} · Last: ${lastDate} · ${purposes || '—'}</div>
            </div>
          </div>
          <div class="hv-right">
            ${isCurrentlyInside ? '<span class="status-inside">Inside</span>' : ''}
            <span class="badge">${totalVisits}</span>
            <div class="hv-toggle" id="toggle-${vnum}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
        </div>
        <div class="history-vehicle-body" id="hvb-${vnum}">
          ${renderVehicleHistoryTable(entries, vnum)}
        </div>
      </div>
    `;
  }).join('');
}

function renderVehicleHistoryTable(entries, vnum) {
  // Show vehicle image if any entry has imageUrl
  const imageEntry = entries.find(e => e.imageUrl);
  const imgHtml = imageEntry
    ? `<div style="padding:0.75rem 1rem;border-bottom:1px solid var(--border)">
         <img src="${imageEntry.imageUrl}" alt="${vnum}" style="max-height:120px;border-radius:8px;object-fit:cover">
       </div>`
    : '';

  const rows = entries.map((e, i) => {
    const isInside = !e.exitDate && !e.exitTime;
    const duration = calculateDuration(e.entryDate, e.entryTime, e.exitDate, e.exitTime);
    return `
      <tr>
        <td style="font-weight:600;color:var(--text-2)">#${entries.length - i}</td>
        <td>${purposeBadge(e.purpose)}</td>
        <td>${esc(e.driverName)}</td>
        <td>${esc(e.mobileNumber)}</td>
        <td>${formatDate(e.entryDate)} ${formatTime(e.entryTime)}</td>
        <td>
          ${e.exitDate ? `${formatDate(e.exitDate)} ${formatTime(e.exitTime)}` : '<span style="color:var(--text-3)">—</span>'}
          ${duration ? `<div style="font-size:0.75rem;color:var(--accent);margin-top:2px">Duration: ${duration}</div>` : ''}
        </td>
        <td>${isInside ? '<span class="status-inside">Inside</span>' : '<span class="status-exited">Exited</span>'}</td>
        <td>
          <div style="display:flex;gap:0.3rem">
            ${isInside
              ? `<button class="btn btn-outline btn-sm btn-table" onclick="openExitModal('${e.id}','${esc(vnum)}')">Exit</button>`
              : `<button class="btn btn-outline btn-sm btn-table btn-clear-exit" onclick="clearExit('${e.id}','${esc(vnum)}')">Clear Exit</button>`}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    ${imgHtml}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th><th>Purpose</th><th>Driver</th><th>Mobile</th>
            <th>Entry</th><th>Exit</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function toggleVehicleHistory(vnum) {
  const body   = document.getElementById(`hvb-${vnum}`);
  const toggle = document.getElementById(`toggle-${vnum}`);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (toggle) toggle.classList.toggle('open', !isOpen);
}

function latestTimestamp(entries) {
  return entries.reduce((max, e) => {
    const t = e.createdAt?.toDate?.().getTime() || 0;
    return t > max ? t : max;
  }, 0);
}
