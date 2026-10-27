import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetLoader } from '../src/js/lazy-assets.mjs';

// Detached mock DOM only: no HTTP, browser, or CRM calls occur in these tests.
function documentFixture({ failAppend = 0 } = {}) {
  const appended = [];
  const active = new Set();
  const document = {
    createElement(tagName) {
      return {
        tagName,
        removed: false,
        remove() { this.removed = true; active.delete(this); }
      };
    },
    head: {
      appendChild(node) {
        if (failAppend-- > 0) throw new Error('mock DOM insertion failure');
        appended.push(node); active.add(node); return node;
      }
    }
  };
  return { document, appended, active, load: createAssetLoader(document) };
}

test('concurrent consumers share one request and successful resources remain cached', async () => {
  const { load, appended } = documentFixture();
  const first = load('./phone.js');
  const second = load('./phone.js');
  assert.equal(first, second);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, './phone.js');
  assert.equal(appended[0].async, true);
  appended[0].onload();
  await Promise.all([first, second]);
  assert.equal(load('./phone.js'), first);
  assert.equal(appended.length, 1);
});

test('phone readiness waits for stylesheet, main library and validation utilities', async () => {
  const { load, appended } = documentFixture();
  let ready = false;
  const waiting = Promise.all([
    load('./phone.css', 'style'), load('./phone.js'), load('./utils.js')
  ]).then(() => { ready = true; });
  assert.equal(appended.length, 3);
  assert.equal(appended[0].tagName, 'link');
  assert.equal(appended[0].rel, 'stylesheet');
  assert.equal(appended[0].href, './phone.css');
  appended[0].onload(); appended[1].onload();
  await Promise.resolve();
  assert.equal(ready, false, 'validation must not proceed without phone utilities');
  appended[2].onload();
  await waiting;
  assert.equal(ready, true);
});

test('a failed resource is removed, rejects all consumers and can be retried', async () => {
  const { load, appended, active } = documentFixture();
  const first = load('./phone.js');
  const concurrent = load('./phone.js');
  const expectedFailure = assert.rejects(first, /Не вдалося завантажити поле телефону/);
  appended[0].onerror();
  await expectedFailure;
  assert.equal(concurrent, first);
  assert.equal(appended[0].removed, true);
  assert.equal(active.size, 0);
  const retry = load('./phone.js');
  assert.notEqual(retry, first);
  assert.equal(appended.length, 2);
  appended[1].onload();
  await retry;
});

test('timeouts permit retry, and late callbacks from the old request cannot cancel the retry', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { load, appended } = documentFixture();
  const first = load('./utils.js');
  const staleError = appended[0].onerror;
  const staleLoad = appended[0].onload;
  const expectedFailure = assert.rejects(first, /Не вдалося завантажити поле телефону/);
  context.mock.timers.tick(20000);
  await expectedFailure;
  assert.equal(appended[0].removed, true);
  assert.equal(appended[0].onload, null);
  assert.equal(appended[0].onerror, null);
  const retry = load('./utils.js');
  staleError(); staleLoad();
  assert.equal(load('./utils.js'), retry, 'old callbacks must not evict a new in-flight request');
  assert.equal(appended.length, 2);
  appended[1].onload();
  await retry;
  context.mock.timers.tick(20000);
  assert.equal(load('./utils.js'), retry, 'successful request must remain cached after its old timeout');
});

test('synchronous DOM insertion failure also resets the resource for retry', async () => {
  const { load, appended } = documentFixture({ failAppend: 1 });
  await assert.rejects(load('./phone.js'), /Не вдалося завантажити поле телефону/);
  const retry = load('./phone.js');
  assert.equal(appended.length, 1);
  appended[0].onload();
  await retry;
});
