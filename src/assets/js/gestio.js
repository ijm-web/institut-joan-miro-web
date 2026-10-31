/* =====================================================================
   GESTIO · àrea privada de gestió de l'Institut Joan Miró
   - Accés amb Google (funcions /api/gestio/login|api|sortir|config).
   - Portada amb una targeta per mòdul permès (nivell consulta, edició o admin).
   - Mòduls de dades (PROFESSORAT, ALUMNAT): graella (Tabulator) amb filtre ràpid i embut (selecció múltiple)
     a totes les columnes, edició a la cel·la,
     alta, estat (actiu, baixa laboral, substitut, baixa), «Desa els canvis» / «Descarta» (sense tornar al servidor),
     exportació a Excel/PDF, columnes visibles (amb Nom i 1r cognom fixats a l'esquerra),
     camps (admin). Els permisos es gestionen només des del mòdul EQUIPS I PERMISOS (PAS 27).
   - Mòdul EQUIPS (només admins globals): equips de gestió i docents, membres i matriu de permisos.
   - Dins d'un mòdul (ordinador), s'amaguen la barra d'idiomes, el menú i la foto: la graella s'ajusta a la finestra
     i només hi ha un scroll vertical, el de la graella (PAS 27).
   Qui pot fer què ho decideix l'Apps Script d'ijm_nucli_db; aquí només s'amaguen els botons.
   Les dades de cada mòdul es carreguen una vegada per sessió de pàgina (botó «Actualitza» per tornar-les a llegir).
   - PAS 28: mòdul PAS; alumnat amb nivell, grup anterior/actual i decisió final; selecció de files («Aplica a la selecció»),
     tancament de curs i alta massiva per fitxer (plantilla Excel → previsualització → altes sense desar a la graella).
   Rutes: #  ·  #professorat  ·  #alumnat  ·  #pas  ·  #equips
   ===================================================================== */
