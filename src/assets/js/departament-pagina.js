// PAS 76 · Pàgina d'un departament/àmbit (El Nostre Centre › Departaments i àmbits), compartida pel build del web
// (src/_data/departaments.js) i per la «Vista prèvia» de GESTIO › Departaments/àmbits: totes dues fan servir aquest mateix
// codi, de manera que la vista prèvia és igual que la pàgina publicada. Disseny com el de Projectes › Llengües estrangeres:
// capçalera amb imatge, introducció, xifres i seccions numerades (títol a l'esquerra, contingut a la dreta).
// Del professorat, només el nom complet; cap dada d'alumnat. Els enllaços externs s'obren en una pestanya nova.
(function (arrel, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else arrel.DepartamentPagina = fab();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var url = function (u) { return /^https?:\/\/[^\s<>"]+$/i.test(String(u || "")) ? String(u) : ""; };

  // Format bàsic (com el Markdown): paràgrafs separats per una línia en blanc, **negreta**, *cursiva*, [text](https://…),
  // llistes de pics (línies que comencen per «- » o «* ») i llistes numerades («1. », «2. »…)
  var enLinia = function (t) {
    return esc(t).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (m, a, u) { return '<a href="' + u.replace(/"/g, "&quot;") + '" target="_blank" rel="noopener">' + a + "</a>"; })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  };
  function md(t) {
    var o = [], par = [], llista = null;
    var tancaPar = function () { if (par.length) { o.push("<p>" + par.map(enLinia).join("<br>") + "</p>"); par = []; } };
    var tancaLl = function () { if (llista) { o.push("<" + llista.t + ">" + llista.ll.map(function (x) { return "<li>" + enLinia(x) + "</li>"; }).join("") + "</" + llista.t + ">"); llista = null; } };
    String(t || "").replace(/\r/g, "").split("\n").forEach(function (l) {
      var s = l.trim(), pic = /^[-*•]\s+(.+)$/.exec(s), num = /^\d+[.)]\s+(.+)$/.exec(s);
      if (!s) { tancaPar(); tancaLl(); return; }
      if (pic || num) { tancaPar(); var tt = pic ? "ul" : "ol"; if (llista && llista.t !== tt) tancaLl(); if (!llista) llista = { t: tt, ll: [] }; llista.ll.push((pic || num)[1]); return; }
      if (llista) { tancaLl(); }
      par.push(s);
    });
    tancaPar(); tancaLl();
    return o.join("");
  }
  // Primer paràgraf, sense format (resum de la targeta)
  var resum = function (t) { var p = String(t || "").replace(/\r/g, "").split(/\n\s*\n/)[0] || ""; return p.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_]/g, "").replace(/^\s*([-•]|\d+[.)])\s+/gm, "").replace(/\s+/g, " ").trim(); };
  var neta = function (ll, camps) { return (Array.isArray(ll) ? ll : []).map(function (x) { var o = {}; camps.forEach(function (k) { o[k] = k === "enllac" ? url(x && x[k]) : String((x && x[k]) || ""); }); return o; }).filter(function (o) { return o.titol || o.text || o.enllac; }); };
  // Criteris de qualificació (/api/criteris-publics): «1r ESO» → «ESO 1r»
  var NIV = { "1r ESO": "ESO 1r", "2n ESO": "ESO 2n", "3r ESO": "ESO 3r", "4t ESO": "ESO 4t", "1r BAT": "BAT 1r", "2n BAT": "BAT 2n" };

  var TEXT = {
    ca: { kicker: "El Nostre Centre", titol: "Departaments i àmbits", lead: "Cada departament i àmbit presenta el seu professorat, les matèries que imparteix, els criteris de qualificació, els projectes i les feines d’estiu.", properament: "Properament.", nomesCa: "", molla: "Molla de pa", veure: "Veure la pàgina",
      presentacio: "Presentació", professorat: "Professorat", programacions: "Programacions", progProperament: "Properament es podran consultar aquí les programacions de les matèries del departament.", criteris: "Criteris de qualificació", criterisText: "PDF amb els criteris de qualificació publicats de les matèries del departament, per nivell:", materies: "Matèries i professorat", nivell: "Nivell", materia: "Matèria", projectes: "Projectes", estiu: "Feines d’estiu", altres: "Altres",
      xDocents: "docents", xMateries: "matèries", xNivells: "nivells", xProjectes: "projectes", h: "h",
      js: { generant: "Generant el PDF dels criteris de qualificació…", senseCriteris: "Encara no s’han publicat els criteris de qualificació de les matèries d’aquest departament per a", error: "No s’ha pogut generar el PDF. Torneu-ho a provar d’aquí a una estona." } },
    es: { kicker: "Nuestro Centro", titol: "Departamentos y ámbitos", lead: "Cada departamento y ámbito presenta su profesorado, las materias que imparte, los criterios de calificación, los proyectos y los trabajos de verano.", properament: "Próximamente.", nomesCa: "El contenido de los departamentos está en catalán.", molla: "Ruta de navegación", veure: "Ver la página",
      presentacio: "Presentación", professorat: "Profesorado", programacions: "Programaciones", progProperament: "Próximamente se podrán consultar aquí las programaciones de las materias del departamento.", criteris: "Criterios de calificación", criterisText: "PDF con los criterios de calificación publicados de las materias del departamento, por nivel:", materies: "Materias y profesorado", nivell: "Nivel", materia: "Materia", projectes: "Proyectos", estiu: "Trabajos de verano", altres: "Otros",
      xDocents: "docentes", xMateries: "materias", xNivells: "niveles", xProjectes: "proyectos", h: "h",
      js: { generant: "Generando el PDF de los criterios de calificación…", senseCriteris: "Todavía no se han publicado los criterios de calificación de las materias de este departamento para", error: "No se ha podido generar el PDF. Vuelva a intentarlo dentro de un rato." } },
    en: { kicker: "Our School", titol: "Departments", lead: "Each department presents its teaching staff, the subjects it teaches, the grading criteria, its projects and the summer work.", properament: "Coming soon.", nomesCa: "Department content is in Catalan.", molla: "Breadcrumb", veure: "See the page",
      presentacio: "Introduction", professorat: "Teaching staff", programacions: "Syllabuses", progProperament: "The syllabuses of the department’s subjects will soon be available here.", criteris: "Grading criteria", criterisText: "PDF with the published grading criteria of the department’s subjects, by level:", materies: "Subjects and teaching staff", nivell: "Level", materia: "Subject", projectes: "Projects", estiu: "Summer work", altres: "Other",
      xDocents: "teachers", xMateries: "subjects", xNivells: "levels", xProjectes: "projects", h: "h",
      js: { generant: "Generating the grading criteria PDF…", senseCriteris: "The grading criteria of this department’s subjects have not been published yet for", error: "The PDF could not be generated. Please try again later." } }
  };

  // Dades netes d'un departament (tal com les publica GESTIO, o les de l'editor per a la vista prèvia)
  function prepara(d) {
    var perNivell = [];
    (d.materies || []).forEach(function (m) { var g = perNivell.filter(function (x) { return x.nivell === m.nivell; })[0]; if (!g) { g = { nivell: m.nivell, materies: [] }; perNivell.push(g); } g.materies.push(m); });
    return {
      slug: d.slug, nom: String(d.nom || ""), especialitats: d.especialitats || [], presentacio: String(d.presentacio || ""), resum: resum(d.presentacio),
      imatge: d.imatge || "", peu_imatge: String(d.peu_imatge || ""), professorat: d.professorat || [], perNivell: perNivell, nMateries: (d.materies || []).length,
      criteris: (d.nivells || []).filter(function (n) { return NIV[n]; }).map(function (n) { return { nivell: n, api: NIV[n], materies: (d.materies || []).filter(function (m) { return m.nivell === n; }).map(function (m) { return m.materia; }) }; }),
      projectes: neta(d.projectes, ["titol", "text", "enllac", "curs"]), feines_estiu: neta(d.feines_estiu, ["nivell", "titol", "text", "enllac"]), altres: neta(d.altres, ["titol", "text", "enllac"])
    };
  }

  var HERO = '<img src="/assets/img/inici/inici-1-facana-2400.jpg" srcset="/assets/img/inici/inici-1-facana-1600.jpg 1600w, /assets/img/inici/inici-1-facana-2400.jpg 2400w" sizes="100vw" width="2400" height="900" alt="" role="presentation">';
  function hero(titol, sub) { return '<div class="qs-hero dp-hero">' + HERO + '<div class="qs-hero__box"><h1><span class="qs-hero__title">' + esc(titol) + '</span><span class="qs-hero__subtitle">' + esc(sub) + "</span></h1></div></div>"; }

  // Pàgina d'un departament: {hero, cos}
  function pagina(d0, lang, pref) {
    var L = TEXT[lang] || TEXT.ca, d = d0.perNivell ? d0 : prepara(d0), n = 0, o = [];
    var sec = function (id, titol, cos) { n++; return '<section class="dp-section" aria-labelledby="dp-' + id + '"><header class="dp-section__head dp-reveal"><span class="dp-section__num">' + (n < 10 ? "0" : "") + n + '</span><h2 id="dp-' + id + '">' + esc(titol) + '</h2></header><div class="dp-section__body dp-reveal">' + cos + "</div></section>"; };
    var llista = function (items) {
      return '<ul class="dp-cards">' + items.map(function (x) {
        return '<li class="dp-card">' + (x.nivell ? '<span class="dp-card__tag">' + esc(x.nivell) + "</span>" : "") + (x.curs ? '<span class="dp-card__tag dp-card__tag--gris">' + esc(x.curs) + "</span>" : "") +
          '<h3 class="dp-card__tit">' + (x.enllac ? '<a href="' + esc(x.enllac) + '" target="_blank" rel="noopener">' + esc(x.titol || x.enllac) + ' <span aria-hidden="true">↗</span></a>' : esc(x.titol)) + "</h3>" + (x.text ? "<p>" + esc(x.text) + "</p>" : "") + "</li>";
      }).join("") + "</ul>";
    };
    // Introducció: el primer paràgraf de la presentació (la resta, a la secció «Presentació»)
    var parts = d.presentacio.replace(/\r/g, "").split(/\n\s*\n/), primer = parts[0] || "", resta = parts.slice(1).join("\n\n");
    var esPrimerText = primer && !/^\s*([-*•]|\d+[.)])\s+/.test(primer);
    o.push('<div class="dp-intro dp-reveal"><p class="dp-kicker">' + esc(d.especialitats.join(" · ")) + "</p>" + (esPrimerText ? '<div class="dp-lead">' + md(primer) + "</div>" : "") + (L.nomesCa ? '<p class="dp-gris">' + esc(L.nomesCa) + "</p>" : "") + "</div>");
    var nNiv = d.perNivell.length, xs = [[d.professorat.length, L.xDocents], [d.nMateries, L.xMateries], [nNiv, L.xNivells], [d.projectes.length, L.xProjectes]].filter(function (x) { return x[0]; });
    if (xs.length) o.push('<ul class="dp-stats dp-reveal">' + xs.map(function (x) { return '<li><span class="dp-stats__num">' + x[0] + '</span><span class="dp-stats__label">' + esc(x[1]) + "</span></li>"; }).join("") + "</ul>");
    var cosPres = (esPrimerText ? md(resta) : md(d.presentacio));
    if (cosPres || d.imatge) o.push(sec("pres", L.presentacio, (d.imatge ? '<figure class="dp-figura"><img src="' + esc(d.imatge) + '" alt="' + esc(d.peu_imatge || d.nom) + '" loading="lazy">' + (d.peu_imatge ? "<figcaption>" + esc(d.peu_imatge) + "</figcaption>" : "") + "</figure>" : "") + '<div class="dp-text">' + cosPres + "</div>"));
    if (d.professorat.length) o.push(sec("prof", L.professorat, '<ul class="dp-tags">' + d.professorat.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>"));
    o.push(sec("prog", L.programacions, '<p class="dp-gris">' + esc(L.progProperament) + "</p>"));
    if (d.criteris.length) o.push(sec("crit", L.criteris, "<p>" + esc(L.criterisText) + '</p><p class="dp-botons">' + d.criteris.map(function (c) { return '<a class="dp-boto" href="#dp-crit" data-criteris-dep="' + esc(c.api) + '" data-nom="' + esc(c.nivell) + '" data-materies="' + esc(JSON.stringify(c.materies)) + '"><span aria-hidden="true">⬇</span> ' + esc(c.nivell) + "</a>"; }).join("") + "</p>"));
    if (d.perNivell.length) o.push(sec("mat", L.materies, '<div class="dp-nivells">' + d.perNivell.map(function (g) {
      return '<div class="dp-nivell"><h3 class="dp-nivell__tit">' + esc(g.nivell) + '</h3><ul class="dp-mats">' + g.materies.map(function (m) {
        return '<li><span class="dp-mats__nom">' + esc(m.materia) + (m.hores ? ' <small>' + esc(String(m.hores).replace(".", ",")) + " " + L.h + "</small>" : "") + '</span><span class="dp-mats__prof">' + (m.docents || []).map(function (x) { return esc(x.nom) + ((x.grups || []).length ? " <small>(" + esc(x.grups.join(", ")) + ")</small>" : ""); }).join("<br>") + "</span></li>";
      }).join("") + "</ul></div>";
    }).join("") + "</div>"));
    if (d.projectes.length) o.push(sec("proj", L.projectes, llista(d.projectes)));
    if (d.feines_estiu.length) o.push(sec("estiu", L.estiu, llista(d.feines_estiu)));
    if (d.altres.length) o.push(sec("altres", L.altres, llista(d.altres)));
    var molla = '<nav class="dp-molla" aria-label="' + esc(L.molla) + '"><a href="' + (pref || "") + '/departaments-i-ambits.html">' + esc(L.titol) + '</a> <span aria-hidden="true">›</span> ' + esc(d.nom) + "</nav>";
    return { hero: hero(L.titol, d.nom), cos: '<div class="dp-wrap">' + molla + o.join("") + "</div>" };
  }

  // Pàgina índex: una targeta per departament/àmbit
  function index(llista, lang, pref) {
    var L = TEXT[lang] || TEXT.ca;
    var cos = '<div class="dp-wrap"><div class="dp-intro dp-reveal"><p class="dp-kicker">' + esc(L.kicker) + '</p><p class="dp-lead">' + esc(L.lead) + "</p>" + (L.nomesCa ? '<p class="dp-gris">' + esc(L.nomesCa) + "</p>" : "") + "</div>" +
      (llista.length ? '<ul class="dp-targetes">' + llista.map(function (d0, i) {
        var d = d0.perNivell ? d0 : prepara(d0);
        return '<li class="dp-reveal"><a class="dp-targeta" href="' + (pref || "") + "/departaments/" + esc(d.slug) + '.html"><span class="dp-targeta__img">' + (d.imatge ? '<img src="' + esc(d.imatge) + '" alt="" loading="lazy" width="480" height="270">' : '<span class="dp-targeta__inicial" aria-hidden="true">' + esc(d.nom.charAt(0)) + "</span>") + '</span><span class="dp-targeta__num">' + (i < 9 ? "0" : "") + (i + 1) + '</span><span class="dp-targeta__nom">' + esc(d.nom) + '</span><span class="dp-targeta__esp">' + esc(d.especialitats.join(" · ")) + "</span>" +
          (d.resum ? '<span class="dp-targeta__resum">' + esc(d.resum.length > 220 ? d.resum.slice(0, 219) + "…" : d.resum) + "</span>" : "") + '<span class="dp-targeta__veure">' + esc(L.veure) + ' <span aria-hidden="true">→</span></span></a></li>';
      }).join("") + "</ul>" : '<p class="dp-gris">' + esc(L.properament) + "</p>") + "</div>";
    return { hero: hero(L.kicker, L.titol), cos: cos };
  }

  return { md: md, resum: resum, prepara: prepara, pagina: pagina, index: index, TEXT: TEXT, esc: esc };
});
