import { validateContact, buildPayload, submitLead } from './crm.mjs';
import { parsePhoneInput } from './phone.mjs';
import { createAssetLoader } from './lazy-assets.mjs';

const config = window.RECORD_CONFIG;
const modal = document.querySelector('[data-modal]');
const dialog = modal.querySelector('.modal__dialog');
const main = document.querySelector('main');
const form = document.querySelector('[data-record-form]');
const success = document.querySelector('[data-record-success]');
const error = form.querySelector('[data-form-error]');
const submitButton = form.querySelector('[data-submit]');
const phoneInput = form.elements.phone;
const phoneHint = document.querySelector('[data-phone-hint]');
const openButton = document.querySelector('[data-open-modal]');
const loadAsset = createAssetLoader(document);
let previousFocus;
let sending = false;
let phoneControl;
let phoneReady;
let visibleIssueField = '';

function updatePhoneHint() {
  const code = phoneControl?.getSelectedCountryData().dialCode || '380';
  phoneHint.textContent = `Код +${code} вже вибрано — повторювати його не потрібно. Повний номер із кодом теж приймається.`;
}
function readPhone() {
  return parsePhoneInput(phoneInput.value, phoneControl.getSelectedCountryData(), window.intlTelInputUtils);
}
function normalizePhoneDisplay() {
  if (!phoneControl || !phoneInput.value.trim()) return;
  const parsed = readPhone();
  if (parsed.error) { showIssue(parsed.error, false); return; }
  phoneControl.setNumber(parsed.phone);
  updatePhoneHint();
  phoneInput.removeAttribute('aria-invalid');
  if (visibleIssueField === 'phone') { error.hidden = true; error.textContent = ''; visibleIssueField = ''; }
}

function ensurePhoneControl() {
  if (phoneControl) return Promise.resolve(phoneControl);
  if (phoneReady) return phoneReady;
  phoneReady = Promise.all([
    loadAsset(PHONE_STYLE_URL, 'style'),
    loadAsset(PHONE_SCRIPT_URL),
    loadAsset(PHONE_UTILS_URL)
  ]).then(() => {
    if (!window.intlTelInput || !window.intlTelInputUtils) throw new Error('Не вдалося завантажити поле телефону. Спробуйте ще раз.');
    const wasFocused = document.activeElement === phoneInput;
    const enteredBeforeLoading = phoneInput.value;
    phoneControl = window.intlTelInput(phoneInput, {
      initialCountry: 'ua', preferredCountries: ['ua', 'pl', 'de'],
      excludeCountries: ['ru', 'by'], separateDialCode: true, formatOnDisplay: true,
      localizedCountries: { ua: 'Україна', pl: 'Польща', de: 'Німеччина', gb: 'Велика Британія', us: 'США', cz: 'Чехія', sk: 'Словаччина', es: 'Іспанія', it: 'Італія', fr: 'Франція', ca: 'Канада', pt: 'Португалія', ro: 'Румунія', md: 'Молдова', at: 'Австрія', be: 'Бельгія', nl: 'Нідерланди', ch: 'Швейцарія', kz: 'Казахстан' }
    });
    if (enteredBeforeLoading.trim()) {
      const parsed = parsePhoneInput(enteredBeforeLoading, phoneControl.getSelectedCountryData(), window.intlTelInputUtils);
      if (parsed.phone) phoneControl.setNumber(parsed.phone);
      else phoneInput.value = enteredBeforeLoading;
    }
    updatePhoneHint();
    if (wasFocused && modal.classList.contains('is-open')) phoneInput.focus({ preventScroll: true });
    return phoneControl;
  }).catch(failure => { phoneReady = null; throw failure; });
  return phoneReady;
}

const deadline = Date.now() + 15 * 60 * 1000;
const hoursNode = document.querySelector('[data-hours]');
const minutesNode = document.querySelector('[data-minutes]');
const secondsNode = document.querySelector('[data-seconds]');
let timerInterval;
function renderTimer() {
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  hoursNode.textContent = String(Math.floor(remaining / 3600)).padStart(2, '0');
  minutesNode.textContent = String(Math.floor(remaining % 3600 / 60)).padStart(2, '0');
  secondsNode.textContent = String(remaining % 60).padStart(2, '0');
  if (!remaining) { clearInterval(timerInterval); timerInterval = null; }
}
function syncTimer() {
  clearInterval(timerInterval); timerInterval = null;
  if (modal.classList.contains('is-open') && !document.hidden) {
    renderTimer();
    if (Date.now() < deadline) timerInterval = setInterval(renderTimer, 1000);
  }
}
document.addEventListener('visibilitychange', syncTimer);

