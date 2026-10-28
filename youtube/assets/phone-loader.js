(() => {
  'use strict';
  const assetBase = new URL('.', document.currentScript.src);
  const coreUrl = new URL('vendor/intl-tel-input/js/intlTelInput.min.js', assetBase);
  const styleUrl = new URL('phone.min.css', assetBase);
  styleUrl.search = new URL(document.currentScript.src).search;
  let preparing, corePromise, stylePromise, reloadCore = false, attempts = 0;

  function loadAsset(type, url) {
    return new Promise((resolve, reject) => {
      const element = document.createElement(type);
      if (type === 'link') {
        element.rel = 'stylesheet';
        element.href = url.href;
      } else {
        element.async = true;
        element.src = url.href;
      }
      element.addEventListener('load', () => resolve(element), {once:true});
      element.addEventListener('error', () => {
        element.remove();
        reject(new Error('Не удалось загрузить поле телефона.'));
      }, {once:true});
      document.head.appendChild(element);
    });
  }

  function loadStyles() {
    if (!stylePromise) {
      stylePromise = loadAsset('link', styleUrl).catch(error => {
        stylePromise = null;
        throw error;
      });
    }
    return stylePromise;
  }

  function loadCore() {
    if (!corePromise || reloadCore) {
      reloadCore = false;
      corePromise = loadAsset('script', coreUrl).then(() => {
        const factory = window.intlTelInput;
        if (typeof factory !== 'function' || typeof factory.attachUtils !== 'function') {
          throw new Error('Не удалось загрузить поле телефона.');
        }
        return factory;
      }).catch(error => {
        corePromise = null;
        throw error;
      });
    }
    return corePromise;
  }

  function prepare() {
    if (preparing) return preparing;
    const attempt = ++attempts;
    // Wait for both resources even on failure, so a retry cannot race an older
    // core script. No picker exists until this promise has completely succeeded.
    preparing = Promise.allSettled([loadStyles(), loadCore()]).then(async results => {
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      const factory = results[1].value;
      if (!factory.utils) {
        const utilsUrl = new URL('vendor/intl-tel-input/js/utils.js', assetBase);
        if (attempt > 1) utilsUrl.searchParams.set('retry', String(attempt));
        // The public attachUtils API starts now; loadUtils alone would wait for
        // window.load, even when the visitor has already opened registration.
        await factory.attachUtils(() => import(utilsUrl.href));
      }
      if (!factory.utils) throw new Error('Не удалось загрузить поле телефона.');
      return factory;
    }).catch(error => {
      // A failed attachUtils retains a loading flag in v29.2.3. Reload its core
      // on retry rather than changing private state on a failed factory.
      reloadCore = true;
      preparing = null;
      throw error;
    });
    return preparing;
  }

  window.YouTubePhoneLoader = Object.freeze({prepare});
})();
