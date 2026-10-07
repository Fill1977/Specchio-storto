/* Specchio Storto — service worker
   Alza il numero di CACHE a ogni modifica del sito, così il telefono
   scarica la versione nuova invece di riusare quella vecchia. */
const CACHE = 'specchio-v3';

const CORE = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/shaders.js',
  './js/i18n.js',
  './js/audio.js',
  './js/store.js',
  './js/native.js',
  './fonts/bungee-latin-400-normal.woff2',
  './fonts/archivo-latin-400-normal.woff2',
  './fonts/archivo-latin-600-normal.woff2',
  './fonts/archivo-latin-800-normal.woff2',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Prima la rete (per prendere gli aggiornamenti),
  // cache come rete di salvataggio quando il telefono è offline.
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