function closeModal() {
  modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); modal.inert = true;
  main.inert = false; document.body.style.overflow = ''; previousFocus?.focus(); syncTimer();
}
openButton.addEventListener('click', () => {
  previousFocus = document.activeElement;
  modal.inert = false; modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
  main.inert = true; document.body.style.overflow = 'hidden'; syncTimer();
  if (success.hidden) ensurePhoneControl().catch(() => {});
  setTimeout(() => {
    if (modal.classList.contains('is-open')) (success.hidden ? form.elements.name : success).focus({ preventScroll: true });
  }, 80);
});
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
document.addEventListener('keydown', event => {
  if (!modal.classList.contains('is-open')) return;
  if (event.key === 'Escape') closeModal();
  if (event.key !== 'Tab') return;
  const nodes = [...dialog.querySelectorAll('button, input, [href], [tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
  const first = nodes[0], last = nodes.at(-1);
  if (!nodes.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
form.addEventListener('input', event => {
  event.target.removeAttribute('aria-invalid');
  if (!error.hidden && (!visibleIssueField || visibleIssueField === event.target.name)) {
    error.hidden = true; error.textContent = ''; visibleIssueField = '';
  }
});
phoneInput.addEventListener('blur', normalizePhoneDisplay);
phoneInput.addEventListener('countrychange', updatePhoneHint);

function showIssue(issue, focus = true) {
  visibleIssueField = issue.field || '';
  error.textContent = issue.message; error.hidden = false;
  if (issue.field) {
    form.elements[issue.field].setAttribute('aria-invalid', 'true');
    if (focus) form.elements[issue.field].focus();
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending) return;
  sending = true; submitButton.disabled = true; form.setAttribute('aria-busy', 'true');
  submitButton.textContent = 'Надсилаємо…'; error.hidden = true;
  try {
    // Повна телефонна перевірка обов’язкова навіть при миттєвому submit після відкриття.
    await ensurePhoneControl();
    const parsed = readPhone();
    if (parsed.error) { showIssue(parsed.error); return; }
    phoneControl.setNumber(parsed.phone);
    updatePhoneHint();
    const contact = { name: form.elements.name.value, email: form.elements.email.value, phone: parsed.phone };
    const issue = validateContact(contact);
    if (issue) { showIssue(issue); return; }
    let externalId = '';
    try { externalId = localStorage.getItem('exid') || ''; } catch {}
    const payload = buildPayload({ contact, href: location.href, cookieString: document.cookie, externalId, preset: config.crm.preset });
    const response = await submitLead(config.crm, payload);
    if (response.formHistoryId) { try { localStorage.setItem('ilFormHistoryId', response.formHistoryId); } catch {} }
    form.hidden = true; success.hidden = false; success.focus();
    form.dispatchEvent(new CustomEvent('ilf:success', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('record:lead-success'));
  } catch (failure) {
    showIssue(failure);
    form.dispatchEvent(new CustomEvent('ilf:error', { bubbles: true }));
  } finally {
    sending = false; submitButton.disabled = false; form.removeAttribute('aria-busy');
    submitButton.textContent = 'Почати свій шлях у ШІ';
  }
});

// Плеєр і відеопотік з’являються лише після явного натискання Play.
const videoButton = document.querySelector('[data-video-play]');
videoButton.addEventListener('click', () => {
  if (!config.video.src) return;
  const source = new URL(config.video.src, location.href);
  if (!['https:', 'http:'].includes(source.protocol)) return;
  const nativeVideo = config.video.type === 'video';
  const node = document.createElement(nativeVideo ? 'video' : 'iframe');
  if (!nativeVideo) source.searchParams.set('autoplay', 'true');
  node.src = source.href;
  if (nativeVideo) {
    node.controls = true; node.playsInline = true; node.autoplay = true; node.preload = 'metadata';
    if (config.video.poster) node.poster = config.video.poster;
    node.setAttribute('aria-label', config.video.title);
  } else {
    node.title = config.video.title; node.loading = 'eager'; node.allowFullscreen = true;
    node.allow = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen';
  }
  videoButton.replaceWith(node);
  if (nativeVideo) node.play().catch(() => {});
}, { once: true });
