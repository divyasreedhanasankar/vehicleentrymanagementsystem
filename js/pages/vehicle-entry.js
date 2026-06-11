// =============================================
// Vehicle Entry Page – Full Logic
// Category: Inward / Outward / Others
// OCR → Auto-Search → Auto-Fill → Save to Firebase
// =============================================

// ─── Category Configuration ────────────────────────────
const ENTRY_CATEGORIES = {
  inward: {
    label: 'Inward',
    purposes: [
      'Delivery (Inward)',
      'Material Receipt',
      'Vendor Visit',
      'Service Visit',
      'Canteen Supply',
      'Interview',
      'Others'
    ]
  },
  outward: {
    label: 'Outward',
    purposes: [
      'Pickup (Outward)',
      'Material Dispatch',
      'Return Material',
      'Vendor Exit',
      'Employee Transport',
      'Interview',
      'Others'
    ]
  },
  others: {
    label: 'Others',
    purposes: [
      'Canteen',
      'Visitor Entry',
      'Maintenance Work',
      'Contractor Visit',
      'Official Visit',
      'Interview',
      'Others'
    ]
  }
};

// ─── State ─────────────────────────────────────────────
let currentVehicleFile  = null;
let currentVehicleImageURL = null;
let vnumDebounceTimer   = null;
let currentCategory     = 'inward';
let currentLogId        = null;
let activeEntryData     = null; // Holds active inward entry if present

// ─── Init ──────────────────────────────────────────────
async function initVehicleEntry() {
  document.getElementById('entry-date').value = todayISO();
  document.getElementById('entry-time').value = nowTimeHHMM();
  document.getElementById('exit-date').value  = '';
  document.getElementById('exit-time').value  = '';

  setEntryCategory('inward');


  // Setup drag-and-drop (once)
  const dropZone = document.getElementById('upload-drop-zone');
  if (dropZone && !dropZone._dndBound) {
    dropZone._dndBound = true;
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) processVehicleImageFile(file);
    });
  }
}

// ─── Category Tabs ──────────────────────────────────────
function setEntryCategory(cat) {
  currentCategory = cat;

  // Update tab styles
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`.cat-tab[data-cat="${cat}"]`);
  if (activeTab) activeTab.classList.add('active');

  // Update subtitle label
  const labelEl = document.getElementById('entry-cat-label');
  if (labelEl) labelEl.textContent = ENTRY_CATEGORIES[cat].label;

  // Rebuild purpose dropdown
  const purposeEl = document.getElementById('purpose');
  if (purposeEl) {
    purposeEl.innerHTML = '<option value="">Select purpose…</option>';
    ENTRY_CATEGORIES[cat].purposes.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      purposeEl.appendChild(opt);
    });
  }

  updateFormMode();
}

