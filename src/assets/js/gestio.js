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
    autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'   // PAS 74: calendari com a imatge
  };
  var NIVELLS = ['consulta', 'edicio', 'admin'];
  var NOM_NIVELL = { consulta: 'Consulta', edicio: 'Edició', admin: 'Administració' };
  var TIPUS = { text: 'Text', numero: 'Número', data: 'Data', llista: 'Llista', si_no: 'Sí / no', correu: 'Correu', nif: 'NIF / NIE', calculat: 'Calculat' };

  var MISSATGES = {
    domini_no_permes: 'Cal entrar amb un compte @institutjoanmiro.cat.',
    sense_acces: 'Aquest compte no té accés a GESTIO. Si creieu que és un error, parleu amb la direcció.',
    sense_permis: 'No teniu permís per fer aquesta acció.',
    notificacions_no_configurat: 'Les notificacions encara no estan configurades: cal posar l’adreça del full notificacions_db a config › db_notificacions i executar configura.', vapid_no_configurat: 'Falten les claus de les notificacions (VAPID_PUBLIC i VAPID_PRIVATE) a les variables d’entorn de Netlify.', vapid_no_coincideixen: 'Les claus VAPID_PUBLIC i VAPID_PRIVATE de Netlify no fan parella (són de dues generacions diferents o una està mal copiada). Genereu-ne un parell nou, poseu-les totes dues, torneu a publicar i torneu a activar els avisos als dispositius.', vapid_invalid: 'Una de les claus VAPID de Netlify no és vàlida (mal copiada?). Genereu-ne un parell nou amb «npx web-push generate-vapid-keys».', cap_destinatari: 'Cap dispositiu subscrit no rebria aquest avís (ningú no ha triat aquests cursos).', avis_invalid: 'Reviseu l’avís.', massa_subscripcions: 'S’ha arribat al màxim de subscripcions.', avis_en_curs: 'Hi ha un avís que no s’ha acabat d’enviar: continueu-lo o atureu-lo abans d’enviar-ne un altre.', no_en_curs: 'Aquest avís ja no s’està enviant.',
    conflicte_versio: 'Algú altre ha desat o importat l’horari mentre l’editàveu. Torneu-lo a carregar (els vostres canvis sense desar es perdran).',
    sense_horari: 'Encara no s’ha importat cap horari.',
    fora_abast: 'Només podeu modificar l’alumnat dels vostres grups.',
    alumne_invalid: 'Trieu un alumne de la llista.', professor_invalid: 'Trieu el professor/a de la llista.',
    data_futura: 'La data dels fets no pot ser posterior a avui.', data_fora_curs: 'La data dels fets ha de ser d’aquest curs escolar.',
    fets_curts: 'Els fets han de tenir com a mínim 20 caràcters.', fets_llargs: 'Els fets poden tenir com a màxim 3.000 caràcters.', fets_invalids: 'Descriviu els fets amb paraules.',
    imatge_invalida: 'La imatge no és vàlida o és massa gran.',
    edicio_bloquejada: 'L’edició de les pàgines dels departaments/àmbits està bloquejada (data límit superada o bloqueig de l’administració).', pagina_tancada: 'Aquesta pàgina està tancada (editada i verificada): torneu-la a obrir per canviar-la.',
    cap_tancada: 'No hi ha cap pàgina tancada: només es publiquen les pàgines tancades (editades i verificades).', cal_bloquejar: 'Primer cal bloquejar l’edició.', data_invalida: 'La data no és vàlida.',
    carpeta_invalida: 'L’enllaç de la carpeta de Drive no és vàlid.', carpeta_sense_acces: 'L’Apps Script no té accés a aquesta carpeta de Drive (compartiu-la amb el compte que executa GESTIO).',
    pdf_error: 'No s’ha pogut fer el PDF.',
    camp_desconegut: 'Aquest camp no és d’hores lectives.', grup_classe_desconegut: 'Grups-classe: només lletres de grups-classe del nivell (vegeu el botó Grups-classe), separades per comes (grups) o + (units).', grup_x: 'Grups-classe: amb el nivell ESO-BAT (o per a un grup sense grup-classe) escriviu X (un grup) o «X, X» (dos grups), o deixeu-ho buit; la X no es barreja amb lletres de grups-classe.', sense_especialitat: 'No trobem la vostra especialitat a la fitxa del professorat.', marc_invalid: 'El marc horari té errors.', aules_invalides: 'Les aules tenen errors.', regles_invalides: 'Les regles tenen errors.', sessions_invalides: 'Les sessions tenen errors.', professorat_invalid: 'Les graelles del professorat tenen errors.', especialitat_repetida: 'Hi ha especialitats a més d’un departament/àmbit.', classes_buides: 'Cada nivell ha de tenir almenys un grup-classe.', separacio_invalida: 'Cal marcar almenys un grup-classe de la fila i deixar-ne algun.', hores_invalides: 'Les hores de la part han de ser més d’1 i menys que les del grup.', falta_configura: 'Cal executar «configura» a l’Apps Script (falta la columna d’hores lectives).',
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
  var ERRORS_CAMP = { grup_x: 'X (grup sense grup-classe) no es pot barrejar amb lletres de grups-classe: escriviu X o «X, X».', grup_classe_desconegut: 'només lletres de grups-classe del nivell, separades per comes (grups) o + (units).',
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
      $('gsModal').querySelector('.gs-modal__box').classList.remove('gs-modal--ample', 'gs-modal--sancions', 'gs-modal--hl', 'gs-modal--gran');
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
  // PAS 72 · Frescor de les dades: quan es llegeixen les dades d'un mòdul i quan un mòdul desa. Les dades d'un mòdul són
  // fresques si cap ALTRE mòdul ha desat res després de llegir-les (els canvis propis ja s'apliquen a la memòria local).
  var LECTURA = { horaris_dades: 'horaris', ocupacio_dades: 'ocupacio', horari_editor_dades: 'horaris_editor', calendari_dades: 'calendari', equips: 'equips', matricula_dades: 'matricula', nou_professor: 'nou_professor', nou_alumne: 'nou_alumne', departaments_web_dades: 'departaments', sancions_dades: 'sancions', notificacions_dades: 'notificacions' };
  var NOMES_LECTURA = /(^destacats_desa$|^dades$|_dades$|_informe|_analisi|_pdf$|_cerca|_llista$|_historial|^versio|_exporta|_convoca$|^matricula_formulari$|^sessio|^jo$)/;
  function fresc(m) { return S.llegit[m] && S.llegit[m].t >= S.escrit; }
  function api(accio, cos, progres) {
    var crida = fetch(API + 'api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
      body: JSON.stringify(Object.assign({ accio: accio }, cos || {})) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'error_servidor' }; }).then(function (d) { d.status = r.status; if (r.status === 401) avisSessio(); marcaFrescor(accio, d); return d; }); })
      .catch(function () { return { ok: false, error: 'error_servidor' }; });
    return progres && window.Progres ? Progres.amb(crida, progres) : crida;
  }
  function marcaFrescor(accio, d) {
    if (!d || !d.ok) return;
    var t = Date.now();
    if (LECTURA[accio]) { S.llegit[LECTURA[accio]] = { t: t }; return; }
    if (NOMES_LECTURA.test(accio)) return;
    var m = S.modul && S.modul.id;
    // PAS 75: desar a l'alumnat (ESO, batxillerat, amonestacions, control d'entrada, consell orientador) només deixa
    // obsoletes les dades que en depenen (matrícula, nou alumne/a i el formulari d'amonestació); la resta de mòduls
    // (horaris, ocupació, editor, calendari, equips…) es continuen aprofitant
    if (ESCRIU_ALUMNAT.test(accio) || (m && MODULS_ALUMNAT.indexOf(m) >= 0)) {
      ['matricula', 'nou_alumne'].forEach(function (x) { if (x !== m) delete S.llegit[x]; });
      if (m !== 'amonestacions') { S.formAmon = null; if (S.cache.amonestacions) S.cache.amonestacions.form = null; }
      if (m && S.llegit[m]) S.llegit[m].t = t + 1;
      return;
    }
    // una escriptura: la resta de mòduls queden «no fresques»; el mòdul que desa manté la seva lectura al dia
    S.escrit = t; if (m && S.llegit[m]) S.llegit[m].t = t + 1;
  }
  var MODULS_ALUMNAT = ['alumnat', 'batxillerat', 'amonestacions', 'control_entrada', 'consell_orientador', 'sancions'];
  var ESCRIU_ALUMNAT = /^(entrada_nova|entrada_estat|retards_desa|sancio_desa|sancio_esborra|amonestacio_nova|amonestacions_config|consell_config|tanca_curs|alta_alumne)$/;
  function textError(d) { var c = d && d.error || 'error_servidor'; return esc(text(c)) + '<small class="prog-avis__codi">' + esc([c, d && d.detall].filter(Boolean).join(' · ')) + '</small>'; }
  var guarda = {
    llegeix: function (k) { try { return JSON.parse(localStorage.getItem('gestio|' + k) || 'null'); } catch (e) { return null; } },
    desa: function (k, v) { try { localStorage.setItem('gestio|' + k, JSON.stringify(v)); } catch (e) { /* sense localStorage */ } }
  };
  var nivellIdx = function (n) { return NIVELLS.indexOf(n); };

  // ------------------------------------------------------------------ estat
  var S = { sessio: null, modul: null, d: null, taula: null, canvis: {}, altes: {}, nTmp: 0, brut: false, baixes: false, cache: {}, llegit: {}, escrit: 0 };

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
  // PAS 69 · Una icona pròpia i significativa per a cada mòdul (traç blau i detall taronja, 48 × 48)
  var ic = function (cos) { return '<svg class="prog-apartat__icon" aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + cos + '</svg>'; };
  var A_ = function (d) { return '<path class="prog-apartat__acc" d="' + d + '"/>'; };
  var ICONES = {
    // Personal: docent davant la pissarra · PAS amb clau
    professorat: ic('<rect x="16" y="6" width="27" height="18" rx="2"/>' + A_('M21 13h9M21 18h14') + '<circle cx="12" cy="22" r="5"/><path d="M3 42c0-6 4-11 9-11s9 5 9 11"/><path d="M17 31l7-6"/>'),
    pas: ic('<circle cx="17" cy="15" r="6"/><path d="M5 40c0-7 5-12 12-12s12 5 12 12"/>' + A_('M36 22a5 5 0 1 1 0 .1M36 27v13M36 33h4M36 37h3')),
    // Alumnat: birret ESO · birret amb diploma (batxillerat)
    alumnat: ic('<path d="M4 18 24 9l20 9-20 9z"/><path d="M12 22v9c0 3 5 6 12 6s12-3 12-6v-9"/>' + A_('M44 18v11')),
    batxillerat: ic('<path d="M6 15 22 8l16 7-16 7z"/><path d="M12 18v7c0 2 4 4 10 4s10-2 10-4v-7"/>' + '<rect x="28" y="30" width="16" height="10" rx="5"/>' + A_('M33 30v10M39 30v10')),
    control_entrada: ic('<circle cx="24" cy="26" r="15"/><path d="M24 17v9l6 4"/>' + A_('M19 5h10M24 5v6M37 13l3-3')),
    amonestacions: ic('<path d="M10 6h20l8 8v28H10z"/><path d="M30 6v8h8"/>' + A_('M24 19v10M24 34v.5')),
    notificacions: ic('<path d="M14 20a10 10 0 0 1 20 0c0 11 5 14 5 14H9s5-3 5-14"/><path d="M21 39a3.4 3.4 0 0 0 6 0"/>' + A_('M38 8a12 12 0 0 1 4 9M10 8a12 12 0 0 0-4 9')),   // PAS 81: campana
    sancions: ic('<path d="M8 42h24M12 38h16"/><path d="M17 33 30 20M27 12l9 9-6 6-9-9z"/>' + A_('M34 10l4-4M40 16l4-4')),   // PAS 76: mall del jutge
    consell_orientador: ic('<circle cx="24" cy="24" r="17"/>' + A_('M31 17l-4 10-10 4 4-10z') + '<path d="M24 5v4M24 39v4M5 24h4M39 24h4"/>'),
    // Secretaria: altes noves (fitxa amb el signe +)
    nou_professor: ic('<rect x="6" y="9" width="28" height="32" rx="3"/><circle cx="20" cy="20" r="4"/><path d="M12 33c0-4 4-7 8-7s8 3 8 7"/>' + A_('M39 24v12M33 30h12')),
    nou_alumne: ic('<path d="M4 17 20 10l16 7-16 7z"/><path d="M10 20v7c0 2 4 5 10 5s10-3 10-5v-7"/>' + A_('M39 28v12M33 34h12')),
    matricula: ic('<path d="M12 5h18l8 8v30H12z"/><path d="M30 5v8h8"/><path d="M17 20h14M17 26h10"/>' + A_('M18 35l4 4 8-8')),
    rebuts: ic('<path d="M10 5h28v38l-5-3-4 3-5-3-4 3-5-3-5 3z"/><path d="M16 14h16M16 20h16"/>' + A_('M28 28c-1-1.5-2.5-2-4-2-2.5 0-4 1.3-4 3s1.5 2.5 4 3 4 1.3 4 3-1.5 3-4 3c-1.5 0-3-.5-4-2M24 24v2M24 37v2')),
    // Organització del curs
    curriculum: ic('<path d="M6 10c6-3 12-3 18 1v30c-6-4-12-4-18-1z"/><path d="M42 10c-6-3-12-3-18 1v30c6-4 12-4 18-1z"/>' + A_('M10 18h9M10 24h9M29 18h9M29 24h9')),
    desiderata: ic('<rect x="9" y="8" width="30" height="34" rx="3"/><path d="M18 5h12v6H18z"/>' + A_('M15 22l3 3 5-5M15 33l3 3 5-5') + '<path d="M28 23h6M28 34h6"/>'),
    ocupacio: ic('<path d="M6 40h36"/><rect x="9" y="26" width="6" height="14"/><rect x="21" y="16" width="6" height="24"/><rect x="33" y="21" width="6" height="19"/>' + A_('M6 13h36')),
    horaris: ic('<rect x="6" y="9" width="36" height="32" rx="3"/><path d="M6 17h36M15 5v7M33 5v7"/>' + A_('M14 25h8M26 25h8M14 33h8') + '<path d="M38 31l3 3-3 3"/>'),
    horaris_editor: ic('<rect x="6" y="9" width="36" height="32" rx="3"/><path d="M6 17h36M18 17v24M30 17v24M6 25h36M6 33h36M15 5v7M33 5v7"/>' + A_('M33 44l11-11-3-3-11 11-1 4z')),
    departaments: ic('<path d="M6 42h36M9 42V20M39 42V20M5 20 24 7l19 13z"/><path d="M16 42V26h16v16"/>' + A_('M20 31h8M20 36h8')),   // PAS 75
    calendari: ic('<rect x="6" y="9" width="36" height="32" rx="3"/><path d="M6 17h36M15 5v7M33 5v7"/>' + A_('M14 24h4M22 24h4M30 24h4M14 31h4M22 31h4') + '<circle cx="32" cy="32" r="3"/>'),
    // Administració
    equips: ic('<circle cx="16" cy="17" r="5"/><circle cx="32" cy="17" r="5"/><path d="M6 36c0-6 4-10 10-10s10 4 10 10"/><path d="M22 36c0-6 4-10 10-10s10 4 10 10"/>' + A_('M21 6h6v4h-6zM24 10v3')),
    generic: ic('<rect x="8" y="8" width="32" height="32" rx="4"/>' + A_('M16 20h16M16 28h10'))
  };
  // PAS 49: portada amb els mòduls agrupats (Personal, Alumnat, Organització del curs, Administració…). El grup surt de la
  // pestanya «moduls» (columna grup). Amb més de 4 mòduls, a dalt hi ha pestanyes per veure'n només un grup (es recorda).
  var ORDRE_GRUPS = ['Personal', 'Alumnat', 'Secretaria', 'Organització del curs', 'Administració', 'Altres'];
  function pintaPortada() {
    var ms = S.sessio.moduls, grups = [];
    ms.forEach(function (m) { var g = m.grup || 'Altres'; if (grups.indexOf(g) < 0) grups.push(g); });
    grups.sort(function (a, b) { var i = ORDRE_GRUPS.indexOf(a), j = ORDRE_GRUPS.indexOf(b); return (i < 0 ? 50 : i) - (j < 0 ? 50 : j) || a.localeCompare(b, 'ca'); });
    var amb = ms.length > 4 && grups.length > 1, sel = '';
    try { sel = localStorage.getItem('gestio_grup') || ''; } catch (e) { /* sense memòria */ }
    if (grups.indexOf(sel) < 0) sel = '';
    var dest = (S.sessio.destacats || []).filter(function (id) { return ms.some(function (m) { return m.id === id; }); });
    var targeta = function (m) {
      // PAS 84 · Targeta petita: icona i nivell a la dreta, el nom a sota; la descripció surt en passar-hi el ratolí
      // PAS 85 · Estrella: afegeix o treu el mòdul dels Destacats (fora de l'enllaç: un botó no pot anar dins d'un <a>)
      var on = dest.indexOf(m.id) >= 0;
      return '<div class="gs-mod-w"><a class="prog-apartat gs-mod" href="#' + esc(m.id) + '"><span class="gs-mod__cap">' + (ICONES[m.id] || ICONES.generic) +
        '<span class="gs-tag gs-tag--' + esc(m.nivell) + '">' + esc(NOM_NIVELL[m.nivell] || m.nivell) + '</span></span>' +
        '<span class="prog-apartat__nom">' + esc(m.nom) + '</span>' +
        (m.descripcio ? '<span class="gs-mod__tip" role="tooltip">' + esc(m.descripcio) + '</span>' : '') + '</a>' +
        '<button type="button" class="gs-mod__estrella' + (on ? ' is-on' : '') + '" data-destacat="' + esc(m.id) + '" aria-pressed="' + on + '" title="' + (on ? 'Treu dels destacats' : 'Afegeix als destacats') + '" aria-label="' + (on ? 'Treu ' : 'Afegeix ') + esc(m.nom) + (on ? ' dels destacats' : ' als destacats') + '">' + (on ? '★' : '☆') + '</button></div>';
    };
    var html = amb ? '<div class="gs-pestanyes gs-portada__tabs" role="tablist" aria-label="Grups de mòduls">' + [''].concat(grups).map(function (g) {
      var n = g ? ms.filter(function (m) { return (m.grup || 'Altres') === g; }).length : ms.length;
      return '<button type="button" role="tab" data-grup="' + esc(g) + '" aria-selected="' + (g === sel) + '">' + esc(g || 'Tots') + ' <span class="gs-portada__n">' + n + '</span></button>'; }).join('') + '</div>' : '';
    // PAS 85 · Destacats: els mòduls marcats amb l'estrella, a dalt de tot (sempre, sigui quina sigui la pestanya). Sense cap, no surt.
    if (dest.length) html = '<section class="gs-portada__grup gs-portada__dest"><h2 class="gs-portada__titol">★ Destacats</h2><div class="gs-portada__targetes">' + dest.map(function (id) { return targeta(ms.filter(function (m) { return m.id === id; })[0]); }).join('') + '</div></section>' + html;
    html += grups.filter(function (g) { return !sel || g === sel; }).map(function (g) {
      var mg = ms.filter(function (m) { return (m.grup || 'Altres') === g; });
      return '<section class="gs-portada__grup">' + (grups.length > 1 ? '<h2 class="gs-portada__titol">' + esc(g) + '</h2>' : '') + '<div class="gs-portada__targetes">' + mg.map(targeta).join('') + '</div></section>';
    }).join('');
    $('gsModuls').innerHTML = html;
    [].forEach.call($('gsModuls').querySelectorAll('[data-destacat]'), function (b) { b.addEventListener('click', function () { commutaDestacat(b.dataset.destacat); }); });
    [].forEach.call($('gsModuls').querySelectorAll('[data-grup]'), function (b) { b.addEventListener('click', function () { try { localStorage.setItem('gestio_grup', b.dataset.grup); } catch (e) { /* res */ } pintaPortada(); }); });
  }
  // PAS 85 · Afegeix o treu un mòdul dels Destacats: es veu de seguida i es desa per a la persona (a qualsevol dispositiu)
  function commutaDestacat(id) {
    var abans = (S.sessio.destacats || []).slice(), d = abans.slice(), i = d.indexOf(id);
    if (i >= 0) d.splice(i, 1); else d.push(id);
    S.sessio.destacats = d; pintaPortada();
    api('destacats_desa', { destacats: d }).then(function (r) {
      if (!r.ok) { S.sessio.destacats = abans; pintaPortada(); return toast(r.error === 'accio_desconeguda' || r.error === 'gestio_accio_desconeguda' ? 'Cal l’Apps Script nou per desar els destacats.' : text(r.error), true); }
      S.sessio.destacats = r.destacats;
    });
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
    // PAS 57: el calendari i l'ocupació també tenen el seu desplaçament vertical (abans no es veia tot)
    var cl = document.querySelector('#gsTaula.gs-cal, #gsTaula.gs-ocu'); if (cl) { cl.style.maxHeight = h; cl.style.overflowY = 'auto'; }
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
    if (m.id === 'nou_alumne') return carregaNouAlumne();   // PAS 68
    if (m.id === 'matricula') return carregaMatricula();   // PAS 70
    if (m.id === 'departaments') return carregaDepartaments();   // PAS 75
    if (m.id === 'sancions') return carregaSancions();   // PAS 76
    if (m.id === 'notificacions') return carregaNotificacions();   // PAS 81
    if (m.id === 'desiderata') return carregaDesiderata();
    // PAS 72: el planificador, l'ocupació i l'editor reutilitzen les dades ja llegides si cap altre mòdul n'ha desat
    // res des d'aleshores («Actualitza» les torna a llegir)
    if (m.id === 'horaris') return fresc('horaris') && S.hor ? reobreHoraris() : carregaHoraris();
    if (m.id === 'calendari') return carregaCalendari();   // PAS 56
    if (m.id === 'ocupacio') return fresc('ocupacio') && S.ocu && S.ocu.r ? (S.d = { files: [], camps: [], nivell: S.ocu.r.nivell, obert: S.ocu.r.obert }, S.ocu.brut = {}, pintaOcupacio()) : carregaOcupacio();   // PAS 57
    if (m.id === 'horaris_editor') return fresc('horaris_editor') && S.he && S.he.r ? (S.d = { files: [], camps: [], nivell: S.he.r.nivell, obert: S.he.r.obert }, S.he.canvis = 0, pintaEditorHoraris()) : carregaEditorHoraris();   // PAS 64
    // Les dades ja llegides en aquesta pàgina es reutilitzen: tornar al mòdul no torna a cridar el full
    // PAS 62: les dues vistes del Currículum es tornen a llegir sempre (les hores de les matèries canviades a «Matèries» han
    // d'arribar a «Assignacions»; abans quedava l'avís ⚠ amb les hores antigues)
    // PAS 71: el Currículum també aprofita les dades ja llegides; només es tornen a llegir quan un canvi les ha deixat
    // obsoletes (desar les matèries invalida les assignacions; generar, separar o aplicar la desiderata, també)
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
    // Les sancions (estat, finestra de l'alumne/a) necessiten l'Apps Script del PAS 76 o posterior: un de més antic no
    // envia «pot_sancionar». Amb l'administració, es diu clarament què falta (si no, la finestra del doble clic surt sense la part esquerra)
    if ((S.modul.id === 'amonestacions' || S.modul.id === 'control_entrada') && d.pot_sancionar === undefined && nivellIdx(d.nivell) >= 2) {
      $('gsAvis').innerHTML = 'L’<strong>Apps Script desplegat és anterior a les sancions</strong>: per això no es poden crear sancions ni canviar l’estat. Obriu l’Apps Script, enganxeu-hi el <code>Code.gs</code> nou (ESQUEMA 76 o posterior), executeu <strong>configura</strong> i, a <strong>Implementa › Gestiona les implementacions</strong>, editeu la implementació que ja feu servir (el llapis) i trieu <strong>Versió nova</strong>. No en creeu una de nova: canviaria l’adreça. Després, torneu a carregar aquesta pàgina.';
      $('gsAvis').hidden = false;
    }
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
        (S.d.sancions ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="sancions-llista" title="Gestió de les sancions: llista, filtres, nova, edita, anul·la, esborra">Sancions (' + S.d.sancions.length + ')</button>' : '') +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="entrada-analisi">Anàlisi</button>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="columnes">Visualització camps</button>' +
        (esAdmin() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="camps">Gestió camps</button>' : '') +
        (esAdmin() ? BOTO_ACTUALITZA : '') +
        '<span class="gs-exporta"><button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button></span>';
      pintaRetards(); lligaPeriode();
      // PAS 73: filtre per estat de les entrades (a més del filtre de la columna)
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
      // PAS 57: «Carrega dades des del Currículum» passa al mòdul Ocupació
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
    // PAS 62: si es filtra per nivell (botons de nivell o filtre de la columna Nivell), els valors de les altres columnes són
    // només els d'aquell nivell (p. ex. el filtre Matèria del Currículum només té les matèries del nivell)
    var fn = null;
    if (camp !== 'nivell' && S.taula) {
      var fN = null; try { fN = S.taula.getHeaderFilterValue('nivell'); } catch (e) { fN = null; }
      var nc = typeof esCurriculum === 'function' && esCurriculum() && S.nivellCurr ? S.nivellCurr : '';
      if (nc || (fN && (fN.s || fN.t))) fn = function (d) { var n = String(d.nivell || ''); if (nc && n !== nc) return false; if (fN && fN.s && fN.s.indexOf(n) < 0) return false; if (fN && fN.t && !conte(n, fN.t)) return false; return true; };
    }
    (S.taula ? S.taula.getData() : S.d.files).filter(function (d) { return !fn || fn(d); }).forEach(function (d) { var v = d[camp] == null ? '' : String(d[camp]).trim(); if (v === '') buit = true; else vist[v] = 1; });
    return Object.keys(vist).sort(function (a, b) { return a.localeCompare(b, 'ca', { numeric: true }); }).map(function (x) { return { v: x, t: x }; }).concat(buit ? [BUIT] : []);
  }
  var ordreNivell = function (v) { var o = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'], i = o.indexOf(String(v || '').replace(/\bBat\b/i, 'BAT')); return i < 0 ? (v ? 50 : 99) : i; };
  function filtreDe(c, compacte) {
    var opts = c.tipus === 'si_no' ? function () { return [{ v: 'sí', t: 'sí' }, { v: '', t: 'no' }]; }
      // PAS 53: també els valors que hi ha a les dades i que ja no són a la llista (p. ex. un docent que ja no és en actiu)
      : c.tipus === 'llista' ? function () { var ll = c.valors.split('|').map(function (x) { return x.trim(); }); return ll.map(function (x) { return { v: x, t: x }; })
        .concat(valorsDiferents(c.clau).filter(function (o) { return o !== BUIT && ll.indexOf(o.v) < 0; }).map(function (o) { return { v: o.v, t: o.t + ' (fora de la llista)' }; })).concat([BUIT]); }
      : c.tipus === 'data' ? function () { return valorsDiferents(c.clau).map(function (o) { return o === BUIT ? o : { v: o.v, t: dataVista(o.v) }; }); }
      : function () { return valorsDiferents(c.clau); };
    // PAS 47: el filtre Nivell, en l'ordre de les etapes (ESO i després batxillerat), no alfabètic
    if (c.clau === 'nivell') { var base = opts; opts = function () { return base().slice().sort(function (a, b) { return ordreNivell(a.v) - ordreNivell(b.v); }); }; }
    // L'estat dels registres (control d'entrada, amonestacions) es filtra amb el nom del color i el que vol dir
    if (c.clau === 'estat' && esRegistre()) { var baseE = opts; opts = function () { return baseE().map(function (o) { return o === BUIT ? o : { v: o.v, t: o.v + (TEXT_ESTAT_ENT[o.v] ? ' · ' + TEXT_ESTAT_ENT[o.v].toLowerCase() : '') }; }); }; }
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
    // PAS 73: al control d'entrada, «Estat» sempre és la primera columna (encara que el full de camps tingui un altre ordre)
    if (esRegistre()) camps = camps.filter(function (c) { return c.clau === 'estat'; }).concat(camps.filter(function (c) { return c.clau !== 'estat'; }));   // PAS 76: també a amonestacions
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
      // PAS 72/76 · Control d'entrada i amonestacions: l'estat és un punt de color (blanc = res; groc = justificat; vermell =
      // sanció en curs; verd = sancionat). Al control d'entrada, l'administració marca/desmarca «justificat» amb un clic.
      if (esRegistre() && c.clau === 'estat') Object.assign(col, { width: 74, minWidth: 64, hozAlign: 'center', headerHozAlign: 'center', frozen: true,
        formatter: function (cell) { var v = cell.getValue() || 'blanc', d = cell.getRow().getData(), clic = S.modul.id === 'control_entrada' && S.d.pot_sancionar && !d.id_sancio && (v === 'blanc' || v === 'groc');
          return '<span class="gs-punt gs-punt--' + esc(v) + (clic ? ' gs-punt--clic' : '') + '" title="' + esc(TEXT_ESTAT_ENT[v] || v) + (d.id_sancio ? ' · ' + esc(d.id_sancio) : '') + (clic ? ' · clic: ' + (v === 'groc' ? 'treu el justificat' : 'marca com a justificat') : '') + '"></span>'; },
        cellClick: function (e, cell) { var d = cell.getRow().getData(); if (S.modul.id === 'control_entrada' && S.d.pot_sancionar && !d.id_sancio) justificaEntrada(cell.getRow()); },
        accessorDownload: function (v) { return TEXT_ESTAT_ENT[v || 'blanc'] || v; } });
      if (esRegistre() && c.clau === 'id_sancio') return;
      if (c.tipus === 'si_no') col.formatter = function (cell) { return cell.getValue() === 'sí' ? '<span class="gs-si">sí</span>' : ''; };
      if (esRegistre() && c.clau === 'alumne' && S.d.retards) col.formatter = function (cell) {
        var d = cell.getRow().getData(), k = d.id_alumne || plega(d.alumne), av = (S.avisRetards || {})[k];
        // PAS 87 · L'etiqueta de l'avís (només als alumnes que compleixen el criteri): «X · Z sanc.», X = retards del període
        // triat a dalt (sense les justificades) i Z = quants d'aquests són sancionats (verds) o en tràmit (vermells)
        var T = (S.totRetards || {})[k] || { tot: av, sanc: 0 }, ne = (S.avisEntrades || {})[k], R = S.d.retards, des = dataVista(iniciPeriode(R.periode));
        return esc(cell.getValue()) + (av ? ' <span class="gs-avis-ret" title="' + esc(T.tot + ' retards en ' + R.periode + ' (des del ' + des + '; sense les entrades justificades). D’aquests, ' + T.sanc + ' ja són sancionats (verds) o en tràmit (vermells) i ' + (T.tot - T.sanc) + ' encara no. ' +
          'Surt l’avís perquè compleix el criteri: ' + R.quantitat + ' retards o més en ' + R.periode + ' (en té ' + av + (ambVerdes() ? '' : ', sense comptar els verds') + ', en ' + ne + (ne === 1 ? ' entrada' : ' entrades') + '). Cada entrada compta segons l’hora: ' + TEXT_PES_RETARD + '.') + '">⚠ ' + T.tot + ' <small>· ' + T.sanc + ' sanc.</small></span>' : '');
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
    // PAS 73: un camp que no existia quan es va desar la tria (p. ex. «Estat» del control d'entrada) es mostra
    var coneguts = guarda.llegeix('cols-tots|' + S.modul.id), NOUS_PAS72 = { control_entrada: ['estat'], amonestacions: ['estat'] };
    var nou = function (f) { return Array.isArray(coneguts) ? coneguts.indexOf(f) < 0 : (NOUS_PAS72[S.modul.id] || []).indexOf(f) >= 0; };
    if (Array.isArray(visibles)) cols.forEach(function (c) { if (c.field && c.field.charAt(0) !== '_' && c.field !== 'id' && visibles.indexOf(c.field) < 0 && !nou(c.field)) c.visible = false; });
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
    // PAS 76: doble clic → finestra de l'alumne/a: a l'esquerra, sanció amb les amonestacions triades (només l'administració); a la dreta, les seves amonestacions
    if (esAmon()) S.taula.on('rowDblClick', function (e, row) { try { window.getSelection().removeAllRanges(); } catch (x) { /* res */ } dialegAlumneAmon(row.getData()); });
    // PAS 72: control d'entrada → doble clic a un alumne/a obre les seves entrades i sancions
    if (S.modul.id === 'control_entrada') S.taula.on('rowDblClick', function (e, row) { try { window.getSelection().removeAllRanges(); } catch (x) { /* res */ } dialegSancio(row.getData()); });
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
        // PAS 71: les hores i els grups de les matèries arriben a les assignacions: la vista d'assignacions es tornarà a llegir
        if (S.modul.id === 'curriculum') delete S.cache.curriculum_grups;
        document.querySelectorAll('#gsTaula .gs-canviat').forEach(function (el) { el.classList.remove('gs-canviat'); });
        S.taula.getRows().forEach(function (rw) { rw.reformat(); });
        aplicaFiltre();
        // PAS 56: el substitut ha heretat dades de la persona substituïda (es tornen a llegir per veure-les a la graella)
        // PAS 79: les matèries (Currículum › Assignacions i horari calculat) passen al substitut, o tornen a la persona titular
        if (r.transferides) { ['curriculum', 'curriculum_grups', 'horaris_editor', 'ocupacio'].forEach(function (k) { delete S.cache[k]; }); if (S.he) S.he.r = null; }
        if (r.herencia || r.transferides) { toast('Desat.' + (r.herencia ? ' El substitut ha heretat ' + r.herencia + ' dades d’ocupació (lectives, càrrec, guàrdies…) de la persona substituïda.' : '') + (r.transferides ? ' Matèries transferides: ' + r.transferides + ' (assignacions del Currículum i sessions de l’horari).' : '')); delete S.cache[S.modul.id]; carregaDades(); return; }
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
      guarda.desa('cols-tots|' + S.modul.id, cols.map(function (c) { return c.getField(); }));   // PAS 73: els camps nous (no vistos en desar) es mostren
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
        estils: { fontSize: 10, minCellHeight: 10, cellPadding: 2, lineColor: [70, 72, 90], lineWidth: 0.35 },   // PAS 56: línies més gruixudes i fosques (es veuen en imprimir)
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
      '<div class="gs-form-fila"><label><span>Hores que es queda aquesta part</span> <input type="number" id="gsDivH" min="1" max="' + (h - 1) + '" step="1" value="' + Math.max(1, Math.floor(h - 1)) + '"></label>' +
      '<label><span>Especialitat de la part nova (<span id="gsDivR"></span> h)</span> <select id="gsDivE">' + esp.map(function (e) { return '<option' + (e === d.especialitat ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></label></div><p class="prog-avis" id="gsDivErr" hidden></p>',
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
        ['curriculum', 'curriculum_grups'].forEach(function (k) { if (S.cache[k]) S.cache[k].professorat_hores = r2.professorat; });   // PAS 71: sense tornar a llegir
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
    var files = S.d.files.map(function (f) { var m = materiaDe(f) || {}; return { nivell: f.nivell, materia: f.materia, de: m.especialitat || '', a: f.especialitat || '', hores: numero(f.hores), codo: numero(m.docents) > 1 }; });
    var esps = {}; files.forEach(function (f) { if (f.de) esps[f.de] = 1; if (f.a) esps[f.a] = 1; }); (S.d.professorat_hores || []).forEach(function (p) { if (p.especialitat) esps[p.especialitat] = 1; });
    // PAS 75: es marca la codocència (docents a l'aula ≥ 2 a la matèria): el pas del ratolí per sobre de les hores ho indica
    var trans = {}; files.forEach(function (f) { if (!f.de || !f.a || f.de === f.a) return; var k = f.de + '→' + f.a; var t = trans[k] = trans[k] || { de: f.de, a: f.a, hores: 0, codo: 0, det: {} }; t.hores += f.hores; if (f.codo) t.codo += f.hores; var d = f.nivell + ' ' + f.materia + (f.codo ? ' (codocència)' : ''); t.det[d] = (t.det[d] || 0) + f.hores; });
    var llista = Object.keys(esps).sort(function (a, b) { return a.localeCompare(b, 'ca'); }).map(function (e) { var D = dadesEspecialitat(e); return { e: e, balanc: D.balanc, tE: D.tE, tP: D.tP, tC: D.tC, tA: D.tA }; });
    return { esps: llista, trans: Object.keys(trans).map(function (k) { return trans[k]; }) };
  }
  function svgBalanc(B, nomesTrans) {
    var amb = {}; B.trans.forEach(function (t) { amb[t.de] = amb[t.a] = 1; });
    var es = B.esps.filter(function (x) { return !nomesTrans || amb[x.e]; });
    var n = es.length, bw = 168, bh = 58, R = Math.max(230, n * 30), W = 2 * R + bw + 80, H = 2 * R + bh + 80, cx = W / 2, cy = H / 2, pos = {};
    es.forEach(function (x, i) { var a = -Math.PI / 2 + 2 * Math.PI * i / Math.max(1, n); pos[x.e] = (B.mou || {})[x.e] || { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });   // PAS 75: posicions arrossegades
    var color = function (b) { return Math.abs(b) < 0.01 ? ['#E3F3EA', '#0F9D58'] : b < 0 ? ['#FDE8E8', '#C62828'] : ['#ECEAFD', '#1C0CBC']; };
    var vora = function (p, q) { // punt de la vora de la caixa p en direcció a q
      var dx = q.x - p.x, dy = q.y - p.y, sx = (bw / 2 + 6) / Math.abs(dx || 1e-6), sy = (bh / 2 + 6) / Math.abs(dy || 1e-6), s = Math.min(sx, sy); return { x: p.x + dx * s, y: p.y + dy * s };
    };
    var fl = B.trans.filter(function (t) { return pos[t.de] && pos[t.a]; }).map(function (t) {
      var p = vora(pos[t.de], pos[t.a]), q = vora(pos[t.a], pos[t.de]), mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, dx = q.x - p.x, dy = q.y - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      var ox = -dy / l * 26, oy = dx / l * 26, kx = mx + ox, ky = my + oy, lx = (p.x + 2 * kx + q.x) / 4, ly = (p.y + 2 * ky + q.y) / 4;
      var tip = t.de + ' → ' + t.a + ': ' + fmtH(t.hores) + ' h' + '\n' + Object.keys(t.det).map(function (d) { return '· ' + d + ': ' + fmtH(t.det[d]) + ' h'; }).join('\n');
      return '<g class="gs-bal__fl"><title>' + esc(tip) + '</title><path d="M' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' Q' + kx.toFixed(1) + ',' + ky.toFixed(1) + ' ' + q.x.toFixed(1) + ',' + q.y.toFixed(1) + '" fill="none" stroke="#E8600C" stroke-width="' + Math.min(6, 1.5 + t.hores / 4).toFixed(1) + '" marker-end="url(#gsBalPunta)" opacity=".85"/>' +
        '<rect x="' + (lx - 22).toFixed(1) + '" y="' + (ly - 10).toFixed(1) + '" width="44" height="20" rx="10" fill="#fff" stroke="#E8600C"/><text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#B54700">' + esc(fmtH(t.hores)) + ' h' + (t.codo ? '*' : '') + '</text></g>';
    }).join('');
    var caixes = es.map(function (x) {
      var p = pos[x.e], c = color(x.balanc), nom = x.e.length > 22 ? x.e.slice(0, 21) + '…' : x.e;
      return '<g class="gs-bal__caixa" data-e="' + esc(x.e) + '"><title>' + esc(x.e + '\nHores de l’especialitat: ' + fmtH(x.tE) + '\n− cedides: ' + fmtH(x.tC) + '\n+ assignades d’altres: ' + fmtH(x.tA) + '\nProfessorat: ' + fmtH(x.tP) + '\nBalanç: ' + fmtH(x.balanc)) + '</title>' +
        '<rect x="' + (p.x - bw / 2).toFixed(1) + '" y="' + (p.y - bh / 2).toFixed(1) + '" width="' + bw + '" height="' + bh + '" rx="10" fill="' + c[0] + '" stroke="' + c[1] + '" stroke-width="2"/>' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 6).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="600" fill="#1E1E2A">' + esc(nom) + '</text>' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 17).toFixed(1) + '" text-anchor="middle" font-size="16" font-weight="800" fill="' + c[1] + '">' + (x.balanc > 0 ? '+' : '') + esc(fmtH(x.balanc)) + ' h</text></g>';
    }).join('');
    // PAS 76: el marc s'ajusta a totes les caixes (també les arrossegades fora del cercle inicial) i a les etiquetes de les fletxes,
    // perquè cap caixa quedi tallada a l'esquerra o a la dreta. Mentre s'arrossega, el marc només creix (no salta).
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, inclou = function (x, y) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    es.forEach(function (x) { var p = pos[x.e]; inclou(p.x - bw / 2, p.y - bh / 2); inclou(p.x + bw / 2, p.y + bh / 2); });
    if (!es.length) { inclou(0, 0); inclou(W, H); }
    x0 -= 40; y0 -= 40; x1 += 40; y1 += 40;
    // ... i, a la finestra, ocupa com a mínim tot l'espai visible (les caixes es poden portar fins a la vora)
    if (B.minW && x1 - x0 < B.minW) { var ex = (B.minW - (x1 - x0)) / 2; x0 -= ex; x1 += ex; }
    if (B.minH && y1 - y0 < B.minH) { var ey = (B.minH - (y1 - y0)) / 2; y0 -= ey; y1 += ey; }
    if (B.marc) { x0 = Math.min(x0, B.marc[0]); y0 = Math.min(y0, B.marc[1]); x1 = Math.max(x1, B.marc[2]); y1 = Math.max(y1, B.marc[3]); }
    if (B.arrossega) B.marc = [x0, y0, x1, y1]; else B.marc = null;
    W = x1 - x0; H = y1 - y0;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + x0.toFixed(0) + ' ' + y0.toFixed(0) + ' ' + W.toFixed(0) + ' ' + H.toFixed(0) + '" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '" font-family="Montserrat, Helvetica, Arial, sans-serif"><defs><marker id="gsBalPunta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#E8600C"/></marker></defs>' +
      '<rect x="' + x0.toFixed(0) + '" y="' + y0.toFixed(0) + '" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '" fill="#fff"/>' + fl + caixes + '</svg>';
  }
  function esquemaBalanc() {
    if (S.modul.id !== 'curriculum_grups') return;
    if (!S.d.files.length) return toast('No hi ha assignacions: primer genereu els grups.', true);
    var B = dadesBalanc();
    pregunta('Balanç i transferències', '<p class="gs-ajuda">Cada caixa és una especialitat amb el seu <strong>balanç</strong> d’hores (hores lectives del professorat − hores a impartir): <span class="gs-bal__l gs-bal__l--0">0 = quadra</span> <span class="gs-bal__l gs-bal__l--n">negatiu = falten hores</span> <span class="gs-bal__l gs-bal__l--p">positiu = sobren</span>. Cada <strong>fletxa</strong> va de l’especialitat de la matèria a la que la imparteix, amb les hores transferides (passeu el ratolí per sobre per veure les matèries; <strong>*</strong> = hi ha hores de codocència). Les caixes es poden <strong>arrossegar</strong> amb el ratolí.</p>' +
      '<div class="gs-form-fila"><label class="gs-check"><input type="checkbox" id="gsBalTrans" checked> Només les especialitats amb transferències</label><span class="gs-gris">' + B.trans.length + ' transferències · ' + B.esps.length + ' especialitats</span></div><div class="gs-bal" id="gsBal"></div>',
      [{ t: 'PDF', valor: 0, tipus: 'ghost', abans: function () { pdfBalanc(B, $('gsBalTrans').checked); return false; } }, { t: 'Tanca', valor: 1 }], false);
    // PAS 75: finestra més gran i caixes arrossegables amb el ratolí (les fletxes les segueixen; el PDF surt tal com es veu)
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample', 'gs-modal--gran');
    B.mou = B.mou || {};
    var pinta = function () { var c = $('gsBal'); B.minW = c.clientWidth - 2; B.minH = c.clientHeight - 2; c.innerHTML = svgBalanc(B, $('gsBalTrans').checked); };
    $('gsBalTrans').addEventListener('change', pinta); pinta();
    var arr = null, punt = function (e) { var svg = $('gsBal').querySelector('svg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    $('gsBal').addEventListener('pointerdown', function (e) {
      var g = e.target.closest('.gs-bal__caixa'); if (!g) return;
      var r = g.querySelector('rect'), p = punt(e), x0 = Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2, y0 = Number(r.getAttribute('y')) + Number(r.getAttribute('height')) / 2;
      arr = { e: g.getAttribute('data-e'), dx: p.x - x0, dy: p.y - y0 }; B.arrossega = true; e.preventDefault();
    });
    $('gsBal').addEventListener('pointermove', function (e) { if (!arr) return; var p = punt(e); B.mou[arr.e] = { x: p.x - arr.dx, y: p.y - arr.dy }; pinta(); });
    var deixa = function () { if (arr) { arr = null; B.arrossega = false; pinta(); } }; $('gsBal').addEventListener('pointerup', deixa); $('gsBal').addEventListener('pointerleave', deixa);
  }
  function pdfBalanc(B, nomesTrans) {
    var mw = B.minW, mh = B.minH; B.minW = B.minH = 0; var svg = svgBalanc(B, nomesTrans); B.minW = mw; B.minH = mh; var m = /width="(\d+)" height="(\d+)"/.exec(svg), w = Number(m[1]), h = Number(m[2]);
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
    // PAS 74: una sola comprovació (abans n'hi havia dues seguides i la segona no mostrava cap progrés: semblava penjat)
    api('curriculum_aplica_desiderata', { prova: true, sobreescriu: true }, 'Comprovant la desiderata…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      (r.buits !== undefined ? Promise.resolve({ posats: r.buits }) : api('curriculum_aplica_desiderata', { prova: true }, 'Comprovant la desiderata…')).then(function (r0) {
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
      var T = { falta: 'Falten grups', fora: 'No és a la desiderata', diferent: 'Grups diferents', no_actiu: 'Docent no en actiu', fora_no_actiu: 'No és a la desiderata i ja no és en actiu' };
      var B = r.bloqueig || {};
      pregunta('Comprova la desiderata', (B.bloquejada ? '' : '<p class="gs-des__estat is-avis">⚠ La desiderata no està bloquejada: els caps encara la poden canviar.</p>') +
        '<p><b>' + r.correctes + '</b> assignacions coincideixen amb la desiderata' + (r.sense_desiderata ? ' · <b>' + r.sense_desiderata + '</b> sense desiderata desada' : '') + '.</p>' +
        (r.incoherencies.length ? '<p class="prog-avis">' + r.incoherencies.length + ' incoherències:</p><div class="gs-comprova"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Assignació</th><th>Docent</th><th class="gs-cen">Desiderata</th><th class="gs-cen">Assignats</th><th>Què passa</th></tr></thead><tbody>' +
          r.incoherencies.map(function (x) { return '<tr><td>' + esc(x.assignacio) + '<br><small class="gs-gris">' + esc(x.especialitat) + '</small></td><td>' + esc(x.docent) + (x.grups && x.grups.length ? '<br><small class="gs-gris">' + esc(x.grups.join(', ')) + '</small>' : '') + '</td><td class="gs-cen">' + x.desiderata + '</td><td class="gs-cen">' + x.assignats + '</td><td>' + esc(T[x.tipus] || x.tipus) + '</td></tr>'; }).join('') + '</tbody></table></div>'
          : r.correctes ? '<p class="is-ok">✓ Les assignacions coincideixen amb la desiderata.</p>' : '<p class="gs-gris">Encara no hi ha cap desiderata desada per comparar.</p>'),
        [{ t: 'Tanca', valor: 0 }], false);
    });
  }
  // PAS 55 · Professorat: hores lectives i càrrec a partir de Currículum › Assignacions (primer es mostra què canvia)
  function carregaDesDelCurriculum() {
    if (S.brut) return toast('Primer deseu o descarteu els canvis.', true);
    var NOMS = { lectives_eso: 'Lectives ESO', lectives_bat: 'Lectives Bat', atencio_individual: 'Atenció individual', tutoria_eso12: 'Tutoria ESO 1r/2n', tutoria_eso34: 'Tutoria ESO 3r/4t', tutoria_bat: 'Tutoria Bat', carrec: 'Càrrec' };
    api('professorat_carrega_curriculum', { prova: true }, 'Calculant les dades del Currículum…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      if (!r.canvis.length) return toast('Les dades del professorat ja coincideixen amb el Currículum.');
      pregunta('Carrega dades des del Currículum', '<p>Es calculen a partir del professor/a de cada grup a Currículum › Assignacions: <strong>lectives ESO i Bat</strong> (sense tutoria ni atenció individual), <strong>atenció individual</strong> (matèries «Atenció individual»), <strong>tutoria</strong> de cada etapa i el <strong>càrrec</strong> (tutor/a i cap de departament/àmbit; els altres càrrecs no es toquen). Els docents sense cap grup assignat no canvien. Després es poden continuar editant.</p>' +
        '<p><b>' + r.canvis.length + '</b> docents canvien:</p><div class="gs-comprova"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Docent</th><th>Camp</th><th>Abans</th><th>Ara</th></tr></thead><tbody>' +
        r.canvis.map(function (c) { return c.camps.map(function (x, i) { return '<tr><td>' + (i ? '' : esc(c.nom)) + '</td><td>' + esc(NOMS[x.camp] || x.camp) + '</td><td>' + esc(x.abans || '—') + '</td><td><b>' + esc(x.despres || '—') + '</b></td></tr>'; }).join(''); }).join('') + '</tbody></table></div>',
        [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Carrega', valor: 1 }], false).then(function (v) {
        if (!v) return;
        api('professorat_carrega_curriculum', {}, 'Desant…').then(function (r2) { if (!r2.ok) return toast(text(r2.error), true); delete S.cache.professorat; toast('Dades carregades per a ' + r2.canvis.length + ' docents.'); obreModul(S.modul); });
      });
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
    // PAS 59: grup «X» = un sol grup sense grup-classe; el nivell ESO-BAT sempre és X
    var xs = String(f.grups_classe || '').split(/[,;]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
    if (f.nivell === 'ESO-BAT' || (xs.length && xs.every(function (x) { return x === 'X'; }))) { var nx = Math.max(1, xs.filter(function (x) { return x === 'X'; }).length), gx = [];
      for (var ix = 0; ix < nx; ix++) gx.push({ lletres: ['X'], nom: f.nivell + ' X' + (nx > 1 ? ' ' + (ix + 1) : '') }); return gx; }
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
    var nivells = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT', 'ESO-BAT'];   // PAS 59: ESO-BAT = multinivell
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist">' +
        '<button type="button" role="tab" data-accio="cur-materies" aria-selected="' + (!grups && !dist) + '">Matèries</button>' +
        '<button type="button" role="tab" data-accio="cur-distribucio" aria-selected="' + dist + '">Grups i distribució</button>' +
        '<button type="button" role="tab" data-accio="cur-grups" aria-selected="' + grups + '">Assignacions</button></div>' +
      '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="cur-hores" title="Les hores de cada docent (lectives, reduccions i guàrdies) són al mòdul Ocupació">Ocupació del professorat</button>' +
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
      (grups && nivellIdx(S.d.nivell) >= 2 ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="des-departaments" title="Departaments/àmbits: especialitats de cadascun i el seu cap">Caps de departament/àmbit</button>' : '') +   // PAS 80: abans a Departaments/àmbits › Administració
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
  // PAS 59 · Document dels equips docents (com el document «Equips docents» del centre): un full apaïsat per nivell, una columna
  // per grup-classe; les matèries de grups units (A+B, A+B+C+D…) ocupen una cel·la que abraça aquells grups-classe; el tutor/a
  // de cada grup surt destacat a la columna del seu grup. L'atenció individual (ESO-BAT) va en un full a part.
  var NIVELLS_DOC = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT', 'ESO-BAT'];
  function documentEquips() {
    var files = S.d.files || [];
    if (!files.length) return toast('No hi ha grups: primer genereu-los des de la pestanya Matèries.', true);
    var hi = NIVELLS_DOC.filter(function (n) { return files.some(function (f) { return f.nivell === n; }); }), tria = null;
    pregunta('Document dels equips docents', '<p><label>Nivell <select id="gsDocNiv"><option value="">Tots els nivells (un full per nivell)</option>' + hi.map(function (n) { return '<option' + (n === S.nivellCurr ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label></p>' +
      '<p class="gs-ajuda">Una columna per grup-classe; els grups units ocupen una sola cel·la. El tutor/a de cada grup surt destacat. Entre claudàtors, l’especialitat dels grups sense professor/a.</p>',
      [{ t: 'Genera el PDF', valor: 1, abans: function () { tria = $('gsDocNiv').value; } }, { t: 'Cancel·la', tipus: 'ghost', valor: 0 }], false)
      .then(function (v) { if (v) pdfEquipsDocents(tria ? [tria] : hi); });
  }
  // PAS 60: ordre de les matèries al document (1r a 3r d'ESO; als altres nivells també serveix): les de la llista, la resta i,
  // al final, les optatives per ordre alfabètic
  var normDoc = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.()]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var ORDRE_DOC = [/^catala$/, /^catala.*div/, /^castella$/, /^castella.*div/, /^angles$/, /^(socials|ciencies socials|geografia)/, /^matematiques$/, /^matematiques.*div|^mates.*div/,
    /^(educacio fisica|ed fisica|ef)$/, /^(ciencies experimentals.*biolog|exp.*bio|biologia)/, /^(ciencies experimentals.*fisica|exp.*(fq|fisica)|fisica i quimica)/, /^musica$/, /^(evip|educacio visual)/, /^tecnologia$/];
  // PAS 61: a 4t d'ESO, després d'Educació Física va Ètica i valors; les matèries de franja van a les files «Franja 1/2/3»
  var ORDRE_DOC_4T = [/^catala$/, /^catala.*div/, /^castella$/, /^castella.*div/, /^angles$/, /^(socials|ciencies socials|geografia)/, /^matematiques$/, /^matematiques.*div|^mates.*div/,
    /^(educacio fisica|ed fisica|ef)$/, /^etica/];
  var ordreMatDoc = function (nom, niv) { var n = normDoc(nom); if (/^tutoria/.test(n)) return -1; if (/^lectura/.test(n)) return 900; if (/^optativ/.test(n)) return 1000;
    if (niv === '4t ESO') { for (var j = 0; j < ORDRE_DOC_4T.length; j++) if (ORDRE_DOC_4T[j].test(n)) return j; return 500; }   // Tutoria la primera; Lectura just abans de les optatives
    for (var i = 0; i < ORDRE_DOC.length; i++) if (ORDRE_DOC[i].test(n)) return i; return 500; };
  var nomCurt = function (p) { var x = String(p || '').split(', '); return x.length > 1 ? x[1] + ' ' + x[0] : String(p || ''); };
  function pdfEquipsDocents(nivells) {
    var files = S.d.files || [], GN = S.d.grups_nivell || {};
    var crida = logoPdf().then(function (logo) {
      var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10;
      var data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      nivells.forEach(function (niv, ip) {
        if (ip) doc.addPage();
        capPdf(doc, logo, 'EQUIPS DOCENTS · Institut Joan Miró', data + ' · ' + niv, M, W);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(28, 12, 188); doc.text(niv === 'ESO-BAT' ? 'Atenció individual (ESO-BAT)' : niv, W / 2, 27, { align: 'center' });
        var fn = files.filter(function (f) { return f.nivell === niv; });
        // PAS 60: una fila per nom de matèria (encara que siguin matèries diferents al Currículum), en l'ordre del centre
        // PAS 67: a 4t d'ESO, Català, Castellà i Matemàtiques van juntes amb la seva divisió (una fila: A, B, div)
        // PAS 68: detecció més àmplia dels noms (Llengua catalana, Català (div), Matemàtiques div…)
        // PAS 69: a «Català (A)», «Matemàtiques (B)»… la lletra entre parèntesis és una TIPOLOGIA de la matèria (no el
        // grup-classe): van a la fila de la matèria («Català») amb l'etiqueta [A] / [B]; la divisió («Català (div.)») té fila pròpia
        var tipDoc = function (f) { var x = String(f.materia || '').match(/\(\s*([A-Za-z])\s*\)\s*$/); return x ? x[1].toUpperCase() : ''; };
        var baseNom = function (nom) { return String(nom || '').replace(/\s*\(\s*[A-Za-z]\s*\)\s*$/, '').trim(); };
        var kDoc = function (f) { return normDoc(tipDoc(f) ? baseNom(f.materia) : f.materia); };
        var mats = []; fn.forEach(function (f) { var k = kDoc(f), m0 = mats.filter(function (m) { return m.k === k; })[0];
          if (!m0) mats.push(m0 = { k: k, nom: tipDoc(f) ? baseNom(f.materia) : f.materia, mat: materiaDe(f) || {}, ambTip: false });
          if (tipDoc(f)) m0.ambTip = true; });
        mats.sort(function (a, b) { return ordreMatDoc(a.nom, niv) - ordreMatDoc(b.nom, niv) || a.nom.localeCompare(b.nom, 'ca'); });
        // PAS 61: matèries de franja (columna «Franja» d'Assignacions): totes les files de la matèria amb franja
        var franjaDe = function (m) { var ff = fn.filter(function (f) { return kDoc(f) === m.k; }); return ff.length && ff.every(function (f) { return String(f.franja || '').trim(); }) ? 'franja' : ''; };
        var franges = {}; fn.forEach(function (f) { var fr = String(f.franja || '').trim(); if (fr) (franges[fr] = franges[fr] || []).push(f); });
        var mostraFranges = Object.keys(franges).length > 0;
        if (mostraFranges) mats = mats.filter(function (m) { return !franjaDe(m); });
        var docents = {}; fn.forEach(function (f) { if (f.professor) docents[f.professor] = 1; });
        var estil = { font: 'helvetica', fontSize: 8, cellPadding: 1.4, overflow: 'linebreak', valign: 'middle', halign: 'center', lineColor: [70, 72, 90], lineWidth: 0.25 };
        var cap = { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold', halign: 'center' };
        if (niv === 'ESO-BAT' || !(GN[niv] || []).length) {
          var cos = []; mats.forEach(function (m) { fn.filter(function (f) { return normDoc(f.materia) === m.k; }).forEach(function (f) { cos.push([m.nom, fmtH(numero(f.hores)), f.professor ? nomCurt(f.professor) : '[' + (f.especialitat || '—') + ']']); }); });
          doc.autoTable({ head: [['Matèria', 'Hores', 'Professor/a']], body: cos, startY: 32, margin: { left: 50, right: 50, bottom: 14 }, styles: estil, headStyles: cap, columnStyles: { 0: { halign: 'left' } } });
        } else {
          var L = GN[niv].map(function (g) { return g.slice(niv.length).trim(); }), Ls = L.slice().sort(function (a, b) { return b.length - a.length; });
          var lletres = function (grup) { var t = String(grup || '').slice(niv.length).trim().split(' ')[0].toUpperCase(), o = [];
            while (t) { var l = Ls.filter(function (x) { return t.indexOf(x.toUpperCase()) === 0; })[0]; if (!l) break; o.push(l); t = t.slice(l.length); } return o; };
          var llDe = function (f) { var mt = materiaDe(f), gm = mt ? (grupsMat(mt)[(Number(f.num_grup) || 1) - 1] || null) : null; return gm ? gm.lletres : lletres(f.grup); };
          // PAS 69: un grup-classe pot tenir més d'un tutor/a (p. ex. cotutoria): tots es ressalten
          var tutor = {}; fn.filter(function (f) { return /^tutoria/i.test(f.materia) && f.professor; }).forEach(function (f) { llDe(f).forEach(function (l) { (tutor[l] = tutor[l] || []).push(f.professor); }); });
          // PAS 61: docents (que no són el tutor/a) amb més d'una matèria al mateix grup-classe
          // PAS 69: també compten les matèries de diversitat (abracen més d'un grup-classe); Català (A) i (B) són la mateixa
          // PAS 70: el blau NO s'aplica a les optatives (1r a 3r d'ESO) ni a les matèries de franja (4t d'ESO): no compten
          var senseBlau = function (f) { return /^optativ/.test(normDoc(f.materia)) || !!String(f.franja || '').trim(); };
          var nMat = {}; fn.forEach(function (f) { if (!f.professor || /^tutoria/i.test(f.materia) || senseBlau(f)) return; llDe(f).forEach(function (l) { var k = l + '|' + f.professor; (nMat[k] = nMat[k] || {})[kDoc(f)] = 1; }); });
          var multi = function (l, prof) { return (tutor[l] || []).indexOf(prof) < 0 && Object.keys(nMat[l + '|' + prof] || {}).length > 1; };
          var cos2 = mats.map(function (m) {
            var A = numero(m.mat.hores_a), B = numero(m.mat.hores_b), grups = {};
            // PAS 60: cada grup (matèria + número de grup) amb els seus grups-classe segons «Grups-classe» de la matèria (no pel nom
            // del grup, que pot venir de Clickedu); els docents d'un mateix grup van a la mateixa casella
            // PAS 69: les hores de cada docent dins del grup se sumen (p. ex. Anglès de 4t: 2 h A + 1 h B = 3 h, i l'altre docent 1 h B)
            fn.filter(function (f) { return kDoc(f) === m.k; }).forEach(function (f) {
              var key = (f.id_materia || f.materia) + '#' + (f.num_grup || f.grup), g = grups[key] = grups[key] || { ll: llDe(f), profs: [], tip: m.ambTip ? tipDoc(f) : '' };
              var p0 = f.professor ? g.profs.filter(function (x) { return x.professor === f.professor; })[0] : null;
              if (p0) p0.hores += numero(f.hores); else g.profs.push({ professor: f.professor, especialitat: f.especialitat, hores: numero(f.hores) }); });
            // Grups amb els mateixos grups-classe (desdoblaments, tipologies A/B…) van a la mateixa cel·la, una línia per grup
            var cel = {}, idxDe = function (g) { var idx = g.ll.map(function (l) { return L.indexOf(l); }).filter(function (i) { return i >= 0; }).sort(function (a, b) { return a - b; }); return idx.length ? idx : L.map(function (x, i) { return i; }); };
            Object.keys(grups).sort(function (x, y) { return idxDe(grups[x])[0] - idxDe(grups[y])[0] || grups[x].tip.localeCompare(grups[y].tip); }).forEach(function (k) { var g = grups[k], idx = idxDe(g);
              var a = idx[0], b = idx[idx.length - 1], key = a + '-' + b; (cel[key] = cel[key] || { a: a, b: b, grups: [] }).grups.push(g); });
            var fila = [m.nom + ' (' + fmtH(A + B / 2) + ')', A ? fmtH(A) : '', B ? fmtH(B) : ''], c = 0, spans = Object.keys(cel).map(function (k) { return cel[k]; }).sort(function (x, y) { return x.a - y.a || y.b - x.b; });
            while (c < L.length) {
              var sp = spans.filter(function (x) { return x.a === c; })[0];
              if (!sp) { fila.push(''); c++; continue; }
              var linies = [], marques = [];
              sp.grups.forEach(function (g) { var noms = g.profs.map(function (f) { return f.professor ? nomCurt(f.professor) + (g.profs.length > 1 ? ' (' + fmtH(f.hores) + 'h)' : '') : '[' + (f.especialitat || '—') + ']'; });
                var txt = noms.join(' + ') + (g.tip ? ' [' + g.tip + ']' : ''); linies.push(txt);
                // PAS 69: a TOTES les cel·les (també les de diversitat i optatives, que abracen més d'un grup-classe): taronja si
                // hi fa classe el tutor/a d'algun dels grups-classe; blau si el docent fa dues o més matèries a algun d'ells
                var cls = L.slice(sp.a, sp.b + 1).filter(function (l) { return !g.ll.length || g.ll.indexOf(l) >= 0; });
                var esTut = g.profs.some(function (f) { return f.professor && cls.some(function (l) { return (tutor[l] || []).indexOf(f.professor) >= 0; }); });
                var esMulti = !esTut && !/^optativ/.test(normDoc(m.nom)) && g.profs.some(function (f) { return f.professor && cls.some(function (l) { return multi(l, f.professor); }); });
                if (esTut || esMulti) marques.push({ text: txt, color: esTut ? [255, 196, 120] : [178, 224, 245] }); });
              // Una sola línia: es pinta tota la cel·la; si n'hi ha més, només les línies marcades
              var una = linies.length === 1 && marques.length === 1;
              fila.push({ content: linies.join('\n'), colSpan: sp.b - sp.a + 1, tutor: una && marques[0].color[0] === 255, multi: una && marques[0].color[0] !== 255, marques: una ? [] : marques }); c = sp.b + 1;
            }
            return fila;
          });
          // PAS 61: files «Franja 1/2/3» (4t d'ESO): una cel·la per a tots els grups-classe amb «Matèria - Gn: docent»
          if (mostraFranges) Object.keys(franges).sort().forEach(function (fr) {
            var per = {}; franges[fr].forEach(function (f) { var k = normDoc(f.materia); (per[k] = per[k] || []).push(f); });
            var linies = [], h = 0;
            Object.keys(per).sort(function (a, b) { return a.localeCompare(b, 'ca'); }).forEach(function (k) { var ff = per[k], grups = {};
              ff.forEach(function (f) { var gk = f.num_grup || f.grup; (grups[gk] = grups[gk] || []).push(f); h = Math.max(h, numero((materiaDe(f) || {}).hores_a) + numero((materiaDe(f) || {}).hores_b) / 2); });
              var ng = Object.keys(grups);
              // PAS 68: si la matèria és només d'una part dels grups-classe, es diu de quins (p. ex. «A, B, C»)
              ng.sort().forEach(function (gk) { var gf = grups[gk], ll2 = []; gf.forEach(function (f) { llDe(f).forEach(function (l) { if (ll2.indexOf(l) < 0) ll2.push(l); }); });
                ll2.sort(function (a, b) { return L.indexOf(a) - L.indexOf(b); });
                // PAS 69: també es ressalten (tutor/a en taronja; docent amb més d'una matèria al grup-classe, en blau)
                var cls = ll2.length ? ll2 : L, mk = null;
                if (gf.some(function (f) { return f.professor && cls.some(function (l) { return (tutor[l] || []).indexOf(f.professor) >= 0; }); })) mk = [255, 196, 120];
                linies.push({ t: gf[0].materia + (ng.length > 1 ? ' - G' + gk : '') + (ll2.length && ll2.length < L.length ? ' (' + ll2.join(', ') + ')' : '') + ': ' + gf.map(function (f) { return f.professor ? nomCurt(f.professor) + (gf.length > 1 ? ' (' + fmtH(numero(f.hores)) + 'h)' : '') : '[' + (f.especialitat || '—') + ']'; }).join(' + '), mk: mk }); });
            });
            // PAS 67: les matèries de la franja en dues columnes (ocupen menys alçada)
            // PAS 68: una sola cel·la amb dues columnes de text, sense línia entremig (la dreta es dibuixa a didDrawCell)
            var mig = Math.ceil(linies.length / 2), fila = [{ content: 'Franja ' + fr + (h ? ' (' + fmtH(h) + ')' : ''), styles: { fontStyle: 'bold' } }, '', ''];
            fila.push({ content: '', colSpan: L.length, styles: { halign: 'left', valign: 'top' }, duesCol: [linies.slice(0, mig), linies.slice(mig)] });
            cos2.push(fila);
          });
          var amp = (W - 2 * M - 46 - 16) / L.length, cs = { 0: { cellWidth: 46, halign: 'left', fontStyle: 'bold' }, 1: { cellWidth: 8 }, 2: { cellWidth: 8 } };
          L.forEach(function (l, i) { cs[i + 3] = { cellWidth: amp }; });
          var mitja = (amp * L.length) / 2 - 4, lh = estil.fontSize * 0.3528 * 1.15;
          // Les dues columnes de les franges es parteixen a la mida de mitja cel·la; la cel·la fa l'alçada de la més llarga
          var parteix = function (ll) { var t = [], mk = []; ll.forEach(function (x) { doc.splitTextToSize(x.t, mitja).forEach(function (w) { t.push(w); mk.push(x.mk); }); }); return { t: t, mk: mk }; };
          cos2.forEach(function (fila) { fila.forEach(function (c) { if (c && c.duesCol) { doc.setFontSize(estil.fontSize); var e = parteix(c.duesCol[0]), dr = parteix(c.duesCol[1]);
            while (e.t.length < dr.t.length) { e.t.push(''); e.mk.push(null); } c.content = e.t.join('\n'); c.dreta = dr.t; c.mkE = e.mk; c.mkD = dr.mk; } }); });
          doc.autoTable({ head: [['Assignatura', 'A', 'B'].concat(L.map(function (l) { return niv + ' ' + l; }))], body: cos2, startY: 32, margin: { left: M, right: M, bottom: 14 }, styles: estil, headStyles: cap, columnStyles: cs,
            didParseCell: function (d) { if (d.section !== 'body' || !d.cell.raw) return;
              if (d.cell.raw.tutor) { d.cell.styles.fillColor = [255, 196, 120]; d.cell.styles.fontStyle = 'bold'; }
              else if (d.cell.raw.multi) { d.cell.styles.fillColor = [178, 224, 245]; d.cell.styles.fontStyle = 'bold'; } },
            // PAS 68: ressaltat de línies dins d'una cel·la agrupada (es pinta abans del text)
            willDrawCell: function (d) { var r = d.cell.raw; if (d.section !== 'body' || !r) return;
              if (r.mkE) { var yE = d.cell.y + d.cell.padding('top'), w2 = d.cell.width / 2, fE = d.cell.styles.fillColor;
                if (!r.mkE.some(Boolean) && !r.mkD.some(Boolean)) return;
                if (fE) { doc.setFillColor.apply(doc, [].concat(fE)); doc.rect(d.cell.x, d.cell.y, d.cell.width, d.cell.height, 'F'); }
                r.mkE.forEach(function (c, i) { if (c) { doc.setFillColor(c[0], c[1], c[2]); doc.rect(d.cell.x + 0.6, yE + i * lh, w2 - 1.2, lh, 'F'); } });
                r.mkD.forEach(function (c, i) { if (c) { doc.setFillColor(c[0], c[1], c[2]); doc.rect(d.cell.x + w2, yE + i * lh, w2 - 0.6, lh, 'F'); } });
                d.cell.styles.fillColor = false; return; }
              if (!r.marques || !r.marques.length) return;
              var t = d.cell.text || [], y0 = d.cell.y + (d.cell.height - t.length * lh) / 2, fons = d.cell.styles.fillColor;
              if (fons) { doc.setFillColor.apply(doc, [].concat(fons)); doc.rect(d.cell.x, d.cell.y, d.cell.width, d.cell.height, 'F'); }
              t.forEach(function (lin, i) { var mk = r.marques.filter(function (q) { return q.text.indexOf(lin.trim()) >= 0 && lin.trim(); })[0];
                if (mk) { doc.setFillColor(mk.color[0], mk.color[1], mk.color[2]); doc.rect(d.cell.x + 0.6, y0 + i * lh, d.cell.width - 1.2, lh, 'F'); } });
              d.cell.styles.fillColor = false; },
            didDrawCell: function (d) { var r = d.cell.raw; if (d.section !== 'body' || !r || !r.dreta) return;
              doc.setFont('helvetica', 'normal'); doc.setFontSize(estil.fontSize); doc.setTextColor(40, 40, 50);
              doc.text(r.dreta, d.cell.x + d.cell.width / 2 + 1, d.cell.y + d.cell.padding('top') + lh * 0.78); } });
        }
        var y = doc.lastAutoTable.finalY + 6, noms = Object.keys(docents).sort(function (a, b) { return a.localeCompare(b, 'ca'); }).map(nomCurt);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 64, 80);
        if (niv !== 'ESO-BAT') { var yl = Math.min(y, H - 18); doc.setFillColor(255, 196, 120); doc.rect(M, yl - 2.6, 4, 3, 'F'); doc.text('tutor/a del grup-classe', M + 6, yl);
          doc.setFillColor(178, 224, 245); doc.rect(M + 48, yl - 2.6, 4, 3, 'F'); doc.text('docent amb més d’una matèria al grup-classe', M + 54, yl); }
        doc.splitTextToSize('Equip docent (' + noms.length + '): ' + noms.join(', ') + '.', W - 2 * M).forEach(function (l, i) { doc.text(l, M, Math.min(y + 5 + i * 3.8, H - 8)); });
        doc.setFontSize(8); doc.setTextColor(90, 96, 120); doc.text('Pàgina ' + doc.internal.getNumberOfPages(), W - M, H - 6, { align: 'right' });
      });
      doc.save('equips-docents' + (nivells.length === 1 ? '-' + nivells[0].replace(/\s+/g, '').toLowerCase() : '') + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
    });
    return window.Progres ? Progres.amb(crida, 'Generant el document…') : crida;
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
      (S.d.nomes_propies ? '<span class="gs-gris" title="Veieu les amonestacions que heu redactat vosaltres i, si sou tutor/a o coordinador/a, les del vostre grup-classe o nivell">' + (S.d.tutoria ? 'Les vostres i les ' + esc(S.d.tutoria) : 'Les vostres amonestacions') + '</span>' : '') +
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
    var lim = A.periode === 'tot el curs' ? null : iniciPeriode(A.periode), per = {}, verdes = ambVerdesAmon();
    S.d.files.forEach(function (f) {
      if (lim ? String(f.data_fets) < lim : (A.curs && f.curs !== A.curs)) return;
      if (!verdes && f.estat === 'verd') return;   // PAS 76
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
    // PAS 76: com al control d'entrada: el criteri es canvia aquí mateix (l'administració), «compta les verdes» i el recompte
    var pot = A.pot_canviar, ns = []; for (var i = 1; i <= 20; i++) ns.push(i);
    var sel = function (id, ops, v) { return '<select id="' + id + '"' + (pot ? '' : ' disabled') + '>' + ops.map(function (o) { return '<option' + (String(o) === String(v) ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'; };
    el.innerHTML = '<span class="gs-retards__regla" title="' + (pot ? 'Podeu canviar el criteri: val per a tothom.' : 'El criteri el fixa qui administra el mòdul.') + '">Avís: ESO ' + sel('gsAvEso', ns, A.eso) + ' · BAT ' + sel('gsAvBat', ns, A.bat) + ' amonestacions o més en ' + sel('gsAvPer', A.periodes || [A.periode], A.periode) +
        ' <small class="gs-gris">(' + (A.periode === 'tot el curs' ? 'aquest curs' : 'des del ' + dataVista(iniciPeriode(A.periode))) + ')</small> <small class="gs-gris gs-retards__info" title="NOFC 5.3.2: mesures a partir de cinc amonestacions lleus a l’ESO i de dues al batxillerat">NOFC: ESO 5 o més · BAT 2 o més</small></span>' +
      '<label class="gs-check gs-retards__verd" title="Si no es marca, les amonestacions ja sancionades (verdes) no compten per a l’avís"><input type="checkbox" id="gsAvVerd"' + (ambVerdesAmon() ? ' checked' : '') + '> compta les verdes</label>' +
      '<button type="button" class="gs-incomplet' + (llista.length ? '' : ' is-cap') + '" data-accio="amon-avis"><span aria-hidden="true">⚠</span> ' + llista.length + (llista.length === 1 ? ' alumne' : ' alumnes') + '</button>';
    $('gsAvVerd').addEventListener('change', function () { guarda.desa('amon_verdes', this.checked); pintaAvisAmon(); if (S.taula) S.taula.redraw(true); });
    if (pot) ['gsAvEso', 'gsAvBat', 'gsAvPer'].forEach(function (id) { $(id).addEventListener('change', function () {
      api('amonestacions_config', { eso: Number($('gsAvEso').value), bat: Number($('gsAvBat').value), periode: $('gsAvPer').value }, 'Desant el criteri…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        S.d.avis_amon = r.avis_amon; toast('Criteri desat: ESO ' + r.avis_amon.eso + ' · BAT ' + r.avis_amon.bat + ' en ' + r.avis_amon.periode + '.'); pintaAvisAmon(); if (S.taula) S.taula.redraw(true); }); }); });
  }
  function ambVerdesAmon() { var v = guarda.llegeix('amon_verdes'); return v === null ? true : !!v; }
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
  // PAS 76 · Finestra de l'alumne/a (doble clic a una amonestació), en dues parts. Esquerra (només l'administració): les
  // sancions de l'alumne/a i una sanció nova (o l'edició d'una) amb les amonestacions marcades: tipus, descripció, data i
  // estat. Dreta: les amonestacions de l'alumne/a, amb navegació i els fets de la triada.
  function dialegAlumneAmon(fila, sid) {
    var k = fila.id_alumne || plega(fila.alumne), pot = !!S.d.pot_sancionar;
    var ams = S.d.files.filter(function (f) { return (f.id_alumne || plega(f.alumne)) === k; }).sort(function (a, b) { return String(b.data_fets).localeCompare(String(a.data_fets)); });
    var sancs = (S.d.sancions || []).filter(function (x) { return (x.id_alumne || plega(x.alumne)) === k; }).sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    var ed = sid ? sancs.filter(function (x) { return x.id_sancio === sid; })[0] : null, cur = Math.max(0, ams.map(function (f) { return f.id; }).indexOf(fila.id));
    var marcades = ed ? ed.amonestacions : ams.filter(function (f) { return (f.estat || 'blanc') === 'blanc' && !f.id_sancio; }).map(function (f) { return f.id; });
    var compte = ['blanc', 'vermell', 'verd'].map(function (e) { return '<span class="gs-punt gs-punt--' + e + '"></span> ' + ams.filter(function (f) { return (f.estat || 'blanc') === e; }).length; }).join(' · ');
    // Sense permís (o amb un Apps Script anterior), la part esquerra diu per què no es pot sancionar i mostra les sancions
    var motiu = S.d.pot_sancionar === undefined ? 'L’Apps Script desplegat és anterior a les sancions: enganxeu el Code.gs nou, executeu «configura» i feu una implementació nova (Versió nova). Després, torneu a carregar la pàgina.'
      : S.d.obert === false ? 'El curs està tancat: no es poden crear ni modificar sancions.' : 'Només l’administració del mòdul Amonestacions pot crear sancions (Equips i permisos).';
    var esq = !pot ? '<div class="gs-amsan__esq"><h4 class="gs-amon__tit">Sancions</h4>' + (sancs.length ? '<ul class="gs-sanc__llista">' + sancs.map(function (x) { return '<li><span class="gs-punt gs-punt--' + COLOR_SANCIO[x.estat] + '"></span> <b>' + esc(dataVista(x.data)) + '</b> · ' + esc(TIPUS_SANCIO[x.tipus] || x.tipus) + ' · ' + esc(x.descripcio) + ' · ' + esc(x.estat) + '</li>'; }).join('') + '</ul>' : '<p class="gs-gris">Encara no té cap sanció.</p>') +
      '<p class="prog-avis">' + esc(motiu) + '</p></div>' : '<div class="gs-amsan__esq"><h4 class="gs-amon__tit">Sancions</h4>' +
      (sancs.length ? '<ul class="gs-sanc__llista">' + sancs.map(function (x) { return '<li><span class="gs-punt gs-punt--' + COLOR_SANCIO[x.estat] + '"></span> <b>' + esc(dataVista(x.data)) + '</b> · ' + esc(TIPUS_SANCIO[x.tipus] || x.tipus) + ' · ' + esc(x.descripcio) + ' · ' + esc(x.estat) + ' · ' + x.amonestacions.length + ' amon. <small class="gs-gris">' + esc(x.id_sancio) + '</small> <button type="button" class="gs-enllac" data-amsan="edita" data-id="' + esc(x.id_sancio) + '">Edita</button> <button type="button" class="gs-enllac gs-perill" data-amsan="esborra" data-id="' + esc(x.id_sancio) + '">Esborra</button></li>'; }).join('') + '</ul>' : '<p class="gs-gris">Encara no té cap sanció.</p>') +
      '<h4 class="gs-amon__tit">' + (ed ? 'Edita la sanció ' + esc(ed.id_sancio) : 'Nova sanció') + '</h4>' +
      '<div class="gs-form-fila"><label>Tipus <select id="gsAsTipus">' + ['amonestacions', 'greu'].map(function (t) { return '<option value="' + t + '"' + ((ed ? ed.tipus : 'amonestacions') === t ? ' selected' : '') + '>' + esc(TIPUS_SANCIO[t]) + '</option>'; }).join('') + '</select></label>' +
      '<label>Data <input type="date" id="gsAsData" value="' + esc(ed ? ed.data : isoDe(new Date())) + '"></label>' +
      '<label>Estat <select id="gsAsEstat">' + Object.keys(COLOR_SANCIO).map(function (e) { return '<option' + ((ed ? ed.estat : 'en tràmit') === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="gs-form-fila gs-form-fila--ample">Descripció <input type="text" id="gsAsDesc" maxlength="500" value="' + esc(ed ? ed.descripcio : '') + '" placeholder="P. ex. acumulació de 5 amonestacions lleus: 2 dies d’expulsió"></label>' +
      '<p class="gs-ajuda">Marqueu les amonestacions que formen part de la sanció (les d’una altra sanció no es poden triar). Les marcades passen a <span class="gs-punt gs-punt--vermell"></span> sanció en curs o <span class="gs-punt gs-punt--verd"></span> sancionat. Mai no es posa sola: la valora l’administració.</p>' +
      '<div class="gs-sanc__ents"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th><input type="checkbox" id="gsAsTots" aria-label="Marca-les totes"></th><th>Estat</th><th>Data</th><th>Professor/a</th><th>Sanció</th></tr></thead><tbody>' +
      ams.map(function (f) { var altra = f.id_sancio && (!ed || f.id_sancio !== ed.id_sancio);
        return '<tr' + (altra ? ' class="gs-gris"' : '') + '><td><input type="checkbox" class="gsAsAm" value="' + esc(f.id) + '"' + (marcades.indexOf(f.id) >= 0 ? ' checked' : '') + (altra ? ' disabled' : '') + '></td><td><span class="gs-punt gs-punt--' + esc(f.estat || 'blanc') + '"></span></td><td>' + esc(dataVista(f.data_fets)) + '</td><td>' + esc(f.professor || '') + '</td><td>' + esc(f.id_sancio || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="prog-avis" id="gsAsErr" hidden></p></div>';
    var dreta = '<div class="gs-amsan__dre"><h4 class="gs-amon__tit">Amonestacions (' + ams.length + ') <small class="gs-gris">' + compte + '</small></h4><ol class="gs-amsan__llista">' +
      ams.map(function (f, i) { return '<li><button type="button" class="gs-amsan__item' + (i === cur ? ' is-actiu' : '') + '" data-amsan="mostra" data-i="' + i + '"><span class="gs-punt gs-punt--' + esc(f.estat || 'blanc') + '"></span> ' + esc(dataVista(f.data_fets)) + ' · ' + esc(f.professor || '') + '</button></li>'; }).join('') + '</ol><div id="gsAsDet" class="gs-amsan__det"></div></div>';
    var botons = pot ? [{ t: ed ? 'Desa la sanció' : 'Crea la sanció', valor: 'desa', abans: function () {
      var cos = { modul: 'amonestacions', tipus: $('gsAsTipus').value, descripcio: $('gsAsDesc').value, data: $('gsAsData').value, estat: $('gsAsEstat').value, amonestacions: [].map.call(document.querySelectorAll('.gsAsAm:checked'), function (x) { return x.value; }), id_alumne: fila.id_alumne };
      var e = []; if (!cos.descripcio.trim()) e.push('Cal la descripció.'); if (!cos.data) e.push('Cal la data.'); if (cos.tipus === 'amonestacions' && !cos.amonestacions.length) e.push('Marqueu almenys una amonestació.');
      if (e.length) { $('gsAsErr').textContent = e.join(' '); $('gsAsErr').hidden = false; return false; }
      if (ed) cos.id_sancio = ed.id_sancio; dialegAlumneAmon.cos = cos; } }] : [];
    if (ed) botons.push({ t: 'Nova sanció', valor: 'nova', tipus: 'ghost' });
    botons.push({ t: pot ? 'Cancel·la' : 'Tanca', valor: 0, tipus: 'ghost' });
    var obre = pregunta('Amonestacions i sancions · ' + fila.alumne + ' · ' + (fila.grup || fila.nivell || ''), '<div class="gs-amsan">' + esq + dreta + '</div>', botons, false);
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample', 'gs-modal--gran');
    var mostra = function (i) { cur = Math.max(0, Math.min(ams.length - 1, i)); var d = ams[cur]; if (!d) { $('gsAsDet').innerHTML = '<p class="gs-gris">Cap amonestació visible.</p>'; return; }
      [].forEach.call(document.querySelectorAll('.gs-amsan__item'), function (b) { b.classList.toggle('is-actiu', Number(b.dataset.i) === cur); });
      $('gsAsDet').innerHTML = '<p class="gs-amon__nav"><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-amsan="ant"' + (cur === 0 ? ' disabled' : '') + '>‹</button> ' + (cur + 1) + ' de ' + ams.length + ' <button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-amsan="seg"' + (cur === ams.length - 1 ? ' disabled' : '') + '>›</button></p>' +
        '<dl class="gs-amon__dl">' + [['Data dels fets', dataVista(d.data_fets)], ['Professor/a', d.professor], ['Estat', TEXT_ESTAT_ENT[d.estat || 'blanc'] + (d.id_sancio ? ' (' + d.id_sancio + ')' : '')], ['Curs', d.curs], ['Codi', d.id]].map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1] || '—') + '</dd>'; }).join('') + '</dl>' +
        '<p class="gs-amon__tit">Fets i circumstàncies</p><div class="gs-amon__fets">' + esc(d.fets || '').replace(/\n/g, '<br>') + '</div>' + (d.pdf ? '<p><a class="prog-btn prog-btn--ghost prog-btn--sm" href="' + esc(d.pdf) + '" target="_blank" rel="noopener">Obre el PDF</a></p>' : ''); };
    mostra(cur);
    var accio = null;
    $('gsModalText').addEventListener('click', function (e) { var b = e.target.closest('[data-amsan]'); if (!b) return; var a = b.dataset.amsan;
      if (a === 'mostra') mostra(Number(b.dataset.i)); else if (a === 'ant') mostra(cur - 1); else if (a === 'seg') mostra(cur + 1);
      else { accio = { a: a, id: b.dataset.id }; $('gsModalBtns').lastChild.click(); } });
    if ($('gsAsTots')) $('gsAsTots').addEventListener('change', function () { var v = this.checked; [].forEach.call(document.querySelectorAll('.gsAsAm:not(:disabled)'), function (x) { x.checked = v; }); });
    obre.then(function (v) {
      if (accio && accio.a === 'edita') return dialegAlumneAmon(fila, accio.id);
      if (accio && accio.a === 'esborra') return pregunta('Esborra la sanció', '<p>S’esborrarà la sanció ' + esc(accio.id) + ' i les seves amonestacions tornaran a blanc (queda una còpia a l’historial).</p>', [{ t: 'Esborra', valor: 1, tipus: 'danger' }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]).then(function (ok) {
        if (ok) api('sancio_esborra', { id_sancio: accio.id, modul: 'amonestacions' }, 'Esborrant…').then(function (r) { if (!r.ok) return toast(text(r.error), true); aplicaSancionsAmon(r); toast('Sanció esborrada.'); dialegAlumneAmon(fila); }); });
      if (v === 'nova') return dialegAlumneAmon(fila);
      if (v !== 'desa') return;
      var cos = dialegAlumneAmon.cos;
      api('sancio_desa', cos, 'Desant la sanció…').then(function (r) {
        if (!r.ok) return toast(r.errors ? r.errors.join(' ') : text(r.error), true);
        aplicaSancionsAmon(r); toast((cos.id_sancio ? 'Sanció desada: ' : 'Sanció creada: ') + r.sancio.id_sancio + ' (' + r.sancio.amonestacions.length + ' amonestacions).'); });
    });
  }
  // Aplica a la graella d'amonestacions els estats nous (sense tornar a llegir el full)
  function aplicaSancionsAmon(r) {
    S.d.sancions = r.sancions || S.d.sancions;
    var per = {}; (r.amonestacions || []).forEach(function (x) { per[x.id] = x; });
    S.d.files.forEach(function (f) { var x = per[f.id]; if (x) { f.estat = x.estat; f.id_sancio = x.id_sancio; } });
    if (S.taula) S.taula.updateData((r.amonestacions || []).map(function (x) { return { id: x.id, estat: x.estat, id_sancio: x.id_sancio }; }));
    if (S.cache) { delete S.cache.control_entrada; } S.san = null;
    pintaAvisAmon();
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

  // PAS 76/86/87 · Retards que compta una entrada segons l'hora d'arribada (PAS 87): abans de les 9:15, 0; entre 9:15 i
  // 10:15, 1; entre 10:15 i 11:45, 2; entre 11:45 i 12:45, 3; entre 12:45 i 13:45, 4; a partir de 13:45, 5. Les
  // justificades (grogues) no compten mai.
  var TRAMS_RETARD = [['09:15', 0], ['10:15', 1], ['11:45', 2], ['12:45', 3], ['13:45', 4]];
  var TEXT_PES_RETARD = '8:15–9:15 → 0, 9:15–10:15 → 1, 10:15–11:45 → 2, 11:45–12:45 → 3, 12:45–13:45 → 4, 13:45–14:45 → 5; justificades (grogues) → 0';
  function pesRetard(hora) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hora || '')); if (!m) return 1;
    var h = ('0' + m[1]).slice(-2) + ':' + m[2];
    for (var i = 0; i < TRAMS_RETARD.length; i++) if (h < TRAMS_RETARD[i][0]) return TRAMS_RETARD[i][1];
    return 5;
  }
  // PAS 33 · CONTROL D'ENTRADA · Avís de retards: alumnes amb «quantitat» retards o més dins del període (comptat fins avui)
  function alumnesAmbRetards() {
    var R = S.d.retards; if (!R || !S.d.files) return [];
    var limIso = iniciPeriode(R.periode);
    var per = {};
    var verdes = ambVerdes();
    S.d.files.forEach(function (f) {
      if (String(f.data) < limIso) return;
      if (f.estat === 'groc') return;   // PAS 76: justificat, no compta mai
      var k = f.id_alumne || plega(f.alumne), x = per[k] = per[k] || { alumne: f.alumne, nivell: f.nivell, grup: f.grup, n: 0, entrades: 0, ultima: '', tot: 0, sanc: 0 };
      // PAS 87 · L'etiqueta: tots els retards del període (també els verds) i, d'aquests, els sancionats o en tràmit
      var w = pesRetard(f.hora); x.tot += w; if (f.estat === 'verd' || f.estat === 'vermell') x.sanc += w;
      if (!verdes && f.estat === 'verd') return;   // PAS 72: el criteri de l'avís pot no comptar les verdes
      x.n += pesRetard(f.hora); x.entrades++; var t = f.data + ' ' + f.hora;   // PAS 76: cada entrada compta segons l'hora
      if (t > x.ultima) { x.ultima = t; x.grup = f.grup || x.grup; x.nivell = f.nivell || x.nivell; }   // PAS 86: abans quedava dins del comentari
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
    if (p === 'tot el curs') { var ic = S.d && S.d.retards && S.d.retards.inici_curs; if (ic) return ic; var y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return y + '-09-01'; }   // PAS 86: des de l'inici de classes
    if (m && /setman/.test(m[2])) d.setDate(d.getDate() - 7 * Number(m[1]));
    else if (m) { var dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() - Number(m[1])); d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
    return isoDe(d);
  }
  function pintaRetards() {
    var R = S.d.retards, el = $('gsRetards'); if (!R || !el) return;
    var llista = alumnesAmbRetards();
    S.avisRetards = {}; S.avisEntrades = {}; S.totRetards = {}; llista.forEach(function (a) { S.avisRetards[a.clau] = a.n; S.avisEntrades[a.clau] = a.entrades; S.totRetards[a.clau] = { tot: a.tot, sanc: a.sanc }; });
    var sel = function (id, ops, v) { return '<select id="' + id + '"' + (R.pot_canviar ? '' : ' disabled') + '>' + ops.map(function (o) { return '<option' + (String(o) === String(v) ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'; };
    var q = []; for (var i = 3; i <= 50; i++) q.push(i);
    el.innerHTML = '<span class="gs-retards__regla" title="' + (R.pot_canviar ? 'Podeu canviar el criteri: val per a tothom.' : 'El criteri el fixa qui administra el mòdul.') + '">Avís: ' + sel('gsRetQ', q, R.quantitat) + ' retards o més en ' + sel('gsRetP', R.periodes, R.periode) + ' <small class="gs-gris">(des del ' + dataVista(iniciPeriode(R.periode)) + ')</small> <span class="gs-gris gs-retards__info" title="Retards que compta cada entrada segons l’hora: ' + esc(TEXT_PES_RETARD) + '">ⓘ</span></span>' +
      (S.d.sancions ? '<label class="gs-check gs-retards__verd" title="Si no es marca, les entrades ja sancionades (verdes) no compten per a l’avís"><input type="checkbox" id="gsRetVerd"' + (ambVerdes() ? ' checked' : '') + '> compta les verdes</label>' : '') +
      '<button type="button" class="gs-incomplet' + (llista.length ? '' : ' is-cap') + '" data-accio="retards-llista"><span aria-hidden="true">⚠</span> ' + llista.length + (llista.length === 1 ? ' alumne' : ' alumnes') + '</button>';
    if ($('gsRetVerd')) $('gsRetVerd').addEventListener('change', function () { guarda.desa('retards_verdes', this.checked); pintaRetards(); if (S.taula) S.taula.redraw(true); });
    if (R.pot_canviar) ['gsRetQ', 'gsRetP'].forEach(function (id) { $(id).addEventListener('change', function () {
      api('retards_desa', { quantitat: Number($('gsRetQ').value), periode: $('gsRetP').value }, 'Desant el criteri…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        S.d.retards = Object.assign(r.retards, { pot_canviar: true }); toast('Criteri desat: ' + r.retards.quantitat + ' retards en ' + r.retards.periode + '.'); pintaRetards(); if (S.taula) S.taula.redraw(true);
      });
    }); });
  }
  // PAS 72: l'avís compta (o no) les entrades ja sancionades; per defecte, sí (com fins ara). Es recorda en aquest navegador.
  function ambVerdes() { var v = guarda.llegeix('retards_verdes'); return v === null ? true : !!v; }
  function llistaRetards() {
    var R = S.d.retards, llista = alumnesAmbRetards();
    informe('Avís de retards', 'Alumnes amb ' + R.quantitat + ' retards o més en ' + R.periode + ' (del ' + dataVista(iniciPeriode(R.periode)) + ' fins avui' + (S.d.sancions && !ambVerdes() ? '; sense les entrades ja sancionades' : '') + '). ' + llista.length + (llista.length === 1 ? ' alumne.' : ' alumnes.') + ' Retards: del període, sense les justificades; sancionats: verds (sancionat) o vermells (en tràmit).', ['', 'Alumne', 'Nivell', 'Grup-Classe', 'Retards (' + R.periode + ')', 'Entrades', 'Sancionats', 'Darrer'],
      llista.map(function (a, i) { return [String(i + 1), a.alumne, a.nivell || '', a.grup || '', String(a.tot), String(a.entrades), String(a.sanc), a.ultima ? dataVista(a.ultima.slice(0, 10)) + ' ' + a.ultima.slice(11, 16) : '']; }), 'avis-retards');
  }
  // ------------------------------------------------------------------ PAS 72 · SANCIONS (control d'entrada)
  // PAS 76: verd = sancionat; groc = justificat (no compta mai); vermell = sanció en curs; blanc = res
  var TEXT_ESTAT_ENT = { blanc: 'Res', groc: 'Justificat', vermell: 'Sanció en curs', verd: 'Sancionat' };
  var COLOR_SANCIO = { 'en tràmit': 'vermell', 'sancionat': 'verd', 'anul·lada': 'blanc' };   // PAS 73: anul·lada = de baixa
  var TIPUS_SANCIO = { retards: 'Acumulació de retards', mobil: 'Ús indegut del mòbil', amonestacions: 'Acumulació d’amonestacions lleus', greu: 'Amonestació greu' };
  // PAS 76 · Marca o desmarca una entrada com a justificada (groc): no compta mai per a l'avís
  function justificaEntrada(row) {
    var d = row.getData(), nou = d.estat === 'groc' ? 'blanc' : 'groc';
    pregunta(nou === 'groc' ? 'Retard justificat' : 'Treu el justificat', '<p><b>' + esc(d.alumne) + '</b> · ' + esc(dataVista(d.data)) + ' ' + esc(d.hora || '') + '</p><p>' + (nou === 'groc' ? 'L’entrada queda en <span class="gs-punt gs-punt--groc"></span> groc (justificada: p. ex. arriba tard amb una causa justificada) i no comptarà mai per a l’avís de retards.' : 'L’entrada torna a blanc i tornarà a comptar per a l’avís de retards.') + '</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: nou === 'groc' ? 'Justificat' : 'Treu-ho', valor: 1 }]).then(function (v) {
      if (!v) return; api('entrada_estat', { id: d.id, estat: nou }, 'Desant…').then(function (r) { if (!r.ok) return toast(text(r.error), true);
        var f = S.d.files.filter(function (x) { return x.id === d.id; })[0]; if (f) f.estat = nou; row.update({ estat: nou }); pintaRetards(); toast(nou === 'groc' ? 'Entrada justificada.' : 'Entrada sense justificar.'); }); });
  }
  var clauAluEnt = function (f) { return f.id_alumne || plega(f.alumne); };
  // Doble clic a una entrada: les entrades de l'alumne/a (amb caselles) i les seves sancions. Amb permís (admin), es crea
  // una sanció amb les entrades marcades o se n'edita una (descripció, data, estat i entrades).
  function dialegSancio(fila, sid, enAcabar) {
    var k = clauAluEnt(fila), pot = !!S.d.pot_sancionar;
    var ents = S.d.files.filter(function (f) { return clauAluEnt(f) === k; }).sort(function (a, b) { return String(b.data + b.hora).localeCompare(String(a.data + a.hora)); });
    var sancs = (S.d.sancions || []).filter(function (x) { return (x.id_alumne || plega(x.alumne)) === k; }).sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    var ed = sid ? sancs.filter(function (x) { return x.id_sancio === sid; })[0] : null;
    var marcades = ed ? ed.entrades : ents.filter(function (f) { return (f.estat || 'blanc') === 'blanc'; }).map(function (f) { return f.id; });
    var html = '<p><b>' + esc(fila.alumne) + '</b> · ' + esc(fila.grup || fila.nivell || '') + ' · ' + ents.length + ' entrades (' + ['blanc', 'groc', 'vermell', 'verd'].map(function (e) { return '<span class="gs-punt gs-punt--' + e + '"></span> ' + ents.filter(function (f) { return (f.estat || 'blanc') === e; }).length; }).join(' · ') + ')</p>' +
      (sancs.length ? '<h4 class="gs-amon__tit">Sancions</h4><ul class="gs-sanc__llista">' + sancs.map(function (x) { return '<li><span class="gs-punt gs-punt--' + COLOR_SANCIO[x.estat] + '"></span> <b>' + esc(dataVista(x.data)) + '</b> · ' + esc(x.descripcio) + ' · ' + esc(x.estat) + ' · ' + x.entrades.length + ' entrades <small class="gs-gris">' + esc(x.id_sancio) + '</small>' +
        (pot ? ' <button type="button" class="gs-enllac" data-sanc="edita" data-id="' + esc(x.id_sancio) + '">Edita</button> <button type="button" class="gs-enllac gs-perill" data-sanc="esborra" data-id="' + esc(x.id_sancio) + '">Esborra</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="gs-gris">Encara no té cap sanció.</p>') +
      (pot ? '<h4 class="gs-amon__tit">' + (ed ? 'Edita la sanció ' + esc(ed.id_sancio) : 'Nova sanció') + '</h4>' +
        '<div class="gs-form-fila"><label style="flex:2">Descripció <input type="text" id="gsSancDesc" maxlength="500" value="' + esc(ed ? ed.descripcio : '') + '" placeholder="P. ex. retards reiterats: dimecres al pati"></label>' +
        '<label>Data <input type="date" id="gsSancData" value="' + esc(ed ? ed.data : isoDe(new Date())) + '"></label>' +
        '<label>Estat <select id="gsSancEstat">' + Object.keys(COLOR_SANCIO).map(function (e) { return '<option' + ((ed ? ed.estat : 'en tràmit') === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label></div>' +
        '<p class="gs-ajuda">Marqueu les entrades que formen part d’aquesta sanció (les d’una altra sanció no es poden triar).</p>' : '') +
      '<div class="gs-sanc__ents"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr>' + (pot ? '<th><input type="checkbox" id="gsSancTots" aria-label="Marca-les totes"></th>' : '') + '<th>Estat</th><th>Data</th><th>Hora</th><th>Sanció</th></tr></thead><tbody>' +
      ents.map(function (f) { var altra = f.id_sancio && (!ed || f.id_sancio !== ed.id_sancio);
        return '<tr' + (altra ? ' class="gs-gris"' : '') + '>' + (pot ? '<td><input type="checkbox" class="gsSancEnt" value="' + esc(f.id) + '"' + (marcades.indexOf(f.id) >= 0 ? ' checked' : '') + (altra ? ' disabled' : '') + '></td>' : '') +
          '<td><span class="gs-punt gs-punt--' + esc(f.estat || 'blanc') + '" title="' + esc(TEXT_ESTAT_ENT[f.estat || 'blanc']) + '"></span></td><td>' + esc(dataVista(f.data)) + '</td><td>' + esc(f.hora) + '</td><td>' + esc(f.id_sancio || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="prog-avis" id="gsSancErr" hidden></p>';
    var cos = null;
    var botons = pot ? [{ t: ed ? 'Desa la sanció' : 'Crea la sanció', valor: 'desa', abans: function () {
      cos = { tipus: 'retards', modul: 'control_entrada', descripcio: $('gsSancDesc').value, data: $('gsSancData').value, estat: $('gsSancEstat').value, entrades: [].map.call(document.querySelectorAll('.gsSancEnt:checked'), function (x) { return x.value; }) };
      var e = []; if (!cos.descripcio.trim()) e.push('Cal la descripció.'); if (!cos.data) e.push('Cal la data.'); if (!cos.entrades.length) e.push('Marqueu almenys una entrada.');
      if (e.length) { $('gsSancErr').textContent = e.join(' '); $('gsSancErr').hidden = false; return false; }
      if (ed) cos.id_sancio = ed.id_sancio; } }] : [];
    if (ed) botons.push({ t: 'Nova sanció', valor: 'nova', tipus: 'ghost' });
    botons.push({ t: pot ? 'Cancel·la' : 'Tanca', valor: 0, tipus: 'ghost' });
    var obre = pregunta('Entrades i sancions', html, botons, false);
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample');
    if ($('gsSancTots')) $('gsSancTots').addEventListener('change', function () { var v = this.checked; [].forEach.call(document.querySelectorAll('.gsSancEnt:not(:disabled)'), function (x) { x.checked = v; }); });
    var accio = null;
    [].forEach.call(document.querySelectorAll('#gsModalText [data-sanc]'), function (b) { b.addEventListener('click', function () { accio = { a: b.dataset.sanc, id: b.dataset.id }; $('gsModalBtns').lastChild.click(); }); });
    var fi = function () { if (enAcabar) enAcabar(); };
    obre.then(function (v) {
      if (accio && accio.a === 'edita') return dialegSancio(fila, accio.id, enAcabar);
      if (accio && accio.a === 'esborra') return pregunta('Esborra la sanció', '<p>S’esborrarà la sanció ' + esc(accio.id) + ' i les seves entrades tornaran a blanc (queda una còpia a l’historial).</p>', [{ t: 'Esborra', valor: 1, tipus: 'danger' }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]).then(function (ok) {
        if (ok) api('sancio_esborra', { id_sancio: accio.id, modul: S.modul.id }, 'Esborrant…').then(function (r) { if (!r.ok) return toast(text(r.error), true); aplicaSancions(r); toast('Sanció esborrada.'); dialegSancio(fila, null, enAcabar); }); else fi(); });
      if (v === 'nova') return dialegSancio(fila, null, enAcabar);
      if (v !== 'desa') return fi();
      api('sancio_desa', cos, 'Desant la sanció…').then(function (r) {
        if (!r.ok) { toast(r.errors ? r.errors.join(' ') : text(r.error), true); return fi(); }
        aplicaSancions(r); toast((cos.id_sancio ? 'Sanció desada: ' : 'Sanció creada: ') + r.sancio.id_sancio + ' (' + r.sancio.entrades.length + ' entrades).'); fi();
      });
    });
  }
  // Aplica a la taula els estats nous de les entrades (sense tornar a llegir el full)
  function aplicaSancions(r) {
    S.d.sancions = r.sancions || S.d.sancions; S.san = null;   // PAS 76: el mòdul Sancions es torna a llegir
    var per = {}; (r.entrades || []).forEach(function (x) { per[x.id] = x; });
    S.d.files.forEach(function (f) { var x = per[f.id]; if (x) { f.estat = x.estat; f.id_sancio = x.id_sancio; } });
    if (S.taula) S.taula.updateData((r.entrades || []).map(function (x) { return { id: x.id, estat: x.estat, id_sancio: x.id_sancio }; }));
    var b = document.querySelector('[data-accio="sancions-llista"]'); if (b) b.textContent = 'Sancions (' + S.d.sancions.length + ')';
    pintaRetards();
  }
  // PAS 73 · Gestió de les sancions: llista amb filtres (cerca, estat, grup-classe, dates), nova sanció, edició, anul·lació
  // (baixa: les entrades tornen a blanc però la sanció es conserva), recuperació i esborrat
  function llistaSancions() {
    S.sanF = S.sanF || { q: '', estat: '', grup: '', des: '', fins: '' };
    var F = S.sanF, pot = !!S.d.pot_sancionar, totes = S.d.sancions || [];
    var grups = totes.map(function (x) { return x.grup; }).filter(function (g, i, a) { return g && a.indexOf(g) === i; }).sort(ordreGrup);
    var filtra = function () { var q = plega(F.q); return totes.filter(function (x) { return (!F.estat || x.estat === F.estat) && (!F.grup || x.grup === F.grup) && (!F.des || String(x.data) >= F.des) && (!F.fins || String(x.data) <= F.fins) && (!q || plega(x.alumne + ' ' + x.descripcio + ' ' + x.id_sancio).indexOf(q) >= 0); })
      .sort(function (a, b) { return String(b.data).localeCompare(String(a.data)) || plega(a.alumne).localeCompare(plega(b.alumne), 'ca'); }); };
    var cos = function () { var l = filtra();
      return '<p class="gs-gris">' + l.length + ' de ' + totes.length + ' sancions · en tràmit ' + l.filter(function (x) { return x.estat === 'en tràmit'; }).length + ' · sancionades ' + l.filter(function (x) { return x.estat === 'sancionat'; }).length + ' · anul·lades ' + l.filter(function (x) { return x.estat === 'anul·lada'; }).length + '</p>' +
        '<div class="gs-sanc__ents gs-sanc__llistat"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th></th><th>Data</th><th>Alumne/a</th><th>Grup-Classe</th><th>Descripció</th><th>Estat</th><th>Entrades</th>' + (pot ? '<th></th>' : '') + '</tr></thead><tbody>' +
        (l.length ? l.map(function (x) { return '<tr' + (x.estat === 'anul·lada' ? ' class="gs-gris"' : '') + '><td><span class="gs-punt gs-punt--' + COLOR_SANCIO[x.estat] + '"></span></td><td>' + esc(dataVista(x.data)) + '</td><td><b>' + esc(x.alumne) + '</b></td><td>' + esc(x.grup || x.nivell || '') + '</td><td>' + esc(x.descripcio) + ' <small class="gs-gris">' + esc(x.id_sancio) + '</small></td><td>' + esc(x.estat) + '</td><td class="gs-cen">' + x.entrades.length + '</td>' +
          (pot ? '<td style="white-space:nowrap"><button type="button" class="gs-enllac" data-gsan="edita" data-id="' + esc(x.id_sancio) + '">Edita</button> · ' + (x.estat === 'anul·lada' ? '<button type="button" class="gs-enllac" data-gsan="recupera" data-id="' + esc(x.id_sancio) + '">Recupera</button>' : '<button type="button" class="gs-enllac" data-gsan="anul·la" data-id="' + esc(x.id_sancio) + '">Anul·la</button>') + ' · <button type="button" class="gs-enllac gs-perill" data-gsan="esborra" data-id="' + esc(x.id_sancio) + '">Esborra</button></td>' : '') + '</tr>'; }).join('')
          : '<tr><td colspan="8" class="gs-gris">Cap sanció amb aquests filtres.</td></tr>') + '</tbody></table></div>'; };
    var alumnes = {}; S.d.files.forEach(function (f) { var k = clauAluEnt(f); if (!alumnes[k] || String(f.data + f.hora) > String(alumnes[k].data + alumnes[k].hora)) alumnes[k] = f; });
    var llAl = Object.keys(alumnes).map(function (k) { return alumnes[k]; }).sort(function (a, b) { return plega(a.alumne).localeCompare(plega(b.alumne), 'ca'); });
    var html = '<div class="gs-form-fila"><label style="flex:2">Cerca <input type="search" id="gsSanQ" value="' + esc(F.q) + '" placeholder="Alumne/a, descripció o codi"></label>' +
      '<label>Estat <select id="gsSanE"><option value="">Tots</option>' + Object.keys(COLOR_SANCIO).map(function (e) { return '<option' + (F.estat === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label>' +
      '<label>Grup-Classe <select id="gsSanG"><option value="">Tots</option>' + grups.map(function (g) { return '<option' + (F.grup === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></label>' +
      '<label>Des del <input type="date" id="gsSanD" value="' + esc(F.des) + '"></label><label>Fins al <input type="date" id="gsSanF" value="' + esc(F.fins) + '"></label></div>' +
      (pot ? '<div class="gs-form-fila"><label style="flex:2">Nova sanció per a <select id="gsSanNou"><option value="">— trieu l’alumne/a —</option>' + llAl.map(function (f) { return '<option value="' + esc(clauAluEnt(f)) + '">' + esc(f.alumne) + ' · ' + esc(f.grup || f.nivell || '') + '</option>'; }).join('') + '</select></label></div>' : '') +
      '<div id="gsSanCos">' + cos() + '</div>';
    var accio = null;
    var obre = pregunta('Sancions del control d’entrada', html, (pot ? [{ t: '+ Nova sanció', valor: 'nova', abans: function () { if (!$('gsSanNou').value) { toast('Trieu primer l’alumne/a.', true); return false; } accio = { a: 'nova', k: $('gsSanNou').value }; } }] : [])
      .concat([{ t: 'Descarrega (CSV)', valor: 'csv', tipus: 'ghost' }, { t: 'Tanca', valor: 0, tipus: 'ghost' }]), false);
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample', 'gs-modal--sancions');   // PAS 73b: més ampla i alta
    var refresca = function () { F.q = $('gsSanQ').value; F.estat = $('gsSanE').value; F.grup = $('gsSanG').value; F.des = $('gsSanD').value; F.fins = $('gsSanF').value; $('gsSanCos').innerHTML = cos(); };
    ['gsSanE', 'gsSanG', 'gsSanD', 'gsSanF'].forEach(function (id) { $(id).addEventListener('change', refresca); }); $('gsSanQ').addEventListener('input', refresca);
    $('gsSanCos').addEventListener('click', function (e) { var b = e.target.closest('[data-gsan]'); if (!b) return; accio = { a: b.dataset.gsan, id: b.dataset.id }; $('gsModalBtns').lastChild.click(); });
    obre.then(function (v) {
      if (v === 'csv') { var q = function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; };
        var csv = '﻿' + ['Codi;Data;Alumne/a;Grup-Classe;Descripció;Estat;Entrades'].concat(filtra().map(function (x) { return [x.id_sancio, dataVista(x.data), x.alumne, x.grup, x.descripcio, x.estat, x.entrades.length].map(q).join(';'); })).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'sancions-control-entrada.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); return; }
      if (!accio) return;
      var x = totes.filter(function (y) { return y.id_sancio === accio.id; })[0];
      var torna = function () { setTimeout(llistaSancions, 50); };
      if (accio.a === 'nova') { var f = alumnes[accio.k]; if (f) dialegSancio(f, null, torna); return; }
      if (!x) return;
      var fila = S.d.files.filter(function (f) { return clauAluEnt(f) === (x.id_alumne || plega(x.alumne)); })[0] || { alumne: x.alumne, grup: x.grup, nivell: x.nivell, id_alumne: x.id_alumne };
      if (accio.a === 'edita') return dialegSancio(fila, x.id_sancio, torna);
      if (accio.a === 'esborra') return pregunta('Esborra la sanció', '<p>S’esborrarà la sanció ' + esc(x.id_sancio) + ' de <b>' + esc(x.alumne) + '</b> i les seves entrades tornaran a blanc (queda una còpia a l’historial).</p>', [{ t: 'Esborra', valor: 1, tipus: 'danger' }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]).then(function (ok) {
        if (!ok) return torna(); api('sancio_esborra', { id_sancio: x.id_sancio, modul: 'control_entrada' }, 'Esborrant…').then(function (r) { if (!r.ok) toast(textError(r), true); else { aplicaSancions(r); toast('Sanció esborrada.'); } torna(); }); });
      var nouEstat = accio.a === 'anul·la' ? 'anul·lada' : 'en tràmit';
      api('sancio_desa', { id_sancio: x.id_sancio, tipus: x.tipus || 'retards', modul: 'control_entrada', descripcio: x.descripcio, data: x.data, estat: nouEstat, entrades: x.entrades }, 'Desant…').then(function (r) {
        if (!r.ok) toast(r.errors ? r.errors.join(' ') : textError(r), true); else { aplicaSancions(r); toast(nouEstat === 'anul·lada' ? 'Sanció anul·lada: les entrades tornen a blanc.' : 'Sanció recuperada (en tràmit).'); } torna(); });
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
          if (av) setTimeout(function () { var ne = (S.avisEntrades || {})[f.id_alumne || plega(f.alumne)]; toast('Avís: ' + f.alumne + ' ja té ' + av + ' retards (' + ne + ' entrades) en ' + S.d.retards.periode + '.', true); }, 400);
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
      var per = {}, tot = { blanc: 0, groc: 0, vermell: 0, verd: 0, pes: 0 }; sel.forEach(function (f) { var k = f.id_alumne || f.alumne, e = TEXT_ESTAT_ENT[f.estat] ? f.estat : 'blanc'; var x = per[k] = per[k] || { alumne: f.alumne, nivell: f.nivell, grup: f.grup, n: 0, pes: 0, ultima: '', blanc: 0, groc: 0, vermell: 0, verd: 0 }; x.n++; x[e]++; tot[e]++; if (e !== 'groc') { x.pes += pesRetard(f.hora); tot.pes += pesRetard(f.hora); } var t = f.data + ' ' + f.hora; if (t > x.ultima) { x.ultima = t; x.grup = f.grup || x.grup; x.nivell = f.nivell || x.nivell; } });
      var llista = Object.keys(per).map(function (k) { return per[k]; }).sort(function (a, b) { return senseAccents(a.alumne).localeCompare(senseAccents(b.alumne), 'ca'); });
      var filtre = [o.niv || 'tots els nivells', o.grup || 'tots els grups', o.data ? 'a partir del ' + dataCat(o.data) : 'tot el període'].join(' · ');
      // PAS 72/76: per estat (blanc = res; groc = justificat; vermell = sanció en curs; verd = sancionat) i retards comptats (pes per hora)
      informe('Control d’entrada · anàlisi', filtre + ' · ' + sel.length + ' entrades de ' + llista.length + ' alumnes (blanques ' + tot.blanc + ', grogues ' + tot.groc + ', vermelles ' + tot.vermell + ', verdes ' + tot.verd + '). Retards = ' + TEXT_PES_RETARD + '.', ['', 'Alumne', 'Nivell', 'Grup-Classe', 'Entrades', 'Retards', 'Blanques', 'Grogues', 'Vermelles', 'Verdes'],
        llista.map(function (a, i) { return [String(i + 1), a.alumne, a.nivell || '', a.grup || '', String(a.n), String(a.pes), String(a.blanc), String(a.groc), String(a.vermell), String(a.verd)]; }).concat(llista.length ? [{ t: ['', 'Total', '', '', String(sel.length), String(tot.pes), String(tot.blanc), String(tot.groc), String(tot.vermell), String(tot.verd)] }] : []), 'control-entrada-analisi');
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
  // PAS 58: el càrrec s'assigna a Ocupació (o l'hereta el substitut): no el demana el formulari
  var NO_AL_FORMULARI = ['data_arribada_centre', 'carrec'];
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
    // PAS 58: sense «Altres dades» (hores, càrrecs i altres dades que s'assignen soles o des d'altres mòduls)
    return g.filter(function (x) { return x.camps.length; });
  }
  var esSubstitut = function () { var el = $('gsNou_situacio'); return !!el && el.value === 'Substitut'; };

  // ================================================================== PAS 47 · DESIDERATA
  // El cap de departament proposa, per a cada assignació de la seva especialitat (Currículum › Assignacions), quins docents
  // la imparteixen i quants grups fa cadascun (els grups concrets els assigna després la direcció). Comptadors d'hores,
  // observacions pedagògiques, coherència amb les hores lectives de cada docent, PDF, Excel i, per a l'administració, «Anàlisi».
  // PAS 71: en canviar d'especialitat, el professorat (igual per a totes) no es torna a demanar
  function carregaDesiderata(esp, lleuger) {
    var prof = lleuger && S.des && S.des.professorat;
    api('desiderata_dades', Object.assign(esp ? { especialitat: esp } : {}, prof ? { lleuger: true } : {}), 'Carregant la desiderata…').then(function (r) {
      if (r.ok && prof && !r.professorat) r.professorat = prof;
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
      (R.admin ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="des-analisi" title="Balanç de totes les especialitats">Anàlisi</button>' : '') +
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
    if ($('gsDesEsp')) $('gsDesEsp').addEventListener('change', function () { if (S.brut && !confirm('Hi ha canvis sense desar. Voleu canviar d’especialitat igualment?')) { this.value = R.especialitat; return; } brutDes(false); carregaDesiderata(this.value, true); });
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
  function departamentsDesiderata(despres) {
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
          toast('Departaments/àmbits desats (' + r2.departaments.length + '). Els caps ja tenen accés a Edició pàgina web departaments/àmbits i a Desiderata.');
          if (despres) despres(); else if (S.modul && S.modul.id === 'desiderata' && S.des) carregaDesiderata(S.des.especialitat); else if (S.dw) S.dw = null;   // PAS 80: des de Currículum, la pàgina dels departaments es tornarà a llegir
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
  // ------------------------------------------------------------------ PAS 56 · CALENDARI
  // Esdeveniments del curs (General = es publica al web; Intern = només GESTIO, amb nivells opcionals), dates clau i festius,
  // vistes de llista, dia, setmana, mes i trimestre (totes amb PDF) i publicació a Secretaria › Calendari escolar.
  var MESOS_CAL = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
  var DIES_CAL = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'], DIES_CAL_LL = ['dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte', 'diumenge'];
  var TIPUS_CAL = { inici: 'Inici de classes (ESO i Batx.)', darrer: 'Darrer dia de classe d’ESO', darrerBat: 'Darrer dia de 1r de Batx.', festiu: 'Festiu', local: 'Festa local',
    lliure: 'Lliure disposició', vacances: 'Vacances', trimestre1: '1r trimestre', trimestre2: '2n trimestre', trimestre3: '3r trimestre' };
  var SENSE_CLASSE = { festiu: 1, local: 1, lliure: 1, vacances: 1 };
  var VISTES_CAL = [['llista', 'Llista'], ['dia', 'Dia'], ['setmana', 'Setmana'], ['mes', 'Mes'], ['trimestre', 'Trimestre'], ['dates', 'Dates clau']];
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var isoDe = function (d) { return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
  var dataDe = function (iso) { var p = String(iso).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); };
  var mesDies = function (iso, n) { var d = dataDe(iso); d.setUTCDate(d.getUTCDate() + n); return isoDe(d); };
  var diaSet = function (iso) { return (dataDe(iso).getUTCDay() + 6) % 7; };   // dilluns = 0
  var avuiIso = function () { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  var deMes = function (m) { return (/^[aeiou]/.test(MESOS_CAL[m]) ? 'd’' : 'de ') + MESOS_CAL[m]; };
  var dataLl = function (iso, ambDia) { var d = dataDe(iso); return (ambDia ? DIES_CAL_LL[diaSet(iso)] + ' ' : '') + d.getUTCDate() + ' ' + deMes(d.getUTCMonth()) + ' de ' + d.getUTCFullYear(); };
  var dataCurta = function (iso) { var d = dataDe(iso); return d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
  var rangCal = function (a, b) { return b && b !== a ? dataCurta(a) + ' – ' + dataCurta(b) : dataCurta(a); };
  // PAS 58: colors de cada nivell (els esdeveniments de més d'un nivell, en gris) i el nivell «Professorat»
  var COLORS_NIV = { '1r ESO': 'n1', '2n ESO': 'n2', '3r ESO': 'n3', '4t ESO': 'n4', '1r BAT': 'n5', '2n BAT': 'n6', 'Professorat': 'np' };
  var colorEv = function (e) { return e.nivells.length === 1 ? COLORS_NIV[e.nivells[0]] || 'nx' : e.nivells.length ? 'nx' : 'n0'; };
  var nivsAlumnat = function (n) { return n.filter(function (x) { return x !== 'Professorat'; }); };
  var nivellsText = function (n) { n = n || []; var a = nivsAlumnat(n), p = n.length > a.length ? ['Professorat'] : [];
    if (a.length === 6) return ['Tot l’alumnat'].concat(p).join(', ');
    if (a.length === 4 && a.every(function (x) { return /ESO/.test(x); })) return ['ESO'].concat(p).join(', ');
    if (a.length === 2 && a.every(function (x) { return /BAT/.test(x); })) return ['Batxillerat'].concat(p).join(', ');
    return n.join(', ');
  };
  function carregaCalendari() {
    S.cal = S.cal || guarda.llegeix('calendari') || {};
    // PAS 76: en entrar al mòdul, sempre el dia d'avui (amb la vista recordada: dia, setmana, mes o trimestre d'avui);
    // «Actualitza» manté la data que es mirava
    var entra = !carregaCalendari.forca;
    S.cal.vista = S.cal.vista || 'mes'; S.cal.data = entra || !S.cal.data ? avuiIso() : S.cal.data; S.cal.cat = S.cal.cat || ''; S.cal.niv = Array.isArray(S.cal.niv) ? S.cal.niv : S.cal.niv ? [S.cal.niv] : []; S.cal.q = '';
    // PAS 73: les dades ja llegides es reutilitzen si cap altre mòdul n'ha desat res després («Actualitza» les torna a llegir)
    var crida = S.cal.r && fresc('calendari') && !carregaCalendari.forca ? Promise.resolve(S.cal.r) : api('calendari_dades', {}, 'Carregant el calendari…');
    carregaCalendari.forca = false;
    return crida.then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.cal.r = r; S.d = { files: [], camps: [], nivell: r.nivell, obert: r.obert };
      // fora del curs (p. ex. a l'estiu): s'obre a l'inici de classes
      var D = datesCal(); if (entra && D.inici && (S.cal.data < D.inici || S.cal.data > D.final)) S.cal.data = D.inici;
      lligaCalendari(); pintaCalendari();
    });
  }
  var edCal = function () { return S.cal.r && nivellIdx(S.cal.r.nivell) >= 1 && S.cal.r.obert; };
  var adminCal = function () { return S.cal.r && S.cal.r.nivell === 'admin'; };
  function datesCal() {
    var dd = (S.cal.r.dates && S.cal.r.dates.dates) || [], u = function (t) { return (dd.filter(function (x) { return x.tipus === t; })[0] || {}).des; };
    // PAS 57: cada trimestre té inici i final (Dates clau › Trimestres); si falten, es dedueixen de l'inici i el final de classes
    var tr = function (k) { return dd.filter(function (x) { return x.tipus === 'trimestre' + k; })[0] || {}; };
    var T1 = tr(1), T2 = tr(2), T3 = tr(3);
    var inici = u('inici'), fi = u('darrer'), t2 = T2.des, t3 = T3.des;
    var a = Number(String(S.cal.r.dates.curs || '').slice(0, 4)) || dataDe(inici || avuiIso()).getUTCFullYear();
    inici = inici || a + '-09-01'; fi = fi || (a + 1) + '-06-30';
    t2 = t2 || (a + 1) + '-01-01'; t3 = t3 || (a + 1) + '-04-01';
    return { inici: inici, final: fi, trimestres: [[T1.des || inici, T1.fins || mesDies(t2, -1)], [t2, T2.fins || mesDies(t3, -1)], [t3, T3.fins || fi]] };
  }
  function clauDelDia(iso) { return ((S.cal.r.dates && S.cal.r.dates.dates) || []).filter(function (x) { return !/^trimestre/.test(x.tipus) && iso >= x.des && iso <= (x.fins || x.des); }); }
  function evFiltrats() {
    var q = S.cal.vista === 'llista' ? normCal(S.cal.q || '') : '';   // la cerca només és a la llista
    return S.cal.r.esdeveniments.filter(function (e) {
      if (S.cal.cat && e.categoria !== S.cal.cat) return false;
      // PAS 58: diversos nivells alhora; els esdeveniments sense nivell (tot el centre) sempre hi surten
      if (S.cal.niv.length && e.nivells.length && !e.nivells.some(function (n) { return S.cal.niv.indexOf(n) >= 0; })) return false;
      return !q || normCal(e.descripcio + ' ' + e.hora + ' ' + e.nivells.join(' ')).indexOf(q) >= 0;
    });
  }
  var normCal = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var ordreEv = function (a, b) { return (a.data_inici + (a.hora || '99')).localeCompare(b.data_inici + (b.hora || '99')) || a.descripcio.localeCompare(b.descripcio, 'ca'); };
  function evDelDia(iso, ll) { return (ll || evFiltrats()).filter(function (e) { return iso >= e.data_inici && iso <= (e.data_fi || e.data_inici); }).sort(function (a, b) { return String(a.hora || '99').localeCompare(String(b.hora || '99')); }); }
  function evEntre(a, b) { return evFiltrats().filter(function (e) { return e.data_inici <= b && (e.data_fi || e.data_inici) >= a; }).sort(ordreEv); }
  // Interval de la vista actual i el seu títol
  function intervalCal() {
    var d = S.cal.data, v = S.cal.vista, D = datesCal();
    if (v === 'dia') return { a: d, b: d, titol: dataLl(d, true) };
    if (v === 'setmana') { var a = mesDies(d, -diaSet(d)), b = mesDies(a, 6); return { a: a, b: b, titol: 'Setmana del ' + dataCurta(a) + ' al ' + dataLl(b) }; }
    if (v === 'mes') { var x = dataDe(d), a2 = x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-01'; var u = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)); return { a: a2, b: isoDe(u), titol: MESOS_CAL[x.getUTCMonth()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' de ' + x.getUTCFullYear() }; }
    if (v === 'trimestre') { var i = trimestreDe(d), t = D.trimestres[i]; return { a: t[0], b: t[1], i: i, titol: ['1r', '2n', '3r'][i] + ' trimestre (' + dataCurta(t[0]) + ' – ' + dataCurta(t[1]) + ')' }; }
    return { a: D.inici, b: D.final, titol: 'Curs ' + (S.cal.r.dates.curs || '') };
  }
  function trimestreDe(iso) { var T = datesCal().trimestres; for (var i = 0; i < 3; i++) if (iso <= T[i][1]) return i; return 2; }
  function mouCal(n) {
    var v = S.cal.vista, d = S.cal.data;
    if (v === 'dia') d = mesDies(d, n); else if (v === 'setmana') d = mesDies(d, 7 * n);
    else if (v === 'mes') { var x = dataDe(d); d = isoDe(new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1))); }
    else if (v === 'trimestre') { var i = trimestreDe(d) + n, T = datesCal().trimestres; if (i < 0 || i > 2) return; d = T[i][0]; }
    S.cal.data = d; pintaCalendari();
  }
  function desaPrefCal() { guarda.desa('calendari', { vista: S.cal.vista, data: S.cal.data, cat: S.cal.cat, niv: S.cal.niv }); }
  // PAS 74 · La vista actual del calendari com a imatge (PNG), tal com es veu, amb el títol, el període i els filtres.
  // Es fa d'una còpia sense desplaçament (les vistes amb barra de desplaçament surten senceres).
  function imatgeCal() {
    var t = $('gsTaula'); if (!t) return;
    var V = { mes: 'mes', setmana: 'setmana', dia: 'dia', trimestre: 'trimestre', llista: 'llista', dates: 'dates-clau' }, v = S.cal.vista, I = v !== 'llista' && v !== 'dates' ? intervalCal() : null;
    var filtres = [S.cal.cat || 'totes les categories', S.cal.niv.length ? S.cal.niv.join(', ') : 'tots els nivells'].join(' · ');
    var crida = carregaScript(LIBS.html2canvas).then(function () {
      return window.html2canvas(t, { backgroundColor: '#ffffff', scale: 2, useCORS: true, windowWidth: Math.max(document.documentElement.clientWidth, t.scrollWidth + 40),
        onclone: function (doc) {
          var c = doc.getElementById('gsTaula'); c.style.height = 'auto'; c.style.maxHeight = 'none'; c.style.overflow = 'visible';
          [].forEach.call(c.querySelectorAll('*'), function (el) { var cs = doc.defaultView.getComputedStyle(el); if (/auto|scroll/.test(cs.overflowY) || /auto|scroll/.test(cs.overflowX)) { el.style.overflow = 'visible'; el.style.maxHeight = 'none'; el.style.height = 'auto'; } });
          [].forEach.call(c.querySelectorAll('[data-cal="nou"], .gs-cal__afegeix'), function (el) { el.remove(); });
          var h = doc.createElement('div'); h.style.cssText = 'font:600 18px Montserrat,system-ui,sans-serif;color:#1C0CBC;margin:0 0 4px';
          h.textContent = 'Institut Joan Miró · Calendari' + (v === 'dates' ? ' · Dates clau' : v === 'llista' ? ' · Llista' : '');   // el període ja surt al títol de la vista
          var f = doc.createElement('div'); f.style.cssText = 'font:12px Montserrat,system-ui,sans-serif;color:#5A6078;margin:0 0 10px'; f.textContent = filtres;
          c.insertBefore(f, c.firstChild); c.insertBefore(h, c.firstChild); c.style.padding = '16px';
        } });
    }).then(function (canvas) {
      return new Promise(function (ok) { canvas.toBlob(function (b) { ok(b); }, 'image/png'); });
    }).then(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'calendari-' + (V[v] || v) + '-' + (S.cal.data || avuiIso()) + '.png';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); toast('Imatge desada (' + a.download + ').');
    }).catch(function (e) { if (window.console) console.error(e); toast('No s’ha pogut fer la imatge.', true); });
    return window.Progres ? Progres.amb(crida, 'Fent la imatge…') : crida;
  }
  function pintaCalendari() {
    desaPrefCal();
    var R = S.cal.r, v = S.cal.vista, ed = edCal(), I = intervalCal(), nav = v !== 'llista' && v !== 'dates';
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist">' + VISTES_CAL.map(function (x) { return '<button type="button" role="tab" data-cal="vista" data-v="' + x[0] + '" aria-selected="' + (x[0] === v) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (nav ? '<span class="gs-cal__nav"><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-cal="ant" aria-label="Anterior">◀</button><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-cal="avui">Avui</button><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-cal="seg" aria-label="Següent">▶</button>' +
        '<input type="date" class="gs-cal__salta" data-cal="salta" value="' + esc(S.cal.data) + '" aria-label="Vés a la data"></span>' : '') +
      (v !== 'dates' ? '<select data-cal="cat" aria-label="Categoria"><option value="">Totes les categories</option><option value="General"' + (S.cal.cat === 'General' ? ' selected' : '') + '>General</option><option value="Intern"' + (S.cal.cat === 'Intern' ? ' selected' : '') + '>Intern</option></select>' +
        '<details class="gs-cal__nivs"><summary>' + (S.cal.niv.length && S.cal.niv.length < R.nivells.length ? esc(S.cal.niv.join(', ')) : 'Tots els nivells') + '</summary><div>' + R.nivells.map(function (n) { return '<label class="gs-check"><input type="checkbox" data-cal="nivx" value="' + esc(n) + '"' + (S.cal.niv.indexOf(n) >= 0 ? ' checked' : '') + '> <i class="gs-cal__sw gs-cal__c--' + COLORS_NIV[n] + '"></i>' + esc(n) + '</label>'; }).join('') +
          '<p class="gs-cal__nivbtn"><button type="button" class="gs-enllac" data-cal="niv-cap">Cap</button> · <button type="button" class="gs-enllac" data-cal="niv-tots">Tots</button></p>' +
          '<p class="gs-cal__nivbtn"><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-cal="niv-cancela">Cancel·la</button><button type="button" class="prog-btn prog-btn--sm" data-cal="niv-accepta">Accepta</button></p></div></details>' : '') +
      (v === 'llista' ? '<input type="search" class="gs-cal__cerca" data-cal="cerca" placeholder="Cerca…" value="' + esc(S.cal.q || '') + '">' : '') +
      '<span class="gs-espai"></span>' + '<button type="button" class="prog-btn prog-btn--ghost" data-accio="mod-actualitza" title="Torna a llegir les dades (p. ex. si algú altre les ha canviat)">Actualitza</button>' +
      (ed && v !== 'dates' ? '<button type="button" class="prog-btn" data-cal="nou">+ Nou esdeveniment</button>' : '') +
      (v !== 'dates' ? '<button type="button" class="prog-btn prog-btn--ghost" data-cal="pdf" title="PDF de la vista actual (amb els filtres)">PDF</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-cal="imatge" title="Imatge (PNG) de la vista actual, tal com es veu (amb els filtres)">Imatge</button>' +
      (adminCal() ? '<button type="button" class="prog-btn prog-btn--ghost" data-cal="importa" title="Afegeix els esdeveniments del full del calendari (config › font_calendari) que encara no hi són">Importa del full</button>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-cal="publica" title="Publica les dates clau i els esdeveniments «General» a Secretaria › Calendari escolar">Publica</button>' : '') +
      '<p class="gs-ajuda gs-cal__ajuda">' + (v === 'dates' ? 'Inici i final de classes, inici dels trimestres, festius, dies de lliure disposició, festes locals i vacances. Surten a totes les vistes i, en publicar, al web (els trimestres, no).' :
        'Vora <span class="gs-cal__ll gs-cal__ll--General">General</span> (es publica al web) o <span class="gs-cal__ll gs-cal__ll--Intern">Intern</span> (només GESTIO). Color: el del nivell ' + R.nivells.map(function (n) { return '<i class="gs-cal__sw gs-cal__c--' + COLORS_NIV[n] + '" title="' + esc(n) + '"></i>'; }).join('') + ', gris si és de més d’un nivell i blanc si és de tot el centre. ' + (ed ? 'Cliqueu un dia per afegir-hi un esdeveniment i un esdeveniment per canviar-lo.' : '')) +
        (R.publicat ? ' <span class="gs-cal__pub">Publicat el ' + esc(String(R.publicat.data).slice(0, 16)) + ' (' + R.publicat.n + ' esdeveniments).</span>' : adminCal() ? ' <span class="gs-cal__pub">Encara no s’ha publicat.</span>' : '') + '</p>';
    var html;
    try {
      html = v === 'dates' ? htmlDatesCal(ed) : (nav ? '<h3 class="gs-cal__titol">' + esc(I.titol) + '</h3>' : '') +
        (v === 'llista' ? htmlLlistaCal(evFiltrats().sort(ordreEv), ed, true) : v === 'dia' ? htmlDiaCal(I.a, ed) : v === 'setmana' ? htmlSetmanaCal(I.a) : v === 'mes' ? htmlMesCal(I.a, false) : htmlTrimestreCal(I));
    } catch (er) { if (window.console) console.error(er); html = '<p class="prog-avis">No s’ha pogut mostrar el calendari: ' + esc(er && er.message || er) + '</p>'; }
    var t = $('gsTaula'); t.className = 'gs-cal gs-cal--' + v; t.innerHTML = html;
    ajustaAlcada();
  }
  var chipCal = function (e, curt) { return '<button type="button" class="gs-cal__ev gs-cal__ev--' + e.categoria + ' gs-cal__c--' + colorEv(e) + '" data-cal="edita" data-id="' + esc(e.id) + '" title="' + esc((e.hora ? e.hora + ' · ' : '') + e.descripcio + (e.nivells.length ? ' (' + nivellsText(e.nivells) + ')' : '') + ' · ' + e.categoria) + '">' + (e.hora && !curt ? '<b>' + esc(e.hora.split('-')[0]) + '</b> ' : '') + esc(e.descripcio) + '</button>'; };
  var classeDia = function (iso) { return clauDelDia(iso).map(function (x) { return ' is-' + x.tipus; }).join('') + (diaSet(iso) >= 5 ? ' is-we' : '') + (iso === avuiIso() ? ' is-avui' : ''); };
  var marcaClau = function (iso) { return clauDelDia(iso).map(function (x) { return '<span class="gs-cal__clau gs-cal__clau--' + x.tipus + '">' + esc(x.nom && x.nom.ca || TIPUS_CAL[x.tipus]) + '</span>'; }).join(''); };
  function htmlMesCal(a, mini) {
    var x = dataDe(a), primer = x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-01', ini = mesDies(primer, -diaSet(primer)), ll = evFiltrats(), h = '';
    for (var s = 0; s < 6; s++) {
      var w = mesDies(ini, 7 * s); if (s && dataDe(w).getUTCMonth() !== x.getUTCMonth()) break;
      h += '<tr>' + [0, 1, 2, 3, 4, 5, 6].map(function (k) {
        var iso = mesDies(w, k), fora = dataDe(iso).getUTCMonth() !== x.getUTCMonth(), evs = fora ? [] : evDelDia(iso, ll);
        if (mini) return '<td class="gs-cal__mdia' + (fora ? ' is-fora' : classeDia(iso)) + '"' + (fora ? '' : ' data-cal="dia" data-d="' + iso + '" title="' + esc(evs.length + ' esdeveniments' + (clauDelDia(iso).length ? ' · ' + clauDelDia(iso).map(function (c) { return TIPUS_CAL[c.tipus]; }).join(', ') : '')) + '"') + '>' + (fora ? '' : dataDe(iso).getUTCDate() + (evs.length ? '<i class="gs-cal__punts">' + evs.slice(0, 3).map(function (e) { return '<span class="gs-cal__punt gs-cal__punt--' + e.categoria + '"></span>'; }).join('') + '</i>' : '')) + '</td>';
        return '<td class="gs-cal__dia' + (fora ? ' is-fora' : classeDia(iso)) + '"' + (fora ? '' : ' data-cal="cel" data-d="' + iso + '"') + '><div class="gs-cal__num">' + (fora ? '<span>' + dataDe(iso).getUTCDate() + '</span>' : '<button type="button" class="gs-enllac" data-cal="dia" data-d="' + iso + '" title="Vista del dia">' + dataDe(iso).getUTCDate() + '</button>' + marcaClau(iso)) + '</div>' +
          evs.slice(0, 4).map(function (e) { return chipCal(e); }).join('') + (evs.length > 4 ? '<button type="button" class="gs-enllac gs-cal__mes" data-cal="dia" data-d="' + iso + '">+' + (evs.length - 4) + ' més</button>' : '') + '</td>';
      }).join('') + '</tr>';
    }
    return '<table class="gs-cal__graella' + (mini ? ' gs-cal__graella--mini' : '') + '">' + (mini ? '<caption>' + MESOS_CAL[x.getUTCMonth()] + ' ' + x.getUTCFullYear() + '</caption>' : '') + (mini ? '' : '<colgroup>' + DIES_CAL.map(function (d, k) { return '<col style="width:' + (k >= 5 ? 10 : 16) + '%">'; }).join('') + '</colgroup>') + '<thead><tr>' + DIES_CAL.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead><tbody>' + h + '</tbody></table>';
  }
  function htmlSetmanaCal(a) {
    var ll = evFiltrats();
    return '<div class="gs-cal__setmana">' + [0, 1, 2, 3, 4, 5, 6].map(function (k) {
      var iso = mesDies(a, k), evs = evDelDia(iso, ll);
      return '<section class="gs-cal__col' + classeDia(iso) + '" data-cal="cel" data-d="' + iso + '"><h4><button type="button" class="gs-enllac" data-cal="dia" data-d="' + iso + '">' + DIES_CAL_LL[k] + ' ' + dataCurta(iso) + '</button></h4>' + marcaClau(iso) +
        evs.map(function (e) { return chipCal(e); }).join('') + '</section>';
    }).join('') + '</div>';
  }
  function htmlDiaCal(iso, ed) {
    var evs = evDelDia(iso), clau = marcaClau(iso);
    return (clau ? '<p class="gs-cal__claus">' + clau + '</p>' : '') + (ed ? htmlAfegeixCal(iso) : '') + (evs.length ? htmlLlistaCal(evs, ed, false) : '<p class="gs-ajuda">Cap esdeveniment aquest dia' + (S.cal.cat || S.cal.niv ? ' (amb els filtres triats)' : '') + '.</p>');
  }
  function htmlTrimestreCal(I) {
    var mesos = [], x = dataDe(I.a);
    while (isoDe(x) <= I.b) { mesos.push(isoDe(x)); x = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 1)); }
    var evs = evEntre(I.a, I.b);
    return '<div class="gs-cal__minis">' + mesos.map(function (m) { return htmlMesCal(m, true); }).join('') + '</div><p class="gs-ajuda"><b>' + evs.length + '</b> esdeveniments en aquest trimestre (' + evs.filter(function (e) { return e.categoria === 'General'; }).length + ' generals).</p>' + htmlLlistaCal(evs, edCal(), true);
  }
  function htmlAfegeixCal(iso) {
    return '<form class="gs-cal__afegeix" data-cal="afegeix"><input type="date" name="data_inici" value="' + esc(iso || '') + '" required aria-label="Data"><input type="text" name="hora" placeholder="Hora (9:00)" aria-label="Hora" size="9">' +
      '<input type="text" name="descripcio" placeholder="Nou esdeveniment… (Retorn per afegir)" aria-label="Descripció" required>' +
      '<select name="categoria" aria-label="Categoria"><option>Intern</option><option>General</option></select>' +
      '<select name="nivells" aria-label="Nivells"><option value="">Sense nivell</option><option value="ESO">Tota l’ESO</option><option value="BAT">Tot el batxillerat</option>' + S.cal.r.nivells.map(function (n) { return '<option>' + n + '</option>'; }).join('') + '</select>' +
      '<button type="submit" class="prog-btn prog-btn--sm">Afegeix</button></form>';
  }
  function htmlLlistaCal(evs, ed, perMes) {
    var mes = '', files = '';
    evs.forEach(function (e) {
      var m = e.data_inici.slice(0, 7);
      if (perMes && m !== mes) { mes = m; files += '<tr class="gs-cal__mesfila"><th colspan="6">' + MESOS_CAL[Number(m.slice(5)) - 1] + ' ' + m.slice(0, 4) + '</th></tr>'; }
      files += '<tr data-id="' + esc(e.id) + '"><td class="gs-cal__ld">' + esc(rangCal(e.data_inici, e.data_fi)) + ' <small>' + DIES_CAL[diaSet(e.data_inici)] + '</small></td><td>' + esc(e.hora) + '</td><td><button type="button" class="gs-cal__lt" data-cal="edita" data-id="' + esc(e.id) + '">' + esc(e.descripcio) + '</button></td>' +
        '<td><span class="gs-cal__ll gs-cal__ll--' + e.categoria + '">' + e.categoria + '</span></td><td>' + esc(nivellsText(e.nivells)) + '</td><td class="gs-cen">' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-cal="esborra" data-id="' + esc(e.id) + '" title="Esborra" aria-label="Esborra">🗑</button>' : '') + '</td></tr>';
    });
    return (S.cal.vista === 'llista' && ed ? htmlAfegeixCal(S.cal.data) : '') + (evs.length ? '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-cal__llista"><thead><tr><th>Data</th><th>Hora</th><th>Esdeveniment</th><th>Categoria</th><th>Nivells</th><th></th></tr></thead><tbody>' + files + '</tbody></table>' : (S.cal.vista === 'dia' ? '' : '<p class="gs-ajuda">Cap esdeveniment' + (S.cal.cat || S.cal.niv || S.cal.q ? ' amb els filtres triats' : '') + '.</p>'));
  }
  function htmlDatesCal(ed) {
    var D = S.cal.datesEd || (S.cal.datesEd = JSON.parse(JSON.stringify(S.cal.r.dates))), dis = ed ? '' : ' disabled';
    var T = datesCal().trimestres, idx = function (k) { for (var i = 0; i < D.dates.length; i++) if (D.dates[i].tipus === 'trimestre' + k) return i; return -1; };
    return '<section class="gs-hor__sec"><p><label>Curs <input type="text" data-dk="curs" value="' + esc(D.curs || '') + '" size="10"' + dis + '></label></p>' +
      '<h3 class="gs-amon__tit">Trimestres</h3><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-cal__trim"><thead><tr><th></th><th>Inici</th><th>Final</th></tr></thead><tbody>' +
      [1, 2, 3].map(function (k) { var t = T[k - 1]; return '<tr data-trim="' + k + '"><th>' + ['1r', '2n', '3r'][k - 1] + ' trimestre</th><td><input type="date" data-tk="des" value="' + esc(t[0]) + '"' + dis + '></td><td><input type="date" data-tk="fins" value="' + esc(t[1]) + '"' + dis + '></td></tr>'; }).join('') +
      '</tbody></table><p class="gs-ajuda">Els trimestres marquen la vista Trimestre i no es publiquen. «Importa del full» els posa sols a partir de «Inici … trimestre» i «Fi del … trimestre».</p>' +
      '<h3 class="gs-amon__tit">Dates clau i festius</h3>' +
      '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-cal__dates"><thead><tr><th>Tipus</th><th>Data</th><th>Fins a (opcional)</th><th>Nom (català)</th><th>Castellà</th><th>Anglès</th><th></th></tr></thead><tbody>' +
      D.dates.map(function (x, i) {
        if (/^trimestre/.test(x.tipus)) return '';
        return '<tr data-i="' + i + '" class="is-' + esc(x.tipus) + '"><td><select data-dk="tipus"' + dis + '>' + Object.keys(TIPUS_CAL).filter(function (t) { return !/^trimestre/.test(t); }).map(function (t) { return '<option value="' + t + '"' + (t === x.tipus ? ' selected' : '') + '>' + TIPUS_CAL[t] + '</option>'; }).join('') + '</select></td>' +
          '<td><input type="date" data-dk="des" value="' + esc(x.des) + '"' + dis + '></td><td><input type="date" data-dk="fins" value="' + esc(x.fins || '') + '"' + dis + '></td>' +
          ['ca', 'es', 'en'].map(function (L) { return '<td><input type="text" data-dk="nom_' + L + '" value="' + esc((x.nom || {})[L] || '') + '" placeholder="' + (L === 'ca' ? esc(TIPUS_CAL[x.tipus] || '') : '') + '"' + dis + '></td>'; }).join('') +
          '<td>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-cal="treu-data" title="Treu" aria-label="Treu">🗑</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (ed ? '<p><button type="button" class="gs-enllac" data-cal="nova-data">+ data</button></p><p><button type="button" class="prog-btn" data-cal="desa-dates">Desa les dates clau</button> <button type="button" class="prog-btn prog-btn--ghost" data-cal="refes-dates">Descarta els canvis</button></p>' : '') +
      '<p class="gs-ajuda">El nom és opcional (per defecte, el del tipus). Si només l’escriviu en català, al web en castellà i anglès sortirà igual.</p></section>';
  }
  // ---- edició
  function editaCal(e, nou) {
    var ed = edCal(); e = e || {}; var niv = e.nivells || [], dis = ed ? '' : ' disabled';
    var html = '<div class="gs-form-fila gs-cal__form"><label>Data <input type="date" id="calDi" value="' + esc(e.data_inici || S.cal.data) + '"' + dis + '></label><label>Fins a (opcional) <input type="date" id="calDf" value="' + esc(e.data_fi || '') + '"' + dis + '></label>' +
      '<label>Hora <input type="text" id="calHo" value="' + esc(e.hora || '') + '" placeholder="9:00 o 9:00-11:00" size="12"' + dis + '></label></div>' +
      '<p><label>Descripció<br><textarea id="calDe" rows="2" maxlength="300" style="width:100%"' + dis + '>' + esc(e.descripcio || '') + '</textarea></label></p>' +
      '<fieldset class="gs-cal__fs"><legend>Categoria</legend>' + ['General', 'Intern'].map(function (c) { return '<label class="gs-check"><input type="radio" name="calCat" value="' + c + '"' + ((e.categoria || 'Intern') === c ? ' checked' : '') + dis + '> <span class="gs-cal__ll gs-cal__ll--' + c + '">' + c + '</span> ' + (c === 'General' ? '(es publica al web)' : '(només GESTIO)') + '</label>'; }).join(' ') + '</fieldset>' +
      '<fieldset class="gs-cal__fs"><legend>Nivells (cap = tot el centre)</legend>' + S.cal.r.nivells.map(function (n) { return '<label class="gs-check"><input type="checkbox" class="calNiv" value="' + n + '"' + (niv.indexOf(n) >= 0 ? ' checked' : '') + dis + '> ' + n + '</label>'; }).join(' ') +
      (ed ? ' <button type="button" class="gs-enllac" id="calNivEso">ESO</button> · <button type="button" class="gs-enllac" id="calNivBat">Batx.</button> · <button type="button" class="gs-enllac" id="calNivCap">cap</button>' : '') + '</fieldset>' +
      (e.desat_per ? '<p class="gs-ajuda">Desat per ' + esc(e.desat_per) + ' (' + esc(String(e.data).slice(0, 16)) + ')</p>' : '') + '<p class="prog-avis" id="calErr" hidden></p>';
    var llegeix = function () { return { id: nou ? '' : e.id, data_inici: $('calDi').value, data_fi: $('calDf').value, hora: $('calHo').value.trim(), descripcio: $('calDe').value.trim(),
      categoria: (document.querySelector('input[name="calCat"]:checked') || {}).value, nivells: [].map.call(document.querySelectorAll('.calNiv:checked'), function (c) { return c.value; }) }; };
    var valida = function () { var x = llegeix(), m = !x.data_inici ? 'Cal la data.' : x.data_fi && x.data_fi < x.data_inici ? 'La data final ha de ser igual o posterior a la inicial.' : !x.descripcio ? 'Cal una descripció.' : '';
      $('calErr').textContent = m; $('calErr').hidden = !m; return !m; };
    var botons = ed ? [{ t: nou ? 'Afegeix' : 'Desa', valor: 'desa', abans: valida }].concat(nou ? [] : [{ t: 'Duplica', tipus: 'ghost', valor: 'duplica', abans: valida }, { t: 'Esborra', tipus: 'ghost', valor: 'esborra' }]).concat([{ t: 'Cancel·la', tipus: 'ghost', valor: null }]) : [{ t: 'Tanca', valor: null }];
    var p = pregunta(nou ? 'Nou esdeveniment' : 'Esdeveniment', html, botons, false), dades = null;
    setTimeout(function () {
      var marca = function (f) { [].forEach.call(document.querySelectorAll('.calNiv'), function (c) { c.checked = f(c.value); }); };
      if ($('calNivEso')) { $('calNivEso').onclick = function () { marca(function (v) { return /ESO/.test(v); }); }; $('calNivBat').onclick = function () { marca(function (v) { return /BAT/.test(v); }); }; $('calNivCap').onclick = function () { marca(function () { return false; }); }; }
      [].forEach.call($('gsModalBtns').querySelectorAll('button'), function (b) { b.addEventListener('click', function () { if ($('calDi')) dades = llegeix(); }, true); });
      if (nou && $('calDe')) $('calDe').focus();
    }, 0);
    return p.then(function (v) {
      if (v === 'desa') return desaCal([dades], [], nou ? 'Esdeveniment afegit.' : 'Esdeveniment desat.');
      if (v === 'duplica') { dades.id = ''; return desaCal([dades], [], 'Esdeveniment duplicat: ara el podeu canviar.').then(function (r) { if (r && r.ids) editaCal(S.cal.r.esdeveniments.filter(function (x) { return x.id === r.ids[0]; })[0]); }); }
      if (v === 'esborra') return esborraCal(e);
    });
  }
  function desaCal(evs, esborra, msg) {
    return api('calendari_desa', { esdeveniments: evs, esborra: esborra }, 'Desant…').then(function (r) {
      if (!r.ok) { toast(r.errors ? r.errors.join(' ') : text(r.error), true); return r; }
      if (r.esdeveniments) S.cal.r.esdeveniments = r.esdeveniments;
      else {   // PAS 73: es combinen els desats i els esborrats amb els que ja hi ha (sense tornar a llegir el full)
        var fora = {}; (r.esborrats_ids || []).concat(r.desats.map(function (e) { return e.id; })).forEach(function (id) { fora[id] = 1; });
        S.cal.r.esdeveniments = S.cal.r.esdeveniments.filter(function (e) { return !fora[e.id]; }).concat(r.desats)
          .sort(function (a, b) { return (a.data_inici + (a.hora || '99')).localeCompare(b.data_inici + (b.hora || '99')); });
      }
      toast(msg || 'Desat.'); pintaCalendari(); return r;
    });
  }
  function esborraCal(e) {
    return pregunta('Esborra l’esdeveniment', '<p>Segur que voleu esborrar <b>' + esc(e.descripcio) + '</b> (' + esc(rangCal(e.data_inici, e.data_fi)) + ')?</p>', [{ t: 'Esborra', valor: true }, { t: 'Cancel·la', tipus: 'ghost', valor: false }])
      .then(function (ok) { if (ok) return desaCal([], [e.id], 'Esdeveniment esborrat.'); });
  }
  function desaDatesCal() {
    var D = S.cal.datesEd;
    return api('calendari_dates_desa', { dates: D }, 'Desant les dates clau…').then(function (r) {
      if (!r.ok) { toast(r.errors ? r.errors.join(' ') : text(r.error), true); return; }
      S.cal.r.dates = r.dates; S.cal.datesEd = null; S.brut = false; toast('Dates clau desades.'); pintaCalendari();
    });
  }
  function publicaCal() {
    var gen = S.cal.r.esdeveniments.filter(function (e) { return e.categoria === 'General'; }).length;
    return pregunta('Publica el calendari', '<p>Es publicaran a <b>Secretaria › Calendari escolar</b> les <b>dates clau</b> (sense els trimestres) i els <b>' + gen + '</b> esdeveniments de categoria <b>General</b>. Els interns no surten mai al web.</p>' +
      '<p>' + (S.cal.r.build_hook ? 'El web es tornarà a construir sol: la pàgina i el PDF del calendari s’actualitzen al cap d’uns minuts.' : 'Encara no hi ha <code>config › netlify_build_hook</code>: el calendari publicat sortirà al web en el proper desplegament.') + '</p>',
      [{ t: 'Publica', valor: true }, { t: 'Cancel·la', tipus: 'ghost', valor: false }]).then(function (ok) {
      if (!ok) return;
      return api('calendari_publica', {}, 'Publicant…').then(function (r) {
        if (!r.ok) { toast(r.errors ? r.errors.join(' ') : text(r.error), true); return; }
        S.cal.r.publicat = r.publicat;
        toast('Publicat: ' + r.n + ' esdeveniments i ' + r.dates + ' dates clau. ' + ({ iniciat: 'El web s’està tornant a construir.', sense_hook: 'Sortirà al web en el proper desplegament.' }[r.build] || 'No s’ha pogut avisar Netlify (' + r.build + '): sortirà en el proper desplegament.'), r.build !== 'iniciat' && r.build !== 'sense_hook');
        pintaCalendari();
      });
    });
  }
  function importaCal() {
    return api('calendari_importa', { prova: true }, 'Llegint el full del calendari…').then(function (r) {
      if (!r.ok) { toast(text(r.error) + (r.detall ? ' (' + r.detall + ')' : ''), true); return; }
      if (!r.n) { toast('No hi ha esdeveniments nous al full.' + (r.dubtes.length ? ' Dates no reconegudes: ' + r.dubtes.length + '.' : '')); return; }
      return pregunta('Importa del full del calendari', '<p>S’afegiran <b>' + r.n + '</b> esdeveniments nous (<b>' + r.resum.general + '</b> generals i <b>' + r.resum.intern + '</b> interns). Els que ja hi són (mateixa data i descripció) no es repeteixen; els festius i dies de lliure disposició ja són a les dates clau.</p>' +
        '<p class="gs-ajuda">La categoria i els nivells es dedueixen del text: reviseu-los després (sobretot els generals, que es publiquen).</p><ul>' + r.mostra.map(function (e) { return '<li>' + esc(rangCal(e.data_inici, e.data_fi)) + ' · ' + esc(e.descripcio) + ' <span class="gs-cal__ll gs-cal__ll--' + e.categoria + '">' + e.categoria + '</span></li>'; }).join('') + (r.n > r.mostra.length ? '<li>…</li>' : '') + '</ul>' +
        (r.dubtes.length ? '<p class="prog-avis">Files amb una data que no s’entén (no s’importen): ' + r.dubtes.map(esc).join(' · ') + '</p>' : ''), [{ t: 'Importa', valor: true }, { t: 'Cancel·la', tipus: 'ghost', valor: false }], false).then(function (ok) {
        if (!ok) return;
        return api('calendari_importa', {}, 'Important…').then(function (r2) {
          if (!r2.ok) { toast(r2.errors ? r2.errors.join(' ') : text(r2.error), true); return; }
          S.cal.r.esdeveniments = r2.esdeveniments; if (r2.dates) S.cal.r.dates = r2.dates; S.cal.datesEd = null;
          toast(r2.n + ' esdeveniments importats.' + (r2.trimestres ? ' Inici dels trimestres posat a les dates clau segons el full.' : '')); pintaCalendari();
        });
      });
    });
  }
  // ---- PDF (amb el logo): llista per a la llista, el dia i el trimestre; graella per a la setmana i el mes
  function pdfCal() {
    var v = S.cal.vista, I = intervalCal(), filtre = [S.cal.cat, S.cal.niv.join(', ')].filter(Boolean).join(' · ');
    var sub = (v === 'llista' ? 'Curs ' + (S.cal.r.dates.curs || '') : I.titol) + (filtre ? ' · ' + filtre : '') + (v === 'llista' && S.cal.q ? ' · «' + S.cal.q + '»' : '');
    if (v === 'setmana' || v === 'mes') return pdfGraellaCal(I, sub);
    var evs = v === 'llista' ? evFiltrats().sort(ordreEv) : evEntre(I.a, I.b), files = [], mes = '';
    if (v !== 'dia') ((S.cal.r.dates || {}).dates || []).filter(function (x) { return x.des <= I.b && (x.fins || x.des) >= I.a && !/^trimestre/.test(x.tipus); })
      .forEach(function (x) { evs.push({ data_inici: x.des, data_fi: x.fins || '', hora: '', descripcio: (x.nom && x.nom.ca) || TIPUS_CAL[x.tipus], categoria: 'Data clau', nivells: [] }); });
    evs.sort(ordreEv).forEach(function (e) {
      var m = e.data_inici.slice(0, 7);
      if (v !== 'dia' && m !== mes) { mes = m; files.push({ s: MESOS_CAL[Number(m.slice(5)) - 1].toUpperCase() + ' ' + m.slice(0, 4) }); }
      files.push([rangCal(e.data_inici, e.data_fi) + ' ' + DIES_CAL[diaSet(e.data_inici)], e.hora || '', e.descripcio, e.categoria, nivellsText(e.nivells)]);
    });
    if (!files.length) return toast('No hi ha cap esdeveniment per posar al PDF.', true);
    return pdfInforme('Calendari', sub, ['Data', 'Hora', 'Esdeveniment', 'Categoria', 'Nivells'], files, 'calendari-' + v, { vertical: true, esquerra: true,
      columnes: { 0: { cellWidth: 26 }, 1: { cellWidth: 20 }, 3: { cellWidth: 20 }, 4: { cellWidth: 30 } } });
  }
  function pdfGraellaCal(I, sub) {
    var mes = S.cal.vista === 'mes', ll = evFiltrats(), setmanes = [], ini = mesDies(I.a, -diaSet(I.a));
    for (var w = ini; w <= I.b; w = mesDies(w, 7)) setmanes.push(w);
    var colors = { festiu: [253, 226, 226], local: [255, 237, 213], lliure: [255, 237, 213], vacances: [230, 233, 240], inici: [221, 243, 228], darrer: [221, 243, 228], darrerBat: [221, 243, 228] };
    var crida = logoPdf().then(function (logo) {
      var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10;
      var data = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' }), fons = [];
      var cos = setmanes.map(function (w, si) {
        fons[si] = [];
        return [0, 1, 2, 3, 4, 5, 6].map(function (k) {
          var iso = mesDies(w, k), fora = mes && dataDe(iso).getUTCMonth() !== dataDe(I.a).getUTCMonth();
          if (fora) { fons[si][k] = [250, 250, 252]; return ''; }
          var cl = clauDelDia(iso).filter(function (x) { return TIPUS_CAL[x.tipus] && x.tipus.indexOf('trimestre') < 0; });
          fons[si][k] = cl.length && colors[cl[0].tipus] ? colors[cl[0].tipus] : diaSet(iso) >= 5 ? [246, 247, 250] : null;
          return [String(dataDe(iso).getUTCDate()) + (mes ? '' : ' ' + MESOS_CAL[dataDe(iso).getUTCMonth()])].concat(cl.map(function (x) { return '[' + ((x.nom && x.nom.ca) || TIPUS_CAL[x.tipus]) + ']'; }),
            evDelDia(iso, ll).map(function (e) { return '• ' + (e.hora ? e.hora.split('-')[0] + ' ' : '') + e.descripcio + (e.categoria === 'Intern' ? '' : ' (G)'); })).join('\n');
        });
      });
      var alt = (H - Y_TAULA - 14 - 8) / setmanes.length;
      doc.autoTable({ head: [DIES_CAL_LL.map(function (d) { return d.charAt(0).toUpperCase() + d.slice(1); })], body: cos, startY: Y_TAULA, margin: { top: Y_TAULA, left: M, right: M, bottom: 12 },
        styles: { font: 'helvetica', fontSize: mes ? 6.6 : 8, cellPadding: 1.2, overflow: 'linebreak', valign: 'top', lineColor: [70, 72, 90], lineWidth: 0.25, minCellHeight: mes ? alt : H - Y_TAULA - 30 },
        headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle', minCellHeight: 7 }, columnStyles: (function () { var cw = (W - 2 * M - 52) / 5, o = { 5: { cellWidth: 26 }, 6: { cellWidth: 26 } }; for (var k = 0; k < 5; k++) o[k] = { cellWidth: cw }; return o; })(),
        didParseCell: function (d) { if (d.section === 'body' && fons[d.row.index] && fons[d.row.index][d.column.index]) d.cell.styles.fillColor = fons[d.row.index][d.column.index]; },
        didDrawPage: function () { capPdf(doc, logo, 'CALENDARI · Institut Joan Miró', data + ' · ' + sub + ' · (G) = General', M, W);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120); doc.text('Pàgina ' + doc.internal.getNumberOfPages(), W - M, H - 6, { align: 'right' }); } });
      doc.save('calendari-' + S.cal.vista + '-' + I.a + '.pdf');
    });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  // ---- esdeveniments (una sola vegada: els contenidors no canvien)
  function lligaCalendari() {
    if (lligaCalendari.fet) return; lligaCalendari.fet = true;
    var actiu = function () { return S.modul && S.modul.id === 'calendari' && S.cal && S.cal.r; };
    $('gsEines').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cal]'); if (!b || !actiu()) return;
      var a = b.dataset.cal;
      if (a === 'vista') { if (S.cal.datesEd && S.cal.vista === 'dates' && b.dataset.v !== 'dates') S.cal.datesEd = null; S.cal.vista = b.dataset.v; pintaCalendari(); }
      else if (a === 'ant') mouCal(-1); else if (a === 'seg') mouCal(1);
      else if (a === 'avui') { S.cal.data = avuiIso(); pintaCalendari(); }
      else if (a === 'nou') editaCal({ data_inici: S.cal.vista === 'mes' || S.cal.vista === 'trimestre' ? '' : S.cal.data, nivells: S.cal.niv.slice(), categoria: S.cal.cat || 'Intern' }, true);
      // PAS 59: la tria de nivells s'aplica amb «Accepta»; «Cap» i «Tots» marquen o desmarquen, «Cancel·la» la deixa com era
      else if (a === 'niv-cap' || a === 'niv-tots') [].forEach.call(document.querySelectorAll('#gsEines input[data-cal="nivx"]'), function (c) { c.checked = a === 'niv-tots'; });
      else if (a === 'niv-cancela') pintaCalendari();
      else if (a === 'niv-accepta') { var tr = [].map.call(document.querySelectorAll('#gsEines input[data-cal="nivx"]:checked'), function (c) { return c.value; }); S.cal.niv = tr.length === S.cal.r.nivells.length ? [] : tr; pintaCalendari(); }
      else if (a === 'pdf') pdfCal(); else if (a === 'imatge') imatgeCal(); else if (a === 'publica') publicaCal(); else if (a === 'importa') importaCal();
    });
    $('gsEines').addEventListener('change', function (e) {
      var x = e.target, a = x.dataset && x.dataset.cal; if (!a || !actiu()) return;
      if (a === 'cat') S.cal.cat = x.value; else if (a === 'nivx') return; else if (a === 'salta' && x.value) S.cal.data = x.value; else return;
      pintaCalendari();
    });
    $('gsEines').addEventListener('input', function (e) {
      if (!actiu() || e.target.dataset.cal !== 'cerca') return;
      S.cal.q = e.target.value; clearTimeout(lligaCalendari.t);
      lligaCalendari.t = setTimeout(function () { var t = $('gsTaula'); t.innerHTML = htmlLlistaCal(evFiltrats().sort(ordreEv), edCal(), true); }, 200);
    });
    $('gsTaula').addEventListener('click', function (e) {
      if (!actiu()) return;
      var b = e.target.closest('[data-cal]'); if (!b) return;
      var a = b.dataset.cal, ev = function () { return S.cal.r.esdeveniments.filter(function (x) { return x.id === b.dataset.id; })[0]; };
      if (a === 'edita') { e.stopPropagation(); if (ev()) editaCal(ev()); }
      else if (a === 'esborra') { if (ev()) esborraCal(ev()); }
      else if (a === 'dia') { e.stopPropagation(); S.cal.data = b.dataset.d; S.cal.vista = 'dia'; pintaCalendari(); }
      else if (a === 'cel') { if (edCal()) editaCal({ data_inici: b.dataset.d, nivells: S.cal.niv.slice(), categoria: S.cal.cat || 'Intern' }, true); }
      else if (a === 'nova-data') { S.cal.datesEd.dates.push({ des: S.cal.data, tipus: 'festiu' }); S.brut = true; pintaCalendari(); }
      else if (a === 'treu-data') { S.cal.datesEd.dates.splice(Number(b.closest('tr').dataset.i), 1); S.brut = true; pintaCalendari(); }
      else if (a === 'desa-dates') desaDatesCal();
      else if (a === 'refes-dates') { S.cal.datesEd = null; S.brut = false; pintaCalendari(); }
    });
    $('gsTaula').addEventListener('change', function (e) {
      if (!actiu() || S.cal.vista !== 'dates') return;
      var x = e.target, k = x.dataset.dk, D = S.cal.datesEd;
      if (x.dataset.tk) { var nk = x.closest('tr').dataset.trim, t = D.dates.filter(function (d) { return d.tipus === 'trimestre' + nk; })[0];
        if (!t) { var T0 = datesCal().trimestres[nk - 1]; t = { tipus: 'trimestre' + nk, des: T0[0], fins: T0[1] }; D.dates.push(t); }
        t[x.dataset.tk] = x.value; S.brut = true; return; }
      if (!k) return;
      S.brut = true;
      if (k === 'curs') { D.curs = x.value.trim(); return; }
      var f = D.dates[Number(x.closest('tr').dataset.i)];
      if (k.indexOf('nom_') === 0) { f.nom = f.nom || {}; f.nom[k.slice(4)] = x.value.trim(); }
      else if (k === 'fins') { if (x.value) f.fins = x.value; else delete f.fins; }
      else { f[k] = x.value; if (k === 'tipus') pintaCalendari(); }
    });
    $('gsTaula').addEventListener('submit', function (e) {
      if (!actiu() || e.target.dataset.cal !== 'afegeix') return;
      e.preventDefault();
      var f = e.target, n = f.nivells.value, x = { data_inici: f.data_inici.value, hora: f.hora.value.trim(), descripcio: f.descripcio.value.trim(), categoria: f.categoria.value,
        nivells: n === 'ESO' ? S.cal.r.nivells.slice(0, 4) : n === 'BAT' ? S.cal.r.nivells.slice(4, 6) : n ? [n] : [] };
      if (!x.data_inici || !x.descripcio) return toast('Cal la data i la descripció.', true);
      S.cal.data = x.data_inici;
      desaCal([x], [], 'Esdeveniment afegit.').then(function (r) { var d = r && r.ok && document.querySelector('.gs-cal__afegeix [name="descripcio"]'); if (d) d.focus(); });
    });
  }
  // ------------------------------------------------------------------ PAS 64/67 · HORARIS · EDITOR
  // L'horari calculat pel MOTOR (generador-horaris, fitxer «horari-resultat») s'importa aquí. Consulta per docent, grup-classe,
  // espai i guàrdies; fins a 3 graelles alhora (de tipus diferents); cada matèria amb el seu color (un clic en ressalta totes
  // les hores); PDF amb l'aula entre [ ] i llegenda numerada quan una casella té més de tres docents.
  var NOM_TIPUS_HE = { reunio: 'Reunió', reduccio_lectiva: 'Reducció lectiva', reduccio_guardia: 'Reducció de guàrdia', guardia: 'Guàrdia', guardia_b: 'Guàrdia de biblioteca', guardia_p: 'Guàrdia de pati' };
  var VISTES_HE = [['docent', 'Docent'], ['grup', 'Grup-classe'], ['espai', 'Espai'], ['guardies', 'Guàrdies']];
  // Colors de matèria (fons clar, vora fosca), assignats per ordre alfabètic de matèria perquè no es repeteixin a prop
  var PALETA_HE = [[221, 232, 255, 46, 91, 214], [255, 228, 214, 214, 96, 36], [222, 245, 228, 29, 128, 66], [244, 226, 255, 133, 52, 191], [255, 244, 204, 173, 128, 0],
    [214, 241, 245, 14, 125, 140], [255, 222, 232, 196, 44, 98], [233, 240, 214, 103, 128, 30], [230, 230, 245, 80, 80, 150], [255, 236, 224, 170, 90, 40], [222, 236, 246, 40, 100, 160], [240, 230, 220, 120, 90, 60]];
  var FIXOS_HE = { guardia: [255, 241, 222, 224, 138, 0], guardia_b: [255, 241, 222, 224, 138, 0], guardia_p: [255, 241, 222, 224, 138, 0], reduccio_lectiva: [229, 245, 236, 29, 112, 68], reduccio_guardia: [229, 245, 236, 29, 112, 68], reunio: [243, 232, 255, 123, 44, 191] };
  // PAS 68: un color per a cada parella matèria + grup (grup-classe o subgrup)
  var grupHE = function (s) { return s.grup || (s.grups_classe || []).join(', '); };
  var clauMatHE = function (s) { return s.tipus === 'classe' ? normDoc(s.materia) + '|' + grupHE(s) : s.tipus; };
  var hslRgb = function (h, sat, l) { sat /= 100; l /= 100; var k = function (n) { return (n + h / 30) % 12; }, a = sat * Math.min(l, 1 - l);
    var f = function (n) { return Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); }; return [f(0), f(8), f(4)]; };
  function colorHE(s) {
    if (FIXOS_HE[s.tipus]) return FIXOS_HE[s.tipus];
    var R = S.he.r; if (!R.colors) { R.colors = {}; var ks = R.sessions.filter(function (x) { return x.tipus === 'classe'; }).map(clauMatHE).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
      // tons repartits amb l'angle d'or: colors consecutius molt diferents
      ks.forEach(function (k, i) { var h = (i * 137.508) % 360; R.colors[k] = hslRgb(h, 78, 89).concat(hslRgb(h, 62, 36)); }); }
    return R.colors[clauMatHE(s)] || PALETA_HE[0];
  }
  var rgb = function (c, o) { return 'rgb(' + c.slice(o, o + 3).join(',') + ')'; };
  function carregaEditorHoraris() {
    S.he = S.he || { panells: [{ tipus: 'docent', sel: '' }], focus: '' };
    if (!S.he.panells) S.he.panells = [{ tipus: S.he.vista || 'docent', sel: S.he.sel || '' }];
    return api('horari_editor_dades', {}, 'Carregant l’horari…').then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      if (!(r.esquema >= 69)) { $('gsAvis').innerHTML = 'Cal l’Apps Script del PAS 69 o posterior: enganxeu el Code.gs nou, executeu «configura» i feu una nova implementació.'; $('gsAvis').hidden = false; return; }
      S.he.r = r; S.d = { files: [], camps: [], nivell: r.nivell, obert: r.obert };
      S.he.noms = {}; S.he.curts = {}; r.docents.forEach(function (d) { S.he.noms[d.id] = d.nom; S.he.curts[d.id] = d.curt; });
      S.he.canvis = 0; S.he.desfer = []; preparaHE(); lligaEditorHoraris(); pintaEditorHoraris();
    });
  }
  function itemsHE(tipus) {
    var R = S.he.r;
    if (tipus === 'docent') {
      var amb = {}; R.sessions.forEach(function (s) { s.docents.forEach(function (d) { amb[d] = 1; }); });
      return R.docents.filter(function (d) { return amb[d.id]; }).map(function (d) { return { id: d.id, nom: d.nom }; });
    }
    if (tipus === 'espai') return R.sessions.map(function (s) { return s.aula; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort(function (a, b) { return a.localeCompare(b, 'ca', { numeric: true }); }).map(function (a) { return { id: a, nom: a }; });
    if (tipus === 'guardies') return [['tot', 'Totes les guàrdies'], ['guardia', 'Ordinàries'], ['guardia_b', 'Biblioteca'], ['guardia_p', 'Pati']].map(function (x) { return { id: x[0], nom: x[1] }; });
    var o = []; Object.keys(R.grups_classe || {}).forEach(function (n) { (R.grups_classe[n] || []).forEach(function (g) { o.push({ id: g, nom: g }); }); });
    return o;
  }
  // PAS 69: als horaris, el docent amb el nom i el primer cognom («Anna Prova»)
  var nomCurtHE = function (id) { var c = S.he.curts && S.he.curts[id]; if (c) return c; var n = S.he.noms[id] || id, x = n.split(', ');
    if (x.length < 2) return n; var cg = x[0].split(' '), i = 0; while (i < cg.length - 1 && /^(de|del|la|las|los|i|y|d')$/i.test(cg[i])) i++; return x[1] + ' ' + cg.slice(0, i + 1).join(' '); };
  function sessionsHE(tipus, id) {
    return S.he.r.sessions.filter(function (s) {
      if (tipus === 'docent') return s.docents.indexOf(id) >= 0;
      if (tipus === 'espai') return s.aula === id;
      if (tipus === 'guardies') return /^guardia/.test(s.tipus) && (id === 'tot' || s.tipus === id);
      return s.grups_classe.indexOf(id) >= 0 && s.tipus === 'classe';
    });
  }
  // Text d'una sessió: títol i línia petita (sense docents si «senseDoc»: es posen a la llegenda del PDF)
  function partsTextHE(tipus, s, senseDoc) {
    var t = s.tipus === 'classe' ? s.materia : (s.tipus === 'reunio' && s.materia ? s.materia : NOM_TIPUS_HE[s.tipus] || s.tipus), sub = [];
    var docs = senseDoc ? '' : s.docents.map(nomCurtHE).join(', ');
    if (tipus === 'docent') { if (s.tipus === 'classe') sub.push(s.grup || s.grups_classe.join(', ')); }
    else if (tipus === 'grup') { if (s.grup && s.grups_classe.length && s.grup !== s.grups_classe[0]) sub.push(s.grup); if (docs) sub.push(docs); }
    else if (tipus === 'espai') { sub.push(s.grup || s.grups_classe.join(', ')); if (docs) sub.push(docs); }
    else if (docs) sub.push(docs);
    if (s.aula && tipus !== 'espai') sub.push('[' + s.aula + ']');
    return { t: t, sub: sub.join(' · ') };
  }
  // Guàrdies: a cada casella, una línia per tipus amb tots els docents
  function agrupaGuardiesHE(ll) {
    var per = {}; ll.forEach(function (s) { var g = per[s.tipus] = per[s.tipus] || { tipus: s.tipus, materia: NOM_TIPUS_HE[s.tipus], docents: [], grups_classe: [], aula: '', items: [] }; g.docents = g.docents.concat(s.docents); g.items.push(s); });
    // PAS 69: a la franja de l'esbarjo, primer la guàrdia de biblioteca i després les altres
    var ORD = ['guardia_b', 'guardia_p', 'guardia'];
    return Object.keys(per).sort(function (a, b) { return ORD.indexOf(a) - ORD.indexOf(b); }).map(function (k) { return per[k]; });
  }
  function graellaHE(tipus, id) {
    var ses = sessionsHE(tipus, id), per = {};
    ses.forEach(function (s) { (per[s.dia + ' ' + s.franja] = per[s.dia + ' ' + s.franja] || []).push(s); });
    if (tipus === 'guardies') Object.keys(per).forEach(function (k) { per[k] = agrupaGuardiesHE(per[k]); });
    var hores = {}; ses.forEach(function (s) { var k = clauMatHE(s); (hores[k] = hores[k] || { s: s, pos: {} }).pos[s.dia + ' ' + s.franja] = 1; });
    return { M: S.he.r.marc_horari, per: per, n: Object.keys(per).length, hores: hores };   // hores = franges ocupades (un bloc compta una vegada)
  }
  function pintaEditorHoraris() {
    var R = S.he.r, ed = nivellIdx(R.nivell) >= 1 && R.obert, meta = R.meta, P = S.he.panells;
    $('gsEines').innerHTML = (R.meta ? (P.length < 3 ? '<button type="button" class="prog-btn prog-btn--ghost" data-he="afegeix" title="Fins a tres graelles alhora, de tipus diferents (docent, grup-classe, espai, guàrdies)">+ Graella</button>' : '') +
        (edHE() ? '<button type="button" class="prog-btn prog-btn--ghost" data-he="desfes"' + (S.he.desfer.length ? ' title="Desfés: ' + esc(S.he.desfer[S.he.desfer.length - 1].t) + '"' : ' disabled') + '>↶ Desfés</button>' +
          '<button type="button" class="prog-btn' + (S.he.canvis ? '' : ' prog-btn--ghost') + '" data-he="desa"' + (S.he.canvis ? '' : ' disabled') + '>Desa els canvis' + (S.he.canvis ? ' (' + S.he.canvis + ')' : '') + '</button>' : '') +
        '<span class="gs-espai"></span>' + '<button type="button" class="prog-btn prog-btn--ghost" data-accio="mod-actualitza" title="Torna a llegir les dades (p. ex. si algú altre les ha canviat)">Actualitza</button>' + '<button type="button" class="prog-btn prog-btn--ghost" data-he="pdf-tots" title="Un full per a cada element del tipus de la primera graella">PDF de tots</button><button type="button" class="prog-btn prog-btn--ghost" data-he="pdf">PDF</button><button type="button" class="prog-btn prog-btn--ghost" data-he="pdf-tutories" title="Mapa de tutories (grup-classe i tutor/a) i reunions de nivell, per dies i franges">Tutories i reunions (PDF)</button>' : '<span class="gs-espai"></span>') +
      (ed ? '<button type="button" class="prog-btn" data-he="importa">Importa horari</button><input type="file" id="gsHeFitxer" accept=".json,application/json" hidden>' : '') +
      '<p class="gs-ajuda gs-cal__ajuda">' + (meta ? 'Horari calculat el <b>' + esc(dataHoraHE(meta.generat)) + '</b> (curs ' + esc(meta.curs || '?') + ') · mode: nivells <b>' + esc(Array.isArray(meta.mode.nivells) ? meta.mode.nivells.join(', ') : meta.mode.nivells || 'tots') + '</b>, lectives <b>' + esc((meta.mode.lectives || []).join(' + ') || 'cap') + '</b>, guàrdies <b>' + esc((meta.mode.guardies || []).join(' + ') || 'cap') + '</b> · ' + meta.sessions + ' hores · importat el ' + esc(dataHoraHE(meta.importat)) +
        ' · <button type="button" class="gs-enllac" data-he="avisos">penalització ' + ((meta.resultat || {}).penalitzacio || 0) + ((meta.resultat && meta.resultat.avisos || []).length ? ' · ' + meta.resultat.avisos.length + ' avisos' : '') + '</button>' + '. Cada matèria i grup té un color: un clic a una sessió (o a la llegenda) en ressalta totes les hores; Escape ho desfà.' + (edHE() ? ' <b>Per moure una sessió, arrossegueu-la</b> a una altra casella (si xoca, s’obre l’assistent); <b>doble clic</b> per canviar-ne l’aula.' : '') +
        (meta.editat ? ' Editat a mà el ' + esc(dataHoraHE(meta.editat)) + ' (' + (meta.canvis || 0) + ' canvis).' : '')
        : 'Encara no s’ha importat cap horari. Calculeu-lo amb el motor (interfície «Motor d’horaris» o <code>python -m horaris.motor</code>) i importeu el fitxer <code>horari-….json</code>' + (ed ? ' amb <b>Importa horari</b>.' : ' (cal nivell d’edició).')) + '</p>';
    var t = $('gsTaula'); t.className = 'gs-ocu gs-he';
    if (!meta) { t.innerHTML = '<p class="gs-ajuda" style="padding:12px">Sense horari.</p>'; return ajustaAlcada(); }
    t.innerHTML = '<div class="gs-he__panells gs-he__panells--' + P.length + (S.he.focus ? ' gs-he--focus' : '') + '">' + P.map(function (p, i) { return htmlPanellHE(p, i); }).join('') + '</div>';
    ajustaAlcada();
  }
  var dataHoraHE = function (x) { x = String(x || ''); var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(x); return m ? Number(m[3]) + '/' + Number(m[2]) + '/' + m[1] + ' ' + m[4] + ':' + m[5] : x; };
  function htmlPanellHE(p, pi) {
    var it = itemsHE(p.tipus); if (!it.some(function (x) { return x.id === p.sel; })) p.sel = it.length ? it[0].id : '';
    var i = it.map(function (x) { return x.id; }).indexOf(p.sel), nP = S.he.panells.length;
    var cap = '<div class="gs-he__cap" data-p="' + pi + '"><select data-he="tipus" aria-label="Tipus de graella">' + VISTES_HE.map(function (v) { return '<option value="' + v[0] + '"' + (v[0] === p.tipus ? ' selected' : '') + '>' + v[1] + '</option>'; }).join('') + '</select>' +
      (it.length ? '<button type="button" class="prog-btn prog-btn--ghost" data-he="ant" aria-label="Anterior"' + (i > 0 ? '' : ' disabled') + '>‹</button><select data-he="sel" aria-label="Element">' + it.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === p.sel ? ' selected' : '') + '>' + esc(x.nom) + '</option>'; }).join('') + '</select>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-he="seg" aria-label="Següent"' + (i < it.length - 1 ? '' : ' disabled') + '>›</button>' : '') +
      (nP > 1 ? '<button type="button" class="gs-perill gs-he__treu" data-he="treu" title="Treu aquesta graella" aria-label="Treu aquesta graella">×</button>' : '') + '</div>';
    if (!p.sel) return '<section class="gs-he__panell">' + cap + '<p class="gs-ajuda" style="padding:12px">' + (p.tipus === 'espai' ? 'Cap sessió de l’horari importat no té aula. Poseu les aules preferents a Horaris · planificador › Sessions lectives (o calculeu-lo de nou: ara el motor posa una aula ordinària lliure a les sessions que no en tenen).' : 'No n’hi ha cap amb hores.') + '</p></section>';
    var G = graellaHE(p.tipus, p.sel), M = G.M, nom = (it.filter(function (x) { return x.id === p.sel; })[0] || {}).nom || p.sel, ed = edHE();
    // PAS 69: a la vista d'un docent, ocupació, lectives (alumnat + reduccions), forats i permanència
    var st = p.tipus === 'docent' ? statsDocentHE(p.sel) : null, nf = function (x) { return String(x).replace('.', ','); };
    var h = '<section class="gs-he__panell">' + cap + '<h3 class="gs-amon__tit gs-he__titol">' + esc(nom) + ' <small class="gs-gris">· ' + (st ? nf(st.ocupacio) : G.n) + ' hores' +
      (st ? ' d’ocupació · lectives ' + st.lectives + ' (alumnat ' + st.alumnat + ' + reduccions ' + st.reduccions + ') · guàrdies ' + st.gtotal + ' (' + st.guardies.o + ' ordinàries, ' + st.guardies.p + ' pati, ' + st.guardies.b + ' biblioteca, ' + st.guardies.rg + ' reduccions) · forats ' + nf(st.forats) + ' · permanència ' + nf(st.permanencia) : '') + '</small></h3><table class="gs-he__taula"><colgroup><col class="gs-he__colh">' + M.dies.map(function () { return '<col>'; }).join('') + '</colgroup><thead><tr><th></th>' +
      M.dies.map(function (d) { return '<th>' + esc(d.charAt(0).toUpperCase() + (nP > 1 ? d.slice(1, 3) : d.slice(1))) + '</th>'; }).join('') + '</tr></thead><tbody>';
    M.franges.forEach(function (f) {
      var hiHa = M.dies.some(function (d) { return G.per[d + ' ' + f.id]; });
      if (f.esbarjo && !hiHa) { h += '<tr class="gs-he__esb"><th>' + esc(f.inici) + '</th><td colspan="' + M.dies.length + '">Esbarjo</td></tr>'; return; }
      h += '<tr' + (f.esbarjo ? ' class="gs-he__esb"' : '') + '><th>' + esc(f.inici) + '<br><small>' + esc(f.fi) + '</small></th>' + M.dies.map(function (d) {
        // PAS 69: amb permís d'edició, cada sessió es pot arrossegar a una altra casella (micromoviment) i un doble clic obre
        // l'assistent d'espais; a les guàrdies, cada docent es pot arrossegar per separat
        return '<td data-pos="' + esc(d + '|' + f.id) + '">' + (G.per[d + ' ' + f.id] || []).map(function (s) { var c = colorHE(s), x = partsTextHE(p.tipus, s), k = clauMatHE(s);
          var cos = s.items ? '<b>' + esc(x.t) + '</b><small>' + s.items.map(function (g) { return '<span class="gs-he__g"' + (ed ? ' draggable="true" data-u="' + esc(g._u) + '"' : '') + '>' + esc(g.docents.map(nomCurtHE).join(', ')) + '</span>'; }).join(', ') + '</small>'
            : '<b>' + esc(x.t) + '</b>' + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '');
          return '<div class="gs-he__s' + (s.tipus === 'classe' && !s.aula ? ' gs-he__s--sensaula' : '') + (S.he.focus === k ? ' is-focus' : '') + '" data-m="' + esc(k) + '"' + (ed && !s.items ? ' draggable="true" data-u="' + esc(s._u) + '"' : '') + ' style="background:' + rgb(c, 0) + ';border-left-color:' + rgb(c, 3) + '" title="' + esc(x.t + (x.sub ? ' · ' + x.sub : '')) + '">' + cos + '</div>'; }).join('') + '</td>';
      }).join('') + '</tr>';
    });
    // Llegenda de matèries: color i hores de cada una (un clic la ressalta)
    var ll = Object.keys(G.hores).map(function (k) { var x = G.hores[k]; return { k: k, s: x.s, n: Object.keys(x.pos).length }; }).sort(function (a, b) { return partsTextHE(p.tipus, a.s).t.localeCompare(partsTextHE(p.tipus, b.s).t, 'ca') || grupHE(a.s).localeCompare(grupHE(b.s), 'ca'); });
    return h + '</tbody></table>' + (p.tipus !== 'guardies' ? '<div class="gs-he__llegenda">' + ll.map(function (x) { var c = colorHE(x.s);
      var g = x.s.tipus === 'classe' && p.tipus !== 'grup' ? grupHE(x.s) : (x.s.tipus === 'classe' && x.s.grup && x.s.grups_classe.length && x.s.grup !== x.s.grups_classe[0] ? x.s.grup : '');
      return '<button type="button" class="gs-he__xip' + (S.he.focus === x.k ? ' is-focus' : '') + '" data-he="focus" data-m="' + esc(x.k) + '" style="background:' + rgb(c, 0) + ';border-color:' + rgb(c, 3) + '">' + esc(partsTextHE(p.tipus, x.s).t) + (g ? ' · ' + esc(g) : '') + ' · ' + x.n + ' h</button>'; }).join('') + '</div>' : '') + '</section>';
  }
  // PDF: aula entre [ ]; si una casella té més de tres docents, s'hi posa un número i la llista va a la llegenda del peu
  function cosPdfHE(tipus, id) {
    var G = graellaHE(tipus, id), M = G.M, llegenda = [], perClau = {}, colors = {};
    var cos = M.franges.map(function (f, fi) { return [f.inici + '\n' + f.fi].concat(M.dies.map(function (d, di) {
      var ll = G.per[d + ' ' + f.id] || [], docs = []; ll.forEach(function (s) { s.docents.forEach(function (x) { if (docs.indexOf(x) < 0) docs.push(x); }); });
      // PAS 68: més de tres docents → a la casella només hi va el número; el contingut complet, a la llegenda (no a les guàrdies)
      var molts = tipus !== 'guardies' && docs.length > 3, text = ll.map(function (s) { var x = partsTextHE(tipus, s); return x.t + (x.sub ? '\n' + x.sub : ''); }).join('\n\n');
      if (ll.length) colors[fi + '-' + (di + 1)] = colorHE(ll[0]);
      if (!molts) return text;
      var k = ll.map(function (s) { var x = partsTextHE(tipus, s); return x.t + ' (' + x.sub + ')'; }).join(' + ');
      if (!perClau[k]) { llegenda.push(k); perClau[k] = llegenda.length; }
      return '(' + perClau[k] + ')';
    })); });
    return { cos: cos, llegenda: llegenda, colors: colors };
  }
  function pdfHE(llista) {   // llista: [{tipus, id}]
    var M = S.he.r.marc_horari, nomDe = function (t, id) { return (itemsHE(t).filter(function (x) { return x.id === id; })[0] || {}).nom || id; };
    var titol = { docent: 'Docent', grup: 'Grup-classe', espai: 'Espai', guardies: 'Guàrdies' };
    var crida = logoPdf().then(function (logo) {
      var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M2 = 12;
      var esb = {}; M.franges.forEach(function (f, j) { if (f.esbarjo) esb[j] = 1; });
      llista.forEach(function (q, k) {
        if (k) doc.addPage();
        var C = cosPdfHE(q.tipus, q.id);
        capPdf(doc, logo, 'Horari · ' + nomDe(q.tipus, q.id), titol[q.tipus] + ' · curs ' + ((S.he.r.meta || {}).curs || '') + ' · ' + new Date().toLocaleDateString('ca-ES'), M2, W);
        doc.autoTable({ theme: 'grid', head: [[''].concat(M.dies.map(function (d) { return d.charAt(0).toUpperCase() + d.slice(1); }))], body: C.cos, startY: Y_TAULA, margin: { left: M2, right: M2, bottom: 10 },
          styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 1.3, valign: 'middle', halign: 'center', lineColor: [205, 210, 225], lineWidth: 0.15, overflow: 'linebreak' },
          headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold', textColor: [90, 96, 120] } },
          didParseCell: function (c) { if (c.section !== 'body') return; if (esb[c.row.index]) { c.cell.styles.fillColor = [246, 247, 252]; c.cell.styles.minCellHeight = 5; return; }
            c.cell.styles.minCellHeight = 12; var col = C.colors[c.row.index + '-' + c.column.index]; if (col) c.cell.styles.fillColor = col.slice(0, 3); } });
        if (C.llegenda.length) { var y = doc.lastAutoTable.finalY + 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(60, 64, 80);
          C.llegenda.forEach(function (t, i) { doc.splitTextToSize('(' + (i + 1) + ') ' + t, W - 2 * M2).forEach(function (l) { if (y > H - 8) { doc.addPage(); y = 20; } doc.text(l, M2, y); y += 3.6; }); }); }
      });
      var u = llista.length === 1 ? String(nomDe(llista[0].tipus, llista[0].id)).toLowerCase().replace(/[^a-z0-9]+/g, '-') : llista[0].tipus === 'docent' ? 'professorat' : llista[0].tipus === 'grup' ? 'grups' : llista[0].tipus;
      doc.save('horari-' + u + '.pdf');
    });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  // PAS 85 · Mapa de tutories i reunions de nivell: una graella (franges × dies) amb, a cada casella, les reunions (de
  // nivell o fixes) i les hores de tutoria (matèria «Tutoria») amb el grup-classe i el tutor/a. Un sol full A4 apaïsat.
  function itemsTutoriesHE() {
    var R = S.he.r, M = R.marc_horari, cel = {}, vist = {}, nomD = function (id) { return S.he.curts[id] || S.he.noms[id] || id; };
    R.sessions.forEach(function (s) {
      var k = s.dia + '|' + s.franja, t = null;
      if (s.tipus === 'reunio') t = { o: 0, txt: s.materia || 'Reunió', reunio: true };
      else if (s.tipus === 'classe' && /^tutoria/i.test(String(s.materia || '').trim())) {
        var g = (s.grups_classe || []).join(', ') || [s.nivell, s.grup].filter(Boolean).join(' ');
        t = { o: 1, g: g, txt: g + (s.docents.length ? ' · ' + s.docents.map(nomD).join(', ') : '') };
      }
      if (!t || vist[k + '|' + t.txt]) return; vist[k + '|' + t.txt] = 1;
      (cel[k] = cel[k] || []).push(t);
    });
    Object.keys(cel).forEach(function (k) { cel[k].sort(function (a, b) { return a.o - b.o || String(a.g || a.txt).localeCompare(String(b.g || b.txt), 'ca', { numeric: true }); }); });
    return { cel: cel, n: Object.keys(cel).reduce(function (m, k) { return m + cel[k].length; }, 0), M: M };
  }
  function pdfTutoriesHE() {
    var T = itemsTutoriesHE(), M = T.M;
    if (!T.n) return toast('L’horari no té hores de tutoria (matèria «Tutoria») ni reunions.', true);
    var crida = logoPdf().then(function (logo) {
      var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth(), M2 = 10;
      capPdf(doc, logo, 'Mapa de tutories i reunions de nivell', 'Curs ' + ((S.he.r.meta || {}).curs || '') + ' · ' + new Date().toLocaleDateString('ca-ES'), M2, W);
      var body = M.franges.map(function (f) {
        return [{ content: f.inici + '–' + f.fi, styles: { fontStyle: 'bold', textColor: [90, 96, 120] } }].concat(M.dies.map(function (d) {
          if (f.esbarjo) return '';
          return (T.cel[d + '|' + f.id] || []).map(function (x) { return x.txt; }).join('\n');
        }));
      });
      doc.autoTable({ theme: 'grid', head: [['Hora'].concat(M.dies.map(function (d) { return d.charAt(0).toUpperCase() + d.slice(1); }))], body: body, startY: Y_TAULA, margin: { left: M2, right: M2, bottom: 10 },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, valign: 'middle', halign: 'center', lineColor: [205, 210, 225], lineWidth: 0.15, overflow: 'linebreak' },
        headStyles: { fillColor: [28, 12, 188], textColor: 255, fontStyle: 'bold' }, columnStyles: (function () { var o = { 0: { cellWidth: 22 } }, w = (W - 2 * M2 - 22) / M.dies.length; M.dies.forEach(function (d, i) { o[i + 1] = { cellWidth: w }; }); return o; })(),
        didParseCell: function (c) {
          if (c.section !== 'body') return; var f = M.franges[c.row.index];
          if (f.esbarjo) { c.cell.styles.fillColor = [246, 247, 252]; c.cell.styles.minCellHeight = 5; return; }
          c.cell.styles.minCellHeight = 17;
          var l = c.column.index ? T.cel[M.dies[c.column.index - 1] + '|' + f.id] || [] : [];
          if (l.some(function (x) { return x.reunio; })) c.cell.styles.fillColor = [255, 240, 228];
        } });
      var y = doc.lastAutoTable.finalY + 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90, 96, 120);
      doc.text('Tutories: hores de la matèria «Tutoria» de cada grup-classe, amb el tutor/a. Reunions: les reunions fixes (de nivell) de l’horari. En taronja, les caselles amb reunió.', M2, y);
      doc.save('mapa-tutories-reunions.pdf');
    });
    return window.Progres ? Progres.amb(crida, 'Generant el PDF…') : crida;
  }
  function importaHE(f) {
    var lector = new FileReader();
    lector.onload = function () {
      var h; try { h = JSON.parse(lector.result); } catch (e) { return toast('El fitxer no és un JSON vàlid.', true); }
      if (!h || h.format !== 'horari-resultat') return toast('Aquest fitxer no és un horari calculat pel motor (format «horari-resultat»).', true);
      var n = (h.sessions || []).length;
      pregunta('Importa l’horari', '<p>Horari calculat el <b>' + esc(dataHoraHE(h.generat)) + '</b> amb <b>' + n + '</b> hores.</p><p>Substitueix l’horari importat ara' + (S.he.r.meta ? ' (' + esc(dataHoraHE(S.he.r.meta.generat)) + ')' : '') + (S.he.r.meta && S.he.r.meta.canvis ? ', amb els ' + S.he.r.meta.canvis + ' canvis fets a l’editor' : '') + '.</p>' + (S.he.canvis ? '<p class="prog-avis">Hi ha ' + S.he.canvis + ' canvis sense desar: es perdran.</p>' : ''),
        [{ t: 'Importa', valor: 1 }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]).then(function (v) {
        if (v !== 1) return;
        api('horari_editor_importa', { horari: h }, 'Important l’horari…').then(function (r) {
          if (!r.ok) return toast(r.errors ? r.errors.slice(0, 3).join(' ') : text(r.error), true);
          S.he.r = r; S.he.noms = {}; S.he.curts = {}; r.docents.forEach(function (d) { S.he.noms[d.id] = d.nom; S.he.curts[d.id] = d.curt; }); S.he.canvis = 0; S.he.desfer = []; S.brut = false; preparaHE(); toast('Horari importat: ' + r.importades + ' hores.'); pintaEditorHoraris();
        });
      });
    };
    lector.readAsText(f);
  }
  // ------------------------------------------------------------------ PAS 69 · EDITOR: micromoviments i assistent d'espais
  // Cada hora pertany a una UNITAT (el que el motor col·loca junt: un bloc simultani, una sessió de 2 h, una guàrdia…); en
  // arrossegar una sessió (de qualsevol graella) es mou la unitat sencera. Si el moviment xoca (docent, grup-classe o aula
  // ocupats, franja prohibida…), l'assistent busca solucions movent altres unitats, amb un màxim de canvis.
  var edHE = function () { var R = S.he && S.he.r; return !!(R && R.meta && nivellIdx(R.nivell) >= 1 && R.obert); };
  var posHE = function (s) { return s.dia + '|' + s.franja; };
  function clauUnitatHE(s) { return s.unitat || [s.tipus, s.id_assignacio || s.docents.join(','), s.dia, s.franja].join('|'); }
  function preparaHE() {
    var R = S.he.r, U = {}, M = R.marc_horari;
    S.he.fi = {}; M.franges.forEach(function (f, i) { S.he.fi[f.id] = i; });
    R.sessions.forEach(function (s) { s._u = clauUnitatHE(s); });
    // PAS 72 · Un bloc es mou sencer: les classes que es fan a la mateixa hora i comparteixen grup-classe (un bloc simultani:
    // optatives, desdoblaments, hores B…) són una sola unitat, encara que l'horari no ho digui (importat abans del PAS 69 o
    // amb unitats separades). Unió de conjunts per franja.
    var pare = {}, arrel = function (k) { while (pare[k] && pare[k] !== k) k = pare[k] = pare[pare[k]] || pare[k]; return k; };
    // PAS 76 · Itineraris: els grups d'alumnat de cada sessió (recursos); les classes de dos itineraris del mateix grup-classe
    // poden anar alhora i no són la mateixa unitat
    S.he.itin = {}; R.sessions.forEach(function (s) { (s.recursos || []).forEach(function (r) { var g = r.split('#')[0]; (S.he.itin[g] = S.he.itin[g] || {})[r] = 1; }); });
    R.sessions.forEach(function (s) { s._rec = recursosHE(s); });
    var perPos = {}; R.sessions.forEach(function (s) { pare[s._u] = pare[s._u] || s._u; if (s.tipus === 'classe' && (s.grups_classe || []).length) (perPos[s.dia + '|' + s.franja] = perPos[s.dia + '|' + s.franja] || []).push(s); });
    Object.keys(perPos).forEach(function (k) { var l = perPos[k], g = {}; l.forEach(function (s) { s._rec.forEach(function (c) { if (g[c]) { var a = arrel(g[c]), b = arrel(s._u); if (a !== b) pare[b] = a; } else g[c] = s._u; }); }); });
    // les franges d'una mateixa unitat del motor (sessió de 2 h) segueixen juntes: si una es fusiona, la resta també
    R.sessions.forEach(function (s) { s._u = arrel(s._u); (U[s._u] = U[s._u] || { k: s._u, ses: [], tipus: s.tipus }).ses.push(s); });
    S.he.pref = {}; R.sessions.forEach(function (s) { if (s.unitat) { var pf = s.unitat.split('@')[0]; (S.he.pref[pf] = S.he.pref[pf] || []).push(s); } });
    S.he.U = U; S.he.proh = {}; S.he.mitja = {}; S.he.red = {}; S.he.fixD = {}; (R.docents || []).forEach(function (d) { S.he.proh[d.id] = d.prohibides || []; if ((d.fixes || []).length) S.he.fixD[d.id] = d.fixes; if (/^(1\/2|½|mitja)/i.test(String(d.jornada || ''))) S.he.mitja[d.id] = 1; if (/^(1\/2|½|mitja|2\/3|⅔)/i.test(String(d.jornada || ''))) (S.he.red = S.he.red || {})[d.id] = 1; });
    // PAS 75 · Regles obligatòries del motor que l'editor també comprova: posicions fixes/prohibides de cada unitat del motor
    // (i si les seves sessions van en dies diferents) i el nombre de guàrdies de cada tipus a cada franja (no pot baixar)
    S.he.posU = {}; ((R.meta || {}).posicions || []).forEach(function (x) { S.he.posU[x[0]] = { fixes: x[1] || [], proh: x[2] || [], dd: x[3] !== 0 }; });
    S.he.gbase = {}; R.sessions.forEach(function (s) { if (GUARDIES_HE[s.tipus]) { var k = s.dia + '|' + s.franja + '|' + s.tipus; S.he.gbase[k] = (S.he.gbase[k] || 0) + 1; } });
    S.he.canvis = S.he.canvis || 0; S.he.desfer = S.he.desfer || [];
  }
  // Franges (ordenades) que ocupa una unitat i les que ocuparia començant a «franja»
  function franjesUnitatHE(u) { var fs = []; u.ses.forEach(function (s) { if (fs.indexOf(s.franja) < 0) fs.push(s.franja); }); return fs.sort(function (a, b) { return S.he.fi[a] - S.he.fi[b]; }); }
  // PAS 76: recursos (grups d'alumnat) d'una sessió: els itineraris que ocupa o, si no en diu, tots els del seu grup-classe
  function recursosHE(s) {
    if ((s.recursos || []).length) return s.recursos;
    var o = []; (s.grups_classe || []).forEach(function (g) { var it = (S.he.itin || {})[g]; if (it) Object.keys(it).forEach(function (r) { o.push(r); }); else o.push(g); }); return o;
  }
  var nomRecHE = function (r) { return String(r).replace('#', ' · '); };
  var esEsbarjoHE = function (t) { return t === 'guardia_b' || t === 'guardia_p'; };
  var GUARDIES_HE = { guardia: 1, guardia_p: 1, guardia_b: 1 };
  var prefHE = function (s) { return s.unitat ? s.unitat.split('@')[0] : ''; };
  // PAS 75 · Guàrdies que falten: franges on, amb els moviments «mv», hi ha menys guàrdies d'un tipus que a l'horari importat
  function deficitsHE(mv, occ) {
    var o = [], vist = {};
    Object.keys(mv).forEach(function (k) { var u = S.he.U[k]; if (!u || !GUARDIES_HE[u.tipus]) return;
      u.ses.forEach(function (s) { var kk = s.dia + '|' + s.franja + '|' + s.tipus; if (vist[kk]) return; vist[kk] = 1;
        var n = (occ[s.dia + '|' + s.franja] || []).filter(function (x) { return x.tipus === s.tipus; }).length;
        if (n < (S.he.gbase[kk] || 0)) o.push({ dia: s.dia, franja: s.franja, tipus: s.tipus }); }); });
    return o;
  }
  function destiHE(u, dia, franja) {
    var M = S.he.r.marc_horari, fs = franjesUnitatHE(u), i0 = S.he.fi[franja], o = {};
    if (i0 === undefined) return null;
    for (var j = 0; j < fs.length; j++) { var f = M.franges[i0 + j]; if (!f || !!f.esbarjo !== esEsbarjoHE(u.tipus)) return null; o[fs[j]] = f.id; }
    return { dia: dia, map: o };   // franja d'origen → franja de destinació
  }
  // Posicions virtuals: {clau d'unitat: {dia, map}} → on és cada sessió
  function onEsHE(s, mv) { var m = mv[s._u]; return m ? { dia: m.dia, franja: m.map[s.franja] } : { dia: s.dia, franja: s.franja }; }
  function ocupacioHE(mv) {
    var o = {}; S.he.r.sessions.forEach(function (s) { var p = onEsHE(s, mv), k = p.dia + '|' + p.franja; (o[k] = o[k] || []).push(s); }); return o;
  }
  // Conflictes d'una unitat a la seva posició (virtual): {unitats: {clau: [motius]}, durs: [motius sense solució], avisos: []}
  function conflictesHE(u, mv, occ) {
    var r = { unitats: {}, durs: [], aules: [], avisos: [] }, nomU = function (k) { return descUnitatHE(S.he.U[k]); }, durU = function (t) { if (r.durs.indexOf(t) < 0) r.durs.push(t); };
    u.ses.forEach(function (s) {
      var p = onEsHE(s, mv), k = p.dia + '|' + p.franja;
      s.docents.forEach(function (d) { if ((S.he.proh[d] || []).indexOf(p.dia + ' ' + p.franja) >= 0) r.durs.push(nomCurtHE(d) + ' té prohibida ' + p.dia + ' ' + p.franja + '.'); });
      (occ[k] || []).forEach(function (x) {
        if (x._u === u.k) return;
        var mot = [];
        s.docents.forEach(function (d) { if (x.docents.indexOf(d) >= 0) mot.push(nomCurtHE(d) + ' ja hi té ' + (x.tipus === 'classe' ? x.materia : NOM_TIPUS_HE[x.tipus] || x.tipus)); });
        if (s.tipus === 'classe' && x.tipus === 'classe') s._rec.forEach(function (g) { if (x._rec.indexOf(g) >= 0) mot.push(nomRecHE(g) + ' ja hi fa ' + x.materia); });
        if (s.aula && x.aula === s.aula && !mot.length) { r.aules.push({ u: x._u, aula: s.aula, s: s }); return; }
        if (mot.length) { var l = r.unitats[x._u] = r.unitats[x._u] || []; mot.forEach(function (m) { if (l.indexOf(m) < 0) l.push(m); }); }
      });
    });
    // Regles del motor «mateix dia» i «en dies diferents» (de l'horari importat): avisos
    // PAS 75: una unitat de l'editor pot reunir sessions de diverses unitats del motor (bloc): es comproven totes
    var diaU = (mv[u.k] || { dia: u.ses[0].dia }).dia, P = S.he.pref || {}, pfs = u.ses.map(prefHE).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    pfs.forEach(function (pf) { (((S.he.r.meta || {}).relacions) || []).forEach(function (rel) {
      var gi = -1; rel.unitats.forEach(function (g, i) { if (g.indexOf(pf) >= 0) gi = i; }); if (gi < 0) return;
      var diesDe = function (g) { var o = {}; g.forEach(function (x) { (P[x] || []).forEach(function (y) { if (y._u !== u.k) o[onEsHE(y, mv).dia] = 1; }); }); return o; };
      // PAS 75: són regles obligatòries del motor → impedeixen la solució (abans només eren avisos)
      if (rel.tipus === 'mateix_dia') { var ds = {}; rel.unitats.forEach(function (g, i) { if (i !== gi) Object.assign(ds, diesDe(g)); }); if (Object.keys(ds).length && !ds[diaU]) durU('Trenca «Mateix dia» (' + rel.nom + '): els altres blocs són el ' + Object.keys(ds).join(', ') + '.'); }
      else rel.unitats.forEach(function (g, i) { if (i !== gi && diesDe(g)[diaU]) durU('Trenca «En dies diferents» (' + rel.nom + ').'); });
    }); });
    // PAS 72/75 · Obligatòria del motor: mitja jornada → dilluns o divendres lliure
    var docsU = {}; u.ses.forEach(function (s) { s.docents.forEach(function (d) { docsU[d] = 1; }); });
    Object.keys(docsU).forEach(function (d) { if (!S.he.mitja || !S.he.mitja[d]) return;
      var dies = {}, abans = {}; S.he.r.sessions.forEach(function (x) { if (x.docents.indexOf(d) >= 0) { dies[onEsHE(x, mv).dia] = 1; abans[x.dia] = 1; } });
      if (dies.dilluns && dies.divendres && !(abans.dilluns && abans.divendres)) durU(nomCurtHE(d) + ' (mitja jornada) es queda sense el dilluns ni el divendres lliure.'); });
    // PAS 76 · Obligatòria del motor: classe amb alumnat cada dia (mitja jornada o 2/3: fins a dos dies del tot lliures). Només
    // si el moviment ho empitjora (un horari antic que ja no ho complia es pot continuar retocant)
    var diesHE = S.he.r.marc_horari.dies, faltaDia = function (d, m) {
      var cls = {}, res = {}; S.he.r.sessions.forEach(function (x) { if (x.docents.indexOf(d) < 0) return; var q = m ? onEsHE(x, m).dia : x.dia; res[q] = 1; if (x.tipus === 'classe') cls[q] = 1; });
      var red = S.he.red && S.he.red[d], n = 0, lliures = 0; diesHE.forEach(function (dia) { if (!res[dia]) lliures++; if (!cls[dia] && (!red || res[dia])) n++; });
      return red ? n + Math.max(0, lliures - 2) : n;
    };
    Object.keys(docsU).forEach(function (d) { if (faltaDia(d, mv) > faltaDia(d, null)) durU(nomCurtHE(d) + (S.he.red && S.he.red[d] ? ' (jornada reduïda)' : '') + ' es queda un dia sense classe amb alumnat' + (S.he.red && S.he.red[d] ? ' (només pot tenir fins a dos dies del tot lliures)' : '') + '.'); });
    // PAS 75 · Posicions fixes i prohibides de la unitat del motor (sessió) i fixes del docent
    pfs.forEach(function (pf) { if (!S.he.posU[pf]) return; var PU = S.he.posU[pf], on = {};
      (P[pf] || []).forEach(function (y) { var q = onEsHE(y, mv); on[q.dia + ' ' + q.franja] = 1; if (PU.proh.indexOf(q.dia + ' ' + q.franja) >= 0) durU(descUnitatHE(u) + ': ' + q.dia + ' ' + q.franja + ' és una posició prohibida.'); });
      PU.fixes.forEach(function (fx) { if (!on[fx]) durU(descUnitatHE(u) + ': ha de fer-se a la posició fixa ' + fx + '.'); }); });
    Object.keys(docsU).forEach(function (d) { (S.he.fixD[d] || []).forEach(function (fx) {
      var hi = S.he.r.sessions.some(function (x) { if (x.tipus !== 'classe' || x.docents.indexOf(d) < 0) return false; var q = onEsHE(x, mv); return q.dia + ' ' + q.franja === fx; });
      if (!hi) durU(nomCurtHE(d) + ' ha de fer classe a ' + fx + ' (posició fixa).'); }); });
    // PAS 75 · Distribució (obligatòria): les sessions d'una mateixa unitat del motor van en dies diferents (excepte l'atenció
    // individual i el que el motor no reparteix)
    if (u.tipus === 'classe') pfs.forEach(function (pf) { if (S.he.posU[pf] && !S.he.posU[pf].dd) return;
      var ses = P[pf] || []; if (!ses.length || /atenci[oó] individual/i.test(ses[0].materia || '')) return;
      if (ses.some(function (y) { return y._u !== u.k && onEsHE(y, mv).dia === diaU; })) durU(descUnitatHE(u) + ': ja té una altra sessió el ' + diaU + ' (la distribució demana dies diferents).'); });
    // Avís (horaris importats abans del PAS 75): la mateixa matèria i grup ja té classe aquell dia
    // PAS 73: l'atenció individual pot tenir diverses sessions el mateix dia
    if (!((S.he.r.meta || {}).posicions) && u.tipus === 'classe' && !/atenci[oó] individual/i.test(u.ses[0].materia || '')) { var dia = (mv[u.k] || { dia: u.ses[0].dia }).dia, ids = {}; u.ses.forEach(function (s) { if (s.id_assignacio) ids[s.id_assignacio] = s; });
      S.he.r.sessions.forEach(function (x) { if (x._u !== u.k && ids[x.id_assignacio] && onEsHE(x, mv).dia === dia) { var t = ids[x.id_assignacio].materia + ' ' + grupHE(ids[x.id_assignacio]) + ' ja té classe el ' + dia + '.'; if (r.avisos.indexOf(t) < 0) r.avisos.push(t); } }); }
    return r;
  }
  function descUnitatHE(u) {
    if (!u) return '';
    var s = u.ses[0], fs = franjesUnitatHE(u), on = s.dia + ' ' + fs[0] + (fs.length > 1 ? '–' + fs[fs.length - 1] : '');
    if (u.tipus !== 'classe') return (NOM_TIPUS_HE[u.tipus] || u.tipus) + ' · ' + s.docents.map(nomCurtHE).join(', ') + ' (' + on + ')';
    var m = []; u.ses.forEach(function (x) { var t = x.materia + ' ' + grupHE(x); if (m.indexOf(t) < 0) m.push(t); });
    return (m.length > 2 ? m.slice(0, 2).join(' · ') + ' +' + (m.length - 2) : m.join(' · ')) + ' (' + on + ')';
  }
  // Totes les posicions on pot anar una unitat (dia, franja d'inici)
  function posicionsHE(u) { var M = S.he.r.marc_horari, o = []; M.dies.forEach(function (d) { M.franges.forEach(function (f) { var x = destiHE(u, d, f.id); if (x) o.push(x); }); }); return o; }
  var mateixaPosHE = function (u, x) { return u.ses[0].dia === x.dia && franjesUnitatHE(u).every(function (f) { return x.map[f] === f; }); };
  // Aula lliure (preferent, alternatives o del mateix tipus) per a les sessions d'una unitat amb l'aula ocupada
  function aulaLliureHE(s, poss, occ) {
    var A = aulesHE(), tipus = (A.filter(function (a) { return a.id === s.aula; })[0] || {}).tipus;
    var cands = [s.aula_preferent].concat(s.aules_alternatives || []).concat(A.filter(function (a) { return !tipus || a.tipus === tipus; }).map(function (a) { return a.id; }));
    return cands.filter(function (a, i) { return a && cands.indexOf(a) === i && a !== s.aula; }).filter(function (a) { return poss.every(function (k) { return !(occ[k] || []).some(function (x) { return x.aula === a && x._u !== s._u; }); }); })[0] || '';
  }
  // Cerca de solucions: el moviment principal + com a molt «max - 1» moviments d'altres unitats (i canvis d'aula si cal)
  // PAS 71 · Cerca en amplada creixent (aprofundiment iteratiu): primer totes les solucions d'1 moviment, després les de
  // 2… fins al màxim. Abans era en profunditat i, amb un màxim alt, gastava el pressupost en camins llargs i no trobava
  // solucions amb menys moviments.
  // Cost ràpid de posar la unitat u a x (amb l'ocupació virtual occ): -1 si és impossible (franja prohibida d'un docent o xoc
  // amb una unitat que ja s'ha mogut), si no, quantes unitats més caldria moure
  function costHE(u, x, occ, ordre) {
    var mou = {}, n = 0;
    for (var i = 0; i < u.ses.length; i++) { var s = u.ses[i], f = x.map[s.franja], k = x.dia + '|' + f;
      for (var j = 0; j < s.docents.length; j++) if ((S.he.proh[s.docents[j]] || []).indexOf(x.dia + ' ' + f) >= 0) return -1;
      var l = occ[k] || [];
      for (var m = 0; m < l.length; m++) { var y = l[m]; if (y._u === u.k || mou[y._u]) continue;
        var xoc = s.docents.some(function (d) { return y.docents.indexOf(d) >= 0; }) || (s.tipus === 'classe' && y.tipus === 'classe' && s._rec.some(function (g) { return y._rec.indexOf(g) >= 0; }));
        if (!xoc) continue; if (ordre.indexOf(y._u) >= 0) return -1; mou[y._u] = 1; n++; } }
    return n;
  }
  function cercaHE(k0, desti, maxTot) {
    var sols = [], trobades = {}, vist, nodes, LIM = 20000, max, t0 = Date.now();
    var origen = S.he.U[k0];
    var sigMv = function (mv) { return Object.keys(mv).sort().map(function (k) { return k + '>' + mv[k].dia + JSON.stringify(mv[k].map); }).join(';'); };
    function prova(mv, ordre) {
      if (++nodes > LIM || Date.now() - t0 > 8000) return;
      var sig = sigMv(mv); if (vist[sig]) return; vist[sig] = 1;
      var occ = ocupacioHE(mv), pendents = [], aules = [], avisos = [];
      for (var i = 0; i < ordre.length; i++) { var c = conflictesHE(S.he.U[ordre[i]], mv, occ); if (c.durs.length) return;
        Object.keys(c.unitats).forEach(function (k) { if (pendents.indexOf(k) < 0) pendents.push(k); }); c.aules.forEach(function (a) { aules.push(a); }); avisos = avisos.concat(c.avisos); }
      if (!pendents.length) {
        // PAS 75 · Guàrdies: cap franja es pot quedar amb menys guàrdies d'un tipus que a l'horari importat. Si en falten, es
        // prova de portar-hi una guàrdia del mateix tipus d'una franja on ara en sobren (un intercanvi de guàrdies)
        var def = deficitsHE(mv, occ);
        if (def.length) {
          if (ordre.length >= max) return;
          var d0 = def[0], gc = [];
          Object.keys(occ).forEach(function (pk) { var l = (occ[pk] || []).filter(function (y) { return y.tipus === d0.tipus; });
            if (l.length > (S.he.gbase[pk + '|' + d0.tipus] || 0)) l.forEach(function (y) { if (ordre.indexOf(y._u) < 0 && gc.indexOf(y._u) < 0) gc.push(y._u); }); });
          gc.forEach(function (k2) { var x2 = destiHE(S.he.U[k2], d0.dia, d0.franja); if (!x2) return; var m2 = Object.assign({}, mv); m2[k2] = x2; prova(m2, ordre.concat([k2])); });
          return;
        }
        // Aules ocupades: es busca una aula lliure per a la sessió moguda
        var canvisAula = [], ok = true;
        aules.forEach(function (a) { var u = S.he.U[a.s._u], poss = u.ses.filter(function (x) { return x.aula === a.aula; }).map(function (x) { var p = onEsHE(x, mv); return p.dia + '|' + p.franja; });
          var nova = aulaLliureHE(a.s, poss, occ);
          if (nova) { if (!canvisAula.some(function (c) { return c.u === a.s._u && c.de === a.aula; })) canvisAula.push({ u: a.s._u, de: a.aula, a: nova }); return; }
          // PAS 73: si la sessió moguda no troba cap aula lliure, es canvia l'aula de la que hi és (també és un moviment)
          if (canvisAula.some(function (c) { return c.u === a.u && c.de === a.aula; })) return;
          var x = S.he.U[a.u], sx = x && x.ses.filter(function (y) { return y.aula === a.aula; })[0];
          var possX = x ? x.ses.filter(function (y) { return y.aula === a.aula; }).map(function (y) { var p = onEsHE(y, mv); return p.dia + '|' + p.franja; }) : [];
          var novaX = sx && ordre.indexOf(a.u) < 0 ? aulaLliureHE(sx, possX, occ) : '';
          if (novaX) canvisAula.push({ u: a.u, de: a.aula, a: novaX }); else ok = false; });
        if (ok && ordre.length + canvisAula.length <= max && !trobades[sig]) { trobades[sig] = 1; sols.push({ mv: mv, ordre: ordre, aules: canvisAula, avisos: avisos.filter(function (x, i) { return avisos.indexOf(x) === i; }) }); }
        return;
      }
      if (ordre.length >= max) return;
      var k = pendents.filter(function (x) { return ordre.indexOf(x) < 0; })[0]; if (!k) return;   // xoca amb una unitat que ja s'ha mogut
      // PAS 72 · Primer les posicions més prometedores (de qualsevol grup-classe): es descarten les impossibles (franja
      // prohibida, xoc amb una unitat que ja s'ha mogut) i s'ordenen pel nombre d'unitats que caldria moure després; així la
      // cerca arriba a moviments derivats d'altres grups-classe i docents dins del pressupost
      var u = S.he.U[k], o0 = origen.ses[0].dia, cands = posicionsHE(u).filter(function (x) { return !mateixaPosHE(u, x); })
        .map(function (x) { return { x: x, n: costHE(u, x, occ, ordre) }; }).filter(function (c) { return c.n >= 0 && c.n <= max - ordre.length; })
        .sort(function (a, b) { return a.n - b.n || (b.x.dia === o0 ? 1 : 0) - (a.x.dia === o0 ? 1 : 0); });
      cands.forEach(function (c) { var m2 = Object.assign({}, mv); m2[k] = c.x; prova(m2, ordre.concat([k])); });
    }
    var mv0 = {}; mv0[k0] = desti;
    for (max = 1; max <= maxTot && sols.length < 8; max++) { vist = {}; nodes = 0; prova(mv0, [k0]); }
    return sols.sort(function (a, b) { return (a.ordre.length + a.aules.length) - (b.ordre.length + b.aules.length) || a.avisos.length - b.avisos.length; }).slice(0, 8);
  }
  // PAS 75: també els docents que es mouen
  function textMovHE(k, x) { var u = S.he.U[k], fs = franjesUnitatHE(u), nf = fs.map(function (f) { return x.map[f]; }), ds = [];
    u.ses.forEach(function (s) { s.docents.forEach(function (d) { if (ds.indexOf(d) < 0) ds.push(d); }); });
    return '<b>' + esc(descUnitatHE(u)) + '</b> → ' + esc(x.dia + ' ' + nf[0] + (nf.length > 1 ? '–' + nf[nf.length - 1] : '')) + (ds.length ? ' <small class="gs-he__docs">' + esc(ds.map(nomCurtHE).join(', ')) + '</small>' : ''); }
  function aplicaHE(sol, etiqueta) {
    var abans = [];
    sol.ordre.forEach(function (k) { var x = sol.mv[k]; S.he.U[k].ses.forEach(function (s) { abans.push({ s: s, dia: s.dia, franja: s.franja, aula: s.aula }); s.franja = x.map[s.franja]; s.dia = x.dia; }); });
    (sol.aules || []).forEach(function (c) { S.he.U[c.u].ses.forEach(function (s) { if (s.aula === c.de) { if (!abans.some(function (b) { return b.s === s; })) abans.push({ s: s, dia: s.dia, franja: s.franja, aula: s.aula }); s.aula = c.a; s.aula_on = 'editor'; } }); });
    S.he.desfer.push({ t: etiqueta, abans: abans }); S.he.canvis += sol.ordre.length + (sol.aules || []).length; S.brut = true;
    preparaHE(); pintaEditorHoraris();
  }
  function desfesHE() { var x = S.he.desfer.pop(); if (!x) return; x.abans.forEach(function (b) { b.s.dia = b.dia; b.s.franja = b.franja; b.s.aula = b.aula; }); S.he.canvis = Math.max(0, S.he.canvis - 1); S.brut = S.he.desfer.length > 0; preparaHE(); pintaEditorHoraris(); toast('Desfet: ' + x.t + '.'); }
  function mouHE(k, dia, franja) {
    var u = S.he.U[k]; if (!u) return;
    var x = destiHE(u, dia, franja);
    if (!x) return toast(esEsbarjoHE(u.tipus) ? 'Les guàrdies de pati i de biblioteca només poden anar a l’esbarjo.' : 'No hi cap: ' + (franjesUnitatHE(u).length > 1 ? 'la sessió és de ' + franjesUnitatHE(u).length + ' hores seguides (sense esbarjo entremig).' : 'aquesta franja no és lectiva.'), true);
    if (mateixaPosHE(u, x)) return;
    var mv = {}; mv[k] = x; var oc = ocupacioHE(mv), c = conflictesHE(u, mv, oc), etiqueta = descUnitatHE(u) + ' → ' + dia + ' ' + franja;
    c.guardies = deficitsHE(mv, oc).map(function (d) { return d.dia + ' ' + d.franja + ' es quedaria amb menys ' + (NOM_TIPUS_HE[d.tipus] || d.tipus).toLowerCase() + ' de les necessàries.'; });
    if (!c.durs.length && !Object.keys(c.unitats).length && !c.aules.length && !c.avisos.length && !c.guardies.length) return aplicaHE({ mv: mv, ordre: [k], aules: [] }, etiqueta);
    assistentHE(k, x, c, etiqueta);
  }
  // PAS 70 · L'assistent: a l'esquerra, els conflictes i les solucions (cada pas és clicable); a la dreta, una graella (grup-
  // classe o docent) amb la solució aplicada: el pas triat surt ressaltat on arriba i, ratllat, d'on surt.
  function assistentHE(k, x, c, etiqueta) {
    var max = S.he.max || 8, sols = [], P = { sol: -1, pas: -1, tipus: '', id: '' };
    var u0 = S.he.U[k], cls0 = u0.ses[0].grups_classe || [];
    P.tipus = u0.tipus === 'classe' && cls0.length ? 'grup' : 'docent'; P.id = P.tipus === 'grup' ? cls0[0] : u0.ses[0].docents[0];
    var mvSol = function () { if (P.sol >= 0 && sols[P.sol]) return sols[P.sol].mv; var m = {}; m[k] = x; return m; };
    var pasK = function () { if (P.sol >= 0 && sols[P.sol]) return sols[P.sol].ordre[Math.max(0, P.pas)] || k; return k; };
    var pintaPrev = function () {
      var it = itemsHE(P.tipus), sel = '<select id="gsHePrevT" aria-label="Tipus"><option value="grup"' + (P.tipus === 'grup' ? ' selected' : '') + '>Grup-classe</option><option value="docent"' + (P.tipus === 'docent' ? ' selected' : '') + '>Docent</option></select>' +
        '<select id="gsHePrevS" aria-label="Element">' + it.map(function (e) { return '<option value="' + esc(e.id) + '"' + (e.id === P.id ? ' selected' : '') + '>' + esc(e.nom) + '</option>'; }).join('') + '</select>';
      $('gsHePrev').innerHTML = '<div class="gs-he__prevcap">' + sel + '</div>' + miniGraellaHE(P.tipus, P.id, mvSol(), pasK()) +
        '<p class="gs-gris gs-he__prevll"><span class="gs-he__m gs-he__m--pas">arriba</span> <span class="gs-he__m gs-he__m--orig">surt</span> <span class="gs-he__m gs-he__m--mou">altres sessions mogudes</span></p>';
    };
    var pinta = function () {
      sols = c.durs.length ? [] : cercaHE(k, x, max);
      if (P.sol >= sols.length) P.sol = -1;
      $('gsHeSol').innerHTML = (c.durs.length ? '<p class="prog-avis prog-avis--error">' + c.durs.map(esc).join('<br>') + '</p>' : '') +
        (sols.length ? '<p><b>Solucions</b> (com a màxim ' + max + ' moviments; les primeres en fan menys). Un clic a un pas el mostra a la graella.</p><ol class="gs-he__sols">' + sols.map(function (s, i) {
          return '<li><label><input type="radio" name="gsHeSol" value="' + i + '"' + (i === Math.max(0, P.sol) ? ' checked' : '') + '> Solució ' + (i + 1) + ' · ' + (s.ordre.length + s.aules.length) + (s.ordre.length + s.aules.length === 1 ? ' moviment' : ' moviments') + '</label>' +
            s.ordre.map(function (kk, j) { return '<button type="button" class="gs-he__pas' + (P.sol === i && P.pas === j ? ' is-actiu' : '') + '" data-pas="' + i + '-' + j + '">' + (j + 1) + '. ' + textMovHE(kk, s.mv[kk]) + '</button>'; }).join('') +
            s.aules.map(function (a) { return '<span class="gs-he__pas">Aula de <b>' + esc(descUnitatHE(S.he.U[a.u])) + '</b>: ' + esc(a.de) + ' → <b>' + esc(a.a) + '</b></span>'; }).join('') +
            (s.avisos.length ? '<small class="gs-gris">⚠ ' + s.avisos.map(esc).join(' ') + '</small>' : '') + '</li>'; }).join('') + '</ol>'
          : (c.durs.length ? '' : '<p class="prog-avis">Cap solució amb ' + max + ' moviments com a màxim. Proveu-ho amb més moviments o en una altra franja.</p>'));
      if (sols.length && P.sol < 0) P.sol = 0;
      pintaPrev();
    };
    var conf = Object.keys(c.unitats).map(function (kk) { return '<li>' + esc(descUnitatHE(S.he.U[kk])) + ': ' + esc(c.unitats[kk].join('; ')) + '</li>'; })
      .concat(c.aules.map(function (a) { return '<li>Aula ' + esc(a.aula) + ' ocupada per ' + esc(descUnitatHE(S.he.U[a.u])) + '</li>'; }))
      .concat((c.guardies || []).map(function (a) { return '<li>' + esc(a) + '</li>'; }))
      .concat(c.avisos.map(function (a) { return '<li>' + esc(a) + ' <small class="gs-gris">(avís)</small></li>'; }));
    var obre = pregunta('Moure una sessió', '<div class="gs-he__ass"><div class="gs-he__assE"><p>' + textMovHE(k, x) + '</p>' + (conf.length ? '<p><b>Conflictes</b></p><ul>' + conf.join('') + '</ul>' : '') +
      '<p><label>Màxim de moviments <select id="gsHeMax">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<option' + (n === max ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></p><div id="gsHeSol"></div></div>' +
      '<div class="gs-he__assD" id="gsHePrev"></div></div>',
      [{ t: 'Aplica la solució', valor: 'sol', abans: function () { if (!sols.length) { toast('No hi ha cap solució triada.', true); return false; } } },
        { t: 'Mou igualment', valor: 'forca', tipus: 'ghost' }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }], false);
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample', 'gs-modal--assist');
    var canvi = function (e) { var t = e.target;
      if (t.id === 'gsHeMax') { max = S.he.max = Number(t.value); P.sol = -1; P.pas = -1; pinta(); }
      else if (t.name === 'gsHeSol') { P.sol = Number(t.value); P.pas = -1; pinta(); }
      else if (t.id === 'gsHePrevT') { P.tipus = t.value; P.id = (itemsHE(P.tipus)[0] || {}).id || ''; pintaPrev(); }
      else if (t.id === 'gsHePrevS') { P.id = t.value; pintaPrev(); } };
    var clic = function (e) { var b = e.target.closest && e.target.closest('[data-pas]'); if (!b) return;
      var q = b.dataset.pas.split('-'); P.sol = Number(q[0]); P.pas = Number(q[1]);
      // la graella passa al grup-classe (o docent) del pas, si el que es veu ara no hi surt
      var uu = S.he.U[sols[P.sol].ordre[P.pas]], hiEs = uu.ses.some(function (s) { return P.tipus === 'grup' ? (s.grups_classe || []).indexOf(P.id) >= 0 : s.docents.indexOf(P.id) >= 0; });
      if (!hiEs) { var g = uu.tipus === 'classe' ? (uu.ses[0].grups_classe || [])[0] : ''; if (g) { P.tipus = 'grup'; P.id = g; } else { P.tipus = 'docent'; P.id = uu.ses[0].docents[0]; } }
      pinta(); };
    $('gsModal').addEventListener('change', canvi); $('gsModal').addEventListener('click', clic);
    pinta();
    obre.then(function (v) {
      $('gsModal').removeEventListener('change', canvi); $('gsModal').removeEventListener('click', clic);
      $('gsModalText').closest('.prog-modal__box').classList.remove('gs-modal--assist');
      if (v === 'sol') { var r = document.querySelector('input[name="gsHeSol"]:checked'), i = r ? Number(r.value) : Math.max(0, P.sol); aplicaHE(sols[i], etiqueta); toast('Moviment fet' + (sols[i].ordre.length > 1 ? ' (' + sols[i].ordre.length + ' sessions mogudes)' : '') + '. Recordeu desar els canvis.'); }
      else if (v === 'forca') { var mv = {}; mv[k] = x; aplicaHE({ mv: mv, ordre: [k], aules: [] }, etiqueta); toast('Mogut amb conflictes: reviseu-los.', true); }
    });
  }
  // Graella petita d'un grup-classe o d'un docent amb els moviments «mv» aplicats; «kPas» = la unitat del pas triat
  function miniGraellaHE(tipus, id, mv, kPas) {
    var M = S.he.r.marc_horari, hi = function (s) { return tipus === 'grup' ? s.tipus === 'classe' && (s.grups_classe || []).indexOf(id) >= 0 : s.docents.indexOf(id) >= 0; };
    var per = {}, orig = {};
    S.he.r.sessions.forEach(function (s) { if (!hi(s)) return; var p = onEsHE(s, mv), q = p.dia + '|' + p.franja; (per[q] = per[q] || []).push(s);
      if (s._u === kPas && mv[kPas]) (orig[s.dia + '|' + s.franja] = orig[s.dia + '|' + s.franja] || []).push(s); });
    var curt = function (s) { var t = s.tipus === 'classe' ? s.materia : NOM_TIPUS_HE[s.tipus] || s.tipus; return t.length > 16 ? t.slice(0, 15) + '…' : t; };
    return '<table class="gs-he__mini"><thead><tr><th></th>' + M.dies.map(function (d) { return '<th>' + esc({ dilluns: 'Dl', dimarts: 'Dt', dimecres: 'Dc', dijous: 'Dj', divendres: 'Dv' }[d] || d.slice(0, 3)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      M.franges.map(function (f) { return '<tr' + (f.esbarjo ? ' class="gs-he__esb"' : '') + '><th>' + esc(f.inici) + '</th>' + M.dies.map(function (d) { var q = d + '|' + f.id, ll = per[q] || [], o = orig[q] || [];
        var u = {}; ll = ll.filter(function (s) { if (u[s._u]) return false; u[s._u] = 1; return true; });
        return '<td>' + ll.map(function (s) { var c = colorHE(s); return '<div class="gs-he__m' + (s._u === kPas ? ' gs-he__m--pas' : mv[s._u] ? ' gs-he__m--mou' : '') + '" style="background:' + rgb(c, 0) + '" title="' + esc(curt(s) + ' ' + grupHE(s)) + '">' + esc(curt(s)) + '</div>'; }).join('') +
          o.filter(function (s, i) { return o.findIndex(function (z) { return z._u === s._u; }) === i; }).map(function (s) { return '<div class="gs-he__m gs-he__m--orig" title="Surt d’aquí">' + esc(curt(s)) + '</div>'; }).join('') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  // Assistent d'espais: canviar l'aula d'una sessió (o de totes les hores de la mateixa matèria i grup)
  function aulesHE() {
    var R = S.he.r, A = ((R.meta || {}).aules || []).slice();
    R.sessions.forEach(function (s) { if (s.aula && !A.some(function (a) { return a.id === s.aula; })) A.push({ id: s.aula, tipus: '', capacitat: 0 }); });
    return A.sort(function (a, b) { return a.id.localeCompare(b.id, 'ca', { numeric: true }); });
  }
  // PAS 75: amb diverses sessions a la mateixa hora (hores B, optatives…), es tria quina (de partida, la del doble clic) i
  // l'aula ocupada per una altra sessió del mateix bloc també s'intercanvia (abans només es podia canviar bé la primera)
  function espaiHE(k, pos, m) {
    var u = S.he.U[k]; if (!u || u.tipus !== 'classe') return;
    var ses = u.ses.slice().sort(function (a, b) { return (S.he.fi[a.franja] - S.he.fi[b.franja]) || String(a.materia).localeCompare(String(b.materia), 'ca'); }), s0 = ses[0], tria = null;
    var ini = ses.filter(function (x) { return (!pos || posHE(x) === pos) && (!m || clauMatHE(x) === m); })[0] || ses.filter(function (x) { return !pos || posHE(x) === pos; })[0] || s0;
    var mateixes = function (s) { return S.he.r.sessions.filter(function (x) { return x.id_assignacio && x.id_assignacio === s.id_assignacio && x.grup === s.grup && x.aula === s.aula; }); };
    var occ = ocupacioHE({});
    var html = function () {
      var s = tria || ses[0], tot = !!(document.getElementById('gsHeTot') || {}).checked, objectiu = tot ? mateixes(s) : [s];
      var A = aulesHE(), tip = (A.filter(function (a) { return a.id === s.aula; })[0] || {}).tipus, pref = [s.aula_preferent].concat(s.aules_alternatives || []);
      var ocupadaPer = function (a) { var o = []; objectiu.forEach(function (x) { (occ[posHE(x)] || []).forEach(function (y) { if (y.aula === a && y !== x && objectiu.indexOf(y) < 0 && o.indexOf(y) < 0) o.push(y); }); }); return o; };
      var ll = A.map(function (a) { return { a: a, o: ocupadaPer(a.id), p: pref.indexOf(a.id) }; }).sort(function (x, y) { return (x.o.length ? 1 : 0) - (y.o.length ? 1 : 0) || (y.p >= 0 ? 1 : 0) - (x.p >= 0 ? 1 : 0) || (x.a.tipus === tip ? 0 : 1) - (y.a.tipus === tip ? 0 : 1) || x.a.id.localeCompare(y.a.id, 'ca', { numeric: true }); });
      return '<table class="gs-taula-simple gs-he__aules"><thead><tr><th></th><th>Aula</th><th>Tipus</th><th>Places</th><th>Estat</th></tr></thead><tbody>' + ll.map(function (x) {
        var act = x.a.id === s.aula;
        return '<tr' + (act ? ' class="is-actiu"' : '') + '><td><input type="radio" name="gsHeAula" value="' + esc(x.a.id) + '"' + (act ? ' checked disabled' : '') + '></td><td><b>' + esc(x.a.id) + '</b>' + (x.p === 0 ? ' <small>preferent</small>' : x.p > 0 ? ' <small>alternativa</small>' : '') + '</td><td>' + esc(x.a.tipus || '') + '</td><td>' + (x.a.capacitat || '') + '</td><td>' +
          (act ? 'actual' : x.o.length ? '<span class="gs-gris">ocupada: ' + esc(x.o.map(function (y) { return y.materia + ' ' + grupHE(y); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')) + ' (s’intercanvien)</span>' : '<b class="gs-ok">lliure</b>') + '</td></tr>'; }).join('') + '</tbody></table>';
    };
    var etq = function (x) { return x.materia + ' ' + grupHE(x) + ' · ' + x.docents.map(nomCurtHE).join(', ') + ' · ' + x.dia + ' ' + x.franja + ' [' + (x.aula || 'sense aula') + ']'; };
    pregunta('Canvia l’aula', (ses.length > 1 ? '<p><label>Sessió <select id="gsHeSes">' + ses.map(function (x, i) { return '<option value="' + i + '"' + (x === ini ? ' selected' : '') + '>' + esc(etq(x)) + '</option>'; }).join('') + '</select></label></p>' : '') +
      '<p id="gsHeSesTxt"></p>' +
      '<p><label><input type="checkbox" id="gsHeTot"> A totes les hores d’aquesta matèria i grup que són a la mateixa aula</label></p><div id="gsHeAules"></div>',
      [{ t: 'Canvia l’aula', valor: 1, abans: function () { if (!document.querySelector('input[name="gsHeAula"]:checked:not([disabled])')) { toast('Trieu una aula.', true); return false; } aplica.aula = document.querySelector('input[name="gsHeAula"]:checked').value; aplica.tot = $('gsHeTot').checked; } },
        { t: 'Cancel·la', valor: 0, tipus: 'ghost' }], false).then(function (v) {
      $('gsModal').removeEventListener('change', refresca);
      if (v !== 1) return;
      var s = tria || ses[0], objectiu = aplica.tot ? mateixes(s) : [s], abans = [], vell = s.aula;
      objectiu.forEach(function (x) { (occ[posHE(x)] || []).forEach(function (y) { if (y.aula === aplica.aula && y !== x && objectiu.indexOf(y) < 0) { abans.push({ s: y, dia: y.dia, franja: y.franja, aula: y.aula }); y.aula = vell; y.aula_on = 'editor'; } });
        abans.push({ s: x, dia: x.dia, franja: x.franja, aula: x.aula }); x.aula = aplica.aula; x.aula_on = 'editor'; });
      S.he.desfer.push({ t: 'aula ' + vell + ' → ' + aplica.aula, abans: abans }); S.he.canvis++; S.brut = true; preparaHE(); pintaEditorHoraris();
      toast('Aula canviada a ' + objectiu.length + (objectiu.length === 1 ? ' hora' : ' hores') + '. Recordeu desar els canvis.');
    });
    var aplica = {};
    var capS = function () { $('gsHeSesTxt').innerHTML = esc(tria.materia + ' ' + grupHE(tria)) + ' · ' + esc(tria.dia + ' ' + tria.franja) + ' · aula actual <b>' + esc(tria.aula || '—') + '</b>'; };
    var refresca = function (e) { if (e.target.id === 'gsHeSes') { tria = ses[Number(e.target.value)]; capS(); } if (e.target.id === 'gsHeSes' || e.target.id === 'gsHeTot') $('gsHeAules').innerHTML = html(); };
    $('gsModal').addEventListener('change', refresca);
    tria = ini; capS(); $('gsHeAules').innerHTML = html();
  }
  function desaHE() {
    var R = S.he.r, net = R.sessions.map(function (s) { var o = {}; Object.keys(s).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = s[k]; }); return o; });
    return api('horari_editor_desa', { sessions: net, importat: R.meta.importat, editat: R.meta.editat || '', canvis: S.he.canvis }, 'Desant l’horari…').then(function (r) {
      if (!r.ok) return toast(r.errors ? r.errors.slice(0, 3).join(' ') : text(r.error), true);
      // PAS 72: el servidor només torna la meta (abans tornava tot l'horari i es tornava a preparar)
      if (r.lleuger) { S.he.r.meta = r.meta; S.he.canvis = 0; S.he.desfer = []; S.brut = false; pintaEditorHoraris(); return toast('Horari desat.'); }
      S.he.r = r; S.he.canvis = 0; S.he.desfer = []; S.brut = false; S.he.noms = {}; r.docents.forEach(function (d) { S.he.noms[d.id] = d.nom; S.he.curts[d.id] = d.curt; });
      preparaHE(); pintaEditorHoraris(); toast('Horari desat.');
    });
  }
  // Estadístiques d'un docent: ocupació, lectives (alumnat + reduccions), forats i permanència
  // Forat = franja lectiva lliure entre dues ocupades del mateix dia; l'esbarjo lliure no compta; una franja lliure just
  // abans o després d'una guàrdia de pati o de biblioteca compta com a mig forat. Permanència = ocupació + forats.
  function statsDocentHE(id) {
    var M = S.he.r.marc_horari, ses = sessionsHE('docent', id), occ = {}, alu = {}, red = {};
    ses.forEach(function (s) { var k = s.dia + '|' + s.franja; occ[k] = 1; if (s.tipus === 'classe') alu[k] = 1; if (s.tipus === 'reduccio_lectiva') red[k] = 1; });
    var forats = 0;
    M.dies.forEach(function (d) {
      var o = M.franges.map(function (f) { return !!occ[d + '|' + f.id]; }), pri = o.indexOf(true), dar = o.lastIndexOf(true);
      for (var i = pri + 1; i < dar; i++) { if (o[i] || M.franges[i].esbarjo) continue;
        // PAS 71: el mig forat només si la guàrdia d'esbarjo del costat NO és extrema; si ho és, el forat compta sencer
        var extrema = function (j) { return o.slice(0, j).indexOf(true) < 0 || o.slice(j + 1).indexOf(true) < 0; };
        var vora = [i - 1, i + 1].some(function (j) { return M.franges[j] && M.franges[j].esbarjo && o[j] && !extrema(j); }); forats += vora ? 0.5 : 1; }
    });
    // PAS 75: cada franja ocupada compta 1, també una guàrdia de pati o de biblioteca (abans, si era «extrema», 0,5)
    var n = Object.keys(occ).length;
    var a = Object.keys(alu).length, r = Object.keys(red).length, g = { o: 0, p: 0, b: 0, rg: 0 };
    ses.forEach(function (s) { if (s.tipus === 'guardia') g.o++; else if (s.tipus === 'guardia_p') g.p++; else if (s.tipus === 'guardia_b') g.b++; else if (s.tipus === 'reduccio_guardia') g.rg++; });
    return { ocupacio: n, alumnat: a, reduccions: r, lectives: a + r, forats: forats, permanencia: n + forats, guardies: g, gtotal: g.o + g.p + g.b + g.rg };
  }
  function lligaEditorHoraris() {
    if (lligaEditorHoraris.fet) return; lligaEditorHoraris.fet = true;
    var actiu = function () { return S.modul && S.modul.id === 'horaris_editor' && S.he && S.he.r; };
    var panell = function (x) { var c = x.closest('[data-p]'); return c ? S.he.panells[Number(c.dataset.p)] : null; };
    var clic = function (e) {
      if (!actiu()) return;
      var b = e.target.closest('[data-he]'), sx = e.target.closest('.gs-he__s');
      // PAS 69: amb edició, el ressaltat espera un moment per si és un doble clic (assistent d'espais)
      if (!b && sx) { var m = sx.dataset.m; clearTimeout(S.he.tclic); S.he.tclic = setTimeout(function () { S.he.focus = S.he.focus === m ? '' : m; pintaEditorHoraris(); }, edHE() ? 260 : 0); return; }
      if (!b) return;
      var a = b.dataset.he, p = panell(b), it = p ? itemsHE(p.tipus).map(function (x) { return x.id; }) : [], i = p ? it.indexOf(p.sel) : -1;
      if (a === 'ant' && i > 0) { p.sel = it[i - 1]; pintaEditorHoraris(); }
      else if (a === 'seg' && i < it.length - 1) { p.sel = it[i + 1]; pintaEditorHoraris(); }
      else if (a === 'treu') { S.he.panells.splice(S.he.panells.indexOf(p), 1); pintaEditorHoraris(); }
      else if (a === 'afegeix' && S.he.panells.length < 3) { var usats = S.he.panells.map(function (q) { return q.tipus; }), nou = VISTES_HE.map(function (v) { return v[0]; }).filter(function (t) { return usats.indexOf(t) < 0; })[0] || 'docent'; S.he.panells.push({ tipus: nou, sel: '' }); pintaEditorHoraris(); }
      else if (a === 'focus') { S.he.focus = S.he.focus === b.dataset.m ? '' : b.dataset.m; pintaEditorHoraris(); }
      else if (a === 'pdf') pdfHE(S.he.panells.filter(function (q) { return q.sel; }).map(function (q) { return { tipus: q.tipus, id: q.sel }; }));
      else if (a === 'pdf-tutories') pdfTutoriesHE();   // PAS 85
      else if (a === 'pdf-tots') { var p0 = S.he.panells[0]; pdfHE(itemsHE(p0.tipus).map(function (x) { return { tipus: p0.tipus, id: x.id }; })); }
      else if (a === 'importa') $('gsHeFitxer').click();
      else if (a === 'desfes') desfesHE();
      else if (a === 'desa') desaHE();
      else if (a === 'avisos') { var Rr = S.he.r.meta.resultat, dt = Rr.detall || {}, NR = { dies: 'Mateixa matèria el mateix dia', forats: 'Forats del professorat', guardies: 'Guàrdies sense cobrir', max_diaria: 'Màxim d’hores d’ocupació diària', permanencia: 'Màxim de permanència setmanal', pati: 'Ocupació al costat d’una guàrdia de pati' };
        pregunta('Resultat del motor', '<p>Índex de penalització: <b>' + (Rr.penalitzacio || 0) + '</b>' + (Object.keys(dt.per_regla || {}).length ? ' = ' + Object.keys(dt.per_regla).map(function (k) { return esc(NR[k] || k) + ' ' + dt.per_regla[k]; }).join(' + ') : '') + '</p>' +
          ((dt.principals || []).length ? '<p><b>El que més penalitza</b></p><ul>' + dt.principals.map(function (x) { return '<li>' + x.punts + ' · ' + esc(NR[x.regla] || x.regla) + ': ' + esc(x.qui) + '</li>'; }).join('') + '</ul>' : '') +
          ((Rr.avisos || []).length ? '<p><b>Avisos</b></p><ul>' + Rr.avisos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''), [{ t: 'Tanca', valor: 1 }]); }
    };
    $('gsEines').addEventListener('click', clic); $('gsTaula').addEventListener('click', clic);
    var canvi = function (e) {
      if (!actiu()) return;
      var x = e.target, p = panell(x);
      if (x.dataset && x.dataset.he === 'sel' && p) { p.sel = x.value; pintaEditorHoraris(); }
      else if (x.dataset && x.dataset.he === 'tipus' && p) { p.tipus = x.value; p.sel = ''; pintaEditorHoraris(); }
      else if (x.id === 'gsHeFitxer' && x.files[0]) { importaHE(x.files[0]); x.value = ''; }
    };
    $('gsEines').addEventListener('change', canvi); $('gsTaula').addEventListener('change', canvi);
    // PAS 69: arrossegar i deixar anar (micromoviments) i doble clic (assistent d'espais)
    var T = $('gsTaula');
    T.addEventListener('dragstart', function (e) { if (!actiu() || !edHE()) return; var x = e.target.closest && e.target.closest('[data-u]'); if (!x) return;
      e.stopPropagation(); S.he.drag = x.dataset.u; try { e.dataTransfer.setData('text/plain', x.dataset.u); e.dataTransfer.effectAllowed = 'move'; } catch (er) { /* res */ } x.classList.add('is-drag'); });
    T.addEventListener('dragend', function () { S.he.drag = ''; [].forEach.call(T.querySelectorAll('.is-drag, .is-sobre'), function (x) { x.classList.remove('is-drag', 'is-sobre'); }); });
    T.addEventListener('dragover', function (e) { if (!actiu() || !S.he.drag) return; var td = e.target.closest && e.target.closest('td[data-pos]'); if (!td) return; e.preventDefault();
      [].forEach.call(T.querySelectorAll('.is-sobre'), function (x) { if (x !== td) x.classList.remove('is-sobre'); }); td.classList.add('is-sobre'); });
    T.addEventListener('drop', function (e) { if (!actiu() || !S.he.drag) return; var td = e.target.closest && e.target.closest('td[data-pos]'); if (!td) return; e.preventDefault();
      var k = S.he.drag, p = td.dataset.pos.split('|'); S.he.drag = ''; td.classList.remove('is-sobre'); mouHE(k, p[0], p[1]); });
    T.addEventListener('dblclick', function (e) { if (!actiu() || !edHE()) return; var x = e.target.closest && e.target.closest('.gs-he__s[data-u]'); if (x) { clearTimeout(S.he.tclic); var td = x.closest('td[data-pos]'); espaiHE(x.dataset.u, td ? td.dataset.pos : '', x.dataset.m); } });
    // PAS 68: Escape treu el ressaltat (totes les matèries en mode normal)
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && actiu() && S.he.focus && $('gsModal').hidden) { S.he.focus = ''; pintaEditorHoraris(); } });
  }
  // ------------------------------------------------------------------ PAS 75 · DEPARTAMENTS/ÀMBITS (pàgina web)
  // Cada departament/àmbit té una pàgina al web (El Nostre Centre › Departaments i àmbits). El cap escriu la presentació
  // (amb una imatge opcional), els projectes, les feines d'estiu i altres; el professorat, les matèries amb el seu professorat
  // i els nivells dels criteris de qualificació surten sols. «Publica» (administració) torna a construir el web.
  var LLISTES_DW = [['projectes', 'Projectes', [['titol', 'Títol'], ['text', 'Descripció', 1], ['enllac', 'Enllaç (https://…)'], ['curs', 'Curs']]],
    ['feines_estiu', 'Feines d’estiu', [['nivell', 'Nivell'], ['titol', 'Títol'], ['text', 'Indicacions', 1], ['enllac', 'Enllaç (https://…)']]],
    ['altres', 'Altres (opcional)', [['titol', 'Títol'], ['text', 'Text', 1], ['enllac', 'Enllaç (https://…)']]]];
  // PAS 76: format bàsic (negreta, cursiva, llistes i enllaços) amb el mateix codi que el web (departament-pagina.js)
  function mdDw(t) { return window.DepartamentPagina ? DepartamentPagina.md(t) : '<p>' + esc(t) + '</p>'; }
  var depDw = function () { return ((S.dw && S.dw.departaments) || []).filter(function (d) { return d.id === S.dwSel; })[0]; };
  // PAS 76 · Icones (SVG) de l'estat i de les accions
  var IC_DW = {
    desa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h11l3 3v15H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 3v6h8V3M8 21v-7h8v7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    tanca: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    obre: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    ull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    edita: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    bloc: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 6l12 12" stroke="currentColor" stroke-width="1.8"/></svg>',
    publica: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 14v5.5h15V14" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    rellotge: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };
  var estatDw = function (w) { var t = (w || {}).estat === 'tancada'; return '<span class="gs-dw__estat gs-dw__estat--' + (t ? 'tancada' : 'oberta') + '">' + (t ? IC_DW.tanca + ' Tancada' : IC_DW.edita + ' Oberta') + '</span>'; };
  function carregaDepartaments(forca) {
    return (!forca && S.dw && fresc('departaments') ? Promise.resolve(S.dw) : api('departaments_web_dades', {}, 'Carregant els departaments/àmbits…')).then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.dw = r; S.d = { files: [], camps: [], nivell: r.nivell, obert: r.obert };
      if (!r.admin) S.dwTab = 'edicio'; else S.dwTab = S.dwTab || 'edicio';
      if (!r.departaments.some(function (d) { return d.id === S.dwSel; })) S.dwSel = ((r.departaments.filter(function (d) { return d.es_meu; })[0]) || r.departaments[0] || {}).id;
      S.dwEd = null; lligaDepartaments(); pintaDepartaments();
    });
  }
  function edDw() { var d = depDw(); if (!d) return null; if (!S.dwEd || S.dwEd.id !== d.id) { var w = d.web || {}; S.dwEd = { id: d.id, presentacio: w.presentacio || '', peu_imatge: w.peu_imatge || '', projectes: JSON.parse(JSON.stringify(w.projectes || [])), feines_estiu: JSON.parse(JSON.stringify(w.feines_estiu || [])), altres: JSON.parse(JSON.stringify(w.altres || [])) }; } return S.dwEd; }
  // Text del bloqueig de l'edició (data límit o bloqueig manual)
  function textBloqueigDw(B) {
    if (!B) return '';
    if (B.manual) return 'Edició <b>bloquejada</b> per l’administració.';
    if (B.perData) return 'Edició <b>bloquejada</b>: la data límit (' + esc(dataCurta(B.limit)) + ') ja ha passat.';
    return B.limit ? 'Edició oberta fins al <b>' + esc(dataCurta(B.limit)) + '</b> (l’endemà es bloqueja sola).' : 'Edició oberta (sense data límit).';
  }
  var dataCurta = function (d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? Number(m[3]) + '/' + Number(m[2]) + '/' + m[1] : String(d || ''); };
  function pintaDepartaments() {
    var R = S.dw, d = depDw(), pub = R.publicat, adm = S.dwTab === 'admin';
    $('gsEines').innerHTML = (R.admin ? '<div class="gs-dw__tabs" role="tablist"><button type="button" role="tab" class="gs-dw__tab' + (!adm ? ' is-actiu' : '') + '" data-dw="tab" data-tab="edicio" aria-selected="' + !adm + '">' + IC_DW.edita + ' Edició</button><button type="button" role="tab" class="gs-dw__tab' + (adm ? ' is-actiu' : '') + '" data-dw="tab" data-tab="admin" aria-selected="' + adm + '">' + IC_DW.tanca + ' Administració</button></div>' : '') +
      (!adm && R.departaments.length ? '<select data-dw="sel" aria-label="Departament/àmbit">' + R.departaments.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === S.dwSel ? ' selected' : '') + '>' + esc(x.nom) + ((x.web || {}).estat === 'tancada' ? ' 🔒' : x.es_meu ? ' ✎' : '') + '</option>'; }).join('') + '</select>' : '') +
      '<span class="gs-espai"></span>' + (!adm && d ? '<button type="button" class="prog-btn prog-btn--ghost gs-dw__ic" data-dw="previ" title="Obre en una pestanya nova la pàgina tal com sortirà al web (amb els canvis encara sense desar)">' + IC_DW.ull + ' Vista prèvia</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="mod-actualitza" title="Torna a llegir les dades">Actualitza</button>' +
      '<p class="gs-ajuda gs-cal__ajuda">Pàgina de cada departament/àmbit al web (<b>El Nostre Centre › Departaments i àmbits</b>), amb el mateix format per a tots. ' +
      'El cap escriu la <b>presentació</b> (amb una imatge opcional), els <b>projectes</b>, les <b>feines d’estiu</b> i <b>altres</b>; el <b>professorat</b> (només el nom complet), les <b>matèries</b> amb el seu professorat i els <b>criteris de qualificació</b> surten sols. ' +
      'Quan la pàgina està llesta, el cap la <b>tanca</b> (editada i verificada). L’administració fixa la data límit, bloqueja l’edició i <b>publica</b> les pàgines tancades. ' + textBloqueigDw(R.bloqueig) + ' ' + (pub ? 'Darrera publicació: ' + esc(dataHoraHE(pub.data)) + ' (' + pub.n + ').' : 'Encara no s’ha publicat.') + '</p>';
    var t = $('gsTaula'); t.className = 'gs-ocu gs-dw';
    if (adm) return pintaAdminDw();
    if (!d) { t.innerHTML = '<p class="gs-ajuda" style="padding:12px">No hi ha cap departament/àmbit. Es defineixen a <b>Currículum › Assignacions › Caps de departament/àmbit</b>.</p>'; return ajustaAlcada(); }
    var E = edDw(), w = d.web || {}, A = d.auto || {}, ed = d.edita, tancada = w.estat === 'tancada', B = R.bloqueig || {};
    var llista = function (L) { var k = L[0], camps = L[2], ll = E[k];
      return '<section class="gs-dw__sec"><h3>' + esc(L[1]) + '</h3>' + (ll.length ? '<div class="gs-dw__ll">' + ll.map(function (x, i) { return '<div class="gs-dw__item" data-ll="' + k + '" data-i="' + i + '">' + camps.map(function (c) {
          return '<label' + (c[2] ? ' class="gs-dw__ample"' : '') + '><span>' + esc(c[1]) + '</span>' + (c[2] ? '<textarea rows="2" data-dwk="' + c[0] + '"' + (ed ? '' : ' disabled') + '>' + esc(x[c[0]] || '') + '</textarea>' : '<input type="text" data-dwk="' + c[0] + '" value="' + esc(x[c[0]] || '') + '"' + (ed ? '' : ' disabled') + '>') + '</label>'; }).join('') +
          (ed ? '<button type="button" class="gs-perill" data-dw="treu" aria-label="Treu">×</button>' : '') + '</div>'; }).join('') + '</div>' : '<p class="gs-gris">Cap.</p>') +
        (ed ? '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-dw="afegeix" data-ll="' + k + '">+ Afegeix</button>' : '') + '</section>'; };
    var mats = {}; (A.materies || []).forEach(function (m) { (mats[m.nivell] = mats[m.nivell] || []).push(m); });
    // PAS 76: barra de dalt per al cap (Desa, Tanca/Obre i l'estat) i ajuda del format del text
    var barra = d.es_meu ? '<div class="gs-dw__barra">' + estatDw(w) +
        (ed ? '<button type="button" class="prog-btn gs-dw__ic" data-dw="desa">' + IC_DW.desa + ' Desa</button>' : '') +
        (d.estat_pot ? (tancada ? '<button type="button" class="prog-btn prog-btn--ghost gs-dw__ic" data-dw="obre" title="Torna a obrir la pàgina per canviar-la">' + IC_DW.obre + ' Obre</button>' : '<button type="button" class="prog-btn prog-btn--ghost gs-dw__ic" data-dw="tanca" title="Informa que la pàgina està editada i verificada (es publicarà)">' + IC_DW.tanca + ' Tanca</button>') : '') +
        '<span class="gs-gris" id="gsDwEstat">' + (tancada ? 'Tancada' + (w.data_tancat ? ' el ' + esc(dataHoraHE(w.data_tancat)) : '') + '. ' + (d.estat_pot ? 'Per canviar-la, obriu-la.' : '') : '') + (d.bloquejat && !R.admin ? ' L’edició està bloquejada: la podeu consultar, però no editar, tancar ni obrir.' : '') + '</span></div>' : '';
    var ajudaFmt = '<details class="gs-dw__fmt" open><summary>Com es dona format al text</summary><p>Edició bàsica, com al Markdown: <code>**negreta**</code> → <b>negreta</b> · <code>*cursiva*</code> → <i>cursiva</i> · una línia en blanc = paràgraf nou · ' +
      '<code>- element</code> (una línia per element) = llista de pics · <code>1. element</code> = llista numerada · <code>[text de l’enllaç](https://…)</code> = enllaç (s’obre en una pestanya nova). El primer paràgraf de la presentació surt destacat a dalt de la pàgina. ' +
      'Guia completa: <a href="https://www.markdownguide.org/basic-syntax/" target="_blank" rel="noopener">Markdown Guide · Basic Syntax ↗</a> (en anglès; només funcionen els formats d’aquí).</p></details>';
    t.innerHTML = '<div class="gs-dw__cos"><div class="gs-dw__form">' +
      '<h2 class="gs-amon__tit">' + esc(d.nom) + ' <small class="gs-gris">· ' + esc(d.especialitats.join(', ')) + (d.cap_nom ? ' · cap: ' + esc(d.cap_nom) : '') + (w.data ? ' · desat el ' + esc(dataHoraHE(w.data)) : '') + '</small></h2>' +
      barra + (d.es_meu ? '' : '<p class="prog-avis">Només el cap del departament/àmbit (o l’administració) el pot editar.</p>') + ajudaFmt +
      '<section class="gs-dw__sec"><h3>Presentació</h3><textarea id="gsDwPres" rows="12"' + (ed ? '' : ' disabled') + ' placeholder="Primer paràgraf: la idea principal (surt destacada).&#10;&#10;Paràgrafs separats per una línia en blanc. **negreta**, *cursiva*, [text](https://…)&#10;- llista de pics&#10;1. llista numerada">' + esc(E.presentacio) + '</textarea>' +
        '<div class="gs-dw__img">' + (w.miniatura ? '<img src="' + esc(w.miniatura) + '" alt="Imatge de la presentació">' : '<span class="gs-gris">Sense imatge</span>') +
        (ed ? '<div><label class="prog-btn prog-btn--ghost prog-btn--sm">' + (w.miniatura ? 'Canvia la imatge' : 'Afegeix una imatge') + '<input type="file" id="gsDwImg" accept="image/*" hidden></label>' + (w.miniatura ? ' <button type="button" class="gs-enllac" data-dw="treu-img">Treu la imatge</button>' : '') + '</div>' : '') + '</div>' +
        '<label class="gs-dw__peu"><span>Peu de la imatge (opcional)</span><input type="text" id="gsDwPeu" value="' + esc(E.peu_imatge) + '"' + (ed ? '' : ' disabled') + '></label></section>' +
      LLISTES_DW.map(llista).join('') + '</div>' +
      '<aside class="gs-dw__auto"><h3>Surt sol</h3>' +
      '<section class="gs-dw__sec"><h4>Professorat (' + (A.professorat || []).length + ')</h4><p>' + ((A.professorat || []).map(esc).join(' · ') || '<span class="gs-gris">Cap docent amb aquestes especialitats.</span>') + '</p><p class="gs-gris">De GESTIO › Professorat (docents en actiu amb una especialitat del departament/àmbit). Només el nom complet.</p></section>' +
      '<section class="gs-dw__sec"><h4>Matèries i professorat</h4>' + (Object.keys(mats).length ? Object.keys(mats).map(function (n) { return '<p><b>' + esc(n) + '</b></p><ul>' + mats[n].map(function (m) { return '<li>' + esc(m.materia) + (m.hores ? ' (' + fmtH(m.hores) + ' h)' : '') + (m.docents.length ? ': ' + esc(m.docents.map(function (x) { return x.nom + (x.grups.length ? ' (' + x.grups.join(', ') + ')' : ''); }).join('; ')) : '') + '</li>'; }).join('') + '</ul>'; }).join('') : '<p class="gs-gris">Cap matèria.</p>') + '<p class="gs-gris">De Currículum (matèries) i Currículum › Assignacions (professorat).</p></section>' +
      '<section class="gs-dw__sec"><h4>Criteris de qualificació</h4><p>' + ((A.nivells || []).map(esc).join(' · ') || '—') + '</p><p class="gs-gris">Al web, un botó per nivell genera el PDF amb els criteris publicats de les matèries del departament/àmbit (mòdul Criteris de qualificació).</p></section>' +
      '<section class="gs-dw__sec"><h4>Programacions</h4><p class="gs-gris">Quan el mòdul Programacions estigui en marxa, hi sortiran les del departament/àmbit.</p></section>' +
      '</aside></div>';
    ajustaAlcada();
  }
  // PAS 76 · Administració: data límit, bloqueig, estat de cada pàgina (tanca/obre) i publicació de les tancades
  function pintaAdminDw() {
    var R = S.dw, B = R.bloqueig || {}, t = $('gsTaula'), ll = R.departaments, nT = ll.filter(function (d) { return (d.web || {}).estat === 'tancada'; }).length;
    t.innerHTML = '<div class="gs-dw__admin">' +
      '<section class="gs-dw__sec gs-dw__panell"><h3>' + IC_DW.rellotge + ' Termini d’edició</h3><p>' + textBloqueigDw(B) + '</p>' +
        '<div class="gs-form-fila"><label>Data límit <input type="date" id="gsDwLimit" value="' + esc(B.limit || '') + '"></label><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-dw="limit">Desa la data</button>' +
        (B.manual ? '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm gs-dw__ic" data-dw="desbloqueja">' + IC_DW.obre + ' Desbloqueja-les totes</button>' : '<button type="button" class="prog-btn prog-btn--sm gs-dw__ic gs-dw__perill" data-dw="bloqueja">' + IC_DW.bloc + ' Bloqueja-les totes</button>') +
        (B.bloquejat && nT < ll.length ? '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm gs-dw__ic" data-dw="tanca-totes">' + IC_DW.tanca + ' Tanca les obertes (' + (ll.length - nT) + ')</button>' : '') + '</div>' +
        '<p class="gs-gris">Amb l’edició bloquejada, els caps no poden canviar ni tancar ni obrir les seves pàgines (sí que les poden consultar); l’administració, sí. L’endemà de la data límit es bloqueja sola. Per bloquejar-ne <b>només una</b>, feu servir el cadenat de la columna <b>Bloqueig</b>.</p></section>' +
      '<section class="gs-dw__sec"><h3>Estat de les pàgines <small class="gs-gris">· ' + nT + ' de ' + ll.length + ' tancades</small></h3>' +
        '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-dw__estats"><thead><tr><th>Departament/àmbit</th><th>Cap</th><th>Estat</th><th>Darrer desat</th><th>Tancada</th><th class="gs-cen">Bloqueig</th><th class="gs-cen">Accions</th></tr></thead><tbody>' +
        ll.map(function (d) { var w = d.web || {}, tc = w.estat === 'tancada';
          return '<tr data-dwid="' + esc(d.id) + '"><td><b>' + esc(d.nom) + '</b></td><td>' + esc(d.cap_nom || '—') + '</td><td>' + estatDw(w) + '</td><td>' + (w.data ? esc(dataHoraHE(w.data)) : '<span class="gs-gris">mai</span>') + '</td><td>' + (tc && w.data_tancat ? esc(dataHoraHE(w.data_tancat)) + (w.tancat_per ? ' <small class="gs-gris">' + esc(w.tancat_per.split('@')[0]) + '</small>' : '') : '—') + '</td>' +
            '<td class="gs-cen"><button type="button" class="gs-dw__ib' + (w.bloquejada ? ' gs-dw__ib--bloc' : '') + '" data-dw="bloc-dep" title="' + (w.bloquejada ? 'Bloquejat: el cap el pot consultar, però no editar, tancar ni obrir. Clic: desbloqueja' : 'Bloqueja aquest departament/àmbit (el cap el podrà consultar, però no editar, tancar ni obrir)') + '" aria-label="' + (w.bloquejada ? 'Desbloqueja ' : 'Bloqueja ') + esc(d.nom) + '" aria-pressed="' + !!w.bloquejada + '">' + (w.bloquejada ? IC_DW.tanca : IC_DW.obre) + '</button></td>' +
            '<td class="gs-cen gs-dw__accions"><button type="button" class="gs-dw__ib" data-dw="' + (tc ? 'obre' : 'tanca') + '" title="' + (tc ? 'Torna a obrir la pàgina' : 'Tanca la pàgina (editada i verificada)') + '" aria-label="' + (tc ? 'Obre ' : 'Tanca ') + esc(d.nom) + '">' + (tc ? IC_DW.obre : IC_DW.tanca) + '</button>' +
            '<button type="button" class="gs-dw__ib" data-dw="ves" title="Edita la pàgina" aria-label="Edita ' + esc(d.nom) + '">' + IC_DW.edita + '</button><button type="button" class="gs-dw__ib" data-dw="previ" title="Vista prèvia (pestanya nova)" aria-label="Vista prèvia de ' + esc(d.nom) + '">' + IC_DW.ull + '</button></td></tr>'; }).join('') + '</tbody></table></section>' +
      '<section class="gs-dw__sec gs-dw__panell"><h3>' + IC_DW.publica + ' Publicació al web</h3><p>Només es publiquen les pàgines <b>tancades</b> (' + nT + '). Les obertes no surten al web fins que es tanquin i es torni a publicar.' + (R.publicat ? ' Darrera publicació: ' + esc(dataHoraHE(R.publicat.data)) + ' (' + R.publicat.n + ').' : '') + '</p>' +
        '<button type="button" class="prog-btn gs-dw__ic" data-dw="publica"' + (nT ? '' : ' disabled') + '>' + IC_DW.publica + ' Publica les pàgines tancades (' + nT + ')</button></section></div>';
    ajustaAlcada();
  }
  function llegeixDw() {
    var E = edDw(); if (!E || S.dwTab === 'admin') return;
    if ($('gsDwPres')) E.presentacio = $('gsDwPres').value; if ($('gsDwPeu')) E.peu_imatge = $('gsDwPeu').value;
    [].forEach.call(document.querySelectorAll('#gsTaula .gs-dw__item'), function (it) { var o = E[it.dataset.ll][Number(it.dataset.i)]; if (!o) return; [].forEach.call(it.querySelectorAll('[data-dwk]'), function (i) { o[i.dataset.dwk] = i.value; }); });
  }
  function desaDw() {
    llegeixDw(); var E = S.dwEd;
    return api('departaments_web_desa', E, 'Desant…').then(function (r) {
      if (!r.ok) { toast(r.errors ? r.errors.slice(0, 3).join(' ') : text(r.error), true); return false; }
      depDw().web = r.web; S.dwEd = null; S.brut = false; pintaDepartaments(); toast('Desat. Quan estigui llesta, tanqueu-la: l’administració publica les pàgines tancades.'); return true;
    });
  }
  // PAS 76 · Tanca (editada i verificada) o torna a obrir una pàgina. Si hi ha canvis sense desar, primer es desen.
  function estatDwCanvia(id, estat) {
    var fes = function () { return api('departaments_estat', { id: id, estat: estat }, estat === 'tancada' ? 'Tancant…' : 'Obrint…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      var d = S.dw.departaments.filter(function (x) { return x.id === id; })[0]; d.web = r.web; d.edita = estat !== 'tancada' && d.estat_pot; S.dwEd = null; S.brut = false; pintaDepartaments();
      toast(estat === 'tancada' ? 'Pàgina tancada: queda com a editada i verificada.' : 'Pàgina oberta: ja es pot tornar a editar.'); }); };
    if (estat === 'tancada' && S.brut && id === S.dwSel && S.dwTab !== 'admin') return desaDw().then(function (ok) { if (ok) return fes(); });
    if (estat === 'tancada') return pregunta('Tanca la pàgina', '<p>En tancar-la informeu que la pàgina està <b>editada i verificada</b>: l’administració la podrà publicar. Si cal canviar-la, es pot tornar a obrir' + (S.dw.admin ? '' : ' mentre l’edició no estigui bloquejada') + '.</p>', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Tanca-la', valor: 1 }]).then(function (v) { if (v) fes(); });
    return fes();
  }
  // PAS 76 · Vista prèvia en una pestanya nova, igual que la pàgina del web (departament-pagina.js) i amb els canvis sense desar
  function previDw(d, E) {
    if (!window.DepartamentPagina) return toast('No s’ha pogut carregar la vista prèvia. Torneu a carregar la pàgina.', true);
    var w = d.web || {}, A = d.auto || {}, dades = { slug: d.slug, nom: d.nom, especialitats: d.especialitats, presentacio: E.presentacio, imatge: w.miniatura || '', peu_imatge: E.peu_imatge,
      professorat: A.professorat || [], cap: d.cap_nom || '', materies: A.materies || [], nivells: A.nivells || [], projectes: E.projectes, feines_estiu: E.feines_estiu, altres: E.altres };
    var H = DepartamentPagina.pagina(dades, 'ca', '');
    var css = ':root{--color-bg:#fff;--color-blue:#1C0CBC;--color-orange:#E8600C;--color-text:#1E1E2A;--color-text-muted:#5A6078;--color-border:#E9EAEE;}' +
      '@font-face{font-family:Montserrat;font-weight:100 900;font-display:swap;src:url(/assets/fonts/montserrat-latin-wght-normal.woff2) format("woff2")}' +
      'body{margin:0;font-family:Montserrat,system-ui,sans-serif;color:var(--color-text);background:#fff}' +
      '.qs-hero{position:relative;width:100%;height:clamp(220px,28vw,420px);overflow:hidden}.qs-hero img{width:100%;height:100%;object-fit:cover;object-position:center 55%;display:block}' +
      '.qs-hero__box{position:absolute;right:clamp(16px,5vw,64px);bottom:clamp(24px,5vw,56px);background:rgba(255,255,255,.72);backdrop-filter:blur(3px);padding:clamp(18px,2.6vw,34px) clamp(22px,3.4vw,48px);border-radius:4px;max-width:calc(100% - 32px);box-shadow:0 14px 34px rgba(15,8,90,.18)}' +
      '.qs-hero__box h1{margin:0;color:var(--color-blue);text-transform:uppercase;line-height:1.05}.qs-hero__title{display:block;font-size:clamp(28px,4.4vw,60px);font-weight:300}.qs-hero__subtitle{display:block;margin-top:.45em;font-size:clamp(15px,1.9vw,26px);font-weight:500}' +
      '.dp-previ{position:sticky;top:0;z-index:5;background:#E8600C;color:#fff;font:600 14px/1.4 Montserrat,system-ui,sans-serif;padding:10px 16px;text-align:center}' +
      '.dp-boto{pointer-events:none;opacity:.85}';
    var html = '<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vista prèvia · ' + esc(d.nom) + '</title>' +
      '<link rel="stylesheet" href="/assets/css/departaments.css"><style>' + css + '</style></head><body><div class="dp-previ">VISTA PRÈVIA · ' + esc(d.nom) + ' · ' + ((w.estat === 'tancada') ? 'pàgina tancada' : 'pàgina oberta') + (S.brut ? ' · amb canvis sense desar' : '') + ' · així sortirà al web quan es publiqui (la imatge, en petit)</div>' + H.hero + H.cos + '</body></html>';
    var win = window.open('', '_blank');
    if (!win) return toast('El navegador ha bloquejat la pestanya nova: permeteu les finestres emergents d’aquest web.', true);
    win.document.open(); win.document.write(html); win.document.close();
  }
  // La imatge es redueix al navegador (JPEG, màx. 1600 px; miniatura de 360 px) i es desa de seguida
  function imatgeDw(f) {
    if (!/^image\//.test(f.type)) return toast('Trieu una imatge.', true);
    var rd = new FileReader();
    rd.onload = function () { var img = new Image(); img.onload = function () {
      var redueix = function (max, q) { var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q); };
      var gran = redueix(1600, 0.85), mini = redueix(360, 0.72); if (mini.length > 44000) mini = redueix(260, 0.6);
      api('departaments_web_imatge', { id: S.dwSel, b64: gran.split(',')[1], miniatura: mini }, 'Desant la imatge…').then(function (r) {
        if (!r.ok) return toast(text(r.error), true);
        llegeixDw(); depDw().web = Object.assign({}, r.web); var E = S.dwEd; S.dwEd = null; var E2 = edDw(); if (E) { E2.presentacio = E.presentacio; E2.peu_imatge = E.peu_imatge; ['projectes', 'feines_estiu', 'altres'].forEach(function (k) { E2[k] = E[k]; }); }
        pintaDepartaments(); toast('Imatge desada.'); });
    }; img.onerror = function () { toast('No s’ha pogut llegir la imatge.', true); }; img.src = rd.result; };
    rd.readAsDataURL(f);
  }
  function adminDw(dades, msg) {
    return api('departaments_admin', dades, 'Desant…').then(function (r) { if (!r.ok) return toast(text(r.error), true);
      S.dw.bloqueig = r.bloqueig; if (r.tancades) return carregaDepartaments(true).then(function () { toast(msg + ' (' + r.tancades + ')'); });
      if (r.web && dades.bloqueja_dep) S.dw.departaments.forEach(function (d) { if (d.id === dades.bloqueja_dep.id) d.web = r.web; });
      S.dw.departaments.forEach(function (d) { d.bloquejat = r.bloqueig.bloquejat || !!(d.web || {}).bloquejada; d.edita = d.es_meu && (S.dw.admin || !d.bloquejat) && (d.web || {}).estat !== 'tancada'; d.estat_pot = d.es_meu && (S.dw.admin || !d.bloquejat); });
      pintaDepartaments(); toast(msg); });
  }
  function lligaDepartaments() {
    if (lligaDepartaments.fet) return; lligaDepartaments.fet = true;
    var actiu = function () { return S.modul && S.modul.id === 'departaments' && S.dw; };
    var accio = function (e) { if (!actiu()) return; var b = e.target.closest('[data-dw]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return; var a = b.dataset.dw, fila = b.closest('[data-dwid]'), idF = fila ? fila.dataset.dwid : S.dwSel;
      if (a === 'tab') { if (b.dataset.tab === S.dwTab) return; var vesT = function () { llegeixDw(); S.dwTab = b.dataset.tab; pintaDepartaments(); };
        if (S.brut && b.dataset.tab === 'admin') pregunta('Canvis sense desar', '<p>Hi ha canvis sense desar a la pàgina que editeu. Es mantenen si torneu a Edició abans de canviar de departament.</p>', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Continua', valor: 1 }]).then(function (v) { if (v) vesT(); }); else vesT(); }
      else if (a === 'desa') desaDw();
      else if (a === 'tanca') estatDwCanvia(idF, 'tancada');
      else if (a === 'obre') estatDwCanvia(idF, 'oberta');
      else if (a === 'ves') { S.dwSel = idF; S.dwEd = null; S.brut = false; S.dwTab = 'edicio'; pintaDepartaments(); }
      else if (a === 'afegeix') { llegeixDw(); S.dwEd[b.dataset.ll].push({}); S.brut = true; pintaDepartaments(); }
      else if (a === 'treu') { llegeixDw(); var it = b.closest('.gs-dw__item'); S.dwEd[it.dataset.ll].splice(Number(it.dataset.i), 1); S.brut = true; pintaDepartaments(); }
      else if (a === 'treu-img') pregunta('Treu la imatge', '<p>Es treurà la imatge de la presentació (els altres canvis sense desar també es desaran).</p>', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Treu-la', valor: 1, tipus: 'danger' }]).then(function (v) { if (!v) return; llegeixDw(); S.dwEd.treu_imatge = true; desaDw(); });
      else if (a === 'previ') { var dd = S.dw.departaments.filter(function (x) { return x.id === idF; })[0]; if (!dd) return; var E;
        if (idF === S.dwSel && S.dwTab !== 'admin') { llegeixDw(); E = edDw(); } else { var w0 = dd.web || {}; E = { presentacio: w0.presentacio || '', peu_imatge: w0.peu_imatge || '', projectes: w0.projectes || [], feines_estiu: w0.feines_estiu || [], altres: w0.altres || [] }; }
        previDw(dd, E); }
      else if (a === 'limit') adminDw({ limit: $('gsDwLimit').value }, $('gsDwLimit').value ? 'Data límit desada.' : 'Data límit treta.');
      else if (a === 'bloqueja') pregunta('Bloqueja l’edició', '<p>Els caps no podran canviar ni tancar ni obrir les seves pàgines fins que la desbloquegeu. L’administració sí que podrà.</p>', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Bloqueja', valor: 1, tipus: 'danger' }]).then(function (v) { if (v) adminDw({ bloqueig: true }, 'Edició bloquejada.'); });
      else if (a === 'bloc-dep') { var dB = S.dw.departaments.filter(function (x) { return x.id === idF; })[0], bl = !(dB.web || {}).bloquejada; adminDw({ bloqueja_dep: { id: idF, bloquejada: bl } }, dB.nom + (bl ? ': bloquejat (el cap el pot consultar, però no editar).' : ': desbloquejat.')); }
      else if (a === 'desbloqueja') adminDw({ bloqueig: false }, 'Edició desbloquejada' + ((S.dw.bloqueig || {}).perData ? ' (però la data límit ja ha passat: canvieu-la).' : '.'));
      else if (a === 'tanca-totes') pregunta('Tanca les pàgines obertes', '<p>Es tancaran totes les pàgines que encara són obertes, tal com estan desades.</p>', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Tanca-les', valor: 1 }]).then(function (v) { if (v) adminDw({ tanca_obertes: true }, 'Pàgines tancades'); });
      else if (a === 'publica') pregunta('Publica els departaments/àmbits', '<p>Es publicaran només les pàgines <b>tancades</b> (tal com estan desades) i es tornarà a construir el web. Del professorat només hi surt el nom complet; cap dada d’alumnat.</p>', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Publica', valor: 1 }]).then(function (v) {
        if (!v) return; api('departaments_publica', {}, 'Publicant…').then(function (r) { if (!r.ok) return toast(text(r.error), true); S.dw.publicat = r.publicat; pintaDepartaments();
          toast('Publicat (' + r.publicat.n + ').' + (r.build === 'iniciat' ? ' El web s’està tornant a construir (uns minuts).' : r.build === 'sense_hook' ? ' Falta el build hook de Netlify (config › netlify_build_hook): el web s’actualitzarà al proper desplegament.' : ' No s’ha pogut iniciar la reconstrucció del web (' + r.build + ').'), r.build !== 'iniciat' && r.build !== 'sense_hook'); }); });
    };
    $('gsEines').addEventListener('click', accio); $('gsTaula').addEventListener('click', accio);
    $('gsEines').addEventListener('change', function (e) { if (!actiu() || e.target.dataset.dw !== 'sel') return; var nou = e.target.value;
      var canvia = function () { S.dwSel = nou; S.dwEd = null; S.brut = false; pintaDepartaments(); };
      if (S.brut) pregunta('Canvis sense desar', '<p>Hi ha canvis sense desar en aquest departament/àmbit. Es perdran.</p>', [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Continua', valor: 1 }]).then(function (v) { if (v) canvia(); else e.target.value = S.dwSel; }); else canvia(); });
    $('gsTaula').addEventListener('input', function (e) { if (actiu() && e.target.type !== 'file' && e.target.closest('.gs-dw__form')) S.brut = true; });
    $('gsTaula').addEventListener('change', function (e) { if (actiu() && e.target.id === 'gsDwImg' && e.target.files[0]) { imatgeDw(e.target.files[0]); e.target.value = ''; } });
  }
  // ------------------------------------------------------------------ PAS 76 · SANCIONS
  // Totes les sancions de l'alumnat: acumulació de retards (Control d'entrada), ús indegut del mòbil, acumulació
  // d'amonestacions lleus i amonestació greu. Mai no es posen soles: les valora i les crea l'administració (aquí, al
  // Control d'entrada o a Amonestacions: es veuen a tot arreu). Llista amb filtres i ordre per qualsevol columna.
  var COLS_SAN = [['estat', 'Estat'], ['data', 'Data'], ['alumne', 'Alumne/a'], ['grup', 'Grup-Classe'], ['tipus', 'Tipus'], ['descripcio', 'Descripció'], ['registres', 'Registres'], ['id_sancio', 'Codi']];
  function carregaSancions(forca) {
    return (!forca && S.san && fresc('sancions') ? Promise.resolve(S.san) : api('sancions_dades', {}, 'Carregant les sancions…')).then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.san = r; S.sanV = S.sanV || { fc: {}, ord: ['data', -1], tipus: '', estat: '' }; S.d = { files: [], camps: [], nivell: r.nivell, obert: r.obert };
      lligaSancions(); pintaSancions();
    });
  }
  var valSan = function (x, k) {
    var R = S.san;
    if (k === 'tipus') return TIPUS_SANCIO[x.tipus] || x.tipus;
    if (k === 'registres') { var e = x.entrades.length, a = x.amonestacions.length, pes = 0; if (e) R.entrades.forEach(function (y) { if (x.entrades.indexOf(y.id) >= 0) pes += pesRetard(y.hora); });
      return (e ? e + ' entrades (' + pes + ' retards)' : '') + (e && a ? ' · ' : '') + (a ? a + ' amonestacions' : '') || '—'; }
    if (k === 'estat') return x.estat;
    return String(x[k] || '');
  };
  function filesSan() {
    var V = S.sanV, fc = V.fc;
    var l = S.san.sancions.filter(function (x) { return (!V.tipus || x.tipus === V.tipus) && (!V.estat || x.estat === V.estat) &&
      COLS_SAN.every(function (c) { var q = plega(fc[c[0]] || ''); return !q || plega(c[0] === 'data' ? dataVista(x.data) + ' ' + x.data : valSan(x, c[0])).indexOf(q) >= 0; }); });
    var k = V.ord[0], dir = V.ord[1];
    return l.sort(function (a, b) { var x = valSan(a, k), y = valSan(b, k); return dir * (k === 'data' ? x.localeCompare(y) : plega(x).localeCompare(plega(y), 'ca', { numeric: true })) || String(b.data).localeCompare(String(a.data)); });
  }
  function pintaSancions() {
    var R = S.san, V = S.sanV, pot = R.pot_sancionar, l = filesSan(), tot = R.sancions;
    var n = function (f) { return tot.filter(f).length; };
    $('gsEines').innerHTML = '<label class="gs-check">Tipus <select data-san="tipus"><option value="">tots</option>' + Object.keys(TIPUS_SANCIO).map(function (t) { return '<option value="' + t + '"' + (V.tipus === t ? ' selected' : '') + '>' + esc(TIPUS_SANCIO[t]) + ' (' + n(function (x) { return x.tipus === t; }) + ')</option>'; }).join('') + '</select></label>' +
      '<label class="gs-check">Estat <select data-san="estat"><option value="">tots</option>' + R.estats.map(function (e) { return '<option' + (V.estat === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label>' +
      '<span class="gs-gris">' + l.length + ' de ' + tot.length + ' sancions</span><span class="gs-espai"></span>' +
      (pot ? '<button type="button" class="prog-btn" data-san="nova">+ Nova sanció</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-san="pdf">PDF</button><button type="button" class="prog-btn prog-btn--ghost" data-accio="mod-actualitza" title="Torna a llegir les dades">Actualitza</button>' +
      '<p class="gs-ajuda gs-cal__ajuda">Sancions de l’alumnat de quatre tipus: <b>acumulació de retards</b> (amb les entrades del Control d’entrada), <b>ús indegut del mòbil</b>, <b>acumulació d’amonestacions lleus</b> i <b>amonestació greu</b> (amb les amonestacions). ' +
      'Mai no es posen soles: les valora i les crea l’administració, aquí o des del Control d’entrada i les Amonestacions (doble clic a l’alumne/a). Estat: <span class="gs-punt gs-punt--vermell"></span> en tràmit (sanció en curs) · <span class="gs-punt gs-punt--verd"></span> sancionat · <span class="gs-punt gs-punt--blanc"></span> anul·lada. Cliqueu el títol d’una columna per ordenar i escriviu a la fila de sota per filtrar.</p>';
    var fl = function (c) { var o = V.ord[0] === c[0]; return '<th><button type="button" class="gs-mat__ord" data-san-ord="' + c[0] + '">' + esc(c[1]) + (o ? (V.ord[1] > 0 ? ' ▲' : ' ▼') : '') + '</button></th>'; };
    var t = $('gsTaula'); t.className = 'gs-ocu gs-san';
    t.innerHTML = '<div class="gs-san__wrap"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-san__taula"><thead><tr>' + COLS_SAN.map(fl).join('') + (pot ? '<th></th>' : '') + '</tr>' +
      '<tr class="gs-mat__filtres">' + COLS_SAN.map(function (c) { return '<th><input type="search" data-san-fc="' + c[0] + '" value="' + esc(V.fc[c[0]] || '') + '" placeholder="filtra" aria-label="Filtra ' + esc(c[1]) + '"></th>'; }).join('') + (pot ? '<th></th>' : '') + '</tr></thead><tbody>' +
      (l.length ? l.map(function (x) { return '<tr data-sid="' + esc(x.id_sancio) + '"' + (x.estat === 'anul·lada' ? ' class="gs-gris"' : '') + '><td class="gs-cen"><span class="gs-punt gs-punt--' + COLOR_SANCIO[x.estat] + '" title="' + esc(x.estat) + '"></span></td><td>' + esc(dataVista(x.data)) + '</td><td><b>' + esc(x.alumne) + '</b></td><td>' + esc(x.grup || x.nivell || '') + '</td><td>' + esc(TIPUS_SANCIO[x.tipus] || x.tipus) + '</td><td>' + esc(x.descripcio) + '</td><td>' + esc(valSan(x, 'registres')) + '</td><td class="gs-gris">' + esc(x.id_sancio) + '</td>' +
        (pot ? '<td class="gs-san__acc"><button type="button" class="gs-enllac" data-san="edita">Edita</button> · ' + (x.estat === 'anul·lada' ? '<button type="button" class="gs-enllac" data-san="recupera">Recupera</button>' : '<button type="button" class="gs-enllac" data-san="anul·la">Anul·la</button>') + ' · <button type="button" class="gs-enllac gs-perill" data-san="esborra">Esborra</button></td>' : '') + '</tr>'; }).join('') : '<tr><td colspan="' + (COLS_SAN.length + 1) + '" class="gs-gris">Cap sanció' + (tot.length ? ' amb aquests filtres.' : ' encara.') + '</td></tr>') + '</tbody></table></div>';
    ajustaAlcada();
  }
  // Nova sanció o edició: alumne/a, tipus, descripció, data, estat i (segons el tipus) les entrades o les amonestacions
  function dialegSancioGen(x) {
    var R = S.san, ed = x || null, alu = ed ? { id: ed.id_alumne, nom: ed.alumne, grup: ed.grup } : null;
    var html = '<div class="gs-form-fila">' + (ed ? '<p><b>' + esc(ed.alumne) + '</b> · ' + esc(ed.grup || ed.nivell || '') + ' <small class="gs-gris">' + esc(ed.id_sancio) + '</small></p>' :
        '<label style="flex:2">Alumne/a <input type="text" id="gsSgAlu" list="gsSgAlus" placeholder="Escriviu el nom o el grup…" autocomplete="off"><datalist id="gsSgAlus">' + R.alumnes.map(function (a) { return '<option value="' + esc(a.nom + ' · ' + (a.grup || a.nivell)) + '">'; }).join('') + '</datalist></label>') +
      '<label>Tipus <select id="gsSgTipus">' + Object.keys(TIPUS_SANCIO).map(function (t) { return '<option value="' + t + '"' + ((ed ? ed.tipus : 'retards') === t ? ' selected' : '') + '>' + esc(TIPUS_SANCIO[t]) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="gs-form-fila"><label style="flex:2">Descripció <input type="text" id="gsSgDesc" maxlength="500" value="' + esc(ed ? ed.descripcio : '') + '"></label><label>Data <input type="date" id="gsSgData" value="' + esc(ed ? ed.data : isoDe(new Date())) + '"></label>' +
      '<label>Estat <select id="gsSgEstat">' + R.estats.map(function (e) { return '<option' + ((ed ? ed.estat : 'en tràmit') === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label></div><div id="gsSgRegs"></div><p class="prog-avis" id="gsSgErr" hidden></p>';
    var obre = pregunta(ed ? 'Edita la sanció' : 'Nova sanció', html, [{ t: ed ? 'Desa' : 'Crea la sanció', valor: 1, abans: function () {
      var t = $('gsSgTipus').value, cos = { tipus: t, descripcio: $('gsSgDesc').value, data: $('gsSgData').value, estat: $('gsSgEstat').value, modul: 'sancions',
        entrades: t === 'retards' ? [].map.call(document.querySelectorAll('.gsSgReg:checked'), function (c) { return c.value; }) : [], amonestacions: t === 'amonestacions' || t === 'greu' ? [].map.call(document.querySelectorAll('.gsSgReg:checked'), function (c) { return c.value; }) : [] };
      if (ed) cos.id_sancio = ed.id_sancio; if (alu) cos.id_alumne = alu.id;
      var e = []; if (!alu) e.push('Trieu l’alumne/a de la llista.'); if (!cos.descripcio.trim()) e.push('Cal la descripció.'); if (!cos.data) e.push('Cal la data.');
      if (t === 'retards' && !cos.entrades.length) e.push('Marqueu almenys una entrada.'); if (t === 'amonestacions' && !cos.amonestacions.length) e.push('Marqueu almenys una amonestació.');
      if (e.length) { $('gsSgErr').textContent = e.join(' '); $('gsSgErr').hidden = false; return false; }
      dialegSancioGen.cos = cos; } }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }], false);
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample');
    var regs = function () {
      var t = $('gsSgTipus').value, el = $('gsSgRegs');
      if (!alu) { el.innerHTML = '<p class="gs-gris">Trieu l’alumne/a per veure les seves entrades i amonestacions.</p>'; return; }
      var k = alu.id, ent = t === 'retards', am = t === 'amonestacions' || t === 'greu';
      if (!ent && !am) { el.innerHTML = '<p class="gs-gris">Aquest tipus de sanció no porta entrades ni amonestacions.</p>'; return; }
      var ll = (ent ? R.entrades : R.amonestacions).filter(function (y) { return y.id_alumne === k; }).sort(function (a, b) { return String(b.data || b.data_fets).localeCompare(String(a.data || a.data_fets)); });
      var dins = ed ? (ent ? ed.entrades : ed.amonestacions) : [];
      el.innerHTML = '<p class="gs-ajuda">' + (ent ? 'Entrades amb retard de l’alumne/a (les justificades, en groc, no es poden sancionar).' : 'Amonestacions de l’alumne/a' + (t === 'greu' ? ' (opcional: la greu pot no tenir-ne cap).' : '.')) + ' Les d’una altra sanció no es poden triar.</p>' +
        (ll.length ? '<div class="gs-sanc__ents"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th></th><th>Estat</th><th>Data</th><th>' + (ent ? 'Hora · retards' : 'Professor/a') + '</th><th>Sanció</th></tr></thead><tbody>' +
          ll.map(function (y) { var altra = y.id_sancio && (!ed || y.id_sancio !== ed.id_sancio), no = altra || (ent && y.estat === 'groc');
            return '<tr' + (no ? ' class="gs-gris"' : '') + '><td><input type="checkbox" class="gsSgReg" value="' + esc(y.id) + '"' + (dins.indexOf(y.id) >= 0 ? ' checked' : '') + (no ? ' disabled' : '') + '></td><td><span class="gs-punt gs-punt--' + esc(y.estat || 'blanc') + '"></span></td><td>' + esc(dataVista(y.data || y.data_fets)) + '</td><td>' + esc(ent ? y.hora + ' · ' + pesRetard(y.hora) : y.professor) + '</td><td>' + esc(y.id_sancio || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="gs-gris">Cap.</p>');
    };
    if ($('gsSgAlu')) $('gsSgAlu').addEventListener('input', function () { var v = this.value; alu = R.alumnes.filter(function (a) { return a.nom + ' · ' + (a.grup || a.nivell) === v; })[0] || null; regs(); });
    $('gsSgTipus').addEventListener('change', regs); regs();
    obre.then(function (v) { if (!v) return; api('sancio_desa', dialegSancioGen.cos, 'Desant la sanció…').then(function (r) { if (!r.ok) return toast(r.errors ? r.errors.join(' ') : text(r.error), true); sancioFeta(r, 'Sanció desada: ' + r.sancio.id_sancio + '.'); }); });
  }
  // Després de desar o esborrar: es torna a llegir (els estats de les entrades i les amonestacions canvien) i els mòduls de
  // control d'entrada i amonestacions ja llegits es tornaran a llegir
  function sancioFeta(r, msg) { delete S.cache.control_entrada; delete S.cache.amonestacions; toast(msg); carregaSancions(true); }
  function pdfSancions() {
    var l = filesSan();
    informe('Sancions', l.length + ' sancions' + (S.sanV.tipus ? ' · ' + TIPUS_SANCIO[S.sanV.tipus] : '') + (S.sanV.estat ? ' · ' + S.sanV.estat : '') + '.', ['', 'Data', 'Alumne/a', 'Grup-Classe', 'Tipus', 'Descripció', 'Estat', 'Registres'],
      l.map(function (x, i) { return [String(i + 1), dataVista(x.data), x.alumne, x.grup || x.nivell || '', TIPUS_SANCIO[x.tipus] || x.tipus, x.descripcio, x.estat, valSan(x, 'registres')]; }), 'sancions');
  }
  function lligaSancions() {
    if (lligaSancions.fet) return; lligaSancions.fet = true;
    var actiu = function () { return S.modul && S.modul.id === 'sancions' && S.san; };
    var clic = function (e) { if (!actiu()) return; var o = e.target.closest('[data-san-ord]'); if (o) { var k = o.dataset.sanOrd; S.sanV.ord = [k, S.sanV.ord[0] === k ? -S.sanV.ord[1] : 1]; return pintaSancions(); }
      var b = e.target.closest('[data-san]'); if (!b || b.tagName === 'SELECT') return; var a = b.dataset.san, tr = b.closest('[data-sid]'), x = tr ? S.san.sancions.filter(function (y) { return y.id_sancio === tr.dataset.sid; })[0] : null;
      if (a === 'nova') dialegSancioGen(null);
      else if (a === 'pdf') pdfSancions();
      else if (a === 'edita') dialegSancioGen(x);
      else if (a === 'anul·la' || a === 'recupera') api('sancio_desa', { id_sancio: x.id_sancio, tipus: x.tipus, modul: 'sancions', id_alumne: x.id_alumne, descripcio: x.descripcio, data: x.data, estat: a === 'anul·la' ? 'anul·lada' : 'en tràmit', entrades: x.entrades, amonestacions: x.amonestacions }, 'Desant…').then(function (r) { if (!r.ok) return toast(r.errors ? r.errors.join(' ') : text(r.error), true); sancioFeta(r, a === 'anul·la' ? 'Sanció anul·lada: els registres tornen a blanc.' : 'Sanció recuperada (en tràmit).'); });
      else if (a === 'esborra') pregunta('Esborra la sanció', '<p>S’esborrarà la sanció ' + esc(x.id_sancio) + ' i els seus registres tornaran a blanc (queda una còpia a l’historial). Per conservar-la, anul·leu-la.</p>', [{ t: 'Esborra', valor: 1, tipus: 'danger' }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]).then(function (v) {
        if (v) api('sancio_esborra', { id_sancio: x.id_sancio, modul: 'sancions' }, 'Esborrant…').then(function (r) { if (!r.ok) return toast(text(r.error), true); sancioFeta(r, 'Sanció esborrada.'); }); });
    };
    $('gsEines').addEventListener('click', clic); $('gsTaula').addEventListener('click', clic);
    $('gsEines').addEventListener('change', function (e) { if (!actiu() || !e.target.dataset.san) return; S.sanV[e.target.dataset.san] = e.target.value; pintaSancions(); });
    $('gsTaula').addEventListener('input', function (e) { if (!actiu() || !e.target.dataset.sanFc) return; var k = e.target.dataset.sanFc, pos = e.target.selectionStart; S.sanV.fc[k] = e.target.value; pintaSancions();
      var i = $('gsTaula').querySelector('[data-san-fc="' + k + '"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (x) { /* res */ } } });
  }
  // ------------------------------------------------------------------ PAS 81 · NOTIFICACIONS
  // Avisos importants i excepcionals (notificacions del web) a qui s'hi ha subscrit a la pàgina pública Avisos: a tot el
  // centre o a uns cursos. Només l'administració del mòdul els envia (sense aprovació); en l'idioma en què s'escriuen i a
  // qualsevol hora. L'enviament el fa la funció de Netlify avisos-envia. Subscripcions: només recomptes (cap dada personal).
  var PAGINES_AVIS = ['/calendari-escolar.html', '/noticies.html', '/secretaria-preinscripcio-matricula.html', '/secretaria-beques-ajuts.html', '/avisos.html', '/index.html'];
  function carregaNotificacions(forca) {
    if (forca) S.notVapid = null;
    return (!forca && S.not && fresc('notificacions') ? Promise.resolve(S.not) : api('notificacions_dades', {}, 'Carregant les notificacions…')).then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.not = r; S.notF = S.notF || { titol: '', text: '', url: '', tots: true, cursos: [] };
      S.d = { files: [], camps: [], nivell: r.nivell, obert: r.obert };
      lligaNotificacions(); pintaNotificacions();
    });
  }
  var nomCursNot = function (id) { var c = (S.not.cursos || []).filter(function (x) { return x.id === id; })[0]; return c ? c.nom : id; };
  var textTemesNot = function (t) { var l = String(t || '').split('|').filter(Boolean); return l.indexOf('tots') >= 0 || !l.length ? 'Tot el centre' : l.map(nomCursNot).join(', '); };
  // Dispositius que rebrien l'avís: tots, o els que han triat algun dels cursos
  function destinatarisNot() {
    var F = S.notF, R = S.not.recompte || {}, t = R.temes || [];
    if (F.tots) return t.length;
    return t.filter(function (x) { var l = x ? x.split('|') : []; return l.some(function (c) { return F.cursos.indexOf(c) >= 0; }); }).length;
  }
  function enCursNot() { return (S.not.avisos || []).filter(function (a) { return a.estat === 'enviant'; })[0] || null; }
  function darrerNot() { var l = (S.not.avisos || []).filter(function (a) { return a.estat !== 'error'; }); return l[0] || null; }
  function pintaPreviNot() {
    var F = S.notF, el = $('gsNotPrevi'); if (!el) return;
    el.innerHTML = '<div class="gs-not__notif"><img src="/assets/icones/icona-192.png" alt=""><div><b>' + esc(F.titol || 'Títol de l’avís') + '</b><span>' + esc(F.text || 'Text de l’avís.') + '</span><small>institutjoanmiro.cat' + (F.url ? ' · obre ' + esc(urlNot(F.url)) : '') + '</small></div></div>';
    var n = destinatarisNot(); $('gsNotN').textContent = n + (n === 1 ? ' dispositiu' : ' dispositius');
    $('gsNotCt').textContent = F.titol.length + '/50'; $('gsNotCx').textContent = F.text.length + '/150';
  }
  function pintaNotificacions() {
    var R = S.not, F = S.notF, Rc = R.recompte || {}, d = darrerNot(), pot = R.pot_enviar && R.configurat;
    $('gsEines').innerHTML = '<span class="gs-gris"><b>' + (Rc.total || 0) + '</b> dispositius subscrits' + (d ? ' · darrer avís: ' + esc(dataVista(d.data)) : '') + '</span><span class="gs-espai"></span>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="mod-actualitza" title="Torna a llegir les dades">Actualitza</button>' +
      '<p class="gs-ajuda gs-cal__ajuda">Avisos <b>importants i excepcionals</b> (aproximadament un al mes) al mòbil o a l’ordinador de qui s’hi ha subscrit a la pàgina pública <a href="/avisos.html" target="_blank" rel="noopener">Avisos</a> del web (icona de la campana). Cada avís va a <b>tot el centre</b> o a uns <b>cursos</b>. ' +
      'Es veuen a la pantalla de bloqueig: <b>cap dada personal ni d’alumnat</b>; l’enllaç porta a la pàgina del web amb la informació.' + (pot ? '' : ' Només els envia l’administració del mòdul.') + '</p>';
    estatVapidNot();
    var t = $('gsTaula'); t.className = 'gs-ocu gs-not';
    if (!R.configurat) { t.innerHTML = '<p class="prog-avis">' + esc(text('notificacions_no_configurat')) + '</p>'; return ajustaAlcada(); }
    var form = !pot ? '' : '<section class="gs-not__sec"><h3>Nou avís</h3><div class="gs-not__form"><div>' +
      '<label class="gs-not__camp">Títol <small id="gsNotCt"></small><input type="text" id="gsNotTitol" maxlength="50" value="' + esc(F.titol) + '" placeholder="P. ex. Jornada de portes obertes"></label>' +
      '<label class="gs-not__camp">Text <small id="gsNotCx"></small><textarea id="gsNotText" maxlength="150" rows="3" placeholder="Una o dues frases. Sense dades personals.">' + esc(F.text) + '</textarea></label>' +
      '<label class="gs-not__camp">Enllaç (opcional: una pàgina del web) <input type="text" id="gsNotUrl" list="gsNotPags" value="' + esc(F.url) + '" placeholder="/calendari-escolar.html"><datalist id="gsNotPags">' + PAGINES_AVIS.map(function (p) { return '<option value="' + p + '">'; }).join('') + '</datalist></label>' +
      '<fieldset class="gs-not__dest"><legend>Destinataris</legend><label class="gs-check"><input type="radio" name="gsNotDest" value="tots"' + (F.tots ? ' checked' : '') + '> Tot el centre</label><label class="gs-check"><input type="radio" name="gsNotDest" value="cursos"' + (F.tots ? '' : ' checked') + '> Uns cursos:</label>' +
      '<div class="gs-not__cursos">' + R.cursos.map(function (c) { return '<label class="gs-check"><input type="checkbox" class="gsNotCurs" value="' + esc(c.id) + '"' + (F.cursos.indexOf(c.id) >= 0 ? ' checked' : '') + (F.tots ? ' disabled' : '') + '> ' + esc(c.nom) + '</label>'; }).join('') +
      '<span><button type="button" class="gs-enllac" data-not="eso">Tota l’ESO</button> · <button type="button" class="gs-enllac" data-not="bat">Tot el batxillerat</button></span></div></fieldset>' +
      (enCursNot() ? '<p class="prog-avis">L’avís ' + esc(enCursNot().id) + ' no s’ha acabat d’enviar (' + enCursNot().enviats + ' de ' + enCursNot().destinataris + '). Continueu-lo o atureu-lo a la llista d’avisos enviats abans d’enviar-ne un altre.</p>' : '') + '<p class="prog-avis" id="gsNotErr" hidden></p><div class="gs-not__env"><button type="button" class="prog-btn" data-not="envia"' + (enCursNot() ? ' disabled' : '') + '>Envia l’avís…</button><span class="gs-gris">Arribarà a <b id="gsNotN"></b> (aprox.)</span></div></div>' +
      '<div><p class="gs-gris gs-not__previtit">Vista prèvia</p><div id="gsNotPrevi"></div><p class="gs-ajuda">L’aspecte exacte depèn del mòbil o de l’ordinador. Títol: fins a 50 caràcters; text: fins a 150.</p></div></div></section>';
    var per = Rc.per_curs || {};
    var subs = '<section class="gs-not__sec"><h3>Subscripcions</h3><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-not__subs"><thead><tr><th>Curs</th><th>Dispositius</th></tr></thead><tbody>' +
      R.cursos.map(function (c) { return '<tr><td>' + esc(c.nom) + '</td><td class="gs-cen">' + (per[c.id] || 0) + '</td></tr>'; }).join('') +
      '<tr><td>Només els avisos de tot el centre</td><td class="gs-cen">' + (Rc.nomes_centre || 0) + '</td></tr><tr><th>Total de dispositius</th><th class="gs-cen">' + (Rc.total || 0) + '</th></tr></tbody></table>' +
      '<p class="gs-ajuda">Un dispositiu pot haver triat més d’un curs. Tots reben els avisos de tot el centre. No es desa cap nom ni correu.</p></section>';
    var av = R.avisos || [];
    var hist = '<section class="gs-not__sec"><h3>Avisos enviats</h3>' + (av.length ? '<div class="gs-not__wrap"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Data</th><th>Avís</th><th>Destinataris</th><th>Enviat per</th><th>Lliurats</th><th>Fallits</th><th>Codi</th></tr></thead><tbody>' +
      av.map(function (a) { return '<tr' + (a.estat === 'error' ? ' class="gs-gris"' : '') + '><td>' + esc(dataVista(a.data)) + ' ' + esc(String(a.data).slice(11, 16)) + '</td><td><b>' + esc(a.titol) + '</b><br><span class="gs-gris">' + esc(a.text) + '</span>' + (a.url ? '<br><small>' + esc(a.url) + '</small>' : '') + '</td><td>' + esc(textTemesNot(a.temes)) + '</td><td>' + esc(a.autor) + '</td><td class="gs-cen">' + a.lliurats + ' / ' + a.destinataris + '</td><td class="gs-cen">' + a.fallits + (a.caducades ? ' <small class="gs-gris" title="Subscripcions que ja no existeixen: s’han esborrat">(' + a.caducades + ' esborrades)</small>' : '') + (a.estat === 'enviant' ? '<br><small class="gs-not__curs">enviant… ' + a.enviats + ' de ' + a.destinataris + '</small>' + (S.not.pot_enviar ? '<br><button type="button" class="gs-enllac" data-not="continua" data-id="' + esc(a.id) + '">Continua</button> · <button type="button" class="gs-enllac gs-perill" data-not="atura" data-id="' + esc(a.id) + '">Atura</button>' : '') : a.estat === 'aturat' ? '<br><small class="gs-gris">aturat (' + a.enviats + ' de ' + a.destinataris + ')</small>' : '') + (a.detall ? '<br><small class="gs-not__det">' + esc(a.detall) + '</small>' : '') + '</td><td class="gs-gris">' + esc(a.id) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '<p class="gs-gris">Encara no s’ha enviat cap avís.</p>') + '</section>';
    t.innerHTML = '<div class="gs-not__graella">' + form + subs + '</div>' + hist;
    pintaPreviNot(); ajustaAlcada();
  }
  // PAS 82 · Configuració de l'enviament (claus VAPID de Netlify): es comprova en obrir el mòdul i es mostra a dalt
  function estatVapidNot() {
    var pinta = function (v) { var el = $('gsNotVapid'); if (!el || !v) return;
      el.innerHTML = v.vapid === 'correcte' ? '✔ Claus de les notificacions correctes · remitent ' + esc(v.subjecte) + (v.subjecte_propi ? '' : ' <span class="gs-perill">(VAPID_SUBJECT no és vàlid: cal «mailto:adreça@domini» sense espais)</span>') : '<span class="gs-perill">✖ ' + esc(text(v.vapid)) + '</span>'; };
    var el = document.createElement('p'); el.id = 'gsNotVapid'; el.className = 'gs-gris gs-not__vapid'; $('gsEines').appendChild(el);
    if (S.notVapid) return pinta(S.notVapid);
    fetch(API + 'avisos-envia', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) { if (v && v.ok) { S.notVapid = v; pinta(v); } }).catch(function () { /* sense funció (proves locals) */ });
  }
  function urlNot(u) { u = String(u || '').trim(); var m = /^https?:\/\/(www\.)?institutjoanmiro(\.cat|\.netlify\.app)(\/.*)?$/i.exec(u); if (m) u = m[3] || '/'; return u; }
  function enviaNot() {
    var F = S.notF, e = [], d = darrerNot(); F.url = urlNot(F.url);
    if (!F.titol.trim()) e.push('Cal el títol.'); if (!F.text.trim()) e.push('Cal el text.');
    if (F.url && (!/^\/[^\s<>"]*$/.test(F.url) || /^\/\//.test(F.url))) e.push('L’enllaç ha de ser una pàgina del web (comença per /).');
    if (!F.tots && !F.cursos.length) e.push('Trieu algun curs o «Tot el centre».');
    var n = destinatarisNot(); if (!e.length && !n) e.push(text('cap_destinatari'));
    if (e.length) { $('gsNotErr').textContent = e.join(' '); $('gsNotErr').hidden = false; return; }
    $('gsNotErr').hidden = true;
    var dies = d ? Math.floor((Date.now() - new Date(String(d.data).replace(' ', 'T')).getTime()) / 864e5) : 99;
    pregunta('Envia l’avís', '<div class="gs-not__notif"><img src="/assets/icones/icona-192.png" alt=""><div><b>' + esc(F.titol) + '</b><span>' + esc(F.text) + '</span><small>institutjoanmiro.cat' + (F.url ? ' · obre ' + esc(F.url) : '') + '</small></div></div>' +
      '<p>Destinataris: <b>' + esc(F.tots ? 'tot el centre' : F.cursos.map(nomCursNot).join(', ')) + '</b> · <b>' + n + '</b> dispositius (aprox.).</p>' +
      (dies < 30 ? '<p class="prog-avis">El darrer avís es va enviar fa ' + dies + (dies === 1 ? ' dia' : ' dies') + ' (' + esc(dataVista(d.data)) + '). Els avisos han de ser importants i excepcionals: aproximadament un al mes.</p>' : '') +
      '<p class="gs-gris">Un cop enviat, no es pot desfer. Comproveu que no hi ha cap dada personal.</p>', [{ t: 'Envia', valor: 1 }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }], false).then(function (v) {
      if (!v) return;
      postNot({ accio: 'inicia', titol: F.titol, text: F.text, url: F.url, temes: F.tots ? ['tots'] : F.cursos }, 'Preparant l’avís…').then(function (r) {
        if (!r.ok) { if (r.error === 'avis_en_curs') carregaNotificacions(true); return toast(r.errors ? r.errors.join(' ') : text(r.error) + (r.detall ? ' (' + r.detall + ')' : ''), true); }
        S.notF = { titol: '', text: '', url: '', tots: true, cursos: [] };
        enviaTrossosNot(r.id, r.destinataris);
      });
    });
  }
  // PAS 83 · Crida a la funció d'enviament (inicia, tros o atura)
  function postNot(cos, progres) {
    var crida = fetch(API + 'avisos-envia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(cos) })
      .then(function (r) { if (r.status === 401) avisSessio(); return r.json().catch(function () { return { ok: false, error: 'error_servidor', detall: 'HTTP ' + r.status }; }); })
      .catch(function () { return { ok: false, error: 'error_servidor' }; });
    return progres && window.Progres ? Progres.amb(crida, progres) : crida;
  }
  // PAS 83 · L'enviament es fa en trossos de 400 dispositius (cada tros, una crida curta a la funció de Netlify), amb la
  // barra «Enviant… 800 de 2.000». Si s'interromp, l'avís queda «enviant» i es pot continuar (sense repetir ningú).
  function enviaTrossosNot(id, total) {
    var P = window.Progres, voltes = 0, brut = S.brut; S.brut = true;   // avís si es tanca la pestanya a mig enviament
    if (P) P.inici('Enviant l’avís… 0 de ' + total);
    var acaba = function (r, error) { S.brut = brut; if (P) P.fi(error); return r; };
    var pas = function () {
      return postNot({ accio: 'tros', id: id }).then(function (r) {
        if (!r.ok) return acaba(r, true);
        if (P) P.posa(r.total ? r.enviats / r.total : 1, 'Enviant l’avís… ' + r.enviats + ' de ' + r.total);
        if (r.acabat || ++voltes > 200) return acaba(r);
        return pas();
      });
    };
    return pas().then(function (r) {
      if (!r.ok) { toast('L’enviament s’ha interromput (' + text(r.error) + (r.detall ? ': ' + r.detall : '') + '). L’avís ha quedat «enviant»: podeu continuar-lo des de la llista d’avisos enviats.', true); return carregaNotificacions(true); }
      if (!r.acabat) return carregaNotificacions(true);
      S.not = r; S.llegit.notificacions = { t: Date.now() }; pintaNotificacions();
      toast('Avís enviat (' + r.id + '): lliurat a ' + r.lliurats + ' de ' + r.enviats + ' dispositius' + (r.fallits ? ' · ' + r.fallits + ' fallits' + (r.caducades ? ' (' + r.caducades + ' subscripcions caducades, esborrades)' : '') + (r.detall ? ': ' + r.detall : '') : '') + '.', r.fallits && !r.lliurats);
    });
  }
  function lligaNotificacions() {
    if (lligaNotificacions.fet) return; lligaNotificacions.fet = true;
    var actiu = function () { return S.modul && S.modul.id === 'notificacions' && S.not; };
    $('gsTaula').addEventListener('input', function (e) {
      if (!actiu()) return; var F = S.notF, id = e.target.id;
      if (id === 'gsNotTitol') F.titol = e.target.value; else if (id === 'gsNotText') F.text = e.target.value; else if (id === 'gsNotUrl') F.url = e.target.value; else return;
      pintaPreviNot();
    });
    $('gsTaula').addEventListener('change', function (e) {
      if (!actiu()) return; var F = S.notF;
      if (e.target.name === 'gsNotDest') { F.tots = e.target.value === 'tots'; [].forEach.call(document.querySelectorAll('.gsNotCurs'), function (c) { c.disabled = F.tots; }); pintaPreviNot(); }
      else if (e.target.classList.contains('gsNotCurs')) { F.cursos = [].filter.call(document.querySelectorAll('.gsNotCurs'), function (c) { return c.checked; }).map(function (c) { return c.value; }); pintaPreviNot(); }
    });
    $('gsTaula').addEventListener('click', function (e) {
      if (!actiu()) return; var b = e.target.closest('[data-not]'); if (!b) return; var a = b.dataset.not, F = S.notF;
      if (a === 'envia') return enviaNot();
      if (a === 'continua') return enviaTrossosNot(b.dataset.id, (enCursNot() || {}).destinataris || 0);
      if (a === 'atura') return pregunta('Atura l’enviament', '<p>L’avís ' + esc(b.dataset.id) + ' ja no arribarà als dispositius que encara no l’han rebut. Es conserva a la llista com a «aturat».</p>', [{ t: 'Atura', valor: 1, tipus: 'danger' }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]).then(function (v) {
        if (v) postNot({ accio: 'atura', id: b.dataset.id }, 'Aturant…').then(function (r) { if (!r.ok) return toast(text(r.error), true); S.not = r; pintaNotificacions(); toast('Enviament aturat.'); }); });
      if (a === 'eso' || a === 'bat') {
        F.tots = false; var re = a === 'eso' ? /ESO$/ : /BAT$/;
        S.not.cursos.forEach(function (c) { if (re.test(c.id) && F.cursos.indexOf(c.id) < 0) F.cursos.push(c.id); });
        var r = document.querySelector('input[name="gsNotDest"][value="cursos"]'); if (r) r.checked = true;
        [].forEach.call(document.querySelectorAll('.gsNotCurs'), function (c) { c.disabled = false; c.checked = F.cursos.indexOf(c.value) >= 0; }); pintaPreviNot();
      }
    });
  }
  // ------------------------------------------------------------------ PAS 57 · OCUPACIÓ
  // Hores fixes de cada docent: lectives d'alumnat (Currículum), reduccions lectives (manuals o automàtiques), guàrdies i
  // reduccions de guàrdia, amb el semàfor 18 + 4 = 22 (en proporció a la jornada). També s'hi assignen els càrrecs.
  var COL_OCU_ALU = { lectives_eso: 'ESO', lectives_bat: 'Bat', atencio_individual: 'At. ind.', tutoria_eso12: 'Tut. 1r/2n', tutoria_eso34: 'Tut. 3r/4t', tutoria_bat: 'Tut. Bat' };
  var COL_OCU_RED = { red_tutoria_eso12: 'Tutoria 1r ESO', carrec_directiu: 'Càrrec directiu', coordinacio_lectiu: 'Coordinació', red_coord_nivell: 'Reunió nivell', red_lectiva_55: '55 anys' };
  var AUTO_OCU = { red_tutoria_eso12: 'tutor/a de 1r d’ESO', red_coord_nivell: 'tutor/a o coordinació de nivell (reunió setmanal)' };   // PAS 58: la de 55 anys s'entra a mà
  function carregaOcupacio() {
    S.ocu = S.ocu || { tab: 'docents', q: '', esp: '', nomesMal: false };
    return api('ocupacio_dades', {}, 'Carregant l’ocupació…').then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      if (!(r.esquema >= 57)) { $('gsAvis').innerHTML = 'Cal l’Apps Script del PAS 57 o posterior: enganxeu el Code.gs nou, executeu «configura» i feu una nova implementació.'; $('gsAvis').hidden = false; return; }
      S.ocu.r = r; S.ocu.brut = {}; S.brut = false; S.d = { files: [], camps: [], nivell: r.nivell, obert: r.obert };
      lligaOcupacio(); pintaOcupacio();
    });
  }
  var edOcu = function () { return S.ocu.r && nivellIdx(S.ocu.r.nivell) >= 1 && S.ocu.r.obert; };
  var nOcu = function (x) { var v = Number(String(x == null ? '' : x).replace(',', '.')); return isNaN(v) ? 0 : v; };
  var r2 = function (x) { return Math.round(x * 100) / 100; };
  // Valors amb els canvis sense desar
  function valOcu(d, k) { var b = S.ocu.brut[d.id]; if (b && Object.prototype.hasOwnProperty.call(b, k)) return b[k]; return k === 'carrec' ? d.carrec : /^guardies_/.test(k) ? d.guardies[k.slice(-1)] : d.valors[k]; }
  function calculOcu(d) {
    var R = S.ocu.r, f = R.factor[d.jornada] || 1, o = { alu: 0, red: 0, g: 0, rg: 0 };
    R.lectives.forEach(function (c) { o.alu += nOcu(valOcu(d, c.clau)); });
    R.reduccions.forEach(function (c) { var v = valOcu(d, c.clau); o.red += String(v == null ? '' : v).trim() === '' ? (d.auto[c.clau] || 0) : nOcu(v); });
    ['o', 'b', 'p'].forEach(function (k) { o.g += nOcu(valOcu(d, 'guardies_' + k)); });
    R.reduccions_guardia.forEach(function (c) { o.rg += nOcu(valOcu(d, c.clau)); });
    o.lect = r2(o.alu + o.red); o.guard = r2(o.g + o.rg); o.total = r2(o.lect + o.guard);
    o.objL = r2(R.objectiu.lectives * f); o.objG = r2(R.objectiu.guardies * f); o.objT = r2(R.objectiu.total * f);
    o.estat = Math.abs(o.lect - o.objL) < 0.01 && Math.abs(o.guard - o.objG) < 0.01 ? 'ok' : Math.abs(o.total - o.objT) < 0.01 ? 'reparteix' : 'no';
    o.text = o.estat === 'ok' ? 'Quadra' : o.estat === 'reparteix' ? 'El total quadra, però no el repartiment (' + o.lect + ' lectives i ' + o.guard + ' de guàrdia; calen ' + o.objL + ' i ' + o.objG + ')'
      : (o.total < o.objT ? 'Falten ' + r2(o.objT - o.total) : 'Sobren ' + r2(o.total - o.objT)) + ' h (' + o.total + ' de ' + o.objT + ')';
    return o;
  }
  function docentsOcu() {
    var q = normCal(S.ocu.q || '');
    return S.ocu.r.docents.filter(function (d) {
      if (S.ocu.esp && d.especialitat !== S.ocu.esp) return false;
      if (q && normCal(d.nom + ' ' + d.especialitat + ' ' + valOcu(d, 'carrec')).indexOf(q) < 0) return false;
      return !S.ocu.nomesMal || calculOcu(d).estat !== 'ok';
    });
  }
  function pintaOcupacio() {
    var R = S.ocu.r, ed = edOcu(), tab = S.ocu.tab, brut = Object.keys(S.ocu.brut).length;
    var esps = R.docents.map(function (d) { return d.especialitat; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort(function (a, b) { return a.localeCompare(b, 'ca'); });
    var tots = R.docents.map(calculOcu), mal = tots.filter(function (o) { return o.estat !== 'ok'; }).length;
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist">' + [['docents', 'Docents'], ['carrecs', 'Càrrecs']].map(function (x) { return '<button type="button" role="tab" data-ocu="tab" data-v="' + x[0] + '" aria-selected="' + (x[0] === tab) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (tab === 'docents' ? '<input type="search" class="gs-cal__cerca" data-ocu="cerca" placeholder="Cerca docent, especialitat o càrrec…" value="' + esc(S.ocu.q) + '">' +
        '<select data-ocu="esp" aria-label="Especialitat"><option value="">Totes les especialitats</option>' + esps.map(function (e) { return '<option' + (e === S.ocu.esp ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select>' +
        '<label class="gs-check"><input type="checkbox" data-ocu="mal"' + (S.ocu.nomesMal ? ' checked' : '') + '> Només els que no quadren (' + mal + ')</label>' : '') +
      '<span class="gs-espai"></span>' + '<button type="button" class="prog-btn prog-btn--ghost" data-accio="mod-actualitza" title="Torna a llegir les dades (p. ex. si algú altre les ha canviat)">Actualitza</button>' +
      (tab === 'docents' && ed ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="prof-curriculum" title="Lectives d’ESO i Bat, atenció individual, tutories i càrrec de tutor/a a partir de Currículum › Assignacions">Carrega des del Currículum</button>' : '') +
      (tab === 'docents' ? '<button type="button" class="prog-btn prog-btn--ghost" data-ocu="pdf-carrecs" title="PDF: docents amb càrrec i quins càrrecs">Llistat de càrrecs</button><button type="button" class="prog-btn prog-btn--ghost" data-ocu="pdf-tutors" title="PDF: tutor/a de cada grup-classe">Llistat de tutors</button>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-ocu="xlsx">Excel</button><button type="button" class="prog-btn prog-btn--ghost" data-ocu="pdf">PDF</button>' : '') +
      (tab === 'docents' && ed ? '<button type="button" class="prog-btn" data-ocu="desa"' + (brut ? '' : ' disabled') + '>' + (brut ? 'Desa (' + brut + ')' : 'Desat') + '</button>' : '') +
      '<p class="gs-ajuda gs-cal__ajuda">' + (tab === 'docents' ? 'Objectiu: <b>' + R.objectiu.lectives + '</b> lectives (amb alumnat + reduccions) + <b>' + R.objectiu.guardies + '</b> de guàrdia (guàrdies + reduccions de guàrdia) = <b>' + R.objectiu.total + '</b> hores fixes, en proporció a la jornada (½ = 11, ⅔ ≈ 14,67). ' +
        'Un clic al títol d’una secció la plega o la desplega. Les reduccions en <i>cursiva</i> són automàtiques (tutoria de 1r d’ESO i reunió de nivell, amb la casella buida): s’hi pot escriure un altre valor, i 0 per treure-la.' : 'Llista de càrrecs que es poden assignar a cada docent (pestanya Docents › columna Càrrecs). Els de tutoria (Tutor/a de cada grup-classe) i de cap de departament/àmbit hi surten sols.') + '</p>';
    var t = $('gsTaula'); t.className = 'gs-ocu';
    try { t.innerHTML = tab === 'docents' ? htmlOcupacio(ed) : htmlCarrecsOcu(); } catch (er) { if (window.console) console.error(er); t.innerHTML = '<p class="prog-avis">No s’ha pogut mostrar: ' + esc(er && er.message || er) + '</p>'; }
    ajustaAlcada();
  }
  // PAS 58 · Quatre seccions plegables: un clic al títol la plega (només en queda la suma) o la desplega
  var SECC_OCU = [['alu', 'Lectives (amb alumnat)'], ['red', 'Reduccions lectives'], ['g', 'Guàrdies'], ['rg', 'Reduccions de guàrdia']];
  function plegaOcu() { if (!S.ocu.plega) S.ocu.plega = guarda.llegeix('ocupacio_plega') || { rg: true }; return S.ocu.plega; }
  function colsOcu() {
    var R = S.ocu.r;
    return { alu: R.lectives.map(function (c) { return { k: c.clau, t: COL_OCU_ALU[c.clau] || c.nom, n: c.nom }; }),
      red: R.reduccions.map(function (c) { return { k: c.clau, t: COL_OCU_RED[c.clau] || c.nom, n: c.nom, auto: true }; }),
      g: ['o', 'b', 'p'].map(function (k) { return { k: 'guardies_' + k, t: R.tipus_guardia[k].slice(0, 4) + '.', n: 'Guàrdies ' + R.tipus_guardia[k].toLowerCase() }; }),
      rg: R.reduccions_guardia.map(function (c) { return { k: c.clau, t: c.nom.replace(/^R\. /, ''), n: c.nom + ' (' + c.codi + ')' }; }) };
  }
  function htmlOcupacio(ed) {
    var P = plegaOcu(), C = colsOcu(), ll = docentsOcu();
    var grup = function (id, nom) { var n = P[id] ? 1 : C[id].length + 1;
      return '<th colspan="' + n + '" class="gs-ocu__sec' + (P[id] ? ' is-plegada' : '') + '"><button type="button" data-ocu="plega" data-sec="' + id + '" aria-expanded="' + !P[id] + '" title="' + (P[id] ? 'Desplega' : 'Plega') + ' la secció">' + (P[id] ? '▸ ' : '▾ ') + esc(nom) + '</button></th>'; };
    var sub = function (id) { return (P[id] ? '' : C[id].map(function (c) { return '<th title="' + esc(c.n) + '">' + esc(c.t) + '</th>'; }).join('')) + '<th>Σ</th>'; };
    var cap = '<thead><tr class="gs-ocu__grups"><th rowspan="2" class="gs-ocu__nom">Docent</th><th rowspan="2">Jorn.</th><th rowspan="2">Càrrecs</th>' + grup('alu', SECC_OCU[0][1]) + grup('red', SECC_OCU[1][1]) +
      '<th rowspan="2" class="gs-ocu__t">Total lectives</th>' + grup('g', SECC_OCU[2][1]) + grup('rg', SECC_OCU[3][1]) + '<th rowspan="2" class="gs-ocu__t">Total guàrdies</th><th rowspan="2" class="gs-ocu__t">Total</th><th rowspan="2">Estat</th></tr><tr>' +
      sub('alu') + sub('red') + sub('g') + sub('rg') + '</tr></thead>';
    var files = ll.map(function (d) { return filaOcu(d, ed); }).join('');
    return '<div class="gs-ocu__cont"><table class="gs-ocu__taula">' + cap + '<tbody>' + (files || '<tr><td colspan="40" class="gs-ajuda">Cap docent amb aquests filtres.</td></tr>') + '</tbody></table></div>';
  }
  function filaOcu(d, ed) {
    var P = plegaOcu(), C = colsOcu(), dis = ed ? '' : ' disabled', o = calculOcu(d), c = String(valOcu(d, 'carrec') || '');
    var inp = function (col) { var k = col.k, v = valOcu(d, k), buit = String(v == null ? '' : v).trim() === '', b = S.ocu.brut[d.id] && Object.prototype.hasOwnProperty.call(S.ocu.brut[d.id], k), auto = col.auto && d.auto[k];
      if (/^guardies_/.test(k) && Number(v) === 0) buit = true;
      return '<td class="gs-ocu__n' + (b ? ' is-brut' : '') + '"><input type="text" inputmode="decimal" data-k="' + k + '" value="' + esc(buit ? '' : v) + '"' + (auto && buit ? ' placeholder="' + auto + '" class="is-auto" title="Automàtica: ' + esc(AUTO_OCU[k] || '') + '"' : '') + dis + ' aria-label="' + esc(col.n) + '"></td>'; };
    var seccio = function (id, suma) { return (P[id] ? '' : C[id].map(inp).join('')) + '<td class="gs-ocu__s">' + (id === 'rg' && P[id] ? '<button type="button" class="gs-enllac" data-ocu="rg" title="Reduccions de guàrdia, una per una">' + r2(suma) + '</button>' : r2(suma)) + '</td>'; };
    return '<tr data-id="' + esc(d.id) + '" class="is-' + o.estat + '"><th class="gs-ocu__nom" scope="row">' + esc(d.nom) + '<small>' + esc(d.especialitat) + '</small></th><td class="gs-cen">' + esc(d.jornada) + '</td>' +
      '<td class="gs-ocu__c"><button type="button" class="gs-ocu__cb" data-ocu="carrec" title="' + esc(c || 'Sense càrrec') + '"' + (ed ? '' : ' disabled') + '>' + (c ? esc(c) : '<span class="gs-ajuda">—</span>') + '</button></td>' +
      seccio('alu', o.alu) + seccio('red', o.red) + '<td class="gs-ocu__t">' + o.lect + '<small>/' + o.objL + '</small></td>' +
      seccio('g', o.g) + seccio('rg', o.rg) + '<td class="gs-ocu__t">' + o.guard + '<small>/' + o.objG + '</small></td><td class="gs-ocu__t">' + o.total + '<small>/' + o.objT + '</small></td>' +
      '<td class="gs-ocu__e"><span class="gs-ocu__sem gs-ocu__sem--' + o.estat + '" title="' + esc(o.text) + '"></span><span class="gs-ocu__et">' + esc(o.estat === 'ok' ? 'Quadra' : o.estat === 'reparteix' ? 'Repartiment' : o.total < o.objT ? '−' + r2(o.objT - o.total) : '+' + r2(o.total - o.objT)) + '</span></td></tr>';
  }
  function htmlCarrecsOcu() {
    var R = S.ocu.r, adm = R.nivell === 'admin';
    return '<section class="gs-hor__sec"><h3 class="gs-amon__tit">Càrrecs' + (R.carrecs_per_defecte ? ' (llista per defecte)' : '') + '</h3>' +
      '<p class="gs-ajuda">Un per línia. ' + (adm ? 'Els canvis no toquen els càrrecs ja assignats.' : 'Només l’administració del mòdul pot canviar la llista.') + '</p>' +
      '<textarea id="ocuCarrecs" rows="18" style="width:100%;max-width:640px"' + (adm ? '' : ' disabled') + '>' + esc(R.carrecs.join('\n')) + '</textarea>' +
      (adm ? '<p><button type="button" class="prog-btn" data-ocu="desa-carrecs">Desa la llista</button></p>' : '') +
      '<h3 class="gs-amon__tit">Automàtics</h3><p class="gs-ajuda">' + R.carrecs_auto.map(esc).join(' · ') + '</p></section>';
  }
  function canviOcu(id, k, v) {
    var d = S.ocu.r.docents.filter(function (x) { return x.id === id; })[0]; if (!d) return;
    var orig = k === 'carrec' ? d.carrec : /^guardies_/.test(k) ? String(d.guardies[k.slice(-1)] || 0) : d.valors[k];
    var b = S.ocu.brut[id] = S.ocu.brut[id] || {};
    if (String(v) === String(orig == null ? '' : orig)) delete b[k]; else b[k] = v;
    if (!Object.keys(b).length) delete S.ocu.brut[id];
    S.brut = Object.keys(S.ocu.brut).length > 0;
  }
  function desaOcupacio() {
    var canvis = Object.keys(S.ocu.brut).map(function (id) { return { id: id, valors: S.ocu.brut[id] }; });
    if (!canvis.length) return;
    return api('ocupacio_desa', { canvis: canvis }, 'Desant l’ocupació…').then(function (r) {
      if (!r.ok) return toast(text(r.error) + (r.camp ? ' (' + r.camp + ')' : ''), true);
      S.ocu.r.docents = r.docents; S.ocu.brut = {}; S.brut = false;
      toast('Desat: ' + r.desats + ' docents.' + (r.herencia ? ' Els substituts han heretat ' + r.herencia + ' dades.' : '') + (r.transferides ? ' Matèries transferides al substitut: ' + r.transferides + '.' : '')); pintaOcupacio();
    });
  }
  function dialegCarrecOcu(d) {
    var R = S.ocu.r, actuals = String(valOcu(d, 'carrec') || '').split(/\s*·\s*/).filter(Boolean), llista = R.carrecs.concat(R.carrecs_auto);
    var altres = actuals.filter(function (c) { return llista.indexOf(c) < 0; });
    var html = '<p><b>' + esc(d.nom) + '</b></p><div class="gs-ocu__llc">' + R.carrecs.map(function (c) { return '<label class="gs-check"><input type="checkbox" class="ocuCar" value="' + esc(c) + '"' + (actuals.indexOf(c) >= 0 ? ' checked' : '') + '> ' + esc(c) + '</label>'; }).join('') + '</div>' +
      '<details' + (actuals.some(function (c) { return R.carrecs_auto.indexOf(c) >= 0; }) ? ' open' : '') + '><summary>Tutoria i caps de departament/àmbit</summary><div class="gs-ocu__llc">' + R.carrecs_auto.map(function (c) { return '<label class="gs-check"><input type="checkbox" class="ocuCar" value="' + esc(c) + '"' + (actuals.indexOf(c) >= 0 ? ' checked' : '') + '> ' + esc(c) + '</label>'; }).join('') + '</div></details>' +
      '<p><label>Altres (separats per «·»)<br><input type="text" id="ocuCarAltres" value="' + esc(altres.join(' · ')) + '" style="width:100%"></label></p>';
    var val = null;
    pregunta('Càrrecs', html, [{ t: 'D’acord', valor: 1, abans: function () { val = [].map.call(document.querySelectorAll('.ocuCar:checked'), function (x) { return x.value; }).concat($('ocuCarAltres').value.split('·').map(function (x) { return x.trim(); }).filter(Boolean)).join(' · '); } }, { t: 'Cancel·la', tipus: 'ghost', valor: 0 }], false)
      .then(function (v) { if (v && val !== null) { canviOcu(d.id, 'carrec', val); pintaOcupacio(); } });
  }
  function dialegRgOcu(d) {
    var R = S.ocu.r, ed = edOcu(), vals = {};
    var html = '<p><b>' + esc(d.nom) + '</b> · reduccions de guàrdia (hores per setmana)</p><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><tbody>' + R.reduccions_guardia.map(function (c) {
      return '<tr><td>' + esc(c.nom) + ' <small class="gs-ajuda">(' + esc(c.codi) + ')</small></td><td><input type="text" inputmode="decimal" class="ocuRg" data-k="' + c.clau + '" value="' + esc(valOcu(d, c.clau) || '') + '" size="4"' + (ed ? '' : ' disabled') + '></td></tr>'; }).join('') + '</tbody></table>';
    pregunta('Reduccions de guàrdia', html, ed ? [{ t: 'D’acord', valor: 1, abans: function () { [].forEach.call(document.querySelectorAll('.ocuRg'), function (x) { vals[x.dataset.k] = x.value.trim(); }); } }, { t: 'Cancel·la', tipus: 'ghost', valor: 0 }] : [{ t: 'Tanca', valor: 0 }], false)
      .then(function (v) { if (!v) return; Object.keys(vals).forEach(function (k) { canviOcu(d.id, k, vals[k]); }); pintaOcupacio(); });
  }
  function filesExportOcu() {
    var R = S.ocu.r;
    return docentsOcu().map(function (d) { var o = calculOcu(d);
      return { d: d, o: o, fila: [d.nom, d.especialitat, d.jornada, String(valOcu(d, 'carrec') || '')].concat(R.lectives.map(function (c) { return nOcu(valOcu(d, c.clau)); }), [r2(o.alu)],
        R.reduccions.map(function (c) { var v = valOcu(d, c.clau); return String(v == null ? '' : v).trim() === '' ? (d.auto[c.clau] || 0) : nOcu(v); }), [r2(o.red), o.lect],
        ['o', 'b', 'p'].map(function (k) { return nOcu(valOcu(d, 'guardies_' + k)); }), R.reduccions_guardia.map(function (c) { return nOcu(valOcu(d, c.clau)); }), [r2(o.rg), o.guard, o.total, o.objT, o.text]) }; });
  }
  function xlsxOcupacio() {
    var R = S.ocu.r, cap = ['Docent', 'Especialitat', 'Jornada', 'Càrrecs'].concat(R.lectives.map(function (c) { return c.nom; }), ['Σ lectives (amb alumnat)'], R.reduccions.map(function (c) { return c.nom; }), ['Σ reduccions lectives', 'Total lectives'],
      ['o', 'b', 'p'].map(function (k) { return 'Guàrdies ' + R.tipus_guardia[k].toLowerCase(); }), R.reduccions_guardia.map(function (c) { return c.nom + ' (' + c.codi + ')'; }), ['Σ red. guàrdia', 'Total guàrdies', 'Total', 'Objectiu', 'Estat']);
    carregaScript(LIBS.xlsx).then(function () {
      var wb = XLSX.utils.book_new(), sh = XLSX.utils.aoa_to_sheet([cap].concat(filesExportOcu().map(function (x) { return x.fila; })));
      sh['!cols'] = cap.map(function (c, i) { return { wch: i === 0 ? 30 : i === 3 ? 34 : i === cap.length - 1 ? 50 : 10 }; });
      XLSX.utils.book_append_sheet(wb, sh, 'Ocupació'); XLSX.writeFile(wb, 'ocupacio-' + new Date().toISOString().slice(0, 10) + '.xlsx');
    });
  }
  function pdfOcupacio() {
    var files = filesExportOcu().map(function (x) { var o = x.o; return [x.d.nom, x.d.jornada, String(valOcu(x.d, 'carrec') || ''), r2(o.alu), r2(o.red), o.lect + ' / ' + o.objL, r2(o.g), r2(o.rg), o.guard + ' / ' + o.objG, o.total + ' / ' + o.objT, o.text]; });
    if (!files.length) return toast('No hi ha cap docent per posar al PDF.', true);
    var filtre = [S.ocu.esp, S.ocu.nomesMal ? 'només els que no quadren' : '', S.ocu.q ? '«' + S.ocu.q + '»' : ''].filter(Boolean).join(' · ');
    return pdfInforme('Ocupació del professorat', 'Objectiu 18 + 4 = 22 h (en proporció a la jornada)' + (filtre ? ' · ' + filtre : ''), ['Docent', 'Jornada', 'Càrrecs', 'Lectives (amb alumnat)', 'Red. lectives', 'Total lectives', 'Guàrdies', 'Red. guàrdia', 'Total guàrdies', 'Total', 'Estat'], files, 'ocupacio',
      { columnes: { 0: { cellWidth: 44, halign: 'left' }, 2: { cellWidth: 46, halign: 'left' }, 10: { cellWidth: 52, halign: 'left' } }, estils: { lineColor: [70, 72, 90], lineWidth: 0.25 } });
  }
  // PAS 59 · Llistats en PDF: docents amb càrrec i tutor/a de cada grup-classe
  function pdfCarrecsOcu() {
    var files = S.ocu.r.docents.map(function (d) { return [d.nom, d.especialitat, String(valOcu(d, 'carrec') || '').split(/\s*·\s*/).filter(Boolean)]; })
      .filter(function (x) { return x[2].length; }).map(function (x) { return [x[0], x[1], x[2].join('\n')]; });
    if (!files.length) return toast('Cap docent no té càrrec.', true);
    return pdfInforme('Càrrecs del professorat', files.length + ' docents amb càrrec', ['Docent', 'Especialitat', 'Càrrecs'], files, 'carrecs', { vertical: true, esquerra: true, columnes: { 0: { cellWidth: 62 }, 1: { cellWidth: 36 } }, estils: { lineColor: [70, 72, 90], lineWidth: 0.25 } });
  }
  function pdfTutorsOcu() {
    var ordre = ['1r ESO', '2n ESO', '3r ESO', '4t ESO', '1r BAT', '2n BAT'], per = {};
    S.ocu.r.docents.forEach(function (d) {
      var gs = (d.tutor || []).concat(String(valOcu(d, 'carrec') || '').split(/\s*·\s*/).filter(function (c) { return /^Tutor\/a /.test(c); }).map(function (c) { return c.slice(8); }));
      gs.forEach(function (g) { (per[g] = per[g] || []); if (per[g].indexOf(d) < 0) per[g].push(d); });
    });
    var grups = Object.keys(per).sort(function (a, b) { var na = ordre.filter(function (n) { return a.indexOf(n) === 0; })[0] || 'z', nb = ordre.filter(function (n) { return b.indexOf(n) === 0; })[0] || 'z';
      return (ordre.indexOf(na) - ordre.indexOf(nb)) || a.localeCompare(b, 'ca', { numeric: true }); });
    if (!grups.length) return toast('No hi ha tutors: carregueu-los des del Currículum (matèria Tutoria) o poseu el càrrec «Tutor/a …».', true);
    var files = [], niv = '';
    grups.forEach(function (g) { var n = ordre.filter(function (x) { return g.indexOf(x) === 0; })[0] || 'Altres'; if (n !== niv) { niv = n; files.push({ s: n }); }
      files.push([g, per[g].map(function (d) { return d.nom; }).join('\n'), per[g].map(function (d) { return d.especialitat; }).join('\n')]); });
    return pdfInforme('Tutors i tutores', grups.length + ' grups-classe', ['Grup-classe', 'Tutor/a', 'Especialitat'], files, 'tutors', { vertical: true, esquerra: true, columnes: { 0: { cellWidth: 34 } }, estils: { lineColor: [70, 72, 90], lineWidth: 0.25 } });
  }
  function lligaOcupacio() {
    if (lligaOcupacio.fet) return; lligaOcupacio.fet = true;
    var actiu = function () { return S.modul && S.modul.id === 'ocupacio' && S.ocu && S.ocu.r; };
    $('gsEines').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ocu]'); if (!b || !actiu()) return;
      var a = b.dataset.ocu;
      if (a === 'tab') { if (S.brut && b.dataset.v !== 'docents') return toast('Primer deseu o descarteu els canvis.', true); S.ocu.tab = b.dataset.v; pintaOcupacio(); }
      else if (a === 'desa') desaOcupacio(); else if (a === 'pdf') pdfOcupacio(); else if (a === 'xlsx') xlsxOcupacio();
      else if (a === 'pdf-carrecs') pdfCarrecsOcu(); else if (a === 'pdf-tutors') pdfTutorsOcu();
    });
    $('gsEines').addEventListener('change', function (e) {
      var x = e.target, a = x.dataset && x.dataset.ocu; if (!a || !actiu()) return;
      if (a === 'esp') S.ocu.esp = x.value; else if (a === 'mal') S.ocu.nomesMal = x.checked; else return;
      pintaOcupacio();
    });
    $('gsEines').addEventListener('input', function (e) {
      if (!actiu() || e.target.dataset.ocu !== 'cerca') return;
      S.ocu.q = e.target.value; clearTimeout(lligaOcupacio.t);
      lligaOcupacio.t = setTimeout(function () { $('gsTaula').innerHTML = htmlOcupacio(edOcu()); }, 200);
    });
    $('gsTaula').addEventListener('change', function (e) {
      if (!actiu()) return;
      var x = e.target, tr = x.closest('tr[data-id]'); if (!tr || !x.dataset.k) return;
      var v = x.value.replace(',', '.').trim();
      if (v && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 40)) { toast('Ha de ser un nombre entre 0 i 40.', true); x.focus(); return; }
      canviOcu(tr.dataset.id, x.dataset.k, v);
      // Només es torna a pintar la fila (el focus i el desplaçament es mantenen) i el botó Desa
      // (després que el focus hagi passat a la casella següent, per tornar-l'hi)
      setTimeout(function () {
        var d = S.ocu.r.docents.filter(function (y) { return y.id === tr.dataset.id; })[0], act = document.activeElement, ka = act && tr.contains(act) && act.dataset.k;
        if (!tr.parentNode) return;
        var tmp = document.createElement('tbody'); tmp.innerHTML = filaOcu(d, edOcu()); var nou = tmp.firstChild; tr.parentNode.replaceChild(nou, tr);
        if (ka) { var f = nou.querySelector('input[data-k="' + ka + '"]'); if (f) { f.focus(); try { f.select(); } catch (er) { /* res */ } } }
      }, 0);
      var bd = document.querySelector('[data-ocu="desa"]'), n = Object.keys(S.ocu.brut).length; if (bd) { bd.disabled = !n; bd.textContent = n ? 'Desa (' + n + ')' : 'Desat'; }
    });
    $('gsTaula').addEventListener('click', function (e) {
      if (!actiu()) return;
      var b = e.target.closest('[data-ocu]'); if (!b) return;
      if (b.dataset.ocu === 'plega') { var P = plegaOcu(); P[b.dataset.sec] = !P[b.dataset.sec]; guarda.desa('ocupacio_plega', P); var t = $('gsTaula'), sx = t.scrollLeft, sy = t.scrollTop; t.innerHTML = htmlOcupacio(edOcu()); t.scrollTop = sy; t.scrollLeft = sx; return; }
      if (b.dataset.ocu === 'desa-carrecs') {
        var l = $('ocuCarrecs').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        return api('ocupacio_carrecs_desa', { carrecs: l }, 'Desant…').then(function (r) { if (!r.ok) return toast(r.errors ? r.errors.join(' ') : text(r.error), true); S.ocu.r.carrecs = r.carrecs; S.ocu.r.carrecs_per_defecte = false; toast('Llista de càrrecs desada.'); pintaOcupacio(); });
      }
      var tr = b.closest('tr[data-id]'), d = tr && S.ocu.r.docents.filter(function (x) { return x.id === tr.dataset.id; })[0]; if (!d) return;
      if (b.dataset.ocu === 'carrec') dialegCarrecOcu(d); else if (b.dataset.ocu === 'rg') dialegRgOcu(d);
    });
  }
  function carregaHoraris() {
    api('horaris_dades', {}, 'Carregant el planificador…').then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      aplicaHoraris(r);
    });
  }
  // PAS 72: tornar al planificador amb les dades fresques no les torna a demanar (es descarten els canvis sense desar)
  function reobreHoraris() { aplicaHoraris(S.hor); }
  function aplicaHoraris(r) {
    (function () {
      // PAS 53: si l'Apps Script desplegat és d'una versió anterior, ho diem (abans la pantalla es quedava buida)
      if (!(r.esquema >= 70)) { $('gsAvis').innerHTML = 'L’Apps Script desplegat és d’una versió anterior (ESQUEMA ' + esc(r.esquema || '≤ 52') + '; cal el 70 o posterior: codocència en una fila, regles i matrícula). Enganxeu el Code.gs nou, executeu «configura» i feu una <strong>nova implementació</strong>.'; $('gsAvis').hidden = false; return; }
      var copia = function (x, def) { return JSON.parse(JSON.stringify(x === undefined || x === null ? def : x)); };
      S.hor = r; S.marc = copia(r.marc, { dies: [], franges: [] }); S.aules = copia(r.aules, { aules: [], conjunts: [] }); S.regles = copia(r.regles, { blocs_parallels: [], toves: { pesos: {} } });
      // PAS 50: sessions lectives i professorat (es desen només les files canviades)
      S.ses = {}; r.sessions.forEach(function (x) { S.ses[x.id] = JSON.parse(JSON.stringify(x)); }); S.sesBrut = {};
      S.hprof = {}; r.professorat.forEach(function (x) { S.hprof[x.id] = JSON.parse(JSON.stringify(x)); }); S.hprofBrut = {};
      S.subg = copia(r.subgrups, { classes: {}, subgrups: [], blocs: [] }); if (!S.subg.classes || Array.isArray(S.subg.classes)) S.subg.classes = {}; S.subg.subgrups = S.subg.subgrups || []; S.subg.blocs = S.subg.blocs || []; S.subg.dies_diferents = S.subg.dies_diferents || [];   // PAS 54 · PAS 69
      S.guard = copia(r.guardies, { demanda: {} }); S.guard.demanda = S.guard.demanda || {};   // PAS 55
      S.reun = copia((r.reunions || {}).reunions, []);   // PAS 57
      S.horNiv = S.horNiv || r.nivells[0]; S.horEsp = S.horEsp || '';
      S.horTab = S.horTab || 'marc'; S.horBrut = {}; S.brut = false; S.d = { files: [], camps: [], nivell: S.modul.nivell };
      pintaHoraris();
    })();
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
  function errorsRegles() { return []; }   // PAS 54: els blocs paral·lels passen a ser blocs simultanis (Sessions lectives)
  function pintaHoraris() {
    var R = S.hor, ed = R.pot_desar, tab = S.horTab, brut = Object.keys(S.horBrut).some(function (k) { return S.horBrut[k]; });
    var pes = { marc: R.per_defecte, aules: R.aules_per_defecte, regles: R.regles_per_defecte, subgrups: R.regles_per_defecte }[tab] || false;
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist">' + [['marc', 'Marc horari'], ['aules', 'Aules'], ['subgrups', 'Subgrups'], ['sessions', 'Sessions lectives'], ['professorat', 'Professorat'], ['guardies', 'Guàrdies'], ['reunions', 'Reunions'], ['regles', 'Regles']].map(function (t) { return '<button type="button" role="tab" data-accio="hor-tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + (S.horBrut[t[0]] || (t[0] === 'subgrups' && S.horBrut.blocs) ? ' *' : '') + '</button>'; }).join('') + '</div>' +
      '<span class="gs-espai"></span>' + (tab === 'professorat' && ed ? '<label class="prog-btn prog-btn--ghost gs-hor__imp" title="Claus de Clickedu del professorat a partir de la llista del professorat de Peñalara (CSV)">Claus de Clickedu (CSV)<input type="file" id="gsProfImp" accept=".csv,text/csv" hidden></label>' : '') + (tab === 'subgrups' && ed ? '<label class="prog-btn prog-btn--ghost gs-hor__imp" title="Grups-classe i subgrups amb les claus: llistes de grups o de subgrups de Peñalara (CSV) o exportació de Clickedu (XML)">Grups de Clickedu/Peñalara (CSV/XML)<input type="file" id="gsGrupsImp" accept=".xml,.csv,text/xml,application/xml,text/csv" hidden></label>' : '') + (tab === 'aules' && ed ? '<label class="prog-btn prog-btn--ghost gs-hor__imp" title="Assigna les claus de Clickedu a partir de l’exportació de Clickedu (XML) o de la llista d’aules de Peñalara (CSV)">Claus de Clickedu (XML/CSV)<input type="file" id="gsAulesImp" accept=".xml,.csv,text/xml,application/xml,text/csv" hidden></label>' : '') + (tab === 'marc' ? '<label class="prog-btn prog-btn--ghost gs-hor__imp" title="Carrega un marc_horari.json">Importa JSON<input type="file" id="gsHorImp" accept=".json,application/json" hidden></label><button type="button" class="prog-btn prog-btn--ghost" data-accio="hor-json" title="Descarrega marc_horari.json">marc_horari.json</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost gs-hor__act" data-accio="hor-actualitza" title="Torna a llegir totes les dades del planificador (Currículum, assignacions, professorat, ocupació…). Si hi ha canvis sense desar, abans ho pregunta.">⟳ Actualitza les dades</button>' +
      (ed ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="hor-exporta" title="Descarrega totes les dades per al MOTOR (horaris-dades.json)">Exporta per al motor</button><button type="button" class="prog-btn" data-accio="hor-desa">' + (brut ? 'Desa *' : 'Desa') + '</button>' : '') +
      '<p class="gs-ajuda" style="flex:1 1 100%;margin:4px 0 0"><strong>Planificador</strong> del generador d’horaris (planificador → motor → editor → exportador). ' +
      { reunions: '<strong>Reunions fixes</strong> de nivell (tutors/es i coordinació de nivell): cada reunió es fa a la mateixa franja cada setmana, amb tots els docents lliures. La franja es pot deixar perquè la triï el motor.', marc: 'Dies lectius i franges horàries (amb els esbarjos). Totes les franges són lectives per a tots els nivells.', aules: 'Les aules del centre (amb el tipus) i els <strong>conjunts d’aules alternatives</strong> que després es poden posar a cada sessió.', sessions: 'Cada matèria i grup en <strong>parts</strong> (qui la fa: grup-classe o subgrup), amb la <strong>distribució</strong> (111 = tres sessions d’1 h; 21 = una de 2 h i una d’1 h), l’<strong>aula preferent</strong>, les <strong>alternatives</strong> i la <strong>graella</strong>; i els <strong>blocs simultanis</strong> (sessions a la mateixa hora en aules diferents).', professorat: 'Una graella per docent amb les <strong>posicions fixes</strong> (ha de fer classe aquella hora) i <strong>prohibides</strong> (no hi pot fer classe). Per defecte, totes són lliures.', subgrups: 'Els <strong>grups-classe</strong> i els <strong>subgrups</strong> (tot conjunt d’alumnes del nivell que no és un grup-classe: diversitat, hores B, optatives…) amb el nom i la clau de Clickedu.', guardies: '<strong>Guàrdies</strong>: quantes en calen a cada franja (ordinàries a les lectives; biblioteca i pati a l’esbarjo), quantes en fa cada docent i si estan cobertes.', regles: '<strong>Regles</strong>: preferències del motor, amb un pes de 1 (poc) a 5 (molt), i les regles obligatòries.' }[tab] +
      (pes ? ' <strong>Encara no s’ha desat: és una proposta per revisar.</strong>' : '') + '</p>';
    var html;
    // PAS 53: un error en pintar una pestanya es mostra (abans la pantalla quedava buida)
    try { html = tab === 'marc' ? htmlMarc(ed) : tab === 'aules' ? htmlAules(ed) : tab === 'subgrups' ? htmlSubgrups(ed) : tab === 'sessions' ? htmlSessions(ed) : tab === 'professorat' ? htmlProfessoratH(ed) : tab === 'guardies' ? htmlGuardies(ed) : tab === 'reunions' ? htmlReunions(ed) : htmlRegles(ed); }
    catch (er) { if (window.console) console.error(er); html = '<p class="prog-avis">No s’ha pogut mostrar la pestanya: ' + esc(er && er.message || er) + '. Proveu una altra pestanya o torneu a carregar la pàgina; si es repeteix, envieu aquest missatge.</p>'; }
    var t0 = $('gsTaula'); t0.className = 'gs-des gs-hor'; t0.innerHTML = '<div id="gsHorCos">' + html + '<p class="prog-avis" id="gsHorErr" hidden></p></div>';
    ajustaAlcada();
    var e = tab === 'marc' ? errorsMarc() : tab === 'aules' ? errorsAules() : tab === 'subgrups' ? errorsSubgrups() : tab === 'sessions' ? errorsSessions() : tab === 'professorat' || tab === 'reunions' || tab === 'guardies' ? [] : errorsRegles();
    $('gsHorErr').hidden = !e.length; $('gsHorErr').innerHTML = e.map(esc).join('<br>');
    lligaHoraris(ed);
  }
  // PAS 57 · Reunions fixes de nivell
  function errorsReunions() {
    var e = [], vist = {};
    (S.reun || []).forEach(function (r, i) { var n = r.nom || 'Reunió ' + (i + 1); if (!String(r.nom || '').trim()) e.push('Reunió ' + (i + 1) + ': cal un nom.'); if ((r.docents || []).length < 2) e.push(n + ': cal almenys dos docents.');
      if (vist[r.nom]) e.push(n + ': nom repetit.'); vist[r.nom] = 1; });
    return e;
  }
  function htmlReunions(ed) {
    var dis = ed ? '' : ' disabled', noms = {}; S.hor.professorat.forEach(function (p) { noms[p.id] = p.nom; });
    var pos = []; S.marc.franges.filter(function (f) { return !f.esbarjo; }).forEach(function (f) { S.marc.dies.forEach(function (d) { pos.push(d + ' ' + f.id); }); });
    var opsProf = S.hor.professorat.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nom) + '</option>'; }).join('');
    return '<section class="gs-hor__sec">' + (ed ? '<p><button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-a="proposa-reunions" title="Una reunió per nivell amb els tutors/es (Currículum › Tutoria) i la coordinació de nivell (càrrec a Ocupació)">Proposa a partir del Currículum i dels càrrecs</button> <button type="button" class="gs-enllac" data-a="nova-reunio">+ reunió</button></p>' : '') +
      ((S.reun || []).length ? '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-hor__reun"><thead><tr><th>Nom</th><th>Hores</th><th>Franja</th><th>Docents</th><th></th></tr></thead><tbody>' + S.reun.map(function (r, i) {
        return '<tr data-re="' + i + '"><td><input type="text" data-k="nom" value="' + esc(r.nom) + '" size="26"' + dis + '></td><td><input type="number" min="1" max="3" data-k="hores" value="' + esc(r.hores || 1) + '" style="width:4em"' + dis + '></td>' +
          '<td><select data-k="franja"' + dis + '><option value="">La tria el motor</option>' + pos.map(function (p) { return '<option' + (p === r.franja ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></td>' +
          '<td>' + (r.docents || []).map(function (d) { return '<span class="gs-hor__chip">' + esc(noms[d] || d) + (ed ? ' <button type="button" class="gs-enllac" data-a="treu-docent-re" data-d="' + esc(d) + '" aria-label="Treu">×</button>' : '') + '</span>'; }).join(' ') +
          (ed ? ' <select data-k="afegeix" aria-label="Afegeix un docent"><option value="">+ docent…</option>' + opsProf + '</select>' : '') + ' <small class="gs-ajuda">(' + (r.docents || []).length + ')</small></td>' +
          '<td>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu-reunio" title="Treu" aria-label="Treu la reunió">🗑</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="gs-ajuda">Encara no hi ha cap reunió.' + (ed ? ' «Proposa» en crea una per nivell.' : '') + '</p>') + '</section>';
  }
  function canviReunions(x, canvia) {
    var tr = x.closest('tr[data-re]'); if (!tr) return false;
    var r = S.reun[Number(tr.dataset.re)], k = x.dataset.k;
    if (k === 'afegeix') { if (x.value && r.docents.indexOf(x.value) < 0) r.docents.push(x.value); canvia(true); return true; }
    if (k === 'hores') r.hores = Math.max(1, Math.min(3, Number(x.value) || 1)); else if (k) r[k] = x.value;
    canvia(k === 'franja' ? false : false); return true;
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
    return '<section class="gs-hor__sec"><h3 class="gs-amon__tit">1 · Aules del centre</h3>' + (A.aules.length ? '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-hor__au"><thead><tr>' + [['id', 'Codi'], ['nom', 'Nom / ubicació'], ['tipus', 'Tipus'], ['capacitat', 'Capacitat'], ['nom_clickedu', 'Clickedu'], ['clau_clickedu', 'Clau']].map(function (c) { var o = S.auOrdre || {}; return '<th><button type="button" class="gs-hor__ord" data-a="ordena-au" data-k="' + c[0] + '" title="Ordena per ' + c[1].toLowerCase() + '">' + c[1] + (o.k === c[0] ? (o.dir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>'; }).join('') + '<th></th></tr></thead><tbody>' +
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
  // PAS 53 · Llista d'aules de Peñalara (CSV amb «;»): Aulas; Abreviatura; Descripción; Clave externa; …; Está en conjuntos de aulas
  function llegeixCsvAules(buf) {
    var txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('windows-1252').decode(buf); }
    var ll = txt.split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (l) { return l.split(';'); });
    if (!ll.length) return null;
    var cap = ll[0].map(function (x) { return normAula(x); }), c = function (re) { for (var i = 0; i < cap.length; i++) if (re.test(cap[i])) return i; return -1; };
    var iN = c(/^AULAS?$/), iD = c(/^DESCRIPCI/), iK = c(/^CLAVEEXTERNA$/), iC = c(/CONJUNTOS/);
    if (iN < 0 || iK < 0) return null;
    var conj = {}, sense = [];
    var aules = ll.slice(1).map(function (r) { return { nom: (r[iN] || '').trim(), clau: (r[iK] || '').trim(), desc: iD >= 0 ? (r[iD] || '').trim() : '', cj: iC >= 0 ? (r[iC] || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [] }; })
      .filter(function (a) { if (a.nom && !a.clau) sense.push(a.nom); return a.nom && a.clau; });
    aules.forEach(function (a) { a.cj.forEach(function (k) { (conj[k] = conj[k] || []).push(a.nom); }); });
    return { aules: aules, conjunts: Object.keys(conj).map(function (k) { return { nom: k, aules: conj[k] }; }), sense: sense };
  }
  function importaClausAules(G) {
    var A = S.aules, usats = {}; A.aules.forEach(function (a) { usats[a.id] = 1; });
    var troba = function (c) { return A.aules.filter(function (a) { return (a.clau_clickedu && a.clau_clickedu === c.clau) || [a.nom_clickedu, a.id, a.nom].some(function (x) { return x && normAula(x) === normAula(c.nom); }) || normAula(a.id) === 'A' + normAula(c.nom); })[0]; };
    var nouCodi = function (c) { var b = normAula(c.nom); if (/^\d+$/.test(b)) b = 'A' + b; b = b.slice(0, 16) || 'AULA'; var x = b, n = 2; while (usats[x]) x = b.slice(0, 14) + (n++); usats[x] = 1; return x; };
    var files = G.aules.map(function (c) { var a = troba(c); return { c: c, a: a, id: a ? a.id : nouCodi(c), tipus: a ? a.tipus : (tipusAula(c.nom) !== 'altres' ? tipusAula(c.nom) : tipusAula(c.desc)) }; });
    var senseCk = A.aules.filter(function (a) { return !files.some(function (f) { return f.a === a; }); });
    var html = '<p>' + G.aules.length + ' aules al fitxer: <b>' + files.filter(function (f) { return f.a; }).length + '</b> ja són a GESTIO i <b>' + files.filter(function (f) { return !f.a; }).length + '</b> són noves. Res no es desa fins que premeu <strong>Desa</strong>.</p>' +
      '<div class="gs-comprova"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Clickedu</th><th class="gs-cen">Clau</th><th>A GESTIO</th><th>Tipus</th></tr></thead><tbody>' +
      files.map(function (f) { return '<tr><td>' + esc(f.c.nom) + (/\uFFFD/.test(f.c.nom) ? ' <span class="gs-gris" title="Accent trencat a l’exportació de Clickedu">⚠</span>' : '') + (f.c.desc ? '<br><small class="gs-gris">' + esc(f.c.desc) + '</small>' : '') + '</td><td class="gs-cen">' + esc(f.c.clau || '—') + '</td><td>' + (f.a ? '<b>' + esc(f.a.id) + '</b>' : 'nova: ' + esc(f.id)) + '</td><td>' + esc(NOMS_AULA[f.tipus] || f.tipus) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      ((G.sense || []).length ? '<p class="gs-gris">Al fitxer sense clau de Clickedu (no s’importen): ' + esc(G.sense.join(', ')) + '</p>' : '') +
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
  function htmlProfessoratH(ed) {
    var dis = ed ? '' : ' disabled', fr = lectivesSetmana(), esps = {};
    Object.keys(S.hprof).forEach(function (k) { if (S.hprof[k].especialitat) esps[S.hprof[k].especialitat] = 1; });
    var ll = Object.keys(S.hprof).map(function (k) { return S.hprof[k]; }).filter(function (p) { return !S.horEsp || p.especialitat === S.horEsp; });
    return '<div class="gs-form-fila"><label>Especialitat <select data-a="esp-prof"><option value="">Totes</option>' + Object.keys(esps).sort(function (a, b) { return a.localeCompare(b, 'ca'); }).map(function (e) { return '<option' + (e === S.horEsp ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></label></div>' +
      '<table class="gs-form-taula gs-informe__taula gs-hor__prof"><thead><tr><th>Docent</th><th>Especialitat</th><th>Jornada</th><th class="gs-cen">Hores assignades</th><th class="gs-cen">Franges disponibles</th><th>Graella</th><th title="Clau del docent a Clickedu">Clau Clickedu</th><th>Observacions</th></tr></thead><tbody>' +
      ll.map(function (p) { var disp = fr - p.prohibides.length, av = p.hores_assignades > disp;
        return '<tr data-prof="' + esc(p.id) + '"' + (S.hprofBrut[p.id] ? ' class="is-brut"' : '') + '><td>' + esc(p.nom) + '</td><td>' + esc(p.especialitat || '—') + '</td><td>' + esc(p.jornada || '—') + '</td><td class="gs-cen">' + fmtH(p.hores_assignades) + '</td><td class="gs-cen' + (av ? ' is-pend' : '') + '">' + disp + (av ? ' ⚠' : '') + '</td>' +
          '<td><button type="button" class="gs-enllac gs-hor__gbtn" data-a="graella-prof">' + resumGraella(p) + '</button></td><td><input type="text" data-k="clau_clickedu" class="gs-hor__clau" value="' + esc(p.clau_clickedu || '') + '" placeholder="—"' + dis + '></td><td><input type="text" data-k="observacions" value="' + esc(p.observacions) + '" placeholder="P. ex. dimecres tarda, formació"' + dis + '></td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="gs-gris">Franges disponibles = ' + fr + ' franges lectives de la setmana − prohibides. ⚠ si té més hores assignades (Currículum › Assignacions) que franges disponibles. Claus de Clickedu: <b>' + Object.keys(S.hprof).filter(function (k) { return S.hprof[k].clau_clickedu; }).length + '</b> de ' + Object.keys(S.hprof).length + ' (botó <strong>Claus de Clickedu (CSV)</strong>, amb la llista del professorat de Peñalara).</p>';
  }
  // Graella de posicions (sessió o docent): cada clic canvia lliure → fixa → prohibida → lliure
  function editaGraella(titol, x, maxFixes, ed) {
    var M = S.marc, F = x.fixes.slice(), P = x.prohibides.slice();
    var estat = function (k) { return F.indexOf(k) >= 0 ? 'fixa' : P.indexOf(k) >= 0 ? 'prohibida' : 'lliure'; };
    var posa = function (k, e) { var i = F.indexOf(k); if (i >= 0) F.splice(i, 1); i = P.indexOf(k); if (i >= 0) P.splice(i, 1); if (e === 'fixa') F.push(k); else if (e === 'prohibida') P.push(k); };
    var seg = { lliure: 'fixa', fixa: 'prohibida', prohibida: 'lliure' };
    var pinta = function () {
      // PAS 55: el botó de cada fila (franja) i de cada columna (dia) canvia totes les caselles alhora
      $('gsGrPos').innerHTML = '<table class="gs-hor__grid gs-hor__grid--edit"><thead><tr><th></th>' + M.dies.map(function (d) { return '<th>' + (ed ? '<button type="button" class="gs-hor__tot" data-dia="' + d + '" title="Canvia tot el ' + d + '">' + d + '</button>' : d) + '</th>'; }).join('') + '</tr></thead><tbody>' + M.franges.map(function (f) {
        if (f.esbarjo) return '<tr class="is-esb"><th>' + esc(f.inici) + '</th><td colspan="' + M.dies.length + '">Esbarjo</td></tr>';
        return '<tr><th>' + (ed ? '<button type="button" class="gs-hor__tot" data-franja="' + f.id + '" title="Canvia tota la franja ' + f.id + '">' + f.id + ' <small>' + esc(f.inici) + '–' + esc(f.fi) + '</small></button>' : f.id + ' <small>' + esc(f.inici) + '–' + esc(f.fi) + '</small>') + '</th>' + M.dies.map(function (d) { var k = d + ' ' + f.id, e = estat(k);
          return '<td class="gs-gr gs-gr--' + e + (ed ? ' is-clic' : '') + '" data-pos="' + k + '" title="' + k + ': ' + e + '">' + (e === 'fixa' ? '📌' : e === 'prohibida' ? '⛔' : '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table><p class="gs-gris">' + F.length + (F.length === 1 ? ' fixa' : ' fixes') + (maxFixes ? ' (màxim ' + maxFixes + ')' : '') + ' · ' + P.length + (P.length === 1 ? ' prohibida' : ' prohibides') + '</p>';
    };
    var pr = pregunta(titol, '<p class="gs-ajuda">Clic a una casella: <span class="gs-gr gs-gr--lliure gs-gr--ll">lliure</span> → <span class="gs-gr gs-gr--fixa gs-gr--ll">📌 fixa</span> (hi ha d’anar) → <span class="gs-gr gs-gr--prohibida gs-gr--ll">⛔ prohibida</span> (no hi pot anar). El nom d’un dia o d’una franja canvia tota la columna o tota la fila.</p><div id="gsGrPos"></div><p class="prog-avis" id="gsGrErr" hidden></p>',
      ed ? [{ t: 'Totes lliures', valor: 0, tipus: 'ghost', abans: function () { F = []; P = []; pinta(); return false; } }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'D’acord', valor: 1 }] : [{ t: 'Tanca', valor: 0 }], false);
    pinta();
    var massa = function () { $('gsGrErr').textContent = 'No hi pot haver més posicions fixes que sessions (' + maxFixes + ').'; $('gsGrErr').hidden = false; };
    if (ed) $('gsGrPos').addEventListener('click', function (e) {
      $('gsGrErr').hidden = true;
      var tot = e.target.closest('[data-dia], [data-franja]');
      if (tot) {   // tota la columna o tota la fila passa a l'estat següent de la primera casella
        var ks = []; M.franges.forEach(function (f) { if (f.esbarjo) return; M.dies.forEach(function (d) { if ((tot.dataset.dia && d === tot.dataset.dia) || (tot.dataset.franja && f.id === tot.dataset.franja)) ks.push(d + ' ' + f.id); }); });
        var nou = seg[estat(ks[0])];
        if (nou === 'fixa' && maxFixes && F.filter(function (k) { return ks.indexOf(k) < 0; }).length + ks.length > maxFixes) { massa(); nou = 'prohibida'; }
        ks.forEach(function (k) { posa(k, nou); }); return pinta();
      }
      var td = e.target.closest('[data-pos]'); if (!td) return; var k = td.dataset.pos, n = seg[estat(k)];
      if (n === 'fixa' && maxFixes && F.length >= maxFixes) { massa(); n = 'prohibida'; }
      posa(k, n); pinta();
    });
    return pr.then(function (v) { return v ? { fixes: F, prohibides: P } : null; });
  }
    function htmlRegles(ed) {
    var RG = S.regles, T = RG.toves, dis = ed ? '' : ' disabled';
    var pesSel = function (k) { return '<select data-pes="' + k + '"' + dis + '>' + [1, 2, 3, 4, 5].map(function (v) { return '<option' + (v === (T.pesos[k] || 3) ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>'; };
    var regla = function (k, txt, pk) { return '<tr><td><label class="gs-check"><input type="checkbox" data-t="' + k + '"' + (T[k] ? ' checked' : '') + dis + '> ' + txt + '</label></td><td class="gs-cen">' + pesSel(pk) + '</td></tr>'; };
    return '<section class="gs-hor__sec"><h3 class="gs-amon__tit">Regles del motor</h3><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Regla</th><th class="gs-cen">Pes (1–5)</th></tr></thead><tbody>' +
        // PAS 70: les hores seguides i els dies diferents els marca la distribució, i el docent és el de Currículum (desiderata
        // aplicada): són regles obligatòries (a sota), no preferències
        regla('minimitzar_forats_docents', 'Evitar forats a l’horari del professorat', 'forats') +
        '<tr><td>Penalització si una sessió va a una <strong>aula alternativa</strong> (avís)</td><td class="gs-cen">' + pesSel('aula_alternativa') + '</td></tr>' +
        '<tr><td>Penalització si una sessió va a <strong>qualsevol aula</strong> de la mateixa capacitat (avís)</td><td class="gs-cen">' + pesSel('aula_qualsevol') + '</td></tr>' +
        // PAS 69: pati lliure, màxim d'ocupació diària i de permanència setmanal (0 = sense límit)
        regla('pati_lliure', 'Qui fa guàrdia de <strong>pati o de biblioteca</strong>, sense cap ocupació just abans ni just després de l’esbarjo', 'pati') +
        '<tr><td>Màxim d’<strong>hores d’ocupació diària</strong> per docent <input type="number" data-t="max_ocupacio_diaria" min="0" max="12" value="' + (T.max_ocupacio_diaria == null ? 6 : T.max_ocupacio_diaria) + '"' + dis + ' style="width:56px"> <span class="gs-gris">(0 = sense límit)</span></td><td class="gs-cen">' + pesSel('max_diaria') + '</td></tr>' +
        '<tr><td>Màxim d’<strong>hores de permanència setmanal</strong> per docent (ocupació + forats) <input type="number" data-t="max_permanencia_setmanal" min="0" max="50" value="' + (T.max_permanencia_setmanal == null ? 30 : T.max_permanencia_setmanal) + '"' + dis + ' style="width:56px"> <span class="gs-gris">(0 = sense límit)</span></td><td class="gs-cen">' + pesSel('permanencia') + '</td></tr>' +
        '</tbody></table><p class="gs-gris">Les regles d’aquesta taula són preferències: el motor intenta complir més les de pes alt. Les <strong>obligatòries</strong> (llista de sota) no es poden desactivar ni ponderar. Entre elles: la <strong>distribució</strong> mana («2 1» = dues hores seguides un dia i l’altra un altre dia; «1 1 1» = cada hora un dia diferent) i cada grup el fa el docent de Currículum › Assignacions (la <strong>desiderata</strong> aplicada).</p></section>' +
      // PAS 52: catàleg de regles (obligatòries i toves amb la seva penalització), tal com va a l'exportació per al motor
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">Regles obligatòries</h3><ol class="gs-hor__regles">' + (S.hor.regles_motor ? S.hor.regles_motor.obligatories : []).map(function (r) { return '<li>' + esc(r.text) + ' <span class="gs-gris">(' + esc(r.dades) + ')</span></li>'; }).join('') + '</ol>' +
      '<h3 class="gs-amon__tit">Penalitzacions de les regles toves</h3><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Regla</th><th>Unitat</th><th class="gs-cen">Pes desat</th></tr></thead><tbody>' + (S.hor.regles_motor ? S.hor.regles_motor.toves : []).map(function (r) { return '<tr' + (r.activa ? '' : ' class="gs-gris"') + '><td>' + esc(r.text) + (r.activa ? '' : ' (desactivada)') + '</td><td>' + esc(r.unitat) + '</td><td class="gs-cen">' + r.pes + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="gs-gris">Penalització total = Σ pes × unitats. El motor busca l’horari amb la penalització més baixa i compleix sempre les obligatòries.</p></section>';
  }
  // PAS 54 · SUBGRUPS i SESSIONS LECTIVES (amb parts i blocs simultanis)
  // Un subgrup és tot conjunt d'alumnes d'un nivell que no coincideix amb cap grup-classe. Cada assignació (matèria × grup)
  // es pot partir en parts; cada part la fa un grup-classe o un subgrup. Els blocs simultanis diuen quines parts es fan alhora.
  var NOMS_TIPUS_SG = { diversitat: 'Diversitat', hores_b: 'Hores B', optativa: 'Optativa', altres: 'Altres', itinerari: 'Itinerari' };   // PAS 76: itinerari
  var lletresNiv = function (niv) { return (S.hor.grups_nivell[niv] || []).map(function (g) { return g.slice(niv.length).trim(); }); };
  var subgrupsNiv = function (niv) { return S.subg.subgrups.filter(function (x) { return x.nivell === niv; }); };
  var sgPerId = function () { var o = {}; S.subg.subgrups.forEach(function (x) { o[x.id] = x; }); return o; };
  var nomGrup = function (k) { var x = sgPerId()[k]; return x ? x.nom : k; };
  var nouCodiSg = function (pre, ll) { var mx = 0; ll.forEach(function (x) { var m = new RegExp('^' + pre + '(\\d+)$').exec(x.id || ''); if (m) mx = Math.max(mx, Number(m[1])); }); return pre + (mx + 1); };
  // PAS 69: les assignacions de codocència d'altres docents («codo_de») van amb la de la primera: no surten a part
  var partsNiv = function (niv) { var o = []; Object.keys(S.ses).forEach(function (k) { var a = S.ses[k]; if (a.nivell === niv && !a.codo_de) a.parts.forEach(function (p) { o.push({ k: a.id + '#' + p.id, a: a, p: p }); }); }); return o; };
  var blocDe = function () { var o = {}; S.subg.blocs.forEach(function (b) { b.parts.forEach(function (k) { o[k] = b; }); }); return o; };
  // PAS 67 · Totes les parts (de tots els nivells): un bloc pot tenir sessions de nivells diferents
  var totesParts = function () { var o = []; Object.keys(S.ses).forEach(function (k) { var a = S.ses[k]; if (!a.codo_de) a.parts.forEach(function (p) { o.push({ k: a.id + '#' + p.id, a: a, p: p }); }); }); return o; };
  // PAS 67 · Diversitat i hores B: cada grup-classe del bloc ha de tenir una sessió només seva (si no, alumnat sense classe)
  function cobertura(b, xs) {
    if (b.tipus !== 'diversitat' && b.tipus !== 'hores_b') return [];
    var sg = sgPerId(), totes = {}, propies = {};
    xs.forEach(function (x) { var s2 = sg[x.p.grup], cls = s2 ? s2.grups.map(function (l) { return s2.nivell + ' ' + l; }) : (x.p.grup ? [x.p.grup] : (x.a.classes || []));
      cls.forEach(function (c) { totes[c] = 1; }); if (cls.length === 1) propies[cls[0]] = 1; });
    return Object.keys(totes).filter(function (c) { return !propies[c]; }).map(function (c) { return 'L’alumnat de ' + c + ' que no és a cap subgrup es quedaria sense classe: cal una sessió només de ' + c + '.'; });
  }
  // Mateix docent en dues sessions del bloc = grup combinat (una sola classe per a l'alumnat de totes dues)
  var combinats = function (xs) { var pr = {}, o = []; xs.forEach(function (x) { if (!x.a.professor) return; if (pr[x.a.professor] && o.indexOf(x.a.professor) < 0) o.push(x.a.professor); pr[x.a.professor] = 1; }); return o; };
  // PAS 73d: amb codocència, tots els docents («A + B (codocència)»)
  // PAS 75: codocència de suport trossejada → «n suports (1+1+1)» amb els docents de suport
  var suportsDe = function (id) { return Object.keys(S.ses || {}).map(function (k) { return S.ses[k]; }).filter(function (b) { return b.acompanya === id; }); };
  var etiquetaPart = function (x) { var co = (x.a.codocents || []).map(function (c) { return c.professor || '—'; }), pr = [x.a.professor || (co.length ? '—' : '')].concat(co).filter(Boolean), su = suportsDe(x.a.id);
    return x.a.materia + ' · ' + (x.p.grup ? nomGrup(x.p.grup) : x.a.grup) + ' · ' + fmtH(x.p.hores) + ' h' + (pr.length ? ' · ' + pr.join(' + ') + (co.length ? ' (codocència)' : '') : '') +
      (su.length ? ' · ' + su.length + (su.length === 1 ? ' suport' : ' suports') + ' (' + su.map(function (b) { return fmtH(b.hores); }).join('+') + ' h: ' + su.map(function (b) { return b.professor || '—'; }).join(', ') + ')' : ''); };

  function errorsSubgrups() {
    var e = [], noms = {}, claus = {};
    var clau = function (k, qui) { if (!k) return; if (claus[k]) e.push('Clau de Clickedu ' + k + ' repetida (' + claus[k] + ' i ' + qui + ').'); claus[k] = qui; };
    Object.keys(S.subg.classes).forEach(function (g) { clau(S.subg.classes[g].clau, g); });
    S.subg.subgrups.forEach(function (x) { var n = x.nom || x.id;
      if (!x.nom) e.push('Subgrup ' + x.id + ' (' + x.nivell + '): cal el nom.');
      if (noms[x.nivell + '|' + x.nom]) e.push('Subgrup ' + n + ' repetit a ' + x.nivell + '.'); noms[x.nivell + '|' + x.nom] = 1;
      if (!x.grups.length) e.push('Subgrup ' + n + ': cal marcar de quins grups-classe surt l’alumnat.');
      clau(x.clau, n); });
    // PAS 69: «En dies diferents», almenys dues sessions
    (S.subg.dies_diferents || []).forEach(function (r) { if (r.parts.length < 2) e.push('En dies diferents «' + (r.nom || r.id) + '»: calen almenys dues sessions.'); });
    return e.concat(errorsBlocs());
  }
  function errorsBlocs() {
    var e = [], tot = {}; Object.keys(S.ses).forEach(function (k) { S.ses[k].parts.forEach(function (p) { tot[k + '#' + p.id] = { a: S.ses[k], p: p }; }); });
    S.subg.blocs.forEach(function (b) { var n = 'Bloc ' + (b.nom || b.id), hs = {}, xs = [];
      if (b.parts.length < 2) e.push(n + ': calen almenys dues sessions.');
      b.parts.forEach(function (k) { var x = tot[k]; if (!x) return; xs.push(x); hs[x.p.hores] = 1; if (b.hores && x.p.hores < b.hores) e.push(n + ': ' + x.a.materia + ' · ' + x.a.grup + ' només té ' + fmtH(x.p.hores) + ' h i el bloc en fa coincidir ' + b.hores + '.'); });
      var d = String(b.distribucio || ''); if (d && b.hores && d.split('').reduce(function (t, c) { return t + Number(c); }, 0) !== b.hores) e.push(n + ': la distribució ha de sumar ' + b.hores + ' h.');
      if (!b.hores && Object.keys(hs).length > 1) e.push(n + ': les sessions han de tenir les mateixes hores (ara ' + Object.keys(hs).join(', ') + '); si només en coincideixen unes quantes, poseu-les a «Hores que coincideixen».');
      cobertura(b, xs).forEach(function (t) { e.push(n + ': ' + t); }); });
    return e;
  }
  function errorsSessions() {
    var e = [];
    Object.keys(S.sesBrut).forEach(function (id) { var a = S.ses[id], nom = a.nivell + ' ' + a.materia + ' ' + a.grup, tot = 0;
      a.parts.forEach(function (p) { var d = String(p.distribucio || ''); tot += Number(p.hores) || 0;
        if (!(p.hores > 0)) e.push(nom + ': una part no té hores.');
        if (d && (!/^[1-9]+$/.test(d) || d.split('').reduce(function (t, c) { return t + Number(c); }, 0) !== Number(p.hores))) e.push(nom + ' (' + (p.grup ? nomGrup(p.grup) : 'part ' + p.id) + '): la distribució ha de sumar ' + fmtH(p.hores) + ' h.');
        if (p.fixes.length > (d ? d.length : p.hores)) e.push(nom + ': més posicions fixes que sessions.'); });
      if (Math.abs(tot - a.hores) > 0.01) e.push(nom + ': les parts sumen ' + fmtH(tot) + ' h i la matèria en té ' + fmtH(a.hores) + '.'); });
    // PAS 69: «En dies diferents», almenys dues sessions
    (S.subg.dies_diferents || []).forEach(function (r) { if (r.parts.length < 2) e.push('En dies diferents «' + (r.nom || r.id) + '»: calen almenys dues sessions.'); });
    return e.concat(errorsBlocs());
  }

  // --- Pestanya Subgrups
  function htmlSubgrups(ed) {
    var R = S.hor, niv = S.horNiv, dis = ed ? '' : ' disabled', L = lletresNiv(niv), us = {};
    partsNiv(niv).forEach(function (x) { if (x.p.grup) us[x.p.grup] = (us[x.p.grup] || 0) + 1; });
    var classes = (R.grups_nivell[niv] || []).map(function (g) { var c = S.subg.classes[g] || {};
      return '<tr data-cl="' + esc(g) + '"><td><b>' + esc(g) + '</b></td><td><input type="text" data-k="nom" class="gs-hor__ck" value="' + esc(c.nom || '') + '" placeholder="P. ex. ' + esc(g.replace(/^(\d)\S*\s+(ESO|BAT)\s+/, '$1$2')) + '"' + dis + '></td><td><input type="text" data-k="clau" class="gs-hor__clau" value="' + esc(c.clau || '') + '" placeholder="—"' + dis + '></td><td class="gs-cen">' + (us[g] || 0) + '</td></tr>'; }).join('');
    var sg = S.subg.subgrups.map(function (x, i) { return [x, i]; }).filter(function (p) { return p[0].nivell === niv; })
      .sort(function (a, b) { return Object.keys(NOMS_TIPUS_SG).indexOf(a[0].tipus) - Object.keys(NOMS_TIPUS_SG).indexOf(b[0].tipus) || a[0].nom.localeCompare(b[0].nom, 'ca', { numeric: true }); });
    // PAS 76: itineraris del nivell (columna «Itineraris» dels altres subgrups: de quins surt l'alumnat)
    var its = S.subg.subgrups.filter(function (x) { return x.nivell === niv && x.tipus === 'itinerari' && x.grups.length === 1; });
    var fila = function (p) { var x = p[0];
      return '<tr data-sg="' + p[1] + '"><td><input type="text" data-k="nom" class="gs-hor__ck" value="' + esc(x.nom) + '" placeholder="P. ex. LC1-AB-DIV"' + dis + '></td><td><input type="text" data-k="clau" class="gs-hor__clau" value="' + esc(x.clau || '') + '" placeholder="—"' + dis + '></td>' +
        '<td><select data-k="tipus"' + dis + '>' + Object.keys(NOMS_TIPUS_SG).map(function (t) { return '<option value="' + t + '"' + (t === x.tipus ? ' selected' : '') + '>' + NOMS_TIPUS_SG[t] + '</option>'; }).join('') + '</select></td>' +
        '<td class="gs-hor__lletres">' + L.map(function (l) { return '<label class="gs-check"><input type="checkbox" data-k="grup" value="' + esc(l) + '"' + (x.grups.indexOf(l) >= 0 ? ' checked' : '') + dis + '> ' + esc(l) + '</label>'; }).join('') + '</td>' +
        (its.length ? '<td class="gs-hor__lletres">' + (x.tipus === 'itinerari' ? '<span class="gs-gris">—</span>' : its.filter(function (t) { return x.grups.indexOf(t.grups[0]) >= 0; }).map(function (t) { return '<label class="gs-check" title="L’alumnat d’aquest subgrup surt només d’aquest itinerari (sense cap marcat: de tots)"><input type="checkbox" data-k="itin" value="' + esc(t.id) + '"' + ((x.itineraris || []).indexOf(t.id) >= 0 ? ' checked' : '') + dis + '> ' + esc(t.nom || t.id) + '</label>'; }).join('') || '<span class="gs-gris">—</span>') + '</td>' : '') +
        '<td class="gs-cen">' + (us[x.id] || 0) + '</td><td>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu-sg" title="Treu el subgrup" aria-label="Treu el subgrup">' + PAPERERA + '</button>' : '') + '</td></tr>'; };
    var n = {}; sg.forEach(function (p) { n[p[0].tipus] = (n[p[0].tipus] || 0) + 1; });
    return '<div class="gs-nivells" role="group" aria-label="Nivell">' + R.nivells.map(function (x) { return '<button type="button" class="gs-nivells__btn' + (x === niv ? ' is-actiu' : '') + '" data-a="niv" data-niv="' + esc(x) + '">' + x + '</button>'; }).join('') + '</div>' +
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">1 · Grups-classe</h3><p class="gs-gris">El nom i la clau de cada grup-classe a Clickedu (calen per importar l’horari).</p><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Grup-classe</th><th>Nom a Clickedu</th><th>Clau</th><th class="gs-cen">Sessions</th></tr></thead><tbody>' + classes + '</tbody></table></section>' +
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">2 · Subgrups</h3><p class="gs-gris">Tot conjunt d’alumnes del nivell que no coincideix amb cap grup-classe: <strong>diversitat</strong> (Català, Castellà i Matemàtiques fora del grup-classe: LC1-A, LC1-AB-DIV…), <strong>hores B</strong> (meitat d’un grup-classe: 1ESOA-G1, 1ESOA-G2), <strong>optatives</strong> (alumnat de tots els grups-classe: OSA1, OSI1…), <strong>itineraris</strong> (batxillerat: un grup-classe amb alumnat de dues modalitats, p. ex. 1r BAT B Científic i Humanístic; cada itinerari d’un sol grup-classe i almenys dos per grup: les classes d’un itinerari poden anar a la mateixa hora que les de l’altre, sense blocs) i <strong>altres</strong>. Si un grup-classe té itineraris, la columna <strong>Itineraris</strong> diu de quins surt l’alumnat d’un altre subgrup (p. ex. una matèria compartida pels humanístics de B i el grup C); sense cap marcat, de tots. Les columnes de lletres diuen de quins grups-classe surt l’alumnat. Quines sessions fa cada subgrup i quines són simultànies es diu a <strong>Sessions lectives</strong>.</p>' +
        (sg.length ? '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-hor__sg"><thead><tr><th>Nom a Clickedu</th><th>Clau</th><th>Tipus</th><th>Grups-classe</th>' + (its.length ? '<th>Itineraris</th>' : '') + '<th class="gs-cen">Sessions</th><th></th></tr></thead><tbody>' + sg.map(fila).join('') + '</tbody></table>' : '<p class="gs-gris">Cap subgrup en aquest nivell. Importeu-los de Clickedu o de Peñalara amb el botó de dalt, o afegiu-los a mà.</p>') +
        (ed ? '<p><button type="button" class="gs-enllac" data-a="nou-sg">+ subgrup</button></p>' : '') +
        (sg.length ? '<p class="gs-hor__resum">' + Object.keys(NOMS_TIPUS_SG).filter(function (t) { return n[t]; }).map(function (t) { return '<b>' + n[t] + '</b> ' + NOMS_TIPUS_SG[t].toLowerCase(); }).join(' · ') + '</p>' : '') + '</section>';
  }

  // --- Importació de grups i subgrups: llistes de Peñalara (CSV) o fitxer GHC (exportació de Clickedu o resultat de Peñalara)
  var tipusSubgrup = function (nom, nClasses) { var x = String(nom).toUpperCase();
    if (/^\dBAT[A-Z]+-(CIE|HUM|TEC|SOC|ART|CT|HS)/.test(x)) return 'itinerari';   // PAS 76: 1BATB-Cie, 1BATB-Hum…
    return /^(LC|LS|MA)\d/.test(x) ? 'diversitat' : /^\dESO[A-Z]+-G\d$/.test(x) || /^\dBAT[A-Z]+-G\d$/.test(x) ? 'hores_b' : /^O[A-Z]{2}\d$/.test(x) || nClasses > 1 ? 'optativa' : 'altres'; };
  var nivellDeCurs = function (c) { var m = /^(\d)\s*(?:r|n|t|er)?\s*(ESO|BAT)/i.exec(String(c || '').replace(/\s+/g, ' ')); return m ? S.hor.nivells.filter(function (n) { return n.charAt(0) === m[1] && n.toUpperCase().indexOf(m[2].toUpperCase()) >= 0; })[0] || '' : ''; };
  // «1ESOA» → {nivell: '1r ESO', lletra: 'A'}; «1BATB-Cie» → {1r BAT, B}
  var classeDeNom = function (n) { var m = /^(\d)(ESO|BAT)([A-Z]+)/i.exec(String(n || '').trim()); if (!m) return null; var niv = nivellDeCurs(m[1] + ' ' + m[2]); return niv ? { nivell: niv, lletra: m[3].toUpperCase() } : null; };
  function llegeixCsvGrups(buf) {
    var txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('windows-1252').decode(buf); }
    var ll = txt.split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (l) { return l.split(';'); }); if (!ll.length) return null;
    var cap = ll[0].map(normAula), c = function (re) { for (var i = 0; i < cap.length; i++) if (re.test(cap[i])) return i; return -1; };
    var iK = c(/^CLAVEEXTERNA$/), iC = c(/^CURSO$/), iG = c(/^GRUPOS?$/), iS = c(/^SUBGRUPO/), iP = c(/^ELSUBGRUPOFORMAPARTE/);
    if (iK < 0) return null;
    var o = { font: 'penalara', classes: [], subgrups: [] };
    ll.slice(1).forEach(function (r) { var cel = function (i) { return i >= 0 ? String(r[i] || '').trim() : ''; };
      if (iG >= 0) { var cl = classeDeNom(cel(iG)); if (cl) o.classes.push({ nom: cel(iG), clau: cel(iK), nivell: nivellDeCurs(cel(iC)) || cl.nivell, lletra: cl.lletra }); }
      else if (iS >= 0) { var inc = cel(iP).split(',').map(function (x) { return classeDeNom(x.trim()); }).filter(Boolean);
        o.subgrups.push({ nom: cel(iS), clau: cel(iK), nivell: nivellDeCurs(cel(iC)) || (inc[0] || {}).nivell || '', lletres: inc.map(function (x) { return x.lletra; }) }); } });
    return o;
  }
  function llegeixGhcGrups(buf) {
    var txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('iso-8859-1').decode(buf); }
    var doc = new DOMParser().parseFromString(txt.replace(/^\s*<\?xml[^>]*\?>/, ''), 'application/xml');
    if (!doc.querySelector('datosGHC') || doc.querySelector('parsererror')) return null;
    var t = function (e, k) { var x = e.querySelector(k); return x ? x.textContent.trim() : ''; };
    var o = { font: doc.querySelector('horario > tramo') || doc.querySelector('cursos > curso') ? 'penalara' : 'clickedu', classes: [], subgrups: [] };
    [].forEach.call(doc.querySelectorAll('grupos > grupo'), function (g) {
      var nom = t(g, 'nombre'), clau = t(g, 'claveDeExportacion'), cl = classeDeNom(nom), inc = [].map.call(g.querySelectorAll('gruposIncluidos > grupoIncluido'), function (x) { return classeDeNom(x.textContent); }).filter(Boolean);
      var curs = nivellDeCurs(t(g, 'cursoPerteneciente').replace(/^(\d)(ESO|BAT)$/i, '$1 $2'));
      if (/^C/.test(clau) && cl && !/-/.test(nom)) o.classes.push({ nom: nom, clau: clau, nivell: cl.nivell, lletra: cl.lletra });
      else { if (!inc.length && cl) inc = [cl];   // 1ESOA-G1 → 1ESOA
        var m = /^(?:LC|LS|MA|O[A-Z]{2})(\d)-?([A-Z]*)/.exec(nom), niv = curs || (inc[0] || {}).nivell || '';
        if (!niv && m) niv = nivellDeCurs(m[1] + ' ESO');
        var lletres = inc.map(function (x) { return x.lletra; });
        if (!lletres.length && m && niv) { var part = nom.split('-')[1] || ''; lletres = /^[A-Z]+$/.test(part) && !/DIV/.test(part) ? part.split('') : []; if (!lletres.length) lletres = lletresNiv(niv); if (/-([A-Z]+)-DIV$/.test(nom)) lletres = /-([A-Z]+)-DIV$/.exec(nom)[1].split(''); }
        o.subgrups.push({ nom: nom, clau: clau, nivell: niv, lletres: lletres }); } });
    return o;
  }
  function importaGrupsClickedu(G) {
    var SG = S.subg, canvis = [], avisos = [], ign = [], nous = 0, actualitzats = 0, perNom = {};
    SG.subgrups.forEach(function (x) { perNom[x.nivell + '|' + x.nom] = x; });
    var clauMana = G.font === 'clickedu';   // les claus dels grups-classe de l'exportació de Clickedu són les bones
    G.classes.forEach(function (c) { var g = c.nivell + ' ' + c.lletra;
      if ((S.hor.grups_nivell[c.nivell] || []).indexOf(g) < 0) { ign.push(c.nom); return; }
      var a = SG.classes[g] || {};
      if (a.clau && a.clau !== c.clau) { if (clauMana) avisos.push(g + ': clau ' + a.clau + ' → ' + c.clau + ' (la de Clickedu).'); else { avisos.push(g + ': es manté la clau ' + a.clau + ' (el fitxer de Peñalara diu ' + c.clau + ').'); return; } }
      if (a.nom !== c.nom || a.clau !== c.clau) { canvis.push(function () { SG.classes[g] = { nom: c.nom, clau: c.clau }; }); actualitzats++; } });
    G.subgrups.forEach(function (s) {
      if (!s.nivell) { ign.push(s.nom); return; }
      var L = lletresNiv(s.nivell), ll = s.lletres.filter(function (l) { return L.indexOf(l) >= 0; }), a = perNom[s.nivell + '|' + s.nom];
      if (!ll.length) { ll = L.slice(); avisos.push(s.nom + ': no diu de quins grups-classe surt l’alumnat; es marquen tots els de ' + s.nivell + ' (reviseu-ho).'); }
      if (a) { if (a.clau && s.clau && a.clau !== s.clau) { if (clauMana) avisos.push(s.nom + ': clau ' + a.clau + ' → ' + s.clau + '.'); else { avisos.push(s.nom + ': es manté la clau ' + a.clau + ' (el fitxer diu ' + s.clau + ').'); return; } }
        canvis.push(function () { if (s.clau) a.clau = s.clau; if (ll.length && !a.grups.length) a.grups = ll; }); actualitzats++; }
      else { nous++; canvis.push(function () { SG.subgrups.push({ id: nouCodiSg('S', SG.subgrups), nivell: s.nivell, nom: s.nom, clau: s.clau, tipus: tipusSubgrup(s.nom, ll.length), grups: ll }); }); } });
    var perNiv = {}; G.subgrups.forEach(function (s) { if (s.nivell) perNiv[s.nivell] = (perNiv[s.nivell] || 0) + 1; });
    pregunta('Grups i subgrups de ' + (G.font === 'clickedu' ? 'Clickedu' : 'Peñalara'), '<p>Al fitxer: <b>' + G.classes.length + '</b> grups-classe i <b>' + G.subgrups.length + '</b> subgrups (' + Object.keys(perNiv).map(function (k) { return esc(k) + ': ' + perNiv[k]; }).join(' · ') + ').</p>' +
      '<ul><li>Subgrups nous: <b>' + nous + '</b></li><li>Grups-classe i subgrups que s’actualitzen: <b>' + actualitzats + '</b></li></ul>' +
      (G.font !== 'clickedu' ? '<p class="gs-des__estat is-avis">⚠ Fitxer de Peñalara: les claus dels grups-classe poden ser d’un altre curs. Si ja hi ha una clau (p. ex. de l’exportació de Clickedu), es manté.</p>' : '') +
      (avisos.length ? '<div class="gs-comprova"><p class="prog-avis">' + avisos.map(esc).join('<br>') + '</p></div>' : '') +
      (ign.length ? '<p class="gs-gris">No són grups-classe de GESTIO o no se’n sap el nivell (no s’importen): ' + esc(ign.slice(0, 30).join(', ')) + (ign.length > 30 ? '…' : '') + '</p>' : '') +
      '<p>Res no es desa fins que premeu <strong>Desa</strong>. Reviseu el tipus i els grups-classe de cada subgrup.</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Aplica', valor: 1 }], false).then(function (v) {
      if (!v) return; canvis.forEach(function (f) { f(); }); S.horBrut.subgrups = true; S.brut = true; pintaHoraris(); toast('Grups i subgrups importats: reviseu-los i premeu Desa.');
    });
  }

  // --- Pestanya Sessions lectives
  function htmlSessions(ed) {
    var R = S.hor, niv = S.horNiv, dis = ed ? '' : ' disabled', BD = blocDe();
    // PAS 55: per matèria i després per grup
    var ll = Object.keys(S.ses).map(function (k) { return S.ses[k]; }).filter(function (x) { return x.nivell === niv && !x.codo_de; })
      .sort(function (a, b) { return a.materia.localeCompare(b.materia, 'ca') || a.grup.localeCompare(b.grup, 'ca', { numeric: true }) || a.num_grup - b.num_grup; });
    // PAS 69: aules per ordre alfabètic
    var aOpts = function (sel) { return '<option value="">—</option>' + S.aules.aules.filter(function (a) { return a.id; }).slice().sort(function (x, y) { return x.id.localeCompare(y.id, 'ca', { numeric: true }); }).map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.id) + '</option>'; }).join(''); };
    var cOpts = function (sel) { return '<option value="">—</option>' + S.aules.conjunts.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join(''); };
    var gOpts = function (sel) { return '<option value="">— Tria —</option><optgroup label="Grups-classe">' + (R.grups_nivell[niv] || []).map(function (g) { return '<option value="' + esc(g) + '"' + (g === sel ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</optgroup>' +
      Object.keys(NOMS_TIPUS_SG).map(function (t) { var ss = subgrupsNiv(niv).filter(function (x) { return x.tipus === t; }); return ss.length ? '<optgroup label="Subgrups · ' + NOMS_TIPUS_SG[t].toLowerCase() + '">' + ss.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.nom) + '</option>'; }).join('') + '</optgroup>' : ''; }).join(''); };
    var mat = '', hB = {}; R.materies.forEach(function (m) { if (m.nivell === niv) hB[m.materia] = m.hores_b; });
    var files = ll.map(function (a) { var nova = a.id_materia + a.materia !== mat; mat = a.id_materia + a.materia; var tot = a.parts.reduce(function (t, p) { return t + (Number(p.hores) || 0); }, 0);
      return a.parts.map(function (p, j) { var k = a.id + '#' + p.id, b = BD[k];
        return '<tr data-ses="' + esc(a.id) + '" data-part="' + esc(p.id) + '" class="' + (nova && !j ? 'is-nova' : '') + (j ? ' is-part' : '') + (S.sesBrut[a.id] ? ' is-brut' : '') + '">' +
          (j ? '<td></td><td></td><td></td><td></td>' : '<td>' + (nova ? esc(a.materia) : '') + '</td><td>' + esc(a.grup) + '</td><td>' + (a.professor ? esc(a.professor) : '<span class="gs-gris">—</span>') + (a.codocents && a.codocents.length ? ' + ' + a.codocents.map(function (c) { return c.professor ? esc(c.professor) : '<span class="gs-gris">—</span>'; }).join(' + ') + ' <span class="gs-codo" title="Codocència: ' + (a.codocents.length + 1) + ' docents al mateix grup i a la mateixa aula, a la mateixa hora. Una sola configuració per a tots.">Codocència</span>' : '') + (a.acompanya ? ' <span class="gs-codo" title="Codocència de suport: el motor posa aquestes hores a la mateixa hora i aula que una sessió de ' + esc(a.acompanya_prof || 'la principal') + ' (no ocupen el grup-classe una altra vegada). L’aula i la graella d’aquesta fila no compten.">Suport de ' + esc(a.acompanya_prof || 'la principal') + '</span>' : '') + '</td><td class="gs-cen' + (Math.abs(tot - a.hores) > 0.01 ? ' is-pend' : '') + '" title="Hores de l’assignació">' + fmtH(a.hores) + '</td>') +
          '<td>' + (a.multinivell ? '<span class="gs-codo" title="Atenció individual: no ocupa cap grup-classe, només el docent (i l’aula, si en té)">Multinivell</span>' : '<select data-k="grup"' + dis + (p.grup ? '' : ' class="is-pend"') + '>' + gOpts(p.grup) + '</select>') + (b ? ' <span class="gs-codo" title="Bloc simultani">' + esc(b.nom || b.id) + '</span>' : '') + '</td>' +
          '<td><input type="number" data-k="hores" min="0.5" step="0.5" max="' + a.hores + '" value="' + esc(p.hores) + '" class="gs-hor__h"' + dis + '></td>' +
          '<td><input type="text" data-k="distribucio" value="' + esc(p.distribucio) + '" maxlength="8" inputmode="numeric" class="gs-hor__dist"' + dis + '></td><td><select data-k="aula"' + dis + '>' + aOpts(p.aula) + '</select></td><td><select data-k="conjunt"' + dis + '>' + cOpts(p.conjunt) + '</select></td>' +
          '<td><button type="button" class="gs-enllac gs-hor__gbtn" data-a="graella-ses">' + resumGraella(p) + '</button></td><td class="gs-hor__acc">' +
          (ed ? '<button type="button" class="gs-hist" data-a="parteix" title="Parteix: una part nova amb 1 h d’aquesta">✂</button>' + (j ? '<button type="button" class="gs-hist" data-a="treu-part" title="Treu aquesta part (les hores tornen a la primera)">×</button>' : '') +
            (!j && hB[a.materia] > 0 && a.parts.length === 1 && a.classes.length === 1 ? '<button type="button" class="gs-hist" data-a="parteix-b" title="Hores B: grup sencer + meitat per a G1 + meitat per a G2">B</button>' : '') +
            (!j && nova ? '<button type="button" class="gs-hist" data-a="aplica-materia" title="Copia les parts (grups equivalents, hores, distribució, aules i graella) a tots els grups de la matèria" aria-label="Aplica a tota la matèria">⇣</button>' : '') : '') + '</td></tr>'; }).join(''); }).join('');
    var pn = partsNiv(niv), tp = totesParts(), perK = {}; tp.forEach(function (x) { perK[x.k] = x; });
    // PAS 67: el bloc surt a tots els nivells de les seves sessions (pot ser multinivell)
    var bl = S.subg.blocs.map(function (b, i) { return [b, i]; }).filter(function (p) { return p[0].nivell === niv || p[0].parts.some(function (k) { return perK[k] && perK[k].a.nivell === niv; }); });
    // PAS 68: endreçades per nivell i, dins del nivell, per matèria (i grup)
    var ORD_N = (R.nivells || []).concat(['ESO-BAT']), ordP = function (a, b) { return ORD_N.indexOf(a.a.nivell) - ORD_N.indexOf(b.a.nivell) || a.a.materia.localeCompare(b.a.materia, 'ca') || String(a.p.grup ? nomGrup(a.p.grup) : a.a.grup).localeCompare(String(b.p.grup ? nomGrup(b.p.grup) : b.a.grup), 'ca', { numeric: true }); };
    var lliures = pn.filter(function (x) { return !BD[x.k]; }).sort(ordP), altres = tp.filter(function (x) { return x.a.nivell !== niv && !BD[x.k]; }).sort(ordP);
    var bloc = function (q) { var b = q[0], hs = {}, rep;
      var xs = b.parts.map(function (k) { return perK[k]; }).filter(Boolean);
      xs.forEach(function (x) { hs[x.p.hores] = 1; }); rep = combinats(xs);
      var cob = cobertura(b, xs), curtes = b.hores ? xs.filter(function (x) { return x.p.hores < b.hores; }) : [], nivs = xs.map(function (x) { return x.a.nivell; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      return '<div class="gs-hor__bloc" data-bs="' + q[1] + '"><div class="gs-form-fila"><label>Nom <input type="text" data-k="nom" value="' + esc(b.nom) + '" placeholder="P. ex. Català AB"' + dis + '></label><label>Tipus <select data-k="tipus"' + dis + '>' + Object.keys(NOMS_TIPUS_SG).map(function (t) { return '<option value="' + t + '"' + (t === b.tipus ? ' selected' : '') + '>' + NOMS_TIPUS_SG[t] + '</option>'; }).join('') + '</select></label>' +
        '<label title="Hores en què coincideixen les sessions. En blanc: totes (han de tenir les mateixes hores). Si una sessió en té més, la resta es fa a part.">Hores que coincideixen <input type="number" min="1" max="30" data-k="hores" value="' + esc(b.hores || '') + '" placeholder="totes" style="width:6em"' + dis + '></label>' +
        '<label title="Com es reparteixen les hores del bloc: 11 = dues sessions d’1 h; 2 = una de 2 h">Distribució <input type="text" data-k="distribucio" value="' + esc(b.distribucio || '') + '" placeholder="p. ex. 11" style="width:6em"' + dis + '></label>' +
        '<label title="Els blocs amb la mateixa etiqueta es fan el mateix dia, obligatòriament (p. ex. la rotació de les hores B d’un grup-classe)">Mateix dia que <input type="text" data-k="mateix_dia" value="' + esc(b.mateix_dia || '') + '" placeholder="etiqueta (opcional)" style="width:10em"' + dis + '></label>' + (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu-bs" title="Treu el bloc" aria-label="Treu el bloc">' + PAPERERA + '</button>' : '') + '</div>' +
        '<ul class="gs-hor__parts">' + xs.map(function (x) { return '<li data-k="' + esc(x.k) + '">' + esc(etiquetaPart(x)) + (ed ? ' <button type="button" class="gs-enllac" data-a="treu-de-bloc" aria-label="Treu del bloc">×</button>' : '') + '</li>'; }).join('') + '</ul>' +
        (ed ? '<select data-k="afegeix"><option value="">+ afegeix una sessió…</option><optgroup label="' + esc(niv) + '">' + lliures.map(function (x) { return '<option value="' + esc(x.k) + '">' + esc(etiquetaPart(x)) + '</option>'; }).join('') + '</optgroup>' +
          ORD_N.filter(function (n) { return n !== niv; }).map(function (n) { var xs2 = altres.filter(function (x) { return x.a.nivell === n; }); return xs2.length ? '<optgroup label="' + esc(n) + '">' + xs2.map(function (x) { return '<option value="' + esc(x.k) + '">' + esc(n + ' · ' + etiquetaPart(x)) + '</option>'; }).join('') + '</optgroup>' : ''; }).join('') + '</select>' : '') +
        (nivs.length > 1 ? '<p class="gs-gris">Bloc multinivell: ' + esc(nivs.join(', ')) + '.</p>' : '') +
        (!b.hores && Object.keys(hs).length > 1 ? '<p class="prog-avis">⚠ Les sessions tenen hores diferents (' + Object.keys(hs).join(', ') + '): poseu les <b>hores que coincideixen</b>; la resta de cada sessió es farà a part.</p>' : '') +
        (b.hores && Object.keys(hs).some(function (h) { return Number(h) > b.hores; }) ? '<p class="gs-gris">Coincidència parcial: ' + b.hores + ' h alhora; la resta de cada sessió es fa a part.</p>' : '') +
        (curtes.length ? '<p class="prog-avis">⚠ ' + esc(curtes.map(function (x) { return x.a.materia + ' · ' + x.a.grup; }).join(', ')) + ': menys hores que les que coincideixen.</p>' : '') +
        cob.map(function (t) { return '<p class="prog-avis">✗ ' + esc(t) + '</p>'; }).join('') +
        (rep.length ? '<p class="gs-gris">Grup combinat: ' + esc(rep.join(', ')) + ' fa diverses sessions del bloc alhora (una sola classe amb tot l’alumnat).</p>' : '') + '</div>'; };
    var senseGrup = pn.filter(function (x) { return !x.p.grup; }).length;
    return '<div class="gs-nivells" role="group" aria-label="Nivell">' + R.nivells.map(function (n) { return '<button type="button" class="gs-nivells__btn' + (n === niv ? ' is-actiu' : '') + '" data-a="niv" data-niv="' + esc(n) + '">' + n + '</button>'; }).join('') + '</div>' +
      (!S.aules.aules.length ? '<p class="prog-avis">Encara no hi ha aules: doneu-les d’alta a la pestanya Aules.</p>' : '') +
      (ll.length ? '<section class="gs-hor__sec"><h3 class="gs-amon__tit">1 · Sessions de cada matèria</h3><p class="gs-gris">Cada matèria i grup (de Currículum › Assignacions) es pot partir en <strong>parts</strong>: cada part la fa un <strong>grup-classe o un subgrup</strong>, amb les seves hores. Exemple: Anglès 1r ESO A (4 h) = 2 h amb 1r ESO A + 1 h amb 1ESOA-G1 + 1 h amb 1ESOA-G2 (botó <b>B</b>). ✂ parteix una part, × la treu.' +
          (senseGrup ? ' <span class="is-pend">⚠ ' + senseGrup + ' parts sense grup o subgrup.</span>' : '') + (ed ? ' <button type="button" class="gs-enllac" data-a="assigna-sg">Assigna els subgrups automàticament</button>' : '') + '</p>' +
        '<table class="gs-form-taula gs-informe__taula gs-hor__ses"><thead><tr><th>Matèria</th><th>Grup</th><th>Professor/a</th><th class="gs-cen">h</th><th>La fa</th><th>h</th><th>Distribució</th><th>Aula preferent</th><th>Aules alternatives</th><th>Graella</th><th></th></tr></thead><tbody>' + files + '</tbody></table></section>' +
        '<section class="gs-hor__sec"><h3 class="gs-amon__tit">2 · Blocs simultanis</h3><p class="gs-gris">Sessions que es fan <strong>a la mateixa hora</strong>: la diversitat (Català A + Català B + Català AB-DIV), les hores B (G1 + G2, amb rotació si fan matèries diferents: «Mateix dia que»), les optatives i qualsevol coincidència, fins i tot de <strong>nivells diferents</strong>. Si les sessions no tenen les mateixes hores, indiqueu les <strong>hores que coincideixen</strong> (la resta es fa a part). El mateix docent en dues sessions = <strong>grup combinat</strong>. La codocència (dos docents a la mateixa aula) no és un bloc: es fa al Currículum (Docents a l’aula = 2).' +
          (ed ? ' <button type="button" class="gs-enllac" data-a="proposa-bs">Proposa els blocs del nivell</button>' : '') + '</p>' +
          (bl.length ? bl.map(bloc).join('') : '<p class="gs-gris">Cap bloc en aquest nivell.</p>') + (ed ? '<p><button type="button" class="gs-enllac" data-a="nou-bs">+ bloc</button></p>' : '') + '</section>' +
        htmlDiesDiferents(ed, niv, perK, ordP)
        : '<p class="gs-gris">Aquest nivell no té assignacions (cal generar-les a Currículum › Assignacions).</p>');
  }

  // PAS 69 · «En dies diferents»: sessions (matèria + grup-classe o subgrup) que no poden anar el mateix dia, p. ex. l'hora A
  // de Tecnologia de 1r ESO A i les seves hores B (G1 i G2). És una regla obligatòria del motor (el contrari de «Mateix dia»).
  function htmlDiesDiferents(ed, niv, perK, ordP) {
    var dis = ed ? '' : ' disabled', DD = S.subg.dies_diferents, BD = blocDe();
    var ll = DD.map(function (r, i) { return [r, i]; }).filter(function (q) { return q[0].nivell === niv || q[0].parts.some(function (k) { return perK[k] && perK[k].a.nivell === niv; }); });
    var opcions = partsNiv(niv).sort(ordP);
    var regla = function (q) { var r = q[0], xs = r.parts.map(function (k) { return perK[k]; }).filter(Boolean);
      var bl = r.parts.map(function (k) { return BD[k]; }).filter(Boolean), md = bl.map(function (b) { return b.mateix_dia; }).filter(Boolean);
      return '<div class="gs-hor__bloc" data-dd="' + q[1] + '"><div class="gs-form-fila"><label>Nom <input type="text" data-k="nom" value="' + esc(r.nom) + '" placeholder="P. ex. Tecnologia 1r ESO A: A ≠ B"' + dis + '></label>' +
        (ed ? '<button type="button" class="gs-perill gs-paperera" data-a="treu-dd" title="Treu la regla" aria-label="Treu la regla">' + PAPERERA + '</button>' : '') + '</div>' +
        '<ul class="gs-hor__parts">' + xs.map(function (x) { return '<li data-k="' + esc(x.k) + '">' + esc(etiquetaPart(x)) + (BD[x.k] ? ' <span class="gs-codo" title="Bloc simultani">' + esc(BD[x.k].nom || BD[x.k].id) + '</span>' : '') + (ed ? ' <button type="button" class="gs-enllac" data-a="treu-de-dd" aria-label="Treu de la regla">×</button>' : '') + '</li>'; }).join('') + '</ul>' +
        (ed ? '<select data-k="afegeix"><option value="">+ afegeix una sessió…</option>' + opcions.filter(function (x) { return r.parts.indexOf(x.k) < 0; }).map(function (x) { return '<option value="' + esc(x.k) + '">' + esc(etiquetaPart(x)) + '</option>'; }).join('') + '</select>' : '') +
        (bl.some(function (b, i) { return bl.indexOf(b) !== i; }) ? '<p class="prog-avis">✗ Dues sessions del mateix bloc (es fan alhora): no poden anar en dies diferents.</p>' : '') +
        (md.some(function (x, i) { return md.indexOf(x) !== i; }) ? '<p class="prog-avis">✗ Dues sessions de blocs «Mateix dia que» ' + esc(md[0]) + ': no poden anar en dies diferents.</p>' : '') + '</div>'; };
    return '<section class="gs-hor__sec"><h3 class="gs-amon__tit">3 · En dies diferents</h3><p class="gs-gris">Sessions que <strong>no poden anar el mateix dia</strong> (obligatori per al motor): p. ex. l’hora A de Tecnologia del grup-classe i les seves hores B (G1 i G2). És el contrari de «Mateix dia que» dels blocs. Cada sessió pot ser d’un grup-classe o d’un subgrup, i fins i tot d’un bloc.' +
      (ed ? ' <button type="button" class="gs-enllac" data-a="proposa-dd">Proposa les del nivell</button>' : '') + '</p>' +
      (ll.length ? ll.map(regla).join('') : '<p class="gs-gris">Cap regla en aquest nivell.</p>') + (ed ? '<p><button type="button" class="gs-enllac" data-a="nou-dd">+ regla</button></p>' : '') + '</section>';
  }
  // Proposta: a cada matèria i grup amb part del grup-classe i parts de subgrups (hores B, desdoblaments…), l'hora del
  // grup-classe i la de cada subgrup en dies diferents (els subgrups entre ells poden coincidir el mateix dia)
  function proposaDiesDiferents(niv) {
    var DD = S.subg.dies_diferents, sg = sgPerId(), fet = {}, n = 0;
    DD.forEach(function (r) { fet[r.parts.slice().sort().join('|')] = 1; });
    Object.keys(S.ses).forEach(function (k) { var a = S.ses[k]; if (a.nivell !== niv || a.codo_de || a.parts.length < 2) return;
      var gc = a.parts.filter(function (p) { return p.grup && !sg[p.grup]; }), sub = a.parts.filter(function (p) { return p.grup && sg[p.grup]; });
      gc.forEach(function (p) { sub.forEach(function (q) { var ks = [a.id + '#' + p.id, a.id + '#' + q.id], c = ks.slice().sort().join('|'); if (fet[c]) return; fet[c] = 1;
        DD.push({ id: nouCodiSg('D', DD), nivell: niv, nom: a.materia + ' ' + nomGrup(p.grup) + ' ≠ ' + nomGrup(q.grup), parts: ks }); n++; }); }); });
    return n;
  }
  // Assigna subgrups per nom: diversitat (LC/LS/MA + nivell + lletres) i optatives (codi de la llengua o matèria)
  var CODIS_DIV = { catala: 'LC', castella: 'LS', matematiques: 'MA' };
  var CODIS_OPT = [[/italia/, 'SI'], [/alemany/, 'SA'], [/frances/, 'SF'], [/angles/, 'AN'], [/matematiques/, 'MA'], [/tecniques d.?estudi/, 'TE'], [/esports|raqueta|educacio fisica/, 'EF'], [/coneixement cientific|ciencies/, 'CN']];
  var normMat = function (t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^optativa:\s*/, '').replace(/\s*\(div\.?\)\s*$/, '').trim(); };
  function assignaSubgrups(niv) {
    var sgs = subgrupsNiv(niv), dig = niv.charAt(0), fets = 0;
    var troba = function (re, lletres) { var c = sgs.filter(function (x) { return re.test(x.nom.toUpperCase()) && (!lletres || x.grups.slice().sort().join('') === lletres.slice().sort().join('')); }); return c.length === 1 ? c[0] : null; };
    Object.keys(S.ses).forEach(function (k) { var a = S.ses[k]; if (a.nivell !== niv || a.parts.length !== 1 || a.codo_de) return; var p = a.parts[0], m = normMat(a.materia), L = a.classes.map(function (g) { return g.slice(niv.length).trim(); }), x = null;
      var div = /\(div\.?\)/i.test(a.materia), teDiv = Object.keys(S.ses).some(function (j) { return S.ses[j].nivell === niv && /\(div\.?\)/i.test(S.ses[j].materia) && normMat(S.ses[j].materia) === m; });
      if (CODIS_DIV[m] && (div || teDiv)) x = troba(new RegExp('^' + CODIS_DIV[m] + dig + '-' + (div ? '[A-Z]+-DIV' : L.join('')) + '$'), L);
      else if (/^optativa/i.test(a.materia)) { var c = CODIS_OPT.filter(function (q) { return q[0].test(m); })[0]; if (c) x = troba(new RegExp('^O' + c[1] + dig + '$')); }
      if (x && p.grup !== x.id) { p.grup = x.id; S.sesBrut[k] = true; fets++; } });
    return fets;
  }
  // Proposa blocs: diversitat (matèria + matèria (div.) dels mateixos grups-classe), optatives i hores B (G1/G2 amb matèries diferents)
  function proposaBlocs(niv) {
    var BD = blocDe(), pn = partsNiv(niv).filter(function (x) { return !BD[x.k]; }), sg = sgPerId(), nous = 0;
    var crea = function (nom, tipus, xs, dia) { if (xs.length < 2) return; S.subg.blocs.push({ id: nouCodiSg('B', S.subg.blocs), nivell: niv, nom: nom, tipus: tipus, parts: xs.map(function (x) { return x.k; }), mateix_dia: dia || '' }); xs.forEach(function (x) { BD[x.k] = 1; }); nous++; };
    var lliure = function (x) { return !BD[x.k]; };
    // Diversitat
    pn.filter(function (x) { return /\(div\.?\)/i.test(x.a.materia); }).forEach(function (d) { if (!lliure(d)) return;
      var base = normMat(d.a.materia), xs = [d].concat(pn.filter(function (x) { return lliure(x) && x !== d && !/\(div\.?\)/i.test(x.a.materia) && normMat(x.a.materia) === base && x.a.classes.length === 1 && d.a.classes.indexOf(x.a.classes[0]) >= 0 && x.p.hores === d.p.hores; }));
      crea(d.a.materia.replace(/\s*\(div\.?\)\s*$/i, '') + ' ' + d.a.classes.map(function (g) { return g.slice(niv.length).trim(); }).join(''), 'diversitat', xs); });
    // Optatives (per hores)
    var opt = {}; pn.filter(function (x) { return lliure(x) && (/^optativa/i.test(x.a.materia) || (sg[x.p.grup] || {}).tipus === 'optativa'); }).forEach(function (x) { (opt[x.p.hores] = opt[x.p.hores] || []).push(x); });
    Object.keys(opt).forEach(function (h) { crea('Optatives ' + niv, 'optativa', opt[h]); });
    // Hores B: per grup-classe, parts de G1 amb parts de G2 de matèria diferent (rotació)
    var perClasse = {}; pn.filter(function (x) { return lliure(x) && (sg[x.p.grup] || {}).tipus === 'hores_b'; }).forEach(function (x) { var s = sg[x.p.grup], c = s.grups.join(''); (perClasse[c] = perClasse[c] || {})[s.nom] = ((perClasse[c] || {})[s.nom] || []).concat([x]); });
    // Rotació: amb les matèries en el mateix ordre, la de G1 en posició i va amb la de G2 en posició i+1 (Exp/Tec, Tec/Ang, Ang/Exp)
    Object.keys(perClasse).forEach(function (c) { var noms = Object.keys(perClasse[c]).sort(); if (noms.length < 2) return;
      var ord = function (ll) { return ll.slice().sort(function (x, y) { return x.a.materia.localeCompare(y.a.materia, 'ca'); }); }, A = ord(perClasse[c][noms[0]]), B = ord(perClasse[c][noms[1]]), n = A.length;
      if (n !== B.length || A.some(function (x, i) { return x.a.materia !== B[i].a.materia || x.p.hores !== B[i].p.hores; })) { A.forEach(function (x) { var y = B.filter(function (z) { return z.a.materia !== x.a.materia && z.p.hores === x.p.hores && lliure(z); })[0]; if (y) crea('Hores B ' + niv + ' ' + c + ' ' + x.a.materia, 'hores_b', [x, y], 'B ' + niv + ' ' + c); }); return; }
      A.forEach(function (x, i) { var y = B[(i + 1) % n]; if (n > 1) crea('Hores B ' + niv + ' ' + c + ' ' + (i + 1), 'hores_b', [x, y], 'B ' + niv + ' ' + c); }); });
    return nous;
  }
  // Hores B d'una assignació: grup sencer (hores − B) + G1 (B/2) + G2 (B/2)
  function parteixB(a) {
    var m = S.hor.materies.filter(function (y) { return y.nivell === a.nivell && y.materia === a.materia; })[0], hb = m ? m.hores_b : 0, L = a.classes[0].slice(a.nivell.length).trim();
    var gs = subgrupsNiv(a.nivell).filter(function (x) { return x.tipus === 'hores_b' && x.grups.length === 1 && x.grups[0] === L; }).sort(function (x, y) { return x.nom.localeCompare(y.nom); });
    if (!(hb > 0) || hb % 2) return toast('Aquesta matèria no té un nombre parell d’hores B al currículum.', true);
    if (gs.length < 2) return toast('Falten els subgrups d’hores B de ' + a.classes[0] + ' (pestanya Subgrups).', true);
    var p0 = a.parts[0], h0 = a.hores - hb, nova = function (id, g, h) { return { id: id, grup: g, hores: h, distribucio: '1'.repeat(h), aula: p0.aula, conjunt: p0.conjunt, fixes: [], prohibides: [] }; };
    a.parts = (h0 > 0 ? [Object.assign(p0, { grup: a.classes[0], hores: h0, distribucio: '1'.repeat(h0), fixes: [], prohibides: [] })] : []).concat([nova('P' + (h0 > 0 ? 2 : 1), gs[0].id, hb / 2), nova('P' + (h0 > 0 ? 3 : 2), gs[1].id, hb / 2)]);
    S.sesBrut[a.id] = true;
  }
  // Canvis i clics de les pestanyes Subgrups i Sessions lectives (retorna true si s'ha gestionat)
  function canviSubSes(x, canvia) {
    var tab = S.horTab;
    if (tab === 'subgrups') {
      var cl = x.closest('tr[data-cl]'); if (cl) { var g = cl.dataset.cl, o = S.subg.classes[g] = S.subg.classes[g] || { nom: '', clau: '' }; o[x.dataset.k] = x.value.trim(); return canvia(false, 'subgrups') || true; }
      var tr = x.closest('tr[data-sg]'); if (tr) { var s = S.subg.subgrups[Number(tr.dataset.sg)];
        if (x.dataset.k === 'grup') s.grups = [].filter.call(tr.querySelectorAll('input[data-k="grup"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
        else if (x.dataset.k === 'itin') s.itineraris = [].filter.call(tr.querySelectorAll('input[data-k="itin"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });   // PAS 76
        else s[x.dataset.k] = x.value.trim();
        return canvia(x.dataset.k === 'tipus' || x.dataset.k === 'grup', 'subgrups') || true; }
    } else if (tab === 'sessions') {
      var dd = x.closest('[data-dd]'); if (dd) { var r = S.subg.dies_diferents[Number(dd.dataset.dd)]; if (x.dataset.k === 'afegeix') { if (x.value) r.parts.push(x.value); } else r[x.dataset.k] = x.value.trim(); return canvia(x.dataset.k === 'afegeix', 'subgrups') || true; }
      var bs = x.closest('[data-bs]'); if (bs) { var b = S.subg.blocs[Number(bs.dataset.bs)]; if (x.dataset.k === 'afegeix') { if (x.value) b.parts.push(x.value); } else if (x.dataset.k === 'hores') b.hores = Number(x.value) > 0 ? Math.round(Number(x.value)) : ''; else b[x.dataset.k] = x.value.trim(); return canvia(x.dataset.k === 'afegeix' || x.dataset.k === 'hores' || x.dataset.k === 'distribucio', 'subgrups') || true; }
      var ts = x.closest('tr[data-ses]'); if (ts && x.dataset.k) { var a = S.ses[ts.dataset.ses], p = a.parts.filter(function (q) { return q.id === ts.dataset.part; })[0];
        if (x.dataset.k === 'hores') { var h = Math.max(0.5, Number(x.value) || 0), d = h - p.hores; p.hores = h; p.distribucio = h === Math.round(h) ? '1'.repeat(h) : ''; if (a.parts.length > 1 && d && p !== a.parts[0]) { a.parts[0].hores = Math.max(0, a.parts[0].hores - d); a.parts[0].distribucio = '1'.repeat(Math.round(a.parts[0].hores)); } }
        else p[x.dataset.k] = x.dataset.k === 'distribucio' ? x.value.trim() : x.value;
        S.sesBrut[a.id] = true; return canvia(true) || true; }
    }
    return false;
  }
  function clicSubSes(a, b, canvia, ed) {
    var niv = S.horNiv;
    if (a === 'graella-ses') { var tr = b.closest('tr'), xs = S.ses[tr.dataset.ses], p = xs.parts.filter(function (q) { return q.id === tr.dataset.part; })[0];
      editaGraella('Graella · ' + xs.nivell + ' · ' + xs.materia + ' · ' + (p.grup ? nomGrup(p.grup) : xs.grup), p, (p.distribucio || '').length || Math.round(p.hores), ed).then(function (g) { if (!g) return; p.fixes = g.fixes; p.prohibides = g.prohibides; S.sesBrut[xs.id] = true; canvia(true); }); return true; }
    if (!ed) return false;
    var tr2 = b.closest('tr[data-ses]'), A = tr2 ? S.ses[tr2.dataset.ses] : null, P = A ? A.parts.filter(function (q) { return q.id === tr2.dataset.part; })[0] : null;
    if (a === 'parteix') { if (!(P.hores > 1)) { toast('Una part ha de tenir almenys 2 h per partir-la.', true); return true; } var mx = 0; A.parts.forEach(function (q) { var m = /^P(\d+)$/.exec(q.id); if (m) mx = Math.max(mx, Number(m[1])); });
      P.hores -= 1; P.distribucio = '1'.repeat(Math.round(P.hores)); A.parts.splice(A.parts.indexOf(P) + 1, 0, { id: 'P' + (mx + 1), grup: '', hores: 1, distribucio: '1', aula: P.aula, conjunt: P.conjunt, fixes: [], prohibides: [] }); S.sesBrut[A.id] = true; canvia(true); return true; }
    if (a === 'treu-part') { A.parts[0].hores += P.hores; A.parts[0].distribucio = '1'.repeat(Math.round(A.parts[0].hores)); A.parts.splice(A.parts.indexOf(P), 1);
      S.subg.blocs.concat(S.subg.dies_diferents || []).forEach(function (bl) { bl.parts = bl.parts.filter(function (k) { return k !== A.id + '#' + P.id; }); }); S.sesBrut[A.id] = true; S.horBrut.subgrups = true; canvia(true); return true; }
    if (a === 'parteix-b') { parteixB(A); canvia(true); return true; }
    if (a === 'aplica-materia') { Object.keys(S.ses).forEach(function (k) { var y = S.ses[k]; if (y === A || y.nivell !== A.nivell || y.id_materia !== A.id_materia || y.materia !== A.materia || y.hores !== A.hores) return;
        var L0 = A.classes.length === 1 ? A.classes[0].slice(A.nivell.length).trim() : '', L1 = y.classes.length === 1 ? y.classes[0].slice(y.nivell.length).trim() : '';
        // el grup equivalent: el mateix grup-classe de la fila, o el subgrup del mateix tipus amb el nom canviant la lletra
        var equiv = function (g) { if (!g) return ''; if (g === A.classes[0]) return y.classes[0] || ''; var s = sgPerId()[g]; if (!s || !L0 || !L1) return '';
          var nom = s.nom.replace(new RegExp(L0 + '(?=-|$)'), L1), c = subgrupsNiv(y.nivell).filter(function (z) { return z.nom === nom; })[0]; return c ? c.id : ''; };
        y.parts = A.parts.map(function (q) { return { id: q.id, grup: equiv(q.grup), hores: q.hores, distribucio: q.distribucio, aula: q.aula, conjunt: q.conjunt, fixes: q.fixes.slice(), prohibides: q.prohibides.slice() }; }); S.sesBrut[k] = true; });
      canvia(true); return true; }
    if (a === 'assigna-sg') { var n = assignaSubgrups(niv); toast(n ? n + ' parts amb subgrup. Reviseu-ho i deseu.' : 'No s’ha trobat cap subgrup per assignar (calen els subgrups a la pestanya Subgrups).', !n); if (n) canvia(true); return true; }
    if (a === 'proposa-bs') { var nb = proposaBlocs(niv); toast(nb ? nb + ' blocs proposats. Reviseu-los i deseu.' : 'No hi ha cap bloc nou per proposar (cal que les parts tinguin el seu subgrup).', !nb); if (nb) canvia(true, 'subgrups'); return true; }
    if (a === 'proposa-dd') { var nd = proposaDiesDiferents(niv); toast(nd ? nd + ' regles proposades. Reviseu-les i deseu.' : 'No hi ha cap regla nova per proposar (cal que les matèries tinguin part del grup-classe i parts de subgrups).', !nd); if (nd) canvia(true, 'subgrups'); return true; }
    if (a === 'nou-dd') { S.subg.dies_diferents.push({ id: nouCodiSg('D', S.subg.dies_diferents), nivell: niv, nom: '', parts: [] }); canvia(true, 'subgrups'); return true; }
    if (a === 'treu-dd') { S.subg.dies_diferents.splice(Number(b.closest('[data-dd]').dataset.dd), 1); canvia(true, 'subgrups'); return true; }
    if (a === 'treu-de-dd') { var r2 = S.subg.dies_diferents[Number(b.closest('[data-dd]').dataset.dd)], k3 = b.closest('li').dataset.k; r2.parts = r2.parts.filter(function (k) { return k !== k3; }); canvia(true, 'subgrups'); return true; }
    if (a === 'nou-bs') { S.subg.blocs.push({ id: nouCodiSg('B', S.subg.blocs), nivell: niv, nom: '', tipus: 'diversitat', parts: [], mateix_dia: '' }); canvia(true, 'subgrups'); return true; }
    if (a === 'treu-bs') { S.subg.blocs.splice(Number(b.closest('[data-bs]').dataset.bs), 1); canvia(true, 'subgrups'); return true; }
    if (a === 'treu-de-bloc') { var bl2 = S.subg.blocs[Number(b.closest('[data-bs]').dataset.bs)], k2 = b.closest('li').dataset.k; bl2.parts = bl2.parts.filter(function (k) { return k !== k2; }); canvia(true, 'subgrups'); return true; }
    if (a === 'nou-sg') { S.subg.subgrups.push({ id: nouCodiSg('S', S.subg.subgrups), nivell: niv, nom: '', clau: '', tipus: 'diversitat', grups: [] }); canvia(true, 'subgrups'); return true; }
    if (a === 'treu-sg') { var s2 = S.subg.subgrups[Number(b.closest('tr').dataset.sg)]; S.subg.subgrups.splice(S.subg.subgrups.indexOf(s2), 1);
      Object.keys(S.ses).forEach(function (k) { S.ses[k].parts.forEach(function (q) { if (q.grup === s2.id) { q.grup = ''; S.sesBrut[k] = true; } }); }); canvia(true, 'subgrups'); return true; }
    return false;
  }
  // PAS 55 · Claus de Clickedu del professorat a partir de la llista del professorat de Peñalara (CSV amb «;»):
  // Profesores; Abreviatura; Nombre largo; Clave externa; …; Guardias; Guardias en recreos …
  var normPersona = function (t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); };
  function llegeixCsvProfessorat(buf) {
    var txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('windows-1252').decode(buf); }
    var ll = txt.split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (l) { return l.split(';'); }); if (!ll.length) return null;
    var cap = ll[0].map(normAula), c = function (re) { for (var i = 0; i < cap.length; i++) if (re.test(cap[i])) return i; return -1; };
    var iN = c(/^PROFESORES?$/), iL = c(/^NOMBRELARGO$/), iK = c(/^CLAVEEXTERNA$/), iG = c(/^GUARDIAS$/), iR = c(/^GUARDIASENRECREOS$/);
    if (iK < 0 || (iL < 0 && iN < 0)) return null;
    return ll.slice(1).map(function (r) { var cel = function (i) { return i >= 0 ? String(r[i] || '').trim() : ''; };
      return { nom: cel(iL) || cel(iN), curt: cel(iN), clau: cel(iK), guardies: Number(cel(iG)) || 0, recreos: Number(cel(iR)) || 0 }; }).filter(function (x) { return x.nom && x.clau; });
  }
  function importaClausProfessorat(ll) {
    // GESTIO: «Cognoms, Nom» → «nom cognoms»; Peñalara: «Nom Cognom1 Cognom2» (o només un cognom)
    var gest = Object.keys(S.hprof).map(function (k) { var p = S.hprof[k], m = /^(.*), (.*)$/.exec(p.nom); return { p: p, n: normPersona(m ? m[2] + ' ' + m[1] : p.nom) }; });
    var troba = function (x) { var n = normPersona(x.nom), c = gest.filter(function (g) { return g.n === n; });
      if (c.length !== 1) c = gest.filter(function (g) { var a = g.n.split(' '), b = n.split(' '); return a.length >= 2 && b.length >= 2 && a[0] === b[0] && a[1] === b[1]; });
      return c.length === 1 ? c[0].p : null; };
    var files = ll.map(function (x) { return { x: x, p: troba(x) }; }), trobats = files.filter(function (f) { return f.p; }), usats = {};
    trobats.forEach(function (f) { usats[f.p.id] = 1; });
    var sense = Object.keys(S.hprof).filter(function (k) { return !usats[k]; }).map(function (k) { return S.hprof[k].nom; });
    pregunta('Claus de Clickedu del professorat', '<p>' + ll.length + ' docents al fitxer: <b>' + trobats.length + '</b> trobats a GESTIO pel nom.</p>' +
      '<div class="gs-comprova"><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Al fitxer</th><th class="gs-cen">Clau</th><th>A GESTIO</th><th class="gs-cen">Guàrdies · esbarjo</th></tr></thead><tbody>' +
      files.map(function (f) { return '<tr' + (f.p ? '' : ' class="gs-gris"') + '><td>' + esc(f.x.nom) + '</td><td class="gs-cen">' + esc(f.x.clau) + '</td><td>' + (f.p ? esc(f.p.nom) + (f.p.clau_clickedu && f.p.clau_clickedu !== f.x.clau ? ' <span class="is-pend">(abans ' + esc(f.p.clau_clickedu) + ')</span>' : '') : '— no trobat') + '</td><td class="gs-cen">' + f.x.guardies + ' · ' + f.x.recreos + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (sense.length ? '<p class="prog-avis">Docents de GESTIO que no són al fitxer (es queden sense clau): ' + esc(sense.join('; ')) + '</p>' : '') +
      '<label class="gs-check"><input type="checkbox" id="gsCkGuard"> Posa també les guàrdies del fitxer: «Guardias» → ordinàries i «Guardias en recreos» → pati (les de biblioteca, a mà)</label>' +
      '<p>Res no es desa fins que premeu <strong>Desa</strong>.</p>',
      [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Aplica', valor: 1, abans: function () { importaClausProfessorat.g = $('gsCkGuard').checked; } }], false).then(function (v) {
      if (!v) return;
      trobats.forEach(function (f) { f.p.clau_clickedu = f.x.clau; if (importaClausProfessorat.g) f.p.guardies = { o: f.x.guardies, b: (f.p.guardies || {}).b || 0, p: f.x.recreos }; S.hprofBrut[f.p.id] = true; });
      S.horBrut.professorat = true; S.brut = true; pintaHoraris(); toast('Claus de Clickedu posades a ' + trobats.length + ' docents. Reviseu-les i premeu Desa.');
    });
  }

  // PAS 55 · Pestanya Guàrdies: quantes guàrdies de cada tipus calen a cada franja (ordinàries a les lectives; biblioteca i pati a
  // l'esbarjo) i quantes en fa cada docent. Cobertura = guàrdies del professorat enfront de les demanades.
  var TG = { o: 'Ordinàries', b: 'Biblioteca', p: 'Pati' };
  var totalsGuardies = function () {
    var dem = { o: 0, b: 0, p: 0 }, of = { o: 0, b: 0, p: 0 }, D = S.guard.demanda;
    Object.keys(D).forEach(function (k) { ['o', 'b', 'p'].forEach(function (g) { dem[g] += Number((D[k] || {})[g]) || 0; }); });
    Object.keys(S.hprof).forEach(function (k) { var g = S.hprof[k].guardies || {}; ['o', 'b', 'p'].forEach(function (t) { of[t] += Number(g[t]) || 0; }); });
    return { dem: dem, of: of };
  };
  function htmlGuardies(ed) {
    var M = S.marc, D = S.guard.demanda, dis = ed ? '' : ' disabled', T = totalsGuardies();
    var inp = function (k, g) { var v = (D[k] || {})[g] || ''; return '<label class="gs-hor__gq gs-hor__gq--' + g + '" title="' + TG[g] + '"><span>' + TG[g].charAt(0) + '</span><input type="number" min="0" max="30" data-pos="' + k + '" data-g="' + g + '" value="' + esc(v) + '"' + dis + '></label>'; };
    var graella = '<table class="gs-hor__grid gs-hor__grid--guard"><thead><tr><th>Franja</th>' + M.dies.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '<th class="gs-cen">Total</th></tr></thead><tbody>' + M.franges.map(function (f) {
      var tot = 0; M.dies.forEach(function (d) { var x = D[d + ' ' + f.id] || {}; tot += (Number(x.o) || 0) + (Number(x.b) || 0) + (Number(x.p) || 0); });
      return '<tr class="' + (f.esbarjo ? 'is-esb' : '') + '"><th>' + esc(f.id) + ' <small>' + esc(f.inici) + '–' + esc(f.fi) + '</small></th>' + M.dies.map(function (d) { var k = d + ' ' + f.id;
        return '<td>' + (f.esbarjo ? inp(k, 'b') + inp(k, 'p') : inp(k, 'o')) + '</td>'; }).join('') + '<td class="gs-cen">' + (tot || '') + '</td></tr>'; }).join('') + '</tbody></table>';
    var omple = ed ? '<p class="gs-form-fila">Omple totes les caselles: <label>ordinàries <input type="number" id="gsGO" min="0" max="30" style="width:4em"></label><label>biblioteca <input type="number" id="gsGB" min="0" max="30" style="width:4em"></label><label>pati <input type="number" id="gsGP" min="0" max="30" style="width:4em"></label><button type="button" class="gs-enllac" data-a="omple-guard">Aplica</button></p>' : '';
    var esps = {}; Object.keys(S.hprof).forEach(function (k) { if (S.hprof[k].especialitat) esps[S.hprof[k].especialitat] = 1; });
    var ll = Object.keys(S.hprof).map(function (k) { return S.hprof[k]; }).filter(function (p) { return !S.horEsp || p.especialitat === S.horEsp; });
    var resum = '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-hor__gcob"><thead><tr><th>Tipus</th><th class="gs-cen">Demanades (graella)</th><th class="gs-cen">Del professorat</th><th class="gs-cen">Cobertura</th></tr></thead><tbody>' +
      ['o', 'b', 'p'].map(function (g) { var d = T.dem[g], o = T.of[g], ok = o === d;
        return '<tr><td>' + TG[g] + (g === 'o' ? ' <small class="gs-gris">(franges lectives)</small>' : ' <small class="gs-gris">(esbarjo)</small>') + '</td><td class="gs-cen">' + d + '</td><td class="gs-cen">' + o + '</td><td class="gs-cen ' + (ok ? 'is-ok' : 'is-pend') + '">' + (ok ? '✓ cobertes' : o < d ? '⚠ en falten ' + (d - o) : '⚠ ' + (o - d) + ' de més') + '</td></tr>'; }).join('') + '</tbody></table>';
    return '<section class="gs-hor__sec"><h3 class="gs-amon__tit">1 · Guàrdies que calen a cada franja</h3><p class="gs-gris"><b>O</b> = ordinàries (franges lectives) · <b>B</b> = biblioteca i <b>P</b> = pati (esbarjo). Escriviu quants docents de guàrdia calen a cada casella.</p>' + omple + graella + '</section>' +
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">2 · Cobertura</h3>' + resum + '<p class="gs-gris">La cobertura de cada franja concreta la calcularà el motor en fer l’horari (cada docent fa les seves guàrdies en franges on no té classe).</p></section>' +
      '<section class="gs-hor__sec"><h3 class="gs-amon__tit">3 · Guàrdies de cada docent</h3><div class="gs-form-fila"><label>Especialitat <select data-a="esp-prof"><option value="">Totes</option>' + Object.keys(esps).sort(function (a, b) { return a.localeCompare(b, 'ca'); }).map(function (e) { return '<option' + (e === S.horEsp ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></label></div>' +
        '<table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta gs-hor__gprof"><thead><tr><th>Docent</th><th>Especialitat</th><th class="gs-cen">Hores assignades</th><th class="gs-cen">Ordinàries</th><th class="gs-cen">Biblioteca</th><th class="gs-cen">Pati</th></tr></thead><tbody>' +
        ll.map(function (p) { var g = p.guardies || {}; return '<tr data-prof="' + esc(p.id) + '"' + (S.hprofBrut[p.id] ? ' class="is-brut"' : '') + '><td>' + esc(p.nom) + '</td><td>' + esc(p.especialitat || '—') + '</td><td class="gs-cen">' + fmtH(p.hores_assignades) + '</td>' +
          ['o', 'b', 'p'].map(function (t) { return '<td class="gs-cen"><input type="number" min="0" max="20" data-gd="' + t + '" value="' + esc(g[t] || '') + '" style="width:4em"' + dis + '></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></section>';
  }
  function canviGuardies(x, canvia) {
    if (x.dataset.a === 'esp-prof') { S.horEsp = x.value; setTimeout(pintaHoraris, 0); return true; }
    if (x.dataset.pos && x.dataset.g) { var D = S.guard.demanda, k = x.dataset.pos, n = Math.max(0, Math.round(Number(x.value) || 0)); D[k] = D[k] || {}; if (n) D[k][x.dataset.g] = n; else delete D[k][x.dataset.g]; if (!Object.keys(D[k]).length) delete D[k]; canvia(true, 'guardies'); return true; }
    var tr = x.closest('tr[data-prof]'); if (tr && x.dataset.gd) { var p = S.hprof[tr.dataset.prof]; p.guardies = p.guardies || { o: 0, b: 0, p: 0 }; p.guardies[x.dataset.gd] = Math.max(0, Math.round(Number(x.value) || 0)); S.hprofBrut[p.id] = true; canvia(true, 'professorat'); return true; }
    return false;
  }
  function ompleGuardies() {
    var M = S.marc, D = S.guard.demanda, v = { o: $('gsGO').value, b: $('gsGB').value, p: $('gsGP').value };
    M.franges.forEach(function (f) { M.dies.forEach(function (d) { var k = d + ' ' + f.id; (f.esbarjo ? ['b', 'p'] : ['o']).forEach(function (g) { if (v[g] === '') return; var n = Math.max(0, Math.round(Number(v[g]) || 0)); D[k] = D[k] || {}; if (n) D[k][g] = n; else delete D[k][g]; if (!Object.keys(D[k]).length) delete D[k]; }); }); });
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
        if (canviSubSes(x, canvia)) return;
      } else if (tab === 'guardies') {
        if (canviGuardies(x, canvia)) return;
      } else if (tab === 'reunions') {
        if (canviReunions(x, canvia)) return;
      } else if (tab === 'professorat') {
        if (x.dataset.a === 'esp-prof') { S.horEsp = x.value; return setTimeout(pintaHoraris, 0); }
        var tp = x.closest('tr[data-prof]'); if (tp && x.dataset.k) { S.hprof[tp.dataset.prof][x.dataset.k] = x.value; S.hprofBrut[tp.dataset.prof] = true; return canvia(false); }
      } else if (tab === 'subgrups') {
        if (canviSubSes(x, canvia)) return;
      } else {
        if (x.dataset.t) { RG.toves[x.dataset.t] = x.type === 'checkbox' ? x.checked : x.dataset.t === 'max_hores_seguides_materia' ? Number(x.value) || 1 : Math.max(0, Number(x.value) || 0); return canvia(true); }
        if (x.dataset.pes) { RG.toves.pesos[x.dataset.pes] = Number(x.value); return canvia(true); }
      }
    });
    cos.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      // PAS 57 · reunions
      if (b.dataset.a === 'nova-reunio') { S.reun.push({ id: '', nom: 'Reunió ' + (S.reun.length + 1), nivell: '', hores: 1, franja: '', docents: [] }); return canvia(true, 'reunions'); }
      if (b.dataset.a === 'treu-reunio') { S.reun.splice(Number(b.closest('tr').dataset.re), 1); return canvia(true, 'reunions'); }
      if (b.dataset.a === 'treu-docent-re') { var rr = S.reun[Number(b.closest('tr').dataset.re)]; rr.docents = rr.docents.filter(function (d) { return d !== b.dataset.d; }); return canvia(true, 'reunions'); }
      if (b.dataset.a === 'proposa-reunions') {
        var pr = S.hor.reunions_proposta || [];
        if (!pr.length) return toast('No hi ha tutors/es al Currículum (matèria Tutoria) ni coordinacions de nivell a Ocupació.', true);
        S.reun = JSON.parse(JSON.stringify(pr)); toast(pr.length + ' reunions proposades: reviseu-les i deseu.'); return canvia(true, 'reunions');
      }
      if (b.dataset.a === 'niv') { S.horNiv = b.dataset.niv; return pintaHoraris(); }
      if (clicSubSes(b.dataset.a, b, canvia, ed)) return;
      if (b.dataset.a === 'omple-guard' && ed) { ompleGuardies(); return canvia(true, 'guardies'); }
      if (b.dataset.a === 'graella-prof') { var xp = S.hprof[b.closest('tr').dataset.prof]; return editaGraella('Graella · ' + xp.nom, xp, 0, ed).then(function (g) { if (!g) return; xp.fixes = g.fixes; xp.prohibides = g.prohibides; S.hprofBrut[xp.id] = true; canvia(true); }); }
      if (!ed) return;
      var a = b.dataset.a, ult = M.franges[M.franges.length - 1], ini = ult ? ult.fi : '08:00', mes = function (t, m) { var v = hm(t) + m; return ('0' + Math.floor(v / 60)).slice(-2) + ':' + ('0' + v % 60).slice(-2); };
      if (a === 'nova-franja') M.franges.push({ id: '', inici: ini, fi: mes(ini, 60) });
      else if (a === 'nou-esbarjo') M.franges.push({ id: '', inici: ini, fi: mes(ini, 30), esbarjo: true });
      else if (a === 'treu-franja') M.franges.splice(Number(b.closest('tr').dataset.i), 1);
      else if (a === 'ordena-au') { var ko = b.dataset.k, o = S.auOrdre = S.auOrdre && S.auOrdre.k === ko ? { k: ko, dir: -S.auOrdre.dir } : { k: ko, dir: 1 };
        A.aules.sort(function (x, y) { var u = x[ko], v = y[ko]; if (ko === 'capacitat' || ko === 'clau_clickedu') { var nu = Number(u), nv = Number(v); if (!isNaN(nu) && !isNaN(nv) && u !== '' && v !== '') return (nu - nv) * o.dir; }
          return String(u || '').localeCompare(String(v || ''), 'ca', { numeric: true }) * o.dir; }); return pintaHoraris(); }
      else if (a === 'nova-aula') A.aules.push({ id: '', nom: '', tipus: 'ordinaria', capacitat: 30 });
      else if (a === 'treu-aula') A.aules.splice(Number(b.closest('tr').dataset.au), 1);
      else if (a === 'nou-conjunt') A.conjunts.push({ id: nouCodiConjunt(), nom: '', aules: [] });
      else if (a === 'treu-conjunt') A.conjunts.splice(Number(b.closest('[data-cj]').dataset.cj), 1);
      else if (a === 'proposa-conjunts') S.hor.tipus_aula.forEach(function (t) { var ll = A.aules.filter(function (x) { return x.tipus === t && x.id; }).map(function (x) { return x.id; }); if (ll.length > 1 && !A.conjunts.some(function (c) { return c.nom === 'Aules: ' + NOMS_AULA[t].toLowerCase(); })) A.conjunts.push({ id: nouCodiConjunt(), nom: 'Aules: ' + NOMS_AULA[t].toLowerCase(), aules: ll }); });
      else return;
      if (tab === 'marc') renumeraFranges();
      canvia(true, tab === 'subgrups' ? 'blocs' : undefined);
    });
    if ($('gsProfImp')) $('gsProfImp').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      f.arrayBuffer().then(function (buf) { var ll = llegeixCsvProfessorat(buf); if (!ll || !ll.length) return toast('Aquest fitxer no és la llista del professorat de Peñalara (CSV amb «Clave externa»).', true); importaClausProfessorat(ll); });
    });
    if ($('gsGrupsImp')) $('gsGrupsImp').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      f.arrayBuffer().then(function (buf) { var G = /\.csv$/i.test(f.name) ? llegeixCsvGrups(buf) : llegeixGhcGrups(buf); if (!G || !(G.classes.length + G.subgrups.length)) return toast('Aquest fitxer no és una llista de grups o subgrups de Peñalara (CSV) ni una exportació de Clickedu (XML).', true); importaGrupsClickedu(G); });
    });
    if ($('gsAulesImp')) $('gsAulesImp').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      f.arrayBuffer().then(function (buf) { var G = /\.csv$/i.test(f.name) ? llegeixCsvAules(buf) : llegeixGHC(buf); if (!G || !G.aules.length) return toast('Aquest fitxer no és una exportació de Clickedu (XML, format GHC) ni una llista d’aules de Peñalara (CSV) amb claus.', true); importaClausAules(G); });
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
  // PAS 65 · Desa un JSON triant on (File System Access API: Chrome i Edge). Torna el nom desat, '' si ha anat a Baixades
  // o null si s'ha cancel·lat.
  function desaJsonTria(obj, nom) {
    if (!window.showSaveFilePicker) { baixaJson(obj, nom); return Promise.resolve(''); }
    return window.showSaveFilePicker({ suggestedName: nom, id: 'gestio-horaris', startIn: 'downloads', types: [{ description: 'Dades per al motor (JSON)', accept: { 'application/json': ['.json'] } }] })
      .then(function (h) { return h.createWritable().then(function (w) { return w.write(JSON.stringify(obj, null, 1)).then(function () { return w.close(); }); }).then(function () { return h.name; }); })
      .catch(function (e) { if (e && e.name === 'AbortError') return null; baixaJson(obj, nom); return ''; });
  }
  var baixaJson = function (obj, nom) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })); a.download = nom; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  // Desa totes les pestanyes amb canvis
  function desaHoraris() {
    var parts = [['marc', errorsMarc, 'horaris_marc_desa', function () { return { marc: marcNet() }; }, function (r) { S.hor.marc = r.marc; S.hor.per_defecte = false; }],
      ['aules', errorsAules, 'horaris_aules_desa', function () { return { aules: S.aules }; }, function (r) { S.aules = r.aules; S.hor.aules = JSON.parse(JSON.stringify(r.aules)); S.hor.aules_per_defecte = false; }],
      ['regles', errorsRegles, 'horaris_regles_desa', function () { return { regles: S.regles }; }, function (r) { S.regles = r.regles; S.hor.regles = JSON.parse(JSON.stringify(r.regles)); S.hor.regles_per_defecte = false; if (r.regles_motor) S.hor.regles_motor = r.regles_motor; }],
      ['subgrups', errorsSubgrups, 'horaris_subgrups_desa', function () { var pp = {}; Object.keys(S.sesBrut).forEach(function (id) { pp[id] = S.ses[id].parts; }); return { subgrups: S.subg, parts: pp }; }, function (r) { S.subg = r.subgrups; S.hor.subgrups = JSON.parse(JSON.stringify(r.subgrups)); }],
      ['sessions', errorsSessions, 'horaris_sessions_desa', function () { return { canvis: Object.keys(S.sesBrut).map(function (id) { return { id: id, parts: S.ses[id].parts }; }) }; }, function () { Object.keys(S.sesBrut).forEach(function (id) { var o = S.hor.sessions.filter(function (x) { return x.id === id; })[0]; if (o) o.parts = JSON.parse(JSON.stringify(S.ses[id].parts)); }); S.sesBrut = {}; }],
      ['reunions', function () { return errorsReunions(); }, 'horaris_reunions_desa', function () { return { reunions: S.reun }; }, function (r) { S.reun = JSON.parse(JSON.stringify(r.reunions.reunions)); S.hor.reunions = r.reunions; }],
      ['guardies', function () { return []; }, 'horaris_guardies_desa', function () { return { guardies: S.guard }; }, function (r) { S.guard = r.guardies; S.hor.guardies = JSON.parse(JSON.stringify(r.guardies)); }],
      ['professorat', function () { return []; }, 'horaris_professorat_desa', function () { return { canvis: Object.keys(S.hprofBrut).map(function (id) { var x = S.hprof[id]; return { id: id, fixes: x.fixes, prohibides: x.prohibides, observacions: x.observacions, clau_clickedu: x.clau_clickedu, guardies: x.guardies }; }) }; }, function () { Object.keys(S.hprofBrut).forEach(function (id) { S.hor.professorat.forEach(function (x, i) { if (x.id === id) S.hor.professorat[i] = JSON.parse(JSON.stringify(S.hprof[id])); }); }); S.hprofBrut = {}; }]];
    var pend = parts.filter(function (p) { return S.horBrut[p[0]] || (p[0] === 'regles' && S.horBrut.blocs) || (p[0] === S.horTab && { marc: S.hor.per_defecte, aules: S.hor.aules_per_defecte, regles: S.hor.regles_per_defecte }[p[0]]); });
    if (!pend.length) return toast('No hi ha canvis.');
    for (var i = 0; i < pend.length; i++) { var e = pend[i][1](); if (e.length) { S.horTab = pend[i][0]; pintaHoraris(); return toast('Hi ha errors: ' + e[0], true); } }
    var seg = function (k) {
      if (k >= pend.length) { S.brut = false; S.horBrut.blocs = false; if (S.horRecarrega) { S.horRecarrega = false; carregaHoraris(); } else pintaHoraris(); return toast('Desat: ' + pend.map(function (p) { return { marc: 'marc horari', aules: 'aules', regles: 'regles i blocs', subgrups: 'subgrups i blocs simultanis', guardies: 'guàrdies', reunions: 'reunions', sessions: 'sessions lectives', professorat: 'professorat' }[p[0]]; }).join(', ') + '.'); }
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
      var nom = 'horaris-dades-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2') + '.json';
      var resum = r.dades.assignacions.length + ' assignacions, ' + r.dades.docents.length + ' docents, ' + (r.dades.aules || []).length + ' aules';
      // PAS 65 · Chrome i Edge: es tria la carpeta (el navegador recorda l'última); si no, va a Baixades
      desaJsonTria(r.dades, nom).then(function (on) {
        if (on === null) return;
        toast('Dades exportades (' + resum + ')' + (on ? ': ' + on : ' a la carpeta de baixades') + '. Han d’anar a generador-horaris\\dades (no el pugeu a cap repositori).');
      });
    });
  }
  // ------------------------------------------------------------------ PAS 68 · NOU ALUMNE/A
  // Alta mínima: nom, cognoms, nivell, estat i autoritzacions. Va a Alumnat ESO o Alumnat Batxillerat segons el nivell.
  // ------------------------------------------------------------------ PAS 70/71 · MATRÍCULA (Secretaria)
  // Importació de l'exportació del Departament (CSV «;», UTF-8 o Windows-1252) i, PAS 71, alta, modificació, baixa i
  // esborrat de cada registre, registres de prova i «Convoca la família» (de moment, NOMÉS prepara i previsualitza els
  // correus: no se n'envia cap).
  function carregaMatricula() {
    S.mat = S.mat || { q: '', niv: '', estat: '', baixes: false, sel: {} };
    var crida = S.mat.r && fresc('matricula') && !carregaMatricula.forca ? Promise.resolve(S.mat.r) : api('matricula_dades', {}, 'Carregant la matrícula…');   // PAS 74
    carregaMatricula.forca = false;
    return crida.then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      if (!(r.esquema >= 71)) { $('gsAvis').innerHTML = 'Cal l’Apps Script del PAS 71 o posterior: enganxeu el Code.gs nou, executeu «configura» i feu una nova implementació.'; $('gsAvis').hidden = false; return; }
      S.mat.r = r; S.d = { files: [], camps: [], nivell: r.nivell, obert: r.obert }; lligaMatricula(); pintaMatricula();
    });
  }
  // PAS 74 · Combina la resposta lleugera del servidor (fila desada o esborrada) amb les dades ja llegides
  function combinaMat(r) {
    var R = S.mat.r; if (r.files) { S.mat.r = r; return; }
    var k = r.fila ? clauMat(r.fila) : r.esborrat ? r.id_ralc + '|' + r.curs_academic : '';
    if (!k) return;
    var i = R.files.map(clauMat).indexOf(k);
    if (r.fila) { if (i >= 0) R.files[i] = r.fila; else R.files.push(r.fila); } else if (i >= 0) R.files.splice(i, 1);
    R.resum = {}; R.files.forEach(function (f) { var c = (f.nivell_gestio || f.codi_ensenyament || '?') + ' · ' + (f.estat_matricula || '?'); R.resum[c] = (R.resum[c] || 0) + 1; });
  }
  var edMat = function () { return S.mat.r && nivellIdx(S.mat.r.nivell) >= 1 && S.mat.r.obert; };
  var adminMat = function () { return S.mat.r && nivellIdx(S.mat.r.nivell) >= 2; };
  var nomMat = function (f) { return [f.cognom1, f.cognom2].filter(Boolean).join(' ') + ', ' + f.nom; };
  var clauMat = function (f) { return f.id_ralc + '|' + f.curs_academic; };
  var deBaixaMat = function (f) { return f.estat_gestio === 'baixa'; };
  // PAS 75 · Columnes de la llista: cada una es pot filtrar (fila de filtres de la capçalera) i endreçar (clic al títol)
  var COLS_MAT = [['id', 'Identificador', function (f) { return f.id_ralc; }], ['alumne', 'Alumne/a', function (f) { return nomMat(f); }],
    ['naix', 'Naixement', function (f) { return f.data_naixement; }, function (f) { return dataVista(f.data_naixement); }], ['nivell', 'Nivell', function (f) { return f.nivell_gestio || f.nivell; }],
    ['ens', 'Ensenyament', function (f) { return f.codi_ensenyament; }], ['estat', 'Estat', function (f) { return f.estat_matricula; }],
    ['data', 'Data matrícula', function (f) { return f.data_matricula; }, function (f) { return dataVista(f.data_matricula); }], ['correu', 'Correu', function (f) { return f.email_via1; }],
    ['tel', 'Telèfon', function (f) { return f.telefon_via1; }], ['resp', 'Responsables', function (f) { return [[f.nom_tutor1, f.primer_cognom_tutor1].filter(Boolean).join(' '), [f.nom_tutor2, f.primer_cognom_tutor2].filter(Boolean).join(' ')].filter(Boolean).join(' · '); }],
    ['gestio', 'GESTIO', function (f) { return f.estat_gestio; }]];
  function filesMat() {
    var q = plega(S.mat.q || ''), fc = S.mat.fc || {}, ord = S.mat.ord;
    var cols = COLS_MAT.filter(function (c) { return fc[c[0]]; });
    var ll = S.mat.r.files.filter(function (f) {
      return (S.mat.baixes || !deBaixaMat(f)) && (!S.mat.niv || (f.nivell_gestio || f.codi_ensenyament) === S.mat.niv) && (!S.mat.estat || f.estat_matricula === S.mat.estat) &&
        (!q || plega(nomMat(f) + ' ' + f.id_ralc + ' ' + f.email_via1).indexOf(q) >= 0) &&
        cols.every(function (c) { var v = plega(String((c[3] || c[2])(f) || '')), w = plega(fc[c[0]]); return w === '(buit)' ? !v : v.indexOf(w) >= 0; });
    });
    var c = ord && COLS_MAT.filter(function (x) { return x[0] === ord.k; })[0];
    return ll.sort(function (a, b) { if (c) { var r = String(c[2](a) || '').localeCompare(String(c[2](b) || ''), 'ca', { numeric: true }); if (r) return ord.dir * r; }
      return String(a.nivell_gestio).localeCompare(String(b.nivell_gestio), 'ca') || nomMat(a).localeCompare(nomMat(b), 'ca'); });
  }
  function pintaMatricula() {
    var R = S.mat.r, ed = edMat(), ll = filesMat(), nSel = Object.keys(S.mat.sel).filter(function (k) { return S.mat.sel[k]; }).length;
    var nivs = R.files.map(function (f) { return f.nivell_gestio || f.codi_ensenyament; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort();
    var ests = R.files.map(function (f) { return f.estat_matricula; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort();
    var nB = R.files.filter(deBaixaMat).length;
    $('gsEines').innerHTML = '<input type="search" class="gs-cal__cerca" data-mat="cerca" placeholder="Cerca alumne/a, identificador o correu…" value="' + esc(S.mat.q) + '">' +
      '<select data-mat="niv" aria-label="Nivell"><option value="">Tots els nivells</option>' + nivs.map(function (n) { return '<option' + (n === S.mat.niv ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
      '<select data-mat="estat" aria-label="Estat de la matrícula"><option value="">Tots els estats</option>' + ests.map(function (n) { return '<option' + (n === S.mat.estat ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
      (nB ? '<label class="gs-check"><input type="checkbox" data-mat="baixes"' + (S.mat.baixes ? ' checked' : '') + '> Mostra les baixes (' + nB + ')</label>' : '') +
      '<span class="gs-espai"></span>' +
      (ed ? '<button type="button" class="prog-btn prog-btn--ghost" data-mat="alta">+ Alta</button><button type="button" class="prog-btn prog-btn--ghost" data-mat="prova" title="Un registre inventat per provar el procés (no es convoca mai)">+ Registre de prova</button>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-mat="convoca"' + (nSel ? '' : ' disabled title="Marqueu primer a qui convoqueu (caselles de l’esquerra)"') + '>Convoca la família' + (nSel ? ' (' + nSel + ')' : '') + '</button>' +
        '<button type="button" class="prog-btn" data-mat="importa">Importa el fitxer del Departament</button><input type="file" id="gsMatFitxer" accept=".csv,text/csv" hidden>' : '') +
      '<p class="gs-ajuda gs-cal__ajuda">Alumnat assignat al centre segons l’exportació del Departament (fitxer <code>.csv</code>, separat per «;»). <b>Importa</b> afegeix l’alumnat nou i actualitza el que ja hi és (per l’identificador de l’alumne/a i el curs); abans de desar, es mostra el que canviarà. ' +
        (ed ? 'Un clic a una fila obre la <b>fitxa</b> (modificar, donar de baixa). Les caselles de l’esquerra trien a qui es <b>convoca</b>. ' : '') +
        R.files.length + ' registres · ' + Object.keys(R.resum).sort().map(function (k) { return esc(k) + ': ' + R.resum[k]; }).join(' · ') + '</p>';
    var t = $('gsTaula'); t.className = 'gs-ocu gs-mat';
    var totsSel = ll.length && ll.every(function (f) { return S.mat.sel[clauMat(f)]; });
    t.innerHTML = !R.files.length ? '<p class="gs-ajuda" style="padding:12px">Encara no hi ha cap registre.' + (ed ? ' Premeu <b>Importa el fitxer del Departament</b> o feu una <b>alta</b>.' : '') + '</p>' :
      '<table class="gs-form-taula gs-informe__taula gs-mat__taula"><thead><tr>' + (ed ? '<th><input type="checkbox" data-mat="sel-tots" aria-label="Marca tots els que es veuen"' + (totsSel ? ' checked' : '') + '></th>' : '') +
      COLS_MAT.map(function (c) { var o = S.mat.ord && S.mat.ord.k === c[0] ? S.mat.ord.dir : 0; return '<th><button type="button" class="gs-mat__ord" data-mat-ord="' + c[0] + '" title="Endreça per ' + esc(c[1].toLowerCase()) + '">' + esc(c[1]) + (o ? (o > 0 ? ' ▲' : ' ▼') : '') + '</button></th>'; }).join('') + '</tr>' +
      '<tr class="gs-mat__filtres">' + (ed ? '<th></th>' : '') + COLS_MAT.map(function (c) { return '<th><input type="search" data-mat-fc="' + c[0] + '" value="' + esc((S.mat.fc || {})[c[0]] || '') + '" placeholder="filtra…" aria-label="Filtra per ' + esc(c[1].toLowerCase()) + '"></th>'; }).join('') + '</tr></thead><tbody>' +
      ll.map(function (f) { var k = clauMat(f);
        return '<tr data-k="' + esc(k) + '" class="' + (ed ? 'gs-mat__fila' : '') + (deBaixaMat(f) || /baixa/i.test(f.estat_matricula) ? ' gs-gris' : '') + '">' + (ed ? '<td><input type="checkbox" data-mat="sel"' + (S.mat.sel[k] ? ' checked' : '') + ' aria-label="Convoca"></td>' : '') +
        '<td>' + esc(f.id_ralc) + (f.prova === 'sí' ? ' <span class="gs-codo">prova</span>' : '') + '</td><td><b>' + esc(nomMat(f)) + '</b></td><td>' + esc(dataVista(f.data_naixement)) + '</td><td>' + esc(f.nivell_gestio || f.nivell) + '</td><td>' + esc(f.codi_ensenyament) + '</td>' +
        '<td>' + esc(f.estat_matricula) + (f.data_baixa ? '<br><small>' + esc(dataVista(f.data_baixa)) + (f.motiu_baixa ? ' · ' + esc(f.motiu_baixa) : '') + '</small>' : '') + '</td><td>' + esc(dataVista(f.data_matricula)) + '</td><td>' + esc(f.email_via1) + '</td><td>' + esc(f.telefon_via1) + '</td>' +
        '<td>' + esc([[f.nom_tutor1, f.primer_cognom_tutor1].filter(Boolean).join(' '), [f.nom_tutor2, f.primer_cognom_tutor2].filter(Boolean).join(' ')].filter(Boolean).join(' · ')) + '</td><td>' + esc(f.estat_gestio) + (f.actualitzat ? '<br><small>act. ' + esc(dataHoraHE(f.actualitzat)) + '</small>' : '') + '</td></tr>'; }).join('') +
      '</tbody></table><p class="gs-gris" style="margin:8px 0">' + ll.length + ' de ' + R.files.length + ' registres' + (nSel ? ' · ' + nSel + ' marcats per convocar' : '') + '.</p>';
    ajustaAlcada();
  }
  // Fitxa d'un registre: tots els camps del fitxer del Departament, agrupats
  var GRUPS_MAT = [['Alumne/a', /^(nom|cognom1|cognom2|sexe|nacionalitat|data_naixement|pais_naixement|provincia_naixement|municipi_naixement|dni|nie|pass|tis|emancipat|tutelat|custodia_compartida)$/],
    ['Adreça i contacte', /via1$/], ['Segona adreça', /via2$/], ['Responsables', /tutor[12]$|persona_juridica/],
    ['Matrícula', /^(estat_alumne|curs_academic|periode|codi_centre|codi_ensenyament|especialitat_esportiva|nivell|regim|bloc_batx_nocturn|torn|modalitat|ocupa_placa|data_matricula|data_registre_matricula|data_baixa|data_registre_baixa_mat|motiu_baixa|estat_matricula|pendent_pagament)$/],
    ['NESE', /nese/], ['Altres', /./]];
  function fitxaMat(f, nou, prova) {
    var R = S.mat.r, ed = edMat(), usat = {}, v = f || {};
    var camps = R.camps.filter(function (c) { return c.clau !== 'id_ralc'; });
    var grups = GRUPS_MAT.map(function (g) { var cs = camps.filter(function (c) { if (usat[c.clau] || !g[1].test(c.clau)) return false; usat[c.clau] = 1; return true; }); return [g[0], cs]; }).filter(function (g) { return g[1].length; });
    var data = function (k) { return /^data_/.test(k); };
    var html = (nou ? '<p class="gs-ajuda">' + (prova ? 'Registre de <b>prova</b>: dades inventades per provar el procés. Surt marcat «prova» i no es convoca mai.' : 'Alta manual (alumne/a que no és al fitxer del Departament). Si no sabeu l’identificador (RALC), es posarà «MAN-…».') + '</p>' +
        '<div class="gs-form-fila"><label>Identificador (RALC) <input type="text" id="gsMatId" placeholder="' + (prova ? 'PROVA-… (automàtic)' : 'en blanc = MAN-…') + '"></label></div>' :
        '<p><b>' + esc(v.id_ralc) + '</b> · curs ' + esc(v.curs_academic) + ' · ' + esc(v.estat_gestio || '') + (v.prova === 'sí' ? ' · <span class="gs-codo">prova</span>' : '') + (v.actualitzat ? ' · modificat el ' + esc(dataHoraHE(v.actualitzat)) + (v.actualitzat_per ? ' per ' + esc(v.actualitzat_per) : '') : '') + '</p>') +
      grups.map(function (g, gi) { return '<details class="gs-mat__grup"' + (gi < 2 ? ' open' : '') + '><summary>' + esc(g[0]) + '</summary><div class="gs-mat__camps">' + g[1].map(function (c) {
        var x = v[c.clau] || ''; return '<label><span>' + esc(c.nom) + '</span><input type="text" data-mk="' + esc(c.clau) + '" value="' + esc(data(c.clau) ? dataVista(x) : x) + '"' + (ed ? '' : ' disabled') + (data(c.clau) ? ' placeholder="dd/mm/aaaa"' : '') + '></label>'; }).join('') + '</div></details>'; }).join('') +
      '<p class="prog-avis" id="gsMatErr" hidden></p>';
    var botons = ed ? [{ t: nou ? 'Dona d’alta' : 'Desa', valor: 'desa', abans: function () { fitxaMat.v = llegeixFitxaMat(); } }] : [];
    if (!nou) botons.push({ t: 'Formalització', valor: 'formalitza', tipus: 'ghost' });   // PAS 72
    if (ed && !nou) botons.push(deBaixaMat(v) ? { t: 'Recupera (treu la baixa)', valor: 'recupera', tipus: 'ghost' } : { t: 'Dona de baixa', valor: 'baixa', tipus: 'ghost' });
    if (!nou && adminMat()) botons.push({ t: 'Esborra', valor: 'esborra', tipus: 'danger' });
    botons.push({ t: ed ? 'Cancel·la' : 'Tanca', valor: 0, tipus: 'ghost' });
    var obre = pregunta(nou ? (prova ? 'Registre de prova' : 'Alta de matrícula') : nomMat(v), html, botons, false);
    $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample');
    if (prova) { var P = { nom: 'Prova', cognom1: 'Matrícula', cognom2: 'Inventada', data_naixement: '01/01/2014', codi_ensenyament: 'ESO LOE', nivell: '1', estat_matricula: 'ALTA', email_via1: 'prova@exemple.cat', telefon_via1: '600000000', nom_tutor1: 'Família', primer_cognom_tutor1: 'Prova' };
      Object.keys(P).forEach(function (k) { var i = document.querySelector('#gsModalText [data-mk="' + k + '"]'); if (i) i.value = P[k]; }); }
    obre.then(function (b) {
      if (!b) return;
      var cos = b === 'desa' ? Object.assign({ valors: fitxaMat.v }, nou ? { nou: true, prova: !!prova, id_ralc: ($('gsMatId') || {}).value || '' } : { id_ralc: v.id_ralc, curs_academic: v.curs_academic }) :
        b === 'baixa' || b === 'recupera' ? { id_ralc: v.id_ralc, curs_academic: v.curs_academic, valors: {}, estat_gestio: b === 'baixa' ? 'baixa' : (v.origen === 'importat' || !v.origen ? 'importada' : v.prova === 'sí' ? 'prova' : 'alta manual') } : null;
      if (b === 'formalitza') return formulariMat(v);
      if (b === 'esborra') return pregunta('Esborra el registre', '<p>S’esborrarà definitivament <b>' + esc(nomMat(v)) + '</b> (' + esc(v.id_ralc) + '). No es pot desfer. Per a l’alumnat real, millor «Dona de baixa».</p>', [{ t: 'Esborra', valor: 1, tipus: 'danger' }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]).then(function (ok) {
        if (ok) api('matricula_esborra', { id_ralc: v.id_ralc, curs_academic: v.curs_academic }, 'Esborrant…').then(function (r) { if (!r.ok) return toast(text(r.error), true); combinaMat(r); delete S.mat.sel[clauMat(v)]; pintaMatricula(); toast('Registre esborrat.'); }); });
      api('matricula_desa', cos, 'Desant…').then(function (r) {
        if (!r.ok) { toast(r.errors ? r.errors.join(' ') : text(r.error), true); if (b === 'desa') fitxaMat(Object.assign({}, v, fitxaMat.v), nou, prova); return; }
        combinaMat(r); pintaMatricula(); toast(r.sense_canvis ? 'No hi havia cap canvi.' : nou ? (prova ? 'Registre de prova afegit.' : 'Alta feta.') : b === 'baixa' ? 'Registre donat de baixa (es pot recuperar amb «Mostra les baixes»).' : b === 'recupera' ? 'Baixa treta.' : 'Desat.');
      });
    });
  }
  function llegeixFitxaMat() { var o = {}; [].forEach.call(document.querySelectorAll('#gsModalText [data-mk]'), function (i) { o[i.dataset.mk] = i.value.trim(); }); return o; }
  // ------------------------------------------------------------------ PAS 72 · FORMALITZACIÓ DE LA MATRÍCULA
  // Formulari de matrícula (definició a /assets/dades/matricula-formulari.json, a partir dels models del centre). Secretaria
  // l'omple a la formalització presencial (amb les dades del Departament ja posades), el desa i en treu el PDF per signar.
  // La versió en línia (famílies, amb enllaç personal) farà servir la mateixa definició.
  var defFormMat = null;
  function carregaDefFormMat() { if (!defFormMat) defFormMat = fetch('/assets/dades/matricula-formulari.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('def'); return r.json(); }); defFormMat.catch(function () { defFormMat = null; }); return defFormMat; }
  var nomNivMat = function (f) { return f.nivell_gestio || f.nivell || ''; };
  function marquesMat(t, f, R, cfg) {
    var alu = [R.nom || f.nom, R.cognom1 || f.cognom1, R.cognom2 || f.cognom2].filter(Boolean).join(' ');
    var resp = [R.r1_nom, R.r1_cognom1, R.r1_cognom2].filter(Boolean).join(' ');
    var m = { curs: cfg.curs || f.curs_academic || '', direccio: cfg.direccio || '________________', iban_afa: cfg.iban_afa || '________________', iban_taquilles: cfg.iban_taquilles || '________________',
      alumne: alu || '________________', responsable: resp || '________________', dni_responsable: R.r1_document || '__________' };
    return String(t || '').replace(/\{(curs|direccio|iban_afa|iban_taquilles|alumne|responsable|dni_responsable)\}/g, function (x, k) { return m[k]; });
  }
  // Valor inicial d'un camp: el desat; si no, el de les dades del Departament («de»)
  function valorIniMat(c, f, R) {
    if (R[c.clau] !== undefined) return R[c.clau];
    var de = Array.isArray(c.de) ? c.de : c.de ? [c.de] : [];
    if (c.clau === 'domicili') return de.map(function (k) { return f[k]; }).filter(Boolean).join(' ');
    var v = de.map(function (k) { return f[k]; }).filter(Boolean)[0] || '';
    if (c.tipus === 'data') return dataIsoMat(v);
    if (c.clau === 'sexe' && v) return /^d|^f/i.test(v) ? 'Dona' : /^h|^m/i.test(v) ? 'Home' : v;
    return v;
  }
  var dataIsoMat = function (v) { var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || '')); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : String(v || '').slice(0, 10); };
  var docAplicaMat = function (d, f) { return !d.nivells || d.nivells.indexOf(nomNivMat(f)) >= 0; };
  function formulariMat(f) {
    Promise.all([carregaDefFormMat(), api('matricula_formulari', { id_ralc: f.id_ralc, curs_academic: f.curs_academic }, 'Obrint el formulari…')]).then(function (x) {
      var D = x[0], r = x[1], cfg = S.mat.r.formulari_cfg || {}; if (!r.ok) return toast(textError(r), true);
      var R = r.respostes || {}, ed = edMat();
      var camp = function (c) {
        var v = valorIniMat(c, f, R), id = 'fm_' + c.clau, dis = ed ? '' : ' disabled', si = c.si ? ' data-si="' + esc(c.si) + '"' : '';
        var inp = c.tipus === 'opcions' ? '<span class="gs-fm__ops">' + c.opcions.map(function (o) { return '<label class="gs-check"><input type="radio" name="' + id + '" data-fm="' + esc(c.clau) + '" value="' + esc(o) + '"' + (v === o ? ' checked' : '') + dis + '> ' + esc(o) + '</label>'; }).join('') + '</span>'
          : c.tipus === 'llarg' ? '<textarea data-fm="' + esc(c.clau) + '" rows="2"' + dis + '>' + esc(v) + '</textarea>'
          : '<input type="' + (c.tipus === 'data' ? 'date' : c.tipus === 'correu' ? 'email' : c.tipus === 'tel' ? 'tel' : 'text') + '" data-fm="' + esc(c.clau) + '" value="' + esc(v) + '"' + dis + '>';
        return '<label class="gs-fm__camp' + (c.tipus === 'llarg' || c.tipus === 'opcions' ? ' gs-fm__camp--ample' : '') + '"' + si + '><span>' + esc(c.nom) + (c.obl ? ' *' : '') + '</span>' + inp + '</label>';
      };
      var resposta = function (d) {
        var q = d.resposta, k = q.clau, v = R[k], dis = ed ? '' : ' disabled';
        var radio = function (ops) { return ops.map(function (o) { var val = o[0], t = o[1]; return '<label class="gs-check"><input type="radio" name="fr_' + k + '" data-fr="' + k + '" value="' + esc(val) + '"' + (v === val ? ' checked' : '') + dis + '> ' + esc(t) + '</label>'; }).join(''); };
        var h = q.tipus === 'accepta' ? radio([['accepta', 'Acceptat (signa)']])
          : q.tipus === 'si_no' ? radio([['Sí', 'SÍ'], ['No', 'NO']])
          : q.tipus === 'opcions' ? radio(q.opcions.map(function (o) { return [o, o]; }))
          : q.tipus === 'menjador' ? radio([['Sí', 'SÍ'], ['No', 'NO']]) + '<span class="gs-fm__dies">' + q.dies.map(function (dd) { return '<label class="gs-check"><input type="checkbox" data-frd="' + k + '" value="' + dd + '"' + ((R[k + '_dies'] || []).indexOf(dd) >= 0 ? ' checked' : '') + dis + '> ' + dd + '</label>'; }).join('') + '</span>'
          : q.tipus === 'ordre' ? '<span class="gs-fm__ordre">' + Array.apply(null, Array(q.places)).map(function (_, i) { return '<label>' + (i + 1) + '. <select data-fro="' + k + '"' + dis + '><option value=""></option>' + q.opcions.map(function (o) { return '<option' + ((R[k] || [])[i] === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>'; }).join('') + '</span>' : '';
        return '<div class="gs-fm__resp">' + h + '</div>';
      };
      var html = '<p><b>' + esc(nomMat(f)) + '</b> · ' + esc(nomNivMat(f)) + ' · ' + esc(f.id_ralc) + (r.formalitzada ? ' · <span class="gs-codo">formalitzada el ' + esc(dataHoraHE(r.formalitzada)) + (r.via ? ' (' + esc(r.via) + ')' : '') + '</span>' : '') + '</p>' +
        '<p class="gs-ajuda">Les dades del Departament ja hi són; reviseu-les i completeu-les amb la família. <b>Desa l’esborrany</b> guarda sense comprovar; <b>Formalitza</b> comprova els obligatoris (*) i les acceptacions i marca la matrícula com a formalitzada. <b>PDF per signar</b> treu el document amb les respostes.</p>' +
        D.dades.map(function (g) { return '<details class="gs-mat__grup"' + (g.opcional ? '' : ' open') + '><summary>' + esc(g.titol) + (g.opcional ? ' (si n’hi ha)' : '') + '</summary><div class="gs-mat__camps">' + g.camps.map(camp).join('') + '</div></details>'; }).join('') +
        '<h4 class="gs-amon__tit">Documents i autoritzacions</h4>' +
        D.documents.filter(function (d) { return docAplicaMat(d, f); }).map(function (d) { return '<details class="gs-mat__grup gs-fm__doc" data-doc="' + d.id + '"><summary>' + esc(marquesMat(d.titol, f, R, cfg)) + ' <span class="gs-fm__estat"></span></summary>' +
          '<div class="gs-fm__text">' + (d.text || []).map(function (p) { return '<p>' + esc(marquesMat(p, f, R, cfg)) + '</p>'; }).join('') + '</div>' + resposta(d) + '</details>'; }).join('') +
        '<p class="prog-avis" id="gsFmErr" hidden></p>';
      var cos = null, llegeix = function () {
        var o = {};
        [].forEach.call(document.querySelectorAll('#gsModalText [data-fm]'), function (i) { if (i.type === 'radio') { if (i.checked) o[i.dataset.fm] = i.value; } else o[i.dataset.fm] = i.value.trim(); });
        [].forEach.call(document.querySelectorAll('#gsModalText [data-fr]:checked'), function (i) { o[i.dataset.fr] = i.value; });
        var dies = {}; [].forEach.call(document.querySelectorAll('#gsModalText [data-frd]:checked'), function (i) { (dies[i.dataset.frd] = dies[i.dataset.frd] || []).push(i.value); }); Object.keys(dies).forEach(function (k) { o[k + '_dies'] = dies[k]; });
        var ord = {}; [].forEach.call(document.querySelectorAll('#gsModalText [data-fro]'), function (i) { (ord[i.dataset.fro] = ord[i.dataset.fro] || []).push(i.value); }); Object.keys(ord).forEach(function (k) { o[k] = ord[k]; });
        return o;
      };
      var botons = ed ? [{ t: 'Formalitza', valor: 'formalitza', abans: function () { cos = llegeix(); } }, { t: 'Desa l’esborrany', valor: 'desa', tipus: 'ghost', abans: function () { cos = llegeix(); } }] : [];
      botons.push({ t: 'PDF per signar', valor: 'pdf', tipus: 'ghost', abans: function () { cos = llegeix(); } }, { t: 'Tanca', valor: 0, tipus: 'ghost' });
      var obre = pregunta('Formalització de la matrícula', html, botons, false);
      $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample');
      // camps condicionals i estat de cada document
      var refresca = function () {
        var o = llegeix();
        [].forEach.call(document.querySelectorAll('#gsModalText [data-si]'), function (el) { var p = el.dataset.si.split('='); el.hidden = o[p[0]] !== p[1]; });
        [].forEach.call(document.querySelectorAll('#gsModalText [data-doc]'), function (el) { var d = D.documents.filter(function (x) { return x.id === el.dataset.doc; })[0], v = o[d.resposta.clau];
          el.querySelector('.gs-fm__estat').textContent = (Array.isArray(v) ? v.filter(Boolean).length : v) ? '✓' : '·'; });
      };
      $('gsModalText').addEventListener('change', refresca); refresca();
      obre.then(function (v) {
        if (!v) return;
        if (v === 'pdf') return pdfFormulariMat(D, f, cos, cfg);
        api('matricula_formulari_desa', { id_ralc: f.id_ralc, curs_academic: f.curs_academic, respostes: cos, complet: v === 'formalitza' }, v === 'formalitza' ? 'Formalitzant…' : 'Desant…').then(function (r2) {
          if (!r2.ok) { toast(r2.errors ? r2.errors.slice(0, 4).join(' ') : text(r2.error), true); return; }
          combinaMat(r2); pintaMatricula(); toast(v === 'formalitza' ? 'Matrícula formalitzada. Imprimiu el PDF per signar.' : 'Esborrany desat.');
        });
      });
    }).catch(function () { toast('No s’ha pogut carregar la definició del formulari.', true); });
  }
  // PDF per signar: dades i documents amb les respostes, una caixa de signatura a cada document que la demana
  function pdfFormulariMat(D, f, R, cfg) {
    preparaPdf().then(function (P) {
      var BLAU = [28, 12, 188], GRIS = [90, 96, 112], TEXT = [30, 30, 42], VORA = [200, 205, 220];
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), W = 210, H = 297, MX = 16, y = 0, AM = W - 2 * MX;
      doc.addFileToVFS('Montserrat-400.ttf', P.regular); doc.addFont('Montserrat-400.ttf', 'Montserrat', 'normal');
      doc.addFileToVFS('Montserrat-600.ttf', P.negreta); doc.addFont('Montserrat-600.ttf', 'Montserrat', 'bold');
      var dibuixaCap = function () { doc.addImage(P.logo, 'PNG', MX, 9, 26, 26 * 432 / 1100); doc.setFont('Montserrat', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS);
        doc.text(marquesMat(D.titol, f, R, cfg) + ' · ' + nomMat(f) + ' · ' + nomNivMat(f), W - MX, 14, { align: 'right' }); doc.setDrawColor.apply(doc, BLAU); doc.setLineWidth(0.5); doc.line(MX, 21, W - MX, 21); };
      var cap = function () { dibuixaCap(); y = 28; };
      var nova = function () { doc.addPage(); cap(); };
      var cal = function (h) { if (y + h > H - 14) nova(); };
      var titol = function (t) { cal(14); doc.setFont('Montserrat', 'bold'); doc.setFontSize(12); doc.setTextColor.apply(doc, BLAU); doc.text(t, MX, y); y += 6; };
      var para = function (t, mida, negreta) { doc.setFont('Montserrat', negreta ? 'bold' : 'normal'); doc.setFontSize(mida || 8.6); doc.setTextColor.apply(doc, TEXT);
        doc.splitTextToSize(t, AM).forEach(function (l) { cal(4.4); doc.text(l, MX, y); y += (mida || 8.6) * 0.47; }); y += 1.6; };
      var signa = function (direccio) { cal(30); doc.setDrawColor.apply(doc, VORA); doc.setLineWidth(0.3);
        if (direccio) { doc.roundedRect(MX, y, AM / 2 - 3, 24, 2, 2); doc.setFont('Montserrat', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, BLAU); doc.text((cfg.direccio || 'La direcció'), MX + 3, y + 5); doc.setFont('Montserrat', 'normal'); doc.text('La directora', MX + 3, y + 9); }
        var x0 = direccio ? MX + AM / 2 + 3 : MX, aw = direccio ? AM / 2 - 3 : AM; doc.roundedRect(x0, y, aw, 24, 2, 2);
        doc.setFont('Montserrat', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, BLAU); doc.text('Signatura pare, mare, tutor/a legal', x0 + 3, y + 5);
        doc.setFont('Montserrat', 'normal'); doc.setTextColor.apply(doc, GRIS); doc.text('Data: ____ / ____ / ________', x0 + aw - 3, y + 21, { align: 'right' }); y += 30; };
      cap();
      doc.setFont('Montserrat', 'bold'); doc.setFontSize(16); doc.setTextColor.apply(doc, BLAU); doc.text(marquesMat(D.titol, f, R, cfg), MX, y + 2); y += 9;
      (D.presentacio || []).forEach(function (p) { para(marquesMat(p, f, R, cfg)); });
      D.dades.forEach(function (g) {
        var files = g.camps.filter(function (c) { if (!c.si) return true; var p = c.si.split('='); return R[p[0]] === p[1]; }).map(function (c) { var v = R[c.clau] !== undefined ? R[c.clau] : valorIniMat(c, f, R); return [c.nom, c.tipus === 'data' ? dataVista(v) : String(v || '')]; });
        if (g.opcional && !files.some(function (x) { return x[1]; })) return;
        cal(16); doc.autoTable({ startY: y, margin: { left: MX, right: MX, top: 28 }, theme: 'grid', head: [[{ content: g.titol, colSpan: 2 }]], body: files,
          headStyles: { font: 'Montserrat', fontStyle: 'bold', fontSize: 9, fillColor: BLAU, textColor: 255, cellPadding: 1.4 },
          styles: { font: 'Montserrat', fontSize: 8.2, cellPadding: 1.3, textColor: TEXT, lineColor: VORA, lineWidth: 0.2 }, columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold', textColor: BLAU, fillColor: [246, 247, 252] } },
          didDrawPage: function (dd) { if (dd.pageNumber > 1) dibuixaCap(); } });
        y = doc.lastAutoTable.finalY + 4; });
      D.documents.filter(function (d) { return docAplicaMat(d, f); }).forEach(function (d) {
        nova(); titol(marquesMat(d.titol, f, R, cfg));
        (d.text || []).forEach(function (p) { para(marquesMat(p, f, R, cfg)); });
        (d.proteccio || []).forEach(function (p) { para(p, 7.4); });
        var q = d.resposta, v = R[q.clau], txt = marquesMat(q.text, f, R, cfg);
        var rv = q.tipus === 'si_no' || q.tipus === 'menjador' ? (v === 'Sí' ? 'SÍ' : v === 'No' ? 'NO' : 'SÍ / NO') : q.tipus === 'opcions' ? (v || q.opcions.join(' / ')) : '';
        txt = txt.replace('{resposta}', rv).replace('{dies}', q.tipus === 'menjador' && v === 'Sí' && (R[q.clau + '_dies'] || []).length ? ' (' + R[q.clau + '_dies'].join(', ') + ')' : '');
        if (q.tipus === 'ordre') { para(txt, 8.6, true); (R[q.clau] || []).forEach(function (o, i) { para((i + 1) + '. ' + (o || '________________')); }); }
        else para(txt, 8.6, true);
        (d.despres || []).forEach(function (p) { para(p); });
        if (d.peu) para(d.peu, 7.6);
        signa(!!d.signa_direccio);
        if (d.nota) para(d.nota, 7);
      });
      var n = doc.internal.getNumberOfPages(); for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('Montserrat', 'normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, GRIS); doc.text(i + ' / ' + n, W - MX, H - 8, { align: 'right' }); }
      doc.save('matricula-' + String(f.id_ralc).replace(/[^\w-]/g, '') + '.pdf');
    }).catch(function () { toast('No s’ha pogut fer el PDF.', true); });
  }
  // «Convoca la família»: a qui (els marcats), plantilla del correu (es pot canviar i desar) i previsualització. No s'envia res.
  function convocaMat() {
    var ids = Object.keys(S.mat.sel).filter(function (k) { return S.mat.sel[k]; });
    if (!ids.length) return toast('Marqueu primer a qui convoqueu.', true);
    var pinta = function (r) {
      $('gsMatConv').innerHTML = '<p><b>' + r.correus.length + '</b> famílies rebrien el correu' + (r.exclosos.length ? ' · <b>' + r.exclosos.length + '</b> no (' + r.exclosos.map(function (x) { return esc(x.nom) + ': ' + esc(x.motiu); }).join('; ') + ')' : '') + '.</p>' +
        (r.correus.filter(function (c) { return c.ja_convocada; }).length ? '<p class="prog-avis">Algunes ja s’havien convocat abans.</p>' : '') +
        '<div class="gs-mat__conv">' + r.correus.slice(0, 50).map(function (c) { return '<details><summary><b>' + esc(c.nom) + '</b> · ' + esc(c.nivell) + ' · ' + esc(c.a) + '</summary><p><b>Assumpte:</b> ' + esc(c.assumpte) + '</p><pre>' + esc(c.cos) + '</pre></details>'; }).join('') + '</div>' +
        (r.correus.length > 50 ? '<p class="gs-gris">… i ' + (r.correus.length - 50) + ' més.</p>' : '');
      convocaMat.r = r;
    };
    api('matricula_convoca', { ids: ids }, 'Preparant la convocatòria…').then(function (r) {
      if (!r.ok) return toast(text(r.error), true);
      pregunta('Convoca la família', '<p class="prog-avis">⚠ De moment <b>no s’envia cap correu</b>: aquí es prepara i es revisa la convocatòria. L’enviament s’activarà quan estigui fet l’accés verificat al formulari en línia.</p>' +
        '<div class="gs-form-fila"><label style="flex:1">Assumpte <input type="text" id="gsMatAss" value="' + esc(r.plantilla.assumpte) + '"></label></div>' +
        '<label class="gs-mat__cos">Text del correu <textarea id="gsMatCos" rows="9">' + esc(r.plantilla.cos) + '</textarea></label>' +
        '<p class="gs-gris">Marques: <code>{alumne}</code> (nom complet), <code>{nom}</code>, <code>{nivell}</code>, <code>{curs}</code>, <code>{identificador}</code>, <code>{enllac}</code> (enllaç personal al formulari). <button type="button" class="gs-enllac" id="gsMatPrev">Actualitza la previsualització i desa la plantilla</button></p><div id="gsMatConv"></div>',
        [{ t: 'Descarrega la llista (CSV)', valor: 'csv', tipus: 'ghost' }, { t: 'Envia (encara no disponible)', valor: 'envia', abans: function () { toast('L’enviament encara no està activat: no s’ha enviat res.', true); return false; } }, { t: 'Tanca', valor: 0, tipus: 'ghost' }], false).then(function (v) {
        if (v !== 'csv') return;
        var R = convocaMat.r, q = function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; };
        var csv = '﻿' + ['Alumne/a;Nivell;Correu;Assumpte'].concat(R.correus.map(function (c) { return [c.nom, c.nivell, c.a, c.assumpte].map(q).join(';'); })).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'convocatoria-matricula.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
      });
      $('gsModalText').closest('.prog-modal__box').classList.add('gs-modal--ample');
      pinta(r);
      $('gsMatPrev').addEventListener('click', function () {
        api('matricula_convoca', { ids: ids, plantilla: { assumpte: $('gsMatAss').value, cos: $('gsMatCos').value } }, 'Desant la plantilla…').then(function (r2) { if (!r2.ok) return toast(r2.errors ? r2.errors.join(' ') : text(r2.error), true); S.mat.r.plantilla = r2.plantilla; pinta(r2); toast('Plantilla desada.'); });
      });
    });
  }
  // Llegeix el CSV (UTF-8 o, si no ho és, Windows-1252) i el parteix en files (separador «;» o «,», cometes dobles)
  function llegeixCsvMat(buf) {
    var text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('windows-1252').decode(buf); }
    text = text.replace(/^﻿/, '');
    var primera = text.split(/\r?\n/)[0], sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ',';
    var o = [], f = [], v = '', q = false;
    for (var i = 0; i < text.length; i++) { var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += c; continue; }
      if (c === '"') q = true; else if (c === sep) { f.push(v); v = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; f.push(v); o.push(f); f = []; v = ''; } else v += c; }
    if (v !== '' || f.length) { f.push(v); o.push(f); }
    return o.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }
  function importaMatricula(fitxer) {
    var lector = new FileReader();
    lector.onload = function () {
      var files = llegeixCsvMat(lector.result);
      if (files.length < 2) return toast('El fitxer no té files d’alumnat.', true);
      api('matricula_importa', { files: files, prova: true }, 'Comprovant el fitxer…').then(function (r) {
        if (!r.ok) return toast(r.errors ? r.errors.slice(0, 3).join(' ') : text(r.error), true);
        pregunta('Importa el fitxer del Departament', '<p>Fitxer <b>' + esc(fitxer.name) + '</b>: <b>' + r.files + '</b> alumnes (' + Object.keys(r.per_nivell).sort().map(function (k) { return esc(k) + ': ' + r.per_nivell[k]; }).join(', ') + ').</p>' +
          '<ul><li>Nous: <b>' + r.nous + '</b></li><li>Que canvien: <b>' + r.actualitzats + '</b></li><li>Sense canvis: <b>' + r.iguals + '</b></li>' + (r.baixes ? '<li>Amb la matrícula de baixa: <b>' + r.baixes + '</b></li>' : '') + '</ul>' +
          (r.errors.length ? '<p class="prog-avis">' + r.errors.map(esc).join('<br>') + '</p>' : '') +
          (r.columnes_desconegudes.length ? '<p class="gs-gris">Columnes que no es desen: ' + esc(r.columnes_desconegudes.join(', ')) + '.</p>' : '') +
          '<p class="gs-gris">Les dades es desen a ijm_alumnat_db › matricula. El fitxer conté dades personals: no el deixeu en carpetes compartides ni el pugeu a cap repositori.</p>',
          [{ t: r.nous + r.actualitzats ? 'Importa' : 'Tanca', valor: r.nous + r.actualitzats ? 1 : 0 }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }], false).then(function (v) {
          if (v !== 1) return;
          api('matricula_importa', { files: files }, 'Important…').then(function (r2) {
            if (!r2.ok) return toast(r2.errors ? r2.errors.slice(0, 3).join(' ') : text(r2.error), true);
            S.mat.r = r2.dades; pintaMatricula(); toast('Importat: ' + r2.nous + ' nous i ' + r2.actualitzats + ' actualitzats.');
          });
        });
      });
    };
    lector.readAsArrayBuffer(fitxer);
  }
  function lligaMatricula() {
    if (lligaMatricula.fet) return; lligaMatricula.fet = true;
    var actiu = function () { return S.modul && S.modul.id === 'matricula' && S.mat && S.mat.r; };
    $('gsEines').addEventListener('click', function (e) { if (!actiu()) return; var b = e.target.closest('[data-mat]'); if (!b) return;
      if (b.dataset.mat === 'importa') $('gsMatFitxer').click();
      else if (b.dataset.mat === 'alta') fitxaMat(null, true, false);
      else if (b.dataset.mat === 'prova') fitxaMat(null, true, true);
      else if (b.dataset.mat === 'convoca') convocaMat(); });
    $('gsEines').addEventListener('change', function (e) { if (!actiu()) return; var x = e.target;
      if (x.id === 'gsMatFitxer' && x.files[0]) { importaMatricula(x.files[0]); x.value = ''; }
      else if (x.dataset.mat === 'niv') { S.mat.niv = x.value; pintaMatricula(); } else if (x.dataset.mat === 'estat') { S.mat.estat = x.value; pintaMatricula(); }
      else if (x.dataset.mat === 'baixes') { S.mat.baixes = x.checked; pintaMatricula(); } });
    $('gsEines').addEventListener('input', function (e) { if (!actiu() || e.target.dataset.mat !== 'cerca') return; S.mat.q = e.target.value; var p = e.target.selectionStart; pintaMatricula(); var c = document.querySelector('[data-mat="cerca"]'); if (c) { c.focus(); c.setSelectionRange(p, p); } });
    $('gsTaula').addEventListener('change', function (e) { if (!actiu()) return; var x = e.target;
      if (x.dataset.mat === 'sel') { S.mat.sel[x.closest('tr').dataset.k] = x.checked; pintaMatricula(); }
      else if (x.dataset.mat === 'sel-tots') { filesMat().forEach(function (f) { S.mat.sel[clauMat(f)] = x.checked; }); pintaMatricula(); } });
    // PAS 75: filtres i ordre per columna
    $('gsTaula').addEventListener('input', function (e) { if (!actiu() || !e.target.dataset.matFc) return; var k = e.target.dataset.matFc, p = e.target.selectionStart;
      (S.mat.fc = S.mat.fc || {})[k] = e.target.value; pintaMatricula(); var c = document.querySelector('[data-mat-fc="' + k + '"]'); if (c) { c.focus(); try { c.setSelectionRange(p, p); } catch (er) { /* res */ } } });
    $('gsTaula').addEventListener('click', function (e) { if (!actiu()) return; var b = e.target.closest('[data-mat-ord]'); if (!b) return; var k = b.dataset.matOrd, o = S.mat.ord;
      S.mat.ord = o && o.k === k ? (o.dir > 0 ? { k: k, dir: -1 } : null) : { k: k, dir: 1 }; pintaMatricula(); });
    $('gsTaula').addEventListener('click', function (e) { if (!actiu() || !edMat() || e.target.closest('input') || e.target.closest('[data-mat-ord]')) return; var tr = e.target.closest('tr[data-k]'); if (!tr) return;
      var f = S.mat.r.files.filter(function (x) { return clauMat(x) === tr.dataset.k; })[0]; if (f) fitxaMat(f, false, false); });
  }
  function carregaNouAlumne() {
    // PAS 74: el formulari (nivells, estats) es llegeix un cop; donar d'alta no el torna a demanar
    (S.na && fresc('nou_alumne') ? Promise.resolve(S.na) : api('nou_alumne', {}, 'Preparant el formulari…')).then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.na = r; S.d = { nivell: S.modul.nivell, obert: r.obert, camps: [], files: [] }; pintaNouAlumne();
    });
  }
  function pintaNouAlumne(fet) {
    var R = S.na, niv = ($('gsNaNiv') || {}).value || R.nivells[0], bat = /BAT$/.test(niv), estats = bat ? R.estats.bat : R.estats.eso;
    $('gsEines').innerHTML = '<p class="gs-ajuda" style="flex:1 1 100%;margin:0">Alta d’un alumne/a nou. Només cal posar aquestes dades: <strong>la resta les completa l’equip directiu</strong> a Alumnat ESO o Alumnat Batxillerat (segons el nivell). Tot l’alumnat que ve <strong>de fora del centre</strong> té l’estat <strong>alumne extern</strong>; els altres estats (promociona, repeteix…) són només per a l’alumnat que ja estudia al centre.</p>';
    var t = $('gsTaula'); t.className = 'gs-nou';
    var sn = function (id, nom) { return '<label>' + nom + ' <select id="' + id + '"><option value="">—</option><option>sí</option><option>no</option></select></label>'; };
    t.innerHTML = (fet ? '<p class="gs-ok-nou">✓ ' + esc(fet) + '</p>' : '') +
      '<div class="gs-form-fila"><label>Nom * <input type="text" id="gsNaNom" maxlength="80"></label><label>1r cognom * <input type="text" id="gsNaC1" maxlength="80"></label><label>2n cognom <input type="text" id="gsNaC2" maxlength="80"></label></div>' +
      '<div class="gs-form-fila" style="margin-top:10px"><label>Nivell * <select id="gsNaNiv">' + R.nivells.map(function (n) { return '<option' + (n === niv ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label>Estat * <select id="gsNaEst">' + estats.map(function (e) { return '<option' + (e === 'alumne extern' ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="gs-form-fila" style="margin-top:10px">' + sn('gsNaImg', 'Aut. imatge') + sn('gsNaDies', 'Aut. dies especials') + sn('gsNaMed', 'Aut. medicaments') + '</div>' +
      '<p class="prog-avis" id="gsNaErr" hidden></p><p style="margin-top:14px"><button type="button" class="prog-btn" id="gsNaDesa"' + (R.obert ? '' : ' disabled') + '>Dona d’alta</button></p>';
    $('gsNaNiv').addEventListener('change', function () { var b = /BAT$/.test(this.value), ll = b ? R.estats.bat : R.estats.eso, cur = $('gsNaEst').value;
      $('gsNaEst').innerHTML = ll.map(function (e) { return '<option' + (e === (ll.indexOf(cur) >= 0 ? cur : 'alumne extern') ? ' selected' : '') + '>' + e + '</option>'; }).join(''); });
    $('gsNaDesa').addEventListener('click', function () { desaNouAlumne(false); });
    ajustaAlcada();
  }
  function desaNouAlumne(igualment) {
    var v = { nom: $('gsNaNom').value, cognom1: $('gsNaC1').value, cognom2: $('gsNaC2').value, nivell: $('gsNaNiv').value, estat: $('gsNaEst').value,
      aut_imatge: $('gsNaImg').value, aut_dies_especials: $('gsNaDies').value, aut_medicaments: $('gsNaMed').value };
    if (!v.nom.trim() || !v.cognom1.trim()) { $('gsNaErr').textContent = 'Cal el nom i el 1r cognom.'; $('gsNaErr').hidden = false; return; }
    api('alta_alumne', { valors: v, igualment: igualment }, 'Donant d’alta…').then(function (r) {
      if (r.error === 'repetit') return pregunta('Alumne/a repetit?', '<p>' + esc(r.missatge) + '</p><p>Voleu donar-lo d’alta igualment?</p>', [{ t: 'Dona d’alta igualment', valor: 1 }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]).then(function (x) { if (x === 1) desaNouAlumne(true); });
      if (!r.ok) { $('gsNaErr').textContent = r.errors ? r.errors.map(function (e) { return e.camp + ': ' + (e.error === 'obligatori' ? 'obligatori' : 'valor no vàlid'); }).join(' · ') : text(r.error); $('gsNaErr').hidden = false; return; }
      delete S.cache[r.modul];
      pintaNouAlumne(v.cognom1 + (v.cognom2 ? ' ' + v.cognom2 : '') + ', ' + v.nom + ' (' + v.nivell + ', ' + v.estat + ') donat d’alta a ' + (r.modul === 'batxillerat' ? 'Alumnat Batxillerat' : 'Alumnat ESO') + ' (' + r.id + '). L’equip directiu n’ha de completar la resta de dades.');
    });
  }
  function carregaNouProfessor() {
    // PAS 74: els camps i el professorat (per a «Substitueix a») es llegeixen un cop; desar hi afegeix el docent nou
    (S.npR && fresc('nou_professor') ? Promise.resolve(S.npR) : api('nou_professor', {}, 'Preparant el formulari…')).then(function (r) {
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.npR = r;
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
        if (r.valors && Array.isArray(S.d.professorat)) S.d.professorat.push({ nom: [r.valors.cognom1, r.valors.cognom2].filter(Boolean).join(' ') + ', ' + r.valors.nom, carrec: r.valors.carrec || '' });   // PAS 74
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
      // PAS 58: al full imprès no hi surt l'estat (el posa secretaria)
      var grups = grupsNou().map(function (g) { return { nom: g.nom, camps: g.camps.filter(function (c) { return c.clau !== 'estat'; }) }; }).filter(function (g) { return g.camps.length; });
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
    // PAS 73: reutilitza les dades llegides (els canvis propis ja s'hi apliquen en desar)
    var crida = S.equipsR && fresc('equips') && !carregaEquips.forca ? Promise.resolve(S.equipsR) : api('equips', {}, 'Carregant els equips…');
    carregaEquips.forca = false;
    crida.then(function (r) { if (r.ok) S.equipsR = r;
      if (!r.ok) { $('gsAvis').innerHTML = textError(r); $('gsAvis').hidden = false; return; }
      S.d = { equips_dades: r.equips, moduls: r.moduls, nivell: 'admin', obert: true, r: r };
      S.vistaEquips = S.vistaEquips || 'equips';
      pintaVistaEquips();
    });
  }
  function pintaVistaEquips() {
    var r = S.d.r, perm = S.vistaEquips === 'permisos';
    destrueixTaula();
    if (S.vistaEquips === 'persona') return pintaPermisosPersona(r);   // PAS 58
    $('gsTaula').innerHTML = ''; marcaBrut(false);
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist">' +
        '<button type="button" role="tab" data-accio="vista-equips" aria-selected="' + !perm + '">Equips i membres</button>' +
        '<button type="button" role="tab" data-accio="vista-permisos" aria-selected="' + perm + '">Permisos</button>' +
        '<button type="button" role="tab" data-accio="vista-persona" aria-selected="false">Per persona</button></div>' +
      (perm ? '<p class="gs-ajuda" style="flex:1 1 100%;margin:0 0 4px">Nivell de cada equip a cada mòdul: <strong>Consulta</strong> (veure i exportar), <strong>Edició</strong> (alta, baixa i modificació) o <strong>Administració</strong> (a més, camps i permisos del mòdul). «Tots els mòduls» dona el nivell a tots alhora. Si un docent és a diversos equips, val el nivell més alt. L’administració global de l’equip directiu no es pot treure des d’aquí.</p>'
        : '<p class="gs-ajuda" style="flex:1 1 100%;margin:0 0 4px">Equips de <strong>gestió</strong> (direcció, coordinacions, secretaria…) i <strong>docents</strong> (equips de nivell, departaments/àmbits…). El tipus només serveix per classificar-los i filtrar-los: tots dos funcionen igual. Els membres poden ser professorat o PAS, i una persona pot ser a diversos equips. <strong>Membres</strong>: cliqueu la cel·la per afegir-ne o treure’n. Els permisos, a la pestanya <strong>Permisos</strong>. Per <strong>modificar</strong> un equip, cliqueu la cel·la (nom, tipus, descripció, actiu, grups) i deseu; el codi no es pot canviar. Per <strong>esborrar-lo</strong>, la paperera (o, per conservar-lo, Actiu = no).</p>' +
          '<span class="gs-espai"></span><button type="button" class="prog-btn" data-accio="nou-equip">+ Afegeix equip</button>') + '<button type="button" class="prog-btn prog-btn--ghost" data-accio="mod-actualitza" title="Torna a llegir les dades (p. ex. si algú altre les ha canviat)">Actualitza</button>';
    return perm ? pintaMatriuPermisos(r) : pintaEquips(r);
  }
  function pintaEquips(r) {
    var dadesEquips = function () { return r.equips.map(function (q) { return Object.assign({ _nou: false }, q, { membres: (q.membres || []).slice(), permisos: (q.permisos || []).slice(), grups: (q.grups || []).slice() }); }); };
    S.descartaEquips = function () { S.taula.replaceData(dadesEquips()); };
    var nomMod = function (id) { if (id === '*') return 'tots'; var m = r.moduls.filter(function (x) { return x.id === id; })[0]; return m ? m.nom : id; };
    S.taula = new Tabulator('#gsTaula', {
      data: dadesEquips(), index: 'id_equip', layout: 'fitDataStretch', height: alcada(),
      columns: [
        { title: '', field: '_acc', width: 46, headerSort: false, hozAlign: 'center', cssClass: 'gs-accions', frozen: true,
          formatter: function (c) { return c.getRow().getData().id_equip === 'EQ-DIR' ? '' : '<span class="gs-acc"><button type="button" class="gs-perill gs-paperera" title="Esborra l’equip" aria-label="Esborra l’equip">' + PAPERERA + '</button></span>'; },
          cellClick: function (e, cell) { if (e.target.closest('button')) esborraEquip(cell.getRow()); } },
        { title: 'Codi', field: 'id_equip', width: 130, frozen: true, editable: function (cell) { return cell.getRow().getData()._nou; }, editor: 'input', headerFilter: 'input', headerFilterFunc: function (f, v) { return conte(v, f); } },
        { title: 'Nom', field: 'nom', editor: 'input', minWidth: 200, headerFilter: 'input', headerFilterFunc: function (f, v) { return conte(v, f); } },
        { title: 'Tipus', field: 'tipus', editor: 'list', editorParams: { values: { gestio: 'Gestió', docent: 'Docent' } }, formatter: function (c) { return c.getValue() === 'docent' ? 'Docent' : 'Gestió'; }, headerFilter: 'list', headerFilterParams: { values: { gestio: 'Gestió', docent: 'Docent' }, clearable: true } },
        { title: 'Descripció', field: 'descripcio', editor: 'input', minWidth: 200 },
        { title: 'Actiu', field: 'actiu', editor: 'list', editorParams: { values: { si: 'sí', no: 'no' } }, formatter: function (c) { return c.getValue() === 'no' ? 'no' : 'sí'; } },
        // PAS 30: un equip docent amb grups (p. ex. 1r ESO A) només veu l'alumnat d'aquests grups
        { title: 'Grups', field: 'grups', minWidth: 120, editor: 'list', editorParams: { values: r.grups || [], multiselect: true }, headerFilter: 'input',
          headerFilterFunc: function (f, v) { return conte((v || []).join(', '), f); },
          formatter: function (c) { var g = c.getValue() || []; return g.length ? g.map(function (x) { return '<span class="gs-pill">' + esc(x) + '</span>'; }).join('') : '<span class="gs-gris">tots</span>'; },
          tooltip: 'Si l’equip té grups, els seus membres només veuen l’alumnat d’aquests grups. Buit: tots els grups.' },
        { title: 'Membres', field: 'membres', minWidth: 220, cssClass: 'gs-membres', formatter: function (c) { var m = c.getValue() || [], au = c.getRow().getData().automatic;
            if (au) return '<span class="gs-gris" title="Hi és tot el professorat que no és de baixa (config › claustre_des_de)">Tot el professorat, automàtic' + (au.des_de ? (au.actiu ? ' (des del ' : ' (a partir del ') + esc(dataVista(au.des_de)) + ')' : '') + '</span>'; return '<button type="button" class="gs-membres__btn" title="Afegeix o treu membres">' + (m.length ? m.length + ' · ' + esc(m.slice(0, 3).join(', ')) + (m.length > 3 ? '…' : '') : 'Cap membre') + ' <span aria-hidden="true">✎</span></button>'; },
          cellClick: function (e, cell) { var q = cell.getRow().getData(); if (q.automatic) return toast('Els membres d’aquest equip són automàtics: tot el professorat en actiu.'); if (q._nou) return toast('Primer deseu l’equip nou; després hi podreu afegir membres.', true); if (S.brut) return toast('Primer deseu o descarteu els canvis dels equips.', true); editaMembres(q, r.persones || r.professorat || []); } },
        { title: 'Permisos', field: 'permisos', formatter: function (c) { return (c.getValue() || []).map(function (p) { return '<span class="gs-pill">' + esc(nomMod(p.modul)) + ': ' + esc(NOM_NIVELL[p.nivell] || p.nivell) + '</span>'; }).join('') || '—'; } }
      ]
    });
    S.taula.on('cellEdited', function (cell) { cell.getElement().classList.add('gs-canviat'); marcaBrut(true); $('gsEstat').textContent = 'Canvis sense desar als equips'; });
    S.taula.on('tableBuilt', ajustaAlcada);
  }
  // PAS 58 · Per persona: a quins equips és una persona i quin nivell té a cada mòdul (i per quin equip)
  function pintaPermisosPersona(r) {
    $('gsTaula').innerHTML = ''; marcaBrut(false);
    var pers = r.persones || [], sel = S.persPerm || '';
    $('gsEines').innerHTML = '<div class="gs-pestanyes" role="tablist"><button type="button" role="tab" data-accio="vista-equips" aria-selected="false">Equips i membres</button>' +
      '<button type="button" role="tab" data-accio="vista-permisos" aria-selected="false">Permisos</button><button type="button" role="tab" data-accio="vista-persona" aria-selected="true">Per persona</button></div>' +
      '<label class="gs-check">Persona <select id="gsPersPerm"><option value="">— Tria —</option>' + pers.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nom) + (p.baixa ? ' (baixa)' : '') + ' · ' + esc(p.especialitat || '') + '</option>'; }).join('') + '</select></label>' +
      '<p class="gs-ajuda" style="flex:1 1 100%;margin:4px 0 0">Equips d’una persona i el nivell que té a cada mòdul: el més alt dels seus equips actius. Si tots els permisos d’un mòdul venen d’equips amb grups, només veu l’alumnat d’aquests grups.</p>';
    $('gsPersPerm').addEventListener('change', function () { S.persPerm = this.value; pintaPermisosPersona(r); });
    if (!sel) { $('gsTaula').innerHTML = '<p class="gs-ajuda" style="padding:12px">Trieu una persona.</p>'; return; }
    var p = pers.filter(function (x) { return x.id === sel; })[0] || {}, prof = /^PRO-/.test(sel);
    var eqs = r.equips.filter(function (q) { return (q.membres_ids || []).indexOf(sel) >= 0 || (q.automatic && prof && !p.baixa); });
    var actius = eqs.filter(function (q) { return q.actiu !== 'no' && (!q.automatic || q.automatic.actiu); });
    var global = actius.some(function (q) { return (q.permisos || []).some(function (x) { return x.modul === '*' && x.nivell === 'admin'; }); });
    var files = r.moduls.map(function (m) {
      var fonts = [], n = -1;
      actius.forEach(function (q) { (q.permisos || []).forEach(function (x) { if (x.modul === m.id || x.modul === '*') { var k = NIVELLS.indexOf(String(x.nivell).toLowerCase()); if (k > n) n = k; fonts.push({ q: q, k: k }); } }); });
      if (global) n = NIVELLS.length - 1;
      if (m.id === 'equips' && !global) n = -1;
      var nota = '';
      var mx = fonts.filter(function (f) { return f.k === n; }), grups = mx.length && mx.every(function (f) { return (f.q.grups || []).length; }) ? mx.reduce(function (t, f) { return t.concat(f.q.grups); }, []) : [];
      return '<tr class="' + (n < 0 ? 'gs-gris' : '') + '"><td>' + esc(m.nom) + '</td><td><strong>' + (n < 0 ? '—' : esc(NOM_NIVELL[NIVELLS[n]])) + '</strong></td><td>' +
        (global ? 'Administració global' : nota || mx.map(function (f) { return esc(f.q.nom); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', ') + (n === 0 && m.id === 'amonestacions' ? ' (només les pròpies)' : '')) + '</td><td>' + (grups.length ? grups.map(function (g) { return '<span class="gs-pill">' + esc(g) + '</span>'; }).join('') : (n < 0 ? '' : 'tots')) + '</td></tr>';
    }).join('');
    $('gsTaula').innerHTML = '<div class="gs-matriu" style="padding:8px 12px"><h3 class="gs-amon__tit">Equips</h3>' + (eqs.length ? '<ul>' + eqs.map(function (q) { var inactiu = q.actiu === 'no' || (q.automatic && !q.automatic.actiu);
        return '<li><strong>' + esc(q.nom) + '</strong> <small class="gs-gris">' + esc(q.id_equip) + ' · ' + (q.tipus === 'docent' ? 'docent' : 'gestió') + (q.automatic ? ' · automàtic' : '') + (inactiu ? ' · <b>inactiu</b>' + (q.automatic && q.automatic.des_de ? ' fins al ' + esc(dataVista(q.automatic.des_de)) : '') : '') + '</small></li>'; }).join('') + '</ul>' : '<p class="gs-ajuda">No és de cap equip.</p>') +
      '<h3 class="gs-amon__tit">Nivell a cada mòdul</h3><table class="gs-form-taula gs-informe__taula gs-informe__taula--compacta"><thead><tr><th>Mòdul</th><th>Nivell</th><th>Per</th><th>Grups</th></tr></thead><tbody>' + files + '</tbody></table>' +
      '<p class="gs-ajuda">Els correus de config › admins també entren com a administració global (aquí no surten).</p></div>';
    ajustaAlcada();
  }
  // Matriu de permisos: una fila per equip actiu, una columna per mòdul (i «Tots els mòduls»)
  function pintaMatriuPermisos(r) {
    var moduls = [{ id: '*', nom: 'Tots els mòduls' }].concat(r.moduls.filter(function (m) { return m.id !== 'equips'; }));
    var nivellDe = function (q, mod) { var p = (q.permisos || []).filter(function (x) { return x.modul === mod; })[0]; return p ? String(p.nivell).toLowerCase() : ''; };
    var equips = r.equips.filter(function (q) { return q.actiu !== 'no'; });
    var opcions = function (sel, bloq) { return ['<option value="">—</option>'].concat(NIVELLS.map(function (n) { return '<option value="' + n + '"' + (sel === n ? ' selected' : '') + '>' + NOM_NIVELL[n] + '</option>'; })).join(''); };
    $('gsTaula').innerHTML = '<div class="gs-matriu"><table class="gs-form-taula"><thead><tr><th>Equip</th>' + moduls.map(function (m) { return '<th>' + esc(m.nom) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      equips.map(function (q) {
        return '<tr><td><strong>' + esc(q.nom) + '</strong><br><small>' + esc(q.id_equip) + ' · ' + (q.tipus === 'docent' ? 'Docent' : 'Gestió') + ' · ' + (q.automatic ? 'tot el professorat' : (q.membres || []).length + ' membres') + '</small></td>' +
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
      case 'sancions-llista': llistaSancions(); break;
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
      case 'mod-actualitza':   // PAS 72: ocupació i editor
        (S.brut ? pregunta('Actualitza', '<p>Hi ha canvis sense desar. Si actualitzeu, es perdran.</p>', [{ t: 'Actualitza igualment', valor: 1 }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]) : Promise.resolve(1)).then(function (v) {
          if (v !== 1) return; S.brut = false; if (S.modul.id === 'ocupacio') carregaOcupacio(); else if (S.modul.id === 'horaris_editor') carregaEditorHoraris();
          else if (S.modul.id === 'calendari') { carregaCalendari.forca = true; carregaCalendari(); } else if (S.modul.id === 'equips') { carregaEquips.forca = true; carregaEquips(); } else if (S.modul.id === 'departaments') carregaDepartaments(true); else if (S.modul.id === 'sancions') carregaSancions(true); else if (S.modul.id === 'notificacions') carregaNotificacions(true); });
        break;
      case 'hor-actualitza':   // PAS 68
        if (Object.keys(S.horBrut || {}).some(function (k) { return S.horBrut[k]; })) { pregunta('Actualitza', '<p>Hi ha canvis sense desar al planificador. Si actualitzeu, es perdran.</p>', [{ t: 'Actualitza igualment', valor: 1 }, { t: 'Cancel·la', valor: 0, tipus: 'ghost' }]).then(function (v) { if (v === 1) { S.horBrut = {}; S.brut = false; carregaHoraris(); } }); }
        else carregaHoraris();
        break;
      case 'cur-aplica-des': aplicaDesiderata(); break;
      case 'cur-comprova-des': comprovaDesiderata(); break;
      case 'prof-curriculum': carregaDesDelCurriculum(); break;
      case 'des-tancament': tancamentDesiderata(); break;
      case 'cur-hores': location.hash = 'ocupacio'; break;   // PAS 57: les hores són al mòdul Ocupació
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
      case 'vista-equips': case 'vista-permisos': case 'vista-persona':
        if (S.brut) { toast('Primer deseu o descarteu els canvis.', true); break; }
        S.vistaEquips = b.dataset.accio === 'vista-permisos' ? 'permisos' : b.dataset.accio === 'vista-persona' ? 'persona' : 'equips'; pintaVistaEquips(); break;
      case 'nou-equip': nouEquip(); break;
    }
  });
  $('gsBarra').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accio]'); if (!b) return;
    if (b.dataset.accio === 'desa') { if (S.modul.id === 'equips') { if (S.vistaEquips === 'permisos') desaMatriuPermisos(); else desaEquips(); } else desa(false); }
    if (b.dataset.accio === 'descarta') descarta();
  });

  // PAS 61 · Icones en lloc del text als cinc botons comuns (Visualització camps, Gestió camps, Actualitza, Excel i PDF), a tots
  // els mòduls: el text queda al títol (en passar-hi el ratolí) i a l'etiqueta accessible
  var ICONES_BOTONS = {
    'Visualització camps': ['columnes', '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/></svg>'],
    'Gestió camps': ['camps', '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>'],
    'Actualitza': ['actualitza', '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>'],
    // PAS 62: Excel i PDF com a etiquetes de color amb el nom (més clares que un dibuix)
    'Excel': ['excel', '<svg viewBox="0 0 34 24" width="34" height="24" aria-hidden="true"><rect x="0.5" y="2" width="33" height="20" rx="4" fill="#1D7044"/><text x="17" y="16.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" fill="#fff">XLS</text></svg>'],
    'PDF': ['pdf', '<svg viewBox="0 0 34 24" width="34" height="24" aria-hidden="true"><rect x="0.5" y="2" width="33" height="20" rx="4" fill="#C62828"/><text x="17" y="16.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" fill="#fff">PDF</text></svg>']
  };
  function iconitzaBotons(arrel) {
    [].forEach.call((arrel || document).querySelectorAll('button.prog-btn:not(.gs-ico)'), function (b) {
      var t = b.textContent.replace(/\s+/g, ' ').trim(), x = ICONES_BOTONS[t]; if (!x) return;
      b.classList.add('gs-ico', 'gs-ico--' + x[0]); if (!b.title) b.title = t; else if (b.title.indexOf(t) < 0) b.title = t + ' · ' + b.title;
      b.setAttribute('aria-label', t); b.innerHTML = x[1];
    });
  }
  (function () { var app = $('gsApp'); if (!app || !window.MutationObserver) return; iconitzaBotons(app);
    new MutationObserver(function () { iconitzaBotons(app); }).observe(app, { childList: true, subtree: true }); })();

  window.GestioApp = { S: S, comprovaVersio: comprovaVersio };   // per a les proves
  comprova();
})();
