// =============================================
// Drivers Page Module
// Search drivers, show visit stats & risk score
// All data from live Firebase Firestore
// =============================================

let driversCache = {};
let selectedDriverKey = null;
let driverSearchTimer = null;

function initDrivers() {
  selectedDriverKey = null;
  const detailCard = document.getElementById('driver-detail-card');
  const detailEmpty = document.getElementById('driver-detail-empty');
  if (detailCard) detailCard.style.display = 'none';
  if (detailEmpty) detailEmpty.style.display = 'block';

  const queryEl = document.getElementById('driver-search-query');
  if (queryEl) queryEl.value = '';

  loadDriversData();
}

async function loadDriversData() {
  const body = document.getElementById('drivers-list-body');
  if (body) {
    body.innerHTML = '<tr><td colspan="5" class="empty-cell"><span class="dot-loader"></span> Loading drivers…</td></tr>';
  }

  try {
    const logs = await FirebaseService.getAllEntryLogs();
    const vehicles = await FirebaseService.getAllVehicles();

    // Map of normalized plate to vehicle doc
    const vehicleMap = {};
    vehicles.forEach(v => {
      const vnum = FirebaseService.normalize(v.vehicleNumber);
      if (vnum) vehicleMap[vnum] = v;
    });

    const drivers = {};
    const today = todayISO();

    logs.forEach(l => {
      if (!l.driverName) return;
      const nameClean = l.driverName.trim();
      if (!nameClean) return;
      const dKey = nameClean.toLowerCase();

      if (!drivers[dKey]) {
        drivers[dKey] = {
          key: dKey,
          name: nameClean,
          mobile: '',
          visits: 0,
          vehicles: new Set(),
          logs: [],
          logsToday: []
        };
      }

      const d = drivers[dKey];
      d.visits++;
      if (l.mobileNumber && !d.mobile) {
        d.mobile = l.mobileNumber;
      }
      if (l.vehicleNumber) {
        d.vehicles.add(l.vehicleNumber.toUpperCase().trim());
      }
      d.logs.push(l);
      if (l.entryDate === today) {
        d.logsToday.push(l);
      }
    });

    // Calculate risk score for each driver using their latest vehicle
    Object.values(drivers).forEach(d => {
      const latestLog = d.logs[0];
      const latestVnum = latestLog ? FirebaseService.normalize(latestLog.vehicleNumber) : null;
      const latestVehicleDoc = latestVnum ? (vehicleMap[latestVnum] || { vehicleNumber: latestLog.vehicleNumber }) : {};
      
      // Ensure mobile number is evaluated from driver's details if missing in vehicle doc
      const evalDoc = { ...latestVehicleDoc };
      if (!evalDoc.mobileNumber && d.mobile) {
        evalDoc.mobileNumber = d.mobile;
      }

      d.risk = calculateRiskScore(evalDoc, d.logsToday);
      d.latestVehicleDoc = latestVehicleDoc;
    });

    driversCache = drivers;
    renderDriversList(Object.values(drivers));

  } catch (e) {
    console.error('loadDriversData error:', e);
    if (body) {
      body.innerHTML = '<tr><td colspan="5" class="empty-cell">Failed to load drivers</td></tr>';
    }
  }
}

function renderDriversList(driversList) {
  const body = document.getElementById('drivers-list-body');
  const countEl = document.getElementById('drivers-count');
  if (!body) return;

  if (countEl) countEl.textContent = `${driversList.length} driver${driversList.length !== 1 ? 's' : ''}`;

  if (driversList.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="empty-cell">No drivers found</td></tr>';
    return;
  }

  body.innerHTML = driversList.map(d => {
    return `
      <tr>
        <td style="font-weight:600; color:var(--text);">${esc(d.name)}</td>
        <td>${esc(d.mobile) || '—'}</td>
        <td>${d.visits}</td>
        <td>
          <span style="display:inline-block; padding:0.18rem 0.55rem; border-radius:4px; background:${d.risk.bg}; color:${d.risk.color}; font-size:0.7rem; font-weight:600; border:1px solid ${d.risk.color}30">
            ${d.risk.level}
          </span>
        </td>
        <td>
          <button class="btn btn-outline btn-sm btn-table" onclick="viewDriverProfile('${esc(d.key)}')">Profile</button>
        </td>
      </tr>
    `;
  }).join('');
}

