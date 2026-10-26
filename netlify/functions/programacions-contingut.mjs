// GET /api/programacions/contingut → dades de la sessió (només amb sessió vàlida).
// La pàgina /programacions no mostra res de l'àrea privada fins que aquesta funció respon ok.
// Les dades (criteris, matèries…) les serveix /api/programacions/criteris.
import { sessio, json, configProg } from '../lib/programacions.mjs';

export default async (req) => {
  const s = sessio(req);
  if (!s) return json({ ok: false, error: 'sessio_no_valida' }, 401);
  // Estat de les Programacions de matèries (config › estat_programacions) per pintar la portada.
  // Si no es pot llegir, es considera «ocult» (la Gestió de criteris no en depèn).
  let estat_programacions = 'ocult';
  try { estat_programacions = (await configProg()).estat_programacions; } catch (err) { console.error('[programacions-contingut]', err.codi || '', err.message); }
  return json({ ok: true, email: s.email, admin: s.admin, departaments: s.departaments, estat_programacions });
};

export const config = { path: '/api/programacions/contingut' };
