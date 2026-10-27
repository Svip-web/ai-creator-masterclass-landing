const invalid = message => ({ error: { field: 'phone', message } });
const formatMessage = 'Вкажіть один номер телефону: цифри, пробіли, дужки або дефіси.';
const checkMessage = 'Перевірте номер телефону та код країни.';

// Код із перемикача застосовується до національного номера. Повний номер
// також дозволений: libphonenumber розрізняє його без ручного дублювання коду.
export function parsePhoneInput(value, country = {}, utils) {
  const raw = String(value ?? '').trim();
  if (!raw) return invalid('Вкажіть номер телефону.');
  if (!/^[+\d\s()\-\u2010-\u2015]+$/u.test(raw) || /[\r\n]/.test(raw) || !/^\+?[^+]*$/.test(raw)) return invalid(formatMessage);
  let depth = 0;
  for (const character of raw) {
    if (character === '(' && ++depth > 1) return invalid(formatMessage);
    if (character === ')' && --depth < 0) return invalid(formatMessage);
  }
  if (depth || /\(\s*\)/.test(raw)) return invalid(formatMessage);
  if (!utils || typeof utils.formatNumber !== 'function' || typeof utils.isValidNumber !== 'function') {
    return invalid('Не вдалося перевірити номер телефону. Спробуйте ще раз.');
  }

  const region = /^[a-z]{2}$/i.test(country.iso2 || '') ? country.iso2.toUpperCase() : '';
  let input = raw.replace(/[\u2010-\u2015]/g, '-');
  if (input.startsWith('00')) input = '+' + input.slice(2);
  if (!region && !input.startsWith('+')) return invalid('Оберіть код країни та введіть номер телефону.');

  try {
    const phone = utils.formatNumber(input, region, utils.numberFormat?.E164 ?? 0);
    // Перевірка всієї РФ, а не лише мобільних +79. Код +7 для Казахстану
    // (+76/+77) залишається доступним; перемикач країни не обходить правило.
    if (/^\+375/.test(phone) || (/^\+7/.test(phone) && !/^\+7[67]/.test(phone))) return invalid('Ця країна не підтримується.');
    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !utils.isValidNumber(phone, region)) {
      const code = typeof utils.getValidationError === 'function' ? utils.getValidationError(input, region) : null;
      if (code === (utils.validationError?.TOO_SHORT ?? 2)) return invalid('Номер телефону закороткий. Введіть його повністю.');
      if (code === (utils.validationError?.TOO_LONG ?? 3)) return invalid('Номер телефону задовгий. Перевірте код країни та цифри.');
      return invalid(checkMessage);
    }
    return { phone };
  } catch {
    return invalid(checkMessage);
  }
}