function updateFormMode() {
  const btn             = document.getElementById('save-entry-btn');
  const bannerDuplicate = document.getElementById('banner-duplicate');
  const bannerExitMode  = document.getElementById('banner-exit-mode');
  const exitDateGroup   = document.getElementById('exit-date-group');
  const exitTimeGroup   = document.getElementById('exit-time-group');
  const entryDateEl     = document.getElementById('entry-date');
  const entryTimeEl     = document.getElementById('entry-time');

  const saveSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
  const exitSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;

  if (currentCategory === 'outward' && activeEntryData) {
    // ── EXIT MODE: Vehicle is inside → outward records the exit ──
    if (bannerDuplicate) bannerDuplicate.style.display = 'none';
    if (bannerExitMode)  bannerExitMode.style.display  = 'flex';

    // Show exit date / time fields
    if (exitDateGroup) exitDateGroup.style.display = 'flex';
    if (exitTimeGroup) exitTimeGroup.style.display = 'flex';

    // Entry time = original from the inward log (read-only)
    entryDateEl.value    = activeEntryData.entryDate || '';
    entryTimeEl.value    = activeEntryData.entryTime || '';
    entryDateEl.disabled = true;
    entryTimeEl.disabled = true;

    // Exit time = now (user can adjust if needed)
    document.getElementById('exit-date').value = todayISO();
    document.getElementById('exit-time').value = nowTimeHHMM();

    if (btn) btn.innerHTML = `${exitSvg} Record Exit`;
    currentLogId = activeEntryData.id;

  } else if (currentCategory === 'inward') {
    // ── INWARD MODE: Entry time locked to now, no exit fields ──
    if (bannerExitMode)  bannerExitMode.style.display  = 'none';
    if (exitDateGroup)   exitDateGroup.style.display   = 'none';
    if (exitTimeGroup)   exitTimeGroup.style.display   = 'none';

    document.getElementById('exit-date').value = '';
    document.getElementById('exit-time').value = '';

    // Lock entry time to current time
    entryDateEl.value    = todayISO();
    entryTimeEl.value    = nowTimeHHMM();
    entryDateEl.disabled = true;
    entryTimeEl.disabled = true;

    // Show duplicate warning if vehicle already inside
    if (activeEntryData) {
      if (bannerDuplicate) bannerDuplicate.style.display = 'flex';
    } else {
      if (bannerDuplicate) bannerDuplicate.style.display = 'none';
    }

    if (btn) btn.innerHTML = `${saveSvg} Save Entry`;
    currentLogId = null;

  } else {
    // ── NORMAL MODE: Outward with no active inward, or Others ──
    if (bannerExitMode)  bannerExitMode.style.display  = 'none';
    if (bannerDuplicate) bannerDuplicate.style.display = 'none';
    if (exitDateGroup)   exitDateGroup.style.display   = 'none';
    if (exitTimeGroup)   exitTimeGroup.style.display   = 'none';

    document.getElementById('exit-date').value = '';
    document.getElementById('exit-time').value = '';

    entryDateEl.value    = todayISO();
    entryTimeEl.value    = nowTimeHHMM();
    entryDateEl.disabled = false;
    entryTimeEl.disabled = false;

    if (btn) btn.innerHTML = `${saveSvg} Save Entry`;
    currentLogId = null;
  }
}

// ─── Image Upload & OCR ────────────────────────────────
async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  processVehicleImageFile(file);
}

async function processVehicleImageFile(file) {
  currentVehicleFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('vehicle-image-preview').src = e.target.result;
    document.getElementById('upload-placeholder').style.display = 'none';
    document.getElementById('image-preview-wrap').style.display = 'block';
  };
  reader.readAsDataURL(file);

  // Run OCR
  setOcrState('running');
  try {
    const plate = await OcrService.recognizePlate(file);
    if (plate) {
      setOcrState('success', plate);
      document.getElementById('vehicle-number').value = plate;
      onVehicleNumberInput(plate);
    } else {
      setOcrState('fail');
    }
  } catch (e) {
    setOcrState('fail');
    console.error('OCR error:', e);
  }
}

function setOcrState(state, plate) {
  document.getElementById('ocr-running').style.display      = state === 'running'  ? 'flex' : 'none';
  document.getElementById('ocr-result-banner').style.display = state === 'success' ? 'flex' : 'none';
  document.getElementById('ocr-fail-banner').style.display   = state === 'fail'    ? 'flex' : 'none';
  if (state === 'success' && plate) {
    document.getElementById('ocr-detected-text').textContent = plate;
  }
}

function clearVehicleImage() {
  currentVehicleFile = null;
  currentVehicleImageURL = null;
  document.getElementById('vehicle-image-preview').src = '';
  document.getElementById('upload-placeholder').style.display = 'block';
  document.getElementById('image-preview-wrap').style.display = 'none';
  setOcrState('none');
  document.getElementById('vehicle-image-input').value = '';
}

// ─── Vehicle Number Auto-Lookup ────────────────────────
function onVehicleNumberInput(value) {
  const vnum = (value || '').toUpperCase().replace(/[\s\-]/g, '').trim();
  document.getElementById('vehicle-number').value = vnum;

  _hide('banner-found'); _hide('banner-duplicate');
  _hide('vnum-found');   _hide('vnum-searching');

  if (vnumDebounceTimer) clearTimeout(vnumDebounceTimer);
  if (vnum.length < 3) { clearVisitHistory(); hidePrevImage(); return; }

  _show('vnum-searching');
  vnumDebounceTimer = setTimeout(() => searchVehicle(vnum), 650);
}

