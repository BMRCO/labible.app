const CACHE_NAME = 'labible-v8';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/app.v2.js',
  '/manifest.webmanifest',
  '/a-propos.html',
  '/contact.html',
  '/legal.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

const BIBLE_DATA = '/data/lsg1910.json';

// Installation — cache individual pour éviter l'échec global
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache chaque fichier individuellement — un échec n'arrête pas tout
      await Promise.allSettled(
        STATIC_ASSETS.map(url =>
          fetch(url).then(res => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      );
      // JSON Bible séparé
      try {
        const res = await fetch(BIBLE_DATA);
        if (res.ok) await cache.put(BIBLE_DATA, res);
        console.log('[SW] Bible JSON mis en cache ✓');
      } catch (e) {
        console.warn('[SW] Bible JSON non disponible:', e);
      }
    })
  );
  self.skipWaiting();
});

// Activation — suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// Fetch — stratégie selon le type de ressource
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore les requêtes non-GET et les extensions externes
  if (request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin) && !url.hostname.includes('fonts.googleapis') && !url.hostname.includes('fonts.gstatic')) return;

  // JSON Bible → Cache First (priorité absolue au cache)
  if (url.pathname === BIBLE_DATA) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Fonts Google → Cache First
  if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Pages HTML → Network First (toujours la version fraîche si possible)
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Fichiers statiques → Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Cache First : sert depuis le cache, essaie le réseau si absent
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Contenu non disponible hors ligne.', { status: 503 });
  }
}

// Network First — essaie le réseau, fallback sur le cache puis offline.html
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback vers la page offline
    return caches.match('/offline.html');
  }
}

// Stale While Revalidate : sert le cache immédiatement, met à jour en arrière-plan
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('Hors ligne', { status: 503 });
}
