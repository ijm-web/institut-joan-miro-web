# Programacions (àrea privada) · com funciona i com activar-la

Adreça: **https://institutjoanmiro.netlify.app/programacions**

## Què hi ha

1. **Accés** amb el compte de Google de l'escola (botó «Inicia la sessió amb Google").
2. **Portada PROGRAMACIONS** amb els apartats: **Gestió Criteris de Qualificació** i **Programacions de matèries** (ESO).
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

Els enllaços «Criteris de qualificació (PDF)» de **Estudis › ESO** (un per nivell) i **Estudis › Batxillerat** (1r i 2n) generen al moment un PDF amb els criteris de totes les matèries d'aquell nivell que tenen dades a programacions_db del **curs publicat** (`config › curs_publicat`), i l'obren en una pestanya nova.

- Dades: `GET /api/criteris-publics?nivell=ESO%201r` (funció `criteris-publics.mjs`, pública, sense correus) → acció `publics` de l'Apps Script. Resposta guardada 5 minuts: un canvi desat a Programacions (o de `curs_publicat`) pot trigar uns minuts a sortir al PDF públic.
- PDF: `src/assets/js/criteris-pdf.js` (el mateix generador que fa servir Programacions), textos de capçalera en l'idioma de la pàgina; el contingut és el que han escrit els departaments.
- Portada amb la llista de matèries publicades i la data d'actualització; si encara no n'hi ha cap, ho diu.
- Codis de nivell a `eso.json › curr.cursos[].nivell` i `batxillerat.json › qual.blocs[].nivell`.
- **Cal actualitzar l'Apps Script** de programacions_db amb el `Code.gs` d'aquest repositori (accions `publics` i `config`), executar `configura` (afegeix `curs_publicat` i `curs_gestio` a config) i desplegar una versió nova.

## Programacions de matèries (ESO)

Ruta `#materies` de /programacions. Per a cada matèria d'ESO dels departaments de l'usuari i per a cada curs:

- **Formulari per apartats (A–K)** a l'esquerra i **vista prèvia del document final** a la dreta (en mòbil, botons «Formulari / Vista prèvia»). La vista prèvia s'actualitza mentre s'escriu i marca en groc les dades pendents.
- **Què s'hi escriu:** identificació (àmbit, tipus, hores, responsable, docents, dates), presentació, objectius, criteris d'avaluació de cada competència específica, competències transversals (amb els indicadors de competència digital), seqüenciació per trimestres (continguts, repte, criteris i sessions), metodologia, pes per blocs i condicions, recuperació de pendents, millora de nota, mesures d'atenció a la diversitat, lectures i sortides, i el registre de versions.
- **Què NO s'hi escriu (ve de la Gestió Criteris de Qualificació):** les competències específiques, les activitats avaluatives de cada trimestre, el criteri per aprovar, la recuperació i les observacions. Així no hi ha dades duplicades.
- **Textos comuns** (iguals a totes les programacions: marc normatiu, avaluació, nivells d'assoliment, modificació dels criteris, PI…): pestanya `textos_comuns` de programacions_db (clau · valor · descripcio). Si una clau és buida, es fa servir el text per defecte (`TEXTOS_PER_DEFECTE` a Code.gs i `TEXTOS` a `src/assets/js/programacio-doc.js`). `{curs}` es canvia pel nivell («1r d'ESO»).
- **Estat:** completa quan té els 9 apartats bàsics (identificació, presentació, objectius, criteris d'avaluació de totes les CE, continguts dels 3 trimestres, metodologia, criteris de qualificació complets, mesures universals i data d'aprovació).
- **Alta / baixa / modificació / consulta:** Desa, Descarta, «Dona de baixa» (queda a l'historial), «Carrega dades…» (la mateixa matèria del curs anterior o una altra programació del curs: d'una altra matèria no es copien la identificació, els criteris d'avaluació ni la seqüenciació). Control de conflictes com als criteris.
- **Informes:** PDF (jsPDF) i Excel (SheetJS de cdnjs) d'una matèria o del departament (amb un resum de l'estat de totes les matèries).
- Permisos, curs de gestió i `config › estat`: els mateixos que la Gestió Criteris de Qualificació.

Dades: pestanya `programacions` de programacions_db (curs · id_materia · departament · un JSON per apartat · data · desat_per). Funció `GET/POST /api/programacions/materies` (`programacions-materies.mjs`) → accions `prog_inici`, `prog_materia`, `prog_desa`, `prog_esborra` de l'Apps Script.

