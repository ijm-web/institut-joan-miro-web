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

module.exports = { llista, publicat: publicat ? publicat.publicat : null };
