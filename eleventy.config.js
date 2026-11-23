module.exports = async function (eleventyConfig) {
  // PAS 80b: les descàrregues de GESTIO tenen un temps màxim total. Si l'Apps Script no respon, el web es construeix
  // igualment (amb el que hi hagi a .cache) i el servidor local (netlify dev) arrenca sense quedar-se esperant.
  const ambLimit = (nom, fn, ms) => {
    let t;
    const limit = new Promise((ok) => { t = setTimeout(() => { console.log("[" + nom + "] GESTIO no ha respost en " + ms / 1000 + " s · es continua sense esperar"); ok(); }, ms); });
    return Promise.race([Promise.resolve().then(fn), limit]).finally(() => clearTimeout(t));
  };
  // PAS 56: calendari publicat des de GESTIO (si n'hi ha), abans de llegir src/_data/calendari.js
  await ambLimit("calendari", () => require("./lib/calendari-publicat.js").descarrega(), 20000);
  // PAS 75: departaments/àmbits publicats des de GESTIO (i les seves imatges)
  await ambLimit("departaments", () => require("./lib/departaments-publicat.js").descarrega(), 40000);

  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ ".cache/departaments-img": "assets/img/departaments" });   // PAS 75
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });   // PAS 31: icona del web (motiu Miró: punt verd i estrella)
  // PAS 72 · PWA: manifest i service worker (a l'arrel, perquè el seu abast sigui tot el web)
  eleventyConfig.addPassthroughCopy({ "src/manifest.webmanifest": "manifest.webmanifest", "src/sw.js": "sw.js" });

  // Filtres per a les dades de src/_data/centre.json
  const conj = { ca: " i ", es: " y ", en: " and " };
  eleventyConfig.addFilter("llistaNoms", (noms, lang) =>
    noms.length < 2 ? noms.join("") : noms.slice(0, -1).join(", ") + (conj[lang] || conj.ca) + noms[noms.length - 1]);
  eleventyConfig.addFilter("majuscula", (s) => s.charAt(0).toUpperCase() + s.slice(1));
  eleventyConfig.addFilter("dataISO", (d) => { try { return new Date(d).toISOString().slice(0, 10); } catch (e) { return ""; } });   // PAS 48: sitemap.xml
  eleventyConfig.addFilter("minuscula", (s) => s.charAt(0).toLowerCase() + s.slice(1));

  // Any del copyright del peu: s'actualitza sol en cada build
  eleventyConfig.addGlobalData("anyActual", () => new Date().getFullYear());

  // PDF del calendari escolar (ca/es/en), generat a partir de src/_data/calendari.js
  eleventyConfig.on("eleventy.after", ({ dir }) => {
    require("./lib/calendari-pdf.js")(dir.output);
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site",
    },
    // Els fitxers .html de "src" es tracten com a contingut pla (només
    // s'hi llegeix el "front matter" per triar la plantilla/base.njk),
    // sense passar-los pel motor de plantilles Nunjucks. Això evita
    // qualsevol conflicte si algun dia el codi CSS/JS d'una pàgina conté
    // caràcters { } que Nunjucks podria intentar interpretar.
    htmlTemplateEngine: false,
  };
};