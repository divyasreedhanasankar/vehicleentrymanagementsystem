// =============================================
// App.js – Main Router, Navigation, Exit Modal
// Bootstraps all modules and connects Firebase
// =============================================

// ── Current page state ────────────────────────────────
let currentPage = 'dashboard';

// ── Navigation ────────────────────────────────────────
function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target page
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  // Activate nav item
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  currentPage = page;

  // Scroll content to top
  document.getElementById('main-content').scrollTop = 0;

  // Initialize page on first visit / every visit
  switch (page) {
    case 'dashboard':
      initDashboard();
      break;
    case 'vehicle-entry':
      initVehicleEntry();
      break;
    case 'search':
      initSearch();
      break;
    case 'history':
      initHistory();
      break;
    case 'reports':
      initReports();
      break;
    case 'drivers':
      initDrivers();
      break;
  }
}

// ── Exit Modal (shared across pages) ─────────────────
let exitModalLogId      = null;
let exitModalVehicleNum = null;

function openExitModal(logId, vehicleNumber) {
  exitModalLogId      = logId;
  exitModalVehicleNum = vehicleNumber;

  // Pre-fill current date/time
  document.getElementById('exit-vehicle-label').textContent = vehicleNumber;
  document.getElementById('modal-exit-date').value = todayISO();
  document.getElementById('modal-exit-time').value = nowTimeHHMM();

  document.getElementById('exit-modal').style.display = 'flex';
}

function closeExitModal() {
  document.getElementById('exit-modal').style.display = 'none';
  exitModalLogId      = null;
  exitModalVehicleNum = null;
}

async function saveExit() {
  if (!exitModalLogId) return;

  const exitDate = document.getElementById('modal-exit-date').value;
  const exitTime = document.getElementById('modal-exit-time').value;

  if (!exitDate || !exitTime) {
    showToast('Please set both exit date and time', 'warning');
    return;
  }

  const btn = document.querySelector('#exit-modal .modal-footer .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    await FirebaseService.updateEntryLog(exitModalLogId, {
      exitDate,
      exitTime
    });
    showToast(`Exit recorded for ${exitModalVehicleNum}`, 'success');
    closeExitModal();

    // Refresh current page data
    switch (currentPage) {
      case 'dashboard':  initDashboard(); break;
      case 'search':     performSearch(); break;
      case 'history':    initHistory();   break;
      case 'drivers':    initDrivers();   break;
    }
  } catch (e) {
    console.error('saveExit error:', e);
    showToast('Could not save exit: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Exit'; }
  }
}

async function clearExit(logId, vehicleNumber) {
  if (!confirm(`Are you sure you want to clear the exit record for ${vehicleNumber} and mark it as "Inside"?`)) return;

  try {
    await FirebaseService.updateEntryLog(logId, {
      exitDate: null,
      exitTime: null
    });
    showToast(`Exit record cleared for ${vehicleNumber}`, 'success');

    // Refresh current page data
    switch (currentPage) {
      case 'dashboard':  initDashboard(); break;
      case 'search':     performSearch(); break;
      case 'history':    initHistory();   break;
      case 'drivers':    initDrivers();   break;
    }
  } catch (e) {
    console.error('clearExit error:', e);
    showToast('Could not clear exit: ' + e.message, 'error');
  }
}

// ── Handle browser back / hash routing ───────────────
window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '') || 'dashboard';
  const pages = ['dashboard', 'vehicle-entry', 'search', 'history', 'reports', 'drivers'];
  if (pages.includes(hash)) navigateTo(hash);
});

// ── App Bootstrap ─────────────────────────────────────
async function initApp() {
  console.log('[VEMS] Initializing…');

  // Show "connecting" status
  setFirebaseStatus(false, 'Connecting…');

  // Verify Firebase is connected by doing a lightweight probe
  try {
    await db.collection('entryLogs').limit(1).get();
    setFirebaseStatus(true);
    console.log('[VEMS] Firebase connected ✓');
  } catch (e) {
    console.warn('[VEMS] Firebase connection issue:', e);
    window.useLocalFallback = true;
    setFirebaseStatus(false, 'Local Mode');
    showToast('Running in Local Mode (Offline/Insufficient Firebase permissions)', 'warning');
  }

  // Initialize OCR worker in background (non-blocking)
  OcrService.init().catch(e => console.warn('[OCR] Init warning:', e));

  // Navigate to dashboard (or hash route)
  const hash = location.hash.replace('#', '');
  const pages = ['dashboard', 'vehicle-entry', 'search', 'history', 'reports'];
  navigateTo(pages.includes(hash) ? hash : 'dashboard');

  console.log('[VEMS] Ready ✓');
}

// ── Start the app when DOM is ready ──────────────────
document.addEventListener('DOMContentLoaded', initApp);
