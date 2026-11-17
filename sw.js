/* Nexo ERP: guarda la app en el dispositivo para que abra sin señal.
   Los datos nunca se guardan aquí: las llamadas al sistema (script.google.com) siempre van a la red. */
const CACHE = 'nexo-0.15.0';
const SHELL = ['./', './index.html', './recibo.html', './contacto.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.indexOf('nexo-') === 0 && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/(^|\.)google\.com$|googleusercontent\.com$/.test(url.hostname)) return; // el sistema: siempre en vivo

  if (url.origin === self.location.origin) {
    // Primero la red (para recibir actualizaciones); sin señal, la copia guardada.
    e.respondWith(withTimeout(fetch(req), 6000).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
    return;
  }

  if (/fonts\.googleapis\.com$|fonts\.gstatic\.com$|cdn\.jsdelivr\.net$|fastly\.jsdelivr\.net$/.test(url.hostname)) {
    // Letras y el lector de códigos: la copia guardada primero.
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
