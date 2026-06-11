// =============================================
// Dashboard Page Module
// Inward / Outward / Others / Interview stats
// All data from Firebase Firestore (no mocks)
// =============================================

let dashboardUnsubscribe = null;

// Inward purposes (for legacy records without category field)
const DASH_INWARD_PURPOSES = new Set([
  'Delivery (Inward)', 'Material Receipt', 'Vendor Visit', 'Service Visit', 'Canteen Supply'
]);
// Outward purposes
const DASH_OUTWARD_PURPOSES = new Set([
  'Pickup (Outward)', 'Material Dispatch', 'Return Material', 'Vendor Exit', 'Employee Transport'
]);

function initDashboard() {
  // Set today's date in header
  const dateEl = document.getElementById('dashboard-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Tear down previous subscription
  if (dashboardUnsubscribe) {
    try { dashboardUnsubscribe(); } catch (e) {}
    dashboardUnsubscribe = null;
  }

  // Real-time subscription to Firestore
  dashboardUnsubscribe = FirebaseService.subscribeToEntryLogs((err, logs) => {
    if (err) { console.error('Dashboard subscription error:', err); return; }
    renderDashboard(logs);
  });
}

// Infer category from log (supports both old and new records)
function getLogCategory(log) {
  if (log.category) return log.category;
  if (DASH_INWARD_PURPOSES.has(log.purpose))  return 'inward';
  if (DASH_OUTWARD_PURPOSES.has(log.purpose)) return 'outward';
  return 'others';
}

function renderDashboard(logs) {
  const today     = todayISO();
  const todayLogs = logs.filter(l => l.entryDate === today);

  const inward     = todayLogs.filter(l => getLogCategory(l) === 'inward');
  // Outward = any record whose exitDate is today OR a new outward entry made today
  const outward    = logs.filter(l => l.exitDate === today || (l.entryDate === today && getLogCategory(l) === 'outward'));
  const inside     = logs.filter(l => !l.exitDate && !l.exitTime);
  const exits      = logs.filter(l => l.exitDate === today);

  // ── Calculate new dashboard metrics ─────────────────
  // 1. Frequent Visitors Count (distinct vehicles with visits > FREQUENT_VISITOR_THRESHOLD)
  const visitsPerVehicle = {};
  logs.forEach(l => {
    const vnum = FirebaseService.normalize(l.vehicleNumber);
    if (vnum) {
      visitsPerVehicle[vnum] = (visitsPerVehicle[vnum] || 0) + 1;
    }
  });

  // FREQUENT VISITORS = total distinct vehicle numbers ever seen in the system
  const frequentVisitorsCount = Object.keys(visitsPerVehicle).length;

  // 2. Total People Inside (sum of numberOfPersons for entries currently inside)
  const totalPeopleInside = inside.reduce((sum, l) => {
    const num = parseInt(l.numberOfPersons, 10);
    return sum + (isNaN(num) ? 1 : num);
  }, 0);

  // 3. Average Stay Duration
  let totalMins = 0;
  let completedCount = 0;
  logs.forEach(l => {
    if (l.entryDate && l.entryTime && l.exitDate && l.exitTime) {
      try {
        const entryDT = new Date(`${l.entryDate}T${l.entryTime}:00`);
        const exitDT = new Date(`${l.exitDate}T${l.exitTime}:00`);
        const diffMs = exitDT.getTime() - entryDT.getTime();
        if (!isNaN(diffMs) && diffMs >= 0) {
          totalMins += Math.floor(diffMs / 60000);
          completedCount++;
        }
      } catch (e) {
        console.error('Error parsing stay duration: ', e);
      }
    }
  });
  const avgMins = completedCount > 0 ? Math.round(totalMins / completedCount) : 0;

  function formatMinsToDuration(totalMins) {
    if (totalMins <= 0) return '—';
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const hrStr = hrs === 1 ? '1 Hour' : `${hrs} Hours`;
    const minStr = mins === 1 ? '1 Minute' : `${mins} Minutes`;
    if (hrs > 0 && mins > 0) {
      return `${hrStr} ${minStr}`;
    } else if (hrs > 0) {
      return hrStr;
    } else {
      return minStr;
    }
  }
  const avgStayDurationStr = formatMinsToDuration(avgMins);

  // 4. Most Visited Vehicle
  let mostVisitedVehicle = '—';
  let maxVisits = 0;
  Object.entries(visitsPerVehicle).forEach(([vnum, count]) => {
    if (count > maxVisits) {
      maxVisits = count;
      mostVisitedVehicle = vnum;
    }
  });
  const mostVisitedVehicleStr = maxVisits > 0 ? `${mostVisitedVehicle} (${maxVisits} visit${maxVisits !== 1 ? 's' : ''})` : '—';

  // 5. Busiest Day of Week
  const weekdayCounts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
  logs.forEach(l => {
    if (l.entryDate) {
      const parts = l.entryDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const date = new Date(year, month - 1, day);
          const dayOfWeek = date.getDay();
          weekdayCounts[dayOfWeek]++;
        }
      }
    }
  });
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let busiestDayIdx = 0;
  let maxDayCount = -1;
  Object.entries(weekdayCounts).forEach(([dayIdx, count]) => {
    if (count > maxDayCount) {
      maxDayCount = count;
      busiestDayIdx = Number(dayIdx);
    }
  });
  const busiestDayStr = maxDayCount > 0 ? weekdays[busiestDayIdx] : '—';

  // 6. Average Vehicles Per Day & Hour
  const uniqueDays = new Set();
  logs.forEach(l => {
    if (l.entryDate) uniqueDays.add(l.entryDate);
  });
  const daysCount = uniqueDays.size || 1;
  const avgVehiclesPerDay = (logs.length / daysCount).toFixed(1);
  const avgVehiclesPerHour = (logs.length / (daysCount * 24)).toFixed(2);

  const avgVehiclesPerDayStr = `${avgVehiclesPerDay} / Day`;
  const avgVehiclesPerHourStr = `${avgVehiclesPerHour} / Hour`;

  // ── Update stat cards ───────────────────────────────
  const statsMap = {
    'stat-entries':    todayLogs.length,
    'stat-inward':     inward.length,
    'stat-outward':    outward.length,
    'stat-frequent-visitors': frequentVisitorsCount,
    'stat-people-inside':     totalPeopleInside,
    'stat-avg-stay':          avgStayDurationStr,
    'stat-most-visited':      mostVisitedVehicleStr,
    'stat-busiest-day':       busiestDayStr,
    'stat-avg-vehicles-day':  avgVehiclesPerDayStr,
    'stat-avg-vehicles-hour': avgVehiclesPerHourStr
  };
  Object.entries(statsMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });

  // ── Inside badge ────────────────────────────────────
  const insideBadge = document.getElementById('inside-badge');
  if (insideBadge) insideBadge.textContent = `${inside.length} active`;

  // ── Vehicles Currently Inside ───────────────────────
  const insideList = document.getElementById('vehicles-inside-list');
  if (insideList) {
    if (inside.length === 0) {
      insideList.innerHTML = '<div class="empty-state">No vehicles inside</div>';
    } else {
      insideList.innerHTML = inside.slice(0, 10).map(v => {
        const cat = getLogCategory(v);
        return `<div class="activity-item">
          <div>
            <div class="activity-vnum">${v.vehicleNumber}</div>
            <div class="activity-purpose">
              ${v.purpose || '—'} &nbsp;<span class="cat-pill cat-${cat}">${cat}</span>
            </div>
            <div class="activity-time">In: ${formatDate(v.entryDate)} ${v.entryTime ? formatTime(v.entryTime) : ''}</div>
          </div>
          <button class="btn-exit-small" onclick="openExitModal('${v.id}','${v.vehicleNumber}')">Exit</button>
        </div>`;
      }).join('');
    }
  }

  // ── Recent Entries ──────────────────────────────────
  const recentList = document.getElementById('recent-entries-list');
  if (recentList) {
    if (todayLogs.length === 0) {
      recentList.innerHTML = '<div class="empty-state">No activity yet</div>';
    } else {
      recentList.innerHTML = todayLogs.slice(0, 6).map(v => {
        const cat = getLogCategory(v);
        return `<div class="activity-item">
          <div>
            <div class="activity-vnum">${v.vehicleNumber}</div>
            <div class="activity-purpose">
              ${v.purpose || '—'} &nbsp;<span class="cat-pill cat-${cat}">${cat}</span>
            </div>
            ${v.driverName ? `<div class="activity-time">${v.driverName}</div>` : ''}
          </div>
          <div class="activity-time">${v.entryTime ? formatTime(v.entryTime) : '—'}</div>
        </div>`;
      }).join('');
    }
  }

  // ── Recent Exits ────────────────────────────────────
  const exitsList = document.getElementById('recent-exits-list');
  if (exitsList) {
    if (exits.length === 0) {
      exitsList.innerHTML = '<div class="empty-state">No exits today</div>';
    } else {
      exitsList.innerHTML = exits.slice(0, 6).map(v => `
        <div class="activity-item">
          <div>
            <div class="activity-vnum">${v.vehicleNumber}</div>
            <div class="activity-purpose">${v.purpose || '—'}</div>
          </div>
          <div class="activity-time">${v.exitTime ? formatTime(v.exitTime) : '—'}</div>
        </div>`).join('');
    }
  }
}

