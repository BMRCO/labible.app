/* sw.js — LaBible.app PRO */
const VERSION = "labible-pro-v1";
const CORE = [
  "/",
  "/index.html",
  "/offline.html",
  "/assets/style.css",
  "/assets/app.js",
  "/assets/bible.js",
  "/assets/ui.js",
  "/assets/storage.js",
  "/assets/share-image.js",
  "/manifest.webmanifest",
  "/data/books.json",
  "/data/segond_1910.json",
  "/data/vdd_365.json",
  "/plan/plan_365.json",
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

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Navigation => network-first with offline fallback
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // JSON data => stale-while-revalidate for speed
  if (url.pathname.startsWith("/data/") || url.pathname.startsWith("/plan/")) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Assets => cache-first
  if (url.pathname.startsWith("/assets/") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Default
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
    // For SPA deep links, serve index
    const cachedIndex = await cache.match("/index.html");
    return cachedIndex || (await cache.match("/offline.html")) || new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response("Offline", { status: 503 });
}