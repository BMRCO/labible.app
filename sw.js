const CACHE = "bible-fr-cache-v99";

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());

// Sem cache customizado para evitar problemas de rotas em SPA.