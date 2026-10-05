const form = document.querySelector('.registration-form');
const status = document.querySelector('.form-status');
const fixedCta = document.querySelector('.fixed-cta');
const registerSection = document.querySelector('.register');
const phoneInput = form?.querySelector('.phone-control');
const hiddenPhoneInput = form?.querySelector('input[name="phone"]');
const eventDate = document.querySelector('#event-date');
const eventTime = document.querySelector('#event-time');
let phonePlugin = null;
let formServicesPromise = null;

function setNextKyivEvent() {
  const monthNames = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const kyivParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(kyivParts.map(({ type, value }) => [type, value]));
  const tomorrow = new Date(Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day) + 1));

  if (eventDate) eventDate.textContent = `${tomorrow.getUTCDate()} ${monthNames[tomorrow.getUTCMonth()]}`;
  if (eventTime) eventTime.textContent = '19:00';
}

setNextKyivEvent();
const year = document.querySelector('#year');
if (year) year.textContent = String(new Date().getFullYear());

async function detectVisitorCountry() {
  const normalizeCountry = (countryCode) => {
    const normalized = String(countryCode || '').trim().toLowerCase();
    return /^[a-z]{2}$/.test(normalized) ? normalized : 'ua';
  };

  try {
    const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
    if (!response.ok) throw new Error('Geo lookup failed');
    const data = await response.json();
    return normalizeCountry(data.country_code);
  } catch {
    try {
      const response = await fetch('https://ipapi.co/country_code/');
      if (!response.ok) throw new Error('Fallback geo lookup failed');
      return normalizeCountry(await response.text());
    } catch {
      return 'ua';
    }
  }
}

function loadStylesheetOnce(href, id) {
  const existing = document.getElementById(id);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', () => resolve(link), { once: true });
    link.addEventListener('error', reject, { once: true });
    document.head.append(link);
  });
}

function loadScriptOnce(src, id) {
  const existing = document.getElementById(id);
  if (existing?.dataset.loaded === '1') return Promise.resolve(existing);

  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(existing), { once: true });
      existing.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      resolve(script);
    }, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.append(script);
  });
}

function initPhonePlugin() {
  if (!phoneInput || phonePlugin || !window.intlTelInput) return;

  phonePlugin = window.intlTelInput(phoneInput, {
    initialCountryLookup: detectVisitorCountry,
    separateDialCode: true,
    showFlags: true,
    placeholderNumberPolicy: 'AGGRESSIVE',
    formatAsYouType: true,
    strictMode: true,
    countryOrder: ['ua'],
    countryNameLocale: 'uk',
    uiTranslations: {
      selectedCountryAriaLabel: 'Змінити країну, зараз обрано ${countryName} (${dialCode})',
      noCountrySelected: 'Оберіть країну',
      countryListAriaLabel: 'Список країн',
      searchPlaceholder: 'Пошук країни',
      clearSearchAriaLabel: 'Очистити пошук',
      closeCountrySelectorAriaLabel: 'Закрити список країн',
      searchEmptyState: 'Країн не знайдено',
      searchSummaryAria: (count) => `Знайдено країн: ${count}`
    }
  });
}

function loadFormServices() {
  if (!form) return Promise.resolve();
  if (formServicesPromise) return formServicesPromise;

  formServicesPromise = Promise.all([
    loadStylesheetOnce('assets/vendor/intl-tel-input/css/intlTelInput.min.css', 'intl-tel-input-css'),
    loadScriptOnce('assets/vendor/intl-tel-input/js/intlTelInputWithUtils.min.js', 'intl-tel-input-js')
  ])
    .then(() => {
      initPhonePlugin();
      return loadScriptOnce('https://client.integraleap.com/js/sf.js', 'integraleap-sf');
    })
    .then(() => {
      window.ilForms?.create?.();
    })
    .catch(() => {
      formServicesPromise = null;
      status.textContent = 'Не вдалося завантажити сервіс реєстрації. Оновіть сторінку й спробуйте ще раз.';
    });

  return formServicesPromise;
}

if (registerSection && 'IntersectionObserver' in window) {
  const formServicesObserver = new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    loadFormServices();
  }, { rootMargin: '700px 0px' });

  formServicesObserver.observe(registerSection);
}

document.querySelectorAll('a[href="#form"]').forEach((link) => {
  ['pointerenter', 'focus', 'click'].forEach((eventName) => {
    link.addEventListener(eventName, loadFormServices, { once: true, passive: eventName !== 'click' });
  });
});

if (fixedCta && registerSection) {
  const formVisibilityObserver = new IntersectionObserver(([entry]) => {
    fixedCta.classList.toggle('is-hidden', entry.isIntersecting);
  }, { threshold: 0.05 });

  formVisibilityObserver.observe(registerSection);
}

