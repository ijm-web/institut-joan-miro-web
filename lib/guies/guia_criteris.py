"""Guia pas a pas: criteris de qualificació (per als caps de departament i d'àmbit).

Mateix aspecte que els PDF de criteris de Programacions: logo, capçalera taronja i gris,
títols en blau, taules amb capçalera lila clara i peu amb paginació.

Ús:  python3 lib/guies/guia_criteris.py [sortida.pdf]
     (per defecte: «Guia pas a pas - Criteris de qualificació.pdf» a l'arrel del projecte,
      que no es publica amb el web: és a .gitignore)
El contingut és en aquest fitxer (llista CONTINGUT, més avall).
"""
import os, sys, datetime
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
                                KeepTogether, ListFlowable, ListItem, Flowable, CondPageBreak)

AQUI = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.dirname(AQUI)
ARREL = os.path.dirname(LIB)
LOGO = os.path.join(LIB, "img", "logo-ijm.png")
for w, n in ((300, "M-L"), (400, "M-R"), (600, "M-S"), (700, "M-B")):
    pdfmetrics.registerFont(TTFont(n, os.path.join(LIB, "fonts", f"Montserrat-{w}.ttf")))
pdfmetrics.registerFontFamily("M-R", normal="M-R", bold="M-S", italic="M-R", boldItalic="M-S")
# Símbols que Montserrat no té (✕, ↻)
pdfmetrics.registerFont(TTFont("DJ", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
SIMB = lambda t: "<font name='DJ'>%s</font>" % t

# Colors dels PDF de criteris (criteris-pdf.js)
BLAU = HexColor("#1C0CBC"); TARONJA = HexColor("#E8600C"); GRIS = HexColor("#5A6070")
TEXT = HexColor("#1E1E2A"); VORA = HexColor("#D6DAE6"); CAP = HexColor("#EEF0FC"); FONS = HexColor("#F6F7FA")
VERD = HexColor("#0F7A6E"); FONS_AVIS = HexColor("#FFF6EE")

W, H = A4
MX = 18 * mm
CURS = "Curs 2026-2027"
AVUI = datetime.date.today()
DATA = f"{AVUI.day}/{AVUI.month}/{AVUI.year}"

# ---------------------------------------------------------------- estils
st = {
    "p": ParagraphStyle("p", fontName="M-R", fontSize=9.4, leading=14, textColor=TEXT, spaceAfter=5),
    "lead": ParagraphStyle("lead", fontName="M-R", fontSize=10.5, leading=16, textColor=TEXT, spaceAfter=8),
    "h2": ParagraphStyle("h2", fontName="M-S", fontSize=14, leading=18, textColor=BLAU, spaceBefore=14, spaceAfter=7),
    "h3": ParagraphStyle("h3", fontName="M-S", fontSize=11, leading=14, textColor=BLAU, spaceBefore=0, spaceAfter=0),
    "li": ParagraphStyle("li", fontName="M-R", fontSize=9.4, leading=14, textColor=TEXT),
    "cel": ParagraphStyle("cel", fontName="M-R", fontSize=8.6, leading=12, textColor=TEXT),
    "celcap": ParagraphStyle("celcap", fontName="M-S", fontSize=7.8, leading=10, textColor=BLAU),
    "nota": ParagraphStyle("nota", fontName="M-R", fontSize=8.8, leading=13, textColor=TEXT),
    "obj_t": ParagraphStyle("obj_t", fontName="M-S", fontSize=10.5, leading=14, textColor=BLAU, spaceAfter=4),
    "obj": ParagraphStyle("obj", fontName="M-R", fontSize=8.8, leading=13, textColor=TEXT),
}


# ---------------------------------------------------------------- peces
class Fase(Flowable):
    """Títol de fase: número en un cercle taronja + títol blau + línia fina"""
    def __init__(self, num, titol, ample):
        super().__init__(); self.num, self.titol, self.ample = num, titol, ample
    def wrap(self, aw, ah): return self.ample, 26
    def draw(self):
        c = self.canv
        c.setFillColor(TARONJA); c.circle(9, 11, 9, fill=1, stroke=0)
        c.setFillColor(white); c.setFont("M-B", 10); c.drawCentredString(9, 7.6, str(self.num))
        c.setFillColor(BLAU); c.setFont("M-S", 11.5); c.drawString(26, 7, self.titol)
        c.setStrokeColor(VORA); c.setLineWidth(0.6); c.line(26, 0, self.ample, 0)


def llista(items, numerada=True):
    return ListFlowable(
        [ListItem(Paragraph(t, st["li"]), leftIndent=16) for t in items],
        bulletType="1" if numerada else "bullet", start=1 if numerada else None,
        bulletFontName="M-S" if numerada else "M-R", bulletFontSize=9 if numerada else 8,
        bulletColor=TARONJA, leftIndent=16, bulletDedent=14, spaceBefore=2, spaceAfter=6,
        **({} if numerada else {"bulletChar": "●"}))


def caixa(text, color=BLAU, fons=FONS):
    """Nota destacada: fons suau i barra de color a l'esquerra"""
    t = Table([["", Paragraph(text, st["nota"])]], colWidths=[3, W - 2 * MX - 3])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), color), ("BACKGROUND", (1, 0), (1, 0), fons),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 10), ("RIGHTPADDING", (1, 0), (1, 0), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    return KeepTogether([Spacer(1, 2), t, Spacer(1, 6)])


def taula(cap, files, amples, centra=()):
    dades = [[Paragraph(x, st["celcap"]) for x in cap]] + [[Paragraph(x, st["cel"]) for x in f] for f in files]
    t = Table(dades, colWidths=amples, repeatRows=1)
    estil = [
        ("BACKGROUND", (0, 0), (-1, 0), CAP), ("GRID", (0, 0), (-1, -1), 0.5, VORA),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6)]
    for i in range(1, len(dades)):
        if i % 2 == 0: estil.append(("BACKGROUND", (0, i), (-1, i), FONS))
    t.setStyle(TableStyle(estil))
    return t


