(() => {
  const { hostname, protocol } = location;
  const isPreview = /(^|\.)(localhost|chatgpt\.site)$/i.test(hostname)
    || /^127(?:\.\d{1,3}){3}$/.test(hostname)
    || hostname === '[::1]';
  if (isPreview || (protocol !== 'https:' && protocol !== 'http:')) return;

  function loadScript(url) {
    const script = document.createElement('script');
    script.async = true;
    script.src = url;
    document.head.append(script);
  }

  window.clarity ??= function () { (window.clarity.q ??= []).push(arguments); };
  loadScript('https://www.clarity.ms/tag/vrkeul72zk');

  if (!window.fbq) {
    const fbq = function () {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
      else fbq.queue.push(arguments);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = window._fbq = fbq;
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
  }

  const pixels = [
    '1448562013512989', '1411553907555948', '1272331291736172',
    '1373939656603531', '816692014084476', '1508510300388057',
    '4393348487596340',
  ];
  for (const pixel of pixels) {
    window.fbq('init', pixel);
    window.fbq('trackSingle', pixel, 'PageView');
  }
  window.addEventListener('registration:accepted', () => {
    for (const pixel of pixels) window.fbq('trackSingle', pixel, 'Lead');
  });
})();
