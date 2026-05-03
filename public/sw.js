const CACHE = "ondda-v1";
const OFFLINE_URL = "/catalogo";

// Recursos para cache imediato
const PRE_CACHE = ["/", "/catalogo", "/pedidos", "/login", "/ondda-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRE_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Só intercepta GETs de navegação (não APIs)
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Atualiza cache com resposta fresca
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL))
      )
  );
});
