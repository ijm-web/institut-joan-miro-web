# Programacions (àrea privada) · com activar-la

Adreça: **https://institutjoanmiro.netlify.app/programacions**

## Com funciona

1. La pàgina `/programacions` només mostra el botó «Inicia la sessió amb Google». No conté cap informació privada.
2. Google comprova el compte. La funció `programacions-login` verifica que:
   - el compte és del domini **@institutjoanmiro.cat**;
   - el correu consta a la pestanya **departaments** del full de dades (columna `email`), consultant-ho pel mateix pont d'Apps Script que fa servir el web de llibres (acció `loginEmail`). També hi entren els correus de `config › admins`.
3. Si té accés, rep una galeta de sessió signada (HttpOnly, 8 hores).
4. El contingut privat el serveix la funció `programacions-contingut` només si la galeta és vàlida. De moment és una pàgina «En construcció».

Per donar o treure accés a algú: afegiu o traieu el seu correu a la pestanya `departaments` (fila del curs de gestió). No cal tocar el web.

## Configuració (una sola vegada)

### 1. Variables d'entorn a Netlify (web de l'institut)

Netlify › site **institutjoanmiro** › Site configuration › Environment variables › Add a variable:

| Variable | Valor |
|---|---|
| `APPS_SCRIPT_URL` | El mateix valor que té el site de llibres |
| `APPS_SCRIPT_SECRET` | El mateix valor que té el site de llibres |
| `GOOGLE_CLIENT_ID` | El mateix Client ID que fa servir el site de llibres |
| `PROGRAMACIONS_SECRET` | Un text llarg i aleatori nou (p. ex. 40 caràcters), diferent dels altres |
| `GOOGLE_DOMINI` | `institutjoanmiro.cat` (opcional; és el valor per defecte) |

Després de desar-les: Deploys › Trigger deploy › Deploy site.

### 2. Autoritzar el web a Google

Google Cloud Console › APIs i serveis › Credencials › el client OAuth del web de llibres › **Orígens de JavaScript autoritzats** › afegiu:

- `https://institutjoanmiro.netlify.app`
- (quan es canviï el domini) `https://institutjoanmiro.cat`

Desa. Pot trigar uns minuts a funcionar.

### 3. Comprovar-ho

- Amb un compte que consti a `departaments` → ha d'aparèixer «En construcció» i el vostre correu.
- Amb un compte de l'institut que no hi consti → missatge «Aquest compte no té accés…».
- Amb un compte de Gmail → missatge «Cal entrar amb un compte @institutjoanmiro.cat».

## Nota

L'accés depèn de l'opció `config › acces_google = si` del full de dades (la mateixa que el web de llibres). Si es desactiva, tampoc es podrà entrar a Programacions.

Fitxers: `src/programacions.njk`, `src/assets/css/programacions.css`, `netlify/functions/programacions-*.mjs`, `netlify/lib/programacions.mjs`.
