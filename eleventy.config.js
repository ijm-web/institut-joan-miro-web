module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");

  // Filtres per a les dades de src/_data/centre.json
  const conj = { ca: " i ", es: " y ", en: " and " };
  eleventyConfig.addFilter("llistaNoms", (noms, lang) =>
    noms.length < 2 ? noms.join("") : noms.slice(0, -1).join(", ") + (conj[lang] || conj.ca) + noms[noms.length - 1]);
  eleventyConfig.addFilter("majuscula", (s) => s.charAt(0).toUpperCase() + s.slice(1));
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