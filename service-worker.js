// Service worker de "Libro Finanzas Hogar".
// Guarda una copia de la cáscara de la app (HTML, manifest, íconos) para que abra
// rápido e instale como app. Firebase, Google Fonts y las librerías externas
// (html2canvas, jsPDF) NUNCA pasan por acá: siempre van directo a internet.
//
// Si alguna vez hacés un cambio grande y querés forzar que todos bajen la
// versión nueva, cambiá el número de CACHE_NAME (ej: 'lfh-shell-v13').
const CACHE_NAME = 'lfh-shell-v19';
const SHELL = ['./', './index.html', './privacidad.html', './manifest.json', './vendor/html2canvas.min.js', './vendor/jspdf.umd.min.js', './vendor/xlsx.full.min.js', './icon-192.png', './icon-512.png', './icon-maskable.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase/CDN: sin intervenir

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html');
  if (isPage) {
    // Página principal: primero internet (para traer siempre la versión más nueva),
    // y si no hay conexión, se muestra la última copia guardada.
    event.respondWith(
      fetch(req)
        .then(res => { caches.open(CACHE_NAME).then(c => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Archivos propios (manifest, íconos): lo guardado primero, actualizando en segundo plano.
  event.respondWith(
    caches.match(req).then(cached => {
      const fresh = fetch(req)
        .then(res => { caches.open(CACHE_NAME).then(c => c.put(req, res.clone())); return res; })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
