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
    curs_invalid: 'El curs de config › curs no té el format aaaa-aaaa.',
    no_existeix: 'Aquest alumne ja no és a la base de dades. Actualitzeu la llista.'
  };
  var ERRORS_CAMP = {
    obligatori: 'és obligatori', massa_llarg: 'és massa llarg', numero_invalid: 'ha de ser un número', data_invalida: 'ha de ser una data',
    si_no_invalid: 'ha de ser sí o no', correu_invalid: 'no és un correu vàlid', correu_domini: 'ha de ser un correu ', valor_no_permes: 'no és un dels valors de la llista',
    repetit: 'està repetit (ja el té una altra persona)', no_existeix: 'aquesta fila ja no existeix',
    nif_invalid: 'no és un DNI o NIE vàlid (8 xifres i lletra, o X/Y/Z, 7 xifres i lletra)',
    no_aplica_1r: 'no s’omple a 1r d’ESO (el grup anterior, només si repeteix 1r)', grup_nivell: 'no és del nivell de l’alumne (p. ex. 2n ESO → 2n ESO A…)',
    estat_nivell: 'no és possible per al nivell (només es pot repetir el mateix nivell; a 1r d’ESO no hi ha «promociona»)',
    no_aplica_nivell: 'no s’omple en aquest nivell (p. ex. camps de 4t, optatives de cursos superiors o matèries de l’altre curs de batxillerat)'
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
  // Regles entre camps (les mateixes que l'Apps Script). ALUMNAT ESO i BATXILLERAT (PAS 29): camp «nivell» (si és
  // buit, el del grup actual), camps que només s'omplen en alguns nivells i «repeteix» del mateix nivell.
  var ETAPES = {
    alumnat: { nivells: ['1r ESO', '2n ESO', '3r ESO', '4t ESO'], repeteix: function (n) { return 'repeteix ' + String(n).split(' ')[0]; }, primerSensePromocio: true },
    batxillerat: { nivells: ['1r BAT', '2n BAT'], repeteix: function (n) { return 'repeteix ' + n; }, primerSensePromocio: false }
  };
  var QUART_ESO = ['itinerari', 'franja1', 'franja2', 'franja3', 'mates_orientacio', 'mates_pares', 'catala_4t', 'castella_4t'];
  function aplica(modul, clau, n) {
    if (!n) return true;
    if (modul === 'alumnat') {
      if (clau === 'optativa_2n') return n >= 2;
      if (clau === 'optativa_3r') return n >= 3;
      if (QUART_ESO.indexOf(clau) >= 0) return n === 4;
    }
    if (modul === 'batxillerat') {
      if (/^m1_/.test(clau)) return n === 1;
      if (/^m2_/.test(clau) || clau === 'materies_soltes') return n === 2;
    }
    return true;
  }
  var esAlumnat = function () { return !!(S.modul && ETAPES[S.modul.id]); };
  var esRegistre = function () { return !!(S.modul && S.modul.id === 'control_entrada'); };
  var etapa = function () { return ETAPES[S.modul.id]; };
  var nivellDeGrup = function (g) { g = String(g || '').toUpperCase(); if (!esAlumnat()) return ''; var N = etapa().nivells; for (var i = 0; i < N.length; i++) if (g.indexOf(N[i].toUpperCase()) === 0) return N[i]; return ''; };
  var nivellAlumne = function (d) { return esAlumnat() ? etapa().nivells.indexOf(nivellDeGrup(d.nivell || d.grup_actual)) + 1 : 0; };
  var senseGrupAnterior = function (d) { var E = esAlumnat() && etapa(); return !!E && E.primerSensePromocio && nivellAlumne(d) === 1 && d.estat !== E.repeteix(E.nivells[0]); };
  var noAplica = function (clau, d) { return esAlumnat() && !aplica(S.modul.id, clau, nivellAlumne(d)); };
  var restringit = function (clau) { return esAlumnat() && etapa().nivells.some(function (x, i) { return !aplica(S.modul.id, clau, i + 1); }); };
  var esMateria = function (clau) { return S.modul && S.modul.id === 'batxillerat' && /^m[12]_/.test(clau); };
  // Estats que té sentit triar per al nivell de la fila
  function estatsPossibles(d, ops) {
    var E = etapa(), n = nivellAlumne(d), niv = E.nivells[n - 1];
    if (!niv) return ops;
    return ops.filter(function (o) { if (/^repeteix /.test(o)) return o === E.repeteix(niv); return !(o === 'promociona' && E.primerSensePromocio && n === 1); });
  }
  function reglaAlumnat(d) {
    var E = etapa(), n = nivellAlumne(d), niv = E.nivells[n - 1] || '';
    if (d.nivell && String(d.grup_actual || '').trim() && String(d.grup_actual).indexOf(d.nivell) !== 0) return { error: 'grup_nivell', camp: 'grup_actual' };
    var fora = Object.keys(d).filter(function (k) { return k.charAt(0) !== '_' && !Array.isArray(d[k]) && String(d[k] == null ? '' : d[k]).trim() && !aplica(S.modul.id, k, n); })[0];
    if (fora) return { error: 'no_aplica_nivell', camp: fora };
    if (E.primerSensePromocio && n === 1 && String(d.grup_anterior || '').trim() && d.estat !== E.repeteix(niv)) return { error: 'no_aplica_1r', camp: 'grup_anterior' };
    if (d.estat && niv) {
      if (/^repeteix /.test(d.estat) && d.estat !== E.repeteix(niv)) return { error: 'estat_nivell', camp: 'estat' };
      if (E.primerSensePromocio && n === 1 && d.estat === 'promociona') return { error: 'estat_nivell', camp: 'estat' };
    }
    return null;
  }
  var regla = function (d) { return esAlumnat() ? reglaAlumnat(d) : null; };
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
    batxillerat: '<svg class="prog-apartat__icon" aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 8h22l6 6v26H10z"/><path d="M32 8v6h6"/><path class="prog-apartat__acc" d="M16 22h16M16 28h16M16 34h10"/></svg>',
    nou_professor: '<svg class="prog-apartat__icon" aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="19" cy="16" r="6"/><path d="M7 38c0-7 5-12 12-12 4 0 7 1.5 9 4"/><path class="prog-apartat__acc" d="M36 26v12M30 32h12"/></svg>',
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
    if (m) { window.scrollTo(0, 0); obreModul(m); } else { clearInterval(vigila.t); tancaAjuda(); $('gsInici').hidden = false; if (h) history.replaceState(null, '', location.pathname); window.scrollTo({ top: $('gsApp').offsetTop - 90, behavior: 'smooth' }); }
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
    var fn = document.querySelector('#gsTaula.gs-nou'); if (fn) fn.style.maxHeight = h;
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
    $('gsManual').href = '/assets/docs/gestio/manual-' + m.id.replace(/_/g, '-') + '.pdf';
    tancaAjuda();
    $('gsAvis').hidden = true; $('gsEines').innerHTML = ''; $('gsTaula').innerHTML = ''; $('gsMobil').hidden = true; $('gsBarra').hidden = true;
    destrueixTaula(); clearInterval(vigila.t); amagaAvisCanvis();
    if (m.id === 'equips') return carregaEquips();
    if (m.id === 'nou_professor') return carregaNouProfessor();
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
  // PAS 29 · Cada minut es pregunta qui ha desat l'últim aquest mòdul. Si és una altra persona, un avís ho diu
  // (amb «Actualitza»); els canvis propis sense desar no es toquen i, en desar, es combinen (vegeu combina).
  var vigila = { t: 0 };
  function vigilaCanvis() {
    clearInterval(vigila.t);
    if (!S.d || !S.d.versio || !S.modul) return;
    var modul = S.modul.id;
    vigila.t = setInterval(function () { if (!document.hidden) comprovaVersio(modul); }, 60000);
  }
  function comprovaVersio(modul) {
    if (!S.modul || S.modul.id !== modul) return Promise.resolve();
    return api('versio', { modul: modul }).then(function (r) {
      if (!r.ok || !r.versio || !S.d || !S.d.versio || S.modul.id !== modul) return;
      if (r.versio.data && r.versio.data !== S.d.versio.data && String(r.versio.per).toLowerCase() !== String(S.sessio.email).toLowerCase()) avisCanvis(r.versio);
    });
  }
  function avisCanvis(v) {
    var a = $('gsCanvisAltres');
    if (!a) { a = document.createElement('p'); a.id = 'gsCanvisAltres'; a.className = 'prog-avis gs-avis-canvis'; a.setAttribute('role', 'status'); $('gsEines').parentNode.insertBefore(a, $('gsEines')); }
    a.innerHTML = '<strong>' + esc(v.per) + '</strong> ha desat canvis en aquest mòdul (' + esc(String(v.data).slice(11, 16)) + '). ' +
      (S.brut ? 'Els vostres canvis sense desar es conserven: en desar, es combinaran amb els seus.' : '') + ' <button type="button" class="prog-btn prog-btn--sm" data-accio="recarrega">Actualitza</button>';
    a.hidden = false; ajustaAlcada();
  }
  function amagaAvisCanvis() { var a = $('gsCanvisAltres'); if (a && !a.hidden) { a.hidden = true; ajustaAlcada(); } }
  function mostraDades(d) {
    destrueixTaula();
    S.d = d; S.canvis = {}; S.altes = {}; marcaBrut(false);
    $('gsAvis').hidden = true; amagaAvisCanvis(); vigilaCanvis();
    if (!d.obert && nivellIdx(d.nivell) >= 1) { $('gsAvis').textContent = text('tancat'); $('gsAvis').hidden = false; }
    pintaEines(); pintaTaula();
  }
  var potEditar = function () { return S.d && nivellIdx(S.d.nivell) >= 1 && S.d.obert; };
  var esAdmin = function () { return S.d && S.d.nivell === 'admin'; };
  var editable = function (c) { return potEditar() && !esRegistre() && c.tipus !== 'calculat' && c.origen !== 'clickedu'; };
  // Per fila: a l'alumnat no s'editen els camps que no són del nivell de l'alumne (surten ratllats)
  var editableFila = function (c, d) {
    if (!editable(c)) return false;
    if (!esAlumnat()) return true;
    if (noAplica(c.clau, d)) return false;
    return !(c.clau === 'grup_anterior' && senseGrupAnterior(d));
  };

  function pintaEines() {
    var ed = potEditar(), ambEstat = S.d.camps.some(function (c) { return c.clau === 'estat'; });
    if (esRegistre()) {
      // CONTROL D'ENTRADA: «Nova entrada» (edició) i «Anàlisi» (consulta); les entrades no s'editen a la cel·la
      $('gsEines').innerHTML = '<span class="gs-compte" id="gsCompte"></span><span class="gs-espai"></span>' +
        (ed ? '<button type="button" class="prog-btn" data-accio="entrada-nova">+ Nova entrada</button>' : '') +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="entrada-analisi">Anàlisi</button>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Visualització camps</button>' +
        (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="camps">Gestió camps</button>' : '') +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="recarrega" title="Torna a llegir les dades del full">Actualitza</button>' +
        '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button></span>';
      return;
    }
    $('gsEines').innerHTML =
      (ambEstat ? '<label class="gs-check"><input type="checkbox" id="gsBaixes"' + (S.baixes ? ' checked' : '') + '> Mostra també les baixes</label>' : '') +
      '<span class="gs-compte" id="gsCompte"></span>' +
      (ed ? '<span class="gs-seleccio" id="gsSeleccio" hidden><span id="gsSelN"></span> <button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="aplica-seleccio">Aplica a la selecció…</button> <button type="button" class="gs-enllac" data-accio="treu-seleccio">Treu la selecció</button></span>' : '') +
      '<span class="gs-espai"></span>' +
      (ed ? '<button type="button" class="prog-btn" data-accio="alta">+ Afegeix ' + esc(S.d.nom_fila || 'fila') + '</button>' : '') +
      (ed ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="importa" title="Alta massiva a partir d’un fitxer Excel o CSV">Importa fitxer</button>' : '') +
      (esAlumnat() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="totals" title="Alumnes per nivell i grup">Nombres totals</button><button type="button" class="prog-btn prog-btn--ghost" data-accio="analisi" title="Comptadors per grup d’un nivell">Anàlisi</button>' : '') +
      (S.modul.id === 'professorat' && ed ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="llistat" title="PDF per recollir signatures en una reunió">Llistat</button>' : '') +
      (ed && esAlumnat() && S.d.camps.some(function (c) { return c.clau === 'decisio_final'; }) ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="tancament" title="Promocions, repeticions i baixes de final de curs">Tancament de curs</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Visualització camps</button>' +
      (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="camps">Gestió camps</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="recarrega" title="Torna a llegir les dades del full">Actualitza</button>' +
      '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button></span>';
    if ($('gsBaixes')) $('gsBaixes').addEventListener('change', function () { S.baixes = this.checked; aplicaFiltre(); });
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
  function filtreDe(c, compacte) {
    var opts = c.tipus === 'si_no' ? function () { return [{ v: 'sí', t: 'sí' }, { v: '', t: 'no' }]; }
      : c.tipus === 'llista' ? function () { return c.valors.split('|').map(function (x) { x = x.trim(); return { v: x, t: x }; }).concat([BUIT]); }
      : function () { return valorsDiferents(c.clau); };
    var norm = function (v) { v = v == null ? '' : String(v).trim(); return c.tipus === 'si_no' ? (v === 'sí' ? 'sí' : '') : v; };
    return {
      headerFilter: function (cell, onRendered, success) { var el = filtreMultiple(c.nom, opts, success, cell.getValue()); if (compacte) el.classList.add('gs-filtre--compacte'); return el; },
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
    S.filtreFn = {};
    var cols = [];
    // Selecció de files (casella) per aplicar un mateix valor a moltes files: p. ex. «Decisió final» d'un grup sencer
    if (ed && !esRegistre()) cols.push({ formatter: 'rowSelection', titleFormatter: 'rowSelection', titleFormatterParams: { rowRange: 'active' }, field: '_sel', frozen: true,
      headerSort: false, download: false, width: 44, minWidth: 44, resizable: false, hozAlign: 'center', headerHozAlign: 'center', cssClass: 'gs-sel', cellClick: function (e, cell) { if (e.target.tagName !== 'INPUT') cell.getRow().toggleSelect(); } });
    if (ed && esRegistre()) cols.push({ title: '', field: '_acc', frozen: true, headerSort: false, download: false, width: 44, cssClass: 'gs-accions',
      formatter: function () { return '<span class="gs-acc"><button type="button" class="gs-perill gs-paperera" data-a="esborra" title="Esborra aquesta entrada (feta per error)" aria-label="Esborra l’entrada">' + PAPERERA + '</button></span>'; },
      cellClick: function (e, cell) { var b = e.target.closest('button[data-a]'); if (b) accioFila(b.dataset.a, cell.getRow()); } });
    else if (ed) cols.push({ title: '', field: '_acc', frozen: true, headerSort: false, download: false, width: adm ? 118 : 92, cssClass: 'gs-accions',
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
      S.filtreFn[c.clau] = col.headerFilterFunc;
      if (FIXADES.indexOf(c.clau) >= 0) col.frozen = true;
      if (editable(c)) {
        Object.assign(col, editorDe(c));
        col.editable = function (cell) { return editableFila(c, cell.getRow().getData()); };
        // Estat de l'alumnat: només els valors possibles per al nivell del grup
        if (esAlumnat() && c.clau === 'estat') col.editorParams = function (cell) { var ops = c.valors.split('|').map(function (x) { return x.trim(); }); return { values: estatsPossibles(cell.getRow().getData(), ops) }; };
        if (esAlumnat() && c.clau === 'grup_anterior') col.cssClass = 'gs-ant';
      }
      if (c.clau === 'estat') col.formatter = function (cell) { var v = cell.getValue() || ''; return v ? '<span class="gs-estat gs-estat--' + esc(v.replace(/\s+/g, '-')) + '">' + esc(v) + '</span>' : ''; };
      if (c.tipus === 'si_no') col.formatter = function (cell) { return cell.getValue() === 'sí' ? '<span class="gs-si">sí</span>' : ''; };
      // Batxillerat (PAS 29): matèries en columnes estretes, nom en vertical i el nombre d'alumnes (de les files filtrades) a dalt
      if (esMateria(c.clau)) {
        Object.assign(col, { width: 40, minWidth: 36, maxWidth: 60, hozAlign: 'center', headerHozAlign: 'center', headerSort: false, cssClass: 'gs-mat',
          titleFormatter: function () { return '<span class="gs-vt" title="' + esc(c.nom) + '">' + esc(c.nom) + '</span><span class="gs-recompte" data-camp="' + esc(c.clau) + '" title="Alumnes amb ' + esc(c.nom) + ' (files filtrades)"></span>'; },
          formatter: function (cell) { return cell.getValue() === 'sí' ? '<span class="gs-si" aria-label="sí">✓</span>' : ''; } }, filtreDe(c, true));
      }
      if (c.tipus === 'numero') { col.hozAlign = 'right'; col.sorter = 'number'; }
      cols.push(col);
    });
    if (S.d.amb_equips) cols.push(Object.assign({ title: 'Equips', field: 'equips', minWidth: 140, headerSort: false,
      formatter: function (cell) { return (cell.getValue() || []).map(function (id) { return '<span class="gs-pill" title="' + esc(nomEquip(id)) + '">' + esc(id.replace(/^EQ-/, '')) + '</span>'; }).join(''); },
      accessorDownload: function (v) { return (v || []).join(', '); },
      editable: ed && S.d.admin_global, editor: 'list', editorParams: { values: (S.d.equips || []).reduce(function (o, e) { o[e.id] = e.nom; return o; }, {}), multiselect: true } }, filtreEquips()));
    if (S.d.amb_equips) S.filtreFn.equips = cols[cols.length - 1].headerFilterFunc;
    return cols;
  }
  function pintaTaula() {
    var mobil = window.matchMedia('(max-width: 760px)').matches;
    var visibles = guarda.llegeix('cols|' + S.modul.id);
    var cols = columnes();
    if (Array.isArray(visibles)) cols.forEach(function (c) { if (c.field && c.field.charAt(0) !== '_' && c.field !== 'id' && visibles.indexOf(c.field) < 0) c.visible = false; });
    $('gsTaula').hidden = mobil;
    S.taula = new Tabulator('#gsTaula', {
      data: S.d.files.slice().sort(esRegistre() ? function (a, b) { return String(b.data + ' ' + b.hora).localeCompare(String(a.data + ' ' + a.hora)); } : esAlumnat() ? function (a, b) { return nivellAlumne(a) - nivellAlumne(b) || String(a.grup_actual || '').localeCompare(String(b.grup_actual || ''), 'ca') || ordenaCognoms(a, b); } : ordenaCognoms).map(copia),
      index: 'id', columns: cols, layout: 'fitDataStretch', height: alcada(), movableColumns: true, selectableRows: potEditar() ? 'highlight' : false,
      placeholder: 'No hi ha cap fila amb aquests filtres.', columnHeaderVertAlign: 'bottom',
      rowFormatter: function (row) {
        var d = row.getData(); var el = row.getElement(); el.classList.toggle('gs-baixa', deBaixa(d)); el.classList.toggle('gs-nova', String(d.id).indexOf('nou-') === 0);
        el.classList.toggle('gs-sense-ant', esAlumnat() && senseGrupAnterior(d));
        // Cel·les dels camps que no són del nivell de l'alumne: ratllades (no s'editen)
        if (esAlumnat()) row.getCells().forEach(function (ce) { var f = ce.getField(); if (f && restringit(f)) ce.getElement().classList.toggle('gs-na', noAplica(f, d)); });
      }
    });
    S.taula.on('rowSelectionChanged', function (data) { var b = $('gsSeleccio'); if (!b) return; var abans = b.hidden; b.hidden = !data.length; if (abans !== b.hidden) setTimeout(ajustaAlcada, 0); $('gsSelN').textContent = data.length + (data.length === 1 ? ' fila seleccionada' : ' files seleccionades'); });
    S.taula.on('tableBuilt', function () { aplicaFiltre(); ajustaAlcada(); });
    S.taula.on('dataFiltered', function (f, rows) { var c = $('gsCompte'); if (c) c.textContent = rows.length + ' de ' + S.taula.getDataCount() + ' files'; setTimeout(function () { recomptes(); comptesFiltre(); }, 0); });
    S.taula.on('columnMoved', function () { setTimeout(recomptes, 0); });
    S.taula.on('cellEdited', celEditada);
    if (mobil) pintaMobil();
  }
  // PAS 29 · Damunt de cada camp amb un filtre actiu: quantes files compleixen la condició d'aquell filtre
  // (entre les files que es poden veure: sense les baixes, si no es mostren). Les matèries del batxillerat ja tenen el seu comptador.
  function comptesFiltre() {
    if (!S.taula) return;
    var base = S.taula.getData().filter(function (d) { return S.baixes || !deBaixa(d) || !!S.canvis[d.id] || filtreEstat(); });
    var actius = {};
    S.taula.getHeaderFilters().forEach(function (f) { actius[f.field] = f.value; });
    S.taula.getColumns().forEach(function (col) {
      var camp = col.getField(); if (!camp || camp.charAt(0) === '_') return;
      var tit = col.getElement(); if (!tit) return;
      var b = tit.querySelector(':scope > .gs-nfiltre');
      var f = actius[camp], fn = S.filtreFn && S.filtreFn[camp];
      var buit = !f || (typeof f === 'object' && !f.t && !f.s);
      if (buit || !fn || esMateria(camp)) { if (b) b.remove(); return; }
      var n = base.filter(function (d) { return fn(f, d[camp], d); }).length;
      if (!b) { b = document.createElement('span'); b.className = 'gs-nfiltre'; tit.appendChild(b); }
      b.textContent = n + (n === 1 ? ' fila' : ' files'); b.title = n + ' files compleixen el filtre d’aquest camp';
    });
  }
  // Batxillerat: nombre d'alumnes de cada matèria entre les files que es veuen (amb els filtres)
  function recomptes() {
    if (!S.taula || !S.modul || S.modul.id !== 'batxillerat') return;
    var rows = S.taula.getData('active');
    document.querySelectorAll('#gsTaula .gs-recompte').forEach(function (sp) { var k = sp.dataset.camp; sp.textContent = rows.filter(function (r) { return r[k] === 'sí'; }).length; });
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
    if (esAlumnat() && camp === 'grup_actual' && v && !d.nivell && nivellDeGrup(v)) { row.update({ nivell: nivellDeGrup(v) }); registra(d.id, 'nivell', nivellDeGrup(v)); }
    if (esMateria(camp)) recomptes();
    if (esAlumnat() && ['nivell', 'grup_actual', 'estat'].indexOf(camp) >= 0) { row.reformat(); var cg = row.getCell(camp); if (cg && cg.getElement()) cg.getElement().classList.add('gs-canviat'); }   // camps de 2n, grup anterior i opcions d'estat
    // Regles entre camps de la fila (p. ex. alumnat de 1r amb grup 25-26)
    var rg = !err && regla(d);
    if (rg) {
      var cr = row.getCell(rg.camp); if (cr) cr.getElement().classList.add('gs-error');
      var cn = S.d.camps.filter(function (c) { return c.clau === rg.camp; })[0];
      toast((nomComplet(d) ? nomComplet(d) + ': ' : '') + (cn ? cn.nom : rg.camp) + ' ' + ERRORS_CAMP[rg.error] + '.', true);
    } else if (!err) row.getCells().forEach(function (ce) { var cf = ce.getField(); if ((['estat', 'grup_actual', 'grup_anterior'].indexOf(cf) >= 0 || restringit(cf)) && !errorCel(S.d.camps.filter(function (c) { return c.clau === cf; })[0] || {}, ce.getValue())) ce.getElement().classList.remove('gs-error'); });
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
      if (esRegistre()) return pregunta('Esborrar l’entrada', '<p>S’esborrarà l’entrada de <strong>' + esc(d.alumne) + '</strong> del ' + esc(dataCat(d.data)) + ' a les ' + esc(d.hora) + ' (queda una còpia a l’historial).</p>',
        [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Esborra', valor: 1, tipus: 'danger' }]).then(function (v) {
        if (!v) return;
        api('esborra', { modul: S.modul.id, ids: [d.id] }, 'Esborrant…').then(function (r) {
          if (!r.ok) return toast(text(r.error), true);
          row.delete(); S.d.files = S.d.files.filter(function (f) { return f.id !== d.id; }); toast('Entrada esborrada.');
        });
      });
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
      '<ul class="gs-ajuda"><li><strong>Promociona</strong> → nivell següent, estat «promociona». ' + (S.modul.id === 'batxillerat' ? '2n de batxillerat' : '4t d’ESO') + ' acaba l’etapa: estat «baixa».' + (S.modul.id === 'batxillerat' ? ' Les matèries de 1r es buiden en passar a 2n (la còpia les conserva).' : '') + '</li><li><strong>Repeteix</strong> → mateix nivell, estat «repeteix…».</li><li><strong>Baixa</strong> → estat «baixa».</li>' +
      '<li>A tots: el grup actual passa a <strong>grup anterior</strong> i el grup del curs vinent queda <strong>per assignar</strong>; la decisió final es buida.</li>' +
      '<li>El curs passa a ' + esc(a0 ? (a0 + 1) + '-' + any(a0 + 2) : 'el següent') + '. Abans de canviar res es fa una <strong>còpia</strong> de la pestanya (es pot desfer des de l’Apps Script amb <code>' + (S.modul.id === 'batxillerat' ? 'desfesTancamentBatxillerat' : 'desfesTancament') + '</code>).</li></ul>' +
      '<label class="gs-check"><input type="checkbox" id="gsTancaOk"> He revisat les decisions de tots els grups</label>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Tanca el curs', valor: 1, tipus: 'danger', abans: function () { if (!$('gsTancaOk').checked) { toast('Marqueu la casella de revisió.', true); return false; } } }], false).then(function (v) {
      if (!v) return;
      api('tanca_curs', { modul: S.modul.id, curs: S.d.curs }, 'Tancant el curs…').then(function (r) {
        if (!r.ok) {
          var det = r.error === 'nivell_no_existeix' ? ' ' + (r.nivells || []).map(function (n) { return n.alumnes + ' alumnes a ' + n.nivell; }).join(', ') + '. Afegiu el nivell al mòdul (Gestió camps) o canvieu-ne la decisió.' :
            r.error === 'pendents' ? ' (' + r.total + ')' : '';
          return pregunta('No s’ha tancat el curs', '<p>' + esc(text(r.error) + det) + '</p>', [{ t: 'Entesos', valor: 1 }]);
        }
        delete S.cache[S.modul.id];
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
        if (esAlumnat()) { if (!fila.nivell) fila.nivell = nivellDeGrup(fila.grup_actual); if (!fila.estat) fila.estat = 'alumne extern'; }
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
      if (esAlumnat()) { if (!v.nivell) v.nivell = nivellDeGrup(v.grup_actual); if (!v.estat) v.estat = 'alumne extern'; }
      var clau = normTxt([v.cognom1, v.cognom2, v.nom].join(' '));
      var errs = camps.map(function (c) { var e = errorCel(c, v[c.clau]); return e ? c.nom + ' ' + (ERRORS_CAMP[e] || e) : ''; }).filter(Boolean);
      var rg = regla(v); if (rg) { var cn = camps.filter(function (c) { return c.clau === rg.camp; })[0]; errs.push((cn ? cn.nom : rg.camp) + ' ' + ERRORS_CAMP[rg.error]); }
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

  // PAS 29 · Dues persones alhora. Si algú altre ha desat alguna de les mateixes files mentre editàveu, es llegeixen les
  // dades noves: els camps que només ha canviat l'altra persona s'hi incorporen i els vostres es mantenen. Si tots dos
  // heu canviat el mateix camp d'una fila, es pregunta quin valor es queda. No es perd cap canvi sense desar.
  function combina(conflictes) {
    api('dades', { modul: S.modul.id }, 'Comprovant els canvis de l’altra persona…').then(function (d) {
      if (!d.ok) return toast(text(d.error), true);
      var nous = {}; d.files.forEach(function (f) { nous[f.id] = f; });
      var xocs = [], combinades = 0, desaparegudes = [];
      conflictes.forEach(function (c) {
        var meu = S.canvis[c.id]; if (!meu) return;
        var abans = S.d.files.filter(function (f) { return f.id === c.id; })[0] || {}, ara = nous[c.id];
        if (!ara) { desaparegudes.push(c.id); return; }
        var seus = Object.keys(ara).filter(function (k) { return k !== 'data' && k !== 'desat_per' && JSON.stringify(ara[k] == null ? '' : ara[k]) !== JSON.stringify(abans[k] == null ? '' : abans[k]); });
        var comuns = seus.filter(function (k) { return Object.prototype.hasOwnProperty.call(meu.valors, k) && JSON.stringify(meu.valors[k]) !== JSON.stringify(ara[k]); });
        // La fila «desada» passa a ser la nova; a la graella, els camps de l'altra persona; els meus es mantenen
        meu.data_anterior = ara.data || '';
        S.d.files = S.d.files.map(function (f) { return f.id === c.id ? copia(ara) : f; });
        var row = S.taula.getRow(c.id), upd = {};
        seus.forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(meu.valors, k)) upd[k] = ara[k]; });
        if (row && Object.keys(upd).length) row.update(upd);
        if (comuns.length) xocs.push({ id: c.id, qui: c.desat_per, nom: nomComplet(ara), camps: comuns.map(function (k) { return { k: k, seu: ara[k], meu: meu.valors[k] }; }) });
        else combinades++;
      });
      if (desaparegudes.length) desaparegudes.forEach(function (id) { delete S.canvis[id]; });
      if (!xocs.length) { toast('S’han combinat els canvis de l’altra persona (' + combinades + (combinades === 1 ? ' fila' : ' files') + '). Desant…'); return desa(false); }
      var nomCamp = function (k) { var c = S.d.camps.filter(function (x) { return x.clau === k; })[0]; return c ? c.nom : k; };
      var html = '<p>Mentre editàveu, una altra persona ha canviat <strong>els mateixos camps</strong> d’aquestes files. Els altres canvis ja s’han combinat. Trieu quin valor es queda:</p>' +
        '<table class="gs-form-taula"><thead><tr><th>Fila</th><th>Camp</th><th>L’altra persona</th><th>Vosaltres</th></tr></thead><tbody>' +
        xocs.map(function (x) { return x.camps.map(function (c, i) { return '<tr>' + (i ? '<td></td>' : '<td><strong>' + esc(x.nom || x.id) + '</strong>' + (x.qui ? '<br><small>' + esc(x.qui) + '</small>' : '') + '</td>') + '<td>' + esc(nomCamp(c.k)) + '</td><td>' + esc(c.seu || '—') + '</td><td>' + esc(c.meu || '—') + '</td></tr>'; }).join(''); }).join('') +
        '</tbody></table>';
      pregunta('Canvis al mateix camp', html, [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Accepta els seus', valor: 'seus' }, { t: 'Mantén els meus', valor: 'meus' }], false).then(function (v) {
        if (v === 'seus') xocs.forEach(function (x) {
          var row = S.taula.getRow(x.id), upd = {};
          x.camps.forEach(function (c) { delete S.canvis[x.id].valors[c.k]; upd[c.k] = c.seu; if (row && row.getCell(c.k)) row.getCell(c.k).getElement().classList.remove('gs-canviat'); });
          if (row) row.update(upd);
          if (!Object.keys(S.canvis[x.id].valors).length) delete S.canvis[x.id];
        });
        if (v) desa(false); else marcaBrut(true);
      });
    });
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
        if (r.versio) { S.d.versio = r.versio; amagaAvisCanvis(); }
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
      if (r.error === 'conflicte') return combina(r.conflictes || []);
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

  // ------------------------------------------------------------------ informes en una finestra, amb PDF (PAS 29)
  // files: arrays de cel·les o { s: 'Títol de secció' } o { t: [cel·les] } (fila de total, en negreta)
  var dataCat = function (x) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(x || ''); };
  function informe(titol, subtitol, cap, files, nomFitxer) {
    // Columnes numèriques (totes les cel·les són xifres): alineades a la dreta, aquí i al PDF
    var nums = cap.map(function (c, j) { return j > 0 && files.every(function (f) { var r = f.s ? null : (f.t || f); return !r || /^\d*$/.test(String(r[j] == null ? '' : r[j])); }); });
    var cel = function (x, j) { return '<td' + (nums[j] ? ' class="gs-num"' : '') + '>' + esc(x) + '</td>'; };
    var html = '<p class="gs-ajuda">' + esc(subtitol) + '</p><div class="gs-informe"><table class="gs-form-taula gs-informe__taula"><thead><tr>' +
      cap.map(function (c, j) { return '<th' + (nums[j] ? ' class="gs-num"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      files.map(function (f) {
        if (f.s) return '<tr class="gs-informe__seccio"><td colspan="' + cap.length + '">' + esc(f.s) + '</td></tr>';
        if (f.t) return '<tr class="gs-informe__total">' + f.t.map(cel).join('') + '</tr>';
        return '<tr>' + f.map(cel).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    var colPdf = {}; nums.forEach(function (n, j) { if (n) colPdf[j] = { halign: 'right' }; });
    return pregunta(titol, html, [{ t: 'PDF', valor: 0, tipus: 'ghost', abans: function () { pdfInforme(titol, subtitol, cap, files, nomFitxer, { esquerra: true, columnes: colPdf }); return false; } }, { t: 'Tanca', valor: 1 }], false);
  }
  // El mateix disseny que l'exportació a PDF de la graella
  function pdfInforme(titol, subtitol, cap, files, nom, opcions) {
    opcions = opcions || {};
    var crida = carregaScript(LIBS.jspdf).then(function () { return carregaScript(LIBS.autotable); }).then(function () {
      var doc = new window.jspdf.jsPDF({ orientation: opcions.vertical || cap.length <= 7 ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' });
      var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
      var data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      var cos = files.map(function (f) {
        if (f.s) return [{ content: f.s, colSpan: cap.length, styles: { fillColor: [238, 240, 255], textColor: [28, 12, 188], fontStyle: 'bold' } }];
        if (f.t) return f.t.map(function (x) { return { content: x, styles: { fontStyle: 'bold', fillColor: [246, 247, 252] } }; });
        return f;
      });
      var y0 = opcions.capcalera ? opcions.capcalera(doc, M, W) : 24;
      var colEst = {}; cap.forEach(function (c, j) { if (j && !opcions.esquerra) colEst[j] = { halign: 'right' }; });
      Object.assign(colEst, opcions.columnes || {});
      doc.autoTable({
        head: [cap], body: cos, startY: y0, margin: { top: 24, left: M, right: M, bottom: 12 }, columnStyles: colEst,
        styles: Object.assign({ font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle', lineColor: [225, 229, 238], lineWidth: 0.1 }, opcions.estils || {}),
        headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: opcions.sensAlternes ? { fillColor: [255, 255, 255] } : { fillColor: [247, 248, 252] },
        didDrawPage: function () {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(28, 12, 188);
          doc.text(titol.toUpperCase() + ' · Institut Joan Miró', M, 12);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120);
          doc.text(doc.splitTextToSize(data + ' · ' + subtitol, W - 2 * M)[0], M, 17);
          doc.text('Pàgina ' + doc.internal.getNumberOfPages(), W - M, H - 6, { align: 'right' });
        }
      });
      doc.save(nom + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
    });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  var viusAlumnat = function () { return S.d.files.filter(function (f) { return !deBaixa(f); }); };
  var ordreGrup = function (a, b) { return String(a).localeCompare(String(b), 'ca', { numeric: true }); };
  // Nombres totals: alumnes (sense baixes) per nivell i grup; al batxillerat, també per itinerari
  function nombresTotals() {
    var E = etapa(), bat = S.modul.id === 'batxillerat', vius = viusAlumnat();
    var its = bat ? ((S.d.camps.filter(function (c) { return c.clau === 'itinerari'; })[0] || {}).valors || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean) : [];
    var cap = ['Grup-Classe'].concat(its, bat ? ['Sense itinerari'] : [], ['Alumnes']), files = [], total = 0;
    E.nivells.forEach(function (niv) {
      var del = vius.filter(function (f) { return f.nivell === niv; }); if (!del.length) return;
      files.push({ s: niv });
      var grups = {}; del.forEach(function (f) { var g = f.grup_actual || '(per assignar)'; (grups[g] = grups[g] || []).push(f); });
      var fila = function (llista) { return its.map(function (it) { return llista.filter(function (f) { return f.itinerari === it; }).length; }).concat(bat ? [llista.filter(function (f) { return its.indexOf(f.itinerari) < 0; }).length] : [], [llista.length]); };
      Object.keys(grups).sort(ordreGrup).forEach(function (g) { files.push([g].concat(fila(grups[g]))); });
      files.push({ t: ['Total ' + niv].concat(fila(del)) }); total += del.length;
    });
    if (bat || E.nivells.length > 1) files.push({ t: ['TOTAL'].concat(fila2(vius, its, bat)) });
    function fila2(llista) { return its.map(function (it) { return llista.filter(function (f) { return f.itinerari === it; }).length; }).concat(bat ? [llista.filter(function (f) { return its.indexOf(f.itinerari) < 0; }).length] : [], [llista.length]); }
    informe('Nombres totals · ' + S.modul.nom, 'Alumnes per nivell i grup-classe' + (bat ? ' i itinerari' : '') + ' (sense les baixes). Curs ' + (S.d.curs || '') + '.', cap, files, 'nombres-totals-' + S.modul.id);
  }
  // Anàlisi d'un nivell: comptadors per grup-classe i total del nivell
  function analisiAlumnat() {
    var E = etapa();
    pregunta('Anàlisi · ' + S.modul.nom, '<label class="gs-form-fila">Nivell <select id="gsAnNivell">' + E.nivells.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select></label>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Mostra l’anàlisi', valor: 1, abans: function () { analisiAlumnat.niv = $('gsAnNivell').value; } }]).then(function (v) { if (v) mostraAnalisi(analisiAlumnat.niv); });
  }
  function seccionsAnalisi(niv) {
    var camp = function (k) { return S.d.camps.filter(function (c) { return c.clau === k; })[0]; };
    var V = function (k, titol) { var c = camp(k); return c ? { titol: titol || c.nom, camp: k, valors: (c.valors || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean) } : null; };
    var SI = function (titol, claus) { return { titol: titol, si: claus.filter(camp) }; };
    if (S.modul.id === 'batxillerat') {
      var pre = niv === '1r BAT' ? 'm1_' : 'm2_';
      return [V('itinerari', 'Tipologia de batxillerat (itinerari)'), SI('Matèries', S.d.camps.filter(function (c) { return c.clau.indexOf(pre) === 0; }).map(function (c) { return c.clau; }))];
    }
    if (niv === '4t ESO') return [V('itinerari'), V('franja1'), V('franja2'), V('franja3'), V('mates_orientacio'), V('mates_pares'), V('catala_4t', 'Català'), V('castella_4t', 'Castellà'),
      SI('Diversitat i NESE', ['nouvingut', 'pi_psp', 'nee', 'nese_a', 'nese_b'])];
    var opt = { '1r ESO': 'optativa_1r', '2n ESO': 'optativa_2n', '3r ESO': 'optativa_3r' }[niv];
    return [V(opt, 'Optatives'), SI('Diversitat i NESE', ['div_mates', 'div_catala', 'div_castella', 'nouvingut', 'pi_psp', 'nese_a', 'nese_b'])];
  }
  function mostraAnalisi(niv) {
    var del = viusAlumnat().filter(function (f) { return f.nivell === niv; });
    if (!del.length) return toast('No hi ha alumnes de ' + niv + '.', true);
    var grups = []; del.forEach(function (f) { var g = f.grup_actual || '(per assignar)'; if (grups.indexOf(g) < 0) grups.push(g); }); grups.sort(ordreGrup);
    var perGrup = function (pred) { return grups.map(function (g) { return del.filter(function (f) { return (f.grup_actual || '(per assignar)') === g && pred(f); }).length; }).concat([del.filter(pred).length]); };
    var nomCamp = function (k) { var c = S.d.camps.filter(function (x) { return x.clau === k; })[0]; return c ? c.nom : k; };
    var files = [{ t: ['Alumnes'].concat(perGrup(function () { return true; })) }];
    seccionsAnalisi(niv).filter(Boolean).forEach(function (sec) {
      files.push({ s: sec.titol });
      if (sec.camp) {
        var vals = sec.valors.slice(); del.forEach(function (f) { var v = f[sec.camp]; if (v && vals.indexOf(v) < 0) vals.push(v); });
        vals.forEach(function (v) { files.push([v].concat(perGrup(function (f) { return f[sec.camp] === v; }))); });
        files.push([ '(sense valor)'].concat(perGrup(function (f) { return !f[sec.camp]; })));
      } else sec.si.forEach(function (k) { files.push([nomCamp(k)].concat(perGrup(function (f) { return f[k] === 'sí'; }))); });
    });
    informe('Anàlisi ' + niv, S.modul.nom + ' · ' + del.length + ' alumnes de ' + niv + ' (sense les baixes), per grup-classe i total. Curs ' + (S.d.curs || '') + '.', ['Indicador'].concat(grups, ['Total']), files, 'analisi-' + niv.replace(/\s+/g, '-').toLowerCase());
  }
  // PROFESSORAT · LLISTAT: PDF per recollir signatures (les persones que es veuen ara, sense les baixes)
  function llistatSignatures() {
    var gent = S.taula.getData('active').filter(function (d) { return !deBaixa(d) && String(d.id).indexOf('nou-') !== 0; }).sort(ordenaCognoms);
    var avui = new Date(), iso = avui.getFullYear() + '-' + ('0' + (avui.getMonth() + 1)).slice(-2) + '-' + ('0' + avui.getDate()).slice(-2);
    pregunta('Llistat per signar', '<p class="gs-ajuda">PDF amb <strong>' + gent.length + '</strong> persones: les que es veuen ara a la graella (amb els filtres), sense les baixes, per ordre de cognoms.</p>' +
      '<div class="gs-form-fila"><label>Data <input type="date" id="gsLlData" value="' + iso + '"></label></div>' +
      '<label class="gs-form-fila gs-form-fila--ample">Descripció <textarea id="gsLlDesc" rows="3" placeholder="P. ex. Claustre ordinari"></textarea></label>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Genera el PDF', valor: 1, abans: function () { llistatSignatures.o = { data: $('gsLlData').value, desc: $('gsLlDesc').value.trim() }; } }], false).then(function (v) {
      if (!v) return;
      var o = llistatSignatures.o;
      var cognoms = function (d) { return [d.cognom1, d.cognom2].filter(Boolean).join(' ') + (d.nom ? ', ' + d.nom : ''); };
      pdfInforme('Professorat', gent.length + ' persones', ['', 'Professor/a', 'Signatura'], gent.map(function (d, i) { return [String(i + 1), cognoms(d), '']; }), 'llistat-professorat', {
        vertical: true, esquerra: true, sensAlternes: true,
        estils: { fontSize: 10, minCellHeight: 10, cellPadding: 2 },
        columnes: { 0: { cellWidth: 12, halign: 'right' }, 1: { cellWidth: 95 }, 2: { cellWidth: 'auto' } },
        capcalera: function (doc, M, W) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 42);
          doc.text('Data:', M, 28); doc.setFont('helvetica', 'normal'); doc.text(o.data ? dataCat(o.data) : '____ / ____ / ________', M + 13, 28);
          doc.setFont('helvetica', 'bold'); doc.text('Descripció:', M, 35); doc.setFont('helvetica', 'normal');
          var ll = doc.splitTextToSize(o.desc || '', W - 2 * M - 24); if (!ll.length) ll = [''];
          ll.forEach(function (l, i) { doc.text(l, M + 24, 35 + i * 5); });
          if (!o.desc) { doc.setDrawColor(185, 192, 208); doc.line(M + 24, 36, W - M, 36); }
          return 41 + (ll.length - 1) * 5;
        }
      });
    });
  }
  // CONTROL D'ENTRADA · Nova entrada: triar un alumne (ESO i batxillerat) i desar (data i hora d'ara)
  function novaEntrada() {
    var obre = function (llista) {
      var opcions = function (q) { q = senseAccents(q); return llista.filter(function (a) { return !q || senseAccents(a.nom + ' ' + a.grup).indexOf(q) >= 0; }).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.nom) + ' — ' + esc(a.grup || a.nivell || '') + '</option>'; }).join(''); };
      pregunta('Nova entrada', '<p class="gs-ajuda">Trieu l’alumne (per 1r i 2n cognom). En desar es registra amb la data i l’hora d’ara, el nivell i el grup.</p>' +
        '<input type="search" id="gsEntCerca" class="gs-cerca" placeholder="Escriviu un cognom o el grup…" style="max-width:none;width:100%;margin-bottom:8px" autocomplete="off">' +
        '<select id="gsEntAlumne" size="12" class="gs-ent-llista" aria-label="Alumne">' + opcions('') + '</select>',
        [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa l’entrada', valor: 1, abans: function () { novaEntrada.id = $('gsEntAlumne').value; if (!novaEntrada.id) { toast('Trieu un alumne de la llista.', true); return false; } } }], false).then(function (v) {
        if (!v) return;
        api('entrada_nova', { id_alumne: novaEntrada.id }, 'Desant l’entrada…').then(function (r) {
          if (!r.ok) return toast(text(r.error), true);
          var f = r.fila; S.d.files.push(copia(f)); S.taula.addRow(copia(f), true).then(aplicaFiltre); if (S.d.versio && r.fila) S.d.versio = { data: f.data + ' ' + f.hora, per: S.sessio.email };
          toast('Entrada registrada: ' + f.alumne + ' · ' + f.hora + '.');
        });
      });
      var c = $('gsEntCerca'), sel = $('gsEntAlumne');
      // En cercar, queda triat el primer resultat: Enter desa; amb les fletxes es tria un altre
      c.addEventListener('input', function () { sel.innerHTML = opcions(c.value); if (c.value.trim() && sel.options.length) sel.selectedIndex = 0; });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel.focus(); if (sel.selectedIndex < 0 && sel.options.length) sel.selectedIndex = 0; }
        if (e.key === 'Enter' && sel.value) { e.preventDefault(); $('gsModalBtns').lastChild.click(); }
      });
      sel.addEventListener('keydown', function (e) { if (e.key === 'Enter' && sel.value) { e.preventDefault(); $('gsModalBtns').lastChild.click(); } });
      sel.addEventListener('dblclick', function () { if (sel.value) $('gsModalBtns').lastChild.click(); });
      setTimeout(function () { c.focus(); }, 0);
    };
    if (S.alumnesEntrada) return obre(S.alumnesEntrada);
    api('entrada_alumnes', {}, 'Carregant l’alumnat…').then(function (r) { if (!r.ok) return toast(text(r.error), true); S.alumnesEntrada = r.alumnes; obre(r.alumnes); });
  }
  // CONTROL D'ENTRADA · Anàlisi: entrades per alumne (nivell, grup i data a partir de la qual es compta)
  function analisiEntrades() {
    var files = S.d.files, nivells = [], grups = {};
    files.forEach(function (f) { if (f.nivell && nivells.indexOf(f.nivell) < 0) nivells.push(f.nivell); if (f.grup) (grups[f.nivell || ''] = grups[f.nivell || ''] || []).indexOf(f.grup) < 0 && grups[f.nivell || ''].push(f.grup); });
    var ordre = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT']; nivells.sort(function (a, b) { return ordre.indexOf(a) - ordre.indexOf(b); });
    var opGrups = function (n) { var g = n ? (grups[n] || []) : Object.keys(grups).reduce(function (t, k) { return t.concat(grups[k]); }, []); return '<option value="">Tots</option>' + g.slice().sort(ordreGrup).map(function (x) { return '<option>' + esc(x) + '</option>'; }).join(''); };
    pregunta('Anàlisi del control d’entrada', '<div class="gs-form-fila"><label>Nivell <select id="gsAnEnNiv"><option value="">Tots</option>' + nivells.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select></label>' +
      '<label>Grup-Classe <select id="gsAnEnGrup">' + opGrups('') + '</select></label>' +
      '<label>A partir del <input type="date" id="gsAnEnData"></label></div><p class="gs-ajuda">Sense data, es compta tot el període.</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Mostra l’anàlisi', valor: 1, abans: function () { analisiEntrades.o = { niv: $('gsAnEnNiv').value, grup: $('gsAnEnGrup').value, data: $('gsAnEnData').value }; } }], false).then(function (v) {
      if (!v) return;
      var o = analisiEntrades.o;
      var sel = files.filter(function (f) { return (!o.niv || f.nivell === o.niv) && (!o.grup || f.grup === o.grup) && (!o.data || String(f.data) >= o.data); });
      var per = {}; sel.forEach(function (f) { var k = f.id_alumne || f.alumne; var x = per[k] = per[k] || { alumne: f.alumne, nivell: f.nivell, grup: f.grup, n: 0, ultima: '' }; x.n++; var t = f.data + ' ' + f.hora; if (t > x.ultima) { x.ultima = t; x.grup = f.grup || x.grup; x.nivell = f.nivell || x.nivell; } });
      var llista = Object.keys(per).map(function (k) { return per[k]; }).sort(function (a, b) { return senseAccents(a.alumne).localeCompare(senseAccents(b.alumne), 'ca'); });
      var filtre = [o.niv || 'tots els nivells', o.grup || 'tots els grups', o.data ? 'a partir del ' + dataCat(o.data) : 'tot el període'].join(' · ');
      informe('Control d’entrada · anàlisi', filtre + ' · ' + sel.length + ' entrades de ' + llista.length + ' alumnes.', ['', 'Alumne', 'Nivell', 'Grup-Classe', 'Entrades'],
        llista.map(function (a, i) { return [String(i + 1), a.alumne, a.nivell || '', a.grup || '', String(a.n)]; }).concat(llista.length ? [{ t: ['', 'Total', '', '', String(sel.length)] }] : []), 'control-entrada-analisi');
    });
    $('gsAnEnNiv').addEventListener('change', function () { $('gsAnEnGrup').innerHTML = opGrups(this.value); });
  }

  // ------------------------------------------------------------------ mòdul NOU PROFESSOR/A (PAS 29)
  // Formulari d'alta d'un docent (secretaria). Camps i validació: els del mòdul Professorat. Desa, Cancel·la i PDF per signar.
  var INFO_PROF = {
    nom: 'Nom de pila, tal com consta al DNI o NIE.',
    cognom1: 'Primer cognom, tal com consta al DNI o NIE.',
    cognom2: 'Segon cognom, si en té.',
    estat: 'Situació al claustre: actiu (forma part del claustre d’aquest curs), substitut (temporalment), baixa laboral o baixa (ja no és al centre). Per a una alta, normalment «actiu» o «substitut».',
    nif: 'DNI (8 xifres i la lletra) o NIE (X, Y o Z, 7 xifres i la lletra). Es comprova que la lletra sigui correcta.',
    especialitat: 'Especialitat docent amb què s’incorpora (p. ex. Matemàtiques, Llengua catalana, Tecnologia).',
    email_xtec: 'Correu del Departament d’Educació. Ha d’acabar en @xtec.cat.',
    email: 'Correu del centre, acabat en @institutjoanmiro.cat. És el que farà servir per entrar a GESTIO i a les altres eines del centre. No pot estar repetit.',
    jornada: 'Jornada al centre: sencera, mitja jornada (1/2) o dos terços (⅔).',
    situacio: 'Situació administrativa: definitiu, comissió de serveis, provisional o interí.',
    anys: 'Anys que fa que treballa al centre (un número; 0 si s’incorpora ara).',
    catala: 'Nivell de català acreditat (p. ex. C1, C2).',
    carrec: 'Càrrec al centre, si en té (tutor/a, cap de departament, coordinació…).'
  };
  function carregaNouProfessor() {
    api('nou_professor', {}, 'Preparant el formulari…').then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.d = { nivell: S.modul.nivell, obert: r.obert, camps: r.camps, curs: r.curs, files: [] };
      pintaNouProfessor();
    });
  }
  function pintaNouProfessor(desat) {
    var camps = S.d.camps, ed = S.d.obert;
    $('gsEines').innerHTML = '<p class="gs-ajuda" style="flex:1 1 100%;margin:0">Alta d’un docent nou al professorat. Els camps amb <strong>*</strong> són obligatoris. Passeu el ratolí per la <span class="gs-info-mostra" aria-hidden="true">i</span> de cada camp per veure què cal posar-hi. Després de desar, genereu el PDF perquè el signi.</p>';
    var t = $('gsTaula'); t.className = 'gs-nou';
    t.innerHTML = '<form id="gsNouForm" class="gs-nou__form" novalidate>' + camps.map(function (c) {
      var id = 'gsNou_' + c.clau, info = INFO_PROF[c.clau] || c.nom;
      var camp;
      if (c.tipus === 'llista') camp = '<select id="' + id + '" name="' + esc(c.clau) + '">' + ['<option value="">—</option>'].concat(c.valors.split('|').map(function (o) { o = o.trim(); return '<option' + (c.clau === 'estat' && o === 'actiu' ? ' selected' : '') + '>' + esc(o) + '</option>'; })).join('') + '</select>';
      else if (c.tipus === 'si_no') camp = '<select id="' + id + '" name="' + esc(c.clau) + '"><option value="">no</option><option>sí</option></select>';
      else camp = '<input id="' + id + '" name="' + esc(c.clau) + '" type="' + (c.tipus === 'numero' ? 'number' : c.tipus === 'data' ? 'date' : c.tipus === 'correu' ? 'email' : 'text') + '"' +
        (c.tipus === 'correu' && c.valors ? ' placeholder="nom' + esc(c.valors) + '"' : '') + (c.tipus === 'nif' ? ' style="text-transform:uppercase" placeholder="12345678Z"' : '') + ' autocomplete="off">';
      return '<div class="gs-nou__camp' + (c.clau === 'cognom2' || c.clau === 'carrec' ? '' : '') + '"><label for="' + id + '">' + esc(c.nom) + (c.obligatori ? ' <span class="gs-oblig" title="Obligatori">*</span>' : '') +
        ' <span class="gs-info" tabindex="0" role="note" aria-label="' + esc(info) + '" data-info="' + esc(info) + '">i</span></label>' + camp + '<p class="gs-nou__err" id="' + id + '_err" aria-live="polite"></p></div>';
    }).join('') + '</form>' +
      '<div class="gs-nou__btns">' + (desat ? '<p class="gs-nou__ok">Desat al professorat amb el codi <strong>' + esc(desat) + '</strong>.</p>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="nou-cancel">' + (desat ? 'Nova alta' : 'Cancel·la') + '</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="nou-pdf">PDF per signar</button>' +
      (ed && !desat ? '<button type="button" class="prog-btn" data-accio="nou-desa">Desa</button>' : '') + '</div>';
    S.nouCodi = desat || '';
    var form = $('gsNouForm');
    form.addEventListener('input', function () { if (!S.nouCodi) S.brut = true; });
    camps.forEach(function (c) { var el = $('gsNou_' + c.clau); el.addEventListener('blur', function () { validaCampNou(c); }); el.addEventListener('change', function () { validaCampNou(c); }); });
    if (desat) form.querySelectorAll('input,select').forEach(function (el) { el.disabled = true; });
    ajustaAlcada();
  }
  function valorsNou() {
    var v = {};
    S.d.camps.forEach(function (c) { var el = $('gsNou_' + c.clau); var x = el ? String(el.value || '').trim() : ''; if (c.tipus === 'nif') x = x.toUpperCase().replace(/[\s.\-]/g, ''); if (c.tipus === 'correu') x = x.toLowerCase(); v[c.clau] = x; });
    return v;
  }
  function validaCampNou(c, missatge) {
    var v = valorsNou()[c.clau], err = missatge || errorCel(c, v);
    var p = $('gsNou_' + c.clau + '_err'), el = $('gsNou_' + c.clau);
    // L'espai del missatge sempre hi és: si desaparegués en sortir del camp, els botons es mourien i el clic es perdria
    p.textContent = err ? c.nom + ' ' + (ERRORS_CAMP[err] || err) + (err === 'correu_domini' ? c.valors : '') + '.' : '';
    el.classList.toggle('is-error', !!err); el.setAttribute('aria-invalid', err ? 'true' : 'false');
    return !err;
  }
  function desaNouProfessor() {
    var bons = S.d.camps.map(function (c) { return validaCampNou(c); });
    if (bons.indexOf(false) >= 0) { var primer = document.querySelector('#gsNouForm .is-error'); if (primer) primer.focus(); return toast('Reviseu els camps marcats en vermell.', true); }
    api('alta_professor', { valors: valorsNou() }, 'Desant el docent nou…').then(function (r) {
      if (r.ok) { S.brut = false; delete S.cache.professorat; toast('Docent desat: ' + r.id + '.'); var v = valorsNou(); pintaNouProfessor(r.id); S.d.camps.forEach(function (c) { var el = $('gsNou_' + c.clau); if (el) el.value = v[c.clau] || ''; }); return; }
      if (r.error === 'validacio') {
        var perNom = {}; S.d.camps.forEach(function (c) { perNom[c.nom] = c; });
        (r.errors || []).forEach(function (e) { var c = perNom[e.camp]; if (c) validaCampNou(c, e.error); });
        return toast('No s’ha desat: ' + (r.errors || []).map(function (e) { return e.camp + ' ' + (ERRORS_CAMP[e.error] || e.error); }).join('; ') + '.', true);
      }
      toast(text(r.error), true);
    });
  }
  function cancelaNouProfessor() {
    var fes = function () { S.brut = false; pintaNouProfessor(); };
    if (!S.brut) return fes();
    pregunta('Descartar el formulari', '<p>Es buidaran les dades escrites. Voleu continuar?</p>', [{ t: 'Continua editant', valor: 0, tipus: 'ghost' }, { t: 'Buida el formulari', valor: 1, tipus: 'danger' }]).then(function (v) { if (v) fes(); });
  }
  // PDF amb el mateix aspecte que els altres documents del centre (Montserrat, logo, línia blava) i caselles de signatura i data
  var recursosPdf = null;
  function base64(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.arrayBuffer(); }).then(function (buf) {
      var b = new Uint8Array(buf), t = '', pas = 0x8000; for (var i = 0; i < b.length; i += pas) t += String.fromCharCode.apply(null, b.subarray(i, i + pas)); return btoa(t);
    });
  }
  function preparaPdf() {
    if (!recursosPdf) recursosPdf = carregaScript(LIBS.jspdf).then(function () { return carregaScript(LIBS.autotable); }).then(function () {
      return Promise.all(['/assets/programacions/Montserrat-400.ttf', '/assets/programacions/Montserrat-600.ttf', '/assets/programacions/logo-ijm.png'].map(base64));
    }).then(function (r) { return { regular: r[0], negreta: r[1], logo: 'data:image/png;base64,' + r[2] }; });
    recursosPdf.catch(function () { recursosPdf = null; });
    return recursosPdf;
  }
  function pdfNouProfessor() {
    var bons = S.d.camps.map(function (c) { return validaCampNou(c); });
    if (bons.indexOf(false) >= 0) return toast('Abans de generar el PDF, reviseu els camps marcats en vermell.', true);
    var v = valorsNou();
    var crida = preparaPdf().then(function (R) {
      var BLAU = [28, 12, 188], TARONJA = [232, 96, 12], GRIS = [90, 96, 112], TEXT = [30, 30, 42], VORA = [214, 218, 230];
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), W = 210, H = 297, MX = 18;
      doc.addFileToVFS('Montserrat-400.ttf', R.regular); doc.addFont('Montserrat-400.ttf', 'Montserrat', 'normal');
      doc.addFileToVFS('Montserrat-600.ttf', R.negreta); doc.addFont('Montserrat-600.ttf', 'Montserrat', 'bold');
      doc.addImage(R.logo, 'PNG', MX, 10, 30, 30 * 432 / 1100);
      doc.setFont('Montserrat', 'bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, TARONJA);
      doc.text('GESTIO · ALTA DE PROFESSORAT', W - MX, 13.5, { align: 'right' });
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS);
      doc.text('Institut Joan Miró · Curs ' + (S.d.curs || ''), W - MX, 18, { align: 'right' });
      doc.setDrawColor.apply(doc, BLAU); doc.setLineWidth(0.6); doc.line(MX, 24, W - MX, 24);
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(20); doc.setTextColor.apply(doc, BLAU);
      doc.text('Alta de nou professor/a', MX, 38);
      doc.setFontSize(9.5); doc.setTextColor.apply(doc, GRIS);
      doc.text((S.nouCodi ? 'Codi intern ' + S.nouCodi + ' · ' : 'Pendent de desar · ') + 'Dades per a l’expedient del centre', MX, 45);
      doc.autoTable({
        startY: 51, margin: { left: MX, right: MX }, theme: 'grid',
        body: S.d.camps.map(function (c) { return [c.nom + (c.obligatori ? ' *' : ''), v[c.clau] || '']; }),
        styles: { font: 'Montserrat', fontSize: 9.5, cellPadding: 2.6, textColor: TEXT, lineColor: VORA, lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 58, fontStyle: 'bold', textColor: BLAU, fillColor: [246, 247, 252] } }
      });
      var y = doc.lastAutoTable.finalY + 10;
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, TEXT);
      doc.splitTextToSize('Declaro que les dades d’aquest document són correctes i autoritzo el centre a fer-les servir per a la gestió interna del professorat.', W - 2 * MX).forEach(function (l) { doc.text(l, MX, y); y += 4.4; });
      y += 4;
      var ampleSig = (W - 2 * MX) * 0.62, ampleData = (W - 2 * MX) - ampleSig - 6, alt = 34;
      if (y + alt + 12 > H - 16) { doc.addPage(); y = 30; }
      doc.setDrawColor.apply(doc, VORA); doc.setLineWidth(0.4);
      doc.roundedRect(MX, y, ampleSig, alt, 2, 2); doc.roundedRect(MX + ampleSig + 6, y, ampleData, alt, 2, 2);
      doc.setFont('Montserrat', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, BLAU);
      doc.text('Signatura de la persona interessada', MX + 3, y + 5);
      doc.text('Data', MX + ampleSig + 9, y + 5);
      doc.setFont('Montserrat', 'normal'); doc.setTextColor.apply(doc, GRIS);
      doc.text(nomComplet(v), MX + 3, y + alt - 3);
      doc.text('____ / ____ / ________', MX + ampleSig + 9, y + alt / 2 + 3);
      doc.setFontSize(7); doc.setTextColor.apply(doc, GRIS);
      doc.text('Document generat des de GESTIO el ' + new Date().toLocaleDateString('ca-ES') + '. Els camps amb * són obligatoris.', MX, H - 10);
      doc.save('alta-professor-' + (normNomFitxer(nomComplet(v)) || 'nou') + '.pdf');
    });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  var normNomFitxer = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };

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

  // ------------------------------------------------------------------ ajuda interactiva (PAS 29)
  // Temes del mòdul obert i, als mòduls amb graella, els temes comuns. Cerca sense accents a títol, text i paraules clau.
  var AJUDA = (function () { try { return JSON.parse($('gsAjudaDades').textContent); } catch (e) { return null; } })();
  var senseAccents = function (x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var negretes = function (t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>'); };
  function temesAjuda() {
    if (!AJUDA || !S.modul) return [];
    var m = AJUDA.moduls[S.modul.id] || { titol: S.modul.nom, temes: [], graella: true };
    return m.temes.map(function (t) { return Object.assign({ grup: m.titol }, t); })
      .concat(m.graella ? AJUDA.comu.temes.map(function (t) { return Object.assign({ grup: AJUDA.comu.titol }, t); }) : []);
  }
  function pintaAjuda() {
    var q = senseAccents($('gsAjudaCerca').value.trim()), temes = temesAjuda(), grup = '';
    var bons = temes.filter(function (t) { return !q || q.split(/\s+/).every(function (p) { return senseAccents(t.titol + ' ' + t.claus + ' ' + t.text.join(' ')).indexOf(p) >= 0; }); });
    var m = AJUDA && AJUDA.moduls[S.modul.id];
    $('gsAjudaLlista').innerHTML = (m && !q ? '<p class="gs-ajuda-panell__intro">' + negretes(m.intro) + '</p>' : '') + (bons.length ? bons.map(function (t) {
      var cap = t.grup !== grup ? '<h4 class="gs-ajuda-panell__grup">' + esc(t.grup) + '</h4>' : ''; grup = t.grup;
      var cos = '', llista = false;
      t.text.forEach(function (l) {
        var item = /^- /.test(l);
        if (item && !llista) { cos += '<ul>'; llista = true; } if (!item && llista) { cos += '</ul>'; llista = false; }
        cos += item ? '<li>' + negretes(l.slice(2)) + '</li>' : '<p>' + negretes(l) + '</p>';
      });
      if (llista) cos += '</ul>';
      return cap + '<details class="gs-ajuda-panell__tema"' + (q ? ' open' : '') + '><summary>' + esc(t.titol) + '</summary>' + cos + '</details>';
    }).join('') : '<p class="gs-ajuda-panell__res">No hi ha cap tema amb «' + esc($('gsAjudaCerca').value) + '». Proveu una altra paraula o obriu el manual en PDF.</p>');
  }
  function obreAjuda() {
    $('gsAjudaTitol').textContent = 'Ajuda · ' + (S.modul ? S.modul.nom : 'GESTIO');
    $('gsAjuda').hidden = false; $('gsAjudaBtn').setAttribute('aria-expanded', 'true');
    pintaAjuda(); $('gsAjudaCerca').focus();
  }
  function tancaAjuda() { if ($('gsAjuda')) { $('gsAjuda').hidden = true; $('gsAjudaBtn').setAttribute('aria-expanded', 'false'); } }
  $('gsAjudaBtn').addEventListener('click', function () { if ($('gsAjuda').hidden) obreAjuda(); else tancaAjuda(); });
  $('gsAjudaTanca').addEventListener('click', tancaAjuda);
  $('gsAjudaCerca').addEventListener('input', pintaAjuda);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('gsAjuda').hidden && !document.querySelector('.gs-popover')) tancaAjuda(); });

  // ------------------------------------------------------------------ esdeveniments
  // Botons de la barra d'eines, de l'avís de canvis i del formulari Nou professor/a (la barra de desar va a part)
  $('gsModul').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accio]'); if (!b || b.closest('#gsBarra')) return;
    switch (b.dataset.accio) {
      case 'alta': alta(); break;
      case 'importa': importaFitxer(); break;
      case 'nou-desa': desaNouProfessor(); break;
      case 'totals': nombresTotals(); break;
      case 'analisi': analisiAlumnat(); break;
      case 'llistat': llistatSignatures(); break;
      case 'entrada-nova': novaEntrada(); break;
      case 'entrada-analisi': analisiEntrades(); break;
      case 'nou-cancel': cancelaNouProfessor(); break;
      case 'nou-pdf': pdfNouProfessor(); break;
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

  window.GestioApp = { S: S, comprovaVersio: comprovaVersio };   // per a les proves
  comprova();
})();
