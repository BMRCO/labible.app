const VERSION = "labible-2026-pro-v1";

const CORE = [
  "/",
  "/index.html",
  "/offline.html",
  "/404.html",
  "/assets/style.css",
  "/assets/app.js",
  "/assets/ui.js",
  "/assets/storage.js",
  "/assets/bible.js",
  "/assets/share-image.js",
  "/manifest.webmanifest",
  "/data/books.json",
  "/data/segond_1910.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE.map(u => new Request(u, { cache: "reload" })));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window" });
    for (const c of clients) c.postMessage("SW_UPDATED");
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // Data + assets cache-first
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/data/") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cachedIndex = await cache.match("/index.html");
    return cachedIndex || (await cache.match("/offline.html")) || new Response("Offline", { status: 503 });
  }
}
