# Programacions (àrea privada) · com funciona i com activar-la

Adreça: **https://institutjoanmiro.netlify.app/programacions**

## Què hi ha

1. **Accés** amb el compte de Google de l'escola (botó «Inicia la sessió amb Google").
2. **Portada PROGRAMACIONS** amb els apartats. De moment: **Gestió Criteris de Qualificació** (la resta, «properament»).
3. **Gestió Criteris de Qualificació**: per a cada matèria dels departaments de l'usuari i per a cada curs escolar:
   - **Competències específiques** de la matèria: codi + descripció.
   - **Criteris de qualificació** de cada trimestre: activitat avaluativa, percentatge, competències específiques i competència digital (es marquen amb botons a partir dels catàlegs). Es mostra el total per trimestre (ha de sumar 100 %).
   - **Criteri per aprovar**, **mecanismes de recuperació** i **observacions** (text lliure).
   - Alta / baixa / modificació / consulta: botons Afegeix, ✕, ↑↓, Desa, Descarta, «Dona de baixa» (esborra la matèria sencera; queda a l'historial).
   - **Informes**: PDF que es descarrega directament (jsPDF des de cdnjs, amb Montserrat i el logo de `src/assets/programacions/`), de la matèria o del departament (amb portada-resum de l'estat de totes les matèries), i CSV (Excel) de la matèria o del departament.
   - **Barra de progrés** (`src/assets/js/progres.js`) en totes les càrregues i desades. L'Apps Script no informa de l'avanç real: la barra avança sola fins al 90 % i acaba quan arriba la resposta. El mateix fitxer és al web de llibres.
   - Llista de matèries amb l'estat: **Completa** (els tres trimestres sumen 100 %, té competències, criteri per aprovar i recuperació), **En curs** o **Pendent**.
   - **Carrega dades…**: omple l'editor amb la mateixa matèria del curs anterior o amb un dels fulls de criteris 2025-2026 importats. No es desa fins que es prem Desa.
   - Si dues persones editen la mateixa matèria alhora, la segona que desa rep un avís i tria si torna a carregar o si desa la seva versió.

## PDF públics per nivell (pàgines d'ESO i Batxillerat)

Els enllaços «Criteris de qualificació (PDF)» de **Estudis › ESO** (un per nivell) i **Estudis › Batxillerat** (1r i 2n) generen al moment un PDF amb els criteris de totes les matèries d'aquell nivell que tenen dades a programacions_db (curs actual), i l'obren en una pestanya nova.

- Dades: `GET /api/criteris-publics?nivell=ESO%201r` (funció `criteris-publics.mjs`, pública, sense correus) → acció `publics` de l'Apps Script. Resposta guardada 5 minuts: un canvi desat a Programacions pot trigar fins a 5 minuts a sortir al PDF públic.
- PDF: `src/assets/js/criteris-pdf.js` (el mateix generador que fa servir Programacions), textos de capçalera en l'idioma de la pàgina; el contingut és el que han escrit els departaments.
- Portada amb la llista de matèries publicades i la data d'actualització; si encara no n'hi ha cap, ho diu.
- Codis de nivell a `eso.json › curr.cursos[].nivell` i `batxillerat.json › qual.blocs[].nivell`.
- **Cal actualitzar l'Apps Script** de programacions_db amb el `Code.gs` d'aquest repositori (acció `publics`) i desplegar una versió nova.

## Permisos

- Entra qui té el correu a la pestanya **departaments** de **joanmiro_db** (fila del curs de gestió) o a `config › admins`. És la mateixa llista que dona accés al web de llibres (acció `loginEmail` del pont).
- Cada persona només veu i modifica les matèries dels seus departaments (pestanya **materies** de joanmiro_db del curs seleccionat). Els admins les veuen totes.
- Els cursos anteriors a l'actual són només de consulta (excepte per als admins).
- `config › estat = tancat` (a programacions_db) bloqueja les desades de tothom menys dels admins. `config › missatge` mostra un avís a dalt de la gestió (p. ex. el termini).
- El curs actual es calcula sol (de l'1 d'agost al 31 de juliol). Es pot fixar amb la variable `PROG_CURS` (p. ex. `2026-2027`).

## Dades: programacions_db

Full **programacions_db** (`1qQ7tiVMl9MsHkEssmUdXxyJnp_PdNeElp_oFxFH2_Ag`). Pestanyes (les crea la funció `configura`):

| Pestanya | Columnes |
|---|---|
| `criteris` | curs · id_materia · departament · trimestre · ordre · activitat · percentatge · competencies · competencia_digital · data · desat_per |
| `competencies` | curs · id_materia · departament · codi · descripcio · data · desat_per |
| `materies_info` | curs · id_materia · departament · criteri_aprovar · recuperacio · observacions · data · desat_per |
| `competencies_digitals` | codi · descripcio (catàleg comú CD1-CD11; s'edita directament al full) |
| `historial` | data_canvi · canvi_per · accio · curs · id_materia · contingut (estat anterior en JSON) |
| `config` | estat (obert/tancat) · missatge |
| `imp_criteris`, `imp_competencies`, `imp_info` | dades 2025-2026 per importar (opcional) |

`id_materia` = «nivell - matèria», igual que a joanmiro_db (p. ex. `ESO 1r - Matemàtiques`). Les competències d'una activitat es desen com a codis separats per comes (`CE1, CE3`).

## Activació (una sola vegada)

### 1. Apps Script de programacions_db

1. Obriu **programacions_db** › Extensions › Apps Script.
2. Substituïu el contingut de `Code.gs` pel fitxer `apps-script/programacions_db/Code.gs` d'aquest repositori. Deseu.
3. Configuració del projecte (⚙️) › Propietats de l'script › Afegeix: `PROG_SECRET` = un text llarg i aleatori (p. ex. 40 caràcters).
4. Editor › tria la funció **configura** › ▶ Executa (autoritzeu-la). Crea les pestanyes.
5. Desplega › Desplegament nou › Tipus: Aplicació web · Executa com a: **Jo** · Qui hi té accés: **Qualsevol**. Copieu l'URL que acaba en `/exec`.

Cada vegada que es canviï `Code.gs`: Desplega › Gestiona els desplegaments › ✏️ › Versió nova › Desplega (l'URL no canvia).

### 2. Variables d'entorn a Netlify (web de l'institut)

Ja hi ha `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET`, `GOOGLE_CLIENT_ID`, `PROGRAMACIONS_SECRET` (pas 4). Afegiu:

| Variable | Valor |
|---|---|
| `PROG_SCRIPT_URL` | L'URL `/exec` del pas 1.5 |
| `PROG_SCRIPT_SECRET` | El mateix text que `PROG_SECRET` del pas 1.3 |
| `PROG_CURS` | (opcional) curs que s'obre per defecte, p. ex. `2026-2027` |

Després: Deploys › Trigger deploy › Deploy site. Les sessions obertes abans del canvi demanen tornar a entrar (ara la sessió porta els departaments).

### 3. Importar els criteris 2025-2026 (opcional, recomanat)

El fitxer `importacio_criteris_2025-2026.xlsx` (generat amb `lib/programacions/importa_criteris.py` a partir dels sis fulls «Criteris de qualificació … 25-26») té les pestanyes `imp_criteris`, `imp_competencies` i `imp_info`.

programacions_db › Fitxer › Importa › Penja › el fitxer › **Insereix fulls nous**. A partir d'aquí, a cada matèria, «Carrega dades…» ofereix els fulls 2025-2026 del mateix nivell (preselecciona el que té el nom més semblant). Les dades no passen a ser oficials fins que algú les revisa i desa.

Regles de la conversió: percentatges 0-1 → 0-100; un percentatge compartit per diverses activitats (cel·la combinada) → una sola activitat amb els noms units per « · »; la columna de pes per bloc (Català, Castellà, Tecnologia) s'ignora; «Competència personal i social» (Música) passa a observacions; els percentatges no numèrics i els trimestres que no sumen 100 queden com a avisos que es mostren en carregar-los.

### 4. Comprovar-ho

- Amb un compte que consti a `departaments` → portada PROGRAMACIONS → Gestió Criteris de Qualificació → les matèries del vostre departament.
- Amb un compte de l'institut que no hi consti → «Aquest compte no té accés…».
- Amb un compte de Gmail → «Cal entrar amb un compte @institutjoanmiro.cat».

## Fitxers

`src/programacions.njk` · `src/assets/js/programacions.js` · `src/assets/js/progres.js` · `src/assets/js/criteris-pdf.js` · `netlify/functions/criteris-publics.mjs` · `src/assets/css/programacions.css` · `netlify/functions/programacions-{config,login,contingut,criteris,sortir}.mjs` · `netlify/lib/programacions.mjs` · `apps-script/programacions_db/Code.gs` · `lib/programacions/importa_criteris.py`.

Funcions: `GET /api/programacions/criteris?curs=` (dades) · `POST /api/programacions/criteris` amb `accio` = `desa` | `esborra` | `materia` | `importacio`.
