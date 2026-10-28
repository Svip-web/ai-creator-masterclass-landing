(() => {
  'use strict';
  const CRM_URL = 'https://mufiksoft.com/shopifyband/amo-panel/forms.php?req=reg-web';
  const STORE_URL = 'https://aipashamik.customer.smartsender.eu/api/i/store';
  const BOT_URL = 'https://telegram.me/aicreatorjenny_bot?start=ZGw6MzMyNzEz';
  const PRESET = Object.freeze({title:'Регистрация Онлайн мастер-класс',stage:'97482948',tag:'Регистрация',product:'AI',type_lead:'Реєстрація',req:'reg-web'});
  const text = value => value == null ? '' : String(value);

  function failure(phase, accepted, timeout = false) {
    const message = phase === 'smartsender'
      ? 'Заявка принята, но не удалось открыть Telegram. Нажмите ещё раз.'
      : timeout
        ? 'Сервер не ответил вовремя. Попробуйте отправить заявку ещё раз.'
        : 'Не удалось отправить заявку. Попробуйте ещё раз.';
    const error = new Error(message);
    error.phase = phase;
    error.accepted = accepted || null;
    return error;
  }

  function validation(message) {
    const error = failure('crm', null);
    error.message = message;
    return error;
  }

  function isBlockedPhone(phone, country = '') {
    const iso = text(country).toLowerCase();
    const raw = text(phone).trim();
    const digits = raw.replace(/\D/g, '');
    return iso === 'ru' || iso === 'by' || /^7[3489]\d{9}$/.test(digits)
      || (!raw.startsWith('+') && /^8[3489]\d{9}$/.test(digits)) || /^375\d{9}$/.test(digits);
  }

  function validate(payload) {
    if (!text(payload && payload.name).trim()) throw validation('Введите имя.');
    const phone = text(payload && payload.phone).trim();
    if (isBlockedPhone(phone)) throw validation('Эта страна не поддерживается.');
    if (!/^\+[1-9]\d{8,14}$/.test(phone)) {
      throw validation('Введите корректный номер телефона с кодом страны.');
    }
  }

  function cookie(cookies, key) {
    if (cookies && typeof cookies === 'object') return text(cookies[key]);
    for (const pair of text(cookies).split(';')) {
      const split = pair.indexOf('=');
      if (split < 0 || pair.slice(0, split).trim() !== key) continue;
      const value = pair.slice(split + 1).trim();
      try { return decodeURIComponent(value); } catch { return value; }
    }
    return '';
  }

  function buildPayload({name, rawPhone, phone, search = '', url = '', cookies = '', exid = ''} = {}) {
    const query = {};
    new URLSearchParams(search).forEach((value, key) => {
      if (!['__proto__', 'constructor', 'prototype', 'error', 'dealId', 'contactId', 'formHistoryId'].includes(key)) query[key] = value;
    });
    const payload = {...query,
      system_fbc:cookie(cookies, '_fbc'), system_fbp:cookie(cookies, '_fbp'),
      system_url:text(url), system_exid:cookie(cookies, 'exid') || text(exid), name:text(name).trim(),
      phone_intltelinput:text(rawPhone), phone:text(phone).trim(), ...PRESET};
    validate(payload);
    return payload;
  }

  async function post(url, body, request, phase, accepted) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 20000) : null;
    try {
      const headers = {'Content-Type':'application/json'};
      if (phase === 'smartsender') headers['X-Requested-With'] = 'XMLHttpRequest';
      const response = await request(url, {method:'POST',headers,body:JSON.stringify(body),
        credentials:'omit',...(controller ? {signal:controller.signal} : {})});
      if (!response || response.status !== 200) throw failure(phase, accepted);
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw failure(phase, accepted);
      return data;
    } catch (error) {
      throw failure(phase, accepted, error && error.name === 'AbortError');
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  async function submit(payload, {request = fetch, accepted = null} = {}) {
    let merged;
    if (accepted !== null) {
      validate(accepted);
      if (accepted.error || !(accepted.dealId || accepted.contactId)) throw failure('crm', null);
      merged = {...accepted};
    } else {
      validate(payload);
      const response = await post(CRM_URL, payload, request, 'crm', null);
      if (response.error || !(response.dealId || response.contactId)) throw failure('crm', null);
      merged = {...payload, ...response};
    }
    const store = await post(STORE_URL, {range:[],scope:{},variables:merged}, request, 'smartsender', merged);
    if (store.error || !store.id) throw failure('smartsender', merged);
    const destination = new URL(BOT_URL);
    try {
      const start = destination.searchParams.get('start');
      destination.searchParams.set('start', btoa(atob(start) + '|' + store.id).replace(/=/g, ''));
    } catch { throw failure('smartsender', merged); }
    return {crm:merged,redirectUrl:destination.href,formHistoryId:merged.formHistoryId || ''};
  }

  window.YouTubeRegistration = Object.freeze({buildPayload,submit,isBlockedPhone});
})();
