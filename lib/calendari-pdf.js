// ============ CALENDARI ESCOLAR EN PDF ============
// Genera el PDF del calendari (ca/es/en) a partir de les MATEIXES dades que la pàgina web
// (src/_data/calendari.js). S'executa sol en cada build d'Eleventy (vegeu eleventy.config.js):
// no cal fer res a mà quan s'actualitza el calendari.
// Sortida: _site/assets/docs/calendari/calendari-escolar-<curs>-<lang>.pdf

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const ROOT = path.join(__dirname, "..");
const FONT = (w) => path.join(__dirname, "fonts", `Montserrat-${w}.ttf`);
const LOGO = path.join(__dirname, "img", "logo-ijm.png");

const BLUE = "#1C0CBC";
const ORANGE = "#E8600C";
const TEXT = "#1E1E2A";
const MUTED = "#5A6070";
const BORDER = "#D6DCE6";

// Mateixos colors que src/assets/css/calendari.css
const COLORS = {
  inici:     { bg: BLUE, fg: "#FFFFFF" },
  darrer:    { bg: "#FFFFFF", fg: BLUE, stroke: BLUE },
  darrerBat: { bg: "#D9D5F7", fg: BLUE },
  festiu:    { bg: "#C9530A", fg: "#FFFFFF" },
  local:     { bg: "#FFFFFF", fg: "#A3420A", stroke: ORANGE },
  lliure:    { bg: "#FCE6D8", fg: "#A3420A" },
  vacances:  { bg: "#C9D2E0", fg: TEXT }
};

const T = {
  titol: { ca: "Calendari escolar", es: "Calendario escolar", en: "School calendar" },
  peu: {
    ca: "Institut Joan Miró · c. Verge de Montserrat, 53 · 08940 Cornellà de Llobregat · 93 377 51 66 · institutjoanmiro.cat",
    es: "Institut Joan Miró · c. Verge de Montserrat, 53 · 08940 Cornellà de Llobregat · 93 377 51 66 · institutjoanmiro.cat",
    en: "Institut Joan Miró · c. Verge de Montserrat, 53 · 08940 Cornellà de Llobregat (Barcelona) · +34 93 377 51 66 · institutjoanmiro.cat"
  }
};

function swatch(doc, x, y, w, h, tipus) {
  const c = COLORS[tipus];
  doc.save();
  doc.roundedRect(x, y, w, h, 2.5).fill(c.bg);
  if (c.stroke) doc.roundedRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2, 2).lineWidth(1.2).stroke(c.stroke);
  doc.restore();
}