function viewDriverProfile(dKey) {
  const d = driversCache[dKey];
  if (!d) return;

  selectedDriverKey = dKey;

  const detailCard = document.getElementById('driver-detail-card');
  const detailEmpty = document.getElementById('driver-detail-empty');

  if (detailCard) detailCard.style.display = 'block';
  if (detailEmpty) detailEmpty.style.display = 'none';

  // Populate fields
  document.getElementById('driver-detail-name').textContent = d.name;
  document.getElementById('driver-detail-visits').textContent = `${d.visits} visit${d.visits !== 1 ? 's' : ''}`;
  document.getElementById('driver-detail-mobile').textContent = d.mobile || '—';

  // Vehicles
  const vehiclesContainer = document.getElementById('driver-detail-vehicles');
  if (vehiclesContainer) {
    vehiclesContainer.innerHTML = Array.from(d.vehicles).map(vnum => {
      return `<span class="visit-purpose" style="margin-right:0.25rem; font-size:0.72rem; letter-spacing:0.04em;">${esc(vnum)}</span>`;
    }).join('') || '—';
  }

  // Risk Badge & Factors
  const riskBadge = document.getElementById('driver-detail-risk-badge');
  const riskFactors = document.getElementById('driver-detail-risk-factors');
  if (riskBadge) {
    riskBadge.textContent = d.risk.level;
    riskBadge.style.color = '#000';
    riskBadge.style.backgroundColor = d.risk.color;
  }
  if (riskFactors) {
    if (d.risk.riskFactors.length > 0) {
      riskFactors.innerHTML = '<strong style="color:var(--text-3);">Risk Factors:</strong><br>' + d.risk.riskFactors.map(f => `⚠ ${f}`).join('<br>');
    } else {
      riskFactors.innerHTML = '<span style="color:var(--green);">No active risk factors.</span>';
    }
  }

  // Recent Visits list
  const visitsList = document.getElementById('driver-detail-visits-list');
  if (visitsList) {
    visitsList.innerHTML = d.logs.slice(0, 10).map(v => {
      return `
        <div style="background:var(--surface2); padding:0.6rem; border-radius:6px; font-size:0.75rem; border:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.2rem;">
            <strong style="color:var(--accent);">${esc(v.vehicleNumber)}</strong>
            <span style="color:var(--text-3); font-size:0.7rem;">${formatDate(v.entryDate)}</span>
          </div>
          <div style="color:var(--text-2);">Purpose: ${esc(v.purpose)} · ${v.category ? v.category.toUpperCase() : 'INWARD'}</div>
          <div style="color:var(--text-3); font-size:0.7rem; margin-top:0.15rem;">
            In: ${v.entryTime ? formatTime(v.entryTime) : '—'} | Out: ${v.exitTime ? formatTime(v.exitTime) : 'Inside'}
          </div>
        </div>
      `;
    }).join('');
  }
}

function debounceDriverSearch() {
  clearTimeout(driverSearchTimer);
  driverSearchTimer = setTimeout(performDriverSearch, 300);
}

function performDriverSearch() {
  const query = (document.getElementById('driver-search-query')?.value || '').toLowerCase().trim();
  const allDrivers = Object.values(driversCache);

  if (!query) {
    renderDriversList(allDrivers);
    return;
  }

  const filtered = allDrivers.filter(d => {
    return d.name.toLowerCase().includes(query) || d.mobile.includes(query);
  });

  renderDriversList(filtered);
}

function clearDriverSearch() {
  const queryEl = document.getElementById('driver-search-query');
  if (queryEl) queryEl.value = '';
  renderDriversList(Object.values(driversCache));
}

// Escaping helper
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
