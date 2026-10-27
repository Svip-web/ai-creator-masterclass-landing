import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const project = dirname(fileURLToPath(import.meta.url));
const root = resolve(project, 'dist');
const gzipAsync = promisify(gzip), brotliAsync = promisify(brotliCompress);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'
};
const compressible = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg']);

function encodingFor(header = '') {
  const qualities = new Map(header.toLowerCase().split(',').map(part => {
    const [name, ...parameters] = part.trim().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    const value = quality ? Number(quality.trim().slice(2)) : 1;
    return [name, Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0];
  }));
  const quality = name => qualities.has(name) ? qualities.get(name) : (qualities.get('*') || 0);
  if (quality('br') > 0 && quality('br') >= quality('gzip')) return 'br';
  if (quality('gzip') > 0) return 'gzip';
  return 'identity';
}

function parseRange(header, length) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match || (!match[1] && !match[2])) return null;
  let start, end;
  if (!match[1]) {
    const count = Number(match[2]);
    if (count <= 0) return null;
    start = Math.max(0, length - count); end = length - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  }
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < length ? { start, end } : null;
}

export function createPreviewServer({ directory = root } = {}) {
  const servedRoot = resolve(directory);
  const encodedCache = new Map();
  async function encodedFile(path, info) {
    const version = `${info.size}:${info.mtimeMs}`;
    const cached = encodedCache.get(path);
    if (cached?.version === version) return cached.promise;
    const promise = readFile(path).then(async raw => {
      const [gzipData, brotliData] = await Promise.all([
        gzipAsync(raw, { level: 9 }),
        brotliAsync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } })
      ]);
      return { raw, gzip: gzipData, br: brotliData };
    });
    encodedCache.set(path, { version, promise });
    if (encodedCache.size > 64) encodedCache.delete(encodedCache.keys().next().value);
    try { return await promise; }
    catch (error) { encodedCache.delete(path); throw error; }
  }

  return createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
      }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let path = resolve(servedRoot, '.' + pathname);
      if (path !== servedRoot && !path.startsWith(servedRoot + sep)) { response.writeHead(403); response.end(); return; }
      let info = await stat(path);
      if (info.isDirectory()) { path = resolve(path, 'index.html'); info = await stat(path); }
      if (!info.isFile()) throw new Error('not-file');
      const extension = extname(path);
      const cacheable = path.startsWith(resolve(servedRoot, 'assets') + sep) || path.startsWith(resolve(servedRoot, 'fonts') + sep) || path.startsWith(resolve(servedRoot, 'images') + sep);
      const headers = {
        'Content-Type': types[extension] || 'application/octet-stream',
        'Cache-Control': cacheable ? 'public, max-age=31536000, immutable' : 'no-cache',
        'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes',
        'Last-Modified': info.mtime.toUTCString(), Vary: 'Accept-Encoding'
      };
      const requestedRange = request.headers.range;
      const canCompress = !requestedRange && compressible.has(extension) && info.size > 512;
      const encoding = canCompress ? encodingFor(request.headers['accept-encoding']) : 'identity';
      let body;
      if (encoding !== 'identity') {
        const encoded = await encodedFile(path, info);
        if (encoded[encoding].length < info.size) { body = encoded[encoding]; headers['Content-Encoding'] = encoding; }
      }
      const representation = headers['Content-Encoding'] || 'identity';
      const etag = `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}-${representation}"`;
      headers.ETag = etag;
      const noneMatch = request.headers['if-none-match'];
      if (noneMatch && (noneMatch === '*' || noneMatch.split(',').map(value => value.trim()).includes(etag))) {
        response.writeHead(304, headers); response.end(); return;
      }
      if (requestedRange) {
        const ifRange = request.headers['if-range'];
        const date = ifRange ? Date.parse(ifRange) : NaN;
        const honorRange = !ifRange || (Number.isFinite(date) && Math.floor(info.mtimeMs / 1000) <= Math.floor(date / 1000));
        if (honorRange) {
          const range = parseRange(requestedRange, info.size);
          if (!range) { response.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }); response.end(); return; }
          response.writeHead(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${info.size}`, 'Content-Length': range.end - range.start + 1 });
          if (request.method === 'HEAD') response.end();
          else createReadStream(path, range).on('error', () => response.destroy()).pipe(response);
          return;
        }
      }
      headers['Content-Length'] = body?.length ?? info.size;
      response.writeHead(200, headers);
      if (request.method === 'HEAD') response.end();
      else if (body) response.end(body);
      else createReadStream(path).on('error', () => response.destroy()).pipe(response);
    } catch {
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : 'Сторінку не знайдено');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4188);
  createPreviewServer().listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port}`));
}
