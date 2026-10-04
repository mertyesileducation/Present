/* Present service worker — sürüm 1.0.0 */
const VERSION = '1.0.0';
const BUILD = 4; // Dosyalar değiştiğinde artırın; eski önbellek silinir
const CACHE = `present-v${VERSION}-${BUILD}`;
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'shapes.js',
  'pptx-import.js',
  'pptx-export.js',
  'manifest.webmanifest',
  'vendor/pptxgen.bundle.js',
  'icons/icon.svg',
  'icons/icon-maskable.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('present-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Önce ağ (her zaman güncel kod), çevrimdışıyken önbellek
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? 'index.html' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? 'index.html' : req, { ignoreSearch: true })
        .then((hit) => hit || caches.match('index.html'))),
  );
});
