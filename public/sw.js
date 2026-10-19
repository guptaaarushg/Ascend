/*
 * Ascend service worker.
 *
 * Students on shared or spotty connections should still get something useful.
 * Strategy:
 *  - Navigations: network first, fall back to the cached shell, then /offline.
 *  - Static assets: stale while revalidate.
 * Nothing personal is ever cached: API and auth calls always go to the network.
 */
const CACHE = "ascend-v2";
const SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache anything that could contain a student's data.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_serverFn")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/offline.html"))),
    );
    return;
  }

  // Only cache files whose names never change (hashed build assets and icons).
  // Caching anything else can serve a stale, blank app after an update.
  const immutable = url.pathname.startsWith("/assets/") || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname);
  if (!immutable) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
