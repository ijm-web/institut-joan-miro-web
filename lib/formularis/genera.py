"""Genera els PDF del centre que no surten de les dades del web.

    python3 lib/formularis/genera.py

Crea:
  src/assets/docs/secretaria/sollicitud-certificat-c1-catala.pdf  (formulari emplenable)
  src/assets/docs/eso/optatives-{1r,2n,3r}-eso.pdf i materies-opcio-4t-eso.pdf
  src/assets/docs/batxillerat/optatives-1r-batxillerat.pdf

Requereix: pip install reportlab
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ijm_pdf import Doc, MX, W, BLUE, ORANGE, TEXT, MUTED, BORDER, SOFT  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_SEC = os.path.join(ROOT, "src", "assets", "docs", "secretaria")
OUT_ESO = os.path.join(ROOT, "src", "assets", "docs", "eso")


# =====================================================================
# Sol·licitud de certificat d'equivalència del nivell C1 de català
# =====================================================================
def certificat_c1():
    os.makedirs(OUT_SEC, exist_ok=True)
    d = Doc(os.path.join(OUT_SEC, "sollicitud-certificat-c1-catala.pdf"),
            "Sol·licitud de certificat C1 de català · Institut Joan Miró")
    c = d.c
    y = d.header("Secretaria · Sol·licitud", "Certificat C1 de català", registre=True)
    y -= 6
    FW = W - 2 * MX

    y = d.section(y, 1, "Dades de la persona sol·licitant")
    d.field("nom", MX, y, FW, "Nom i cognoms")
    y -= 36
    d.field("document", MX, y, 150, "DNI / NIE / Passaport")
    d.field("naixement", MX + 170, y, 110, "Data de naixement")
    d.field("telefon", MX + 300, y, FW - 300, "Telèfon")
    y -= 36
    d.field("correu", MX, y, FW, "Adreça electrònica")
    y -= 36
    d.field("adreca", MX, y, 280, "Adreça")
    d.field("cp", MX + 300, y, 70, "Codi postal")
    d.field("municipi", MX + 390, y, FW - 390, "Municipi")
    y -= 46

    y = d.section(y, 2, "Exposo")
    c.setFillColor(TEXT); c.setFont("M-R", 9)
    c.drawString(MX, y, "Que he obtingut a l'Institut Joan Miró el títol següent:")
    y -= 20
    x = d.check("titol_eso", MX, y, "Graduat en Educació Secundària Obligatòria")
    c.setFont("M-R", 9); c.drawString(MX + 290, y, "Any d'obtenció:"); d.inline_field("any_eso", MX + 360, y, 60)
    y -= 20
    d.check("titol_btx", MX, y, "Batxiller")
    c.setFont("M-R", 9); c.drawString(MX + 290, y, "Any d'obtenció:"); d.inline_field("any_btx", MX + 360, y, 60)
    y -= 12
    y = d.para(MX, y, FW,
               "I que he cursat a Catalunya els estudis que la normativa vigent exigeix per a l'equivalència "
               "amb el nivell de suficiència de català (C1), amb la llengua catalana superada.",
               size=8.5, leading=12.5)
    y -= 26

    y = d.section(y, 3, "Documentació que adjunto")
    d.check("doc_identitat", MX, y, "Còpia del DNI / NIE / passaport")
    y -= 19
    d.check("doc_primaria", MX, y, "Certificat dels estudis de primària cursats a Catalunya")
    c.setFillColor(MUTED); c.setFont("M-R", 7); c.drawString(MX + 300, y, "(si no consten a l'expedient del centre)")
    y -= 19
    d.check("doc_altres", MX, y, "Altres:")
    d.inline_field("doc_altres_text", MX + 70, y, FW - 70)
    y -= 34

    y = d.section(y, 4, "Sol·licito")
    y = d.para(MX, y + 4, FW,
               "Que se m'expedeixi el <b>certificat d'equivalència amb el nivell de suficiència de català (C1)</b> "
               "corresponent als estudis indicats.", size=9, leading=13.5)
    y -= 26

    y = d.section(y, 5, "Signatura")
    c.setFillColor(TEXT); c.setFont("M-R", 10)
    c.drawString(MX, y - 8, "Cornellà de Llobregat,")
    d.inline_field("dia", MX + 112, y - 8, 30)
    c.drawString(MX + 150, y - 8, "de"); d.inline_field("mes", MX + 168, y - 8, 90)
    c.drawString(MX + 266, y - 8, "de 20"); d.inline_field("any", MX + 296, y - 8, 26)
    d.signbox(W - MX - 200, y + 6, 200, 62)
    y -= 44
    c.setFillColor(MUTED); c.setFont("M-S", 8)
    c.drawString(MX, y, "SR./SRA. DIRECTOR/A DE L'INSTITUT JOAN MIRÓ")

    d.footer("Lliureu aquesta sol·licitud a la secretaria del centre, en l'horari d'atenció al públic.")
    d.save()


# =====================================================================
# Optatives (1r-3r) i matèries d'opció (4t) d'ESO, un PDF per nivell
# (textos a lib/formularis/materies_eso.py)
# =====================================================================
def materies_eso():
    from materies_eso import NIVELLS
    os.makedirs(OUT_ESO, exist_ok=True)
    FW = W - 2 * MX
    gap = 10
    colw = (FW - gap) / 2
    for niv, dades in NIVELLS.items():
        d = Doc(os.path.join(OUT_ESO, dades["fitxer"]), f"{dades['titol']} · Institut Joan Miró")
        nota = f"Per a qualsevol dubte, adreceu-vos a la tutoria o a la coordinació de {niv} d'ESO."
        y = d.header("Estudis · ESO", dades["titol"])
        y = d.para(MX, y + 6, FW, dades["intro"], size=9.5, leading=14.5) - 16

        def nova_pagina():
            d.footer(nota)
            d.c.showPage()
            d.c.setFillColor(ORANGE); d.c.setFont("M-S", 8)
            d.c.drawString(MX, 800, ("Estudis · ESO · " + dades["titol"]).upper())
            return 780

        for titol, items in dades["seccions"]:
            if y < 200:
                y = nova_pagina()
            d.c.setFillColor(BLUE); d.c.setFont("M-S", 12); d.c.drawString(MX, y, titol)
            y -= 14
            for r in range(0, len(items), 2):
                pair = items[r:r + 2]
                cw = colw if len(pair) == 2 else FW
                h = max(card_height(d, cw, t) for _, _, _, t in pair)
                if y - h < 80:
                    y = nova_pagina()
                for k, (nom, hores, tag, txt) in enumerate(pair):
                    draw_card(d, MX + k * (colw + gap), y, cw, h, nom, f"{tag} · {hores} h/setmana", txt)
                y -= h + gap
            y -= 12
        d.footer(nota)
        d.save()


def card_height(d, w, txt):
    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle
    st = ParagraphStyle("p", fontName="M-R", fontSize=8.5, leading=12.5)
    _, h = Paragraph(txt, st).wrap(w - 28, 1000)
    return h + 50


def draw_card(d, x, y, w, h, nom, tag, txt):
    c = d.c
    c.setFillColor(SOFT); c.setStrokeColor(BORDER); c.setLineWidth(0.6)
    c.roundRect(x, y - h, w, h, 8, fill=1, stroke=1)
    c.setFillColor(BLUE); c.rect(x, y - 3, w, 3, fill=1, stroke=0)
    c.setFillColor(ORANGE); c.setFont("M-S", 6.5); c.drawString(x + 14, y - 18, tag.upper())
    c.setFillColor(BLUE); c.setFont("M-S", 11); c.drawString(x + 14, y - 34, nom)
    d.para(x + 14, y - 42, w - 28, txt, size=8.5, leading=12.5)



# =====================================================================
# Optatives de 1r de Batxillerat (descripció)
# =====================================================================
OUT_BAT = os.path.join(ROOT, "src", "assets", "docs", "batxillerat")
OPTATIVES_BAT = [
    ("Programació", "Franja 1 · 2 h", "Fonaments de la programació: algorismes, estructures de control, funcions i dades, amb un llenguatge actual (Python). L'alumnat resol problemes i desenvolupa petits projectes, com aplicacions senzilles o programes per a dispositius físics."),
    ("Psicologia", "Franja 2 · 2 h", "Introducció a l'estudi científic de la conducta i dels processos mentals: el cervell, la percepció, la memòria, l'aprenentatge, la motivació, les emocions, la personalitat i les relacions socials. Ajuda a conèixer-se millor i a entendre els altres."),
    ("Problemàtiques socials", "Franja 1 · 2 h", "Anàlisi dels grans reptes de la societat actual (desigualtats, pobresa, migracions, gènere, medi ambient, conflictes) a partir de dades i fonts diverses, per formar una mirada crítica i plantejar propostes de millora."),
    ("Funcionament de l'empresa", "Franja 1 · 2 h", "Què és una empresa i com s'organitza: àrees funcionals, producció, màrqueting, recursos humans, comptabilitat bàsica i finançament. Es treballa a partir de casos reals i de la creació d'un petit projecte empresarial."),
    ("Ciutadania, política i dret", "Franja 1 · 2 h", "Els fonaments de la vida democràtica: l'Estat i les institucions, la Constitució i l'Estatut, els drets i deures, el sistema judicial i la participació ciutadana. Es treballa amb casos d'actualitat i debats."),
    ("Formació i orientació personal i professional", "Franja 1 · 2 h", "Autoconeixement, presa de decisions i planificació de l'itinerari formatiu i professional: estudis universitaris i de formació professional, món laboral, cerca de feina i competències per a l'ocupació."),
    ("Món clàssic", "Franja 2 · 2 h", "Aproximació a la cultura de Grècia i Roma: història, mitologia, art, literatura, pensament i vida quotidiana, i el seu llegat en la llengua, les institucions i la cultura actuals."),
]


def optatives_batxillerat():
    os.makedirs(OUT_BAT, exist_ok=True)
    d = Doc(os.path.join(OUT_BAT, "optatives-1r-batxillerat.pdf"), "Optatives de 1r de Batxillerat · Institut Joan Miró")
    FW = W - 2 * MX
    gap = 10
    colw = (FW - gap) / 2
    y = d.header("Estudis · Batxillerat", "Optatives de 1r de Batxillerat")
    y = d.para(MX, y + 6, FW, "Descripció d'algunes de les matèries optatives de 1r de batxillerat. A la franja 1 es pot triar una matèria de 4 hores o dues de 2 hores (una del grup A i una del grup B); a la franja 2, una matèria de 2 hores.", size=9.5, leading=14.5) - 16
    items = OPTATIVES_BAT
    for r in range(0, len(items), 2):
        pair = items[r:r + 2]
        cw = colw if len(pair) == 2 else FW
        h = max(card_height(d, cw, t) for _, _, t in pair)
        for k, (nom, tag, txt) in enumerate(pair):
            draw_card(d, MX + k * (colw + gap), y, cw, h, nom, tag, txt)
        y -= h + gap
    d.footer("Per a qualsevol dubte, adreceu-vos a la tutoria o a la coordinació de batxillerat.")
    d.save()

if __name__ == "__main__":
    certificat_c1()
    materies_eso()
    optatives_batxillerat()
    print("PDF generats.")
