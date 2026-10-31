/**
 * GESTIO · pont entre Netlify (web de l'institut) i els fulls de càlcul ijm_nucli_db i ijm_alumnat_db
 *
 * On va aquest codi: al full ijm_nucli_db › Extensions › Apps Script (fitxer Code.gs).
 * Aquest fitxer és una còpia de referència: si el canvies aquí, enganxa'l també a l'editor
 * i torna a desplegar (Desplega › Gestiona els desplegaments › ✏️ › Versió nova › Desplega).
 *
 * Seguretat: només respon si la petició porta el secret correcte (propietat de l'script GESTIO_SECRET),
 * que coneixen només aquest script i Netlify (variable GESTIO_SCRIPT_SECRET). Netlify comprova la sessió
 * amb Google i envia el correu de qui fa la petició; AQUEST script decideix què pot fer cada correu
 * (equips → permisos per mòdul). Ningú no entra directament als fulls.
 *
 * Fitxers:
 *   ijm_nucli_db   (on viu aquest script): professorat, equips, permisos, camps i historial de tots els mòduls.
 *   ijm_alumnat_db (fitxer a part, amb els seus permisos de Drive): pestanya «alumnes». L'obre aquest mateix
 *                  script amb l'ID que hi ha a config › db_alumnat. No necessita cap Apps Script propi.
 *
 * Pestanyes de ijm_nucli_db (es creen soles amb «configura»; les columnes es llegeixen pel nom de la capçalera):
 *   config      : clau | valor | descripcio          (admins d'emergència, estat, curs, fitxers i fonts d'importació)
 *   professorat : id_professor | <un camp per columna, definits a «camps»; els calculats no es desen> | data | desat_per
 *   equips      : id_equip | nom | tipus (gestio/docent) | descripcio | actiu
 *   membres     : id_equip | id_professor | carrec
 *   moduls      : id_modul | nom | descripcio | ordre | actiu
 *   permisos    : id_equip | id_modul (o *) | nivell (consulta/edicio/admin)
 *   camps       : modul | clau | nom | tipus | valors | obligatori | unic | visible_des_de | origen | ordre | actiu
 *   historial   : data | usuari | accio | taula | id | detall
 * Pestanya de ijm_alumnat_db:
 *   alumnes     : id_alumne | <camps del mòdul alumnat> | data | desat_per
 *
 * Nivells (cadascun inclou l'anterior):
 *   consulta : veure, filtrar i exportar (només els camps «visible_des_de = consulta»)
 *   edicio   : alta, baixa i modificació de files
 *   admin    : a més, camps (columnes) del mòdul · permisos del mòdul: pot donar «consulta» i «edicio» (PAS 26: només admin)
 *   admin global (equip amb permís «*» admin, o correu a config › admins): tots els mòduls, equips i nivell admin
 */

const FULL = { conf: 'config', prof: 'professorat', eq: 'equips', memb: 'membres', mod: 'moduls', perm: 'permisos',
  camps: 'camps', hist: 'historial', alu: 'alumnes' };
