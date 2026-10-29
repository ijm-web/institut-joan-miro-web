/* =====================================================================
   GESTIO · àrea privada de gestió de l'Institut Joan Miró
   - Accés amb Google (funcions /api/gestio/login|api|sortir|config).
   - Portada amb una targeta per mòdul permès (nivell consulta, edició o admin).
   - Mòdul PROFESSORAT: graella (Tabulator) amb filtres per columna, cercador, edició a la cel·la,
     alta, estat (actiu, baixa laboral, substitut, baixa), «Desa els canvis» / «Descarta» (sense tornar al servidor),
     exportació a Excel/PDF, columnes visibles (amb Nom i 1r cognom fixats a l'esquerra),
     camps (admin) i permisos (edició: dona consulta; admin: dona consulta i edició).
   - Mòdul EQUIPS (només admins globals): equips de gestió i docents.
   Qui pot fer què ho decideix l'Apps Script d'ijm_nucli_db; aquí només s'amaguen els botons.
   Rutes: #  ·  #professorat  ·  #equips
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
  var TIPUS = { text: 'Text', numero: 'Número', data: 'Data', llista: 'Llista', si_no: 'Sí / no', correu: 'Correu', calculat: 'Calculat' };

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
    gestio_error_script: 'Hi ha hagut un error dins de l’Apps Script d’ijm_nucli_db.'
  };
  var ERRORS_CAMP = {
    obligatori: 'és obligatori', massa_llarg: 'és massa llarg', numero_invalid: 'ha de ser un número', data_invalida: 'ha de ser una data',
    si_no_invalid: 'ha de ser sí o no', correu_invalid: 'no és un correu vàlid', correu_domini: 'ha de ser un correu ', valor_no_permes: 'no és un dels valors de la llista',
    repetit: 'està repetit (ja el té una altra persona)', no_existeix: 'aquesta fila ja no existeix'
  };
  var text = function (c) { return MISSATGES[c] || MISSATGES.error_servidor; };
  var PAPERERA = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
  var FIXADES = ['nom', 'cognom1'];   // columnes bloquejades a l'esquerra per defecte
  var copia = function (f) { var o = Object.assign({}, f); if (Array.isArray(o.equips)) o.equips = o.equips.slice(); return o; };
  var deBaixa = function (d) { return d.estat === 'baixa'; };

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
  var S = { sessio: null, modul: null, d: null, taula: null, canvis: {}, altes: {}, nTmp: 0, brut: false, baixes: false, cerca: '' };

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
    if (m) { obreModul(m); } else { $('gsInici').hidden = false; if (h) history.replaceState(null, '', location.pathname); }
    window.scrollTo({ top: $('gsApp').offsetTop - 90, behavior: 'smooth' });
  }
  $('gsCrumbInici').addEventListener('click', function (e) { e.preventDefault(); location.hash = ''; });

  function obreModul(m) {
    S.modul = m; S.canvis = {}; S.altes = {}; S.brut = false; S.cerca = '';
    $('gsModul').hidden = false; $('gsCrumbModul').hidden = false; $('gsCrumbModulNom').textContent = m.nom;
    $('gsModulKicker').textContent = 'Mòdul'; $('gsModulTitol').textContent = m.nom.toUpperCase();
    $('gsNivell').innerHTML = 'El vostre nivell: <span class="gs-tag gs-tag--' + esc(m.nivell) + '">' + esc(NOM_NIVELL[m.nivell]) + '</span>';
    $('gsAvis').hidden = true; $('gsEines').innerHTML = ''; $('gsTaula').innerHTML = ''; $('gsMobil').hidden = true; $('gsBarra').hidden = true;
    if (S.taula) { try { S.taula.destroy(); } catch (e) { /* ja destruïda */ } S.taula = null; }
    if (m.id === 'equips') return carregaEquips();
    carregaDades();
  }

  // ------------------------------------------------------------------ mòdul de dades (PROFESSORAT)
  function carregaDades() {
    return api('dades', { modul: S.modul.id }, 'Carregant ' + S.modul.nom.toLowerCase() + '…').then(function (d) {
      if (!d.ok) { $('gsAvis').innerHTML = textError(d); $('gsAvis').hidden = false; return; }
      S.d = d; S.canvis = {}; S.altes = {}; marcaBrut(false);
      if (!d.obert && nivellIdx(d.nivell) >= 1) { $('gsAvis').textContent = text('tancat'); $('gsAvis').hidden = false; }
      pintaEines(); pintaTaula();
    });
  }
  var potEditar = function () { return S.d && nivellIdx(S.d.nivell) >= 1 && S.d.obert; };
  var esAdmin = function () { return S.d && S.d.nivell === 'admin'; };
  var editable = function (c) { return potEditar() && c.tipus !== 'calculat' && c.origen !== 'clickedu'; };

  function pintaEines() {
    var ed = potEditar();
    $('gsEines').innerHTML =
      '<input type="search" class="gs-cerca" id="gsCerca" placeholder="Cerca a totes les columnes…" aria-label="Cerca">' +
      '<label class="gs-check"><input type="checkbox" id="gsBaixes"' + (S.baixes ? ' checked' : '') + '> Mostra també les baixes</label>' +
      '<span class="gs-compte" id="gsCompte"></span><span class="gs-espai"></span>' +
      (ed ? '<button type="button" class="prog-btn" data-accio="alta">+ Afegeix docent</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Columnes</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button>' +
      (nivellIdx(S.d.nivell) >= 1 ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="permisos">Permisos</button>' : '') +
      (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="camps">Camps</button>' : '');
    $('gsCerca').addEventListener('input', function () { S.cerca = this.value.trim().toLowerCase(); aplicaFiltre(); });
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
  function filtreDe(c) {
    if (c.tipus === 'llista') return { headerFilter: 'list', headerFilterParams: { values: c.valors.split('|').map(function (s) { return s.trim(); }), clearable: true }, headerFilterFunc: '=' };
    if (c.tipus === 'si_no') return { headerFilter: 'list', headerFilterParams: { values: { 'sí': 'sí', 'no': 'no' }, clearable: true }, headerFilterFunc: function (f, v) { return f === 'sí' ? v === 'sí' : f === 'no' ? v !== 'sí' : true; } };
    return { headerFilter: 'input', headerFilterPlaceholder: 'Filtra…' };
  }
  function nomEquip(id) { var e = (S.d.equips || []).filter(function (x) { return x.id === id; })[0]; return e ? e.nom : id; }
  function columnes() {
    var ed = potEditar(), adm = esAdmin();
    var cols = [];
    if (ed) cols.push({ title: '', field: '_acc', frozen: true, headerSort: false, download: false, width: adm ? 118 : 92, cssClass: 'gs-accions',
      formatter: function (cell) {
        var r = cell.getRow().getData();
        return '<span class="gs-acc">' + (deBaixa(r) ? '<button type="button" data-a="reactiva">Reactiva</button>' : '<button type="button" data-a="baixa">Baixa</button>') +
          (adm || String(r.id).indexOf('nou-') === 0 ? '<button type="button" class="gs-perill gs-paperera" data-a="esborra" title="Esborra del tot" aria-label="Esborra del tot">' + PAPERERA + '</button>' : '') + '</span>';
      },
      cellClick: function (e, cell) { var b = e.target.closest('button[data-a]'); if (b) accioFila(b.dataset.a, cell.getRow()); } });
    // El codi intern (PER-…) no es mostra: és l'índex de cada fila. Nom i 1r cognom, fixats a l'esquerra.
    var camps = S.d.camps.filter(function (c) { return FIXADES.indexOf(c.clau) >= 0; }).concat(S.d.camps.filter(function (c) { return FIXADES.indexOf(c.clau) < 0; }));
    camps.forEach(function (c) {
      var col = Object.assign({ title: c.nom + (c.obligatori && editable(c) ? ' *' : ''), field: c.clau, minWidth: 90, maxWidth: 360,
        editable: editable(c), cssClass: c.tipus === 'calculat' ? 'gs-calc' : (c.origen === 'clickedu' ? 'gs-ck' : ''),
        tooltip: c.tipus === 'calculat' ? 'Es calcula sol' : (c.origen === 'clickedu' ? 'Ve de Clickedu: no s’edita aquí' : false) }, filtreDe(c));
      if (FIXADES.indexOf(c.clau) >= 0) col.frozen = true;
      if (editable(c)) Object.assign(col, editorDe(c));
      if (c.clau === 'estat') col.formatter = function (cell) { var v = cell.getValue() || ''; return v ? '<span class="gs-estat gs-estat--' + esc(v.replace(/\s+/g, '-')) + '">' + esc(v) + '</span>' : ''; };
      if (c.tipus === 'si_no') col.formatter = function (cell) { return cell.getValue() === 'sí' ? '<span class="gs-si">sí</span>' : ''; };
      if (c.tipus === 'numero') { col.hozAlign = 'right'; col.sorter = 'number'; }
      cols.push(col);
    });
    cols.push({ title: 'Equips', field: 'equips', minWidth: 140, headerSort: false,
      formatter: function (cell) { return (cell.getValue() || []).map(function (id) { return '<span class="gs-pill" title="' + esc(nomEquip(id)) + '">' + esc(id.replace(/^EQ-/, '')) + '</span>'; }).join(''); },
      accessorDownload: function (v) { return (v || []).join(', '); },
      headerFilter: 'list', headerFilterParams: { values: (S.d.equips || []).reduce(function (o, e) { o[e.id] = e.nom; return o; }, {}), clearable: true },
      headerFilterFunc: function (f, v) { return (v || []).indexOf(f) >= 0; },
      editable: ed && S.d.admin_global, editor: 'list', editorParams: { values: (S.d.equips || []).reduce(function (o, e) { o[e.id] = e.nom; return o; }, {}), multiselect: true } });
    return cols;
  }
  function pintaTaula() {
    var mobil = window.matchMedia('(max-width: 760px)').matches;
    var visibles = guarda.llegeix('cols|' + S.modul.id);
    var cols = columnes();
    if (Array.isArray(visibles)) cols.forEach(function (c) { if (c.field && c.field.charAt(0) !== '_' && c.field !== 'id' && visibles.indexOf(c.field) < 0) c.visible = false; });
    $('gsTaula').hidden = mobil;
    S.taula = new Tabulator('#gsTaula', {
      data: S.d.files.map(copia),
      index: 'id', columns: cols, layout: 'fitDataStretch', height: 'min(72vh, 760px)', movableColumns: true,
      placeholder: 'No hi ha cap fila amb aquests filtres.', columnHeaderVertAlign: 'bottom',
      initialSort: [{ column: S.d.camps.some(function (c) { return c.clau === 'nom_cognoms'; }) ? 'nom_cognoms' : 'id', dir: 'asc' }],
      rowFormatter: function (row) { var d = row.getData(); var el = row.getElement(); el.classList.toggle('gs-baixa', deBaixa(d)); el.classList.toggle('gs-nova', String(d.id).indexOf('nou-') === 0); }
    });
    S.taula.on('tableBuilt', function () { aplicaFiltre(); });
    S.taula.on('dataFiltered', function (f, rows) { var c = $('gsCompte'); if (c) c.textContent = rows.length + ' de ' + S.taula.getDataCount() + ' files'; });
    S.taula.on('cellEdited', celEditada);
    if (mobil) pintaMobil();
  }
  function aplicaFiltre() {
    if (!S.taula) return;
    var claus = S.d.camps.map(function (c) { return c.clau; });
    S.taula.setFilter(function (d) {
      if (!S.baixes && deBaixa(d) && !S.canvis[d.id]) return false;
      if (!S.cerca) return true;
      return claus.some(function (k) { return String(d[k] == null ? '' : d[k]).toLowerCase().indexOf(S.cerca) >= 0; }) ||
        (d.equips || []).some(function (e) { return e.toLowerCase().indexOf(S.cerca) >= 0 || nomEquip(e).toLowerCase().indexOf(S.cerca) >= 0; });
    });
    if (window.matchMedia('(max-width: 760px)').matches) pintaMobil();
  }
  function pintaMobil() {
    var rows = S.taula ? S.taula.getData('active') : [];
    var principals = S.d.camps.slice(0, 1).map(function (c) { return c.clau; });
    var tit = S.d.camps.some(function (c) { return c.clau === 'nom_complet'; }) ? 'nom_complet' : principals[0];
    $('gsMobil').hidden = false;
    $('gsMobil').innerHTML = '<p class="gs-nota-mobil">Al mòbil es mostren fitxes de consulta. Per editar, feu servir un ordinador.</p>' + rows.slice(0, 200).map(function (r) {
      return '<article class="gs-fitxa"><h4>' + esc(r[tit] || r.id) + '</h4><dl>' + S.d.camps.filter(function (c) { return r[c.clau] && c.clau !== tit; }).slice(0, 8).map(function (c) {
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
    $('gsBarra').hidden = !b; $('gsBarra').classList.toggle('is-brut', b);
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
      pregunta('Esborrar del tot', '<p>S’esborrarà <strong>' + esc(d.nom_complet || d.id) + '</strong> de la base de dades (queda una còpia a la pestanya «historial»).</p><p>Per a una persona que ja no és al centre, és millor <strong>donar-la de baixa</strong>: es conserva i es pot reactivar.</p>',
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
    var id = 'nou-' + (++S.nTmp), fila = { id: id, equips: [] };
    S.d.camps.forEach(function (c) { fila[c.clau] = ''; });
    S.altes[id] = { tmp: id, valors: {} };
    if (S.d.camps.some(function (c) { return c.clau === 'estat'; })) { fila.estat = 'actiu'; S.altes[id].valors.estat = 'actiu'; }
    marcaBrut(true);
    S.taula.addRow(fila, true).then(function (row) {
      S.taula.scrollToRow(row, 'top', false);
      var primer = S.d.camps.filter(editable)[0];
      if (primer) row.getCell(primer.clau).edit();
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
          var qui = d.nom_complet || [d.nom, d.cognom1].filter(Boolean).join(' ') || (String(e.id).indexOf('nou-') === 0 || String(e.id).indexOf('alta-') === 0 ? 'fila nova' : e.id);
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
    pregunta('Columnes visibles', '<p class="gs-ajuda">Trieu quines columnes voleu veure. Es recorda en aquest navegador. També podeu arrossegar les capçaleres per canviar l’ordre.</p><div class="gs-cols">' +
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
    var filtres = [S.cerca ? 'cerca «' + S.cerca + '»' : '', S.taula.getHeaderFilters().length ? 'filtres a les columnes' : '', S.baixes ? 'amb baixes' : 'sense baixes'].filter(Boolean).join(' · ');
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
      var sis = c.clau === 'estat' && S.modul.id === 'professorat';   // camp de sistema: obligatori, llista i sempre actiu
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
      $('gsModalText').innerHTML = '<p class="gs-ajuda">Columnes del mòdul. <strong>Valors</strong>: per a una llista, les opcions separades per | (A|B|C); per a un correu, el domini obligatori (@institutjoanmiro.cat); per a un calculat, les claus que s’ajunten (nom cognom1). Un camp no s’esborra: desmarqueu <strong>Actiu</strong> per arxivar-lo i les dades es conserven. <strong>Visible des de</strong>: qui la pot veure (p. ex. el NIF, des d’edició).</p>' +
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
    pregunta('Camps del mòdul', '', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa els camps', valor: 1, abans: llegeix }], false).then(function (v) {
      if (!v) return;
      var buits = camps.filter(function (c) { return c.nou && !c.nom; }); camps = camps.filter(function (c) { return buits.indexOf(c) < 0; });
      api('camps_desa', { modul: S.modul.id, camps: camps }, 'Desant els camps…').then(function (r) {
        if (!r.ok) return toast(text(r.error) + (r.camp ? ' (' + r.camp + ')' : '') + (r.camps ? ' (' + r.camps.join(', ') + ')' : ''), true);
        toast('Camps desats.'); carregaDades();
      });
    });
    pinta();
  }

  // ------------------------------------------------------------------ permisos (edició: consulta · admin: consulta i edició)
  function editaPermisos() {
    api('permisos', { modul: S.modul.id }, 'Carregant els permisos…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      var pots = r.assignables;
      var html = '<p class="gs-ajuda">Els permisos es donen a <strong>equips</strong>. Amb el vostre nivell (' + esc(NOM_NIVELL[r.nivell]) + ') podeu donar o treure: <strong>' + esc(pots.map(function (n) { return NOM_NIVELL[n]; }).join(', ') || 'cap') + '</strong>. Els equips amb un nivell igual o superior al vostre no es poden canviar.</p>' +
        '<table class="gs-form-taula"><thead><tr><th>Equip</th><th>Tipus</th><th>Nivell en aquest mòdul</th></tr></thead><tbody>' +
        r.equips.map(function (q) {
          var bloquejat = q.nivell && pots.indexOf(q.nivell) < 0;
          var opcions = ['<option value="">— Sense accés —</option>'].concat(NIVELLS.map(function (n) {
            var ok = pots.indexOf(n) >= 0 || n === q.nivell;
            return ok ? '<option value="' + n + '"' + (q.nivell === n ? ' selected' : '') + '>' + NOM_NIVELL[n] + '</option>' : '';
          })).join('');
          return '<tr><td><strong>' + esc(q.nom) + '</strong><br><small>' + esc(q.id_equip) + (q.tots_moduls ? ' · ' + esc(NOM_NIVELL[q.tots_moduls] || q.tots_moduls) + ' a tots els mòduls' : '') + '</small></td><td>' + esc(q.tipus === 'docent' ? 'Docent' : 'Gestió') + '</td>' +
            '<td><select data-eq="' + esc(q.id_equip) + '" data-abans="' + esc(q.nivell) + '"' + (bloquejat ? ' disabled' : '') + '>' + opcions + '</select></td></tr>';
        }).join('') + '</tbody></table>';
      pregunta('Permisos · ' + S.modul.nom, html, [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa els permisos', valor: 1 }], false).then(function (v) {
        if (!v) return;
        var canvis = [].filter.call($('gsModalText').querySelectorAll('select[data-eq]'), function (s) { return !s.disabled && s.value !== s.dataset.abans; })
          .map(function (s) { return { id_equip: s.dataset.eq, nivell: s.value }; });
        if (!canvis.length) return;
        api('permisos_desa', { modul: S.modul.id, canvis: canvis }, 'Desant els permisos…').then(function (r2) {
          if (!r2.ok) return toast(text(r2.error) + (r2.id_equip ? ' (' + r2.id_equip + ')' : ''), true);
          toast('Permisos desats.');
        });
      });
    });
  }

  // ------------------------------------------------------------------ mòdul EQUIPS (admins globals)
  function carregaEquips() {
    api('equips', {}, 'Carregant els equips…').then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.d = { equips_dades: r.equips, moduls: r.moduls, nivell: 'admin', obert: true };
      var dadesEquips = function () { return r.equips.map(function (q) { return Object.assign({ _nou: false }, q, { membres: (q.membres || []).slice(), permisos: (q.permisos || []).slice() }); }); };
      S.descartaEquips = function () { S.taula.replaceData(dadesEquips()); };
      $('gsEines').innerHTML = '<p class="gs-ajuda" style="flex:1 1 100%;margin:0 0 4px">Equips de gestió i docents. Qui és a cada equip es canvia a la columna <strong>Equips</strong> del mòdul Professorat; els permisos de cada mòdul, amb el botó <strong>Permisos</strong> de cada mòdul. Un equip no s’esborra: es marca com a inactiu.</p>' +
        '<span class="gs-espai"></span><button type="button" class="prog-btn" data-accio="nou-equip">+ Afegeix equip</button>';
      var nomMod = function (id) { if (id === '*') return 'tots'; var m = r.moduls.filter(function (x) { return x.id === id; })[0]; return m ? m.nom : id; };
      S.taula = new Tabulator('#gsTaula', {
        data: dadesEquips(), index: 'id_equip', layout: 'fitDataStretch', height: 'min(70vh, 700px)',
        columns: [
          { title: 'Codi', field: 'id_equip', width: 130, editable: function (cell) { return cell.getRow().getData()._nou; }, editor: 'input', headerFilter: 'input' },
          { title: 'Nom', field: 'nom', editor: 'input', minWidth: 200, headerFilter: 'input' },
          { title: 'Tipus', field: 'tipus', editor: 'list', editorParams: { values: { gestio: 'Gestió', docent: 'Docent' } }, formatter: function (c) { return c.getValue() === 'docent' ? 'Docent' : 'Gestió'; }, headerFilter: 'list', headerFilterParams: { values: { gestio: 'Gestió', docent: 'Docent' }, clearable: true } },
          { title: 'Descripció', field: 'descripcio', editor: 'input', minWidth: 200 },
          { title: 'Actiu', field: 'actiu', editor: 'list', editorParams: { values: { si: 'sí', no: 'no' } }, formatter: function (c) { return c.getValue() === 'no' ? 'no' : 'sí'; } },
          { title: 'Membres', field: 'membres', formatter: function (c) { var m = c.getValue() || []; return m.length ? '<span title="' + esc(m.join(', ')) + '">' + m.length + ' · ' + esc(m.slice(0, 3).join(', ')) + (m.length > 3 ? '…' : '') + '</span>' : '—'; } },
          { title: 'Permisos', field: 'permisos', formatter: function (c) { return (c.getValue() || []).map(function (p) { return '<span class="gs-pill">' + esc(nomMod(p.modul)) + ': ' + esc(NOM_NIVELL[p.nivell] || p.nivell) + '</span>'; }).join('') || '—'; } }
        ]
      });
      S.taula.on('cellEdited', function (cell) { cell.getElement().classList.add('gs-canviat'); marcaBrut(true); $('gsEstat').textContent = 'Canvis sense desar als equips'; });
    });
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
      case 'columnes': triaColumnes(); break;
      case 'xlsx': exporta('xlsx'); break;
      case 'pdf': exporta('pdf'); break;
      case 'camps': if (S.brut) toast('Primer deseu o descarteu els canvis de la graella.', true); else editaCamps(); break;
      case 'permisos': editaPermisos(); break;
      case 'nou-equip': S.taula.addRow({ _nou: true, id_equip: 'EQ-', nom: '', tipus: 'gestio', descripcio: '', actiu: 'si', membres: [], permisos: [] }, true).then(function (row) { row.getCell('id_equip').edit(); }); marcaBrut(true); break;
    }
  });
  $('gsBarra').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accio]'); if (!b) return;
    if (b.dataset.accio === 'desa') { if (S.modul.id === 'equips') desaEquips(); else desa(false); }
    if (b.dataset.accio === 'descarta') descarta();
  });

  window.GestioApp = { S: S };   // per a les proves
  comprova();
})();
