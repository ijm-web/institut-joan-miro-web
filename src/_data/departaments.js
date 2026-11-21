// PAS 75/76 · El Nostre Centre › Departaments i àmbits: dades publicades des de GESTIO › Departaments/àmbits (botó «Publica»,
// només les pàgines tancades). Si encara no s'ha publicat res, la llista és buida i ni la pàgina índex ni l'enllaç del menú
// hi surten. PAS 76: l'HTML el fa src/assets/js/departament-pagina.js, el mateix que la «Vista prèvia» de GESTIO.
const P = require("../assets/js/departament-pagina.js");
const publicat = require("../../lib/departaments-publicat.js").llegeix();

const pref = (lang) => (lang === "ca" ? "" : "/" + lang);
const llista = ((publicat && publicat.departaments) || []).map((d0) => {
  const d = P.prepara(Object.assign({}, d0, { imatge: d0.te_imatge ? "/assets/img/departaments/" + d0.slug + ".jpg" : "" }));
  const html = {};
  ["ca", "es", "en"].forEach((l) => { html[l] = P.pagina(d, l, pref(l)); });
  return Object.assign(d, { html });
}).sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
const index = {};
["ca", "es", "en"].forEach((l) => { index[l] = P.index(llista, l, pref(l)); });

module.exports = { text: P.TEXT, llista, index, publicat: publicat ? publicat.publicat : null };
