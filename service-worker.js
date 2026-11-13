// Service worker de "Libro Finanzas Hogar".
// Guarda una copia de la cáscara de la app (HTML, manifest, íconos) para que abra
// rápido e instale como app. Las librerías (Firebase, html2canvas, jsPDF, xlsx) viven dentro de la app
// (carpeta vendor/) y se guardan acá para que todo abra aunque no haya internet.
// Los datos de los usuarios NO pasan por acá: van directo a Firebase.
//
// Si alguna vez hacés un cambio grande y querés forzar que todos bajen la
// versión nueva, cambiá el número de CACHE_NAME (ej: 'lfh-shell-v13').
const CACHE_NAME = 'lfh-shell-v29';
const SHELL = ['./', './index.html', './privacidad.html', './manifest.json', './vendor/html2canvas.min.js', './vendor/jspdf.umd.min.js', './vendor/xlsx.full.min.js', './vendor/firebase/firebase-app.js', './vendor/firebase/firebase-auth.js', './vendor/firebase/firebase-firestore.js', './vendor/firebase/firebase-app-check.js', './guia-libro-de-finanzas.pdf', './icon-192.png', './icon-512.png', './icon-maskable.png'];

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
    // Página principal: primero internet (para traer siempre la versión más nueva).
    // Si no hay conexión, o responde muy lento (4 s), se muestra la última copia guardada.
    event.respondWith(new Promise(resolve => {
      let done = false;
      const finish = r => { if (!done && r) { done = true; resolve(r); } };
      const t = setTimeout(() => { caches.match(req).then(finish); }, 4000);
      fetch(req).then(res => {
        clearTimeout(t);
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        finish(res);
      }).catch(() => {
        clearTimeout(t);
        caches.match(req).then(r => r || caches.match('./index.html')).then(r => { if (!done) { done = true; resolve(r || Response.error()); } });
      });
    }));
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