async function searchVehicle(vnum) {
  try {
    const [vehicleDoc, activeEntry, history] = await Promise.all([
      FirebaseService.getVehicleByNumber(vnum),
      FirebaseService.checkActiveEntry(vnum),
      FirebaseService.getVehicleHistory(vnum)
    ]);

    activeEntryData = activeEntry; // Store active inward log globally

    _hide('vnum-searching');

    // updateFormMode FIRST (sets entry/exit fields and currentLogId correctly)
    updateFormMode();

    if (currentCategory === 'outward' && !activeEntry) {
      showToast('⚠ Vehicle not found inside premises. Create an Inward entry first.', 'warning');
    }

    const hasHistory = history && history.length > 0;
    const isFound = vehicleDoc || hasHistory;

    // Display the visit counter banner
    const banner = document.getElementById('visit-counter-banner');
    if (banner) {
      if (isFound) {
        const totalVisitsCount = history ? history.length : 0;
        const lastVisitDate = hasHistory ? formatToDDMMYYYY(history[0].entryDate) : '—';

        // Update counts
        const elTotal = document.getElementById('val-total-visits');
        if (elTotal) elTotal.textContent = `Total Visits: ${totalVisitsCount}`;

        const elLast = document.getElementById('val-last-visit');
        if (elLast) elLast.textContent = `Last Visit: ${lastVisitDate}`;

        // Toggle Frequent Visitor badge
        const badgeFreq = document.getElementById('badge-frequent-visitor');
        const threshold = window.FREQUENT_VISITOR_THRESHOLD || 5;
        if (badgeFreq) {
          if (totalVisitsCount > threshold) {
            badgeFreq.style.display = 'inline-block';
          } else {
            badgeFreq.style.display = 'none';
          }
        }

        // Update Risk Score Badge
        const badgeRisk = document.getElementById('badge-risk-score');
        if (badgeRisk) {
          const today = todayISO();
          const logsToday = history ? history.filter(l => l.entryDate === today) : [];
          const riskRes = calculateRiskScore(vehicleDoc || {}, logsToday);
          badgeRisk.textContent = `Risk Score: ${riskRes.level}`;
          badgeRisk.style.display = 'inline-block';
          badgeRisk.style.color = '#000';
          badgeRisk.style.backgroundColor = riskRes.color;
        }

        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    }

    if (isFound) {
      if (vehicleDoc) {
        autoFillVehicleData(vehicleDoc);
        updateDocumentBadges(vehicleDoc);
      }

      // Retrieve purpose from the most recent active or latest entry record.
      // This works for all categories: Inward, Outward, Others.
      let targetPurpose = null;
      if (activeEntry && activeEntry.purpose) {
        targetPurpose = activeEntry.purpose;
      } else if (history && history.length > 0 && history[0].purpose) {
        targetPurpose = history[0].purpose;
      } else if (vehicleDoc && vehicleDoc.purpose) {
        targetPurpose = vehicleDoc.purpose;
      }

      if (targetPurpose) {
        const purposeEl = document.getElementById('purpose');
        if (purposeEl) {
          // Dynamically add the option if it's not in the dropdown
          if (!Array.from(purposeEl.options).some(o => o.value === targetPurpose)) {
            const opt = document.createElement('option');
            opt.value       = targetPurpose;
            opt.textContent = targetPurpose;
            purposeEl.appendChild(opt);
          }
          purposeEl.value = targetPurpose;
        }
      }

      _show('vnum-found');
      if (!activeEntry) _show('banner-found');
      loadVisitHistory(vnum);
      if (vehicleDoc && vehicleDoc.lastImageUrl) showPrevImage(vehicleDoc.lastImageUrl);
    } else {
      clearVisitHistory();
      hidePrevImage();
    }
  } catch (e) {
    _hide('vnum-searching');
    console.error('searchVehicle error:', e);
  }
}

function autoFillVehicleData(doc) {
  const fieldMap = {
    'driver-name':      doc.driverName,
    'mobile-number':    doc.mobileNumber,
    'contact-person':   doc.contactPerson,
    'shipment-method':  doc.shipmentMethod,
    'num-persons':      doc.numberOfPersons,
    'dl-number':        doc.drivingLicenseNumber,
    'dl-expiry':        doc.drivingLicenseExpiryDate,
    'insurance-number': doc.insuranceNumber,
    'insurance-expiry': doc.insuranceExpiryDate,
    'pollution-number': doc.pollutionCertificateNumber,
    'pollution-expiry': doc.pollutionCertificateExpiryDate,
    'permit-number':    doc.vehiclePermitNumber,
    'permit-expiry':    doc.vehiclePermitExpiryDate,
    'reg-number':       doc.vehicleRegistrationNumber,
    'reg-expiry':       doc.vehicleRegistrationExpiryDate
  };

  Object.entries(fieldMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val != null && val !== '') el.value = val;
  });

  // Try to match purpose from existing record to current category
  if (doc.purpose) {
    const purposeEl = document.getElementById('purpose');
    const exists = Array.from(purposeEl.options).some(o => o.value === doc.purpose);
    if (exists) purposeEl.value = doc.purpose;
  }

  // Note: do NOT call setEntryCategory here — it would trigger updateFormMode
  // and overwrite the exit-mode state (entry time, currentLogId, etc.)
}

