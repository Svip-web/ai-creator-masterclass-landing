const form = document.querySelector('.registration-form');
const status = document.querySelector('.form-status');
const fixedCta = document.querySelector('.fixed-cta');
const registerSection = document.querySelector('.register');
const phoneInput = form?.querySelector('input[name="phone"]');
const eventDate = document.querySelector('#event-date');
const eventTime = document.querySelector('#event-time');

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

function formatUaPhone(value) {
  let digits = value.replace(/\D/g, '');

  if (digits.startsWith('380')) digits = digits.slice(3);
  if (digits.startsWith('0') && digits.length > 9) digits = digits.slice(1);

  digits = digits.slice(0, 9);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

phoneInput?.addEventListener('input', () => {
  phoneInput.value = formatUaPhone(phoneInput.value);
});

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
  const phone = String(data.get('phone') || '').trim();
  const phoneDigits = phone.replace(/\D/g, '');

  if (!email || phoneDigits.length !== 9 || !email.includes('@')) {
    status.textContent = 'Перевірте, будь ласка, email і номер телефону.';
    return;
  }

  status.textContent = 'Готово! Це локальна форма, тому дані не були відправлені.';
  form.reset();
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
