// PAS 75 · El Nostre Centre › Departaments i àmbits: dades publicades des de GESTIO › Departaments/àmbits (botó «Publica»).
// Si encara no s'ha publicat res, la llista és buida i ni la pàgina índex ni l'enllaç del menú hi surten.
const publicat = require("../../lib/departaments-publicat.js").llegeix();

const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Format bàsic de la presentació: paràgrafs (línia en blanc), **negreta**, *cursiva* i [text](https://…)
const md = (t) => String(t || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => "<p>" + esc(p)
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, a, u) => '<a href="' + u + '" target="_blank" rel="noopener">' + a + "</a>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\n/g, "<br>") + "</p>").join("");
const url = (u) => (/^https?:\/\/[^\s<>"]+$/i.test(String(u || "")) ? String(u) : "");
const neta = (ll, camps) => (Array.isArray(ll) ? ll : []).map((x) => { const o = {}; camps.forEach((k) => { o[k] = k === "enllac" ? url(x && x[k]) : String((x && x[k]) || ""); }); return o; }).filter((o) => o.titol || o.text || o.enllac);
// Criteris de qualificació (/api/criteris-publics): «1r ESO» → «ESO 1r»
const NIV = { "1r ESO": "ESO 1r", "2n ESO": "ESO 2n", "3r ESO": "ESO 3r", "4t ESO": "ESO 4t", "1r BAT": "BAT 1r", "2n BAT": "BAT 2n" };

const llista = ((publicat && publicat.departaments) || []).map((d) => {
  const perNivell = [];
  (d.materies || []).forEach((m) => { let g = perNivell.find((x) => x.nivell === m.nivell); if (!g) { g = { nivell: m.nivell, materies: [] }; perNivell.push(g); } g.materies.push(m); });
  return {
    slug: d.slug, nom: d.nom, especialitats: d.especialitats || [],
    presentacio: md(d.presentacio), resum: String(d.presentacio || "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_]/g, "").split(/\n\s*\n/)[0].slice(0, 220),
    imatge: d.te_imatge ? "/assets/img/departaments/" + d.slug + ".jpg" : "", peu_imatge: d.peu_imatge || "",
    professorat: d.professorat || [], perNivell,
    criteris: (d.nivells || []).filter((n) => NIV[n]).map((n) => ({ nivell: n, api: NIV[n], materies: (d.materies || []).filter((m) => m.nivell === n).map((m) => m.materia) })),
    projectes: neta(d.projectes, ["titol", "text", "enllac", "curs"]),
    feines_estiu: neta(d.feines_estiu, ["nivell", "titol", "text", "enllac"]),
    altres: neta(d.altres, ["titol", "text", "enllac"]),
  };
}).sort((a, b) => a.nom.localeCompare(b.nom, "ca"));

// Textos de les pàgines en ca/es/en (el contingut que escriuen els caps i les matèries es mostren tal com són, en català)
const text = {
  ca: { kicker: "El Nostre Centre", titol: "Departaments i àmbits", lead: "Cada departament i àmbit presenta el seu professorat, les matèries que imparteix, els criteris de qualificació, els projectes i les feines d’estiu.", properament: "Properament.", nomesCa: "", molla: "Molla de pa",
    presentacio: "Presentació", professorat: "Professorat", programacions: "Programacions", progProperament: "Properament es podran consultar aquí les programacions de les matèries del departament.", criteris: "Criteris de qualificació", criterisText: "PDF amb els criteris de qualificació publicats de les matèries del departament, per nivell:", materies: "Matèries i professorat", nivell: "Nivell", materia: "Matèria", projectes: "Projectes", estiu: "Feines d’estiu", altres: "Altres",
    js: { generant: "Generant el PDF dels criteris de qualificació…", senseCriteris: "Encara no s’han publicat els criteris de qualificació de les matèries d’aquest departament per a", error: "No s’ha pogut generar el PDF. Torneu-ho a provar d’aquí a una estona." } },
  es: { kicker: "Nuestro Centro", titol: "Departamentos y ámbitos", lead: "Cada departamento y ámbito presenta su profesorado, las materias que imparte, los criterios de calificación, los proyectos y los trabajos de verano.", properament: "Próximamente.", nomesCa: "El contenido de los departamentos está en catalán.", molla: "Ruta de navegación",
    presentacio: "Presentación", professorat: "Profesorado", programacions: "Programaciones", progProperament: "Próximamente se podrán consultar aquí las programaciones de las materias del departamento.", criteris: "Criterios de calificación", criterisText: "PDF con los criterios de calificación publicados de las materias del departamento, por nivel:", materies: "Materias y profesorado", nivell: "Nivel", materia: "Materia", projectes: "Proyectos", estiu: "Trabajos de verano", altres: "Otros",
    js: { generant: "Generando el PDF de los criterios de calificación…", senseCriteris: "Todavía no se han publicado los criterios de calificación de las materias de este departamento para", error: "No se ha podido generar el PDF. Vuelva a intentarlo dentro de un rato." } },
  en: { kicker: "Our School", titol: "Departments", lead: "Each department presents its teaching staff, the subjects it teaches, the grading criteria, its projects and the summer work.", properament: "Coming soon.", nomesCa: "Department content is in Catalan.", molla: "Breadcrumb",
    presentacio: "Introduction", professorat: "Teaching staff", programacions: "Syllabuses", progProperament: "The syllabuses of the department’s subjects will soon be available here.", criteris: "Grading criteria", criterisText: "PDF with the published grading criteria of the department’s subjects, by level:", materies: "Subjects and teaching staff", nivell: "Level", materia: "Subject", projectes: "Projects", estiu: "Summer work", altres: "Other",
    js: { generant: "Generating the grading criteria PDF…", senseCriteris: "The grading criteria of this department’s subjects have not been published yet for", error: "The PDF could not be generated. Please try again later." } },
};

module.exports = { text, llista, publicat: publicat ? publicat.publicat : null };
