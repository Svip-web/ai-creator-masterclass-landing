(function () {
  "use strict";

  var row = document.querySelector("[data-intro-updates]");
  if (!row || row.dataset.updatesInitialized) return;
  var primary = row.querySelector("[data-updates-primary]");
  var secondary = row.querySelector("[data-updates-secondary]");
  if (!primary || !secondary) return;
  row.dataset.updatesInitialized = "true";

  // Simulated display messages only; no CRM records or registration counts are created.
  var messages = [
    "Марина заняла место",
    "Анна заняла место",
    "Ольга заняла место",
    "Андрей занял место",
    "Ирина заняла место",
    "Алина заняла место",
    "Елена заняла место",
    "Дмитрий занял место",
    "Юлия заняла место",
    "Виктория заняла место",
    "Оксана заняла место",
    "Наталья заняла место"
  ];
  var changeInterval = 5000;
  var fadeDuration = 180;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var paused = motion.matches;
  var hovered = false;
  var visible = true;
  var index = 0;
  var timer = null;
  var fadeTimer = null;
  var lastMinutes = 0;

  function randomElapsedTime() {
    var minutes = 1 + Math.floor(Math.random() * 59);
    if (minutes === lastMinutes) minutes = minutes % 59 + 1;
    lastMinutes = minutes;
    var lastDigit = minutes % 10;
    var lastTwoDigits = minutes % 100;
    var unit = lastDigit === 1 && lastTwoDigits !== 11 ? "минуту"
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? "минуты" : "минут";
    return minutes + " " + unit + " назад";
  }

  function stop() {
    clearTimeout(timer);
    clearTimeout(fadeTimer);
    row.classList.remove("is-changing");
  }

  function schedule() {
    stop();
    if (!paused && !hovered && visible && !document.hidden) {
      // Include the fade in the five-second interval between message changes.
      timer = setTimeout(next, changeInterval - (motion.matches ? 0 : fadeDuration));
    }
  }

  function next() {
    if (paused || hovered || !visible || document.hidden) return;
    row.classList.add("is-changing");
    fadeTimer = setTimeout(function () {
      index = (index + 1) % messages.length;
      primary.textContent = messages[index];
      secondary.textContent = randomElapsedTime();
      schedule();
    }, motion.matches ? 0 : fadeDuration);
  }

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
    paused = motion.matches;
    schedule();
  });
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      schedule();
    });
    observer.observe(row);
  }

  secondary.textContent = randomElapsedTime();
  schedule();
})();