async function loadVisitHistory(vnum) {
  const panel = document.getElementById('visit-history-panel');
  const badge = document.getElementById('visit-badge');
  if (!panel) return;

  panel.innerHTML = '<div class="empty-state"><span class="dot-loader"></span> Loading history…</div>';

  try {
    const history = await FirebaseService.getVehicleHistory(vnum);
    const total = history.length;
    if (badge) badge.textContent = `${total} visit${total !== 1 ? 's' : ''}`;

    if (total === 0) {
      panel.innerHTML = '<div class="empty-state">No prior visits recorded.</div>';
      return;
    }

    const last = history[0];
    let html = `<div class="visit-summary">
      <div class="vs-row">
        <div class="vs-item">
          <span class="vs-label">TOTAL VISITS</span>
          <span class="vs-value">${total}</span>
        </div>
        <div class="vs-item">
          <span class="vs-label">LAST VISIT</span>
          <span class="vs-value">${formatDate(last.entryDate)}</span>
        </div>
        <div class="vs-item">
          <span class="vs-label">LAST PURPOSE</span>
          <span class="vs-value">${last.purpose || '—'}</span>
        </div>
        <div class="vs-item">
          <span class="vs-label">LAST CATEGORY</span>
          <span class="vs-value">${last.category ? last.category.toUpperCase() : '—'}</span>
        </div>
      </div>
    </div>`;

    history.forEach((v, i) => {
      const inside = !v.exitDate && !v.exitTime;
      const catLabel = v.category ? v.category.toUpperCase() : '';
      const duration = calculateDuration(v.entryDate, v.entryTime, v.exitDate, v.exitTime);
      html += `<div class="visit-item">
        <div class="visit-num">Visit #${total - i}${catLabel ? ` &nbsp;·&nbsp; <span class="cat-pill cat-${v.category}">${catLabel}</span>` : ''}</div>
        <div class="visit-meta">
          ${purposeBadge(v.purpose)}
          <span class="visit-date">${formatDate(v.entryDate)}</span>
        </div>
        <div class="visit-times" style="display:flex; flex-direction:column; gap:0.15rem;">
          ${v.exitDate && v.exitTime
            ? `<div>↓ Entry Time: ${v.entryTime ? formatTime(v.entryTime) : '—'}</div>
               <div>↑ Exit Time: ${formatTime(v.exitTime)}</div>
               <div style="color:var(--accent); font-weight:600;">⏱ Duration: ${duration || '—'}</div>`
            : `<div>↓ In: ${v.entryTime ? formatTime(v.entryTime) : '—'}</div>
               <div>↑ Out: ${v.exitTime ? formatTime(v.exitTime) : (inside ? '<span style="color:var(--amber);font-weight:600">Still Inside</span>' : '—')}</div>`
          }
        </div>
        ${v.contactPerson ? `<div class="visit-contact">👤 ${v.contactPerson}${v.shipmentMethod ? ' · ' + v.shipmentMethod : ''}</div>` : ''}
        ${v.driverName ? `<div class="visit-contact">🚗 ${v.driverName}${v.mobileNumber ? ' · ' + v.mobileNumber : ''}</div>` : ''}
      </div>`;
    });

    panel.innerHTML = html;
  } catch (e) {
    panel.innerHTML = '<div class="empty-state">Could not load history.</div>';
    console.error('loadVisitHistory:', e);
  }
}