def objectius():
    ample = (W - 2 * MX - 10) / 2
    def bloc(num, titol, text):
        return [Paragraph(f'<font color="#E8600C">{num}</font>  {titol}', st["obj_t"]), Paragraph(text, st["obj"])]
    t = Table([[bloc("01", "Unificar forma i contingut",
                     "Tots els departaments fan servir el mateix formulari: els criteris de totes les matèries tenen els mateixos apartats i el mateix format."),
                "",
                bloc("02", "Informar l’alumnat i les famílies",
                     "Tal com recullen les NOFC i la carta de compromís educatiu, l’alumnat i les famílies han de conèixer com es qualifica cada matèria. "
                     "El que deseu surt al PDF «Criteris de qualificació» de cada nivell, a la web.")]],
              colWidths=[ample, 10, ample])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), CAP), ("BACKGROUND", (2, 0), (2, 0), CAP),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
        ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("LEFTPADDING", (1, 0), (1, 0), 0), ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("LINEABOVE", (0, 0), (0, 0), 2, BLAU), ("LINEABOVE", (2, 0), (2, 0), 2, BLAU)]))
    return t


def recorregut():
    """Resum de les 9 fases en una franja"""
    fases = ["Entrar", "Revisar la llista", "Obrir la matèria", "Apartat 1", "Apartat 2",
             "Apartat 3", "Desar", "Revisar el PDF", "Tancar"]
    ample = (W - 2 * MX) / len(fases)
    cel = ParagraphStyle("fz", fontName="M-R", fontSize=7, leading=9, textColor=TEXT, alignment=1)
    num = ParagraphStyle("fzn", fontName="M-B", fontSize=12, leading=14, textColor=TARONJA, alignment=1)
    t = Table([[Paragraph(str(i + 1), num) for i in range(len(fases))], [Paragraph(f, cel) for f in fases]],
              colWidths=[ample] * len(fases))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FONS), ("LINEBELOW", (0, 1), (-1, 1), 2, BLAU),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, VORA), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, 0), 7), ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
        ("TOPPADDING", (0, 1), (-1, 1), 0), ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3)]))
    return t


