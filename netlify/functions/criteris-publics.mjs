// GET /api/criteris-publics?nivell=ESO%201r  →  criteris de qualificació del nivell (curs actual), públic.
// Ho fan servir els enllaços «Criteris de qualificació» de les pàgines d'ESO i de Batxillerat per generar el PDF
// (src/assets/js/criteris-pdf.js). Les dades són les de programacions_db (acció «publics» de l'Apps Script),
// sense correus de qui ha desat. Resposta guardada 5 minuts (memòria de la funció i CDN de Netlify).
import { cridaProg, cursActual, json } from '../lib/programacions.mjs';

const NIVELLS = ['ESO 1r', 'ESO 2n', 'ESO 3r', 'ESO 4t', 'BAT 1r', 'BAT 2n'];
const DURADA = 5 * 60 * 1000;
const cau = new Map();

export default async (req) => {
  const nivell = new URL(req.url).searchParams.get('nivell') || '';
  if (!NIVELLS.includes(nivell)) return json({ ok: false, error: 'nivell_invalid' }, 400);
  const curs = cursActual();
  const clau = `${curs}|${nivell}`;
  const ara = Date.now();
  const desat = cau.get(clau);
  const capcaleres = { 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };
  if (desat && desat.fins > ara) return json(desat.dades, 200, capcaleres);
  try {
    const r = await cridaProg('publics', { curs, nivell });
    if (!r.ok) return json({ ok: false, error: 'prog_' + (r.error || 'error') }, 502);
    const dades = { ok: true, curs, nivell, materies: r.materies || [], competencies_digitals: r.competencies_digitals || [] };
    cau.set(clau, { fins: ara + DURADA, dades });
    return json(dades, 200, capcaleres);
  } catch (err) {
    console.error('[criteris-publics]', err.codi || '', err.message);
    return json({ ok: false, error: err.codi || 'error_servidor' }, 500);
  }
};

export const config = { path: '/api/criteris-publics' };
