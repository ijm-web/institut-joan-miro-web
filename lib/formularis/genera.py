"""Genera els PDF del centre que no surten de les dades del web.

    python3 lib/formularis/genera.py

Crea:
  src/assets/docs/secretaria/sollicitud-certificat-c1-catala.pdf  (formulari emplenable)
  src/assets/docs/eso/optatives-1r-eso.pdf                         (full informatiu)

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
# Optatives de 1r d'ESO (full informatiu)
# =====================================================================
OPTATIVES_1R = [
    ("Alemany", "Llengua estrangera",
     "Primer contacte amb la llengua alemanya: comunicació oral i escrita bàsica en situacions de la vida quotidiana, "
     "vocabulari i expressions habituals i cultura dels països de parla alemanya. És una matèria de continuïtat: "
     "es cursa de 1r a 4t d'ESO i pot preparar l'alumnat per als exàmens oficials del Goethe-Institut."),
    ("Francès", "Llengua estrangera",
     "Iniciació al francès des de la comunicació: presentar-se, parlar de l'entorn proper, entendre textos senzills i "
     "conèixer la cultura francòfona. És una matèria de continuïtat fins a 4t d'ESO i obre la porta als exàmens "
     "oficials de llengua francesa."),
    ("Italià", "Llengua estrangera",
     "Aprenentatge de l'italià a partir de situacions comunicatives reals, aprofitant la proximitat amb el català i el "
     "castellà. Inclou aspectes de la cultura italiana. És una matèria de continuïtat fins a 4t d'ESO i pot preparar "
     "per als exàmens oficials de l'Istituto Italiano di Cultura."),
    ("Anglès (reforç)", "Reforç",
     "Consolidació de les bases de l'anglès —vocabulari, estructures gramaticals, comprensió i expressió— perquè "
     "l'alumnat pugui seguir amb seguretat la matèria comuna d'anglès."),
    ("Tècniques d'estudi", "Reforç",
     "Eines per aprendre a aprendre: organitzar el temps i el material, planificar les tasques, fer resums, esquemes "
     "i mapes conceptuals, millorar la comprensió lectora i preparar els exàmens."),
    ("Iniciació als esports de raqueta", "Esport i salut",
     "Introducció a diversos esports de raqueta: tècnica bàsica, regles del joc, joc en parella i en equip, "
     "joc net i hàbits de vida saludables."),
    ("Construïm coneixement científic", "Matemàtiques",
     "Matèria de matemàtiques on es consoliden els conceptes bàsics mitjançant metodologies molt actives: "
     "manipulació, reptes, jocs i resolució de problemes en grup."),
]


def optatives_1r():
    os.makedirs(OUT_ESO, exist_ok=True)
    d = Doc(os.path.join(OUT_ESO, "optatives-1r-eso.pdf"), "Optatives de 1r d'ESO · Institut Joan Miró")
    c = d.c
    y = d.header("Estudis · ESO", "Optatives de 1r d'ESO")
    FW = W - 2 * MX
    y = d.para(MX, y + 6, FW,
               "A 1r d'ESO, cada alumne o alumna cursa <b>una matèria optativa de 3 hores setmanals</b>. "
               "Alemany, francès i italià són matèries de continuïtat fins a 4t.",
               size=9.5, leading=14.5)
    y -= 18
    gap = 10
    colw = (FW - gap) / 2
    items = OPTATIVES_1R
    # Dues columnes; la darrera targeta, si queda sola, ocupa tota l'amplada
    rest = items
    for r in range(0, len(rest), 2):
        pair = rest[r:r + 2]
        cw = colw if len(pair) == 2 else FW
        h = max(card_height(d, cw, t) for _, _, t in pair)
        for k, (nom, tag, txt) in enumerate(pair):
            draw_card(d, MX + k * (colw + gap), y, cw, h, nom, tag, txt)
        y -= h + gap
    d.footer("Per a qualsevol dubte, adreceu-vos a la tutoria o a la coordinació de 1r d'ESO.")
    d.save()


def card_height(d, w, txt):
    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle
    st = ParagraphStyle("p", fontName="M-R", fontSize=8.5, leading=12.5)
    _, h = Paragraph(txt, st).wrap(w - 28, 1000)
    return h + 58


def draw_card(d, x, y, w, h, nom, tag, txt):
    c = d.c
    c.setFillColor(SOFT); c.setStrokeColor(BORDER); c.setLineWidth(0.6)
    c.roundRect(x, y - h, w, h, 8, fill=1, stroke=1)
    c.setFillColor(BLUE); c.rect(x, y - 3, w, 3, fill=1, stroke=0)
    c.setFillColor(ORANGE); c.setFont("M-S", 6.5); c.drawString(x + 14, y - 18, tag.upper())
    c.setFillColor(BLUE); c.setFont("M-S", 11); c.drawString(x + 14, y - 34, nom)
    d.para(x + 14, y - 42, w - 28, txt, size=8.5, leading=12.5)


if __name__ == "__main__":
    certificat_c1()
    optatives_1r()
    print("PDF generats.")
