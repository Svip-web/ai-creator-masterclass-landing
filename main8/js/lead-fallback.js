/*!
 * lead-fallback.js — страховка на редирект после отправки формы.
 * Подключать ПЕРЕД https://client.integraleap.com/js/sf.js.
 *
 * Зачем: штатный путь sf.js — сначала ждёт ответ CRM (3–10 с), потом ещё один
 * запрос в SmartSender, и только потом уводит в бота. Если любой из двух
 * запросов повис или заблокирован, человек остаётся со спиннером навсегда.
 *
 * Что делает этот файл (штатный путь не ломает):
 *  1) параллельно с CRM готовит ссылку в бота (SmartSender store);
 *  2) как только CRM ответил — уводит сразу, не ожидая второй запрос;
 *  3) если через SHOW_AFTER человек всё ещё на странице — показывает кнопку
 *     «Открыть Telegram» (клик = жест пользователя: приложение открывается
 *     надёжно, а вкладка остаётся жить, поэтому незавершённый запрос в CRM
 *     не обрывается);
 *  4) HARD_AFTER — жёсткий автопереход, если штатного редиректа так и нет.
 */
(function () {
  var SHOW_AFTER = 6000;
  var HARD_AFTER = 20000;

  var link = '';
  var shown = false;
  var left = false;
  var tShow = null;
  var tHard = null;

  function cfg() {
    return window.ilfConfig || {};
  }

  function baseLink() {
    return cfg().ssLink || '';
  }

  function enrich(base, id) {
    try {
      if (base.indexOf('?') === -1) return base;
      var head = base.split('?')[0];
      var query = base.split('?')[1].split('&').map(function (pair) {
        var kv = pair.split('=');
        if (kv[0] === 'start') kv[1] = btoa(atob(kv[1]) + '|' + id).replace(/=/g, '');
        return kv.join('=');
      });
      return head + '?' + query.join('&');
    } catch (e) {
      return base;
    }
  }

  function prewarm(data) {
    var domain = cfg().ssDomain;
    if (!domain) return;
    var vars = {};
    try {
      Object.keys(data || {}).forEach(function (k) {
        var v = data[k];
        if (v !== null && v !== undefined && typeof v !== 'object' && String(v) !== '') {
          vars[k] = String(v);
        }
      });
    } catch (e) {}
    try {
      fetch('https://' + domain + '.customer.smartsender.eu/api/i/store', {
        method: 'POST',
        headers: { 'Content-type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ range: [], scope: {}, variables: vars })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.id) link = enrich(baseLink(), j.id); })
        .catch(function () {});
    } catch (e) {}
  }

  function go(url) {
    if (left) return;
    left = true;
    clearTimeout(tShow);
    clearTimeout(tHard);
    window.location.href = url;
  }

  function panel() {
    if (left || shown) return;
    var url = link || baseLink();
    if (!url) return;
    shown = true;

    var wrap = document.createElement('div');
    wrap.id = 'lead-fallback';
    wrap.setAttribute('style', [
      'position:fixed', 'inset:0', 'z-index:2147483647', 'display:flex',
      'align-items:center', 'justify-content:center', 'padding:24px',
      'background:rgba(12,10,24,.92)', 'text-align:center'
    ].join(';'));

    var box = document.createElement('div');
    box.setAttribute('style', 'max-width:340px;font-family:inherit');

    var text = document.createElement('div');
    text.setAttribute('style', 'color:#fff;font-size:17px;line-height:1.45;margin-bottom:20px');
    text.innerHTML = 'Заявка принята.<br>Осталось открыть бота в Telegram — ссылка на эфир придёт туда.';

    var btn = document.createElement('a');
    btn.href = url;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.textContent = 'Открыть Telegram';
    btn.setAttribute('style', [
      'display:block', 'padding:15px 22px', 'border-radius:999px',
      'background:#e84393', 'color:#fff', 'font-size:17px', 'font-weight:600',
      'text-decoration:none'
    ].join(';'));
    btn.addEventListener('click', function () {
      btn.href = link || baseLink();
      clearTimeout(tHard);
      text.innerHTML = 'Открыли Telegram в новой вкладке.<br>Не открылся — нажмите ещё раз.';
    });

    box.appendChild(text);
    box.appendChild(btn);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
  }

  var prevPrepare = window.IlPrepareForm;
  window.IlPrepareForm = function (data) {
    link = '';
    shown = false;
    left = false;
    prewarm(data);
    clearTimeout(tShow);
    clearTimeout(tHard);
    tShow = setTimeout(panel, SHOW_AFTER);
    tHard = setTimeout(function () { go(link || baseLink()); }, HARD_AFTER);
    return typeof prevPrepare === 'function' ? prevPrepare(data) : data;
  };

  var prevAfter = window.IlAfterForm;
  window.IlAfterForm = function (data) {
    var out = data;
    if (typeof prevAfter === 'function') {
      try {
        var r = prevAfter(data);
        if (r && typeof r === 'object') out = r;
        else if (r === false) return false;
      } catch (e) {}
    }
    // ссылка в бота уже готова — уводим сразу, не дожидаясь второго запроса sf.js
    if (link) {
      go(link);
      return false;
    }
    return out;
  };
  /* --------------------------------------------------------------------
   * Невалидное поле: sf.js вешает класс form__inp--error, но стиля под него
   * в css нет вообще — человек жмёт «Отправить», не происходит НИЧЕГО и он
   * уходит. Подсвечиваем поле и пишем, что не так.
   * ------------------------------------------------------------------ */
  var HINTS = {
    phone: 'Номер введён не полностью — допишите его до конца.',
    name: 'Напишите имя.',
    email: 'Проверьте адрес почты.'
  };

  function injectStyle() {
    if (document.getElementById('lf-style')) return;
    var st = document.createElement('style');
    st.id = 'lf-style';
    st.textContent =
      '.form__inp--error{border:1.5px solid #ff4d6d !important;' +
      'box-shadow:0 0 0 3px rgba(255,77,109,.14) !important}' +
      '.lf-hint{display:block;color:#ff4d6d;font-size:13px;line-height:1.35;' +
      'margin:6px 2px 0;text-align:left}';
    (document.head || document.documentElement).appendChild(st);
  }

  function hintFor(input) {
    var key = (input.getAttribute('name') || input.id || '').toLowerCase();
    if (key.indexOf('phone') > -1 || key.indexOf('tel') > -1) return HINTS.phone;
    if (key.indexOf('mail') > -1) return HINTS.email;
    if (key.indexOf('name') > -1) return HINTS.name;
    return 'Заполните это поле.';
  }

  function showHints(form) {
    [].forEach.call(form.querySelectorAll('.lf-hint'), function (h) {
      h.parentNode.removeChild(h);
    });
    var bad = form.querySelectorAll('.form__inp--error');
    if (!bad.length) return;
    injectStyle();
    [].forEach.call(bad, function (input) {
      var host = input.parentNode;
      if (!host || host.querySelector('.lf-hint')) return;
      var hint = document.createElement('span');
      hint.className = 'lf-hint';
      hint.textContent = hintFor(input);
      host.appendChild(hint);
      input.addEventListener('input', function clear() {
        input.removeEventListener('input', clear);
        if (hint.parentNode) hint.parentNode.removeChild(hint);
      });
    });
    bad[0].focus();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('[type="submit"]');
    if (!btn) return;
    var form = btn.form || (btn.closest && btn.closest('form'));
    if (!form) return;
    setTimeout(function () { showHints(form); }, 350);
  }, true);
})();