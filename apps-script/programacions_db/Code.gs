/**
 * Programacions · pont entre Netlify (web de l'institut) i el full de càlcul programacions_db
 *
 * On va aquest codi: al full programacions_db › Extensions › Apps Script (fitxer Code.gs).
 * Aquest fitxer és una còpia de referència: si el canvies aquí, enganxa'l també a l'editor
 * i torna a desplegar (Desplega › Gestiona els desplegaments › ✏️ › Versió nova › Desplega).
 *
 * Seguretat: només respon si la petició porta el secret correcte (propietat de l'script PROG_SECRET),
 * que coneixen només aquest script i Netlify (variable PROG_SCRIPT_SECRET).
 * Qui pot tocar cada matèria ho decideix Netlify (sessió amb Google + departaments de joanmiro_db):
 * aquest script només desa i llegeix.
 *
 * Pestanyes (es creen soles amb la funció «configura»; les columnes es llegeixen pel nom):
 *   config                : clau | valor | descripcio
 *   criteris              : curs | id_materia | departament | trimestre | ordre | activitat | percentatge |
 *                           competencies | competencia_digital | data | desat_per
 *   competencies          : curs | id_materia | departament | codi | descripcio | data | desat_per
 *   materies_info         : curs | id_materia | departament | criteri_aprovar | recuperacio | observacions | data | desat_per
 *   competencies_digitals : codi | descripcio        (catàleg comú; s'edita directament al full)
 *   historial             : data_canvi | canvi_per | accio | curs | id_materia | contingut (JSON de l'estat anterior)
 *   imp_criteris, imp_competencies, imp_info : dades del curs 2025-2026 per importar (opcional; vegeu LEGIR_PROGRAMACIONS.md)
 *
 * Accions: ping, inici, materia, desa, esborra, importacio (àrea privada) i publics (PDF públic per nivell de les pàgines d'ESO i Batxillerat).
 *
 * id_materia = «nivell - materia», el mateix identificador que la pestanya materies de joanmiro_db (p. ex. «ESO 1r - Matemàtiques»).
 * Competències i competència digital: codis separats per comes («CE1, CE3», «CD2, CD8»).
 *
 * La primera vegada: executa «configura» des de l'editor (▶ Executa) i, a Configuració del projecte ›
 * Propietats de l'script, afegeix PROG_SECRET amb un text llarg i aleatori.
 */

const FULL = { conf: 'config', crit: 'criteris', comp: 'competencies', info: 'materies_info', cd: 'competencies_digitals',
  hist: 'historial', impCrit: 'imp_criteris', impComp: 'imp_competencies', impInfo: 'imp_info' };

const CAP = {
  criteris: ['curs', 'id_materia', 'departament', 'trimestre', 'ordre', 'activitat', 'percentatge', 'competencies', 'competencia_digital', 'data', 'desat_per'],
  competencies: ['curs', 'id_materia', 'departament', 'codi', 'descripcio', 'data', 'desat_per'],
  materies_info: ['curs', 'id_materia', 'departament', 'criteri_aprovar', 'recuperacio', 'observacions', 'data', 'desat_per'],
  competencies_digitals: ['codi', 'descripcio'],
  historial: ['data_canvi', 'canvi_per', 'accio', 'curs', 'id_materia', 'contingut'],
};

const CONFIG_PER_DEFECTE = [
  ['estat', 'obert', 'obert o tancat. Si és tancat, els departaments poden consultar però no desar (els admins sí).'],
  ['missatge', '', 'Text opcional que es mostra a dalt de la Gestió de criteris (p. ex. el termini de lliurament).'],
];

const TRIMESTRES = ['1r', '2n', '3r'];
const MAX_TEXT = 5000;
const MAX_FILES = 200;

const CD_PER_DEFECTE = [
  ['CD1', 'Seleccionar, configurar i programar dispositius digitals segons les tasques a realitzar.'],
  ['CD2', 'Utilitzar les aplicacions d’edició de textos, presentacions multimèdia i tractament de dades numèriques per a la producció de documents digitals.'],
  ['CD3', 'Utilitzar les aplicacions bàsiques d’edició d’imatge fixa, so i imatge en moviment per a produccions de documents digitals.'],
  ['CD4', 'Cercar, contrastar i seleccionar informació digital adequada per al treball a realitzar, tot considerant diverses fonts i mitjans digitals.'],
  ['CD5', 'Construir nou coneixement personal mitjançant estratègies de tractament de la informació amb el suport d’aplicacions digitals.'],
  ['CD6', 'Organitzar i utilitzar un entorn personal de treball i aprenentatge amb eines digitals per desenvolupar-se en la societat del coneixement.'],
  ['CD7', 'Participar en entorns de comunicació interpersonal i publicacions virtuals per compartir informació.'],
  ['CD8', 'Realitzar activitats en grup tot utilitzant eines i entorns virtuals de treball col·laboratiu.'],
  ['CD9', 'Realitzar accions de ciutadania i de desenvolupament personal, tot utilitzant els recursos digitals propis de la societat actual.'],
  ['CD10', 'Fomentar hàbits d’ús saludable de les TIC vinculats a l’ergonomia per a la prevenció de riscos.'],
  ['CD11', 'Actuar de forma crítica i responsable en l’ús de les TIC, tot considerant aspectes ètics, legals, de seguretat, de sostenibilitat i d’identitat digital.'],
];

