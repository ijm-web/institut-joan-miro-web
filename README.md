# Site de l'Institut Joan Miró — projecte Eleventy

## Per què això existeix

Amb ~30 pàgines previstes, mantenir la barra superior, el menú i el peu
copiats a cada fitxer .html s'hauria convertit en una feinada (un canvi
al menú = 30 canvis manuals). Ara hi ha **una sola plantilla base**
(`src/_includes/base.njk`) amb aquestes tres peces compartides. Cada
pàgina és un fitxer petit amb només el seu contingut propi. Eleventy
combina totes dues coses i genera els fitxers .html finals a `_site/`.

## Estructura

```
src/
 ├─ _includes/
 │   └─ base.njk        ← barra superior + menú + peu + <head> compartit.
 │                          TOCA AQUEST FITXER quan vulguis canviar el
 │                          menú, el peu, els colors, etc. — s'aplicarà
 │                          a totes les pàgines de cop.
 ├─ index.html           ← contingut únic de la pàgina d'inici
 └─ contacte.html        ← contingut únic de la pàgina de contacte

netlify/
 └─ functions/
     └─ procesa-contacte.js   ← envia el correu del formulari de contacte

_site/                   ← es genera SOL en compilar (no el toquis mai
                             a mà, es podria sobreescriure)
```

## Com afegir una pàgina nova (per exemple "Estudis")

1. Crea `src/estudis.html` amb aquesta capçalera i el contingut a sota:

   ```html
   ---
   layout: base.njk
   title: Estudis — Institut Joan Miró
   permalink: "estudis.html"
   pageStyles: |
     /* aquí el CSS específic d'aquesta pàgina, si en necessita */
   ---
   <section>
     <h1>Estudis</h1>
     <p>El contingut de la pàgina...</p>
   </section>
   ```

2. No cal tocar res més: la barra superior, el menú i el peu ja hi
   apareixen automàticament, agafats de `base.njk`.

3. Recorda afegir l'enllaç a aquesta pàgina nova dins del menú, a
   `base.njk` (ho fem junts la primera vegada que ho necessitis).

## Com veure el site en local (amb VS Code)

Obre un terminal integrat de VS Code (Terminal → New Terminal) a la
carpeta del projecte i executa:

```
npm install
npm run serve
```

Això aixeca un servidor local (normalment a `http://localhost:8080`)
que es recarrega sol cada vegada que desis un canvi. Obre aquesta
adreça al navegador (o amb l'extensió "Simple Browser" del propi
VS Code) per veure els canvis a l'instant.

Guia completa (també Programacions amb `netlify dev`, i què cal comprovar a cada pas): **[LEGIR_PROVES_LOCALS.md](LEGIR_PROVES_LOCALS.md)**.

## Com generar la versió final (per desplegar)

```
npm run build
```

Genera tots els fitxers .html definitius dins de `_site/`. Aquesta
és la carpeta que Netlify ha de publicar — ho fa automàticament si
el desplegament és via Git (veure més avall).

## Desplegament a Netlify

Amb el pas de compilació d'Eleventy, arrossegar la carpeta sencera del
projecte ja NO funciona igual que abans (cal generar `_site/` primer).
Parla-ho amb Claude per triar entre:

- **Netlify CLI** (`netlify deploy`): fas servir el terminal, sense
  necessitat de GitHub, però Netlify executa el `build` per tu.
- **Git + GitHub connectat a Netlify** (recomanat a partir d'ara,
  amb 30 pàgines): puges els canvis amb `git push` i Netlify
  compila i desplega sol, incloent la funció de correu.
