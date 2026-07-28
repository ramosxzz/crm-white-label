const CACHE_NAME = "solaire-crm-assets-v4";
// Cache separado do app do tecnico: ele precisa abrir a OS sem sinal na casa
// do cliente. Fica em outro balde pra nao misturar com os assets do CRM e
// poder ser limpo sozinho.
const FIELD_CACHE = "solaire-field-v1";
const SAFE_ASSETS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/apple-icon.svg",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/icon-maskable-512.png",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SAFE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== FIELD_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isFieldRoute = url.pathname === "/campo" || url.pathname.startsWith("/campo/");

  if (request.mode === "navigate") {
    // /campo: network-first mas guardando a ultima versao boa, pra o tecnico
    // conseguir abrir a OS onde nao tem sinal. O resto do CRM continua com o
    // comportamento antigo (rede ou /offline.html) - nao vale o risco de
    // servir tela velha em telas que dependem de dado quente.
    if (isFieldRoute) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(FIELD_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() =>
            caches
              .match(request)
              .then((cached) => cached || caches.match("/offline.html")),
          ),
      );
      return;
    }

    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  // Chunks do Next tem hash no nome, entao sao imutaveis: cachear e seguro e
  // e o que permite a tela do tecnico hidratar offline.
  const isImmutableBuildAsset = url.pathname.startsWith("/_next/static/");

  const isSafeStaticAsset =
    isImmutableBuildAsset ||
    SAFE_ASSETS.includes(url.pathname) ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/pwa/");

  if (!isSafeStaticAsset) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
