/* ENARTE PWA service worker — network-only.
 * Caching HTML/JS previously caused a blank ivory screen after install.
 * A fetch handler is still required for Chrome installability.
 */
const CACHE = "enarte-shell-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Always hit the network. Do not serve stale app shells.
  event.respondWith(fetch(event.request));
});

// Keep CACHE name referenced so future versions can migrate cleanly.
void CACHE;
