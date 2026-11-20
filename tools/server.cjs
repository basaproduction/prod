'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const model = require('../assets/feed-model.js');
const settings = require('../settings.js');

const root = path.resolve(__dirname, '..');
const snapshotPath = path.join(root, 'assets', 'videos.js');
const prefix = 'window.BASA_FEED = ';
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.woff':'font/woff', '.png':'image/png', '.webp':'image/webp', '.txt':'text/plain; charset=utf-8' };

async function readSnapshot(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    const start = text.indexOf(prefix);
    if (start < 0) return null;
    const data = JSON.parse(text.slice(start + prefix.length).replace(/;\s*$/, ''));
    return { channelId: String(data.channelId || ''), fetchedAt: data.fetchedAt, videos: model.normalize(data.videos) };
  } catch (_) { return null; }
}
async function storeSnapshot(file, snapshot) {
  const temp = file + '.' + randomUUID() + '.tmp';
  const json = JSON.stringify(snapshot).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  try {
    await fs.writeFile(temp, prefix + json + ';\n', 'utf8');
    await fs.rename(temp, file);
  } finally { await fs.rm(temp, { force: true }).catch(function () {}); }
}

function makeFeed(config, file, fetcher) {
  const selected = model.channel(config.rutubeChannel);
  const manual = model.normalize(config.videos);
  let current;
  let pending;
  let retryAfter = 0;
  function fallback() {
    return current || { channelId: selected ? selected.id : '', fetchedAt: '', videos: manual };
  }
  async function refresh() {
    const reply = await fetcher(model.apiUrl(selected.id), {
      signal: AbortSignal.timeout(6000), headers: { 'Accept': 'application/json' }
    });
    if (!reply.ok) throw new Error('RUTUBE HTTP ' + reply.status);
    const json = await reply.json();
    if (!Array.isArray(json.results)) throw new Error('Неизвестный формат ответа RUTUBE');
    const videos = model.normalize(json.results);
    const titles = new Map(manual.map(function (item) { return [item.id, item.titleEn]; }));
    videos.forEach(function (item) { if (!item.titleEn && titles.get(item.id)) item.titleEn = titles.get(item.id); });
    current = { channelId: selected.id, fetchedAt: new Date().toISOString(), videos };
    return current;
  }
  return async function getFeed(options = {}) {
    if (!selected || !selected.id) {
      if (options.force) throw new Error('Укажите числовой ID канала RUTUBE или ссылку /channel/ID/ в settings.js.');
      return fallback();
    }
    if (!current) {
      const cache = await readSnapshot(file);
      if (cache && cache.channelId === selected.id) current = cache;
    }
    if (!options.force && (model.fresh(current, selected.id) || Date.now() < retryAfter)) return fallback();
    if (!pending) {
      pending = refresh().then(async function (result) {
        try { await storeSnapshot(file, result); }
        catch (error) {
          if (options.force) throw error;
          console.warn('Снимок не записан. Сервер хранит результат в памяти.', error.message);
        }
        return result;
      }).catch(function (error) {
        retryAfter = Date.now() + 300000;
        throw error;
      }).finally(function () { pending = null; });
    }
    try { return await pending; }
    catch (error) { if (options.force) throw error; return fallback(); }
  };
}

function createServer(getFeed) {
  return http.createServer(async function (req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    function reply(status, type, body, cache) {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': cache || 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : body);
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return reply(405, types['.txt'], 'Method not allowed');
    }
    try {
      let urlPath;
      try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
      catch (_) { return reply(400, types['.txt'], 'Bad request'); }
      if (urlPath === '/api/videos') {
        const feed = await getFeed();
        return reply(200, 'application/json; charset=utf-8', JSON.stringify(feed), 'no-store');
      }
      if (urlPath === '/') urlPath = '/index.html';
      if (urlPath === '/en' || urlPath === '/en/') urlPath = '/en.html';
      const asset = /^\/assets\/[a-z0-9_/-]+\.(?:css|js|woff|png|webp|txt)$/i.test(urlPath);
      if (!asset && !['/index.html','/en.html','/settings.js'].includes(urlPath)) return reply(404, types['.txt'], 'Not found');
      const target = path.join(root, urlPath.slice(1));
      const ext = path.extname(target);
      let data = await fs.readFile(target);
      if (ext === '.html') data = data.toString('utf8').replace('data-feed-mode="static"', 'data-feed-mode="server"');
      const cache = asset && !urlPath.endsWith('/videos.js') ? 'public, max-age=3600' : 'no-cache';
      return reply(200, types[ext], data, cache);
    } catch (error) {
      return reply(error.code === 'ENOENT' ? 404 : 500, types['.txt'], error.code === 'ENOENT' ? 'Not found' : 'Server error');
    }
  });
}

if (require.main === module) {
  const getFeed = makeFeed(settings, snapshotPath, globalThis.fetch);
  if (process.argv.includes('--sync')) {
    getFeed({ force: true }).then(function (result) { console.log('assets/videos.js обновлён. Видео: ' + result.videos.length); })
      .catch(function (error) { console.error(error.message); process.exitCode = 1; });
  } else {
    const host = process.env.HOST || '127.0.0.1';
    const port = Number(process.env.PORT || 8080);
    const server = createServer(getFeed);
    server.on('error', function (error) { console.error(error.message); process.exitCode = 1; });
    server.listen(port, host, function () { console.log('BASA · http://' + host + ':' + server.address().port); });
  }
}
module.exports = { makeFeed, createServer, readSnapshot, storeSnapshot };