# ---------------------------------------------------------------- contingut
def contingut():
    A = W - 2 * MX
    P = lambda t, s="p": Paragraph(t, st[s])
    E = []
    E += [P("Cada cap de departament o d’àmbit ha d’entrar i desar a la web els criteris de qualificació de "
            "<b>totes les matèries i nivells</b> del seu departament. Aquesta guia explica com fer-ho, clic a clic.", "lead")]

    E += [P("Per a què serveix", "h2"), objectius(), Spacer(1, 6),
          P("A més, a l’ESO els criteris s’aprofiten per fer la programació de la matèria: no s’han d’escriure dues vegades.")]

    E += [P("Abans de començar", "h2"), P("Tingueu a mà aquestes coses abans d’obrir la web:"),
          llista(["<b>Un ordinador</b> amb Chrome. Es pot fer des del mòbil, però és molt més còmode amb pantalla gran.",
                  "<b>El vostre compte de l’escola</b> (@institutjoanmiro.cat). No funciona amb comptes personals de Gmail.",
                  "<b>Els acords del departament</b> per a cada matèria i nivell: activitats avaluatives de cada trimestre i el seu percentatge, "
                  "com s’aprova, com es recupera, com es recuperen les pendents i, si n’hi ha, com es millora la nota.",
                  "<b>Les competències específiques</b> de cada matèria (codi i descripció del currículum).",
                  "<b>Els exemples</b> de matèries ja fetes que us ha enviat la direcció: obriu-los i feu-los servir de model."], numerada=False),
          caixa("<b>Qui hi pot entrar:</b> les persones que consten a la llista de departaments del centre. Cadascú només veu i modifica les matèries "
                "del seu departament. Si no hi podeu entrar, parleu amb la direcció. Si hi falta alguna matèria, parleu amb la coordinació pedagògica.<br/>"
                "<b>Termini:</b> el que fixi la coordinació pedagògica. Fins aleshores podeu desar a mitges tantes vegades com calgui.")]

    E += [CondPageBreak(42 * mm), P("Pas a pas", "h2"),
          P("Repetiu les fases 3 a 8 per a <b>cada matèria i cada nivell</b> del departament. Una matèria de 1r i la mateixa de 2n són dues fitxes diferents."),
          recorregut(), Spacer(1, 10)]

    def fase(n, titol, items, despres=None, abans=None):
        bloc = [Fase(n, titol, A), Spacer(1, 6)]
        if abans: bloc.append(P(abans))
        bloc.append(llista(items))
        cua = []
        if despres: cua = despres if isinstance(despres, list) else [P(despres)]
        return [KeepTogether(bloc)] + cua + [Spacer(1, 6)]

    E += fase(1, "Entrar", [
        'Obriu <link href="https://institutjoanmiro.netlify.app/programacions" color="#1C0CBC"><u>institutjoanmiro.netlify.app/programacions</u></link> amb Chrome.',
        "Premeu <b>Inicia la sessió amb Google</b> i trieu el compte @institutjoanmiro.cat.",
        "A la portada PROGRAMACIONS, premeu la targeta <b>Gestió Criteris de Qualificació</b>."],
        [caixa("La web recorda les dades 10 minuts: podeu canviar d’apartat sense esperar. Si no veieu un canvi fet per algú altre, premeu "
               "<b><font name='DJ'>↻</font> Actualitza les dades</b> a la llista. La sessió dura 8 hores. Per sortir, premeu <b>Surt</b>, a dalt a la dreta.")])
    E += fase(2, "Revisar la llista de matèries", [
        "A dalt, comproveu el desplegable <b>Curs</b>: ha de ser el curs marcat «en gestió». Els altres cursos només es poden consultar.",
        "Si porteu més d’un departament, trieu-lo al desplegable <b>Departament</b>.",
        "Mireu la llista: surten totes les matèries del departament, agrupades per nivell, amb el seu estat (<b>Pendent</b>, <b>En curs</b> o <b>Completa</b>).",
        "Si hi falta una matèria o n’hi sobra alguna, aviseu la coordinació pedagògica abans de continuar."])
    E += fase(3, "Obrir una matèria", [
        "Cliqueu el nom de la matèria. S’obre la fitxa amb tres apartats: <b>1 Competències específiques</b>, <b>2 Criteris de qualificació</b> "
        "i <b>3 Aprovar, recuperar i millorar la nota</b>.",
        "Si la matèria ja tenia dades d’altres anys, no comenceu de zero: premeu <b>Carrega dades…</b> i trieu <b>la mateixa matèria del curs anterior</b> "
        "o <b>el full de criteris 2025-2026</b>. Les dades omplen la fitxa, però <b>no es desen</b> fins que premeu Desa. Reviseu-les totes."])
    E += fase(4, "Apartat 1: competències específiques", [
        "Premeu <b>+ Afegeix competència</b>.",
        "Escriviu el codi (CE1, CE2…) i la descripció, tal com surt al currículum.",
        "Repetiu-ho per a cada competència de la matèria. Amb <b><font name='DJ'>✕</font></b> n’esborreu una."],
        "Feu aquest apartat primer: les competències que hi poseu són els botons que després marcareu a cada activitat.")
    E += fase(5, "Apartat 2: activitats de cada trimestre", [
        "Premeu <b>+ Afegeix activitat</b>.",
        "Escriviu el nom de l’activitat avaluativa (p. ex. «Prova escrita», «Dossier», «Projecte») i el seu <b>percentatge</b>.",
        "Cliqueu els botons de les <b>competències específiques</b> que avalua (CE1, CE2…). A l’ESO, cliqueu també els de la "
        "<b>competència digital</b> (CD1…CD11) si en treballa alguna.",
        "Repetiu-ho fins tenir totes les activitats del trimestre.",
        "Comproveu el <b>total</b> de dalt del bloc: ha de ser <b>100 %</b> (verd). Si surt en taronja, no suma 100.",
        "Si el 2n o el 3r trimestre tenen les mateixes activitats, premeu <b>Copia les activitats del … trimestre</b> i després canvieu el que calgui."],
        "Amb <b>↑ ↓</b> canvieu l’ordre i amb <b><font name='DJ'>✕</font></b> esborreu una activitat. A les matèries d’ESO, sota els trimestres surt la taula dels "
        "nivells d’assoliment (NA, AS, AN, AE): és un text comú i no s’ha de tocar.",
        abans="Hi ha un bloc per a cada trimestre (1r, 2n i 3r). A cada bloc:")
    E += fase(6, "Apartat 3: aprovar, recuperar i millorar la nota", [
        "<b>Pes dels instruments per blocs</b> (opcional). Si el departament fa servir blocs, premeu <b>+ Afegeix bloc</b> i escriviu el bloc "
        "(p. ex. Coneixements), els instruments i el percentatge. Han de sumar 100 %.",
        "<b>Criteris per aprovar la matèria</b> (obligatori). Com s’obté la nota de cada trimestre i la final, i què cal per aprovar "
        "(pes dels trimestres, notes mínimes…).",
        "<b>Recuperació trimestral i final</b> (obligatori). Com es recupera un trimestre suspès i la matèria a final de curs.",
        "<b>Recuperació de matèries pendents de cursos anteriors</b> (obligatori). Com recupera l’alumnat la matèria pendent del curs anterior. "
        "A 4t d’ESO i a 2n de Batxillerat aquest apartat no surt.",
        "<b>Criteris per millorar la nota</b> (opcional). Si es pot, com es millora la nota a final de curs.",
        "<b>Observacions</b> (opcional). Qualsevol altra informació (ortografia, lliurament de treballs…)."],
        [caixa("Escriviu-ho pensant en una família que ho llegirà: frases curtes i sense sigles internes.", TARONJA, FONS_AVIS)])
    E += fase(7, "Desar", [
        "Premeu <b>Desa</b>, a la barra de baix.",
        "Si surt una finestra d’avís (un trimestre que no suma 100 %, un text obligatori buit…), llegiu-la. El millor és tornar a la fitxa i corregir-ho. "
        "Si encara us falta informació, podeu desar igualment i acabar-ho un altre dia.",
        "Ha de sortir el missatge <b>Desat correctament</b>."],
        "Si us equivoqueu abans de desar, <b>Descarta els canvis</b> torna a l’última versió desada.")
    E += fase(8, "Revisar el resultat", [
        "Dins de la matèria, premeu <b>PDF</b>: es descarrega el document tal com el veuran les famílies. Llegiu-lo sencer.",
        "Torneu a la llista: la matèria ha de sortir <b>Completa</b>. Si surt <b>En curs</b>, alguna cosa falta (vegeu la llista de comprovació).",
        "Passeu a la matèria següent i torneu a la fase 3."])
    E += fase(9, "Tancar el departament", [
        "Quan totes les matèries surtin <b>Completa</b>, premeu <b>Informe en PDF</b> a la llista. Es descarrega un resum de l’estat de totes les "
        "matèries i una pàgina per matèria.",
        "Reviseu-lo amb el departament i corregiu el que calgui.",
        "Comuniqueu a la coordinació pedagògica que el departament ha acabat.",
        "Al cap d’uns minuts, comproveu el PDF públic del vostre nivell a la web: Estudis › ESO o Estudis › Batxillerat › <b>Criteris de qualificació (PDF)</b>."])

    E += [CondPageBreak(70 * mm), P("Què ha d’incloure cada matèria", "h2"),
          P("Una matèria està ben feta quan compleix tot això. Repasseu-ho abans de passar a la següent."),
          taula(["Apartat", "Què hi ha d’haver", "Obligatori"], [
              ["1 · Competències específiques", "Totes les CE de la matèria, amb codi i descripció", "<b>Sí</b>"],
              ["2 · Criteris de qualificació", "Activitats als tres trimestres; cada trimestre suma 100 %", "<b>Sí</b>"],
              ["2 · Criteris de qualificació", "Cada activitat té marcada almenys una CE (i, a l’ESO, la CD si en treballa)", "<b>Sí</b>"],
              ["3 · Pes per blocs", "Blocs i percentatges que sumen 100 %", "No"],
              ["3 · Criteris per aprovar la matèria", "Text", "<b>Sí</b>"],
              ["3 · Recuperació trimestral i final", "Text", "<b>Sí</b>"],
              ["3 · Recuperació de matèries pendents", "Text", "<b>Sí</b> (no surt a 4t d’ESO ni a 2n de Batxillerat)"],
              ["3 · Criteris per millorar la nota", "Text", "No"],
              ["3 · Observacions", "Text", "No"]], [A * 0.34, A * 0.40, A * 0.26]),
          Spacer(1, 8),
          P("Amb tots els obligatoris, la matèria surt <b>Completa</b> a la llista."),
          caixa("<b>Exemples:</b> la direcció us envia dues o tres matèries ja gestionades. Obriu-ne el PDF i compareu-lo amb el vostre: "
                "el format ha de ser el mateix i el nivell de detall, semblant.")]

    E += [CondPageBreak(60 * mm), P("Si alguna cosa no va bé", "h2"),
          taula(["Què passa", "Què heu de fer"], [
              ["No puc entrar", "Feu servir el compte @institutjoanmiro.cat. Si continua, parleu amb la direcció."],
              ["No veig cap matèria o en falta alguna", "Les matèries surten de la llista oficial del centre. Demaneu a la coordinació que l’actualitzi."],
              ["No puc desar", "Mireu l’avís de dalt: potser teniu triat un curs que només es pot consultar, o la gestió està tancada."],
              ["Un percentatge surt en vermell", "Ha de ser un número entre 0 i 100. Es poden fer servir decimals, amb coma o amb punt."],
              ["Un botó de competència surt amb vora discontínua", "Aquella CE no és a l’apartat 1. Afegiu-la allà o desmarqueu-la."],
              ["La matèria surt «En curs»", "Falta alguna cosa obligatòria. Repasseu la llista de comprovació."],
              ["Avisa que algú altre ha desat la matèria", "Dues persones l’estaven editant alhora. Torneu a carregar-la o deseu la vostra versió, però parleu-ho abans amb l’altra persona."],
              ["He esborrat una cosa per error", "Si no heu desat, premeu <b>Descarta els canvis</b>. Si ja estava desada, la coordinació la pot recuperar de l’historial."],
              ["La sessió ha caducat", "Torneu a entrar. Si teniu canvis sense desar, la web us n’avisa abans."],
              ["No veig un canvi que ha fet una altra persona", "Premeu <b><font name='DJ'>↻</font> Actualitza les dades</b> a la llista de matèries."],
              ["El PDF públic encara no mostra els canvis", "Pot trigar uns minuts. Si l’endemà encara no surten, aviseu la coordinació."]],
              [A * 0.36, A * 0.64]),
          Spacer(1, 10), P("Per a qualsevol altre dubte, parleu amb la coordinació pedagògica.")]
    return E


