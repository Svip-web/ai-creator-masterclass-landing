$(document).ready(() => {
  // setTimeout(() => {
  //     AOS.init({ acnhorPlacement: "center-center", once: true, duration: 700 });
  // }, 200);

  // if ($(window).width() < 575) {
  // }

  // Модальные окна
  var overlay = $(".overlay"),
    modal = $(".modal"),
    modalClose = $(".modal__close"),
    modalOpen = $(".modal__open[data-modal]");

  // Обработчик клика по overlay и закрытие модального окна
  $(document).on("click", ".modal__close", function () {
    $("body, html").removeClass("my-body-noscroll-class");
    overlay.fadeOut();
    modal.fadeOut();
  });

  $(document).on("click", ".overlay", function (e) {
    if ($(e.target).closest(".modal").length === 0) {
      $("body, html").removeClass("my-body-noscroll-class");
      overlay.fadeOut();
      modal.fadeOut();
    }
  });

  // Открытие модальных окон
  modalOpen.each(function () {
    $(this).on("click", function (e) {
      var modalId = $(this).data("modal"),
        EachModal = $('.modal[data-modal="' + modalId + '"]');
      $("body, html").addClass("my-body-noscroll-class");
      $("#mobile__menu").removeClass("active");
      modal.fadeOut();
      overlay.fadeIn();
      EachModal.fadeIn();
    });
  });

  /** * Replace all SVG images with inline SVG */
  $("img.img-svg").each(function () {
    var $img = $(this);
    var imgID = $img.attr("id");
    var imgClass = $img.attr("class");
    var imgURL = $img.attr("src");
    $.get(
      imgURL,
      function (data) {
        var $svg = $(data).find("svg");
        if (typeof imgID !== "undefined") {
          $svg = $svg.attr("id", imgID);
        }
        if (typeof imgClass !== "undefined") {
          $svg = $svg.attr("class", imgClass + " replaced-svg");
        }
        $svg = $svg.removeAttr("xmlns:a");
        $img.replaceWith($svg);
      },
      "xml"
    );
  });

  // Мобильное меню
  $(".mobile__menu-open, .mobile__menu-close").on("click", function () {
    $("#mobile__menu").toggleClass("active");
    $("body, html").toggleClass(
      "my-body-noscroll-class",
      $("#mobile__menu").hasClass("active")
    );
  });

  // Плавная прокрутка при клике на якорь
  $('a[href^="#"]').click(function () {
    $("#mobile__menu").removeClass("active");
    $("body, html").removeClass("my-body-noscroll-class");
    let target = $(this).attr("href");
    let targetPosition = $(target).offset().top - 30;
    $("html, body").animate({ scrollTop: targetPosition }, 500);
    return false;
  });

  const phoneInput = document.querySelector('input[type="tel"]');
  let phoneMaskInitialized = false;

  // РФ и Беларусь исключены из списка стран (excludeCountries ниже).
  // Гео обязан отдавать только страны из списка: setCountry("ru") на
  // исключённой стране бросает "No country data for 'ru'" и убивает виджет.
  const EXCLUDED_COUNTRIES = ["ru", "by"];

  function resolveCountryByIp(callback) {
    const done = (country) =>
      callback(EXCLUDED_COUNTRIES.indexOf(country) === -1 ? country : "ua");

    fetch("https://get.geojs.io/v1/ip/geo.json")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.country_code) {
          done(data.country_code.toLowerCase());
          return;
        }
        throw new Error("geojs: empty country_code");
      })
      .catch(() => {
        fetch("https://ipapi.co/country_code/")
          .then((res) => res.text())
          .then((code) => {
            const country = code.trim().toLowerCase();
            done(country.length === 2 ? country : "ua");
          })
          .catch(() => {
            done("ua");
          });
      });
  }

  const iti = window.intlTelInput(phoneInput, {
    initialCountry: "auto",
    excludeCountries: EXCLUDED_COUNTRIES,
    useFullscreenPopup: false,
    geoIpLookup: resolveCountryByIp,
    separateDialCode: true,
    // Пример номера выбранной страны — вместо маски-заглушки.
    autoPlaceholder: "aggressive",
    customPlaceholder: function (example) {
      return example ? "Телефон: " + example : "Телефон:";
    },
  });

  window.phoneIti = iti;

  // Маска: +код страны + национальная часть нужной длины
  function formatMaskFromDigitCount(digitCount) {
    if (digitCount === 10) {
      return "999 999 99 99";
    }
    if (digitCount === 9) {
      return "999 999 999";
    }

    let mask = "";
    let remaining = digitCount;

    while (remaining > 0) {
      const groupSize = Math.min(3, remaining);
      mask += "9".repeat(groupSize);
      remaining -= groupSize;
      if (remaining > 0) {
        mask += " ";
      }
    }

    return mask;
  }

  function buildInternationalMask(countryData) {
    const dialCode = String(countryData.dialCode || "");
    const escapedCode = dialCode
      .split("")
      .map((digit) => `\\${digit}`)
      .join("");
    let nationalDigitCount = dialCode === "7" ? 10 : 9;
    let nationalMask = formatMaskFromDigitCount(nationalDigitCount);

    if (
      !window.intlTelInputUtils ||
      !countryData.iso2 ||
      typeof window.intlTelInputUtils.getExampleNumber !== "function"
    ) {
      return `+${escapedCode} ${nationalMask}`;
    }

    const utils = window.intlTelInputUtils;
    const e164Example = utils.getExampleNumber(
      countryData.iso2,
      false,
      utils.numberFormat.E164
    );

    if (e164Example) {
      const digitsOnly = e164Example.replace(/\D/g, "");
      nationalDigitCount = digitsOnly.length - dialCode.length;
      nationalMask = formatMaskFromDigitCount(nationalDigitCount);
    }

    const internationalExample = utils.getExampleNumber(
      countryData.iso2,
      false,
      utils.numberFormat.INTERNATIONAL
    );

    if (internationalExample) {
      const normalizedExample = internationalExample.replace(
        /[\u00A0\u2007\u202F]/g,
        " "
      );
      const dialCodeRegex = new RegExp(`^\\+${dialCode}\\s*`);
      const nationalPart = normalizedExample.replace(dialCodeRegex, "").trim();
      const candidateMask = nationalPart.replace(/\d/g, "9").trim();
      const candidateDigitCount = (candidateMask.match(/9/g) || []).length;

      if (candidateDigitCount === nationalDigitCount) {
        nationalMask = candidateMask;
      }
    }

    return `+${escapedCode} ${nationalMask}`;
  }

  // ВАЖНО: inputmask здесь больше НЕ используется.
  // Маска строилась как "+<код страны> 999 ..." — код страны был литералом в
  // начале маски. Курсор вставал перед ним, и набранные человеком цифры
  // inputmask пытался сопоставить с литералом: часть цифр он съедал, часть
  // сдвигал. Проверено на проде: UA 671234567 -> "+380 ___ ___ 671" (форма
  // не отправлялась вообще), US 2125551234 -> "+1 125 551 234" (заявка
  // уходила в CRM с чужим номером). Форматирование и валидацию делает
  // intlTelInput, который этим полем и так управляет.
  function applyPhoneMask() {
    const countryData = iti.getSelectedCountryData();
    if (!countryData || !countryData.dialCode) {
      return;
    }
    try {
      if ($(phoneInput).inputmask && phoneInput.inputmask) {
        $(phoneInput).inputmask("remove");
      }
    } catch (err) {}
  }

  // Значение поля тут НЕ чистим. Раньше чистили, чтобы убрать литерал старой
  // маски, но countrychange прилетает и от самого intlTelInput — когда человек
  // начал набирать номер с "+380..." или когда с опозданием ответил geo-ip на
  // медленном интернете. Набранное стиралось прямо во время набора, дальше
  // валидация не пропускала и форма молча не отправлялась.
  phoneInput.addEventListener("countrychange", function () {
    applyPhoneMask();
    phoneMaskInitialized = true;
  });

  applyPhoneMask();

  const paymentAndPackageInputs = document.querySelectorAll(
    'input[name="top-group"], input[name="bottom-group"]'
  );
  const formBlock = document.querySelector(".intro-section__box-item.item2");

  function tryScrollToFormAfterSelections() {
    if (!formBlock) {
      return;
    }

    const selectedPayment = document.querySelector(
      'input[name="top-group"]:checked'
    );
    const selectedPackage = document.querySelector(
      'input[name="bottom-group"]:checked'
    );

    if (!selectedPayment || !selectedPackage) {
      return;
    }

    const targetPosition = $(formBlock).offset().top - 20;
    $("html, body").stop(true).animate({ scrollTop: targetPosition }, 500);
  }

  paymentAndPackageInputs.forEach((input) => {
    input.addEventListener("change", tryScrollToFormAfterSelections);
  });

  // Слайдер примеров AI-фото и видео
  $(".cases-section__box").slick({
    infinite: true,
    slidesToShow: 1,
    autoplay: true,
    autoplaySpeed: 2500,
    speed: 600,
    pauseOnHover: true,
    arrows: false,
    prevArrow: ".report__arrow.left",
    nextArrow: ".report__arrow.right",
    dots: true,
    responsive: [
      {
        breakpoint: 575,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  });

  // $(".faq__item").click(function () {
  //     $(this).siblings().removeClass("active");
  //     $(this).siblings().find(".faq__item-content").slideUp();

  //     $(this).toggleClass("active");
  //     $(this).find(".faq__item-content").slideToggle();
  // });

  // Табы - вкладки
  // $(".repairs__button").on("click", function () {
  //     $(this).addClass("active").siblings().removeClass("active");
  //     $(".repairs__tab").removeClass("active").eq($(this).index()).addClass("active");
  // });

  // Таймер
  // var deadline = new Date('2024-11-01T23:59:00+03:00');
  // let timerId = null;
  // function declensionNum(num, words) {
  //   return words[(num % 100 > 4 && num % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(num % 10 < 5) ? num % 10 : 5]];
  // }
  // function countdownTimer() {
  //   const diff = deadline - new Date();
  //   if (diff <= 0) {
  //     clearInterval(timerId);
  //   }
  //   var days = diff > 0 ? Math.floor(diff / 1000 / 60 / 60 / 24) : 0;
  //   var hours = diff > 0 ? Math.floor(diff / 1000 / 60 / 60) % 24 : 0;
  //   var minutes = diff > 0 ? Math.floor(diff / 1000 / 60) % 60 : 0;
  //   var seconds = diff > 0 ? Math.floor(diff / 1000) % 60 : 0;
  //   days = days < 10 ? '0' + days : days;
  //   hours = hours < 10 ? '0' + hours : hours;
  //   minutes = minutes < 10 ? '0' + minutes : minutes;
  //   seconds = seconds < 10 ? '0' + seconds : seconds;
  //   if(days !== 0) {
  //     hours = hours + (days * 24);
  //   } else {
  //     hours = hours < 10 ? '0' + hours : hours;
  //   }
  //   var timerValue = hours + ' : ' + minutes + ' : ' + seconds;
  //   $('.day .value').html(days);
  //   $('.hours .value').html(hours);
  //   $('.minutes .value').html(minutes);
  //   $('.seconds .value').html(seconds);
  // }
  // countdownTimer();
  // timerId = setInterval(countdownTimer, 1000);

  // function isInViewport($el) {
  //     const rect = $el[0].getBoundingClientRect();
  //     return (
  //         rect.top < window.innerHeight &&
  //         rect.bottom > 0
  //     );
  // }
  // const $button = $('.t-btn.fixed');
  // const $sections = $('.intro-section');
  // function checkVisibility() {
  //     let shouldHide = false;
  //     $sections.each(function () {
  //         if (isInViewport($(this))) {
  //             shouldHide = true;
  //             return false; // break
  //         }
  //     });
  //     $button.toggleClass('hide', shouldHide);
  // }
  // checkVisibility(); // РїСЂРё Р·Р°РіСЂСѓР·РєРµ
  // $(window).on('scroll resize', checkVisibility);

  function toggleFixedSection() {
    const scrollTop = $(window).scrollTop();

    const introBottom =
      $(".intro-section").offset().top + $(".intro-section").outerHeight();

    const footerRect = $(".footer")[0].getBoundingClientRect();

    // footer появился в зоне экрана
    const footerVisible = footerRect.top <= window.innerHeight;

    if (scrollTop >= introBottom && !footerVisible) {
      $(".fixed-section").addClass("show");
    } else {
      $(".fixed-section").removeClass("show");
    }
  }

  $(window).on("scroll resize", toggleFixedSection);

  toggleFixedSection();

  $(".form .form__inp").on("input focus", function () {
    $(this).removeClass("form__inp--error");
  });

  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM" || !form.classList.contains("form"))
        return;

      var $form = $(form);
      var $phoneNational = $form.find("#phone");
      var $phoneHidden = $form.find('input[name="phone"]');
      var iti = window.phoneIti;

      var $nameInput = $form.find('input[name="name"]');
      var name = ($nameInput.val() || "").trim();

      $form.find(".form__inp").removeClass("form__inp--error");
      var isValid = true;

      if (!name) {
        $nameInput.addClass("form__inp--error");
        isValid = false;
      }

      var nationalDigits = $phoneNational.val().replace(/\D/g, "");
      var phoneValid = nationalDigits.length >= 9;
      if (iti) {
        try {
          if (window.intlTelInputUtils && iti.isValidNumber()) {
            phoneValid = true;
          }
        } catch (err) {
          phoneValid = nationalDigits.length >= 9;
        }
      }
      if (!phoneValid) {
        $phoneNational.addClass("form__inp--error");
        isValid = false;
      }

      if (!isValid) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      var e164 = "";
      if (iti) {
        try {
          e164 = iti.getNumber();
        } catch (err) {}
        if (!e164 || !/^\+/.test(e164)) {
          try {
            var cd = iti.getSelectedCountryData();
            var dial = cd && cd.dialCode ? String(cd.dialCode) : "";
            var nationalOnly = nationalDigits;
            if (dial && nationalDigits.indexOf(dial) === 0) {
              nationalOnly = nationalDigits.slice(dial.length);
            }
            e164 = dial
              ? "+" + dial + nationalOnly
              : nationalDigits
              ? "+" + nationalDigits
              : "";
          } catch (err2) {
            e164 = nationalDigits ? "+" + nationalDigits : "";
          }
        }
      }
      if (!e164 || e164.replace(/\D/g, "").length < 8) {
        $phoneNational.addClass("form__inp--error");
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      $phoneHidden.val(e164);

      // Forms managed by Integraleap keep the local validation and normalized
      // phone value above, while sf.js handles submission and redirection.
      if (form.dataset.name === "smartsender") {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      var submitButton = $form.find('button[type="submit"]');
      submitButton.prop("disabled", true);
      setTimeout(function () {
        submitButton.prop("disabled", false);
      }, 2000);

      var telegramHref =
        "https://telegram.me/aicreatorjenny_bot?start=ZGw6MzMyNzEz";

      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead");
      }

      function goToTelegram(url) {
        window.location.href = url;
      }

      var formFields = {
        name: name,
        phone: e164,
      };

      if (window.postSmartSenderLead) {
        window.postSmartSenderLead(telegramHref, formFields, goToTelegram);
      } else {
        goToTelegram(telegramHref);
      }
    },
    true
  );
});
