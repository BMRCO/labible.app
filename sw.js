/* =========================
   LaBible.app — sw.js
   Service Worker v2
   ========================= */

const CACHE_NAME = "labible-v2";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-1024x1024.png"
];

/* ---- Install : mise en cache des assets statiques ---- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ---- Activate : suppression des anciens caches ---- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ---- Fetch : stratégie Network First pour la Bible, Cache First pour le reste ---- */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-GET et cross-origin
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Données Bible → Network First (mise à jour si possible, sinon cache)
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets statiques → Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
