const CACHE = "villa-layos-v2";
const ASSETS = [
  "./",
  "index.html",
  "assets/app.css",
  "assets/app.js",
  "assets/icon.svg",
  "assets/reports/aguila-real-137-topografia.pdf",
  "assets/reports/alcotan-29-topografia.pdf",
  "assets/reports/alcotan-6-topografia.pdf",
  "assets/reports/alimoche-49-topografia.pdf",
  "assets/reports/zorzal-2-topografia.pdf",
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
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
