/* =====================================================================
   PDF de criteris de qualificació (jsPDF + jspdf-autotable de cdnjs, Montserrat i logo del centre).
   El fan servir:
     - Programacions (/programacions): PDF d'una matèria i informe del departament.
     - Pàgines d'ESO i Batxillerat: enllaços «Criteris de qualificació» de cada nivell
       (dades públiques de /api/criteris-publics).

   CriterisPdf.prepara(progres?)  → Promise(recursos)   (carrega llibreries, tipografia i logo el primer cop)
   CriterisPdf.genera(recursos, opcions) → document jsPDF
     opcions = {
       curs, lang ('ca'|'es'|'en'), capcalera (text de dalt a la dreta),
       portada: { titol, subtitol, head:[[…]], body:[[…]], columnStyles, nota } | null,
       materies: [{ titol, subtitol, pagina, senseCD (sense competència digital: Batxillerat), criteris:[{trimestre, activitat, percentatge, competencies[], competencia_digital[]}],
                    competencies:[{codi, descripcio}], info:{criteri_aprovar, recuperacio, observacions} }],
       competenciesDigitals: [{codi, descripcio}],
       buit: text si no hi ha cap matèria
     }
   CriterisPdf.TRIMESTRES, CriterisPdf.num(valor), CriterisPdf.fmt(n, lang)
   ===================================================================== */
