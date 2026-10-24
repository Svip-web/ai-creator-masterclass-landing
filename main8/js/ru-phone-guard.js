/*!
 * ru-phone-guard.js — не даёт отправить форму с номером РФ или Беларуси.
 *
 * Зачем отдельным файлом: excludeCountries закрывает только ВЫБОР страны в
 * выпадашке. Номер можно вставить целиком — intl-tel-input тогда сам ставит
 * исключённую страну, isValidNumber() отдаёт true, и лид уходит.
 * Проверено 21.10.2026: вставка +79161234567 проходила на 7 посадках из 8.
 *
 * Правило узкое намеренно: РФ-мобильные +79xxxxxxxxx и Беларусь +375xxxxxxxx.
 * Казахстан (+76.., +77..) НЕ блокируем — оттуда идут платящие клиенты.
 *
 * Любая внутренняя ошибка = отправку пропустить. Работающая форма дороже фильтра.
 */
(function () {
  "use strict";

  var MESSAGE = "Эта страна не поддерживается";
  var RU = /^79\d{9}$/;
  var BY = /^375\d{9}$/;
  // Российская домашняя запись 8-916-…: встречается при наборе руками.
  var RU_TRUNK = /^89\d{9}$/;
  var BLOCKED_ISO = { ru: 1, by: 1 };
  var FLAG = "[data-ru-phone-guard]";

  function digits(v) {
    return String(v == null ? "" : v).replace(/\D/g, "");
  }

  function badNumber(d) {
    return RU.test(d) || BY.test(d);
  }

  function itiFor(el) {
    try {
      var g = window.intlTelInput;
      if (g && typeof g.getInstance === "function") {
        var i = g.getInstance(el);
        if (i) return i;
      }
    } catch (e) {}
    try {
      var g2 = window.intlTelInputGlobals;
      if (g2 && typeof g2.getInstance === "function") {
        var i2 = g2.getInstance(el);
        if (i2) return i2;
      }
    } catch (e) {}
    return null;
  }

  // Какая страна реально выбрана. Если это РФ/Беларусь — значит её подставил
  // вставленный номер, вручную её выбрать нельзя: она исключена из списка.
  function selectedIso(el) {
    var iti = itiFor(el);
    try {
      if (iti && iti.getSelectedCountryData) {
        var cd = iti.getSelectedCountryData();
        if (cd && cd.iso2) return String(cd.iso2).toLowerCase();
      }
    } catch (e) {}
    try {
      var box = el.closest(".iti");
      var flag = box && box.querySelector(".iti__selected-country .iti__flag, .iti__selected-flag .iti__flag");
      var m = flag && String(flag.className || "").match(/iti__([a-z]{2})\b/);
      if (m && m[1] !== "flag") return m[1];
    } catch (e) {}
    return "";
  }

  function dialCode(el) {
    var iti = itiFor(el);
    try {
      if (iti && iti.getSelectedCountryData) {
        var cd = iti.getSelectedCountryData();
        if (cd && cd.dialCode) return String(cd.dialCode);
      }
    } catch (e) {}
    try {
      var box = el.closest(".iti");
      var node = box && box.querySelector(".iti__selected-dial-code");
      if (node) return digits(node.textContent);
    } catch (e) {}
    return "";
  }

  // Во что может превратиться введённое к моменту отправки.
  // Голые цифры поля считаем международными только когда кода страны нет
  // вообще или номер набран с «+» — иначе национальный номер чужой страны,
  // случайно начавшийся на 79, попал бы под блокировку.
  function isBad(form) {
    var tels = form.querySelectorAll('input[type="tel"]');
    var i;
    for (i = 0; i < tels.length; i++) {
      var el = tels[i];
      if (BLOCKED_ISO[selectedIso(el)]) return true;

      var raw = String(el.value == null ? "" : el.value).trim();
      var d = digits(raw);
      var dial = dialCode(el);

      var iti = itiFor(el);
      try {
        if (iti && iti.getNumber && badNumber(digits(iti.getNumber()))) return true;
      } catch (e) {}

      if (!d) continue;
      if ((raw.charAt(0) === "+" || !dial) && badNumber(d)) return true;
      if (dial && badNumber(d.indexOf(dial) === 0 ? d : dial + d)) return true;

      // Российский номер, набранный поверх чужого кода страны: поле показывает
      // +380, а внутри 79161234567 или 89161234567. Блокируем только если для
      // выбранной страны такой номер НЕвалиден — иначе под нож попал бы
      // национальный номер чужой страны, случайно начавшийся на 79 или 89.
      if (dial && (badNumber(d) || RU_TRUNK.test(d))) {
        var valid = null;
        try {
          if (iti && typeof iti.isValidNumber === "function") valid = iti.isValidNumber();
        } catch (e) {}
        if (valid === false) return true;
      }
    }
    var hidden = form.querySelectorAll('input[name="phone"], input[name="Phone"]');
    for (i = 0; i < hidden.length; i++) {
      if (String(hidden[i].type).toLowerCase() === "tel") continue;
      if (badNumber(digits(hidden[i].value))) return true;
    }
    return false;
  }

  function note(form, show) {
    var el = form.querySelector('input[type="tel"]');
    if (!el) return;
    var node = form.querySelector(FLAG);
    if (!node) {
      if (!show) return;
      node = document.createElement("div");
      node.setAttribute("data-ru-phone-guard", "1");
      node.style.cssText =
        "color:#d32f2f;font-size:13px;line-height:1.35;margin:6px 0 0;text-align:left;";
      var host = el.closest(".iti") || el;
      var parent = host.parentNode || form;
      parent.insertBefore(node, host.nextSibling);
    }
    node.textContent = show ? MESSAGE : "";
    node.style.display = show ? "" : "none";
    if (show) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
  }

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  document.addEventListener(
    "submit",
    function (e) {
      try {
        var form = e.target;
        if (!form || form.tagName !== "FORM") return;
        if (!isBad(form)) {
          note(form, false);
          return;
        }
        stop(e);
        note(form, true);
      } catch (err) {}
    },
    true
  );

  // Большинство форм отправляется кликом по кнопке. Перехват на клике надёжнее:
  // событие submit тогда не возникает вообще, и сторонний скрипт отправки
  // (Integraleap/sf.js) ничего не видит.
  document.addEventListener(
    "click",
    function (e) {
      try {
        var t = e.target;
        if (!t || !t.closest) return;
        var btn = t.closest('button, input[type="submit"], input[type="image"]');
        if (!btn) return;
        var type = String(btn.getAttribute("type") || "").toLowerCase();
        if (btn.tagName === "INPUT" && type !== "submit" && type !== "image") return;
        if (btn.tagName === "BUTTON" && type && type !== "submit") return;
        var form = btn.form || btn.closest("form");
        if (!form) return;
        if (!isBad(form)) return;
        stop(e);
        note(form, true);
      } catch (err) {}
    },
    true
  );

  // Подсказка появляется сразу при вводе/вставке, а не только на отправке.
  document.addEventListener(
    "input",
    function (e) {
      try {
        var el = e.target;
        if (!el || !el.matches || !el.matches('input[type="tel"]')) return;
        var form = el.closest("form");
        if (!form) return;
        note(form, isBad(form));
      } catch (err) {}
    },
    true
  );
})();
