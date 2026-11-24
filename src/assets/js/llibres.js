/* PAS 88 · Pàgina pública «Llibres de text» (abans, al lloc separat de llibres). Dades: GESTIO › Llibres de text (curs
   publicat), per /api/gestio-publics?quin=llibres. Enllaços: /llibres.html#ESO-1r (un curs) · /llibres.html?etapa=ESO */
(function () {
  'use strict';
  var arrel = document.getElementById('llibres'); if (!arrel) return;
  var $ = function (id) { return document.getElementById(id); };
  var ORDRE = ['ESO 1r', 'ESO 2n', 'ESO 3r', 'ESO 4t', 'BAT 1r', 'BAT 2n'];
  var NOMS = { 'ESO 1r': '1r ESO', 'ESO 2n': '2n ESO', 'ESO 3r': '3r ESO', 'ESO 4t': '4t ESO', 'BAT 1r': '1r Batxillerat', 'BAT 2n': '2n Batxillerat' };
  var TIPUS = { llibre: 'Llibre de text', lectura: 'Lectura', material: 'Material' };
  var FORMATS = { paper: 'Paper', digital: 'Digital', 'paper+digital': 'Paper+Digital' };
  var GRUPS = ['Matèries comunes', 'Matèries d\'itinerari', 'Modalitat obligatòria', 'Modalitat específica', 'Matèries optatives', 'Altres matèries'];
  var LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'];
  var nomNivell = function (n) { return NOMS[n] || n; };
  var slug = function (n) { return n.replace(/\s+/g, '-'); };
  var norm = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); };
  var grup = function (t) { t = norm(t); return t.indexOf('optativ') >= 0 ? 4 : t.indexOf('especific') >= 0 ? 3 : (t.indexOf('obligat') >= 0 || t.indexOf('modalitat') >= 0) ? 2 : t.indexOf('itinerari') >= 0 ? 1 : t.indexOf('comu') >= 0 ? 0 : 5; };
  var agrupa = function (ll) { var g = GRUPS.map(function (n) { return { nom: n, materies: [] }; });
    ll.slice().sort(function (a, b) { return grup(a.tipus) - grup(b.tipus) || a.materia.localeCompare(b.materia, 'ca'); }).forEach(function (m) { g[grup(m.tipus)].materies.push(m); });
    return g.filter(function (x) { return x.materies.length; }); };
  var ordItems = function (a, b) { return ['llibre', 'lectura', 'material'].indexOf(a.tipus) - ['llibre', 'lectura', 'material'].indexOf(b.tipus) || a.ordre - b.ordre; };
  var sn = function (v) { return v === 'si' ? 'Sí' : v === 'no' ? 'No' : ''; };
  var etapa = (new URLSearchParams(location.search).get('etapa') || '').toUpperCase();
  var D = null, MAT = [], OBS = {}, actiu = null;

  fetch('/api/gestio-publics?quin=llibres').then(function (r) { return r.json(); }).then(function (d) {
    if (!d.ok) throw new Error();
    $('llCarregant').hidden = true; D = d;
    if (d.curs) $('llKicker').textContent = $('llKicker').textContent + ' · ' + d.curs;
    MAT = d.materies.filter(function (m) { return (!etapa || m.nivell.toUpperCase().indexOf(etapa) === 0) && m.items.length; });
    OBS = d.observacions || {};
    var ambObs = Object.keys(OBS).filter(function (n) { return OBS[n].length && (!etapa || n.toUpperCase().indexOf(etapa) === 0); });
    var nivells = MAT.map(function (m) { return m.nivell; }).concat(ambObs).filter(function (n, i, a) { return a.indexOf(n) === i; })
      .sort(function (a, b) { return (ORDRE.indexOf(a) + 1 || 99) - (ORDRE.indexOf(b) + 1 || 99) || a.localeCompare(b); });
    if (!nivells.length) { $('llContingut').innerHTML = '<p class="ll-msg">Encara no hi ha llibres publicats.</p>'; return; }
    nivells.forEach(function (n) { var a = document.createElement('a'); a.href = '#' + slug(n); a.className = 'll-tab'; a.textContent = nomNivell(n); a.dataset.n = n; $('llTabs').appendChild(a); });
    nivells.forEach(function (n) {
      var sec = document.createElement('section'); sec.className = 'll-nivell'; sec.id = slug(n); sec.dataset.n = n;
      var h = document.createElement('h2'); h.textContent = nomNivell(n); sec.appendChild(h);
      if ((OBS[n] || []).length) { var box = document.createElement('aside'); box.className = 'll-obs'; box.innerHTML = '<p class="ll-obs__t">Observacions</p><ul></ul>';
        OBS[n].forEach(function (t) { var li = document.createElement('li'); li.textContent = t; box.querySelector('ul').appendChild(li); }); sec.appendChild(box); }
      var nota = document.createElement('p'); nota.className = 'll-nota'; nota.innerHTML = '<span class="ll-nota__i" aria-hidden="true">i</span><span>Les matèries que <strong>no apareixen</strong> en aquesta llista <strong>no tenen llibres</strong>.</span>'; sec.appendChild(nota);
      agrupa(MAT.filter(function (m) { return m.nivell === n; })).forEach(function (g) {
        var hg = document.createElement('h3'); hg.className = 'll-grup'; hg.textContent = g.nom; sec.appendChild(hg);
        g.materies.forEach(function (m) { sec.appendChild(bloc(m)); });
      });
      $('llContingut').appendChild(sec);
    });
    [['Opció A · llibre no nou', d.opcio_A], ['Opció B · llibre nou', d.opcio_B]].forEach(function (x) { if (!x[1]) return; var dt = document.createElement('dt'); dt.textContent = x[0]; var dd = document.createElement('dd'); dd.textContent = x[1]; $('llOpcions').appendChild(dt); $('llOpcions').appendChild(dd); });
    var mostra = function () { var h = decodeURIComponent(location.hash.slice(1)); actiu = nivells.filter(function (n) { return slug(n) === h; })[0] || nivells[0];
      [].forEach.call(document.querySelectorAll('.ll-nivell'), function (s) { s.classList.toggle('is-active', s.dataset.n === actiu); });
      [].forEach.call(document.querySelectorAll('.ll-tab'), function (t) { t.classList.toggle('is-active', t.dataset.n === actiu); }); };
    window.addEventListener('hashchange', mostra); mostra();
    $('llDescarrega').disabled = false;
  }).catch(function () { $('llCarregant').textContent = 'Ara mateix no es poden mostrar els llibres. Torneu-ho a provar d’aquí a una estona.'; });

  function bloc(m) {
    var art = document.createElement('article'); art.className = 'll-mat';
    var h = document.createElement('h4'); h.textContent = m.materia; art.appendChild(h);
    var t = document.createElement('table'); t.className = 'll-taula';
    t.innerHTML = '<thead><tr><th>Tipus</th><th>Títol</th><th>Editorial</th><th>ISBN</th><th>Nou</th><th>Format</th><th>On comprar-lo</th></tr></thead><tbody></tbody>';
    m.items.slice().sort(ordItems).forEach(function (it) {
      var tr = document.createElement('tr');
      var cel = function (txt, lab, cls) { var td = document.createElement('td'); td.textContent = txt || '—'; td.dataset.label = lab; if (cls) td.className = cls; tr.appendChild(td); return td; };
      cel(TIPUS[it.tipus] || it.tipus, 'Tipus', 'll-tipus');
      var tdT = cel(it.titol, 'Títol', 'll-titolm'); if (it.observacions) { var s = document.createElement('small'); s.textContent = it.observacions; tdT.appendChild(s); }
      cel(it.editorial, 'Editorial'); cel(it.isbn, 'ISBN', 'll-isbn'); cel(sn(it.nou), 'Nou'); cel(FORMATS[it.format] || '', 'Format'); cel(it.on_comprar ? 'Opció ' + it.on_comprar : '', 'On comprar-lo');
      t.tBodies[0].appendChild(tr);
    });
    art.appendChild(t); return art;
  }

  // PDF del curs seleccionat (amb el logo del centre)
  var script = function (u) { return new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); };
  var logo = function () { return fetch('/assets/programacions/logo-ijm.png').then(function (r) { return r.blob(); }).then(function (b) { return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.readAsDataURL(b); }); }).catch(function () { return null; }); };
  $('llDescarrega').addEventListener('click', function () {
    if (!actiu) return; var b = this; b.disabled = true;
    (window.jspdf ? Promise.resolve() : script(LIBS[0]).then(function () { return script(LIBS[1]); })).then(logo).then(function (lg) { pdf(actiu, lg); })
      .catch(function () { alert('No s’ha pogut generar el PDF. Torneu-ho a provar.'); }).then(function () { b.disabled = false; });
  });
  function pdf(n, lg) {
    var net = function (t) { return String(t == null ? '' : t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/–|—/g, '-'); };
    var BLAU = [28, 12, 188], TARONJA = [232, 96, 12], GRIS = [107, 112, 128], TEXT = [30, 30, 42];
    var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14, curs = D.curs || '';
    if (lg) { try { doc.addImage(lg, 'PNG', M, 8, 40, 15.7); } catch (e) { /* sense logo */ } }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, GRIS);
    doc.text('Institut Joan Miró · Cornellà de Llobregat', W - M, 13, { align: 'right' }); doc.text('Descarregat el ' + new Date().toLocaleDateString('ca-ES'), W - M, 17.5, { align: 'right' });
    doc.setDrawColor.apply(doc, BLAU); doc.setLineWidth(0.5); doc.line(M, 28, W - M, 28);
    doc.setFontSize(8.5); doc.setTextColor.apply(doc, TARONJA); doc.setFont('helvetica', 'bold'); doc.text(net('LLIBRES DE TEXT, LECTURES I MATERIALS' + (curs ? ' · CURS ' + curs : '')), M, 36);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(20); doc.setTextColor.apply(doc, BLAU); doc.text(net(nomNivell(n)), M, 45);
    var y = 51, obs = OBS[n] || [];
    if (obs.length) { doc.autoTable({ startY: y, body: [[{ content: 'OBSERVACIONS', styles: { textColor: TARONJA, fontStyle: 'bold', fontSize: 8 } }]].concat(obs.map(function (t) { return [{ content: '•  ' + net(t) }]; })),
      margin: { left: M, right: M }, theme: 'plain', styles: { font: 'helvetica', fontSize: 9, textColor: TEXT, cellPadding: { top: 1, bottom: 1, left: 4, right: 4 }, fillColor: [255, 248, 242] } }); y = doc.lastAutoTable.finalY + 5; }
    doc.setFontSize(10); doc.setTextColor.apply(doc, BLAU); doc.text(net('Les matèries que no apareixen en aquesta llista no tenen llibres.'), M, y + 4); y += 9;
    var body = [];
    agrupa(MAT.filter(function (m) { return m.nivell === n; })).forEach(function (g) {
      body.push([{ content: net(g.nom.toUpperCase()), colSpan: 9, styles: { fillColor: 255, textColor: TARONJA, fontStyle: 'bold', fontSize: 7.5 } }]);
      g.materies.forEach(function (m) { var it = m.items.slice().sort(ordItems); it.forEach(function (x, i) { body.push([i === 0 ? { content: net(m.materia), rowSpan: it.length, styles: { fontStyle: 'bold' } } : null,
        TIPUS[x.tipus] || x.tipus, net(x.titol), net(x.editorial), String(x.isbn || ''), sn(x.nou) || '-', FORMATS[x.format] || '-', x.on_comprar ? 'Opció ' + x.on_comprar : '-', net(x.observacions)].filter(function (c) { return c !== null; })); }); });
    });
    if (body.length) { doc.autoTable({ startY: y, head: [['Matèria', 'Tipus', 'Títol', 'Editorial', 'ISBN', 'Nou', 'Format', 'Compra', 'Observacions']], body: body, margin: { left: M, right: M, bottom: 16 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: TEXT, lineColor: [222, 226, 236], lineWidth: 0.2, valign: 'top' }, headStyles: { fillColor: [60, 52, 140], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 24 }, 2: { cellWidth: 54 }, 3: { cellWidth: 30 }, 4: { cellWidth: 28 }, 5: { cellWidth: 10 }, 6: { cellWidth: 22 }, 7: { cellWidth: 16 } } }); y = doc.lastAutoTable.finalY + 7; }
    if (y > H - 40) { doc.addPage(); y = 20; }
    doc.setFontSize(8.5);
    [['Nou', 'El llibre és nou respecte al curs anterior.'], ['Format', 'Paper, Digital o Paper+Digital.'], ['Opció A (llibre no nou)', D.opcio_A], ['Opció B (llibre nou)', D.opcio_B]].forEach(function (x) {
      if (!x[1]) return; doc.setTextColor.apply(doc, TARONJA); doc.setFont('helvetica', 'bold'); doc.text(net(x[0] + ':'), M, y);
      doc.setTextColor.apply(doc, TEXT); doc.setFont('helvetica', 'normal'); var l = doc.splitTextToSize(net(x[1]), W - 2 * M - 42); doc.text(l, M + 42, y); y += 4.5 * l.length + 1.5; });
    var tot = doc.getNumberOfPages();
    for (var i = 1; i <= tot; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS); doc.text(net('Llibres de text · ' + nomNivell(n) + (curs ? ' · ' + curs : '') + ' · Institut Joan Miró'), M, H - 8); doc.text('Pàgina ' + i + ' de ' + tot, W - M, H - 8, { align: 'right' }); }
    doc.save(('llibres-' + nomNivell(n) + (curs ? '-' + curs : '') + '.pdf').replace(/\s+/g, '-').replace(/[^a-z0-9.\-]/gi, '_'));
  }
})();
