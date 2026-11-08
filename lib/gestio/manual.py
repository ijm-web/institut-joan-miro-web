"""Manual de GESTIO en PDF (un per mòdul i un de complet) a partir de src/_data/gestioAjuda.json.

El mateix fitxer JSON fa l'ajuda interactiva («?») de cada mòdul: quan canviï el funcionament d'un mòdul,
s'actualitza el JSON i es torna a executar aquest script.

Ús:  python3 lib/gestio/manual.py      →  src/assets/docs/gestio/manual-<mòdul>.pdf  i  manual-gestio.pdf
Disseny: el dels altres PDF del centre (Montserrat, logo, línia blava, peu amb paginació).
"""
import json
import os
import re

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, ListFlowable, ListItem, PageBreak,
                                PageTemplate, Paragraph, Spacer)

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.dirname(HERE)
ARREL = os.path.dirname(LIB)
LOGO = os.path.join(LIB, "img", "logo-ijm.png")
DADES = os.path.join(ARREL, "src", "_data", "gestioAjuda.json")
SORTIDA = os.path.join(ARREL, "src", "assets", "docs", "gestio")

BLAU, TARONJA, TEXT, GRIS, VORA = HexColor("#1C0CBC"), HexColor("#E8600C"), HexColor("#1E1E2A"), HexColor("#5A6070"), HexColor("#CFD6E4")
for w, n in ((300, "M-L"), (400, "M-R"), (600, "M-S"), (700, "M-B")):
    pdfmetrics.registerFont(TTFont(n, os.path.join(LIB, "fonts", f"Montserrat-{w}.ttf")))
pdfmetrics.registerFontFamily("M-R", normal="M-R", bold="M-S", italic="M-R", boldItalic="M-S")
# PAS 49: Montserrat no té ✓, ⚠, ⅔ ni fletxes: aquests caràcters surten amb DejaVu Sans
pdfmetrics.registerFont(TTFont("DJ", os.path.join(LIB, "fonts", "DejaVuSans.ttf")))
SIMBOLS = "✓⚠✗⅔←→↔×⇣"
# PAS 50: cap de les dues fonts té 📌 ni ⛔ (emoji): al PDF es treuen i el text ja diu «fixa» i «prohibida»
EMOJI = {"📌 ": "", "⛔ ": ""}

W, H = A4
MX = 20 * mm
E = {
    "titol": ParagraphStyle("titol", fontName="M-L", fontSize=24, leading=29, textColor=BLAU, spaceAfter=4),
    "sub": ParagraphStyle("sub", fontName="M-R", fontSize=10, leading=14, textColor=GRIS, spaceAfter=14),
    "intro": ParagraphStyle("intro", fontName="M-R", fontSize=10.5, leading=15.5, textColor=TEXT, spaceAfter=10),
    "part": ParagraphStyle("part", fontName="M-S", fontSize=8.5, leading=11, textColor=TARONJA, spaceBefore=12, spaceAfter=4, keepWithNext=1),
    "tema": ParagraphStyle("tema", fontName="M-S", fontSize=12.5, leading=16, textColor=BLAU, spaceBefore=10, spaceAfter=4),
    "p": ParagraphStyle("p", fontName="M-R", fontSize=9.6, leading=14.2, textColor=TEXT, spaceAfter=5),
    "li": ParagraphStyle("li", fontName="M-R", fontSize=9.6, leading=14.2, textColor=TEXT),
}


def html(t):
    for k, v in EMOJI.items():
        t = t.replace(k, v)
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\*(.+?)\*", r"<i>\1</i>", t)
    return re.sub("([" + SIMBOLS + "])", r'<font name="DJ">\1</font>', t)


def tema(n, t):
    peces = [Paragraph(f"{n}. {html(t['titol'])}", E["tema"])]
    items = []

    def buida():
        if items:
            peces.append(ListFlowable([ListItem(Paragraph(html(x), E["li"]), leftIndent=12, value="•") for x in items],
                                      bulletType="bullet", start="•", leftIndent=12, bulletColor=BLAU, spaceAfter=5))
            items.clear()
    for linia in t["text"]:
        if linia.startswith("- "):
            items.append(linia[2:])
        else:
            buida()
            peces.append(Paragraph(html(linia), E["p"]))
    buida()
    return KeepTogether(peces)


