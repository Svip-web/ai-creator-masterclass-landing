import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/js/tracking.js', import.meta.url), 'utf8');
const pixelIds = ['1540134250632219', '1272331291736172', '1411553907555948', '4393348487596340'];
const analytics = {
  enabled: true,
  metaPixelIds: pixelIds,
  clarityProjectId: '',
  googleAdsConversionId: 'AW-17866299470',
  googleAdsConversionLabel: 'DDnCCJ7dneQbEM6wqMdC'
};

function browser({ hostname = 'www.example.com', protocol = 'https:', config = analytics } = {}) {
  const scripts = [];
  const listeners = new Map();
  const window = {
    location: { hostname, protocol },
    RECORD_CONFIG: { analytics: config },
    addEventListener(name, listener) {
      const handlers = listeners.get(name) || [];
      handlers.push(listener);
      listeners.set(name, handlers);
    }
  };
  const document = {
    head: { appendChild(script) { scripts.push(script); } },
    getElementById(id) { return scripts.find(script => script.id === id); },
    createElement() { return {}; }
  };
  // This VM exposes no browser or Node network APIs. Appended scripts are
  // recorded as plain objects and never fetched or executed.
  const context = vm.createContext({ window, document });
  const evaluate = () => vm.runInContext(source, context, { filename: 'tracking.js' });
  const dispatch = (name, detail) => {
    for (const listener of listeners.get(name) || []) listener({ type: name, detail });
  };
  const metaCalls = () => Array.from(window.fbq?.queue || [], args => Array.from(args));
  const googleCalls = () => Array.from(window.dataLayer || [], args => Array.from(args));
  evaluate();
  return { window, scripts, listeners, evaluate, dispatch, metaCalls, googleCalls };
}

test('local and loopback previews load no analytics scripts or events', () => {
  for (const hostname of ['localhost', 'localhost.', 'preview.localhost', '127.0.0.1', '127.4.5.6', '[::1]', '::1', '0.0.0.0']) {
    const page = browser({ hostname });
    page.dispatch('record:lead-success', { dealId: 'test' });
    assert.equal(page.scripts.length, 0, hostname);
    assert.equal(page.listeners.size, 0, hostname);
    assert.equal(page.window.RECORD_TRACKING.enabled, false, hostname);
    assert.deepEqual(page.metaCalls(), [], hostname);
    assert.deepEqual(page.googleCalls(), [], hostname);
  }
  const file = browser({ hostname: '', protocol: 'file:' });
  assert.equal(file.scripts.length, 0);
  assert.equal(file.window.RECORD_TRACKING.reason, 'local-preview');
});

test('disabled analytics makes no external script requests or tracking calls', () => {
  const page = browser({ config: { ...analytics, enabled: false } });
  page.dispatch('record:lead-success', { dealId: 'test' });
  assert.equal(page.scripts.length, 0);
  assert.equal(page.listeners.size, 0);
  assert.deepEqual(page.metaCalls(), []);
  assert.deepEqual(page.googleCalls(), []);
});

test('live page initializes all four pixels with one PageView each', () => {
  const page = browser();
  assert.equal(page.window.RECORD_TRACKING.enabled, true);
  assert.equal(page.scripts.length, 2);
  assert.equal(page.scripts.filter(script => script.src.includes('fbevents.js')).length, 1);
  assert.equal(page.scripts.filter(script => script.src.includes('/gtag/js')).length, 1);
  assert.equal(page.scripts.some(script => script.src.includes('/gtm.js')), false);

  for (const id of pixelIds) {
    assert.equal(page.metaCalls().filter(call => call[0] === 'init' && call[1] === id).length, 1);
    assert.equal(page.metaCalls().filter(call => call[0] === 'trackSingle' && call[1] === id && call[2] === 'PageView').length, 1);
  }
  assert.equal(page.metaCalls().some(call => call[2] === 'Lead'), false);
  assert.equal(page.googleCalls().some(call => call[1] === 'conversion'), false);
});

test('Meta Lead and Google Ads conversion occur exactly once after CRM success', () => {
  const page = browser();
  page.dispatch('submit');
  page.dispatch('record:lead-error', { error: 'failed' });
  assert.equal(page.metaCalls().some(call => call[2] === 'Lead'), false);
  assert.equal(page.googleCalls().some(call => call[1] === 'conversion'), false);

  page.dispatch('record:lead-success', { dealId: 'test-success' });
  page.dispatch('record:lead-success', { dealId: 'test-success' });
  for (const id of pixelIds) {
    assert.equal(page.metaCalls().filter(call => call[0] === 'trackSingle' && call[1] === id && call[2] === 'Lead').length, 1);
  }
  const conversions = page.googleCalls().filter(call => call[0] === 'event' && call[1] === 'conversion');
  assert.equal(conversions.length, 1);
  assert.equal(conversions[0][2].send_to, 'AW-17866299470/DDnCCJ7dneQbEM6wqMdC');
  assert.equal(page.window.RECORD_TRACKING.leadSent, true);
});

test('success event details and contact fields are not forwarded to analytics', () => {
  const page = browser();
  const contact = {
    name: 'CONTACT_NAME_DO_NOT_FORWARD',
    email: 'contact-marker@example.test',
    phone: 'CONTACT_PHONE_DO_NOT_FORWARD',
    dealId: 'CRM_PRIVATE_ID_DO_NOT_FORWARD'
  };
  page.dispatch('record:lead-success', contact);
  const recorded = JSON.stringify([page.metaCalls(), page.googleCalls()]);
  for (const value of Object.values(contact)) assert.equal(recorded.includes(value), false);
  for (const call of page.metaCalls().filter(call => call[2] === 'Lead')) assert.equal(call.length, 3);
  const conversion = page.googleCalls().find(call => call[1] === 'conversion');
  assert.deepEqual(Object.keys(conversion[2]), ['send_to']);
});

test('re-evaluation and repeated configuration IDs do not duplicate events', () => {
  const page = browser({ config: { ...analytics, metaPixelIds: [...pixelIds, pixelIds[0], 'invalid'] } });
  page.evaluate();
  page.dispatch('record:lead-success');
  page.evaluate();
  page.dispatch('record:lead-success');
  assert.equal(page.scripts.length, 2);
  assert.equal(page.metaCalls().filter(call => call[2] === 'PageView').length, 4);
  assert.equal(page.metaCalls().filter(call => call[2] === 'Lead').length, 4);
  assert.equal(page.googleCalls().filter(call => call[1] === 'conversion').length, 1);
});
