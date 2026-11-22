/* Uspeyka service worker: offline page, cached static files, nothing private. */
const VERSION = "uspeyka-v3";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/mascot.webp", "/logo.svg", "/icon-192.png"];

// The offline page also needs its styles and scripts, so they are cached with it.
async function precache() {
  const cache = await caches.open(VERSION);
  await cache.addAll(PRECACHE);
  const page = await cache.match(OFFLINE_URL);
  if (!page) return;
  const html = await page.text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
  await Promise.all(assets.map((asset) => cache.add(asset).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|webp|svg|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: always fresh from the network; the offline page when there is none.
  // Personal pages are never stored.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((page) => page || Response.error()),
      ),
    );
    return;
  }

  // Build files and images never change under the same URL: cache first.
  if (isStatic(url)) {
    event.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
  }
});
