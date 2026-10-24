# Com provar la pàgina web en local (pas a pas)

Guia per comprovar els canvis a l'ordinador **abans de fer `git push`**. Tot es fa des del terminal de VS Code (Terminal › New Terminal), **dins de la carpeta del projecte**:

```
cd "C:\Users\rmendoza\Documents\Projecte Pàgina Web\institut-joan-miro-eleventy"
```

Hi ha dues maneres de provar-ho:

| Què voleu provar | Ordre | Adreça |
|---|---|---|
| Pàgines normals (inici, estudis, projectes, serveis, secretaria…) | `npm run serve` | http://localhost:8080 |
| Tot el que fa servir funcions de Netlify: **Programacions**, PDF públics de criteris (ESO i Batxillerat), formulari de contacte | `netlify dev` | http://localhost:8888 |

---

## 0. Requisits (només la primera vegada)

1. **Node.js** (versió LTS) i **Git** instal·lats. Comproveu-ho:
   ```
   node -v
   git --version
   ```
2. Instal·leu les dependències del projecte (i torneu-ho a fer quan canviï `package.json`):
   ```
   npm install
   ```
3. Per a `netlify dev`, la línia d'ordres de Netlify:
   ```
   npm install -g netlify-cli
   netlify --version
   ```
   Si PowerShell diu que «l'execució de scripts està deshabilitada», executeu una vegada `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` i torneu-ho a provar.

## 1. Incorporar el paquet de canvis (bundle)

```
git status
git bundle verify canvis-AAAA-MM-DD-pas-N.bundle
git pull canvis-AAAA-MM-DD-pas-N.bundle main
git log --oneline -5
```

`git status` ha de dir que no hi ha canvis pendents abans del `pull`. **No feu `git push` fins que no ho hàgiu provat.**

## 2. Pàgines normals: `npm run serve`

```
npm run serve
```

1. Espereu el missatge `Server at http://localhost:8080/`.
2. Obriu http://localhost:8080 al navegador.
3. Cada vegada que deseu un fitxer, la pàgina es torna a generar sola.
4. Si no veieu un canvi d'estils o de JavaScript, forceu la recàrrega amb **Ctrl + F5**.
5. Per aturar el servidor: **Ctrl + C** al terminal.

Aquí **no funcionen** Programacions ni els PDF públics de criteris (necessiten les funcions de Netlify): feu servir el punt 3.

## 3. Programacions i funcions: `netlify dev`

### 3.1 Preparació (una sola vegada)

1. Inicieu la sessió a Netlify (s'obre el navegador; cal el codi de l'app d'autenticació):
   ```
   netlify login
   ```
2. Vinculeu la carpeta amb el web de l'institut (trieu el site de la llista):
   ```
   netlify link
   ```
3. Variables d'entorn: `netlify dev` les baixa de Netlify. A **Site configuration › Environment variables**, comproveu que `PROG_SCRIPT_URL`, `PROG_SCRIPT_SECRET`, `GOOGLE_CLIENT_ID`, `PROGRAMACIONS_SECRET`… tenen marcat l'àmbit **Local development (Netlify CLI)** (o «All»). Les podeu llistar amb `netlify env:list`.
4. Inici de sessió amb Google en local: a **Google Cloud Console › APIs i serveis › Credencials**, obriu el client OAuth del web i afegiu a **Orígens de JavaScript autoritzats**:
   - `http://localhost:8888`
   - `http://localhost`

   El canvi pot trigar uns minuts a fer efecte.

### 3.2 Cada vegada

```
netlify dev
```

1. Espereu el missatge `Server now ready on http://localhost:8888`.
2. Obriu **http://localhost:8888/programacions/** (no el 8080) i entreu amb el compte de l'escola.
3. Per aturar-ho: **Ctrl + C**.

> ⚠️ **Compte: en local es treballa amb les dades reals** de programacions_db. Tot el que es desi és definitiu. Feu les proves amb una matèria que sigui vostra i, si cal, després torneu a deixar-la com estava.

> ⚠️ Si el canvi inclou un `Code.gs` nou (com el PAS 13), **primer** cal actualitzar l'Apps Script de programacions_db: enganxar el codi, executar `configura` i desplegar una **versió nova** (Desplega › Gestiona els desplegaments › ✏️ › Versió nova). Si no, els camps nous no es desen.

## 4. Què cal comprovar (PAS 13)

**Pàgines normals (8080)**

- [ ] **Projectes › Llengües estrangeres › Internacionalització › Itàlia** (`/projectes-erasmus-italia.html`): primer el viatge i l'estada a Roma, després Barcelona; text inicial nou amb l'enllaç a Sinopoli Ferrini (s'obre en una pestanya nova); xifra «Llengües: italià i anglès». Proveu també `/es/` i `/en/`.
- [ ] **Estudis › Batxillerat** (`/batxillerat.html`): a 1r i 2n un sol enllaç «Descripció de matèries de batxillerat»; el PDF inclou Empresa i Història de l'Art de 2n.

**Programacions (8888)**

- [ ] **Gestió Criteris de Qualificació › una matèria**, apartat 3: «Criteris per aprovar la matèria», «Recuperació trimestral i final», «Recuperació de matèries pendents de cursos anteriors» (obligatoris, amb *), «Criteris per millorar la nota» i «Observacions» (opcionals), i la taula «Pes dels instruments per blocs» (Afegeix bloc, total 100 %).
- [ ] Deseu sense omplir les pendents: ha d'avisar. La matèria només surt **Completa** amb els tres camps obligatoris.
- [ ] PDF de criteris: surten la taula de blocs, les pendents i la millora de nota.
- [ ] **Programacions de matèries › la mateixa matèria**: a l'apartat H ja no hi ha cap camp per omplir, només el resum del que ve dels criteris i l'enllaç «Edita els criteris de qualificació →». A la vista prèvia i al PDF hi surten els blocs, els criteris per aprovar, la recuperació, les pendents, la millora de nota i les observacions.
- [ ] A, «Responsable de departament/àmbit»; a F, ja no hi ha «Repte o projecte»; a E, la CPSAA en blanc mostra «Es defineixen segons el desplegament de la competència personal, social i d'aprendre a aprendre.»; a J, les sortides en blanc mostren «No es programa cap sortida i activitat complementària.»
- [ ] **Estudis › ESO** (8888): l'enllaç «Criteris de qualificació (PDF)» d'un nivell genera el PDF amb els camps nous.

## 5. Problemes habituals

| Problema | Solució |
|---|---|
| `localhost:8080/programacions/` no fa res | Normal: cal `netlify dev` i el port 8888. |
| «Port 8080/8888 already in use» | Hi ha un altre servidor obert: tanqueu l'altre terminal o premeu Ctrl + C. |
| `netlify` no es reconeix | `npm install -g netlify-cli` o feu servir `npx netlify-cli dev`. |
| Google diu «origin_mismatch» / el botó no surt | Falten els orígens del punt 3.1.4, o encara no s'han aplicat. |
| «No s'ha pogut connectar amb programacions_db» | Variables d'entorn no disponibles en local (punt 3.1.3) o Apps Script sense desplegar. |
| No es veu un canvi | Ctrl + F5; si continua, atureu el servidor, esborreu la carpeta `_site` i torneu-lo a engegar. |
| El terminal de VS Code no mostra el prompt | Tanqueu el terminal (icona de la paperera) i obriu-ne un de nou. |

## 6. Quan tot és correcte

```
git status
git log --oneline -5
git push origin main
```

Netlify publica els canvis automàticament en un o dos minuts (Deploys, a app.netlify.com).