// ── Dashboard Stat Card Click Actions ───────────────────
// Each card navigates to the relevant page/section.
// Zero changes to existing logic — purely additive.
function statCardAction(type) {
  const today = todayISO();

  switch (type) {

    // ── Row 1: Today's entry counts ──────────────────────
    case 'entries-today':
      navigateTo('search');
      setTimeout(() => {
        const from = document.getElementById('search-date-from');
        const to   = document.getElementById('search-date-to');
        const q    = document.getElementById('search-query');
        const pur  = document.getElementById('search-purpose');
        const cat  = document.getElementById('search-category');
        if (from) from.value = today;
        if (to)   to.value   = today;
        if (q)    q.value    = '';
        if (pur)  pur.value  = '';
        if (cat)  cat.value  = '';
        performSearch();
      }, 150);
      break;

    case 'inward-today':
      navigateTo('search');
      setTimeout(() => {
        const from = document.getElementById('search-date-from');
        const to   = document.getElementById('search-date-to');
        const q    = document.getElementById('search-query');
        const pur  = document.getElementById('search-purpose');
        const cat  = document.getElementById('search-category');
        if (from) from.value = today;
        if (to)   to.value   = today;
        if (q)    q.value    = '';
        if (pur)  pur.value  = '';
        if (cat)  cat.value  = 'inward';
        performSearch();
      }, 150);
      break;

    case 'outward-today':
      navigateTo('search');
      setTimeout(() => {
        const from = document.getElementById('search-date-from');
        const to   = document.getElementById('search-date-to');
        const q    = document.getElementById('search-query');
        const pur  = document.getElementById('search-purpose');
        const cat  = document.getElementById('search-category');
        if (from) from.value = today;
        if (to)   to.value   = today;
        if (q)    q.value    = '';
        if (pur)  pur.value  = '';
        if (cat)  cat.value  = 'outward';
        performSearch();
      }, 150);
      break;

    case 'others-today':
      navigateTo('search');
      setTimeout(() => {
        const from = document.getElementById('search-date-from');
        const to   = document.getElementById('search-date-to');
        const q    = document.getElementById('search-query');
        const pur  = document.getElementById('search-purpose');
        const cat  = document.getElementById('search-category');
        if (from) from.value = today;
        if (to)   to.value   = today;
        if (q)    q.value    = '';
        if (pur)  pur.value  = '';
        if (cat)  cat.value  = 'others';
        performSearch();
      }, 150);
      break;

    case 'interviews-today':
      navigateTo('search');
      setTimeout(() => {
        const from = document.getElementById('search-date-from');
        const to   = document.getElementById('search-date-to');
        const q    = document.getElementById('search-query');
        const pur  = document.getElementById('search-purpose');
        const cat  = document.getElementById('search-category');
        if (from) from.value = today;
        if (to)   to.value   = today;
        if (q)    q.value    = '';
        if (pur)  pur.value  = 'Interview';
        if (cat)  cat.value  = '';
        performSearch();
      }, 150);
      break;

    // ── CURRENTLY INSIDE / VEHICLES CURRENTLY INSIDE → scroll to the vehicles-inside card ────
    case 'currently-inside':
    case 'vehicles-inside': {
      if (currentPage !== 'dashboard') {
        navigateTo('dashboard');
      }
      setTimeout(() => {
        // Find the card that wraps the vehicles-inside-list
        const insideList = document.getElementById('vehicles-inside-list');
        const mainContent = document.getElementById('main-content');
        if (insideList && mainContent) {
          // Use the card's parent element for scroll target
          const targetEl = insideList.closest('.card') || insideList;
          const containerRect = mainContent.getBoundingClientRect();
          const elRect = targetEl.getBoundingClientRect();
          // scrollBy is relative to current scroll position
          mainContent.scrollBy({
            top: elRect.top - containerRect.top - 16,
            behavior: 'smooth'
          });
        }
      }, 250);
      break;
    }

    // ── FREQUENT VISITORS → Search page filtered to show all vehicles (no date) ─────────────────
    case 'frequent-visitors':
      navigateTo('search');
      setTimeout(() => {
        const from = document.getElementById('search-date-from');
        const to   = document.getElementById('search-date-to');
        const q    = document.getElementById('search-query');
        const pur  = document.getElementById('search-purpose');
        const cat  = document.getElementById('search-category');
        if (from) from.value = '';
        if (to)   to.value   = '';
        if (q)    q.value    = '';
        if (pur)  pur.value  = '';
        if (cat)  cat.value  = '';
        performSearch();
      }, 150);
      break;

    // ── AVERAGE STAY DURATION → Reports page ─────────────
    case 'avg-stay':
      navigateTo('reports');
      break;

    // ── MOST VISITED VEHICLE → Search by that plate ──────
    case 'most-visited': {
      const el = document.getElementById('stat-most-visited');
      if (el) {
        // Value is like "KA01AB1234 (18 visits)" — extract the plate
        const text = el.textContent || '';
        const plate = text.split(' ')[0].trim();
        if (plate && plate !== '—') {
          navigateTo('search');
          setTimeout(() => {
            const q    = document.getElementById('search-query');
            const from = document.getElementById('search-date-from');
            const to   = document.getElementById('search-date-to');
            const pur  = document.getElementById('search-purpose');
            if (q)    q.value    = plate;
            if (from) from.value = '';
            if (to)   to.value   = '';
            if (pur)  pur.value  = '';
            performSearch();
          }, 150);
        }
      }
      break;
    }

    default:
      break;
  }
}

