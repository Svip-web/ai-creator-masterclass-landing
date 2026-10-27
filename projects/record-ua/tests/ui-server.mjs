// Ізольована перевірка інтерфейсу: справжня CRM ніколи не викликається.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
let requests = 0;
let failureMode = false;
let phoneFailure = false;
let phoneDelay = 0;
let lastTags = '';
let canonicalPhone = false;
let lastRouting = {};
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4189');
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/__qa/status') {
    response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ requests, lastTags, canonicalPhone, lastRouting })); return;
  }
  if (url.pathname === '/__qa/mode/failure') { failureMode = true; response.end('failure'); return; }
  if (url.pathname === '/__qa/mode/success') { failureMode = false; response.end('success'); return; }
  if (url.pathname === '/__qa/mode/phone-failure') { phoneFailure = true; response.end('phone-failure'); return; }
  if (url.pathname === '/__qa/mode/phone-success') { phoneFailure = false; phoneDelay = 0; response.end('phone-success'); return; }
  if (url.pathname === '/__qa/mode/phone-slow') { phoneFailure = false; phoneDelay = 2000; response.end('phone-slow'); return; }
  if (url.pathname === '/__qa/crm' && request.method === 'POST') {
    requests += 1;
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => setTimeout(() => {
      try {
        const payload = JSON.parse(raw); lastTags = payload.tag; canonicalPhone = /^\+[1-9]\d{7,14}$/.test(payload.phone);
        lastRouting = Object.fromEntries(['title', 'stage', 'product', 'type_lead', 'req'].map(key => [key, payload[key]]));
      } catch {}
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(failureMode ? { error: 'mock-failure' } : { formHistoryId: 'local-qa-only' }));
    }, 300));
    return;
  }
  if (/phone-(input|utils).*\.js$/.test(url.pathname)) {
    if (phoneFailure) { response.writeHead(503); response.end('mock-asset-failure'); return; }
    if (phoneDelay) await new Promise(resolveDelay => setTimeout(resolveDelay, phoneDelay));
  }
  try {
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + sep)) throw new Error('path');
    let data = await readFile(path);
    if (url.pathname === '/config.js') data = Buffer.from(data.toString().replace('https://mufiksoft.com/shopifyband/amo-panel/forms.php', 'http://127.0.0.1:4189/__qa/crm'));
    response.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); response.end(data);
  } catch { response.writeHead(404); response.end(); }
}).listen(4189, '127.0.0.1', () => console.log('Isolated UI QA: http://127.0.0.1:4189'));
