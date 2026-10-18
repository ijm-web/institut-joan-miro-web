"""Converteix els fulls «Criteris de qualificació … 25-26» (un per nivell, una pestanya per matèria)
al format de les pestanyes d'importació de programacions_db.

    python3 lib/programacions/importa_criteris.py CARPETA_XLSX SORTIDA.xlsx

CARPETA_XLSX ha de contenir 1ESO.xlsx, 2ESO.xlsx, 3ESO.xlsx, 4ESO.xlsx, 1BAT.xlsx i 2BAT.xlsx
(descarregats de Drive com a Excel). La sortida té tres pestanyes:
  imp_criteris     : origen | nivell | full | trimestre | ordre | activitat | percentatge | competencies | competencia_digital
  imp_competencies : origen | codi | descripcio
  imp_info         : origen | nivell | full | criteri_aprovar | recuperacio | observacions | avisos

Regles (vegeu LEGIR_PROGRAMACIONS.md):
  - Es fa servir la primera columna «Percentatge». Les columnes de pes per bloc (Català, Castellà,
    Tecnologia) són sumes de la primera i s'ignoren.
  - Percentatges 0-1 → 0-100.
  - Un percentatge compartit per diverses activitats (cel·la combinada) → una sola activitat
    amb els noms units per « · » i la unió de competències.
  - Percentatges no numèrics (p. ex. «(+/-)10%») → percentatge buit i nota a «avisos».
"""
import re
import sys
import unicodedata

import openpyxl
from openpyxl import Workbook

FITXERS = {"1ESO": "ESO 1r", "2ESO": "ESO 2n", "3ESO": "ESO 3r", "4ESO": "ESO 4t", "1BAT": "BAT 1r", "2BAT": "BAT 2n"}
TRI = re.compile(r"^\s*([123])\s*(r|n|er|on)?\b", re.I)
CODI = re.compile(r"^\s*(?:CE|C|Competència específica|Competencia especifica)\s*\.?\s*(\d{1,2})\s*[\.:\-–\"“]?\s*(.*)$", re.I | re.S)
BOILER = ("percentatge =", "competència específica =", "competencia especifica =")


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s).strip()


def txt(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r"[ \t]+", " ", str(v)).strip()


def codis(valor, prefix):
    """«CE1/CE3», «C2 C4», «CE1, CE3» → ['CE1', 'CE3']. Altres textos es mantenen."""
    sortida = []
    for tros in re.split(r"[/,;\n]+|\s+i\s+|\s{1,}(?=C)", txt(valor)):
        tros = tros.strip().strip(".")
        if not tros:
            continue
        m = re.match(r"^(CE|CD|C)\s*(\d{1,2})$", tros, re.I)
        tros = f"{prefix}{m.group(2)}" if m else tros
        if tros not in sortida:
            sortida.append(tros)
    return sortida


def mapa_combinades(ws):
    """(fila, col) → (fila_superior, col) per a totes les cel·les combinades."""
    m = {}
    for rg in ws.merged_cells.ranges:
        for r in range(rg.min_row, rg.max_row + 1):
            for c in range(rg.min_col, rg.max_col + 1):
                m[(r, c)] = (rg.min_row, rg.min_col, rg.max_row)
    return m


