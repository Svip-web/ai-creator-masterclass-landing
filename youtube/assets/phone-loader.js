(() => {
  'use strict';
  const assetBase = new URL('.', document.currentScript.src);
  const coreUrl = new URL('vendor/intl-tel-input/js/intlTelInput.min.js', assetBase);
  const styleUrl = new URL('phone.min.css', assetBase);
  styleUrl.search = new URL(document.currentScript.src).search;
  let preparing, corePromise, stylePromise, utilsPromise, reloadCore = false, utilsAttempts = 0;

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

  function loadUtils() {
    if (!utilsPromise) {
      const utilsUrl = new URL('vendor/intl-tel-input/js/utils.js', assetBase);
      if (++utilsAttempts > 1) utilsUrl.searchParams.set('retry', String(utilsAttempts));
      utilsPromise = import(utilsUrl.href).then(module => {
        if (!module?.default || typeof module.default !== 'object') {
          throw new Error('Не удалось загрузить поле телефона.');
        }
        return module;
      }).catch(error => {
        utilsPromise = null;
        throw error;
      });
    }
    return utilsPromise;
  }

  function prepare() {
    if (preparing) return preparing;
    // Fetch all three assets on intent, without a core -> utils network waterfall.
    // Settle all of them even on failure, so a retry cannot race an older core.
    preparing = Promise.allSettled([loadStyles(), loadCore(), loadUtils()]).then(async results => {
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      const factory = results[1].value;
      if (!factory.utils) {
        try {
          // Attach the cached module through the public API without waiting for
          // window.load or issuing another import. No picker exists before ready.
          await factory.attachUtils(() => utilsPromise);
          if (!factory.utils) throw new Error('Не удалось загрузить поле телефона.');
        } catch (error) {
          // A failed attachUtils retains a loading flag in v29.2.3. Reload its
          // core on retry rather than changing private state on that factory.
          reloadCore = true;
          throw error;
        }
      }
      return factory;
    }).catch(error => {
      preparing = null;
      throw error;
    });
    return preparing;
  }

  window.YouTubePhoneLoader = Object.freeze({prepare});
})();
