// sw.js — LaBible.app (cache v3) — força update para não ficar preso ao JS antigo

const CACHE = "labible-cache-v3";

const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.webmanifest",
  "/data/segond_1910.json",
  "/plan-lecture-1-an.html",
  "/plan-dashboard.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// Network-first para páginas e JS/CSS (para evitar ficar preso)
// Cache-first para ficheiros grandes (json) quando offline
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // só controla o teu domínio
  if (url.origin !== location.origin) return;

  const isNav = req.mode === "navigate";
  const isCode = url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".html");

  if (isNav || isCode) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("/index.html");
      }
    })());
    return;
  }

  // outros assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});