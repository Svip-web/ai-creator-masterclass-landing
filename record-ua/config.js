/* Налаштування української сторінки запису. Секретні API-ключі тут не потрібні. */
window.RECORD_CONFIG = {
  video: {
    // Вставте embed-посилання плеєра або шлях до нового MP4: './media/masterclass.mp4'.
    // Для YouTube використовуйте https://www.youtube.com/embed/ID, для Bunny — /embed/...
    src: 'https://iframe.mediadelivery.net/embed/733258/f8a64702-67fa-4f4a-8bf3-9b6577cddb92',
    type: 'iframe', // 'iframe' або 'video' для MP4/WebM
    poster: './images/video-poster-1440.933e547cd8ca.webp',
    title: 'Запис майстер-класу «Стань AI-CREATOR»'
  },
  crm: {
    enabled: true,
    endpoint: 'https://mufiksoft.com/shopifyband/amo-panel/forms.php',
    timeoutMs: 20000,
    // Маршрут консультації Creator — як у чинних формах цього проєкту.
    preset: {
      title: 'Консультация  запись  АІ Creator UA',
      stage: '105820611',
      tag: 'запись;консультация;бронь_20€;390€;590€;790€',
      product: 'Ai-creator',
      type_lead: 'Теплый',
      req: 'etsy_no_pay_4'
    }
  },
  analytics: {
    enabled: true,
    // Підтверджені на поточному основному сайті. Локально події вимкнені.
    metaPixelIds: ['1540134250632219', '1272331291736172', '1411553907555948', '4393348487596340'],
    clarityProjectId: '',
    googleAdsConversionId: 'AW-17866299470',
    googleAdsConversionLabel: 'DDnCCJ7dneQbEM6wqMdC'
  }
};
