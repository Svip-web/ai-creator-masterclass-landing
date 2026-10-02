const form = document.querySelector('.registration-form');
const status = document.querySelector('.form-status');
const fixedCta = document.querySelector('.fixed-cta');
const registerSection = document.querySelector('.register');
const phoneInput = form?.querySelector('input[name="phone"]');
const eventDate = document.querySelector('#event-date');
const eventTime = document.querySelector('#event-time');
let phonePlugin = null;

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

if (phoneInput && window.intlTelInput) {
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

if (fixedCta && registerSection) {
  const formVisibilityObserver = new IntersectionObserver(([entry]) => {
    fixedCta.classList.toggle('is-hidden', entry.isIntersecting);
  }, { threshold: 0.05 });

  formVisibilityObserver.observe(registerSection);
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const email = String(data.get('email') || '').trim();
  const phone = phonePlugin?.getNumber() || String(data.get('phone') || '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneIsValid = phonePlugin ? phonePlugin.isValidNumber() : phoneDigits.length >= 7;

  if (!email || !phoneIsValid || !email.includes('@')) {
    status.textContent = 'Перевірте, будь ласка, email і номер телефону.';
    return;
  }

  status.textContent = 'Готово! Це локальна форма, тому дані не були відправлені.';
  form.reset();
  phonePlugin?.setNumber('');
});

const reviews = [...document.querySelectorAll('.review')];
const dots = [...document.querySelectorAll('.dots span')];
const reviewVideos = [...document.querySelectorAll('.review video')];
let activeReview = 0;

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