def analitza(ws, nivell):
    origen = f"{nivell} · {ws.title.strip()}"
    comb = mapa_combinades(ws)
    val = lambda r, c: ws.cell(r, c).value if c else None  # noqa: E731
    maxc = min(ws.max_column, 30)

    # --- capçalera
    hdr, cols = None, {}
    for r in range(1, min(ws.max_row, 8) + 1):
        fila = [norm(val(r, c)) for c in range(1, maxc + 1)]
        if any("activitat avaluativa" in x for x in fila):
            hdr = r
            for c, x in enumerate(fila, 1):
                if not x:
                    continue
                if "activitat" in x and "act" not in cols:
                    cols["act"] = c
                elif x.startswith("percentatge") and "pct" not in cols:
                    cols["pct"] = c
                elif x.startswith("competencia especifica") and "ce" not in cols:
                    cols["ce"] = c
                elif x.startswith("competencia digital") and "cd" not in cols:
                    cols["cd"] = c
                elif x.startswith("competencia personal") or x.startswith("competencies personal"):
                    cols["cps"] = c
                elif "resum competencies especifiques" in x or re.match(r"^ce ?1\b", x):
                    cols.setdefault("cat", c)
            break
    if hdr is None:
        hdr = 1
        cols = {"act": 2, "pct": 3, "ce": 4, "cd": 5, "cat": 7}
    cols.setdefault("tri", cols["act"] - 1)
    cols.setdefault("pct", cols["act"] + 1)
    cat = cols.get("cat") or 99

    # Alguns fulls tenen una columna de més a les dades («Opt | 1r | Activitat…»): es desplacen les columnes.
    mostres = [txt(val(r, cols["act"])) for r in range(hdr + 1, min(ws.max_row, hdr + 8) + 1)]
    if sum(1 for x in mostres if TRI.match(x) and len(x) < 5) >= 3:
        for k in ("tri", "act", "pct", "ce", "cd", "cps"):
            if k in cols:
                cols[k] += 1

    def cel(r, c):
        """Valor d'una cel·la; si és dins d'una combinació, el de la cel·la superior."""
        if not c:
            return None
        k = comb.get((r, c))
        return val(k[0], k[1]) if k else val(r, c)

    # --- activitats
    files, r = [], hdr + 1
    final = hdr
    while r <= ws.max_row:
        t = txt(cel(r, cols["tri"]))
        m = TRI.match(t)
        primera = norm(val(r, 1)) + " " + norm(val(r, 2))
        if not m and any(k in primera for k in ("observacions", "criteri per aprovar", "criteris per aprovar")):
            break
        if m:
            final = r
            act = txt(val(r, cols["act"]))
            if act:
                de = lambda c: cel(r, c)  # noqa: E731
                k = comb.get((r, cols["pct"]))
                grup = k[0] if (k and k[2] > k[0]) else None
                files.append({
                    "fila": r, "trimestre": f"{m.group(1)}{'r' if m.group(1) in '13' else 'n'}",
                    "activitat": act, "pct": val(k[0], k[1]) if k else val(r, cols["pct"]), "grup": grup,
                    "ce": codis(de(cols.get("ce")), "CE"),
                    "cps": txt(de(cols.get("cps"))) if cols.get("cps") else "",
                    "cd": codis(de(cols.get("cd")), "CD"),
                })
        r += 1

    avisos = []
    nums = [f["pct"] for f in files if isinstance(f["pct"], (int, float))]
    escala = 100 if nums and max(nums) <= 1 else 1

    # agrupa les activitats que comparteixen percentatge
    criteris = []
    for f in files:
        if f["grup"] and criteris and criteris[-1].get("grup") == f["grup"] and criteris[-1]["trimestre"] == f["trimestre"]:
            g = criteris[-1]
            g["activitat"] += " · " + f["activitat"]
            g["ce"] += [x for x in f["ce"] if x not in g["ce"]]
            g["cd"] += [x for x in f["cd"] if x not in g["cd"]]
            continue
        p = f["pct"]
        if isinstance(p, (int, float)) and not isinstance(p, bool):
            p = round(p * (100 if p < 1 else escala), 2)
        elif txt(p):
            m = re.search(r"(\d+(?:[.,]\d+)?)\s*%", txt(p))
            avisos.append(f"{f['trimestre']} trimestre · «{f['activitat']}»: percentatge «{txt(p)}»")
            p = ""
        else:
            p = ""
        criteris.append({**f, "pct": p, "ce": list(f["ce"]), "cd": list(f["cd"])})
    for i, c in enumerate(criteris):
        c["ordre"] = i + 1

    cps = []
    for f in files:
        if f.get("cps") and f["cps"] not in cps:
            cps.append(f["cps"])

    for t in ("1r", "2n", "3r"):
        s = sum(c["pct"] for c in criteris if c["trimestre"] == t and isinstance(c["pct"], (int, float)))
        if any(c["trimestre"] == t for c in criteris) and abs(s - 100) > 0.01:
            avisos.append(f"{t} trimestre: els percentatges sumen {round(s, 2)} %")

    # --- textos (a l'esquerra del catàleg de competències)
    seccions = {"observacions": [], "aprovar": [], "recuperar": []}
    actual = None
    for r in range(final + 1, ws.max_row + 1):
        trossos = [txt(val(r, c)) for c in range(1, min(cat, maxc + 1))]
        linia = " ".join(x for x in trossos if x).strip()
        if not linia:
            continue
        n = norm(linia)
        if n.startswith("observacions"):
            actual = "observacions"; linia = linia.split(":", 1)[1].strip() if ":" in linia else ""
        elif "criteri per recuperar" in n or "criteris per recuperar" in n or n.startswith("recuperacio"):
            actual = "recuperar"; linia = linia.split(":", 1)[1].strip() if ":" in linia else ""
        elif "criteri per aprovar" in n or "criteris per aprovar" in n:
            actual = "aprovar"; linia = linia.split(":", 1)[1].strip() if ":" in linia else ""
        if not linia or actual is None or n.startswith(BOILER) or len(linia) < 2:
            continue
        if norm(linia).rstrip(":") == "un alumne aprova la materia si":
            continue
        linia = re.sub(r"^Un alumne aprova la mat[eè]ria si:\s*\|?\s*", "", linia)
        seccions[actual].append(linia)

    # --- catàleg de competències específiques
    comp, ultim = [], None
    if cols.get("cat"):
        for r in range(hdr, ws.max_row + 1):
            v = " ".join(txt(val(r, c)) for c in range(cat, min(cat + 2, maxc) + 1) if txt(val(r, c)))
            if not v:
                continue
            n = norm(v)
            if n.startswith(("competencies transversals", "resum de competencies", "resum competencies digitals")):
                break
            if "resum competencies especifiques" in n and len(n) < 60:
                continue
            m = CODI.match(v)
            if m and m.group(2).strip():
                codi = f"CE{int(m.group(1))}"
                if codi not in [x[0] for x in comp]:
                    comp.append([codi, m.group(2).strip().strip('"”“ ')])
                    ultim = comp[-1]
            elif ultim is not None and not m:
                ultim[1] += " " + v

    return origen, criteris, comp, {
        "aprovar": "\n".join(seccions["aprovar"]), "recuperar": "\n".join(seccions["recuperar"]),
        "observacions": "\n".join(seccions["observacions"] + (["Competència personal i social: " + "; ".join(cps)] if cps else [])),
        "avisos": "\n".join(avisos),
    }