function generaUn(cal, L, outFile) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, info: {
    Title: `${T.titol[L]} ${cal.curs} · Institut Joan Miró`, Author: "Institut Joan Miró"
  } });
  doc.registerFont("L", FONT(300));
  doc.registerFont("R", FONT(400));
  doc.registerFont("S", FONT(600));
  doc.registerFont("B", FONT(700));
  doc.pipe(fs.createWriteStream(outFile));

  const W = doc.page.width, H = doc.page.height, M = 30;

  // ---- Capçalera ----
  if (fs.existsSync(LOGO)) doc.image(LOGO, M, 22, { height: 40 });
  doc.font("S").fontSize(9).fillColor(ORANGE).text(cal.textos.kicker[L].toUpperCase(), M, 26, { width: W - 2 * M, align: "right", characterSpacing: 1 });
  doc.font("L").fontSize(24).fillColor(BLUE).text(T.titol[L], M, 38, { width: W - 2 * M, align: "right" });
  doc.moveTo(M, 74).lineTo(W - M, 74).lineWidth(0.8).strokeColor(BLUE).stroke();

  // ---- Mesos (5 x 2) ----
  const cols = 5, gap = 12;
  const mw = (W - 2 * M - gap * (cols - 1)) / cols;
  const cw = mw / 7, rh = 15.5;
  const top = 86, mh = 16 + 13 + 6 * rh + 6;
  cal.calendari.forEach((m, i) => {
    const x0 = M + (i % cols) * (mw + gap);
    const y0 = top + Math.floor(i / cols) * (mh + 10);
    doc.font("S").fontSize(10).fillColor(BLUE)
      .text(`${cal.mesos[L][m.mes - 1]} ${m.any}`.replace(/^./, (c) => c.toUpperCase()), x0 + 2, y0);
    cal.diesSetmana[L].forEach((d, k) => {
      doc.font("S").fontSize(6.5).fillColor(MUTED).text(d.toUpperCase(), x0 + k * cw, y0 + 16, { width: cw, align: "center" });
    });
    m.setmanes.forEach((w, r) => {
      w.forEach((day, k) => {
        if (!day) return;
        const cx = x0 + k * cw, cy = y0 + 29 + r * rh;
        let fg = day.capSetmana ? "#9096A0" : TEXT, font = "R";
        if (day.tipus) {
          swatch(doc, cx + 1, cy + 0.5, cw - 2, rh - 1.5, day.tipus);
          fg = COLORS[day.tipus].fg; font = "S";
        }
        doc.font(font).fontSize(7.5).fillColor(fg).text(String(day.d), cx, cy + 4, { width: cw, align: "center" });
      });
    });
  });

  // ---- Part inferior: llegenda | dates clau | festius ----
  const by = top + 2 * mh + 10 + 14;
  doc.moveTo(M, by - 8).lineTo(W - M, by - 8).lineWidth(0.5).strokeColor(BORDER).stroke();
  const colW = (W - 2 * M - 2 * 24) / 3;
  const c1 = M, c2 = M + colW + 24, c3 = M + 2 * (colW + 24);

  const head = (txt, x) => doc.font("S").fontSize(9).fillColor(BLUE).text(txt, x, by, { width: colW });

  head(cal.textos.llegenda[L], c1);
  cal.llegenda.forEach((t, i) => {
    const y = by + 16 + i * 13;
    swatch(doc, c1, y, 10, 10, t);
    doc.font("R").fontSize(7.5).fillColor(TEXT).text(cal.tipusText[t][L], c1 + 16, y + 1.5, { width: colW - 16 });
  });

  head(cal.textos.datesClau[L], c2);
  let y = by + 16;
  cal.clau[L].forEach((k) => {
    doc.font("S").fontSize(7.5).fillColor(BLUE).text(k.data, c2, y, { width: colW });
    y = doc.y + 0.5;
    doc.font("R").fontSize(7.5).fillColor(TEXT).text(k.text, c2, y, { width: colW });
    y = doc.y + 4;
  });

  head(cal.textos.festius[L], c3);
  y = by + 16;
  cal.llista[L].forEach((f) => {
    swatch(doc, c3, y, 8, 8, f.tipus);
    doc.font("S").fontSize(7).fillColor(BLUE).text(f.data, c3 + 13, y + 0.5, { continued: true })
      .font("R").fillColor(TEXT).text("  " + f.text, { width: colW - 13 });
    y = doc.y + 2.5;
  });

  // ---- Nota i peu ----
  doc.font("R").fontSize(7).fillColor(MUTED).text(cal.textos.nota[L], M, H - 46, { width: W - 2 * M });
  doc.rect(0, H - 26, W, 26).fill(BLUE);
  doc.font("R").fontSize(7).fillColor("#FFFFFF").text(T.peu[L], M, H - 17, { width: W - 2 * M, align: "center" });

  doc.end();
}

module.exports = function generaCalendariPdf(outputDir) {
  const dataFile = path.join(ROOT, "src", "_data", "calendari.js");
  delete require.cache[require.resolve(dataFile)];
  const cal = require(dataFile);
  const dir = path.join(outputDir, "assets", "docs", "calendari");
  fs.mkdirSync(dir, { recursive: true });
  for (const L of ["ca", "es", "en"]) {
    generaUn(cal, L, path.join(dir, path.basename(cal.pdf[L])));
  }
};
