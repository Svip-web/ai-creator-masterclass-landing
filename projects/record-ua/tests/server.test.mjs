import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createPreviewServer } from '../server.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qaRoot = resolve(project, 'qa');

function readResponse(port, path, options = {}) {
  return new Promise((resolveResponse, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path, ...options }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolveResponse({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end();
  });
}

test('local static server preserves compression, caching and video range behavior', async t => {
  await mkdir(qaRoot, { recursive: true });
  const fixture = await mkdtemp(resolve(qaRoot, 'server-test-'));
  if (!fixture.startsWith(qaRoot + sep)) throw new Error('Unsafe fixture directory.');
  await mkdir(resolve(fixture, 'assets'));
  await mkdir(resolve(fixture, 'media'));
  const html = Buffer.from('<!doctype html><html lang="uk"><body>' + '<p>Українська сторінка запису майстер-класу.</p>'.repeat(100) + '</body></html>');
  const script = Buffer.from('window.TEST_PAGE = "local-test";\n'.repeat(100));
  const configPath = resolve(fixture, 'config.js');
  await writeFile(resolve(fixture, 'index.html'), html);
  await writeFile(resolve(fixture, 'assets/app.0123456789ab.js'), script);
  await writeFile(configPath, 'window.TEST_CONFIG = {};\n'.repeat(100));
  const video = Buffer.from(Array.from({ length: 4096 }, (_value, index) => index % 256));
  await writeFile(resolve(fixture, 'media/clip.mp4'), video);
  const server = createPreviewServer({ directory: fixture });
  t.after(async () => {
    if (server.listening) await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
    // This is a newly-created, verified child folder inside the task's qa directory.
    if (!fixture.startsWith(qaRoot + sep) || !fixture.includes('server-test-')) throw new Error('Unsafe fixture cleanup.');
    await rm(fixture, { recursive: true, force: true });
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const port = server.address().port;

  await t.test('gzip and Brotli responses decode to the exact original HTML', async () => {
    const gzip = await readResponse(port, '/', { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(gzip.status, 200);
    assert.equal(gzip.headers['content-encoding'], 'gzip');
    assert.deepEqual(gunzipSync(gzip.body), html);
    assert.equal(Number(gzip.headers['content-length']), gzip.body.length);
    const brotli = await readResponse(port, '/', { headers: { 'Accept-Encoding': 'br, gzip' } });
    assert.equal(brotli.headers['content-encoding'], 'br');
    assert.deepEqual(brotliDecompressSync(brotli.body), html);
    assert.equal(brotli.headers.vary, 'Accept-Encoding');
  });

  await t.test('ETag returns 304 and HEAD sends matching headers without a body', async () => {
    const first = await readResponse(port, '/', { headers: { 'Accept-Encoding': 'br' } });
    const cached = await readResponse(port, '/', { headers: { 'Accept-Encoding': 'br', 'If-None-Match': first.headers.etag } });
    assert.equal(cached.status, 304);
    assert.equal(cached.body.length, 0);
    const head = await readResponse(port, '/', { method: 'HEAD', headers: { 'Accept-Encoding': 'br' } });
    assert.equal(head.status, 200);
    assert.equal(head.headers.etag, first.headers.etag);
    assert.equal(head.headers['content-length'], first.headers['content-length']);
    assert.equal(head.body.length, 0);
  });

  await t.test('only immutable assets receive long cache lifetimes', async () => {
    const asset = await readResponse(port, '/assets/app.0123456789ab.js');
    assert.match(asset.headers['cache-control'], /max-age=31536000, immutable/);
    assert.match(asset.headers['content-type'], /text\/javascript/);
    assert.equal((await readResponse(port, '/config.js')).headers['cache-control'], 'no-cache');
    assert.equal((await readResponse(port, '/')).headers['cache-control'], 'no-cache');
  });

  await t.test('changed config invalidates ETag and its compressed representation', async () => {
    const first = await readResponse(port, '/config.js', { headers: { 'Accept-Encoding': 'gzip' } });
    const updated = Buffer.from('window.TEST_CONFIG = { updated: true };\n'.repeat(100));
    await writeFile(configPath, updated);
    const second = await readResponse(port, '/config.js', { headers: { 'Accept-Encoding': 'gzip', 'If-None-Match': first.headers.etag } });
    assert.equal(second.status, 200);
    assert.notEqual(second.headers.etag, first.headers.etag);
    assert.deepEqual(gunzipSync(second.body), updated);
  });

  await t.test('MP4 byte ranges and suffix ranges remain uncompressed and exact', async () => {
    const selected = await readResponse(port, '/media/clip.mp4', { headers: { Range: 'bytes=100-199', 'Accept-Encoding': 'br' } });
    assert.equal(selected.status, 206);
    assert.equal(selected.headers['content-type'], 'video/mp4');
    assert.equal(selected.headers['content-range'], 'bytes 100-199/4096');
    assert.equal(selected.headers['content-encoding'], undefined);
    assert.deepEqual(selected.body, video.subarray(100, 200));
    const suffix = await readResponse(port, '/media/clip.mp4', { headers: { Range: 'bytes=-32' } });
    assert.equal(suffix.status, 206);
    assert.deepEqual(suffix.body, video.subarray(-32));
    const head = await readResponse(port, '/media/clip.mp4', { method: 'HEAD', headers: { Range: 'bytes=0-99' } });
    assert.equal(head.status, 206); assert.equal(head.body.length, 0); assert.equal(head.headers['content-length'], '100');
    const invalid = await readResponse(port, '/media/clip.mp4', { headers: { Range: 'bytes=99999-' } });
    assert.equal(invalid.status, 416); assert.equal(invalid.headers['content-range'], 'bytes */4096');
  });

  await t.test('encoding quality zero is respected', async () => {
    const identity = await readResponse(port, '/', { headers: { 'Accept-Encoding': 'br;q=0,gzip;q=0' } });
    assert.equal(identity.headers['content-encoding'], undefined);
    assert.deepEqual(identity.body, html);
  });

  await t.test('path traversal, missing files and unsupported methods are handled', async () => {
    assert.equal((await readResponse(port, '/..%2f..%2fpackage.json')).status, 403);
    assert.equal((await readResponse(port, '/missing-file')).status, 404);
    const post = await readResponse(port, '/', { method: 'POST' });
    assert.equal(post.status, 405); assert.equal(post.headers.allow, 'GET, HEAD');
    assert.deepEqual(await readFile(resolve(fixture, 'media/clip.mp4')), video);
  });
});
