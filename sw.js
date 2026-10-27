// Offline support for the web app: serve the saved copy instantly, refresh it in the background.
// Bump VERSION whenever the app's files change so phones pick up the new version.
const VERSION = "pitchpal-web-5.0.1";
const FILES = ["./", "index.html", "core.js", "gb.js", "sfx.js", "news.js", "reading.js", "manifest.webmanifest",
  "fonts/PressStart2P.woff2", "fonts/VT323.woff2", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const own = url.origin === location.origin, fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!own && !fonts) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: own });
    const fresh = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
