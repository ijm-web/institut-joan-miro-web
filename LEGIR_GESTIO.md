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

## PDF
- Tots els PDF que genera GESTIO (graella, informes, anàlisis, llistat per signar, alta de professorat) porten el **logo del centre** a la part superior (PAS 30).

## Proves en local
`netlify dev` (vegeu `LEGIR_PROVES_LOCALS.md`) i obre http://localhost:8888/gestio/ — fa servir els fulls reals.
