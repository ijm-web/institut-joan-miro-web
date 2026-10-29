# GESTIO · com funciona i com activar-la

Àrea privada de gestió del centre a **/gestio**: s'hi entra amb el compte de Google de l'escola i cada persona veu només els mòduls que té assignats algun dels seus equips. Disseny i decisions: document «GESTIO · Proposta de disseny».

## Peces

| Peça | On és | Què fa |
|---|---|---|
| Pàgina | `src/gestio.njk`, `src/assets/js/gestio.js`, `src/assets/css/gestio.css` | Accés, portada amb targetes, graella (Tabulator 6.3.1 de cdnjs), finestres de camps i permisos |
| Funcions de Netlify | `netlify/functions/gestio-{config,login,api,sortir}.mjs`, `netlify/lib/gestio.mjs` | Accés amb Google, galeta de sessió (8 h) i pas de les peticions a l'Apps Script amb el correu de la sessió |
| Apps Script | `apps-script/gestio_db/Code.gs` (còpia de referència) | Dades i **permisos**: qui pot fer què ho decideix aquí, a cada petició |
| Full | **ijm_nucli_db** (Google Sheets) | Pestanyes `config`, `persones`, `equips`, `membres`, `moduls`, `permisos`, `camps`, `historial` |

Programacions no es toca: GESTIO té les seves funcions, la seva galeta (`ijm_gestio`) i el seu full.

## Nivells

| Nivell | Pot |
|---|---|
| Consulta | Veure, filtrar, ordenar i exportar (Excel, PDF) |
| Edició | A més, alta, baixa i modificació de files · donar «consulta» a altres equips |
| Admin | A més, camps (columnes) del mòdul · donar «consulta» i «edició» |
| Admin global | L'equip directiu (`EQ-DIR`, permís `*` admin) i els correus de `config › admins`: tots els mòduls, el mòdul Equips, qui és a cada equip i el nivell admin |

Els permisos es donen a **equips** (pestanya `permisos`), mai a persones. Una persona pot ser a diversos equips (pestanya `membres`); val el nivell més alt. Una persona de baixa (`actiu = no`) ja no pot entrar.

## Activació (una sola vegada)

### 1. Full i Apps Script
1. A Google Drive (a la carpeta de treball), crea un full de càlcul nou que es digui **ijm_nucli_db**. No el comparteixis amb ningú més.
2. Extensions › Apps Script. Esborra el contingut de `Code.gs` i enganxa-hi `apps-script/gestio_db/Code.gs`. Desa.
3. ⚙️ Configuració del projecte › Propietats de l'script › Afegeix: `GESTIO_SECRET` = un text llarg inventat (p. ex. 40 lletres i xifres). Guarda'l: el necessitaràs a Netlify.
4. A l'editor, tria la funció **configura** › ▶ Executa (autoritza-la). Crea les pestanyes, els mòduls Professorat i Equips, els 18 camps del professorat i l'equip `EQ-DIR` amb permís admin a tot.
5. Al full, pestanya `config`: posa el teu correu a **admins** (accés d'emergència) i, a **font_professorat**, l'URL del full actual de professorat (i a `font_professorat_pestanya` el nom de la pestanya, si no és la primera).
6. A l'editor, executa **importaProfessorat**. Al registre d'execució diu quantes persones ha importat i quines columnes ha reconegut. Només importa les columnes previstes (Nom, 1r Cognom, 2n Cognom, NIF, Especialitat, email xtec, email institutjoanmiro, Jornada, Definitiu, Comissió Serveis, Provisional, Interí, Anys, Català, Càrrec); «Nom+1r cognom», «Nom Complet» i «Nom Complet (cognoms, nom)» es calculen soles. Si la tornes a executar, no duplica (salta els correus que ja hi són).
7. Pestanya `membres`: afegeix una fila per a cada persona de l'equip directiu: `EQ-DIR` | `PER-00xx` (el codi és a la pestanya `persones`). La resta d'equips i membres es poden fer des del web.
8. Desplega › Desplegament nou › Tipus: **Aplicació web** · Executa com a: **Jo** · Qui hi té accés: **Qualsevol** › Desplega. Copia l'URL que acaba en `/exec`.

### 2. Variables d'entorn a Netlify
Site configuration › Environment variables › Add a variable (àmbit «All» o, com a mínim, Production i Local development):

| Variable | Valor |
|---|---|
| `GESTIO_SCRIPT_URL` | L'URL `/exec` del pas 1.8 |
| `GESTIO_SCRIPT_SECRET` | El mateix text que `GESTIO_SECRET` del pas 1.3 |
| `GESTIO_SECRET` | (opcional) un altre text llarg per signar la galeta de sessió; si no hi és, es fa servir `PROGRAMACIONS_SECRET` |

`GOOGLE_CLIENT_ID` ja hi és (Programacions). Després: Deploys › Trigger deploy › Deploy site.

### 3. Comprovar-ho
1. Obre https://institutjoanmiro.netlify.app/gestio i entra amb el teu compte.
2. Ha de sortir la targeta **Professorat** (Administració) i **Equips i permisos**.
3. Equips i permisos: crea els equips (p. ex. `EQ-COORD` Coordinacions, `EQ-SEC` Secretaria) i desa.
4. Professorat: a la columna **Equips** de cada persona, tria els seus equips i desa.
5. Professorat › **Permisos**: dona a cada equip el nivell que li toqui per a aquest mòdul.

## Ús del mòdul Professorat
- **Filtres**: a sota de cada capçalera; **cercador** general a dalt; «Mostra també les baixes».
- **Modificar**: clic a la cel·la, escriure i Enter (o Tab per passar a la següent). Les cel·les canviades queden en taronja fins que es prem **Desa els canvis**. Els camps calculats (gris, cursiva) es recalculen sols.
- **Alta**: «+ Afegeix docent» (fila verda); el codi `PER-…` es posa en desar.
- **Baixa**: botó «Baixa» de la fila (es pot reactivar). «✕» esborra del tot (només admin; queda a l'historial).
- **Errors**: si alguna dada no és vàlida (obligatori buit, correu fora del domini, valor repetit…), no es desa res i les cel·les queden en vermell.
- **Dues persones alhora**: si algú altre ha desat la mateixa fila, avisa i deixa triar entre tornar a carregar o desar la teva versió.
- **Columnes**: amagar/mostrar (es recorda en aquest navegador) i arrossegar per canviar l'ordre.
- **Camps** (admin): afegir columnes, canviar-ne el nom, el tipus (text, número, data, llista, sí/no, correu, calculat), els valors, si és obligatòria o única, des de quin nivell es veu (p. ex. el NIF, des d'edició) i si ve de Clickedu (no s'edita). Una columna no s'esborra: s'arxiva (desmarcar «Actiu»).
- **Mòbil**: fitxes de consulta; per editar, ordinador.

## Proves en local
`netlify dev` (vegeu `LEGIR_PROVES_LOCALS.md`) i obre http://localhost:8888/gestio/ — fa servir el full real.