function clearVisitHistory() {
  const panel = document.getElementById('visit-history-panel');
  const badge = document.getElementById('visit-badge');
  if (panel) panel.innerHTML = '<div class="empty-state">Enter a vehicle number to see visit history.</div>';
  if (badge) badge.textContent = '';

  const banner = document.getElementById('visit-counter-banner');
  if (banner) banner.style.display = 'none';

  const badgeFreq = document.getElementById('badge-frequent-visitor');
  if (badgeFreq) badgeFreq.style.display = 'none';

  const badgeRisk = document.getElementById('badge-risk-score');
  if (badgeRisk) badgeRisk.style.display = 'none';

  const docBadges = document.querySelectorAll('.doc-status-badge');
  docBadges.forEach(b => { b.style.display = 'none'; b.textContent = ''; });
}

function updateDocumentBadges(vehicleDoc) {
  const badgeMap = {
    'badge-dl-expiry': vehicleDoc.drivingLicenseExpiryDate,
    'badge-insurance-expiry': vehicleDoc.insuranceExpiryDate,
    'badge-pollution-expiry': vehicleDoc.pollutionCertificateExpiryDate,
    'badge-permit-expiry': vehicleDoc.vehiclePermitExpiryDate,
    'badge-reg-expiry': vehicleDoc.vehicleRegistrationExpiryDate
  };

  Object.entries(badgeMap).forEach(([badgeId, dateVal]) => {
    const el = document.getElementById(badgeId);
    if (!el) return;
    
    if (dateVal) {
      const res = checkDocumentStatus(dateVal);
      el.textContent = res.text;
      el.style.display = 'inline-block';
      el.style.color = res.color;
      el.style.backgroundColor = res.bg;
      el.style.border = `1px solid ${res.color}40`;
    } else {
      el.style.display = 'none';
    }
  });
}

function showPrevImage(url) {
  const card = document.getElementById('prev-image-card');
  const img  = document.getElementById('prev-vehicle-img');
  if (card && img) { img.src = url; card.style.display = 'block'; }
}

function hidePrevImage() {
  const card = document.getElementById('prev-image-card');
  if (card) card.style.display = 'none';
}

