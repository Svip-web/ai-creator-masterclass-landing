(function () {
  'use strict';

  if (window.__recordTrackingInitialized) return;
  window.__recordTrackingInitialized = true;

  var config = (window.RECORD_CONFIG && window.RECORD_CONFIG.analytics) || {};
  var host = window.location.hostname.toLowerCase().replace(/\.$/, '');
  var isLocal = window.location.protocol === 'file:' ||
    host === '' || host === 'localhost' || /\.localhost$/.test(host) ||
    host === '::1' || host === '[::1]' || host === '0.0.0.0' || /^127\./.test(host);
  var status = window.RECORD_TRACKING = {
    enabled: false,
    reason: isLocal ? 'local-preview' : 'disabled',
    metaPixelIds: [],
    leadSent: false
  };

  if (isLocal || config.enabled === false) return;

  var pixelIds = Array.from(new Set(
    (Array.isArray(config.metaPixelIds) ? config.metaPixelIds : [])
      .map(function (id) { return String(id).trim(); })
      .filter(function (id) { return /^\d{5,25}$/.test(id); })
  ));
  var clarityId = typeof config.clarityProjectId === 'string' ? config.clarityProjectId.trim() : '';
  if (!/^[a-z0-9]{5,30}$/i.test(clarityId)) clarityId = '';
  var adsId = typeof config.googleAdsConversionId === 'string' ? config.googleAdsConversionId.trim() : '';
  var adsLabel = typeof config.googleAdsConversionLabel === 'string' ? config.googleAdsConversionLabel.trim() : '';
  if (!/^AW-\d{5,20}$/.test(adsId) || !/^[a-z0-9_-]{5,100}$/i.test(adsLabel)) {
    adsId = '';
    adsLabel = '';
  }

  function appendScript(src, id) {
    if (document.getElementById(id)) return;
    var script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }

  if (pixelIds.length) {
    if (typeof window.fbq !== 'function') {
      var fbq = window.fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
    }
    pixelIds.forEach(function (id) {
      window.fbq('init', id);
      window.fbq('trackSingle', id, 'PageView');
    });
    appendScript('https://connect.facebook.net/en_US/fbevents.js', 'record-meta-pixel');
  }

  if (clarityId) {
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    appendScript('https://www.clarity.ms/tag/' + encodeURIComponent(clarityId), 'record-clarity');
  }

  if (adsId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', adsId);
    appendScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(adsId), 'record-google-ads');
  }

  status.enabled = Boolean(pixelIds.length || clarityId || adsId);
  status.reason = status.enabled ? 'active' : 'no-tracking-ids';
  status.metaPixelIds = pixelIds.slice();

  // The form dispatches this event only after a successful CRM response.
  // Event details and form contact fields are intentionally not forwarded.
  window.addEventListener('record:lead-success', function () {
    if (status.leadSent) return;
    status.leadSent = true;
    pixelIds.forEach(function (id) {
      window.fbq('trackSingle', id, 'Lead');
    });
    if (adsId) {
      window.gtag('event', 'conversion', { send_to: adsId + '/' + adsLabel });
    }
  });
})();
