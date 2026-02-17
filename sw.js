const CACHE = "bible-fr-cache-v101";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// sem cache customizado (evita problemas de SPA/rotas)