(function (global) {
  'use strict';

  var LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
  ];
  var RECURSOS = ['/assets/programacions/Montserrat-400.ttf', '/assets/programacions/Montserrat-600.ttf', '/assets/programacions/logo-ijm.png'];
  var TRIMESTRES = ['1r', '2n', '3r'];
  var BLAU = [28, 12, 188], TARONJA = [232, 96, 12], GRIS = [90, 96, 112], TEXT = [30, 30, 42], VORA = [214, 218, 230], VERD = [15, 122, 110];

  var T = {
    ca: { trim: { '1r': '1r trimestre', '2n': '2n trimestre', '3r': '3r trimestre' }, act: 'Activitat avaluativa', ce: 'Competència específica',
      cd: 'Competència digital', total: 'Total', ces: 'Competències específiques', cdT: 'Competència digital',
      aprovar: 'Criteri per aprovar la matèria', recup: 'Mecanismes de recuperació', obs: 'Observacions', curs: 'Curs',
      generat: 'Generat el', pagina: 'Pàgina', de: 'de', centre: 'Institut Joan Miró · Cornellà de Llobregat', locale: 'ca-ES' },
    es: { trim: { '1r': '1.er trimestre', '2n': '2.º trimestre', '3r': '3.er trimestre' }, act: 'Actividad evaluativa', ce: 'Competencia específica',
      cd: 'Competencia digital', total: 'Total', ces: 'Competencias específicas', cdT: 'Competencia digital',
      aprovar: 'Criterio para aprobar la materia', recup: 'Mecanismos de recuperación', obs: 'Observaciones', curs: 'Curso',
      generat: 'Generado el', pagina: 'Página', de: 'de', centre: 'Institut Joan Miró · Cornellà de Llobregat', locale: 'es-ES' },
    en: { trim: { '1r': 'Term 1', '2n': 'Term 2', '3r': 'Term 3' }, act: 'Assessment activity', ce: 'Specific competence',
      cd: 'Digital competence', total: 'Total', ces: 'Specific competences', cdT: 'Digital competence',
      aprovar: 'Pass criteria', recup: 'Make-up arrangements', obs: 'Notes', curs: 'School year',
      generat: 'Generated on', pagina: 'Page', de: 'of', centre: 'Institut Joan Miró · Cornellà de Llobregat', locale: 'en-GB' }
  };

  function num(v) {
    var s = String(v == null ? '' : v).replace('%', '').replace(',', '.').trim();
    if (s === '') return null;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function fmt(n, lang) { return (Math.round(n * 100) / 100).toLocaleString((T[lang] || T.ca).locale); }
  function ordenaCodis(a, b) {
    var ma = String(a).match(/^([A-Z]+)(\d+)$/), mb = String(b).match(/^([A-Z]+)(\d+)$/);
    if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
    return String(a).localeCompare(String(b), 'ca');
  }

  function carregaScript(src) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('No s’ha pogut carregar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function base64(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.arrayBuffer(); }).then(function (buf) {
      var b = new Uint8Array(buf), t = '', pas = 0x8000;
      for (var i = 0; i < b.length; i += pas) t += String.fromCharCode.apply(null, b.subarray(i, i + pas));
      return btoa(t);
    });
  }

  var recursos = null;
  /** progres(fraccio, text) opcional, per a la barra de progrés */
  function prepara(progres) {
    progres = progres || function () {};
    if (recursos) return recursos;
    progres(0.1, null);
    var cal = global.jspdf && global.jspdf.jsPDF ? Promise.resolve() : carregaScript(LIBS[0]);
    recursos = cal.then(function () {
      progres(0.3, null);
      return global.jspdf.jsPDF.API.autoTable ? null : carregaScript(LIBS[1]);
    }).then(function () {
      progres(0.45, null);
      return Promise.all(RECURSOS.map(base64));
    }).then(function (r) { return { regular: r[0], negreta: r[1], logo: 'data:image/png;base64,' + r[2] }; });
    recursos.catch(function () { recursos = null; });
    return recursos;
  }

  function genera(R, o) {
    var L = T[o.lang] || T.ca;
    var doc = new global.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    doc.addFileToVFS('Montserrat-400.ttf', R.regular); doc.addFont('Montserrat-400.ttf', 'Montserrat', 'normal');
    doc.addFileToVFS('Montserrat-600.ttf', R.negreta); doc.addFont('Montserrat-600.ttf', 'Montserrat', 'bold');
    doc.setFont('Montserrat', 'normal');
    var W = 210, H = 297, MX = 16, AMPLE = W - 2 * MX, DALT = 34, BAIX = 22;
    var cdDesc = {};
    (o.competenciesDigitals || []).forEach(function (c) { cdDesc[c.codi] = c.descripcio; });
    var y = DALT, titolPagina = '';

    function capcalera() {
      doc.addImage(R.logo, 'PNG', MX, 10, 30, 30 * 432 / 1100);
      doc.setFont('Montserrat', 'bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, TARONJA);
      doc.text(String(o.capcalera || '').toUpperCase(), W - MX, 13.5, { align: 'right' });
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS);
      doc.text('Institut Joan Miró · ' + L.curs + ' ' + o.curs + (titolPagina ? ' · ' + titolPagina : ''), W - MX, 18, { align: 'right' });
      doc.setDrawColor.apply(doc, BLAU); doc.setLineWidth(0.6); doc.line(MX, 24, W - MX, 24);
    }
    function novaPagina() { doc.addPage(); capcalera(); y = DALT; }
    function espai(h) { if (y + h > H - BAIX) novaPagina(); }
    function titol3(t) {
      espai(14);
      doc.setFont('Montserrat', 'bold'); doc.setFontSize(10.5); doc.setTextColor.apply(doc, BLAU);
      doc.text(t, MX, y); y += 3;
    }
    function paragraf(t, color) {
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, color || TEXT);
      doc.splitTextToSize(String(t), AMPLE).forEach(function (l) { espai(5); doc.text(l, MX, y + 3.2); y += 4.6; });
      y += 3;
    }
    function taula(opcions) {
      doc.autoTable(Object.assign({
        startY: y + 1, margin: { left: MX, right: MX, top: DALT, bottom: BAIX },
        styles: { font: 'Montserrat', fontSize: 8.5, cellPadding: 2, textColor: TEXT, lineColor: VORA, lineWidth: 0.2, valign: 'top' },
        headStyles: { font: 'Montserrat', fontStyle: 'bold', fillColor: [238, 240, 255], textColor: BLAU, fontSize: 7.5 },
        didDrawPage: function (data) { if (data.pageNumber > 1 || doc.internal.getNumberOfPages() > 1) capcalera(); }
      }, opcions));
      y = doc.lastAutoTable.finalY + 7;
    }

    capcalera();
    var materies = o.materies || [];
    if (o.portada) {
      var P = o.portada;
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(22); doc.setTextColor.apply(doc, BLAU);
      doc.text(P.titol, MX, y + 6); y += 13;
      doc.setFontSize(10.5); doc.setTextColor.apply(doc, GRIS);
      doc.text(P.subtitol, MX, y); y += 6;
      if (P.body && P.body.length) taula({ head: P.head, body: P.body, columnStyles: P.columnStyles || {} });
      else y += 4;
      if (P.nota) paragraf(P.nota, GRIS);
    }
    if (!materies.length && o.buit) paragraf(o.buit);

    materies.forEach(function (x, k) {
      var info = x.info || {};
      if (o.portada || k > 0) { titolPagina = x.pagina || x.titol; novaPagina(); }
      doc.setFont('Montserrat', 'bold'); doc.setFontSize(18); doc.setTextColor.apply(doc, BLAU);
      doc.text(doc.splitTextToSize(x.titol, AMPLE)[0], MX, y + 5); y += 11;
      if (x.subtitol) {
        doc.setFont('Montserrat', 'normal'); doc.setFontSize(9.5); doc.setTextColor.apply(doc, GRIS);
        doc.text(x.subtitol, MX, y); y += 8;
      }
      TRIMESTRES.forEach(function (t) {
        var files = (x.criteris || []).filter(function (c) { return c.trimestre === t; });
        if (!files.length) return;
        var tot = files.reduce(function (s, c) { var p = num(c.percentatge); return s + (p && !isNaN(p) ? p : 0); }, 0);
        titol3(L.trim[t]);
        var ambCD = !x.senseCD;   // al Batxillerat no hi ha competència digital
        taula({
          head: [ambCD ? [L.act, '%', L.ce, L.cd] : [L.act, '%', L.ce]],
          body: files.map(function (c) {
            var p = num(c.percentatge);
            var fila = [c.activitat, p !== null && !isNaN(p) ? fmt(p, o.lang) : '', (c.competencies || []).join(', ')];
            return ambCD ? fila.concat((c.competencia_digital || []).join(', ')) : fila;
          }),
          foot: [ambCD ? [L.total, fmt(tot, o.lang), '', ''] : [L.total, fmt(tot, o.lang), '']],
          footStyles: { font: 'Montserrat', fontStyle: 'bold', fillColor: [246, 247, 250], textColor: Math.abs(tot - 100) < 0.01 ? TEXT : [163, 90, 0] },
          showFoot: 'lastPage',
          columnStyles: ambCD ? { 1: { halign: 'right', cellWidth: 14 }, 2: { cellWidth: 40 }, 3: { cellWidth: 34 } } : { 1: { halign: 'right', cellWidth: 14 }, 2: { cellWidth: 52 } }
        });
      });
      if ((x.competencies || []).length) {
        titol3(L.ces);
        taula({ body: x.competencies.map(function (c) { return [c.codi, c.descripcio]; }),
          columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold', textColor: BLAU } } });
      }
      var usats = [];
      if (!x.senseCD) (x.criteris || []).forEach(function (c) { (c.competencia_digital || []).forEach(function (v) { if (usats.indexOf(v) < 0) usats.push(v); }); });
      if (usats.length) {
        usats.sort(ordenaCodis);
        titol3(L.cdT);
        taula({ body: usats.map(function (v) { return [v, cdDesc[v] || '']; }),
          columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold', textColor: VERD } } });
      }
      [['criteri_aprovar', L.aprovar], ['recuperacio', L.recup], ['observacions', L.obs]].forEach(function (c) {
        if (info[c[0]]) { titol3(c[1]); y += 1; paragraf(info[c[0]]); }
      });
    });

    // Peu amb la data i la paginació
    var n = doc.internal.getNumberOfPages(), avui = new Date().toLocaleDateString(L.locale);
    for (var pg = 1; pg <= n; pg++) {
      doc.setPage(pg);
      doc.setDrawColor.apply(doc, VORA); doc.setLineWidth(0.2); doc.line(MX, H - 14, W - MX, H - 14);
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS);
      doc.text(L.centre + ' · ' + L.generat + ' ' + avui, MX, H - 9.5);
      doc.text(L.pagina + ' ' + pg + ' ' + L.de + ' ' + n, W - MX, H - 9.5, { align: 'right' });
    }
    return doc;
  }

  global.CriterisPdf = { prepara: prepara, genera: genera, TRIMESTRES: TRIMESTRES, num: num, fmt: fmt };
})(window);