form?.addEventListener('submit', (event) => {
  const data = new FormData(form);
  const email = String(data.get('email') || '').trim();
  const phone = phonePlugin?.getNumber() || String(data.get('phone_intlTelInput') || '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneIsValid = phonePlugin ? phonePlugin.isValidNumber() : phoneDigits.length >= 7;

  if (!email || !phoneIsValid || !email.includes('@')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    status.textContent = 'Перевірте, будь ласка, email і номер телефону.';
    return;
  }

  if (form.dataset.ilInit !== '1') {
    event.preventDefault();
    event.stopImmediatePropagation();
    status.textContent = 'Сервіс реєстрації ще завантажується. Спробуйте ще раз за кілька секунд.';
    return;
  }

  if (hiddenPhoneInput) hiddenPhoneInput.value = phone;
  status.textContent = 'Надсилаємо заявку…';
});

window.IlPrepareForm = async (formData) => {
  status.textContent = 'Надсилаємо заявку…';
  return formData;
};

window.IlAfterForm = async (formData) => {
  if (formData?.error) {
    status.textContent = 'Не вдалося надіслати заявку. Спробуйте ще раз.';
    return false;
  }

  status.textContent = 'Готово! Переходимо до Telegram…';
  return formData;
};

const reviews = [...document.querySelectorAll('.review')];
const dots = [...document.querySelectorAll('.dots span')];
const reviewVideos = [...document.querySelectorAll('.review video')];
const reviewPlayButtons = [...document.querySelectorAll('.review-play')];
let activeReview = 0;

function syncReviewPlayer(video) {
  const media = video.closest('.review-media');
  const button = media?.querySelector('.review-play');
  const isPlaying = !video.paused && !video.ended;
  media?.classList.toggle('is-playing', isPlaying);
  if (button) button.setAttribute('aria-label', isPlaying ? 'Призупинити відеовідгук' : 'Відтворити відеовідгук');
}

function toggleReviewVideo(video) {
  if (video.paused || video.ended) {
    reviewVideos.forEach((otherVideo) => {
      if (otherVideo !== video) otherVideo.pause();
    });
    video.play().catch(() => syncReviewPlayer(video));
  } else {
    video.pause();
  }
}

reviewVideos.forEach((video) => {
  video.addEventListener('click', () => toggleReviewVideo(video));
  ['play', 'pause', 'ended'].forEach((eventName) => video.addEventListener(eventName, () => syncReviewPlayer(video)));
  syncReviewPlayer(video);
});

reviewPlayButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const video = button.closest('.review-media')?.querySelector('video');
    if (video) toggleReviewVideo(video);
  });
});

function showReview(index) {
  activeReview = (index + reviews.length) % reviews.length;
  reviews.forEach((review, i) => review.classList.toggle('is-active', i === activeReview));
  dots.forEach((dot, i) => dot.classList.toggle('is-active', i === activeReview));
  reviewVideos.forEach((video, i) => {
    if (i !== activeReview) video.pause();
  });
}

document.querySelector('.slider-btn--prev')?.addEventListener('click', () => showReview(activeReview - 1));
document.querySelector('.slider-btn--next')?.addEventListener('click', () => showReview(activeReview + 1));

const telegramSlides = [...document.querySelectorAll('.telegram-slide')];
const telegramDots = [...document.querySelectorAll('.telegram-slider__dots button')];
const telegramSlider = document.querySelector('.telegram-slider');
let activeTelegramSlide = 0;
let telegramTouchStart = 0;

function showTelegramSlide(index) {
  activeTelegramSlide = (index + telegramSlides.length) % telegramSlides.length;
  telegramSlides.forEach((slide, i) => slide.classList.toggle('is-active', i === activeTelegramSlide));
  telegramDots.forEach((dot, i) => dot.classList.toggle('is-active', i === activeTelegramSlide));
}

document.querySelector('.telegram-slider__button--prev')?.addEventListener('click', () => showTelegramSlide(activeTelegramSlide - 1));
document.querySelector('.telegram-slider__button--next')?.addEventListener('click', () => showTelegramSlide(activeTelegramSlide + 1));
telegramDots.forEach((dot, index) => dot.addEventListener('click', () => showTelegramSlide(index)));

telegramSlider?.addEventListener('touchstart', (event) => {
  telegramTouchStart = event.changedTouches[0].clientX;
}, { passive: true });

telegramSlider?.addEventListener('touchend', (event) => {
  const distance = event.changedTouches[0].clientX - telegramTouchStart;
  if (Math.abs(distance) < 45) return;
  showTelegramSlide(activeTelegramSlide + (distance < 0 ? 1 : -1));
}, { passive: true });
