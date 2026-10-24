/* =====================================================================
   Programació d'una matèria (ESO): model del document, vista prèvia (HTML), PDF i Excel.
   El fa servir /assets/js/programacions-materies.js (àrea privada Programacions).

   El document es construeix com una llista de blocs (titol, h1, h2, p, llista, taula) a partir de:
     ctx = { m: {materia, nivell, tipus, departament}, curs, dep (nom del departament), data,
             p: programació (apartats editables), crit: {competencies, criteris, info} (de la Gestió Criteris
             de Qualificació), cd: catàleg de competències digitals, textos: textos comuns }
   Cada bloc pot portar f = 'comu' (text comú de centre), 'crit' (ve dels criteris de qualificació) o 'falta' (dada pendent).

   ProgDoc.buida(m) · ProgDoc.normalitza(p, m) · ProgDoc.estat(ctx) · ProgDoc.blocs(ctx)
   ProgDoc.html(blocs) · ProgDoc.pdf(R, [ctx…], {portada}) (R = CriterisPdf.prepara()) · ProgDoc.xlsx([ctx…], nom, resum)
   ===================================================================== */
(function (global) {
  'use strict';

  var NOM_NIVELL = { 'ESO 1r': '1r d’ESO', 'ESO 2n': '2n d’ESO', 'ESO 3r': '3r d’ESO', 'ESO 4t': '4t d’ESO' };
  var TRIMESTRES = ['1r', '2n', '3r'];
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  // Textos comuns per defecte (la pestanya textos_comuns de programacions_db els pot substituir)
  var TEXTOS = {
    normativa: 'Decret 175/2022, de 27 de setembre, d’ordenació dels ensenyaments de l’educació bàsica, modificat pel Decret 480/2024; DOIGC Concreció i desenvolupament del currículum: ESO (curs vigent).',
    intro_competencies: 'Es recullen les competències específiques de la matèria treballades a {curs} i els criteris d’avaluació corresponents (annex 3 del Decret 175/2022).',
    transversal_cc: 'Es defineixen segons el desplegament de la competència ciutadana.',
    transversal_ce: 'Es defineixen segons el desplegament de la competència emprenedora.',
    transversal_cpsaa: 'Es defineixen segons el desplegament de la competència personal, social i d’aprendre a aprendre.',
    intro_sequencia: 'A la taula següent es mostra la distribució orientativa dels continguts per trimestres. Es poden donar canvis en la distribució al llarg del curs, en funció del calendari escolar i del ritme del grup.',
    avaluacio: 'L’avaluació és global, contínua i formativa. El referent són els criteris d’avaluació de cada competència específica (art. 24 del Decret 175/2022). Els instruments d’avaluació (qüestionaris, pràctiques individuals i grupals, exàmens, exercicis d’aula, deures, etc.) segueixen les pautes establertes a la programació de cada unitat.',
    marc_trimestres: 'Com a marc de referència, el pes dels instruments avaluatius a cada trimestre és:',
    modificacio: 'Els criteris de qualificació recullen la planificació inicial de cada matèria per al curs. Al llarg del curs es poden ajustar per raons pedagògiques, sempre amb el vistiplau del departament corresponent i, si escau, de la direcció del centre. Qualsevol canvi es comunicarà a l’alumnat i a les famílies.',
    intro_diversitat: 'Mesures universals i addicionals previstes a la matèria.',
    intensives: 'Les mesures es descriuen en el PI de l’alumne/a.',
    lectures: 'No s’escau (requisit propi de les matèries lingüístiques).',
    sortides: 'No es programa cap sortida i activitat complementària.',
    intro_revisio: 'Registre de versions i d’aprovació de la programació pel departament.'
  };
  var ASSOL = {
    text: 'Els nivells d’assoliment de l’ESO són: 1. No assoliment (NA), 2. Assoliment suficient (AS), 3. Assoliment notable (AN) i 4. Assoliment excel·lent (AE). La qualificació trimestral s’expressa amb un decimal sobre 10, arrodonit amb criteri matemàtic; al final de curs la nota global es tradueix en un dels quatre nivells:',
    head: ['Mitjana numèrica del curs', 'Qualificació competencial', 'Sigles'],
    files: [['D’1 a 4,9', 'No assoliment', 'NA'], ['De 5 a 6,9', 'Assoliment suficient', 'AS'], ['De 7 a 8,6', 'Assoliment notable', 'AN'], ['De 8,7 a 10', 'Assoliment excel·lent', 'AE']]
  };
  var TRANSVERSALS = [
    { id: 'CC', nom: 'Ciutadana (CC)', comu: 'transversal_cc' },
    { id: 'CE', nom: 'Emprenedora (CE)', comu: 'transversal_ce' },
    { id: 'CPSAA', nom: 'Personal, social i d’aprendre a aprendre (CPSAA)', comu: 'transversal_cpsaa' },
    { id: 'CD', nom: 'Digital (CD)' }
  ];
  var APARTATS = [
    ['A', 'Identificació'], ['B', 'Marc normatiu'], ['C', 'Presentació'], ['D', 'Objectius'],
    ['E', 'Competències específiques i criteris d’avaluació'], ['F', 'Seqüenciació i temporització'],
    ['G', 'Metodologia i recursos'], ['H', 'Avaluació i criteris de qualificació'], ['I', 'Atenció a la diversitat'],
    ['J', 'Elements específics'], ['K', 'Revisió i aprovació']
  ];

  // ------------------------------------------------------------------ utilitats
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function linies(v) { return txt(v).split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function paragrafs(v) { return txt(v).split(/\n\s*\n/).map(function (x) { return x.replace(/\s*\n\s*/g, ' ').trim(); }).filter(Boolean); }
  function num(v) { var s = String(v == null ? '' : v).replace('%', '').replace(',', '.').trim(); if (s === '') return null; var n = Number(s); return isFinite(n) ? n : NaN; }
  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('ca-ES'); }
  function ordenaCodis(a, b) {
    var ma = String(a).match(/^([A-Z]+)(\d+)$/), mb = String(b).match(/^([A-Z]+)(\d+)$/);
    if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
    return String(a).localeCompare(String(b), 'ca', { numeric: true });
  }
  function ordenaCriteris(a, b) { return String(a).localeCompare(String(b), 'ca', { numeric: true }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function textos(ctx) { var t = {}; Object.keys(TEXTOS).forEach(function (k) { t[k] = (ctx.textos && txt(ctx.textos[k])) || TEXTOS[k]; }); return t; }
  function falta(t) { return { text: '[Pendent: ' + t + ']', f: 'falta' }; }
  function dataCurta(d) { var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[3]) + '/' + Number(m[2]) + '/' + m[1] : ''; }
  /** Número de la CE («CE3» → «3») per numerar-ne els criteris d'avaluació */
  function numCE(codi) { var m = String(codi).match(/(\d+)\s*$/); return m ? m[1] : ''; }

  // ------------------------------------------------------------------ estructura de dades
  function buida(m) {
    return {
      identificacio: { ambit: '', tipus: (m && m.tipus) || '', hores_totals: '', hores_setmana: '', responsable: '', docents: '', aprovada: '', revisio: '' },
      presentacio: '',
      objectius: [],
      criteris_avaluacio: {},
      transversals: TRANSVERSALS.map(function (t) { return { id: t.id, descripcio: '', evidencies: '', indicadors: [] }; }),
      sequencia: TRIMESTRES.map(function (t) { return { trimestre: t, continguts: '', criteris: [], sessions: '' }; }),
      metodologia: { orientacions: '', agrupaments: '', materials: '', espais: '' },
      diversitat: { universals: '', addicionals: '' },
      especifics: { lectures: '', sortides: '' },
      revisio: [{ versio: '1.0', data: '', canvis: 'Elaboració inicial.', aprovacio: '' }]
    };
  }
  /** Completa una programació desada (o parcial) amb l'estructura buida */
  function normalitza(p, m) {
    var b = buida(m);
    p = p || {};
    var o = {};
    Object.keys(b).forEach(function (k) {
      var v = p[k];
      if (v == null) { o[k] = b[k]; return; }
      if (Array.isArray(b[k])) o[k] = Array.isArray(v) ? v : b[k];
      else if (typeof b[k] === 'object') o[k] = Object.assign({}, b[k], typeof v === 'object' ? v : {});
      else o[k] = String(v);
    });
    // Sempre les quatre competències transversals i els tres trimestres, en aquest ordre
    o.transversals = TRANSVERSALS.map(function (t) {
      var x = (o.transversals || []).filter(function (y) { return y && y.id === t.id; })[0] || {};
      return { id: t.id, descripcio: txt(x.descripcio), evidencies: txt(x.evidencies), indicadors: Array.isArray(x.indicadors) ? x.indicadors : [] };
    });
    o.sequencia = TRIMESTRES.map(function (t) {
      var x = (o.sequencia || []).filter(function (y) { return y && y.trimestre === t; })[0] || {};
      return { trimestre: t, continguts: txt(x.continguts), criteris: Array.isArray(x.criteris) ? x.criteris : [], sessions: txt(x.sessions) };
    });
    if (!o.criteris_avaluacio || typeof o.criteris_avaluacio !== 'object' || Array.isArray(o.criteris_avaluacio)) o.criteris_avaluacio = {};
    return o;
  }

  // ------------------------------------------------------------------ estat (apartats complets)
  function sumes(criteris) {
    var s = {};
    TRIMESTRES.forEach(function (t) { s[t] = { total: 0, n: 0 }; });
    (criteris || []).forEach(function (c) { var t = s[c.trimestre]; if (!t) return; t.n++; var p = num(c.percentatge); if (p !== null && !isNaN(p)) t.total += p; });
    return s;
  }
  function estat(ctx) {
    var p = ctx.p ? normalitza(ctx.p, ctx.m) : null, crit = ctx.crit || {}, info = crit.info || {};
    if (!p) return { codi: 'pendent', nom: 'Pendent', fets: 0, total: 9, apartats: {} };
    var ces = (crit.competencies || []).map(function (c) { return String(c.codi).toUpperCase(); });
    var s = sumes(crit.criteris);
    var a = {
      A: !!(txt(p.identificacio.hores_totals) && txt(p.identificacio.hores_setmana) && txt(p.identificacio.docents)),
      C: !!txt(p.presentacio),
      D: p.objectius.some(function (o) { return txt(o.titol) || txt(o.text); }),
      E: ces.length > 0 && ces.every(function (c) { return (p.criteris_avaluacio[c] || []).some(function (x) { return txt(x.text); }); }),
      F: p.sequencia.every(function (x) { return txt(x.continguts); }),
      G: !!txt(p.metodologia.orientacions),
      H: TRIMESTRES.every(function (t) { return s[t].n && Math.abs(s[t].total - 100) < 0.01; }) && !!txt(info.criteri_aprovar) && !!txt(info.recuperacio) && !!txt(info.pendents),
      I: linies(p.diversitat.universals).length > 0,
      K: p.revisio.some(function (r) { return txt(r.data); })
    };
    var fets = Object.keys(a).filter(function (k) { return a[k]; }).length;
    return { codi: fets === 9 ? 'completa' : 'curs', nom: fets === 9 ? 'Completa' : 'En curs', fets: fets, total: 9, apartats: a };
  }

  // ------------------------------------------------------------------ blocs del document
  function blocs(ctx) {
    var p = normalitza(ctx.p, ctx.m), m = ctx.m, crit = ctx.crit || {}, info = crit.info || {}, T = textos(ctx);
    var id = p.identificacio, nomNivell = NOM_NIVELL[m.nivell] || m.nivell;
    var B = [];
    var h1 = function (k) { var a = APARTATS.filter(function (x) { return x[0] === k; })[0]; B.push({ t: 'h1', lletra: k, text: k + '. ' + a[1] }); };
    var h2 = function (t) { B.push({ t: 'h2', text: t }); };
    var pq = function (t, f) { B.push({ t: 'p', text: t, f: f || '' }); };

    B.push({ t: 'titol', text: m.materia, sub: ['Programació de matèria', nomNivell, txt(id.ambit) || ctx.dep, ctx.data ? 'Actualitzat el ' + dataCurta(ctx.data) : 'Esborrany'].filter(Boolean).join(' · ') });

    // A. Identificació
    h1('A');
    var hores = txt(id.hores_totals) || txt(id.hores_setmana)
      ? [txt(id.hores_totals) ? txt(id.hores_totals) + ' h' : '', txt(id.hores_setmana) ? txt(id.hores_setmana) + ' h/setmana' : ''].filter(Boolean).join(' · ') : null;
    B.push({ t: 'taula', head: ['Camp', 'Dada'], w: [58], body: [
      ['Matèria / àmbit', m.materia + (txt(id.ambit) ? ' · ' + txt(id.ambit) : '')],
      ['Curs', nomNivell + (txt(id.tipus) ? ' (' + (/^mat/i.test(id.tipus) ? '' : 'matèria ') + txt(id.tipus) + ')' : '')],
      ['Hores totals i setmanals', hores || falta('hores')],
      ['Departament', ctx.dep + (txt(id.responsable) ? ' (responsable: ' + txt(id.responsable) + ')' : '')],
      ['Docents', txt(id.docents) || falta('docents')],
      ['Curs acadèmic', ctx.curs],
      ['Aprovada pel departament (data)', txt(id.aprovada) || falta('data d’aprovació')],
      ['Darrera revisió (data)', txt(id.revisio) || '—']
    ] });

    // B. Marc normatiu
    h1('B');
    B.push({ t: 'llista', f: 'comu', items: [{ b: 'Normativa de referència:', text: T.normativa }] });

    // C. Presentació
    h1('C');
    var ps = paragrafs(p.presentacio);
    if (ps.length) ps.forEach(function (x) { pq(x); }); else B.push({ t: 'p', text: falta('presentació de la matèria').text, f: 'falta' });

    // D. Objectius
    h1('D');
    var objs = p.objectius.filter(function (o) { return txt(o.titol) || txt(o.text); });
    if (objs.length) B.push({ t: 'llista', items: objs.map(function (o) { return { b: txt(o.titol), text: txt(o.text) }; }) });
    else pq(falta('objectius').text, 'falta');

    // E. Competències específiques i criteris d'avaluació
    h1('E');
    pq(T.intro_competencies.replace('{curs}', nomNivell), 'comu');
    var ces = (crit.competencies || []).slice().sort(function (a, b) { return ordenaCodis(a.codi, b.codi); });
    if (ces.length) {
      B.push({ t: 'taula', head: ['Codi', 'Competència específica', 'Criteris d’avaluació'], w: [16, 82], body: ces.map(function (c) {
        var cr = (p.criteris_avaluacio[String(c.codi).toUpperCase()] || []).filter(function (x) { return txt(x.text); });
        return [{ text: c.codi, b: true }, { text: c.descripcio, f: 'crit' }, cr.length ? cr.map(function (x) { return (txt(x.codi) ? txt(x.codi) + ' ' : '') + txt(x.text); }).join('\n') : falta('criteris d’avaluació')];
      }) });
    } else pq('[Pendent: competències específiques a la Gestió Criteris de Qualificació]', 'falta');
    h2('Competències transversals');
    var cdDesc = {};
    (ctx.cd || []).forEach(function (c) { cdDesc[c.codi] = c.descripcio; });
    B.push({ t: 'taula', head: ['Competència transversal', 'Descripció de l’activitat', 'Evidències'], w: [46, 0, 46], body: TRANSVERSALS.map(function (t) {
      var x = p.transversals.filter(function (y) { return y.id === t.id; })[0] || {};
      var desc = txt(x.descripcio);
      var cel;
      if (desc) cel = desc;
      else if (t.comu) cel = { text: T[t.comu], f: 'comu' };
      else cel = falta('descripció');
      if (t.id === 'CD' && (x.indicadors || []).length) {
        var ind = x.indicadors.slice().sort(ordenaCodis).map(function (v) { return v + ' ' + (cdDesc[v] || ''); }).join('\n');
        cel = { text: (typeof cel === 'string' ? cel : (cel.f === 'falta' ? 'Es treballen els indicadors:' : cel.text)) + '\n' + ind, f: typeof cel === 'string' ? '' : (cel.f === 'falta' ? '' : cel.f) };
      }
      return [t.nom, cel, txt(x.evidencies) || '—'];
    }) });

    // F. Seqüenciació i temporització
    h1('F');
    pq(T.intro_sequencia, 'comu');
    B.push({ t: 'taula', head: ['Trimestre', 'Continguts', 'CE i criteris', 'Sessions'], w: [20, 0, 42, 20], body: p.sequencia.map(function (x) {
      var cont = linies(x.continguts);
      var perCE = {};
      (x.criteris || []).forEach(function (c) { var k = String(c).split('.')[0]; (perCE[k] = perCE[k] || []).push(c); });
      var ceTxt = Object.keys(perCE).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return 'CE' + k + ': ' + perCE[k].sort(ordenaCriteris).join(', '); }).join('\n');
      return [{ text: x.trimestre, b: true }, cont.length ? cont.join('\n') : falta('continguts'), ceTxt || '—', txt(x.sessions) ? '≈ ' + txt(x.sessions) : '—'];
    }) });

    // G. Metodologia i recursos
    h1('G');
    var met = p.metodologia;
    B.push({ t: 'llista', items: [
      ['Orientacions metodològiques:', met.orientacions, true], ['Agrupaments:', met.agrupaments], ['Materials i recursos:', met.materials], ['Espais i sortides:', met.espais]
    ].filter(function (x) { return txt(x[1]) || x[2]; }).map(function (x) { return txt(x[1]) ? { b: x[0], text: txt(x[1]) } : { b: x[0], text: falta('orientacions metodològiques').text, f: 'falta' }; }) });

    // H. Avaluació i criteris de qualificació
    h1('H');
    h2('Avaluació');
    pq(T.avaluacio, 'comu');
    pq(ASSOL.text, 'comu');
    B.push({ t: 'taula', f: 'comu', head: ASSOL.head, w: [52, 0, 22], body: ASSOL.files.map(function (f) { return [f[0], f[1], { text: f[2], b: true }]; }) });
    // Tot el que segueix ve de la Gestió Criteris de Qualificació (aquí no es defineix res)
    var blocsAv = (info.blocs || []).filter(function (b) { return txt(b.bloc) || txt(b.instruments); });
    h2('Criteris de qualificació per trimestres');
    if (blocsAv.length) {
      pq(T.marc_trimestres, 'comu');
      var totB = blocsAv.reduce(function (s, b) { var n = num(b.pct); return s + (n && !isNaN(n) ? n : 0); }, 0);
      B.push({ t: 'taula', f: 'crit', head: ['Bloc', 'Instruments', '%'], w: [36, 0, 16], body: blocsAv.map(function (b) { var n = num(b.pct); return [txt(b.bloc), txt(b.instruments), n !== null && !isNaN(n) ? fmt(n) : '']; }),
        foot: ['Total', '', fmt(totB)] });
    }
    pq(T.modificacio, 'comu');
    h2('Activitats avaluatives per trimestre');
    var hiHa = false;
    TRIMESTRES.forEach(function (t) {
      var files = (crit.criteris || []).filter(function (c) { return c.trimestre === t; }).sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
      if (!files.length) return;
      hiHa = true;
      var tot = files.reduce(function (s, c) { var n = num(c.percentatge); return s + (n && !isNaN(n) ? n : 0); }, 0);
      B.push({ t: 'h3', text: t + ' trimestre' });
      B.push({ t: 'taula', f: 'crit', head: ['Activitat avaluativa', '%', 'Competència específica', 'Competència digital'], w: [0, 14, 38, 34], body: files.map(function (c) {
        var n = num(c.percentatge);
        return [c.activitat, n !== null && !isNaN(n) ? fmt(n) : '', (c.competencies || []).join(', '), (c.competencia_digital || []).join(', ')];
      }), foot: ['Total', fmt(tot), '', ''] });
    });
    if (!hiHa) pq('[Pendent: activitats avaluatives a la Gestió Criteris de Qualificació]', 'falta');
    var deCrit = function (titol, camp, pendent, opcional) {
      if (txt(info[camp])) { h2(titol); paragrafs(info[camp]).forEach(function (x) { pq(x, 'crit'); }); }
      else if (!opcional) { h2(titol); pq('[Pendent: ' + pendent + ' a la Gestió Criteris de Qualificació]', 'falta'); }
    };
    deCrit('Criteris per aprovar la matèria', 'criteri_aprovar', 'criteris per aprovar la matèria');
    deCrit('Recuperació trimestral i final', 'recuperacio', 'recuperació trimestral i final');
    deCrit('Recuperació de matèries pendents de cursos anteriors', 'pendents', 'recuperació de matèries pendents');
    deCrit('Millora de nota', 'millora', '', true);
    deCrit('Observacions', 'observacions', '', true);

    // I. Atenció a la diversitat
    h1('I');
    pq(T.intro_diversitat, 'comu');
    var uni = linies(p.diversitat.universals), add = linies(p.diversitat.addicionals);
    B.push({ t: 'taula', head: ['Nivell', 'Mesures previstes a la matèria'], w: [56], body: [
      ['Universals (personalització, DUA, avaluació formativa, acció tutorial)', uni.length ? uni.join('\n') : falta('mesures universals')],
      ['Addicionals (suport, alumnat nouvingut, PDC…)', add.length ? add.join('\n') : '—'],
      ['Intensives / PI', { text: T.intensives, f: 'comu' }]
    ] });

    // J. Elements específics
    h1('J');
    B.push({ t: 'llista', items: [
      txt(p.especifics.lectures) ? { b: 'Lectures:', text: txt(p.especifics.lectures) } : { b: 'Lectures:', text: T.lectures, f: 'comu' },
      txt(p.especifics.sortides) ? { b: 'Sortides i activitats complementàries:', text: txt(p.especifics.sortides) } : { b: 'Sortides i activitats complementàries:', text: T.sortides, f: 'comu' }
    ] });

    // K. Revisió i aprovació
    h1('K');
    pq(T.intro_revisio, 'comu');
    var rev = p.revisio.filter(function (r) { return txt(r.versio) || txt(r.data) || txt(r.canvis); });
    B.push({ t: 'taula', head: ['Versió', 'Data', 'Descripció dels canvis', 'Aprovació'], w: [16, 26, 0, 52], body: rev.length ? rev.map(function (r) {
      return [{ text: txt(r.versio), b: true }, txt(r.data) || falta('data'), txt(r.canvis), txt(r.aprovacio) || (ctx.dep + (txt(id.responsable) ? ' (responsable: ' + txt(id.responsable) + ')' : ''))];
    }) : [['1.0', falta('data'), 'Elaboració inicial.', ctx.dep]] });
    return B;
  }

  // ------------------------------------------------------------------ HTML (vista prèvia)
  var ETIQ = { comu: 'Text comú', crit: 'De Criteris de qualificació' };
  function cela(c) {
    if (c == null) return '';
    if (typeof c === 'string') return esc(c).replace(/\n/g, '<br>');
    var h = esc(c.text).replace(/\n/g, '<br>');
    if (c.b) h = '<strong>' + h + '</strong>';
    return c.f ? '<span class="pd-' + c.f + '">' + h + '</span>' : h;
  }
  function html(B) {
    return B.map(function (b) {
      var f = b.f ? ' pd-bloc--' + b.f : '';
      var tag = b.f && ETIQ[b.f] ? '<span class="pd-tag pd-tag--' + b.f + '">' + ETIQ[b.f] + '</span>' : '';
      switch (b.t) {
        case 'titol': return '<header class="pd-titol"><h2>' + esc(b.text) + '</h2><p>' + esc(b.sub) + '</p><p class="pd-llegenda"><span class="pd-falta">groc</span> = dada pendent · <span class="pd-tag pd-tag--comu">Text comú</span> = igual a totes les programacions · <span class="pd-tag pd-tag--crit">De Criteris de qualificació</span> = es modifica a la Gestió Criteris de Qualificació</p></header>';
        case 'h1': return '<h3 class="pd-h1" id="pd-' + b.lletra + '" data-lletra="' + b.lletra + '">' + esc(b.text) + '</h3>';
        case 'h2': return '<h4 class="pd-h2">' + esc(b.text) + '</h4>';
        case 'h3': return '<p class="pd-h3">' + esc(b.text) + '</p>';
        case 'p': return '<p class="pd-p' + f + '">' + (b.f === 'falta' ? '<span class="pd-falta">' + esc(b.text) + '</span>' : esc(b.text)) + tag + '</p>';
        case 'llista': return '<ul class="pd-ul' + f + '">' + b.items.map(function (i) {
          var t = i.f === 'falta' ? '<span class="pd-falta">' + esc(i.text) + '</span>' : esc(i.text).replace(/\n/g, '<br>');
          return '<li>' + (i.b ? '<strong>' + esc(i.b) + '</strong> ' : '') + t + (i.f && ETIQ[i.f] ? '<span class="pd-tag pd-tag--' + i.f + '">' + ETIQ[i.f] + '</span>' : '') + '</li>';
        }).join('') + '</ul>' + (tag && b.t === 'llista' ? '' : '');
        case 'taula': return '<div class="pd-taula' + f + '">' + tag + '<table><thead><tr>' + b.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          b.body.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + cela(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>' +
          (b.foot ? '<tfoot><tr>' + b.foot.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table></div>';
      }
      return '';
    }).join('');
  }

  // ------------------------------------------------------------------ PDF (jsPDF + autotable; tipografia i logo de CriterisPdf.prepara)
  var BLAU = [28, 12, 188], TARONJA = [232, 96, 12], GRIS = [90, 96, 112], TEXT = [30, 30, 42], VORA = [214, 218, 230], FALTA = [163, 90, 0];
  function pdf(R, ctxs, opcions) {
    opcions = opcions || {};
    var doc = new global.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    doc.addFileToVFS('Montserrat-400.ttf', R.regular); doc.addFont('Montserrat-400.ttf', 'Montserrat', 'normal');
    doc.addFileToVFS('Montserrat-600.ttf', R.negreta); doc.addFont('Montserrat-600.ttf', 'Montserrat', 'bold');
    var W = 210, H = 297, MX = 16, AMPLE = W - 2 * MX, DALT = 32, BAIX = 22;
    var y = DALT, capPagina = '', cursDoc = (ctxs[0] && ctxs[0].curs) || '';

    function capcalera() {
      doc.addImage(R.logo, 'PNG', MX, 9, 28, 28 * 432 / 1100);
      doc.setFont('Montserrat', 'bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, TARONJA);
      doc.text('PROGRAMACIONS · PROGRAMACIÓ DE MATÈRIA', W - MX, 13, { align: 'right' });
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS);
      doc.text('Institut Joan Miró · Curs ' + cursDoc + (capPagina ? ' · ' + capPagina : ''), W - MX, 17.5, { align: 'right' });
      doc.setDrawColor.apply(doc, BLAU); doc.setLineWidth(0.6); doc.line(MX, 23, W - MX, 23);
    }
    function novaPagina() { doc.addPage(); capcalera(); y = DALT; }
    function espai(h) { if (y + h > H - BAIX) novaPagina(); }
    function linia(t, mida, estil, color, x0, ample) {
      doc.setFont('Montserrat', estil || 'normal'); doc.setFontSize(mida); doc.setTextColor.apply(doc, color || TEXT);
      var alt = mida * 0.45 + 0.9;
      doc.splitTextToSize(String(t), ample || AMPLE).forEach(function (l) { espai(alt); doc.text(l, x0 || MX, y + mida * 0.35); y += alt; });
    }
    function color(f) { return f === 'falta' ? FALTA : f === 'comu' ? GRIS : TEXT; }
    function taula(b) {
      // Les taules curtes no es parteixen; de les llargues, almenys la capçalera i una fila
      espai(b.body.length <= 6 ? Math.min(90, 10 + 8 * b.body.length) : 30);
      var cs = {};
      (b.w || []).forEach(function (w, i) { if (w) cs[i] = { cellWidth: w }; });
      doc.autoTable({
        startY: y + 1, margin: { left: MX, right: MX, top: DALT, bottom: BAIX },
        head: [b.head],
        body: b.body.map(function (r) {
          return r.map(function (c) {
            if (c == null) return '';
            if (typeof c === 'string') return c;
            return { content: c.text, styles: { fontStyle: c.b ? 'bold' : 'normal', textColor: c.f === 'falta' ? FALTA : (c.b ? BLAU : TEXT) } };
          });
        }),
        foot: b.foot ? [b.foot] : undefined, showFoot: 'lastPage',
        styles: { font: 'Montserrat', fontSize: 8.3, cellPadding: 1.8, textColor: TEXT, lineColor: VORA, lineWidth: 0.2, valign: 'top', fillColor: b.f === 'comu' ? [248, 248, 252] : [255, 255, 255] },
        headStyles: { font: 'Montserrat', fontStyle: 'bold', fillColor: [238, 240, 255], textColor: BLAU, fontSize: 7.6 },
        footStyles: { font: 'Montserrat', fontStyle: 'bold', fillColor: [246, 247, 250], textColor: TEXT },
        columnStyles: cs,
        didDrawPage: function (d) { if (d.pageNumber > 1 || doc.internal.getNumberOfPages() > 1) capcalera(); }
      });
      y = doc.lastAutoTable.finalY + 5;
    }
    function dibuixa(B) {
      B.forEach(function (b) {
        switch (b.t) {
          case 'titol':
            linia(b.text, 20, 'bold', BLAU); y += 1;
            linia(b.sub, 9.5, 'normal', GRIS); y += 4; break;
          case 'h1': espai(32); y += 3; linia(b.text, 12.5, 'bold', BLAU); doc.setDrawColor.apply(doc, TARONJA); doc.setLineWidth(0.5); doc.line(MX, y, MX + 16, y); y += 3; break;
          case 'h2': espai(26); y += 1.5; linia(b.text, 10.5, 'bold', BLAU); y += 1; break;
          case 'h3': espai(22); linia(b.text, 9, 'bold', TEXT); break;
          case 'p': linia(b.text, 9, 'normal', color(b.f)); y += 2; break;
          case 'llista':
            b.items.forEach(function (i) {
              var t = (i.b ? i.b + ' ' : '') + i.text;
              doc.setFont('Montserrat', 'normal'); doc.setFontSize(9);
              var ls = doc.splitTextToSize(t, AMPLE - 5);
              ls.forEach(function (l, k) {
                espai(5);
                if (k === 0) { doc.setTextColor.apply(doc, TARONJA); doc.text('•', MX + 0.5, y + 3.2); }
                doc.setTextColor.apply(doc, color(i.f || b.f));
                // La part en negreta (inici del primer element)
                if (k === 0 && i.b && l.indexOf(i.b) === 0) {
                  doc.setFont('Montserrat', 'bold'); doc.text(i.b, MX + 5, y + 3.2);
                  var wb = doc.getTextWidth(i.b + ' ');
                  doc.setFont('Montserrat', 'normal'); doc.text(l.slice(i.b.length + 1), MX + 5 + wb, y + 3.2);
                } else { doc.setFont('Montserrat', 'normal'); doc.text(l, MX + 5, y + 3.2); }
                y += 4.5;
              });
              y += 1;
            });
            y += 1.5; break;
          case 'taula': taula(b); break;
        }
      });
    }
    if (!opcions.portada && ctxs[0]) capPagina = ctxs[0].m.nivell + ' · ' + ctxs[0].m.materia;
    capcalera();
    if (opcions.portada) {
      var P = opcions.portada;
      linia(P.titol, 22, 'normal', BLAU); y += 2;
      linia(P.subtitol, 10.5, 'normal', GRIS); y += 3;
      taula({ head: P.head, body: P.body, w: P.w });
      if (P.nota) linia(P.nota, 8.5, 'normal', GRIS);
    }
    ctxs.forEach(function (ctx, k) {
      if (opcions.portada || k > 0) { capPagina = ctx.m.nivell + ' · ' + ctx.m.materia; novaPagina(); }
      else capPagina = ctx.m.nivell + ' · ' + ctx.m.materia;
      dibuixa(blocs(ctx));
    });
    var n = doc.internal.getNumberOfPages(), avui = new Date().toLocaleDateString('ca-ES');
    for (var pg = 1; pg <= n; pg++) {
      doc.setPage(pg);
      doc.setDrawColor.apply(doc, VORA); doc.setLineWidth(0.2); doc.line(MX, H - 14, W - MX, H - 14);
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS);
      doc.text('Institut Joan Miró · Cornellà de Llobregat · Generat el ' + avui, MX, H - 9.5);
      doc.text('Pàgina ' + pg + ' de ' + n, W - MX, H - 9.5, { align: 'right' });
    }
    return doc;
  }

  // ------------------------------------------------------------------ Excel (SheetJS de cdnjs, es carrega el primer cop)
  var xlsxLib = null;
  function carregaXlsx() {
    if (global.XLSX) return Promise.resolve(global.XLSX);
    if (xlsxLib) return xlsxLib;
    xlsxLib = new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = XLSX_URL; s.onload = function () { ok(global.XLSX); }; s.onerror = function () { xlsxLib = null; ko(new Error('No s’ha pogut carregar ' + XLSX_URL)); };
      document.head.appendChild(s);
    });
    return xlsxLib;
  }
  function textCela(c) { return c == null ? '' : (typeof c === 'string' ? c : c.text); }
  /** Files d'un full a partir dels blocs: apartat a la columna A, contingut a partir de la B */
  function filesFull(B) {
    var rows = [];
    B.forEach(function (b) {
      switch (b.t) {
        case 'titol': rows.push([b.text]); rows.push([b.sub]); rows.push([]); break;
        case 'h1': rows.push([]); rows.push([b.text]); break;
        case 'h2': rows.push(['', b.text]); break;
        case 'h3': rows.push(['', b.text]); break;
        case 'p': rows.push(['', b.text + (b.f === 'comu' ? '  [text comú]' : '')]); break;
        case 'llista': b.items.forEach(function (i) { rows.push(['', (i.b ? i.b + ' ' : '') + i.text]); }); break;
        case 'taula':
          rows.push([''].concat(b.head));
          b.body.forEach(function (r) { rows.push([''].concat(r.map(textCela))); });
          if (b.foot) rows.push([''].concat(b.foot));
          break;
      }
    });
    return rows;
  }
  function nomFull(t, usats) {
    var n = String(t).replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Full';
    var base = n, k = 2;
    while (usats.indexOf(n) >= 0) { n = base.slice(0, 28) + ' ' + (k++); }
    usats.push(n);
    return n;
  }
  /** resum = { titol, head, body } (opcional, primer full) */
  function xlsx(ctxs, nom, resum) {
    return carregaXlsx().then(function (X) {
      var wb = X.utils.book_new(), usats = [];
      if (resum) {
        var ws0 = X.utils.aoa_to_sheet([[resum.titol], []].concat([resum.head], resum.body));
        ws0['!cols'] = resum.head.map(function (h, i) { return { wch: i === 1 ? 40 : 14 }; });
        X.utils.book_append_sheet(wb, ws0, nomFull('Resum', usats));
      }
      ctxs.forEach(function (ctx) {
        var ws = X.utils.aoa_to_sheet(filesFull(blocs(ctx)));
        ws['!cols'] = [{ wch: 34 }, { wch: 60 }, { wch: 48 }, { wch: 30 }, { wch: 22 }];
        X.utils.book_append_sheet(wb, ws, nomFull(ctxs.length > 1 ? ctx.m.nivell.replace('ESO ', '') + ' ' + ctx.m.materia : 'Programació', usats));
      });
      X.writeFile(wb, nom);
    });
  }

  global.ProgDoc = {
    NOM_NIVELL: NOM_NIVELL, TRIMESTRES: TRIMESTRES, TEXTOS: TEXTOS, ASSOL: ASSOL, TRANSVERSALS: TRANSVERSALS, APARTATS: APARTATS,
    buida: buida, normalitza: normalitza, estat: estat, blocs: blocs, html: html, pdf: pdf, xlsx: xlsx,
    linies: linies, numCE: numCE, ordenaCodis: ordenaCodis, ordenaCriteris: ordenaCriteris, sumes: sumes
  };
})(window);
