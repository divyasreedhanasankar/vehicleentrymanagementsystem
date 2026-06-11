// =============================================
// OCR Service – Vehicle Number Plate Detection
// Uses Plate Recognizer API via /api/ocr proxy
// =============================================

const OcrService = {

  /**
   * Initialize – no-op (kept for API compatibility with app.js).
   */
  async init() {
    console.log('[OCR] Plate Recognizer mode – ready');
  },

  /**
   * Resize the image before sending to reduce bandwidth.
   * Returns a Blob.
   */
  preprocessImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1200;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

        URL.revokeObjectURL(url);
        canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  },

  /**
   * Main OCR function.
   * Sends image to /api/ocr → Plate Recognizer API → returns plate string or null.
   */
  async recognizePlate(file) {
    const dbg = document.getElementById('ocr-debug-raw');
    const PR_TOKEN = 'e09fa506ffc3f6c091d498be5e14dc8a7db431d4';

    try {
      if (dbg) dbg.textContent = 'Processing image...';
      const blob = await this.preprocessImage(file);

      // Attempt 1: Call server proxy
      if (dbg) dbg.textContent = 'Calling server OCR proxy...';
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const response = await fetch('/api/ocr', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ imageBase64: base64 }),
          signal:  AbortSignal.timeout(5000) // 5s timeout for proxy
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        if (json.plate) {
          if (dbg) dbg.textContent = `✓ API detected: ${json.plate}`;
          return json.plate;
        }
      } catch (proxyErr) {
        console.warn('[OCR] Server proxy failed/timed out, falling back to direct browser call:', proxyErr);
      }

      // Attempt 2: Fallback to direct client-side call to Plate Recognizer
      if (dbg) dbg.textContent = 'Server proxy timed out. Attempting direct API call from browser...';
      
      const formData = new FormData();
      formData.append('upload', blob, 'plate.jpg');
      formData.append('regions', 'in');

      const response = await fetch('https://api.platerecognizer.com/v1/plate-reader/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${PR_TOKEN}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }

      const json = await response.json();
      console.log('[OCR] Direct API response:', json);
      
      const result = json.results && json.results[0];
      const plate = result && result.plate;
      
      if (plate) {
        const cleanPlate = plate.toUpperCase().replace(/\s/g, '');
        if (dbg) dbg.textContent = `✓ Direct API detected: ${cleanPlate}`;
        return cleanPlate;
      }

      if (dbg) dbg.textContent = 'API: No plate detected in image';
      return null;

    } catch (e) {
      console.error('[OCR] Error:', e);
      if (dbg) dbg.textContent = 'OCR ERROR: ' + e.message;
      return null;
    }
  },

  /**
   * Terminate – no-op.
   */
  async terminate() {}
};
