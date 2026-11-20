/* Общие правила обработки ленты для браузера и необязательного сервера. */
(function (root) {
  'use strict';
  function https(value) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol === 'https:' && !url.username && !url.password && !url.port) return url;
    } catch (_) { /* A blank or incomplete setting is allowed. */ }
    return null;
  }
  function channel(value) {
    const raw = String(value || '').trim();
    if (/^[1-9]\d*$/.test(raw)) return { id: raw, url: 'https://rutube.ru/channel/' + raw + '/' };
    const url = https(raw);
    if (!url || !['rutube.ru','www.rutube.ru'].includes(url.hostname)) return null;
    const numeric = url.pathname.match(/^\/channel\/([1-9]\d*)(?:\/|$)/);
    if (numeric) return channel(numeric[1]);
    const alias = url.pathname.match(/^\/u\/([a-z\d_.-]+)(?:\/|$)/i);
    return alias ? { id: '', url: 'https://rutube.ru/u/' + alias[1] + '/' } : null;
  }
  function behance(value) {
    const url = https(value);
    if (!url || !['behance.net','www.behance.net'].includes(url.hostname)) return '';
    const account = url.pathname.match(/^\/([a-z\d_.-]+)\/?$/i);
    return account ? 'https://www.behance.net/' + account[1] : '';
  }
  function videoId(value) {
    const raw = String(value || '').trim();
    if (/^[a-f\d]{32}$/i.test(raw)) return raw.toLowerCase();
    const url = https(raw);
    if (!url || !['rutube.ru','www.rutube.ru'].includes(url.hostname)) return '';
    const match = url.pathname.match(/^\/(?:video|shorts|play\/embed)\/([a-f\d]{32})\/?$/i);
    return match ? match[1].toLowerCase() : '';
  }
  function onlyText(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 250) : '';
  }
  function normalize(entries) {
    const seen = new Set();
    const videos = [];
    for (const item of Array.isArray(entries) ? entries : []) {
      if (!item || item.is_hidden || item.is_deleted || item.is_private) continue;
      const id = videoId(item.id) || videoId(item.url || item.video_url);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const thumb = https(item.thumbnail_url || item.thumbnail);
      videos.push({ id: id, title: onlyText(item.title), titleEn: onlyText(item.titleEn), thumbnail: thumb ? thumb.href : '' });
      if (videos.length === 8) break;
    }
    return videos;
  }
  function apiUrl(id) {
    return 'https://rutube.ru/api/video/person/' + id + '/?page=1&format=json';
  }
  function fresh(snapshot, channelId) {
    const age = snapshot ? Date.now() - Date.parse(snapshot.fetchedAt) : NaN;
    return Boolean(snapshot && snapshot.channelId === channelId && Number.isFinite(age) && age >= 0 && age < 3600000);
  }
  const model = { channel, behance, videoId, normalize, apiUrl, fresh };
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.BasaFeedModel = model;
})(typeof window === 'undefined' ? globalThis : window);
