/* Контракт публічного обробника з оригінальної /record, без логування контактів. */
export function getCookie(cookieString, name) {
  const entry = cookieString.split(';').map(value => value.trim()).find(value => value.startsWith(name + '='));
  if (!entry) return '';
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return ''; }
}

export function normalizePhone(value, dialCode = '380') {
  const raw = String(value).trim();
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) digits = digits.slice(2);
  else if (!raw.startsWith('+')) {
    if (dialCode === '380' && /^0\d{9}$/.test(digits)) digits = digits.slice(1);
    const hasCountryCode = digits.startsWith(dialCode) && digits.length > 10;
    if (!hasCountryCode) digits = dialCode + digits;
  }
  return '+' + digits;
}

export function validateContact(contact, countryIso = '') {
  if (!contact.name.trim()) return { field: 'name', message: 'Вкажіть ваше ім’я.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) return { field: 'email', message: 'Вкажіть коректну email-адресу.' };
  if (!/^\+[1-9]\d{7,14}$/.test(contact.phone)) return { field: 'phone', message: 'Перевірте номер телефону та код країни.' };
  // РФ та Білорусь обмежені; спільний код +7 не блокує Казахстан (+76/+77).
  if (['ru', 'by'].includes(countryIso) || /^\+7(?![67])/.test(contact.phone) || /^\+375/.test(contact.phone)) {
    return { field: 'phone', message: 'Ця країна не підтримується.' };
  }
  return null;
}

export function buildPayload({ contact, href, cookieString = '', externalId = '', preset }) {
  const payload = Object.create(null);
  // Зберігаємо атрибуцію; URL не може перезаписати контакт, системні поля або пресет.
  const reserved = new Set(['name', 'email', 'phone', 'phone_intlTelInput', 'system_fbc', 'system_fbp', 'system_url', 'system_exid', '__proto__', 'constructor', 'prototype', ...Object.keys(preset)]);
  for (const [key, value] of new URL(href).searchParams) {
    if (!reserved.has(key)) payload[key] = value;
  }
  return {
    ...payload,
    system_fbc: getCookie(cookieString, '_fbc'),
    system_fbp: getCookie(cookieString, '_fbp'),
    system_url: href,
    system_exid: getCookie(cookieString, 'exid') || externalId,
    name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone,
    ...preset
  };
}

export async function submitLead(config, payload, fetchImpl = fetch) {
  if (!config.enabled) throw new Error('Надсилання заявок тимчасово вимкнене. Спробуйте пізніше.');
  const endpoint = new URL(config.endpoint);
  endpoint.searchParams.set('req', config.preset.req);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 20000);
  try {
    const result = await fetchImpl(endpoint.href, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal, credentials: 'omit'
    });
    if (!result.ok) throw new Error('server');
    const response = await result.json();
    if (!response || typeof response !== 'object' || Array.isArray(response) || response.error || response.success === false) throw new Error('backend');
    return response;
  } catch {
    throw new Error('Не вдалося надіслати заявку. Перевірте з’єднання та спробуйте ще раз.');
  } finally { clearTimeout(timeout); }
}
