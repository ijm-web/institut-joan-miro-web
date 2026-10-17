"""Peces comunes dels PDF del centre (formularis i fulls informatius).

Mateix disseny que els formularis de Secretaria (src/assets/docs/secretaria/):
capçalera amb logo, títol prim en blau, seccions numerades, camps amb línia,
caixa de registre i peu blau.  Fonts: Montserrat estàtica (lib/fonts).

Ús: python3 lib/formularis/genera.py   (crea els PDF a src/assets/docs/…)
"""
import os
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.dirname(HERE)
LOGO = os.path.join(LIB, "img", "logo-ijm.png")

BLUE = HexColor("#1C0CBC")
ORANGE = HexColor("#E8600C")
TEXT = HexColor("#1E1E2A")
MUTED = HexColor("#5A6070")
LINE = HexColor("#B9C0D0")
SOFT = HexColor("#F3F4F9")
BORDER = HexColor("#CFD6E4")

for w, n in ((300, "M-L"), (400, "M-R"), (600, "M-S"), (700, "M-B")):
    pdfmetrics.registerFont(TTFont(n, os.path.join(LIB, "fonts", f"Montserrat-{w}.ttf")))

W, H = A4
MX = 48  # marge lateral


class Doc:
    def __init__(self, path, title):
        self.c = canvas.Canvas(path, pagesize=A4)
        self.c.setTitle(title)
        self.c.setAuthor("Institut Joan Miró")
        self.form = self.c.acroForm

    # ---------- capçalera i peu ----------
    def header(self, kicker, title, registre=False):
        c = self.c
        c.drawImage(LOGO, MX, H - 92, height=46, width=46 * 1100 / 432, mask="auto")
        c.setFillColor(MUTED); c.setFont("M-R", 7.5)
        c.drawRightString(W - MX, H - 50, "Generalitat de Catalunya")
        c.drawRightString(W - MX, H - 61, "Departament d'Educació i Formació Professional")
        c.setFillColor(TEXT); c.setFont("M-S", 7.5)
        c.drawRightString(W - MX, H - 72, "Institut Joan Miró · Cornellà de Llobregat")
        c.setStrokeColor(BLUE); c.setLineWidth(0.8); c.line(MX, H - 104, W - MX, H - 104)
        y = H - 132
        c.setFillColor(ORANGE); c.setFont("M-S", 8); c.drawString(MX, y, kicker.upper())
        c.setFillColor(BLUE)
        size = 22
        c.setFont("M-L", size)
        maxw = (W - 2 * MX - (190 if registre else 0))
        lines = self._wrap(title, "M-L", size, maxw)
        for i, ln in enumerate(lines):
            c.drawString(MX, y - 24 - i * 26, ln)
        if registre:
            bx, by, bw, bh = W - MX - 175, H - 172, 175, 58
            c.setFillColor(SOFT); c.setStrokeColor(BORDER); c.roundRect(bx, by, bw, bh, 6, fill=1, stroke=1)
            c.setFillColor(MUTED); c.setFont("M-S", 6.5); c.drawString(bx + 10, by + bh - 13, "A OMPLIR PER LA SECRETARIA")
            c.setFillColor(TEXT); c.setFont("M-R", 8)
            c.drawString(bx + 10, by + 26, "Data d'entrada:"); c.drawString(bx + 10, by + 10, "Núm. de registre:")
            c.setStrokeColor(LINE); c.setLineWidth(0.6)
            c.line(bx + 85, by + 24, bx + bw - 10, by + 24); c.line(bx + 90, by + 8, bx + bw - 10, by + 8)
        return y - 24 - (len(lines) - 1) * 26 - 30

    def footer(self, nota=None):
        c = self.c
        if nota:
            c.setFillColor(MUTED); c.setFont("M-R", 7.5); c.drawString(MX, 62, nota)
        c.setFillColor(ORANGE); c.rect(0, 46, W, 2, fill=1, stroke=0)
        c.setFillColor(BLUE); c.rect(0, 0, W, 46, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("M-S", 8); c.drawString(MX, 27, "Institut Joan Miró")
        c.setFont("M-R", 7.5); c.drawString(MX, 15, "c. Verge de Montserrat, 53 · 08940 Cornellà de Llobregat")
        c.drawRightString(W - MX, 27, "93 377 51 66 · secretaria@institutjoanmiro.cat")
        c.drawRightString(W - MX, 15, "institutjoanmiro.cat")

    # ---------- blocs ----------
    def section(self, y, num, title):
        c = self.c
        c.setFillColor(BLUE); c.circle(MX + 7, y + 3.5, 7, fill=1, stroke=0)
        c.setFillColor(white); c.setFont("M-B", 8); c.drawCentredString(MX + 7, y + 0.7, str(num))
        c.setFillColor(BLUE); c.setFont("M-S", 10.5); c.drawString(MX + 22, y, title.upper())
        return y - 22

    def label(self, x, y, text, small=None):
        c = self.c
        c.setFillColor(MUTED); c.setFont("M-R", 7.5); c.drawString(x, y, text)
        if small:
            c.setFont("M-R", 6); c.drawString(x + pdfmetrics.stringWidth(text, "M-R", 7.5) + 4, y, small)

    def field(self, name, x, y, w, label=None, small=None, h=16, fontsize=9):
        """Camp de text amb línia a sota. y = línia base de l'etiqueta."""
        c = self.c
        if label:
            self.label(x, y, label, small)
        ly = y - 20
        c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(x, ly, x + w, ly)
        self.form.textfield(name=name, x=x, y=ly + 1, width=w, height=h, borderWidth=0,
                            fillColor=None, borderColor=None, textColor=TEXT, fontName="Helvetica",
                            fontSize=fontsize, forceBorder=False)
        return ly

    def inline_field(self, name, x, y, w, h=14):
        c = self.c
        c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(x, y - 2, x + w, y - 2)
        self.form.textfield(name=name, x=x, y=y - 1, width=w, height=h, borderWidth=0, fillColor=None,
                            borderColor=None, textColor=TEXT, fontName="Helvetica", fontSize=9, forceBorder=False)

    def check(self, name, x, y, text, font="M-R", size=9):
        c = self.c
        c.setStrokeColor(BLUE); c.setLineWidth(0.9); c.rect(x, y - 1.5, 10, 10, stroke=1, fill=0)
        self.form.checkbox(name=name, x=x, y=y - 1.5, size=10, borderWidth=0, borderColor=None,
                           fillColor=None, buttonStyle="check", textColor=BLUE, forceBorder=False)
        c.setFillColor(TEXT); c.setFont(font, size); c.drawString(x + 17, y, text)
        return x + 17 + pdfmetrics.stringWidth(text, font, size)

    def textarea(self, name, x, y, w, h):
        c = self.c
        c.setStrokeColor(LINE); c.setLineWidth(0.6); c.roundRect(x, y - h, w, h, 4)
        self.form.textfield(name=name, x=x + 2, y=y - h + 2, width=w - 4, height=h - 4, borderWidth=0,
                            fillColor=None, borderColor=None, textColor=TEXT, fontName="Helvetica",
                            fontSize=9, fieldFlags="multiline", forceBorder=False)

    def para(self, x, y, w, html, size=9, leading=13.5, color=TEXT, font="M-R"):
        st = ParagraphStyle("p", fontName=font, fontSize=size, leading=leading, textColor=color)
        p = Paragraph(html, st)
        _, h = p.wrap(w, 1000)
        p.drawOn(self.c, x, y - h)
        return y - h

    def signbox(self, x, y, w, h):
        c = self.c
        c.setStrokeColor(BORDER); c.setDash(3, 3); c.roundRect(x, y - h, w, h, 6); c.setDash()
        c.setFillColor(MUTED); c.setFont("M-R", 7); c.drawString(x + 10, y - 13, "Signatura")

    def _wrap(self, text, font, size, maxw):
        words, lines, cur = text.split(), [], ""
        for wd in words:
            t = (cur + " " + wd).strip()
            if pdfmetrics.stringWidth(t, font, size) <= maxw:
                cur = t
            else:
                lines.append(cur); cur = wd
        lines.append(cur)
        return lines

    def save(self):
        self.c.showPage(); self.c.save()
