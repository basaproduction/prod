(function () {
  'use strict';
  const lang = document.documentElement.lang;
  const ru = lang === 'ru';
  const config = window.BASA_SETTINGS || {};
  const feeds = window.BasaFeedModel;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileMenu = document.querySelector('.mobile-menu');
  const lastFocus = new WeakMap();
  if (typeof document.getElementById('detail-vulkan').showModal === 'function') document.getElementById('case-notes').hidden = true;

  function track(event, detail) {
    const data = Object.assign({ event: 'basa_' + event, language: lang }, detail || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
  }
  track('page_view');

  const profile = feeds.behance(config.behanceUrl);
  if (profile) {
    document.querySelectorAll('[data-work]').forEach(function (link) {
      link.href = profile;
      link.target = '_blank';
      link.rel = 'noopener';
      link.firstElementChild.textContent = link.dataset.externalLabel;
      link.querySelector('.work-arrow').hidden = false;
    });
  }
  mobileMenu.querySelector('nav').addEventListener('click', function () {
    mobileMenu.open = false;
  });
  document.addEventListener('click', function (event) {
    if (!mobileMenu.contains(event.target)) mobileMenu.open = false;
    const link = event.target.closest('a');
    if (!link) return;
    if (link.hasAttribute('data-contact')) track('telegram_click', { placement: link.dataset.contact });
    if (link.matches('[data-work]')) track('work_click', { destination: profile ? 'behance' : 'case' });
    if (link.classList.contains('x-link')) track('x_click');
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && mobileMenu.open) {
      mobileMenu.open = false;
      mobileMenu.querySelector('summary').focus();
    }
  });
  const languageLinks = document.querySelectorAll('[data-language]');
  function preserveSection() {
    languageLinks.forEach(function (link) {
      if (link.dataset.language === lang) return;
      const hash = location.hash;
      link.href = (link.dataset.language === 'ru' ? 'index.html' : 'en.html') + (/^#(?:services|work|about|videos|contact|main|top)$/.test(hash) ? hash : '');
    });
  }
  preserveSection();
  window.addEventListener('hashchange', preserveSection);
  languageLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (link.dataset.language === lang) {
        event.preventDefault();
        return;
      }
      track('language_change', { to: link.dataset.language });
    });
  });

  function openDialog(dialog, trigger) {
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    lastFocus.set(dialog, trigger);
    dialog.showModal();
    document.documentElement.classList.add('modal-open');
    dialog.scrollTop = 0;
    const close = dialog.querySelector('[data-close]');
    if (close) close.focus({ preventScroll: true });
    return true;
  }
  document.querySelectorAll('[data-dialog]').forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const id = trigger.dataset.dialog;
      if (openDialog(document.getElementById('detail-' + id), trigger)) {
        event.preventDefault();
        track(id === 'vulkan' ? 'case_open' : 'service_open', { item: id });
      }
    });
  });
  document.querySelectorAll('dialog').forEach(function (dialog) {
    dialog.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', function () {
      if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('modal-open');
      const slot = dialog.querySelector('.player-slot');
      if (slot) slot.replaceChildren();
      const trigger = lastFocus.get(dialog);
      if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
    });
  });

  const channel = feeds.channel(config.rutubeChannel);
  const snapshot = window.BASA_FEED || {};
  const manual = feeds.normalize(config.videos);
  const rail = document.querySelector('.video-rail');
  const fallback = document.querySelector('.video-fallback');
  const channelLink = document.querySelector('.channel-link');
  const controls = document.querySelector('.rail-controls');
  const prev = controls.querySelector('[data-prev]');
  const next = controls.querySelector('[data-next]');
  const playerDialog = document.getElementById('detail-video');
  if (channel) {
    channelLink.href = channel.url;
    channelLink.hidden = false;
    fallback.querySelector('p').textContent = ru ? 'Видео доступны на моём канале.' : 'You can watch my videos on my channel.';
    const link = fallback.querySelector('a');
    link.firstChild.textContent = ru ? 'Перейти на RUTUBE ' : 'Watch on RUTUBE ';
    link.href = channel.url;
    link.removeAttribute('data-contact');
  }

  function watch(video, title, link, event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!openDialog(playerDialog, link)) return;
    event.preventDefault();
    playerDialog.querySelector('#player-title').textContent = title;
    playerDialog.querySelector('.player-source').href = link.href;
    const frame = document.createElement('iframe');
    frame.title = title;
    frame.src = 'https://rutube.ru/play/embed/' + video.id;
    frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    playerDialog.querySelector('.player-slot').replaceChildren(frame);
    track('video_open', { video_id: video.id });
  }
  function syncControls() {
    const max = rail.scrollWidth - rail.clientWidth;
    controls.hidden = rail.hidden || max < 3;
    prev.disabled = rail.scrollLeft < 2;
    next.disabled = rail.scrollLeft >= max - 2;
  }
  function move(direction) {
    const card = rail.firstElementChild;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    rail.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
  prev.addEventListener('click', function () { move(-1); });
  next.addEventListener('click', function () { move(1); });
  rail.addEventListener('scroll', syncControls, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(syncControls).observe(rail);
  else window.addEventListener('resize', syncControls);

  let currentVideos = '';
  function showVideos(entries) {
    const videos = feeds.normalize(entries);
    const signature = JSON.stringify(videos);
    if (signature === currentVideos) return;
    currentVideos = signature;
    const fragment = document.createDocumentFragment();
    videos.forEach(function (video) {
      const link = document.createElement('a');
      link.className = 'video-card';
      link.href = 'https://rutube.ru/video/' + video.id + '/';
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-haspopup', 'dialog');
      const title = ((!ru && video.titleEn) || video.title || (ru ? 'Видео на RUTUBE' : 'Video on RUTUBE'));
      if (video.thumbnail) {
        const img = document.createElement('img');
        img.src = video.thumbnail;
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', function () { img.remove(); });
        link.append(img);
      }
      const icon = document.createElement('span');
      icon.className = 'video-play';
      icon.textContent = '▶';
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'video-title';
      label.textContent = title;
      link.append(icon, label);
      link.addEventListener('click', function (event) { watch(video, title, link, event); });
      fragment.append(link);
    });
    rail.replaceChildren(fragment);
    rail.hidden = !videos.length;
    fallback.hidden = Boolean(videos.length);
    channelLink.hidden = !channel || !videos.length;
    requestAnimationFrame(syncControls);
  }
  const saved = channel && channel.id && snapshot.channelId === channel.id ? feeds.normalize(snapshot.videos) : [];
  showVideos(saved.length ? saved : manual);

  async function refresh() {
    if (!channel || !channel.id || (location.protocol !== 'http:' && location.protocol !== 'https:')) return;
    const localServer = document.documentElement.dataset.feedMode === 'server';
    if (!localServer && feeds.fresh(snapshot, channel.id)) return;
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, localServer ? 9000 : 5500);
    try {
      const url = localServer ? 'api/videos' : feeds.apiUrl(channel.id);
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) return;
      const data = await response.json();
      const entries = localServer ? data.videos : data.results;
      if (!Array.isArray(entries)) return;
      const live = feeds.normalize(entries);
      const localized = new Map(manual.map(function (video) { return [video.id, video.titleEn]; }));
      live.forEach(function (video) {
        if (!video.titleEn && localized.get(video.id)) video.titleEn = localized.get(video.id);
      });
      showVideos(live.length ? live : manual);
    } catch (_) { /* Offline, a slow provider or browser cross-origin policy: keep the displayed fallback. */ }
    finally { clearTimeout(timer); }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        observer.disconnect();
        refresh();
      }
    }, { rootMargin: '400px' });
    observer.observe(document.getElementById('videos'));
  } else refresh();
})();
