// ============ CALENDARI ESCOLAR ============
// Dades de la pàgina Secretaria › Calendari escolar (ca/es/en).
// Per actualitzar-lo cada curs només cal canviar `curs`, `inici`, `final` i la llista `dates`.
// Els dies de cada mes es calculen automàticament (no cal copiar la graella del full de càlcul).
// Font 2026-2027: Calendari_26-27.xlsx, pestanya «Complet».

const curs = "2026-2027";
const inici = { any: 2026, mes: 9 };   // primer mes que es mostra
const final = { any: 2027, mes: 6 };   // darrer mes que es mostra

// tipus: inici | darrer | darrerBat | festiu | local | lliure | vacances
const dates = [
  { des: "2026-09-08", tipus: "inici" },
  { des: "2026-09-11", tipus: "festiu", nom: { ca: "Diada Nacional de Catalunya", es: "Diada Nacional de Cataluña", en: "Catalonia National Day" } },
  { des: "2026-10-09", tipus: "lliure" },
  { des: "2026-10-12", tipus: "festiu", nom: { ca: "Festa Nacional d’Espanya", es: "Fiesta Nacional de España", en: "Spanish National Day" } },
  { des: "2026-12-07", tipus: "lliure" },
  { des: "2026-12-08", tipus: "festiu", nom: { ca: "La Immaculada", es: "La Inmaculada", en: "Immaculate Conception" } },
  { des: "2026-12-22", fins: "2027-01-07", tipus: "vacances", nom: { ca: "Vacances de Nadal", es: "Vacaciones de Navidad", en: "Christmas holidays" } },
  { des: "2027-03-20", fins: "2027-03-29", tipus: "vacances", nom: { ca: "Vacances de Setmana Santa", es: "Vacaciones de Semana Santa", en: "Easter holidays" } },
  { des: "2027-05-01", tipus: "festiu", nom: { ca: "Festa del Treball", es: "Fiesta del Trabajo", en: "Labour Day" } },
  { des: "2027-05-17", tipus: "local" },
  { des: "2027-05-27", tipus: "lliure" },
  { des: "2027-05-28", tipus: "local" },
  { des: "2027-06-17", tipus: "darrerBat" },
  { des: "2027-06-21", tipus: "darrer" }
];

const tipusText = {
  inici:     { ca: "Inici de classes ESO i Batxillerat", es: "Inicio de clases ESO y Bachillerato", en: "First day of classes (ESO and Batxillerat)" },
  darrer:    { ca: "Darrer dia de classe d’ESO", es: "Último día de clase de ESO", en: "Last day of classes (ESO)" },
  darrerBat: { ca: "Darrer dia de classe de 1r de Batxillerat", es: "Último día de clase de 1.º de Bachillerato", en: "Last day of classes (1st Batxillerat)" },
  festiu:    { ca: "Festiu", es: "Festivo", en: "Public holiday" },
  local:     { ca: "Festa local", es: "Fiesta local", en: "Local holiday" },
  lliure:    { ca: "Dia de lliure disposició", es: "Día de libre disposición", en: "School day off" },
  vacances:  { ca: "Vacances", es: "Vacaciones", en: "Holidays" }
};

const mesos = {
  ca: ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
};
const diesSetmana = {
  ca: ["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"],
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
};