(function () {
  'use strict';
  var API = '/api/gestio/';
  var $ = function (id) { return document.getElementById(id); };
  var LIBS = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
  };
  var NIVELLS = ['consulta', 'edicio', 'admin'];
  var NOM_NIVELL = { consulta: 'Consulta', edicio: 'Edició', admin: 'Administració' };
  var TIPUS = { text: 'Text', numero: 'Número', data: 'Data', llista: 'Llista', si_no: 'Sí / no', correu: 'Correu', nif: 'NIF / NIE', calculat: 'Calculat' };

  var MISSATGES = {
    domini_no_permes: 'Cal entrar amb un compte @institutjoanmiro.cat.',
    sense_acces: 'Aquest compte no té accés a GESTIO. Si creieu que és un error, parleu amb la direcció.',
    sense_permis: 'No teniu permís per fer aquesta acció.',
    google_token_invalid: 'No s’ha pogut validar l’inici de sessió amb Google. Torneu-ho a provar.',
    google_no_configurat: 'L’accés encara no està configurat.',
    sessio_no_valida: 'La sessió ha caducat. Torneu a entrar.',
    error_servidor: 'Hi ha hagut un error. Torneu-ho a provar d’aquí a una estona.',
    tancat: 'GESTIO està tancat: podeu consultar, però no desar.',
    conflicte: 'Algú altre ha desat aquestes dades mentre les editàveu.',
    validacio: 'Hi ha dades que no són vàlides.',
    equips_no_permes: 'Només la direcció pot canviar els equips d’una persona.',
    camp_no_es_pot_treure: 'Un camp no es pot treure: desmarqueu «Actiu» per arxivar-lo (les dades es conserven).',
    clau_invalida: 'La clau d’un camp ha de començar per una lletra i només pot tenir minúscules, xifres i _.',
    clau_repetida: 'Hi ha dos camps amb la mateixa clau.',
    nom_buit: 'Cal un nom.',
    nivell_no_permes: 'No podeu donar ni treure aquest nivell a aquest equip.',
    id_equip_invalid: 'El codi d’un equip ha de ser EQ- i lletres o xifres (p. ex. EQ-1ESO).',
    id_equip_repetit: 'Hi ha dos equips amb el mateix codi.',
    equip_no_es_pot_treure: 'Un equip no es pot treure: marqueu-lo com a inactiu.',
    massa_canvis: 'Hi ha massa canvis per desar d’una vegada (màxim 500).',
    gestio_no_configurat: 'Falten les variables GESTIO_SCRIPT_URL i GESTIO_SCRIPT_SECRET a Netlify.',
    gestio_url_invalida: 'No es pot connectar amb l’adreça de GESTIO_SCRIPT_URL (ha d’acabar en /exec).',
    gestio_resposta_invalida: 'L’Apps Script d’ijm_nucli_db no respon com a aplicació web. Reviseu el desplegament («Qualsevol», «Executa com a: Jo»).',
    gestio_no_autoritzat: 'El secret no coincideix: GESTIO_SCRIPT_SECRET (Netlify) ha de ser igual que GESTIO_SECRET (Apps Script).',
    gestio_accio_desconeguda: 'L’Apps Script d’ijm_nucli_db no és la versió d’aquest web: enganxeu-hi el Code.gs i desplegueu una versió nova.',
    gestio_error_script: 'Hi ha hagut un error dins de l’Apps Script d’ijm_nucli_db.',
    eq_dir_protegit: 'L’administració global de l’equip directiu no es pot treure des del web (es canvia directament al full).',
    db_alumnat_no_configurat: 'Encara no s’ha indicat el full ijm_alumnat_db (config › db_alumnat a ijm_nucli_db).',
    pendents: 'Hi ha alumnes sense «Decisió final». Cal decidir-los tots abans de tancar el curs.',
    nivell_no_existeix: 'Hi ha alumnes que promocionen a un nivell que encara no és al mòdul.',
    sense_nivell: 'Hi ha alumnes sense nivell.',
    curs_canviat: 'Algú altre ja ha tancat el curs. Actualitzeu les dades.',
    curs_invalid: 'El curs de config › curs no té el format aaaa-aaaa.'
  };
  var ERRORS_CAMP = {
    obligatori: 'és obligatori', massa_llarg: 'és massa llarg', numero_invalid: 'ha de ser un número', data_invalida: 'ha de ser una data',
    si_no_invalid: 'ha de ser sí o no', correu_invalid: 'no és un correu vàlid', correu_domini: 'ha de ser un correu ', valor_no_permes: 'no és un dels valors de la llista',
    repetit: 'està repetit (ja el té una altra persona)', no_existeix: 'aquesta fila ja no existeix',
    nif_invalid: 'no és un DNI o NIE vàlid (8 xifres i lletra, o X/Y/Z, 7 xifres i lletra)',
    no_aplica_1r: 'no s’omple a 1r d’ESO (el grup anterior, només si repeteix 1r)', grup_nivell: 'no és del nivell de l’alumne (p. ex. 2n ESO → 2n ESO A…)', estat_nivell: 'no és possible per al nivell del grup (1r: alumne extern, repeteix 1r o baixa; 2n: promociona, repeteix 2n, alumne extern o baixa)'
  };
  var text = function (c) { return MISSATGES[c] || MISSATGES.error_servidor; };
  var PAPERERA = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
  var FIXADES = ['nom', 'cognom1'];   // columnes bloquejades a l'esquerra per defecte
  var copia = function (f) { var o = Object.assign({}, f); if (Array.isArray(o.equips)) o.equips = o.equips.slice(); return o; };
  var deBaixa = function (d) { return d.estat === 'baixa'; };
  var nomComplet = function (d) { return [d.nom, d.cognom1, d.cognom2].filter(Boolean).join(' '); };
  var ordenaCognoms = function (a, b) { var k = function (d) { return [d.cognom1, d.cognom2, d.nom].map(function (x) { return String(x || '').toLowerCase(); }).join(' '); }; return k(a).localeCompare(k(b), 'ca'); };
  // Comprovació a la cel·la (la mateixa que fa l'Apps Script en desar): retorna el codi d'error o ''
  function nifValid(x) {
    var m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(x);
    if (!m || (m[1] && m[2].length !== 7) || (!m[1] && m[2].length !== 8)) return false;
    var n = Number(({ X: '0', Y: '1', Z: '2' }[m[1]] || '') + m[2]);
    return 'TRWAGMYFPDXBNJZSQVHLCKE'.charAt(n % 23) === m[3];
  }
  function dataValida(x) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x); if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  // Regles entre camps (les mateixes que l'Apps Script). ALUMNAT: camp «nivell» (si és buit, el del grup actual).
  var NIVELLS_ESO = ['1r ESO', '2n ESO', '3r ESO', '4t ESO'];
  var nivellDeGrup = function (g) { g = String(g || ''); for (var i = 0; i < NIVELLS_ESO.length; i++) if (g.indexOf(NIVELLS_ESO[i]) === 0) return NIVELLS_ESO[i]; return ''; };
  var nivellAlumne = function (d) { return NIVELLS_ESO.indexOf(nivellDeGrup(d.nivell || d.grup_actual)) + 1; };
  var ESTATS_NIVELL = { 1: ['alumne extern', 'repeteix 1r', 'baixa'], 2: ['promociona', 'repeteix 2n', 'alumne extern', 'baixa'] };
  var NOMES_2N = ['optativa_2n'];   // camps que no s'omplen a 1r d'ESO (i el grup anterior, si no repeteix)
  var senseGrupAnterior = function (d) { return nivellAlumne(d) === 1 && d.estat !== 'repeteix 1r'; };
  var REGLES = {
    alumnat: function (d) {
      var n = nivellAlumne(d);
      if (d.nivell && String(d.grup_actual || '').trim() && String(d.grup_actual).indexOf(d.nivell) !== 0) return { error: 'grup_nivell', camp: 'grup_actual' };
      if (n === 1) {
        if (String(d.grup_anterior || '').trim() && d.estat !== 'repeteix 1r') return { error: 'no_aplica_1r', camp: 'grup_anterior' };
        for (var i = 0; i < NOMES_2N.length; i++) if (String(d[NOMES_2N[i]] || '').trim()) return { error: 'no_aplica_1r', camp: NOMES_2N[i] };
        if (d.estat && ESTATS_NIVELL[1].indexOf(d.estat) < 0) return { error: 'estat_nivell', camp: 'estat' };
      }
      if (n === 2 && d.estat === 'repeteix 1r') return { error: 'estat_nivell', camp: 'estat' };
      return null;
    }
  };
  var regla = function (d) { return S.modul && REGLES[S.modul.id] ? REGLES[S.modul.id](d) : null; };
  function errorCel(c, v) {
    var x = String(v == null ? '' : v).trim();
    if (c.obligatori && !x) return 'obligatori';
    if (!x) return '';
    if (c.tipus === 'numero' && isNaN(Number(x.replace(',', '.')))) return 'numero_invalid';
    if (c.tipus === 'data' && !dataValida(x)) return 'data_invalida';
    if (c.tipus === 'nif' && !nifValid(x.toUpperCase().replace(/[\s.\-]/g, ''))) return 'nif_invalid';
    if (c.tipus === 'correu') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) return 'correu_invalid';
      if (c.valors && c.valors.charAt(0) === '@' && x.toLowerCase().slice(-c.valors.length) !== c.valors.toLowerCase()) return 'correu_domini';
    }
    if (c.tipus === 'llista' && c.valors && c.valors.split('|').map(function (o) { return o.trim(); }).indexOf(x) < 0) return 'valor_no_permes';
    return '';
  }

  // ------------------------------------------------------------------ utilitats
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function carregaScript(url) {
    carregaScript.p = carregaScript.p || {};
    if (!carregaScript.p[url]) carregaScript.p[url] = new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
    return carregaScript.p[url];
  }
  function toast(m, error) {
    var t = $('gsToast'); t.textContent = m; t.className = 'prog-toast' + (error ? ' prog-toast--error' : ''); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, error ? 7000 : 3000);
  }
  function pregunta(titol, html, botons, petita) {
    return new Promise(function (resol) {
      $('gsModalTitol').textContent = titol; $('gsModalText').innerHTML = html;
      $('gsModal').querySelector('.gs-modal__box').classList.toggle('gs-modal--petita', petita !== false);
      var caixa = $('gsModalBtns'); caixa.innerHTML = '';
      function tanca(v) { $('gsModal').hidden = true; document.removeEventListener('keydown', tecla); resol(v); }
      function tecla(e) { if (e.key === 'Escape') tanca(null); }
      botons.forEach(function (b) {
        var el = document.createElement('button'); el.type = 'button';
        el.className = 'prog-btn' + (b.tipus ? ' prog-btn--' + b.tipus : ''); el.textContent = b.t;
        el.addEventListener('click', function () { if (b.abans && b.abans() === false) return; tanca(b.valor); });
        caixa.appendChild(el);
      });
      document.addEventListener('keydown', tecla);
      $('gsModal').hidden = false;
      var primer = caixa.querySelector('.prog-btn:not(.prog-btn--ghost)') || caixa.querySelector('button'); if (primer) primer.focus();
    });
  }
  function api(accio, cos, progres) {
    var crida = fetch(API + 'api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
      body: JSON.stringify(Object.assign({ accio: accio }, cos || {})) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'error_servidor' }; }).then(function (d) { d.status = r.status; if (r.status === 401) avisSessio(); return d; }); })
      .catch(function () { return { ok: false, error: 'error_servidor' }; });
    return progres && window.Progres ? Progres.amb(crida, progres) : crida;
  }
  function textError(d) { var c = d && d.error || 'error_servidor'; return esc(text(c)) + '<small class="prog-avis__codi">' + esc([c, d && d.detall].filter(Boolean).join(' · ')) + '</small>'; }
  var guarda = {
    llegeix: function (k) { try { return JSON.parse(localStorage.getItem('gestio|' + k) || 'null'); } catch (e) { return null; } },
    desa: function (k, v) { try { localStorage.setItem('gestio|' + k, JSON.stringify(v)); } catch (e) { /* sense localStorage */ } }
  };
  var nivellIdx = function (n) { return NIVELLS.indexOf(n); };

  // ------------------------------------------------------------------ estat
  var S = { sessio: null, modul: null, d: null, taula: null, canvis: {}, altes: {}, nTmp: 0, brut: false, baixes: false, cache: {} };

  // ------------------------------------------------------------------ accés
  function missatgeLogin(c) { var m = $('gsMsg'); m.textContent = text(c); m.hidden = false; }
  function mostraLogin() {
    $('gsCarregant').hidden = true; $('gsAcces').hidden = false; $('gsApp').hidden = true; $('gsLogin').hidden = false;
    if (mostraLogin.fet) return; mostraLogin.fet = true;
    fetch(API + 'config').then(function (r) { return r.json(); }).then(function (c) {
      if (!c.ok || !c.google_client_id) return missatgeLogin('google_no_configurat');
      carregaScript('https://accounts.google.com/gsi/client').then(function () {
        google.accounts.id.initialize({ client_id: c.google_client_id, callback: entra, hd: c.domini, ux_mode: 'popup' });
        google.accounts.id.renderButton($('gsGoogle'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ca' });
      });
    }).catch(function () { missatgeLogin('error_servidor'); });
  }
  function entra(resp) {
    $('gsMsg').hidden = true;
    var p = fetch(API + 'login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ credential: resp.credential }) })
      .then(function (r) { return r.json(); });
    (window.Progres ? Progres.amb(p, 'Comprovant l’accés…') : p).then(function (d) { if (d.ok) obreApp(d); else missatgeLogin(d.error); })
      .catch(function () { missatgeLogin('error_servidor'); });
  }
  function comprova() {
    api('inici').then(function (d) {
      if (d.ok) return obreApp(d);
      if (d.status === 401) return mostraLogin();
      mostraLogin(); missatgeLogin(d.error);
    });
  }
  function avisSessio() {
    if (avisSessio.fet || !S.sessio) return; avisSessio.fet = true;
    pregunta('La sessió ha caducat', '<p>Per seguretat, la sessió dura 8 hores. Torneu a entrar per continuar.</p>' + (S.brut ? '<p><strong>Atenció:</strong> els canvis sense desar es perdran.</p>' : ''),
      [{ t: 'Torna a entrar', valor: 1 }]).then(function () { S.brut = false; location.reload(); });
  }
  function obreApp(d) {
    S.sessio = d;
    $('gsAcces').hidden = true; $('gsApp').hidden = false;
    $('gsUsuari').textContent = (d.nom ? d.nom + ' · ' : '') + d.email + (d.admin_global ? ' · direcció' : '');
    pintaPortada(); encamina();
  }
  $('gsSortir').addEventListener('click', function () {
    var surt = function () { fetch(API + 'sortir', { method: 'POST', credentials: 'same-origin' }).then(function () { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); S.brut = false; location.hash = ''; location.reload(); }); };
    if (!S.brut) return surt();
    pregunta('Hi ha canvis sense desar', '<p>Si sortiu ara, es perdran.</p>', [{ t: 'Continua editant', valor: 0, tipus: 'ghost' }, { t: 'Surt igualment', valor: 1, tipus: 'danger' }]).then(function (v) { if (v) surt(); });
  });
  window.addEventListener('beforeunload', function (e) { if (S.brut) { e.preventDefault(); e.returnValue = ''; } });

  // ------------------------------------------------------------------ portada i rutes
  var ICONES = {
    professorat: '<svg class="prog-apartat__icon" aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="16" r="6"/><path d="M6 38c0-7 5-12 12-12s12 5 12 12"/><rect x="30" y="18" width="13" height="18" rx="2"/><path class="prog-apartat__acc" d="M33 24h7M33 29h7M33 34h4"/></svg>',
    alumnat: '<svg class="prog-apartat__icon" aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18 24 9l20 9-20 9z"/><path d="M12 22v9c0 3 5 6 12 6s12-3 12-6v-9"/><path class="prog-apartat__acc" d="M44 18v11"/></svg>',
    pas: '<svg class="prog-apartat__icon" aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="15" r="6"/><path d="M5 38c0-7 5-12 12-12s12 5 12 12"/><path d="M30 24h13v14H30z"/><path class="prog-apartat__acc" d="M34 24v-3h5v3M30 30h13"/></svg>',
    equips: '<svg class="prog-apartat__icon" aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="17" r="5"/><circle cx="32" cy="17" r="5"/><path d="M6 36c0-6 4-10 10-10s10 4 10 10"/><path d="M22 36c0-6 4-10 10-10s10 4 10 10"/><path class="prog-apartat__acc" d="M24 6v6M21 9h6"/></svg>'
  };
  function pintaPortada() {
    $('gsModuls').innerHTML = S.sessio.moduls.map(function (m) {
      return '<a class="prog-apartat" href="#' + esc(m.id) + '">' + (ICONES[m.id] || ICONES.professorat) +
        '<span class="gs-tag gs-tag--' + esc(m.nivell) + '">' + esc(NOM_NIVELL[m.nivell] || m.nivell) + '</span>' +
        '<span class="prog-apartat__nom">' + esc(m.nom) + '</span>' +
        '<span class="prog-apartat__txt">' + esc(m.descripcio || '') + '</span>' +
        '<span class="prog-apartat__cta">Obre <span aria-hidden="true">→</span></span></a>';
    }).join('');
  }
  var hashAnterior = location.hash;
  window.addEventListener('hashchange', function () {
    if (!S.sessio) return;
    if (S.brut && location.hash !== hashAnterior) {
      var desti = location.hash; history.replaceState(null, '', hashAnterior || '#');
      pregunta('Hi ha canvis sense desar', '<p>Voleu sortir sense desar els canvis?</p>', [{ t: 'Continua editant', valor: 0, tipus: 'ghost' }, { t: 'Surt sense desar', valor: 1, tipus: 'danger' }])
        .then(function (v) { if (v) { S.brut = false; location.hash = desti; } });
      return;
    }
    encamina();
  });
  function encamina() {
    var h = location.hash.replace(/^#/, '');
    hashAnterior = location.hash;
    $('gsInici').hidden = true; $('gsModul').hidden = true; $('gsCrumbModul').hidden = true;
    var m = S.sessio.moduls.filter(function (x) { return x.id === h; })[0];
    document.body.classList.toggle('gs-en-modul', !!m);
    if (m) { window.scrollTo(0, 0); obreModul(m); } else { $('gsInici').hidden = false; if (h) history.replaceState(null, '', location.pathname); window.scrollTo({ top: $('gsApp').offsetTop - 90, behavior: 'smooth' }); }
  }
  $('gsCrumbInici').addEventListener('click', function (e) { e.preventDefault(); location.hash = ''; });

  // Alçada de la graella: la finestra menys el que hi ha a sobre (eines, barra de desar). Així la pàgina no fa scroll
  // i només en fa la graella. Al mòbil (fitxes) i fora dels mòduls, alçada fixa.
  var esMobil = function () { return window.matchMedia('(max-width: 760px)').matches; };
  function alcada() {
    if (esMobil() || !document.body.classList.contains('gs-en-modul')) return 'min(72vh, 760px)';
    var top = $('gsTaula').getBoundingClientRect().top + window.scrollY;
    return Math.max(280, Math.floor(window.innerHeight - top - 14)) + 'px';
  }
  function ajustaAlcada() {
    var h = alcada();
    if (S.taula) { try { S.taula.setHeight(h); } catch (e) { /* encara no construïda */ } }
    var mx = document.querySelector('.gs-matriu'); if (mx) mx.style.maxHeight = h;
  }
  var tempsResize = 0;
  window.addEventListener('resize', function () { clearTimeout(tempsResize); tempsResize = setTimeout(ajustaAlcada, 120); });

  // Tabulator deixa al contenidor l'alçada i les classes: es netegen perquè la matriu de permisos no hereti la caixa
  function destrueixTaula() {
    if (S.taula) { try { S.taula.destroy(); } catch (e) { /* ja destruïda */ } S.taula = null; }
    var t = $('gsTaula'); t.removeAttribute('style'); t.removeAttribute('role'); t.removeAttribute('tabulator-layout'); t.className = 'gs-taula';
  }
  function obreModul(m) {
    tancaPopovers();
    S.modul = m; S.canvis = {}; S.altes = {}; S.brut = false;
    $('gsModul').hidden = false; $('gsCrumbModul').hidden = false; $('gsCrumbModulNom').textContent = m.nom;
    $('gsModulKicker').textContent = 'Mòdul'; $('gsModulTitol').textContent = m.nom.toUpperCase();
    $('gsNivell').innerHTML = 'El vostre nivell: <span class="gs-tag gs-tag--' + esc(m.nivell) + '">' + esc(NOM_NIVELL[m.nivell]) + '</span>';
    $('gsAvis').hidden = true; $('gsEines').innerHTML = ''; $('gsTaula').innerHTML = ''; $('gsMobil').hidden = true; $('gsBarra').hidden = true;
    destrueixTaula();
    if (m.id === 'equips') return carregaEquips();
    // Les dades ja llegides en aquesta pàgina es reutilitzen: tornar al mòdul no torna a cridar el full
    if (S.cache[m.id]) return mostraDades(S.cache[m.id]);
    carregaDades();
  }

  // ------------------------------------------------------------------ mòdul de dades (PROFESSORAT)
  function carregaDades() {
    return api('dades', { modul: S.modul.id }, 'Carregant ' + S.modul.nom.toLowerCase() + '…').then(function (d) {
      if (!d.ok) { $('gsAvis').innerHTML = textError(d); $('gsAvis').hidden = false; return; }
      S.cache[S.modul.id] = d;
      mostraDades(d);
    });
  }
  function mostraDades(d) {
    destrueixTaula();
    S.d = d; S.canvis = {}; S.altes = {}; marcaBrut(false);
    $('gsAvis').hidden = true;
    if (!d.obert && nivellIdx(d.nivell) >= 1) { $('gsAvis').textContent = text('tancat'); $('gsAvis').hidden = false; }
    pintaEines(); pintaTaula();
  }
  var potEditar = function () { return S.d && nivellIdx(S.d.nivell) >= 1 && S.d.obert; };
  var esAdmin = function () { return S.d && S.d.nivell === 'admin'; };
  var editable = function (c) { return potEditar() && c.tipus !== 'calculat' && c.origen !== 'clickedu'; };
  // Per fila: a l'alumnat de 1r no s'editen els camps que només són de 2n
  var editableFila = function (c, d) {
    if (!editable(c)) return false;
    if (S.modul.id !== 'alumnat') return true;
    if (nivellAlumne(d) === 1 && NOMES_2N.indexOf(c.clau) >= 0) return false;
    return !(c.clau === 'grup_anterior' && senseGrupAnterior(d));
  };

  function pintaEines() {
    var ed = potEditar();
    $('gsEines').innerHTML =
      '<label class="gs-check"><input type="checkbox" id="gsBaixes"' + (S.baixes ? ' checked' : '') + '> Mostra també les baixes</label>' +
      '<span class="gs-compte" id="gsCompte"></span>' +
      (ed ? '<span class="gs-seleccio" id="gsSeleccio" hidden><span id="gsSelN"></span> <button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="aplica-seleccio">Aplica a la selecció…</button> <button type="button" class="gs-enllac" data-accio="treu-seleccio">Treu la selecció</button></span>' : '') +
      '<span class="gs-espai"></span>' +
      (ed ? '<button type="button" class="prog-btn" data-accio="alta">+ Afegeix ' + esc(S.d.nom_fila || 'fila') + '</button>' : '') +
      (ed ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="importa" title="Alta massiva a partir d’un fitxer Excel o CSV">Importa fitxer</button>' : '') +
      (ed && S.modul.id === 'alumnat' && S.d.camps.some(function (c) { return c.clau === 'decisio_final'; }) ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="tancament" title="Promocions, repeticions i baixes de final de curs">Tancament de curs</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Visualització camps</button>' +
      (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="camps">Gestió camps</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="recarrega" title="Torna a llegir les dades del full">Actualitza</button>' +
      '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button></span>';
    $('gsBaixes').addEventListener('change', function () { S.baixes = this.checked; aplicaFiltre(); });
  }

  // Valors calculats (els mateixos que fa l'Apps Script en desar): «nom cognom1 cognom2», «cognom1 cognom2, nom»
  function calcula(c, v) {
    return String(c.valors || '').replace(/[a-z_0-9]+/g, function (k) { return String(v[k] == null ? '' : v[k]).trim(); })
      .replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
  }
  function editorDe(c) {
    if (c.tipus === 'numero') return { editor: 'number' };
    if (c.tipus === 'data') return { editor: 'date' };
    if (c.tipus === 'llista') { var ops = c.valors.split('|').map(function (s) { return s.trim(); }); return { editor: 'list', editorParams: { values: c.obligatori ? ops : [''].concat(ops), clearable: !c.obligatori } }; }
    if (c.tipus === 'si_no') return { editor: 'list', editorParams: { values: { 'sí': 'sí', '': '—' } } };
    return { editor: 'input' };
  }
  // Filtres de capçalera (PAS 27: a TOTS els camps). Cada columna té una casella de filtre ràpid (text) i, al costat,
  // l'embut ⛉ que obre una caixa amb tots els valors (selecció múltiple) i els botons Tots, Cap, Cancel·la i Accepta.
  // Llistes i sí/no: els valors previstos. Altres camps: els valors diferents que hi ha a la graella en obrir l'embut.
  // Valor del filtre: { t: text, s: [valors marcats] o null (= tots) }
  var BUIT = { v: '', t: '(buit)' };
  function valorsDiferents(camp) {
    var vist = {}, buit = false;
    (S.taula ? S.taula.getData() : S.d.files).forEach(function (d) { var v = d[camp] == null ? '' : String(d[camp]).trim(); if (v === '') buit = true; else vist[v] = 1; });
    return Object.keys(vist).sort(function (a, b) { return a.localeCompare(b, 'ca', { numeric: true }); }).map(function (x) { return { v: x, t: x }; }).concat(buit ? [BUIT] : []);
  }
  function filtreDe(c) {
    var opts = c.tipus === 'si_no' ? function () { return [{ v: 'sí', t: 'sí' }, { v: '', t: 'no' }]; }
      : c.tipus === 'llista' ? function () { return c.valors.split('|').map(function (x) { x = x.trim(); return { v: x, t: x }; }).concat([BUIT]); }
      : function () { return valorsDiferents(c.clau); };
    var norm = function (v) { v = v == null ? '' : String(v).trim(); return c.tipus === 'si_no' ? (v === 'sí' ? 'sí' : '') : v; };
    return {
      headerFilter: function (cell, onRendered, success) { return filtreMultiple(c.nom, opts, success, cell.getValue()); },
      headerFilterLiveFilter: false,   // si no, Tabulator escolta el keyup del contenidor i esborra el filtre ràpid
      headerFilterFunc: function (f, v) {
        if (f.s && f.s.indexOf(norm(v)) < 0) return false;
        if (f.t && String(v == null ? '' : v).toLowerCase().indexOf(f.t.toLowerCase()) < 0) return false;
        return true;
      },
      headerFilterEmptyCheck: function (f) { return !f || (!f.t && !f.s); }
    };
  }
  // Columna Equips (llista de codis): l'embut tria equips; el filtre ràpid busca pel codi o pel nom
  function filtreEquips() {
    var opts = function () { return (S.d.equips || []).map(function (e) { return { v: e.id, t: e.nom }; }).concat([{ v: '', t: '(cap equip)' }]); };
    return {
      headerFilter: function (cell, onRendered, success) { return filtreMultiple('Equips', opts, success); },
      headerFilterLiveFilter: false,
      headerFilterFunc: function (f, v) {
        v = v || [];
        if (f.s && !(v.length ? v.some(function (e) { return f.s.indexOf(e) >= 0; }) : f.s.indexOf('') >= 0)) return false;
        if (f.t) { var t = f.t.toLowerCase(); if (!v.some(function (e) { return e.toLowerCase().indexOf(t) >= 0 || nomEquip(e).toLowerCase().indexOf(t) >= 0; })) return false; }
        return true;
      },
      headerFilterEmptyCheck: function (f) { return !f || (!f.t && !f.s); }
    };
  }
  function filtreMultiple(nomCol, opcions, success, inicial) {
    var st = { t: (inicial && inicial.t) || '', s: inicial && inicial.s ? inicial.s.slice() : null }, opts = [];
    var caixa = document.createElement('div'); caixa.className = 'gs-filtre';
    caixa.innerHTML = '<input type="search" placeholder="Filtra…" aria-label="Filtre ràpid de ' + esc(nomCol) + '">' +
      '<button type="button" class="gs-filtre__embut" title="Tria diversos valors" aria-label="Tria diversos valors de ' + esc(nomCol) + '">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/></svg></button>';
    var inp = caixa.querySelector('input'), emb = caixa.querySelector('button');
    if (st.t) inp.value = st.t; if (st.s) emb.classList.add('is-actiu');
    var envia = function () { emb.classList.toggle('is-actiu', !!st.s); success({ t: st.t, s: st.s ? st.s.slice() : null }); };
    inp.addEventListener('input', function () { st.t = inp.value.trim(); envia(); });
    ['mousedown', 'click', 'keydown', 'keyup', 'search'].forEach(function (ev) { caixa.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    emb.addEventListener('click', function () { obrePopover(); });
    function obrePopover() {
      tancaPopovers();
      opts = opcions();
      // Un valor marcat que ja no existeix es conserva perquè el filtre no canviï sol
      if (st.s) st.s.forEach(function (v) { if (!opts.some(function (o) { return o.v === v; })) opts.push({ v: v, t: v || '(buit)' }); });
      var pop = document.createElement('div'); pop.className = 'gs-popover'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Filtre de ' + nomCol);
      pop.innerHTML = '<p class="gs-popover__tit">' + esc(nomCol) + '</p>' +
        (opts.length > 12 ? '<input type="search" class="gs-popover__cerca" placeholder="Cerca un valor…" aria-label="Cerca un valor">' : '') +
        '<div class="gs-popover__llista">' + opts.map(function (o, i) {
        var marcat = !st.s || st.s.indexOf(o.v) >= 0;
        return '<label data-t="' + esc(String(o.t).toLowerCase()) + '"><input type="checkbox" data-i="' + i + '"' + (marcat ? ' checked' : '') + '> ' + esc(o.t) + '</label>';
      }).join('') + '</div><div class="gs-popover__btns"><button type="button" data-b="tots">Tots</button><button type="button" data-b="cap">Cap</button>' +
        '<span></span><button type="button" data-b="cancel">Cancel·la</button><button type="button" data-b="ok" class="is-primari">Accepta</button></div>';
      document.body.appendChild(pop);
      var rc = emb.getBoundingClientRect();
      pop.style.top = (window.scrollY + rc.bottom + 6) + 'px';
      pop.style.left = Math.max(8, Math.min(window.scrollX + rc.right - pop.offsetWidth, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8)) + 'px';
      var caselles = pop.querySelectorAll('input[type=checkbox]'), cercaPop = pop.querySelector('.gs-popover__cerca');
      // Tots i Cap actuen sobre els valors visibles (si s'ha fet servir la cerca de la caixa)
      if (cercaPop) cercaPop.addEventListener('input', function () { var t = cercaPop.value.trim().toLowerCase(); caselles.forEach(function (x) { var l = x.parentNode; l.hidden = !!t && l.dataset.t.indexOf(t) < 0; }); });
      pop.addEventListener('click', function (e) {
        var bt = e.target.closest('button[data-b]'); if (!bt) return;
        if (bt.dataset.b === 'tots' || bt.dataset.b === 'cap') caselles.forEach(function (x) { if (!x.parentNode.hidden) x.checked = bt.dataset.b === 'tots'; });
        if (bt.dataset.b === 'cancel') tancaPopovers();
        if (bt.dataset.b === 'ok') {
          var sel = [].filter.call(caselles, function (x) { return x.checked; }).map(function (x) { return opts[+x.dataset.i].v; });
          st.s = sel.length === opts.length ? null : sel;   // tots marcats = sense filtre
          tancaPopovers(); envia();
        }
      });
      setTimeout(function () { document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc_); }, 0);
      function fora(e) { if (!pop.contains(e.target) && e.target !== emb && !emb.contains(e.target)) tancaPopovers(); }
      function esc_(e) { if (e.key === 'Escape') tancaPopovers(); }
      pop._tanca = function () { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc_); };
      var primer = pop.querySelector('input'); if (primer) primer.focus();
    }
    return caixa;
  }
  function tancaPopovers() { document.querySelectorAll('.gs-popover').forEach(function (p) { if (p._tanca) p._tanca(); p.remove(); }); }
  function nomEquip(id) { var e = (S.d.equips || []).filter(function (x) { return x.id === id; })[0]; return e ? e.nom : id; }
  function columnes() {
    var ed = potEditar(), adm = esAdmin();
    var cols = [];
    // Selecció de files (casella) per aplicar un mateix valor a moltes files: p. ex. «Decisió final» d'un grup sencer
    if (ed) cols.push({ formatter: 'rowSelection', titleFormatter: 'rowSelection', titleFormatterParams: { rowRange: 'active' }, field: '_sel', frozen: true,
      headerSort: false, download: false, width: 44, minWidth: 44, resizable: false, hozAlign: 'center', headerHozAlign: 'center', cssClass: 'gs-sel', cellClick: function (e, cell) { if (e.target.tagName !== 'INPUT') cell.getRow().toggleSelect(); } });
    if (ed) cols.push({ title: '', field: '_acc', frozen: true, headerSort: false, download: false, width: adm ? 118 : 92, cssClass: 'gs-accions',
      formatter: function (cell) {
        var r = cell.getRow().getData();
        return '<span class="gs-acc">' + (deBaixa(r) ? '<button type="button" data-a="reactiva">Reactiva</button>' : '<button type="button" data-a="baixa">Baixa</button>') +
          (adm || String(r.id).indexOf('nou-') === 0 ? '<button type="button" class="gs-perill gs-paperera" data-a="esborra" title="Esborra del tot" aria-label="Esborra del tot">' + PAPERERA + '</button>' : '') + '</span>';
      },
      cellClick: function (e, cell) { var b = e.target.closest('button[data-a]'); if (b) accioFila(b.dataset.a, cell.getRow()); } });
    // El codi intern (PRO-…, ALU-…) no es mostra: és l'índex de cada fila. Nom i 1r cognom, fixats a l'esquerra.
    var camps = S.d.camps.filter(function (c) { return FIXADES.indexOf(c.clau) >= 0; }).concat(S.d.camps.filter(function (c) { return FIXADES.indexOf(c.clau) < 0; }));
    camps.forEach(function (c) {
      var col = Object.assign({ title: c.nom + (c.obligatori && editable(c) ? ' *' : ''), field: c.clau, minWidth: 90, maxWidth: 360,
        editable: editable(c), cssClass: c.tipus === 'calculat' ? 'gs-calc' : (c.origen === 'clickedu' ? 'gs-ck' : ''),
        tooltip: c.tipus === 'calculat' ? 'Es calcula sol' : (c.origen === 'clickedu' ? 'Ve de Clickedu: no s’edita aquí' : false) }, filtreDe(c));
      if (FIXADES.indexOf(c.clau) >= 0) col.frozen = true;
      if (editable(c)) {
        Object.assign(col, editorDe(c));
        col.editable = function (cell) { return editableFila(c, cell.getRow().getData()); };
        // Estat de l'alumnat: només els valors possibles per al nivell del grup
        if (S.modul.id === 'alumnat' && c.clau === 'estat') col.editorParams = function (cell) { var n = nivellAlumne(cell.getRow().getData()); var ops = c.valors.split('|').map(function (x) { return x.trim(); }); return { values: n ? ops.filter(function (o) { return ESTATS_NIVELL[n].indexOf(o) >= 0 || ESTATS_NIVELL[1].concat(ESTATS_NIVELL[2]).indexOf(o) < 0; }) : ops }; };
        if (S.modul.id === 'alumnat' && NOMES_2N.indexOf(c.clau) >= 0) col.cssClass = 'gs-nomes2n';
        if (S.modul.id === 'alumnat' && c.clau === 'grup_anterior') col.cssClass = 'gs-ant';
      }
      if (c.clau === 'estat') col.formatter = function (cell) { var v = cell.getValue() || ''; return v ? '<span class="gs-estat gs-estat--' + esc(v.replace(/\s+/g, '-')) + '">' + esc(v) + '</span>' : ''; };
      if (c.tipus === 'si_no') col.formatter = function (cell) { return cell.getValue() === 'sí' ? '<span class="gs-si">sí</span>' : ''; };
      if (c.tipus === 'numero') { col.hozAlign = 'right'; col.sorter = 'number'; }
      cols.push(col);
    });
    if (S.d.amb_equips) cols.push(Object.assign({ title: 'Equips', field: 'equips', minWidth: 140, headerSort: false,
      formatter: function (cell) { return (cell.getValue() || []).map(function (id) { return '<span class="gs-pill" title="' + esc(nomEquip(id)) + '">' + esc(id.replace(/^EQ-/, '')) + '</span>'; }).join(''); },
      accessorDownload: function (v) { return (v || []).join(', '); },
      editable: ed && S.d.admin_global, editor: 'list', editorParams: { values: (S.d.equips || []).reduce(function (o, e) { o[e.id] = e.nom; return o; }, {}), multiselect: true } }, filtreEquips()));
    return cols;
  }
  function pintaTaula() {
    var mobil = window.matchMedia('(max-width: 760px)').matches;
    var visibles = guarda.llegeix('cols|' + S.modul.id);
    var cols = columnes();
    if (Array.isArray(visibles)) cols.forEach(function (c) { if (c.field && c.field.charAt(0) !== '_' && c.field !== 'id' && visibles.indexOf(c.field) < 0) c.visible = false; });
    $('gsTaula').hidden = mobil;
    S.taula = new Tabulator('#gsTaula', {
      data: S.d.files.slice().sort(S.modul.id === 'alumnat' ? function (a, b) { return nivellAlumne(a) - nivellAlumne(b) || String(a.grup_actual || '').localeCompare(String(b.grup_actual || ''), 'ca') || ordenaCognoms(a, b); } : ordenaCognoms).map(copia),
      index: 'id', columns: cols, layout: 'fitDataStretch', height: alcada(), movableColumns: true, selectableRows: potEditar() ? 'highlight' : false,
      placeholder: 'No hi ha cap fila amb aquests filtres.', columnHeaderVertAlign: 'bottom',
      rowFormatter: function (row) { var d = row.getData(); var el = row.getElement(); el.classList.toggle('gs-baixa', deBaixa(d)); el.classList.toggle('gs-nova', String(d.id).indexOf('nou-') === 0); el.classList.toggle('gs-n1', S.modul.id === 'alumnat' && nivellAlumne(d) === 1); el.classList.toggle('gs-sense-ant', S.modul.id === 'alumnat' && senseGrupAnterior(d)); }
    });
    S.taula.on('rowSelectionChanged', function (data) { var b = $('gsSeleccio'); if (!b) return; var abans = b.hidden; b.hidden = !data.length; if (abans !== b.hidden) setTimeout(ajustaAlcada, 0); $('gsSelN').textContent = data.length + (data.length === 1 ? ' fila seleccionada' : ' files seleccionades'); });
    S.taula.on('tableBuilt', function () { aplicaFiltre(); ajustaAlcada(); });
    S.taula.on('dataFiltered', function (f, rows) { var c = $('gsCompte'); if (c) c.textContent = rows.length + ' de ' + S.taula.getDataCount() + ' files'; });
    S.taula.on('cellEdited', celEditada);
    if (mobil) pintaMobil();
  }
  // Si es filtra la columna Estat per «baixa» (casella o embut), les baixes no s'amaguen
  function filtreEstat() { try { var f = S.taula && S.taula.getColumn('estat') && S.taula.getHeaderFilterValue('estat'); return !!(f && ((f.s && f.s.indexOf('baixa') >= 0) || (f.t && 'baixa'.indexOf(f.t.toLowerCase()) === 0))); } catch (e) { return false; } }
  function aplicaFiltre() {
    if (!S.taula) return;
    S.taula.setFilter(function (d) {
      // Les baixes s'amaguen si no es marca «Mostra també les baixes»… excepte si es filtra per la columna Estat
      return S.baixes || !deBaixa(d) || !!S.canvis[d.id] || filtreEstat();
    });
    if (window.matchMedia('(max-width: 760px)').matches) pintaMobil();
  }
  function pintaMobil() {
    var rows = S.taula ? S.taula.getData('active') : [];
    var tit = '_nom';
    $('gsMobil').hidden = false;
    $('gsMobil').innerHTML = '<p class="gs-nota-mobil">Al mòbil es mostren fitxes de consulta. Per editar, feu servir un ordinador.</p>' + rows.slice(0, 200).map(function (r) {
      return '<article class="gs-fitxa"><h4>' + esc(nomComplet(r) || r.id) + '</h4><dl>' + S.d.camps.filter(function (c) { return r[c.clau] && ['nom', 'cognom1', 'cognom2'].indexOf(c.clau) < 0; }).slice(0, 8).map(function (c) {
        return '<dt>' + esc(c.nom) + '</dt><dd>' + esc(r[c.clau]) + '</dd>';
      }).join('') + '</dl></article>';
    }).join('');
  }

  function celEditada(cell) {
    var row = cell.getRow(), d = row.getData(), camp = cell.getField(), v = cell.getValue();
    if (Array.isArray(v)) v = v.slice(); else v = v == null ? '' : String(v);
    if (camp === 'equips' && !Array.isArray(v)) v = v ? String(v).split(',') : [];
    registra(d.id, camp, v);
    cell.getElement().classList.add('gs-canviat');
    var cdef = S.d.camps.filter(function (c) { return c.clau === camp; })[0];
    var err = cdef ? errorCel(cdef, v) : '';
    cell.getElement().classList.toggle('gs-error', !!err);
    if (!err && $('gsToast').classList.contains('prog-toast--error')) $('gsToast').hidden = true;
    if (err) toast((nomComplet(d) ? nomComplet(d) + ': ' : '') + cdef.nom + ' ' + (ERRORS_CAMP[err] || err) + (err === 'correu_domini' ? cdef.valors : '') + '.', true);
    // Alumnat: sense nivell, el grup actual el posa (2n ESO B → 2n ESO)
    if (S.modul.id === 'alumnat' && camp === 'grup_actual' && v && !d.nivell && nivellDeGrup(v)) { row.update({ nivell: nivellDeGrup(v) }); registra(d.id, 'nivell', nivellDeGrup(v)); }
    if (S.modul.id === 'alumnat' && ['nivell', 'grup_actual', 'estat'].indexOf(camp) >= 0) { row.reformat(); var cg = row.getCell(camp); if (cg && cg.getElement()) cg.getElement().classList.add('gs-canviat'); }   // camps de 2n, grup anterior i opcions d'estat
    // Regles entre camps de la fila (p. ex. alumnat de 1r amb grup 25-26)
    var rg = !err && regla(d);
    if (rg) {
      var cr = row.getCell(rg.camp); if (cr) cr.getElement().classList.add('gs-error');
      var cn = S.d.camps.filter(function (c) { return c.clau === rg.camp; })[0];
      toast((nomComplet(d) ? nomComplet(d) + ': ' : '') + (cn ? cn.nom : rg.camp) + ' ' + ERRORS_CAMP[rg.error] + '.', true);
    } else if (!err) row.getCells().forEach(function (ce) { var cf = ce.getField(); if ((['estat', 'grup_actual', 'grup_anterior'].indexOf(cf) >= 0 || NOMES_2N.indexOf(cf) >= 0) && !errorCel(S.d.camps.filter(function (c) { return c.clau === cf; })[0] || {}, ce.getValue())) ce.getElement().classList.remove('gs-error'); });
    // Recalcula els camps calculats a la mateixa fila
    var calc = {};
    S.d.camps.filter(function (c) { return c.tipus === 'calculat'; }).forEach(function (c) { calc[c.clau] = calcula(c, Object.assign({}, d)); });
    if (Object.keys(calc).length) row.update(calc);
  }
  function registra(id, camp, v) {
    if (String(id).indexOf('nou-') === 0) { S.altes[id] = S.altes[id] || { tmp: id, valors: {} }; S.altes[id].valors[camp] = v; }
    else {
      var orig = S.d.files.filter(function (f) { return f.id === id; })[0] || {};
      S.canvis[id] = S.canvis[id] || { id: id, data_anterior: orig.data || '', valors: {} };
      S.canvis[id].valors[camp] = v;
    }
    marcaBrut(true);
  }
  function marcaBrut(b) {
    S.brut = b;
    var n = Object.keys(S.canvis).length, a = Object.keys(S.altes).length;
    var canvia = $('gsBarra').hidden === b;
    $('gsBarra').hidden = !b; $('gsBarra').classList.toggle('is-brut', b);
    if (canvia) ajustaAlcada();   // la barra de desar ocupa lloc: la graella s'escurça o s'allarga
    $('gsEstat').textContent = b ? 'Canvis sense desar: ' + [n ? n + (n === 1 ? ' fila modificada' : ' files modificades') : '', a ? a + (a === 1 ? ' alta' : ' altes') : ''].filter(Boolean).join(' · ') : '';
  }
  function accioFila(a, row) {
    var d = row.getData();
    if (a === 'baixa' || a === 'reactiva') {
      var nou = a === 'baixa' ? 'baixa' : 'actiu';
      if (String(d.id).indexOf('nou-') === 0) return;
      row.update({ estat: nou }); registra(d.id, 'estat', nou); row.reformat();
      var ce = row.getCell('estat'); if (ce) ce.getElement().classList.add('gs-canviat');
      toast(a === 'baixa' ? 'Fila marcada de baixa. Premeu «Desa els canvis».' : 'Fila reactivada. Premeu «Desa els canvis».');
      return;
    }
    if (a === 'esborra') {
      if (String(d.id).indexOf('nou-') === 0) { delete S.altes[d.id]; row.delete(); marcaBrut(Object.keys(S.canvis).length + Object.keys(S.altes).length > 0); return; }
      pregunta('Esborrar del tot', '<p>S’esborrarà <strong>' + esc(nomComplet(d) || d.id) + '</strong> de la base de dades (queda una còpia a la pestanya «historial»).</p><p>Per a una persona que ja no és al centre, és millor <strong>donar-la de baixa</strong>: es conserva i es pot reactivar.</p>',
        [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Esborra del tot', valor: 1, tipus: 'danger' }]).then(function (v) {
        if (!v) return;
        api('esborra', { modul: S.modul.id, ids: [d.id] }, 'Esborrant…').then(function (r) {
          if (!r.ok) return toast(text(r.error), true);
          delete S.canvis[d.id]; row.delete(); S.d.files = S.d.files.filter(function (f) { return f.id !== d.id; });
          marcaBrut(Object.keys(S.canvis).length + Object.keys(S.altes).length > 0); toast('Esborrat.');
        });
      });
    }
  }
  function alta() {
    var id = 'nou-' + (++S.nTmp), fila = { id: id };
    if (S.d.amb_equips) fila.equips = [];
    S.d.camps.forEach(function (c) { fila[c.clau] = ''; });
    S.altes[id] = { tmp: id, valors: {} };
    if (S.d.camps.some(function (c) { return c.clau === 'estat'; })) { fila.estat = 'actiu'; S.altes[id].valors.estat = 'actiu'; }
    marcaBrut(true);
    S.taula.addRow(fila, true).then(function (row) {
      S.taula.scrollToRow(row, 'top', false).catch(function () { /* ja és visible */ });
      // Si la barra de desar acaba d'aparèixer, la graella es redibuixa (alçada nova) i tancaria l'editor: s'obre després
      var primer = S.d.camps.filter(editable)[0];
      if (primer) setTimeout(function () { var ce = row.getCell(primer.clau); if (ce) ce.edit(); }, 180);
    });
  }

  // ------------------------------------------------------------------ selecció: un mateix valor a moltes files (PAS 28)
  // P. ex. filtrar 2n ESO B, marcar-los tots i posar «Decisió final = promociona»; després es canvien els casos concrets.
  function marcaCel(row, camp, err) { var ce = row.getCell(camp); if (ce && ce.getElement()) { ce.getElement().classList.add('gs-canviat'); ce.getElement().classList.toggle('gs-error', !!err); } }
  function aplicaSeleccio() {
    var rows = S.taula.getSelectedRows();
    if (!rows.length) return toast('Primer marqueu les files (casella de l’esquerra).', true);
    var camps = S.d.camps.filter(function (c) { return editable(c) && (c.tipus === 'llista' || c.tipus === 'si_no'); });
    if (!camps.length) return;
    var per = camps.filter(function (c) { return c.clau === 'decisio_final'; })[0] || camps[0];
    var opcions = function (c) { return c.tipus === 'si_no' ? ['sí', ''] : [''].concat(c.valors.split('|').map(function (x) { return x.trim(); })); };
    var pintaValors = function (c) { $('gsSelValor').innerHTML = opcions(c).map(function (o) { return '<option value="' + esc(o) + '">' + esc(o || (c.tipus === 'si_no' ? 'no' : '— (buit)')) + '</option>'; }).join(''); };
    pregunta('Aplica a la selecció', '<p class="gs-ajuda">Es posarà el mateix valor a les <strong>' + rows.length + '</strong> files seleccionades. Queda com a canvi sense desar: reviseu-lo i premeu «Desa els canvis».</p>' +
      '<div class="gs-form-fila"><label>Camp <select id="gsSelCamp">' + camps.map(function (c) { return '<option value="' + esc(c.clau) + '"' + (c === per ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join('') + '</select></label>' +
      '<label>Valor <select id="gsSelValor"></select></label></div>', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Aplica', valor: 1, abans: function () { pregunta.sel = { camp: $('gsSelCamp').value, valor: $('gsSelValor').value }; } }]).then(function (v) {
      if (!v) return;
      var c = camps.filter(function (x) { return x.clau === pregunta.sel.camp; })[0], val = pregunta.sel.valor, fets = 0, saltats = 0, errors = 0;
      rows.forEach(function (row) {
        var d = row.getData();
        if (!editableFila(c, d)) { saltats++; return; }
        if (String(d[c.clau] == null ? '' : d[c.clau]) === val) return;
        var o = {}; o[c.clau] = val; row.update(o); registra(d.id, c.clau, val);
        row.reformat(); var rg = regla(row.getData()); marcaCel(row, c.clau, rg && rg.camp === c.clau);
        if (rg) { errors++; marcaCel(row, rg.camp, true); }
        fets++;
      });
      S.taula.deselectRow();
      toast(fets + ' files canviades' + (saltats ? ' · ' + saltats + ' no es poden canviar' : '') + (errors ? ' · ' + errors + ' amb errors (en vermell)' : '') + '. Premeu «Desa els canvis».', !!errors);
    });
    pintaValors(per);
    $('gsSelCamp').addEventListener('change', function () { pintaValors(camps.filter(function (x) { return x.clau === $('gsSelCamp').value; })[0]); });
  }

  // ------------------------------------------------------------------ tancament de curs (ALUMNAT) · PAS 28
  // Qui té edició del mòdul. Resum de les decisions per grup; si en falta alguna, no es pot tancar.
  function tancamentCurs() {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    var vius = S.d.files.filter(function (f) { return !deBaixa(f); });
    var pend = vius.filter(function (f) { return !f.decisio_final; });
    var grups = {};
    vius.forEach(function (f) { var g = f.grup_actual || ((f.nivell || '?') + ' · sense grup'); var x = grups[g] = grups[g] || { promociona: 0, repeteix: 0, baixa: 0, pendent: 0 }; x[f.decisio_final || 'pendent']++; });
    var any = function (a) { return String(a).slice(2); }, a0 = Number(String(S.d.curs || '').slice(0, 4)) || 0;
    var cursTxt = a0 ? a0 + '-' + any(a0 + 1) : (S.d.curs || '');
    var taula = '<table class="gs-form-taula gs-resum"><thead><tr><th>Grup</th><th>Promociona</th><th>Repeteix</th><th>Baixa</th><th>Pendent</th></tr></thead><tbody>' +
      Object.keys(grups).sort(function (x, y) { return x.localeCompare(y, 'ca'); }).map(function (g) { var x = grups[g]; return '<tr><td>' + esc(g) + '</td><td>' + x.promociona + '</td><td>' + x.repeteix + '</td><td>' + x.baixa + '</td><td' + (x.pendent ? ' class="gs-pendent"' : '') + '>' + x.pendent + '</td></tr>'; }).join('') + '</tbody></table>';
    if (pend.length) {
      return pregunta('Tancament de curs ' + cursTxt, '<p>Abans de tancar, <strong>tots</strong> els alumnes que no són de baixa han de tenir <strong>Decisió final</strong>. Falten <strong>' + pend.length + '</strong>.</p>' + taula +
        '<p class="gs-ajuda">Consell: filtreu un grup, marqueu-lo sencer amb la casella de la capçalera i feu «Aplica a la selecció» → Decisió final = promociona; després canvieu els casos concrets.</p>',
        [{ t: 'Tanca', valor: 0, tipus: 'ghost' }, { t: 'Mostra els pendents', valor: 1 }], false).then(function (v) {
        if (!v) return;
        try { S.taula.setHeaderFilterValue('decisio_final', { t: '', s: [''] }); } catch (e) { /* sense columna */ }
      });
    }
    pregunta('Tancament de curs ' + cursTxt, '<p>Es faran aquests canvis a <strong>' + vius.length + '</strong> alumnes (les baixes no es toquen):</p>' + taula +
      '<ul class="gs-ajuda"><li><strong>Promociona</strong> → nivell següent, estat «promociona». 4t d’ESO acaba l’etapa: estat «baixa».</li><li><strong>Repeteix</strong> → mateix nivell, estat «repeteix…».</li><li><strong>Baixa</strong> → estat «baixa».</li>' +
      '<li>A tots: el grup actual passa a <strong>grup anterior</strong> i el grup del curs vinent queda <strong>per assignar</strong>; la decisió final es buida.</li>' +
      '<li>El curs passa a ' + esc(a0 ? (a0 + 1) + '-' + any(a0 + 2) : 'el següent') + '. Abans de canviar res es fa una <strong>còpia</strong> de la pestanya alumnes (es pot desfer des de l’Apps Script amb <code>desfesTancament</code>).</li></ul>' +
      '<label class="gs-check"><input type="checkbox" id="gsTancaOk"> He revisat les decisions de tots els grups</label>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Tanca el curs', valor: 1, tipus: 'danger', abans: function () { if (!$('gsTancaOk').checked) { toast('Marqueu la casella de revisió.', true); return false; } } }], false).then(function (v) {
      if (!v) return;
      api('tanca_curs', { modul: 'alumnat', curs: S.d.curs }, 'Tancant el curs…').then(function (r) {
        if (!r.ok) {
          var det = r.error === 'nivell_no_existeix' ? ' ' + (r.nivells || []).map(function (n) { return n.alumnes + ' alumnes a ' + n.nivell; }).join(', ') + '. Afegiu el nivell al mòdul (Gestió camps) o canvieu-ne la decisió.' :
            r.error === 'pendents' ? ' (' + r.total + ')' : '';
          return pregunta('No s’ha tancat el curs', '<p>' + esc(text(r.error) + det) + '</p>', [{ t: 'Entesos', valor: 1 }]);
        }
        delete S.cache.alumnat;
        pregunta('Curs tancat', '<p>Ara el curs és <strong>' + esc(r.curs) + '</strong>. Còpia de seguretat: pestanya <code>' + esc(r.copia) + '</code> d’ijm_alumnat_db.</p><ul>' +
          Object.keys(r.resum || {}).map(function (k) { return '<li>' + esc(k) + ': ' + r.resum[k] + '</li>'; }).join('') + '</ul><p>Ara cal assignar el grup del curs vinent i fer l’alta de l’alumnat nou (botó «Importa fitxer»).</p>', [{ t: 'Entesos', valor: 1 }]);
        carregaDades();
      });
    });
  }

  // ------------------------------------------------------------------ alta massiva per fitxer (PAS 28)
  // Plantilla Excel amb les columnes del mòdul → s'omple → es puja (xlsx, xls o csv) → previsualització → les files
  // entren a la graella com a altes sense desar (es poden revisar i corregir) i es desen amb «Desa els canvis».
  var normTxt = function (x) { return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
  function separaNom(sn) {
    var p = String(sn).split(','), nom = (p.slice(1).join(',') || '').trim(), mots = p[0].trim().split(/\s+/).filter(Boolean);
    var part = ['de', 'del', 'la', 'las', 'los', 'el', 'van', 'von', 'da', 'di', 'dos', 'das'], cg = [], act = [];
    mots.forEach(function (m) { act.push(m); if (part.indexOf(m.toLowerCase()) < 0) { cg.push(act.join(' ')); act = []; } });
    if (act.length) cg.push(act.join(' '));
    return { nom: nom, cognom1: cg[0] || '', cognom2: cg.slice(1).join(' ') };
  }
  function valorDe(c, x) {
    if (x == null) return '';
    if (c.tipus === 'data') {
      if (typeof x === 'number') { var dt = new Date(Math.round((x - 25569) * 86400000)); return dt.toISOString().slice(0, 10); }
      var m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(String(x).trim()); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    }
    x = String(x).trim();
    if (c.tipus === 'si_no') return ['si', 'sí', 'x', 'true', '1', 'cert', 'verdadero', 'yes'].indexOf(x.toLowerCase()) >= 0 ? 'sí' : '';
    if (c.tipus === 'llista' && x) { var ok = c.valors.split('|').map(function (o) { return o.trim(); }).filter(function (o) { return normTxt(o) === normTxt(x); })[0]; return ok || x; }
    if (c.tipus === 'nif') return x.toUpperCase().replace(/[\s.\-]/g, '');
    return x;
  }
  function campsImportables() { return S.d.camps.filter(function (c) { return editable(c) && c.clau !== 'decisio_final'; }); }
  function plantilla() {
    return carregaScript(LIBS.xlsx).then(function () {
      var camps = campsImportables();
      var wb = XLSX.utils.book_new();
      var full = XLSX.utils.aoa_to_sheet([camps.map(function (c) { return c.nom; })]);
      full['!cols'] = camps.map(function (c) { return { wch: Math.max(12, c.nom.length + 2) }; });
      XLSX.utils.book_append_sheet(wb, full, S.modul.nom.slice(0, 30));
      var llistes = camps.filter(function (c) { return c.tipus === 'llista' || c.tipus === 'si_no'; });
      var maxN = llistes.reduce(function (m, c) { return Math.max(m, c.tipus === 'si_no' ? 2 : c.valors.split('|').length); }, 0);
      var files = [llistes.map(function (c) { return c.nom; })];
      for (var i = 0; i < maxN; i++) files.push(llistes.map(function (c) { var o = c.tipus === 'si_no' ? ['sí', '(buit = no)'] : c.valors.split('|'); return (o[i] || '').trim(); }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(files), 'Valors permesos');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Instruccions'], ['Una fila per ' + (S.d.nom_fila || 'fila') + '. No canvieu els títols de la primera fila.'], ['Columnes obligatòries: ' + camps.filter(function (c) { return c.obligatori; }).map(function (c) { return c.nom; }).join(', ')],
        ['Les llistes han de tenir un dels valors de la pestanya «Valors permesos». Sí/no: «sí» o en blanc. Dates: dd/mm/aaaa.'], ['També s’accepta una sola columna «Cognoms, Nom» en lloc de Nom, 1r cognom i 2n cognom.']]), 'Instruccions');
      XLSX.writeFile(wb, 'plantilla-' + S.modul.id + '.xlsx');
    });
  }
  function importaFitxer() {
    pregunta('Importa fitxer · alta massiva', '<p class="gs-ajuda">Per donar d’alta moltes files de cop (p. ex. l’alumnat nou de 1r d’ESO o de 1r de Batxillerat). ' +
      '1) Baixeu la plantilla, 2) ompliu-la (o copieu-hi les dades de la preinscripció o matrícula), 3) pugeu-la. Les files entren a la graella <strong>sense desar</strong>: les podeu revisar i, després, «Desa els canvis».</p>' +
      '<p><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" id="gsPlantilla">Baixa la plantilla (Excel)</button></p>' +
      '<p><input type="file" id="gsFitxer" accept=".xlsx,.xls,.csv,.ods"></p><div id="gsImpResum"></div>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Afegeix a la graella', valor: 1, abans: function () { if (!importaFitxer.files || !importaFitxer.files.length) { toast('Primer trieu un fitxer amb dades vàlides.', true); return false; } } }], false).then(function (v) {
      var files = importaFitxer.files; importaFitxer.files = null;
      if (!v || !files) return;
      var dup = $('gsImpDup') && $('gsImpDup').checked;
      var aAfegir = files.filter(function (f) { return dup || !f.dup; });
      if (Object.keys(S.altes).length + aAfegir.length > 500) return toast(text('massa_canvis'), true);
      var nous = aAfegir.map(function (f) {
        var id = 'nou-' + (++S.nTmp), fila = { id: id };
        if (S.d.amb_equips) fila.equips = [];
        S.d.camps.forEach(function (c) { fila[c.clau] = f.v[c.clau] || ''; });
        if (S.modul.id === 'alumnat') { if (!fila.nivell) fila.nivell = nivellDeGrup(fila.grup_actual); if (!fila.estat) fila.estat = 'alumne extern'; }
        else if (S.d.camps.some(function (c) { return c.clau === 'estat'; }) && !fila.estat) fila.estat = 'actiu';
        S.altes[id] = { tmp: id, valors: {} };
        S.d.camps.forEach(function (c) { if (fila[c.clau] && editable(c)) S.altes[id].valors[c.clau] = fila[c.clau]; });
        return fila;
      });
      marcaBrut(true);
      S.taula.addData(nous, true).then(function (rows) {
        rows.forEach(function (row) { var d = row.getData(); S.d.camps.forEach(function (c) { var e = errorCel(c, d[c.clau]); if (e) marcaCel(row, c.clau, true); }); var rg = regla(d); if (rg) marcaCel(row, rg.camp, true); });
        if (rows[0]) S.taula.scrollToRow(rows[0], 'top', false).catch(function () { /* visible */ });
      });
      toast(nous.length + ' files afegides a la graella (a dalt de tot). Reviseu-les i premeu «Desa els canvis».');
    });
    $('gsPlantilla').addEventListener('click', plantilla);
    $('gsFitxer').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      $('gsImpResum').innerHTML = '<p>Llegint…</p>';
      carregaScript(LIBS.xlsx).then(function () { return f.arrayBuffer(); }).then(function (buf) {
        var wb = XLSX.read(buf, { type: 'array', cellDates: false });
        var aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
        llegeixFiles(aoa);
      }).catch(function () { $('gsImpResum').innerHTML = '<p class="gs-pendent">No s’ha pogut llegir el fitxer.</p>'; });
    });
  }
  function llegeixFiles(aoa) {
    var camps = campsImportables(), perNom = {};
    camps.forEach(function (c) { perNom[normTxt(c.nom)] = c; perNom[normTxt(c.clau)] = c; });
    var fc = aoa.findIndex(function (r) { return r.some(function (x) { var n = normTxt(x); return perNom[n] || n === 'cognoms nom' || n === 'cognoms i nom'; }); });
    if (fc < 0) { importaFitxer.files = null; $('gsImpResum').innerHTML = '<p class="gs-pendent">No trobo cap columna coneguda. Feu servir la plantilla.</p>'; return; }
    var cap = aoa[fc].map(normTxt);
    var mapa = cap.map(function (k) { return perNom[k] ? perNom[k].clau : (k === 'cognoms nom' || k === 'cognoms i nom' ? '_complet' : ''); });
    var ignorades = aoa[fc].filter(function (k, i) { return String(k).trim() && !mapa[i]; });
    var existents = {}; S.taula.getData().forEach(function (d) { existents[normTxt([d.cognom1, d.cognom2, d.nom].join(' '))] = 1; });
    var vistos = {}, files = [];
    aoa.slice(fc + 1).forEach(function (r) {
      if (!r.some(function (x) { return String(x).trim(); })) return;
      var v = {};
      mapa.forEach(function (k, i) { if (k === '_complet') Object.assign(v, separaNom(r[i])); else if (k) { var c = camps.filter(function (x) { return x.clau === k; })[0]; v[k] = valorDe(c, r[i]); } });
      if (S.modul.id === 'alumnat') { if (!v.nivell) v.nivell = nivellDeGrup(v.grup_actual); if (!v.estat) v.estat = 'alumne extern'; }
      var clau = normTxt([v.cognom1, v.cognom2, v.nom].join(' '));
      var errs = camps.map(function (c) { var e = errorCel(c, v[c.clau]); return e ? c.nom + ' ' + (ERRORS_CAMP[e] || e) : ''; }).filter(Boolean);
      var rg = S.modul.id === 'alumnat' ? REGLES.alumnat(v) : null; if (rg) { var cn = camps.filter(function (c) { return c.clau === rg.camp; })[0]; errs.push((cn ? cn.nom : rg.camp) + ' ' + ERRORS_CAMP[rg.error]); }
      files.push({ v: v, dup: !!(clau && (existents[clau] || vistos[clau])), errs: errs, nom: [v.nom, v.cognom1, v.cognom2].filter(Boolean).join(' ') || '(sense nom)' });
      vistos[clau] = 1;
    });
    importaFitxer.files = files;
    var dups = files.filter(function (f) { return f.dup; }), amb = files.filter(function (f) { return f.errs.length; });
    $('gsImpResum').innerHTML = '<p><strong>' + files.length + '</strong> files llegides · columnes reconegudes: ' + esc(aoa[fc].filter(function (k, i) { return mapa[i]; }).join(' · ')) + '</p>' +
      (ignorades.length ? '<p class="gs-ajuda">No s’importen: ' + esc(ignorades.join(' · ')) + '</p>' : '') +
      (dups.length ? '<p class="gs-pendent">' + dups.length + ' ja hi són (mateix nom i cognoms) o estan repetides al fitxer: no s’afegiran. <label class="gs-check"><input type="checkbox" id="gsImpDup"> Afegeix-les igualment</label></p>' : '') +
      (amb.length ? '<p class="gs-pendent">' + amb.length + ' files amb dades per corregir (sortiran en vermell a la graella):</p><ul class="gs-errors">' + amb.slice(0, 12).map(function (f) { return '<li><strong>' + esc(f.nom) + '</strong>: ' + esc(f.errs.join('; ')) + '</li>'; }).join('') + (amb.length > 12 ? '<li>…</li>' : '') + '</ul>' : '') +
      (!dups.length && !amb.length ? '<p>Tot correcte.</p>' : '');
  }

  function desa(forca) {
    var canvis = Object.keys(S.canvis).map(function (k) { return S.canvis[k]; });
    var altes = Object.keys(S.altes).map(function (k) { return S.altes[k]; });
    if (!canvis.length && !altes.length) return marcaBrut(false);
    document.querySelectorAll('#gsTaula .gs-error').forEach(function (el) { el.classList.remove('gs-error'); });
    api('desa', { modul: S.modul.id, canvis: canvis, altes: altes, forca: !!forca }, 'Desant…').then(function (r) {
      if (r.ok) {
        r.files.forEach(function (f) {
          var dades = Object.assign({ id: f.id, data: f.data, equips: f.equips || [] }, f.valors);
          // S.d.files és la còpia «desada» (la que es recupera en descartar): mai no comparteix objectes amb la graella
          if (f.tmp) { var rt = S.taula.getRow(f.tmp); if (rt) rt.delete(); S.taula.addRow(copia(dades)); S.d.files.push(copia(dades)); }
          else { var rw = S.taula.getRow(f.id); if (rw) rw.update(copia(dades)); S.d.files = S.d.files.map(function (x) { return x.id === f.id ? copia(dades) : x; }); }
        });
        S.canvis = {}; S.altes = {}; marcaBrut(false);
        document.querySelectorAll('#gsTaula .gs-canviat').forEach(function (el) { el.classList.remove('gs-canviat'); });
        S.taula.getRows().forEach(function (rw) { rw.reformat(); });
        aplicaFiltre();
        toast('Desat correctament.');
        return;
      }
      if (r.error === 'validacio') {
        var nomCamp = {}; S.d.camps.forEach(function (c) { nomCamp[c.nom] = c.clau; });
        var items = (r.errors || []).map(function (e) {
          var row = S.taula.getRow(e.id); var d = row ? row.getData() : {};
          if (row && nomCamp[e.camp]) { var cel = row.getCell(nomCamp[e.camp]); if (cel) cel.getElement().classList.add('gs-error'); }
          var qui = nomComplet(d) || (String(e.id).indexOf('nou-') === 0 || String(e.id).indexOf('alta-') === 0 ? 'fila nova' : e.id);
          return '<li><strong>' + esc(qui) + '</strong>: ' + esc(e.camp || '') + ' ' + esc((ERRORS_CAMP[e.error] || e.error) + (e.domini ? e.domini : '')) + '</li>';
        });
        return pregunta('No s’ha desat res', '<p>' + esc(text('validacio')) + ' Corregiu les cel·les marcades en vermell i torneu a desar:</p><ul class="gs-errors">' + items.join('') + '</ul>', [{ t: 'Entesos', valor: 1 }]);
      }
      if (r.error === 'conflicte') {
        var qui2 = (r.conflictes || []).map(function (c) { return esc(c.id) + (c.desat_per ? ' (desat per ' + esc(c.desat_per) + ')' : ''); }).join(', ');
        return pregunta('Algú altre ha desat aquestes files', '<p>' + qui2 + '</p><p>Podeu tornar a carregar les dades (perdreu els vostres canvis) o desar la vostra versió (substituirà la seva; l’anterior queda a l’historial).</p>',
          [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Torna a carregar', valor: 'recarrega' }, { t: 'Desa la meva versió', valor: 'forca', tipus: 'danger' }])
          .then(function (v) { if (v === 'forca') desa(true); if (v === 'recarrega') carregaDades(); });
      }
      toast(text(r.error), true);
    });
  }

  function triaColumnes() {
    var marca = function (b) { $('gsModalText').querySelectorAll('.gs-cols input').forEach(function (i) { i.checked = b; }); };
    var cols = S.taula.getColumns().filter(function (c) { var f = c.getField(); return f && f.charAt(0) !== '_' && f !== 'id'; });
    pregunta('Visualització camps', '<p class="gs-ajuda">Trieu quines columnes voleu veure. Es recorda en aquest navegador. També podeu arrossegar les capçaleres per canviar l’ordre.</p><div class="gs-cols">' +
      cols.map(function (c) { return '<label><input type="checkbox" value="' + esc(c.getField()) + '"' + (c.isVisible() ? ' checked' : '') + '> ' + esc(c.getDefinition().title.replace(/ \*$/, '')) + '</label>'; }).join('') + '</div>',
      [{ t: 'Cap', tipus: 'ghost', abans: function () { marca(false); return false; } },
       { t: 'Totes', tipus: 'ghost', abans: function () { marca(true); return false; } },
       { t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Aplica', valor: 'aplica' }], false).then(function (v) {
      if (!v) return;
      var marcats = [].map.call($('gsModalText').querySelectorAll('input:checked'), function (i) { return i.value; });
      cols.forEach(function (c) { if (marcats.indexOf(c.getField()) >= 0) c.show(); else c.hide(); });
      guarda.desa('cols|' + S.modul.id, marcats);
    });
  }
  function exporta(tipus) {
    var nom = S.modul.id + '-' + new Date().toISOString().slice(0, 10);
    if (tipus === 'xlsx') return carregaScript(LIBS.xlsx).then(function () { S.taula.download('xlsx', nom + '.xlsx', { sheetName: S.modul.nom.slice(0, 30) }); });
    return carregaScript(LIBS.jspdf).then(function () { return carregaScript(LIBS.autotable); }).then(function () { pdf(nom); });
  }
  // PDF fet a mà (jsPDF + autoTable): capçalera fora de la taula, amplades segons el contingut, peu amb pàgines
  function pdf(nom) {
    var cols = S.taula.getColumns().filter(function (c) { var f = c.getField(); return c.isVisible() && f && f.charAt(0) !== '_'; });
    var files = S.taula.getData('active');
    var valor = function (c, d) { var f = c.getField(), v = d[f]; if (f === 'equips') return (v || []).join(', '); return v == null ? '' : String(v); };
    var cap = cols.map(function (c) { return c.getDefinition().title.replace(/ \*$/, ''); });
    var cos = files.map(function (d) { return cols.map(function (c) { return valor(c, d); }); });
    var doc = new window.jspdf.jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10, util = W - 2 * M;
    var mida = cols.length > 14 ? 6 : cols.length > 10 ? 6.5 : 7.5;
    // Amplada de cada columna segons el text real: natural = el que ocupa el 95 % de les files (o la capçalera);
    // mínima = la paraula més llarga. Si no hi cap tot, s'encongeixen les columnes llargues (els correus, els noms
    // complets), mai per sota de la mínima; si sobra espai, es reparteix.
    doc.setFont('helvetica', 'normal'); doc.setFontSize(mida);
    var mm = function (t, negreta) { doc.setFont('helvetica', negreta ? 'bold' : 'normal'); return doc.getStringUnitWidth(t) * mida / doc.internal.scaleFactor; };
    var pad = 2 * 1.2 + 0.6;
    var nat = [], min = [];
    cols.forEach(function (c, j) {
      var amp = cos.map(function (r) { return mm(r[j]); }).sort(function (x, y) { return x - y; });
      var p95 = amp.length ? amp[Math.min(amp.length - 1, Math.floor(amp.length * 0.95))] : 0;
      var paraules = cap[j].split(/\s+/).map(function (w) { return mm(w, true); });
      var mot = cos.reduce(function (m, r) { return r[j].split(/\s+/).reduce(function (mm2, w) { return Math.max(mm2, mm(w)); }, m); }, 0);
      min[j] = Math.max(Math.max.apply(null, paraules), Math.min(mot, 26)) + pad;
      nat[j] = Math.max(min[j], Math.min(p95 + pad, 70), Math.min(mm(cap[j], true) + pad, 30));
    });
    var amples = nat.slice(), suma = amples.reduce(function (x, y) { return x + y; }, 0);
    if (suma > util) {
      var flex = amples.reduce(function (t, w, j) { return t + (w - min[j]); }, 0), sobra = suma - util;
      amples = amples.map(function (w, j) { return flex > sobra ? w - (w - min[j]) * sobra / flex : min[j]; });
      suma = amples.reduce(function (x, y) { return x + y; }, 0);
    }
    if (suma < util) amples = amples.map(function (w) { return w * util / suma; });
    var columnStyles = {}; amples.forEach(function (w, j) { columnStyles[j] = { cellWidth: w }; });
    var filtres = [S.taula.getHeaderFilters().length ? 'filtres a les columnes' : '', S.baixes ? 'amb baixes' : 'sense baixes'].filter(Boolean).join(' · ');
    var data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.autoTable({
      head: [cap], body: cos, startY: 24, margin: { top: 24, left: M, right: M, bottom: 12 }, tableWidth: 'wrap', columnStyles: columnStyles,
      styles: { font: 'helvetica', fontSize: mida, cellPadding: 1.2, overflow: 'linebreak', valign: 'top', lineColor: [225, 229, 238], lineWidth: 0.1 },
      headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 248, 252] },
      didDrawPage: function () {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(28, 12, 188);
        doc.text(S.modul.nom.toUpperCase() + ' · Institut Joan Miró', M, 12);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120);
        doc.text(data + ' · ' + files.length + ' files' + (filtres ? ' · ' + filtres : ''), M, 17);
        doc.text('Pàgina ' + doc.internal.getNumberOfPages(), W - M, H - 6, { align: 'right' });
      }
    });
    doc.save(nom + '.pdf');
  }

  // ------------------------------------------------------------------ camps (admin)
  function editaCamps() {
    var camps = (S.d.camps_tots || S.d.camps).map(function (c) { return Object.assign({ nou: false }, c); });
    function fila(c, i) {
      var sis = c.clau === 'estat';   // camp de sistema: obligatori, llista i sempre actiu
      var bloq = sis ? ' disabled title="Camp de sistema: sempre és una llista obligatòria i activa"' : '';
      var opcionsTipus = Object.keys(TIPUS).map(function (t) { return '<option value="' + t + '"' + (c.tipus === t ? ' selected' : '') + '>' + TIPUS[t] + '</option>'; }).join('');
      return '<tr data-i="' + i + '" class="' + (c.actiu === false ? 'gs-arxivat' : '') + '">' +
        '<td><input type="text" data-k="nom" value="' + esc(c.nom) + '"></td>' +
        '<td><input type="text" data-k="clau" value="' + esc(c.clau) + '"' + (c.nou ? '' : ' readonly title="La clau no es pot canviar: les dades hi estan lligades"') + '></td>' +
        '<td><select data-k="tipus"' + bloq + '>' + opcionsTipus + '</select></td>' +
        '<td><input type="text" data-k="valors" value="' + esc(c.valors) + '" placeholder="A|B|C · @domini · nom cognom1"></td>' +
        '<td style="text-align:center"><input type="checkbox" data-k="obligatori"' + (c.obligatori ? ' checked' : '') + bloq + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-k="unic"' + (c.unic ? ' checked' : '') + '></td>' +
        '<td><select data-k="visible_des_de"><option value="consulta"' + (c.visible_des_de === 'consulta' ? ' selected' : '') + '>Consulta</option><option value="edicio"' + (c.visible_des_de === 'edicio' ? ' selected' : '') + '>Edició</option><option value="admin"' + (c.visible_des_de === 'admin' ? ' selected' : '') + '>Admin</option></select></td>' +
        '<td><select data-k="origen"><option value="gestio"' + (c.origen !== 'clickedu' ? ' selected' : '') + '>GESTIO</option><option value="clickedu"' + (c.origen === 'clickedu' ? ' selected' : '') + '>Clickedu</option></select></td>' +
        '<td style="text-align:center"><input type="checkbox" data-k="actiu"' + (c.actiu !== false ? ' checked' : '') + bloq + '></td>' +
        '<td style="white-space:nowrap"><button type="button" class="prog-ico" data-m="-1" title="Puja">↑</button><button type="button" class="prog-ico" data-m="1" title="Baixa">↓</button></td></tr>';
    }
    function pinta() {
      $('gsModalText').innerHTML = '<p class="gs-ajuda">Columnes del mòdul. <strong>Valors</strong>: per a una llista, les opcions separades per | (A|B|C); per a un correu, el domini obligatori (@institutjoanmiro.cat, @xtec.cat); el tipus <strong>NIF / NIE</strong> comprova la lletra; per a un calculat, les claus que s’ajunten (nom cognom1). Un camp no s’esborra: desmarqueu <strong>Actiu</strong> per arxivar-lo i les dades es conserven. <strong>Visible des de</strong>: qui la pot veure (p. ex. el NIF, des d’edició).</p>' +
        '<table class="gs-form-taula"><thead><tr><th>Nom</th><th>Clau</th><th>Tipus</th><th>Valors</th><th>Oblig.</th><th>Únic</th><th>Visible des de</th><th>Origen</th><th>Actiu</th><th></th></tr></thead><tbody>' +
        camps.map(fila).join('') + '</tbody></table><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" id="gsNouCamp">+ Afegeix camp</button>';
      $('gsNouCamp').addEventListener('click', function () { llegeix(); camps.push({ nou: true, clau: '', nom: '', tipus: 'text', valors: '', obligatori: false, unic: false, visible_des_de: 'consulta', origen: 'gestio', actiu: true }); pinta(); });
      $('gsModalText').querySelectorAll('[data-m]').forEach(function (b) {
        b.addEventListener('click', function () { llegeix(); var i = Number(b.closest('tr').dataset.i), j = i + Number(b.dataset.m); if (j < 0 || j >= camps.length) return; var t = camps[i]; camps[i] = camps[j]; camps[j] = t; pinta(); });
      });
    }
    function llegeix() {
      $('gsModalText').querySelectorAll('tbody tr').forEach(function (tr) {
        var c = camps[Number(tr.dataset.i)];
        tr.querySelectorAll('[data-k]').forEach(function (el) { c[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
        if (c.nou && !c.clau && c.nom) c.clau = c.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'c_$1').slice(0, 40);
      });
    }
    pregunta('Gestió camps', '', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa els camps', valor: 1, abans: llegeix }], false).then(function (v) {
      if (!v) return;
      var buits = camps.filter(function (c) { return c.nou && !c.nom; }); camps = camps.filter(function (c) { return buits.indexOf(c) < 0; });
      api('camps_desa', { modul: S.modul.id, camps: camps }, 'Desant els camps…').then(function (r) {
        if (!r.ok) return toast(text(r.error) + (r.camp ? ' (' + r.camp + ')' : '') + (r.camps ? ' (' + r.camps.join(', ') + ')' : ''), true);
        toast('Camps desats.'); carregaDades();
      });
    });
    pinta();
  }

  // ------------------------------------------------------------------ mòdul EQUIPS I PERMISOS (admins globals)
  // Dues vistes: «Equips» (alta, nom, tipus, actiu, membres) i «Permisos» (matriu equips × mòduls, nivell a cada casella)
  function carregaEquips() {
    api('equips', {}, 'Carregant els equips…').then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.d = { equips_dades: r.equips, moduls: r.moduls, nivell: 'admin', obert: true, r: r };
      S.vistaEquips = S.vistaEquips || 'equips';
      pintaVistaEquips();
    });
  }
  function pintaVistaEquips() {
    var r = S.d.r, perm = S.vistaEquips === 'permisos';
    destrueixTaula();
    $('gsTaula').innerHTML = ''; marcaBrut(false);
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist">' +
        '<button type="button" role="tab" data-accio="vista-equips" aria-selected="' + !perm + '">Equips i membres</button>' +
        '<button type="button" role="tab" data-accio="vista-permisos" aria-selected="' + perm + '">Permisos</button></div>' +
      (perm ? '<p class="gs-ajuda" style="flex:1 1 100%;margin:0 0 4px">Nivell de cada equip a cada mòdul: <strong>Consulta</strong> (veure i exportar), <strong>Edició</strong> (alta, baixa i modificació) o <strong>Administració</strong> (a més, camps i permisos del mòdul). «Tots els mòduls» dona el nivell a tots alhora. Si un docent és a diversos equips, val el nivell més alt. L’administració global de l’equip directiu no es pot treure des d’aquí.</p>'
        : '<p class="gs-ajuda" style="flex:1 1 100%;margin:0 0 4px">Equips de <strong>gestió</strong> (direcció, coordinacions, secretaria…) i <strong>docents</strong> (equips de nivell, departaments…). El tipus només serveix per classificar-los i filtrar-los: tots dos funcionen igual. Els membres poden ser professorat o PAS, i una persona pot ser a diversos equips. <strong>Membres</strong>: cliqueu la cel·la per afegir-ne o treure’n. Els permisos, a la pestanya <strong>Permisos</strong>. Un equip no s’esborra: es marca com a inactiu.</p>' +
          '<span class="gs-espai"></span><button type="button" class="prog-btn" data-accio="nou-equip">+ Afegeix equip</button>');
    return perm ? pintaMatriuPermisos(r) : pintaEquips(r);
  }
  function pintaEquips(r) {
    var dadesEquips = function () { return r.equips.map(function (q) { return Object.assign({ _nou: false }, q, { membres: (q.membres || []).slice(), permisos: (q.permisos || []).slice() }); }); };
    S.descartaEquips = function () { S.taula.replaceData(dadesEquips()); };
    var nomMod = function (id) { if (id === '*') return 'tots'; var m = r.moduls.filter(function (x) { return x.id === id; })[0]; return m ? m.nom : id; };
    S.taula = new Tabulator('#gsTaula', {
      data: dadesEquips(), index: 'id_equip', layout: 'fitDataStretch', height: alcada(),
      columns: [
        { title: 'Codi', field: 'id_equip', width: 130, editable: function (cell) { return cell.getRow().getData()._nou; }, editor: 'input', headerFilter: 'input' },
        { title: 'Nom', field: 'nom', editor: 'input', minWidth: 200, headerFilter: 'input' },
        { title: 'Tipus', field: 'tipus', editor: 'list', editorParams: { values: { gestio: 'Gestió', docent: 'Docent' } }, formatter: function (c) { return c.getValue() === 'docent' ? 'Docent' : 'Gestió'; }, headerFilter: 'list', headerFilterParams: { values: { gestio: 'Gestió', docent: 'Docent' }, clearable: true } },
        { title: 'Descripció', field: 'descripcio', editor: 'input', minWidth: 200 },
        { title: 'Actiu', field: 'actiu', editor: 'list', editorParams: { values: { si: 'sí', no: 'no' } }, formatter: function (c) { return c.getValue() === 'no' ? 'no' : 'sí'; } },
        { title: 'Membres', field: 'membres', minWidth: 220, cssClass: 'gs-membres', formatter: function (c) { var m = c.getValue() || []; return '<button type="button" class="gs-membres__btn" title="Afegeix o treu membres">' + (m.length ? m.length + ' · ' + esc(m.slice(0, 3).join(', ')) + (m.length > 3 ? '…' : '') : 'Cap membre') + ' <span aria-hidden="true">✎</span></button>'; },
          cellClick: function (e, cell) { var q = cell.getRow().getData(); if (q._nou) return toast('Primer deseu l’equip nou; després hi podreu afegir membres.', true); if (S.brut) return toast('Primer deseu o descarteu els canvis dels equips.', true); editaMembres(q, r.persones || r.professorat || []); } },
        { title: 'Permisos', field: 'permisos', formatter: function (c) { return (c.getValue() || []).map(function (p) { return '<span class="gs-pill">' + esc(nomMod(p.modul)) + ': ' + esc(NOM_NIVELL[p.nivell] || p.nivell) + '</span>'; }).join('') || '—'; } }
      ]
    });
    S.taula.on('cellEdited', function (cell) { cell.getElement().classList.add('gs-canviat'); marcaBrut(true); $('gsEstat').textContent = 'Canvis sense desar als equips'; });
    S.taula.on('tableBuilt', ajustaAlcada);
  }
  // Matriu de permisos: una fila per equip actiu, una columna per mòdul (i «Tots els mòduls»)
  function pintaMatriuPermisos(r) {
    var moduls = [{ id: '*', nom: 'Tots els mòduls' }].concat(r.moduls.filter(function (m) { return m.id !== 'equips'; }));
    var nivellDe = function (q, mod) { var p = (q.permisos || []).filter(function (x) { return x.modul === mod; })[0]; return p ? String(p.nivell).toLowerCase() : ''; };
    var equips = r.equips.filter(function (q) { return q.actiu !== 'no'; });
    var opcions = function (sel, bloq) { return ['<option value="">—</option>'].concat(NIVELLS.map(function (n) { return '<option value="' + n + '"' + (sel === n ? ' selected' : '') + '>' + NOM_NIVELL[n] + '</option>'; })).join(''); };
    $('gsTaula').innerHTML = '<div class="gs-matriu"><table class="gs-form-taula"><thead><tr><th>Equip</th>' + moduls.map(function (m) { return '<th>' + esc(m.nom) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      equips.map(function (q) {
        return '<tr><td><strong>' + esc(q.nom) + '</strong><br><small>' + esc(q.id_equip) + ' · ' + (q.tipus === 'docent' ? 'Docent' : 'Gestió') + ' · ' + (q.membres || []).length + ' membres</small></td>' +
          moduls.map(function (m) {
            var v = nivellDe(q, m.id), bloq = q.id_equip === 'EQ-DIR' && m.id === '*';
            return '<td><select data-eq="' + esc(q.id_equip) + '" data-mod="' + esc(m.id) + '" data-abans="' + esc(v) + '"' + (bloq ? ' disabled title="L’administració global de l’equip directiu no es pot treure des del web"' : '') + '>' + opcions(v) + '</select></td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    ajustaAlcada();
    var sels = $('gsTaula').querySelectorAll('select[data-eq]');
    S.descartaEquips = function () { sels.forEach(function (x) { x.value = x.dataset.abans; x.classList.remove('gs-canviat'); }); };
    sels.forEach(function (x) { x.addEventListener('change', function () {
      x.classList.toggle('gs-canviat', x.value !== x.dataset.abans);
      var n = [].filter.call(sels, function (y) { return y.value !== y.dataset.abans; }).length;
      marcaBrut(n > 0); $('gsEstat').textContent = n ? 'Canvis sense desar: ' + n + (n === 1 ? ' permís' : ' permisos') : '';
    }); });
  }
  function desaMatriuPermisos() {
    var canvis = [].filter.call($('gsTaula').querySelectorAll('select[data-eq]'), function (x) { return x.value !== x.dataset.abans; })
      .map(function (x) { return { id_equip: x.dataset.eq, id_modul: x.dataset.mod, nivell: x.value }; });
    if (!canvis.length) return marcaBrut(false);
    api('permisos_matriu_desa', { canvis: canvis }, 'Desant els permisos…').then(function (r) {
      if (!r.ok) return toast(text(r.error) + (r.id_equip ? ' (' + r.id_equip + ')' : ''), true);
      S.cache = {};   // els nivells poden haver canviat a qualsevol mòdul
      marcaBrut(false); toast('Permisos desats.'); carregaEquips();
    });
  }
  // Membres d'un equip: llista del professorat amb cercador; es desa de cop (membres_desa)
  function editaMembres(q, prof) {
    var sel = (q.membres_ids || []).slice();
    var html = '<p class="gs-ajuda">Marqueu les persones (professorat i PAS) que formen part de <strong>' + esc(q.nom) + '</strong> (' + esc(q.id_equip) + '). Una persona pot ser a diversos equips.</p>' +
      '<input type="search" class="gs-cerca" id="gsMembresCerca" placeholder="Cerca una persona (nom, especialitat o PAS)…" style="max-width:none;width:100%;margin-bottom:8px">' +
      '<p class="gs-compte" id="gsMembresCompte"></p><div class="gs-cols gs-membres__llista">' + prof.map(function (p) {
        return '<label data-nom="' + esc((p.nom + ' ' + p.especialitat).toLowerCase()) + '"><input type="checkbox" value="' + esc(p.id) + '"' + (sel.indexOf(p.id) >= 0 ? ' checked' : '') + '> ' + esc(p.nom) +
          (p.especialitat ? ' <small>· ' + esc(p.especialitat) + '</small>' : '') + (p.baixa ? ' <small>(de baixa)</small>' : '') + '</label>';
      }).join('') + '</div>';
    var compta = function () { var n = $('gsModalText').querySelectorAll('.gs-membres__llista input:checked').length; $('gsMembresCompte').textContent = n + (n === 1 ? ' membre' : ' membres'); };
    pregunta('Membres · ' + q.nom, html, [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa els membres', valor: 1, abans: function () {
      var n = $('gsModalText').querySelectorAll('.gs-membres__llista input:checked').length;
      if (q.id_equip === 'EQ-DIR' && n < 2 && !confirmaDir) { confirmaDir = true; toast('Recomanació: almenys dues persones a l’equip directiu, perquè ningú no es quedi sense accés. Torneu a prémer «Desa els membres» per desar igualment.', true); return false; }
    } }], false).then(function (v) {
      confirmaDir = false;
      if (!v) return;
      api('membres_desa', { id_equip: q.id_equip, membres: sel }, 'Desant els membres…').then(function (r2) {
        if (!r2.ok) return toast(text(r2.error), true);
        delete S.cache.professorat;   // la columna Equips del professorat ha canviat
        toast('Membres desats (' + r2.entren + ' altes, ' + r2.surten + ' baixes).'); obreModul(S.modul);
      });
    });
    var confirmaDir = false;
    compta();
    $('gsModalText').querySelectorAll('.gs-membres__llista input').forEach(function (i) { i.addEventListener('change', function () { if (i.checked) { if (sel.indexOf(i.value) < 0) sel.push(i.value); } else sel = sel.filter(function (x) { return x !== i.value; }); compta(); }); });
    $('gsMembresCerca').addEventListener('input', function () { var t = this.value.trim().toLowerCase(); $('gsModalText').querySelectorAll('.gs-membres__llista label').forEach(function (l) { l.hidden = t && l.dataset.nom.indexOf(t) < 0; }); });
  }
  function desaEquips() {
    var equips = S.taula.getData().map(function (q) { return { id_equip: q.id_equip, nom: q.nom, tipus: q.tipus, descripcio: q.descripcio, actiu: q.actiu }; });
    api('equips_desa', { equips: equips }, 'Desant els equips…').then(function (r) {
      if (!r.ok) return toast(text(r.error) + (r.id_equip ? ' (' + r.id_equip + ')' : '') + (r.camp ? ' (' + r.camp + ')' : ''), true);
      marcaBrut(false); toast('Equips desats.'); obreModul(S.modul);
    });
  }

  // Descartar: es torna a la còpia desada que ja és al navegador; no es crida el servidor ni es toca el full
  function descarta() {
    if (S.modul.id === 'equips') { if (S.descartaEquips) S.descartaEquips(); marcaBrut(false); toast('Canvis descartats.'); return; }
    S.canvis = {}; S.altes = {}; marcaBrut(false);
    S.taula.replaceData(S.d.files.map(copia)).then(function () { aplicaFiltre(); });
    toast('Canvis descartats.');
  }

  // ------------------------------------------------------------------ esdeveniments
  $('gsEines').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accio]'); if (!b) return;
    switch (b.dataset.accio) {
      case 'alta': alta(); break;
      case 'importa': importaFitxer(); break;
      case 'tancament': tancamentCurs(); break;
      case 'aplica-seleccio': aplicaSeleccio(); break;
      case 'treu-seleccio': if (S.taula) S.taula.deselectRow(); break;
      case 'recarrega': if (S.brut) toast('Primer deseu o descarteu els canvis de la graella.', true); else { delete S.cache[S.modul.id]; carregaDades(); } break;
      case 'columnes': triaColumnes(); break;
      case 'xlsx': exporta('xlsx'); break;
      case 'pdf': exporta('pdf'); break;
      case 'camps': if (S.brut) toast('Primer deseu o descarteu els canvis de la graella.', true); else editaCamps(); break;
      case 'vista-equips': case 'vista-permisos':
        if (S.brut) { toast('Primer deseu o descarteu els canvis.', true); break; }
        S.vistaEquips = b.dataset.accio === 'vista-permisos' ? 'permisos' : 'equips'; pintaVistaEquips(); break;
      case 'nou-equip': S.taula.addRow({ _nou: true, id_equip: 'EQ-', nom: '', tipus: 'gestio', descripcio: '', actiu: 'si', membres: [], permisos: [] }, true).then(function (row) { row.getCell('id_equip').edit(); }); marcaBrut(true); break;
    }
  });
  $('gsBarra').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accio]'); if (!b) return;
    if (b.dataset.accio === 'desa') { if (S.modul.id === 'equips') { if (S.vistaEquips === 'permisos') desaMatriuPermisos(); else desaEquips(); } else desa(false); }
    if (b.dataset.accio === 'descarta') descarta();
  });

  window.GestioApp = { S: S };   // per a les proves
  comprova();
})();
