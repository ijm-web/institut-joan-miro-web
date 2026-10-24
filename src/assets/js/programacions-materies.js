/* =====================================================================
   PROGRAMACIONS › Programacions de matèries (de moment, ESO)
   Rutes: #materies (llista)  ·  #materies/<id_materia> (editor amb vista prèvia)
   Dades: /api/programacions/materies (programacions_db › programacions i textos_comuns).
   Les competències específiques, les activitats avaluatives, el criteri per aprovar i la recuperació
   surten de la Gestió Criteris de Qualificació (no es dupliquen).
   Document, PDF i Excel: /assets/js/programacio-doc.js · Utilitats comunes: window.Prog (programacions.js)
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var D = window.ProgDoc;
  var M = { dades: null, curs: '', idx: {}, ed: null, dep: '', previ: null };
  var P = function () { return window.Prog; };
  var esc = function (s) { return P().esc(s); };
  var TIPUS = ['comuna', 'optativa', 'matèria d’opció', 'projecte'];

  // ------------------------------------------------------------------ entrada des del router
  function mostra(h) {
    var id = h.indexOf('materies/') === 0 ? h.slice('materies/'.length) : '';
    var fes = function () { if (id) obreEditor(id); else mostraLlista(); };
    if (!M.dades || (M.curs && M.dades.curs !== M.curs)) carrega().then(fes); else fes();
  }

  function carrega() {
    $('matLlista').innerHTML = '';
    var S = P().S;
    return P().api('materies' + (M.curs ? '?curs=' + encodeURIComponent(M.curs) : ''), { progres: 'Carregant les programacions…' }).then(function (d) {
      if (!d.ok) { $('matLlista').innerHTML = '<p class="prog-avis prog-avis--error">' + P().textError(d) + '</p>'; return; }
      M.dades = d; M.curs = d.curs;
      if (!M.dep && S.dep) M.dep = S.dep;
      indexa(); pintaFiltres();
    }).catch(function (err) {
      $('matLlista').innerHTML = '<p class="prog-avis prog-avis--error">' + P().textError({ error: 'error_servidor', detall: err && err.message }) + '</p>';
    });
  }

  function indexa() {
    var d = M.dades, idx = {};
    d.materies.forEach(function (m) { idx[m.id_materia] = { m: m, prog: null, crit: { criteris: [], competencies: [], info: null } }; });
    (d.programacions || []).forEach(function (p) { if (idx[p.id_materia]) idx[p.id_materia].prog = p; });
    d.criteris.forEach(function (c) { if (idx[c.id_materia]) idx[c.id_materia].crit.criteris.push(c); });
    d.competencies.forEach(function (c) { if (idx[c.id_materia]) idx[c.id_materia].crit.competencies.push(c); });
    d.info.forEach(function (i) { if (idx[i.id_materia]) idx[i.id_materia].crit.info = i; });
    Object.keys(idx).forEach(function (k) {
      idx[k].crit.criteris.sort(function (a, b) { return D.TRIMESTRES.indexOf(a.trimestre) - D.TRIMESTRES.indexOf(b.trimestre) || a.ordre - b.ordre; });
      idx[k].crit.competencies.sort(function (a, b) { return D.ordenaCodis(a.codi, b.codi); });
    });
    M.idx = idx;
  }

  function nomDep(id) { var x = (M.dades.departaments || []).filter(function (d) { return d.id === id; })[0]; return x ? x.nom : id; }

  function pintaFiltres() {
    var d = M.dades;
    $('selCursM').innerHTML = d.cursos.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === d.curs ? ' selected' : '') + '>' + esc(c) + (c === d.curs_gestio ? ' (en gestió)' : '') + '</option>';
    }).join('');
    var deps = d.departaments.filter(function (x) { return d.materies.some(function (m) { return m.departament === x.id; }); });
    if (M.dep && !deps.some(function (x) { return x.id === M.dep; })) M.dep = '';
    if (!M.dep && deps.length === 1) M.dep = deps[0].id;
    $('selDepM').innerHTML = (deps.length > 1 ? '<option value="">Tots els departaments</option>' : '') + deps.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === M.dep ? ' selected' : '') + '>' + esc(x.nom) + '</option>';
    }).join('');
    $('lblDepM').hidden = deps.length < 1;
    $('matMissatge').hidden = !d.missatge; $('matMissatge').textContent = d.missatge || '';
    var lec = $('matLectura');
    lec.hidden = !!d.editable;
    if (!d.editable) lec.textContent = String(d.estat).toLowerCase() !== 'obert' ? P().text('tancat') : 'El curs ' + d.curs + ' és només de consulta. Ara es gestiona el curs ' + d.curs_gestio + '.';
  }

  $('selCursM').addEventListener('change', function () {
    var nou = this.value, sel = this, S = P().S;
    var fes = function () { M.curs = nou; S.brut = false; M.dades = null; location.hash = '#materies'; if (location.hash === '#materies') P().encamina(); };
    if (!S.brut) return fes();
    P().pregunta('Hi ha canvis sense desar', '<p>Si canvieu de curs, es perdran.</p>', [
      { t: 'Continua editant', valor: 0, tipus: 'ghost' }, { t: 'Canvia de curs', valor: 1, tipus: 'danger' }
    ]).then(function (v) { if (v) fes(); else sel.value = M.curs; });
  });
  $('selDepM').addEventListener('change', function () { M.dep = this.value; if (!M.ed) mostraLlista(); });

  function visibles() {
    var NIV = P().NIVELLS, OT = P().ORDRE_TIPUS;
    return M.dades.materies.filter(function (m) { return !M.dep || m.departament === M.dep; }).sort(function (a, b) {
      var ta = OT.indexOf(String(a.tipus).toLowerCase()), tb = OT.indexOf(String(b.tipus).toLowerCase());
      return NIV.indexOf(a.nivell) - NIV.indexOf(b.nivell) || (ta < 0 ? 9 : ta) - (tb < 0 ? 9 : tb) || a.materia.localeCompare(b.materia, 'ca');
    });
  }

  function ctxDe(id, actual) {
    var e = M.idx[id];
    var p = actual && M.ed && M.ed.id === id ? M.ed.p : (e.prog ? e.prog : null);
    return { m: e.m, curs: M.dades.curs, dep: nomDep(e.m.departament), data: e.prog ? e.prog.data : '', p: p,
      crit: e.crit, cd: M.dades.competencies_digitals || [], textos: M.dades.textos || {} };
  }

  // ------------------------------------------------------------------ llista
  function mostraLlista() {
    M.ed = null;
    P().S.hashEditor = '';
    $('matEditor').hidden = true; $('matLlista').hidden = false;
    $('progCrumbMat').hidden = true;
    if (!M.dades) return;
    var mats = visibles();
    if (!mats.length) { $('matLlista').innerHTML = '<p class="prog-avis">No hi ha matèries d’ESO del vostre departament per al curs ' + esc(M.dades.curs) + '.</p>'; return; }
    var compta = { completa: 0, curs: 0, pendent: 0 };
    mats.forEach(function (m) { compta[D.estat(ctxDe(m.id_materia)).codi]++; });
    var h = '<div class="prog-resum"><div class="prog-resum__xifres"><span><strong>' + mats.length + '</strong> matèries</span>' +
      '<span class="est est--completa"><strong>' + compta.completa + '</strong> completes</span>' +
      '<span class="est est--curs"><strong>' + compta.curs + '</strong> en curs</span>' +
      '<span class="est est--pendent"><strong>' + compta.pendent + '</strong> pendents</span></div>' +
      '<div class="prog-resum__accions"><button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">Informe en PDF</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Descarrega Excel</button></div></div>' +
      '<p class="prog-ajuda">Una programació és <strong>completa</strong> quan té els nou apartats bàsics: identificació, presentació, objectius, criteris d’avaluació de cada competència, seqüenciació dels tres trimestres, metodologia, criteris de qualificació complets, mesures universals d’atenció a la diversitat i data d’aprovació. De moment, només ESO.</p>';
    P().NIVELLS.filter(function (n) { return /^ESO/.test(n); }).forEach(function (niv) {
      var grup = mats.filter(function (m) { return m.nivell === niv; });
      if (!grup.length) return;
      h += '<section class="prog-nivell"><h3>' + esc(P().NOM_NIVELL[niv]) + '</h3><div class="prog-taula pm-taula" role="table">' +
        '<div class="prog-fila pm-fila prog-fila--cap" role="row"><span role="columnheader">Matèria</span><span role="columnheader">Apartats</span><span role="columnheader">Criteris de qualificació</span><span role="columnheader">Estat</span></div>';
      grup.forEach(function (m) {
        var ctx = ctxDe(m.id_materia), st = D.estat(ctx), e = M.idx[m.id_materia];
        var pct = Math.round(100 * st.fets / st.total);
        h += '<a class="prog-fila pm-fila" role="row" href="#materies/' + encodeURIComponent(m.id_materia) + '">' +
          '<span class="prog-fila__mat" role="cell"><strong>' + esc(m.materia) + '</strong><small>' + esc([m.tipus, M.dep ? '' : nomDep(m.departament)].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="pm-apartats" role="cell">' + 'ACDEFGHIK'.split('').map(function (k) {
            return '<span class="pm-ap' + (st.apartats[k] ? ' is-ok' : '') + '" title="' + esc(k + '. ' + D.APARTATS.filter(function (a) { return a[0] === k; })[0][1]) + (st.apartats[k] ? ': fet' : ': pendent') + '">' + k + '</span>';
          }).join('') + '<span class="pm-pct">' + (e.prog ? pct + ' %' : '—') + '</span></span>' +
          '<span role="cell">' + (st.apartats.H ? '<span class="trim trim--ok">Complets</span>' : (e.crit.criteris.length ? '<span class="trim trim--ko">Incomplets</span>' : '<span class="trim">Sense dades</span>')) + '</span>' +
          '<span role="cell"><span class="est est--' + st.codi + '">' + st.nom + '</span>' + (e.prog && e.prog.data ? '<small class="prog-fila__data">' + esc(P().dataCurta(e.prog.data)) + '</small>' : '') + '</span></a>';
      });
      h += '</div></section>';
    });
    $('matLlista').innerHTML = h;
  }

  $('matLlista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accio]');
    if (!b) return;
    var ids = visibles().map(function (m) { return m.id_materia; });
    var titol = M.dep ? nomDep(M.dep) : 'Tots els departaments';
    if (b.dataset.accio === 'pdf') informePdf(ids, titol);
    if (b.dataset.accio === 'xlsx') informeXlsx(ids, titol);
  });

  // ------------------------------------------------------------------ editor
  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  function obreEditor(id) {
    var e = M.idx[id];
    if (!e) { P().toast('Aquesta matèria no és a la llista del curs ' + M.dades.curs + '.', true); location.hash = '#materies'; return; }
    var p = D.normalitza(e.prog ? copia(e.prog) : null, e.m);
    M.ed = { id: id, m: e.m, p: p, data_anterior: e.prog ? e.prog.data : '', avisos: '', vista: M.ed && M.ed.id === id ? M.ed.vista : 'form' };
    P().S.brut = false;
    P().S.hashEditor = '#materies/' + encodeURIComponent(id);
    $('matLlista').hidden = true; $('matEditor').hidden = false;
    $('progCrumbMat').hidden = false;
    $('progCrumbMatNom').textContent = e.m.nivell + ' · ' + e.m.materia;
    pintaEditor();
  }

  function pot() { return !!(M.dades && M.dades.editable); }

  // Petits constructors de camps
  function camp(cami, etiqueta, valor, opcions) {
    opcions = opcions || {};
    var ro = pot() ? '' : ' disabled';
    var ctl = opcions.area
      ? '<textarea class="prog-in" data-cami="' + cami + '" rows="' + (opcions.files || 3) + '" placeholder="' + esc(opcions.ph || '') + '"' + ro + '>' + esc(valor) + '</textarea>'
      : opcions.select
        ? '<select class="prog-in" data-cami="' + cami + '"' + ro + '>' + opcions.select.map(function (o) { return '<option' + (o === valor ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + (opcions.select.indexOf(valor) < 0 && valor ? '<option selected>' + esc(valor) + '</option>' : '') + '</select>'
        : '<input class="prog-in" data-cami="' + cami + '" value="' + esc(valor) + '" placeholder="' + esc(opcions.ph || '') + '"' + (opcions.mode ? ' inputmode="' + opcions.mode + '"' : '') + ro + '>';
    return '<label class="pm-camp' + (opcions.ample ? ' pm-camp--ample' : '') + '"><span class="pm-camp__lbl">' + esc(etiqueta) + '</span>' + (opcions.ajuda ? '<span class="pm-camp__ajuda">' + esc(opcions.ajuda) + '</span>' : '') + ctl + '</label>';
  }
  function seccio(k, cos, nota) {
    var a = D.APARTATS.filter(function (x) { return x[0] === k; })[0];
    var st = M.estat && M.estat.apartats[k];
    var marca = 'ACDEFGHIK'.indexOf(k) >= 0 ? '<span class="pm-sec__estat' + (st ? ' is-ok' : '') + '">' + (st ? 'Fet' : 'Pendent') + '</span>' : '<span class="pm-sec__estat pm-sec__estat--comu">Text comú</span>';
    return '<details class="pm-sec" id="pm-sec-' + k + '" data-lletra="' + k + '" open><summary><span class="pm-sec__lletra">' + k + '</span><span class="pm-sec__nom">' + esc(a[1]) + '</span>' + marca + '</summary>' +
      (nota ? '<p class="pm-sec__nota">' + nota + '</p>' : '') + '<div class="pm-sec__cos">' + cos + '</div></details>';
  }
  function boto(accio, text, extra) { return pot() ? '<button type="button" class="prog-btn prog-btn--ghost prog-btn--sm" data-accio="' + accio + '"' + (extra || '') + '>' + text + '</button>' : ''; }
  function ico(accio, titol, simbol, extra) { return pot() ? '<button type="button" class="prog-ico" data-accio="' + accio + '" title="' + titol + '" aria-label="' + titol + '"' + (extra || '') + '>' + simbol + '</button>' : ''; }

  function pintaEditor() {
    var ed = M.ed, m = ed.m, e = M.idx[ed.id], p = ed.p, crit = e.crit, info = crit.info || {};
    var T = Object.assign({}, D.TEXTOS, M.dades.textos || {});
    M.estat = D.estat(ctxDe(ed.id, true));
    var ro = pot() ? '' : ' disabled';
    var h = '<a class="prog-tornar" href="#materies">← Totes les matèries</a>' +
      '<header class="prog-ed__cap"><div><p class="prog-kicker">' + esc(P().NOM_NIVELL[m.nivell] || m.nivell) + ' · ' + esc(M.dades.curs) + ' · Programació de matèria</p>' +
      '<h3 class="prog-ed__titol">' + esc(m.materia) + '</h3>' +
      '<p class="prog-ed__meta">' + esc([m.tipus, nomDep(m.departament)].filter(Boolean).join(' · ')) +
      (e.prog ? ' · Desada el ' + esc(P().dataCurta(e.prog.data)) + ' per ' + esc(e.prog.desat_per) : ' · Encara no s’ha desat') + '</p></div>' +
      '<div class="prog-ed__eines">' +
      (pot() ? '<button type="button" class="prog-btn prog-btn--ghost" data-accio="carrega">Carrega dades…</button>' : '') +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="pdf">PDF</button>' +
      '<button type="button" class="prog-btn prog-btn--ghost" data-accio="xlsx">Excel</button>' +
      (pot() && e.prog ? '<button type="button" class="prog-btn prog-btn--ghost prog-btn--perill" data-accio="esborra">Dona de baixa</button>' : '') +
      '</div></header>';
    if (ed.avisos) h += '<div class="prog-avis prog-avis--info"><strong>Dades carregades. Reviseu-les abans de desar:</strong><br>' + esc(ed.avisos) + '</div>';
    h += '<div class="pm-progres"><span class="pm-progres__barra"><span style="width:' + Math.round(100 * M.estat.fets / M.estat.total) + '%"></span></span>' +
      '<span class="pm-progres__txt">' + M.estat.fets + ' de ' + M.estat.total + ' apartats bàsics fets</span>' +
      '<nav class="pm-nav" aria-label="Apartats">' + D.APARTATS.map(function (a) { return '<a href="#pm-sec-' + a[0] + '" data-salta="' + a[0] + '" class="' + (M.estat.apartats[a[0]] ? 'is-ok' : ('ACDEFGHIK'.indexOf(a[0]) < 0 ? 'is-comu' : '')) + '" title="' + esc(a[1]) + '">' + a[0] + '</a>'; }).join('') + '</nav>' +
      '<div class="pm-vistes" role="tablist"><button type="button" role="tab" data-vista="form" aria-selected="' + (ed.vista !== 'previ') + '">Formulari</button><button type="button" role="tab" data-vista="previ" aria-selected="' + (ed.vista === 'previ') + '">Vista prèvia</button></div></div>';

    h += '<div class="pm-ed pm-ed--' + (ed.vista === 'previ' ? 'previ' : 'form') + '"><div class="pm-form" id="pmForm">';
    var id = p.identificacio;
    // A
    h += seccio('A',
      '<div class="pm-graella">' +
      '<div class="pm-fix"><span>Matèria</span><b>' + esc(m.materia) + '</b></div><div class="pm-fix"><span>Curs</span><b>' + esc(P().NOM_NIVELL[m.nivell] || m.nivell) + '</b></div>' +
      '<div class="pm-fix"><span>Departament</span><b>' + esc(nomDep(m.departament)) + '</b></div><div class="pm-fix"><span>Curs acadèmic</span><b>' + esc(M.dades.curs) + '</b></div>' +
      camp('identificacio.ambit', 'Àmbit', id.ambit, { ph: 'p. ex. Àmbit cientificotecnològic' }) +
      camp('identificacio.tipus', 'Tipus de matèria', id.tipus, { select: TIPUS }) +
      camp('identificacio.hores_totals', 'Hores totals', id.hores_totals, { ph: '105', mode: 'numeric' }) +
      camp('identificacio.hores_setmana', 'Hores setmanals', id.hores_setmana, { ph: '3', mode: 'decimal' }) +
      camp('identificacio.responsable', 'Responsable de departament/àmbit', id.responsable) +
      camp('identificacio.docents', 'Docents', id.docents, { ph: 'Noms separats per « · »' }) +
      camp('identificacio.aprovada', 'Aprovada pel departament (data)', id.aprovada, { ph: 'p. ex. Juliol 2026' }) +
      camp('identificacio.revisio', 'Darrera revisió (data)', id.revisio) + '</div>',
      'La matèria, el curs i el departament surten de joanmiro_db.');
    // B
    h += seccio('B', '<div class="pm-comu">' + esc(T.normativa) + '</div>', 'Text comú per a totes les programacions (pestanya «textos_comuns» de programacions_db).');
    // C
    h += seccio('C', camp('presentacio', 'Presentació de la matèria', p.presentacio, { area: true, files: 8, ample: true,
      ajuda: 'Finalitat de la matèria, enfocament, contribució al perfil de sortida i organització (sessions, desdoblaments…). Separeu els paràgrafs amb una línia en blanc.' }));
    // D
    var dh = '<div class="pm-files" data-llista="objectius">';
    p.objectius.forEach(function (o, i) {
      dh += '<div class="pm-fila2" data-i="' + i + '"><input class="prog-in pm-fila2__t" data-cami="objectius.' + i + '.titol" value="' + esc(o.titol) + '" placeholder="Idea clau (en negreta)"' + ro + '>' +
        '<textarea class="prog-in" data-cami="objectius.' + i + '.text" rows="2" placeholder="Desenvolupament de l’objectiu"' + ro + '>' + esc(o.text) + '</textarea>' +
        '<span class="pm-mou">' + ico('puja', 'Puja', '↑', ' data-llista="objectius"') + ico('baixa', 'Baixa', '↓', ' data-llista="objectius"') + ico('treu', 'Elimina', '✕', ' data-llista="objectius"') + '</span></div>';
    });
    if (!p.objectius.length) dh += '<p class="prog-buit">Encara no hi ha cap objectiu.</p>';
    h += seccio('D', dh + '</div>' + boto('afegeix', '+ Afegeix objectiu', ' data-llista="objectius"'));
    // E
    var eh = '';
    if (!crit.competencies.length) {
      eh += '<p class="prog-avis">Aquesta matèria encara no té competències específiques. Afegiu-les a la <a href="#criteris/' + encodeURIComponent(ed.id) + '">Gestió Criteris de Qualificació</a> i després hi podreu posar els criteris d’avaluació.</p>';
    }
    crit.competencies.forEach(function (c) {
      var codi = String(c.codi).toUpperCase(), ll = p.criteris_avaluacio[codi] || [];
      eh += '<div class="pm-ce"><div class="pm-ce__cap"><b>' + esc(c.codi) + '</b><span class="pm-crit">' + esc(c.descripcio) + '</span></div><div class="pm-files">';
      ll.forEach(function (x, i) {
        eh += '<div class="pm-crit-av"><input class="prog-in pm-crit-av__codi" data-cami="criteris_avaluacio.' + codi + '.' + i + '.codi" value="' + esc(x.codi) + '" aria-label="Codi"' + ro + '>' +
          '<textarea class="prog-in" data-cami="criteris_avaluacio.' + codi + '.' + i + '.text" rows="2" placeholder="Criteri d’avaluació"' + ro + '>' + esc(x.text) + '</textarea>' +
          ico('treu-crit', 'Elimina el criteri', '✕', ' data-ce="' + codi + '" data-i="' + i + '"') + '</div>';
      });
      eh += '</div>' + boto('afegeix-crit', '+ Criteri d’avaluació', ' data-ce="' + codi + '"') + '</div>';
    });
    // Transversals
    eh += '<h5 class="pm-sub">Competències transversals</h5>';
    var cdCat = M.dades.competencies_digitals || [];
    p.transversals.forEach(function (t, i) {
      var def = D.TRANSVERSALS[i];
      eh += '<div class="pm-trans"><b>' + esc(def.nom) + '</b>' +
        camp('transversals.' + i + '.descripcio', 'Descripció de l’activitat', t.descripcio, { area: true, files: 2, ph: def.comu ? 'Si ho deixeu en blanc: «' + T[def.comu] + '»' : (def.id === 'CD' ? 'p. ex. Ús de l’ordinador i de Classroom per…' : '') }) +
        camp('transversals.' + i + '.evidencies', 'Evidències', t.evidencies, { ph: 'p. ex. Dossier de cada unitat · lliuraments a Classroom' });
      if (def.id === 'CD') {
        eh += '<div class="prog-chips pm-chips"><span class="prog-chips__lbl">Indicadors de competència digital</span>' + cdCat.map(function (c) {
          var on = (t.indicadors || []).indexOf(c.codi) >= 0;
          return '<button type="button" class="prog-chip prog-chip--cd' + (on ? ' is-on' : '') + '" data-chip="transversals.' + i + '.indicadors" data-v="' + esc(c.codi) + '" aria-pressed="' + on + '" title="' + esc(c.descripcio) + '"' + ro + '>' + esc(c.codi) + '</button>';
        }).join('') + '</div>';
      }
      eh += '</div>';
    });
    h += seccio('E', eh, 'Les competències específiques (codi i descripció) es gestionen a la <a href="#criteris/' + encodeURIComponent(ed.id) + '">Gestió Criteris de Qualificació</a>. Aquí s’hi afegeixen els criteris d’avaluació de cada una.');
    // F
    var codisCrit = [];
    crit.competencies.forEach(function (c) { (p.criteris_avaluacio[String(c.codi).toUpperCase()] || []).forEach(function (x) { var k = String(x.codi || '').trim(); if (k && codisCrit.indexOf(k) < 0) codisCrit.push(k); }); });
    codisCrit.sort(D.ordenaCriteris);
    var fh = '<div class="pm-trims">';
    p.sequencia.forEach(function (s, i) {
      fh += '<div class="pm-trim"><h5>' + s.trimestre + ' trimestre</h5>' +
        camp('sequencia.' + i + '.continguts', 'Continguts (un per línia)', s.continguts, { area: true, files: 4, ph: 'Unitat 1. …\nUnitat 2. …' }) +
        '<div class="pm-graella">' + camp('sequencia.' + i + '.sessions', 'Sessions (aprox.)', s.sessions, { mode: 'numeric', ph: '30' }) + '</div>' +
        '<div class="prog-chips pm-chips"><span class="prog-chips__lbl">Criteris d’avaluació</span>' +
        (codisCrit.length ? codisCrit.map(function (k) {
          var on = (s.criteris || []).indexOf(k) >= 0;
          return '<button type="button" class="prog-chip' + (on ? ' is-on' : '') + '" data-chip="sequencia.' + i + '.criteris" data-v="' + esc(k) + '" aria-pressed="' + on + '"' + ro + '>' + esc(k) + '</button>';
        }).join('') : '<span class="prog-chips__buit">Primer afegiu els criteris d’avaluació (apartat E)</span>') + '</div></div>';
    });
    h += seccio('F', fh + '</div>');
    // G
    var mt = p.metodologia;
    h += seccio('G', camp('metodologia.orientacions', 'Orientacions metodològiques', mt.orientacions, { area: true, files: 3, ample: true }) +
      camp('metodologia.agrupaments', 'Agrupaments', mt.agrupaments, { area: true, files: 2, ample: true }) +
      camp('metodologia.materials', 'Materials i recursos', mt.materials, { area: true, files: 3, ample: true }) +
      camp('metodologia.espais', 'Espais i sortides', mt.espais, { area: true, files: 2, ample: true }));
    // H
    var s = D.sumes(crit.criteris);
    var blocsC = (info.blocs || []).filter(function (b) { return b.bloc || b.instruments; });
    var ok = function (v, nom, opcional) { return '<span class="trim' + (v ? ' trim--ok' : (opcional ? ' trim--opc' : '')) + '">' + nom + (opcional && !v ? ' <small>(opcional)</small>' : '') + '</span>'; };
    var hh = '<div class="pm-comu"><p>' + esc(T.avaluacio) + '</p><p>' + esc(D.ASSOL.text) + '</p></div>' +
      '<div class="pm-critresum"><b>Tot aquest apartat ve de la Gestió Criteris de Qualificació</b><span>' + D.TRIMESTRES.map(function (t) {
        var x = s[t], cl = !x.n ? '' : (Math.abs(x.total - 100) < 0.01 ? ' trim--ok' : ' trim--ko');
        return '<span class="trim' + cl + '">' + t + ' <b>' + (x.n ? P().fmtNum(x.total) + '%' : '—') + '</b></span>';
      }).join('') + ok(blocsC.length, 'Pes per blocs', true) + ok(info.criteri_aprovar, 'Criteris per aprovar') + ok(info.recuperacio, 'Recuperació trimestral i final') +
      ok(info.pendents, 'Pendents de cursos anteriors') + ok(info.millora, 'Millora de nota', true) + '</span>' +
      '<p>Aquí no es defineix res: el pes dels instruments per blocs, els criteris per aprovar, la recuperació, les pendents i la millora de nota es desen amb els criteris de la matèria i surten automàticament al document.</p>' +
      '<a href="#criteris/' + encodeURIComponent(ed.id) + '">Edita els criteris de qualificació →</a></div>';
    h += seccio('H', hh, 'Les activitats avaluatives, el pes per blocs, els criteris per aprovar, la recuperació i la millora de nota es prenen de la Gestió Criteris de Qualificació.');
    // I
    var dv = p.diversitat;
    h += seccio('I', camp('diversitat.universals', 'Mesures universals (una per línia)', dv.universals, { area: true, files: 4, ample: true, ajuda: 'Personalització, DUA, avaluació formativa, acció tutorial…' }) +
      camp('diversitat.addicionals', 'Mesures addicionals (una per línia)', dv.addicionals, { area: true, files: 3, ample: true, ajuda: 'Suport, alumnat nouvingut, PDC…' }) +
      '<div class="pm-comu"><b>Intensives / PI:</b> ' + esc(T.intensives) + '</div>');
    // J
    h += seccio('J', camp('especifics.lectures', 'Lectures', p.especifics.lectures, { area: true, files: 2, ample: true, ph: 'Si ho deixeu en blanc: «' + T.lectures + '»' }) +
      camp('especifics.sortides', 'Sortides i activitats complementàries', p.especifics.sortides, { area: true, files: 2, ample: true, ph: 'Si ho deixeu en blanc: «' + T.sortides + '»' }));
    // K
    var kh = '<div class="pm-files">';
    p.revisio.forEach(function (r, i) {
      kh += '<div class="pm-rev"><input class="prog-in" data-cami="revisio.' + i + '.versio" value="' + esc(r.versio) + '" placeholder="1.0" aria-label="Versió"' + ro + '>' +
        '<input class="prog-in" data-cami="revisio.' + i + '.data" value="' + esc(r.data) + '" placeholder="Data" aria-label="Data"' + ro + '>' +
        '<input class="prog-in" data-cami="revisio.' + i + '.canvis" value="' + esc(r.canvis) + '" placeholder="Descripció dels canvis" aria-label="Descripció dels canvis"' + ro + '>' +
        '<input class="prog-in" data-cami="revisio.' + i + '.aprovacio" value="' + esc(r.aprovacio) + '" placeholder="Aprovació (si és en blanc, el departament)" aria-label="Aprovació"' + ro + '>' +
        ico('treu', 'Elimina', '✕', ' data-llista="revisio" data-i="' + i + '"') + '</div>';
    });
    h += seccio('K', kh + '</div>' + boto('afegeix', '+ Afegeix versió', ' data-llista="revisio"'));
    h += '</div>';   // pm-form
    h += '<aside class="pm-previ" aria-label="Vista prèvia"><div class="pm-previ__cap">Vista prèvia <span>s’actualitza mentre escriviu</span></div><div class="pm-doc" id="pmDoc"></div></aside></div>';

    if (pot()) {
      h += '<div class="prog-desa" id="pmBarra"><span class="prog-desa__estat" id="pmEstat"></span>' +
        '<button type="button" class="prog-btn prog-btn--ghost" data-accio="descarta">Descarta els canvis</button>' +
        '<button type="button" class="prog-btn prog-btn--primary" data-accio="desa">Desa</button></div>';
    }
    $('matEditor').innerHTML = h;
    marcaBrut(P().S.brut);
    $('matEditor').querySelectorAll('textarea').forEach(P().autoalt);
    pintaPrevi();
  }

  function pintaPrevi() {
    var doc = $('pmDoc');
    if (!doc || !M.ed) return;
    doc.innerHTML = D.html(D.blocs(ctxDe(M.ed.id, true)));
  }
  function previAviat() { clearTimeout(M.previ); M.previ = setTimeout(function () { pintaPrevi(); actualitzaEstat(); }, 250); }
  function actualitzaEstat() {
    if (!M.ed) return;
    M.estat = D.estat(ctxDe(M.ed.id, true));
    var bar = $('matEditor').querySelector('.pm-progres__barra span'), t = $('matEditor').querySelector('.pm-progres__txt');
    if (bar) bar.style.width = Math.round(100 * M.estat.fets / M.estat.total) + '%';
    if (t) t.textContent = M.estat.fets + ' de ' + M.estat.total + ' apartats bàsics fets';
    $('matEditor').querySelectorAll('.pm-nav a').forEach(function (a) { var k = a.dataset.salta; if ('ACDEFGHIK'.indexOf(k) >= 0) a.classList.toggle('is-ok', !!M.estat.apartats[k]); });
    $('matEditor').querySelectorAll('.pm-sec').forEach(function (s) {
      var k = s.dataset.lletra, e = s.querySelector('.pm-sec__estat');
      if ('ACDEFGHIK'.indexOf(k) >= 0 && e) { e.classList.toggle('is-ok', !!M.estat.apartats[k]); e.textContent = M.estat.apartats[k] ? 'Fet' : 'Pendent'; }
    });
  }

  function marcaBrut(v) {
    P().S.brut = v;
    var e = $('pmEstat'), b = $('pmBarra');
    if (!e) return;
    e.textContent = v ? 'Hi ha canvis sense desar' : (M.idx[M.ed.id].prog ? 'Tot desat' : 'Encara no s’ha desat');
    b.classList.toggle('is-brut', v);
  }

  // Escriu un valor a M.ed.p seguint un camí «a.b.0.c»
  function posa(cami, valor) {
    var parts = cami.split('.'), o = M.ed.p;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i], seg = parts[i + 1];
      if (o[k] == null) o[k] = /^\d+$/.test(seg) ? [] : {};
      o = o[k];
    }
    o[parts[parts.length - 1]] = valor;
  }
  function llegeix(cami) { return cami.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, M.ed.p); }

  $('matEditor').addEventListener('input', function (e) {
    var t = e.target;
    if (!M.ed || !t.dataset.cami) return;
    if (t.tagName === 'TEXTAREA') P().autoalt(t);
    posa(t.dataset.cami, t.value);
    marcaBrut(true);
    previAviat();
  });
  $('matEditor').addEventListener('change', function (e) {
    var t = e.target;
    if (!M.ed || !t.dataset.cami) return;
    // En canviar el codi d'un criteri d'avaluació, s'actualitzen els xips de la seqüenciació
    if (/^criteris_avaluacio\.[^.]+\.\d+\.codi$/.test(t.dataset.cami)) repinta();
  });

  function repinta() {
    var y = window.scrollY, fy = $('pmForm') ? $('pmForm').scrollTop : 0;
    var tancats = [].map.call($('matEditor').querySelectorAll('.pm-sec:not([open])'), function (s) { return s.dataset.lletra; });
    pintaEditor();
    tancats.forEach(function (k) { var s = $('pm-sec-' + k); if (s) s.open = false; });
    window.scrollTo(0, y);
    if ($('pmForm')) $('pmForm').scrollTop = fy;
  }

  $('matEditor').addEventListener('click', function (e) {
    var vista = e.target.closest('[data-vista]');
    if (vista) {
      M.ed.vista = vista.dataset.vista;
      var cont = $('matEditor').querySelector('.pm-ed');
      cont.classList.toggle('pm-ed--previ', M.ed.vista === 'previ'); cont.classList.toggle('pm-ed--form', M.ed.vista !== 'previ');
      $('matEditor').querySelectorAll('[data-vista]').forEach(function (b) { b.setAttribute('aria-selected', String(b === vista)); });
      return;
    }
    var salta = e.target.closest('[data-salta]');
    if (salta) {
      e.preventDefault();
      var k = salta.dataset.salta, sec = $('pm-sec-' + k), h1 = $('pmDoc') && $('pmDoc').querySelector('[data-lletra="' + k + '"]');
      if (sec) { sec.open = true; sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      if (h1) { var pr = $('matEditor').querySelector('.pm-previ'); if (pr && getComputedStyle(pr).position === 'sticky') pr.scrollTop = h1.offsetTop - 50; }
      return;
    }
    var b = e.target.closest('button');
    if (!b || !M.ed || b.disabled) return;
    var p = M.ed.p;
    if (b.dataset.chip) {
      var ll = llegeix(b.dataset.chip) || [];
      var pos = ll.indexOf(b.dataset.v);
      if (pos >= 0) ll.splice(pos, 1); else ll.push(b.dataset.v);
      ll.sort(b.dataset.chip.indexOf('indicadors') >= 0 ? D.ordenaCodis : D.ordenaCriteris);
      posa(b.dataset.chip, ll);
      b.classList.toggle('is-on', pos < 0); b.setAttribute('aria-pressed', String(pos < 0));
      marcaBrut(true); previAviat();
      return;
    }
    var fila = b.closest('[data-i]'), i = b.dataset.i != null ? Number(b.dataset.i) : (fila ? Number(fila.dataset.i) : -1);
    switch (b.dataset.accio) {
      case 'afegeix': {
        var l = b.dataset.llista, arr = llegeix(l) || [];
        if (l === 'objectius') arr.push({ titol: '', text: '' });
        if (l === 'revisio') {
          var ult = arr[arr.length - 1], v = ult && /^(\d+)\.(\d+)$/.test(ult.versio) ? ult.versio.replace(/\.(\d+)$/, function (x, n) { return '.' + (Number(n) + 1); }) : '1.' + arr.length;
          arr.push({ versio: v, data: '', canvis: '', aprovacio: '' });
        }
        posa(l, arr); marcaBrut(true); repinta();
        break;
      }
      case 'treu': { var l2 = b.dataset.llista, a2 = llegeix(l2); if (a2 && i >= 0) { a2.splice(i, 1); marcaBrut(true); repinta(); } break; }
      case 'puja': case 'baixa': {
        var l3 = b.dataset.llista, a3 = llegeix(l3), j = i + (b.dataset.accio === 'puja' ? -1 : 1);
        if (!a3 || j < 0 || j >= a3.length) return;
        var tmp = a3[i]; a3[i] = a3[j]; a3[j] = tmp; marcaBrut(true); repinta();
        break;
      }
      case 'afegeix-crit': {
        var ce = b.dataset.ce, llc = p.criteris_avaluacio[ce] = p.criteris_avaluacio[ce] || [];
        var n = D.numCE(ce), seg = 1;
        llc.forEach(function (x) { var mm = String(x.codi).match(/\.(\d+)$/); if (mm) seg = Math.max(seg, Number(mm[1]) + 1); });
        llc.push({ codi: (n ? n + '.' : '') + seg, text: '' });
        marcaBrut(true); repinta();
        var ins = $('matEditor').querySelectorAll('[data-cami^="criteris_avaluacio.' + ce + '."][data-cami$=".text"]');
        if (ins.length) ins[ins.length - 1].focus();
        break;
      }
      case 'treu-crit': { var lc = p.criteris_avaluacio[b.dataset.ce]; if (lc) { lc.splice(i, 1); marcaBrut(true); repinta(); } break; }
      case 'desa': desa(false); break;
      case 'descarta':
        if (!P().S.brut) return;
        P().pregunta('Descartar els canvis', '<p>Es tornarà a l’última versió desada.</p>', [
          { t: 'Continua editant', valor: 0, tipus: 'ghost' }, { t: 'Descarta', valor: 1, tipus: 'danger' }
        ]).then(function (v2) { if (v2) { P().S.brut = false; obreEditor(M.ed.id); } });
        break;
      case 'esborra': donaBaixa(); break;
      case 'pdf': informePdf([M.ed.id], null, true); break;
      case 'xlsx': informeXlsx([M.ed.id], null, true); break;
      case 'carrega': carregaDades(); break;
    }
  });

  // ------------------------------------------------------------------ desar, donar de baixa i carregar
  function neteja(p) {
    var o = copia(p);
    o.objectius = o.objectius.filter(function (x) { return String(x.titol).trim() || String(x.text).trim(); });
    Object.keys(o.criteris_avaluacio).forEach(function (k) {
      o.criteris_avaluacio[k] = o.criteris_avaluacio[k].filter(function (x) { return String(x.text).trim() || String(x.codi).trim(); });
      if (!o.criteris_avaluacio[k].length) delete o.criteris_avaluacio[k];
    });
    o.revisio = o.revisio.filter(function (x) { return String(x.versio).trim() || String(x.data).trim() || String(x.canvis).trim(); });
    return o;
  }

  function desa(forca) {
    var ed = M.ed, prog = neteja(ed.p);
    var avisos = [], st = D.estat(ctxDe(ed.id, true));
    D.APARTATS.forEach(function (a) { if ('ACDEFGHIK'.indexOf(a[0]) >= 0 && !st.apartats[a[0]]) avisos.push(a[0] + '. ' + a[1] + ': incomplet.'); });
    var ces = M.idx[ed.id].crit.competencies.map(function (c) { return String(c.codi).toUpperCase(); });
    var fora = Object.keys(prog.criteris_avaluacio).filter(function (k) { return ces.indexOf(k) < 0; });
    if (fora.length) avisos.push('Hi ha criteris d’avaluació de competències que ja no són al catàleg (' + fora.join(', ') + '); es desen però no surten al document.');
    var continua = (avisos.length && !forca) ? P().pregunta('Abans de desar', '<ul>' + avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul><p>Podeu desar igualment i acabar-ho més endavant.</p>', [
      { t: 'Torna a l’editor', valor: 0, tipus: 'ghost' }, { t: 'Desa igualment', valor: 1, tipus: 'primary' }
    ]) : Promise.resolve(1);
    continua.then(function (v) {
      if (!v) return;
      var bt = $('matEditor').querySelector('[data-accio="desa"]');
      if (bt) { bt.disabled = true; bt.textContent = 'Desant…'; }
      P().api('materies', { cos: { accio: 'desa', curs: M.dades.curs, id_materia: ed.id, programacio: prog, data_anterior: ed.data_anterior, forca: !!forca }, progres: 'Desant la programació…' }).then(function (r) {
        if (bt) { bt.disabled = false; bt.textContent = 'Desa'; }
        if (r.ok) {
          M.idx[ed.id].prog = Object.assign({ id_materia: ed.id, data: r.data, desat_per: r.desat_per }, prog);
          P().S.brut = false; ed.avisos = '';
          obreEditor(ed.id);
          P().toast('Programació desada.');
          return;
        }
        if (r.error === 'conflicte') {
          P().pregunta('Algú altre ha desat aquesta programació', '<p>' + esc(r.desat_per || 'Una altra persona') + ' l’ha desada ' + (r.data ? 'el ' + esc(P().dataCurta(r.data)) : 'fa poc') +
            ', després que vosaltres l’obríssiu.</p><p>Podeu tornar-la a carregar (perdreu els vostres canvis) o desar la vostra versió (l’anterior queda a l’historial).</p>', [
            { t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Torna a carregar', valor: 'recarrega' }, { t: 'Desa la meva versió', valor: 'forca', tipus: 'danger' }
          ]).then(function (v2) {
            if (v2 === 'forca') desa(true);
            if (v2 === 'recarrega') { P().S.brut = false; M.dades = null; carrega().then(function () { obreEditor(ed.id); }); }
          });
          return;
        }
        P().toast(P().text(r.error) + (P().MISSATGES[r.error] ? '' : ' (' + r.error + ')'), true);
      }).catch(function () { if (bt) { bt.disabled = false; bt.textContent = 'Desa'; } P().toast(P().text('error_servidor'), true); });
    });
  }

  function donaBaixa() {
    var ed = M.ed;
    P().pregunta('Donar de baixa la programació', '<p>S’eliminarà la programació de <strong>' + esc(ed.m.materia) + '</strong> (' + esc(ed.m.nivell) + ', curs ' + esc(M.dades.curs) + '). Els criteris de qualificació no es toquen.</p><p>Queda una còpia a la pestanya «historial» del full.</p>', [
      { t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Dona de baixa', valor: 1, tipus: 'danger' }
    ]).then(function (v) {
      if (!v) return;
      P().api('materies', { cos: { accio: 'esborra', curs: M.dades.curs, id_materia: ed.id }, progres: 'Donant de baixa…' }).then(function (r) {
        if (!r.ok) return P().toast(P().text(r.error), true);
        M.idx[ed.id].prog = null; P().S.brut = false;
        P().toast('S’ha donat de baixa la programació.');
        obreEditor(ed.id);
      });
    });
  }

  function carregaDades() {
    var ed = M.ed, d = M.dades;
    var a = Number(String(d.curs).slice(0, 4)), anterior = (a - 1) + '-' + a;
    var altres = d.materies.filter(function (m) { return m.id_materia !== ed.id && M.idx[m.id_materia].prog; });
    var h = '<p>Les dades carregades substitueixen les de l’editor. No es desa res fins que premeu <strong>Desa</strong>.</p>' +
      '<label class="prog-radio"><input type="radio" name="fontP" value="curs" checked> La mateixa matèria del curs ' + esc(anterior) + '</label>';
    if (altres.length) {
      h += '<label class="prog-radio"><input type="radio" name="fontP" value="altra"> Una altra programació d’aquest curs:</label><select class="prog-in" id="selAltraP">' +
        altres.map(function (m) { return '<option value="' + esc(m.id_materia) + '">' + esc(m.nivell + ' · ' + m.materia) + '</option>'; }).join('') + '</select>' +
        '<p class="prog-ajuda" style="margin:8px 0 0">D’una altra matèria no es copien la identificació, els criteris d’avaluació ni la seqüenciació.</p>';
    }
    P().pregunta('Carregar dades', h, [{ t: 'Cancel·la', valor: 0, tipus: 'ghost' }, { t: 'Carrega', valor: 1, tipus: 'primary' }]);
    var bts = $('progModalBtns').querySelectorAll('button');
    bts[bts.length - 1].addEventListener('click', function () {
      var font = ($('progModalText').querySelector('input[name="fontP"]:checked') || {}).value;
      var altra = $('selAltraP') ? $('selAltraP').value : '';
      var crida = font === 'altra'
        ? Promise.resolve({ ok: true, programacio: M.idx[altra].prog })
        : P().api('materies', { cos: { accio: 'materia', curs: d.curs, curs_origen: anterior, id_materia: ed.id }, progres: 'Carregant el curs ' + anterior + '…' });
      crida.then(function (r) {
        if (!r.ok) return P().toast(P().text(r.error), true);
        if (!r.programacio) return P().toast('Aquesta matèria no té programació al curs ' + anterior + '.', true);
        var nou = D.normalitza(copia(r.programacio), ed.m);
        if (font === 'altra') {
          nou.identificacio = ed.p.identificacio; nou.criteris_avaluacio = ed.p.criteris_avaluacio; nou.sequencia = ed.p.sequencia;
          ed.avisos = 'Origen: ' + altra + '.';
        } else {
          nou.revisio = nou.revisio.concat([{ versio: '', data: '', canvis: 'Revisió per al curs ' + d.curs + '.', aprovacio: '' }]);
          ed.avisos = 'Origen: curs ' + anterior + '. Reviseu sobretot els docents, les dates i la seqüenciació.';
        }
        ed.p = nou;
        marcaBrut(true); pintaEditor();
        P().toast('Dades carregades. Reviseu-les i deseu.');
      });
    }, { once: true });
  }

  // ------------------------------------------------------------------ informes
  function resumFiles(ids) {
    return ids.map(function (id) {
      var ctx = ctxDe(id), st = D.estat(ctx), e = M.idx[id];
      return [e.m.nivell, e.m.materia, nomDep(e.m.departament), st.fets + '/' + st.total, st.nom, e.prog && e.prog.data ? P().dataCurta(e.prog.data) : '—'];
    });
  }
  function informePdf(ids, titol, actual) {
    var amb = ids.filter(function (id) { return actual || M.idx[id].prog; });
    if (!amb.length && !titol) return P().toast('Aquesta programació encara no s’ha desat.', true);
    window.Progres.inici('Generant el PDF…');
    window.CriterisPdf.prepara(function (f) { window.Progres.posa(f, 'Preparant el PDF…'); }).then(function (R) {
      window.Progres.posa(0.7, 'Generant el PDF…');
      var portada = titol ? {
        titol: 'Programacions de matèries', subtitol: titol + ' · ESO · Curs ' + M.dades.curs,
        head: ['Nivell', 'Matèria', 'Departament', 'Apartats', 'Estat', 'Desada'], body: resumFiles(ids), w: [17, 0, 40, 18, 20, 22],
        nota: amb.length + ' programacions desades de ' + ids.length + ' matèries.'
      } : null;
      var doc = window.ProgDoc.pdf(R, amb.map(function (id) { return ctxDe(id, actual); }), { portada: portada });
      var e0 = M.idx[ids[0]].m;
      var nom = 'programacio-' + (titol ? P().normalitza(titol) : P().normalitza(e0.nivell + ' ' + e0.materia)).replace(/ /g, '-') + '-' + M.dades.curs + '.pdf';
      doc.save(nom);
      window.Progres.fi();
      P().toast('S’ha descarregat ' + nom + '.');
    }).catch(function (err) {
      window.Progres.fi(true);
      P().toast('No s’ha pogut generar el PDF. Comproveu la connexió i torneu-ho a provar.', true);
      if (window.console) console.error(err);
    });
  }
  function informeXlsx(ids, titol, actual) {
    var amb = ids.filter(function (id) { return actual || M.idx[id].prog; });
    if (!amb.length && !titol) return P().toast('Aquesta programació encara no s’ha desat.', true);
    var e0 = M.idx[ids[0]].m;
    var nom = 'programacio-' + (titol ? P().normalitza(titol) : P().normalitza(e0.nivell + ' ' + e0.materia)).replace(/ /g, '-') + '-' + M.dades.curs + '.xlsx';
    var resum = titol ? { titol: 'Programacions de matèries · ' + titol + ' · Curs ' + M.dades.curs, head: ['Nivell', 'Matèria', 'Departament', 'Apartats', 'Estat', 'Desada'], body: resumFiles(ids) } : null;
    window.Progres.inici('Generant l’Excel…');
    window.ProgDoc.xlsx(amb.map(function (id) { return ctxDe(id, actual); }), nom, resum).then(function () {
      window.Progres.fi(); P().toast('S’ha descarregat ' + nom + '.');
    }).catch(function (err) {
      window.Progres.fi(true); P().toast('No s’ha pogut generar l’Excel. Comproveu la connexió i torneu-ho a provar.', true);
      if (window.console) console.error(err);
    });
  }

  window.ProgMat = { mostra: mostra };
})();
