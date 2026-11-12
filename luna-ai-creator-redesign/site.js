(() => {
  const registration = document.getElementById('registration');
  const phone = document.getElementById('phone');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  const revealItems = document.querySelectorAll('[data-reveal]');
  if (revealItems.length && !reducedMotion?.matches && typeof window.IntersectionObserver === 'function') {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target);
      });
    }, { rootMargin: '0px 0px -32px' });

    function reveal(element, immediate = false) {
      if (immediate) element.classList.add('reveal-immediate');
      element.classList.add('is-visible');
      observer.unobserve(element);
    }

    function revealPath(element) {
      let item = element?.closest?.('[data-reveal]');
      while (item) {
        reveal(item, true);
        item = item.parentElement?.closest('[data-reveal]');
      }
    }

    function revealHashTarget() {
      revealPath(document.querySelector(':target'));
    }

    revealItems.forEach((item) => observer.observe(item));
    revealHashTarget();
    document.addEventListener('focusin', (event) => revealPath(event.target));
    window.addEventListener('hashchange', revealHashTarget);
    reducedMotion?.addEventListener?.('change', (event) => {
      if (!event.matches) return;
      observer.disconnect();
      document.documentElement.classList.remove('motion-enabled');
    });
    document.documentElement.classList.add('motion-enabled');
  }

  if (registration && phone) {
    document.querySelectorAll('[data-open-registration]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        registration.scrollIntoView({ behavior: reducedMotion?.matches ? 'instant' : 'smooth', block: 'start' });
        phone.focus({ preventScroll: true });
      });
    });
  }

  const fixedRegistration = document.querySelector('[data-fixed-registration]');
  if (fixedRegistration && registration && phone && typeof IntersectionObserver === 'function') {
    const inlineButtons = [...document.querySelectorAll('.landing .cta')];
    const registrationAreas = document.querySelectorAll('.registration');
    const visibleElements = new Set();

    function updateFixedRegistration() {
      const focusedArea = document.activeElement?.closest('.registration');
      fixedRegistration.hidden = inlineButtons.some((button) => visibleElements.has(button))
        || visibleElements.has(focusedArea);
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleElements.add(entry.target);
        else visibleElements.delete(entry.target);
      }
      updateFixedRegistration();
    });

    inlineButtons.forEach((button) => observer.observe(button));
    registrationAreas.forEach((area) => observer.observe(area));
    document.addEventListener('focusin', updateFixedRegistration);
    document.addEventListener('focusout', () => requestAnimationFrame(updateFixedRegistration));
    document.body.classList.add('fixed-registration-enabled');
  }

  const videos = [...document.querySelectorAll('#portfolio-videos video, #testimonial-videos video')];
  videos.forEach((video) => {
    const play = video.closest('.video-frame')?.querySelector('[data-video-play]');
    if (play) {
      play.hidden = false;
      play.addEventListener('click', () => {
        video.play().catch(() => { play.hidden = true; });
      });
      video.addEventListener('pause', () => { play.hidden = false; });
      video.addEventListener('ended', () => { play.hidden = false; });
    }
    video.addEventListener('play', () => {
      if (play) play.hidden = true;
      videos.forEach((other) => {
        if (other !== video && !other.paused) other.pause();
      });
    });
  });

  function setupCarousel(track, itemSelector, previous, next, position, { fitActiveCard = false, onActiveChange } = {}) {
    const cards = [...(track?.querySelectorAll(itemSelector) ?? [])];
    if (!cards.length || !previous || !next) return false;

    const getStops = () => {
      const start = cards[0].getBoundingClientRect().left;
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const offsets = cards.map((card) => Math.min(maxScroll, card.getBoundingClientRect().left - start));
      return offsets.filter((offset, index) => index === 0 || offset - offsets[index - 1] > 1);
    };

    let requestedScroll = null;
    let scrollTimeout;
    let activeCard;
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateControls) : null;

    function getPosition(stops, offset) {
      return stops.reduce((closest, stop, index) =>
        Math.abs(stop - offset) < Math.abs(stops[closest] - offset) ? index : closest, 0);
    }

    function updateControls() {
      const stops = getStops();
      const current = getPosition(stops, track.scrollLeft);
      previous.disabled = stops.length < 2;
      next.disabled = stops.length < 2;
      if (position) {
        const label = `${current + 1} / ${stops.length}`;
        if (position.textContent !== label) position.textContent = label;
      }
      const card = cards[current];
      if (card !== activeCard) {
        if (fitActiveCard) {
          if (activeCard) observer?.unobserve(activeCard);
          observer?.observe(card);
          // Screenshots further down the active card can start outside the clipped track.
          card.querySelectorAll('img[loading="lazy"]').forEach((image) => { image.loading = 'eager'; });
        }
        activeCard = card;
        onActiveChange?.(card);
      }
      if (fitActiveCard) {
        const scrollbarHeight = track.offsetHeight - track.clientHeight;
        const height = `${Math.ceil(card.getBoundingClientRect().height) + scrollbarHeight}px`;
        if (track.style.blockSize !== height) track.style.blockSize = height;
      }
    }

    function move(direction) {
      const stops = getStops();
      const current = getPosition(stops, requestedScroll ?? track.scrollLeft);
      const nextIndex = (current + direction + stops.length) % stops.length;
      requestedScroll = stops[nextIndex];
      track.scrollTo({ left: requestedScroll, behavior: reducedMotion?.matches ? 'instant' : 'smooth' });
    }

    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('pointerdown', () => { requestedScroll = null; });
    track.addEventListener('scroll', () => {
      updateControls();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { requestedScroll = null; }, 150);
    }, { passive: true });
    if (observer) {
      observer.observe(track);
    } else {
      window.addEventListener('resize', updateControls);
      if (fitActiveCard) track.addEventListener('load', updateControls, true);
    }
    updateControls();
    return true;
  }

  setupCarousel(
    document.querySelector('[data-reviews]'),
    '[data-review-card]',
    document.querySelector('[data-review-prev]'),
    document.querySelector('[data-review-next]'),
    document.querySelector('[data-review-position]'),
    { fitActiveCard: true }
  );

  const photoControls = document.querySelector('[data-photo-controls]');
  if (photoControls) {
    photoControls.hidden = !setupCarousel(
      document.getElementById('portfolio-photos'),
      '.example',
      photoControls.querySelector('[data-photo-prev]'),
      photoControls.querySelector('[data-photo-next]'),
      photoControls.querySelector('[data-photo-position]')
    );
  }

  document.querySelectorAll('[data-video-controls]').forEach((controls) => {
    const previous = controls.querySelector('[data-video-prev]');
    const track = document.getElementById(previous?.getAttribute('aria-controls') ?? '');
    const trackVideos = [...(track?.querySelectorAll('video') ?? [])];
    controls.hidden = !setupCarousel(
      track,
      '.video-frame',
      previous,
      controls.querySelector('[data-video-next]'),
      controls.querySelector('[data-video-position]'),
      {
        fitActiveCard: true,
        onActiveChange: (card) => {
          trackVideos.forEach((video) => {
            if (!card.contains(video) && !video.paused) video.pause();
          });
        }
      }
    );
  });

  const timer = ['hours', 'minutes', 'seconds'].map((id) => document.getElementById(id));
  if (timer.every(Boolean)) {
    const duration = 24 * 60 * 60 * 1000;
    const key = 'countdownEndTime';
    let deadline = 0;
    try { deadline = Number(localStorage.getItem(key)); } catch { /* Storage may be disabled. */ }

    function updateTimer() {
      const now = Date.now();
      if (!Number.isFinite(deadline) || deadline <= now) {
        deadline = now + duration;
        try { localStorage.setItem(key, String(deadline)); } catch { /* Keep the timer in memory. */ }
      }

      const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
      const units = [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60];
      timer.forEach((part, index) => { part.textContent = String(units[index]).padStart(2, '0'); });
    }

    updateTimer();
    setInterval(updateTimer, 1000);
  }
})();
