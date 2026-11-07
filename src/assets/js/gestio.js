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
    fora_abast: 'Només podeu modificar l’alumnat dels vostres grups.',
    alumne_invalid: 'Trieu un alumne de la llista.', professor_invalid: 'Trieu el professor/a de la llista.',
    data_futura: 'La data dels fets no pot ser posterior a avui.', data_fora_curs: 'La data dels fets ha de ser d’aquest curs escolar.',
    fets_curts: 'Els fets han de tenir com a mínim 20 caràcters.', fets_llargs: 'Els fets poden tenir com a màxim 3.000 caràcters.', fets_invalids: 'Descriviu els fets amb paraules.',
    carpeta_invalida: 'L’enllaç de la carpeta de Drive no és vàlid.', carpeta_sense_acces: 'L’Apps Script no té accés a aquesta carpeta de Drive (compartiu-la amb el compte que executa GESTIO).',
    pdf_error: 'No s’ha pogut fer el PDF.',
    camp_desconegut: 'Aquest camp no és d’hores lectives.', hores_invalides: 'Les hores de la part han de ser més d’1 i menys que les del grup.', falta_configura: 'Cal executar «configura» a l’Apps Script (falta la columna d’hores lectives).',
    falten_dades: 'Cap alumne del grup té les dades d’aquest document', sense_alumnes: 'No hi ha alumnes en aquest grup.',
    grup_desconegut: 'Algun grup de l’equip no existeix (reviseu la columna Grups).',
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
    id_equip_invalid: 'El codi d’un equip ha de ser EQ- seguit de lletres o xifres, sense espais ni accents (p. ex. EQ-ADM). Si heu afegit una fila i no hi heu escrit el codi, queda «EQ-» i no és vàlid.',
    eq_dir_protegit: 'L’equip directiu (EQ-DIR) no es pot esborrar ni perdre l’administració.',
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
    cp_invalid: 'ha de tenir 5 xifres (p. ex. 08860)', telefon_invalid: 'ha de tenir com a mínim 9 xifres',
    no_aplica_1r: 'no s’omple a 1r d’ESO (el grup anterior, només si repeteix 1r)', grup_nivell: 'no és del nivell de l’alumne (p. ex. 2n ESO → 2n ESO A…)',
    estat_nivell: 'no és possible per al nivell (només es pot repetir el mateix nivell; a 1r d’ESO no hi ha «promociona»)',
    no_aplica_nivell: 'no s’omple en aquest nivell (p. ex. camps de 4t, optatives de cursos superiors o matèries de l’altre curs de batxillerat)'
  };
  var text = function (c) { return MISSATGES[c] || MISSATGES.error_servidor; };
  var BOTO_ACTUALITZA = '<button type="button" class="prog-btn prog-btn--ghost" data-accio="recarrega" title="Torna a llegir les dades del full (p. ex. després d’una importació o d’un canvi fet directament al full)">Actualitza</button>';
  var ICONA_TEXT = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6"/></svg>';
  var ICONA_PDF = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 12v6M9 15l3 3 3-3"/></svg>';
  var TISORES = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/></svg>';
  var GOMA = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20H9l-5-5a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8"/><path d="M6 11l7 7"/></svg>';
  var RELLOTGE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var PAPERERA = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
  var FIXADES = ['nom', 'cognom1'];   // columnes bloquejades a l'esquerra per defecte
  var copia = function (f) { var o = Object.assign({}, f); if (Array.isArray(o.equips)) o.equips = o.equips.slice(); return o; };
  var deBaixa = function (d) { return d.estat === 'baixa'; };
  var nomComplet = function (d) { return [d.nom, d.cognom1, d.cognom2].filter(Boolean).join(' '); };
  // PAS 31: tots els filtres i cerques sense distingir majúscules ni accents
  var plega = function (x) { return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
  var esProva = function (d) { return d && (d.prova === 'sí' || d.prova === 'si'); };
  // PAS 33: fitxa incompleta = no és de baixa ni de prova i té buit algun dels camps de S.d.completesa
  var buitsDe = function (d) { return (S.d && S.d.completesa || []).filter(function (k) { return !String(d[k] == null ? '' : d[k]).trim(); }); };
  var incompleta = function (d) { return !deBaixa(d) && !esProva(d) && String(d.id).indexOf('nou-') !== 0 && buitsDe(d).length > 0; };
  var conte = function (v, t) { return plega(v).indexOf(plega(t)) >= 0; };
  // PAS 31: les dates es desen aaaa-mm-dd (ordenen bé) i es mostren dd/mm/aaaa
  var dataVista = function (x) { var m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/.exec(String(x == null ? '' : x).trim()); return m ? ('0' + m[3]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[1] : String(x == null ? '' : x); };
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
  var esRegistre = function () { return !!(S.modul && (S.modul.id === 'control_entrada' || S.modul.id === 'amonestacions')); };
  var esAmon = function () { return !!(S.modul && S.modul.id === 'amonestacions'); };
  var esConsell = function () { return !!(S.modul && S.modul.id === 'consell_orientador'); };
  var esCurriculum = function () { return !!(S.modul && (S.modul.id === 'curriculum' || S.modul.id === 'curriculum_grups')); };
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
      $('gsModal').querySelector('.gs-modal__box').classList.remove('gs-modal--ample');
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
    if (esAmon()) { pintaEinesAmon(); return; }
    if (esConsell()) { pintaEinesConsell(); return; }
    if (esCurriculum()) { pintaEinesCurriculum(); return; }
    if (esRegistre()) {
      // CONTROL D'ENTRADA: «Nova entrada» (edició) i «Anàlisi» (consulta); les entrades no s'editen a la cel·la
      // PAS 38: el mateix selector de període que a amonestacions
      $('gsEines').innerHTML = htmlPeriode() + '<span class="gs-compte" id="gsCompte"></span><span class="gs-espai"></span>' +
        (S.d.retards ? '<span class="gs-retards" id="gsRetards"></span>' : '') +
        (ed ? '<button type="button" class="prog-btn" data-accio="entrada-nova">+ Nova entrada</button>' : '') +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="entrada-analisi">Anàlisi</button>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Visualització camps</button>' +
        (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="camps">Gestió camps</button>' : '') +
        (esAdmin() ? BOTO_ACTUALITZA : '') +
        '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button></span>';
      pintaRetards(); lligaPeriode();
      return;
    }
    var nivells = esAlumnat() ? (S.d.nivells || etapa().nivells) : [], sel = nivellTriat();
    $('gsEines').innerHTML =
      (nivells.length ? '<span class="gs-nivells" role="group" aria-label="Nivell que es mostra">' + [''].concat(nivells).map(function (n) {
        return '<button type="button" class="gs-nivells__btn' + (n === sel ? ' is-actiu' : '') + '" data-accio="nivell" data-nivell="' + esc(n) + '" aria-pressed="' + (n === sel) + '">' + (n ? esc(n) : 'Tots') + '</button>';
      }).join('') + '</span>' : '') +
      (ambEstat ? '<label class="gs-check"><input type="checkbox" id="gsBaixes"' + (S.baixes ? ' checked' : '') + '> Mostra també les baixes</label>' : '') +
      '<span class="gs-compte" id="gsCompte"></span>' +
      ((S.d.completesa || []).length && ed ? '<button type="button" class="gs-incomplet' + (S.nomesIncompletes ? ' is-actiu' : '') + '" id="gsIncomplet" data-accio="incompletes" aria-pressed="' + !!S.nomesIncompletes + '" title="Fitxes (sense baixes ni proves) amb algun camp obligatori buit. Cliqueu per veure només aquestes."></button>' : '') +
      (ed ? '<span class="gs-seleccio" id="gsSeleccio" hidden><span id="gsSelN"></span> <button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="aplica-seleccio">Aplica a la selecció…</button> <button type="button" class="gs-enllac" data-accio="treu-seleccio">Treu la selecció</button></span>' : '') +
      '<span class="gs-espai"></span>' +
      (ed ? '<button type="button" class="prog-btn" data-accio="alta">+ Afegeix ' + esc(S.d.nom_fila || 'fila') + '</button>' : '') +
      // PAS 35: la importació massiva és exclusiva de l'administració del mòdul
      (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="importa" title="Alta massiva a partir d’un fitxer Excel o CSV">Importa fitxer</button>' : '') +
      (esAlumnat() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="totals" title="Alumnes per nivell i grup">Nombres totals</button><button type="button" class="prog-btn prog-btn--ghost" data-accio="analisi" title="Comptadors per grup d’un nivell">Anàlisi</button>' : '') +
      (S.modul.id === 'professorat' && ed ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="llistat" title="PDF per recollir signatures en una reunió">Llistat</button>' : '') +
      (ed && esAlumnat() && S.d.camps.some(function (c) { return c.clau === 'decisio_final'; }) ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="tancament" title="Promocions, repeticions i baixes de final de curs">Tancament de curs</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Visualització camps</button>' +
      (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="camps">Gestió camps</button>' : '') +
      // PAS 35: «Actualitza» torna a llegir el full (canvis fets directament al full o per una importació): només administració.
      // Quan algú altre desa des del web, l'avís de dalt ja té el seu botó «Actualitza».
      (esAdmin() ? BOTO_ACTUALITZA : '') +
      '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button></span>';
    if ($('gsBaixes')) $('gsBaixes').addEventListener('change', function () { S.baixes = this.checked; aplicaFiltre(); });
  }

  // Valors calculats (els mateixos que fa l'Apps Script en desar): «nom cognom1 cognom2», «cognom1 cognom2, nom»
  function calcula(c, v) {
    // PAS 42: «a + b + c» = suma numèrica (buit si tots són buits)
    if (/\+/.test(String(c.valors || ''))) {
      var ks = String(c.valors).split('+').map(function (k) { return k.trim(); }).filter(Boolean);
      var ns = ks.map(function (k) { return String(v[k] == null ? '' : v[k]).replace(',', '.').trim(); }).filter(function (x) { return x !== '' && !isNaN(Number(x)); });
      return ns.length ? String(Math.round(ns.reduce(function (t, x) { return t + Number(x); }, 0) * 100) / 100).replace('.', ',') : '';
    }
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
      : c.tipus === 'data' ? function () { return valorsDiferents(c.clau).map(function (o) { return o === BUIT ? o : { v: o.v, t: dataVista(o.v) }; }); }
      : function () { return valorsDiferents(c.clau); };
    var norm = function (v) { v = v == null ? '' : String(v).trim(); return c.tipus === 'si_no' ? (v === 'sí' ? 'sí' : '') : v; };
    return {
      headerFilter: function (cell, onRendered, success) { var el = filtreMultiple(c.nom, opts, success, cell.getValue()); if (compacte) el.classList.add('gs-filtre--compacte'); return el; },
      headerFilterLiveFilter: false,   // si no, Tabulator escolta el keyup del contenidor i esborra el filtre ràpid
      headerFilterFunc: function (f, v) {
        if (f.s && f.s.indexOf(norm(v)) < 0) return false;
        if (f.t && !conte(v, f.t) && !(c.tipus === 'data' && conte(dataVista(v), f.t))) return false;
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
        if (f.t) { if (!v.some(function (e) { return conte(e, f.t) || conte(nomEquip(e), f.t); })) return false; }
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
        '<input type="search" class="gs-popover__cerca" placeholder="Cerca un valor…" aria-label="Cerca un valor">' +
        '<div class="gs-popover__llista">' + opts.map(function (o, i) {
        var marcat = !st.s || st.s.indexOf(o.v) >= 0;
        return '<label data-t="' + esc(plega(o.t)) + '"><input type="checkbox" data-i="' + i + '"' + (marcat ? ' checked' : '') + '> ' + esc(o.t) + '</label>';
      }).join('') + '</div><div class="gs-popover__btns"><button type="button" data-b="tots">Tots</button><button type="button" data-b="cap">Cap</button>' +
        '<span></span><button type="button" data-b="cancel">Cancel·la</button><button type="button" data-b="ok" class="is-primari">Accepta</button></div>';
      document.body.appendChild(pop);
      var rc = emb.getBoundingClientRect();
      pop.style.top = (window.scrollY + rc.bottom + 6) + 'px';
      pop.style.left = Math.max(8, Math.min(window.scrollX + rc.right - pop.offsetWidth, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8)) + 'px';
      var caselles = pop.querySelectorAll('input[type=checkbox]'), cercaPop = pop.querySelector('.gs-popover__cerca');
      // Tots i Cap actuen sobre els valors visibles (si s'ha fet servir la cerca de la caixa)
      // PAS 31: en escriure a la cerca, queden marcats NOMÉS els valors que hi coincideixen (com a l'Excel); si s'esborra,
      // es torna a la selecció d'abans. Enter = Accepta.
      var abansCerca = [].map.call(caselles, function (x) { return x.checked; });
      if (cercaPop) {
        cercaPop.addEventListener('input', function () {
          var t = plega(cercaPop.value.trim());
          caselles.forEach(function (x, i) { var l = x.parentNode, ok = !t || l.dataset.t.indexOf(t) >= 0; l.hidden = !ok; x.checked = t ? ok : abansCerca[i]; });
        });
        cercaPop.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); pop.querySelector('[data-b="ok"]').click(); } });
      }
      pop.addEventListener('click', function (e) {
        var bt = e.target.closest('button[data-b]'); if (!bt) return;
        if (bt.dataset.b === 'tots' || bt.dataset.b === 'cap') caselles.forEach(function (x) { if (!x.parentNode.hidden) x.checked = bt.dataset.b === 'tots'; });
        if (bt.dataset.b === 'cancel') tancaPopovers();
        if (bt.dataset.b === 'ok') {
          var sel = [].filter.call(caselles, function (x) { return x.checked && !x.parentNode.hidden; }).map(function (x) { return opts[+x.dataset.i].v; });
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
    else if (ed && esCurriculum()) cols.push({ title: '', field: '_acc', frozen: true, headerSort: false, download: false, width: S.modul.id === 'curriculum_grups' ? 92 : 44, cssClass: 'gs-accions',
      formatter: function () { return '<span class="gs-acc">' + (S.modul.id === 'curriculum_grups' ? '<button type="button" class="gs-hist" data-a="divideix" title="Reparteix les hores d’aquest grup amb una altra especialitat" aria-label="Reparteix les hores">' + TISORES + '</button>' : '') + '<button type="button" class="gs-perill gs-paperera" data-a="esborra" title="Esborra" aria-label="Esborra">' + PAPERERA + '</button></span>'; },
      cellClick: function (e, cell) { var b = e.target.closest('button[data-a]'); if (!b) return; if (b.dataset.a === 'divideix') divideixAssignacio(cell.getRow()); else accioFila(b.dataset.a, cell.getRow()); } });
    // PAS 40: al consell orientador no es dona de baixa ni s'esborra cap alumne (es fa a l'alumnat): només es buiden les dades del consell
    else if (ed && esConsell()) cols.push({ title: '', field: '_acc', frozen: true, headerSort: false, download: false, width: 44, cssClass: 'gs-accions',
      formatter: function () { return '<span class="gs-acc"><button type="button" class="gs-perill gs-paperera" data-a="buida-consell" title="Buida les dades del consell orientador d’aquest alumne (orientacions, resultat, voluntat i observacions)" aria-label="Buida les dades del consell orientador">' + GOMA + '</button></span>'; },
      cellClick: function (e, cell) { if (e.target.closest('button[data-a]')) buidaConsell(cell.getRow()); } });
    else if (ed && !esConsell()) cols.push({ title: '', field: '_acc', frozen: true, headerSort: false, download: false, width: (adm || esAlumnat() ? 118 : 92) + (S.d.pot_historial ? 30 : 0), cssClass: 'gs-accions',
      formatter: function (cell) {
        var r = cell.getRow().getData();
        return '<span class="gs-acc">' + (S.d.pot_historial && String(r.id).indexOf('nou-') !== 0 ? '<button type="button" class="gs-hist" data-a="historial" title="Historial de canvis d’aquesta fila" aria-label="Historial de canvis">' + RELLOTGE + '</button>' : '') +
          (deBaixa(r) ? '<button type="button" data-a="reactiva">Reactiva</button>' : '<button type="button" data-a="baixa">Baixa</button>') +
          (adm || esAlumnat() || String(r.id).indexOf('nou-') === 0 ? '<button type="button" class="gs-perill gs-paperera" data-a="esborra" title="Esborra del tot" aria-label="Esborra del tot">' + PAPERERA + '</button>' : '') + '</span>';
      },
      cellClick: function (e, cell) { var b = e.target.closest('button[data-a]'); if (b) accioFila(b.dataset.a, cell.getRow()); } });
    // El codi intern (PRO-…, ALU-…) no es mostra: és l'índex de cada fila. Nom i 1r cognom, fixats a l'esquerra.
    var camps = S.d.camps.filter(function (c) { return FIXADES.indexOf(c.clau) >= 0; }).concat(S.d.camps.filter(function (c) { return FIXADES.indexOf(c.clau) < 0; }));
    camps.forEach(function (c) {
      var col = Object.assign({ title: c.nom + (c.obligatori && editable(c) ? ' *' : ''), field: c.clau, minWidth: 90, maxWidth: 360,
        editable: editable(c), cssClass: c.tipus === 'calculat' ? 'gs-calc' : (c.origen === 'clickedu' ? 'gs-ck' : ''),
        tooltip: c.tipus === 'calculat' ? 'Es calcula sol' : (c.origen === 'clickedu' ? (esConsell() ? 'Ve de l’alumnat o el posa GESTIO: no s’edita aquí' : esCurriculum() ? 'Ve de la matèria: es canvia a la pestanya Matèries' : 'Ve de Clickedu: no s’edita aquí') : false) }, filtreDe(c));
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
      if (esRegistre() && c.clau === 'alumne' && S.d.retards) col.formatter = function (cell) {
        var d = cell.getRow().getData(), k = d.id_alumne || plega(d.alumne), av = (S.avisRetards || {})[k];
        return esc(cell.getValue()) + (av ? ' <span class="gs-avis-ret" title="' + av + ' retards en ' + esc(S.d.retards.periode) + '">⚠ ' + av + '</span>' : '');
      };
      // Batxillerat (PAS 29): matèries en columnes estretes, nom en vertical i el nombre d'alumnes (de les files filtrades) a dalt
      if (esMateria(c.clau)) {
        Object.assign(col, { width: 40, minWidth: 36, maxWidth: 60, hozAlign: 'center', headerHozAlign: 'center', headerSort: false, cssClass: 'gs-mat',
          titleFormatter: function () { return '<span class="gs-vt" title="' + esc(c.nom) + '">' + esc(c.nom) + '</span><span class="gs-recompte" data-camp="' + esc(c.clau) + '" title="Alumnes amb ' + esc(c.nom) + ' (files filtrades)"></span>'; },
          formatter: function (cell) { return cell.getValue() === 'sí' ? '<span class="gs-si" aria-label="sí">✓</span>' : ''; } }, filtreDe(c, true));
      }
      if (c.tipus === 'numero') { col.hozAlign = 'right'; col.sorter = 'number'; }
      if (c.tipus === 'data') { col.formatter = function (cell) { return esc(dataVista(cell.getValue())); }; col.accessorDownload = function (v) { return dataVista(v); }; }
      // PAS 31: el codi intern de l'alumne del control d'entrada no es mostra (es fa servir per dins)
      if (esRegistre() && c.clau === 'id_alumne') return;
      // PAS 39: currículum › matèries → hores de l'alumne i de professorat (calculades) després de «Grups»
      if (S.modul.id === 'curriculum' && c.clau === 'grups') {
        cols.push(col);
        cols.push({ title: 'Hores alumne', field: '_halumne', width: 96, hozAlign: 'right', headerSort: false, download: false, cssClass: 'gs-calc', tooltip: 'A + B/2', formatter: function (cell) { var d = cell.getRow().getData(); return fmtH(horesA(d) + horesB(d) / 2); } });
        col = { title: 'Hores professorat', field: '_hprof', width: 120, hozAlign: 'right', headerSort: false, download: false, cssClass: 'gs-calc', tooltip: '(A + B) × grups', formatter: function (cell) { var d = cell.getRow().getData(); return fmtH((horesA(d) + horesB(d)) * numero(d.grups)); } };
      }
      // PAS 42: professorat → ⚠ si el total lectives supera el màxim de la jornada
      if (S.modul.id === 'professorat' && c.clau === 'total_lectives') col.formatter = function (cell) {
        var t = cell.getValue(), mx = maxJornada(cell.getRow().getData().jornada);
        return esc(t == null ? '' : t) + (t !== '' && t != null && mx && numero(t) > mx ? ' <span class="gs-avis-ret" title="Supera les ' + mx + ' h lectives de la jornada">⚠</span>' : '');
      };
      // PAS 41: assignacions → ⚠ si les parts d'un grup no sumen les hores de la matèria
      if (S.modul.id === 'curriculum_grups' && c.clau === 'hores') col.formatter = function (cell) {
        var d = cell.getRow().getData(), t = totalMateria(d), s = sumaGrup(d);
        return esc(fmtH(numero(cell.getValue()))) + (t !== null && Math.abs(s - t) > 0.01 ? ' <span class="gs-avis-ret" title="Les parts d’aquest grup sumen ' + fmtH(s) + ' h i la matèria en té ' + fmtH(t) + '">⚠</span>' : '');
      };
      // PAS 38: consell orientador → els PDF com a icona (pestanya nova)
      if (esConsell() && (c.clau === 'pdf_inicial' || c.clau === 'pdf_final')) Object.assign(col, { width: 74, minWidth: 64, hozAlign: 'center', headerSort: false, headerFilter: false, pdfExclou: true,
        formatter: function (cell) { var u = cell.getValue(); return u ? '<a class="gs-ico-btn" href="' + esc(u) + '" target="_blank" rel="noopener" title="Obre el PDF del grup (pestanya nova)" aria-label="Obre el PDF">' + ICONA_PDF + '</a>' : '<span class="gs-gris">—</span>'; } });
      if (esAmon()) {
        if (c.clau === 'id_professor') return;
        if (c.clau === 'alumne') col.formatter = function (cell) {
          var d = cell.getRow().getData(), av = (S.avisAmon || {})[d.id_alumne || plega(d.alumne)];
          return esc(cell.getValue()) + (av ? ' <span class="gs-avis-ret" title="' + av + ' amonestacions ' + esc(textPeriodeAmon()) + '">⚠ ' + av + '</span>' : '');
        };
        // Els fets no es veuen a la graella: la icona els mostra (a l'Excel sí que hi surten)
        if (c.clau === 'redactat_el') col.formatter = function (cell) { var v = String(cell.getValue() || ''); return esc(dataVista(v.slice(0, 10)) + ' ' + v.slice(11, 16)); };
        if (c.clau === 'fets') Object.assign(col, { title: 'Fets', width: 64, minWidth: 56, hozAlign: 'center', headerSort: false, headerFilter: false, pdfExclou: true,
          formatter: function (cell) { return cell.getValue() ? '<button type="button" class="gs-ico-btn" title="Mostra els fets" aria-label="Mostra els fets">' + ICONA_TEXT + '</button>' : ''; },
          cellClick: function (e, cell) { if (e.target.closest('button')) mostraFets(cell.getRow().getData()); } });
        if (c.clau === 'pdf') Object.assign(col, { title: 'PDF', width: 60, minWidth: 54, hozAlign: 'center', headerSort: false, headerFilter: false, pdfExclou: true,
          formatter: function (cell) { var u = cell.getValue(), est = cell.getRow().getData()._pdf;
            if (u) return '<a class="gs-ico-btn" href="' + esc(u) + '" target="_blank" rel="noopener" title="Obre el PDF (pestanya nova)" aria-label="Obre el PDF">' + ICONA_PDF + '</a>';
            return est === 'fent' ? '<span class="gs-pdf-fent" title="El PDF s’està fent en segon pla" aria-label="PDF en preparació"></span>' : '<span class="gs-gris" title="Sense PDF: feu-lo des del visor (doble clic)">—</span>'; } });
      }
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
      data: S.d.files.slice().sort(esCurriculum() ? function (a, b) { var o = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT']; return (o.indexOf(a.nivell) - o.indexOf(b.nivell)) || String(a.id_materia || a.id).localeCompare(String(b.id_materia || b.id)) || (Number(a.num_grup) || 0) - (Number(b.num_grup) || 0) || String(a.grup || '').localeCompare(String(b.grup || ''), 'ca') || String(a.id).localeCompare(String(b.id)); } : esConsell() ? function (a, b) { return String(a.grup || '').localeCompare(String(b.grup || ''), 'ca', { numeric: true }) || plega(a.alumne).localeCompare(plega(b.alumne), 'ca'); } : esAmon() ? function (a, b) { return String(b.data_fets + ' ' + b.redactat_el).localeCompare(String(a.data_fets + ' ' + a.redactat_el)); } : esRegistre() ? function (a, b) { return String(b.data + ' ' + b.hora).localeCompare(String(a.data + ' ' + a.hora)); } : esAlumnat() ? function (a, b) { return nivellAlumne(a) - nivellAlumne(b) || String(a.grup_actual || '').localeCompare(String(b.grup_actual || ''), 'ca') || ordenaCognoms(a, b); } : ordenaCognoms).map(copia),
      index: 'id', columns: cols, layout: 'fitDataStretch', height: alcada(), movableColumns: true, selectableRows: potEditar() ? 'highlight' : false,
      placeholder: 'No hi ha cap fila amb aquests filtres.', columnHeaderVertAlign: 'bottom',
      rowFormatter: function (row) {
        var d = row.getData(); var el = row.getElement(); el.classList.toggle('gs-baixa', deBaixa(d)); el.classList.toggle('gs-nova', String(d.id).indexOf('nou-') === 0);
        el.classList.toggle('gs-sense-ant', esAlumnat() && senseGrupAnterior(d));
        el.classList.toggle('gs-prova', esProva(d));
        el.classList.toggle('gs-desant', !!d._desant);
        // PAS 33: amb el filtre d'incompletes, els camps buits es marquen
        if (S.nomesIncompletes) { var buits = buitsDe(d); row.getCells().forEach(function (ce) { ce.getElement().classList.toggle('gs-buit', buits.indexOf(ce.getField()) >= 0 && incompleta(d)); }); }
        else row.getCells().forEach(function (ce) { ce.getElement().classList.remove('gs-buit'); });
        // Cel·les dels camps que no són del nivell de l'alumne: ratllades (no s'editen)
        if (esAlumnat()) row.getCells().forEach(function (ce) { var f = ce.getField(); if (f && restringit(f)) ce.getElement().classList.toggle('gs-na', noAplica(f, d)); });
      }
    });
    S.taula.on('rowSelectionChanged', function (data) { var b = $('gsSeleccio'); if (!b) return; var abans = b.hidden; b.hidden = !data.length; if (abans !== b.hidden) setTimeout(ajustaAlcada, 0); $('gsSelN').textContent = data.length + (data.length === 1 ? ' fila seleccionada' : ' files seleccionades'); });
    S.taula.on('tableBuilt', function () { aplicaFiltre(); ajustaAlcada(); });
    S.taula.on('dataFiltered', function (f, rows) { var c = $('gsCompte'); if (c) c.textContent = rows.length + ' de ' + S.taula.getDataCount() + ' files'; setTimeout(function () { recomptes(); comptesFiltre(); compteIncompletes(); }, 0); });
    S.taula.on('columnMoved', function () { setTimeout(recomptes, 0); });
    S.taula.on('cellEdited', celEditada);
    // PAS 35: amonestacions → doble clic a una fila obre el visor (amb els fets), que recorre les files que es veuen
    if (esAmon()) S.taula.on('rowDblClick', function (e, row) { try { window.getSelection().removeAllRanges(); } catch (x) { /* res */ } visorAmon(row.getData().id); });
    if (mobil) pintaMobil();
  }
  // PAS 29 · Damunt de cada camp amb un filtre actiu: quantes files compleixen la condició d'aquell filtre
  // (entre les files que es poden veure: sense les baixes, si no es mostren). Les matèries del batxillerat ja tenen el seu comptador.
  // PAS 33 · Avís de dades incompletes (professorat i PAS)
  function compteIncompletes() {
    var b = $('gsIncomplet'); if (!b || !S.taula) return;
    var n = S.taula.getData().filter(incompleta).length;
    b.hidden = !n && !S.nomesIncompletes;
    b.innerHTML = '<span aria-hidden="true">⚠</span> ' + (S.nomesIncompletes ? 'Mostra totes les fitxes' : n + (n === 1 ? ' fitxa amb dades buides' : ' fitxes amb dades buides'));
  }
  function comptesFiltre() {
    if (!S.taula) return;
    var base = S.taula.getData().filter(function (d) { return (S.baixes || !deBaixa(d) || !!S.canvis[d.id] || filtreEstat()) && delNivell(d); });
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
  // PAS 30 · Selector de nivell (Alumnat ESO i Batxillerat): només les files del nivell triat i, amagades, les columnes
  // que no s'omplen en aquell nivell (p. ex. a 1r d'ESO, els camps de 4t). Es recorda en aquest navegador.
  function nivellTriat() {
    if (!esAlumnat()) return '';
    S.nivellSel = S.nivellSel || {};
    if (S.nivellSel[S.modul.id] === undefined) S.nivellSel[S.modul.id] = guarda.llegeix('nivell|' + S.modul.id) || '';
    var n = S.nivellSel[S.modul.id] || ''; return (S.d.nivells || etapa().nivells).indexOf(n) >= 0 ? n : ''; }
  function triaNivell(n) {
    S.nivellSel = S.nivellSel || {}; S.nivellSel[S.modul.id] = n; guarda.desa('nivell|' + S.modul.id, n);
    document.querySelectorAll('.gs-nivells__btn').forEach(function (b) { var on = b.dataset.nivell === n; b.classList.toggle('is-actiu', on); b.setAttribute('aria-pressed', String(on)); });
    aplicaFiltre();
  }
  function columnesNivell() {
    if (!S.taula || !esAlumnat()) return;
    var sel = nivellTriat(), n = sel ? etapa().nivells.indexOf(sel) + 1 : 0;
    S.ocultesNivell = S.ocultesNivell || [];
    S.ocultesNivell.forEach(function (f) { var c = S.taula.getColumn(f); if (c) c.show(); });
    S.ocultesNivell = [];
    if (!n) return;
    S.taula.getColumns().forEach(function (c) { var f = c.getField(); if (f && f.charAt(0) !== '_' && c.isVisible() && !aplica(S.modul.id, f, n)) { c.hide(); S.ocultesNivell.push(f); } });
  }
  var delNivell = function (d) { var sel = nivellTriat(); return !sel || nivellDeGrup(d.nivell || d.grup_actual) === sel || !!S.canvis[d.id] || String(d.id).indexOf('nou-') === 0; };
  function aplicaFiltre() {
    if (!S.taula) return;
    S.taula.setFilter(function (d) {
      // Les baixes s'amaguen si no es marca «Mostra també les baixes»… excepte si es filtra per la columna Estat
      return (S.baixes || !deBaixa(d) || !!S.canvis[d.id] || filtreEstat()) && delNivell(d) && (!S.nomesIncompletes || incompleta(d) || !!S.canvis[d.id]) && delPeriodeAmon(d) && delCursConsell(d) && nivellCurr(d);
    });
    columnesNivell();
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
    S.filaEditada = row.getElement();   // PAS 39: la fila s'ha de continuar veient quan surt la barra de desar
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
  // PAS 33 · Historial d'una fila: qui ha canviat què i quan (del més recent al més antic)
  var ACCIONS_HIST = { alta: 'Alta', modificacio: 'Modificació', baixa: 'Baixa', reactivacio: 'Reactivació', equips: 'Equips', alta_nou_professor: 'Alta (Nou professor/a)', esborra: 'Esborrat' };
  function historialFila(d) {
    api('historial_fila', { modul: S.modul.id, id: d.id }, 'Llegint l’historial…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      var dataHora = function (x) { var m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(x || '')); return m ? dataVista(m[1]) + ' ' + m[2] : esc(x); };
      var html = '<p class="gs-ajuda">' + esc(nomComplet(d) || d.id) + ' · ' + r.files.length + (r.files.length === 1 ? ' canvi' : ' canvis') + ' (el més recent primer).</p>' +
        (r.files.length ? '<div class="gs-informe"><table class="gs-form-taula gs-informe__taula"><thead><tr><th>Data</th><th>Qui</th><th>Què</th></tr></thead><tbody>' + r.files.map(function (h) {
          var que = h.canvis ? (h.canvis.length ? '<ul class="gs-hist__llista">' + h.canvis.map(function (c) { return '<li><strong>' + esc(c.camp) + '</strong>: ' + (c.abans ? esc(c.abans) : '<em>buit</em>') + ' → ' + (c.ara ? esc(c.ara) : '<em>buit</em>') + '</li>'; }).join('') + '</ul>' : '') : esc(h.detall);
          return '<tr><td style="white-space:nowrap">' + dataHora(h.data) + '</td><td>' + esc(h.usuari) + '</td><td><strong>' + esc(ACCIONS_HIST[h.accio] || h.accio) + '</strong>' + (que ? '<br>' + que : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p>No hi ha cap canvi registrat d’aquesta fila des del web (les importacions i els canvis fets directament al full no hi surten).</p>');
      pregunta('Historial · ' + (nomComplet(d) || d.id), html, [{ t: 'Tanca', valor: 1 }], false);
    });
  }
  function marcaBrut(b) {
    S.brut = b;
    var n = Object.keys(S.canvis).length, a = Object.keys(S.altes).length;
    var canvia = $('gsBarra').hidden === b;
    // (es mesura abans de mostrar la barra)
    var cont = canvia && S.taula && document.querySelector('#gsTaula .tabulator-tableholder'), top0 = $('gsTaula').getBoundingClientRect().top, sc0 = cont ? cont.scrollTop : 0, scx = cont ? cont.scrollLeft : 0;
    $('gsBarra').hidden = !b; $('gsBarra').classList.toggle('is-brut', b);
    // La barra de desar ocupa lloc: la graella baixa i s'escurça. PAS 31: es compensa el desplaçament perquè la fila
    // que s'està editant es quedi al mateix lloc de la pantalla (sovint es canvien diversos camps seguits).
    if (canvia) {
      ajustaAlcada();
      if (cont) {
        // PAS 39: però mai fins al punt que la fila editada quedi amagada (p. ex. si era de les primeres de la graella)
        var d = $('gsTaula').getBoundingClientRect().top - top0, fe = S.filaEditada, posa = function () {
          var v = Math.max(0, sc0 + d);
          if (fe && fe.isConnected && cont.contains(fe)) { var rt = fe.offsetTop, rh = fe.offsetHeight, ch = cont.clientHeight; v = Math.max(0, Math.min(v, rt), rt + rh - ch); }
          try { S.taula.rowManager.scrollTop = v; } catch (e) { /* intern de Tabulator */ } cont.scrollTop = v; cont.scrollLeft = scx; };
        posa(); setTimeout(posa, 0); setTimeout(posa, 60);   // Tabulator torna a posar el seu scroll en redibuixar: es reaplica
      }
    }
    $('gsEstat').textContent = b ? 'Canvis sense desar: ' + [n ? n + (n === 1 ? ' fila modificada' : ' files modificades') : '', a ? a + (a === 1 ? ' alta' : ' altes') : ''].filter(Boolean).join(' · ') : '';
  }
  function accioFila(a, row) {
    var d = row.getData();
    if (a === 'historial') return historialFila(d);
    if (a === 'baixa' || a === 'reactiva') {
      var nou = a === 'baixa' ? 'baixa' : (esAlumnat() ? '' : 'actiu');   // alumnat: cal triar l'estat (promociona, repeteix…)
      if (String(d.id).indexOf('nou-') === 0) return;
      row.update({ estat: nou }); registra(d.id, 'estat', nou); row.reformat();
      var ce = row.getCell('estat'); if (ce) ce.getElement().classList.add('gs-canviat');
      toast(a === 'baixa' ? 'Fila marcada de baixa. Premeu «Desa els canvis».' : 'Fila reactivada. Premeu «Desa els canvis».');
      return;
    }
    if (a === 'esborra') {
      if (String(d.id).indexOf('nou-') === 0) { delete S.altes[d.id]; row.delete(); marcaBrut(Object.keys(S.canvis).length + Object.keys(S.altes).length > 0); return; }
      if (esRegistre()) return pregunta(esAmon() ? 'Esborrar l’amonestació' : 'Esborrar l’entrada', esAmon() ? '<p>S’esborrarà l’amonestació de <strong>' + esc(d.alumne) + '</strong> del ' + esc(dataCat(d.data_fets)) + ' (' + esc(d.professor) + '). El PDF va a la paperera de Drive i queda una còpia a l’historial.</p><p class="gs-ajuda">Feu-ho només si s’ha redactat per error.</p>' : '<p>S’esborrarà l’entrada de <strong>' + esc(d.alumne) + '</strong> del ' + esc(dataCat(d.data)) + ' a les ' + esc(d.hora) + ' (queda una còpia a l’historial).</p>',
        [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Esborra', valor: 1, tipus: 'danger' }]).then(function (v) {
        if (!v) return;
        api('esborra', { modul: S.modul.id, ids: [d.id] }, 'Esborrant…').then(function (r) {
          if (!r.ok) return toast(text(r.error), true);
          row.delete(); S.d.files = S.d.files.filter(function (f) { return f.id !== d.id; });
          if (esAmon()) { pintaAvisAmon(); toast('Amonestació esborrada.'); } else toast('Entrada esborrada.');
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
    if (S.d.camps.some(function (c) { return c.clau === 'estat'; }) && !esAlumnat()) { fila.estat = 'actiu'; S.altes[id].valors.estat = 'actiu'; }
    if (nivellTriat()) { fila.nivell = nivellTriat(); S.altes[id].valors.nivell = fila.nivell; }
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
      S.ocultesNivell = [];
      cols.forEach(function (c) { if (marcats.indexOf(c.getField()) >= 0) c.show(); else c.hide(); });
      guarda.desa('cols|' + S.modul.id, marcats);
    });
  }
  function exporta(tipus) {
    var nom = S.modul.id + '-' + new Date().toISOString().slice(0, 10);
    if (tipus === 'xlsx') return carregaScript(LIBS.xlsx).then(function () { S.taula.download('xlsx', nom + '.xlsx', { sheetName: S.modul.nom.slice(0, 30) }); });
    var crida = logoPdf().then(function (logo) { pdf(nom, logo); });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  // PAS 30 · Tots els PDF porten el logo del centre a la part superior: logo a l'esquerra, títol i subtítol al costat
  // i una línia blava a sota (com el PDF de Nou professor/a). Si el logo no es pot carregar, el PDF es fa igualment.
  var ALT_LOGO = 9.5, AMPLE_LOGO = ALT_LOGO * 1100 / 432, Y_TAULA = 25;
  function capPdf(doc, logo, titol, subtitol, M, W) {
    var x = M;
    if (logo) { try { doc.addImage(logo, 'PNG', M, 6, AMPLE_LOGO, ALT_LOGO); x = M + AMPLE_LOGO + 5; } catch (e) { /* sense logo */ } }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(28, 12, 188);
    doc.text(doc.splitTextToSize(titol, W - M - x)[0], x, 10.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120);
    doc.text(doc.splitTextToSize(subtitol, W - M - x)[0], x, 15);
    doc.setDrawColor(28, 12, 188); doc.setLineWidth(0.5); doc.line(M, 18.5, W - M, 18.5);
  }
  function logoPdf() { return preparaPdf().then(function (R) { return R.logo; }, function () { return carregaScript(LIBS.jspdf).then(function () { return carregaScript(LIBS.autotable); }).then(function () { return null; }); }); }
  // PDF fet a mà (jsPDF + autoTable): capçalera fora de la taula, amplades segons el contingut, peu amb pàgines
  function pdf(nom, logo) {
    var cols = S.taula.getColumns().filter(function (c) { var f = c.getField(); return c.isVisible() && f && f.charAt(0) !== '_' && !c.getDefinition().pdfExclou; });
    var files = S.taula.getData('active');
    var tipus = {}; S.d.camps.forEach(function (c) { tipus[c.clau] = c.tipus; });
    var valor = function (c, d) { var f = c.getField(), v = d[f]; if (f === 'equips') return (v || []).join(', '); if (tipus[f] === 'data') return dataVista(v); return v == null ? '' : String(v); };
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
    var filtres = [nivellTriat(), S.taula.getHeaderFilters().length ? 'filtres a les columnes' : '', esRegistre() ? periodeAmonText() : S.baixes ? 'amb baixes' : 'sense baixes'].filter(Boolean).join(' · ');
    var data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.autoTable({
      head: [cap], body: cos, startY: Y_TAULA, margin: { top: Y_TAULA, left: M, right: M, bottom: 12 }, tableWidth: 'wrap', columnStyles: columnStyles,
      styles: { font: 'helvetica', fontSize: mida, cellPadding: 1.2, overflow: 'linebreak', valign: 'top', lineColor: [225, 229, 238], lineWidth: 0.1 },
      headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 248, 252] },
      didDrawPage: function () {
        capPdf(doc, logo, S.modul.nom.toUpperCase() + ' · Institut Joan Miró', data + ' · ' + files.length + ' files' + (filtres ? ' · ' + filtres : ''), M, W);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120);
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
  var dataCat = function (x) { return dataVista(x); };
  function informe(titol, subtitol, cap, files, nomFitxer, compacte) {
    // Columnes numèriques (totes les cel·les són xifres): alineades a la dreta, aquí i al PDF
    var nums = cap.map(function (c, j) { return j > 0 && files.every(function (f) { var r = f.s ? null : (f.t || f); return !r || /^\d*$/.test(String(r[j] == null ? '' : r[j])); }); });
    var cel = function (x, j) { return '<td' + (nums[j] ? ' class="gs-num"' : '') + '>' + esc(x) + '</td>'; };
    // PAS 35: taules compactes (les xifres al costat del nom, no a l'altra punta de la finestra)
    if (compacte === undefined) compacte = true;
    var html = '<p class="gs-ajuda">' + esc(subtitol) + '</p><div class="gs-informe"><table class="gs-form-taula gs-informe__taula' + (compacte ? ' gs-informe__taula--compacta' : '') + '"><thead><tr>' +
      cap.map(function (c, j) { return '<th' + (nums[j] ? ' class="gs-num"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      files.map(function (f) {
        if (f.s) return '<tr class="gs-informe__seccio"><td colspan="' + cap.length + '">' + esc(f.s) + '</td></tr>';
        if (f.t) return '<tr class="gs-informe__total">' + f.t.map(cel).join('') + '</tr>';
        return '<tr>' + f.map(cel).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    var colPdf = {}; nums.forEach(function (n, j) { if (n) colPdf[j] = { halign: 'right' }; });
    return pregunta(titol, html, [{ t: 'PDF', valor: 0, tipus: 'ghost', abans: function () { pdfInforme(titol, subtitol, cap, files, nomFitxer, { esquerra: true, columnes: colPdf, compacte: compacte }); return false; } }, { t: 'Tanca', valor: 1 }], compacte && cap.length <= 4);
  }
  // El mateix disseny que l'exportació a PDF de la graella
  function pdfInforme(titol, subtitol, cap, files, nom, opcions) {
    opcions = opcions || {};
    var crida = logoPdf().then(function (logo) {
      var doc = new window.jspdf.jsPDF({ orientation: opcions.vertical || cap.length <= 7 ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' });
      var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
      var data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      var cos = files.map(function (f) {
        if (f.s) return [{ content: f.s, colSpan: cap.length, styles: { fillColor: [238, 240, 255], textColor: [28, 12, 188], fontStyle: 'bold' } }];
        if (f.t) return f.t.map(function (x) { return { content: x, styles: { fontStyle: 'bold', fillColor: [246, 247, 252] } }; });
        return f;
      });
      var y0 = opcions.capcalera ? opcions.capcalera(doc, M, W) : Y_TAULA;
      var colEst = {}; cap.forEach(function (c, j) { if (j && !opcions.esquerra) colEst[j] = { halign: 'right' }; });
      Object.assign(colEst, opcions.columnes || {});
      // PAS 31 · dues cares: la meitat de les files a cada full, amb l'alçada i la lletra ajustades perquè hi càpiguen
      var trossos = [cos], estils = opcions.estils || {};
      if (opcions.duesCares && cos.length > 1) {
        // PAS 32: la capçalera de la taula fa la mateixa alçada que una fila; es tria el repartiment (files a la 1a cara) que
        // dona les files més altes, de manera que les dues cares quedin plenes (la 1a té menys lloc per la data i la descripció)
        var h1 = H - 12 - y0, h2 = H - 12 - Y_TAULA, n = cos.length, r1 = 1, alt = 0;
        for (var k = 1; k < n; k++) { var a = Math.min(h1 / (k + 1), h2 / (n - k + 1)); if (a > alt) { alt = a; r1 = k; } }
        alt = Math.min(16, alt) - 0.2;
        estils = Object.assign({}, estils, { minCellHeight: alt, fontSize: Math.max(6.5, Math.min(12, alt * 1.3)), cellPadding: { top: 0.3, bottom: 0.3, left: 2, right: 2 } });
        trossos = [cos.slice(0, r1), cos.slice(r1)];
      }
      trossos.forEach(function (tros, ti) {
      if (ti) doc.addPage();
      // PAS 35: compacte → amplada segons el contingut (columnes de xifres estretes)
      if (opcions.compacte) cap.forEach(function (c, j) { if (j) colEst[j] = Object.assign({ cellWidth: Math.max(16, Math.min(30, String(c).length * 2.1 + 6)) }, colEst[j] || {}); else colEst[0] = Object.assign({ cellWidth: 'wrap' }, colEst[0] || {}); });
      doc.autoTable({
        head: [cap], body: tros, startY: ti ? Y_TAULA : y0, margin: { top: Y_TAULA, left: M, right: M, bottom: 12 }, columnStyles: colEst, tableWidth: opcions.compacte ? 'wrap' : 'auto',
        styles: Object.assign({ font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle', lineColor: [225, 229, 238], lineWidth: 0.1 }, estils),
        headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: opcions.sensAlternes ? { fillColor: [255, 255, 255] } : { fillColor: [247, 248, 252] },
        didDrawPage: function () {
          capPdf(doc, logo, titol.toUpperCase() + ' · Institut Joan Miró', data + ' · ' + subtitol, M, W);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120);
          doc.text('Pàgina ' + doc.internal.getNumberOfPages(), W - M, H - 6, { align: 'right' });
        }
      });
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
    // PAS 32: només el professorat amb estat «actiu» (ni baixes, ni baixes laborals, ni permisos)
    var gent = S.taula.getData('active').filter(function (d) { return String(d.estat || '').trim().toLowerCase() === 'actiu' && !esProva(d) && String(d.id).indexOf('nou-') !== 0; }).sort(ordenaCognoms);
    var avui = new Date(), iso = avui.getFullYear() + '-' + ('0' + (avui.getMonth() + 1)).slice(-2) + '-' + ('0' + avui.getDate()).slice(-2);
    pregunta('Llistat per signar', '<p class="gs-ajuda">PDF amb <strong>' + gent.length + '</strong> persones: el professorat <strong>en actiu</strong> que es veu ara a la graella (amb els filtres), per ordre de cognoms, repartit entre les dues cares d’un full.</p>' +
      '<div class="gs-form-fila"><label>Data <input type="date" id="gsLlData" value="' + iso + '"></label></div>' +
      '<label class="gs-form-fila gs-form-fila--ample">Descripció <textarea id="gsLlDesc" rows="3" placeholder="P. ex. Claustre ordinari"></textarea></label>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Genera el PDF', valor: 1, abans: function () { llistatSignatures.o = { data: $('gsLlData').value, desc: $('gsLlDesc').value.trim() }; } }], false).then(function (v) {
      if (!v) return;
      var o = llistatSignatures.o;
      var cognoms = function (d) { return [d.cognom1, d.cognom2].filter(Boolean).join(' ') + (d.nom ? ', ' + d.nom : ''); };
      pdfInforme('Professorat', gent.length + ' persones', ['', 'Professor/a', 'Signatura'], gent.map(function (d, i) { return [String(i + 1), cognoms(d), '']; }), 'llistat-professorat', {
        vertical: true, esquerra: true, sensAlternes: true, duesCares: true,
        estils: { fontSize: 10, minCellHeight: 10, cellPadding: 2 },
        columnes: { 0: { cellWidth: 12, halign: 'right' }, 1: { cellWidth: 95 }, 2: { cellWidth: 'auto' } },
        capcalera: function (doc, M, W) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 42);
          doc.text('Data:', M, 30); doc.setFont('helvetica', 'normal'); doc.text(o.data ? dataCat(o.data) : '____ / ____ / ________', M + 13, 30);
          doc.setFont('helvetica', 'bold'); doc.text('Descripció:', M, 37); doc.setFont('helvetica', 'normal');
          var ll = doc.splitTextToSize(o.desc || '', W - 2 * M - 24); if (!ll.length) ll = [''];
          ll.forEach(function (l, i) { doc.text(l, M + 24, 37 + i * 5); });
          if (!o.desc) { doc.setDrawColor(185, 192, 208); doc.setLineWidth(0.2); doc.line(M + 24, 38, W - M, 38); }
          return 43 + (ll.length - 1) * 5;
        }
      });
    });
  }
  // ================================================================== PAS 38 · CONSELL ORIENTADOR 4t ESO
  var cursConsell = function () { return S.cursConsell || S.d.curs || ''; };
  var delCursConsell = function (d) { return !esConsell() || !cursConsell() || d.curs === cursConsell(); };
  function pintaEinesConsell() {
    var ed = potEditar(), cursos = {};
    S.d.files.forEach(function (f) { if (f.curs) cursos[f.curs] = 1; }); if (S.d.curs) cursos[S.d.curs] = 1;
    var llista = Object.keys(cursos).sort().reverse();
    $('gsEines').innerHTML =
      '<span class="gs-periode"><label>Curs <select id="gsCoCurs">' + llista.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + (c === S.d.curs ? ' (actual)' : '') + '</option>'; }).join('') + '</select></label></span>' +
      '<span class="gs-compte" id="gsCompte"></span>' +
      (S.d.abast ? '<span class="gs-gris" title="El vostre equip té aquests grups">Grups: ' + esc(S.d.abast.join(', ')) + '</span>' : '') +
      '<span class="gs-espai"></span>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="co-analisi" title="Comptadors de cada orientació per grup (de les files que es veuen)">Anàlisi</button>' +
      (ed ? '<button type="button" class="prog-btn" data-accio="co-pdf" title="Un PDF per grup, amb una pàgina per alumne, per imprimir i lliurar">PDF per lliurar</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Visualització camps</button>' +
      (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="co-config" title="Carpeta de Drive dels PDF">Configuració</button><button type="button" class="prog-btn prog-btn--ghost" data-accio="camps" title="Opcions de les llistes (orientacions, resultats…)">Gestió camps</button>' + BOTO_ACTUALITZA : '') +
      '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button></span>';
    $('gsCoCurs').value = cursConsell();
    $('gsCoCurs').addEventListener('change', function () { S.cursConsell = this.value; aplicaFiltre(); });
  }
  // Anàlisi: per a cada grup (de les files que es veuen), quants alumnes hi ha a cada opció
  function analisiConsell() {
    var Q = [['orientacio_inicial', 'Orientació inicial'], ['orientacio_final', 'Orientació final'], ['resultat_final', 'Resultat final'], ['voluntat_familia', 'Voluntat de la família/alumne'], ['coincidencia', 'Orientació final i voluntat de la família']];
    pregunta('Anàlisi · Consell orientador', '<p class="gs-ajuda">Compta els alumnes que es veuen ara a la graella (curs i filtres), per grup.</p><label class="gs-form-fila">Què voleu comptar <select id="gsCoQue">' +
      Q.map(function (q) { return '<option value="' + q[0] + '">' + q[1] + '</option>'; }).join('') + '</select></label>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Mostra l’anàlisi', valor: 1, abans: function () { analisiConsell.k = $('gsCoQue').value; } }]).then(function (v) {
      if (!v) return;
      var k = analisiConsell.k, files = S.taula.getData('active'), grups = [];
      files.forEach(function (f) { if (grups.indexOf(f.grup) < 0) grups.push(f.grup); }); grups.sort(ordreGrup);
      var valor = function (f) {
        if (k !== 'coincidencia') return f[k] || '(sense dades)';
        if (!f.orientacio_final || !f.voluntat_familia) return '(sense dades)';
        return f.orientacio_final === f.voluntat_familia ? 'Coincideixen' : 'No coincideixen';
      };
      var opcions = k === 'coincidencia' ? ['Coincideixen', 'No coincideixen'] : (k === 'resultat_final' ? S.d.consell.resultats : (k === 'voluntat_familia' ? (S.d.camps.filter(function (c) { return c.clau === k; })[0] || { valors: '' }).valors.split('|').filter(Boolean) : S.d.consell.orientacions));
      var per = {}; files.forEach(function (f) { var x = valor(f); per[x] = per[x] || {}; per[x][f.grup] = (per[x][f.grup] || 0) + 1; });
      Object.keys(per).forEach(function (x) { if (opcions.indexOf(x) < 0 && x !== '(sense dades)') opcions.push(x); });
      if (per['(sense dades)']) opcions.push('(sense dades)');
      var tot = function (x) { return grups.reduce(function (s, g) { return s + ((per[x] || {})[g] || 0); }, 0); };
      var nom = Q.filter(function (q) { return q[0] === k; })[0][1];
      informe('Consell orientador · ' + nom, files.length + ' alumnes · curs ' + cursConsell() + (S.taula.getHeaderFilters().length ? ' · amb filtres' : '') + '.',
        [nom].concat(grups, ['Total']),
        opcions.filter(function (x) { return tot(x) > 0 || x !== '(sense dades)'; }).map(function (x) { return [x].concat(grups.map(function (g) { return String((per[x] || {})[g] || 0); }), [String(tot(x))]); })
          .concat([{ t: ['Total'].concat(grups.map(function (g) { return String(files.filter(function (f) { return f.grup === g; }).length); }), [String(files.length)]) }]),
        'consell-orientador-' + k, false);
    });
  }
  // PAS 40 · Buida les dades del consell orientador d'un alumne (queda pendent de desar, com qualsevol canvi de la graella)
  function buidaConsell(row) {
    var d = row.getData(), camps = S.d.camps.filter(function (c) { return editable(c) && d[c.clau]; });
    if (!camps.length) return toast('Aquest alumne no té cap dada del consell orientador.', true);
    pregunta('Buidar les dades', '<p>Es buidaran les dades del consell orientador de <strong>' + esc(d.alumne) + '</strong>: ' + esc(camps.map(function (c) { return c.nom; }).join(', ')) + '.</p><p class="gs-ajuda">L’alumne no s’esborra ni es dona de baixa (això es fa a Alumnat ESO). El canvi queda pendent fins que premeu «Desa els canvis».</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Buida', valor: 1, tipus: 'danger' }]).then(function (v) {
      if (!v) return;
      var x = {}; camps.forEach(function (c) { x[c.clau] = ''; }); row.update(x);
      camps.forEach(function (c) { registra(d.id, c.clau, ''); var ce = row.getCell(c.clau); if (ce) ce.getElement().classList.add('gs-canviat'); });
      toast('Dades buidades. Premeu «Desa els canvis».');
    });
  }
  // PAS 41 · Assignacions: repartir les hores d'un grup entre especialitats (parts d'1 h, 2 h…)
  // la matèria d'una assignació: per id (administració) o per nivell + nom (la resta no veu l'id)
  var materiaDe = function (d) { return (S.d.materies || []).filter(function (x) { return d.id_materia ? x.id === d.id_materia : x.nivell === d.nivell && x.materia === d.materia; })[0]; };
  var totalMateria = function (d) { var m = materiaDe(d); return m ? numero(m.hores_a) + numero(m.hores_b) : null; };
  var clauGrup = function (d) { return (d.id_materia || d.nivell + '|' + d.materia) + '|' + (d.num_grup || d.grup); };
  var sumaGrup = function (d) { var k = clauGrup(d); return S.taula.getData().filter(function (x) { return clauGrup(x) === k; }).reduce(function (t, x) { return t + numero(x.hores); }, 0); };
  function divideixAssignacio(row) {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    var d = row.getData(), h = numero(d.hores);
    if (h < 2) return toast('Aquesta part només té ' + fmtH(h) + ' h: no es pot repartir més.', true);
    var esp = (S.d.camps.filter(function (c) { return c.clau === 'especialitat'; })[0] || { valors: '' }).valors.split('|').filter(Boolean);
    pregunta('Repartir les hores · ' + d.materia + ' · ' + d.grup, '<p class="gs-ajuda">Aquesta part té <strong>' + fmtH(h) + ' h</strong> (' + esc(d.especialitat || 'sense especialitat') + '). Es queda amb les hores que indiqueu i la resta passa a una part nova, amb l’especialitat que trieu. Podeu tornar a repartir qualsevol part.</p>' +
      '<div class="gs-form-fila"><label>Hores que es queda aquesta part <input type="number" id="gsDivH" min="1" max="' + (h - 1) + '" step="1" value="' + Math.max(1, Math.floor(h - 1)) + '"></label>' +
      '<label>Especialitat de la part nova (<span id="gsDivR"></span> h) <select id="gsDivE">' + esp.map(function (e) { return '<option' + (e === d.especialitat ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></label></div><p class="prog-avis" id="gsDivErr" hidden></p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Reparteix', valor: 1, abans: function () {
        var x = numero($('gsDivH').value); if (!(x > 0 && x < h)) { $('gsDivErr').textContent = 'Han de ser entre 1 i ' + fmtH(h - 1) + ' h.'; $('gsDivErr').hidden = false; return false; }
        divideixAssignacio.v = { id: d.id, hores: x, especialitat: $('gsDivE').value };
      } }], false).then(function (v) {
      if (!v) return;
      api('curriculum_divideix', divideixAssignacio.v, 'Repartint…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        row.update(copia(r.fila)); S.d.files = S.d.files.map(function (f) { return f.id === r.fila.id ? copia(r.fila) : f; });
        S.d.files.push(copia(r.nova)); S.taula.addRow(copia(r.nova), false, row).then(function () { aplicaFiltre(); S.taula.getRows().forEach(function (rw) { rw.reformat(); }); });
        if (r.versio) S.d.versio = r.versio;
        toast('Repartit: ' + fmtH(numero(r.fila.hores)) + ' h (' + (r.fila.especialitat || '—') + ') + ' + fmtH(numero(r.nova.hores)) + ' h (' + (r.nova.especialitat || '—') + ').');
      });
    });
    var posa = function () { $('gsDivR').textContent = fmtH(Math.max(0, h - numero($('gsDivH').value))); }; $('gsDivH').addEventListener('input', posa); posa();
  }
  // PAS 42 · Hores lectives de cada docent (camps de la fitxa del professorat). Es carreguen amb el mòdul (S.d.professorat_hores):
  // lectives amb alumnat + reduccions; els totals es calculen sols i ⚠ si el total supera el màxim de la jornada.
  var COLS_HL = [['lectives_eso', 'ESO', 'Lectives matèries ESO'], ['lectives_bat', 'Bat', 'Lectives matèries Bat'], ['atencio_individual', 'AI', 'Atenció individual (ahl)'], ['tutoria_eso12', 'Tut 1-2', 'Tutoria (matèria) ESO 1r/2n'], ['tutoria_eso34', 'Tut 3-4', 'Tutoria (matèria) ESO 3r/4t'], ['tutoria_bat', 'Tut Bat', 'Tutoria (matèria) Bat']];
  var COLS_RED = [['red_tutoria_eso12', 'R.Tut', 'Red. tutoria ESO 1r/2n (ahl)'], ['carrec_directiu', 'CD', 'Càrrec directiu (cd1)'], ['coordinacio_lectiu', 'CC', 'Coordinació lectiu (cc)'], ['red_coord_nivell', 'R.Niv', 'Red. coord. nivell (ahl)'], ['red_lectiva_55', 'R.55', 'Red. lectiva 55 (ahl)']];
  var maxJornada = function (j) { var M = (S.d && S.d.max_lectives) || { 'Sencera': 18, '1/2': 9, '⅔': 12 }; return M[j] || null; };
  var sumaHL = function (o, cols) { var b = cols.filter(function (c) { return String(o[c[0]] == null ? '' : o[c[0]]).trim() !== ''; }); return b.length ? b.reduce(function (t, c) { return t + numero(o[c[0]]); }, 0) : ''; };
  function horesLectives() {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    var llista = S.d.professorat_hores || [], pot = !!S.d.hores_pot_desar;
    if (!llista.length) return toast('No hi ha professorat (o cal executar «configura»).', true);
    var per = {}; llista.forEach(function (p) { var e = p.especialitat || '(sense especialitat)'; (per[e] = per[e] || []).push(p); });
    var esp = Object.keys(per).sort(function (a, b) { return a.localeCompare(b, 'ca'); });
    var totes = COLS_HL.concat(COLS_RED), cel = function (p, c) { var v = String(p[c[0]] == null ? '' : p[c[0]]); return '<td class="gs-num">' + (pot ? '<input type="number" min="0" max="40" step="0.5" data-id="' + esc(p.id) + '" data-k="' + c[0] + '" data-abans="' + esc(v) + '" value="' + esc(v.replace(',', '.')) + '" aria-label="' + esc(c[2]) + '">' : esc(v)) + '</td>'; };
    var html = '<p class="gs-ajuda">Hores lectives de cada docent (fitxa del professorat; també es canvien des del mòdul Professorat). <strong>Alumnat</strong> = lectives amb alumnat (el que fa servir el Currículum); <strong>Total</strong> = alumnat + reduccions. ⚠ = el total supera el màxim de la jornada (sencera 18, ⅔ 12, mitja 9).</p>' +
      '<div class="gs-informe gs-hl-wrap"><table class="gs-form-taula gs-informe__taula gs-hl"><thead><tr><th rowspan="2">Professor/a</th><th rowspan="2">Jornada</th><th colspan="' + (COLS_HL.length + 1) + '" class="gs-hl__grup">Lectives amb alumnat</th><th colspan="' + (COLS_RED.length + 1) + '" class="gs-hl__grup">Reduccions</th></tr><tr>' +
      COLS_HL.map(function (c) { return '<th class="gs-num" title="' + esc(c[2]) + '">' + c[1] + '</th>'; }).join('') + '<th class="gs-num">Alumnat</th>' + COLS_RED.map(function (c) { return '<th class="gs-num" title="' + esc(c[2]) + '">' + c[1] + '</th>'; }).join('') + '<th class="gs-num">Total</th></tr></thead><tbody>' +
      esp.map(function (e) {
        return '<tr class="gs-informe__seccio"><td colspan="' + (totes.length + 4) + '">' + esc(e) + ' · <span data-tot="' + esc(e) + '"></span> h amb alumnat</td></tr>' + per[e].map(function (p) {
          return '<tr data-fila="' + esc(p.id) + '" data-esp="' + esc(e) + '" data-j="' + esc(p.jornada) + '"><td>' + esc(p.nom) + (p.carrec ? '<br><small class="gs-gris">' + esc(p.carrec) + '</small>' : '') + '</td><td>' + esc(p.jornada || '—') + '</td>' +
            COLS_HL.map(function (c) { return cel(p, c); }).join('') + '<td class="gs-num gs-hl__tot" data-t="a"></td>' + COLS_RED.map(function (c) { return cel(p, c); }).join('') + '<td class="gs-num gs-hl__tot" data-t="t"></td></tr>';
        }).join('');
      }).join('') + '</tbody></table></div>';
    pregunta('Hores lectives classe', html, pot ? [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa', valor: 1, abans: function () {
      var canvis = {};
      [].forEach.call($('gsModalText').querySelectorAll('input[data-id]'), function (i) { if (String(i.value) !== String(i.dataset.abans).replace(',', '.')) (canvis[i.dataset.id] = canvis[i.dataset.id] || {})[i.dataset.k] = i.value; });
      horesLectives.c = Object.keys(canvis).map(function (id) { return { id: id, valors: canvis[id] }; });
    } }] : [{ t: 'Tanca', valor: 0 }], false).then(function (v) {
      if (!v) return;
      if (!horesLectives.c.length) return toast('No hi ha cap canvi.');
      api('hores_lectives_desa', { canvis: horesLectives.c }, 'Desant les hores lectives…').then(function (r2) {
        if (!r2.ok) return toast(text(r2.error), true);
        delete S.cache.professorat; S.d.professorat_hores = r2.professorat;
        toast('Hores lectives desades (' + r2.desats + ' docents).');
      });
    });
    var box = $('gsModalText').closest('.prog-modal__box'); box.classList.add('gs-modal--ample', 'gs-modal--hl');
    var valor = function (tr, k) { var i = tr.querySelector('input[data-k="' + k + '"]'); if (i) return i.value; var p = llista.filter(function (x) { return x.id === tr.dataset.fila; })[0]; return p ? p[k] : ''; };
    var recalcula = function () {
      var tots = {};
      [].forEach.call($('gsModalText').querySelectorAll('tr[data-fila]'), function (tr) {
        var o = {}; COLS_HL.concat(COLS_RED).forEach(function (c) { o[c[0]] = valor(tr, c[0]); });
        var a = sumaHL(o, COLS_HL), t = sumaHL(o, COLS_HL.concat(COLS_RED)), mx = maxJornada(tr.dataset.j);
        tr.querySelector('[data-t="a"]').textContent = a === '' ? '' : fmtH(a);
        var ct = tr.querySelector('[data-t="t"]'); ct.innerHTML = t === '' ? '' : esc(fmtH(t)) + (mx && t > mx ? ' <span class="gs-avis-ret" title="Supera les ' + mx + ' h de la jornada ' + esc(tr.dataset.j) + '">⚠</span>' : '');
        tots[tr.dataset.esp] = (tots[tr.dataset.esp] || 0) + (a === '' ? 0 : a);
      });
      [].forEach.call($('gsModalText').querySelectorAll('[data-tot]'), function (s) { s.textContent = fmtH(tots[s.dataset.tot] || 0); });
    };
    $('gsModalText').addEventListener('input', recalcula); recalcula();
  }
  // PAS 41 · Document per especialitat (per al cap de departament): hores de l'especialitat, cedides, assignades d'altres
  // especialitats, professorat amb les hores lectives i balanç
  function dadesEspecialitat(e) {
    var files = S.d.files.map(function (f) { var m = materiaDe(f) || {}; return { nivell: f.nivell, materia: f.materia, esp_mat: m.especialitat || '', assig: f.especialitat || '', hores: numero(f.hores), a: m.hores_a || '', b: m.hores_b || '', g: clauGrup(f) }; });
    var agrupa = function (ll) {
      var per = {}; ll.forEach(function (f) { var k = f.nivell + '|' + f.materia + '|' + f.esp_mat + '|' + f.assig; var x = per[k] = per[k] || { f: f, grups: {}, hores: 0 }; x.grups[f.g] = 1; x.hores += f.hores; });
      var o = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'];
      return Object.keys(per).map(function (k) { return per[k]; }).sort(function (x, y) { return (o.indexOf(x.f.nivell) - o.indexOf(y.f.nivell)) || x.f.materia.localeCompare(y.f.materia, 'ca'); })
        .map(function (x) { return { cel: [x.f.nivell, x.f.materia, String(Object.keys(x.grups).length), String(x.f.a), String(x.f.b), fmtH(x.hores), x.f.esp_mat, x.f.assig], hores: x.hores }; });
    };
    var propies = agrupa(files.filter(function (f) { return f.esp_mat === e; }));
    var cedides = agrupa(files.filter(function (f) { return f.esp_mat === e && f.assig !== e; }));
    var alienes = agrupa(files.filter(function (f) { return f.esp_mat !== e && f.assig === e; }));
    var prof = (S.d.professorat_hores || []).filter(function (p) { return p.especialitat === e; });
    var sum = function (ll) { return ll.reduce(function (t, x) { return t + x.hores; }, 0); };
    var tE = sum(propies), tC = sum(cedides), tA = sum(alienes), tP = prof.reduce(function (t, p) { return t + numero(p.hores_lectives); }, 0);
    return { propies: propies, cedides: cedides, alienes: alienes, prof: prof, tE: tE, tC: tC, tA: tA, tP: tP, aImpartir: tE - tC + tA, balanc: tP - (tE - tC + tA) };
  }
  var CAP_ESP = ['Nivell', 'Matèria', 'Grups', 'Hores A', 'Hores B', 'Total', 'Especialitat', 'Assignació'];
  function documentEspecialitat() {
    if (S.modul.id !== 'curriculum_grups') return;
    var esps = {}; (S.d.materies || []).forEach(function (m) { if (m.especialitat) esps[m.especialitat] = 1; }); S.d.files.forEach(function (f) { if (f.especialitat) esps[f.especialitat] = 1; });
    var llista = Object.keys(esps).sort(function (a, b) { return a.localeCompare(b, 'ca'); });
    var taula = function (titol, ll, total) {
      return '<p class="gs-amon__tit">' + esc(titol) + ' · ' + fmtH(total) + ' h</p>' + (ll.length ? '<div class="gs-informe"><table class="gs-form-taula gs-informe__taula"><thead><tr>' + CAP_ESP.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
        ll.map(function (x) { return '<tr>' + x.cel.map(function (c, j) { return '<td' + (j >= 2 && j <= 5 ? ' class="gs-num"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '<p class="gs-gris">Cap.</p>');
    };
    var pinta = function () {
      var e = $('gsEspSel').value, D = dadesEspecialitat(e);
      $('gsEspDoc').innerHTML = taula('Matèries de l’especialitat', D.propies, D.tE) + taula('Matèries/grups cedits a altres especialitats', D.cedides, D.tC) + taula('Matèries/grups assignats d’altres especialitats', D.alienes, D.tA) +
        '<p class="gs-amon__tit">Professorat · ' + fmtH(D.tP) + ' h lectives</p><div class="gs-informe"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Professor/a</th><th>Càrrec</th><th class="gs-num">Hores lectives</th></tr></thead><tbody>' +
        (D.prof.length ? D.prof.map(function (p) { return '<tr><td>' + esc(p.nom) + '</td><td>' + esc(p.carrec) + '</td><td class="gs-num">' + esc(p.hores_lectives || '—') + '</td></tr>'; }).join('') : '<tr><td colspan="3" class="gs-gris">Cap docent amb aquesta especialitat.</td></tr>') + '</tbody></table></div>' +
        '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-balanc"><tbody>' +
        [['Total hores de l’especialitat', D.tE], ['− Hores cedides', D.tC], ['+ Hores assignades d’altres', D.tA], ['= Hores a impartir', D.aImpartir], ['Hores lectives del professorat', D.tP], ['Balanç (professorat − a impartir)', D.balanc]]
          .map(function (x, i) { return '<tr' + (i === 3 || i === 5 ? ' class="gs-informe__total"' : '') + '><td>' + x[0] + '</td><td class="gs-num">' + fmtH(x[1]) + '</td></tr>'; }).join('') + '</tbody></table>' +
        '<p class="gs-ajuda">Balanç positiu: sobren hores de professorat; negatiu: en falten.</p>';
    };
    pregunta('Document per especialitat', '<div class="gs-form-fila"><label>Especialitat <select id="gsEspSel">' + llista.map(function (e) { return '<option>' + esc(e) + '</option>'; }).join('') + '</select></label></div><div id="gsEspDoc"></div>',
      [{ t: 'PDF de totes', valor: 0, tipus: 'ghost', abans: function () { pdfEspecialitats(llista); return false; } }, { t: 'PDF', valor: 0, tipus: 'ghost', abans: function () { pdfEspecialitats([$('gsEspSel').value]); return false; } }, { t: 'Tanca', valor: 1 }], false);
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample');
    $('gsEspSel').addEventListener('change', pinta); pinta();
  }
  function pdfEspecialitats(llista) {
    var crida = logoPdf().then(function (logo) {
      var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12, data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      var est = { font: 'helvetica', fontSize: 8, cellPadding: 1.4, lineColor: [225, 229, 238], lineWidth: 0.1 };
      llista.forEach(function (e, n) {
        if (n) doc.addPage();
        var D = dadesEspecialitat(e), y = Y_TAULA;
        var peu = function () { capPdf(doc, logo, ('Currículum · ' + e).toUpperCase() + ' · Institut Joan Miró', data + ' · Document per al cap de departament', M, W); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120); doc.text('Pàgina ' + doc.internal.getNumberOfPages(), W - M, H - 6, { align: 'right' }); };
        var titol = function (t) { if (y > H - 30) { doc.addPage(); y = Y_TAULA; } doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(28, 12, 188); doc.text(t, M, y + 4); y += 6; };
        var taula = function (head, body, opc) { doc.autoTable(Object.assign({ head: [head], body: body, startY: y, margin: { top: Y_TAULA, left: M, right: M, bottom: 12 }, styles: est, headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 248, 252] }, didDrawPage: peu }, opc || {})); y = doc.lastAutoTable.finalY + 5; };
        var cols = { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } };
        [['Matèries de l’especialitat', D.propies, D.tE], ['Matèries/grups cedits a altres especialitats', D.cedides, D.tC], ['Matèries/grups assignats d’altres especialitats', D.alienes, D.tA]].forEach(function (s) {
          titol(s[0] + ' · ' + fmtH(s[2]) + ' h');
          taula(CAP_ESP, s[1].length ? s[1].map(function (x) { return x.cel; }) : [[{ content: 'Cap.', colSpan: 8 }]], { columnStyles: cols });
        });
        titol('Professorat · ' + fmtH(D.tP) + ' h lectives');
        taula(['Professor/a', 'Càrrec', 'Hores lectives'], D.prof.length ? D.prof.map(function (p) { return [p.nom, p.carrec, p.hores_lectives || '—']; }) : [[{ content: 'Cap docent amb aquesta especialitat.', colSpan: 3 }]], { columnStyles: { 2: { halign: 'right' } } });
        titol('Balanç d’hores');
        taula(['Concepte', 'Hores'], [['Total hores de l’especialitat', fmtH(D.tE)], ['- Hores cedides', fmtH(D.tC)], ['+ Hores assignades d’altres especialitats', fmtH(D.tA)], ['= Hores a impartir', fmtH(D.aImpartir)], ['Hores lectives del professorat', fmtH(D.tP)], ['Balanç (professorat - a impartir)', fmtH(D.balanc)]],
          { tableWidth: 110, columnStyles: { 1: { halign: 'right' } }, didParseCell: function (h) { if (h.section === 'body' && (h.row.index === 3 || h.row.index === 5)) h.cell.styles.fontStyle = 'bold'; } });
        if (!n) peu();
      });
      doc.save('curriculum-especialitats-' + new Date().toISOString().slice(0, 10) + '.pdf');
    });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  // PAS 39 · Configuració (administració del mòdul): carpeta de Drive dels PDF; s'hi creen les subcarpetes Inicial i Final
  function configConsell() {
    pregunta('Configuració · Consell orientador', '<label class="gs-form-fila gs-form-fila--ample">Carpeta de Drive dels PDF <input id="gsCoCarp" value="' + esc(S.d.consell.carpeta || '') + '" placeholder="https://drive.google.com/drive/folders/…"></label>' +
      '<p class="gs-ajuda">Dins d’aquesta carpeta es creen (si no hi són) les subcarpetes <strong>Inicial</strong> i <strong>Final</strong>, i cada PDF es desa a la seva. Ha de ser accessible per al compte que executa GESTIO. En blanc, es fa servir «GESTIO · Consell orientador».</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa', valor: 1, abans: function () { configConsell.v = $('gsCoCarp').value.trim(); } }], false).then(function (v) {
      if (!v) return;
      api('consell_config', { carpeta: configConsell.v }, 'Desant la configuració…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        S.d.consell.carpeta = r.carpeta; toast(r.carpeta ? 'Configuració desada. Subcarpetes Inicial i Final a punt.' : 'Configuració desada: es farà servir la carpeta «GESTIO · Consell orientador».');
      });
    });
  }
  // PDF per lliurar: un PDF per grup (una pàgina per alumne) amb l'orientació inicial o final. Abans, es diu qui no té dades.
  function pdfConsell() {
    if (S.brut) return toast('Primer deseu els canvis de la graella.', true);
    var actual = S.d.files.filter(function (f) { return f.curs === S.d.curs; }), grups = [];
    actual.forEach(function (f) { if (f.grup && grups.indexOf(f.grup) < 0 && (!S.d.abast || S.d.abast.indexOf(f.grup) >= 0)) grups.push(f.grup); }); grups.sort(ordreGrup);
    if (!grups.length) return toast('No hi ha alumnes de 4t d’ESO aquest curs.', true);
    var complet = function (f, fase) { return fase === 'inicial' ? !!f.orientacio_inicial : !!(f.resultat_final && f.orientacio_final); };
    pregunta('PDF per lliurar · Consell orientador', '<div class="gs-form-fila"><label>Document <select id="gsCoFase"><option value="inicial">Orientació inicial</option><option value="final">Orientació final</option></select></label>' +
      '<label>Data del document <input type="date" id="gsCoData" value="' + esc(isoDe(new Date())) + '"></label></div>' +
      '<p class="gs-ajuda">Grups (curs ' + esc(S.d.curs) + '):</p><div class="gs-cols" id="gsCoGrups">' + grups.map(function (g) { return '<label><input type="checkbox" value="' + esc(g) + '" checked> ' + esc(g) + ' <small class="gs-gris" data-g="' + esc(g) + '"></small></label>'; }).join('') + '</div>' +
      '<p class="gs-ajuda">Es fa un PDF per grup, amb una pàgina per alumne, i es desa a la carpeta de Drive del consell orientador. Els alumnes sense dades no hi surten.</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Fes els PDF', valor: 1, abans: function () {
        pdfConsell.o = { fase: $('gsCoFase').value, data: $('gsCoData').value, grups: [].map.call($('gsCoGrups').querySelectorAll('input:checked'), function (i) { return i.value; }) };
        if (!pdfConsell.o.grups.length) { toast('Trieu algun grup.', true); return false; }
      } }], false).then(function (v) {
      if (!v) return;
      var o = pdfConsell.o, res = [], i = 0;
      var seguent = function () {
        if (i >= o.grups.length) return resultat();
        var g = o.grups[i++];
        api('consell_pdf', { fase: o.fase, grup: g, data: o.data, igualment: true }, 'Fent el PDF de ' + g + ' (' + i + ' de ' + o.grups.length + ')…').then(function (r) {
          res.push({ grup: g, r: r });
          if (r.ok) (r.ids || []).forEach(function (id) {
            var x = {}; x[r.camp] = r.pdf; var row = S.taula.getRow(id); if (row) row.update(x);
            var f = S.d.files.filter(function (y) { return y.id === id; })[0]; if (f) f[r.camp] = r.pdf;
          });
          seguent();
        });
      };
      var resultat = function () {
        pregunta('PDF del consell orientador ' + o.fase, '<ul class="gs-co-res">' + res.map(function (x) {
          return '<li><strong>' + esc(x.grup) + '</strong>: ' + (x.r.ok ? '<a href="' + esc(x.r.pdf) + '" target="_blank" rel="noopener">obre el PDF</a> (' + x.r.alumnes + ' alumnes)' +
            (x.r.falten && x.r.falten.length ? '<br><small class="prog-avis">Sense dades (no hi surten): ' + esc(x.r.falten.join('; ')) + '</small>' : '') :
            '<span class="prog-avis">' + esc(text(x.r.error)) + (x.r.falten ? ': ' + esc(x.r.falten.join('; ')) : '') + '</span>') + '</li>';
        }).join('') + '</ul>', [{ t: 'Tanca', valor: 1 }]);
      };
      seguent();
    });
    var posaFalten = function () {
      var fase = $('gsCoFase').value;
      grups.forEach(function (g) { var n = actual.filter(function (f) { return f.grup === g && !complet(f, fase); }).length, t = actual.filter(function (f) { return f.grup === g; }).length;
        var el = $('gsCoGrups').querySelector('[data-g="' + g + '"]'); if (el) el.textContent = n ? '(' + (t - n) + ' de ' + t + ' amb dades)' : '(' + t + ' alumnes)'; });
    };
    $('gsCoFase').addEventListener('change', posaFalten); posaFalten();
  }

  // ================================================================== PAS 39 · CURRÍCULUM
  // Dues vistes amb el mateix permís: «Matèries» (curriculum) i «Assignacions» (curriculum_grups)
  var nivellCurr = function (d) { return !esCurriculum() || !S.nivellCurr || d.nivell === S.nivellCurr; };
  var horesA = function (d) { var n = Number(String(d.hores_a || '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  var horesB = function (d) { var n = Number(String(d.hores_b || '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  var numero = function (x) { var n = Number(String(x == null ? '' : x).replace(',', '.')); return isNaN(n) ? 0 : n; };
  var fmtH = function (n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); };
  function pintaEinesCurriculum() {
    var ed = potEditar(), grups = S.modul.id === 'curriculum_grups';
    var nivells = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'];
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist">' +
        '<button type="button" role="tab" data-accio="cur-materies" aria-selected="' + !grups + '">Matèries</button>' +
        '<button type="button" role="tab" data-accio="cur-grups" aria-selected="' + grups + '">Assignacions</button></div>' +
      '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="cur-hores" title="Hores lectives de classe de cada docent (fitxa del professorat)">Hores lectives classe</button>' +
      '<p class="gs-ajuda" style="flex:1 1 100%;margin:0 0 4px">' + (grups ?
        'Cada grup de cada matèria i l’especialitat que l’imparteix (per defecte, la de la matèria; es pot canviar). Amb les <strong>tisores</strong> es reparteixen les hores d’un grup entre especialitats (p. ex. 1 h Anglès + 1 h Alemany + 1 h Matemàtiques). ⚠ = les parts no sumen les hores de la matèria. El professor/a és opcional.' :
        'Matèries de cada nivell. <strong>Hores A</strong>: amb el grup sencer; <strong>hores B</strong>: amb mig grup (desdoblament). Hores de l’alumne = A + B/2; hores de professorat = (A + B) × grups. Quan el currículum estigui a punt, <strong>Genera els grups</strong>.') + '</p>' +
      '<span class="gs-nivells" role="group" aria-label="Nivell que es mostra">' + [''].concat(nivells).map(function (n) {
        return '<button type="button" class="gs-nivells__btn' + ((S.nivellCurr || '') === n ? ' is-actiu' : '') + '" data-accio="cur-nivell" data-nivell="' + esc(n) + '">' + (n || 'Tots') + '</button>'; }).join('') + '</span>' +
      '<span class="gs-compte" id="gsCompte"></span>' +
      (ed ? '<span class="gs-seleccio" id="gsSeleccio" hidden><span id="gsSelN"></span> <button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="aplica-seleccio">Aplica a la selecció…</button> <button type="button" class="gs-enllac" data-accio="treu-seleccio">Treu la selecció</button></span>' : '') +
      '<span class="gs-espai"></span>' +
      (ed && !grups ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="alta">+ Afegeix matèria</button>' : '') +
      (ed && !grups ? '<button type="button" class="prog-btn" data-accio="cur-genera" title="Crea o actualitza una fila per cada matèria i grup">Genera els grups</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="cur-resum" title="Hores de professorat per especialitat i nivell">Hores per especialitat</button>' +
      (grups ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="cur-especialitat" title="Per al cap de departament: hores de l’especialitat, cedides, assignades, professorat i balanç (PDF)">Document per especialitat</button><button type="button" class="prog-btn prog-btn--ghost" data-accio="cur-document" title="Taula per nivell: matèries × grups amb el professorat o l’especialitat (PDF)">Document equips docents</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Visualització camps</button>' +
      (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="camps">Gestió camps</button>' + BOTO_ACTUALITZA : '') +
      '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button></span>';
  }
  function vistaCurriculum(grups) {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    var m = Object.assign({}, S.modul, { id: grups ? 'curriculum_grups' : 'curriculum' });
    obreModul(m);
    $('gsManual').href = '/assets/docs/gestio/manual-curriculum.pdf';
  }
  function generaGrups() {
    if (S.brut) return toast('Primer deseu els canvis de les matèries.', true);
    api('curriculum_genera', { prova: true }, 'Comprovant…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      if (!r.afegides && !r.tretes && !r.actualitzades) return toast('Els grups ja estan al dia amb les matèries.');
      pregunta('Genera els grups', '<p>Es crearà una fila per cada matèria i grup (segons la columna <strong>Grups</strong>):</p><ul>' +
        '<li>Files noves: <strong>' + r.afegides + '</strong> (amb l’especialitat de la matèria)</li><li>Files actualitzades (nom, nivell o hores de la matèria): <strong>' + r.actualitzades + '</strong></li>' +
        '<li>Files que es treuen (matèries esborrades o amb menys grups): <strong>' + r.tretes + '</strong></li></ul>' +
        (r.tretes_amb_professor.length ? '<p class="prog-avis">Es treuran files que ja tenen professor/a: ' + esc(r.tretes_amb_professor.join('; ')) + '</p>' : '') +
        (r.desquadrats && r.desquadrats.length ? '<p class="prog-avis">Grups repartits que no sumen les hores de la matèria (es conserven com estan): ' + esc(r.desquadrats.join('; ')) + '</p>' : '') +
        '<p class="gs-ajuda">Les especialitats i els professors ja assignats es conserven.</p>',
        [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Genera', valor: 1 }], false).then(function (v) {
        if (!v) return;
        api('curriculum_genera', {}, 'Generant els grups…').then(function (r2) {
          if (!r2.ok) return toast(text(r2.error), true);
          delete S.cache.curriculum_grups;
          toast('Grups generats: ' + r2.afegides + ' nous, ' + r2.actualitzades + ' actualitzats, ' + r2.tretes + ' trets.');
          vistaCurriculum(true);
        });
      });
    });
  }
  // Hores de professorat per especialitat i nivell (de les files que es veuen)
  function resumCurriculum() {
    var grups = S.modul.id === 'curriculum_grups', files = S.taula.getData('active'), niv = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'];
    var per = {};
    files.forEach(function (f) {
      var h = grups ? numero(f.hores) : (horesA(f) + horesB(f)) * numero(f.grups), e = f.especialitat || '(sense especialitat)';
      per[e] = per[e] || {}; per[e][f.nivell] = (per[e][f.nivell] || 0) + h;
    });
    var esp = Object.keys(per).sort(function (a, b) { return a.localeCompare(b, 'ca'); }), usats = niv.filter(function (n) { return esp.some(function (e) { return per[e][n]; }); });
    var tot = function (e) { return usats.reduce(function (s, n) { return s + (per[e][n] || 0); }, 0); };
    var totN = function (n) { return esp.reduce(function (s, e) { return s + (per[e][n] || 0); }, 0); };
    informe('Hores de professorat per especialitat', (grups ? 'Segons els grups (especialitat que imparteix cada matèria i grup)' : 'Segons les matèries: (hores A + hores B) × grups') + ' · ' + files.length + ' files' + (S.nivellCurr ? ' · ' + S.nivellCurr : '') + '.',
      ['Especialitat'].concat(usats, ['Total']),
      esp.map(function (e) { return [e].concat(usats.map(function (n) { return per[e][n] ? fmtH(per[e][n]) : ''; }), [fmtH(tot(e))]); })
        .concat([{ t: ['Total'].concat(usats.map(function (n) { return fmtH(totN(n)); }), [fmtH(esp.reduce(function (s, e) { return s + tot(e); }, 0))]) }]),
      'curriculum-hores-especialitat', false);
  }
  // Document dels equips docents: per nivell, una taula matèria × grup amb el professor/a (o l'especialitat entre claudàtors)
  function documentEquips() {
    var files = S.taula.getData('active'), niv = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'];
    if (!files.length) return toast('No hi ha grups: primer genereu-los des de la pestanya Matèries.', true);
    var sufix = function (f) { var g = String(f.grup || ''); return g.indexOf(f.nivell) === 0 ? g.slice(f.nivell.length).trim() || g : g; };
    var cols = []; files.forEach(function (f) { var s = sufix(f); if (cols.indexOf(s) < 0) cols.push(s); }); cols.sort(ordreGrup);
    var rows = [];
    niv.concat(['']).forEach(function (n) {
      var fn = files.filter(function (f) { return n ? f.nivell === n : niv.indexOf(f.nivell) < 0; }); if (!fn.length) return;
      rows.push({ s: n || 'Altres' });
      var mats = []; fn.forEach(function (f) { var k = f.id_materia || f.materia; if (!mats.some(function (m) { return m.k === k; })) mats.push({ k: k, nom: f.materia, h: f.hores }); });
      mats.forEach(function (m) {
        rows.push([m.nom, fmtH(numero(m.h))].concat(cols.map(function (c) {
          return fn.filter(function (f) { return (f.id_materia || f.materia) === m.k && sufix(f) === c; }).map(function (f) { return f.professor || (f.especialitat ? '[' + f.especialitat + ']' : '—'); }).join(' / ');
        })));
      });
    });
    informe('Equips docents', 'Professor/a de cada matèria i grup; entre claudàtors, l’especialitat quan encara no hi ha professor/a. Hores de professorat per grup (A + B).' + (S.nivellCurr ? ' · ' + S.nivellCurr : ''),
      ['Matèria', 'h'].concat(cols), rows, 'equips-docents', false);
  }

  // ================================================================== PAS 35 · AMONESTACIONS
  function textPeriodeAmon() { var A = S.d.avis_amon || {}; return A.periode === 'tot el curs' ? 'aquest curs' : 'en ' + A.periode + ' (des del ' + dataVista(iniciPeriode(A.periode)) + ')'; }
  // Selector del període de la graella: curs actual, tots o data a data
  // PAS 38 · Selector de període dels mòduls de registre (amonestacions i control d'entrada): curs actual, tots o data a data.
  // Cada mòdul recorda el seu; el curs actual va de l'1 de setembre al 31 d'agost.
  var periodeDe = function () { S.periodes = S.periodes || {}; var k = S.modul.id; return S.periodes[k] = S.periodes[k] || { tipus: 'curs', des: '', fins: '' }; };
  var campDataReg = function () { return esAmon() ? 'data_fets' : 'data'; };
  // PAS 41: el control d'entrada fa servir el curs del calendari (de l'1 de setembre d'enguany); el curs de la configuració
  // pot no estar al dia i amagava les entrades importades més recents.
  var cursActualReg = function () { var c = esAmon() ? (S.d.avis_amon || {}).curs || S.d.curs || '' : ''; if (/^\d{4}-\d{4}$/.test(c)) return c; var y = Number(iniciPeriode('tot el curs').slice(0, 4)); return y + '-' + (y + 1); };
  var delPeriodeAmon = function (d) {
    if (!esRegistre()) return true;
    var P = periodeDe(), v = String(d[campDataReg()] || '');
    if (P.tipus === 'tots') return true;
    if (P.tipus === 'curs') {
      var c = cursActualReg();
      if (esAmon() && d.curs) return d.curs === c;
      return v >= c.slice(0, 4) + '-09-01' && v <= c.slice(5) + '-08-31';
    }
    return (!P.des || v >= P.des) && (!P.fins || v <= P.fins);
  };
  function periodeAmonText() {
    var P = periodeDe();
    return P.tipus === 'tots' ? 'tots els cursos' : P.tipus === 'curs' ? 'curs ' + cursActualReg() : 'del ' + dataVista(P.des || '…') + ' al ' + dataVista(P.fins || '…');
  }
  function htmlPeriode() {
    var P = periodeDe();
    return '<span class="gs-periode"><label>Període <select id="gsAmPer"><option value="curs">Curs actual</option><option value="tots">Tots</option><option value="dates">Data a data</option></select></label>' +
      '<span id="gsAmDates"' + (P.tipus === 'dates' ? '' : ' hidden') + '><label>del <input type="date" id="gsAmDes" value="' + esc(P.des) + '"></label> <label>al <input type="date" id="gsAmFins" value="' + esc(P.fins || isoDe(new Date())) + '"></label></span></span>';
  }
  function lligaPeriode() {
    var P = periodeDe(); if (!$('gsAmPer')) return;
    $('gsAmPer').value = P.tipus;
    var canvi = function () {
      P.tipus = $('gsAmPer').value; P.des = $('gsAmDes').value; P.fins = $('gsAmFins').value;
      $('gsAmDates').hidden = P.tipus !== 'dates';
      if (P.tipus === 'dates' && P.des && P.fins && P.des > P.fins) return toast('La data inicial és posterior a la final.', true);
      aplicaFiltre();
    };
    ['gsAmPer', 'gsAmDes', 'gsAmFins'].forEach(function (id) { $(id).addEventListener('change', canvi); });
  }
  function pintaEinesAmon() {
    var ed = potEditar();
    $('gsEines').innerHTML = htmlPeriode() +
      '<span class="gs-compte" id="gsCompte"></span>' +
      '<span class="gs-retards" id="gsAvisAmon"></span>' +
      (S.d.nomes_propies ? '<span class="gs-gris" title="Veieu les amonestacions que heu redactat vosaltres">Les vostres amonestacions</span>' : '') +
      '<span class="gs-espai"></span>' +
      (S.d.pot_crear ? '<button type="button" class="prog-btn" data-accio="amon-nova">+ Nova amonestació</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="amon-analisi" title="Nombre d’amonestacions per alumne, nivell, grup o professor (de les files que es veuen)">Anàlisi</button>' +
      (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="amon-config" title="Carpeta dels PDF i criteri de l’avís">Configuració</button>' + BOTO_ACTUALITZA : '') +
      '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx" title="Les files que es veuen, amb els fets">Excel</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf" title="Les files que es veuen">PDF</button></span>';
    lligaPeriode();
    pintaAvisAmon();
  }
  // Avís: alumnes amb N amonestacions o més en el període (ESO i batxillerat tenen el seu nombre, NOFC 5.3.2)
  function alumnesAmbAmon() {
    var A = S.d.avis_amon; if (!A) return [];
    var lim = A.periode === 'tot el curs' ? null : iniciPeriode(A.periode), per = {};
    S.d.files.forEach(function (f) {
      if (lim ? String(f.data_fets) < lim : (A.curs && f.curs !== A.curs)) return;
      var k = f.id_alumne || plega(f.alumne), x = per[k] = per[k] || { alumne: f.alumne, nivell: f.nivell, grup: f.grup, n: 0, darrera: '' };
      x.n++; if (String(f.data_fets) > x.darrera) { x.darrera = f.data_fets; x.grup = f.grup || x.grup; x.nivell = f.nivell || x.nivell; }
    });
    return Object.keys(per).map(function (k) { return Object.assign({ clau: k }, per[k]); })
      .filter(function (a) { return a.n >= (/BAT/.test(a.nivell || a.grup) ? A.bat : A.eso); })
      .sort(function (a, b) { return b.n - a.n || plega(a.alumne).localeCompare(plega(b.alumne), 'ca'); });
  }
  function pintaAvisAmon() {
    var A = S.d.avis_amon, el = $('gsAvisAmon'); if (!A || !el) return;
    var llista = alumnesAmbAmon();
    S.avisAmon = {}; llista.forEach(function (a) { S.avisAmon[a.clau] = a.n; });
    el.innerHTML = '<span class="gs-retards__regla" title="Criteri de l’avís (el fixa qui administra el mòdul, a Configuració)">Avís: ESO ' + A.eso + ' o més · BAT ' + A.bat + ' o més · ' + esc(textPeriodeAmon()) + '</span>' +
      '<button type="button" class="gs-incomplet' + (llista.length ? '' : ' is-cap') + '" data-accio="amon-avis"><span aria-hidden="true">⚠</span> ' + llista.length + (llista.length === 1 ? ' alumne' : ' alumnes') + '</button>';
  }
  function llistaAvisAmon() {
    var A = S.d.avis_amon, llista = alumnesAmbAmon();
    informe('Avís d’amonestacions', 'Alumnes amb ' + A.eso + ' amonestacions o més (ESO) o ' + A.bat + ' o més (batxillerat), ' + textPeriodeAmon() + '. ' + llista.length + (llista.length === 1 ? ' alumne.' : ' alumnes.'),
      ['', 'Alumne/a', 'Grup-Classe', 'Amonestacions', 'Darrera'], llista.map(function (a, i) { return [String(i + 1), a.alumne, a.grup || a.nivell || '', String(a.n), dataVista(a.darrera)]; }), 'avis-amonestacions', false);
  }
  // Fets d'una amonestació (icona de la graella)
  function mostraFets(d) {
    pregunta('Fets · ' + d.alumne, '<p class="gs-ajuda">' + esc(d.grup || '') + ' · ' + esc(dataVista(d.data_fets)) + ' · ' + esc(d.professor || '') + '</p><div class="gs-amon__fets">' + esc(d.fets).replace(/\n/g, '<br>') + '</div>',
      [{ t: 'Obre el visor', valor: 2, tipus: 'ghost' }, { t: 'Tanca', valor: 1 }]).then(function (v) { if (v === 2) visorAmon(d.id); });
  }
  // Visor: totes les dades (també els fets) i navegació entre les files que es veuen ara (amb els filtres i l'ordre)
  function visorAmon(id) {
    var files = S.taula.getData('active'), i = files.map(function (f) { return f.id; }).indexOf(id);
    if (i < 0) return;
    var pinta = function () {
      var d = files[i];
      $('gsModalTitol').textContent = 'Amonestació ' + (i + 1) + ' de ' + files.length;
      $('gsModalText').innerHTML = '<dl class="gs-amon__dl">' +
        [['Alumne/a', d.alumne], ['Grup-Classe', d.grup + (d.nivell ? ' (' + d.nivell + ')' : '')], ['Data dels fets', dataVista(d.data_fets)], ['Professor/a', d.professor], ['Curs', d.curs], ['Redactada el', dataVista(String(d.redactat_el).slice(0, 10)) + ' ' + String(d.redactat_el).slice(11, 16)], ['Codi', d.id]]
          .map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1] || '—') + '</dd>'; }).join('') + '</dl>' +
        '<p class="gs-amon__tit">Fets i circumstàncies</p><div class="gs-amon__fets">' + esc(d.fets).replace(/\n/g, '<br>') + '</div>' +
        '<p class="gs-amon__nav">' + (d.pdf ? '<a class="prog-btn prog-btn--ghost prog-btn--sm" href="' + esc(d.pdf) + '" target="_blank" rel="noopener">Obre el PDF</a>' : d._pdf === 'fent' ? '<span class="gs-gris"><span class="gs-pdf-fent"></span> El PDF s’està fent en segon pla…</span>' : '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-amon-pdf="' + esc(d.id) + '">Fes el PDF</button>') + '</p>';
      $('gsVisAnt').disabled = i === 0; $('gsVisSeg').disabled = i === files.length - 1;
      var b = $('gsModalText').querySelector('[data-amon-pdf]'); if (b) b.addEventListener('click', function () { fesPdfAmon(d, pinta); });
    };
    pregunta('Amonestació', '', [{ t: '‹ Anterior', valor: 0, tipus: 'ghost', abans: function () { if (i > 0) { i--; pinta(); } return false; } },
      { t: 'Següent ›', valor: 0, tipus: 'ghost', abans: function () { if (i < files.length - 1) { i++; pinta(); } return false; } }, { t: 'Tanca', valor: 1 }]);
    var bs = $('gsModalBtns').querySelectorAll('button'); bs[0].id = 'gsVisAnt'; bs[1].id = 'gsVisSeg';
    var tecla = function (e) { if ($('gsModal').hidden) return document.removeEventListener('keydown', tecla); if (e.key === 'ArrowLeft') bs[0].click(); if (e.key === 'ArrowRight') bs[1].click(); };
    document.addEventListener('keydown', tecla);
    pinta();
  }
  function fesPdfAmon(d, despres) {
    api('amonestacio_pdf', { id: d.id }, 'Fent el PDF…').then(function (r) {
      if (!r.ok) return toast(text(r.error) + (r.detall ? ' (' + r.detall + ')' : ''), true);
      d.pdf = r.pdf; var row = S.taula.getRow(d.id); if (row) row.update({ pdf: r.pdf });
      var f = S.d.files.filter(function (x) { return x.id === d.id; })[0]; if (f) f.pdf = r.pdf;
      toast('PDF fet.'); if (despres) despres();
    });
  }
  // Anàlisi: comptadors de les files que es veuen (amb els filtres i el període), per alumne, nivell, grup o professor
  function analisiAmon() {
    pregunta('Anàlisi · Amonestacions', '<p class="gs-ajuda">Compta les amonestacions que es veuen ara a la graella (període i filtres).</p><label class="gs-form-fila">Agrupa per <select id="gsAmAgr"><option value="alumne">Alumne/a</option><option value="grup">Grup-classe</option><option value="nivell">Nivell</option><option value="professor">Professor/a</option></select></label>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Mostra l’anàlisi', valor: 1, abans: function () { analisiAmon.k = $('gsAmAgr').value; } }]).then(function (v) {
      if (!v) return;
      var k = analisiAmon.k, files = S.taula.getData('active'), per = {};
      files.forEach(function (f) { var x = f[k] || '(sense valor)'; per[x] = per[x] || { n: 0, grup: f.grup }; per[x].n++; });
      var noms = { alumne: 'Alumne/a', grup: 'Grup-Classe', nivell: 'Nivell', professor: 'Professor/a' };
      var ordre = k === 'nivell' || k === 'grup' ? function (a, b) { return a.localeCompare(b, 'ca', { numeric: true }); } : function (a, b) { return per[b].n - per[a].n || a.localeCompare(b, 'ca'); };
      var claus = Object.keys(per).sort(ordre);
      var periode = periodeAmonText();
      informe('Anàlisi d’amonestacions', files.length + ' amonestacions (' + periode + (S.taula.getHeaderFilters().length ? ', amb filtres' : '') + '), per ' + noms[k].toLowerCase() + '.',
        k === 'alumne' ? ['Alumne/a', 'Grup-Classe', 'Amonestacions'] : [noms[k], 'Amonestacions'],
        claus.map(function (c) { return k === 'alumne' ? [c, per[c].grup || '', String(per[c].n)] : [c, String(per[c].n)]; }).concat([{ t: k === 'alumne' ? ['Total', '', String(files.length)] : ['Total', String(files.length)] }]), 'analisi-amonestacions-' + k);
    });
  }
  // Configuració (administració del mòdul): carpeta de Drive dels PDF i criteri de l'avís
  function configAmon() {
    var A = S.d.avis_amon, ns = []; for (var i = 1; i <= 20; i++) ns.push(i);
    var sel = function (id, ops, v) { return '<select id="' + id + '">' + ops.map(function (o) { return '<option' + (String(o) === String(v) ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'; };
    pregunta('Configuració · Amonestacions', '<label class="gs-form-fila gs-form-fila--ample">Carpeta de Drive dels PDF <input id="gsAmCarp" value="' + esc(A.carpeta) + '" placeholder="https://drive.google.com/drive/folders/…"></label>' +
      '<p class="gs-ajuda">Cada amonestació nova es desa en PDF en aquesta carpeta. Ha de ser accessible per al compte que executa GESTIO.</p>' +
      '<div class="gs-form-fila">Avís a partir de ' + sel('gsAmEso', ns, A.eso) + ' (ESO) i ' + sel('gsAmBat', ns, A.bat) + ' (batxillerat) amonestacions o més en ' + sel('gsAmPerA', A.periodes, A.periode) + '</div>' +
      '<p class="gs-ajuda">Les NOFC (5.3.2) preveuen mesures a partir de cinc amonestacions lleus a l’ESO i de dues al batxillerat.</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa', valor: 1, abans: function () { configAmon.v = { carpeta: $('gsAmCarp').value.trim(), eso: Number($('gsAmEso').value), bat: Number($('gsAmBat').value), periode: $('gsAmPerA').value }; } }], false).then(function (v) {
      if (!v) return;
      api('amonestacions_config', configAmon.v, 'Desant la configuració…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        S.d.avis_amon = r.avis_amon; pintaAvisAmon(); if (S.taula) S.taula.redraw(true); toast('Configuració desada.');
      });
    });
  }
  // Nova amonestació: formulari (alumne i professor de llista, data amb calendari, fets lliures) → desa i fa el PDF
  var INFO_AMON = {
    alumne: 'Alumne/a que ha comès els fets. Escriviu un cognom (o el grup) per trobar-lo a la llista.',
    grup: 'Es posa sol: el grup-classe actual de l’alumne/a.',
    data: 'Dia que van passar els fets (no pot ser posterior a avui ni d’un altre curs).',
    professor: 'Docent que redacta l’amonestació (qui imparteix classe a l’alumne/a o ha estat testimoni dels fets, NOFC 5.3.3). Es posa sol: és qui ha entrat a GESTIO. Només l’administració del mòdul pot triar un altre docent.',
    fets: 'Descripció objectiva dels fets i les circumstàncies (què, on, quan), sense valoracions personals. Entre 20 i 3.000 caràcters. Aquest text surt al PDF que rep la família.'
  };
  // PAS 36 · Nova amonestació: el formulari arriba amb les dades del mòdul (sense espera); l'alumne es tria amb un cercador
  // amb desplegable compacte; el professor/a va després dels fets; en desar, el PDF es fa en segon pla.
  function novaAmon(previ) {
    var obre = function (F) {
      previ = previ || {};
      var lab = function (id, t, k, oblig) { return '<label for="' + id + '">' + t + (oblig ? ' <span class="gs-oblig">*</span>' : '') + ' <span class="gs-info" aria-hidden="true" data-info="' + esc(INFO_AMON[k]) + '">i</span></label>'; };
      var triat = F.alumnes.filter(function (a) { return a.id === previ.id_alumne; })[0] || null;
      var jo = F.professorat.filter(function (p) { return p.id === F.jo; })[0] || null;
      var etiqueta = function (a) { return a.nom + ' — ' + (a.grup || a.nivell || ''); };
      var html = '<div class="gs-amon__form">' +
        '<div class="gs-amon__camp gs-amon__camp--ample gs-combo">' + lab('gsAmCerca', 'Alumne/a', 'alumne', true) +
          '<input type="search" id="gsAmCerca" class="gs-cerca" placeholder="Escriviu un cognom, el nom o el grup…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="gsAmLlista" aria-autocomplete="list" aria-describedby="gsAmInfoAlu" value="' + esc(triat ? etiqueta(triat) : '') + '">' +
          '<span class="gs-sr" id="gsAmInfoAlu">' + esc(INFO_AMON.alumne) + '</span>' +
          '<ul id="gsAmLlista" class="gs-combo__llista" role="listbox" hidden></ul></div>' +
        '<div class="gs-amon__camp">' + lab('gsAmGrup', 'Grup-classe', 'grup') + '<input id="gsAmGrup" readonly tabindex="-1" placeholder="(es posa sol)" value="' + esc(triat ? triat.grup || triat.nivell || '' : '') + '"></div>' +
        '<div class="gs-amon__camp">' + lab('gsAmData', 'Data dels fets', 'data', true) + '<input type="date" id="gsAmData" max="' + esc(F.avui) + '" min="' + esc(String(F.curs).slice(0, 4) + '-09-01') + '" value="' + esc(previ.data_fets || F.avui) + '"></div>' +
        '<div class="gs-amon__camp gs-amon__camp--ample">' + lab('gsAmFets', 'Fets i circumstàncies', 'fets', true) + '<textarea id="gsAmFets" rows="7" maxlength="3000" placeholder="Descriviu els fets de manera objectiva…">' + esc(previ.fets || '') + '</textarea><small class="gs-gris" id="gsAmCompte"></small></div>' +
        // PAS 37: el professor/a es posa sol (qui ha entrat a GESTIO); només l'administració del mòdul pot triar-ne un altre
        '<div class="gs-amon__camp gs-amon__camp--ample">' + lab('gsAmProf', 'Professor/a', 'professor', true) + (F.triar_professor ?
          '<select id="gsAmProf"><option value="">— Trieu el professor/a —</option>' +
            F.professorat.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === (previ.id_professor || F.jo) ? ' selected' : '') + '>' + esc(p.nom) + '</option>'; }).join('') + '</select>' +
            '<small class="gs-gris">Per defecte, vosaltres. Com a administració del mòdul, podeu triar un altre docent.</small>' :
          (jo ? '<input id="gsAmProfNom" readonly tabindex="-1" value="' + esc(jo.nom) + '"><input type="hidden" id="gsAmProf" value="' + esc(jo.id) + '">' +
            '<small class="gs-gris">Es posa sol: és el nom de qui ha entrat a GESTIO. Només l’administració pot triar un altre docent.</small>' :
            '<input type="hidden" id="gsAmProf" value=""><p class="prog-avis">No s’ha trobat la vostra fitxa al professorat (actiu): no podeu redactar amonestacions. Aviseu l’administració de GESTIO.</p>')) + '</div>' +
        '<p class="gs-ajuda gs-amon__camp--ample">La data i l’hora de redacció i el curs escolar es posen sols. En desar, el PDF per a la família (amb el logo del centre i la referència a les NOFC) es fa en segon pla i es desa a la carpeta de Drive de les amonestacions.</p>' +
        '<p class="prog-avis gs-amon__camp--ample" id="gsAmErr"' + (previ.error ? '' : ' hidden') + '>' + esc(previ.error || '') + '</p></div>';
      var err = function (t, el) { $('gsAmErr').textContent = t; $('gsAmErr').hidden = false; if (el) el.focus(); return false; };
      pregunta('Nova amonestació', html, [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa', valor: 1, abans: function () {
        var v = { id_alumne: triat ? triat.id : '', id_professor: $('gsAmProf').value, data_fets: $('gsAmData').value, fets: $('gsAmFets').value.trim(), pdf_despres: true };
        if (!v.id_alumne) return err(text('alumne_invalid'), $('gsAmCerca'));
        if (!v.data_fets || !/^\d{4}-\d{2}-\d{2}$/.test(v.data_fets)) return err('Trieu la data dels fets.', $('gsAmData'));
        if (v.data_fets > F.avui) return err(text('data_futura'), $('gsAmData'));
        if (v.fets.length < 20) return err(text('fets_curts'), $('gsAmFets'));
        if (!/[A-Za-zÀ-ÿ]{3,}/.test(v.fets)) return err(text('fets_invalids'), $('gsAmFets'));
        if (!v.id_professor) return err(text('professor_invalid'), $('gsAmProf'));
        novaAmon.v = v;
      } }], false).then(function (ok) {
        if (!ok) return;
        var v = novaAmon.v;
        api('amonestacio_nova', v, 'Desant l’amonestació…').then(function (r) {
          if (!r.ok) { v.error = text(r.error); return novaAmon(v); }
          var f = r.fila;
          if (!f.pdf && !r.repetida) f._pdf = 'fent';
          S.d.files.push(copia(f)); S.taula.addRow(copia(f), true).then(aplicaFiltre); pintaAvisAmon();
          if (S.d.versio) S.d.versio = { data: f.redactat_el, per: S.sessio.email };
          var av = (S.avisAmon || {})[f.id_alumne || plega(f.alumne)];
          toast(r.repetida ? 'Aquesta amonestació ja s’havia desat fa un moment: no s’ha duplicat.' : 'Amonestació ' + f.id + ' desada (' + f.alumne + '). El PDF es fa en segon pla.');
          if (av) pregunta('Avís d’amonestacions', '<p class="prog-avis">' + esc(f.alumne) + ' ja té ' + av + ' amonestacions ' + esc(textPeriodeAmon()) + '.</p>', [{ t: 'Entesos', valor: 1 }]);
          if (f._pdf === 'fent') pdfEnSegonPla(f);
        });
      });
      // Cercador amb desplegable: com a màxim 50 resultats, fletxes per moure's, Enter o clic per triar
      var c = $('gsAmCerca'), ll = $('gsAmLlista'), res = [], act = -1;
      var tanca = function () { ll.hidden = true; c.setAttribute('aria-expanded', 'false'); };
      var marca = function (i) { act = i; [].forEach.call(ll.children, function (li, j) { li.classList.toggle('is-actiu', j === i); li.setAttribute('aria-selected', j === i ? 'true' : 'false'); if (j === i) li.scrollIntoView({ block: 'nearest' }); }); };
      var tria = function (a) { triat = a; c.value = a ? etiqueta(a) : ''; $('gsAmGrup').value = a ? a.grup || a.nivell || '' : ''; tanca(); $('gsAmErr').hidden = true; };
      var cerca = function () {
        var q = plega(c.value.trim()); triat = null; $('gsAmGrup').value = '';
        if (!q) { tanca(); return; }
        var mots = q.split(/\s+/);
        res = F.alumnes.filter(function (a) { var t = plega(a.nom + ' ' + (a.grup || '')); return mots.every(function (m) { return t.indexOf(m) >= 0; }); }).slice(0, 50);
        ll.innerHTML = res.length ? res.map(function (a, i) { return '<li role="option" id="gsAmOp' + i + '" data-i="' + i + '">' + esc(a.nom) + ' <small>' + esc(a.grup || a.nivell || '') + '</small></li>'; }).join('') : '<li class="gs-combo__cap">Cap alumne amb aquest text</li>';
        ll.hidden = false; c.setAttribute('aria-expanded', 'true'); marca(res.length ? 0 : -1);
      };
      c.addEventListener('input', cerca);
      c.addEventListener('keydown', function (e) {
        if (ll.hidden) { if (e.key === 'ArrowDown' && c.value) { e.preventDefault(); cerca(); } return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); marca(Math.min(act + 1, res.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); marca(Math.max(act - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (res[act]) { tria(res[act]); $('gsAmData').focus(); } }
        else if (e.key === 'Escape') { e.stopPropagation(); tanca(); }
      });
      ll.addEventListener('mousedown', function (e) { var li = e.target.closest('li[data-i]'); if (!li) return; e.preventDefault(); tria(res[Number(li.dataset.i)]); $('gsAmData').focus(); });
      c.addEventListener('blur', function () { setTimeout(tanca, 120); });
      ['gsAmData', 'gsAmProf', 'gsAmFets'].forEach(function (id) { if ($(id)) $(id).addEventListener('input', function () { $('gsAmErr').hidden = true; }); });
      var compta = function () { var n = $('gsAmFets').value.trim().length; $('gsAmCompte').textContent = n + ' / 3.000 caràcters' + (n && n < 20 ? ' (mínim 20)' : ''); };
      $('gsAmFets').addEventListener('input', compta); compta();
      setTimeout(function () { (previ.id_alumne ? $('gsAmFets') : c).focus(); }, 0);
    };
    var F = S.formAmon || (S.d && S.d.form);
    if (F) { S.formAmon = F; return obre(F); }
    api('amonestacio_form', {}, 'Preparant el formulari…').then(function (r) { if (!r.ok) return toast(text(r.error), true); S.formAmon = r; obre(r); });
  }
  // PAS 36 · PDF en segon pla: la fila ja és desada; la icona del PDF mostra «en preparació» fins que arriba l'enllaç.
  // Si falla (o es tanca la pàgina abans), la fila queda sense PDF i es pot fer des del visor; fesPdfsPendents també els fa.
  function pdfEnSegonPla(f, intent) {
    intent = intent || 1;
    api('amonestacio_pdf', { id: f.id }).then(function (r) {
      var posa = function (canvis) {
        var row = S.taula && esAmon() ? S.taula.getRow(f.id) : null; if (row) row.update(canvis);
        var x = S.d && S.d.files ? S.d.files.filter(function (y) { return y.id === f.id; })[0] : null; if (x) Object.assign(x, canvis);
        var c = S.cache.amonestacions; if (c && c !== S.d) { var y = c.files.filter(function (z) { return z.id === f.id; })[0]; if (y) Object.assign(y, canvis); }
      };
      if (r.ok) { posa({ pdf: r.pdf, _pdf: '' }); toast('PDF de l’amonestació ' + f.id + ' fet.'); return; }
      if (intent < 2 && r.error === 'error_servidor') return setTimeout(function () { pdfEnSegonPla(f, intent + 1); }, 3000);
      posa({ _pdf: 'error' });
      toast('No s’ha pogut fer el PDF de l’amonestació ' + f.id + '. Està desada: el podeu fer des del visor (doble clic a la fila).', true);
    });
  }

  // PAS 33 · CONTROL D'ENTRADA · Avís de retards: alumnes amb «quantitat» entrades o més dins del període (comptat fins avui)
  function alumnesAmbRetards() {
    var R = S.d.retards; if (!R || !S.d.files) return [];
    var limIso = iniciPeriode(R.periode);
    var per = {};
    S.d.files.forEach(function (f) {
      if (String(f.data) < limIso) return;
      var k = f.id_alumne || plega(f.alumne), x = per[k] = per[k] || { alumne: f.alumne, nivell: f.nivell, grup: f.grup, n: 0, ultima: '' };
      x.n++; var t = f.data + ' ' + f.hora; if (t > x.ultima) { x.ultima = t; x.grup = f.grup || x.grup; x.nivell = f.nivell || x.nivell; }
    });
    return Object.keys(per).filter(function (k) { return per[k].n >= R.quantitat; }).map(function (k) { return Object.assign({ clau: k }, per[k]); })
      .sort(function (a, b) { return b.n - a.n || plega(a.alumne).localeCompare(plega(b.alumne), 'ca'); });
  }
  // PAS 35 · Inici d'un període comptat a partir d'avui (inclòs): «1 mes» = des del mateix dia del mes anterior;
  // «N setmanes» = des de fa N×7 dies; «tot el curs» = des de l'1 de setembre del curs actual
  function isoDe(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function iniciPeriode(p) {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    var m = /^(\d+) (setmana|setmanes|mes|mesos)$/.exec(String(p || ''));
    if (p === 'tot el curs') { var y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return y + '-09-01'; }
    if (m && /setman/.test(m[2])) d.setDate(d.getDate() - 7 * Number(m[1]));
    else if (m) { var dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() - Number(m[1])); d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
    return isoDe(d);
  }
  function pintaRetards() {
    var R = S.d.retards, el = $('gsRetards'); if (!R || !el) return;
    var llista = alumnesAmbRetards();
    S.avisRetards = {}; llista.forEach(function (a) { S.avisRetards[a.clau] = a.n; });
    var sel = function (id, ops, v) { return '<select id="' + id + '"' + (R.pot_canviar ? '' : ' disabled') + '>' + ops.map(function (o) { return '<option' + (String(o) === String(v) ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'; };
    var q = []; for (var i = 3; i <= 20; i++) q.push(i);
    el.innerHTML = '<span class="gs-retards__regla" title="' + (R.pot_canviar ? 'Podeu canviar el criteri: val per a tothom.' : 'El criteri el fixa qui administra el mòdul.') + '">Avís: ' + sel('gsRetQ', q, R.quantitat) + ' retards o més en ' + sel('gsRetP', R.periodes, R.periode) + ' <small class="gs-gris">(des del ' + dataVista(iniciPeriode(R.periode)) + ')</small></span>' +
      '<button type="button" class="gs-incomplet' + (llista.length ? '' : ' is-cap') + '" data-accio="retards-llista"><span aria-hidden="true">⚠</span> ' + llista.length + (llista.length === 1 ? ' alumne' : ' alumnes') + '</button>';
    if (R.pot_canviar) ['gsRetQ', 'gsRetP'].forEach(function (id) { $(id).addEventListener('change', function () {
      api('retards_desa', { quantitat: Number($('gsRetQ').value), periode: $('gsRetP').value }, 'Desant el criteri…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        S.d.retards = Object.assign(r.retards, { pot_canviar: true }); toast('Criteri desat: ' + r.retards.quantitat + ' retards en ' + r.retards.periode + '.'); pintaRetards(); if (S.taula) S.taula.redraw(true);
      });
    }); });
  }
  function llistaRetards() {
    var R = S.d.retards, llista = alumnesAmbRetards();
    informe('Avís de retards', 'Alumnes amb ' + R.quantitat + ' retards o més en ' + R.periode + ' (del ' + dataVista(iniciPeriode(R.periode)) + ' fins avui). ' + llista.length + (llista.length === 1 ? ' alumne.' : ' alumnes.'), ['', 'Alumne', 'Nivell', 'Grup-Classe', 'Retards', 'Darrer'],
      llista.map(function (a, i) { return [String(i + 1), a.alumne, a.nivell || '', a.grup || '', String(a.n), dataVista(a.ultima.slice(0, 10)) + ' ' + a.ultima.slice(11, 16)]; }), 'avis-retards');
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
        // PAS 37: la fila surt a l'instant (provisional, en gris) i es confirma quan respon el servidor, sense finestra d'espera:
        // es poden registrar diversos alumnes seguits. Si el servidor diu que no, la fila provisional es treu i surt l'error.
        var a = llista.filter(function (x) { return x.id === novaEntrada.id; })[0] || {}, ara = new Date();
        var tmp = 'desant-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        var prov = { id: tmp, _desant: true, alumne: a.nom, nivell: a.nivell, grup: a.grup, id_alumne: a.id, data: isoDe(ara), hora: ('0' + ara.getHours()).slice(-2) + ':' + ('0' + ara.getMinutes()).slice(-2) };
        S.taula.addRow(copia(prov), true).then(aplicaFiltre);
        toast('Desant l’entrada de ' + a.nom + '…');
        api('entrada_nova', { id_alumne: novaEntrada.id }).then(function (r) {
          var rp = S.taula && S.modul.id === 'control_entrada' ? S.taula.getRow(tmp) : null;
          if (!r.ok) { if (rp) rp.delete(); return toast('No s’ha desat l’entrada de ' + a.nom + ': ' + text(r.error), true); }
          var f = r.fila; S.d.files.push(copia(f));
          if (rp) { rp.delete(); S.taula.addRow(copia(f), true).then(aplicaFiltre); }
          pintaRetards();
          var av = (S.avisRetards || {})[f.id_alumne || plega(f.alumne)];
          if (av) setTimeout(function () { toast('Avís: ' + f.alumne + ' ja té ' + av + ' retards en ' + S.d.retards.periode + '.', true); }, 400);
          if (S.d.versio && r.fila) S.d.versio = { data: f.data + ' ' + f.hora, per: S.sessio.email };
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
    if (!S.alumnesEntrada && S.d && S.d.alumnes_entrada) S.alumnesEntrada = S.d.alumnes_entrada;
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
    estat: 'Situació al claustre: actiu (forma part del claustre d’aquest curs), permís, substitut (temporalment), baixa laboral o baixa (ja no és al centre). Per a una alta, normalment «actiu».',
    nif: 'DNI (8 xifres i la lletra) o NIE (X, Y o Z, 7 xifres i la lletra). Es comprova que la lletra sigui correcta.',
    data_naixement: 'Data de naixement (dia, mes i any), tal com consta al DNI o NIE.',
    nacionalitat: 'Nacionalitat (p. ex. Espanyola).',
    telefon: 'Telèfon mòbil de contacte (9 xifres; sense el prefix 34).',
    adreca: 'Carrer, número, pis i porta de l’adreça on viu.',
    poblacio: 'Població de l’adreça.',
    codi_postal: 'Codi postal de 5 xifres (p. ex. 08860). En escriure’l, la província s’omple sola.',
    provincia: 'Província de l’adreça. S’omple sola a partir del codi postal; la podeu corregir.',
    especialitat: 'Especialitat docent amb què s’incorpora. Trieu-la de la llista.',
    email_xtec: 'Correu del Departament d’Educació. Ha d’acabar en @xtec.cat.',
    email: 'Correu del centre, acabat en @institutjoanmiro.cat. És el que farà servir per entrar a GESTIO i a les altres eines del centre. No pot estar repetit.',
    jornada: 'Jornada al centre: sencera, mitja jornada (1/2) o dos terços (⅔).',
    situacio: 'Situació administrativa: definitiu, comissió de serveis, provisional, interí o substitut. Si és substitut, cal dir a qui substitueix.',
    substitueix: 'Docent a qui substitueix (només si la situació és «Substitut»). En triar-lo, el càrrec s’omple amb el de la persona substituïda.',
    anys: 'Anys que fa que treballa com a docent (en total, no només al centre). Un número; 0 si és el primer any.',
    catala: 'Nivell de català acreditat (p. ex. C1, C2).',
    carrec: 'Càrrec al centre, si en té (tutor/a, cap de departament, coordinació…). Si substitueix algú, s’omple amb el càrrec d’aquella persona.'
  };
  // Camps que el formulari no demana: la data d'arribada al centre la posa el servidor el dia que es desa
  var NO_AL_FORMULARI = ['data_arribada_centre'];
  var campsForm = function () { return S.d.camps.filter(function (c) { return NO_AL_FORMULARI.indexOf(c.clau) < 0; }); };
  // PAS 31: el formulari (i el PDF) s'organitza per tipologia. Els camps nous que afegeixi un admin van a «Altres dades».
  var GRUPS_NOU = [
    ['Dades personals', ['nom', 'cognom1', 'cognom2', 'nif', 'data_naixement', 'nacionalitat']],
    ['Adreça', ['adreca', 'poblacio', 'codi_postal', 'provincia']],
    ['Contacte', ['telefon', 'email', 'email_xtec']],
    ['Dades professionals', ['estat', 'especialitat', 'situacio', 'substitueix', 'jornada', 'anys', 'catala', 'carrec']]
  ];
  function grupsNou() {
    var camps = campsForm(), usats = {};
    var g = GRUPS_NOU.map(function (x) { return { nom: x[0], camps: x[1].map(function (k) { usats[k] = 1; return camps.filter(function (c) { return c.clau === k; })[0]; }).filter(Boolean) }; });
    g.push({ nom: 'Altres dades', camps: camps.filter(function (c) { return !usats[c.clau]; }) });
    return g.filter(function (x) { return x.camps.length; });
  }
  var esSubstitut = function () { var el = $('gsNou_situacio'); return !!el && el.value === 'Substitut'; };

  function carregaNouProfessor() {
    api('nou_professor', {}, 'Preparant el formulari…').then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.d = { nivell: S.modul.nivell, obert: r.obert, camps: r.camps, curs: r.curs, files: [], professorat: r.professorat || [], provincies: r.provincies || {} };
      pintaNouProfessor();
    });
  }
  function pintaNouProfessor(desat) {
    var camps = S.d.camps, ed = S.d.obert;
    $('gsEines').innerHTML = '<p class="gs-ajuda" style="flex:1 1 100%;margin:0">Alta d’un docent nou al professorat. Els camps amb <strong>*</strong> són obligatoris. Passeu el ratolí per la <span class="gs-info-mostra" aria-hidden="true">i</span> de cada camp per veure què cal posar-hi. El botó <strong>PDF per signar</strong> fa el full en blanc perquè el docent l’ompli a mà i el signi; després, aquí, es copien les dades i es desa.</p>';
    var t = $('gsTaula'); t.className = 'gs-nou';
    var campHtml = function (c) {
      var id = 'gsNou_' + c.clau, info = INFO_PROF[c.clau] || c.nom;
      var camp;
      // Valors per defecte d'una alta: estat «actiu» i situació «Substitut» (PAS 30)
      var perDefecte = { estat: 'actiu', situacio: 'Substitut' }[c.clau];
      if (c.clau === 'substitueix') camp = '<select id="' + id + '" name="substitueix"><option value="">— Trieu el docent —</option>' + (S.d.professorat || []).map(function (p) { return '<option value="' + esc(p.nom) + '" data-carrec="' + esc(p.carrec) + '">' + esc(p.nom) + (p.carrec ? ' · ' + esc(p.carrec) : '') + '</option>'; }).join('') + '</select>';
      else if (c.tipus === 'llista') camp = '<select id="' + id + '" name="' + esc(c.clau) + '">' + ['<option value="">—</option>'].concat(c.valors.split('|').map(function (o) { o = o.trim(); return '<option' + (o === perDefecte ? ' selected' : '') + '>' + esc(o) + '</option>'; })).join('') + '</select>';
      else if (c.tipus === 'si_no') camp = '<select id="' + id + '" name="' + esc(c.clau) + '"><option value="">no</option><option>sí</option></select>';
      else camp = '<input id="' + id + '" name="' + esc(c.clau) + '" type="' + (c.tipus === 'numero' ? 'number' : c.tipus === 'data' ? 'date' : c.tipus === 'correu' ? 'email' : 'text') + '"' +
        (c.tipus === 'correu' && c.valors ? ' placeholder="nom' + esc(c.valors) + '"' : '') + (c.tipus === 'nif' ? ' style="text-transform:uppercase" placeholder="12345678Z"' : '') +
        (c.clau === 'codi_postal' ? ' inputmode="numeric" maxlength="5" placeholder="08860"' : '') + (c.clau === 'telefon' ? ' inputmode="tel" placeholder="600000000"' : '') + ' autocomplete="off">';
      var oblig = c.obligatori || c.clau === 'substitueix';
      // PAS 31: la (i) no rep el focus (el tabulador va de camp a camp); l'explicació es llegeix amb el camp (aria-describedby)
      camp = camp.replace(/^<(input|select) /, '<$1 aria-describedby="' + id + '_info" ');
      return '<div class="gs-nou__camp" id="' + id + '_bloc"' + (c.clau === 'substitueix' ? ' data-nomes-substitut="1"' : '') + '><label for="' + id + '">' + esc(c.nom) + (oblig ? ' <span class="gs-oblig" title="Obligatori">*</span>' : '') +
        ' <span class="gs-info" aria-hidden="true" data-info="' + esc(info) + '">i</span></label>' + camp + '<span class="gs-sr" id="' + id + '_info">' + esc(info) + '</span><p class="gs-nou__err" id="' + id + '_err" aria-live="polite"></p></div>';
    };
    t.innerHTML = '<form id="gsNouForm" class="gs-nou__form" novalidate>' + grupsNou().map(function (g) {
      return '<fieldset class="gs-nou__grup"><legend>' + esc(g.nom) + '</legend><div class="gs-nou__camps">' + g.camps.map(campHtml).join('') + '</div></fieldset>';
    }).join('') + '<p class="gs-nou__auto"><strong>Data d’arribada al centre:</strong> ' + (desat ? esc(dataCat(S.nouArribada || '')) : 'es posarà sola, el dia que es desi (' + new Date().toLocaleDateString('ca-ES') + ')') + '.</p></form>' +
      '<div class="gs-nou__btns">' + (desat ? '<p class="gs-nou__ok">Desat al professorat amb el codi <strong>' + esc(desat) + '</strong>.</p>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="nou-cancel">' + (desat ? 'Nova alta' : 'Cancel·la') + '</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="nou-pdf">PDF per signar</button>' +
      (ed && !desat ? '<button type="button" class="prog-btn" data-accio="nou-desa">Desa</button>' : '') + '</div>';
    S.nouCodi = desat || '';
    var form = $('gsNouForm');
    form.addEventListener('input', function () { if (!S.nouCodi) S.brut = true; });
    campsForm().forEach(function (c) { var el = $('gsNou_' + c.clau); el.addEventListener('blur', function () { validaCampNou(c); }); el.addEventListener('change', function () { validaCampNou(c); }); });
    // «Substitueix a» només es veu (i és obligatori) si la situació és «Substitut»; en triar-lo, el càrrec s'hi copia
    var sit = $('gsNou_situacio'), sub = $('gsNou_substitueix'), carrec = $('gsNou_carrec'), cp = $('gsNou_codi_postal'), prov = $('gsNou_provincia');
    var mostraSub = function () { var b = $('gsNou_substitueix_bloc'); if (b) b.hidden = !esSubstitut(); };
    if (sit) sit.addEventListener('change', mostraSub);
    mostraSub();
    if (sub && carrec) sub.addEventListener('change', function () { var o = sub.options[sub.selectedIndex]; if (o && o.value) { carrec.value = o.getAttribute('data-carrec') || ''; S.brut = true; } });
    if (cp && prov) cp.addEventListener('input', function () { var x = cp.value.replace(/\D/g, ''); if (x.length === 5 && (S.d.provincies || {})[x.slice(0, 2)]) prov.value = S.d.provincies[x.slice(0, 2)]; });
    if (desat) form.querySelectorAll('input,select').forEach(function (el) { el.disabled = true; });
    ajustaAlcada();
  }
  function valorsNou() {
    var v = {};
    campsForm().forEach(function (c) { var el = $('gsNou_' + c.clau); var x = el ? String(el.value || '').trim() : ''; if (c.tipus === 'nif') x = x.toUpperCase().replace(/[\s.\-]/g, ''); if (c.tipus === 'correu') x = x.toLowerCase(); v[c.clau] = x; });
    if (v.situacio !== 'Substitut') v.substitueix = '';
    return v;
  }
  function validaCampNou(c, missatge) {
    var v = valorsNou()[c.clau], err = missatge || errorCel(c, v);
    if (!err && c.clau === 'substitueix' && esSubstitut() && !v) err = 'obligatori';
    if (!err && c.clau === 'codi_postal' && v && !/^\d{5}$/.test(v)) err = 'cp_invalid';
    if (!err && c.clau === 'telefon' && v && v.replace(/\D/g, '').length < 9) err = 'telefon_invalid';
    var p = $('gsNou_' + c.clau + '_err'), el = $('gsNou_' + c.clau);
    // L'espai del missatge sempre hi és: si desaparegués en sortir del camp, els botons es mourien i el clic es perdria
    p.textContent = err ? c.nom + ' ' + (ERRORS_CAMP[err] || err) + (err === 'correu_domini' ? c.valors : '') + '.' : '';
    el.classList.toggle('is-error', !!err); el.setAttribute('aria-invalid', err ? 'true' : 'false');
    return !err;
  }
  function desaNouProfessor() {
    var bons = campsForm().map(function (c) { return validaCampNou(c); });
    if (bons.indexOf(false) >= 0) { var primer = document.querySelector('#gsNouForm .is-error'); if (primer) primer.focus(); return toast('Reviseu els camps marcats en vermell.', true); }
    api('alta_professor', { valors: valorsNou() }, 'Desant el docent nou…').then(function (r) {
      if (r.ok) {
        // PAS 36: el docent nou s'afegeix al professorat ja carregat (sense tornar-lo a llegir)
        S.brut = false; if (S.cache.professorat && r.valors) S.cache.professorat.files.push(Object.assign({ id: r.id, data: r.data || '', desat_per: S.sessio.email, equips: [] }, r.valors));
        toast('Docent desat: ' + r.id + '.'); var v = valorsNou();
        S.nouArribada = (r.valors && r.valors.data_arribada_centre) || new Date().toISOString().slice(0, 10);
        pintaNouProfessor(r.id); campsForm().forEach(function (c) { var el = $('gsNou_' + c.clau); if (el) el.value = v[c.clau] || ''; });
        if (r.valors && r.valors.carrec && $('gsNou_carrec')) $('gsNou_carrec').value = r.valors.carrec;
        var b = $('gsNou_substitueix_bloc'); if (b) b.hidden = v.situacio !== 'Substitut';
        return;
      }
      if (r.error === 'validacio') {
        var perNom = {}; campsForm().forEach(function (c) { perNom[c.nom] = c; });
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
  // PAS 31 · PDF per signar: plantilla EN BLANC (un sol full A4) que el docent omple a mà i signa; després secretaria
  // en copia les dades al formulari i desa. Mateix aspecte que els altres documents del centre (Montserrat, logo).
  function pdfNouProfessor() {
    var crida = preparaPdf().then(function (R) {
      var BLAU = [28, 12, 188], TARONJA = [232, 96, 12], GRIS = [90, 96, 112], TEXT = [30, 30, 42], VORA = [200, 205, 220];
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), W = 210, H = 297, MX = 16;
      doc.addFileToVFS('Montserrat-400.ttf', R.regular); doc.addFont('Montserrat-400.ttf', 'Montserrat', 'normal');
      doc.addFileToVFS('Montserrat-600.ttf', R.negreta); doc.addFont('Montserrat-600.ttf', 'Montserrat', 'bold');
      doc.addImage(R.logo, 'PNG', MX, 9, 28, 28 * 432 / 1100);
      doc.setFont('Montserrat', 'bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, TARONJA);
      doc.text('GESTIO · ALTA DE PROFESSORAT', W - MX, 12.5, { align: 'right' });
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS);
      doc.text('Institut Joan Miró · Curs ' + (S.d.curs || ''), W - MX, 17, { align: 'right' });
      doc.setDrawColor.apply(doc, BLAU); doc.setLineWidth(0.6); doc.line(MX, 22, W - MX, 22);
      doc.setFontSize(17); doc.setTextColor.apply(doc, BLAU); doc.text('Alta de nou professor/a', MX, 31);
      doc.setFontSize(8.5); doc.setTextColor.apply(doc, GRIS);
      doc.text('Ompliu el full amb lletra clara. Els camps amb * són obligatoris.', MX, 36.5);
      var grups = grupsNou();
      var n = grups.reduce(function (t, g) { return t + g.camps.length; }, 0);
      // Alçada de cada fila perquè tot càpiga en un full: capçalera (40) + grups + signatura (40) + peu (12)
      var dispo = H - 40 - 12 - 44 - grups.length * 7.5;
      var alt = Math.max(6.2, Math.min(9.5, dispo / n));
      var pista = function (c) {
        if (c.clau === 'substitueix') return 'Només si és substitut';
        if (c.tipus === 'data') return '____ / ____ / ________';
        if (c.tipus === 'llista' && c.clau !== 'especialitat') { var o = c.valors.split('|').map(function (x) { return x.trim(); }); if (o.length <= 6) return 'Encercleu-ne un:   ' + o.join('   ·   '); }
        if (c.clau === 'especialitat') return '';
        if (c.tipus === 'correu' && c.valors) return '______________________ ' + c.valors;
        return '';
      };
      var y = 40;
      grups.forEach(function (g) {
        doc.autoTable({
          startY: y, margin: { left: MX, right: MX }, theme: 'grid',
          head: [[{ content: g.nom, colSpan: 2 }]],
          body: g.camps.map(function (c) { return [c.nom + (c.obligatori || c.clau === 'substitueix' ? ' *' : ''), pista(c)]; }),
          headStyles: { font: 'Montserrat', fontStyle: 'bold', fontSize: 9, fillColor: BLAU, textColor: 255, cellPadding: 1.6 },
          styles: { font: 'Montserrat', fontSize: 8.5, cellPadding: { top: 1, bottom: 1, left: 2.4, right: 2.4 }, minCellHeight: alt, valign: 'middle', textColor: TEXT, lineColor: VORA, lineWidth: 0.2 },
          columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold', textColor: BLAU, fillColor: [246, 247, 252] }, 1: { textColor: [150, 154, 168], fontSize: 7.5 } }
        });
        y = doc.lastAutoTable.finalY + 2.5;
      });
      y += 2;
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, TEXT);
      doc.splitTextToSize('Declaro que les dades d’aquest document són correctes i autoritzo el centre a fer-les servir per a la gestió interna del professorat.', W - 2 * MX).forEach(function (l) { doc.text(l, MX, y); y += 4; });
      y += 1.5;
      var ample = W - 2 * MX, altSig = Math.min(32, H - 14 - y);
      doc.setDrawColor.apply(doc, VORA); doc.setLineWidth(0.4); doc.roundedRect(MX, y, ample, altSig, 2, 2);
      doc.setFont('Montserrat', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, BLAU);
      doc.text('Signatura de la persona interessada i data', MX + 3, y + 5);
      doc.setFont('Montserrat', 'normal'); doc.setTextColor.apply(doc, GRIS);
      doc.text('Data: ____ / ____ / ________', MX + ample - 3, y + altSig - 3, { align: 'right' });
      doc.setFontSize(6.5);
      doc.text('Per a secretaria: un cop omplert, copieu les dades al formulari Nou professor/a de GESTIO i deseu. La data d’arribada al centre la posa GESTIO en desar.', MX, H - 8);
      if (doc.internal.getNumberOfPages() > 1) console.warn('PDF de l’alta en més d’un full');
      doc.save('alta-professor-plantilla.pdf');
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
        : '<p class="gs-ajuda" style="flex:1 1 100%;margin:0 0 4px">Equips de <strong>gestió</strong> (direcció, coordinacions, secretaria…) i <strong>docents</strong> (equips de nivell, departaments…). El tipus només serveix per classificar-los i filtrar-los: tots dos funcionen igual. Els membres poden ser professorat o PAS, i una persona pot ser a diversos equips. <strong>Membres</strong>: cliqueu la cel·la per afegir-ne o treure’n. Els permisos, a la pestanya <strong>Permisos</strong>. Per <strong>modificar</strong> un equip, cliqueu la cel·la (nom, tipus, descripció, actiu, grups) i deseu; el codi no es pot canviar. Per <strong>esborrar-lo</strong>, la paperera (o, per conservar-lo, Actiu = no).</p>' +
          '<span class="gs-espai"></span><button type="button" class="prog-btn" data-accio="nou-equip">+ Afegeix equip</button>');
    return perm ? pintaMatriuPermisos(r) : pintaEquips(r);
  }
  function pintaEquips(r) {
    var dadesEquips = function () { return r.equips.map(function (q) { return Object.assign({ _nou: false }, q, { membres: (q.membres || []).slice(), permisos: (q.permisos || []).slice(), grups: (q.grups || []).slice() }); }); };
    S.descartaEquips = function () { S.taula.replaceData(dadesEquips()); };
    var nomMod = function (id) { if (id === '*') return 'tots'; var m = r.moduls.filter(function (x) { return x.id === id; })[0]; return m ? m.nom : id; };
    S.taula = new Tabulator('#gsTaula', {
      data: dadesEquips(), index: 'id_equip', layout: 'fitDataStretch', height: alcada(),
      columns: [
        { title: '', field: '_acc', width: 46, headerSort: false, hozAlign: 'center', cssClass: 'gs-accions',
          formatter: function (c) { return c.getRow().getData().id_equip === 'EQ-DIR' ? '' : '<span class="gs-acc"><button type="button" class="gs-perill gs-paperera" title="Esborra l’equip" aria-label="Esborra l’equip">' + PAPERERA + '</button></span>'; },
          cellClick: function (e, cell) { if (e.target.closest('button')) esborraEquip(cell.getRow()); } },
        { title: 'Codi', field: 'id_equip', width: 130, editable: function (cell) { return cell.getRow().getData()._nou; }, editor: 'input', headerFilter: 'input', headerFilterFunc: function (f, v) { return conte(v, f); } },
        { title: 'Nom', field: 'nom', editor: 'input', minWidth: 200, headerFilter: 'input', headerFilterFunc: function (f, v) { return conte(v, f); } },
        { title: 'Tipus', field: 'tipus', editor: 'list', editorParams: { values: { gestio: 'Gestió', docent: 'Docent' } }, formatter: function (c) { return c.getValue() === 'docent' ? 'Docent' : 'Gestió'; }, headerFilter: 'list', headerFilterParams: { values: { gestio: 'Gestió', docent: 'Docent' }, clearable: true } },
        { title: 'Descripció', field: 'descripcio', editor: 'input', minWidth: 200 },
        { title: 'Actiu', field: 'actiu', editor: 'list', editorParams: { values: { si: 'sí', no: 'no' } }, formatter: function (c) { return c.getValue() === 'no' ? 'no' : 'sí'; } },
        // PAS 30: un equip docent amb grups (p. ex. 1r ESO A) només veu l'alumnat d'aquests grups
        { title: 'Grups', field: 'grups', minWidth: 120, editor: 'list', editorParams: { values: r.grups || [], multiselect: true }, headerFilter: 'input',
          headerFilterFunc: function (f, v) { return conte((v || []).join(', '), f); },
          formatter: function (c) { var g = c.getValue() || []; return g.length ? g.map(function (x) { return '<span class="gs-pill">' + esc(x) + '</span>'; }).join('') : '<span class="gs-gris">tots</span>'; },
          tooltip: 'Si l’equip té grups, els seus membres només veuen l’alumnat d’aquests grups. Buit: tots els grups.' },
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
      // PAS 36: qui desa els permisos és administrador global (nivell admin a tot arreu): els seus mòduls ja carregats no canvien
      // PAS 35: sense tornar a carregar: s'actualitzen les dades del navegador
      canvis.forEach(function (c) {
        var q = S.d.r.equips.filter(function (x) { return x.id_equip === c.id_equip; })[0]; if (!q) return;
        q.permisos = (q.permisos || []).filter(function (p) { return p.modul !== c.id_modul; }).concat(c.nivell ? [{ modul: c.id_modul, nivell: c.nivell }] : []);
      });
      $('gsTaula').querySelectorAll('select[data-eq]').forEach(function (x) { x.dataset.abans = x.value; x.classList.remove('gs-canviat'); });
      marcaBrut(false); toast('Permisos desats.');
    });
  }
  // Membres d'un equip: llista del professorat amb cercador; es desa de cop (membres_desa)
  // PAS 32 · Membres d'un equip: dues llistes (a l'esquerra qui NO és membre, a la dreta qui SÍ que ho és), per ordre del
  // 1r cognom, amb botons al mig per passar persones d'una a l'altra (també doble clic). Cada llista té la seva cerca.
  function editaMembres(q, prof) {
    var sel = (q.membres_ids || []).slice();
    var ordre = function (a, b) { return plega(a.nom).localeCompare(plega(b.nom), 'ca'); };
    prof = prof.slice().sort(ordre);
    var opcio = function (p) { return '<option value="' + esc(p.id) + '" data-t="' + esc(plega(p.nom + ' ' + p.especialitat)) + '">' + esc(p.nom) + (p.especialitat ? ' · ' + esc(p.especialitat) : '') + (p.baixa ? ' (de baixa)' : '') + '</option>'; };
    var html = '<p class="gs-ajuda">Persones (professorat i PAS) de <strong>' + esc(q.nom) + '</strong> (' + esc(q.id_equip) + '). Seleccioneu-ne una o diverses (Ctrl o Maj + clic) i passeu-les amb els botons del mig, o feu doble clic. Una persona pot ser a diversos equips.</p>' +
      '<div class="gs-transfer">' +
        '<div class="gs-transfer__col"><label class="gs-transfer__tit" for="gsMemFora">No membres <span id="gsMemNFora"></span></label>' +
          '<input type="search" class="gs-cerca gs-transfer__cerca" id="gsMemCercaFora" placeholder="Cerca…" aria-label="Cerca entre els no membres">' +
          '<select multiple id="gsMemFora" class="gs-transfer__llista"></select></div>' +
        '<div class="gs-transfer__btns">' +
          '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" id="gsMemAfegeix" title="Fes membres les persones seleccionades" aria-label="Afegeix a l’equip">Afegeix →</button>' +
          '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" id="gsMemTreu" title="Treu de l’equip les persones seleccionades" aria-label="Treu de l’equip">← Treu</button></div>' +
        '<div class="gs-transfer__col"><label class="gs-transfer__tit" for="gsMemDins">Membres <span id="gsMemNDins"></span></label>' +
          '<input type="search" class="gs-cerca gs-transfer__cerca" id="gsMemCercaDins" placeholder="Cerca…" aria-label="Cerca entre els membres">' +
          '<select multiple id="gsMemDins" class="gs-transfer__llista"></select></div>' +
      '</div>';
    var pinta = function () {
      var fora = prof.filter(function (p) { return sel.indexOf(p.id) < 0; }), dins = prof.filter(function (p) { return sel.indexOf(p.id) >= 0; });
      // Membres que ja no surten a la llista de persones (p. ex. esborrats): es mantenen
      sel.forEach(function (id) { if (!prof.some(function (p) { return p.id === id; })) dins.push({ id: id, nom: id, especialitat: '' }); });
      $('gsMemFora').innerHTML = fora.map(opcio).join(''); $('gsMemDins').innerHTML = dins.map(opcio).join('');
      $('gsMemNFora').textContent = '(' + fora.length + ')'; $('gsMemNDins').textContent = '(' + dins.length + ')';
      filtra('gsMemCercaFora', 'gsMemFora'); filtra('gsMemCercaDins', 'gsMemDins');
    };
    var filtra = function (idCerca, idLlista) { var t = plega($(idCerca).value.trim()); [].forEach.call($(idLlista).options, function (o) { o.hidden = !!t && o.dataset.t.indexOf(t) < 0; }); };
    var passa = function (dEsquerra) {
      var llista = $(dEsquerra ? 'gsMemFora' : 'gsMemDins');
      var ids = [].filter.call(llista.options, function (o) { return o.selected && !o.hidden; }).map(function (o) { return o.value; });
      if (!ids.length) return toast('Seleccioneu primer alguna persona de la llista ' + (dEsquerra ? 'de l’esquerra.' : 'de la dreta.'), true);
      sel = dEsquerra ? sel.concat(ids.filter(function (x) { return sel.indexOf(x) < 0; })) : sel.filter(function (x) { return ids.indexOf(x) < 0; });
      pinta();
    };
    pregunta('Membres · ' + q.nom, html, [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa els membres', valor: 1, abans: function () {
      if (q.id_equip === 'EQ-DIR' && sel.length < 2 && !confirmaDir) { confirmaDir = true; toast('Recomanació: almenys dues persones a l’equip directiu, perquè ningú no es quedi sense accés. Torneu a prémer «Desa els membres» per desar igualment.', true); return false; }
    } }], false).then(function (v) {
      confirmaDir = false;
      if (!v) return;
      api('membres_desa', { id_equip: q.id_equip, membres: sel }, 'Desant els membres…').then(function (r2) {
        if (!r2.ok) return toast(text(r2.error), true);
        // PAS 36: la columna Equips del professorat i del PAS ja carregats s'actualitza aquí (sense tornar-los a llegir)
        ['professorat', 'pas'].forEach(function (m) { var c = S.cache[m]; if (!c) return; c.files.forEach(function (f) {
          var e = (f.equips || []).filter(function (x) { return x !== q.id_equip; }); if (sel.indexOf(f.id) >= 0) e.push(q.id_equip); f.equips = e; }); });
        // PAS 35: sense tornar a carregar: s'actualitza la fila de l'equip
        var noms = sel.map(function (id) { var p = prof.filter(function (x) { return x.id === id; })[0]; return p ? p.nom : id; });
        var o = S.d.r.equips.filter(function (x) { return x.id_equip === q.id_equip; })[0]; if (o) { o.membres = noms; o.membres_ids = sel.slice(); }
        var row = S.taula.getRow(q.id_equip); if (row) row.update({ membres: noms, membres_ids: sel.slice() });
        toast('Membres desats (' + r2.entren + ' altes, ' + r2.surten + ' baixes).');
      });
    });
    var confirmaDir = false;
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample');
    pinta();
    $('gsMemAfegeix').addEventListener('click', function () { passa(true); });
    $('gsMemTreu').addEventListener('click', function () { passa(false); });
    $('gsMemFora').addEventListener('dblclick', function () { passa(true); });
    $('gsMemDins').addEventListener('dblclick', function () { passa(false); });
    $('gsMemCercaFora').addEventListener('input', function () { filtra('gsMemCercaFora', 'gsMemFora'); });
    $('gsMemCercaDins').addEventListener('input', function () { filtra('gsMemCercaDins', 'gsMemDins'); });
  }
  // PAS 34 · Equip nou: finestra amb el codi (EQ- + lletres o xifres), el nom, el tipus i la descripció; es desa en acceptar
  function nouEquip() {
    if (S.brut) return toast('Primer deseu o descarteu els canvis dels equips.', true);
    var html = '<div class="gs-form-fila"><label>Codi <span class="gs-codi-eq"><span>EQ-</span><input id="gsEqCodi" maxlength="20" autocomplete="off" placeholder="ADM"></span></label></div>' +
      '<p class="gs-ajuda" id="gsEqCodiAj">Lletres i xifres, sense espais ni accents (p. ex. ADM, CON, 1ESOA). No es podrà canviar.</p>' +
      '<div class="gs-form-fila"><label>Nom <input id="gsEqNom" maxlength="80" autocomplete="off" placeholder="Administratives"></label></div>' +
      '<div class="gs-form-fila"><label>Tipus <select id="gsEqTipus"><option value="gestio">Gestió (direcció, secretaria, administració, consergeria…)</option><option value="docent">Docent (equips de nivell o de grup, departaments…)</option></select></label></div>' +
      '<div class="gs-form-fila"><label>Descripció <input id="gsEqDesc" maxlength="200" autocomplete="off"></label></div>' +
      '<p class="prog-avis" id="gsEqErr" hidden></p>';
    var codi = function () { return 'EQ-' + String($('gsEqCodi').value || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_.·]+/g, '-').replace(/[^A-Z0-9-]/g, ''); };
    pregunta('Equip nou', html, [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Crea l’equip', valor: 1, abans: function () {
      var c = codi(), err = '';
      if (!/^EQ-[A-Z0-9][A-Z0-9-]{0,19}$/.test(c)) err = 'Escriviu el codi després d’EQ- (lletres o xifres).';
      else if (S.taula.getData().some(function (q) { return q.id_equip === c; })) err = 'Ja hi ha un equip amb el codi ' + c + '.';
      else if (!$('gsEqNom').value.trim()) err = 'Escriviu el nom de l’equip.';
      if (err) { $('gsEqErr').textContent = err; $('gsEqErr').hidden = false; return false; }
      nouEquip.dades = { id_equip: c, nom: $('gsEqNom').value.trim(), tipus: $('gsEqTipus').value, descripcio: $('gsEqDesc').value.trim(), actiu: 'si', grups: [] };
    } }]).then(function (v) {
      if (!v) return;
      var equips = S.taula.getData().map(function (q) { return { id_equip: q.id_equip, nom: q.nom, tipus: q.tipus, descripcio: q.descripcio, actiu: q.actiu, grups: Array.isArray(q.grups) ? q.grups : String(q.grups || '').split(',').filter(Boolean) }; }).concat([nouEquip.dades]);
      api('equips_desa', { equips: equips }, 'Creant l’equip…').then(function (r) {
        if (!r.ok) return toast(text(r.error) + (r.id_equip ? ' (' + r.id_equip + ')' : '') + (r.camp ? ' (' + r.camp + ')' : ''), true);
        var nou = Object.assign({ _nou: false, membres: [], membres_ids: [], permisos: [] }, nouEquip.dades);
        S.d.r.equips.push(Object.assign({}, nou)); S.taula.addRow(nou, false);
        toast('Equip ' + nouEquip.dades.id_equip + ' creat. Ara podeu afegir-hi membres i, a la pestanya Permisos, donar-li accés als mòduls.');
      });
    });
    $('gsEqCodi').addEventListener('input', function () { $('gsEqCodiAj').textContent = 'Codi: ' + codi() + ' · lletres i xifres, sense espais ni accents. No es podrà canviar.'; });
    $('gsEqCodi').focus();
  }
  // PAS 34 · Esborrar un equip: també els seus membres i permisos (no es pot desfer). L'equip directiu no.
  function esborraEquip(row) {
    var q = row.getData();
    if (S.brut) return toast('Primer deseu o descarteu els canvis dels equips.', true);
    var nm = (q.membres_ids || []).length, np = (q.permisos || []).length;
    pregunta('Esborrar l’equip', '<p>S’esborrarà l’equip <strong>' + esc(q.nom || q.id_equip) + '</strong> (' + esc(q.id_equip) + ')' + (nm || np ? ', amb ' + nm + (nm === 1 ? ' membre' : ' membres') + ' i ' + np + (np === 1 ? ' permís' : ' permisos') : '') + '. Les persones no s’esborren, però perden els permisos que tenien per aquest equip. <strong>No es pot desfer.</strong></p><p class="gs-ajuda">Si el voleu conservar però sense que doni accés, poseu-lo com a inactiu (Actiu = no).</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Esborra l’equip', valor: 1, tipus: 'danger' }]).then(function (v) {
      if (!v) return;
      api('equip_esborra', { id_equip: q.id_equip }, 'Esborrant l’equip…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        ['professorat', 'pas'].forEach(function (m) { var c = S.cache[m]; if (c) c.files.forEach(function (f) { f.equips = (f.equips || []).filter(function (x) { return x !== r.id_equip; }); }); });
        S.d.r.equips = S.d.r.equips.filter(function (x) { return x.id_equip !== r.id_equip; }); row.delete();
        toast('Equip ' + r.id_equip + ' esborrat (' + r.membres + ' membres i ' + r.permisos + ' permisos).');
      });
    });
  }
  function desaEquips() {
    var equips = S.taula.getData().map(function (q) { return { id_equip: q.id_equip, nom: q.nom, tipus: q.tipus, descripcio: q.descripcio, actiu: q.actiu, grups: Array.isArray(q.grups) ? q.grups : String(q.grups || '').split(',').filter(Boolean) }; });
    api('equips_desa', { equips: equips }, 'Desant els equips…').then(function (r) {
      if (!r.ok) return toast(text(r.error) + (r.id_equip ? ' (' + r.id_equip + ')' : '') + (r.camp ? ' (' + r.camp + ')' : ''), true);
      // PAS 35: no cal tornar a llegir les dades: les del navegador ja són les desades
      var r0 = S.d.r;
      S.taula.getData().forEach(function (q) { var o = r0.equips.filter(function (x) { return x.id_equip === q.id_equip; })[0]; if (o) Object.assign(o, { nom: q.nom, tipus: q.tipus, descripcio: q.descripcio, actiu: q.actiu, grups: (q.grups || []).slice() }); });
      S.taula.getRows().forEach(function (row) { row.getCells().forEach(function (c) { c.getElement().classList.remove('gs-canviat'); }); });
      marcaBrut(false); toast('Equips desats.');
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
    var m = AJUDA.moduls[S.modul.id === 'curriculum_grups' ? 'curriculum' : S.modul.id] || { titol: S.modul.nom, temes: [], graella: true };
    return m.temes.map(function (t) { return Object.assign({ grup: m.titol }, t); })
      .concat(m.graella ? AJUDA.comu.temes.map(function (t) { return Object.assign({ grup: AJUDA.comu.titol }, t); }) : []);
  }
  function pintaAjuda() {
    var q = senseAccents($('gsAjudaCerca').value.trim()), temes = temesAjuda(), grup = '';
    var bons = temes.filter(function (t) { return !q || q.split(/\s+/).every(function (p) { return senseAccents(t.titol + ' ' + t.claus + ' ' + t.text.join(' ')).indexOf(p) >= 0; }); });
    var m = AJUDA && AJUDA.moduls[S.modul.id === 'curriculum_grups' ? 'curriculum' : S.modul.id];
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
  // PAS 30: el requadre de la (i) s'obre cap a dins si la icona és a prop de la vora de la zona visible
  var posaInfo = function (e) {
    var i = e.target && e.target.closest && e.target.closest('.gs-info'); if (!i) return;
    var r = i.getBoundingClientRect(), cont = i.closest('#gsTaula, .prog-modal__box') || document.body, rc = cont.getBoundingClientRect();
    var w = Math.min(260, window.innerWidth * 0.8), mig = r.left + r.width / 2, esq = Math.max(0, rc.left), dre = Math.min(window.innerWidth, rc.right);
    i.classList.toggle('gs-info--esq', mig - w / 2 < esq + 8);
    i.classList.toggle('gs-info--dre', !(mig - w / 2 < esq + 8) && mig + w / 2 > dre - 8);
  };
  document.addEventListener('mouseover', posaInfo); document.addEventListener('focusin', posaInfo);
  $('gsModul').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accio]'); if (!b || b.closest('#gsBarra')) return;
    switch (b.dataset.accio) {
      case 'alta': alta(); break;
      case 'importa': importaFitxer(); break;
      case 'nou-desa': desaNouProfessor(); break;
      case 'totals': nombresTotals(); break;
      case 'nivell': triaNivell(b.dataset.nivell || ''); break;
      case 'incompletes': S.nomesIncompletes = !S.nomesIncompletes; b.classList.toggle('is-actiu', S.nomesIncompletes); b.setAttribute('aria-pressed', String(S.nomesIncompletes)); aplicaFiltre(); S.taula.redraw(true); compteIncompletes(); break;
      case 'retards-llista': llistaRetards(); break;
      case 'amon-nova': novaAmon(); break;
      case 'amon-analisi': analisiAmon(); break;
      case 'amon-avis': llistaAvisAmon(); break;
      case 'amon-config': configAmon(); break;
      case 'co-analisi': analisiConsell(); break;
      case 'co-config': configConsell(); break;
      case 'cur-materies': vistaCurriculum(false); break;
      case 'cur-grups': vistaCurriculum(true); break;
      case 'cur-nivell': S.nivellCurr = b.dataset.nivell; document.querySelectorAll('#gsEines [data-accio="cur-nivell"]').forEach(function (x) { x.classList.toggle('is-actiu', x === b); }); aplicaFiltre(); break;
      case 'cur-genera': generaGrups(); break;
      case 'cur-resum': resumCurriculum(); break;
      case 'cur-document': documentEquips(); break;
      case 'cur-especialitat': documentEspecialitat(); break;
      case 'cur-hores': horesLectives(); break;
      case 'co-pdf': pdfConsell(); break;
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
      case 'nou-equip': nouEquip(); break;
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
