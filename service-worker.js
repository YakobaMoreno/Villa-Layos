const CACHE = "villa-layos-v5";
const ASSETS = [
  "./",
  "index.html",
  "assets/app.css",
  "assets/app.js",
  "assets/icon.svg",
  "assets/reports/aguila-real-137-topografia.pdf",
  "assets/reports/aguila-real-84-topografia.pdf",
  "assets/reports/alcotan-20-topografia.pdf",
  "assets/reports/alcotan-25-topografia.pdf",
  "assets/reports/alcotan-29-topografia.pdf",
  "assets/reports/alcotan-41-topografia.pdf",
  "assets/reports/alcotan-46-topografia.pdf",
  "assets/reports/alcotan-6-topografia.pdf",
  "assets/reports/alimoche-21-topografia.pdf",
  "assets/reports/alimoche-23-topografia.pdf",
  "assets/reports/alimoche-49-topografia.pdf",
  "assets/reports/herrerillo-14-topografia.pdf",
  "assets/reports/herrerillo-4-topografia.pdf",
  "assets/reports/herrerillo-44-topografia.pdf",
  "assets/reports/herrerillo-52-topografia.pdf",
  "assets/reports/rascon-13-topografia.pdf",
  "assets/reports/zorzal-2-topografia.pdf",
  "assets/reports/zorzal-29-topografia.pdf",
  "data/project-data.json",
  "manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const networkFirst = event.request.mode === "navigate" || /\.(html|css|js|json)$/i.test(url.pathname);
  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