# ---------------------------------------------------------------- pàgina
class Guia(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(path, pagesize=A4, leftMargin=MX, rightMargin=MX, topMargin=36 * mm, bottomMargin=20 * mm,
                         title="Guia pas a pas: criteris de qualificació", author="Institut Joan Miró",
                         subject="Programacions · Gestió Criteris de Qualificació")
        sense = dict(leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        primera = Frame(MX, 20 * mm, W - 2 * MX, H - 20 * mm - 62 * mm, id="primera", **sense)
        resta = Frame(MX, 20 * mm, W - 2 * MX, H - 20 * mm - 34 * mm, id="resta", **sense)
        self.addPageTemplates([PageTemplate("primera", [primera], onPage=self.capcalera, autoNextPageTemplate="resta"),
                               PageTemplate("resta", [resta], onPage=self.capcalera)])

    def capcalera(self, c, doc):
        c.saveState()
        c.drawImage(LOGO, MX, H - 25 * mm, height=11 * mm, width=11 * mm * 1100 / 432, mask="auto")
        c.setFillColor(TARONJA); c.setFont("M-S", 7.2); c.drawRightString(W - MX, H - 15.5 * mm, "PROGRAMACIONS · GUIA PAS A PAS")
        c.setFillColor(GRIS); c.setFont("M-R", 7.2); c.drawRightString(W - MX, H - 20 * mm, "Institut Joan Miró · " + CURS)
        c.setStrokeColor(BLAU); c.setLineWidth(0.7); c.line(MX, H - 28 * mm, W - MX, H - 28 * mm)
        if doc.page == 1:
            c.setFillColor(BLAU); c.setFont("M-S", 24); c.drawString(MX, H - 42 * mm, "Criteris de qualificació")
            c.setFillColor(GRIS); c.setFont("M-R", 10)
            c.drawString(MX, H - 49 * mm, "Guia pas a pas per als caps de departament i d’àmbit · Actualitzada el " + DATA)
            c.setFillColor(TARONJA); c.rect(MX, H - 55 * mm, 16 * mm, 1.4, fill=1, stroke=0)
        # peu
        c.setStrokeColor(VORA); c.setLineWidth(0.4); c.line(MX, 14 * mm, W - MX, 14 * mm)
        c.setFillColor(GRIS); c.setFont("M-R", 7)
        c.drawString(MX, 10 * mm, "Institut Joan Miró · Cornellà de Llobregat · Generat el " + DATA)
        c.drawRightString(W - MX, 10 * mm, "Pàgina %d de %s" % (doc.page, "{TOTAL}"))
        c.restoreState()


def genera(sortida):
    # Dues passades: la primera compta les pàgines per al «Pàgina X de Y»
    import io
    from reportlab.pdfgen import canvas as cv
    class Comptador(cv.Canvas):
        def __init__(self, *a, **k):
            super().__init__(*a, **k); self._pagines = []
        def showPage(self):
            self._pagines.append(dict(self.__dict__)); self._startPage()
        def save(self):
            n = len(self._pagines)
            for p in self._pagines:
                self.__dict__.update(p)
                self._code = [x.replace("{TOTAL}", str(n)) if isinstance(x, str) else x for x in self._code]
                super().showPage()
            super().save()
    Guia(sortida).build(contingut(), canvasmaker=Comptador)
    return sortida


if __name__ == "__main__":
    sortida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ARREL, "Guia pas a pas - Criteris de qualificació.pdf")
    print(genera(sortida))
