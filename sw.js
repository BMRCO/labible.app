// sw.js — minimal (no offline cache)
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Não intercepta fetch => não faz cache, não cria offline