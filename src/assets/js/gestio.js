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
    camp_desconegut: 'Aquest camp no és d’hores lectives.', grup_classe_desconegut: 'Grups-classe: només lletres de grups-classe del nivell (vegeu el botó Grups-classe), separades per comes (grups) o + (units).', sense_especialitat: 'No trobem la vostra especialitat a la fitxa del professorat.', marc_invalid: 'El marc horari té errors.', aules_invalides: 'Les aules tenen errors.', regles_invalides: 'Les regles tenen errors.', sessions_invalides: 'Les sessions tenen errors.', professorat_invalid: 'Les graelles del professorat tenen errors.', especialitat_repetida: 'Hi ha especialitats a més d’un departament/àmbit.', classes_buides: 'Cada nivell ha de tenir almenys un grup-classe.', separacio_invalida: 'Cal marcar almenys un grup-classe de la fila i deixar-ne algun.', hores_invalides: 'Les hores de la part han de ser més d’1 i menys que les del grup.', falta_configura: 'Cal executar «configura» a l’Apps Script (falta la columna d’hores lectives).',
    falten_dades: 'Cap alumne del grup té les dades d’aquest document', sense_alumnes: 'No hi ha alumnes en aquest grup.',
    grup_desconegut: 'Algun grup de l’equip no existeix (reviseu la columna Grups).',
    google_token_invalid: 'No s’ha pogut validar l’inici de sessió amb Google. Torneu-ho a provar.',
    google_no_configurat: 'L’accés encara no està configurat.',
    sessio_no_valida: 'La sessió ha caducat. Torneu a entrar.',
    error_servidor: 'Hi ha hagut un error. Torneu-ho a provar d’aquí a una estona.',
    tancat: 'GESTIO està tancat: podeu consultar, però no desar.',
    desiderata_bloquejada: 'La desiderata està bloquejada: només es pot consultar.', data_invalida: 'La data no és vàlida.',
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
  // PAS 49: portada amb els mòduls agrupats (Personal, Alumnat, Organització del curs, Administració…). El grup surt de la
  // pestanya «moduls» (columna grup). Amb més de 4 mòduls, a dalt hi ha pestanyes per veure'n només un grup (es recorda).
  var ORDRE_GRUPS = ['Personal', 'Alumnat', 'Organització del curs', 'Administració', 'Altres'];
  function pintaPortada() {
    var ms = S.sessio.moduls, grups = [];
    ms.forEach(function (m) { var g = m.grup || 'Altres'; if (grups.indexOf(g) < 0) grups.push(g); });
    grups.sort(function (a, b) { var i = ORDRE_GRUPS.indexOf(a), j = ORDRE_GRUPS.indexOf(b); return (i < 0 ? 50 : i) - (j < 0 ? 50 : j) || a.localeCompare(b, 'ca'); });
    var amb = ms.length > 4 && grups.length > 1, sel = '';
    try { sel = localStorage.getItem('gestio_grup') || ''; } catch (e) { /* sense memòria */ }
    if (grups.indexOf(sel) < 0) sel = '';
    var targeta = function (m) {
      return '<a class="prog-apartat" href="#' + esc(m.id) + '">' + (ICONES[m.id] || ICONES.professorat) +
        '<span class="gs-tag gs-tag--' + esc(m.nivell) + '">' + esc(NOM_NIVELL[m.nivell] || m.nivell) + '</span>' +
        '<span class="prog-apartat__nom">' + esc(m.nom) + '</span>' +
        '<span class="prog-apartat__txt">' + esc(m.descripcio || '') + '</span>' +
        '<span class="prog-apartat__cta">Obre <span aria-hidden="true">→</span></span></a>';
    };
    var html = amb ? '<div class="gs-pestanyes gs-portada__tabs" role="tablist" aria-label="Grups de mòduls">' + [''].concat(grups).map(function (g) {
      var n = g ? ms.filter(function (m) { return (m.grup || 'Altres') === g; }).length : ms.length;
      return '<button type="button" role="tab" data-grup="' + esc(g) + '" aria-selected="' + (g === sel) + '">' + esc(g || 'Tots') + ' <span class="gs-portada__n">' + n + '</span></button>'; }).join('') + '</div>' : '';
    html += grups.filter(function (g) { return !sel || g === sel; }).map(function (g) {
      var mg = ms.filter(function (m) { return (m.grup || 'Altres') === g; });
      return '<section class="gs-portada__grup">' + (grups.length > 1 ? '<h2 class="gs-portada__titol">' + esc(g) + '</h2>' : '') + '<div class="gs-portada__targetes">' + mg.map(targeta).join('') + '</div></section>';
    }).join('');
    $('gsModuls').innerHTML = html;
    [].forEach.call($('gsModuls').querySelectorAll('[data-grup]'), function (b) { b.addEventListener('click', function () { try { localStorage.setItem('gestio_grup', b.dataset.grup); } catch (e) { /* res */ } pintaPortada(); }); });
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
    // PAS 48: la desiderata té el seu propi desplaçament (si no, les observacions quedaven tallades a sota)
    var ds = document.querySelector('#gsTaula.gs-des'); if (ds) { ds.style.maxHeight = h; ds.style.overflowY = 'auto'; }
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
    if (m.id === 'desiderata') return carregaDesiderata();
    if (m.id === 'horaris') return carregaHoraris();
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
  var ordreNivell = function (v) { var o = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'], i = o.indexOf(String(v || '').replace(/\bBat\b/i, 'BAT')); return i < 0 ? (v ? 50 : 99) : i; };
  function filtreDe(c, compacte) {
    var opts = c.tipus === 'si_no' ? function () { return [{ v: 'sí', t: 'sí' }, { v: '', t: 'no' }]; }
      : c.tipus === 'llista' ? function () { return c.valors.split('|').map(function (x) { x = x.trim(); return { v: x, t: x }; }).concat([BUIT]); }
      : c.tipus === 'data' ? function () { return valorsDiferents(c.clau).map(function (o) { return o === BUIT ? o : { v: o.v, t: dataVista(o.v) }; }); }
      : function () { return valorsDiferents(c.clau); };
    // PAS 47: el filtre Nivell, en l'ordre de les etapes (ESO i després batxillerat), no alfabètic
    if (c.clau === 'nivell') { var base = opts; opts = function () { return base().slice().sort(function (a, b) { return ordreNivell(a.v) - ordreNivell(b.v); }); }; }
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
    else if (ed && esCurriculum()) cols.push({ title: '', field: '_acc', frozen: true, headerSort: false, download: false, width: S.modul.id === 'curriculum_grups' || S.vistaCur === 'distribucio' ? 92 : 44, cssClass: 'gs-accions',
      formatter: function () { return '<span class="gs-acc">' + (S.modul.id === 'curriculum' && S.vistaCur === 'distribucio' ? '<button type="button" class="gs-hist" data-a="separa" title="Separa alguns grups-classe en una fila nova d’aquesta matèria" aria-label="Separa grups-classe">' + TISORES + '</button>' : '') + (S.modul.id === 'curriculum_grups' ? '<button type="button" class="gs-hist" data-a="divideix" title="Reparteix les hores d’aquest grup amb una altra especialitat" aria-label="Reparteix les hores">' + TISORES + '</button>' : '') + '<button type="button" class="gs-perill gs-paperera" data-a="esborra" title="Esborra" aria-label="Esborra">' + PAPERERA + '</button></span>'; },
      cellClick: function (e, cell) { var b = e.target.closest('button[data-a]'); if (!b) return; if (b.dataset.a === 'divideix') divideixAssignacio(cell.getRow()); else if (b.dataset.a === 'separa') separaMateria(cell.getRow()); else accioFila(b.dataset.a, cell.getRow()); } });
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
    // PAS 43: el mòdul Currículum té dues vistes del mateix full: Matèries (camps propis) i Grups i distribució
    if (S.modul.id === 'curriculum') {
      var DIST = ['grups_classe', 'docents'], COM = ['nivell', 'materia'];
      camps = camps.filter(function (c) { return COM.indexOf(c.clau) >= 0 || (S.vistaCur === 'distribucio' ? DIST.indexOf(c.clau) >= 0 || c.clau === 'hores_a' || c.clau === 'hores_b' : DIST.indexOf(c.clau) < 0); });
    }
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
      if (S.modul.id === 'curriculum' && c.clau === 'grups_classe') { col.tooltip = 'Comes = grups separats (A, B → 2 grups); + = units (A+B → 1 grup). Buit = un grup per cada grup-classe'; col.formatter = function (cell) { return cell.getValue() ? esc(cell.getValue()) : '<span class="gs-gris">tots, separats</span>'; }; }
      if (S.modul.id === 'curriculum' && S.vistaCur === 'distribucio' && (c.clau === 'hores_a' || c.clau === 'hores_b')) { col.editable = false; col.cssClass = 'gs-ck'; col.tooltip = 'Es canvia a la pestanya Matèries'; }
      if (c.tipus === 'data') { col.formatter = function (cell) { return esc(dataVista(cell.getValue())); }; col.accessorDownload = function (v) { return dataVista(v); }; }
      // PAS 31: el codi intern de l'alumne del control d'entrada no es mostra (es fa servir per dins)
      if (esRegistre() && c.clau === 'id_alumne') return;
      // PAS 39/43: currículum → Matèries: hores de l'alumne després d'«Hores B»; Grups i distribució: hores de professorat al final
      if (S.modul.id === 'curriculum' && c.clau === 'hores_b' && S.vistaCur !== 'distribucio') {
        cols.push(col);
        col = { title: 'Hores alumne', field: '_halumne', width: 96, hozAlign: 'right', headerSort: false, download: false, cssClass: 'gs-calc', tooltip: 'A + B/2', formatter: function (cell) { var d = cell.getRow().getData(); return fmtH(horesA(d) + horesB(d) / 2); } };
      }
      if (S.modul.id === 'curriculum' && c.clau === 'grups_classe' && S.vistaCur === 'distribucio') {
        cols.push(col);
        col = { title: 'Grups', field: '_ngrups', width: 220, headerSort: false, download: false, cssClass: 'gs-calc', tooltip: 'Grups que surten dels grups-classe (es generen a Assignacions)', formatter: function (cell) { var g = grupsMat(cell.getRow().getData()); return '<strong>' + g.length + '</strong> <span class="gs-gris">· ' + esc(g.map(function (x) { return x.nom.slice(cell.getRow().getData().nivell.length).trim(); }).join(' · ')) + '</span>'; } };
      }
      if (S.modul.id === 'curriculum' && c.clau === 'docents' && S.vistaCur === 'distribucio') {
        cols.push(col);
        col = { title: 'Hores professorat', field: '_hprof', width: 130, hozAlign: 'right', headerSort: false, download: false, cssClass: 'gs-calc', tooltip: '(A + B) × grups × docents a l’aula', formatter: function (cell) { var d = cell.getRow().getData(); return fmtH((horesA(d) + horesB(d)) * grupsDe(d) * (Math.round(numero(d.docents)) || 1)); } };
      }
      // PAS 42: professorat → ⚠ si el total lectives supera el màxim de la jornada
      if (S.modul.id === 'professorat' && c.clau === 'total_lectives') col.formatter = function (cell) {
        var t = cell.getValue(), mx = maxJornada(cell.getRow().getData().jornada);
        return esc(t == null ? '' : t) + (t !== '' && t != null && mx && Math.abs(numero(t) - mx) > 0.01 ? ' <span class="gs-avis-ret" title="No coincideix amb les ' + mx + ' h lectives de la jornada">⚠</span>' : '');
      };
      // PAS 47: assignacions → les files de codocència (o cotutoria) es marquen: n'hi ha una per docent i no és un error
      if (S.modul.id === 'curriculum_grups' && c.clau === 'grup') col.formatter = function (cell) {
        var d = cell.getRow().getData(), m = materiaDe(d), n = m ? Math.round(numero(m.docents)) || 1 : 1;
        return esc(cell.getValue() || '') + (n > 1 ? ' <span class="gs-codo" title="' + n + ' docents a l’aula alhora: hi ha una fila per docent, cadascuna amb totes les hores">' + (/tutoria/i.test(d.materia || '') ? 'Cotutoria' : 'Codocència') + ' ×' + n + '</span>' : '');
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
    // PAS 45: a Grups i distribució, els grups i les hores de professorat (calculats) es refan en canviar grups-classe, docents o hores
    if (S.modul.id === 'curriculum') S.taula.on('cellEdited', function (cell) { if (['grups_classe', 'docents', 'hores_a', 'hores_b'].indexOf(cell.getField()) >= 0) cell.getRow().reformat(); });
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
  var totalMateria = function (d) { var m = materiaDe(d); return m ? (numero(m.hores_a) + numero(m.hores_b)) * (Math.round(numero(m.docents)) || 1) : null; };
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
    var html = '<p class="gs-ajuda">Hores lectives de cada docent (fitxa del professorat; també es canvien des del mòdul Professorat). <strong>Alumnat</strong> = lectives amb alumnat (el que fa servir el Currículum); <strong>Total</strong> = alumnat + reduccions. ⚠ = el total no coincideix amb les hores de la jornada (sencera 18, ⅔ 12, mitja 9).</p>' +
      '<div class="gs-form-fila gs-hl-filtre"><label>Mostra <select id="gsHlMode"><option value="tot">Tot</option><option value="esp">Especialitat</option></select></label><label id="gsHlEspL" hidden>Especialitat <select id="gsHlEsp">' + esp.map(function (e) { return '<option>' + esc(e) + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" id="gsHlPdf">PDF</button></div>' +
      '<div class="gs-informe gs-hl-wrap"><table class="gs-form-taula gs-informe__taula gs-hl"><thead><tr><th rowspan="2">Professor/a</th><th rowspan="2">Jornada</th><th colspan="' + (COLS_HL.length + 1) + '" class="gs-hl__grup gs-hl-sep">Lectives amb alumnat</th><th colspan="' + COLS_RED.length + '" class="gs-hl__grup gs-hl-sep">Reduccions</th><th rowspan="2" class="gs-num gs-hl-sep">Total</th></tr><tr>' +
      COLS_HL.map(function (c) { return '<th class="gs-num" title="' + esc(c[2]) + '">' + c[1] + '</th>'; }).join('') + '<th class="gs-num">Alumnat</th>' + COLS_RED.map(function (c) { return '<th class="gs-num" title="' + esc(c[2]) + '">' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      esp.map(function (e) {
        return '<tr class="gs-informe__seccio"><td colspan="' + (totes.length + 4) + '">' + esc(e) + ' · <span data-tot="' + esc(e) + '"></span> h amb alumnat</td></tr>' + per[e].map(function (p) {
          return '<tr data-fila="' + esc(p.id) + '" data-esp="' + esc(e) + '" data-j="' + esc(p.jornada) + '"><td>' + esc(p.nom) + (p.carrec ? '<br><small class="gs-gris">' + esc(p.carrec) + '</small>' : '') + '</td><td>' + esc(p.jornada || '—') + '</td>' +
            COLS_HL.map(function (c) { return cel(p, c); }).join('') + '<td class="gs-num gs-hl__tot" data-t="a"></td>' + COLS_RED.map(function (c) { return cel(p, c); }).join('') + '<td class="gs-num gs-hl__tot" data-t="t"></td></tr>';
        }).join('');
      }).join('') + '</tbody><tfoot><tr class="gs-informe__total"><td colspan="2">Total <span id="gsHlN"></span></td>' + COLS_HL.map(function (c) { return '<td class="gs-num" data-peu="' + c[0] + '"></td>'; }).join('') + '<td class="gs-num" data-peu="_a"></td>' +
        COLS_RED.map(function (c) { return '<td class="gs-num" data-peu="' + c[0] + '"></td>'; }).join('') + '<td class="gs-num" data-peu="_t"></td></tr></tfoot></table></div>';
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
    var visible = function (e) { return $('gsHlMode').value === 'tot' || $('gsHlEsp').value === e; };
    var recalcula = function () {
      var tots = {}, peu = { _a: 0, _t: 0 }, nv = 0;
      [].forEach.call($('gsModalText').querySelectorAll('tr.gs-informe__seccio'), function (tr) { var s = tr.querySelector('[data-tot]'); tr.hidden = !visible(s.dataset.tot); });
      [].forEach.call($('gsModalText').querySelectorAll('tr[data-fila]'), function (tr) {
        tr.hidden = !visible(tr.dataset.esp);
        var o = {}; COLS_HL.concat(COLS_RED).forEach(function (c) { o[c[0]] = valor(tr, c[0]); });
        if (!tr.hidden) { nv++; COLS_HL.concat(COLS_RED).forEach(function (c) { peu[c[0]] = (peu[c[0]] || 0) + numero(o[c[0]]); }); }
        var a = sumaHL(o, COLS_HL), t = sumaHL(o, COLS_HL.concat(COLS_RED)), mx = maxJornada(tr.dataset.j);
        tr.querySelector('[data-t="a"]').textContent = a === '' ? '' : fmtH(a);
        var ct = tr.querySelector('[data-t="t"]'); ct.innerHTML = t === '' ? '' : esc(fmtH(t)) + (mx && Math.abs(t - mx) > 0.01 ? ' <span class="gs-avis-ret" title="No coincideix amb les ' + mx + ' h de la jornada ' + esc(tr.dataset.j) + '">⚠</span>' : '');
        tots[tr.dataset.esp] = (tots[tr.dataset.esp] || 0) + (a === '' ? 0 : a);
        if (!tr.hidden) { peu._a += a === '' ? 0 : a; peu._t += t === '' ? 0 : t; }
      });
      [].forEach.call($('gsModalText').querySelectorAll('[data-tot]'), function (s) { s.textContent = fmtH(tots[s.dataset.tot] || 0); });
      [].forEach.call($('gsModalText').querySelectorAll('[data-peu]'), function (c) { c.textContent = fmtH(peu[c.dataset.peu] || 0); });
      $('gsHlN').textContent = '(' + nv + ' docents)';
    };
    $('gsModalText').addEventListener('input', recalcula);
    // PAS 44: línies verticals entre lectives amb alumnat, reduccions i total; el selector d'especialitat només amb «Especialitat»
    var sep = function (tr, ix) { ix.forEach(function (i) { if (tr.cells[i]) tr.cells[i].classList.add('gs-hl-sep'); }); };
    [].forEach.call($('gsModalText').querySelectorAll('tr[data-fila]'), function (tr) { sep(tr, [2, 3 + COLS_HL.length, 3 + COLS_HL.length + COLS_RED.length]); });
    sep($('gsModalText').querySelector('.gs-hl thead tr:nth-child(2)'), [0, COLS_HL.length + 1]);
    sep($('gsModalText').querySelector('.gs-hl tfoot tr'), [1, 2 + COLS_HL.length, 2 + COLS_HL.length + COLS_RED.length]);
    var modeEsp = function () { var on = $('gsHlMode').value === 'esp'; $('gsHlEspL').style.display = on ? '' : 'none'; $('gsHlEsp').disabled = !on; };
    modeEsp();
    $('gsHlMode').addEventListener('change', function () { modeEsp(); recalcula(); });
    $('gsHlEsp').addEventListener('change', recalcula); recalcula();
    $('gsHlPdf').addEventListener('click', function () { pdfHoresLectives(valor); });
  }
  // PAS 44 · Grups-classe de cada nivell (aquest curs): els fa servir «Grups-classe» de les matèries i «Genera els grups»
  function grupsClasseNivells() {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    var GN = S.d.grups_nivell || {}, ed = potEditar(), niv = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'];
    var lletres = function (n) { return (GN[n] || []).map(function (g) { return g.slice(n.length).trim(); }).join(', '); };
    pregunta('Grups-classe de cada nivell', '<p class="gs-ajuda">Lletres dels grups-classe de cada nivell aquest curs, separades per comes (sense GR ni UEC). Les fa servir la columna <strong>Grups-classe</strong> de les matèries (buit = tots aquests) i <strong>Genera els grups</strong>. Els grups ja generats no canvien de nom.</p>' +
      '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><tbody>' + niv.map(function (n) { return '<tr><th>' + n + '</th><td>' + (ed ? '<input type="text" data-niv="' + n + '" value="' + esc(lletres(n)) + '" style="width:100%">' : esc(lletres(n))) + '</td></tr>'; }).join('') + '</tbody></table><p class="prog-avis" id="gsClErr" hidden></p>',
      ed ? [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa', valor: 1, abans: function () {
        var o = {}, buit = null; [].forEach.call($('gsModalText').querySelectorAll('input[data-niv]'), function (i) { o[i.dataset.niv] = i.value; if (!/[A-Za-z0-9]/.test(i.value)) buit = i.dataset.niv; });
        if (buit) { $('gsClErr').textContent = 'Cal almenys un grup-classe a ' + buit + '.'; $('gsClErr').hidden = false; return false; }
        grupsClasseNivells.o = o;
      } }] : [{ t: 'Tanca', valor: 0 }], false).then(function (v) {
      if (!v) return;
      api('curriculum_classes_desa', { grups: grupsClasseNivells.o }, 'Desant els grups-classe…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        S.d.grups_nivell = r.grups_nivell; Object.keys(S.cache || {}).forEach(function (k) { if (/^curriculum/.test(k) && S.cache[k] && S.cache[k] !== S.d) S.cache[k].grups_nivell = r.grups_nivell; });
        if (S.taula) S.taula.getRows().forEach(function (rw) { rw.reformat(); });
        toast('Grups-classe desats.');
      });
    });
  }
  // PAS 44 · Separa grups-classe d'una matèria en una fila nova (Grups i distribució)
  function separaMateria(row) {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    var d = row.getData(), gs = grupsMat(d);
    if (gs.length < 2) return toast('Aquesta fila només té un grup: no es pot separar.', true);
    pregunta('Separa grups · ' + d.materia + ' · ' + d.nivell, '<p class="gs-ajuda">Els grups que marqueu passen a una <strong>fila nova</strong> d’aquesta matèria (amb les mateixes hores, especialitat i docents); aquesta fila es queda amb la resta. Després cada fila pot tenir una altra especialitat o un altre nombre de docents. Recordeu tornar a <strong>generar els grups</strong>.</p>' +
      '<div class="gs-form-fila" id="gsSepG">' + gs.map(function (g, i) { return '<label class="gs-check"><input type="checkbox" value="' + i + '"> ' + esc(g.nom) + (g.lletres.length > 1 ? ' <span class="gs-gris">(' + esc(g.lletres.join('+')) + ')</span>' : '') + '</label>'; }).join('') + '</div><p class="prog-avis" id="gsSepErr" hidden></p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Separa', valor: 1, abans: function () {
        var g = [].filter.call($('gsSepG').querySelectorAll('input'), function (i) { return i.checked; }).map(function (i) { return Number(i.value); });
        if (!g.length || g.length === gs.length) { $('gsSepErr').textContent = 'Marqueu almenys un grup i deixeu-ne algun a la fila actual.'; $('gsSepErr').hidden = false; return false; }
        separaMateria.v = { id: d.id, grups: g };
      } }], false).then(function (v) {
      if (!v) return;
      api('curriculum_separa', separaMateria.v, 'Separant…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        row.update(copia(r.fila)); S.d.files = S.d.files.map(function (f) { return f.id === r.fila.id ? copia(r.fila) : f; });
        S.d.files.push(copia(r.nova)); S.taula.addRow(copia(r.nova), false, row).then(function () { aplicaFiltre(); S.taula.getRows().forEach(function (rw) { rw.reformat(); }); });
        if (r.versio) S.d.versio = r.versio;
        delete S.cache.curriculum_grups;
        toast('Separat: «' + r.fila.grups_classe + '» | «' + r.nova.grups_classe + '». Torneu a generar els grups.');
      });
    });
  }
  // PAS 43 · PDF del que es veu al diàleg d'hores lectives (amb els valors que hi ha escrits, encara que no s'hagin desat)
  function pdfHoresLectives(valor) {
    var modeEsp = $('gsHlMode').value === 'esp', titolEsp = modeEsp ? $('gsHlEsp').value : 'Tot el professorat';
    var files = [].filter.call($('gsModalText').querySelectorAll('tr[data-fila], tr.gs-informe__seccio'), function (tr) { return !tr.hidden; });
    var cols = COLS_HL.concat(COLS_RED), body = [], peu = {};
    files.forEach(function (tr) {
      if (tr.classList.contains('gs-informe__seccio')) { body.push([{ content: tr.textContent.trim(), colSpan: cols.length + 4, styles: { fillColor: [236, 234, 253], textColor: [28, 12, 188], fontStyle: 'bold' } }]); return; }
      var o = {}; cols.forEach(function (c) { o[c[0]] = valor(tr, c[0]); peu[c[0]] = (peu[c[0]] || 0) + numero(o[c[0]]); });
      var a = sumaHL(o, COLS_HL), t = sumaHL(o, cols), mx = maxJornada(tr.dataset.j);
      peu._a = (peu._a || 0) + (a === '' ? 0 : a); peu._t = (peu._t || 0) + (t === '' ? 0 : t);
      body.push([tr.cells[0].innerText.replace(/\n+/g, ' - '), String(tr.dataset.j || '-').replace('⅔', '2/3')].concat(COLS_HL.map(function (c) { return String(o[c[0]] || '').replace('.', ','); }), [a === '' ? '' : fmtH(a)],
        COLS_RED.map(function (c) { return String(o[c[0]] || '').replace('.', ','); }), [t === '' ? '' : fmtH(t) + (mx && Math.abs(t - mx) > 0.01 ? ' (!)' : '')]));
    });
    body.push([{ content: 'Total', colSpan: 2, styles: { fontStyle: 'bold' } }].concat(COLS_HL.map(function (c) { return fmtH(peu[c[0]] || 0); }), [fmtH(peu._a || 0)], COLS_RED.map(function (c) { return fmtH(peu[c[0]] || 0); }), [fmtH(peu._t || 0)]).map(function (x) { return typeof x === 'string' ? { content: x, styles: { fontStyle: 'bold' } } : x; }));
    var crida = logoPdf().then(function (logo) {
      var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10, data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      var peuPag = function () { capPdf(doc, logo, ('Hores lectives · ' + titolEsp).toUpperCase() + ' · Institut Joan Miró', data + ' · (!) = el total no coincideix amb la jornada (sencera 18, 2/3 12, mitja 9)', M, W); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120); doc.text('Pàgina ' + doc.internal.getNumberOfPages(), W - M, H - 6, { align: 'right' }); };
      var cs = {}; for (var j = 2; j < cols.length + 4; j++) cs[j] = { halign: 'center', cellWidth: 15 };
      doc.autoTable({ head: [['Professor/a', 'Jornada'].concat(COLS_HL.map(function (c) { return c[1]; }), ['Alumnat'], COLS_RED.map(function (c) { return c[1]; }), ['Total'])], body: body, startY: Y_TAULA,
        margin: { top: Y_TAULA, left: M, right: M, bottom: 12 }, styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.2, lineColor: [225, 229, 238], lineWidth: 0.1 },
        headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold', halign: 'center' }, columnStyles: cs, didDrawPage: peuPag,
        didParseCell: function (h) { if (h.section === 'body' && (h.column.index === COLS_HL.length + 2 || h.column.index === cols.length + 3)) h.cell.styles.fontStyle = 'bold'; if (h.section === 'body' && /\(!\)/.test(String(h.cell.raw))) h.cell.styles.textColor = [200, 40, 40]; } });
      doc.save('hores-lectives-' + (modeEsp ? titolEsp.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') : 'tot') + '.pdf');
    });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  // PAS 47 · Esquema «Balanç i transferències»: una caixa per especialitat amb el balanç d'hores (professorat − a impartir;
  // l'ideal és 0) i fletxes de l'especialitat de la matèria a l'especialitat que la imparteix amb les hores transferides.
  function dadesBalanc() {
    var files = S.d.files.map(function (f) { var m = materiaDe(f) || {}; return { nivell: f.nivell, materia: f.materia, de: m.especialitat || '', a: f.especialitat || '', hores: numero(f.hores) }; });
    var esps = {}; files.forEach(function (f) { if (f.de) esps[f.de] = 1; if (f.a) esps[f.a] = 1; }); (S.d.professorat_hores || []).forEach(function (p) { if (p.especialitat) esps[p.especialitat] = 1; });
    var trans = {}; files.forEach(function (f) { if (!f.de || !f.a || f.de === f.a) return; var k = f.de + '→' + f.a; var t = trans[k] = trans[k] || { de: f.de, a: f.a, hores: 0, det: {} }; t.hores += f.hores; var d = f.nivell + ' ' + f.materia; t.det[d] = (t.det[d] || 0) + f.hores; });
    var llista = Object.keys(esps).sort(function (a, b) { return a.localeCompare(b, 'ca'); }).map(function (e) { var D = dadesEspecialitat(e); return { e: e, balanc: D.balanc, tE: D.tE, tP: D.tP, tC: D.tC, tA: D.tA }; });
    return { esps: llista, trans: Object.keys(trans).map(function (k) { return trans[k]; }) };
  }
  function svgBalanc(B, nomesTrans) {
    var amb = {}; B.trans.forEach(function (t) { amb[t.de] = amb[t.a] = 1; });
    var es = B.esps.filter(function (x) { return !nomesTrans || amb[x.e]; });
    var n = es.length, bw = 168, bh = 58, R = Math.max(230, n * 30), W = 2 * R + bw + 80, H = 2 * R + bh + 80, cx = W / 2, cy = H / 2, pos = {};
    es.forEach(function (x, i) { var a = -Math.PI / 2 + 2 * Math.PI * i / Math.max(1, n); pos[x.e] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
    var color = function (b) { return Math.abs(b) < 0.01 ? ['#E3F3EA', '#0F9D58'] : b < 0 ? ['#FDE8E8', '#C62828'] : ['#ECEAFD', '#1C0CBC']; };
    var vora = function (p, q) { // punt de la vora de la caixa p en direcció a q
      var dx = q.x - p.x, dy = q.y - p.y, sx = (bw / 2 + 6) / Math.abs(dx || 1e-6), sy = (bh / 2 + 6) / Math.abs(dy || 1e-6), s = Math.min(sx, sy); return { x: p.x + dx * s, y: p.y + dy * s };
    };
    var fl = B.trans.filter(function (t) { return pos[t.de] && pos[t.a]; }).map(function (t) {
      var p = vora(pos[t.de], pos[t.a]), q = vora(pos[t.a], pos[t.de]), mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, dx = q.x - p.x, dy = q.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      var ox = -dy / l * 26, oy = dx / l * 26, kx = mx + ox, ky = my + oy, lx = (p.x + 2 * kx + q.x) / 4, ly = (p.y + 2 * ky + q.y) / 4;
      var tip = t.de + ' → ' + t.a + ': ' + fmtH(t.hores) + ' h\n' + Object.keys(t.det).map(function (d) { return '· ' + d + ': ' + fmtH(t.det[d]) + ' h'; }).join('\n');
      return '<g class="gs-bal__fl"><title>' + esc(tip) + '</title><path d="M' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' Q' + kx.toFixed(1) + ',' + ky.toFixed(1) + ' ' + q.x.toFixed(1) + ',' + q.y.toFixed(1) + '" fill="none" stroke="#E8600C" stroke-width="' + Math.min(6, 1.5 + t.hores / 4).toFixed(1) + '" marker-end="url(#gsBalPunta)" opacity=".85"/>' +
        '<rect x="' + (lx - 22).toFixed(1) + '" y="' + (ly - 10).toFixed(1) + '" width="44" height="20" rx="10" fill="#fff" stroke="#E8600C"/><text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#B54700">' + esc(fmtH(t.hores)) + ' h</text></g>';
    }).join('');
    var caixes = es.map(function (x) {
      var p = pos[x.e], c = color(x.balanc), nom = x.e.length > 22 ? x.e.slice(0, 21) + '…' : x.e;
      return '<g><title>' + esc(x.e + '\nHores de l’especialitat: ' + fmtH(x.tE) + '\n− cedides: ' + fmtH(x.tC) + '\n+ assignades d’altres: ' + fmtH(x.tA) + '\nProfessorat: ' + fmtH(x.tP) + '\nBalanç: ' + fmtH(x.balanc)) + '</title>' +
        '<rect x="' + (p.x - bw / 2).toFixed(1) + '" y="' + (p.y - bh / 2).toFixed(1) + '" width="' + bw + '" height="' + bh + '" rx="10" fill="' + c[0] + '" stroke="' + c[1] + '" stroke-width="2"/>' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 6).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="600" fill="#1E1E2A">' + esc(nom) + '</text>' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 17).toFixed(1) + '" text-anchor="middle" font-size="16" font-weight="800" fill="' + c[1] + '">' + (x.balanc > 0 ? '+' : '') + esc(fmtH(x.balanc)) + ' h</text></g>';
    }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0) + '" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '" font-family="Montserrat, Helvetica, Arial, sans-serif"><defs><marker id="gsBalPunta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#E8600C"/></marker></defs>' +
      '<rect width="100%" height="100%" fill="#fff"/>' + fl + caixes + '</svg>';
  }
  function esquemaBalanc() {
    if (S.modul.id !== 'curriculum_grups') return;
    if (!S.d.files.length) return toast('No hi ha assignacions: primer genereu els grups.', true);
    var B = dadesBalanc();
    pregunta('Balanç i transferències', '<p class="gs-ajuda">Cada caixa és una especialitat amb el seu <strong>balanç</strong> d’hores (hores lectives del professorat − hores a impartir): <span class="gs-bal__l gs-bal__l--0">0 = quadra</span> <span class="gs-bal__l gs-bal__l--n">negatiu = falten hores</span> <span class="gs-bal__l gs-bal__l--p">positiu = sobren</span>. Cada <strong>fletxa</strong> va de l’especialitat de la matèria a la que la imparteix, amb les hores transferides (passeu el ratolí per sobre per veure les matèries).</p>' +
      '<div class="gs-form-fila"><label class="gs-check"><input type="checkbox" id="gsBalTrans" checked> Només les especialitats amb transferències</label><span class="gs-gris">' + B.trans.length + ' transferències · ' + B.esps.length + ' especialitats</span></div><div class="gs-bal" id="gsBal"></div>',
      [{ t: 'PDF', valor: 0, tipus: 'ghost', abans: function () { pdfBalanc(B, $('gsBalTrans').checked); return false; } }, { t: 'Tanca', valor: 1 }], false);
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample', 'gs-modal--hl');
    var pinta = function () { $('gsBal').innerHTML = svgBalanc(B, $('gsBalTrans').checked); };
    $('gsBalTrans').addEventListener('change', pinta); pinta();
  }
  function pdfBalanc(B, nomesTrans) {
    var svg = svgBalanc(B, nomesTrans), m = /width="(\d+)" height="(\d+)"/.exec(svg), w = Number(m[1]), h = Number(m[2]);
    var img = new Image(), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    var crida = new Promise(function (ok, ko) { img.onload = ok; img.onerror = ko; img.src = url; }).then(function () {
      var c = document.createElement('canvas'), k = 2; c.width = w * k; c.height = h * k; var x = c.getContext('2d'); x.scale(k, k); x.drawImage(img, 0, 0);
      return logoPdf().then(function (logo) {
        var doc = new window.jspdf.jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
        var PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight(), M = 10, data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        capPdf(doc, logo, 'CURRÍCULUM · BALANÇ I TRANSFERÈNCIES · Institut Joan Miró', data + ' · Balanç = hores del professorat - hores a impartir (0 = quadra)', M, PW);
        var aw = PW - 2 * M, ah = PH - Y_TAULA - 12, s = Math.min(aw / w, ah / h);
        doc.addImage(c.toDataURL('image/png'), 'PNG', M + (aw - w * s) / 2, Y_TAULA, w * s, h * s);
        doc.addPage();
        capPdf(doc, logo, 'CURRÍCULUM · TRANSFERÈNCIES D’HORES · Institut Joan Miró', data, M, PW);
        doc.autoTable({ head: [['De (especialitat de la matèria)', 'A (especialitat que la imparteix)', 'Hores', 'Matèries']], body: B.trans.sort(function (a, b) { return a.de.localeCompare(b.de, 'ca') || a.a.localeCompare(b.a, 'ca'); }).map(function (t) { return [t.de, t.a, fmtH(t.hores), Object.keys(t.det).map(function (d) { return d + ' (' + fmtH(t.det[d]) + ' h)'; }).join('; ')]; }),
          startY: Y_TAULA, margin: { left: M, right: M }, styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4 }, headStyles: { fillColor: [28, 12, 188], textColor: 255 }, columnStyles: { 2: { halign: 'center', cellWidth: 16 } } });
        doc.autoTable({ head: [['Especialitat', 'Hores especialitat', '- Cedides', '+ Assignades', 'Professorat', 'Balanç']], body: B.esps.map(function (x) { return [x.e, fmtH(x.tE), fmtH(x.tC), fmtH(x.tA), fmtH(x.tP), fmtH(x.balanc)]; }),
          startY: doc.lastAutoTable.finalY + 6, margin: { left: M, right: M }, styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4 }, headStyles: { fillColor: [28, 12, 188], textColor: 255 }, columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center', fontStyle: 'bold' } } });
        doc.save('balanc-transferencies-' + new Date().toISOString().slice(0, 10) + '.pdf');
      });
    });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  // PAS 48 · La direcció passa la desiderata a les assignacions: cada grup rep el professor/a, per ordre de grup
  function aplicaDesiderata() {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    api('curriculum_aplica_desiderata', { prova: true, sobreescriu: true }, 'Comprovant la desiderata…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      api('curriculum_aplica_desiderata', { prova: true }, '').then(function (r0) {
        if (!r.posats && !r.canviats) return toast('Les assignacions ja tenen el professorat de la desiderata (o encara no n’hi ha cap de desada).');
        var Bq = r.bloqueig || {};
        pregunta('Aplica la desiderata', (Bq.bloquejada ? '<p class="gs-des__estat is-bloc">🔒 La desiderata està <strong>bloquejada</strong>: els caps ja no la poden canviar.</p>' : '<p class="gs-des__estat is-avis">⚠ La desiderata <strong>no està bloquejada</strong>' + (Bq.tancament ? ' (tancament: ' + esc(dataVista(Bq.tancament)) + ')' : '') + ': els caps encara la poden canviar.</p>') + '<p>La desiderata desada de cada departament/àmbit diu quants grups fa cada docent; aquí es posa el <strong>professor/a de cada grup</strong> (per ordre de grup: 1r ESO A, B…). Després es pot canviar a mà a la columna Professor/a.</p><ul>' +
          '<li>Grups sense professor/a que es poden omplir: <strong>' + r0.posats + '</strong></li><li>Grups que ja tenen un altre professor/a: <strong>' + r.canviats + '</strong></li></ul>' +
          (r.sobren.length ? '<p class="prog-avis">Desiderates amb més grups dels que hi ha (no es posen): ' + esc(r.sobren.join('; ')) + '</p>' : '') +
          '<label class="gs-check"><input type="checkbox" id="gsApSob"> Substitueix també els que ja tenen professor/a</label>',
          [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Aplica', valor: 1, abans: function () { aplicaDesiderata.s = $('gsApSob').checked; } }], false).then(function (v) {
          if (!v) return;
          api('curriculum_aplica_desiderata', { sobreescriu: aplicaDesiderata.s }, 'Aplicant…').then(function (r2) {
            if (!r2.ok) return toast(text(r2.error), true);
            delete S.cache.curriculum_grups; toast('Desiderata aplicada: ' + r2.posats + ' grups omplerts' + (r2.canviats ? ', ' + r2.canviats + ' canviats' : '') + '.');
            vistaCurriculum(true);
            setTimeout(function () { comprovaDesiderata(true); }, 600);
          });
        });
      });
    });
  }
  // PAS 53 · Comprova que les assignacions (amb els canvis fets a mà) són coherents amb la desiderata: per a cada assignació i
  // docent, els grups de la desiderata enfront dels assignats; docents fora de la desiderata o que ja no són en actiu
  function comprovaDesiderata(silenciosSiOk) {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    api('curriculum_comprova_desiderata', {}, 'Comprovant la desiderata…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      if (!r.incoherencies.length && silenciosSiOk) return;
      var T = { falta: 'Falten grups', fora: 'No és a la desiderata', diferent: 'Grups diferents', no_actiu: 'Docent no en actiu' };
      var B = r.bloqueig || {};
      pregunta('Comprova la desiderata', (B.bloquejada ? '' : '<p class="gs-des__estat is-avis">⚠ La desiderata no està bloquejada: els caps encara la poden canviar.</p>') +
        '<p><b>' + r.correctes + '</b> assignacions coincideixen amb la desiderata' + (r.sense_desiderata ? ' · <b>' + r.sense_desiderata + '</b> sense desiderata desada' : '') + '.</p>' +
        (r.incoherencies.length ? '<p class="prog-avis">' + r.incoherencies.length + ' incoherències:</p><div class="gs-comprova"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Assignació</th><th>Docent</th><th class="gs-cen">Desiderata</th><th class="gs-cen">Assignats</th><th>Què passa</th></tr></thead><tbody>' +
          r.incoherencies.map(function (x) { return '<tr><td>' + esc(x.assignacio) + '<br><small class="gs-gris">' + esc(x.especialitat) + '</small></td><td>' + esc(x.docent) + '</td><td class="gs-cen">' + x.desiderata + '</td><td class="gs-cen">' + x.assignats + '</td><td>' + esc(T[x.tipus] || x.tipus) + '</td></tr>'; }).join('') + '</tbody></table></div>'
          : r.correctes ? '<p class="is-ok">✓ Les assignacions coincideixen amb la desiderata.</p>' : '<p class="gs-gris">Encara no hi ha cap desiderata desada per comparar.</p>'),
        [{ t: 'Tanca', valor: 0 }], false);
    });
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
    // PAS 43: columnes numèriques estretes i centrades (abans quedaven massa a la dreta)
    var taula = function (titol, ll, total) {
      return '<p class="gs-amon__tit">' + esc(titol) + ' · ' + fmtH(total) + ' h</p>' + (ll.length ? '<div class="gs-informe"><table class="gs-form-taula gs-informe__taula gs-esp-taula"><colgroup><col class="gs-esp-c-niv"><col><col class="gs-esp-c-num"><col class="gs-esp-c-num"><col class="gs-esp-c-num"><col class="gs-esp-c-num"><col class="gs-esp-c-esp"><col class="gs-esp-c-esp"></colgroup><thead><tr>' + CAP_ESP.map(function (c, j) { return '<th' + (j >= 2 && j <= 5 ? ' class="gs-cen"' : '') + '>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
        ll.map(function (x) { return '<tr>' + x.cel.map(function (c, j) { return '<td' + (j >= 2 && j <= 5 ? ' class="gs-cen"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '<p class="gs-gris">Cap.</p>');
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
        var peu = function () { capPdf(doc, logo, ('Currículum · ' + e).toUpperCase() + ' · Institut Joan Miró', data + ' · Document per al cap de departament/àmbit', M, W); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120); doc.text('Pàgina ' + doc.internal.getNumberOfPages(), W - M, H - 6, { align: 'right' }); };
        var titol = function (t) { if (y > H - 30) { doc.addPage(); y = Y_TAULA; } doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(28, 12, 188); doc.text(t, M, y + 4); y += 6; };
        var taula = function (head, body, opc) { doc.autoTable(Object.assign({ head: [head], body: body, startY: y, margin: { top: Y_TAULA, left: M, right: M, bottom: 12 }, styles: est, headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 248, 252] }, didDrawPage: peu }, opc || {})); y = doc.lastAutoTable.finalY + 5; };
        var cols = { 0: { cellWidth: 17 }, 2: { halign: 'center', cellWidth: 14 }, 3: { halign: 'center', cellWidth: 16 }, 4: { halign: 'center', cellWidth: 16 }, 5: { halign: 'center', cellWidth: 14 }, 6: { cellWidth: 32 }, 7: { cellWidth: 32 } };
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
  // PAS 45: grups d'una matèria segons «Grups-classe» (comes = grups separats, + = units; buit = un per grup-classe)
  var grupsMat = function (f) {
    var L = (((S.d && S.d.grups_nivell) || {})[f.nivell] || []).map(function (g) { return g.slice(f.nivell.length).trim(); });
    var t = String(f.grups_classe || '').toUpperCase().split(String(f.nivell).toUpperCase()).join(' ').trim();
    var gs = t ? t.split(/[,;]+/).map(function (x) { return x.split(/[+\s]+/).filter(function (y) { return L.indexOf(y) >= 0; }); }).filter(function (x) { return x.length; }) : [];
    if (!gs.length) gs = L.map(function (x) { return [x]; });
    var noms = gs.map(function (x) { return f.nivell + ' ' + (x.length === 1 ? x[0] : x.join('')); }), cops = {}, vist = {};
    noms.forEach(function (n) { cops[n] = (cops[n] || 0) + 1; });
    return gs.map(function (x, i) { var n = noms[i]; vist[n] = (vist[n] || 0) + 1; return { lletres: x, nom: cops[n] > 1 ? n + ' ' + vist[n] : n }; });
  };
  var grupsDe = function (f) { return grupsMat(f).length; };
  var numero = function (x) { var n = Number(String(x == null ? '' : x).replace(',', '.')); return isNaN(n) ? 0 : n; };
  var fmtH = function (n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); };
  function pintaEinesCurriculum() {
    var ed = potEditar(), grups = S.modul.id === 'curriculum_grups', dist = !grups && S.vistaCur === 'distribucio';
    var nivells = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'];
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist">' +
        '<button type="button" role="tab" data-accio="cur-materies" aria-selected="' + (!grups && !dist) + '">Matèries</button>' +
        '<button type="button" role="tab" data-accio="cur-distribucio" aria-selected="' + dist + '">Grups i distribució</button>' +
        '<button type="button" role="tab" data-accio="cur-grups" aria-selected="' + grups + '">Assignacions</button></div>' +
      '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="cur-hores" title="Hores lectives de classe de cada docent (fitxa del professorat)">Hores lectives classe</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="cur-classes" title="Grups-classe de cada nivell aquest curs">Grups-classe</button>' +
      '<p class="gs-ajuda" style="flex:1 1 100%;margin:0 0 4px">' + (grups ?
        'Cada grup de cada matèria i l’especialitat que l’imparteix (per defecte, la de la matèria; es pot canviar). Amb les <strong>tisores</strong> es reparteixen les hores d’un grup entre especialitats (p. ex. 1 h Anglès + 1 h Alemany + 1 h Matemàtiques). ⚠ = les parts no sumen les hores de la matèria. El professor/a és opcional.' :
        dist ? '<strong>Grups-classe</strong>: comes = grups separats (A, B → 2 grups); + = units (A+B → 1 grup); buit = un grup per cada grup-classe del nivell. Es pot repetir (A+B+C+D, A+B+C+D = dues optatives barrejades). <strong>Docents a l’aula</strong>: 2 = codocència (dos docents alhora: es dupliquen les hores de professorat). Després, <strong>Genera els grups</strong>.' :
        'Matèries de cada nivell. <strong>Hores A</strong>: amb el grup sencer; <strong>hores B</strong>: amb mig grup (desdoblament). Hores de l’alumne = A + B/2. Els grups i la distribució es defineixen a la pestanya següent.') + '</p>' +
      '<span class="gs-nivells" role="group" aria-label="Nivell que es mostra">' + [''].concat(nivells).map(function (n) {
        return '<button type="button" class="gs-nivells__btn' + ((S.nivellCurr || '') === n ? ' is-actiu' : '') + '" data-accio="cur-nivell" data-nivell="' + esc(n) + '">' + (n || 'Tots') + '</button>'; }).join('') + '</span>' +
      '<span class="gs-compte" id="gsCompte"></span>' +
      (ed ? '<span class="gs-seleccio" id="gsSeleccio" hidden><span id="gsSelN"></span> <button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="aplica-seleccio">Aplica a la selecció…</button> <button type="button" class="gs-enllac" data-accio="treu-seleccio">Treu la selecció</button></span>' : '') +
      '<span class="gs-espai"></span>' +
      (ed && !grups ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="alta">+ Afegeix matèria</button>' : '') +
      (ed && !grups ? '<button type="button" class="prog-btn" data-accio="cur-genera" title="Crea o actualitza una fila per cada matèria i grup">Genera els grups</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="cur-resum" title="Hores de professorat per especialitat i nivell">Hores per especialitat</button>' +
      (grups && ed ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="cur-aplica-des" title="Posa el professor/a de cada grup segons la desiderata desada dels departaments/àmbits">Aplica la desiderata</button>' : '') +
      (grups ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="cur-comprova-des" title="Compara les assignacions (també els canvis fets a mà) amb la desiderata de cada docent">Comprova la desiderata</button>' : '') +
      (grups ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="cur-balanc" title="Esquema: balanç d’hores de cada especialitat i transferències entre especialitats">Balanç i transferències</button>' : '') +
      (grups ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="cur-especialitat" title="Per al cap de departament/àmbit: hores de l’especialitat, cedides, assignades, professorat i balanç (PDF)">Document per especialitat</button><button type="button" class="prog-btn prog-btn--ghost" data-accio="cur-document" title="Taula per nivell: matèries × grups amb el professorat o l’especialitat (PDF)">Document equips docents</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Visualització camps</button>' +
      (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="camps">Gestió camps</button>' + BOTO_ACTUALITZA : '') +
      '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button></span>';
  }
  function vistaCurriculum(grups, dist) {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    S.vistaCur = dist ? 'distribucio' : 'materies';
    var m = Object.assign({}, S.modul, { id: grups ? 'curriculum_grups' : 'curriculum' });
    obreModul(m);
    $('gsManual').href = '/assets/docs/gestio/manual-curriculum.pdf';
  }
  function generaGrups() {
    if (S.brut) return toast('Primer deseu els canvis de les matèries.', true);
    api('curriculum_genera', { prova: true }, 'Comprovant…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      if (!r.afegides && !r.tretes && !r.actualitzades) return toast('Els grups ja estan al dia amb les matèries.');
      pregunta('Genera els grups', '<p>Es crearà una fila per cada matèria i grup (segons els <strong>Grups-classe</strong> de cada matèria):</p><ul>' +
        '<li>Files noves: <strong>' + r.afegides + '</strong> (amb l’especialitat de la matèria)</li><li>Files actualitzades (nom del grup, matèria, nivell o hores): <strong>' + r.actualitzades + '</strong></li>' +
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
      var h = grups ? numero(f.hores) : (horesA(f) + horesB(f)) * grupsDe(f) * (Math.round(numero(f.docents)) || 1), e = f.especialitat || '(sense especialitat)';
      per[e] = per[e] || {}; per[e][f.nivell] = (per[e][f.nivell] || 0) + h;
    });
    var esp = Object.keys(per).sort(function (a, b) { return a.localeCompare(b, 'ca'); }), usats = niv.filter(function (n) { return esp.some(function (e) { return per[e][n]; }); });
    var tot = function (e) { return usats.reduce(function (s, n) { return s + (per[e][n] || 0); }, 0); };
    var totN = function (n) { return esp.reduce(function (s, e) { return s + (per[e][n] || 0); }, 0); };
    informe('Hores de professorat per especialitat', (grups ? 'Segons els grups (especialitat que imparteix cada matèria i grup)' : 'Segons les matèries: (hores A + hores B) × grups × docents a l’aula') + ' · ' + files.length + ' files' + (S.nivellCurr ? ' · ' + S.nivellCurr : '') + '.',
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

  // ================================================================== PAS 47 · DESIDERATA
  // El cap de departament proposa, per a cada assignació de la seva especialitat (Currículum › Assignacions), quins docents
  // la imparteixen i quants grups fa cadascun (els grups concrets els assigna després la direcció). Comptadors d'hores,
  // observacions pedagògiques, coherència amb les hores lectives de cada docent, PDF, Excel i, per a l'administració, «Anàlisi».
  function carregaDesiderata(esp) {
    api('desiderata_dades', esp ? { especialitat: esp } : {}, 'Carregant la desiderata…').then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = r.error === 'sense_especialitat' ? 'No trobem la vostra especialitat a la fitxa del professorat: la direcció l’hi ha de posar (o us pot obrir la desiderata d’una especialitat).' : textError(r); $('gsAvis').hidden = false; return; }
      S.des = r; S.desDades = JSON.parse(JSON.stringify(r.dades || {})); S.d = { files: [], camps: [], nivell: S.modul.nivell };
      pintaDesiderata();
    });
  }
  // Canvis sense desar (sense la barra de la graella: aquí el botó Desa és a dalt)
  var brutDes = function (b) { S.brut = b; var x = document.querySelector('[data-accio="des-desa"]'); if (x) { x.classList.toggle('is-brut', b); x.textContent = b ? 'Desa *' : 'Desa'; } };
  var desProfs = function () { var P = {}; (S.des.professorat || []).forEach(function (p) { P[p.id] = p; }); return P; };
  function calculsDesiderata() {
    var A = S.des.assignacions, D = S.desDades, P = desProfs(), per = {}, total = 0, fetes = 0, sobre = [];
    A.forEach(function (a) {
      var ll = D[a.clau] || [], g = ll.reduce(function (t, x) { return t + (Number(x.grups) || 0); }, 0);
      total += a.grups * a.hores; fetes += Math.min(g, a.grups) * a.hores; if (g > a.grups) sobre.push(a);
      ll.forEach(function (x) { if (!x.prof || !(Number(x.grups) > 0)) return; per[x.prof] = (per[x.prof] || 0) + x.grups * a.hores; });
    });
    var ids = {}; Object.keys(per).forEach(function (k) { ids[k] = 1; }); (S.des.professorat || []).forEach(function (p) { if (p.especialitat === S.des.especialitat) ids[p.id] = 1; });
    var docents = Object.keys(ids).map(function (id) { var p = P[id] || { nom: id, especialitat: '' }, l = p.hores_lectives === '' || p.hores_lectives == null ? null : numero(p.hores_lectives), as = per[id] || 0;
      return { id: id, nom: p.nom, especialitat: p.especialitat, lectives: l, assignades: as, dif: (l === null ? 0 : l) - as }; })
      .sort(function (a, b) { return (a.especialitat === S.des.especialitat ? 0 : 1) - (b.especialitat === S.des.especialitat ? 0 : 1) || a.nom.localeCompare(b.nom, 'ca'); });
    return { total: total, fetes: fetes, pendents: Math.round((total - fetes) * 100) / 100, sobre: sobre, docents: docents };
  }
  function pintaDesiderata() {
    var R = S.des, B = R.bloqueig || {}, ed = R.obert !== false && (!B.bloquejada || R.admin), C;
    // PAS 53: estat de la desiderata (bloquejada o data de tancament) per als caps i per a l'administració
    var dies = B.tancament ? Math.ceil((new Date(B.tancament + 'T23:59:59') - new Date()) / 86400000) : null;
    var estatDes = B.bloquejada ? '<p class="gs-des__estat is-bloc">🔒 <strong>Desiderata bloquejada</strong>' + (R.admin ? ': els caps només la poden consultar (l’administració la pot editar).' : ': només es pot consultar.') + '</p>'
      : B.tancament ? '<p class="gs-des__estat' + (dies < 0 ? ' is-bloc' : dies <= 3 ? ' is-avis' : '') + '">Data de tancament: <strong>' + esc(dataVista(B.tancament)) + '</strong>' + (dies < 0 ? ' (ja ha passat)' : dies === 0 ? ' (avui)' : ' (queden ' + dies + (dies === 1 ? ' dia' : ' dies') + ')') + '</p>' : '';
    $('gsEines').innerHTML = (R.departament ? '<p class="gs-des__dep">Departament/àmbit: <strong>' + esc(R.departament.nom) + '</strong> <span class="gs-gris">· ' + esc(R.departament.especialitats.join(', ')) + '</span></p>' : '') +
      (R.especialitats.length > 1 ? '<label class="gs-des__esp">Especialitat <select id="gsDesEsp">' + R.especialitats.map(function (e) { return '<option' + (e === R.especialitat ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></label>' : '<p class="gs-des__titol">' + esc(R.especialitat) + '</p>') +
      '<span class="gs-espai"></span><a class="prog-btn prog-btn--ghost" href="/assets/docs/gestio/guia-desiderata.pdf" target="_blank" rel="noopener" title="Guia per als caps de departament/àmbit (PDF)">Guia</a>' +
      (R.admin ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="des-tancament" title="Data de tancament i bloqueig de la desiderata">' + (B.bloquejada ? '🔒 Bloquejada' : 'Tancament') + '</button>' : '') +
      (R.admin ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="des-departaments" title="Departaments/àmbits: especialitats i cap de cadascun">Departaments/àmbits</button><button type="button" class="prog-btn prog-btn--ghost" data-accio="des-analisi" title="Balanç de totes les especialitats">Anàlisi</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="des-xlsx">Excel</button><button type="button" class="prog-btn prog-btn--ghost" data-accio="des-pdf">PDF</button>' +
      (ed ? '<button type="button" class="prog-btn" data-accio="des-desa">Desa</button>' : '') +
      estatDes + '<p class="gs-ajuda" style="flex:1 1 100%;margin:4px 0 0">Per a cada assignació de l’especialitat, indiqueu <strong>quins docents</strong> la faran i <strong>quants grups</strong> fa cadascun (no cal dir quins: els grups-classe concrets els assigna després la direcció). ' + (R.data ? 'Desat el ' + esc(dataVista(R.data.slice(0, 10))) + ' per ' + esc(R.desat_per) + '.' : 'Encara no s’ha desat.') + '</p>';
    var P = desProfs(), opcions = function (sel) {
      var dep = R.departament ? R.departament.especialitats : [R.especialitat];
      var propis = R.professorat.filter(function (p) { return p.especialitat === R.especialitat; }), delDep = R.professorat.filter(function (p) { return p.especialitat !== R.especialitat && dep.indexOf(p.especialitat) >= 0; }), altres = R.professorat.filter(function (p) { return dep.indexOf(p.especialitat) < 0 && p.especialitat !== R.especialitat; });
      var op = function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nom) + (p.especialitat !== R.especialitat ? ' · ' + esc(p.especialitat || '—') : '') + '</option>'; };
      return '<option value="">— Docent —</option><optgroup label="' + esc(R.especialitat) + '">' + propis.map(op).join('') + '</optgroup>' + (delDep.length ? '<optgroup label="Altres especialitats del departament/àmbit">' + delDep.map(op).join('') + '</optgroup>' : '') + '<optgroup label="Altres especialitats">' + altres.map(op).join('') + '</optgroup>';
    };
    var fila = function (a, x, i) { return '<div class="gs-des__doc" data-i="' + i + '"><select data-k="prof"' + (ed ? '' : ' disabled') + '>' + opcions(x.prof) + '</select><input type="number" data-k="grups" min="1" max="' + a.grups + '" step="1" value="' + esc(x.grups || 1) + '"' + (ed ? '' : ' disabled') + ' aria-label="Grups"><span class="gs-gris">grups</span>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu" title="Treu" aria-label="Treu">' + PAPERERA + '</button>' : '') + '</div>'; };
    var html = '<div class="gs-des__compt" id="gsDesCompt"></div>' +
      (R.assignacions.length ? '<table class="gs-form-taula gs-informe__taula gs-des__taula"><thead><tr><th>Nivell</th><th>Matèria</th><th class="gs-cen">h/grup</th><th class="gs-cen">Grups</th><th>Docents (i quants grups fa cadascun)</th><th class="gs-cen">Pendents</th></tr></thead><tbody>' +
        R.assignacions.map(function (a) { var ll = S.desDades[a.clau] || [];
          return '<tr data-clau="' + esc(a.clau) + '"><td>' + esc(a.nivell) + '</td><td>' + esc(a.materia) + '<br><small class="gs-gris">' + esc(a.noms.join(', ')) + '</small></td><td class="gs-cen">' + esc(fmtH(a.hores)) + '</td><td class="gs-cen">' + a.grups + '</td><td><div class="gs-des__docs">' + ll.map(function (x, i) { return fila(a, x, i); }).join('') + '</div>' +
            (ed ? '<button type="button" class="gs-enllac" data-a="afegeix">+ docent</button>' : '') + '</td><td class="gs-cen" data-pend></td></tr>'; }).join('') + '</tbody></table>' : '<p class="prog-avis">Aquesta especialitat no té assignacions: cal generar-les al Currículum (pestanya Assignacions).</p>') +
      '<h3 class="gs-amon__tit">Docents: hores lectives amb alumnat i hores assignades</h3><div id="gsDesDocents"></div>' +
      '<h3 class="gs-amon__tit">Observacions pedagògiques</h3><textarea id="gsDesObs" class="gs-des__obs" rows="5" maxlength="5000"' + (ed ? '' : ' disabled') + ' placeholder="Criteris del departament/àmbit, continuïtat amb els grups, docents que convé que facin un nivell…">' + esc(R.observacions || '') + '</textarea>';
    // Els esdeveniments van a un contenidor intern (es destrueix en tornar a pintar o en canviar de mòdul)
    var t0 = $('gsTaula'); t0.className = 'gs-des'; t0.innerHTML = '<div id="gsDesCos">' + html + '</div>'; var t = $('gsDesCos'); ajustaAlcada();
    var llegeix = function () {
      [].forEach.call(t.querySelectorAll('tr[data-clau]'), function (tr) {
        S.desDades[tr.dataset.clau] = [].map.call(tr.querySelectorAll('.gs-des__doc'), function (d) { return { prof: d.querySelector('[data-k="prof"]').value, grups: Number(d.querySelector('[data-k="grups"]').value) || 0 }; });
      });
    };
    var refresca = function () {
      llegeix(); C = calculsDesiderata();
      $('gsDesCompt').innerHTML = '<span><b>' + fmtH(C.total) + '</b> h a assignar</span><span class="is-ok"><b>' + fmtH(C.fetes) + '</b> h assignades</span><span class="' + (C.pendents > 0 ? 'is-pend' : 'is-ok') + '"><b>' + fmtH(C.pendents) + '</b> h pendents</span>' + (C.sobre.length ? '<span class="is-pend">⚠ ' + C.sobre.length + ' amb més grups dels que hi ha</span>' : '');
      [].forEach.call(t.querySelectorAll('tr[data-clau]'), function (tr) {
        var a = R.assignacions.filter(function (x) { return x.clau === tr.dataset.clau; })[0], g = (S.desDades[a.clau] || []).reduce(function (s, x) { return s + (Number(x.grups) || 0); }, 0), p = a.grups - g;
        var c = tr.querySelector('[data-pend]'); c.textContent = p > 0 ? p + (p === 1 ? ' grup' : ' grups') : p < 0 ? '⚠ ' + (-p) + ' de més' : '✓'; c.className = 'gs-cen ' + (p === 0 ? 'is-ok' : 'is-pend');
      });
      $('gsDesDocents').innerHTML = '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Docent</th><th>Especialitat</th><th class="gs-cen">Lectives alumnat</th><th class="gs-cen">Assignades</th><th class="gs-cen">Diferència</th></tr></thead><tbody>' +
        C.docents.map(function (d) { var av = d.lectives === null ? 'sense hores lectives a la fitxa' : d.dif > 0.01 ? 'li falten ' + fmtH(d.dif) + ' h' : d.dif < -0.01 ? 'té ' + fmtH(-d.dif) + ' h de més' : '';
          return '<tr><td>' + esc(d.nom) + '</td><td>' + esc(d.especialitat) + '</td><td class="gs-cen">' + (d.lectives === null ? '—' : esc(fmtH(d.lectives))) + '</td><td class="gs-cen">' + esc(fmtH(d.assignades)) + '</td><td class="gs-cen ' + (av ? 'is-pend' : 'is-ok') + '">' + (av ? '⚠ ' + esc(av) : '✓') + '</td></tr>'; }).join('') + '</tbody></table>';
      brutDes(true);
    };
    t.addEventListener('input', refresca); t.addEventListener('change', refresca);
    t.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      var tr = b.closest('tr[data-clau]'), a = R.assignacions.filter(function (x) { return x.clau === tr.dataset.clau; })[0];
      if (b.dataset.a === 'afegeix') { var fet = (S.desDades[a.clau] || []).reduce(function (s, x) { return s + (Number(x.grups) || 0); }, 0); var box = tr.querySelector('.gs-des__docs'); box.insertAdjacentHTML('beforeend', fila(a, { prof: '', grups: Math.max(1, a.grups - fet) }, box.children.length)); }
      else if (b.dataset.a === 'treu') b.closest('.gs-des__doc').remove();
      refresca();
    });
    if ($('gsDesEsp')) $('gsDesEsp').addEventListener('change', function () { if (S.brut && !confirm('Hi ha canvis sense desar. Voleu canviar d’especialitat igualment?')) { this.value = R.especialitat; return; } brutDes(false); carregaDesiderata(this.value); });
    refresca(); brutDes(false);
  }
  // PAS 53 · Administració: data de tancament i bloqueig
  function tancamentDesiderata() {
    var B = S.des.bloqueig || {};
    pregunta('Tancament de la desiderata', '<p>Els caps de departament/àmbit veuen la data de tancament. Si la desiderata està <strong>bloquejada</strong>, només la poden consultar (l’administració la pot continuar editant).</p>' +
      '<div class="gs-form-fila"><label>Data de tancament <input type="date" id="gsDesTanc" value="' + esc(B.tancament || '') + '"></label></div><label class="gs-check"><input type="checkbox" id="gsDesBloc"' + (B.bloquejada ? ' checked' : '') + '> Bloquejada (els caps no poden fer canvis)</label>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa', valor: 1, abans: function () { tancamentDesiderata.v = { tancament: $('gsDesTanc').value, bloquejada: $('gsDesBloc').checked }; } }], false).then(function (v) {
      if (!v) return;
      api('desiderata_config', tancamentDesiderata.v, 'Desant…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        S.des.bloqueig = r.bloqueig; pintaDesiderata(); toast(r.bloqueig.bloquejada ? 'Desiderata bloquejada.' : 'Desiderata oberta' + (r.bloqueig.tancament ? ' fins al ' + dataVista(r.bloqueig.tancament) : '') + '.');
      });
    });
  }
  function desaDesiderata() {
    var C = calculsDesiderata(), envia = function () {
      var net = {}; Object.keys(S.desDades).forEach(function (k) { var ll = S.desDades[k].filter(function (x) { return x.prof && x.grups > 0; }); if (ll.length) net[k] = ll; });
      api('desiderata_desa', { especialitat: S.des.especialitat, dades: net, observacions: $('gsDesObs').value }, 'Desant la desiderata…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        S.des.data = r.data; S.des.desat_per = r.desat_per; S.des.dades = r.dades; S.des.observacions = $('gsDesObs').value; brutDes(false);
        toast('Desiderata desada' + (C.pendents > 0 ? ' (queden ' + fmtH(C.pendents) + ' h pendents).' : '.'));
      });
    };
    var falten = [].filter.call(document.querySelectorAll('.gs-des__doc select[data-k="prof"]'), function (s) { return !s.value; }).length;
    if (C.pendents > 0 || C.sobre.length || falten) return pregunta('Desar la desiderata', '<p class="prog-avis">' + [C.pendents > 0 ? 'Queden <strong>' + fmtH(C.pendents) + ' h pendents</strong> d’assignar.' : '', C.sobre.length ? 'Hi ha ' + C.sobre.length + ' assignacions amb més grups dels que hi ha: ' + esc(C.sobre.map(function (a) { return a.nivell + ' ' + a.materia; }).join('; ')) + '.' : '', falten ? falten + ' files sense docent (no es desaran).' : ''].filter(Boolean).join('<br>') + '</p><p>Es pot desar igualment i acabar-la més tard.</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa igualment', valor: 1 }], false).then(function (v) { if (v) envia(); });
    envia();
  }
  // Exportacions (PDF i Excel): el mateix que es veu a la pantalla (comptadors, assignacions amb els docents i els
  // pendents, tots els docents amb l'estat) i una llista de totes les incoherències, i les observacions (PAS 48)
  function filesDesiderata() {
    var P = desProfs(), C = calculsDesiderata(), inc = [];
    var ass = S.des.assignacions.map(function (a) {
      var tots = S.desDades[a.clau] || [], ll = tots.filter(function (x) { return x.prof; }), g = ll.reduce(function (s, x) { return s + (Number(x.grups) || 0); }, 0), d = a.grups - g;
      if (d > 0) inc.push(['Grups pendents', a.nivell + ' ' + a.materia, (d === 1 ? 'Falta 1 grup' : 'Falten ' + d + ' grups') + ' per assignar (' + fmtH(d * a.hores) + ' h)']);
      if (d < 0) inc.push(['Grups de més', a.nivell + ' ' + a.materia, 'S’han posat ' + (-d) + ' grups més dels que hi ha']);
      if (tots.length > ll.length) inc.push(['Fila sense docent', a.nivell + ' ' + a.materia, (tots.length - ll.length) + ' fila(es) sense docent triat']);
      return [a.nivell, a.materia, a.noms.join(', '), fmtH(a.hores), String(a.grups), ll.map(function (x) { return (P[x.prof] || { nom: x.prof }).nom + ' (' + x.grups + ')'; }).join('; '), d > 0 ? d + (d === 1 ? ' grup' : ' grups') : d < 0 ? (-d) + ' de més' : 'cap'];
    });
    var docents = C.docents.map(function (d) {
      var estat = d.lectives === null ? 'Sense hores lectives a la fitxa' : d.dif > 0.01 ? 'Més hores lectives que assignades: li falten ' + fmtH(d.dif) + ' h' : d.dif < -0.01 ? 'Menys hores lectives que assignades: té ' + fmtH(-d.dif) + ' h de més' : 'Quadra';
      if (estat !== 'Quadra') inc.push(['Docent', d.nom + ' (' + (d.especialitat || '—') + ')', estat + ' (lectives ' + (d.lectives === null ? '—' : fmtH(d.lectives)) + ', assignades ' + fmtH(d.assignades) + ')']);
      return [d.nom, d.especialitat, d.lectives === null ? '—' : fmtH(d.lectives), fmtH(d.assignades), d.lectives === null ? '—' : fmtH(d.dif), estat];
    });
    return { C: C, ass: ass, docents: docents, inc: inc, obs: $('gsDesObs') ? $('gsDesObs').value : S.des.observacions || '', dep: S.des.departament };
  }
  var fitxerDes = function (ext) { return 'desiderata-' + S.des.especialitat.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.' + ext; };
  function pdfDesiderata() {
    var F = filesDesiderata(), esp = S.des.especialitat;
    var crida = logoPdf().then(function (logo) {
      var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12, data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      var peu = function () { capPdf(doc, logo, ('Desiderata · ' + esp).toUpperCase() + ' · Institut Joan Miró', (F.dep ? 'Departament/àmbit: ' + F.dep.nom + ' · ' : '') + data + (S.des.data ? ' · desada el ' + dataVista(S.des.data.slice(0, 10)) : ''), M, W); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120); doc.text('Pàgina ' + doc.internal.getNumberOfPages(), W - M, H - 6, { align: 'right' }); };
      var est = { font: 'helvetica', fontSize: 8, cellPadding: 1.4, lineColor: [225, 229, 238], lineWidth: 0.1 }, head = { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold' }, mg = { top: Y_TAULA, left: M, right: M, bottom: 12 };
      var y = Y_TAULA, titol = function (t) { if (y > H - 30) { doc.addPage(); peu(); y = Y_TAULA; } doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(28, 12, 188); doc.text(t, M, y + 4); y += 6; };
      titol('Resum');
      doc.autoTable({ head: [['Hores a assignar', 'Hores assignades', 'Hores pendents', 'Incoherències']], body: [[fmtH(F.C.total), fmtH(F.C.fetes), fmtH(F.C.pendents), String(F.inc.length)]], startY: y, margin: mg, styles: Object.assign({}, est, { halign: 'center', fontSize: 10 }), headStyles: head, tableWidth: 150, didDrawPage: peu });
      y = doc.lastAutoTable.finalY + 6; titol('Assignacions');
      doc.autoTable({ head: [['Nivell', 'Matèria', 'Grups', 'h/grup', 'Núm.', 'Docents (grups)', 'Pendents']], body: F.ass, startY: y, margin: mg, styles: est, headStyles: head, didDrawPage: peu,
        columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 46 }, 2: { cellWidth: 52 }, 3: { halign: 'center', cellWidth: 13 }, 4: { halign: 'center', cellWidth: 12 }, 6: { halign: 'center', cellWidth: 22 } },
        didParseCell: function (h) { if (h.section === 'body' && h.column.index === 6 && h.cell.raw !== 'cap') { h.cell.styles.textColor = [198, 40, 40]; h.cell.styles.fontStyle = 'bold'; } } });
      y = doc.lastAutoTable.finalY + 6; titol('Docents: hores lectives amb alumnat i hores assignades');
      doc.autoTable({ head: [['Docent', 'Especialitat', 'Lectives alumnat', 'Assignades', 'Diferència', 'Estat']], body: F.docents, startY: y, margin: mg, styles: est, headStyles: head, didDrawPage: peu,
        columnStyles: { 2: { halign: 'center', cellWidth: 24 }, 3: { halign: 'center', cellWidth: 22 }, 4: { halign: 'center', cellWidth: 20 } },
        didParseCell: function (h) { if (h.section === 'body' && h.column.index === 5 && h.cell.raw !== 'Quadra') { h.cell.styles.textColor = [198, 40, 40]; h.cell.styles.fontStyle = 'bold'; } } });
      y = doc.lastAutoTable.finalY + 6; titol('Incoherències (' + F.inc.length + ')');
      doc.autoTable({ head: [['Tipus', 'On', 'Detall']], body: F.inc.length ? F.inc : [[{ content: 'Cap: tot quadra.', colSpan: 3 }]], startY: y, margin: mg, styles: est, headStyles: { fillColor: [198, 40, 40], textColor: 255, fontStyle: 'bold' }, didDrawPage: peu, columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold' } } });
      y = doc.lastAutoTable.finalY + 6;
      doc.autoTable({ head: [['Observacions pedagògiques']], body: [[F.obs || '—']], startY: y, margin: mg, styles: est, headStyles: head, didDrawPage: peu });
      doc.save(fitxerDes('pdf'));
    });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  function xlsxDesiderata() {
    var F = filesDesiderata(), esp = S.des.especialitat;
    carregaScript(LIBS.xlsx).then(function () {
      var wb = XLSX.utils.book_new(), full = function (aoa, nom, amples) { var sh = XLSX.utils.aoa_to_sheet(aoa); if (amples) sh['!cols'] = amples.map(function (w) { return { wch: w }; }); XLSX.utils.book_append_sheet(wb, sh, nom); };
      full([['Desiderata', esp], ['Departament/àmbit', F.dep ? F.dep.nom : ''], ['Desada', S.des.data || 'no'], [], ['Hores a assignar', F.C.total], ['Hores assignades', F.C.fetes], ['Hores pendents', F.C.pendents], ['Incoherències', F.inc.length]], 'Resum', [22, 40]);
      full([['Nivell', 'Matèria', 'Grups', 'h/grup', 'Núm. grups', 'Docents (grups)', 'Pendents']].concat(F.ass), 'Assignacions', [10, 34, 40, 8, 10, 50, 12]);
      full([['Docent', 'Especialitat', 'Lectives alumnat', 'Assignades', 'Diferència', 'Estat']].concat(F.docents), 'Docents', [32, 20, 16, 12, 12, 52]);
      full([['Tipus', 'On', 'Detall']].concat(F.inc.length ? F.inc : [['Cap: tot quadra.']]), 'Incoherències', [20, 40, 70]);
      full([['Observacions pedagògiques'], [F.obs]], 'Observacions', [100]);
      XLSX.writeFile(wb, fitxerDes('xlsx'));
    });
  }
  // PAS 48 · Departaments/àmbits (administració): nom, especialitats i cap. Els caps passen a ser l'equip «Caps de
  // departament/àmbit» i a Desiderata gestionen totes les especialitats del seu departament/àmbit.
  function departamentsDesiderata() {
    api('departaments', {}, 'Carregant els departaments/àmbits…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      var deps = r.departaments.length ? r.departaments : r.proposta;
      var fila = function (d) {
        return '<tr class="gs-dep"><td><input type="text" data-k="nom" value="' + esc(d.nom) + '" placeholder="Nom del departament/àmbit"></td><td><div class="gs-dep__esps">' + r.especialitats.map(function (e) { return '<label class="gs-check"><input type="checkbox" value="' + esc(e) + '"' + (d.especialitats.indexOf(e) >= 0 ? ' checked' : '') + '> ' + esc(e) + '</label>'; }).join('') + '</div></td>' +
          '<td><select data-k="cap"><option value="">— Sense cap —</option>' + r.professorat.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === d.cap ? ' selected' : '') + '>' + esc(p.nom) + ' · ' + esc(p.especialitat || '—') + '</option>'; }).join('') + '</select></td>' +
          '<td><button type="button" class="gs-perill gs-paperera" data-a="treu-dep" title="Treu" aria-label="Treu">' + PAPERERA + '</button></td></tr>';
      };
      pregunta('Departaments/àmbits', '<p class="gs-ajuda">Cada departament/àmbit agrupa una o més <strong>especialitats</strong> i té un <strong>cap</strong> (un docent, d’una de les especialitats o no). En desar, els caps passen a ser l’equip «Caps de departament/àmbit» (accés a Desiderata) i cada cap hi gestiona <strong>totes les especialitats</strong> del seu departament/àmbit. Una especialitat només pot ser d’un departament/àmbit.' + (r.departaments.length ? '' : ' <strong>Encara no n’hi ha cap: us en proposem uns de partida per revisar.</strong>') + '</p>' +
        '<table class="gs-form-taula gs-informe__taula gs-dep__taula"><thead><tr><th>Departament/àmbit</th><th>Especialitats</th><th>Cap</th><th></th></tr></thead><tbody id="gsDepCos">' + deps.map(fila).join('') + '</tbody></table>' +
        '<button type="button" class="gs-enllac" id="gsDepNou">+ Afegeix un departament/àmbit</button><p class="prog-avis" id="gsDepErr" hidden></p><p class="gs-gris" id="gsDepSense"></p>',
        [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Desa', valor: 1, abans: function () {
          var ll = [].map.call($('gsDepCos').querySelectorAll('tr.gs-dep'), function (tr) { return { nom: tr.querySelector('[data-k="nom"]').value.trim(), especialitats: [].filter.call(tr.querySelectorAll('input[type="checkbox"]'), function (c) { return c.checked; }).map(function (c) { return c.value; }), cap: tr.querySelector('[data-k="cap"]').value }; }).filter(function (d) { return d.nom; });
          var vist = {}, rep = []; ll.forEach(function (d) { d.especialitats.forEach(function (e) { if (vist[e]) rep.push(e); vist[e] = 1; }); });
          if (rep.length) { $('gsDepErr').textContent = 'Aquestes especialitats són a més d’un departament/àmbit: ' + rep.join(', ') + '.'; $('gsDepErr').hidden = false; return false; }
          departamentsDesiderata.ll = ll;
        } }], false).then(function (v) {
        if (!v) return;
        api('departaments_desa', { departaments: departamentsDesiderata.ll }, 'Desant els departaments/àmbits…').then(function (r2) {
          if (!r2.ok) return toast(r2.error === 'especialitat_repetida' ? 'Especialitats repetides: ' + (r2.detall || []).join('; ') : text(r2.error), true);
          toast('Departaments/àmbits desats (' + r2.departaments.length + '). Els caps ja tenen accés a Desiderata.');
          carregaDesiderata(S.des.especialitat);
        });
      });
      $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample', 'gs-modal--hl');
      var sense = function () { var us = {}; [].forEach.call($('gsDepCos').querySelectorAll('input[type="checkbox"]:checked'), function (c) { us[c.value] = 1; }); var s0 = r.especialitats.filter(function (e) { return !us[e]; }); $('gsDepSense').textContent = s0.length ? 'Especialitats sense departament/àmbit: ' + s0.join(', ') : 'Totes les especialitats tenen departament/àmbit.'; };
      $('gsModalText').addEventListener('change', sense);
      $('gsDepNou').addEventListener('click', function () { $('gsDepCos').insertAdjacentHTML('beforeend', fila({ nom: '', especialitats: [], cap: '' })); });
      $('gsDepCos').addEventListener('click', function (e) { var b = e.target.closest('[data-a="treu-dep"]'); if (b) { b.closest('tr').remove(); sense(); } });
      sense();
    });
  }
  function analisiDesiderata() {
    api('desiderata_analisi', {}, 'Analitzant…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      var T = r.especialitats.reduce(function (t, f) { t[0] += f.a_assignar; t[1] += f.assignades; t[2] += f.pendents; return t; }, [0, 0, 0]);
      var files = [{ s: 'Especialitats' }].concat(r.especialitats.sort(function (a, b) { return (a.departament || '~').localeCompare(b.departament || '~', 'ca') || a.especialitat.localeCompare(b.especialitat, 'ca'); }).map(function (f) { return [(f.departament ? f.departament + ' · ' : '') + f.especialitat, fmtH(f.a_assignar), fmtH(f.assignades), fmtH(f.pendents), f.sobreassignades.length ? '⚠ ' + f.sobreassignades.length : '', f.data ? dataVista(String(f.data).slice(0, 10)) : 'no desada']; }),
        [{ t: ['Total', fmtH(T[0]), fmtH(T[1]), fmtH(T[2]), '', ''] }], [{ s: 'Docents amb hores que no quadren (lectives amb alumnat ≠ assignades)' }],
        r.docents.length ? r.docents.map(function (d) { return [d.nom + ' · ' + d.especialitat, fmtH(d.lectives), fmtH(d.assignades), fmtH(d.lectives - d.assignades), '', '']; }) : [['Cap', '', '', '', '', '']]);
      informe('Anàlisi de la desiderata', 'Hores a assignar, assignades i pendents de cada especialitat (de les desiderates desades). A la part de docents: lectives, assignades i diferència.', ['Departament/àmbit · especialitat / docent', 'A assignar', 'Assignades', 'Pendents', 'Excés', 'Desada'], files, 'desiderata-analisi', true);
    });
  }
  // ================================================================== PAS 48-49 · HORARIS · PLANIFICADOR
  // Generador d'horaris en quatre fases: PLANIFICADOR (aquí: condicions de l'horari), MOTOR (programa Python que calcula),
  // EDITOR (retocs manuals) i EXPORTADOR (altres formats). El planificador té tres pestanyes: Marc horari (dies, franges i
  // esbarjos; totes les franges són lectives), Aules (aules i tipus d'aula de cada matèria) i Regles i blocs (blocs
  // paral·lels i regles amb pes). Cada part es desa a la configuració i va dins de l'exportació per al motor.
  var DIES_H = ['dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres'];
  var NOMS_AULA = { ordinaria: 'Ordinària', laboratori: 'Laboratori', informatica: 'Informàtica', idiomes: 'Idiomes', musica: 'Música', gimnas: 'Gimnàs / pista', taller: 'Taller', dibuix: 'Dibuix', desdoblament: 'Desdoblament', altres: 'Altres' };
  function carregaHoraris() {
    api('horaris_dades', {}, 'Carregant el planificador…').then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      // PAS 53: si l'Apps Script desplegat és d'una versió anterior, ho diem (abans la pantalla es quedava buida)
      if (!(r.esquema >= 53)) { $('gsAvis').innerHTML = 'L’Apps Script desplegat és d’una versió anterior (ESQUEMA ' + esc(r.esquema || '≤ 52') + '; cal el 53 o posterior). Enganxeu el Code.gs nou, executeu «configura» i feu una <strong>nova implementació</strong>.'; $('gsAvis').hidden = false; return; }
      var copia = function (x, def) { return JSON.parse(JSON.stringify(x === undefined || x === null ? def : x)); };
      S.hor = r; S.marc = copia(r.marc, { dies: [], franges: [] }); S.aules = copia(r.aules, { aules: [], conjunts: [] }); S.regles = copia(r.regles, { blocs_parallels: [], toves: { pesos: {} } });
      // PAS 50: sessions lectives i professorat (es desen només les files canviades)
      S.ses = {}; r.sessions.forEach(function (x) { S.ses[x.id] = JSON.parse(JSON.stringify(x)); }); S.sesBrut = {};
      S.hprof = {}; r.professorat.forEach(function (x) { S.hprof[x.id] = JSON.parse(JSON.stringify(x)); }); S.hprofBrut = {};
      S.subg = copia(r.subgrups, { hores_b: [] });   // PAS 51: blocs d'hores B
      S.horNiv = S.horNiv || r.nivells[0]; S.horEsp = S.horEsp || '';
      S.horTab = S.horTab || 'marc'; S.horBrut = {}; S.d = { files: [], camps: [], nivell: S.modul.nivell };
      pintaHoraris();
    });
  }
  var hm = function (t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  var lectivesSetmana = function () { return S.marc.franges.filter(function (f) { return !f.esbarjo; }).length * S.marc.dies.length; };
  function renumeraFranges() { var nf = 0, ne = 0; S.marc.franges.forEach(function (f) { f.id = f.esbarjo ? 'E' + (++ne) : 'F' + (++nf); }); }
  function errorsMarc() {
    var M = S.marc, e = [], ant = -1;
    if (!M.dies.length) e.push('Cal triar almenys un dia.');
    if (!M.franges.some(function (f) { return !f.esbarjo; })) e.push('Cal almenys una franja lectiva.');
    M.franges.forEach(function (f) { var a = hm(f.inici), b = hm(f.fi); if (a === null || b === null) e.push(f.id + ': hores no vàlides.'); else { if (a >= b) e.push(f.id + ': l’inici ha de ser abans del final.'); if (a < ant) e.push(f.id + ': comença abans que acabi la franja anterior.'); ant = b; } });
    return e;
  }
  function errorsAules() {
    var e = [], vist = {};
    var claus = {};
    S.aules.aules.forEach(function (a, i) { var id = String(a.id || '').trim().toUpperCase(); if (!/^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(id)) e.push('Aula ' + (i + 1) + ': cal un codi (lletres, xifres, punt o guió; fins a 16).'); else if (vist[id]) e.push('Aula ' + id + ' repetida.'); vist[id] = 1;
      var k = String(a.clau_clickedu || '').trim(); if (k) { if (claus[k]) e.push('Clau de Clickedu ' + k + ' repetida (' + claus[k] + ' i ' + id + ').'); claus[k] = id; } });
    return e;
  }
  function errorsSessions() {
    var e = []; Object.keys(S.sesBrut).forEach(function (id) { var x = S.ses[id], d = String(x.distribucio || ''); if (d && (!/^[1-9]+$/.test(d) || d.split('').reduce(function (t, c) { return t + Number(c); }, 0) !== x.hores_sessions)) e.push(x.nivell + ' ' + x.materia + ' ' + x.grup + ': la distribució ha de sumar ' + fmtH(x.hores_sessions) + ' h' + (x.bloc_b ? ' (les ' + fmtH(x.hores_b) + ' h B van al bloc ' + x.bloc_b + ')' : '') + '.'); if (x.fixes.length > (d ? d.length : x.hores_sessions)) e.push(x.grup + ' ' + x.materia + ': més posicions fixes que sessions.'); });
    return e;
  }
  // PAS 51: hores B (cada bloc: dues o més matèries amb les mateixes hores B i almenys un grup-classe)
  var horesBMat = function (niv, m) { var x = S.hor.materies.filter(function (y) { return y.nivell === niv && y.materia === m; })[0]; return x ? x.hores_b : 0; };
  function errorsSubgrups() {
    var e = [], usat = {};
    S.subg.hores_b.forEach(function (b) { var nom = 'Bloc ' + b.id + ' (' + b.nivell + ')', hs = b.materies.map(function (m) { return horesBMat(b.nivell, m); });
      if (b.materies.length < 2) e.push(nom + ': calen almenys dues matèries.');
      if (!b.grups.length) e.push(nom + ': cal triar almenys un grup-classe.');
      if (hs.some(function (h) { return h !== hs[0]; })) e.push(nom + ': les matèries han de tenir les mateixes hores B.');
      else if (b.materies.length > 1 && hs[0] % b.materies.length) e.push(nom + ': ' + hs[0] + ' hores B no es poden repartir en ' + b.materies.length + ' subgrups.');
      b.grups.forEach(function (L) { b.materies.forEach(function (m) { var k = L + '|' + m + '|' + b.nivell; if (usat[k]) e.push(b.nivell + ' ' + L + ': «' + m + '» és a dos blocs.'); usat[k] = 1; }); }); });
    return e.concat(errorsRegles());
  }
  function errorsRegles() {
    var e = []; S.regles.blocs_parallels.forEach(function (b, i) { if (!b.nom.trim()) e.push('Bloc ' + (i + 1) + ': cal un nom.'); if (b.materies.length < 2) e.push('Bloc «' + (b.nom || i + 1) + '»: calen almenys dues matèries.'); }); return e;
  }
  function pintaHoraris() {
    var R = S.hor, ed = R.pot_desar, tab = S.horTab, brut = Object.keys(S.horBrut).some(function (k) { return S.horBrut[k]; });
    var pes = { marc: R.per_defecte, aules: R.aules_per_defecte, regles: R.regles_per_defecte, subgrups: R.regles_per_defecte }[tab] || false;
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist">' + [['marc', 'Marc horari'], ['aules', 'Aules'], ['subgrups', 'Subgrups'], ['sessions', 'Sessions lectives'], ['professorat', 'Professorat'], ['regles', 'Regles']].map(function (t) { return '<button type="button" role="tab" data-accio="hor-tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + (S.horBrut[t[0]] || (t[0] === 'subgrups' && S.horBrut.blocs) ? ' *' : '') + '</button>'; }).join('') + '</div>' +
      '<span class="gs-espai"></span>' + (tab === 'aules' && ed ? '<label class="prog-btn prog-btn--ghost gs-hor__imp" title="Assigna les claus de Clickedu a partir del fitxer d’exportació de Clickedu (XML)">Claus de Clickedu (XML)<input type="file" id="gsAulesImp" accept=".xml,text/xml,application/xml" hidden></label>' : '') + (tab === 'marc' ? '<label class="prog-btn prog-btn--ghost gs-hor__imp" title="Carrega un marc_horari.json">Importa JSON<input type="file" id="gsHorImp" accept=".json,application/json" hidden></label><button type="button" class="prog-btn prog-btn--ghost" data-accio="hor-json" title="Descarrega marc_horari.json">marc_horari.json</button>' : '') +
      (ed ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="hor-exporta" title="Descarrega totes les dades per al MOTOR (horaris-dades.json)">Exporta per al motor</button><button type="button" class="prog-btn" data-accio="hor-desa">' + (brut ? 'Desa *' : 'Desa') + '</button>' : '') +
      '<p class="gs-ajuda" style="flex:1 1 100%;margin:4px 0 0"><strong>Planificador</strong> del generador d’horaris (planificador → motor → editor → exportador). ' +
      { marc: 'Dies lectius i franges horàries (amb els esbarjos). Totes les franges són lectives per a tots els nivells.', aules: 'Les aules del centre (amb el tipus) i els <strong>conjunts d’aules alternatives</strong> que després es poden posar a cada sessió.', sessions: 'Una fila per sessió lectiva (matèria i grup de Currículum › Assignacions): professor/a, <strong>distribució</strong> de les hores (111 = tres sessions d’1 h; 21 = una de 2 h i una d’1 h), <strong>aula preferent</strong>, <strong>aules alternatives</strong> i <strong>graella</strong> amb posicions fixes i prohibides.', professorat: 'Una graella per docent amb les <strong>posicions fixes</strong> (ha de fer classe aquella hora) i <strong>prohibides</strong> (no hi pot fer classe). Per defecte, totes són lliures.', subgrups: 'Un <strong>subgrup</strong> és una part de l’alumnat que fa una matèria a la mateixa hora que la resta fa una altra. <strong>Hores B</strong>: el grup-classe es divideix en G1 i G2 i les matèries del bloc s’alternen. <strong>Optatives i divisions</strong>: diversos docents alhora, cadascun amb un subgrup i en aules diferents.', regles: '<strong>Regles</strong>: preferències del motor, amb un pes de 1 (poc) a 5 (molt), i les regles obligatòries.' }[tab] +
      (pes ? ' <strong>Encara no s’ha desat: és una proposta per revisar.</strong>' : '') + '</p>';
    var html;
    // PAS 53: un error en pintar una pestanya es mostra (abans la pantalla quedava buida)
    try { html = tab === 'marc' ? htmlMarc(ed) : tab === 'aules' ? htmlAules(ed) : tab === 'subgrups' ? htmlSubgrups(ed) : tab === 'sessions' ? htmlSessions(ed) : tab === 'professorat' ? htmlProfessoratH(ed) : htmlRegles(ed); }
    catch (er) { if (window.console) console.error(er); html = '<p class="prog-avis">No s’ha pogut mostrar la pestanya: ' + esc(er && er.message || er) + '. Proveu una altra pestanya o torneu a carregar la pàgina; si es repeteix, envieu aquest missatge.</p>'; }
    var t0 = $('gsTaula'); t0.className = 'gs-des gs-hor'; t0.innerHTML = '<div id="gsHorCos">' + html + '<p class="prog-avis" id="gsHorErr" hidden></p></div>';
    ajustaAlcada();
    var e = tab === 'marc' ? errorsMarc() : tab === 'aules' ? errorsAules() : tab === 'subgrups' ? errorsSubgrups() : tab === 'sessions' ? errorsSessions() : tab === 'professorat' ? [] : errorsRegles();
    $('gsHorErr').hidden = !e.length; $('gsHorErr').innerHTML = e.map(esc).join('<br>');
    lligaHoraris(ed);
  }
  function htmlMarc(ed) {
    var M = S.marc, dis = ed ? '' : ' disabled';
    var franja = function (f, i) {
      var a = hm(f.inici), b = hm(f.fi), dur = a !== null && b !== null && b > a ? (b - a) + ' min' : '—';
      return '<tr class="' + (f.esbarjo ? 'is-esb' : '') + '" data-i="' + i + '"><td class="gs-cen"><b>' + esc(f.id) + '</b></td><td><input type="time" data-k="inici" value="' + esc(f.inici) + '"' + dis + '></td><td><input type="time" data-k="fi" value="' + esc(f.fi) + '"' + dis + '></td><td class="gs-cen">' + dur + '</td>' +
        '<td class="gs-cen"><input type="checkbox" data-k="esbarjo"' + (f.esbarjo ? ' checked' : '') + dis + ' aria-label="Esbarjo"></td><td>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu-franja" title="Treu" aria-label="Treu la franja">' + PAPERERA + '</button>' : '') + '</td></tr>';
    };
    var graella = '<table class="gs-hor__grid"><thead><tr><th>Franja</th>' + M.dies.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead><tbody>' + M.franges.map(function (f) {
      return f.esbarjo ? '<tr class="is-esb"><th>' + esc(f.inici) + '–' + esc(f.fi) + '</th><td colspan="' + M.dies.length + '">Esbarjo</td></tr>' : '<tr><th>' + f.id + ' <small>' + esc(f.inici) + '–' + esc(f.fi) + '</small></th>' + M.dies.map(function () { return '<td></td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
    return '<section class="gs-hor__sec"><h3 class="gs-amon__tit">1 · Dies lectius</h3><div class="gs-form-fila">' + DIES_H.map(function (d) { return '<label class="gs-check"><input type="checkbox" data-dia="' + d + '"' + (M.dies.indexOf(d) >= 0 ? ' checked' : '') + dis + '> ' + d + '</label>'; }).join('') + '</div></section>' +
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">2 · Franges i esbarjos</h3><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-hor__fr"><thead><tr><th>Codi</th><th>Inici</th><th>Final</th><th>Durada</th><th>Esbarjo</th><th></th></tr></thead><tbody>' + M.franges.map(franja).join('') + '</tbody></table>' +
      (ed ? '<p><button type="button" class="gs-enllac" data-a="nova-franja">+ franja</button> · <button type="button" class="gs-enllac" data-a="nou-esbarjo">+ esbarjo</button></p>' : '') + '</section>' +
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">3 · Graella setmanal</h3>' + graella + '<p class="gs-hor__resum"><b>' + lectivesSetmana() + '</b> franges lectives per setmana (' + M.franges.filter(function (f) { return !f.esbarjo; }).length + ' al dia × ' + M.dies.length + ' dies).</p></section>';
  }
  function htmlAules(ed) {
    var A = S.aules, dis = ed ? '' : ' disabled', opts = function (sel) { return S.hor.tipus_aula.map(function (t) { return '<option value="' + t + '"' + (t === sel ? ' selected' : '') + '>' + NOMS_AULA[t] + '</option>'; }).join(''); };
    var n = {}; A.aules.forEach(function (a) { n[a.tipus] = (n[a.tipus] || 0) + 1; });
    var resum = S.hor.tipus_aula.filter(function (t) { return n[t]; }).map(function (t) { return '<li><b>' + n[t] + '</b> ' + NOMS_AULA[t].toLowerCase() + '</li>'; }).join('');
    return '<section class="gs-hor__sec"><h3 class="gs-amon__tit">1 · Aules del centre</h3>' + (A.aules.length ? '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-hor__au"><thead><tr><th>Codi</th><th>Nom / ubicació</th><th>Tipus</th><th>Capacitat</th><th title="Nom de l’aula a Clickedu">Clickedu</th><th title="Clau de l’aula a Clickedu (claveDeExportacion)">Clau</th><th></th></tr></thead><tbody>' +
        A.aules.map(function (a, i) { return '<tr data-au="' + i + '"><td><input type="text" data-k="id" value="' + esc(a.id) + '" maxlength="16" placeholder="P. ex. A01"' + dis + '></td><td><input type="text" data-k="nom" value="' + esc(a.nom) + '" placeholder="P. ex. Planta 1"' + dis + '></td><td><select data-k="tipus"' + dis + '>' + opts(a.tipus) + '</select></td><td><input type="number" data-k="capacitat" min="0" max="200" value="' + esc(a.capacitat || '') + '"' + dis + '></td>' +
          '<td><input type="text" data-k="nom_clickedu" class="gs-hor__ck" value="' + esc(a.nom_clickedu || '') + '" placeholder="—"' + dis + (/\uFFFD/.test(a.nom_clickedu || '') ? ' title="Clickedu exporta aquest nom amb un accent trencat; no cal canviar-lo"' : '') + '></td><td><input type="text" data-k="clau_clickedu" class="gs-hor__clau" value="' + esc(a.clau_clickedu || '') + '" placeholder="—"' + dis + '></td><td>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu-aula" title="Treu" aria-label="Treu l’aula">' + PAPERERA + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="gs-gris">Encara no hi ha cap aula.</p>') +
      (ed ? '<p><button type="button" class="gs-enllac" data-a="nova-aula">+ aula</button></p>' : '') + (resum ? '<ul class="gs-hor__resum">' + resum + '</ul>' : '') +
      (A.aules.length ? '<p class="gs-gris">Claus de Clickedu: <b>' + A.aules.filter(function (a) { return a.clau_clickedu; }).length + '</b> de ' + A.aules.length + ' aules. Calen per importar l’horari a Clickedu; el botó <strong>Claus de Clickedu (XML)</strong> les posa a partir del fitxer d’exportació de Clickedu.</p>' : '') + '</section>' +
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">2 · Conjunts d’aules alternatives</h3><p class="gs-gris">Un conjunt agrupa aules que poden substituir l’aula preferent d’una sessió (p. ex. «Aules d’idiomes», «Planta 1», «Laboratoris»). Es posa a cada sessió a la pestanya Sessions lectives. Si no hi ha lloc ni a la preferent ni a les alternatives, el motor posarà la sessió en qualsevol aula de la mateixa capacitat i avisarà.</p>' +
        (A.conjunts.length ? A.conjunts.map(function (c, i) { return '<div class="gs-hor__bloc" data-cj="' + i + '"><div class="gs-form-fila"><label>Nom <input type="text" data-k="nom-cj" value="' + esc(c.nom) + '" placeholder="P. ex. Aules d’idiomes"' + dis + '></label><span class="gs-gris">' + c.aules.length + ' aules</span>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu-conjunt" title="Treu el conjunt" aria-label="Treu el conjunt">' + PAPERERA + '</button>' : '') + '</div>' +
          '<div class="gs-hor__mats">' + A.aules.filter(function (a) { return a.id; }).map(function (a) { return '<label class="gs-check"><input type="checkbox" value="' + esc(a.id) + '"' + (c.aules.indexOf(a.id) >= 0 ? ' checked' : '') + dis + '> ' + esc(a.id) + ' <span class="gs-gris">' + esc(NOMS_AULA[a.tipus] || '') + '</span></label>'; }).join('') + '</div></div>'; }).join('') : '<p class="gs-gris">Cap conjunt.</p>') +
        (ed ? '<p><button type="button" class="gs-enllac" data-a="nou-conjunt">+ conjunt</button>' + (A.aules.length ? ' · <button type="button" class="gs-enllac" data-a="proposa-conjunts">Proposa un conjunt per a cada tipus d’aula</button>' : '') + '</p>' : '') + '</section>';
  }
  // PAS 53 · Claus de Clickedu de les aules a partir del fitxer GHC (exportació de Clickedu o resultat de Peñalara)
  var normAula = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f\uFFFD]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  var tipusAula = function (n) { var x = normAula(n);
    return /^(L(AB|BIO|FIS|QUI)|LABORATORI)/.test(x) ? 'laboratori' : /INFORM|ROB/.test(x) ? 'informatica' : /ANGLES|FRANCES|ITALIA|ALEMANY|IDIOM/.test(x) ? 'idiomes' : /MUSICA/.test(x) ? 'musica' : /GIMNAS|PISTA|POLIESPORT/.test(x) ? 'gimnas' : /TECNO|TALLER/.test(x) ? 'taller' : /DIBUIX|PLASTICA/.test(x) ? 'dibuix' : /^ADES|DESDOBL/.test(x) ? 'desdoblament' : /^(\d+|A\d+|M\d+)$/.test(x) ? 'ordinaria' : 'altres'; };
  function llegeixGHC(buf) {
    var txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('iso-8859-1').decode(buf); }
    var doc = new DOMParser().parseFromString(txt.replace(/^\s*<\?xml[^>]*\?>/, ''), 'application/xml');
    if (!doc.querySelector('datosGHC') || doc.querySelector('parsererror')) return null;
    var t = function (e, k) { var x = e.querySelector(k); return x ? x.textContent.trim() : ''; };
    return { aules: [].map.call(doc.querySelectorAll('aulas > aula'), function (e) { return { nom: t(e, 'nombre'), clau: t(e, 'claveDeExportacion'), desc: t(e, 'descripcion') }; }).filter(function (a) { return a.nom; }),
      conjunts: [].map.call(doc.querySelectorAll('conjuntoDeAulas > otroConjunto'), function (e) { return { nom: e.getAttribute('nombre') || '', aules: [].map.call(e.querySelectorAll('aula'), function (x) { return x.textContent.trim(); }) }; }) };
  }
  function importaClausAules(G) {
    var A = S.aules, usats = {}; A.aules.forEach(function (a) { usats[a.id] = 1; });
    var troba = function (c) { return A.aules.filter(function (a) { return (a.clau_clickedu && a.clau_clickedu === c.clau) || [a.nom_clickedu, a.id, a.nom].some(function (x) { return x && normAula(x) === normAula(c.nom); }) || normAula(a.id) === 'A' + normAula(c.nom); })[0]; };
    var nouCodi = function (c) { var b = normAula(c.nom); if (/^\d+$/.test(b)) b = 'A' + b; b = b.slice(0, 16) || 'AULA'; var x = b, n = 2; while (usats[x]) x = b.slice(0, 14) + (n++); usats[x] = 1; return x; };
    var files = G.aules.map(function (c) { var a = troba(c); return { c: c, a: a, id: a ? a.id : nouCodi(c), tipus: a ? a.tipus : tipusAula(c.nom + ' ' + c.desc) }; });
    var senseCk = A.aules.filter(function (a) { return !files.some(function (f) { return f.a === a; }); });
    var html = '<p>' + G.aules.length + ' aules al fitxer: <b>' + files.filter(function (f) { return f.a; }).length + '</b> ja són a GESTIO i <b>' + files.filter(function (f) { return !f.a; }).length + '</b> són noves. Res no es desa fins que premeu <strong>Desa</strong>.</p>' +
      '<div class="gs-comprova"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Clickedu</th><th class="gs-cen">Clau</th><th>A GESTIO</th><th>Tipus</th></tr></thead><tbody>' +
      files.map(function (f) { return '<tr><td>' + esc(f.c.nom) + (/\uFFFD/.test(f.c.nom) ? ' <span class="gs-gris" title="Accent trencat a l’exportació de Clickedu">⚠</span>' : '') + (f.c.desc ? '<br><small class="gs-gris">' + esc(f.c.desc) + '</small>' : '') + '</td><td class="gs-cen">' + esc(f.c.clau || '—') + '</td><td>' + (f.a ? '<b>' + esc(f.a.id) + '</b>' : 'nova: ' + esc(f.id)) + '</td><td>' + esc(NOMS_AULA[f.tipus] || f.tipus) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (senseCk.length ? '<p class="prog-avis">Aules de GESTIO que no són al fitxer (es queden sense clau): ' + esc(senseCk.map(function (a) { return a.id; }).join(', ')) + '</p>' : '') +
      '<label class="gs-check"><input type="checkbox" id="gsCkNoves" checked> Afegeix les aules noves</label>' +
      (G.conjunts.length ? '<label class="gs-check"><input type="checkbox" id="gsCkConj"> Afegeix també els ' + G.conjunts.length + ' conjunts d’aules del fitxer (' + esc(G.conjunts.map(function (c) { return c.nom; }).join(', ')) + ')</label>' : '');
    pregunta('Claus de Clickedu de les aules', html, [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Aplica', valor: 1, abans: function () { importaClausAules.o = { noves: $('gsCkNoves').checked, conj: !!($('gsCkConj') && $('gsCkConj').checked) }; } }], false).then(function (v) {
      if (!v) return;
      var o = importaClausAules.o, perNom = {};
      files.forEach(function (f) {
        if (f.a) { f.a.clau_clickedu = f.c.clau; f.a.nom_clickedu = f.c.nom; perNom[f.c.nom] = f.a.id; }
        else if (o.noves) { A.aules.push({ id: f.id, nom: f.c.desc || f.c.nom, tipus: f.tipus, capacitat: 30, nom_clickedu: f.c.nom, clau_clickedu: f.c.clau }); perNom[f.c.nom] = f.id; }
      });
      if (o.conj) G.conjunts.forEach(function (c) { var ll = c.aules.map(function (n) { return perNom[n] || (A.aules.filter(function (a) { return normAula(a.id) === normAula(n) || normAula(a.nom_clickedu) === normAula(n); })[0] || {}).id; }).filter(Boolean);
        if (ll.length && !A.conjunts.some(function (x) { return x.nom === c.nom; })) A.conjunts.push({ id: nouCodiConjunt(), nom: c.nom, aules: ll }); });
      S.horBrut.aules = true; S.brut = true; pintaHoraris(); toast('Claus de Clickedu posades. Reviseu les aules (codi, tipus i capacitat) i premeu Desa.');
    });
  }
  // Codi estable d'un conjunt nou (C1, C2…): les sessions hi fan referència
  var nouCodiConjunt = function () { var mx = 0; S.aules.conjunts.forEach(function (c) { var m = /^C(\d+)$/.exec(c.id || ''); if (m) mx = Math.max(mx, Number(m[1])); }); return 'C' + (mx + 1); };
  // Etiqueta curta d'una graella: «2 fixes · 3 prohibides»
  var resumGraella = function (x) { var t = []; if (x.fixes.length) t.push(x.fixes.length + (x.fixes.length === 1 ? ' fixa' : ' fixes')); if (x.prohibides.length) t.push(x.prohibides.length + (x.prohibides.length === 1 ? ' prohibida' : ' prohibides')); return t.length ? t.join(' · ') : 'lliure'; };
  function htmlSessions(ed) {
    var R = S.hor, dis = ed ? '' : ' disabled', ll = Object.keys(S.ses).map(function (k) { return S.ses[k]; }).filter(function (x) { return x.nivell === S.horNiv; });
    var aOpts = function (sel) { return '<option value="">—</option>' + S.aules.aules.filter(function (a) { return a.id; }).map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.id) + (a.nom ? ' · ' + esc(a.nom) : '') + '</option>'; }).join(''); };
    var cOpts = function (sel) { return '<option value="">—</option>' + S.aules.conjunts.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join(''); };
    var blocs = {}; S.regles.blocs_parallels.forEach(function (b) { if (b.nivell === S.horNiv) b.materies.forEach(function (m) { blocs[m] = b.nom; }); });
    var mat = '';
    return '<div class="gs-nivells" role="group" aria-label="Nivell">' + R.nivells.map(function (n) { return '<button type="button" class="gs-nivells__btn' + (n === S.horNiv ? ' is-actiu' : '') + '" data-a="niv" data-niv="' + esc(n) + '">' + n + '</button>'; }).join('') + '</div>' +
      (!S.aules.aules.length ? '<p class="prog-avis">Encara no hi ha aules: doneu-les d’alta a la pestanya Aules.</p>' : '') +
      (ll.length ? '<table class="gs-form-taula gs-informe__taula gs-hor__ses"><thead><tr><th>Matèria</th><th>Grup</th><th>Professor/a</th><th class="gs-cen">h</th><th>Distribució</th><th>Aula preferent</th><th>Aules alternatives</th><th>Graella</th><th></th></tr></thead><tbody>' +
        ll.map(function (x) { var nova = x.id_materia + x.materia !== mat; mat = x.id_materia + x.materia;
          return '<tr data-ses="' + esc(x.id) + '" class="' + (nova ? 'is-nova' : '') + (S.sesBrut[x.id] ? ' is-brut' : '') + '"><td>' + (nova ? esc(x.materia) + (blocs[x.materia] ? ' <span class="gs-codo" title="Bloc paral·lel">' + esc(blocs[x.materia]) + '</span>' : '') : '') + '</td><td>' + esc(x.grup) + (x.bloc_b ? ' <span class="gs-codo gs-hor__b" title="Hores B amb ' + esc(x.amb_b.join(', ')) + '">' + esc(x.bloc_b) + ' · B</span>' : '') + '</td><td>' + (x.professor ? esc(x.professor) : '<span class="gs-gris">—</span>') + '</td><td class="gs-cen">' + fmtH(x.hores) + (x.bloc_b ? '<br><small class="gs-gris">' + fmtH(x.hores_sessions) + ' + ' + fmtH(x.hores_b) + ' B</small>' : '') + '</td>' +
            '<td><input type="text" data-k="distribucio" value="' + esc(x.distribucio) + '" maxlength="8" inputmode="numeric"' + dis + '></td><td><select data-k="aula"' + dis + '>' + aOpts(x.aula) + '</select></td><td><select data-k="conjunt"' + dis + '>' + cOpts(x.conjunt) + '</select></td>' +
            '<td><button type="button" class="gs-enllac gs-hor__gbtn" data-a="graella-ses">' + resumGraella(x) + '</button></td><td>' + (ed && nova ? '<button type="button" class="gs-hist" data-a="aplica-materia" title="Copia la distribució, les aules i la graella d’aquest grup a tots els grups de la matèria" aria-label="Aplica a tota la matèria">⇣</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="gs-gris">Aquest nivell no té assignacions (cal generar-les a Currículum › Assignacions).</p>');
  }
  function htmlProfessoratH(ed) {
    var dis = ed ? '' : ' disabled', fr = lectivesSetmana(), esps = {};
    Object.keys(S.hprof).forEach(function (k) { if (S.hprof[k].especialitat) esps[S.hprof[k].especialitat] = 1; });
    var ll = Object.keys(S.hprof).map(function (k) { return S.hprof[k]; }).filter(function (p) { return !S.horEsp || p.especialitat === S.horEsp; });
    return '<div class="gs-form-fila"><label>Especialitat <select data-a="esp-prof"><option value="">Totes</option>' + Object.keys(esps).sort(function (a, b) { return a.localeCompare(b, 'ca'); }).map(function (e) { return '<option' + (e === S.horEsp ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></label></div>' +
      '<table class="gs-form-taula gs-informe__taula gs-hor__prof"><thead><tr><th>Docent</th><th>Especialitat</th><th>Jornada</th><th class="gs-cen">Hores assignades</th><th class="gs-cen">Franges disponibles</th><th>Graella</th><th>Observacions</th></tr></thead><tbody>' +
      ll.map(function (p) { var disp = fr - p.prohibides.length, av = p.hores_assignades > disp;
        return '<tr data-prof="' + esc(p.id) + '"' + (S.hprofBrut[p.id] ? ' class="is-brut"' : '') + '><td>' + esc(p.nom) + '</td><td>' + esc(p.especialitat || '—') + '</td><td>' + esc(p.jornada || '—') + '</td><td class="gs-cen">' + fmtH(p.hores_assignades) + '</td><td class="gs-cen' + (av ? ' is-pend' : '') + '">' + disp + (av ? ' ⚠' : '') + '</td>' +
          '<td><button type="button" class="gs-enllac gs-hor__gbtn" data-a="graella-prof">' + resumGraella(p) + '</button></td><td><input type="text" data-k="observacions" value="' + esc(p.observacions) + '" placeholder="P. ex. dimecres tarda, formació"' + dis + '></td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="gs-gris">Franges disponibles = ' + fr + ' franges lectives de la setmana − prohibides. ⚠ si té més hores assignades (Currículum › Assignacions) que franges disponibles.</p>';
  }
  // Graella de posicions (sessió o docent): cada clic canvia lliure → fixa → prohibida → lliure
  function editaGraella(titol, x, maxFixes, ed) {
    var M = S.marc, F = x.fixes.slice(), P = x.prohibides.slice();
    var pinta = function () {
      $('gsGrPos').innerHTML = '<table class="gs-hor__grid gs-hor__grid--edit"><thead><tr><th></th>' + M.dies.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead><tbody>' + M.franges.map(function (f) {
        if (f.esbarjo) return '<tr class="is-esb"><th>' + esc(f.inici) + '</th><td colspan="' + M.dies.length + '">Esbarjo</td></tr>';
        return '<tr><th>' + f.id + ' <small>' + esc(f.inici) + '–' + esc(f.fi) + '</small></th>' + M.dies.map(function (d) { var k = d + ' ' + f.id, e = F.indexOf(k) >= 0 ? 'fixa' : P.indexOf(k) >= 0 ? 'prohibida' : 'lliure';
          return '<td class="gs-gr gs-gr--' + e + (ed ? ' is-clic' : '') + '" data-pos="' + k + '" title="' + k + ': ' + e + '">' + (e === 'fixa' ? '📌' : e === 'prohibida' ? '⛔' : '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table><p class="gs-gris">' + F.length + (F.length === 1 ? ' fixa' : ' fixes') + (maxFixes ? ' (màxim ' + maxFixes + ')' : '') + ' · ' + P.length + (P.length === 1 ? ' prohibida' : ' prohibides') + '</p>';
    };
    var pr = pregunta(titol, '<p class="gs-ajuda">Clic a una casella: <span class="gs-gr gs-gr--lliure gs-gr--ll">lliure</span> → <span class="gs-gr gs-gr--fixa gs-gr--ll">📌 fixa</span> (hi ha d’anar) → <span class="gs-gr gs-gr--prohibida gs-gr--ll">⛔ prohibida</span> (no hi pot anar).</p><div id="gsGrPos"></div><p class="prog-avis" id="gsGrErr" hidden></p>',
      ed ? [{ t: 'Totes lliures', valor: 0, tipus: 'ghost', abans: function () { F = []; P = []; pinta(); return false; } }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'D’acord', valor: 1 }] : [{ t: 'Tanca', valor: 0 }], false);
    pinta();
    if (ed) $('gsGrPos').addEventListener('click', function (e) {
      var td = e.target.closest('[data-pos]'); if (!td) return; var k = td.dataset.pos, i = F.indexOf(k), j = P.indexOf(k);
      if (i >= 0) { F.splice(i, 1); P.push(k); } else if (j >= 0) P.splice(j, 1); else { if (maxFixes && F.length >= maxFixes) { $('gsGrErr').textContent = 'No hi pot haver més posicions fixes que sessions (' + maxFixes + ').'; $('gsGrErr').hidden = false; P.push(k); } else F.push(k); }
      pinta();
    });
    return pr.then(function (v) { return v ? { fixes: F, prohibides: P } : null; });
  }
    function htmlRegles(ed) {
    var RG = S.regles, T = RG.toves, dis = ed ? '' : ' disabled';
    var pesSel = function (k) { return '<select data-pes="' + k + '"' + dis + '>' + [1, 2, 3, 4, 5].map(function (v) { return '<option' + (v === (T.pesos[k] || 3) ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>'; };
    var regla = function (k, txt, pk) { return '<tr><td><label class="gs-check"><input type="checkbox" data-t="' + k + '"' + (T[k] ? ' checked' : '') + dis + '> ' + txt + '</label></td><td class="gs-cen">' + pesSel(pk) + '</td></tr>'; };
    return '<section class="gs-hor__sec"><h3 class="gs-amon__tit">Regles del motor</h3><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Regla</th><th class="gs-cen">Pes (1–5)</th></tr></thead><tbody>' +
        '<tr><td>Màxim d’hores seguides d’una mateixa matèria <input type="number" data-t="max_hores_seguides_materia" min="1" max="6" value="' + T.max_hores_seguides_materia + '"' + dis + ' style="width:56px"></td><td class="gs-cen">' + pesSel('seguides') + '</td></tr>' +
        regla('repartir_en_dies_diferents', 'Repartir les hores de cada matèria en dies diferents', 'dies') + regla('minimitzar_forats_docents', 'Evitar forats a l’horari del professorat', 'forats') + regla('respectar_desiderata', 'Respectar la desiderata (docent de cada grup)', 'desiderata') +
        '<tr><td>Penalització si una sessió va a una <strong>aula alternativa</strong> (avís)</td><td class="gs-cen">' + pesSel('aula_alternativa') + '</td></tr>' +
        '<tr><td>Penalització si una sessió va a <strong>qualsevol aula</strong> de la mateixa capacitat (avís)</td><td class="gs-cen">' + pesSel('aula_qualsevol') + '</td></tr>' +
        '</tbody></table><p class="gs-gris">Les regles són preferències: el motor intenta complir més les de pes alt. Les regles obligatòries no es poden desactivar: un docent, un grup, un subgrup o una aula no poden ser a dos llocs alhora; posicions fixes i prohibides; els blocs paral·lels (optatives, divisions) a la mateixa franja amb docents i aules diferents; les sessions d’un bloc d’hores B, simultànies per als subgrups i totes el mateix dia.</p></section>' +
      // PAS 52: catàleg de regles (obligatòries i toves amb la seva penalització), tal com va a l'exportació per al motor
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">Regles obligatòries</h3><ol class="gs-hor__regles">' + (S.hor.regles_motor ? S.hor.regles_motor.obligatories : []).map(function (r) { return '<li>' + esc(r.text) + ' <span class="gs-gris">(' + esc(r.dades) + ')</span></li>'; }).join('') + '</ol>' +
      '<h3 class="gs-amon__tit">Penalitzacions de les regles toves</h3><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Regla</th><th>Unitat</th><th class="gs-cen">Pes desat</th></tr></thead><tbody>' + (S.hor.regles_motor ? S.hor.regles_motor.toves : []).map(function (r) { return '<tr' + (r.activa ? '' : ' class="gs-gris"') + '><td>' + esc(r.text) + (r.activa ? '' : ' (desactivada)') + '</td><td>' + esc(r.unitat) + '</td><td class="gs-cen">' + r.pes + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="gs-gris">Penalització total = Σ pes × unitats. El motor busca l’horari amb la penalització més baixa i compleix sempre les obligatòries.</p></section>';
  }
  // PAS 51 · Subgrups: hores B (desdoblament en G1, G2… amb rotació de matèries) i blocs paral·lels (optatives, divisions)
  function htmlSubgrups(ed) {
    var R = S.hor, niv = S.horNiv, dis = ed ? '' : ' disabled', RG = S.regles;
    var lletres = (R.grups_nivell[niv] || []).map(function (g) { return g.slice(niv.length).trim(); });
    var matsB = R.materies.filter(function (m) { return m.nivell === niv && m.hores_b > 0; });
    var sesDe = function (m, gc) { return Object.keys(S.ses).map(function (k) { return S.ses[k]; }).filter(function (x) { return x.nivell === niv && x.materia === m && (gc === undefined || x.grup === gc); }); };
    var hb = S.subg.hores_b.map(function (b, i) { return [b, i]; }).filter(function (p) { return p[0].nivell === niv; });
    var blocB = function (p) { var b = p[0], i = p[1], n = b.materies.length, h = n ? horesBMat(niv, b.materies[0]) : 0;
      var rot = n > 1 && h ? '<ol class="gs-hor__rot">' + Array.apply(null, Array(h)).map(function (_, k) { return '<li>Sessió B ' + (k + 1) + ': ' + b.materies.map(function (m, j) { return 'G' + (j + 1) + ' ' + esc(b.materies[(j + k) % n]); }).join(' · ') + '</li>'; }).join('') + '</ol><p class="gs-gris">Les ' + h + ' sessions B de cada grup-classe són <strong>el mateix dia</strong> (no cal que siguin seguides).</p>' : '';
      var xocs = []; b.grups.forEach(function (L) { var ps = {}; b.materies.forEach(function (m) { sesDe(m, niv + ' ' + L).forEach(function (x) { if (x.professor) { if (ps[x.professor]) xocs.push(niv + ' ' + L + ': ' + x.professor + ' fa ' + ps[x.professor] + ' i ' + m); ps[x.professor] = m; } }); }); });
      return '<div class="gs-hor__bloc" data-hb="' + i + '"><div class="gs-form-fila"><b>Bloc ' + esc(b.id) + '</b><span class="gs-gris">' + (n ? n + ' subgrups (G1' + (n > 1 ? '–G' + n : '') + ')' : '') + '</span>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu-hb" title="Treu el bloc" aria-label="Treu el bloc">' + PAPERERA + '</button>' : '') + '</div>' +
        '<p class="gs-gris">Matèries</p><div class="gs-hor__mats">' + matsB.map(function (m) { return '<label class="gs-check"><input type="checkbox" data-k="mat" value="' + esc(m.materia) + '"' + (b.materies.indexOf(m.materia) >= 0 ? ' checked' : '') + dis + '> ' + esc(m.materia) + ' <span class="gs-gris">' + fmtH(m.hores_b) + ' h B</span></label>'; }).join('') + '</div>' +
        '<p class="gs-gris">Grups-classe</p><div class="gs-hor__mats">' + lletres.map(function (L) { return '<label class="gs-check"><input type="checkbox" data-k="grup" value="' + esc(L) + '"' + (b.grups.indexOf(L) >= 0 ? ' checked' : '') + dis + '> ' + esc(niv + ' ' + L) + '</label>'; }).join('') + '</div>' + rot +
        (xocs.length ? '<p class="prog-avis">⚠ El mateix docent no pot fer dues matèries d’un bloc alhora: ' + xocs.map(esc).join('; ') + '.</p>' : '') + '</div>'; };
    var cob = {}; S.subg.hores_b.forEach(function (b) { if (b.nivell === niv) b.grups.forEach(function (L) { b.materies.forEach(function (m) { cob[L + '|' + m] = b.id; }); }); });
    var taula = matsB.length ? '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-hor__cob"><thead><tr><th>Grup-classe</th>' + matsB.map(function (m) { return '<th>' + esc(m.materia) + ' <small>(' + fmtH(m.hores_b) + ' h B)</small></th>'; }).join('') + '</tr></thead><tbody>' +
      lletres.map(function (L) { return '<tr><th>' + esc(niv + ' ' + L) + '</th>' + matsB.map(function (m) { var c = cob[L + '|' + m.materia]; return '<td class="gs-cen' + (c ? '' : ' is-pend') + '">' + (c ? esc(c) : '⚠ sense bloc') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table><p class="gs-gris">Una matèria amb hores B sense bloc fa totes les hores amb el grup sencer.</p>' : '<p class="gs-gris">Cap matèria de ' + esc(niv) + ' té hores B al currículum.</p>';
    var mats = R.materies.filter(function (m) { return m.nivell === niv; });
    var bloc = function (b, i) {
      var hores = {}; b.materies.forEach(function (x) { var m = mats.filter(function (y) { return y.materia === x; })[0]; if (m) hores[m.hores] = 1; });
      var sg = [], profs = {}, rep = []; b.materies.forEach(function (m) { sesDe(m).forEach(function (x) { sg.push('<li>' + esc(x.grup + ' · ' + m) + ' <span class="gs-gris">' + (x.professor ? esc(x.professor) : 'sense docent') + '</span></li>'); if (x.professor) { if (profs[x.professor]) rep.push(x.professor); profs[x.professor] = 1; } }); });
      return '<div class="gs-hor__bloc" data-b="' + i + '"><div class="gs-form-fila"><label>Nom <input type="text" data-k="nom" value="' + esc(b.nom) + '" placeholder="P. ex. Optatives"' + dis + '></label>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu-bloc" title="Treu el bloc" aria-label="Treu el bloc">' + PAPERERA + '</button>' : '') + '</div>' +
        '<div class="gs-hor__mats">' + mats.map(function (m) { return '<label class="gs-check' + (m.units ? ' is-units' : '') + '"><input type="checkbox" value="' + esc(m.materia) + '"' + (b.materies.indexOf(m.materia) >= 0 ? ' checked' : '') + dis + '> ' + esc(m.materia) + ' <span class="gs-gris">' + fmtH(m.hores) + ' h</span></label>'; }).join('') + '</div>' +
        (sg.length ? '<details class="gs-hor__sg"><summary>' + sg.length + ' subgrups simultanis</summary><ul>' + sg.join('') + '</ul></details>' : '') +
        (Object.keys(hores).length > 1 ? '<p class="prog-avis">⚠ Les matèries d’un bloc han de tenir les mateixes hores (ara: ' + Object.keys(hores).join(', ') + ' h).</p>' : '') +
        (rep.length ? '<p class="prog-avis">⚠ Cada subgrup ha de tenir un docent diferent: ' + rep.filter(function (x, j, a) { return a.indexOf(x) === j; }).map(esc).join(', ') + ' hi surt més d’un cop.</p>' : '') + '</div>';
    };
    var bp = RG.blocs_parallels.map(function (b, i) { return [b, i]; }).filter(function (p) { return p[0].nivell === niv; });
    return '<div class="gs-nivells" role="group" aria-label="Nivell">' + R.nivells.map(function (n) { return '<button type="button" class="gs-nivells__btn' + (n === niv ? ' is-actiu' : '') + '" data-a="niv" data-niv="' + esc(n) + '">' + n + '</button>'; }).join('') + '</div>' +
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">1 · Hores B (desdoblaments)</h3><p class="gs-gris">A les hores B el grup-classe es divideix en subgrups (G1, G2…) i, a la mateixa hora, cada subgrup fa una matèria del bloc amb el seu docent i a la seva aula. A la sessió següent s’intercanvien.</p>' +
        (hb.length ? hb.map(blocB).join('') : '<p class="gs-gris">Cap bloc d’hores B en aquest nivell.</p>') + (ed && matsB.length > 1 ? '<p><button type="button" class="gs-enllac" data-a="nou-hb">+ bloc d’hores B</button></p>' : '') +
        '<h4 class="gs-hor__sub">Hores B de cada grup-classe</h4>' + taula + ((R.hores_b_avisos || []).length ? '<p class="prog-avis">' + R.hores_b_avisos.map(esc).join('<br>') + '</p>' : '') + '</section>' +
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">2 · Optatives i divisions (blocs paral·lels)</h3><p class="gs-gris">Matèries que es fan a la mateixa franja: cada una és un subgrup amb el seu docent i la seva aula (p. ex. les optatives, on l’alumnat de diversos grups-classe en tria una). Les de grups units surten en negreta.' + (ed ? ' <button type="button" class="gs-enllac" data-a="proposa-blocs">Proposa un bloc d’optatives per nivell</button>' : '') + '</p>' +
        (bp.length ? bp.map(function (p) { return bloc(p[0], p[1]); }).join('') : '<p class="gs-gris">Cap bloc en aquest nivell.</p>') + (ed ? '<p><button type="button" class="gs-enllac" data-a="nou-bloc">+ bloc</button></p>' : '') + '</section>';
  }
  function lligaHoraris(ed) {
    var cos = $('gsHorCos'), M = S.marc, A = S.aules, RG = S.regles, tab = S.horTab;
    var canvia = function (repinta, clau) { S.horBrut[clau || tab] = true; S.brut = true; if (repinta) setTimeout(pintaHoraris, 0); else { var b = document.querySelector('[data-accio="hor-desa"]'); if (b) b.textContent = 'Desa *'; } };
    cos.addEventListener('change', function (e) {
      var x = e.target;
      if (tab === 'marc') {
        if (x.dataset.dia) { M.dies = DIES_H.filter(function (d) { var c = cos.querySelector('[data-dia="' + d + '"]'); return c && c.checked; }); return canvia(true); }
        var tr = x.closest('tr[data-i]'); if (tr) { var f = M.franges[Number(tr.dataset.i)]; if (x.dataset.k === 'esbarjo') { if (x.checked) f.esbarjo = true; else delete f.esbarjo; renumeraFranges(); } else f[x.dataset.k] = x.value; return canvia(true); }
      } else if (tab === 'aules') {
        var ta = x.closest('tr[data-au]'); if (ta) { var a = A.aules[Number(ta.dataset.au)]; a[x.dataset.k] = x.dataset.k === 'capacitat' ? Number(x.value) || 0 : x.dataset.k === 'id' ? x.value.trim().toUpperCase() : x.value; return canvia(true); }
        var cj = x.closest('[data-cj]'); if (cj) { var c = A.conjunts[Number(cj.dataset.cj)]; if (x.dataset.k === 'nom-cj') c.nom = x.value; else c.aules = [].filter.call(cj.querySelectorAll('.gs-hor__mats input'), function (k) { return k.checked; }).map(function (k) { return k.value; }); return canvia(true); }
      } else if (tab === 'sessions') {
        var ts = x.closest('tr[data-ses]'); if (ts && x.dataset.k) { var se = S.ses[ts.dataset.ses]; se[x.dataset.k] = x.dataset.k === 'distribucio' ? x.value.trim() : x.value; S.sesBrut[se.id] = true; return canvia(true); }
      } else if (tab === 'professorat') {
        if (x.dataset.a === 'esp-prof') { S.horEsp = x.value; return setTimeout(pintaHoraris, 0); }
        var tp = x.closest('tr[data-prof]'); if (tp && x.dataset.k) { S.hprof[tp.dataset.prof][x.dataset.k] = x.value; S.hprofBrut[tp.dataset.prof] = true; return canvia(false); }
      } else if (tab === 'subgrups') {
        var hbx = x.closest('[data-hb]');
        if (hbx) { var hb = S.subg.hores_b[Number(hbx.dataset.hb)], sel = function (k) { return [].filter.call(hbx.querySelectorAll('input[data-k="' + k + '"]'), function (c) { return c.checked; }).map(function (c) { return c.value; }); }; hb.materies = sel('mat'); hb.grups = sel('grup'); return canvia(true, 'subgrups'); }
        var bl = x.closest('[data-b]');
        if (bl) { var b = RG.blocs_parallels[Number(bl.dataset.b)]; if (x.dataset.k === 'nom') b.nom = x.value; else if (x.type === 'checkbox') b.materies = [].filter.call(bl.querySelectorAll('.gs-hor__mats input'), function (c) { return c.checked; }).map(function (c) { return c.value; }); return canvia(true, 'blocs'); }
      } else {
        if (x.dataset.t) { RG.toves[x.dataset.t] = x.type === 'checkbox' ? x.checked : Number(x.value) || 1; return canvia(true); }
        if (x.dataset.pes) { RG.toves.pesos[x.dataset.pes] = Number(x.value); return canvia(true); }
      }
    });
    cos.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'niv') { S.horNiv = b.dataset.niv; return pintaHoraris(); }
      if (b.dataset.a === 'graella-ses') { var xs = S.ses[b.closest('tr').dataset.ses]; return editaGraella('Graella · ' + xs.nivell + ' · ' + xs.materia + ' · ' + xs.grup, xs, (xs.distribucio || '').length || Math.round(xs.hores_sessions), ed).then(function (g) { if (!g) return; xs.fixes = g.fixes; xs.prohibides = g.prohibides; S.sesBrut[xs.id] = true; canvia(true); }); }
      if (b.dataset.a === 'graella-prof') { var xp = S.hprof[b.closest('tr').dataset.prof]; return editaGraella('Graella · ' + xp.nom, xp, 0, ed).then(function (g) { if (!g) return; xp.fixes = g.fixes; xp.prohibides = g.prohibides; S.hprofBrut[xp.id] = true; canvia(true); }); }
      if (!ed) return;
      var a = b.dataset.a, ult = M.franges[M.franges.length - 1], ini = ult ? ult.fi : '08:00', mes = function (t, m) { var v = hm(t) + m; return ('0' + Math.floor(v / 60)).slice(-2) + ':' + ('0' + v % 60).slice(-2); };
      if (a === 'nova-franja') M.franges.push({ id: '', inici: ini, fi: mes(ini, 60) });
      else if (a === 'nou-esbarjo') M.franges.push({ id: '', inici: ini, fi: mes(ini, 30), esbarjo: true });
      else if (a === 'treu-franja') M.franges.splice(Number(b.closest('tr').dataset.i), 1);
      else if (a === 'nova-aula') A.aules.push({ id: '', nom: '', tipus: 'ordinaria', capacitat: 30 });
      else if (a === 'treu-aula') A.aules.splice(Number(b.closest('tr').dataset.au), 1);
      else if (a === 'nou-conjunt') A.conjunts.push({ id: nouCodiConjunt(), nom: '', aules: [] });
      else if (a === 'treu-conjunt') A.conjunts.splice(Number(b.closest('[data-cj]').dataset.cj), 1);
      else if (a === 'proposa-conjunts') S.hor.tipus_aula.forEach(function (t) { var ll = A.aules.filter(function (x) { return x.tipus === t && x.id; }).map(function (x) { return x.id; }); if (ll.length > 1 && !A.conjunts.some(function (c) { return c.nom === 'Aules: ' + NOMS_AULA[t].toLowerCase(); })) A.conjunts.push({ id: nouCodiConjunt(), nom: 'Aules: ' + NOMS_AULA[t].toLowerCase(), aules: ll }); });
      else if (a === 'aplica-materia') { var x0 = S.ses[b.closest('tr').dataset.ses]; Object.keys(S.ses).forEach(function (k) { var y = S.ses[k]; if (y !== x0 && y.nivell === x0.nivell && y.id_materia === x0.id_materia && y.materia === x0.materia && y.hores_sessions === x0.hores_sessions) { y.distribucio = x0.distribucio; y.aula = x0.aula; y.conjunt = x0.conjunt; y.fixes = x0.fixes.slice(); y.prohibides = x0.prohibides.slice(); S.sesBrut[k] = true; } }); }
      else if (a === 'nou-bloc') { RG.blocs_parallels.push({ nivell: S.horNiv, nom: '', materies: [] }); return canvia(true, 'blocs'); }
      else if (a === 'treu-bloc') { RG.blocs_parallels.splice(Number(b.closest('[data-b]').dataset.b), 1); return canvia(true, 'blocs'); }
      else if (a === 'nou-hb') { var mx = 0; S.subg.hores_b.forEach(function (y) { var m = /^B(\d+)$/.exec(y.id || ''); if (m) mx = Math.max(mx, Number(m[1])); }); S.subg.hores_b.push({ id: 'B' + (mx + 1), nivell: S.horNiv, materies: [], grups: [] }); return canvia(true, 'subgrups'); }
      else if (a === 'treu-hb') { S.subg.hores_b.splice(Number(b.closest('[data-hb]').dataset.hb), 1); return canvia(true, 'subgrups'); }
      else if (a === 'proposa-blocs') S.hor.nivells.forEach(function (n) {
        var opt = S.hor.materies.filter(function (m) { return m.nivell === n && /^Optativa/i.test(m.materia); }).map(function (m) { return m.materia; });
        if (opt.length > 1 && !RG.blocs_parallels.some(function (x) { return x.nivell === n && x.nom === 'Optatives'; })) RG.blocs_parallels.push({ nivell: n, nom: 'Optatives', materies: opt });
      });
      else return;
      if (tab === 'marc') renumeraFranges();
      canvia(true, tab === 'subgrups' ? 'blocs' : undefined);
    });
    if ($('gsAulesImp')) $('gsAulesImp').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      f.arrayBuffer().then(function (buf) { var G = llegeixGHC(buf); if (!G || !G.aules.length) return toast('Aquest fitxer no és una exportació de Clickedu (format GHC) amb aules.', true); importaClausAules(G); });
    });
    if ($('gsHorImp')) $('gsHorImp').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (t) {
        try { var j = JSON.parse(t); if (j.format === 'horaris-dades') j = j.marc_horari; if (!j || !Array.isArray(j.franges) || !Array.isArray(j.dies)) throw new Error('format');
          S.marc = { dies: j.dies.filter(function (d) { return DIES_H.indexOf(d) >= 0; }), franges: j.franges.map(function (x) { return Object.assign({ id: x.id, inici: x.inici, fi: x.fi }, x.esbarjo ? { esbarjo: true } : {}); }), no_lectives: {}, reunions: [] };
          renumeraFranges(); S.horBrut.marc = true; S.brut = true; pintaHoraris(); toast('Marc horari importat: reviseu-lo i deseu.');
        } catch (er) { toast('Aquest fitxer no és un marc_horari.json vàlid.', true); }
      });
    });
  }
  var marcNet = function () { return { dies: S.marc.dies, franges: S.marc.franges, no_lectives: {}, reunions: [] }; };
  var baixaJson = function (obj, nom) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })); a.download = nom; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  // Desa totes les pestanyes amb canvis
  function desaHoraris() {
    var parts = [['marc', errorsMarc, 'horaris_marc_desa', function () { return { marc: marcNet() }; }, function (r) { S.hor.marc = r.marc; S.hor.per_defecte = false; }],
      ['aules', errorsAules, 'horaris_aules_desa', function () { return { aules: S.aules }; }, function (r) { S.aules = r.aules; S.hor.aules = JSON.parse(JSON.stringify(r.aules)); S.hor.aules_per_defecte = false; }],
      ['regles', errorsRegles, 'horaris_regles_desa', function () { return { regles: S.regles }; }, function (r) { S.regles = r.regles; S.hor.regles = JSON.parse(JSON.stringify(r.regles)); S.hor.regles_per_defecte = false; }],
      ['subgrups', errorsSubgrups, 'horaris_subgrups_desa', function () { return { subgrups: S.subg }; }, function (r) { S.subg = r.subgrups; S.hor.subgrups = JSON.parse(JSON.stringify(r.subgrups)); S.horRecarrega = true; }],
      ['sessions', errorsSessions, 'horaris_sessions_desa', function () { return { canvis: Object.keys(S.sesBrut).map(function (id) { var x = S.ses[id]; return { id: id, distribucio: x.distribucio, aula: x.aula, conjunt: x.conjunt, fixes: x.fixes, prohibides: x.prohibides }; }) }; }, function () { S.sesBrut = {}; }],
      ['professorat', function () { return []; }, 'horaris_professorat_desa', function () { return { canvis: Object.keys(S.hprofBrut).map(function (id) { var x = S.hprof[id]; return { id: id, fixes: x.fixes, prohibides: x.prohibides, observacions: x.observacions }; }) }; }, function () { S.hprofBrut = {}; }]];
    var pend = parts.filter(function (p) { return S.horBrut[p[0]] || (p[0] === 'regles' && S.horBrut.blocs) || (p[0] === S.horTab && { marc: S.hor.per_defecte, aules: S.hor.aules_per_defecte, regles: S.hor.regles_per_defecte }[p[0]]); });
    if (!pend.length) return toast('No hi ha canvis.');
    for (var i = 0; i < pend.length; i++) { var e = pend[i][1](); if (e.length) { S.horTab = pend[i][0]; pintaHoraris(); return toast('Hi ha errors: ' + e[0], true); } }
    var seg = function (k) {
      if (k >= pend.length) { S.brut = false; S.horBrut.blocs = false; if (S.horRecarrega) { S.horRecarrega = false; carregaHoraris(); } else pintaHoraris(); return toast('Desat: ' + pend.map(function (p) { return { marc: 'marc horari', aules: 'aules', regles: 'regles i blocs', subgrups: 'subgrups (hores B)', sessions: 'sessions lectives', professorat: 'professorat' }[p[0]]; }).join(', ') + '.'); }
      var p = pend[k];
      api(p[2], p[3](), 'Desant…').then(function (r) {
        if (!r.ok) { S.horTab = p[0]; pintaHoraris(); return toast(r.errors ? r.errors.join(' ') : text(r.error), true); }
        p[4](r); S.horBrut[p[0]] = false; seg(k + 1);
      });
    };
    seg(0);
  }
  function exportaHorarisWeb() {
    if (Object.keys(S.horBrut).some(function (k) { return S.horBrut[k]; })) return toast('Primer deseu els canvis (l’exportació fa servir el que hi ha desat).', true);
    api('horaris_exporta', {}, 'Preparant les dades per al motor…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      baixaJson(r.dades, 'horaris-dades-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2') + '.json');
      toast('Dades exportades: ' + r.dades.assignacions.length + ' assignacions, ' + r.dades.docents.length + ' docents, ' + (r.dades.aules || []).length + ' aules. Deseu el fitxer a generador-horaris/dades (no el pugeu a cap repositori).');
    });
  }
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
        : '<p class="gs-ajuda" style="flex:1 1 100%;margin:0 0 4px">Equips de <strong>gestió</strong> (direcció, coordinacions, secretaria…) i <strong>docents</strong> (equips de nivell, departaments/àmbits…). El tipus només serveix per classificar-los i filtrar-los: tots dos funcionen igual. Els membres poden ser professorat o PAS, i una persona pot ser a diversos equips. <strong>Membres</strong>: cliqueu la cel·la per afegir-ne o treure’n. Els permisos, a la pestanya <strong>Permisos</strong>. Per <strong>modificar</strong> un equip, cliqueu la cel·la (nom, tipus, descripció, actiu, grups) i deseu; el codi no es pot canviar. Per <strong>esborrar-lo</strong>, la paperera (o, per conservar-lo, Actiu = no).</p>' +
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
      '<div class="gs-form-fila"><label>Tipus <select id="gsEqTipus"><option value="gestio">Gestió (direcció, secretaria, administració, consergeria…)</option><option value="docent">Docent (equips de nivell o de grup, departaments/àmbits…)</option></select></label></div>' +
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
      case 'cur-distribucio': vistaCurriculum(false, true); break;
      case 'cur-grups': vistaCurriculum(true); break;
      case 'cur-nivell': S.nivellCurr = b.dataset.nivell; document.querySelectorAll('#gsEines [data-accio="cur-nivell"]').forEach(function (x) { x.classList.toggle('is-actiu', x === b); }); aplicaFiltre(); break;
      case 'cur-genera': generaGrups(); break;
      case 'cur-resum': resumCurriculum(); break;
      case 'cur-document': documentEquips(); break;
      case 'cur-especialitat': documentEspecialitat(); break;
      case 'cur-balanc': esquemaBalanc(); break;
      case 'des-desa': desaDesiderata(); break;
      case 'des-pdf': pdfDesiderata(); break;
      case 'des-xlsx': xlsxDesiderata(); break;
      case 'des-analisi': analisiDesiderata(); break;
      case 'des-departaments': departamentsDesiderata(); break;
      case 'hor-desa': desaHoraris(); break;
      case 'hor-json': baixaJson(marcNet(), 'marc_horari.json'); break;
      case 'hor-tab': S.horTab = b.dataset.tab; pintaHoraris(); break;
      case 'hor-exporta': exportaHorarisWeb(); break;
      case 'cur-aplica-des': aplicaDesiderata(); break;
      case 'cur-comprova-des': comprovaDesiderata(); break;
      case 'des-tancament': tancamentDesiderata(); break;
      case 'cur-hores': horesLectives(); break;
      case 'cur-classes': grupsClasseNivells(); break;
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
