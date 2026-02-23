const CACHE_VERSION = "labible-pwa-v2026.04";

const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./offline.html"
];

// opcionais (não podem quebrar a instalação)
const OPTIONAL = [
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

async function cacheAllSafe(cache, urls) {
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) await cache.put(url, res);
    } catch (_) {}
  }));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(CORE);          // core obrigatório
    await cacheAllSafe(cache, OPTIONAL); // opcional: não falha
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_VERSION ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  // HTML: network-first
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put("./", fresh.clone());
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (_) {
        const cached = await caches.match("./index.html") || await caches.match("./");
        return cached || await caches.match("./offline.html");
      }
    })());
    return;
  }

  // assets: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});

self.addEventListener("message", async (event) => {
  if (event.data?.type === "CHECK_UPDATE") {
    await self.registration.update();
  }
});
