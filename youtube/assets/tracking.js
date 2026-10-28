(() => {
  'use strict';
  const w = window;
  const d = document;
  if (w.YouTubeTracking) return;
  const pagePixels = ['1540134250632219','1272331291736172','4393348487596340'];
  const leadPixels = ['1540134250632219','1272331291736172','1411553907555948','4393348487596340'];
  const plainLead = args => args[0] === 'track' && args[1] === 'Lead';

  function installLeadFilter() {
    const f = w.fbq;
    if (w.__fbLeadFilterInstalled || !f || typeof f.callMethod !== 'function') return;
    const callMethod = f.callMethod;
    f.callMethod = function () {
      if (plainLead(arguments)) return;
      return callMethod.apply(this, arguments);
    };
    w.__fbLeadFilterInstalled = true;
  }

  function script(id, src, onload) {
    try {
      if (d.getElementById(id)) return;
      const element = d.createElement('script');
      element.id = id;
      element.async = true;
      element.src = src;
      if (onload) element.addEventListener('load', onload, {once:true});
      const first = d.getElementsByTagName('script')[0];
      if (first?.parentNode) first.parentNode.insertBefore(element, first);
      else (d.head || d.documentElement).appendChild(element);
    } catch { /* Analytics restrictions must not affect registration. */ }
  }

  const needsMeta = typeof w.fbq !== 'function';
  if (needsMeta) {
    const n = function () {
      // The same object survives SDK loading; queued GTM Leads are filtered too.
      if (plainLead(arguments)) return;
      if (n.callMethod) n.callMethod.apply(n, arguments);
      else n.queue.push(arguments);
    };
    w.fbq = n;
    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
  }

  function lead(data) {
    if (!data || data.error || !(data.dealId || data.contactId) || w.__fbLeadSent || typeof w.fbq !== 'function') return false;
    w.__fbLeadSent = true;
    let sent = false;
    for (const id of leadPixels) {
      try { w.fbq('trackSingle', id, 'Lead'); sent = true; } catch { /* Analytics must not interrupt registration. */ }
    }
    return sent;
  }
  w.YouTubeTracking = Object.freeze({lead});

  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
  script('youtube-gtm', 'https://www.googletagmanager.com/gtm.js?id=GTM-PQX4ZSHP');
  if (needsMeta) script('youtube-meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js', installLeadFilter);
  installLeadFilter();
  for (const id of pagePixels) {
    try { w.fbq('init', id); } catch { /* A blocked pixel must not affect the page. */ }
  }
  try { w.fbq('track', 'PageView'); } catch { /* A blocked pixel must not affect the page. */ }
})();
