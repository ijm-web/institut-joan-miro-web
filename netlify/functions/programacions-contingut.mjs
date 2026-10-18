// GET /api/programacions/contingut → dades de la sessió (només amb sessió vàlida).
// La pàgina /programacions no mostra res de l'àrea privada fins que aquesta funció respon ok.
// Les dades (criteris, matèries…) les serveix /api/programacions/criteris.
import { sessio, json, cursActual } from '../lib/programacions.mjs';

export default async (req) => {
  const s = sessio(req);
  if (!s) return json({ ok: false, error: 'sessio_no_valida' }, 401);
  return json({ ok: true, email: s.email, admin: s.admin, departaments: s.departaments, curs: cursActual() });
};

export const config = { path: '/api/programacions/contingut' };