**Activació:** enganxar el `Code.gs` nou a l'Apps Script de programacions_db, executar **configura** (crea `programacions` i `textos_comuns`) i desplegar una versió nova. No cal cap variable nova a Netlify.

### Nivells d'assoliment de l'ESO

Els PDF de criteris de qualificació d'ESO (Programacions i pàgina d'ESO) i l'editor de criteris de les matèries d'ESO mostren el text i la taula dels nivells NA/AS/AN/AE (`CriterisPdf.ASSOLIMENT` a `criteris-pdf.js`).

## Dos cursos: publicat i de gestió (`programacions_db › config`)

| Clau | Per a què serveix |
|---|---|
| `curs_publicat` | Curs dels PDF públics de les pàgines d'ESO i Batxillerat. |
| `curs_gestio` | Curs que s'obre a Programacions i l'únic que poden modificar els departaments (els altres cursos, de consulta; els admins els poden modificar tots). |

Canvi de curs habitual: al juny/juliol es posa `curs_gestio` = curs vinent perquè els departaments el preparin (amb «Carrega dades…» del curs anterior) mentre el web continua mostrant `curs_publicat`; al setembre es canvia `curs_publicat` al curs nou. Si config no té `curs_gestio`, es fa servir el curs escolar actual.

## Permisos

- Entra qui té el correu a la pestanya **departaments** de **joanmiro_db** (fila del curs de gestió) o a `config › admins`. És la mateixa llista que dona accés al web de llibres (acció `loginEmail` del pont).
- Cada persona només veu i modifica les matèries dels seus departaments (pestanya **materies** de joanmiro_db del curs seleccionat). Els admins les veuen totes.
- Només es pot modificar el curs de gestió (`config › curs_gestio`); la resta són de consulta (excepte per als admins).
- `config › estat = tancat` (a programacions_db) bloqueja les desades de tothom menys dels admins. `config › missatge` mostra un avís a dalt de la gestió (p. ex. el termini).
- Si `config › curs_gestio` és buit, el curs de gestió és el curs escolar actual (de l'1 d'agost al 31 de juliol) o el de la variable `PROG_CURS`.

## Dades: programacions_db

Full **programacions_db** (`1qQ7tiVMl9MsHkEssmUdXxyJnp_PdNeElp_oFxFH2_Ag`). Pestanyes (les crea la funció `configura`):

| Pestanya | Columnes |
|---|---|
| `criteris` | curs · id_materia · departament · trimestre · ordre · activitat · percentatge · competencies · competencia_digital · data · desat_per |
| `competencies` | curs · id_materia · departament · codi · descripcio · data · desat_per |
| `materies_info` | curs · id_materia · departament · criteri_aprovar · recuperacio · observacions · data · desat_per |
| `competencies_digitals` | codi · descripcio (catàleg comú CD1-CD11; s'edita directament al full) |
| `historial` | data_canvi · canvi_per · accio · curs · id_materia · contingut (estat anterior en JSON) |
| `config` | estat (obert/tancat) · missatge · curs_publicat · curs_gestio |
| `imp_criteris`, `imp_competencies`, `imp_info` | dades 2025-2026 per importar (opcional) |
| `programacions` | curs · id_materia · departament · identificacio · presentacio · objectius · criteris_avaluacio · transversals · sequencia · metodologia · avaluacio · diversitat · especifics · revisio · data · desat_per (un JSON per apartat) |
| `textos_comuns` | clau · valor · descripcio (textos comuns de les programacions) |

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

`src/programacions.njk` · `src/assets/js/programacions.js` · `src/assets/js/programacions-materies.js` · `src/assets/js/programacio-doc.js` · `src/assets/js/progres.js` · `src/assets/js/criteris-pdf.js` · `netlify/functions/criteris-publics.mjs` · `netlify/functions/programacions-materies.mjs` · `src/assets/css/programacions.css` · `netlify/functions/programacions-{config,login,contingut,criteris,sortir}.mjs` · `netlify/lib/programacions.mjs` · `apps-script/programacions_db/Code.gs` · `lib/programacions/importa_criteris.py`.

Funcions: `GET /api/programacions/criteris?curs=` (dades) · `POST /api/programacions/criteris` amb `accio` = `desa` | `esborra` | `materia` | `importacio`.