// ---------------------------------------------------------------------------------------------
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'peticio_invalida' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('PROG_SECRET');
  if (!secret || req.secret !== secret) return json_({ ok: false, error: 'no_autoritzat' });
  try {
    switch (req.action) {
      case 'ping':       return json_({ ok: true, missatge: 'Connexió correcta amb programacions_db' });
      case 'inici':      return json_(inici_(req.curs, req.materies));
      case 'materia':    return json_(materia_(req.curs, req.id_materia));
      case 'desa':       return json_(desa_(req));
      case 'esborra':    return json_(esborra_(req));
      case 'importacio': return json_(importacio_(req.origen));
      case 'publics':    return json_(publics_(req.curs, req.nivell));
      default:           return json_({ ok: false, error: 'accio_desconeguda' });
    }
  } catch (err) {
    return json_({ ok: false, error: 'error_script', detall: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------------------------
// Dades inicials: config, catàleg CD i les dades del curs de les matèries indicades (les permeses per a l'usuari)
function inici_(curs, materies) {
  if (!cursValid_(curs)) return { ok: false, error: 'curs_invalid' };
  const ids = (materies || []).map(String);
  const enLlista = (r) => r.curs === curs && ids.indexOf(r.id_materia) >= 0;
  const cfg = llegeixConfig_();
  return {
    ok: true,
    config: { estat: cfg.estat, missatge: cfg.missatge || '' },
    cursos: cursosAmbDades_(),
    competencies_digitals: llegeix_(FULL.cd).map((r) => ({ codi: r.codi, descripcio: r.descripcio })).filter((r) => r.codi),
    criteris: llegeix_(FULL.crit).filter(enLlista).map(netCriteri_),
    competencies: llegeix_(FULL.comp).filter(enLlista).map(netComp_),
    info: llegeix_(FULL.info).filter(enLlista).map(netInfo_),
    origens: origensImportacio_(),
  };
}

// Criteris publicats d'un nivell (pàgines ESO i Batxillerat del web, PDF per nivell).
// Sense correus de qui ha desat: només el contingut i la data.
function publics_(curs, nivell) {
  const niv = String(nivell || '').trim();
  if (!cursValid_(curs) || !/^(ESO [1-4]|BAT [12])(r|n|t)$/.test(niv)) return { ok: false, error: 'peticio_invalida' };
  const prefix = niv + ' - ';
  const f = (r) => r.curs === curs && String(r.id_materia).indexOf(prefix) === 0;
  const perId = {};
  const assegura = (id) => (perId[id] = perId[id] || { id_materia: id, materia: id.slice(prefix.length), criteris: [], competencies: [], info: null });
  llegeix_(FULL.crit).filter(f).forEach((r) => {
    const c = netCriteri_(r);
    assegura(r.id_materia).criteris.push({ trimestre: c.trimestre, ordre: c.ordre, activitat: c.activitat, percentatge: c.percentatge,
      competencies: c.competencies, competencia_digital: c.competencia_digital });
  });
  llegeix_(FULL.comp).filter(f).forEach((r) => assegura(r.id_materia).competencies.push({ codi: r.codi, descripcio: r.descripcio }));
  llegeix_(FULL.info).filter(f).forEach((r) => {
    assegura(r.id_materia).info = { criteri_aprovar: r.criteri_aprovar, recuperacio: r.recuperacio, observacions: r.observacions, data: r.data };
  });
  const materies = Object.keys(perId).map((k) => perId[k]).sort((a, b) => a.materia.localeCompare(b.materia, 'ca'));
  materies.forEach((m) => m.criteris.sort((a, b) => TRIMESTRES.indexOf(a.trimestre) - TRIMESTRES.indexOf(b.trimestre) || a.ordre - b.ordre));
  return {
    ok: true, curs: curs, nivell: niv, materies: materies,
    competencies_digitals: llegeix_(FULL.cd).map((r) => ({ codi: r.codi, descripcio: r.descripcio })).filter((r) => r.codi),
  };
}

// Dades d'una matèria d'un curs (per copiar-les d'un altre curs)
function materia_(curs, id) {
  if (!cursValid_(curs) || !id) return { ok: false, error: 'peticio_invalida' };
  const f = (r) => r.curs === curs && r.id_materia === id;
  return {
    ok: true, curs: curs, id_materia: id,
    criteris: llegeix_(FULL.crit).filter(f).map(netCriteri_),
    competencies: llegeix_(FULL.comp).filter(f).map(netComp_),
    info: llegeix_(FULL.info).filter(f).map(netInfo_)[0] || null,
  };
}

// ---------------------------------------------------------------------------------------------
// Desar una matèria: substitueix totes les seves files del curs (criteris, competències i textos).
// Control de conflictes: si algú altre ha desat després que l'usuari obrís la matèria, es retorna «conflicte».
function desa_(req) {
  const curs = String(req.curs || ''), id = String(req.id_materia || ''), dep = String(req.departament || '');
  const usuari = String(req.usuari || '');
  if (!cursValid_(curs) || !id || !usuari) return { ok: false, error: 'peticio_invalida' };
  const cfg = llegeixConfig_();
  if (String(cfg.estat).toLowerCase() !== 'obert' && !req.admin) return { ok: false, error: 'tancat' };

  const v = valida_(req);
  if (!v.ok) return v;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const abans = materia_(curs, id);
    const dataAbans = abans.info ? abans.info.data : '';
    if (!req.forca && String(req.data_anterior || '') !== String(dataAbans || '')) {
      return { ok: false, error: 'conflicte', desat_per: abans.info ? abans.info.desat_per : '', data: dataAbans };
    }
    const ara = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd HH:mm:ss');
    if (abans.criteris.length || abans.competencies.length || abans.info) registra_(usuari, 'desa', curs, id, abans);

    esborraFiles_(FULL.crit, curs, id);
    esborraFiles_(FULL.comp, curs, id);
    esborraFiles_(FULL.info, curs, id);

    afegeix_(FULL.crit, v.criteris.map((c, i) => ({
      curs: curs, id_materia: id, departament: dep, trimestre: c.trimestre, ordre: i + 1, activitat: c.activitat,
      percentatge: c.percentatge, competencies: c.competencies.join(', '), competencia_digital: c.competencia_digital.join(', '),
      data: ara, desat_per: usuari,
    })));
    afegeix_(FULL.comp, v.competencies.map((c) => ({
      curs: curs, id_materia: id, departament: dep, codi: c.codi, descripcio: c.descripcio, data: ara, desat_per: usuari,
    })));
    afegeix_(FULL.info, [{
      curs: curs, id_materia: id, departament: dep, criteri_aprovar: v.info.criteri_aprovar, recuperacio: v.info.recuperacio,
      observacions: v.info.observacions, data: ara, desat_per: usuari,
    }]);
    return { ok: true, data: ara, desat_per: usuari };
  } finally {
    lock.releaseLock();
  }
}

// Baixa de tots els criteris d'una matèria (queden a historial)
function esborra_(req) {
  const curs = String(req.curs || ''), id = String(req.id_materia || ''), usuari = String(req.usuari || '');
  if (!cursValid_(curs) || !id || !usuari) return { ok: false, error: 'peticio_invalida' };
  const cfg = llegeixConfig_();
  if (String(cfg.estat).toLowerCase() !== 'obert' && !req.admin) return { ok: false, error: 'tancat' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const abans = materia_(curs, id);
    if (!abans.criteris.length && !abans.competencies.length && !abans.info) return { ok: true };
    registra_(usuari, 'esborra', curs, id, abans);
    esborraFiles_(FULL.crit, curs, id);
    esborraFiles_(FULL.comp, curs, id);
    esborraFiles_(FULL.info, curs, id);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function valida_(req) {
  const text = (s, max) => String(s == null ? '' : s).trim().slice(0, max || MAX_TEXT);
  const codis = (v) => (Array.isArray(v) ? v : String(v || '').split(','))
    .map((x) => String(x).trim().toUpperCase()).filter((x, i, ll) => x && x.length <= 20 && ll.indexOf(x) === i);
  const criteris = (req.criteris || []).slice(0, MAX_FILES).map((c) => {
    const p = String(c.percentatge == null ? '' : c.percentatge).replace(',', '.').trim();
    return {
      trimestre: String(c.trimestre || ''), activitat: text(c.activitat, 500),
      percentatge: p === '' ? '' : Number(p),
      competencies: codis(c.competencies), competencia_digital: codis(c.competencia_digital),
    };
  }).filter((c) => c.activitat);
  for (const c of criteris) {
    if (TRIMESTRES.indexOf(c.trimestre) < 0) return { ok: false, error: 'trimestre_invalid' };
    if (c.percentatge !== '' && (!isFinite(c.percentatge) || c.percentatge < 0 || c.percentatge > 100)) {
      return { ok: false, error: 'percentatge_invalid', activitat: c.activitat };
    }
  }
  const competencies = (req.competencies || []).slice(0, 60).map((c) => ({
    codi: text(c.codi, 20).toUpperCase(), descripcio: text(c.descripcio, 1500),
  })).filter((c) => c.codi);
  const vistos = {};
  for (const c of competencies) {
    if (vistos[c.codi]) return { ok: false, error: 'codi_repetit', codi: c.codi };
    vistos[c.codi] = true;
  }
  const i = req.info || {};
  return {
    ok: true, criteris: criteris, competencies: competencies,
    info: { criteri_aprovar: text(i.criteri_aprovar), recuperacio: text(i.recuperacio), observacions: text(i.observacions) },
  };
}

// ---------------------------------------------------------------------------------------------
// Importació (dades 2025-2026 convertides amb lib/programacions/importa_criteris.py)
function origensImportacio_() {
  const ss = SpreadsheetApp.getActive();
  const full = ss.getSheetByName(FULL.impInfo);
  if (!full || full.getLastRow() < 2) return [];
  const crit = llegeix_(FULL.impCrit);
  const n = {};
  crit.forEach((r) => { n[r.origen] = (n[r.origen] || 0) + 1; });
  return llegeix_(FULL.impInfo).map((r) => ({ origen: r.origen, nivell: r.nivell, full: r.full, criteris: n[r.origen] || 0 }))
    .filter((r) => r.origen);
}

function importacio_(origen) {
  const o = String(origen || '');
  if (!o) return { ok: false, error: 'peticio_invalida' };
  const f = (r) => r.origen === o;
  const info = llegeix_(FULL.impInfo).filter(f)[0] || {};
  return {
    ok: true, origen: o,
    criteris: llegeix_(FULL.impCrit).filter(f).map((r) => ({
      trimestre: r.trimestre, ordre: Number(r.ordre) || 0, activitat: r.activitat, percentatge: pct_(r.percentatge),
      competencies: llistaCodis_(r.competencies), competencia_digital: llistaCodis_(r.competencia_digital),
    })).sort((a, b) => a.ordre - b.ordre),
    competencies: llegeix_(FULL.impComp).filter(f).map((r) => ({ codi: r.codi, descripcio: r.descripcio })),
    info: { criteri_aprovar: info.criteri_aprovar || '', recuperacio: info.recuperacio || '', observacions: info.observacions || '', avisos: info.avisos || '' },
  };
}

// ---------------------------------------------------------------------------------------------
// Lectura i escriptura de pestanyes (per nom de columna)
function llegeix_(nom) {
  const full = SpreadsheetApp.getActive().getSheetByName(nom);
  if (!full || full.getLastRow() < 2) return [];
  const vals = full.getDataRange().getDisplayValues();
  const cap = vals[0].map(normalitza_);
  return vals.slice(1).filter((r) => r.join('') !== '').map((r) => {
    const o = {};
    cap.forEach((k, i) => { if (k) o[k] = String(r[i] == null ? '' : r[i]).trim(); });
    return o;
  });
}

function afegeix_(nom, files) {
  if (!files.length) return;
  const full = assegura_(nom);
  const cap = full.getRange(1, 1, 1, full.getLastColumn()).getDisplayValues()[0].map(normalitza_);
  const vals = files.map((f) => cap.map((k) => (f[k] == null ? '' : f[k])));
  const r = full.getLastRow() + 1;
  const rang = full.getRange(r, 1, vals.length, cap.length);
  rang.setNumberFormat('@');                       // tot com a text (el percentatge es desa amb punt decimal: «12.5»)
  rang.setValues(vals.map((f) => f.map((x) => String(x))));
}

function esborraFiles_(nom, curs, id) {
  const full = SpreadsheetApp.getActive().getSheetByName(nom);
  if (!full || full.getLastRow() < 2) return;
  const rang = full.getRange(2, 1, full.getLastRow() - 1, full.getLastColumn());
  const vals = rang.getDisplayValues();
  const cap = full.getRange(1, 1, 1, full.getLastColumn()).getDisplayValues()[0].map(normalitza_);
  const ic = cap.indexOf('curs'), im = cap.indexOf('id_materia');
  const queden = vals.filter((r) => !(String(r[ic]).trim() === curs && String(r[im]).trim() === id));
  if (queden.length === vals.length) return;
  // Es reescriu el bloc sencer (molt més ràpid que esborrar files una a una)
  rang.clearContent();
  if (queden.length) full.getRange(2, 1, queden.length, cap.length).setNumberFormat('@').setValues(queden);
}

function registra_(usuari, accio, curs, id, abans) {
  const ara = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd HH:mm:ss');
  afegeix_(FULL.hist, [{ data_canvi: ara, canvi_per: usuari, accio: accio, curs: curs, id_materia: id,
    contingut: JSON.stringify({ criteris: abans.criteris, competencies: abans.competencies, info: abans.info }).slice(0, 49000) }]);
}

function assegura_(nom) {
  const ss = SpreadsheetApp.getActive();
  let full = ss.getSheetByName(nom);
  if (!full) {
    full = ss.insertSheet(nom);
    if (CAP[nom]) {
      full.getRange(1, 1, 1, CAP[nom].length).setValues([CAP[nom]]).setFontWeight('bold');
      full.setFrozenRows(1);
    }
  }
  return full;
}

function netCriteri_(r) {
  return { trimestre: r.trimestre, ordre: Number(r.ordre) || 0, activitat: r.activitat, percentatge: pct_(r.percentatge),
    competencies: llistaCodis_(r.competencies), competencia_digital: llistaCodis_(r.competencia_digital),
    id_materia: r.id_materia, data: r.data, desat_per: r.desat_per };
}
function netComp_(r) { return { id_materia: r.id_materia, codi: r.codi, descripcio: r.descripcio }; }
function netInfo_(r) {
  return { id_materia: r.id_materia, criteri_aprovar: r.criteri_aprovar, recuperacio: r.recuperacio,
    observacions: r.observacions, data: r.data, desat_per: r.desat_per };
}

function pct_(s) { return String(s || '').replace('%', '').replace(',', '.').trim(); }
function llistaCodis_(s) { return String(s || '').split(',').map((x) => x.trim()).filter(Boolean); }

function cursosAmbDades_() {
  const set = {};
  llegeix_(FULL.info).forEach((r) => { if (cursValid_(r.curs)) set[r.curs] = true; });
  return Object.keys(set).sort().reverse();
}

function cursValid_(c) { return /^\d{4}-\d{4}$/.test(String(c || '').trim()); }

/** «Competència digital» → «competencia digital»; «id_materia» es manté */
function normalitza_(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').trim();
}

function llegeixConfig_() {
  const cfg = {};
  CONFIG_PER_DEFECTE.forEach((c) => { cfg[c[0]] = c[1]; });
  const full = SpreadsheetApp.getActive().getSheetByName(FULL.conf);
  if (!full) return cfg;
  full.getDataRange().getValues().slice(1).forEach((r) => {
    const k = String(r[0] || '').trim();
    if (k) cfg[k] = String(r[1]).trim();
  });
  return cfg;
}

// ---------------------------------------------------------------------------------------------
// Execució manual des de l'editor: crea les pestanyes i les capçaleres que falten, sense esborrar res.
function configura() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(CAP).forEach((nom) => assegura_(nom));
  const conf = ss.getSheetByName(FULL.conf) || ss.insertSheet(FULL.conf);
  if (conf.getLastRow() < 1) conf.getRange(1, 1, 1, 3).setValues([['clau', 'valor', 'descripcio']]).setFontWeight('bold');
  const claus = conf.getLastRow() > 1 ? conf.getRange(2, 1, conf.getLastRow() - 1, 1).getValues().map((r) => String(r[0]).trim()) : [];
  CONFIG_PER_DEFECTE.forEach((c) => { if (claus.indexOf(c[0]) < 0) conf.appendRow(c); });
  const cd = ss.getSheetByName(FULL.cd);
  if (cd.getLastRow() < 2) cd.getRange(2, 1, CD_PER_DEFECTE.length, 2).setValues(CD_PER_DEFECTE);
  // La pestanya buida per defecte («Full 1» / «Sheet1») sobra si no té res
  ['Full 1', 'Full1', 'Sheet1', 'Hoja 1'].forEach((n) => {
    const f = ss.getSheetByName(n);
    if (f && f.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(f);
  });
  Logger.log('Fet. Pestanyes: ' + ss.getSheets().map((s) => s.getName()).join(', '));
}
