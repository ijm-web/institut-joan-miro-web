# GESTIO · com funciona i com activar-la

Àrea privada de gestió del centre a **/gestio**: s'hi entra amb el compte de Google de l'escola i cada persona veu només els mòduls que té assignats algun dels seus equips. Disseny i decisions: document «GESTIO - Proposta de disseny» (carpeta local `docs`, al costat de la carpeta del projecte).

Mòduls: **Professorat**, **Alumnat** (1r i 2n d'ESO), **PAS** (personal d'administració i serveis, PAS 28) i **Equips i permisos** (només direcció).

## Peces

| Peça | On és | Què fa |
|---|---|---|
| Pàgina | `src/gestio.njk`, `src/assets/js/gestio.js`, `src/assets/css/gestio.css` | Accés, portada amb targetes, graella (Tabulator 6.3.1 de cdnjs), finestres de camps i permisos |
| Funcions de Netlify | `netlify/functions/gestio-{config,login,api,sortir}.mjs`, `netlify/lib/gestio.mjs` | Accés amb Google, galeta de sessió (8 h) i pas de les peticions a l'Apps Script amb el correu de la sessió |
| Apps Script | `apps-script/gestio_db/Code.gs` (còpia de referència) | Dades i **permisos**: qui pot fer què ho decideix aquí, a cada petició |
| Full **ijm_nucli_db** | Google Sheets (aquí hi viu l'Apps Script) | Pestanyes `config`, `professorat`, `equips`, `membres`, `moduls`, `permisos`, `camps`, `historial` |
| Full **ijm_alumnat_db** | Google Sheets (fitxer a part) | Pestanya `alumnes`. No té Apps Script propi: l'obre el d'ijm_nucli_db amb l'adreça de `config › db_alumnat` |

Programacions no es toca: GESTIO té les seves funcions, la seva galeta (`ijm_gestio`) i els seus fulls.

## Nivells

| Nivell | Pot |
|---|---|
| Consulta | Veure, filtrar, ordenar i exportar (Excel, PDF). Al Professorat només veu Nom, cognoms, Especialitat, els dos correus i Càrrec (i no veu les baixes); a l'Alumnat ho veu tot |
| Edició | A més, alta, baixa i modificació de files |
| Admin | A més, camps (columnes) del mòdul (*Gestió camps*). Els permisos, només els administradors globals des de **Equips i permisos** |
| Admin global | L'equip directiu (`EQ-DIR`, permís `*` admin) i els correus de `config › admins`: tots els mòduls, el mòdul Equips, qui és a cada equip i el nivell admin |

Els permisos es donen a **equips** (pestanya `permisos`), mai a persones. Un docent pot ser a **diversos equips** alhora (una fila per pertinença a la pestanya `membres`); si dos equips li donen nivells diferents en un mòdul, val el més alt.

**Tipus d'equip**: *gestió* (direcció, coordinacions, secretaria…) o *docent* (equips de nivell, departaments…). Només serveix per classificar i filtrar: els dos tipus funcionen igual (membres i permisos).

**Membres d'un equip** (només direcció): al mòdul **Equips i permisos**, clic a la cel·la *Membres* → llista del professorat i del PAS (marcats «PAS · Administració», «PAS · Consergeria»…) amb cercador → marcar/desmarcar → *Desa els membres*. També es pot fer des de la columna *Equips* del mòdul Professorat (un docent → els seus equips). La consulta és la mateixa columna; cada canvi queda a l'historial. Un docent o una persona del PAS amb estat **baixa** ja no pot entrar (amb «baixa laboral» o «substitut», sí). PAS 28: la columna de la pestanya `membres` es diu `id_membre` (hi van codis `PRO-…` i `PAS-…`). Per donar accés al PAS: crear els equips (p. ex. `EQ-ADM` Administració, `EQ-CON` Consergeria), afegir-hi les persones del PAS i donar-los permisos a la matriu.

**Permisos** (PAS 26-27): només els gestionen els administradors globals (equip directiu) des de **Equips i permisos › Permisos** (matriu de tots els equips i mòduls). Dins dels mòduls ja no hi ha botó Permisos i l'Apps Script tampoc no deixa que l'admin d'un sol mòdul en doni. L'administració global de l'equip directiu (`EQ-DIR` · `*` · admin) no es pot treure des del web.

**Accés amb Google**: el nom que surt a la finestra de Google («Llibres de text») és el de l'aplicació configurada a Google Cloud per al `GOOGLE_CLIENT_ID` (el mateix que fa servir Programacions). Es canvia a console.cloud.google.com › el projecte del client › **Google Auth Platform › Branding** (nom de l'aplicació: «Institut Joan Miró») i, a **Audience**, el tipus d'usuari **Intern** (només comptes @institutjoanmiro.cat, sense pantalla de consentiment per a cada usuari nou).

