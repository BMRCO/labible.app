const CACHE_NAME = 'labible-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/a-propos.html',
  '/contact.html',
  '/legal.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const BIBLE_DATA = '/data/lsg1910.json';

// Installation — mise en cache de tout
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Fichiers statiques
      await cache.addAll(STATIC_ASSETS);
      // JSON Bible séparé (gros fichier)
      try {
        const response = await fetch(BIBLE_DATA);
        if (response.ok) {
          await cache.put(BIBLE_DATA, response);
          console.log('[SW] Bible JSON mis en cache ✓');
        }
      } catch (e) {
        console.warn('[SW] Bible JSON non disponible hors ligne:', e);
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
