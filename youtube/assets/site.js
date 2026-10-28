(() => {
  'use strict';
  const overlay = document.querySelector('.overlay');
  const modal = overlay.querySelector('[role="dialog"]');
  const closeButton = modal.querySelector('.modal-close');
  let opener;
  const phoneInput = modal.querySelector('input[type="tel"]');
  const fullPhoneInput = modal.querySelector('input[name="phone"]');
  let countrySelectorOpen = false;

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
      if (window.intlTelInput.getAllCountries().some(country => country.iso2 === region)) return region;
    } catch { /* Older browsers fall back to Ukraine. */ }
    return 'ua';
  }

  // Same local, bundled phone formatter as Luna; no geo-IP or remote requests.
  const phonePicker = window.intlTelInput(phoneInput, {
    initialCountry: detectPhoneCountry(),
    countryOrder: ['ua','pl','de','es','ro','cz','sk','lt','lv','ee','md'],
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
  });
  function syncPhoneNumber() {
    fullPhoneInput.value = phonePicker.isValidNumber() ? phonePicker.getNumber() : '';
  }
  ['input','countrychange','blur'].forEach(name => phoneInput.addEventListener(name, syncPhoneNumber));
  phonePicker.promise.then(syncPhoneNumber);
  phoneInput.addEventListener('open:countryselector', () => { countrySelectorOpen = true; });
  phoneInput.addEventListener('close:countryselector', () => { countrySelectorOpen = false; });

  function closeModal() {
    phonePicker.closeCountrySelector();
    overlay.hidden = true;
    document.body.classList.remove('modal-open');
    opener?.focus();
    syncMotionVisibility();
  }
  document.querySelectorAll('.modal__open').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      overlay.hidden = false;
      document.body.classList.add('modal-open');
      closeButton.focus();
      syncMotionVisibility();
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
  modal.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    modal.querySelector('.form-status').textContent = 'Регистрация пока не открыта. Воронка будет подключена позже.';
  });

  const gallery = document.querySelector('.cases-section__box');
  const slides = [...gallery.children];
  const count = document.querySelector('.gallery-count');
  const previous = document.querySelector('.gallery-prev');
  const next = document.querySelector('.gallery-next');
  let active = 0;
  function updateGallery() {
    const offset = gallery.scrollLeft;
    active = slides.reduce((best, slide, index) => Math.abs(slide.offsetLeft - gallery.offsetLeft - offset) < Math.abs(slides[best].offsetLeft - gallery.offsetLeft - offset) ? index : best, 0);
    count.textContent = `${String(active + 1).padStart(2, '0')} / 07`;
    previous.disabled = gallery.scrollLeft < 5;
    next.disabled = gallery.scrollLeft + gallery.clientWidth >= gallery.scrollWidth - 5;
  }
  function slideBy(direction) {
    const width = slides[0].getBoundingClientRect().width + parseFloat(getComputedStyle(gallery).gap || '0');
    gallery.scrollBy({left:direction * width, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  previous.addEventListener('click', () => slideBy(-1));
  next.addEventListener('click', () => slideBy(1));
  gallery.addEventListener('scroll', updateGallery, {passive:true});
  addEventListener('resize', updateGallery);
  updateGallery();

  const sticky = document.querySelector('.fixed-section');
  const hero = document.querySelector('.intro-section');
  const footer = document.querySelector('.footer');
  function updateSticky() {
    const pastHero = hero.getBoundingClientRect().bottom < 0;
    const atFooter = footer.getBoundingClientRect().top < innerHeight;
    sticky.classList.toggle('is-visible', pastHero && !atFooter && overlay.hidden);
  }
  addEventListener('scroll', updateSticky, {passive:true});
  addEventListener('resize', updateSticky);
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
      '.intro-section__header', '.intro-section__box-title', '.intro-section__box-subtitle',
      '.hero-visual', '.intro-section__footer',
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