def main(carpeta, sortida):
    wb_out = Workbook()
    wc = wb_out.active; wc.title = "imp_criteris"
    wc.append(["origen", "nivell", "full", "trimestre", "ordre", "activitat", "percentatge", "competencies", "competencia_digital"])
    wk = wb_out.create_sheet("imp_competencies"); wk.append(["origen", "codi", "descripcio"])
    wi = wb_out.create_sheet("imp_info")
    wi.append(["origen", "nivell", "full", "criteri_aprovar", "recuperacio", "observacions", "avisos"])
    resum = []
    for fitxer, nivell in FITXERS.items():
        wb = openpyxl.load_workbook(f"{carpeta}/{fitxer}.xlsx", data_only=True)
        for ws in wb.worksheets:
            if ws.sheet_state != "visible" or norm(ws.title) == "exemple":
                continue
            origen, crit, comp, info = analitza(ws, nivell)
            for c in crit:
                wc.append([origen, nivell, ws.title.strip(), c["trimestre"], c["ordre"], c["activitat"], c["pct"],
                           ", ".join(c["ce"]), ", ".join(c["cd"])])
            for codi, d in comp:
                wk.append([origen, codi, d])
            wi.append([origen, nivell, ws.title.strip(), info["aprovar"], info["recuperar"], info["observacions"], info["avisos"]])
            resum.append((origen, len(crit), len(comp), bool(info["aprovar"]), bool(info["recuperar"]), info["avisos"].count("\n") + (1 if info["avisos"] else 0)))
    for ws in (wc, wk, wi):
        for col in ws.columns:
            ws.column_dimensions[col[0].column_letter].width = 22
    wb_out.save(sortida)
    return resum


if __name__ == "__main__":
    for r in main(sys.argv[1], sys.argv[2]):
        print(" | ".join(str(x) for x in r))
