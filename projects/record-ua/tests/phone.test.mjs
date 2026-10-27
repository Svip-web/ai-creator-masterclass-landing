import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parsePhoneInput } from '../src/js/phone.mjs';

const context = {};
vm.runInNewContext(await readFile(new URL('../src/vendor/utils.js', import.meta.url), 'utf8'), context);
const utils = context.intlTelInputUtils;
const countries = { ua: '380', pl: '48', de: '49', gb: '44', fr: '33', kz: '7', ru: '7', by: '375' };
const parse = (raw, iso2 = 'ua') => parsePhoneInput(raw, { iso2, dialCode: countries[iso2] }, utils);

test('Ukraine accepts national digits with the selected +380, or full country code entered once', () => {
  for (const raw of ['501234567', '50 123 45 67', '(50) 123-45-67', '0501234567', '380501234567', '+380501234567', '+380 (50) 123-45-67', '00380501234567']) {
    assert.deepEqual(parse(raw), { phone: '+380501234567' }, raw);
  }
});

test('country-aware parsing keeps correct Polish, German, French and British national formats', () => {
  const cases = [
    ['512345678', 'pl', '+48512345678'], ['48512345678', 'pl', '+48512345678'],
    ['0048512345678', 'pl', '+48512345678'], ['+48512345678', 'pl', '+48512345678'],
    ['030123456', 'de', '+4930123456'], ['49123456789', 'de', '+4949123456789'],
    ['049123456789', 'de', '+4949123456789'], ['+4949123456789', 'de', '+4949123456789'],
    ['0612345678', 'fr', '+33612345678'], ['+33612345678', 'fr', '+33612345678'],
    ['02079460018', 'gb', '+442079460018'], ['07911123456', 'gb', '+447911123456']
  ];
  for (const [raw, iso, phone] of cases) assert.deepEqual(parse(raw, iso), { phone }, `${iso}: ${raw}`);
});

test('Kazakhstan remains supported with national, trunk-8 and full-code input', () => {
  for (const raw of ['7011234567', '87011234567', '77011234567', '+77011234567', '0077011234567']) {
    assert.deepEqual(parse(raw, 'kz'), { phone: '+77011234567' }, raw);
  }
  assert.deepEqual(parse('+77011234567', 'ua'), { phone: '+77011234567' });
});

test('Russia fixed and mobile numbers and Belarus are rejected regardless of chosen picker', () => {
  for (const iso of ['ua', 'pl', 'kz', 'ru']) {
    for (const raw of ['+79161234567', '0079161234567', '+74951234567', '0074951234567', '+375291234567', '00375291234567']) {
      assert.match(parse(raw, iso).error.message, /країна не підтримується/, `${iso}: ${raw}`);
    }
  }
  for (const [raw, iso] of [['79161234567', 'kz'], ['89161234567', 'kz'], ['74951234567', 'ru'], ['84951234567', 'ru'], ['291234567', 'by']]) {
    assert.ok(parse(raw, iso).error, `${iso}: ${raw}`);
  }
});

test('malformed characters, extensions and multiple number syntax cannot become another valid contact', () => {
  for (const raw of ['+380501234567abc', '+380501234567ext', '++380501234567', '+380+501234567', '+380501234567#', '+380501234567/', '+380501234567 доб. 1', '+380501234567, +380671234567', '+380501234567\n+380671234567', '+380 (50 1234567', '+380 ()501234567', '+380 ((50))1234567']) {
    assert.ok(parse(raw).error, raw);
  }
  assert.ok(parse('+49 30 123456 ext1', 'de').error);
  assert.ok(parse('02079460018 ext 123', 'gb').error);
});

test('empty, short, long and unsupported-number ranges fail while valid numbers are not heuristically blacklisted', () => {
  for (const raw of ['', ' ', '123', '380', '50123456', '+38012345678901234567890', '+38099123', '+380111111111']) assert.ok(parse(raw).error, raw);
  assert.deepEqual(parse('+380501111111'), { phone: '+380501111111' });
});

test('validation fails closed when utilities are unavailable and explicit valid international input ignores stale picker', () => {
  assert.ok(parsePhoneInput('501234567', { iso2: 'ua', dialCode: '380' }).error);
  assert.ok(parsePhoneInput('501234567', {}, utils).error);
  assert.deepEqual(parse('+380501234567', 'ru'), { phone: '+380501234567' });
  assert.deepEqual(parse('+77011234567', 'by'), { phone: '+77011234567' });
});
