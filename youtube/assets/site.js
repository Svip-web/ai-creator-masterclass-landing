(() => {
  'use strict';
  const overlay = document.querySelector('.overlay');
  const modal = overlay.querySelector('[role="dialog"]');
  const closeButton = modal.querySelector('.modal-close');
  let opener;
  const phoneInput = modal.querySelector('input[type="tel"]');
  const fullPhoneInput = modal.querySelector('input[name="phone"]');
  let countrySelectorOpen = false;
  let restoringOpenerFocus = false;
  let phonePicker = null, phonePreparation = null, phoneReady = false;
  phoneInput.disabled = true;

  function detectPhoneCountry() {
    const countriesByTimezone = {
      'Europe/Kyiv':'ua', 'Europe/Kiev':'ua', 'Europe/Warsaw':'pl',
      'Europe/Berlin':'de', 'Europe/Madrid':'es', 'Europe/Bucharest':'ro',
      'Europe/Prague':'cz', 'Europe/Bratislava':'sk', 'Europe/Vilnius':'lt',
      'Europe/Riga':'lv', 'Europe/Tallinn':'ee', 'Europe/Chisinau':'md',
      'Europe/Rome':'it', 'Europe/Paris':'fr', 'Europe/Lisbon':'pt',
      'Europe/Amsterdam':'nl', 'Europe/Brussels':'be', 'Europe/Vienna':'at',
      'Europe/London':'gb'
    };
    const timezoneCountry = countriesByTimezone[Intl.DateTimeFormat().resolvedOptions().timeZone];
    if (timezoneCountry) return timezoneCountry;
    try {
      const locale = new Intl.Locale(navigator.languages?.[0] || navigator.language).maximize();
      const region = locale.region?.toLowerCase();
      if (region === 'ru' || region === 'by') return 'ua';
      if (window.intlTelInput.getAllCountries().some(country => country.iso2 === region)) return region;
    } catch { /* Older browsers fall back to Ukraine. */ }
    return 'ua';
  }

  // The matching local Luna formatter is prepared only after CTA intent/open.
  function phoneOptions() { return {
    initialCountry: detectPhoneCountry(),
    countryOrder: ['ua','pl','de','es','ro','cz','sk','lt','lv','ee','md'],
    excludeCountries: ['ru','by'],
    countryNameLocale: 'ru',
    countrySelectorMode: 'FULLSCREEN',
    countrySearch: true,
    dropdownParent: document.body,
    separateDialCode: true,
    showFlags: true,
    strictMode: true,
    formatAsYouType: true,
    placeholderNumberPolicy: 'AGGRESSIVE',
    uiTranslations: {
      selectedCountryAriaLabel: 'Выбрать страну: ${countryName} (${dialCode})',
      searchPlaceholder: 'Поиск страны',
      clearSearchAriaLabel: 'Очистить поиск',
      countryListAriaLabel: 'Список стран',
      noCountrySelected: 'Страна не выбрана',
      searchEmptyState: 'Страна не найдена',
      searchSummaryAria: count => `Найдено стран: ${count}`
    }
  }; }
  function syncPhoneNumber() {
    fullPhoneInput.value = phoneReady && phonePicker.isValidNumber() ? phonePicker.getNumber() : '';
  }
  function preparePhone() {
    if (!phoneReady && !overlay.hidden && registration) registrationStatus.textContent = 'Загружаем поле телефона…';
    if (phonePreparation) return phonePreparation;
    const request = window.YouTubePhoneLoader
      ? window.YouTubePhoneLoader.prepare()
      : Promise.reject(new Error('Не удалось загрузить поле телефона.'));
    phonePreparation = request.then(factory => {
      phonePicker = factory(phoneInput, phoneOptions());
      phoneReady = true;
      if (!registrationPending) {
        phonePicker.setDisabled(false);
        registrationButton.disabled = !registration;
      }
      syncPhoneNumber();
      motionObserver?.observe(registrationButton);
      if (registrationStatus.textContent === 'Загружаем поле телефона…') registrationStatus.textContent = '';
      return phonePicker;
    }).catch(() => {
      phonePreparation = null;
      phoneReady = false;
      fullPhoneInput.value = '';
      phoneInput.disabled = true;
      registrationButton.disabled = true;
      if (!overlay.hidden) {
        registrationStatus.textContent = 'Не удалось загрузить поле телефона. Закройте и откройте форму, чтобы повторить.';
      }
      return null;
    });
    return phonePreparation;
  }
  ['input','countrychange','blur'].forEach(name => phoneInput.addEventListener(name, syncPhoneNumber));
  phoneInput.addEventListener('open:countryselector', () => { countrySelectorOpen = true; });
  phoneInput.addEventListener('close:countryselector', () => { countrySelectorOpen = false; });

  function closeModal() {
    phonePicker?.closeCountrySelector();
    overlay.hidden = true;
    document.body.classList.remove('modal-open');
    restoringOpenerFocus = true;
    opener?.focus();
    restoringOpenerFocus = false;
    syncMotionVisibility();
    updateSticky();
  }
  document.querySelectorAll('.modal__open').forEach(button => {
    ['pointerdown','pointerenter','focus'].forEach(event => button.addEventListener(event, () => {
      if (!restoringOpenerFocus) preparePhone();
    }));
    button.addEventListener('click', () => {
      opener = button;
      overlay.hidden = false;
      document.body.classList.add('modal-open');
      closeButton.focus();
      syncMotionVisibility();
      updateSticky();
      preparePhone();
    });
  });
  closeButton.addEventListener('click', closeModal);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;
    // The mobile country picker is outside the dialog. Let it own its keyboard
    // navigation, and close only that picker on the first Escape.
    if (countrySelectorOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        phonePicker.closeCountrySelector();
        modal.querySelector('.iti__selected-country').focus();
      } else if (event.key === 'Tab') {
        const picker = document.querySelector('.iti--detached-country-selector');
        const controls = [...picker.querySelectorAll('input, button')].filter(element =>
          !element.disabled && element.tabIndex >= 0 && element.getClientRects().length
        );
        const first = controls[0], last = controls.at(-1);
        if (first && ((!event.shiftKey && document.activeElement === last) ||
          (event.shiftKey && document.activeElement === first) || !picker.contains(document.activeElement))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
      return;
    }
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button:not([disabled]), input:not([type="hidden"]):not([disabled]), a[href]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);
  const registrationForm = modal.querySelector('form');
  const registrationStatus = modal.querySelector('.form-status');
  const registrationButton = registrationForm.querySelector('[type="submit"]');
  const registrationLabel = registrationButton.querySelector('span');
  const registrationLabelText = registrationLabel.textContent;
  const registration = window.YouTubeRegistration;
  let registrationPending = false;
  let acceptedRegistration = null;
  let acceptedFingerprint = '';
  function storedValue(key) {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  }
  function rememberRegistration(data) {
    if (data?.formHistoryId) {
      try { localStorage.setItem('ilFormHistoryId', String(data.formHistoryId)); } catch { /* Storage may be unavailable. */ }
    }
  }
  registrationButton.disabled = !registration || !phoneReady;
  if (!registration) registrationStatus.textContent = 'Не удалось загрузить форму. Обновите страницу.';
  registrationForm.addEventListener('input', () => {
    if (!registrationPending && phoneReady) registrationStatus.textContent = '';
    if (!registrationPending && acceptedRegistration) {
      acceptedRegistration = null;
      acceptedFingerprint = '';
      registrationLabel.textContent = registrationLabelText;
      registrationStatus.textContent = '';
    }
  });
  registrationForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (registrationPending || !registration) return;
    if (!phoneReady) { preparePhone(); return; }
    const nameInput = registrationForm.querySelector('[name="name"]');
    const name = nameInput.value.trim();
    syncPhoneNumber();
    const phone = fullPhoneInput.value;
    if (!name) {
      registrationStatus.textContent = 'Введите имя.';
      nameInput.focus();
      return;
    }
    if (!phonePicker.isValidNumber() || !phone) {
      registrationStatus.textContent = 'Введите корректный номер телефона.';
      phoneInput.focus();
      return;
    }
    if (registration.isBlockedPhone(phone, phonePicker.getSelectedCountryData().iso2)) {
      registrationStatus.textContent = 'Регистрация с этим номером недоступна.';
      phoneInput.focus();
      return;
    }
    const fingerprint = `${name}\n${phone}`;
    if (acceptedFingerprint !== fingerprint) {
      acceptedRegistration = null;
      acceptedFingerprint = '';
    }
    let payload;
    try {
      payload = registration.buildPayload({name, rawPhone:phoneInput.value, phone, search:location.search, url:location.href, cookies:document.cookie, exid:storedValue('exid')});
    } catch (error) {
      registrationStatus.textContent = error.message || 'Проверьте имя и номер телефона.';
      return;
    }
    registrationPending = true;
    const controlStates = [...registrationForm.querySelectorAll('input, button')]
      .filter(control => control !== registrationButton)
      .map(control => ({control, disabled:control.disabled}));
    controlStates.forEach(({control}) => { control.disabled = true; });
    registrationButton.disabled = true;
    registrationButton.setAttribute('aria-busy', 'true');
    registrationLabel.textContent = 'Отправляем…';
    registrationStatus.textContent = '';
    try {
      const result = await registration.submit(payload, {
        accepted:acceptedFingerprint === fingerprint ? acceptedRegistration : null,
        onAccepted:data => window.YouTubeTracking?.lead(data)
      });
      acceptedRegistration = result.crm;
      acceptedFingerprint = fingerprint;
      rememberRegistration(result.crm);
      registrationStatus.textContent = 'Регистрация прошла успешно. Открываем Telegram…';
      registrationLabel.textContent = 'Открываем Telegram…';
      location.assign(result.redirectUrl);
    } catch (error) {
      if (error.accepted) {
        acceptedRegistration = error.accepted;
        acceptedFingerprint = fingerprint;
        rememberRegistration(error.accepted);
      }
      registrationLabel.textContent = acceptedRegistration ? 'Повторить переход' : registrationLabelText;
      registrationStatus.textContent = error.message || 'Не удалось отправить заявку. Попробуйте ещё раз.';
    } finally {
      registrationPending = false;
      controlStates.forEach(({control, disabled}) => { control.disabled = disabled; });
      registrationButton.disabled = !registration || !phoneReady;
      registrationButton.removeAttribute('aria-busy');
    }
  });

  const gallery = document.querySelector('.cases-section__box');
  const slides = [...gallery.children];
  const count = document.querySelector('.gallery-count');
  const previous = document.querySelector('.gallery-prev');
  const next = document.querySelector('.gallery-next');
  let active = 0, galleryFrame = 0, galleryMeasureNeeded = false;
  let slideOffsets = [], galleryWidth = 0, galleryExtent = 0, galleryStep = 0;
  function measureGallery() {
    const left = gallery.offsetLeft;
    slideOffsets = slides.map(slide => slide.offsetLeft - left);
    galleryWidth = gallery.clientWidth;
    galleryExtent = gallery.scrollWidth;
    galleryStep = slideOffsets.length > 1 ? slideOffsets[1] - slideOffsets[0] : galleryWidth;
  }
  function updateGallery() {
    const offset = gallery.scrollLeft;
    active = slideOffsets.reduce((best, left, index) => Math.abs(left - offset) < Math.abs(slideOffsets[best] - offset) ? index : best, 0);
    const label = `${String(active + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    if (count.textContent !== label) count.textContent = label;
    previous.disabled = offset < 5;
    next.disabled = offset + galleryWidth >= galleryExtent - 5;
  }
  function scheduleGallery(measure = false) {
    galleryMeasureNeeded = galleryMeasureNeeded || measure;
    if (galleryFrame) return;
    galleryFrame = requestAnimationFrame(() => {
      galleryFrame = 0;
      if (galleryMeasureNeeded) {
        galleryMeasureNeeded = false;
        measureGallery();
      }
      updateGallery();
    });
  }
  function slideBy(direction) {
    gallery.scrollBy({left:direction * galleryStep, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  previous.addEventListener('click', () => slideBy(-1));
  next.addEventListener('click', () => slideBy(1));
  gallery.addEventListener('scroll', () => scheduleGallery(), {passive:true});
  addEventListener('resize', () => scheduleGallery(true));
  if ('ResizeObserver' in window) new ResizeObserver(() => scheduleGallery(true)).observe(gallery);
  measureGallery();
  updateGallery();

  const sticky = document.querySelector('.fixed-section');
  const hero = document.querySelector('.intro-section');
  const footer = document.querySelector('.footer');
  let pastHero = hero.getBoundingClientRect().bottom < 0;
  let atFooter = footer.getBoundingClientRect().top < innerHeight;
  function updateSticky() {
    sticky.classList.toggle('is-visible', pastHero && !atFooter && overlay.hidden);
  }
  if ('IntersectionObserver' in window) {
    const stickyObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === hero) pastHero = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
        if (entry.target === footer) atFooter = entry.boundingClientRect.top < (entry.rootBounds?.bottom ?? innerHeight);
      });
      updateSticky();
    });
    stickyObserver.observe(hero);
    stickyObserver.observe(footer);
  } else {
    let stickyFrame = 0;
    const scheduleSticky = () => {
      if (stickyFrame) return;
      stickyFrame = requestAnimationFrame(() => {
        stickyFrame = 0;
        pastHero = hero.getBoundingClientRect().bottom < 0;
        atFooter = footer.getBoundingClientRect().top < innerHeight;
        updateSticky();
      });
    };
    addEventListener('scroll', scheduleSticky, {passive:true});
    addEventListener('resize', scheduleSticky);
  }
  updateSticky();

  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakSet();
  const visibleMotionTargets = new Set();
  const activeAnimations = new Set();
  const resultTimeline = document.querySelector('.result-section__box-list');
  let revealObserver, motionObserver, timelineResizeObserver;

  function syncMotionVisibility() {
    const allowed = !motionPreference.matches && !document.hidden && !document.body.classList.contains('modal-open');
    visibleMotionTargets.forEach(element => element.classList.toggle('is-motion-visible', allowed));
  }

  function syncResultTimeline() {
    if (!resultTimeline?.classList.contains('timeline-motion')) return;
    const rows = [...resultTimeline.querySelectorAll('.result-section__box-list-item')];
    const centers = rows.map(row => {
      const icon = row.querySelector('.arrow');
      const rowBox = row.getBoundingClientRect();
      const iconBox = icon.getBoundingClientRect();
      return row.offsetTop + iconBox.top - rowBox.top + iconBox.height / 2;
    });
    const first = centers[0], last = centers.at(-1);
    if (!(last > first)) return;
    resultTimeline.style.setProperty('--timeline-top', `${first}px`);
    resultTimeline.style.setProperty('--timeline-bottom', `${resultTimeline.offsetHeight - last}px`);
    rows.forEach((row, index) => {
      row.style.setProperty('--timeline-delay', `${(centers[index] - first) / (last - first) * 5.4}s`);
    });
  }

  function stopMotion() {
    revealObserver?.disconnect();
    motionObserver?.disconnect();
    timelineResizeObserver?.disconnect();
    resultTimeline?.classList.remove('timeline-motion');
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
    document.querySelectorAll('.is-motion-visible').forEach(element => element.classList.remove('is-motion-visible'));
    visibleMotionTargets.clear();
  }

  function startMotion() {
    stopMotion();
    document.querySelectorAll('.intro-section__header, .intro-section__box-title, .intro-section__box-subtitle, .hero-visual, .intro-section__footer').forEach(element => {
      seen.add(element);
      element.classList.add('is-inview');
    });
    if (motionPreference.matches || !('IntersectionObserver' in window) || typeof Element.prototype.animate !== 'function') return;

    if (resultTimeline) {
      resultTimeline.querySelectorAll('.arrow path').forEach(path => path.setAttribute('pathLength', '1'));
      resultTimeline.classList.add('timeline-motion');
      syncResultTimeline();
      if ('ResizeObserver' in window) {
        timelineResizeObserver = new ResizeObserver(syncResultTimeline);
        timelineResizeObserver.observe(resultTimeline);
      }
    }

    const selectors = [
      '.second-section__box', '.learn-section__title', '.comparison-pair',
      '.register-section__titles', '.register-section__box-item',
      '.author-section__title', '.author-visual', '.author-section__sheip', '.author-section__box-item',
      '.practice-section__box-title', '.practice-section__box-inner-item',
      '.cases-section__titles', '.cases-section__box', '.result-section__box-title', '.result-section__box-list-item',
      '.last-section__titles', '.last-section__box-item', '.last-section__subtext'
    ];
    const targets = [...document.querySelectorAll(selectors.join(','))];
    const delays = new WeakMap(targets.map((element, index) => [element, (index % 4) * 65]));
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        revealObserver.unobserve(element);
        if (seen.has(element)) return;
        seen.add(element);
        element.classList.add('is-inview');
        const animation = element.animate([
          {opacity:0, transform:'translate3d(0,20px,0)'},
          {opacity:1, transform:'translate3d(0,0,0)'}
        ], {duration:680, delay:delays.get(element) || 0, easing:'cubic-bezier(.16,1,.3,1)', fill:'both'});
        activeAnimations.add(animation);
        animation.finished.then(() => {
          activeAnimations.delete(animation);
          animation.cancel();
        }).catch(() => activeAnimations.delete(animation));
      });
    }, {threshold:.08, rootMargin:'0px 0px -24px 0px'});
    targets.filter(element => !seen.has(element)).forEach(element => revealObserver.observe(element));

    motionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visibleMotionTargets.add(entry.target);
        else {
          visibleMotionTargets.delete(entry.target);
          entry.target.classList.remove('is-motion-visible');
        }
      });
      syncMotionVisibility();
    }, {threshold:.01});
    document.querySelectorAll('.t-btn:not(:disabled), .hero-visual, .learn-section__box-item-label, .register-section__box-item .icon, .result-section__box-list').forEach(element => motionObserver.observe(element));
  }
  if (!('ResizeObserver' in window)) addEventListener('resize', syncResultTimeline);
  document.fonts?.ready.then(syncResultTimeline);
  motionPreference.addEventListener('change', startMotion);
  document.addEventListener('visibilitychange', syncMotionVisibility);
  startMotion();
})();
