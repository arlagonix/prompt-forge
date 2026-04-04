const CACHE_NAME = "prompt-forge-v2.1";
const BASE_PATH = "/prompt-forge";
const APP_SHELL = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/manifest.webmanifest`,
  `${BASE_PATH}/icon.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (req.mode === "navigate") {
              cache.put(`${BASE_PATH}/`, copy);
            } else {
              cache.put(req, copy);
            }
          });
        }
        return response;
      })
      .catch(() => {
        if (req.mode === "navigate") {
          return caches.match(`${BASE_PATH}/`);
        }
        return caches.match(req);
      }),
  );
});
