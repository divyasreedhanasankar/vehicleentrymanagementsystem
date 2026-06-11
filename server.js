const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT       = 5500;
const PUBLIC_DIR = __dirname;
const PR_TOKEN   = 'e09fa506ffc3f6c091d498be5e14dc8a7db431d4'; // Plate Recognizer API token

const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// ── Plate Recognizer API proxy ─────────────────────────
function callPlateRecognizer(imgBuffer, mimeType) {
  return new Promise((resolve, reject) => {
    const boundary = '----VEMSBoundary' + Date.now();
    const ext      = mimeType === 'image/png' ? 'png' : 'jpg';

    // Build multipart: image + regions=in hint for Indian plates
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="upload"; filename="plate.${ext}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
      ),
      imgBuffer,
      Buffer.from(
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="regions"\r\n\r\n` +
        `in\r\n` +
        `--${boundary}--\r\n`
      )
    ]);

    const options = {
      hostname: 'api.platerecognizer.com',
      path:     '/v1/plate-reader/',
      method:   'POST',
      headers:  {
        'Authorization':  `Token ${PR_TOKEN}`,
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[PlateRecognizer] HTTP ${res.statusCode} → ${data}`);
        try {
          const json = JSON.parse(data);
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            return reject(new Error(`API error ${res.statusCode}: ${data}`));
          }
          const result = json.results && json.results[0];
          const plate  = result && result.plate;
          console.log(`[PlateRecognizer] Plate="${plate}" Score=${result && result.score}`);
          resolve(plate ? plate.toUpperCase().replace(/\s/g, '') : null);
        } catch (e) {
          console.error('[PlateRecognizer] Parse error:', e, data);
          reject(new Error('Failed to parse: ' + data));
        }
      });
    });

    req.on('error', (e) => {
      console.error('[PlateRecognizer] Request error:', e);
      reject(e);
    });

    req.write(body);
    req.end();
  });
}

// ── HTTP Server ────────────────────────────────────────
const server = http.createServer((req, res) => {
  let safeUrl = req.url.split('?')[0];

  // ── POST /api/ocr ──────────────────────────────────
  if (req.method === 'POST' && safeUrl === '/api/ocr') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const json     = JSON.parse(Buffer.concat(chunks).toString());
        const match    = (json.imageBase64 || '').match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) throw new Error('Invalid image data');

        const mimeType = match[1];
        const imgBuf   = Buffer.from(match[2], 'base64');
        // Retry up to 2 times on timeout
        let plate = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            plate = await callPlateRecognizer(imgBuf, mimeType);
            break;
          } catch (retryErr) {
            console.warn(`[OCR API] Attempt ${attempt} failed:`, retryErr.code || retryErr.message);
            if (attempt === 2) throw retryErr;
            await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
          }
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ plate }));
      } catch (e) {
        console.error('[OCR API] Error:', e);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ plate: null, error: e.message }));
      }
    });
    return;
  }

  // ── Static file serving ────────────────────────────
  if (safeUrl === '/') safeUrl = '/index.html';

  const filePath = path.join(PUBLIC_DIR, safeUrl);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext         = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error('Stream error:', streamErr);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`VEMS running at http://localhost:${PORT}`);
  console.log(`Plate Recognizer OCR ready ✓`);
});
