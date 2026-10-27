import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildPayload, getCookie, normalizePhone, validateContact, submitLead } from '../src/js/crm.mjs';

const context = { window: {} };
vm.runInNewContext(await readFile(new URL('../dist/config.js', import.meta.url), 'utf8'), context);
const config = JSON.parse(JSON.stringify(context.window.RECORD_CONFIG.crm));
const contact = { name: ' Тест ', email: ' test@example.com ', phone: '+380501234567' };

test('CRM routes the recording consultation to Creator with the requested title, warmth and six tags', () => {
  assert.deepEqual(config.preset, { title: 'Консультация  запись  АІ Creator UA', stage: '105820611', tag: 'запись;консультация;бронь_20€;390€;590€;790€', product: 'Ai-creator', type_lead: 'Теплый', req: 'etsy_no_pay_4' });
  const payload = buildPayload({ contact, href: 'http://localhost:4188/?utm_source=meta&utm_campaign=ua&fbclid=click&stage=wrong&product=wrong&type_lead=wrong&req=reg-web&title=wrong&tag=wrong&name=wrong&system_url=wrong&__proto__=bad', cookieString: '_fbp=fb.1.1.test; _fbc=fb.1.1.click; exid=client%201', preset: config.preset });
  assert.equal(payload.utm_source, 'meta');
  assert.equal(payload.utm_campaign, 'ua');
  assert.equal(payload.stage, '105820611');
  assert.equal(payload.product, 'Ai-creator');
  assert.equal(payload.type_lead, 'Теплый');
  assert.equal(payload.req, 'etsy_no_pay_4');
  assert.equal(payload.title, 'Консультация  запись  АІ Creator UA');
  assert.deepEqual(payload.tag.split(';'), ['запись', 'консультация', 'бронь_20€', '390€', '590€', '790€']);
  assert.equal(payload.name, 'Тест');
  assert.equal(payload.email, 'test@example.com');
  assert.equal(payload.system_exid, 'client 1');
  assert.equal(payload.system_fbp, 'fb.1.1.test');
  assert.equal(payload.system_fbc, 'fb.1.1.click');
  assert.equal(payload.system_url.startsWith('http://localhost:'), true);
  assert.equal(Object.hasOwn(payload, '__proto__'), false);
});

test('international telephone normalization supports national and full numbers', () => {
  assert.equal(normalizePhone('50 123 45 67'), '+380501234567');
  assert.equal(normalizePhone('050 123 45 67'), '+380501234567');
  assert.equal(normalizePhone('+380 50 123 45 67'), '+380501234567');
  assert.equal(normalizePhone('00380501234567'), '+380501234567');
  assert.equal(normalizePhone('380501234567'), '+380501234567');
  assert.equal(normalizePhone('512 345 678', '48'), '+48512345678');
});

test('phone guard excludes same countries as the source while allowing Kazakhstan', () => {
  assert.equal(validateContact(contact, 'ua'), null);
  assert.equal(validateContact({ ...contact, phone: '+79161234567' }).field, 'phone');
  assert.equal(validateContact({ ...contact, phone: '+74951234567' }).field, 'phone');
  assert.equal(validateContact({ ...contact, phone: '+375291234567' }).field, 'phone');
  assert.equal(validateContact({ ...contact, phone: '+77011234567' }, 'kz'), null);
  assert.equal(validateContact({ ...contact, email: 'wrong' }).field, 'email');
  assert.equal(validateContact({ ...contact, name: ' ' }).field, 'name');
});

test('cookie decoding and external ID fallback tolerate missing storage or malformed values', () => {
  assert.equal(getCookie('_fbp=%broken', '_fbp'), '');
  assert.equal(getCookie('x=1', 'missing'), '');
  assert.equal(buildPayload({ contact, href: 'https://example.com/record', externalId: 'fallback', preset: config.preset }).system_exid, 'fallback');
});

test('submit POSTs the Creator no-payment route with exact consultation metadata', async () => {
  let calls = 0;
  const payload = buildPayload({ contact, href: 'http://localhost:4188/', preset: config.preset });
  const response = await submitLead(config, payload, async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://mufiksoft.com/shopifyband/amo-panel/forms.php?req=etsy_no_pay_4');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(options.credentials, 'omit');
    const body = JSON.parse(options.body);
    assert.deepEqual(body, payload);
    assert.equal(body.title, 'Консультация  запись  АІ Creator UA');
    assert.equal(body.stage, '105820611');
    assert.equal(body.type_lead, 'Теплый');
    assert.equal(body.product, 'Ai-creator');
    assert.equal(body.tag.split(';').length, 6);
    for (const field of ['amount', 'full_price', 'type_lead_pay', 'upstage', 'stripe_title']) assert.equal(Object.hasOwn(body, field), false);
    return { ok: true, json: async () => ({ formHistoryId: 'mock-history' }) };
  });
  assert.equal(response.formHistoryId, 'mock-history');
  assert.equal(calls, 1);
});

test('network, HTTP and backend failures never count as success', async () => {
  for (const fetchMock of [
    async () => { throw new Error('network'); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new Error('bad-json'); } }),
    async () => ({ ok: true, json: async () => ({ error: 'failed' }) }),
    async () => ({ ok: true, json: async () => ({ success: false }) }),
    async () => ({ ok: true, json: async () => null })
  ]) await assert.rejects(submitLead(config, contact, fetchMock), /Не вдалося/);
  await assert.rejects(submitLead({ ...config, enabled: false }, contact, async () => assert.fail('must not send')), /вимкнене/);
});

test('CRM requests have a timeout and reject rather than leaving the form waiting', async () => {
  await assert.rejects(submitLead({ ...config, timeoutMs: 5 }, contact, (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout'))))), /Не вдалося/);
});
