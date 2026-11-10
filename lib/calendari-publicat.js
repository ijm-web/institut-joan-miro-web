// PAS 56 · Abans de construir el web es descarrega el calendari publicat des de GESTIO › Calendari (botó «Publica»)
// a .cache/calendari-publicat.json. src/_data/calendari.js el llegeix si hi és; si no (sense connexió, sense variables
// GESTIO_SCRIPT_URL / GESTIO_SCRIPT_SECRET o encara no publicat), el web es construeix amb les dades de calendari.js.
const fs = require("fs");
const path = require("path");

const FITXER = path.join(__dirname, "..", ".cache", "calendari-publicat.json");

// Comprova que el calendari té la forma que espera calendari.js
function valid(c) {
  const mes = (x) => x && Number.isInteger(x.any) && x.mes >= 1 && x.mes <= 12;
  return c && /^\d{4}-\d{4}$/.test(c.curs || "") && mes(c.inici) && mes(c.final) && Array.isArray(c.dates) &&
    c.dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.des) && typeof d.tipus === "string") && Array.isArray(c.esdeveniments || []);
}

async function descarrega() {
  const url = process.env.GESTIO_SCRIPT_URL, secret = process.env.GESTIO_SCRIPT_SECRET;
  if (!url || !secret) return;
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ secret, action: "publics", quin: "calendari" }), redirect: "follow", signal: ctl.signal });
    clearTimeout(t);
    const c = JSON.parse(await r.text());
    if (!c.ok || !valid(c)) { console.log("[calendari] GESTIO: " + (c.error || "dades no vàlides") + " · es fan servir les dades de calendari.js"); return; }
    fs.mkdirSync(path.dirname(FITXER), { recursive: true });
    fs.writeFileSync(FITXER, JSON.stringify(c));
    console.log("[calendari] Calendari publicat el " + c.publicat + " (" + c.esdeveniments.length + " esdeveniments)");
  } catch (e) {
    console.log("[calendari] No s'ha pogut descarregar de GESTIO (" + e.message + ") · es fan servir les dades de calendari.js");
  }
}

function llegeix() {
  try { const c = JSON.parse(fs.readFileSync(FITXER, "utf8")); return valid(c) ? c : null; } catch (e) { return null; }
}

module.exports = { descarrega, llegeix, valid, FITXER };
