// PAS 56 · GET /api/gestio-publics?quin=professorat  →  professorat en actiu (nom, especialitat i correu del centre) per a
// la pàgina El nostre centre › Professorat. GET /api/gestio-publics?quin=calendari → darrer calendari publicat des de
// GESTIO › Calendari. Dades públiques (les mateixes que ja surten al web), sense sessió. Resposta guardada 5 minuts
// (memòria de la funció i CDN de Netlify).
import { cridaGestio, json } from '../lib/gestio.mjs';

const QUINS = ['professorat', 'calendari'];
const DURADA = 5 * 60 * 1000;
const cau = new Map();

export default async (req) => {
  const quin = new URL(req.url).searchParams.get('quin') || '';
  if (!QUINS.includes(quin)) return json({ ok: false, error: 'peticio_invalida' }, 400);
  const ara = Date.now(), desat = cau.get(quin);
  const capcaleres = { 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };
  if (desat && desat.fins > ara) return json(desat.dades, 200, capcaleres);
  try {
    const r = await cridaGestio('publics', { quin });
    if (!r.ok) return json({ ok: false, error: r.error || 'error' }, r.error === 'no_publicat' ? 404 : 502);
    cau.set(quin, { fins: ara + DURADA, dades: r });
    return json(r, 200, capcaleres);
  } catch (err) {
    console.error('[gestio-publics]', err.codi || '', err.message);
    return json({ ok: false, error: err.codi || 'error_servidor' }, 500);
  }
};

export const config = { path: '/api/gestio-publics' };