## Activació (una sola vegada)

### 1. ijm_nucli_db i l'Apps Script
1. A Google Drive (a la carpeta de treball), crea un full de càlcul nou que es digui **ijm_nucli_db**. No el comparteixis amb ningú més.
2. Extensions › Apps Script. Esborra el contingut de `Code.gs` i enganxa-hi `apps-script/gestio_db/Code.gs`. Desa.
3. ⚙️ Configuració del projecte › Propietats de l'script › Afegeix: `GESTIO_SECRET` = un text llarg inventat (p. ex. 40 lletres i xifres). Guarda'l: el necessitaràs a Netlify.
4. A l'editor, tria la funció **configura** › ▶ Executa (autoritza-la). Crea les pestanyes, els mòduls, els camps i l'equip `EQ-DIR` amb permís admin a tot. Es pot tornar a executar sempre que es vulgui: no esborra dades i, si el full ve d'una versió anterior, l'adapta (vegeu «Actualitzar una instal·lació anterior»).
5. Al full, pestanya `config`: posa el teu correu a **admins** (accés d'emergència) i, a **font_professorat**, l'URL del full actual de professorat (i a `font_professorat_pestanya` el nom de la pestanya, si no és la primera).
6. A l'editor, executa **importaProfessorat**. Al registre d'execució diu quantes persones ha importat i quines columnes ha reconegut. Només importa les columnes previstes (Nom, 1r Cognom, 2n Cognom, NIF, Especialitat, email xtec, email institutjoanmiro, Jornada, Anys, Català, Càrrec). Definitiu, Comissió Serveis, Provisional i Interí es converteixen en un sol camp, **Situació laboral** (la columna que té la X). La jornada «Completa» passa a «Sencera» i «2/3» a «⅔». Tothom entra amb estat «actiu». Si la tornes a executar, no duplica (salta els correus que ja hi són).
7. Pestanya `membres`: afegeix una fila per a cada persona de l'equip directiu: `EQ-DIR` | `PRO-00xx` (el codi és a la columna `id_professor` de la pestanya `professorat`). La resta d'equips i membres es poden fer des del web.
8. Desplega › Desplegament nou › Tipus: **Aplicació web** · Executa com a: **Jo** · Qui hi té accés: **Qualsevol** › Desplega. Copia l'URL que acaba en `/exec`.

### 2. ijm_alumnat_db (mòdul Alumnat)
1. A la carpeta de treball, crea un full de càlcul nou que es digui **ijm_alumnat_db** (buit). Compte que hi haurà dades d'alumnes menors: no el comparteixis.
2. A ijm_nucli_db, pestanya `config`:
   - **db_alumnat**: l'URL d'ijm_alumnat_db.
   - **font_alumnat**: els URL dels fulls de registre de 1r i de 2n d'ESO, separats per una coma.
   - **font_alumnat_pestanya**: `Dades` (ja hi és).
3. Executa **configura** (crea la pestanya `alumnes` a ijm_alumnat_db) i després **importaAlumnat**. Google demanarà permís per obrir els altres fulls: accepta-ho.
4. Mira el registre d'execució:
   - quants alumnes ha importat de cada full i quines columnes ha reconegut;
   - «noms separats automàticament»: els alumnes que no eren a la pestanya `Noms` del full de registre. Els cognoms s'han separat per la coma i pels espais; revisa els cognoms compostos;
   - «Cal revisar»: valors que no són a les llistes (p. ex. una optativa antiga) o observacions que no ha entès. Es conserven tal com eren: corregeix-los des del web.
   - Les files de títol dins del full (p. ex. «REPETIDORS DE 1r») se salten. «Cons_Mates» s'entén com a Taller de matemàtiques i «FALSE» en una data, com a buit.
5. Si la tornes a executar, no duplica (salta els alumnes amb el mateix nom i cognoms).

### Actualitzar una instal·lació anterior (PAS 21 a 27)
1. Apps Script: enganxa el `Code.gs` nou, desa i executa **configura**. Al registre surt què ha canviat:
   - PAS 28: es crea la pestanya **`pas`** i el mòdul **PAS** (amb els seus camps); a `membres`, la columna `id_professor` passa a **`id_membre`**; a l'alumnat, els camps `grup_2526` / `grup_2627` passen a **`grup_anterior`** / **`grup_actual`** (també les capçaleres de la pestanya `alumnes`), s'hi afegeixen **Nivell** (s'omple sol a partir del grup actual) i **Decisió final**, i a `config` apareixen **curs** (`2026-2027`) i `copia_tancament`. Els títols «Grup-Classe 25-26 / 26-27» surten de `config › curs`.
   - La pestanya `persones` passa a dir-se **`professorat`**, i la columna `id_persona` passa a **`id_professor`** (també a `membres`).
   - Els camps Estat, NIF, Jornada, Situació laboral, Anys i Català passen a ser visibles només des d'edició (el nivell consulta veu Nom, cognoms, Especialitat, correus i Càrrec). Només es fa una vegada: si després en tornes a fer visible algun, es respecta.
   - Apareix el mòdul **Alumnat** i els seus camps.
   - PAS 25: els codis del professorat passen de `PER-0001` a **`PRO-0001`** (pestanyes `professorat` i `membres`; l'historial antic es queda com era).
   - Si venies del PAS 21 o 22: també omple **estat** i **situacio**, treu les columnes antigues i els tres camps de nom complet, i passa Jornada a llista, NIF a NIF/NIE i Correu XTEC a `@xtec.cat`.
2. Fes el punt 2 (ijm_alumnat_db).
3. Desplega › Gestiona els desplegaments › ✏️ › Versió: **Versió nova** › Desplega (l'URL `/exec` no canvia).

### 3. Variables d'entorn a Netlify
Site configuration › Environment variables › Add a variable (àmbit «All» o, com a mínim, Production i Local development):

| Variable | Valor |
|---|---|
| `GESTIO_SCRIPT_URL` | L'URL `/exec` del pas 1.8 |
| `GESTIO_SCRIPT_SECRET` | El mateix text que `GESTIO_SECRET` del pas 1.3 |
| `GESTIO_SECRET` | (opcional) un altre text llarg per signar la galeta de sessió; si no hi és, es fa servir `PROGRAMACIONS_SECRET` |

`GOOGLE_CLIENT_ID` ja hi és (Programacions). Després: Deploys › Trigger deploy › Deploy site. El mòdul Alumnat no necessita cap variable nova.

### 4. Comprovar-ho
1. Obre https://institutjoanmiro.netlify.app/gestio i entra amb el teu compte.
2. Han de sortir les targetes **Professorat**, **Alumnat**, **PAS** i **Equips i permisos**.
3. Equips i permisos: crea els equips (p. ex. `EQ-COORD` Coordinacions, `EQ-SEC` Secretaria, `EQ-1ESO` Equip docent 1r ESO) i desa.
4. Professorat: a la columna **Equips** de cada docent, tria els seus equips i desa.
5. **Equips i permisos › Permisos**: matriu equips × mòduls; tria el nivell de cada equip a cada mòdul (o a «Tots els mòduls») i *Desa els canvis*.

## Ús dels mòduls
Comú a Professorat i Alumnat:
- **Càrrega**: les dades d'un mòdul es llegeixen la primera vegada que s'obre; si tornes a la portada i hi tornes a entrar, no es tornen a llegir. **Actualitza** les torna a llegir del full (p. ex. si algú altre hi ha fet canvis).
- **Pantalla del mòdul** (PAS 27): en entrar en un mòdul (a l'ordinador) s'amaguen la barra d'idiomes, el menú i la foto; la graella ocupa la resta de la finestra i només hi ha un scroll vertical, el de la graella. Per tornar: *Gestió* (a dalt a l'esquerra).
- **Filtres**: a sota de **totes** les capçaleres hi ha dos filtres (ja no hi ha cercador general): la **casella** (filtre ràpid: escriviu-hi un tros del valor) i l'**embut** del costat, que obre una caixa amb tots els valors per marcar-ne **diversos** (botons *Tots*, *Cap*, *Cancel·la* i *Accepta*). A les llistes i sí/no, els valors previstos; als altres camps (noms, correus, especialitat…), els valors diferents de la columna, amb una cerca dins la caixa si n'hi ha molts (*Tots* i *Cap* actuen sobre els que es veuen). Es poden combinar: casella i embut de la mateixa columna, i filtres de columnes diferents. Quan l'embut filtra, es veu en blau. Les files amb estat «baixa» no surten si no es marca «Mostra també les baixes» **o** es filtra la columna Estat per «baixa».
- **Recuperar una baixa**: marca «Mostra també les baixes» (o filtra Estat = baixa), prem **Reactiva** a la fila (o tria un altre estat a la cel·la) i **Desa els canvis**.
- **Nom i 1r cognom** queden fixats a l'esquerra quan et desplaces. El codi intern (`PRO-…`, `ALU-…`) no es mostra.
- **Modificar**: clic a la cel·la, escriure i Enter (o Tab per passar a la següent). Les cel·les canviades queden en taronja fins que es prem **Desa els canvis** (la barra surt damunt de la graella). Cada cel·la es comprova en sortir: si el valor no té el format correcte, queda en vermell i surt un avís. L'Apps Script ho torna a comprovar en desar.
- **Alta**: «+ Afegeix docent / alumne / persona» (fila verda, a dalt de tot); el codi es posa en desar.
- **Selecció** (PAS 28, des d'edició): la primera columna té una casella per fila (la de la capçalera marca totes les files que es veuen amb els filtres). Amb files marcades surt **Aplica a la selecció**: es tria un camp de llista o sí/no i un valor, i es posa a totes les files marcades (en taronja, sense desar). **Treu la selecció** desmarca. Després, *Desa els canvis*.
- **Importa fitxer** (alta massiva, PAS 28, des d'edició): *Baixa la plantilla* (Excel amb les columnes del mòdul, una pestanya amb els valors permesos i les instruccions) → omplir-la o copiar-hi les dades de la preinscripció/matrícula → pujar-la (xlsx, xls o csv). Les columnes es reconeixen pel nom (també «Cognoms, Nom» o «Cognoms i nom», que es separen sols). Abans d'afegir, mostra quantes files ha llegit, les columnes reconegudes i les que no, les files que ja hi són (mateix nom i cognoms, no s'afegeixen si no es tria *Afegeix-les igualment*) i les dades per corregir. Les files entren a dalt de la graella **sense desar**: es revisen (les dades incorrectes en vermell) i *Desa els canvis*.
- **Baixa**: botó «Baixa» de la fila (posa l'estat «baixa»). La **paperera** esborra del tot (només admin; queda a l'historial).
- **Descarta**: torna a deixar la graella com estava en l'última desada, sense tornar a llegir res del full.
- **Errors**: si alguna dada no és vàlida, no es desa res i les cel·les queden en vermell.
- **Dues persones alhora**: si algú altre ha desat la mateixa fila, avisa i deixa triar entre tornar a carregar o desar la teva versió.
- **Visualització camps**: amagar/mostrar amb els botons **Cap** i **Totes** (es recorda en aquest navegador) i arrossegar per canviar l'ordre.
- **Excel / PDF** (a la dreta, des del nivell consulta): el que es veu (filtres i columnes visibles).
- **Gestió camps** (admin): afegir columnes, canviar-ne el nom, el tipus (text, número, data, llista, sí/no, correu amb domini, NIF/NIE, calculat), els valors, si és obligatòria o única, des de quin nivell es veu i si ve de Clickedu (no s'edita). Una columna no s'esborra: s'arxiva (desmarcar «Actiu»). L'**Estat** és un camp de sistema: sempre és una llista obligatòria i sempre té el valor «baixa».
- **Mòbil**: fitxes de consulta; per editar, ordinador.

### Professorat
- **Estat** (obligatori): actiu, baixa laboral, substitut o baixa. **Situació laboral**: Definitiu, Comissió de serveis, Provisional o Interí. **Jornada**: Sencera, 1/2 o ⅔.
- Formats: correu XTEC acabat en `@xtec.cat`, correu institutjoanmiro acabat en `@institutjoanmiro.cat`, NIF/NIE amb la lletra correcta.
- **Equips**: columna que només veu qui té edició; només la direcció la pot canviar.

### PAS
- Es gestiona com el Professorat (alta a mà: són poques persones). Camps: nom, cognoms, **Estat** (actiu, baixa laboral, substitut, baixa), **Àmbit** (Administració, Consergeria, Altres), NIF, correu institutjoanmiro, telèfon, jornada, horari i càrrec. Codis interns `PAS-001`…
- El nivell consulta veu nom, cognoms, àmbit, correu, horari i càrrec. La columna **Equips** (edició) diu a quins equips és cada persona.

### Alumnat
- Camps, per aquest ordre: nom, cognoms, **Nivell** (obligatori: 1r ESO, 2n ESO), Grup-Classe anterior, Grup-Classe actual, **Estat** (obligatori), **Decisió final**, Optativa 1r, Optativa 2n, Div. mates / català / castellà, Nouvingut, Data arribada, PI/PSP, NESE-A, NESE-B, NEE, Aut. imatge, Aut. dies especials, Aut. medicaments. Els títols dels grups canvien sols cada curs (`config › curs`).
- El grup actual ha de ser del nivell (2n ESO → 2n ESO A…). Pot quedar **buit** (per assignar), com passa després del tancament de curs.
  - **1r d'ESO**: Optativa 2n no s'omple (ratllada); el grup anterior només l'omple qui repeteix 1r; Estat: alumne extern, repeteix 1r o baixa.
  - **2n d'ESO**: Estat: promociona, repeteix 2n, alumne extern o baixa.
- Diversitats, Nouvingut, PI/PSP, NESE i NEE: sí / (buit). **Autoritzacions**: sí / no / (buit = sense resposta).
- **Data arribada**: es pot escriure 15/09/2026; es desa com 2026-09-15 i es comprova que la data existeixi.
- La graella s'ordena per nivell, grup i cognoms.

### Tancament de curs (Alumnat, PAS 28)
Ho pot fer qui té **edició** del mòdul Alumnat (coordinacions de nivell).
1. **Decisió final** (juny, després de l'avaluació final): promociona, repeteix o baixa per a cada alumne que no sigui de baixa. Per fer-ho de pressa: filtrar (p. ex. grup 2n ESO B), marcar totes les files, *Aplica a la selecció* › Decisió final › promociona, i canviar després els casos concrets. *Desa els canvis*.
2. Botó **Tancament de curs**: resum per grup (promocionen, repeteixen, baixa, pendents). Si en queda cap de pendent o hi ha canvis sense desar, no deixa continuar (*Mostra els pendents* els filtra).
3. Marcar la casella de revisió i **Tanca el curs**. L'Apps Script:
   - copia la pestanya `alumnes` a **`copia_<curs>_<data>`** (a ijm_alumnat_db) abans de canviar res;
   - **promociona** → nivell següent, Estat «promociona» (4t ESO → acaba l'etapa: Estat «baixa»); **repeteix** → mateix nivell, Estat «repeteix 1r/2n…»; **baixa** → Estat «baixa»;
   - a tothom: el grup actual passa a grup anterior i el grup actual queda **buit, per assignar**; la Decisió final es buida;
   - el curs avança (`config › curs`: 2026-2027 → 2027-2028) i els títols dels grups canvien (Grup-Classe 26-27 / 27-28); queda a l'historial.
   - Si algun alumne promociona a un nivell que encara no és al mòdul (ara, 2n → 3r ESO), **no tanca** i diu quants són: primer cal tenir el nivell al mòdul (vegeu la proposta d'importació de 3r, 4t i batxillerat al document de disseny).
4. Després: assignar els grups del curs vinent (selecció + *Aplica a la selecció* › Grup) i fer l'alta de l'alumnat nou amb **Importa fitxer** (Estat «alumne extern»).
- **Desfer** (si s'ha fet per error): a l'editor d'Apps Script, executar **desfesTancament**. Torna a posar la pestanya `alumnes` com era abans del darrer tancament (la de després es conserva com a `desfet_<data>`), el curs anterior i els títols. Els canvis fets després del tancament es perden.
- Si dues persones ho intenten alhora, la segona rep «el curs ja s'ha tancat» (no es tanca dues vegades).

## Proves en local
`netlify dev` (vegeu `LEGIR_PROVES_LOCALS.md`) i obre http://localhost:8888/gestio/ — fa servir els fulls reals.
