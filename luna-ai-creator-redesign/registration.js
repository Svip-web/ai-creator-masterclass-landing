(() => {
  const forms = [...document.querySelectorAll('[data-registration-form]')];
  if (!forms.length) return;

  const telegram = 'https://telegram.me/aicreatorjenny_bot?start=ZGw6MzMyNzEz';
  const hostname = location.hostname.toLowerCase();
  const isPreview = location.protocol === 'file:' || /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/.test(hostname) || /(^|\.)chatgpt\.site$/.test(hostname);
  const lead = {
    title: 'Регистрация не бесплатный миникурс',
    stage: '97482948',
    tag: 'Регистрация',
    product: 'Ai-creator',
    type_lead: 'Реєстрація',
    req: 'reg-web',
  };

  const submitButtons = forms.flatMap((form) => [...form.querySelectorAll('[type="submit"]')]);
  const receipts = new Map();
  let turnstileReady;
  let pending = false;

  function loadTurnstile() {
    if (window.turnstile?.render) return Promise.resolve(window.turnstile);
    if (turnstileReady) return turnstileReady;

    turnstileReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const deadline = setTimeout(() => fail('Turnstile timed out'), 12000);

      function fail(message) {
        clearTimeout(deadline);
        script.remove();
        reject(new Error(message));
      }

      script.addEventListener('error', () => fail('Turnstile failed to load'));
      script.addEventListener('load', () => {
        if (!window.turnstile?.render) {
          fail('Turnstile is unavailable');
          return;
        }
        clearTimeout(deadline);
        resolve(window.turnstile);
      });
      document.head.append(script);
    }).catch((reason) => {
      turnstileReady = null;
      throw reason;
    });

    return turnstileReady;
  }

  function cookie(name) {
    const prefix = `${name}=`;
    const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix));
    if (!entry) return '';
    const value = entry.slice(prefix.length);
    try { return decodeURIComponent(value); } catch { return value; }
  }

  function registrationData(number) {
    const page = new URL(location.href);
    for (const key of [...page.searchParams.keys()]) {
      if (!/^utm_[a-z0-9_-]+$/i.test(key) && !/^(fbclid|gclid|ttclid|campaign_id|adset_id|ad_id|ref|exid)$/i.test(key)) {
        page.searchParams.delete(key);
      }
    }
    page.hash = '';

    let externalId = cookie('exid');
    try { externalId ||= localStorage.getItem('exid') ?? ''; } catch { /* Storage is optional. */ }

    const attribution = {
      ...Object.fromEntries(page.searchParams),
      system_url: page.href,
    };
    return {
      attribution,
      data: {
        ...attribution,
        system_fbc: cookie('_fbc'),
        system_fbp: cookie('_fbp'),
        system_exid: externalId,
        phone: number,
        ...lead,
      },
    };
  }

  async function postJson(url, data, extraHeaders = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Registration request failed');
      const result = await response.json();
      if (!result || typeof result !== 'object' || Array.isArray(result) || result.error || result.success === false) {
        throw new Error('Registration was rejected');
      }
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  function telegramWithContext(id) {
    const url = new URL(telegram);
    const current = atob(url.searchParams.get('start'));
    url.searchParams.set('start', btoa(`${current}|${id}`).replace(/=+$/, ''));
    return url.href;
  }

  function normalizePhone(value, countryPicker) {
    const trimmed = value.trim();
    if (!/^\+?[\d\s().-]+$/.test(trimmed)) return '';
    let digits = trimmed.replace(/\D/g, '');
    if (!trimmed.startsWith('+') && digits.startsWith('00')) {
      digits = digits.slice(2);
    } else if (!trimmed.startsWith('+')) {
      const country = countryPicker?.getSelectedCountryData();
      const utils = window.intlTelInputUtils;
      if (country?.iso2 && utils) {
        const formatted = utils.formatNumber(trimmed, country.iso2, utils.numberFormat.E164);
        if (/^\+[1-9]\d{6,14}$/.test(formatted)) return formatted;
      }

      if ((country?.iso2 === 'ua' || !country?.iso2) && /^0\d{9}$/.test(digits)) {
        digits = `38${digits}`;
      } else if (country?.dialCode) {
        digits = `${country.dialCode}${digits}`;
      } else if (/^[1-9]\d{8}$/.test(digits)) {
        digits = `380${digits}`;
      }
    }
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : '';
  }

  function setupRegistration(form) {
    const phone = form.querySelector('input[name="phone"]');
    const wrapper = form.closest('.w-form');
    if (!phone || !wrapper) return;

    const status = wrapper.querySelector('[data-registration-status]');
    const success = wrapper.querySelector('[data-registration-success]');
    const error = wrapper.querySelector('[data-registration-error]');
    const fallback = wrapper.querySelector('[data-registration-fallback]');
    const continuation = wrapper.querySelector('[data-registration-continue]');
    const errorMessage = error?.querySelector('[data-registration-message]');
    const challenge = form.querySelector('[data-registration-challenge]');
    const sitekey = form.dataset.turnstileSitekey;
    const countryPicker = typeof window.intlTelInput === 'function'
      ? window.intlTelInput(phone, {
        initialCountry: 'ua',
        preferredCountries: ['ua'],
        excludeCountries: ['ru', 'by'],
        separateDialCode: true,
        autoPlaceholder: 'aggressive',
        dropdownContainer: document.body,
      })
      : null;

    let widget;
    let widgetId;

    function setStatus(message) {
      if (!status) return;
      status.textContent = message;
      status.hidden = !message;
    }

    function clearFeedback() {
      setStatus('');
      if (error) error.hidden = true;
      if (fallback) fallback.hidden = true;
      if (success) success.hidden = true;
    }

    function showError(message) {
      setStatus(errorMessage ? '' : message);
      if (errorMessage) errorMessage.textContent = message;
      if (error) error.hidden = false;
      if (fallback) fallback.hidden = false;
    }

    function loadChallenge() {
      if (!widget) {
        widget = loadTurnstile().then((turnstile) => {
          if (!challenge) throw new Error('Turnstile container is missing');
          challenge.hidden = false;
          widgetId = turnstile.render(challenge, { sitekey, language: 'ru', size: 'flexible' });
          return widgetId;
        }).catch((reason) => {
          widget = null;
          throw reason;
        });
      }
      return widget;
    }

    phone.addEventListener('input', () => {
      phone.setCustomValidity('');
      if (!pending) clearFeedback();
    });

    if (countryPicker) {
      phone.addEventListener('countrychange', () => { phone.setCustomValidity(''); });
      phone.addEventListener('paste', (event) => {
        const pasted = event.clipboardData?.getData('text').trim();
        if (!pasted || !/^(\+|00)/.test(pasted)) return;
        const number = normalizePhone(pasted, countryPicker);
        if (!number) return;
        event.preventDefault();
        countryPicker.setNumber(number);
        phone.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    if (!isPreview && sitekey) {
      phone.addEventListener('focus', () => { loadChallenge().catch(() => {}); }, { once: true });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (pending) return;
      clearFeedback();

      const number = normalizePhone(phone.value, countryPicker);
      if (!number) {
        phone.setCustomValidity('Введите номер телефона с кодом страны.');
        phone.reportValidity();
        return;
      }

      if (isPreview) {
        showError('В режиме просмотра заявка не отправляется. Мини-курс доступен в Telegram.');
        return;
      }

      pending = true;
      const disabled = submitButtons.map((button) => button.disabled);
      submitButtons.forEach((button) => { button.disabled = true; });
      form.setAttribute('aria-busy', 'true');
      setStatus('Подождите…');

      try {
        let receipt = receipts.get(number);
        if (!receipt) {
          const { data, attribution } = registrationData(number);
          const payload = { ...data };
          if (sitekey) {
            const id = await loadChallenge();
            const token = window.turnstile.getResponse(id);
            if (!token) {
              showError('Пройдите проверку под номером телефона и отправьте заявку ещё раз.');
              return;
            }
            payload['cf-turnstile-response'] = token;
          }
          const result = await postJson(`https://mufiksoft.com/shopifyband/amo-panel/forms.php?req=${lead.req}`, payload);
          receipt = { variables: { ...data, ...result, ...attribution } };
          receipts.set(number, receipt);

          if (receipt.variables.formHistoryId) {
            try { localStorage.setItem('ilFormHistoryId', receipt.variables.formHistoryId); } catch { /* Storage is optional. */ }
          }
          window.dispatchEvent(new Event('registration:accepted'));
        }

        if (!receipt.destination) {
          const result = await postJson('https://aipashamik.customer.smartsender.eu/api/i/store', {
            range: [],
            scope: {},
            variables: receipt.variables,
          }, { 'X-Requested-With': 'XMLHttpRequest' });
          if (!result.id) throw new Error('Telegram context is missing');
          receipt.destination = telegramWithContext(result.id);
        }

        setStatus('');
        if (success) success.hidden = false;
        if (continuation) continuation.href = receipt.destination;
        location.assign(receipt.destination);
      } catch {
        if (receipts.has(number)) {
          showError('Заявка получена. Откройте мини-курс в Telegram.');
        } else {
          showError('Не удалось отправить заявку. Попробуйте ещё раз или откройте мини-курс в Telegram.');
          if (widgetId !== undefined) window.turnstile?.reset(widgetId);
        }
      } finally {
        pending = false;
        form.removeAttribute('aria-busy');
        submitButtons.forEach((button, index) => { button.disabled = disabled[index]; });
      }
    });
  }

  forms.forEach(setupRegistration);
})();
