/* PAS 81 · Pàgina pública Avisos: activa, canvia o desactiva les notificacions del web en aquest dispositiu.
   La subscripció (adreça tècnica del navegador, claus i cursos; cap dada personal) es desa amb /api/avisos.
   El service worker (/sw.js) ja mostra els avisos i obre l'enllaç en fer-hi clic. */
(function () {
  'use strict';
  var T = {}; try { T = JSON.parse(document.getElementById('avText').textContent); } catch (e) { return; }
  var arrel = document.getElementById('avisos'); if (!arrel) return;
  var idioma = arrel.dataset.lang || 'ca';
  var $ = function (id) { return document.getElementById(id); };
  var B = { activa: $('avActiva'), desa: $('avDesa'), prova: $('avProva'), desactiva: $('avDesactiva') };
  var caselles = [].slice.call(arrel.querySelectorAll('input[name="curs"]'));
  var reg = null, sub = null, clau = '';

  function estat(k, tipus) {
    var e = $('avEstat'); e.innerHTML = T.estat[k] || k;
    e.className = 'av-estat' + (tipus ? ' av-estat--' + tipus : '');
  }
  function mostra(actiu) {
    B.activa.hidden = actiu; B.desa.hidden = !actiu; B.desactiva.hidden = !actiu; B.prova.hidden = !actiu;
  }
  function cap() { Object.keys(B).forEach(function (k) { B[k].hidden = true; }); }
  function ocupat(s) { Object.keys(B).forEach(function (k) { B[k].disabled = s; }); }
  function cursos() { return caselles.filter(function (c) { return c.checked; }).map(function (c) { return c.value; }); }
  function posaCursos(l) { caselles.forEach(function (c) { c.checked = (l || []).indexOf(c.value) >= 0; }); }
  function crida(accio, extra) {
    var s = sub && sub.toJSON ? sub.toJSON() : sub;
    return fetch('/api/avisos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify(Object.assign({ accio: accio, subscripcio: { endpoint: s.endpoint, keys: s.keys || {} } }, extra || {})) })
      .then(function (r) { return r.json(); });
  }
  // Clau pública VAPID (base64url) → bytes
  function bytes(b64) {
    var p = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  function limit(p, ms) { return Promise.race([p, new Promise(function (ok, ko) { setTimeout(function () { ko(new Error('temps')); }, ms); })]); }
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var instal = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  function inicia() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      cap(); return estat(ios && !instal ? 'ios' : 'noCompatible', 'avis');
    }
    if (Notification.permission === 'denied') { cap(); return estat('bloquejats', 'avis'); }
    fetch('/api/avisos', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok || !d.clau) { cap(); return estat('noDisponible', 'avis'); }
      clau = d.clau;
      return navigator.serviceWorker.getRegistration('/').then(function (r) { return r || navigator.serviceWorker.register('/sw.js', { scope: '/' }); })
        .then(function () { return limit(navigator.serviceWorker.ready, 15000); })   // si el service worker no s'instal·la, no s'espera per sempre
        .then(function (r) { reg = r; return r.pushManager.getSubscription(); })
        .then(function (s) {
          sub = s;
          if (!s) { mostra(false); return estat('inactius'); }
          return crida('estat').then(function (e) {
            if (e.ok && e.subscrit) { posaCursos(e.temes); mostra(true); estat('actius', 'ok'); }
            else { mostra(false); estat('inactius'); }   // el navegador hi és subscrit, però el centre no la té: es pot tornar a activar
          });
        });
    }).catch(function () { cap(); estat('error', 'avis'); });
  }

  B.activa.addEventListener('click', function () {
    ocupat(true);
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { ocupat(false); if (p === 'denied') { cap(); estat('bloquejats', 'avis'); } return; }
      return (sub ? Promise.resolve(sub) : reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(clau) }))
        .then(function (s) { sub = s; return crida('subscriu', { temes: cursos(), idioma: idioma }); })
        .then(function (r) { ocupat(false); if (!r.ok) return estat('error', 'avis'); posaCursos(r.temes); mostra(true); estat('desats', 'ok'); });
    }).catch(function () { ocupat(false); estat('error', 'avis'); });
  });
  B.desa.addEventListener('click', function () {
    ocupat(true);
    crida('subscriu', { temes: cursos(), idioma: idioma }).then(function (r) { ocupat(false); if (!r.ok) return estat('error', 'avis'); posaCursos(r.temes); estat('desats', 'ok'); })
      .catch(function () { ocupat(false); estat('error', 'avis'); });
  });
  B.desactiva.addEventListener('click', function () {
    ocupat(true);
    crida('baixa').catch(function () { /* si falla, el servidor l'esborrarà quan ja no existeixi */ })
      .then(function () { return sub ? sub.unsubscribe() : true; })
      .then(function () { sub = null; ocupat(false); posaCursos([]); mostra(false); estat('baixa'); })
      .catch(function () { ocupat(false); estat('error', 'avis'); });
  });
  // Avís de prova: el mostra el mateix navegador (no passa pel servidor ni arriba a ningú més)
  B.prova.addEventListener('click', function () {
    if (reg) reg.showNotification(T.provaTitol, { body: T.provaText, icon: '/assets/icones/icona-192.png', badge: '/assets/icones/favicon-32.png', data: { url: location.pathname }, lang: idioma });
  });

  inicia();
})();
