/* PAS 72 · Service worker del web de l'Institut Joan Miró (PWA).
   Criteri: NO canviar el funcionament del web. Tot es demana primer a la xarxa (com sempre); la memòria cau només
   serveix si no hi ha connexió. Mai no passen pel service worker: GESTIO, Programacions, les funcions (/api,
   /.netlify), els PDF, les peticions que no són GET ni les d'altres dominis.
   Si mai calgués desactivar-lo: substituïu aquest fitxer pel de «sw-desactiva» de LEGIR_GESTIO.md i publiqueu. */
var VERSIO = 'ijm-pas72-1';
var OFFLINE = '/offline.html';
var PRECARREGA = [OFFLINE, '/assets/icones/icona-192.png', '/favicon.ico'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSIO).then(function (c) { return c.addAll(PRECARREGA); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSIO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

var EXCLOSES = /^\/(gestio|programacions|api|\.netlify)(\/|$)/;
function fora(req, url) {
  return req.method !== 'GET' || url.origin !== self.location.origin || EXCLOSES.test(url.pathname) || /\.pdf$/i.test(url.pathname) || url.pathname === '/sw.js';
}
// Desa una còpia (només respostes completes i correctes)
function desa(req, res) {
  if (res && res.ok && res.type === 'basic') { var c = res.clone(); caches.open(VERSIO).then(function (cache) { cache.put(req, c); }); }
  return res;
}
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (fora(req, url)) return;   // el navegador ho fa com sempre
  // Pàgines, CSS, JS i dades: primer la xarxa; si falla, la còpia; si no n'hi ha, la pàgina «sense connexió»
  e.respondWith(fetch(req).then(function (res) { return desa(req, res); }).catch(function () {
    return caches.match(req).then(function (c) { return c || (req.mode === 'navigate' ? caches.match(OFFLINE) : Response.error()); });
  }));
});

// Notificacions (es faran servir quan s'activi el mòdul NOTIFICACIONS): mostra l'avís i, en fer-hi clic, obre l'enllaç
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titol: 'Institut Joan Miró', text: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titol || 'Institut Joan Miró', { body: d.text || '', icon: '/assets/icones/icona-192.png', badge: '/assets/icones/favicon-32.png', data: { url: d.url || '/' }, lang: 'ca' }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var u = (e.notification.data && e.notification.data.url) || '/';
  if (!/^\//.test(u)) u = '/';   // només enllaços del web
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) if (new URL(ws[i].url).pathname === u && 'focus' in ws[i]) return ws[i].focus();
    return self.clients.openWindow(u);
  }));
});
