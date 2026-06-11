// =============================================
// Firebase Service – All Firestore & Storage Operations
// With seamless IndexedDB fallback (Local Mode)
// =============================================

// Local Database fallback using IndexedDB
const LocalDB = {
  db: null,

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('VEMS_LocalDB', 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('vehicles')) {
          db.createObjectStore('vehicles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('entryLogs')) {
          db.createObjectStore('entryLogs', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        reject(e);
      };
    });
  },

  async getAll(storeName) {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  },

  async get(storeName, id) {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },

  async put(storeName, data) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(data);
      req.onsuccess = () => resolve(data.id);
      req.onerror = (e) => reject(e);
    });
  },

  async delete(storeName, id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  }
};

let localListeners = [];
window.useLocalFallback = false;

function checkAndTriggerFallback(err) {
  if (!window.useLocalFallback && err && (err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission')) || err.message?.includes('offline') || err.code === 'unavailable')) {
    window.useLocalFallback = true;
    setFirebaseStatus(false, 'Local Mode');
    showToast('Running in Local Mode (Offline/Insufficient Firebase permissions)', 'warning');
    console.warn('[VEMS] Switched to Local Mode due to Firebase error:', err);
    notifyLocalListeners();
  }
}

async function notifyLocalListeners() {
  const logs = await LocalDB.getAll('entryLogs');
  const sorted = logs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  localListeners.forEach(callback => {
    try { callback(null, sorted); } catch(e) { console.error(e); }
  });
}

const FirebaseService = {

  // ── Normalize vehicle number ──────────────────────────
  normalize(vnum) {
    return (vnum || '').toUpperCase().replace(/[\s\-]/g, '').trim();
  },

  /**
   * Generates case and punctuation variations of a vehicle number for Firestore search.
   * e.g., MH20EE7602 → ["MH20EE7602", "mh20ee7602", "MH 20 EE 7602", "MH-20-EE-7602", ...]
   */
  getVariations(vehicleNumber) {
    const vnum = this.normalize(vehicleNumber);
    if (!vnum) return [];
    const vars = [vnum];

    // Pattern: State (2 letters) + District (2 digits) + Series (1-2 letters) + Number (4 digits)
    const match = vnum.match(/^([A-Z]{2})([0-9]{2})([A-Z]{1,2})([0-9]{4})$/);
    if (match) {
      const [, state, dist, series, num] = match;
      vars.push(`${state} ${dist} ${series} ${num}`);
      vars.push(`${state}-${dist}-${series}-${num}`);
      vars.push(`${state} ${dist} ${series}${num}`);
      vars.push(`${state}${dist} ${series} ${num}`);
    }

    // BH Series pattern: Year (2 digits) + BH + Series (2 letters) + Number (4 digits)
    const bhMatch = vnum.match(/^([0-9]{2})(BH)([A-Z]{2})([0-9]{4})$/);
    if (bhMatch) {
      const [, yr, bh, series, num] = bhMatch;
      vars.push(`${yr} ${bh} ${series} ${num}`);
      vars.push(`${yr}-${bh}-${series}-${num}`);
      vars.push(`${yr} ${bh} ${series}${num}`);
    }

    // Include lowercase/uppercase combinations
    const allVars = [];
    for (const v of vars) {
      allVars.push(v);
      allVars.push(v.toLowerCase());
    }
    return Array.from(new Set(allVars)).slice(0, 10);
  },

  // ══════════════════════════════════════════════════════
  // VEHICLES COLLECTION (master vehicle records)
  // ══════════════════════════════════════════════════════

  /**
   * Get vehicle master record by number.
   */
  async getVehicleByNumber(vehicleNumber) {
    const vnum = this.normalize(vehicleNumber);
    if (!vnum) return null;

    if (window.useLocalFallback) {
      const list = await LocalDB.getAll('vehicles');
      return list.find(v => this.normalize(v.vehicleNumber) === vnum) || null;
    }

    const variations = this.getVariations(vnum);

    try {
      const snap = await db.collection('vehicles')
        .where('vehicleNumber', 'in', variations)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (e) {
      console.error('getVehicleByNumber:', e);
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.getVehicleByNumber(vehicleNumber);
      }
      return null;
    }
  },

  /**
   * Get all vehicle master records.
   */
  async getAllVehicles() {
    if (window.useLocalFallback) {
      return await LocalDB.getAll('vehicles');
    }
    try {
      const snap = await db.collection('vehicles').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('getAllVehicles:', e);
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.getAllVehicles();
      }
      return [];
    }
  },

  /**
   * Save or update vehicle master record.
   */
  async saveVehicle(vehicleData) {
    const vnum = this.normalize(vehicleData.vehicleNumber);
    if (window.useLocalFallback) {
      const existing = await this.getVehicleByNumber(vnum);
      const id = existing ? existing.id : 'v_' + Math.random().toString(36).substr(2, 9);
      const data = {
        ...vehicleData,
        id,
        vehicleNumber: vnum,
        updatedAt: new Date().toISOString()
      };
      if (existing) {
        data.createdAt = existing.createdAt;
      } else {
        data.createdAt = new Date().toISOString();
      }
      await LocalDB.put('vehicles', data);
      return id;
    }

    const existing = await this.getVehicleByNumber(vnum);
    const data = {
      ...vehicleData,
      vehicleNumber: vnum,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      if (existing) {
        await db.collection('vehicles').doc(existing.id).update(data);
        return existing.id;
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const ref = await db.collection('vehicles').add(data);
        return ref.id;
      }
    } catch (e) {
      console.error('saveVehicle error:', e);
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.saveVehicle(vehicleData);
      }
      throw e;
    }
  },

  // ══════════════════════════════════════════════════════
  // ENTRY LOGS COLLECTION
  // ══════════════════════════════════════════════════════

  /**
   * Create a new entry log record.
   */
  async createEntryLog(entryData) {
    if (window.useLocalFallback) {
      const id = 'log_' + Math.random().toString(36).substr(2, 9);
      const data = {
        ...entryData,
        id,
        vehicleNumber: this.normalize(entryData.vehicleNumber),
        exitDate:  entryData.exitDate  || null,
        exitTime:  entryData.exitTime  || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await LocalDB.put('entryLogs', data);
      notifyLocalListeners();
      return id;
    }

    const data = {
      ...entryData,
      vehicleNumber: this.normalize(entryData.vehicleNumber),
      exitDate:  entryData.exitDate  || null,
      exitTime:  entryData.exitTime  || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      const ref = await db.collection('entryLogs').add(data);
      return ref.id;
    } catch (e) {
      console.error('createEntryLog error:', e);
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.createEntryLog(entryData);
      }
      throw e;
    }
  },

  /**
   * Update an existing entry log (e.g. record exit).
   */
  async updateEntryLog(id, data) {
    if (window.useLocalFallback) {
      const existing = await LocalDB.get('entryLogs', id);
      if (existing) {
        const updated = {
          ...existing,
          ...data,
          updatedAt: new Date().toISOString()
        };
        await LocalDB.put('entryLogs', updated);
        notifyLocalListeners();
      }
      return;
    }

    try {
      await db.collection('entryLogs').doc(id).update({
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error('updateEntryLog error:', e);
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.updateEntryLog(id, data);
      }
      throw e;
    }
  },

  /**
   * Delete an entry log.
   */
  async deleteEntryLog(id) {
    if (window.useLocalFallback) {
      await LocalDB.delete('entryLogs', id);
      notifyLocalListeners();
      return;
    }

    try {
      await db.collection('entryLogs').doc(id).delete();
    } catch (e) {
      console.error('deleteEntryLog error:', e);
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.deleteEntryLog(id);
      }
      throw e;
    }
  },

  /**
   * Check if a vehicle already has an active entry (no exit recorded).
   */
  async checkActiveEntry(vehicleNumber) {
    const vnum = this.normalize(vehicleNumber);
    if (window.useLocalFallback) {
      const list = await LocalDB.getAll('entryLogs');
      const docs = list.filter(d => this.normalize(d.vehicleNumber) === vnum);
      const active = docs.find(d => !d.exitDate && !d.exitTime);
      return active || null;
    }

    const variations = this.getVariations(vnum);

    try {
      const snap = await db.collection('entryLogs')
        .where('vehicleNumber', 'in', variations)
        .get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const active = docs.find(d => !d.exitDate && !d.exitTime);
      return active || null;
    } catch (e) {
      console.error('checkActiveEntry:', e);
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.checkActiveEntry(vehicleNumber);
      }
      return null;
    }
  },

  /**
   * Get full visit history for a vehicle number.
   */
  async getVehicleHistory(vehicleNumber) {
    const vnum = this.normalize(vehicleNumber);
    if (window.useLocalFallback) {
      const list = await LocalDB.getAll('entryLogs');
      const docs = list.filter(d => this.normalize(d.vehicleNumber) === vnum);
      return docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const variations = this.getVariations(vnum);

    try {
      const snap = await db.collection('entryLogs')
        .where('vehicleNumber', 'in', variations)
        .orderBy('createdAt', 'desc')
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.getVehicleHistory(vehicleNumber);
      }
      try {
        const snap = await db.collection('entryLogs')
          .where('vehicleNumber', 'in', variations)
          .get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return docs.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() || new Date(0);
          const tb = b.createdAt?.toDate?.() || new Date(0);
          return tb - ta;
        });
      } catch (e2) {
        console.error('getVehicleHistory:', e2);
        return [];
      }
    }
  },

  /**
   * Get all entry logs.
   */
  async getAllEntryLogs() {
    if (window.useLocalFallback) {
      const list = await LocalDB.getAll('entryLogs');
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    try {
      const snap = await db.collection('entryLogs')
        .orderBy('createdAt', 'desc')
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.getAllEntryLogs();
      }
      try {
        const snap = await db.collection('entryLogs').get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return docs.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() || new Date(0);
          const tb = b.createdAt?.toDate?.() || new Date(0);
          return tb - ta;
        });
      } catch (e2) {
        console.error('getAllEntryLogs:', e2);
        return [];
      }
    }
  },

  /**
   * Get today's entry logs.
   */
  async getTodayLogs() {
    const today = new Date().toISOString().split('T')[0];
    if (window.useLocalFallback) {
      const list = await LocalDB.getAll('entryLogs');
      return list.filter(d => d.entryDate === today);
    }

    try {
      const snap = await db.collection('entryLogs')
        .where('entryDate', '==', today)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.getTodayLogs();
      }
      console.error('getTodayLogs:', e);
      return [];
    }
  },

  /**
   * Subscribe to real-time entry log updates.
   */
  subscribeToEntryLogs(callback) {
    if (window.useLocalFallback) {
      localListeners.push(callback);
      LocalDB.getAll('entryLogs').then(logs => {
        const sorted = logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        callback(null, sorted);
      });
      return () => {
        localListeners = localListeners.filter(l => l !== callback);
      };
    }

    let unsub = null;
    try {
      unsub = db.collection('entryLogs')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          callback(null, docs);
        }, err => {
          checkAndTriggerFallback(err);
          if (window.useLocalFallback) {
            if (unsub) unsub();
            this.subscribeToEntryLogs(callback);
            return;
          }
          db.collection('entryLogs').onSnapshot(snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(null, docs);
          }, e2 => callback(e2, []));
        });
      return unsub;
    } catch (e) {
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.subscribeToEntryLogs(callback);
      }
      callback(e, []);
      return () => {};
    }
  },

  // ══════════════════════════════════════════════════════
  // FIREBASE STORAGE – Vehicle Images
  // ══════════════════════════════════════════════════════

  /**
   * Upload vehicle image.
   * In local fallback mode, returns base64 Data URL.
   */
  async uploadVehicleImage(vehicleNumber, file) {
    if (window.useLocalFallback) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });
    }

    try {
      const vnum = this.normalize(vehicleNumber);
      const ext  = file.name.split('.').pop() || 'jpg';
      const path = `vehicle-images/${vnum}/${Date.now()}.${ext}`;
      const ref  = storage.ref(path);
      const snap = await ref.put(file);
      const url  = await snap.ref.getDownloadURL();
      return url;
    } catch (e) {
      console.error('uploadVehicleImage error:', e);
      checkAndTriggerFallback(e);
      if (window.useLocalFallback) {
        return this.uploadVehicleImage(vehicleNumber, file);
      }
      throw e;
    }
  },

  /**
   * Search / filter entry logs client-side.
   */
  filterLogs(logs, { query, purpose, dateFrom, dateTo, category } = {}) {
    const inwardPurposes = new Set([
      'Delivery (Inward)', 'Material Receipt', 'Vendor Visit', 'Service Visit', 'Canteen Supply'
    ]);
    const outwardPurposes = new Set([
      'Pickup (Outward)', 'Material Dispatch', 'Return Material', 'Vendor Exit', 'Employee Transport'
    ]);

    function getCat(r) {
      if (r.category) return r.category;
      if (inwardPurposes.has(r.purpose)) return 'inward';
      if (outwardPurposes.has(r.purpose)) return 'outward';
      return 'others';
    }

    return logs.filter(r => {
      if (query) {
        const q = query.toLowerCase();
        const match =
          (r.vehicleNumber && r.vehicleNumber.toLowerCase().includes(q)) ||
          (r.driverName    && r.driverName.toLowerCase().includes(q))    ||
          (r.mobileNumber  && r.mobileNumber.includes(q));
        if (!match) return false;
      }
      if (purpose && r.purpose !== purpose) return false;

      // Category filter
      if (category) {
        const cat = getCat(r);
        if (category === 'outward') {
          const isOutwardCategory = (cat === 'outward');
          const hasExited = !!r.exitDate;
          if (!isOutwardCategory && !hasExited) return false;
        } else {
          if (cat !== category) return false;
        }
      }

      // Date range filter
      if (category === 'outward') {
        const cat = getCat(r);
        const isOutwardCategory = (cat === 'outward');
        if (dateFrom) {
          const entryMatch = isOutwardCategory && r.entryDate && r.entryDate >= dateFrom;
          const exitMatch  = r.exitDate && r.exitDate >= dateFrom;
          if (!entryMatch && !exitMatch) return false;
        }
        if (dateTo) {
          const entryMatch = isOutwardCategory && r.entryDate && r.entryDate <= dateTo;
          const exitMatch  = r.exitDate && r.exitDate <= dateTo;
          if (!entryMatch && !exitMatch) return false;
        }
      } else {
        if (dateFrom && r.entryDate < dateFrom) return false;
        if (dateTo   && r.entryDate > dateTo)   return false;
      }

      return true;
    });
  }
};