const CAP = {
  equips: ['id_equip', 'nom', 'tipus', 'descripcio', 'actiu'],
  membres: ['id_equip', 'id_professor', 'carrec'],
  moduls: ['id_modul', 'nom', 'descripcio', 'ordre', 'actiu'],
  permisos: ['id_equip', 'id_modul', 'nivell'],
  camps: ['modul', 'clau', 'nom', 'tipus', 'valors', 'obligatori', 'unic', 'visible_des_de', 'origen', 'ordre', 'actiu'],
  historial: ['data', 'usuari', 'accio', 'taula', 'id', 'detall'],
};
const ESQUEMA = 25;   // versió de l'estructura dels fulls (la desa «configura» a config › esquema)
const CONFIG_PER_DEFECTE = [
  ['admins', '', 'Accés d\'emergència: correus (separats per comes) que sempre entren com a admin global, encara que els permisos tinguin un error. Només es canvia aquí.'],
  ['estat', 'obert', 'obert o tancat. Si és tancat, només els admins globals poden desar.'],
  ['curs', '2026-2027', 'Curs actual (informatiu).'],
  ['font_professorat', '', 'Per a importaProfessorat: ID (o URL) del full amb les dades actuals del professorat.'],
  ['font_professorat_pestanya', '', 'Per a importaProfessorat: nom de la pestanya (en blanc = la primera).'],
  ['db_alumnat', '', 'ID (o URL) del full ijm_alumnat_db, on es desen les dades del mòdul Alumnat.'],
  ['font_alumnat', '', 'Per a importaAlumnat: URL dels fulls de registre (1r ESO, 2n ESO…), separats per comes.'],
  ['font_alumnat_pestanya', 'Dades', 'Per a importaAlumnat: nom de la pestanya amb les dades de cada full de registre.'],
  ['esquema', '', 'Versió de l\'estructura dels fulls. La posa «configura»: no la canvieu.'],
];
const MODULS_PER_DEFECTE = [
  ['professorat', 'Professorat', 'Dades administratives de cada docent: graella amb filtres, alta, baixa i modificació.', 1, 'si'],
  ['alumnat', 'Alumnat', 'Dades acadèmiques de l\'alumnat (1r i 2n d\'ESO): grups, optatives, diversitat i autoritzacions.', 2, 'si'],
  ['equips', 'Equips i permisos', 'Equips de gestió i docents, i quins mòduls hi té accés cada equip. Només direcció.', 99, 'si'],
];
// Camps inicials (els admins del mòdul en poden afegir, canviar i arxivar des del web)
// [clau, nom, tipus, valors, obligatori, unic, visible_des_de, origen]
const CAMPS_PROFESSORAT = [
  ['nom', 'Nom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom1', '1r cognom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom2', '2n cognom', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['estat', 'Estat', 'llista', 'actiu|baixa laboral|substitut|baixa', 'si', 'no', 'edicio', 'gestio'],
  ['nif', 'NIF', 'nif', '', 'no', 'si', 'edicio', 'gestio'],
  ['especialitat', 'Especialitat', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['email_xtec', 'Correu XTEC', 'correu', '@xtec.cat', 'no', 'si', 'consulta', 'gestio'],
  ['email', 'Correu institutjoanmiro', 'correu', '@institutjoanmiro.cat', 'si', 'si', 'consulta', 'gestio'],
  ['jornada', 'Jornada', 'llista', 'Sencera|1/2|⅔', 'no', 'no', 'edicio', 'gestio'],
  ['situacio', 'Situació laboral', 'llista', 'Definitiu|Comissió de serveis|Provisional|Interí', 'no', 'no', 'edicio', 'gestio'],
  ['anys', 'Anys', 'numero', '', 'no', 'no', 'edicio', 'gestio'],
  ['catala', 'Català', 'text', '', 'no', 'no', 'edicio', 'gestio'],
  ['carrec', 'Càrrec', 'text', '', 'no', 'no', 'consulta', 'gestio'],
];
// PAS 24: el nivell consulta del professorat només veu aquests camps (la resta passen a «des d'edició»)
const PROFESSORAT_CONSULTA = ['nom', 'cognom1', 'cognom2', 'especialitat', 'email_xtec', 'email', 'carrec'];
const GRUPS_1R = ['1r ESO A', '1r ESO B', '1r ESO C', '1r ESO D', '1r ESO GR'];
const GRUPS_2N = ['2n ESO A', '2n ESO B', '2n ESO C', '2n ESO D', '2n ESO GR'];
const OPTATIVES_1R = ['Alemany', 'Francès', 'Italià', 'Anglès', 'Tècniques d\'estudi', 'Esports de raqueta', 'Taller de matemàtiques', 'Taller d\'expressió'];
const OPTATIVES_2N = ['Alemany', 'Francès', 'Italià', 'Anglès', 'Taller d\'expressió', 'Expressió artística', 'Esports de raqueta'];
const ESTATS_ALUMNAT = ['promociona', 'repeteix 1r', 'repeteix 2n', 'alumne extern', 'baixa'];
const CAMPS_ALUMNAT = [
  ['nom', 'Nom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom1', '1r cognom', 'text', '', 'si', 'no', 'consulta', 'gestio'],
  ['cognom2', '2n cognom', 'text', '', 'no', 'no', 'consulta', 'gestio'],
  ['grup_2526', 'Grup-Classe 25-26', 'llista', GRUPS_1R.concat(GRUPS_2N).join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['grup_2627', 'Grup-Classe 26-27', 'llista', GRUPS_1R.concat(GRUPS_2N).join('|'), 'si', 'no', 'consulta', 'gestio'],
  ['estat', 'Estat', 'llista', ESTATS_ALUMNAT.join('|'), 'si', 'no', 'consulta', 'gestio'],
  ['optativa_1r', 'Optativa 1r', 'llista', OPTATIVES_1R.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['optativa_2n', 'Optativa 2n', 'llista', OPTATIVES_2N.join('|'), 'no', 'no', 'consulta', 'gestio'],
  ['div_mates', 'Div. mates', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['div_catala', 'Div. català', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['div_castella', 'Div. castellà', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['nouvingut', 'Nouvingut', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['data_arribada', 'Data arribada', 'data', '', 'no', 'no', 'consulta', 'gestio'],
  ['pi_psp', 'PI/PSP', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['nese_a', 'NESE-A', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['nese_b', 'NESE-B', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['nee', 'NEE', 'si_no', '', 'no', 'no', 'consulta', 'gestio'],
  ['aut_imatge', 'Aut. imatge', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_dies_especials', 'Aut. dies especials', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
  ['aut_medicaments', 'Aut. medicaments', 'llista', 'sí|no', 'no', 'no', 'consulta', 'gestio'],
];
// Capçaleres del full actual de professorat → clau del camp (per a importaProfessorat)
const IMPORTACIO_PROFESSORAT = {
  'nom': 'nom', '1r cognom': 'cognom1', '2n cognom': 'cognom2', 'nif': 'nif', 'especialitat': 'especialitat',
  'email xtec': 'email_xtec', 'email institutjoanmiro': 'email', 'jornada': 'jornada',
  'anys': 'anys', 'català': 'catala', 'catala': 'catala', 'càrrec': 'carrec', 'carrec': 'carrec',
};
// Capçaleres dels fulls de registre d'alumnat → clau del camp (per a importaAlumnat)
const IMPORTACIO_ALUMNAT = {
  'grup-classe 25-26': 'grup_2526', 'grup-classe 26-27': 'grup_2627', 'optativa 1r': 'optativa_1r', 'optativa 2n': 'optativa_2n',
  'div mates': 'div_mates', 'div català': 'div_catala', 'div catala': 'div_catala', 'div castellà': 'div_castella', 'div castella': 'div_castella',
  'nouvingut': 'nouvingut', 'data arribada': 'data_arribada', 'pi/psp': 'pi_psp', 'nese-a': 'nese_a', 'nese-b': 'nese_b', 'nee': 'nee',
  'aut. imatge': 'aut_imatge', 'dies especials': 'aut_dies_especials', 'aut. dies especials': 'aut_dies_especials',
  'medicaments': 'aut_medicaments', 'aut. medicaments': 'aut_medicaments',
};
// Noms d'optatives als fulls antics → nom de la llista
const OPTATIVA_ALIES = { 'c.científic': 'Taller de matemàtiques', 'c. científic': 'Taller de matemàtiques', 'construïm coneixement científic': 'Taller de matemàtiques',
  'esports raquetes': 'Esports de raqueta', 'raquetes': 'Esports de raqueta', 'iniciació als esports de raqueta': 'Esports de raqueta',
  'tecnificació en esports de raqueta': 'Esports de raqueta', 'anglès (reforç)': 'Anglès', 'opt. anglès': 'Anglès',
  'cons_mates': 'Taller de matemàtiques', 'cons mates': 'Taller de matemàtiques', 'cons. mates': 'Taller de matemàtiques' };
// Observacions dels fulls de registre → estat
const ESTAT_ALIES = { 'nou alumne': 'alumne extern', 'alumne nou': 'alumne extern', 'extern': 'alumne extern', 'repetidor 1r': 'repeteix 1r',
  'repetidor 2n': 'repeteix 2n' };
// Situació laboral: al full original són quatre columnes excloents (amb una X); a GESTIO és un sol camp
const SITUACIONS = { 'definitiu': 'Definitiu', 'comissió serveis': 'Comissió de serveis', 'comissio serveis': 'Comissió de serveis',
  'comissió de serveis': 'Comissió de serveis', 'provisional': 'Provisional', 'interí': 'Interí', 'interi': 'Interí' };
const CLAUS_SITUACIO_ANTIGUES = ['definitiu', 'comissio_serveis', 'provisional', 'interi'];
// Estat de cada docent (camp obligatori i de sistema: no es pot arxivar ni canviar de tipus)
//   actiu · baixa laboral · substitut : formen part del claustre d'aquest curs
//   baixa                             : ja no hi forma part (no pot entrar a GESTIO; es pot reactivar)
// Estat de l'alumnat: promociona · repeteix 1r · repeteix 2n · alumne extern · baixa (baixa = s'amaga per defecte)
const deBaixa_ = (r) => norm_(r.estat) === 'baixa';
const TIPUS = ['text', 'numero', 'data', 'llista', 'si_no', 'correu', 'nif', 'calculat'];
// PAS 23: aquests camps calculats ja no formen part del mòdul (el nom complet es compon on cal)
const CALCULATS_RETIRATS = ['nom_cognom', 'nom_complet', 'nom_cognoms'];
// Valors antics de jornada → valors de la llista
const JORNADA_ALIES = { 'completa': 'Sencera', 'sencera': 'Sencera', 'complet': 'Sencera', '1': 'Sencera', '1/1': 'Sencera',
  '1/2': '1/2', 'mitja': '1/2', 'mitja jornada': '1/2', '0,5': '1/2', '0.5': '1/2', '2/3': '⅔', '⅔': '⅔' };
const NIVELLS = ['consulta', 'edicio', 'admin'];
const MAX_TEXT = 2000;

// Mòduls amb graella de dades: on es desen i com són els codis interns
const MODULS = {
  professorat: { full: FULL.prof, id: 'id_professor', prefix: 'PRO-', xifres: 4, equips: true, nom: 'docent', ss: () => SpreadsheetApp.getActive() },
  alumnat: { full: FULL.alu, id: 'id_alumne', prefix: 'ALU-', xifres: 5, equips: false, nom: 'alumne', ss: () => ssAlumnat_() },
};
function ssAlumnat_() {
  const id = (String(llegeixConfig_().db_alumnat || '').match(/[-\w]{25,}/) || [''])[0];
  if (!id) throw new Error('db_alumnat_no_configurat');
  return SpreadsheetApp.openById(id);
}
const nivellAlumne_ = (v) => { const g = String(v.grup_2627 || ''); return /^1r/i.test(g) ? 1 : /^2n/i.test(g) ? 2 : 0; };
// Regles entre camps (a més de la validació de cada camp). Retornen null o { error, camp }.
// canviats: en una modificació, la regla només es comprova si ha canviat algun dels camps que hi intervenen.
const REGLES = {
  alumnat: (v, canviats) => {
    if (canviats && !canviats.some((k) => ['grup_2526', 'grup_2627', 'estat', 'optativa_2n'].indexOf(k) >= 0)) return null;
    const n = nivellAlumne_(v);
    if (n === 1) {
      if (String(v.grup_2526 || '').trim()) return { error: 'no_aplica_1r', camp: 'Grup-Classe 25-26' };
      if (String(v.optativa_2n || '').trim()) return { error: 'no_aplica_1r', camp: 'Optativa 2n' };
      if (v.estat && ['alumne extern', 'repeteix 1r', 'baixa'].indexOf(v.estat) < 0) return { error: 'estat_nivell', camp: 'Estat' };
    }
    if (n === 2 && v.estat === 'repeteix 1r') return { error: 'estat_nivell', camp: 'Estat' };
    return null;
  },
};

// ---------------------------------------------------------------------------------------------
function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'peticio_invalida' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('GESTIO_SECRET');
  if (!secret || req.secret !== secret) return json_({ ok: false, error: 'no_autoritzat' });
  try {
    const email = String(req.email || '').trim().toLowerCase();
    if (req.action === 'ping') return json_({ ok: true, missatge: 'Connexió correcta amb ijm_nucli_db' });
    if (!email) return json_({ ok: false, error: 'peticio_invalida' });
    const ctx = context_(email);
    switch (req.action) {
      case 'inici':        return json_(inici_(ctx));
      case 'dades':        return json_(dades_(ctx, req.modul));
      case 'desa':         return json_(desa_(ctx, req));
      case 'esborra':      return json_(esborra_(ctx, req));
      case 'camps_desa':   return json_(campsDesa_(ctx, req));
      case 'permisos':     return json_(permisos_(ctx, req.modul));
      case 'permisos_desa':return json_(permisosDesa_(ctx, req));
      case 'equips':       return json_(equips_(ctx));
      case 'equips_desa':  return json_(equipsDesa_(ctx, req));
      case 'membres_desa': return json_(membresDesa_(ctx, req));
      case 'permisos_matriu_desa': return json_(permisosMatriuDesa_(ctx, req));
      default:             return json_({ ok: false, error: 'accio_desconeguda' });
    }
  } catch (err) {
    const m = String(err && err.message || err);
    if (m === 'db_alumnat_no_configurat') return json_({ ok: false, error: m });
    return json_({ ok: false, error: 'error_script', detall: m });
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ------------------------------------------------------------------ qui és i què pot fer
function context_(email) {
  const cfg = llegeixConfig_();
  const admins = String(cfg.admins || '').toLowerCase().split(/[,;\s]+/).filter(Boolean);
  const prof = llegeix_(FULL.prof);
  const p = prof.filter((x) => String(x.email || '').toLowerCase() === email && !deBaixa_(x))[0] || null;
  const meus = p ? llegeix_(FULL.memb).filter((m) => m.id_professor === p.id_professor).map((m) => m.id_equip) : [];
  const equipsActius = llegeix_(FULL.eq).filter((q) => norm_(q.actiu) !== 'no').map((q) => q.id_equip);
  const eqs = meus.filter((id) => equipsActius.indexOf(id) >= 0);
  const perms = llegeix_(FULL.perm).filter((r) => eqs.indexOf(r.id_equip) >= 0);
  const global = admins.indexOf(email) >= 0 || perms.some((r) => r.id_modul === '*' && norm_(r.nivell) === 'admin');
  const nivell = (modul) => {
    if (global) return 'admin';
    if (modul === 'equips') return '';   // equips i permisos: només admins globals
    let n = -1;
    perms.forEach((r) => { if (r.id_modul === modul || r.id_modul === '*') n = Math.max(n, NIVELLS.indexOf(norm_(r.nivell))); });
    return n >= 0 ? NIVELLS[n] : '';
  };
  return { email: email, persona: p, equips: eqs, global: global, nivell: nivell, cfg: cfg };
}
const pot_ = (ctx, modul, nivell) => NIVELLS.indexOf(ctx.nivell(modul)) >= NIVELLS.indexOf(nivell);
const obert_ = (ctx) => norm_(ctx.cfg.estat || 'obert') === 'obert' || ctx.global;

function inici_(ctx) {
  const moduls = llegeix_(FULL.mod).filter((m) => norm_(m.actiu) !== 'no')
    .map((m) => ({ id: m.id_modul, nom: m.nom, descripcio: m.descripcio, ordre: Number(m.ordre) || 50, nivell: ctx.nivell(m.id_modul) }))
    .filter((m) => m.nivell)
    .sort((a, b) => a.ordre - b.ordre);
  if (!moduls.length) return { ok: false, error: 'sense_acces' };
  const p = ctx.persona;
  return { ok: true, email: ctx.email, nom: p ? [p.nom, p.cognom1].filter(Boolean).join(' ') : '', id_professor: p ? p.id_professor : '',
    admin_global: ctx.global, moduls: moduls, estat: norm_(ctx.cfg.estat || 'obert') };
}

// ------------------------------------------------------------------ dades d'un mòdul (graella)
function campsDe_(modul, totes) {
  return llegeix_(FULL.camps).filter((c) => c.modul === modul && (totes || norm_(c.actiu) !== 'no'))
    .map((c) => ({ clau: c.clau, nom: c.nom || c.clau, tipus: TIPUS.indexOf(c.tipus) >= 0 ? c.tipus : 'text', valors: c.valors || '',
      obligatori: norm_(c.obligatori) === 'si', unic: norm_(c.unic) === 'si', visible_des_de: NIVELLS.indexOf(c.visible_des_de) >= 0 ? c.visible_des_de : 'consulta',
      origen: c.origen === 'clickedu' ? 'clickedu' : 'gestio', ordre: Number(c.ordre) || 0, actiu: norm_(c.actiu) !== 'no' }))
    .sort((a, b) => a.ordre - b.ordre);
}
const visibles_ = (ctx, modul, camps) => camps.filter((c) => NIVELLS.indexOf(ctx.nivell(modul)) >= NIVELLS.indexOf(c.visible_des_de));

function dades_(ctx, modul) {
  const M = MODULS[modul];
  if (!M) return { ok: false, error: 'modul_desconegut' };
  if (!pot_(ctx, modul, 'consulta')) return { ok: false, error: 'sense_permis' };
  const tots = campsDe_(modul, true);
  const camps = visibles_(ctx, modul, tots.filter((c) => c.actiu));
  const veuEstat = camps.some((c) => c.clau === 'estat');
  const ambEquips = M.equips && pot_(ctx, modul, 'edicio');
  const membres = ambEquips ? llegeix_(FULL.memb) : [];
  const files = llegeixFull_(fullModul_(M, tots))
    // Qui no pot veure l'estat (p. ex. consulta del professorat) només veu les files que no són de baixa
    .filter((r) => veuEstat || !deBaixa_(r))
    .map((r) => {
      const o = { id: r[M.id], data: r.data || '', desat_per: r.desat_per || '' };
      camps.forEach((c) => { o[c.clau] = c.tipus === 'calculat' ? calcula_(c, r) : (r[c.clau] == null ? '' : r[c.clau]); });
      if (ambEquips) o.equips = membres.filter((m) => m.id_professor === r[M.id]).map((m) => m.id_equip);
      return o;
    });
  const equips = ambEquips ? llegeix_(FULL.eq).filter((q) => norm_(q.actiu) !== 'no').map((q) => ({ id: q.id_equip, nom: q.nom, tipus: q.tipus })) : [];
  const nivell = ctx.nivell(modul);
  return { ok: true, modul: modul, nivell: nivell, obert: obert_(ctx), admin_global: ctx.global, amb_equips: ambEquips, nom_fila: M.nom,
    camps: camps, camps_tots: nivell === 'admin' ? tots : undefined, files: files, equips: equips };
}

// ------------------------------------------------------------------ desar canvis (alta, modificació, baixa)
function calcula_(c, v) {
  // valors = «nom cognom1 cognom2» o «cognom1 cognom2, nom»: claus separades per espais; la coma es manté
  return String(c.valors || '').replace(/[a-z_0-9]+/g, (k) => String(v[k] == null ? '' : v[k]).trim())
    .replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
}
// DNI (8 xifres + lletra) o NIE (X/Y/Z + 7 xifres + lletra), amb la lletra de control
function nifValid_(x) {
  const m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(x);
  if (!m || (m[1] && m[2].length !== 7) || (!m[1] && m[2].length !== 8)) return false;
  const n = Number(({ X: '0', Y: '1', Z: '2' }[m[1]] || '') + m[2]);
  return 'TRWAGMYFPDXBNJZSQVHLCKE'.charAt(n % 23) === m[3];
}
// Data aaaa-mm-dd que existeix (no 2026-02-30)
function dataValida_(x) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
// canviats: si es passa, el format només es comprova als camps que han canviat (les dades antigues que no
// compleixen el format no impedeixen desar una altra columna de la mateixa fila); l'obligatori, sempre.
function valida_(camps, v, canviats) {
  for (const c of camps) {
    const x = String(v[c.clau] == null ? '' : v[c.clau]).trim();
    if (c.tipus === 'calculat') continue;
    if (c.obligatori && !x) return { error: 'obligatori', camp: c.nom };
    if (!x) continue;
    if (canviats && canviats.indexOf(c.clau) < 0) continue;
    if (c.tipus === 'nif' && !nifValid_(x)) return { error: 'nif_invalid', camp: c.nom };
    if (x.length > MAX_TEXT) return { error: 'massa_llarg', camp: c.nom };
    if (c.tipus === 'numero' && isNaN(Number(x.replace(',', '.')))) return { error: 'numero_invalid', camp: c.nom };
    if (c.tipus === 'data' && !dataValida_(x)) return { error: 'data_invalida', camp: c.nom };
    if (c.tipus === 'si_no' && ['si', 'sí', 'no'].indexOf(x.toLowerCase()) < 0) return { error: 'si_no_invalid', camp: c.nom };
    if (c.tipus === 'correu') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) return { error: 'correu_invalid', camp: c.nom };
      if (c.valors && c.valors.charAt(0) === '@' && !x.toLowerCase().endsWith(c.valors.toLowerCase())) return { error: 'correu_domini', camp: c.nom, domini: c.valors };
    }
    if (c.tipus === 'llista' && c.valors) {
      const ops = c.valors.split('|').map((s) => s.trim());
      if (ops.indexOf(x) < 0) return { error: 'valor_no_permes', camp: c.nom };
    }
  }
  return null;
}

function desa_(ctx, req) {
  const modul = String(req.modul || ''), M = MODULS[modul];
  if (!M) return { ok: false, error: 'modul_desconegut' };
  if (!pot_(ctx, modul, 'edicio')) return { ok: false, error: 'sense_permis' };
  if (!obert_(ctx)) return { ok: false, error: 'tancat' };
  const canvis = Array.isArray(req.canvis) ? req.canvis : [], altes = Array.isArray(req.altes) ? req.altes : [];
  if (canvis.length + altes.length > 500) return { ok: false, error: 'massa_canvis' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const totsCamps = campsDe_(modul, true);
    const sh = fullModul_(M, totsCamps);
    const editables = visibles_(ctx, modul, totsCamps.filter((c) => c.actiu && c.origen !== 'clickedu' && c.tipus !== 'calculat'));
    const regla = REGLES[modul] || (() => null);
    const vals = sh.getDataRange().getDisplayValues();
    const cap = vals[0].map(norm_);
    const col = (k) => cap.indexOf(k);
    const files = vals.slice(1).map((r, i) => ({ fila: i + 2, r: r }));
    const perId = {};
    files.forEach((f) => { const id = String(f.r[col(M.id)]).trim(); if (id) perId[id] = f; });
    const ara = ara_();
    const conflictes = [], errors = [];
    const resultat = [];
    // 1) Modificacions (inclosa la baixa: valors.estat = 'baixa' / reactivació: un altre estat)
    const plans = [];
    canvis.forEach((c) => {
      const f = perId[String(c.id)];
      if (!f) { errors.push({ id: c.id, error: 'no_existeix' }); return; }
      const dataFila = String(f.r[col('data')] || '');
      if (!req.forca && String(c.data_anterior || '') !== dataFila) conflictes.push({ id: c.id, desat_per: f.r[col('desat_per')], data: dataFila });
      const actual = {}; cap.forEach((k, j) => { if (k) actual[k] = f.r[j]; });
      const nou = Object.assign({}, actual);
      const v = c.valors || {};
      editables.forEach((cm) => { if (Object.prototype.hasOwnProperty.call(v, cm.clau)) nou[cm.clau] = net_(v[cm.clau], cm); });
      const err = valida_(editables, nou, Object.keys(v)) || regla(nou, Object.keys(v));
      if (err) errors.push(Object.assign({ id: c.id }, err));
      plans.push({ f: f, abans: actual, nou: nou, equips: M.equips && Array.isArray(v.equips) ? v.equips : null });
    });
    // 2) Altes
    const altesPlans = [];
    let seguent = 1 + Object.keys(perId).reduce((m, id) => { const n = Number(String(id).replace(/\D/g, '')); return n > m ? n : m; }, 0);
    altes.forEach((a, k) => {
      const v = a.valors || {}, nou = {};
      editables.forEach((cm) => { nou[cm.clau] = net_(v[cm.clau], cm); });
      if (modul === 'professorat' && totsCamps.some((cm) => cm.clau === 'estat') && !nou.estat) nou.estat = 'actiu';
      const err = valida_(editables, nou) || regla(nou);
      nou[M.id] = codi_(M, seguent++);
      if (err) errors.push(Object.assign({ id: a.tmp || ('alta-' + (k + 1)) }, err));
      altesPlans.push({ tmp: a.tmp, nou: nou, equips: M.equips && Array.isArray(v.equips) ? v.equips : null });
    });
    // 3) Valors únics (entre totes les files, tenint en compte els canvis)
    const unics = totsCamps.filter((c) => c.unic);
    const tmpDe = {}; altesPlans.forEach((p, k) => { tmpDe[p.nou[M.id]] = p.tmp || ('alta-' + (k + 1)); });
    if (unics.length) {
      const finals = {};
      files.forEach((f) => { const id = String(f.r[col(M.id)]); const o = {}; cap.forEach((k, j) => { o[k] = f.r[j]; }); finals[id] = o; });
      plans.forEach((p) => { finals[String(p.abans[M.id])] = p.nou; });
      altesPlans.forEach((p) => { finals[p.nou[M.id]] = p.nou; });
      unics.forEach((u) => {
        const vist = {};
        Object.keys(finals).forEach((id) => {
          const x = String(finals[id][u.clau] || '').trim().toLowerCase();
          if (!x) return;
          if (vist[x]) errors.push({ id: tmpDe[id] || id, error: 'repetit', camp: u.nom });
          vist[x] = id;
        });
      });
    }
    if (errors.length) return { ok: false, error: 'validacio', errors: errors };
    if (conflictes.length) return { ok: false, error: 'conflicte', conflictes: conflictes };
    // 4) Equips: només els admins globals canvien qui és a cada equip
    const vol = plans.some((p) => p.equips) || altesPlans.some((p) => p.equips);
    if (vol && !ctx.global) return { ok: false, error: 'equips_no_permes' };
    // 5) Escriure
    const usuari = ctx.email;
    plans.forEach((p) => {
      p.nou.data = ara; p.nou.desat_per = usuari;
      const fila = cap.map((k) => (k && p.nou[k] !== undefined ? p.nou[k] : ''));
      sh.getRange(p.f.fila, 1, 1, cap.length).setValues([fila]);
      const eraBaixa = deBaixa_(p.abans), esBaixa = deBaixa_(p.nou);
      historial_(usuari, esBaixa && !eraBaixa ? 'baixa' : (!esBaixa && eraBaixa ? 'reactivacio' : 'modificacio'), M.full, p.abans[M.id], difer_(p.abans, p.nou));
      resultat.push(p.nou);
    });
    altesPlans.forEach((p) => {
      p.nou.data = ara; p.nou.desat_per = usuari;
      sh.appendRow(cap.map((k) => (k && p.nou[k] !== undefined ? p.nou[k] : '')));
      historial_(usuari, 'alta', M.full, p.nou[M.id], '');
      resultat.push(Object.assign({ tmp: p.tmp }, p.nou));
    });
    if (vol) {
      const canviEquips = plans.filter((p) => p.equips).map((p) => ({ id: String(p.abans[M.id]), equips: p.equips }))
        .concat(altesPlans.filter((p) => p.equips).map((p) => ({ id: p.nou[M.id], equips: p.equips })));
      desaMembres_(canviEquips, usuari);
    }
    const ambEquips = M.equips && pot_(ctx, modul, 'edicio');
    const membres = ambEquips ? llegeix_(FULL.memb) : [];
    return { ok: true, data: ara, files: resultat.map((r) => ({ tmp: r.tmp, id: r[M.id], data: r.data,
      equips: ambEquips ? membres.filter((m) => m.id_professor === r[M.id]).map((m) => m.id_equip) : undefined,
      valors: visibles_(ctx, modul, totsCamps).reduce((o, c) => { o[c.clau] = c.tipus === 'calculat' ? calcula_(c, r) : (r[c.clau] == null ? '' : r[c.clau]); return o; }, {}) })) };
  } finally { lock.releaseLock(); }
}
const codi_ = (M, n) => M.prefix + ('00000000' + n).slice(-M.xifres);
const apostrof_ = (s) => String(s == null ? '' : s).replace(/[’´`]/g, '\'');
function net_(x, c) {
  let s = apostrof_(x).trim();
  const l = s.toLowerCase();
  if (c.tipus === 'si_no') s = ['si', 'sí', 'x', 'true', '1', 'verdadero', 'cert'].indexOf(l) >= 0 ? 'sí' : (['no', 'false', '0', 'falso', 'fals', 'n'].indexOf(l) >= 0 || !s ? '' : s);
  if (c.tipus === 'correu') s = s.toLowerCase();
  if (c.tipus === 'numero') s = s.replace(',', '.');
  if (c.tipus === 'nif') s = s.toUpperCase().replace(/[\s.\-]/g, '');
  if (c.tipus === 'data' && ['false', 'true', 'fals', 'cert', '-'].indexOf(l) >= 0) s = '';
  if (c.tipus === 'data') { const m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s); if (m) s = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
  if (c.clau === 'jornada' && JORNADA_ALIES[l]) s = JORNADA_ALIES[l];
  if (c.clau.indexOf('optativa') === 0 && OPTATIVA_ALIES[l]) s = OPTATIVA_ALIES[l];
  if (c.tipus === 'llista' && s && c.valors) {
    const ops = c.valors.split('|').map((o) => o.trim());
    if (ops.indexOf('sí') >= 0 && ['si', 'x', 'true'].indexOf(l) >= 0) s = 'sí';
    const op = ops.filter((o) => o.toLowerCase() === s.toLowerCase())[0];   // majúscules/minúscules com a la llista
    if (op) s = op;
  }
  return s;
}
function difer_(a, b) {
  const d = {};
  Object.keys(b).forEach((k) => { if (k !== 'data' && k !== 'desat_per' && String(a[k] == null ? '' : a[k]) !== String(b[k] == null ? '' : b[k])) d[k] = [a[k], b[k]]; });
  return JSON.stringify(d).slice(0, 45000);
}
function desaMembres_(canvis, usuari) {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.memb);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const ci = cap.indexOf('id_professor'), ce = cap.indexOf('id_equip');
  const ids = canvis.map((c) => c.id);
  const queden = vals.slice(1).filter((r) => ids.indexOf(String(r[ci])) < 0 && r.join('') !== '');
  canvis.forEach((c) => c.equips.forEach((e) => { const r = cap.map(() => ''); r[ci] = c.id; r[ce] = e; queden.push(r); }));
  if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
  if (queden.length) sh.getRange(2, 1, queden.length, cap.length).setValues(queden);
  canvis.forEach((c) => historial_(usuari, 'equips', FULL.memb, c.id, JSON.stringify(c.equips)));
}

// Esborrar del tot (només per a errors d'alta): admin del mòdul
function esborra_(ctx, req) {
  const modul = String(req.modul || ''), M = MODULS[modul];
  if (!M) return { ok: false, error: 'modul_desconegut' };
  if (!pot_(ctx, modul, 'admin')) return { ok: false, error: 'sense_permis' };
  const ids = (req.ids || []).map(String);
  if (!ids.length) return { ok: false, error: 'peticio_invalida' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = fullModul_(M, campsDe_(modul, true));
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_), ci = cap.indexOf(M.id);
    const esborrades = [];
    for (let i = vals.length - 1; i >= 1; i--) {
      if (ids.indexOf(String(vals[i][ci])) >= 0) {
        const o = {}; cap.forEach((k, j) => { o[k] = vals[i][j]; });
        historial_(ctx.email, 'esborra', M.full, String(vals[i][ci]), JSON.stringify(o).slice(0, 45000));
        sh.deleteRow(i + 1); esborrades.push(String(vals[i][ci]));
      }
    }
    if (M.equips) desaMembres_(esborrades.map((id) => ({ id: id, equips: [] })), ctx.email);
    return { ok: true, esborrades: esborrades };
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------------ camps (columnes) d'un mòdul: admin
function campsDesa_(ctx, req) {
  const modul = String(req.modul || ''), M = MODULS[modul];
  if (!M) return { ok: false, error: 'modul_desconegut' };
  if (!pot_(ctx, modul, 'admin')) return { ok: false, error: 'sense_permis' };
  const nous = Array.isArray(req.camps) ? req.camps : [];
  const existents = campsDe_(modul, true);
  const claus = {};
  const files = [];
  for (let i = 0; i < nous.length; i++) {
    const c = nous[i];
    const clau = String(c.clau || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(clau) || [M.id, 'id_persona', 'actiu', 'data', 'desat_per', 'equips', 'id'].indexOf(clau) >= 0) return { ok: false, error: 'clau_invalida', camp: clau || '(buida)' };
    if (claus[clau]) return { ok: false, error: 'clau_repetida', camp: clau };
    claus[clau] = 1;
    let tipus = TIPUS.indexOf(c.tipus) >= 0 ? c.tipus : 'text';
    if (!String(c.nom || '').trim()) return { ok: false, error: 'nom_buit', camp: clau };
    let valors = String(c.valors || '').slice(0, 1000), obligatori = !!c.obligatori, actiu = c.actiu !== false, origen = c.origen === 'clickedu' ? 'clickedu' : 'gestio';
    if (clau === 'estat') {
      // Camp de sistema: sempre llista obligatòria i activa, amb «baixa» (i al professorat, «actiu») com a valors
      tipus = 'llista'; obligatori = true; actiu = true; origen = 'gestio';
      const ops = valors.split('|').map((x) => x.trim()).filter(Boolean);
      (modul === 'professorat' ? ['actiu', 'baixa'] : ['baixa']).forEach((x) => { if (ops.indexOf(x) < 0) ops.push(x); });
      valors = ops.join('|');
    }
    files.push([modul, clau, String(c.nom).trim().slice(0, 80), tipus, valors, obligatori ? 'si' : 'no', c.unic ? 'si' : 'no',
      NIVELLS.indexOf(c.visible_des_de) >= 0 ? c.visible_des_de : 'consulta', origen, i + 1, actiu ? 'si' : 'no']);
  }
  // Un camp existent no es pot fer desaparèixer: s'arxiva (actiu = no) perquè les dades es conservin
  const perduts = existents.filter((e) => !claus[e.clau]).map((e) => e.clau);
  if (perduts.length) return { ok: false, error: 'camp_no_es_pot_treure', camps: perduts };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.camps);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_), cm = cap.indexOf('modul');
    const altres = vals.slice(1).filter((r) => String(r[cm]) !== modul && r.join('') !== '');
    const totes = altres.concat(files.map((f) => CAP.camps.map((k) => f[CAP.camps.indexOf(k)])));
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (totes.length) sh.getRange(2, 1, totes.length, CAP.camps.length).setValues(totes);
    fullModul_(M, campsDe_(modul, true));
    historial_(ctx.email, 'camps', FULL.camps, modul, JSON.stringify(files.map((f) => f.slice(1, 5))).slice(0, 45000));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------------ permisos d'un mòdul
// Es donen a equips. PAS 27: només els administradors globals (equips amb admin a «Tots els mòduls», p. ex. EQ-DIR)
// els gestionen, des del mòdul «Equips i permisos» (matriu: permisosMatriuDesa_). Dins dels mòduls ja no hi ha
// botó Permisos; aquestes dues accions es mantenen per compatibilitat, però també només per a admins globals.
function assignables_(ctx, modul) {
  return ctx.global ? NIVELLS.slice() : [];
}
function permisos_(ctx, modul) {
  if (!modul || !ctx.global) return { ok: false, error: 'sense_permis' };
  const perms = llegeix_(FULL.perm);
  const eqs = llegeix_(FULL.eq).filter((q) => norm_(q.actiu) !== 'no');
  const llista = eqs.map((q) => {
    const r = perms.filter((p) => p.id_equip === q.id_equip && p.id_modul === modul)[0];
    const total = perms.filter((p) => p.id_equip === q.id_equip && p.id_modul === '*')[0];
    return { id_equip: q.id_equip, nom: q.nom, tipus: q.tipus, nivell: r ? norm_(r.nivell) : '', tots_moduls: total ? norm_(total.nivell) : '' };
  });
  return { ok: true, modul: modul, equips: llista, assignables: assignables_(ctx, modul), nivell: ctx.nivell(modul) };
}
function permisosDesa_(ctx, req) {
  const modul = String(req.modul || '');
  if (!modul || modul === '*') return { ok: false, error: 'peticio_invalida' };
  const pots = assignables_(ctx, modul);
  if (!pots.length) return { ok: false, error: 'sense_permis' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.perm);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
    const ce = cap.indexOf('id_equip'), cm = cap.indexOf('id_modul'), cn = cap.indexOf('nivell');
    let files = vals.slice(1).filter((r) => r.join('') !== '');
    const canvis = Array.isArray(req.canvis) ? req.canvis : [];
    for (const c of canvis) {
      const eq = String(c.id_equip || ''), nou = norm_(c.nivell || '');
      const actual = files.filter((r) => String(r[ce]) === eq && String(r[cm]) === modul)[0];
      const nivellActual = actual ? norm_(actual[cn]) : '';
      // Només es toca un equip que tingui un nivell que es pugui donar (no es pot rebaixar un igual o superior)
      if (nivellActual && pots.indexOf(nivellActual) < 0) return { ok: false, error: 'nivell_no_permes', id_equip: eq };
      if (nou && pots.indexOf(nou) < 0) return { ok: false, error: 'nivell_no_permes', id_equip: eq };
      files = files.filter((r) => !(String(r[ce]) === eq && String(r[cm]) === modul));
      if (nou) { const r = cap.map(() => ''); r[ce] = eq; r[cm] = modul; r[cn] = nou; files.push(r); }
      historial_(ctx.email, 'permisos', FULL.perm, eq + ' · ' + modul, nivellActual + ' → ' + (nou || '(cap)'));
    }
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (files.length) sh.getRange(2, 1, files.length, cap.length).setValues(files);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// Matriu de permisos (mòdul Equips i permisos, només admins globals): canvis [{ id_equip, id_modul (o *), nivell ('' = cap) }]
function permisosMatriuDesa_(ctx, req) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const canvis = Array.isArray(req.canvis) ? req.canvis : [];
  const equips = llegeix_(FULL.eq).map((q) => q.id_equip), moduls = llegeix_(FULL.mod).map((m) => m.id_modul).concat(['*']);
  for (const c of canvis) {
    if (equips.indexOf(String(c.id_equip)) < 0) return { ok: false, error: 'id_equip_invalid', id_equip: c.id_equip };
    if (moduls.indexOf(String(c.id_modul)) < 0 || c.id_modul === 'equips') return { ok: false, error: 'peticio_invalida' };
    if (c.nivell && NIVELLS.indexOf(norm_(c.nivell)) < 0) return { ok: false, error: 'nivell_no_permes', id_equip: c.id_equip };
  }
  // Salvaguarda: l'equip directiu no es pot quedar sense «*» admin des del web (es canvia directament al full)
  if (canvis.some((c) => c.id_equip === 'EQ-DIR' && c.id_modul === '*' && norm_(c.nivell) !== 'admin')) return { ok: false, error: 'eq_dir_protegit' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.perm);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
    const ce = cap.indexOf('id_equip'), cm = cap.indexOf('id_modul'), cn = cap.indexOf('nivell');
    let files = vals.slice(1).filter((r) => r.join('') !== '');
    canvis.forEach((c) => {
      const eq = String(c.id_equip), mod = String(c.id_modul), nou = norm_(c.nivell || '');
      const abans = (files.filter((r) => String(r[ce]) === eq && String(r[cm]) === mod)[0] || [])[cn] || '';
      files = files.filter((r) => !(String(r[ce]) === eq && String(r[cm]) === mod));
      if (nou) { const r = cap.map(() => ''); r[ce] = eq; r[cm] = mod; r[cn] = nou; files.push(r); }
      if (norm_(abans) !== nou) historial_(ctx.email, 'permisos', FULL.perm, eq + ' · ' + mod, norm_(abans) + ' → ' + (nou || '(cap)'));
    });
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (files.length) sh.getRange(2, 1, files.length, cap.length).setValues(files);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------------ equips (només admins globals)
function equips_(ctx) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const membres = llegeix_(FULL.memb);
  const perms = llegeix_(FULL.perm);
  const prof = llegeix_(FULL.prof);
  const nomDe = (id) => { const p = prof.filter((x) => x.id_professor === id)[0]; return p ? [p.nom, p.cognom1, p.cognom2].filter(Boolean).join(' ') : id; };
  return { ok: true, equips: llegeix_(FULL.eq).map((q) => ({ id_equip: q.id_equip, nom: q.nom, tipus: q.tipus || 'gestio', descripcio: q.descripcio || '',
    actiu: norm_(q.actiu) === 'no' ? 'no' : 'si',
    membres: membres.filter((m) => m.id_equip === q.id_equip).map((m) => nomDe(m.id_professor)),
    membres_ids: membres.filter((m) => m.id_equip === q.id_equip).map((m) => m.id_professor),
    permisos: perms.filter((p) => p.id_equip === q.id_equip).map((p) => ({ modul: p.id_modul, nivell: p.nivell })) })),
    moduls: llegeix_(FULL.mod).map((m) => ({ id: m.id_modul, nom: m.nom })),
    // Per triar membres: tot el professorat que no és de baixa (els de baixa que ja hi són també surten)
    professorat: prof.filter((p) => !deBaixa_(p) || membres.some((m) => m.id_professor === p.id_professor))
      .map((p) => ({ id: p.id_professor, nom: [p.nom, p.cognom1, p.cognom2].filter(Boolean).join(' '), especialitat: p.especialitat || '', baixa: deBaixa_(p) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'ca')) };
}
function equipsDesa_(ctx, req) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const llista = Array.isArray(req.equips) ? req.equips : [];
  const vist = {};
  for (const q of llista) {
    const id = String(q.id_equip || '').trim().toUpperCase();
    if (!/^EQ-[A-Z0-9-]{1,20}$/.test(id)) return { ok: false, error: 'id_equip_invalid', id_equip: id || '(buit)' };
    if (vist[id]) return { ok: false, error: 'id_equip_repetit', id_equip: id };
    if (!String(q.nom || '').trim()) return { ok: false, error: 'nom_buit', camp: id };
    vist[id] = 1;
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.eq);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
    const antics = vals.slice(1).map((r) => String(r[cap.indexOf('id_equip')])).filter(Boolean);
    const treuen = antics.filter((id) => !vist[id]);
    if (treuen.length) return { ok: false, error: 'equip_no_es_pot_treure', equips: treuen };
    const files = llista.map((q) => cap.map((k) => ({ id_equip: String(q.id_equip).trim().toUpperCase(), nom: String(q.nom).trim(),
      tipus: q.tipus === 'docent' ? 'docent' : 'gestio', descripcio: String(q.descripcio || '').slice(0, 500), actiu: q.actiu === 'no' ? 'no' : 'si' })[k] || ''));
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (files.length) sh.getRange(2, 1, files.length, cap.length).setValues(files);
    historial_(ctx.email, 'equips', FULL.eq, '', JSON.stringify(llista.map((q) => q.id_equip + ':' + q.nom)).slice(0, 45000));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// Membres d'un equip (des del mòdul Equips): substitueix la llista de membres d'aquell equip. Només admins globals.
function membresDesa_(ctx, req) {
  if (!ctx.global) return { ok: false, error: 'sense_permis' };
  const eq = String(req.id_equip || '');
  if (!llegeix_(FULL.eq).some((q) => q.id_equip === eq)) return { ok: false, error: 'id_equip_invalid', id_equip: eq };
  const ids = (Array.isArray(req.membres) ? req.membres.map(String) : []).filter((id, i, t) => t.indexOf(id) === i);
  const existents = llegeix_(FULL.prof).map((p) => p.id_professor);
  const dolents = ids.filter((id) => existents.indexOf(id) < 0);
  if (dolents.length) return { ok: false, error: 'no_existeix', ids: dolents };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(FULL.memb);
    const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
    const ci = cap.indexOf('id_professor'), ce = cap.indexOf('id_equip'), cc = cap.indexOf('carrec');
    const antics = vals.slice(1).filter((r) => String(r[ce]) === eq);
    const queden = vals.slice(1).filter((r) => String(r[ce]) !== eq && r.join('') !== '');
    ids.forEach((id) => {
      const vell = antics.filter((r) => String(r[ci]) === id)[0];   // es conserva el càrrec dins l'equip
      const r = cap.map(() => ''); r[ce] = eq; r[ci] = id; if (vell && cc >= 0) r[cc] = vell[cc]; queden.push(r);
    });
    if (vals.length > 1) sh.getRange(2, 1, vals.length - 1, cap.length).clearContent();
    if (queden.length) sh.getRange(2, 1, queden.length, cap.length).setValues(queden);
    const abans = antics.map((r) => String(r[ci]));
    const entren = ids.filter((id) => abans.indexOf(id) < 0), surten = abans.filter((id) => ids.indexOf(id) < 0);
    historial_(ctx.email, 'membres', FULL.memb, eq, JSON.stringify({ entren: entren, surten: surten }));
    return { ok: true, entren: entren.length, surten: surten.length };
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------------ utilitats de fulls
// Claus que tenen columna a la pestanya de dades (els calculats es generen en llegir: no ocupen espai)
function desats_(camps) { return camps.filter((c) => c.tipus !== 'calculat').map((c) => c.clau); }
function norm_(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
function ara_() { return Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd HH:mm:ss'); }
function llegeixFull_(full) {
  if (!full || full.getLastRow() < 2) return [];
  const vals = full.getDataRange().getDisplayValues();
  const cap = vals[0].map(norm_);
  return vals.slice(1).filter((r) => r.join('') !== '').map((r) => {
    const o = {};
    cap.forEach((k, i) => { if (k) o[k] = String(r[i] == null ? '' : r[i]).trim(); });
    return o;
  });
}
function llegeix_(nom) { return llegeixFull_(SpreadsheetApp.getActive().getSheetByName(nom)); }
function llegeixConfig_() {
  const cfg = {};
  CONFIG_PER_DEFECTE.forEach((c) => { cfg[c[0]] = c[1]; });
  llegeix_(FULL.conf).forEach((r) => { if (r.clau) cfg[r.clau] = r.valor; });
  return cfg;
}
function historial_(usuari, accio, taula, id, detall) {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.hist);
  if (sh) sh.appendRow([ara_(), usuari, accio, taula, id, detall || '']);
}
/** Pestanya de dades d'un mòdul (al seu fitxer): la crea si no hi és i hi afegeix les columnes que falten */
function fullModul_(M, camps) {
  const ss = M.ss();
  const cap = [M.id].concat(desats_(camps), ['data', 'desat_per']);
  let sh = ss.getSheetByName(M.full);
  if (!sh) {
    sh = ss.insertSheet(M.full);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');   // text pla: dates i codis no es transformen
    sh.getRange(1, 1, 1, cap.length).setValues([cap]).setFontWeight('bold'); sh.setFrozenRows(1);
    return sh;
  }
  const actual = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_) : [];
  const falten = cap.filter((k) => actual.indexOf(k) < 0);
  if (falten.length) {
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
    sh.getRange(1, actual.length + 1, 1, falten.length).setValues([falten]).setFontWeight('bold');
  }
  return sh;
}
/** Pestanya del nucli (config, equips…): la crea si no hi és i hi afegeix al final les columnes que falten */
function assegura_(nom) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nom);
  const cap = (CAP[nom] || []).slice();
  if (!sh) {
    sh = ss.insertSheet(nom);
    if (cap.length) { sh.getRange(1, 1, 1, cap.length).setValues([cap]).setFontWeight('bold'); sh.setFrozenRows(1); }
    return sh;
  }
  if (!cap.length) return sh;
  const actual = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_) : [];
  const falten = cap.filter((k) => actual.indexOf(k) < 0);
  if (falten.length) sh.getRange(1, actual.length + 1, 1, falten.length).setValues([falten]).setFontWeight('bold');
  return sh;
}

// ---------------------------------------------------------------------------------------------
// Execució manual des de l'editor: crea les pestanyes, la configuració, els mòduls, els camps inicials,
// l'equip de direcció amb el permís admin a tots els mòduls i, si config › db_alumnat ja hi és, la pestanya
// «alumnes» d'ijm_alumnat_db. Adapta els fulls de versions anteriors. No esborra dades.
function configura() {
  const ss = SpreadsheetApp.getActive();
  canviaNomsPAS24_();
  [FULL.conf, FULL.eq, FULL.memb, FULL.mod, FULL.perm, FULL.camps, FULL.hist].forEach((n) => assegura_(n));
  const conf = ss.getSheetByName(FULL.conf);
  if (conf.getLastRow() < 1) conf.getRange(1, 1, 1, 3).setValues([['clau', 'valor', 'descripcio']]).setFontWeight('bold');
  const claus = llegeix_(FULL.conf).map((r) => r.clau);
  CONFIG_PER_DEFECTE.forEach((c) => { if (claus.indexOf(c[0]) < 0) conf.appendRow(c); });
  const mods = llegeix_(FULL.mod).map((m) => m.id_modul);
  MODULS_PER_DEFECTE.forEach((m) => { if (mods.indexOf(m[0]) < 0) ss.getSheetByName(FULL.mod).appendRow(m); });
  const esquema = Number(llegeixConfig_().esquema) || 0;
  const profNou = !llegeix_(FULL.camps).some((c) => c.modul === 'professorat');
  [['professorat', CAMPS_PROFESSORAT], ['alumnat', CAMPS_ALUMNAT]].forEach((x) => {
    if (!llegeix_(FULL.camps).some((c) => c.modul === x[0])) {
      const sh = ss.getSheetByName(FULL.camps);
      x[1].forEach((c, i) => sh.appendRow([x[0], c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], i + 1, 'si']));
    }
  });
  actualitzaProfessorat_();
  if (esquema < 24 && !profNou) visibilitatConsultaPAS24_();
  canviaCodisPAS25_();
  fullModul_(MODULS.professorat, campsDe_('professorat', true));
  if (String(llegeixConfig_().db_alumnat || '').trim()) {
    fullModul_(MODULS.alumnat, campsDe_('alumnat', true));
    Logger.log('ijm_alumnat_db: pestanya «alumnes» a punt.');
  } else Logger.log('Encara no hi ha config › db_alumnat: el mòdul Alumnat no funcionarà fins que hi poseu l\'URL d\'ijm_alumnat_db.');
  if (!llegeix_(FULL.eq).some((q) => q.id_equip === 'EQ-DIR')) ss.getSheetByName(FULL.eq).appendRow(['EQ-DIR', 'Equip directiu', 'gestio', 'Administració de GESTIO', 'si']);
  if (!llegeix_(FULL.perm).some((p) => p.id_equip === 'EQ-DIR' && p.id_modul === '*')) ss.getSheetByName(FULL.perm).appendRow(['EQ-DIR', '*', 'admin']);
  posaConfig_('esquema', String(ESQUEMA));
  ['Full 1', 'Full1', 'Sheet1', 'Hoja 1'].forEach((n) => { const f = ss.getSheetByName(n); if (f && f.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(f); });
  Logger.log('Fet. Pestanyes: ' + ss.getSheets().map((s) => s.getName()).join(', '));
}
function posaConfig_(clau, valor) {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.conf);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]).trim() === clau) { sh.getRange(i + 1, 2).setValues([[valor]]); return; }
  sh.appendRow([clau, valor, '']);
}

// PAS 24: «persones» → «professorat» i «id_persona» → «id_professor» (pestanya de dades i membres)
function canviaNomsPAS24_() {
  const ss = SpreadsheetApp.getActive();
  const antiga = ss.getSheetByName('persones');
  if (antiga && !ss.getSheetByName(FULL.prof)) { antiga.setName(FULL.prof); Logger.log('Pestanya «persones» → «professorat».'); }
  [FULL.prof, FULL.memb].forEach((n) => {
    const sh = ss.getSheetByName(n);
    if (!sh || sh.getLastColumn() < 1) return;
    const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    const j = cap.map(norm_).indexOf('id_persona');
    if (j >= 0) { sh.getRange(1, j + 1, 1, 1).setValues([['id_professor']]); Logger.log(n + ': id_persona → id_professor.'); }
  });
}
// PAS 25: els codis del professorat passen de PER-0001 a PRO-0001 (pestanyes professorat i membres).
// L'historial antic es deixa tal com era. Es pot repetir: si ja no hi ha cap PER-, no fa res.
function canviaCodisPAS25_() {
  const ss = SpreadsheetApp.getActive();
  let n = 0;
  [FULL.prof, FULL.memb].forEach((nom) => {
    const sh = ss.getSheetByName(nom);
    if (!sh || sh.getLastRow() < 2) return;
    const cap = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
    const j = cap.indexOf('id_professor');
    if (j < 0) return;
    const rg = sh.getRange(2, j + 1, sh.getLastRow() - 1, 1), vals = rg.getDisplayValues();
    let canvi = false;
    const nous = vals.map((r) => { const v = String(r[0]); if (/^PER-\d+$/.test(v)) { canvi = true; n++; return ['PRO-' + v.slice(4)]; } return [v]; });
    if (canvi) rg.setValues(nous);
  });
  if (n) { historial_('configura', 'actualitzacio', FULL.prof, '', 'codis PER- → PRO- (' + n + ' cel·les)'); Logger.log('Codis del professorat: PER- → PRO- (' + n + ' cel·les).'); }
}
// PAS 24: el nivell consulta del professorat només veu nom, cognoms, especialitat, correus i càrrec.
// Només s'aplica una vegada (config › esquema < 24): si després l'admin en torna a fer visible algun, es respecta.
function visibilitatConsultaPAS24_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(FULL.camps);
  const vals = sh.getDataRange().getValues(), cap = vals[0].map(norm_);
  const im = cap.indexOf('modul'), ik = cap.indexOf('clau'), iv = cap.indexOf('visible_des_de');
  const canviats = [];
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][im]) !== 'professorat') continue;
    const k = String(vals[i][ik]);
    if (PROFESSORAT_CONSULTA.indexOf(k) < 0 && norm_(vals[i][iv]) === 'consulta') { sh.getRange(i + 1, iv + 1).setValues([['edicio']]); canviats.push(k); }
  }
  if (canviats.length) { historial_('configura', 'actualitzacio', FULL.camps, 'professorat', 'visibles des d\'edició: ' + canviats.join(', ')); Logger.log('Professorat · ara només des d\'edició: ' + canviats.join(', ')); }
}

// Execució manual: importa el professorat del full indicat a config › font_professorat (una vegada).
// Les capçaleres es reconeixen pel nom (vegeu IMPORTACIO_PROFESSORAT); les altres columnes no s'importen.
// No duplica: si el correu institutjoanmiro ja hi és, la persona se salta.
// Definitiu / Comissió serveis / Provisional / Interí (una X) → camp únic «situacio». Tothom entra amb estat «actiu».
function importaProfessorat() {
  const cfg = llegeixConfig_();
  const font = String(cfg.font_professorat || '').trim();
  if (!font) throw new Error('Cal posar l\'ID o l\'URL del full a config › font_professorat.');
  const idFont = (font.match(/[-\w]{25,}/) || [font])[0];
  const origen = SpreadsheetApp.openById(idFont);
  const pest = cfg.font_professorat_pestanya ? origen.getSheetByName(cfg.font_professorat_pestanya) : origen.getSheets()[0];
  if (!pest) throw new Error('No trobo la pestanya ' + cfg.font_professorat_pestanya);
  const vals = pest.getDataRange().getDisplayValues();
  // La capçalera pot no ser a la primera fila: es busca la fila que té «Nom» i «1r Cognom»
  const fc = vals.findIndex((r) => r.map(norm_).indexOf('nom') >= 0 && r.map(norm_).indexOf('1r cognom') >= 0);
  if (fc < 0) throw new Error('No trobo la fila de capçaleres (cal «Nom» i «1r Cognom»).');
  const cap = vals[fc].map(norm_);
  const mapa = cap.map((k) => IMPORTACIO_PROFESSORAT[k] || (SITUACIONS[k] ? 'situacio:' + SITUACIONS[k] : ''));
  Logger.log('Columnes reconegudes: ' + cap.filter((k, i) => mapa[i]).join(', '));
  Logger.log('Columnes que no s\'importen: ' + cap.filter((k, i) => k && !mapa[i]).join(', '));
  const M = MODULS.professorat;
  const camps = campsDe_('professorat', true);
  const sh = fullModul_(M, camps);
  const capP = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
  const existents = llegeixFull_(sh);
  const correus = existents.map((p) => norm_(p.email));
  let seguent = 1 + existents.reduce((m, p) => Math.max(m, Number(String(p[M.id]).replace(/\D/g, '')) || 0), 0);
  const ara = ara_(), noves = [];
  let saltades = 0;
  vals.slice(fc + 1).forEach((r) => {
    if (!r.join('').trim()) return;
    const o = { estat: 'actiu' };
    mapa.forEach((k, i) => {
      if (!k) return;
      if (k.indexOf('situacio:') === 0) { if (marcat_(r[i])) o.situacio = k.slice(9); return; }
      const c = camps.filter((x) => x.clau === k)[0]; o[k] = c ? net_(r[i], c) : String(r[i]).trim();
    });
    if (!o.nom && !o.cognom1) return;
    if (o.email && correus.indexOf(norm_(o.email)) >= 0) { saltades++; return; }
    o[M.id] = codi_(M, seguent++);
    o.data = ara; o.desat_per = 'importació';
    correus.push(norm_(o.email));
    noves.push(capP.map((k) => (o[k] !== undefined ? o[k] : '')));
  });
  if (noves.length) sh.getRange(sh.getLastRow() + 1, 1, noves.length, capP.length).setValues(noves);
  historial_('importació', 'importacio', M.full, '', noves.length + ' files');
  Logger.log('Importades: ' + noves.length + ' persones. Saltades (correu repetit): ' + saltades + '.');
}

// Execució manual: importa l'alumnat dels fulls de registre de config › font_alumnat (un URL per nivell).
// - Pestanya config › font_alumnat_pestanya (per defecte «Dades»); la capçalera és la fila que té «Cognoms i nom».
// - «Cognoms i nom» («Cognom1 Cognom2, Nom») se separa amb la pestanya «Noms» del mateix full si hi és
//   (nom | 1r cognom | 2n cognom), i si no, per la coma i els espais (partícules com de, del, de la… van amb el cognom).
// - Observacions → estat; si és buit: 1r → repeteix 1r (columna Repetidor) o alumne extern;
//   2n → repeteix 2n (Repetidor), promociona (grup 25-26 de 1r) o alumne extern.
// - Al full de 1r, la columna «Optativa» és l'optativa de 1r.
// - No duplica: si ja hi ha un alumne amb el mateix nom i cognoms, se salta. Tot el que no s'entén queda al registre.
function importaAlumnat() {
  const cfg = llegeixConfig_();
  const fonts = String(cfg.font_alumnat || '').split(/[\s,;]+/).map((s) => (s.match(/[-\w]{25,}/) || [''])[0]).filter(Boolean);
  if (!fonts.length) throw new Error('Cal posar els URL dels fulls de registre a config › font_alumnat.');
  const M = MODULS.alumnat;
  const camps = campsDe_('alumnat', true);
  const perClau = {}; camps.forEach((c) => { perClau[c.clau] = c; });
  const sh = fullModul_(M, camps);
  const capA = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(norm_);
  const existents = llegeixFull_(sh);
  const clauNom = (o) => normNom_([o.cognom1, o.cognom2, o.nom].join(' '));
  const vistos = existents.map(clauNom);
  let seguent = 1 + existents.reduce((m, p) => Math.max(m, Number(String(p[M.id]).replace(/\D/g, '')) || 0), 0);
  const ara = ara_(), noves = [], avisos = [];
  let saltades = 0;
  fonts.forEach((id) => {
    const origen = SpreadsheetApp.openById(id);
    const pest = origen.getSheetByName(cfg.font_alumnat_pestanya || 'Dades') || origen.getSheets()[0];
    const vals = pest.getDataRange().getDisplayValues();
    const fc = vals.findIndex((r) => r.map(norm_).indexOf('cognoms i nom') >= 0);
    if (fc < 0) { Logger.log(origen.getName() + ': no trobo la fila «Cognoms i nom»; se salta.'); return; }
    const cap = vals[fc].map(norm_);
    // Noms separats (pestanya «Noms»: A nom, B 1r cognom, C 2n cognom, H «Cognoms, nom»)
    const noms = {};
    const pn = origen.getSheetByName('Noms');
    if (pn) pn.getDataRange().getDisplayValues().forEach((r) => {
      if (r[0] && r[1]) noms[normNom_(r[7] || (r[1] + ' ' + r[2] + ', ' + r[0]))] = { nom: String(r[0]).trim(), cognom1: String(r[1]).trim(), cognom2: String(r[2] || '').trim() };
    });
    const ci = (k) => cap.indexOf(k);
    const esPrimer = cap.indexOf('optativa 2n') < 0 && cap.indexOf('optativa 1r') < 0;
    const mapa = cap.map((k) => IMPORTACIO_ALUMNAT[k] || (k === 'optativa' && esPrimer ? 'optativa_1r' : ''));
    Logger.log(origen.getName() + ' · columnes reconegudes: ' + cap.filter((k, i) => mapa[i]).join(', ') +
      ' · no s\'importen: ' + cap.filter((k, i) => k && !mapa[i] && ['cognoms i nom', 'observacions', 'repetidor'].indexOf(k) < 0).join(', '));
    let n = 0, separats = 0;
    vals.slice(fc + 1).forEach((r) => {
      const complet = String(r[ci('cognoms i nom')] || '').trim();
      if (!complet || !/[a-zà-ÿ]/i.test(complet)) return;
      // Files de títol dins del full (p. ex. «REPETIDORS DE 1r»): sense coma i començant per una paraula en majúscules
      if (complet.indexOf(',') < 0 && /^[A-ZÀ-ÚÇ]{4,}(\s|$)/.test(complet)) { avisos.push('Fila saltada (no sembla un alumne): «' + complet + '»'); return; }
      const trobat = noms[normNom_(complet)];
      if (!trobat) separats++;
      const o = Object.assign({}, trobat || separaNom_(complet));
      mapa.forEach((k, i) => { if (k && perClau[k]) o[k] = net_(r[i], perClau[k]); });
      // Estat a partir d'Observacions (i de Repetidor si és buit)
      const obsOri = ci('observacions') >= 0 ? String(r[ci('observacions')] || '').trim() : '';
      const obs = norm_(obsOri), rep = ci('repetidor') >= 0 && marcat_(r[ci('repetidor')]);
      const niv = nivellAlumne_(o);
      let estat = ESTATS_ALUMNAT.indexOf(obs) >= 0 ? obs : (ESTAT_ALIES[obs] || '');
      if (obs && !estat) avisos.push(complet + ': observacions «' + obsOri + '» no reconegudes');
      if (!estat) estat = niv === 1 ? (rep ? 'repeteix 1r' : 'alumne extern') : rep ? 'repeteix 2n' : (/^1r/i.test(String(o.grup_2526 || '')) ? 'promociona' : 'alumne extern');
      o.estat = estat;
      if (niv === 1) { o.grup_2526 = ''; o.optativa_2n = ''; }
      // Valors que no són a les llistes: es conserven, però s'avisa
      camps.forEach((c) => { if (!o[c.clau]) return; const err = valida_([c], o); if (err) avisos.push(complet + ': ' + c.nom + ' «' + o[c.clau] + '» (' + err.error + ')'); });
      if (vistos.indexOf(clauNom(o)) >= 0) { saltades++; return; }
      vistos.push(clauNom(o));
      o[M.id] = codi_(M, seguent++); o.data = ara; o.desat_per = 'importació';
      noves.push(capA.map((k) => (o[k] !== undefined ? o[k] : '')));
      n++;
    });
    Logger.log(origen.getName() + ': ' + n + ' alumnes nous' + (separats ? ' (' + separats + ' noms separats automàticament: reviseu els cognoms compostos)' : '') + '.');
  });
  if (noves.length) sh.getRange(sh.getLastRow() + 1, 1, noves.length, capA.length).setValues(noves);
  historial_('importació', 'importacio', M.full, '', noves.length + ' files');
  Logger.log('Importats: ' + noves.length + ' alumnes. Saltats (ja hi eren): ' + saltades + '.');
  if (avisos.length) Logger.log('Cal revisar (' + avisos.length + '):\n' + avisos.slice(0, 200).join('\n'));
}
const normNom_ = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
// «Cognom1 Cognom2, Nom» → { nom, cognom1, cognom2 }. Partícules (de, del, de la, de los, van, el…) van amb el cognom següent.
function separaNom_(s) {
  const p = String(s).split(',');
  const nom = (p.slice(1).join(',') || '').trim();
  const mots = p[0].trim().split(/\s+/).filter(Boolean);
  const particules = ['de', 'del', 'la', 'las', 'los', 'el', 'van', 'von', 'da', 'di', 'dos', 'das'];
  const cognoms = [];
  let actual = [];
  mots.forEach((m) => { actual.push(m); if (particules.indexOf(m.toLowerCase()) < 0) { cognoms.push(actual.join(' ')); actual = []; } });
  if (actual.length) cognoms.push(actual.join(' '));
  return { nom: nom, cognom1: cognoms[0] || '', cognom2: cognoms.slice(1).join(' ') };
}

function normalitzaJornada_(sh, cap) {
  const j = cap.indexOf('jornada');
  if (j < 0 || sh.getLastRow() < 2) return;
  const rg = sh.getRange(2, j + 1, sh.getLastRow() - 1, 1), vals = rg.getDisplayValues();
  let canvis = 0; const estranys = {};
  const nous = vals.map((r) => { const v = String(r[0]).trim(), n = JORNADA_ALIES[v.toLowerCase()];
    if (n && n !== v) { canvis++; return [n]; }
    if (v && !n) estranys[v] = 1;
    return [v]; });
  if (canvis) { rg.setValues(nous); historial_('configura', 'actualitzacio', FULL.prof, '', 'jornada: ' + canvis + ' valors adaptats'); }
  if (Object.keys(estranys).length) Logger.log('Jornada amb valors que no són a la llista (cal revisar-los a mà): ' + Object.keys(estranys).join(', '));
}
const marcat_ = (x) => ['x', 'si', 'sí', 'true', '1', 'verdadero', 'cert'].indexOf(norm_(x)) >= 0;

// ---------------------------------------------------------------------------------------------
// PAS 22-23 · s'executa sol amb «configura» (i es pot repetir sense perill):
//  1. Camps: treu Definitiu, Comissió de serveis, Provisional i Interí i hi posa «Situació laboral» (un sol camp);
//     afegeix «Estat» (obligatori) si no hi és; treu els tres calculats de nom; Jornada passa a llista
//     (Sencera | 1/2 | ⅔), NIF a tipus nif i Correu XTEC amb el domini @xtec.cat.
//  2. professorat: omple «situacio» a partir de les quatre columnes antigues i «estat» a partir de l'antiga «actiu»
//     (no → baixa; si → actiu); després treu les columnes antigues i les dels camps calculats. Les altres es conserven.
function actualitzaProfessorat_() {
  const ss = SpreadsheetApp.getActive();
  // 1) camps
  const shC = ss.getSheetByName(FULL.camps);
  const valsC = shC.getDataRange().getValues(), capC = valsC[0].map(norm_);
  const iC = (k) => capC.indexOf(k);
  const propis = valsC.slice(1).filter((r) => String(r[iC('modul')]) === 'professorat');
  const altres = valsC.slice(1).filter((r) => String(r[iC('modul')]) !== 'professorat' && r.join('') !== '');
  const def = (clau) => { const c = CAMPS_PROFESSORAT.filter((x) => x[0] === clau)[0]; const r = capC.map(() => '');
    [['modul', 'professorat'], ['clau', c[0]], ['nom', c[1]], ['tipus', c[2]], ['valors', c[3]], ['obligatori', c[4]], ['unic', c[5]],
      ['visible_des_de', c[6]], ['origen', c[7]], ['actiu', 'si']].forEach((kv) => { if (iC(kv[0]) >= 0) r[iC(kv[0])] = kv[1]; });
    return r; };
  const clausC = propis.map((r) => String(r[iC('clau')]));
  let canviCamps = false;
  const nous = [];
  propis.sort((a, b) => (Number(a[iC('ordre')]) || 0) - (Number(b[iC('ordre')]) || 0)).forEach((r) => {
    const k = String(r[iC('clau')]);
    if (CALCULATS_RETIRATS.indexOf(k) >= 0) {
      canviCamps = true;
      if (k === 'nom_cognoms' && clausC.indexOf('estat') < 0) nous.push(def('estat'));
      return;
    }
    const posa = (col, val) => { if (iC(col) >= 0 && String(r[iC(col)]) !== val) { r[iC(col)] = val; canviCamps = true; } };
    if (k === 'jornada' && norm_(r[iC('tipus')]) === 'text') { posa('tipus', 'llista'); posa('valors', 'Sencera|1/2|⅔'); }
    if (k === 'nif' && norm_(r[iC('tipus')]) === 'text') posa('tipus', 'nif');
    if (k === 'email_xtec' && !String(r[iC('valors')]).trim()) posa('valors', '@xtec.cat');
    if (CLAUS_SITUACIO_ANTIGUES.indexOf(k) >= 0) {
      if (clausC.indexOf('situacio') < 0 && !nous.some((x) => String(x[iC('clau')]) === 'situacio')) nous.push(def('situacio'));
      canviCamps = true; return;
    }
    nous.push(r);
  });
  if (propis.length && !nous.some((x) => String(x[iC('clau')]) === 'estat')) { nous.splice(Math.min(3, nous.length), 0, def('estat')); canviCamps = true; }
  if (canviCamps) {
    nous.forEach((r, i) => { r[iC('ordre')] = i + 1; });
    const totes = altres.concat(nous);
    if (valsC.length > 1) shC.getRange(2, 1, valsC.length - 1, capC.length).clearContent();
    if (totes.length) shC.getRange(2, 1, totes.length, capC.length).setValues(totes);
  }
  // 2) professorat
  const shP = ss.getSheetByName(FULL.prof);
  if (!shP || shP.getLastColumn() < 1) return;
  const vals = shP.getDataRange().getDisplayValues(), cap = vals[0].map(norm_);
  const camps = campsDe_('professorat', true);
  const calcs = camps.filter((c) => c.tipus === 'calculat').map((c) => c.clau).concat(CALCULATS_RETIRATS);
  const treure = CLAUS_SITUACIO_ANTIGUES.concat(calcs, ['actiu']).filter((k) => cap.indexOf(k) >= 0);
  const falten = ['estat', 'situacio'].filter((k) => cap.indexOf(k) < 0 && camps.some((c) => c.clau === k));
  if (!treure.length && !falten.length) { normalitzaJornada_(shP, cap); return; }
  const desats = desats_(camps);
  const extres = cap.filter((k) => k && treure.indexOf(k) < 0 && desats.indexOf(k) < 0 && ['id_professor', 'data', 'desat_per'].indexOf(k) < 0);
  const nouCap = ['id_professor'].concat(desats, extres, ['data', 'desat_per']);
  const files = vals.slice(1).filter((r) => r.join('') !== '').map((r) => {
    const o = {}; cap.forEach((k, j) => { if (k) o[k] = r[j]; });
    if (!o.situacio) {
      const n = { definitiu: 'Definitiu', comissio_serveis: 'Comissió de serveis', provisional: 'Provisional', interi: 'Interí' };
      CLAUS_SITUACIO_ANTIGUES.forEach((k) => { if (!o.situacio && marcat_(o[k])) o.situacio = n[k]; });
    }
    if (!o.estat) o.estat = norm_(o.actiu) === 'no' ? 'baixa' : 'actiu';
    return nouCap.map((k) => (o[k] == null ? '' : o[k]));
  });
  shP.clearContents();
  shP.getRange(1, 1, shP.getMaxRows(), shP.getMaxColumns()).setNumberFormat('@');
  shP.getRange(1, 1, 1, nouCap.length).setValues([nouCap]).setFontWeight('bold');
  if (files.length) shP.getRange(2, 1, files.length, nouCap.length).setValues(files);
  if (shP.getMaxColumns() > nouCap.length) shP.deleteColumns(nouCap.length + 1, shP.getMaxColumns() - nouCap.length);
  normalitzaJornada_(shP, nouCap);
  historial_('configura', 'actualitzacio', FULL.prof, '', 'treu ' + treure.join(', ') + (falten.length ? ' · afegeix ' + falten.join(', ') : ''));
  Logger.log('professorat actualitzat: treu ' + treure.join(', ') + '; columnes: ' + nouCap.join(', '));
}