const textos = {
  heroTitol: { ca: "Secretaria", es: "Secretaría", en: "School office" },
  heroSubtitol: { ca: "Calendari escolar", es: "Calendario escolar", en: "School calendar" },
  kicker: { ca: "Curs " + curs, es: "Curso " + curs, en: curs + " school year" },
  lead: {
    ca: "Dates clau del curs, festius i vacances de l’ESO i el Batxillerat a l’Institut Joan Miró.",
    es: "Fechas clave del curso, festivos y vacaciones de la ESO y el Bachillerato en el Institut Joan Miró.",
    en: "Key dates, public holidays and school holidays for ESO and Batxillerat at Institut Joan Miró."
  },
  datesClau: { ca: "Dates clau", es: "Fechas clave", en: "Key dates" },
  mesAMes: { ca: "Mes a mes", es: "Mes a mes", en: "Month by month" },
  llegenda: { ca: "Llegenda", es: "Leyenda", en: "Key" },
  festius: { ca: "Festius i dies sense classe", es: "Festivos y días sin clase", en: "Holidays and days off" },
  nota: {
    ca: "Els dies de lliure disposició i les festes locals no són lectius. Qualsevol canvi es comunicarà a les famílies per Clickedu.",
    es: "Los días de libre disposición y las fiestas locales no son lectivos. Cualquier cambio se comunicará a las familias por Clickedu.",
    en: "There are no classes on school days off or local holidays. Any changes will be communicated to families via Clickedu."
  }
};

// ---------- Càlcul ----------
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

function tipusDelDia(isoDate) {
  for (const e of dates) {
    const fins = e.fins || e.des;
    if (isoDate >= e.des && isoDate <= fins) return e;
  }
  return null;
}

function construirMesos() {
  const out = [];
  let y = inici.any, m = inici.mes;
  while (y < final.any || (y === final.any && m <= final.mes)) {
    const primer = new Date(Date.UTC(y, m - 1, 1));
    const offset = (primer.getUTCDay() + 6) % 7; // dilluns = 0
    const nDies = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cel = [];
    for (let i = 0; i < offset; i++) cel.push(null);
    for (let d = 1; d <= nDies; d++) {
      const dIso = iso(y, m, d);
      const wd = (offset + d - 1) % 7;
      const e = tipusDelDia(dIso);
      cel.push({ d, iso: dIso, capSetmana: wd >= 5, tipus: e ? e.tipus : null, nom: e && e.nom ? e.nom : null });
    }
    while (cel.length % 7) cel.push(null);
    const setmanes = [];
    for (let i = 0; i < cel.length; i += 7) setmanes.push(cel.slice(i, i + 7));
    out.push({ any: y, mes: m, setmanes });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

function dataLlarga(isoDate, L) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (L === "en") return `${d} ${mesos.en[m - 1]} ${y}`;
  if (L === "es") return `${d} de ${mesos.es[m - 1]} de ${y}`;
  const mes = mesos.ca[m - 1];
  const prep = /^[aeiou]/.test(mes) ? "d’" : "de ";
  return `${d} ${prep}${mes} de ${y}`;
}

function etiqueta(e, L) {
  if (!e.fins) return dataLlarga(e.des, L);
  const [y1, m1, d1] = e.des.split("-").map(Number);
  const [y2, m2] = e.fins.split("-").map(Number);
  // Mateix mes: «20 – 29 de març de 2027»
  if (y1 === y2 && m1 === m2) return `${d1} – ${dataLlarga(e.fins, L)}`;
  return `${dataLlarga(e.des, L)} – ${dataLlarga(e.fins, L)}`;
}

const langs = ["ca", "es", "en"];
const llista = {};
const clau = {};
for (const L of langs) {
  llista[L] = dates.filter((e) => ["festiu", "local", "lliure", "vacances"].includes(e.tipus))
    .map((e) => ({ data: etiqueta(e, L), tipus: e.tipus, text: e.nom ? e.nom[L] : tipusText[e.tipus][L] }));
  clau[L] = dates.filter((e) => ["inici", "darrer", "darrerBat", "vacances"].includes(e.tipus))
    .map((e) => ({ data: etiqueta(e, L), tipus: e.tipus, text: e.nom ? e.nom[L] : tipusText[e.tipus][L] }));
}

module.exports = {
  curs,
  mesos,
  diesSetmana,
  tipusText,
  textos,
  calendari: construirMesos(),
  llista,
  clau,
  llegenda: ["inici", "darrer", "darrerBat", "festiu", "local", "lliure", "vacances"]
};
