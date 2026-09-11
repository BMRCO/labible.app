const CACHE_NAME = 'labible-v46';

// ---------------------------------------------------------------------------
// 11 septembre 2026 — POURQUOI CE FICHIER A ETE TOUCHE SANS RIEN CHANGER D'AUTRE
//
// 53 explications de data/explications.json ont ete reecrites (les passages de
// l'Ancien Testament que le Nouveau rapporte au Christ). Sans cette ligne, la
// correction n'atteignait personne :
//
//   1. _headers sert /*.json en « max-age=31536000, immutable » : le NAVIGATEUR
//      de chaque lecteur garde l'ancien fichier pendant un an.
//   2. app.v2.js demande /data/explications.json SANS ?v= : rien a incrementer.
//   3. Purger Cloudflare ne vide que la bordure, jamais les appareils.
//
// La seule chose qui refait descendre ce fichier est une NOUVELLE INSTALLATION
// du service worker : explications.json est dans STATIC_ASSETS, donc refetche
// avec { cache: 'reload' }, qui ignore le cache HTTP. Or l'installation ne
// rejoue que si sw.js change d'un octet. D'ou ce commentaire : il EST le
// correctif.
//
// ⚠️ NE PAS monter CACHE_NAME pour cela. Le cache reste 'labible-v46', donc :
//    - les STATIC_ASSETS (petits) redescendent : ~200 Ko ;
//    - les DATA_ASSETS sont sautes par « if (await cache.match(url)) return » :
//      les ~11 Mo de la Bible ne bougent pas ;
//    - activate ne supprime rien, puisque aucun cache ne devient orphelin.
//
// A REFAIRE a chaque modification du contenu de data/explications.json.
// ---------------------------------------------------------------------------

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css?v=5',
  '/app.v2.js?v=47',
  '/footer.js',
  '/header.js',
  '/data/explications.json',
  '/manifest.webmanifest',
  '/a-propos.html',
  '/contact.html',
  '/legal.html',
  '/installer.html',
  '/liens.html',
  '/louis-segond.html',
  '/conditions.html',
  '/confidentialite.html',
  '/quiz.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Donnees volumineuses : tout ce qu'il faut pour que l'application soit
// ENTIEREMENT utilisable hors ligne des la premiere installation.
//
// ATTENTION AUX PARAMETRES DE VERSION : la cle de cache est l'URL complete.
// quiz.html demande '/data/quiz.json?v=1' — precharger '/data/quiz.json'
// (sans le ?v=1) ne servirait a rien. Toujours copier l'URL exacte demandee
// par la page.
const DATA_ASSETS = [
  '/data/lsg1910.json',        // 7,7 Mo — la Bible entiere
  '/data/crossrefs.json',      // 2,4 Mo — 225 053 references croisees
  '/data/quiz.json?v=1',       // 0,8 Mo — les 2 032 questions du quiz
  '/data/versets_themes.json', // 0,02 Mo — les themes
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        STATIC_ASSETS.map(url =>
          fetch(url, { cache: 'reload' }).then(res => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      );
      // Une donnee deja en cache n'est PAS retelechargee. Sans ce test, la
      // moindre modification de sw.js relancait l'installation et refaisait
      // descendre ~11 Mo a chaque utilisateur deja installe. Ces fichiers ne
      // changent quasiment jamais ; pour en forcer un, changer son ?v= (comme
      // pour quiz.json) ou monter CACHE_NAME.
      //
      // allSettled : une donnee qui echoue (reseau instable) ne fait PAS
      // echouer l'installation. Ce qui manque sera recupere par
      // staleWhileRevalidate a la premiere utilisation.
      await Promise.allSettled(
        DATA_ASSETS.map(async url => {
          try {
            if (await cache.match(url)) return;
            const res = await fetch(url, { cache: 'reload' });
            if (res.ok) await cache.put(url, res);
          } catch {}
        })
      );
      console.log('[SW] Donnees hors ligne mises en cache ✓');
    })
  );
  self.skipWaiting();
});

// Permet a la page de forcer l'activation immediate d'une nouvelle version.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

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

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin) && !url.hostname.includes('fonts.googleapis') && !url.hostname.includes('fonts.gstatic')) return;

  // Les donnees volumineuses : cache d'abord, elles ne changent pas souvent.
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

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

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'reload' });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('/offline.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('Hors ligne', { status: 503 });
}
