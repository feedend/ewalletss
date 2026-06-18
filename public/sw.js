self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Lascia passare le richieste normalmente, serve solo per attivare l'installazione
  event.respondWith(fetch(event.request));
});