def pagina(kicker):
    def dibuixa(c, doc):
        c.saveState()
        c.drawImage(LOGO, MX, H - 25 * mm, height=13 * mm, width=13 * mm * 1100 / 432, mask="auto")
        c.setFillColor(TARONJA); c.setFont("M-S", 7.5); c.drawRightString(W - MX, H - 15 * mm, kicker.upper())
        c.setFillColor(GRIS); c.setFont("M-R", 7.5); c.drawRightString(W - MX, H - 19.5 * mm, "Institut Joan Miró · GESTIO")
        c.setStrokeColor(BLAU); c.setLineWidth(0.8); c.line(MX, H - 29 * mm, W - MX, H - 29 * mm)
        c.setStrokeColor(VORA); c.setLineWidth(0.4); c.line(MX, 16 * mm, W - MX, 16 * mm)
        c.setFillColor(GRIS); c.setFont("M-R", 7.5)
        c.drawString(MX, 11 * mm, "Manual de GESTIO · També hi ha l'ajuda interactiva (botó «?» de cada mòdul)")
        c.drawRightString(W - MX, 11 * mm, f"Pàgina {doc.page}")
        c.restoreState()
    return dibuixa


def manual(dades, ids, fitxer, titol, kicker):
    os.makedirs(SORTIDA, exist_ok=True)
    doc = BaseDocTemplate(os.path.join(SORTIDA, fitxer), pagesize=A4, title=titol, author="Institut Joan Miró",
                          leftMargin=MX, rightMargin=MX, topMargin=36 * mm, bottomMargin=22 * mm)
    doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(MX, 22 * mm, W - 2 * MX, H - 58 * mm, id="f")], onPage=pagina(kicker))])
    h = [Paragraph(html(titol), E["titol"]), Paragraph("Versió: " + html(dades["versio"]), E["sub"])]
    amb_comu = False
    for k, mid in enumerate(ids):
        m = dades["moduls"][mid]
        if len(ids) > 1:
            if k:
                h.append(PageBreak())
            h.append(Paragraph(html(m["titol"]).upper(), E["part"]))
        h.append(Paragraph(html(m["intro"]), E["intro"]))
        for n, t in enumerate(m["temes"], 1):
            h.append(tema(n, t))
        amb_comu = amb_comu or m.get("graella")
    if amb_comu:
        h.append(PageBreak() if len(ids) > 1 else Spacer(1, 6))
        h.append(Paragraph(html(dades["comu"]["titol"]).upper(), E["part"]))
        for n, t in enumerate(dades["comu"]["temes"], 1):
            h.append(tema(n, t))
    doc.build(h)
    return fitxer


def guia(dades, g, fitxer):
    os.makedirs(SORTIDA, exist_ok=True)
    doc = BaseDocTemplate(os.path.join(SORTIDA, fitxer), pagesize=A4, title=g["titol"], author="Institut Joan Miró",
                          leftMargin=MX, rightMargin=MX, topMargin=36 * mm, bottomMargin=22 * mm)
    doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(MX, 22 * mm, W - 2 * MX, H - 58 * mm, id="f")], onPage=pagina(g.get("kicker", g["titol"])))])
    h = [Paragraph(html(g["titol"]), E["titol"]), Paragraph("Versió: " + html(dades["versio"]), E["sub"]), Paragraph(html(g["intro"]), E["intro"])]
    for n, t in enumerate(g["temes"], 1):
        h.append(tema(n, t))
    doc.build(h)
    return fitxer


if __name__ == "__main__":
    with open(DADES, encoding="utf-8") as f:
        dades = json.load(f)
    fets = []
    for mid, m in dades["moduls"].items():
        fets.append(manual(dades, [mid], "manual-" + mid.replace("_", "-") + ".pdf", "Manual de GESTIO · " + m["titol"], "Manual · " + m["titol"]))
    fets.append(manual(dades, list(dades["moduls"].keys()), "manual-gestio.pdf", "Manual de GESTIO", "Manual de GESTIO"))
    # PAS 48: guies pas a pas per a un públic concret (p. ex. la Desiderata per als caps de departament/àmbit)
    for gid, g in dades.get("guies", {}).items():
        fets.append(guia(dades, g, "guia-" + gid + ".pdf"))
    print("PDF fets a src/assets/docs/gestio/: " + ", ".join(fets))
