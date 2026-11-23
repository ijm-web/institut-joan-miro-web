// PAS 75 · Abans de construir el web es descarreguen els departaments/àmbits publicats des de GESTIO › Departaments/àmbits
// (botó «Publica») a .cache/departaments-publicat.json i les imatges a .cache/departaments-img/<slug>.jpg (es copien a
// /assets/img/departaments/). src/_data/departaments.js els llegeix; si no n'hi ha (sense connexió, sense les variables
// GESTIO_SCRIPT_URL / GESTIO_SCRIPT_SECRET o encara no publicat), l'apartat no surt al web.
const fs = require("fs");
const path = require("path");

const CACHE = path.join(__dirname, "..", ".cache");
const FITXER = path.join(CACHE, "departaments-publicat.json");
const IMATGES = path.join(CACHE, "departaments-img");

const valid = (c) => c && Array.isArray(c.departaments) && c.departaments.every((d) => d && /^[a-z0-9-]+$/.test(d.slug || "") && typeof d.nom === "string");

async function descarrega() {
  fs.mkdirSync(IMATGES, { recursive: true });
  const url = process.env.GESTIO_SCRIPT_URL, secret = process.env.GESTIO_SCRIPT_SECRET;
  if (!url || !secret) return;
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ secret, action: "publics", quin: "departaments" }), redirect: "follow", signal: ctl.signal });
    const text = await r.text();   // PAS 80b: el temps màxim també cobreix la lectura de la resposta
    clearTimeout(t);
    const c = JSON.parse(text);
    if (!c.ok || !valid(c)) { console.log("[departaments] GESTIO: " + (c.error || "dades no vàlides") + " · l'apartat no es publica"); return; }
    for (const [slug, b64] of Object.entries(c.imatges || {})) {
      if (/^[a-z0-9-]+$/.test(slug) && typeof b64 === "string") fs.writeFileSync(path.join(IMATGES, slug + ".jpg"), Buffer.from(b64, "base64"));
    }
    delete c.imatges;
    fs.writeFileSync(FITXER, JSON.stringify(c));
    console.log("[departaments] " + c.departaments.length + " departaments/àmbits publicats" + (c.publicat ? " el " + c.publicat.data : ""));
  } catch (e) {
    console.log("[departaments] No s'ha pogut descarregar de GESTIO (" + e.message + ")");
  }
}

function llegeix() {
  try { const c = JSON.parse(fs.readFileSync(FITXER, "utf8")); return valid(c) ? c : null; } catch (e) { return null; }
}

module.exports = { descarrega, llegeix, FITXER, IMATGES };
