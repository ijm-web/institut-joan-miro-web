/**
 * joanmiro_db · canvi de nom de matèries (execució manual, una sola vegada)
 *
 * On va: joanmiro_db › Extensions › Apps Script › + (fitxer nou) «reanomena_materies», enganxa aquest codi i desa.
 * No cal desplegar res. Quan s'hagi fet el canvi, aquest fitxer es pot esborrar de l'editor.
 *
 * Canvia el nom de les matèries a la pestanya «materies» (columna materia) i l'id_materia de la pestanya
 * «llibres», només per als cursos indicats. Cal fer el mateix a programacions_db (funció reanomenaMateries).
 * 1) Executa reanomenaMateriesJoanmiroProva: només diu quantes files canviaria (Registre d'execució).
 * 2) Executa reanomenaMateriesJoanmiro: fa el canvi. Si el nom nou ja hi és, s'atura sense tocar res.
 */
const REANOMENA_JM = {
  cursos: ['2026-2027'],
  canvis: [   // [nivell, nom antic, nom nou]
    ['ESO 1r', 'Tecnologia', 'Tecnologia i Digitalització'],
    ['ESO 2n', 'Tecnologia', 'Tecnologia i Digitalització'],
    ['ESO 3r', 'Tecnologia', 'Tecnologia i Digitalització'],
  ],
};

function reanomenaMateriesJoanmiroProva() { return reanomenaJM_(true); }
function reanomenaMateriesJoanmiro() { return reanomenaJM_(false); }

function reanomenaJM_(prova) {
  const ss = SpreadsheetApp.getActive();
  const norm = (s) => String(s).trim().toLowerCase();
  const plans = [], conflictes = [];
  const idAntic = {}, idsNous = [];
  REANOMENA_JM.canvis.forEach((c) => { idAntic[c[0] + ' - ' + c[1]] = c[0] + ' - ' + c[2]; idsNous.push(c[0] + ' - ' + c[2]); });

  // Pestanya materies: nivell | materia | tipus | departament | curs
  const mat = ss.getSheetByName('materies');
  if (!mat) throw new Error('No hi ha la pestanya «materies».');
  let v = mat.getDataRange().getValues(), cap = v[0].map(norm);
  const cN = cap.indexOf('nivell'), cM = cap.indexOf('materia'), cC = cap.indexOf('curs');
  if (cN < 0 || cM < 0 || cC < 0) throw new Error('La pestanya «materies» ha de tenir les columnes nivell, materia i curs.');
  const canvisMat = [];
  for (let i = 1; i < v.length; i++) {
    if (REANOMENA_JM.cursos.indexOf(String(v[i][cC]).trim()) < 0) continue;
    const id = String(v[i][cN]).trim() + ' - ' + String(v[i][cM]).trim();
    if (idAntic[id]) canvisMat.push([i + 1, idAntic[id].split(' - ').slice(1).join(' - ')]);
    else if (idsNous.indexOf(id) >= 0) conflictes.push('materies fila ' + (i + 1) + ': ' + id);
  }
  if (canvisMat.length) plans.push({ full: mat, col: cM + 1, canvis: canvisMat });

  // Pestanya llibres: departament | id_materia | curs | …
  const ll = ss.getSheetByName('llibres');
  if (ll && ll.getLastRow() > 1) {
    v = ll.getDataRange().getValues(); cap = v[0].map(norm);
    const cI = cap.indexOf('id_materia'), cC2 = cap.indexOf('curs');
    const canvisLl = [];
    for (let i = 1; i < v.length; i++) {
      if (cC2 >= 0 && REANOMENA_JM.cursos.indexOf(String(v[i][cC2]).trim()) < 0) continue;
      const id = String(v[i][cI]).trim();
      if (idAntic[id]) canvisLl.push([i + 1, idAntic[id]]);
    }
    if (canvisLl.length) plans.push({ full: ll, col: cI + 1, canvis: canvisLl });
  }

  plans.forEach((p) => Logger.log(p.full.getName() + ': ' + p.canvis.length + ' files'));
  if (!plans.length) { Logger.log('No hi ha res a canviar (potser ja està fet).'); return; }
  if (conflictes.length) { Logger.log('ATURAT: el nom nou ja hi és. ' + conflictes.join(' · ')); return; }
  if (prova) { Logger.log('Prova: no s\'ha canviat res.'); return; }
  plans.forEach((p) => p.canvis.forEach((c) => p.full.getRange(c[0], p.col).setValues([[c[1]]])));
  Logger.log('Fet: ' + plans.reduce((s, p) => s + p.canvis.length, 0) + ' files canviades.');
}