// ─── Helpers ───────────────────────────────────────────
function _show(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function _hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

// ─── Save Entry ────────────────────────────────────────
async function saveEntry() {
  const vnum    = (document.getElementById('vehicle-number').value || '').toUpperCase().trim();
  const purpose = document.getElementById('purpose').value;

  if (!vnum)    { showToast('Please enter a vehicle number', 'warning'); return; }
  if (!purpose) { showToast('Please select a purpose', 'warning'); return; }

  // Outward MUST link to an existing active inward entry — never creates a new log
  if (currentCategory === 'outward' && !currentLogId) {
    showToast('⚠ Vehicle not found inside premises. Create an Inward entry first.', 'warning');
    return;
  }

  const btn = document.getElementById('save-entry-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin" style="width:16px;height:16px;border-width:2px;margin-right:6px"></span>Saving…';

  try {
    // Image is used for OCR only – not uploaded to Storage
    let imageUrl = null;

    const entry = {
      vehicleNumber:   vnum,
      category:        currentCategory,
      purpose,
      driverName:      document.getElementById('driver-name').value.trim(),
      mobileNumber:    document.getElementById('mobile-number').value.trim(),
      contactPerson:   document.getElementById('contact-person').value.trim(),
      shipmentMethod:  document.getElementById('shipment-method').value.trim(),
      numberOfPersons: document.getElementById('num-persons').value || null,
      remarks:         document.getElementById('remarks').value.trim(),
      entryDate:       document.getElementById('entry-date').value,
      entryTime:       document.getElementById('entry-time').value,
      exitDate:        null,
      exitTime:        null,
      vehicleImageUrl: imageUrl,
      // Documents
      drivingLicenseNumber:              document.getElementById('dl-number').value.trim(),
      drivingLicenseExpiryDate:          document.getElementById('dl-expiry').value,
      insuranceNumber:                   document.getElementById('insurance-number').value.trim(),
      insuranceExpiryDate:               document.getElementById('insurance-expiry').value,
      pollutionCertificateNumber:        document.getElementById('pollution-number').value.trim(),
      pollutionCertificateExpiryDate:    document.getElementById('pollution-expiry').value,
      vehiclePermitNumber:               document.getElementById('permit-number').value.trim(),
      vehiclePermitExpiryDate:           document.getElementById('permit-expiry').value,
      vehicleRegistrationNumber:         document.getElementById('reg-number').value.trim(),
      vehicleRegistrationExpiryDate:     document.getElementById('reg-expiry').value,
    };

    if (currentLogId) {
      // Record exit for the active inward entry log
      const exitDate = document.getElementById('exit-date').value;
      const exitTime = document.getElementById('exit-time').value;
      if (!exitDate || !exitTime) {
        showToast('Please set both exit date and time', 'warning');
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Record Exit`;
        return;
      }
      await FirebaseService.updateEntryLog(currentLogId, {
        exitDate,
        exitTime,
        driverName: entry.driverName,
        mobileNumber: entry.mobileNumber,
        contactPerson: entry.contactPerson,
        shipmentMethod: entry.shipmentMethod,
        numberOfPersons: entry.numberOfPersons,
        remarks: entry.remarks,
      });
      showToast(`✓ Exit recorded for ${vnum}`, 'success');
    } else {
      // Save a new entry log to Firestore
      await FirebaseService.createEntryLog(entry);
      showToast(`✓ ${ENTRY_CATEGORIES[currentCategory].label} entry saved for ${vnum}`, 'success');
    }

    // Update / create vehicle master record (no time-specific fields)
    const master = {
      vehicleNumber:    entry.vehicleNumber,
      category:         entry.category,
      purpose:          entry.purpose,
      driverName:       entry.driverName,
      mobileNumber:     entry.mobileNumber,
      contactPerson:    entry.contactPerson,
      shipmentMethod:   entry.shipmentMethod,
      numberOfPersons:  entry.numberOfPersons,
      drivingLicenseNumber:              entry.drivingLicenseNumber,
      drivingLicenseExpiryDate:          entry.drivingLicenseExpiryDate,
      insuranceNumber:                   entry.insuranceNumber,
      insuranceExpiryDate:               entry.insuranceExpiryDate,
      pollutionCertificateNumber:        entry.pollutionCertificateNumber,
      pollutionCertificateExpiryDate:    entry.pollutionCertificateExpiryDate,
      vehiclePermitNumber:               entry.vehiclePermitNumber,
      vehiclePermitExpiryDate:           entry.vehiclePermitExpiryDate,
      vehicleRegistrationNumber:         entry.vehicleRegistrationNumber,
      vehicleRegistrationExpiryDate:     entry.vehicleRegistrationExpiryDate,
    };
    if (imageUrl) master.lastImageUrl = imageUrl;
    await FirebaseService.saveVehicle(master);

    // Reset active entry since they just exited
    activeEntryData = null;
    updateFormMode();

    // Reload visit history
    loadVisitHistory(vnum);

  } catch (e) {
    console.error('saveEntry error:', e);
    showToast('Error saving entry: ' + (e.message || 'Unknown error'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Entry`;
  }
}

// ─── Reset Form ─────────────────────────────────────────
function resetEntryForm() {
  const fields = [
    'vehicle-number','driver-name','mobile-number','contact-person','shipment-method',
    'remarks','num-persons','dl-number','dl-expiry','insurance-number','insurance-expiry',
    'pollution-number','pollution-expiry','permit-number','permit-expiry',
    'reg-number','reg-expiry','exit-date','exit-time'
  ];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('purpose').value    = '';
  document.getElementById('entry-date').value = todayISO();
  document.getElementById('entry-time').value = nowTimeHHMM();

  ['banner-found','banner-duplicate','vnum-found','vnum-searching'].forEach(_hide);

  clearVehicleImage();
  clearVisitHistory();
  hidePrevImage();

  currentLogId    = null;
  activeEntryData = null;
  if (vnumDebounceTimer) clearTimeout(vnumDebounceTimer);

  // Re-enable any locked fields then re-initialise the form mode
  document.getElementById('entry-date').disabled = false;
  document.getElementById('entry-time').disabled = false;
  updateFormMode();

  showToast('Form reset', 'info');
}
