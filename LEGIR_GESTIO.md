# GESTIO · com funciona i com activar-la

Àrea privada de gestió del centre a **/gestio**: s'hi entra amb el compte de Google de l'escola i cada persona veu només els mòduls que té assignats algun dels seus equips. Disseny i decisions: document «GESTIO - Proposta de disseny» (carpeta local `docs`, al costat de la carpeta del projecte).

Mòduls: **Professorat**, **Alumnat ESO** (1r a 4t), **Alumnat Batxillerat**, **PAS** (personal d'administració i serveis), **Nou professor/a** (alta des de secretaria), **Control d'entrada** (retards) i **Equips i permisos** (només direcció).

**Ajuda**: dins de cada mòdul, el botó **?** obre l'ajuda interactiva (amb cerca) i **Manual (PDF)** el manual del mòdul (`src/assets/docs/gestio/manual-<mòdul>.pdf`). Tots dos surten del mateix fitxer, **`src/_data/gestioAjuda.json`**: quan canviï el funcionament d'un mòdul, s'edita aquest fitxer i es torna a fer el PDF amb `python3 lib/gestio/manual.py`.

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
   - **font_alumnat**: els URL dels fulls de registre (1r, 2n, 3r i 4t d'ESO, 1r i 2n de batxillerat), separats per comes. L'ordre no importa: cada alumne va al mòdul del seu nivell (ESO → pestanya `alumnes`; batxillerat → `alumnes_bat`).
   - **font_alumnat_pestanya**: `Dades` (ja hi és).
3. Executa **configura** (crea la pestanya `alumnes` a ijm_alumnat_db) i després **importaAlumnat**. Google demanarà permís per obrir els altres fulls: accepta-ho.
4. Mira el registre d'execució:
   - quants alumnes ha importat de cada full i quines columnes ha reconegut;
   - «noms separats automàticament»: els alumnes que no eren a la pestanya `Noms` del full de registre. Els cognoms s'han separat per la coma i pels espais; revisa els cognoms compostos;
   - «Cal revisar»: valors que no són a les llistes (p. ex. una optativa antiga) o observacions que no ha entès. Es conserven tal com eren: corregeix-los des del web.
   - Les files de títol dins del full (p. ex. «REPETIDORS DE 1r») se salten. «Cons_Mates» s'entén com a Taller de matemàtiques i «FALSE» en una data, com a buit.
5. Si la tornes a executar, no duplica (salta els alumnes amb el mateix nom i cognoms). Per afegir 3r, 4t i batxillerat a una instal·lació que ja tenia 1r i 2n, n'hi ha prou d'afegir els URL nous a `font_alumnat` i tornar-la a executar.
6. PAS 29 · el que fa amb cada full (decisions de Romà):
   - La capçalera pot ser a la primera o a la segona fila («Cognoms i nom» o «Cognoms, Nom»). Les files de totals se salten.
   - 3r: només l'optativa assignada (no les preferències OPCIÓ 1–5); «NO Aut. Imatge» marcat → Aut. imatge «no», desmarcat → «sí». «UEC» a Observacions → grup **3r ESO UEC** (o 4t ESO UEC). Un «Repetidor 2n» a 3r és història: es desa a **Observacions**.
   - 4t: itinerari, franges 1–3, orientació mates, mates (pares), català i castellà 4t (A/B/DIV). Les columnes sense títol i les preferències de franges no s'importen (són temporals).
   - Autoritzacions a tots els nivells: imatge, dies especials, medicaments, **sortida metge** i **sortida 1a/6a**. L'ANS i el RALC no s'importen.
   - Batxillerat: itinerari (columna «Batxillerat»), una columna sí/no per matèria i grup (G1, G2…), **Pendents** i **Matèries soltes** (text amb els codis), PI.
   - Els codis `ALU-` són únics entre l'ESO i el batxillerat.

### 2b. Control d'entrada (PAS 29)
1. `configura` crea la pestanya **`entrades`** a ijm_alumnat_db i el mòdul **Control d'entrada**.
2. Per importar el registre que es feia fins ara: a `config › font_control_entrada`, l'URL del full; després executa **importaControlEntrada**. Reconeix les columnes pel nom («Marca de temps» o «Data» i «Hora»; «Alumne», «Nom i cognoms» o «Cognoms i nom»; «Grup»; «Nivell») i busca cada alumne a l'alumnat per posar-hi el codi, el nivell i el grup. Al registre: quantes entrades ha importat, les que ja hi eren i els alumnes que no ha trobat (s'importen amb el nom tal com era). Si es torna a executar, no duplica.

### 2c. Dades de Clickedu i equips docents (PAS 30)
Funcions d'execució manual (a l'editor d'Apps Script: tria-la a la llista i ▶ Executa). Totes escriuen al registre què han fet i què falta. **No esborren res** (excepte la reimportació del control d'entrada, que només treu el que ella mateixa havia importat).
1. **importaDadesProfessorat**: puja a Drive el CSV «llistat_professors» de Clickedu (tal com surt, separat per `;`) i posa'n l'URL a `config › font_dades_professorat`. Busca cada docent pel NIF o pel nom i omple **només els camps buits**: NIF, data de naixement, nacionalitat, telèfon (sense «34-»), adreça, població, codi postal i província (pel codi postal). Al registre: qui és al llistat però no a GESTIO i qui encara té dades buides.
2. **importaPAS**: el mateix amb el CSV «llistat_usuaris» del PAS (`config › font_pas`). Si una persona no hi és, la crea (estat actiu); la «Data d'alta» passa a **data d'arribada al centre**.
3. **reimportaControlEntrada**: esborra les entrades que es van importar (les fetes des del web es conserven) i torna a llegir `font_control_entrada`. Ara reconeix el formulari amb columnes «Marca de temps», «Columna 1» (Cognoms, Nom) i «Columna 2» (grup, p. ex. «2n Bat C» → 2n BAT C): agafa la data i l'hora de la marca de temps. La pestanya «Dades importades» (sense dates) se salta. Ha de ser un **full de càlcul de Google** (si és un .xlsx a Drive: Fitxer › Desa com a Full de càlcul de Google).
4. **creaEquipsDocents**: crea un equip per grup-classe (**EQ-1ESOA** «Equip docent 1r ESO A», EQ-1ESOGR, EQ-1BATA…), tipus docent, columna **grups** = el grup, amb el professorat del document «Equips docents 26-27» i permís de **consulta** a Alumnat ESO o Alumnat Batxillerat. Els noms que no troba al professorat surten al registre (afegiu-los a mà a Equips i permisos › Membres). Si es torna a executar, només afegeix el que falti.

### Actualitzar una instal·lació anterior (PAS 21 a 29)
1. Apps Script: enganxa el `Code.gs` nou, desa i executa **configura**. Al registre surt què ha canviat:
   - PAS 30: ordre dels mòduls (Professorat, PAS, Alumnat ESO, Alumnat Batxillerat…); al professorat, els camps nous (data de naixement, nacionalitat, telèfon, adreça, població, codi postal, província, substitueix a, data d'arribada al centre), **Especialitat** passa a desplegable (les especialitats d'ara s'hi adapten; les que no s'entenen surten al registre) i «Anys» passa a **Anys docència**; al PAS, els mateixos camps personals, jornada, situació i data d'arribada, i s'arxiven àmbit, horari i càrrec (les dades es conserven); a `equips`, la columna **grups**; a `config`, `font_dades_professorat` i `font_pas`.
   - PAS 29: el mòdul Alumnat passa a dir-se **Alumnat ESO** i té els camps nous de 3r i 4t (pendents, optativa 3r, itinerari, franges, mates, català i castellà 4t, sortida metge, sortida 1a/6a, observacions) i les llistes ampliades (nivells 3r i 4t, grups de 3r i 4t amb UEC, «repeteix 3r/4t»); apareixen els mòduls **Alumnat Batxillerat** (pestanya `alumnes_bat`), **Nou professor/a** i **Control d'entrada** (pestanya `entrades`); al professorat, l'estat «permís» i la situació «Substitut»; a `config`, `curs_batxillerat`, `copia_tancament_batxillerat` i `font_control_entrada`. No esborra res.
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
- **Dues persones alhora** (PAS 29): cada minut, la pàgina comprova si algú altre ha desat el mateix mòdul i, si és així, ho avisa damunt la graella (amb **Actualitza**); els canvis propis sense desar no es toquen. En desar, si l'altra persona ha canviat alguna de les mateixes files: si són **camps diferents**, es combinen sols i es desa; si és **el mateix camp**, surt una taula amb els dos valors i es tria *Mantén els meus* o *Accepta els seus*. Cap canvi pendent no es perd.
- **Comptador de filtre** (PAS 29): damunt de cada camp amb un filtre actiu surt quantes files compleixen la condició d'aquell filtre.
- **Visualització camps**: amagar/mostrar amb els botons **Cap** i **Totes** (es recorda en aquest navegador) i arrossegar per canviar l'ordre.
- **Excel / PDF** (a la dreta, des del nivell consulta): el que es veu (filtres i columnes visibles).
- **Gestió camps** (admin): afegir columnes, canviar-ne el nom, el tipus (text, número, data, llista, sí/no, correu amb domini, NIF/NIE, calculat), els valors, si és obligatòria o única, des de quin nivell es veu i si ve de Clickedu (no s'edita). Una columna no s'esborra: s'arxiva (desmarcar «Actiu»). L'**Estat** és un camp de sistema: sempre és una llista obligatòria i sempre té el valor «baixa».
- **Mòbil**: fitxes de consulta; per editar, ordinador.

### Professorat
- **Estat** (obligatori): actiu, baixa laboral, permís, substitut o baixa. **Situació laboral**: Definitiu, Comissió de serveis, Provisional, Interí o Substitut (llavors cal **Substitueix a**). **Jornada**: Sencera, 1/2 o ⅔.
- PAS 30: dades personals (NIF, data de naixement, nacionalitat, telèfon, adreça, població, codi postal, província) i **data d'arribada al centre** (es posa sola en l'alta), visibles només des d'edició. **Especialitat** és un desplegable. **Anys docència**: anys com a docent (no només al centre).
- **Llistat** (des d'edició): PDF per recollir signatures d'una reunió (data, descripció i taula Professor/a · Signatura) amb les persones que es veuen a la graella (filtres), sense baixes, per ordre de cognoms.
- Formats: correu XTEC acabat en `@xtec.cat`, correu institutjoanmiro acabat en `@institutjoanmiro.cat`, NIF/NIE amb la lletra correcta.
- **Equips**: columna que només veu qui té edició; només la direcció la pot canviar.

### PAS
- Es gestiona com el Professorat (alta a mà: són poques persones). Camps (PAS 30): nom, cognoms, **Estat** (actiu, baixa laboral, permís, substitut, baixa), NIF, data de naixement, nacionalitat, correu institutjoanmiro, telèfon, adreça, població, codi postal, província, jornada, situació laboral i data d'arribada al centre. Àmbit, horari i càrrec s'han arxivat. Codis interns `PAS-001`…
- El nivell consulta veu nom, cognoms i correu. La columna **Equips** (edició) diu a quins equips és cada persona.

### Nou professor/a (PAS 29)
- Formulari per a secretaria (qui hi tingui edició): dona d'alta un docent al professorat **sense** accés a la graella del professorat. Camps i validació: els del Professorat (obligatoris amb *; icona **i** amb l'explicació de cada camp).
- **Desa** (es torna a comprovar al servidor: correu i NIF no repetits), **Cancel·la** / **Nova alta**, **PDF per signar** (logo del centre, dades i una casella de signatura i data).
- PAS 30: obligatoris nom, 1r cognom, estat, NIF, especialitat, data de naixement, nacionalitat, correu del centre, telèfon, adreça (carrer i número, població, codi postal, província), jornada i situació laboral. Per defecte, situació **Substitut** → **Substitueix a** (obligatori) i el càrrec es copia del docent substituït. El codi postal omple la província. La data d'arribada la posa el servidor.

### Control d'entrada (PAS 29)
- Consulta: graella de les entrades amb retard (alumne, nivell, grup-classe, data, hora), la més recent primer; filtres, Excel i PDF. **Anàlisi**: nivell, grup-classe i data «a partir del» (buit = tot el període) → nombre d'entrades per alumne (per ordre alfabètic), amb PDF.
- Edició: **+ Nova entrada** (tot l'alumnat d'ESO i batxillerat sense baixes, per cognoms, amb cerca; Enter desa) → es registra amb la data i l'hora d'ara i el nivell i el grup de l'alumne. La paperera esborra una entrada feta per error. Les entrades no s'editen a la cel·la.

### Alumnat ESO i Alumnat Batxillerat
- PAS 30: **selector de nivell** a dalt (Tots, 1r ESO… / 1r BAT, 2n BAT): només les files del nivell i s'amaguen les columnes que no hi apliquen; es recorda al navegador. Cada **estat** té el seu color.
- PAS 30: **equips docents per grup**: un equip amb la columna **grups** plena només veu l'alumnat d'aquests grups (i el seu control d'entrada); si fa classe a dos grups, veu els dos. Els equips docents tenen consulta: els tutors no editen. Qui té el permís per una altra via (sense grups) ho veu tot.
- **Nombres totals**: alumnes per nivell i grup-classe (al batxillerat, també per itinerari), amb PDF. **Anàlisi**: tria un nivell → comptadors per grup-classe i total del nivell (ESO 1r–3r: optatives, diversitats, nouvingut, PI/PSP, NESE; 4t: itinerari, franges, mates, català, castellà, nouvingut, PI, NEE, NESE; batxillerat: itinerari i matèries), amb PDF.
- Batxillerat: matèries en columnes estretes amb el nom en vertical i el nombre d'alumnes (de les files filtrades) a sota; les de 1r només a 1r BAT i les de 2n només a 2n BAT. Tancament de curs propi (`config › curs_batxillerat`; desfer: **desfesTancamentBatxillerat**).
- Camps de l'ESO, per aquest ordre: nom, cognoms, **Nivell** (obligatori: 1r a 4t ESO), Grup-Classe anterior, Grup-Classe actual, **Estat** (obligatori), **Decisió final**, Pendents, Optativa 1r, 2n i 3r, (4t) Itinerari, Franges 1–3, Orientació mates, Mates (pares), Català 4t, Castellà 4t, Div. mates / català / castellà, Nouvingut, Data arribada, PI/PSP, NESE-A, NESE-B, NEE, Aut. imatge, dies especials, medicaments, sortida metge, sortida 1a/6a, Observacions. Els camps que no són del nivell de l'alumne surten ratllats. Els títols dels grups canvien sols cada curs (`config › curs`).
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
   - Si algun alumne promociona a un nivell que no és a la llista de nivells del mòdul, **no tanca** i diu quants són. Al batxillerat, 1r → 2n buida les matèries de 1r (la còpia les conserva) i 2n que promociona acaba l'etapa.
4. Després: assignar els grups del curs vinent (selecció + *Aplica a la selecció* › Grup) i fer l'alta de l'alumnat nou amb **Importa fitxer** (Estat «alumne extern»).
- **Desfer** (si s'ha fet per error): a l'editor d'Apps Script, executar **desfesTancament**. Torna a posar la pestanya `alumnes` com era abans del darrer tancament (la de després es conserva com a `desfet_<data>`), el curs anterior i els títols. Els canvis fets després del tancament es perden.
- Si dues persones ho intenten alhora, la segona rep «el curs ja s'ha tancat» (no es tanca dues vegades).

## PAS 31
- **Baixes**: quan un docent o una persona del PAS passa a estat «baixa», en desar surt de tots els equips (i perd tots els permisos). `configura` neteja també les baixes que encara eren a algun equip.
- **Nou professor/a**: camps agrupats (Dades personals, Adreça, Contacte, Dades professionals); el tabulador va de camp a camp; **PDF per signar** = plantilla en blanc d'un sol full A4.
- **Llistat** (professorat): PDF a dues cares, mida de lletra ajustada.
- **Filtres**: sense distingir majúscules ni accents; la cerca de l'embut marca els valors que hi coincideixen. **Dates** en format dd/mm/aaaa (al full es desen aaaa-mm-dd).
- **Control d'entrada**: el codi intern de l'alumne no es mostra. **Permisos**: capçalera fixa.
- En editar la graella, la fila es queda al mateix lloc encara que aparegui la barra de desar.

## PAS 32
- **Membres d'un equip**: dues llistes (no membres / membres) per ordre del 1r cognom, amb botons per passar-les d'una a l'altra (o doble clic) i cerca a cada llista.
- **Llistat** (professorat): només l'estat «actiu»; repartiment entre les dues cares que aprofita al màxim l'espai.

## PAS 33
- **Dades incompletes** (professorat i PAS): botó «⚠ N fitxes amb dades buides» que filtra les fitxes amb camps obligatoris buits (sense baixes ni proves) i marca els camps.
- **Historial d'una fila** (botó del rellotge, des d'edició): canvis fets des del web (pestanya `historial`).
- **Avís de retards** (control d'entrada): `config › retards_quantitat` (3–20, per defecte 5) i `retards_periode` (1 setmana, 2 setmanes, 3 setmanes, 1 mes). Es canvia des del web (admin del mòdul).
- **Còpia de seguretat**: executa **activaCopiaSetmanal** una vegada (demana permisos): fa una còpia ara i cada dilluns cap a les 3 h de ijm_nucli_db i ijm_alumnat_db a la carpeta de `config › carpeta_copies` (si és buida, es crea «GESTIO · còpies de seguretat»). Es guarden les 8 darreres de cada fitxer. **copiaSeguretat** en fa una a mà.
- **Fitxes de prova**: camp «Fitxa de prova» (professorat i PAS). `configura` marca una vegada «Test, Profe», «Test, Tutor» i «Test, Coord». No s'esborren.

## PAS 34
- **Equip nou**: finestra amb el codi (EQ- + lletres o xifres; es normalitza: majúscules, sense accents ni espais), nom, tipus i descripció; es desa en acceptar. Abans, la fila nova quedava amb el codi «EQ-» si l'editor no s'obria, i en desar sortia «codi no vàlid».
- **Esborrar un equip**: paperera de la fila (acció `equip_esborra`): treu l'equip, els seus membres i permisos. EQ-DIR no.
- Tipus: **gestió** per a administració i consergeria; **docent** per a equips de nivell/grup i departaments.

## PAS 35
- **Equips i permisos**: en desar (equips, membres, permisos, equip nou, esborrar) ja no es torna a carregar el mòdul: s'actualitzen les dades del navegador.
- **Barra d'eines**: «Importa fitxer» i «Actualitza» només per a l'administració del mòdul. Des de consulta: Nombres totals, Anàlisi, Visualització camps, Excel i PDF. «Actualitza» torna a llegir el full (importacions o canvis fets al full); els canvis d'altres persones des del web ja surten amb l'avís de versió, que té el seu botó.
- **Alumnat ESO i batxillerat**: paperera (esborrar del tot) també des d'edició, dins l'abast de l'equip (`esborra_` accepta edició als mòduls d'etapa).
- **Nombres totals i Anàlisi**: taula compacta (amplada segons el contingut) i PDF amb `tableWidth: 'wrap'`.
- **Avís de retards**: període comptat enrere des d'avui, inclòs: setmanes = 7/14/21 dies; 1 mes = des del mateix dia del mes anterior. Es mostra «des del dd/mm/aaaa».
- **Mòdul AMONESTACIONS** (`amonestacions`, codis AMO-00001, full `amonestacions` a ijm_alumnat_db, mòdul de registre):
  - Camps: data_fets, alumne, nivell, grup, professor, fets, pdf, curs, redactat_el, id_alumne i id_professor (interns).
  - Tot el professorat (persona PRO-) hi té consulta implícita encara que el seu equip no hi tingui permís: redacta i veu les seves (`nomes_propies`). Consulta d'un equip amb grups → les dels seus grups; edició/admin → totes, redactar en nom d'altri i esborrar.
  - Accions: `amonestacio_form`, `amonestacio_nova` (valida alumne, professor, data no futura i del curs, fets 20–3000 caràcters amb lletres; evita duplicats per doble clic), `amonestacio_pdf` (refer el PDF), `amonestacions_config` (admin: carpeta, avís ESO/BAT, període).
  - PDF: HTML → PDF amb el logo (`config › logo_pdf`), NOFC 5.3 / 5.3.2 / 5.3.3 i Llei 12/2009, a la carpeta `config › carpeta_amonestacions`. Esborrar una amonestació envia el PDF a la paperera de Drive.
  - Avís: `amonestacions_avis_eso` (5), `amonestacions_avis_bat` (2), `amonestacions_periode` (tot el curs).
  - Importació única: `config › font_amonestacions` (full de respostes del formulari) i executar **importaAmonestacions** (no duplica; registra alumnes i professorat no trobats).
  - Graella: període (curs actual / tots / data a data), fets amb icona, PDF amb icona, doble clic → visor amb navegació, Anàlisi per alumne/grup/nivell/professor, Excel/PDF de les files visibles. Sense «Visualització camps» ni «Gestió camps».
  - Requereix autoritzar permisos nous (UrlFetch per al logo, Drive per crear PDF).

## PAS 36
- **Sense recàrregues en desar**: desa (tots els mòduls), equips, membres, permisos, nou professor/a, control d'entrada i amonestacions actualitzen les dades del navegador. Permisos ja no buida la memòria dels altres mòduls (qui els desa és admin global); membres i esborrar equip actualitzen la columna Equips del professorat i del PAS carregats; el docent nou s'afegeix al professorat carregat. Es torna a llegir només després de «Gestió camps» i del tancament de curs.
- **Amonestacions · formulari**: `dades` porta `form` (alumnes, professorat, avui, curs): obrir-lo no fa cap crida. Cercador d'alumne amb desplegable compacte (màx. 50 resultats; fletxes + Enter). Professor/a després dels fets. La (i) s'obre cap a dins també als formularis en finestra. Corregit: el cercador general (`.gs-cerca`, flex 1 1 260px) feia 260 px d'alçada dins d'una columna flex.
- **PDF en segon pla**: `amonestacio_nova` amb `pdf_despres` desa sense fer el PDF; el web crida tot seguit `amonestacio_pdf` sense finestra de progrés (icona que gira a la columna PDF). **fesPdfsPendents** fa els que faltin (màx. 25 per execució; no els importats) i **activaPdfsPendents** el programa cada hora.
- **Permisos**: consulta = només les pròpies (també si l'equip té permís de consulta amb grups); edició/admin = totes. Tot el professorat (PRO-) pot redactar, sigui quin sigui el nivell.

## PAS 37
- **Amonestacions · professor/a**: es posa sol (qui ha entrat a GESTIO) en un camp de només lectura amb l'explicació. Només l'**administració** del mòdul pot triar un altre docent (abans, també edició); el servidor ignora `id_professor` si no és admin.
- **Corregit**: el desplegable del professor/a quedava buit per a les fitxes de prova («Test, Profe»), perquè la llista excloïa les proves; ara qui redacta sempre hi surt.

- **Control d'entrada · velocitat**: `dades` porta `alumnes_entrada` (obrir «Nova entrada» no fa cap crida). Desar és optimista: la fila surt provisional (`gs-desant`) i `entrada_nova` va sense finestra de progrés. Al servidor, `entradaNova_` busca només l'alumne (`alumnePerId_`, TextFinder a la columna del codi) en lloc de llegir tot l'alumnat, no revisa les columnes de la pestanya a cada entrada, i `ssAlumnat_` obre ijm_alumnat_db una sola vegada per petició (millora també la resta de mòduls).

## PAS 38
- **Batxillerat**: el PDF «Descripció de matèries» inclou Ampliació de Biologia, de Química, de Geologia i Ciències Ambientals i de Física (`lib/formularis/genera.py`, `materies_batxillerat()`).
- **Control d'entrada**: selector de període (curs actual / tots / data a data), el mateix que a amonestacions (`htmlPeriode`, `lligaPeriode`; estat per mòdul a `S.periodes`).
- **Desar més ràpid**: `desa_` llegeix només les files modificades (`filaPerId_`, TextFinder) quan no hi ha altes ni camps únics afectats i escriu només les cel·les que canvien. `context_` fa servir `baseContext_()` (configuració, persones, equips, membres i permisos) a CacheService 60 s; es buida en desar persones, equips, membres, permisos o configuració (`invalidaCtx_`, també des d'`historial_`). Un canvi fet a mà al full tarda com a molt 1 minut a aplicar-se.
- **Mòdul CONSELL ORIENTADOR 4t ESO** (`consell_orientador`, codis CO-00001, pestanya `consell_orientador` d'ijm_alumnat_db):
  - Una fila per alumne de 4t i curs; `sincronitzaConsell_` (a `dades`) afegeix l'alumnat de 4t del curs actual, corregeix grup i nom, i buida l'orientació inicial dels cursos anteriors.
  - Camps: alumne, grup, curs, pdf_inicial, pdf_final, id_alumne (origen «clickedu»: no s'editen); orientacio_inicial, resultat_final, orientacio_final, voluntat_familia (llistes), observacions.
  - Permisos: equips EQ-TUT4TESOA…D (grup + edició, els crea `configura`; cal posar-hi el tutor/a) i coordinació (equip sense grups).
  - `consell_pdf` {fase, grup, data, igualment}: un PDF per grup (una pàgina per alumne; la inicial amb el retorn de la família) a `config › carpeta_consell` (buida = «GESTIO · Consell orientador»), enllaç a cada fila; el PDF anterior va a la paperera.
  - **importaConsellFinal**: importa el final del curs anterior des de `config › font_consell_final` (normalitza les opcions; no duplica).

## PAS 39
- **Consell orientador**: carpeta configurable des del web (Configuració, admin del mòdul; acció `consell_config`); dins s'hi creen les subcarpetes **Inicial** i **Final** (`subcarpeta_`), on va cada PDF.
- **Corregit**: en editar la primera cel·la, quan sortia la barra «Canvis sense desar», la compensació del desplaçament podia amagar la fila editada (si era de les primeres). Ara la fila editada (`S.filaEditada`) sempre es queda visible.
- **Mòdul CURRÍCULUM** (`curriculum`, al nucli):
  - Pestanya `curriculum` (MAT-0001): nivell, materia, hores_a, hores_b, especialitat (ESPECIALITATS), grups, observacions. `configura` hi posa les matèries inicials del document d'equips docents 26-27 (`CURRICULUM_INICIAL`) si és buida.
  - Pestanya `curriculum_grups` (ASG-00001), vista «Assignacions» (mòdul intern amb el mateix permís que `curriculum`): nivell, materia, hores, id_materia (de la matèria), grup, especialitat, professor (desplegable del professorat, valors posats a `dades`).
  - `curriculum_genera` {prova}: crea/treu/actualitza les files segons la columna Grups; conserva especialitats i professors; amb `prova` només compta.
  - Al web: hores de l'alumne (A + B/2) i de professorat ((A + B) × grups), hores per especialitat, document dels equips docents (PDF).

## PAS 40
- **Consell orientador**: sense «Baixa» ni paperera; la fila té una goma (`buidaConsell`) que buida els camps editables del consell (queda pendent de desar). Els alumnes es donen de baixa o s'esborren a Alumnat ESO.
- **Especialitats** per ordre alfabètic: `ESPECIALITATS` ordenada i `configura` reordena les opcions existents (`ordenaLlistes_`: professorat, currículum i grups).
- **AFA**: tret «Biblioteca a les tardes» de «Què finança l'AFA» (`src/_data/projectes.json`).
- **Control d'entrada**: per afegir les entrades noves del full antic, `config › font_control_entrada` amb l'URL del full i executar **importaControlEntrada** (salta les que ja hi són: mateix alumne, data i hora). No cal `reimportaControlEntrada`.

## PAS 41
- **Currículum › Assignacions** (abans «Grups i especialitats»): les hores d'un grup es reparteixen en parts amb especialitats diferents (tisores → `curriculum_divideix` {id, hores, especialitat}: la fila es queda amb `hores` i s'afegeix una part nova amb la resta). Nou camp `num_grup` (admin, origen clickedu) que identifica el grup dins la matèria; el camp `hores` és editable (origen gestio). ⚠ a la graella si les parts no sumen A+B.
- `curriculumGenera_` conserva les parts: un grup amb una sola fila s'actualitza a les hores totals; un grup repartit es deixa com està i es retorna a `desquadrats` si no quadra.
- **Hores lectives classe**: camp `hores_lectives` a `CAMPS_PROFESSORAT` (numèric, origen gestio). Accions `curriculum_professorat` (llista per especialitat; `pot_desar` amb edició a currículum o professorat) i `hores_lectives_desa` {canvis:[{id,hores}]} (0–40, historial al full del professorat).
- **Document per especialitat** (client, `documentEspecialitat`/`pdfEspecialitats`): matèries de l'especialitat, cedides, assignades d'altres, professorat amb hores lectives i balanç (total − cedides + assignades = a impartir; professorat − a impartir = balanç). `dades` de `curriculum_grups` retorna `materies` i `professorat_hores`.
- **Control d'entrada**: el període «Curs actual» es calcula per la data d'avui (no pel `curs` de la configuració, que podia amagar les entrades més recents). `importaControlEntrada` llegeix les dates reals de la cel·la (evita el mes/dia dels fulls amb configuració dels EUA) i el registre diu la data més recent de l'origen i el rang de les entrades noves.
- **Web**: carrusel d'inici amb una diapositiva de logos (Erasmus+, Escola Verda sense el logo de la Generalitat, XAJI, Fundació Joan Miró, Paraula al Centre) a `src/assets/img/inici/inici-5-projectes-*.jpg`. ESO 4t: Educació visual i plàstica adreçada a qui vol fer batxillerat artístic o cicles d'arts.
- Desiderata (pas 3 del currículum): pendent.

## PAS 42
- **Professorat · hores lectives**: camps `LECTIVES_ALUMNAT` (lectives_eso, lectives_bat, atencio_individual, tutoria_eso12, tutoria_eso34, tutoria_bat) i `LECTIVES_REDUCCIONS` (red_tutoria_eso12, carrec_directiu, coordinacio_lectiu, red_coord_nivell, red_lectiva_55). `hores_lectives` passa a ser el calculat «Total lectives alumnat» (suma) i `total_lectives` el calculat «Total lectives» (tot). Els calculats admeten sumes: `valors` = «a + b + c» (`calcula_` i `calcula`). La columna antiga `hores_lectives` del full queda sense ús.
- `MAX_LECTIVES` per jornada (Sencera 18, 1/2 9, ⅔ 12): ⚠ a la graella del professorat i al diàleg del currículum.
- **importaHoresLectives** (manual): `config › font_hores_lectives` (per defecte el full de plantilla; la pestanya del `gid`). Capçalera = fila amb «Total lectives»; docent per correu o pel nom en qualsevol ordre. Registre: no trobats i on el «Total lectives (t_lec)» del full no quadra amb la suma.
- `hores_lectives_desa` ara és {canvis:[{id, valors:{clau: hores}}]} (0–40). `dades` de `curriculum` i `curriculum_grups` porta `professorat_hores`, `hores_pot_desar` i `max_lectives`: el diàleg «Hores lectives classe» ja no fa cap crida en obrir-se.
- **Control d'entrada**: `importaControlEntrada2627()` desa l'URL del formulari 26-27 a `config › font_control_entrada` i importa.

## PAS 43
- **Currículum** amb tres pestanyes: Matèries i **Grups i distribució** (totes dues el mòdul `curriculum`, `S.vistaCur` = 'materies' | 'distribucio' tria les columnes) i Assignacions (`curriculum_grups`).
- Camps nous a `CAMPS_CURRICULUM`: `grups_classe` (text, «A, B»; buit = tots els del nivell sense GR/UEC; `grupsClasse_`) i `docents` (codocència; buit = 1). `curriculumGenera_`: grups buit = nombre de grups-classe; noms nous segons els grups-classe; amb codocència, una fila per docent amb totes les hores (s'afegeixen les que falten); `desquadrats` compara amb total × docents. `dades` del currículum porta `grups_nivell`.
- **Hores lectives**: ⚠ quan el total no coincideix amb la jornada (abans, quan la superava). Diàleg amb selector Tot/Especialitat, peu de totals i PDF (`pdfHoresLectives`).
- **Document per especialitat**: columnes numèriques estretes i centrades (HTML amb `colgroup`, PDF amb `cellWidth`).

## PAS 44
- **Grups-classe de cada nivell** editables (Currículum › botó Grups-classe): `config › curriculum_grups_classe` (JSON {nivell: "A, B, …"}); `grupsNivell_(cfg)` (per defecte, les constants sense GR/UEC), acció `curriculum_classes_desa`. Els fan servir `grupsClasse_`, `curriculumGenera_` i `dades` (`grups_nivell`).
- **Separa** (tisores a Grups i distribució): acció `curriculum_separa` {id, grups_classe:[lletres], grups}: la fila es queda amb la resta de grups-classe i se n'afegeix una de nova (MAT-…) amb els triats; si «Grups» era buit, totes dues queden buides; si no, la nova té `grups` i l'original la resta (mínim 1).
- Hores lectives: separadors verticals (`.gs-hl-sep`) i el selector d'especialitat només amb «Especialitat».

## PAS 45
- **Grups d'una matèria només amb `grups_classe`**: comes = grups separats, + = units, buit = un per grup-classe; es pot repetir (`grupsMateria_` al servidor, `grupsMat` al client; noms «1r ESO A», «1r ESO AB», «1r ESO ABCD 1/2»). El camp `grups` queda inactiu.
- `migraGrupsPAS45_` (a `configura`, idempotent): converteix els `grups` antics (n = nombre de grups-classe → un per grup; menys → blocs seguits «A+B, C+D»; més → el bloc sencer repetit) i escriu al registre les matèries agrupades per revisar-les.
- Regla de validació `REGLES.curriculum` (error `grup_classe_desconegut`). `curriculum_separa` ara rep `grups` = índexs dels grups de la fila.
- Columna calculada «Grups» a Grups i distribució; la fila es refà en editar grups-classe, docents o hores.

## PAS 46
- `curriculumGenera_`: el nom del grup es recalcula sempre (`nomGrup(g)` a partir de `grupsMateria_`); abans es conservava el de la fila i quedaven noms antics (p. ex. «1r ESO A» per a «C+D»). El canvi de nom compta com a fila actualitzada. Camp `grup` de les assignacions amb origen clickedu (no editable).
- `curriculum_separa` mou les assignacions ja generades dels grups triats a la matèria nova (renumera `num_grup` a totes dues): es conserven especialitat i professor/a.

## PAS 47
- **Currículum › Assignacions**: ordre del filtre Nivell per etapa (`ordreNivell`); etiqueta «Codocència ×n» / «Cotutoria ×n» a la columna Grup; esquema **Balanç i transferències** (`dadesBalanc`, `svgBalanc`, `pdfBalanc`: SVG en cercle, caixa per especialitat amb el balanç de `dadesEspecialitat`, fletxes de l'especialitat de la matèria a la que la imparteix).
- **Mòdul Desiderata** (`desiderata`, ordre 9): full `desiderata` (especialitat, dades JSON {id_materia|hores: [{prof, grups}]}, observacions, data, desat_per). Accions `desiderata_dades` (edició; especialitat de la fitxa o, admin, qualsevol), `desiderata_desa`, `desiderata_analisi` (admin). `configura` crea l'equip EQ-CAPS «Caps de departament» (sense membres) amb edició a Desiderata. Client: `carregaDesiderata`, `pdfDesiderata`, `xlsxDesiderata`, `analisiDesiderata`.
- **Generador d'horaris, fase 0**: `exportaHoraris()` (manual) desa un JSON «horaris-dades» v1 a `config › carpeta_horaris` (o «GESTIO · Horaris»). El generador és un projecte a part (carpeta `generador-horaris`, Python).
- **Web**: avís del curs 2026-2027 a Preinscripció (`preinscripcio.json › comuns.banner26`); criteris de qualificació desactivats (`eso.json › qual.criterisDisponibles: false`, «Properament disponibles»); pàgina nova **Projectes › Erasmus+** (`projectes-erasmus.html`, ca/es/en) amb el que hi havia a Llengües estrangeres › 04, que ara hi enllaça; menú i tornada de les mobilitats a Erasmus+.

## PAS 48
- **Departaments/àmbits** (Desiderata, admin): full `departaments` (id_departament, nom, especialitats amb |, cap). Accions `departaments` i `departaments_desa` (sincronitza els membres d'EQ-CAPS amb els caps). `desiderataEsps_`: el cap gestiona totes les especialitats dels seus departaments/àmbits (si no n'hi ha, la de la fitxa). `desiderata_dades` porta `departament`; l'anàlisi, el departament/àmbit de cada especialitat.
- **Aplica la desiderata** (Currículum › Assignacions): acció `curriculum_aplica_desiderata` {prova, sobreescriu}: posa el professor/a de cada grup per ordre de grup segons els grups de cada docent.
- Desiderata: contenidor amb desplaçament propi (`ajustaAlcada`), exportacions PDF/Excel amb tot el que es veu i la llista d'incoherències, botó Guia (`guia-desiderata.pdf`, generada per `manual.py` des de `gestioAjuda.json › guies`). Nomenclatura «departament/àmbit» i «cap de departament/àmbit».
- **Horaris · planificador** (mòdul `horaris`, ordre 10, només admin per defecte): marc horari a `config › horaris_marc` (`marcHorari_`, `validaMarc_`), accions `horaris_dades`, `horaris_marc_desa`, `horaris_exporta` (retorna l'exportació completa al navegador; `exportaHoraris` la desa a Drive). L'exportació «horaris-dades» porta `marc_horari`.
- **Web**: preinscripció de batxillerat amb la icona de formulari «No actiu»; sense l'avís «Fons groc» (preinscripció i ESO); distintiu «Properament disponibles» dins de la caixa; pàgines noves `accessibilitat.html` (ca/es/en, enllaç al peu), `404.html`, `sitemap.xml` (filtre `dataISO`) i `robots.txt`.

## PAS 49
- **Portada agrupada**: columna `grup` a la pestanya `moduls` (Personal, Alumnat, Organització del curs, Administració; `configura` l'omple si és buida). `inici` retorna `grup`; el client mostra seccions i pestanyes de grup (es recorda a localStorage `gestio_grup`).
- **Horaris · planificador**: el marc horari ja no té franges no lectives ni reunions (es buiden en llegir i desar). Pestanyes noves **Aules** (`config › horaris_aules`: aules {id, nom, tipus, capacitat} i `aula_materia` per nom base de matèria; `TIPUS_AULA`) i **Regles i blocs** (`config › horaris_regles`: `blocs_parallels` {nivell, nom, materies} i `toves` amb pesos 1–5). Accions `horaris_aules_desa`, `horaris_regles_desa`; `horaris_dades` porta `materies` (`materiesHoraris_`). L'exportació porta `aules` i `regles` (amb `aula_materia`).
- Manuals i guies: els símbols ✓ ⚠ ⅔ → surten amb DejaVu Sans (`lib/fonts/DejaVuSans.ttf`); guia de la Desiderata reescrita.

## PAS 50
- **Aules**: tipus nous `idiomes` i `dibuix` (abans `plastica`, es converteix en llegir). `config › horaris_aules` porta `conjunts` {id C1, C2…, nom, aules} (conjunts d'aules alternatives; ids estables al client i al servidor). Ja no hi ha `aula_materia`: l'aula es tria a Sessions lectives.
- **Sessions lectives** (full `horaris_sessions`: id_assignacio, distribucio, aula, conjunt, fixes, prohibides): una fila per fila de `curriculum_grups` (`sessionsHoraris_`). Distribució («111», «21») ha de sumar les hores; posicions «dia F1» separades per |. Acció `horaris_sessions_desa` (error `sessions_invalides`).
- **Professorat** (full `horaris_professorat`: id_professor, fixes, prohibides, observacions): acció `horaris_professorat_desa` (error `professorat_invalid`). Franges disponibles = franges lectives − prohibides.
- **Regles**: pesos nous `aula_alternativa` (2) i `aula_qualsevol` (4). El motor prova aula preferent → conjunt alternatiu (penalització i avís) → qualsevol aula de capacitat suficient (penalització més gran i avís).
- **Exportació**: `conjunts_aules`; docents amb `fixes`/`prohibides`; assignacions amb `id_professor`, `distribucio`, `aula_preferent`, `aules_alternatives`, `fixes`, `prohibides`. El generador d'horaris (Python) les valida.

## PAS 51
- **Subgrups** (pestanya nova del planificador, entre Aules i Sessions lectives). `config › horaris_subgrups` = {hores_b: [{id B1…, nivell, materies (noms), grups (lletres)}]}; acció `horaris_subgrups_desa` (error `subgrups_invalids`: ≥2 matèries amb les mateixes hores B, múltiple del nombre de subgrups, ≥1 grup, una matèria-grup en un sol bloc).
- **Hores B**: `horesBExpandit_` expandeix cada bloc per grup-classe: subgrups `1r ESO A-G1`, `-G2`… i `torns` de rotació (sessió k: el subgrup i fa la matèria (i+k) mod n), `mateix_dia: true`. Les sessions d'aquestes assignacions porten `bloc_b`, `hores_b`, `hores_sessions` (= hores − hores B) i la distribució només suma `hores_sessions` (si una distribució desada no hi quadra, es torna a la per defecte).
- **Blocs paral·lels** (optatives, divisions): ara a la pestanya Subgrups (es continuen desant a `horaris_regles`); avís si un docent hi surt dos cops. La pestanya «Regles i blocs» passa a dir-se «Regles».
- **Exportació**: `hores_b` (blocs per grup-classe amb torns) i `subgrups` (hores_b i bloc_parallel amb els seus grups-classe); assignacions amb `bloc_b` i `hores_b_bloc`. `horaris_dades` porta `subgrups`, `grups_nivell` i `hores_b_avisos`; `materies` porta `hores_a`, `hores_b`.

## PAS 52
- **Catàleg de regles del motor** (`reglesMotor_`): `regles_motor` a `horaris_dades` i a l'exportació = {obligatories: [{id, text, dades}], toves: [{id, text, unitat, activa, pes}], penalitzacio}. La pestanya Regles el mostra (regles obligatòries i taula de penalitzacions). Vegeu `generador-horaris/REGLES.md`.
- **Clickedu** (al generador d'horaris, Python): `horaris/clickedu.py` llegeix i escriu el format GHC XML (claus `claveDeExportacion`, secció `<horario>` per importar a Clickedu, com Peñalara) i `horaris/correspondencies.py` relaciona GESTIO amb les claus de Clickedu. Els XML reals no es pugen mai (`.gitignore`).

## PAS 53
- **Professorat en actiu per planificar** (`actiusPlanificacio_`): currículum (desplegable del professor/a), desiderata, hores i horaris només fan servir el professorat amb estat «actiu» o «substitut» que no estigui substituït per un substitut en actiu (camp «Substitueix a»). Fora: baixa, baixa laboral, permís.
- **Desiderata**: config `desiderata_tancament` (AAAA-MM-DD) i `desiderata_bloquejada` (si/no). Acció `desiderata_config` (administració, botó «Tancament»). `desiderata_dades` porta `bloqueig`; `desiderata_desa` torna `desiderata_bloquejada` si no és administració. Els caps veuen l'estat a dalt.
- **Currículum › Assignacions**: botó «Comprova la desiderata» (acció `curriculum_comprova_desiderata`: incoherències falta / fora / diferent / no_actiu per assignació i docent). «Aplica la desiderata» mostra si està bloquejada i en acabar fa la comprovació.
- **Horaris · planificador**: `horaris_dades` porta `esquema`; si l'Apps Script desplegat és anterior, el client ho diu (abans la pantalla quedava buida) i un error en pintar una pestanya es mostra en lloc de deixar-la buida. Aules amb `nom_clickedu` i `clau_clickedu` (codis de fins a 16 caràcters; clau única) i botó «Claus de Clickedu (XML/CSV)» (llegeix al navegador el GHC o la llista d'aules de Peñalara en CSV amb «;», proposa i no desa fins a Desa).
- **Web**: Recollida de títols (cursos fins al 2025-2026 i avís de consultar la secretaria); Sol·licitud de títols (dos documents informatius i el bloc «Després de fer el tràmit»: 48 h i documentació).

## PAS 54
- **Subgrups redissenyats**: `config › horaris_subgrups` = {classes: {"1r ESO A": {nom, clau}}, subgrups: [{id S1…, nivell, nom, clau, tipus diversitat|hores_b|optativa|altres, grups: [lletra]}], blocs: [{id B1…, nivell, nom, tipus, parts: ["ASG-…#P1"], mateix_dia}]}. Substitueix les hores B del PAS 51 (`hores_b`) i els blocs paral·lels (que es queden a `horaris_regles` però ja no es fan servir).
- **Importació** de grups i subgrups (al navegador): llistes de Peñalara en CSV (`;`, Windows-1252: «Grupos…Clave externa…Curso» i «Subgrupo…Clave externa…El subgrupo forma parte…Curso») o GHC XML. Les claus dels grups-classe de l'exportació de Clickedu manen; les de Peñalara no en substitueixen cap.
- **Sessions lectives per parts**: columna `parts` (JSON) al full `horaris_sessions`: [{id P1…, grup (grup-classe o id de subgrup), hores, distribucio, aula, conjunt, fixes, prohibides}]. Per defecte, una part; si la matèria és d'un sol grup-classe, el fa aquest grup. Les columnes antigues guarden la primera part.
- **Blocs simultanis** a Sessions lectives (proposta automàtica de diversitat, optatives i hores B amb rotació).
- **Exportació**: `classes_clickedu`, `subgrups` (nom, clau, tipus, grups_classe), `blocs_simultanis` i `assignacions[].parts`. Regles: `subgrups`, `blocs_simultanis`, `mateix_dia` (substitueixen `blocs_parallels`, `hores_b`, `hores_b_dia`).

## PAS 55
- **Planificador**: aules ordenables per columna; sessions lectives per matèria i grup; a les graelles de posicions, el nom d'un dia o d'una franja canvia tota la columna o fila.
- **Professorat del planificador**: full `horaris_professorat` amb `clau_clickedu`, `guardies_o`, `guardies_b`, `guardies_p`; botó «Claus de Clickedu (CSV)» (llista del professorat de Peñalara, al navegador). Clau única.
- **Guàrdies** (pestanya nova): `config › horaris_guardies` = {demanda: {"dia F1": {o}, "dia E1": {b, p}}}; acció `horaris_guardies_desa` (ordinàries només a les lectives; biblioteca i pati a l'esbarjo). Cobertura global (demanda vs professorat). Exportació: `guardies`, `docents[].guardies`, `docents[].clau_clickedu`; regla obligatòria `guardies`.
- **Professorat (mòdul)**: botó «Carrega dades des del Currículum» (acció `professorat_carrega_curriculum` {prova}): lectives ESO/Bat, atenció individual, tutories i càrrec (només si és buit o de tutoria/cap); no toca els docents sense grups.

## PAS 56
- **Substitucions** (`substitucions_`, `aliesSubstitucio_`, `heretaSubstitucions_`, `ambHerencia_`): en desar al Professorat (o alta), el substitut (actiu/substitut amb «Substitueix a») hereta lectives i reduccions buides, el càrrec buit i, al full `horaris_professorat`, guàrdies i fixes/prohibides si no en té. Al Currículum, el nom de la persona substituïda es tradueix al substitut (hores del planificador, `dadesHoraris_`, comprovació i aplicació de la desiderata). Resposta `herencia` = nombre de dades heretades (el client torna a llegir la graella).
- **Llistat PDF del professorat**: línies més gruixudes i fosques.
- **Dades públiques**: acció `publics` {quin: professorat|calendari} sense correu (només secret). Funció Netlify `gestio-publics` (GET `/api/gestio-publics?quin=…`, 5 min de memòria cau). La pàgina El nostre centre › Professorat la fa servir (amb `professorat.json › especialitats` per traduir); la llista estàtica és la reserva.
- **Mòdul CALENDARI** (grup Organització del curs): full `calendari` (id_event EV-00001, data_inici, data_fi, hora, categoria General|Intern, nivells separats per |, descripcio). Config `calendari_dates` (JSON {curs, dates [{des, fins?, tipus, nom?{ca,es,en}}]}; tipus inici, darrer, darrerBat, festiu, local, lliure, vacances, trimestre2, trimestre3), `calendari_publicat`, `font_calendari`, `font_calendari_pestanyes`, `netlify_build_hook`. Accions `calendari_dades`, `calendari_desa` {esdeveniments, esborra}, `calendari_dates_desa` {dates}, `calendari_publica` (admin), `calendari_importa` {prova} (admin). Funció manual `importaCalendari()`.
- **Publicació**: `eleventy.config.js` (ara asíncron) crida `lib/calendari-publicat.js` → `.cache/calendari-publicat.json` (necessita GESTIO_SCRIPT_URL i GESTIO_SCRIPT_SECRET al build; si falla, es fan servir les dades de `calendari.js`). `calendari.js` en treu curs, mesos, dates i `actes` (esdeveniments General) → secció «Activitats i esdeveniments» de Secretaria › Calendari escolar; el PDF del calendari també es refà.
- **Importació del full real** (Calendari 26-27, pestanyes 1r Trimestre, 2n Trimestre-PER REVISAR i 3r_Trimestre-PER REVISAR; la «3r Trimestre» és del 2024-25): 182 files → 173 esdeveniments (45 General, 128 Intern), cap data sense entendre. Trimestres: 1r 8/9–30/11, 2n 1/12–5/3, 3r 8/3–21/6 (els posa «Inici segon trimestre» i «Inici classes 3r trimestre»). Hora també al final («… - 11:45»); nivells «1r a 3r ESO».
- **Proposta (pendent de confirmar)**: mòduls CÀRRECS (catàleg de càrrecs, coordinacions i reduccions, amb persones assignades) i OCUPACIÓ FIXA (resum per docent: lectives + reduccions lectives = 18, guàrdies − reduccions de guàrdia = 4, total 22); atenció individual com a assignació multinivell sense grup; reunions fixes de nivell com a bloc simultani de docents. Vegeu el document de disseny.

## PAS 57
- **Trimestres configurables**: Calendari › Dates clau › Trimestres (tipus `trimestre1/2/3` amb `des` i `fins` a `config › calendari_dates`). Per defecte 8/9–30/11, 1/12–5/3, 8/3–21/6. La importació del full els posa amb «Inici … trimestre» i «Fi del … trimestre». No es publiquen. El calendari té desplaçament vertical propi.
- **Mòdul OCUPACIÓ** (`ocupacio`, Organització del curs): accions `ocupacio_dades`, `ocupacio_desa` {canvis [{id, valors}]} (lectives, reduccions, `rg_*`, `carrec`, `guardies_o/b/p` → full `horaris_professorat`), `ocupacio_carrecs_desa` (admin, `config › carrecs`). Les dades continuen al full `professorat`; les reduccions de guàrdia són columnes `rg_*` (REDUCCIONS_GUARDIA) que crea `columnesOcupacio_`. A la graella del Professorat s'arxiven els camps d'hores (configura, esquema < 57). Automàtiques (casella buida): `red_tutoria_eso12` (tutor/a de 1r ESO), `red_coord_nivell` (tutor/a o «Coordinació de nivell…»), `red_lectiva_55` (55 anys a `config › reduccio_55_referencia`). Semàfor: lectives = 18·f, guàrdia = 4·f, total = 22·f (f = 1, ½, ⅔).
- **Càrrecs**: llista simple (`config › carrecs`) + automàtics (Tutor/a de cada grup-classe, Cap de cada departament). Una persona pot tenir-ne diversos (« · »). «Carrega des del Currículum» només canvia els de tutoria i de cap.
- **Atenció individual multinivell**: matèries /atenció individual/ sense grup-classe (`sessions[].multinivell`, `assignacions[].multinivell`, `grups_classe` buit, part sense grup).
- **Reunions fixes** (planificador › Reunions): `config › horaris_reunions` {reunions [{id, nom, nivell, hores, franja, docents}]}, acció `horaris_reunions_desa`, proposta `reunions_proposta` (tutors per nivell + coordinació de nivell). Exportació `reunions`; regles obligatòries `reunions` i `multinivell`. Generador: `Dades.reunions`, `Assignacio.multinivell`, validació (secció 9).

## PAS 58
- **Nou professor/a**: sense «Altres dades» ni el càrrec (s'assignen sols o a Ocupació); el PDF no porta l'estat (un sol full).
- **Substitucions**: «Substitueix a» es compara per paraules (`clauNom_`, `personaPerNom_`: «Cognoms, Nom» o «Nom Cognoms», o sense 2n cognom). El substitut hereta també els equips **docents** (no els de gestió). `actiusPlanificacio_` treu les persones substituïdes per codi.
- **Equips i permisos**: pestanya «Per persona» (al client, a partir de `equips`): equips d'una persona i nivell per mòdul amb l'equip que el dona i els grups.
- **Equip Claustre** (`EQ-CLAUSTRE`, tipus docent): membres automàtics (tot el professorat PRO- que no és de baixa ni prova) a `context_`, a partir de `config › claustre_des_de` (2026-11-16). `configura` el crea amb consulta a professorat, alumnat, batxillerat, control_entrada i calendari. `equips_` el retorna amb `automatic` {des_de, actiu}.
- **Calendari**: nivell `Professorat` (NIVELLS_CAL_); importació: reunions, claustres, formació i avaluacions → Professorat (`PROF_CAL_`). Client: filtre de diversos nivells (`S.cal.niv` = llista), colors per nivell (gris = diversos, blanc = tot el centre), vora per categoria. Al web, el nivell Professorat no surt.
- **Ocupació**: seccions plegables (`guarda › ocupacio_plega`), reduccions de guàrdia com a columnes; noms «Lectives (amb alumnat)», «Total lectives», «Total guàrdies». Sense reducció automàtica de 55 anys (es treu `reduccio_55_referencia` dels valors per defecte).
- **Documents** (Claude Docs): «GESTIO · Workflow de final de curs» i «GESTIO · Guia per al professorat».

## PDF
- Tots els PDF que genera GESTIO (graella, informes, anàlisis, llistat per signar, alta de professorat) porten el **logo del centre** a la part superior (PAS 30).

## Proves en local
`netlify dev` (vegeu `LEGIR_PROVES_LOCALS.md`) i obre http://localhost:8888/gestio/ — fa servir els fulls reals.
