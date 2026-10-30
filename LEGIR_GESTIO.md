# GESTIO · com funciona i com activar-la

Àrea privada de gestió del centre a **/gestio**: s'hi entra amb el compte de Google de l'escola i cada persona veu només els mòduls que té assignats algun dels seus equips. Disseny i decisions: document «GESTIO - Proposta de disseny» (carpeta local `docs`, al costat de la carpeta del projecte).

Mòduls: **Professorat**, **Alumnat** (1r i 2n d'ESO) i **Equips i permisos** (només direcció).

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
| Edició | A més, alta, baixa i modificació de files · donar «consulta» a altres equips |
| Admin | A més, camps (columnes) del mòdul · donar «consulta» i «edició» |
| Admin global | L'equip directiu (`EQ-DIR`, permís `*` admin) i els correus de `config › admins`: tots els mòduls, el mòdul Equips, qui és a cada equip i el nivell admin |

Els permisos es donen a **equips** (pestanya `permisos`), mai a persones. Un docent pot ser a diversos equips (pestanya `membres`); val el nivell més alt. Un docent amb estat **baixa** ja no pot entrar (amb «baixa laboral» o «substitut», sí).

## Activació (una sola vegada)

### 1. ijm_nucli_db i l'Apps Script
1. A Google Drive (a la carpeta de treball), crea un full de càlcul nou que es digui **ijm_nucli_db**. No el comparteixis amb ningú més.
2. Extensions › Apps Script. Esborra el contingut de `Code.gs` i enganxa-hi `apps-script/gestio_db/Code.gs`. Desa.
3. ⚙️ Configuració del projecte › Propietats de l'script › Afegeix: `GESTIO_SECRET` = un text llarg inventat (p. ex. 40 lletres i xifres). Guarda'l: el necessitaràs a Netlify.
4. A l'editor, tria la funció **configura** › ▶ Executa (autoritza-la). Crea les pestanyes, els mòduls, els camps i l'equip `EQ-DIR` amb permís admin a tot. Es pot tornar a executar sempre que es vulgui: no esborra dades i, si el full ve d'una versió anterior, l'adapta (vegeu «Actualitzar una instal·lació anterior»).
5. Al full, pestanya `config`: posa el teu correu a **admins** (accés d'emergència) i, a **font_professorat**, l'URL del full actual de professorat (i a `font_professorat_pestanya` el nom de la pestanya, si no és la primera).
6. A l'editor, executa **importaProfessorat**. Al registre d'execució diu quantes persones ha importat i quines columnes ha reconegut. Només importa les columnes previstes (Nom, 1r Cognom, 2n Cognom, NIF, Especialitat, email xtec, email institutjoanmiro, Jornada, Anys, Català, Càrrec). Definitiu, Comissió Serveis, Provisional i Interí es converteixen en un sol camp, **Situació laboral** (la columna que té la X). La jornada «Completa» passa a «Sencera» i «2/3» a «⅔». Tothom entra amb estat «actiu». Si la tornes a executar, no duplica (salta els correus que ja hi són).
7. Pestanya `membres`: afegeix una fila per a cada persona de l'equip directiu: `EQ-DIR` | `PER-00xx` (el codi és a la columna `id_professor` de la pestanya `professorat`). La resta d'equips i membres es poden fer des del web.
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
5. Si la tornes a executar, no duplica (salta els alumnes amb el mateix nom i cognoms).

### Actualitzar una instal·lació anterior (PAS 21, 22 o 23)
1. Apps Script: enganxa el `Code.gs` nou, desa i executa **configura**. Al registre surt què ha canviat:
   - La pestanya `persones` passa a dir-se **`professorat`**, i la columna `id_persona` passa a **`id_professor`** (també a `membres`).
   - Els camps Estat, NIF, Jornada, Situació laboral, Anys i Català passen a ser visibles només des d'edició (el nivell consulta veu Nom, cognoms, Especialitat, correus i Càrrec). Només es fa una vegada: si després en tornes a fer visible algun, es respecta.
   - Apareix el mòdul **Alumnat** i els seus camps.
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
2. Han de sortir les targetes **Professorat**, **Alumnat** i **Equips i permisos**.
3. Equips i permisos: crea els equips (p. ex. `EQ-COORD` Coordinacions, `EQ-SEC` Secretaria, `EQ-1ESO` Equip docent 1r ESO) i desa.
4. Professorat: a la columna **Equips** de cada docent, tria els seus equips i desa.
5. A cada mòdul, botó **Permisos**: dona a cada equip el nivell que li toqui.

## Ús dels mòduls
Comú a Professorat i Alumnat:
- **Càrrega**: les dades d'un mòdul es llegeixen la primera vegada que s'obre; si tornes a la portada i hi tornes a entrar, no es tornen a llegir. **Actualitza** les torna a llegir del full (p. ex. si algú altre hi ha fet canvis).
- **Filtres**: a sota de cada capçalera; **cercador** general a dalt. Les files amb estat «baixa» no surten si no es marca «Mostra també les baixes» **o** es filtra la columna Estat per «baixa».
- **Recuperar una baixa**: marca «Mostra també les baixes» (o filtra Estat = baixa), prem **Reactiva** a la fila (o tria un altre estat a la cel·la) i **Desa els canvis**.
- **Nom i 1r cognom** queden fixats a l'esquerra quan et desplaces. El codi intern (`PER-…`, `ALU-…`) no es mostra.
- **Modificar**: clic a la cel·la, escriure i Enter (o Tab per passar a la següent). Les cel·les canviades queden en taronja fins que es prem **Desa els canvis** (la barra surt damunt de la graella). Cada cel·la es comprova en sortir: si el valor no té el format correcte, queda en vermell i surt un avís. L'Apps Script ho torna a comprovar en desar.
- **Alta**: «+ Afegeix docent / alumne» (fila verda); el codi es posa en desar.
- **Baixa**: botó «Baixa» de la fila (posa l'estat «baixa»). La **paperera** esborra del tot (només admin; queda a l'historial).
- **Descarta**: torna a deixar la graella com estava en l'última desada, sense tornar a llegir res del full.
- **Errors**: si alguna dada no és vàlida, no es desa res i les cel·les queden en vermell.
- **Dues persones alhora**: si algú altre ha desat la mateixa fila, avisa i deixa triar entre tornar a carregar o desar la teva versió.
- **Visualització camps**: amagar/mostrar amb els botons **Cap** i **Totes** (es recorda en aquest navegador) i arrossegar per canviar l'ordre.
- **Excel / PDF**: el que es veu (filtres i columnes visibles).
- **Gestió camps** (admin): afegir columnes, canviar-ne el nom, el tipus (text, número, data, llista, sí/no, correu amb domini, NIF/NIE, calculat), els valors, si és obligatòria o única, des de quin nivell es veu i si ve de Clickedu (no s'edita). Una columna no s'esborra: s'arxiva (desmarcar «Actiu»). L'**Estat** és un camp de sistema: sempre és una llista obligatòria i sempre té el valor «baixa».
- **Mòbil**: fitxes de consulta; per editar, ordinador.

### Professorat
- **Estat** (obligatori): actiu, baixa laboral, substitut o baixa. **Situació laboral**: Definitiu, Comissió de serveis, Provisional o Interí. **Jornada**: Sencera, 1/2 o ⅔.
- Formats: correu XTEC acabat en `@xtec.cat`, correu institutjoanmiro acabat en `@institutjoanmiro.cat`, NIF/NIE amb la lletra correcta.
- **Equips**: columna que només veu qui té edició; només la direcció la pot canviar.

### Alumnat
- Camps, per aquest ordre: nom, cognoms, Grup-Classe 25-26, Grup-Classe 26-27 (obligatori), Estat (obligatori), Optativa 1r, Optativa 2n, Div. mates / català / castellà, Nouvingut, Data arribada, PI/PSP, NESE-A, NESE-B, NEE, Aut. imatge, Aut. dies especials, Aut. medicaments.
- El **nivell** el marca el Grup-Classe 26-27:
  - **1r d'ESO**: Grup-Classe 25-26 i Optativa 2n no s'omplen (surten ratllats); Estat: alumne extern, repeteix 1r o baixa.
  - **2n d'ESO**: Estat: promociona, repeteix 2n, alumne extern o baixa.
- Diversitats, Nouvingut, PI/PSP, NESE i NEE: sí / (buit). **Autoritzacions**: sí / no / (buit = sense resposta).
- **Data arribada**: es pot escriure 15/09/2026; es desa com 2026-09-15 i es comprova que la data existeixi.
- La graella s'ordena per grup i cognoms.

## Proves en local
`netlify dev` (vegeu `LEGIR_PROVES_LOCALS.md`) i obre http://localhost:8888/gestio/ — fa servir els fulls reals.
