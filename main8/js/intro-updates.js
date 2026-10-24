(function () {
  "use strict";

  var row = document.querySelector("[data-intro-updates]");
  if (!row || row.dataset.updatesInitialized) return;
  var primary = row.querySelector("[data-updates-primary]");
  var secondary = row.querySelector("[data-updates-secondary]");
  var toggle = row.querySelector("[data-updates-toggle]");
  if (!primary || !secondary || !toggle) return;
  row.dataset.updatesInitialized = "true";

  var messages = [
    ["Онлайн мастер-класс", "Практика с AI"],
    ["Бонус за регистрацию", "2 видео-урока"],
    ["Начни с нуля", "Без дорогой техники"],
    ["Создавай AI-контент", "Фото и видео на заказ"]
  ];
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var paused = motion.matches;
  var hovered = false;
  var visible = true;
  var index = 0;
  var timer = null;
  var fadeTimer = null;

  function stop() {
    clearTimeout(timer);
    clearTimeout(fadeTimer);
    row.classList.remove("is-changing");
  }

  function updateToggle() {
    toggle.querySelector("span").textContent = paused ? "▶" : "Ⅱ";
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.setAttribute("aria-label", paused
      ? "Продолжить смену сообщений"
      : "Приостановить смену сообщений");
  }

  function schedule() {
    stop();
    if (!paused && !hovered && visible && !document.hidden) {
      timer = setTimeout(next, 8000);
    }
  }

  function next() {
    if (paused || hovered || !visible || document.hidden) return;
    row.classList.add("is-changing");
    fadeTimer = setTimeout(function () {
      index = (index + 1) % messages.length;
      primary.textContent = messages[index][0];
      secondary.textContent = messages[index][1];
      schedule();
    }, motion.matches ? 0 : 180);
  }

  toggle.addEventListener("click", function () {
    paused = !paused;
    updateToggle();
    schedule();
  });
  row.addEventListener("mouseenter", function () {
    hovered = true;
    schedule();
  });
  row.addEventListener("mouseleave", function () {
    hovered = false;
    schedule();
  });
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", schedule);
  motion.addEventListener("change", function () {
    if (motion.matches) {
      paused = true;
      updateToggle();
      schedule();
    }
  });
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      schedule();
    });
    observer.observe(row);
  }

  updateToggle();
  schedule();
})();
