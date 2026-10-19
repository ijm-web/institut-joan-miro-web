// Gestió de criteris de qualificació (àrea privada Programacions).
//
// GET  /api/programacions/criteris?curs=2026-2027
//      → departaments i matèries de l'usuari (joanmiro_db) + criteris, competències i textos (programacions_db)
// POST /api/programacions/criteris  { accio, ... }
//      accio = desa       { curs, id_materia, criteris[], competencies[], info{}, data_anterior, forca? }
//              esborra    { curs, id_materia }
//              materia    { curs, id_materia, curs_origen }   (dades d'un altre curs, per copiar-les)
//              importacio { origen }                          (dades 2025-2026 importades)
//
// Permisos: només les matèries dels departaments de l'usuari (els admins, totes).
// Només es pot modificar el curs de gestió (programacions_db › config › curs_gestio); els altres cursos són
// de consulta, excepte per als admins. Sense ?curs= s'obre el curs de gestió.
import { sessio, json, cridaProg, configProg, materiesPermeses } from '../lib/programacions.mjs';

const cursValid = (c) => /^\d{4}-\d{4}$/.test(String(c || ''));

export default async (req) => {
  const s = sessio(req);
  if (!s) return json({ ok: false, error: 'sessio_no_valida' }, 401);

  try {
    const cfg = await configProg();
    const gestio = cfg.curs_gestio;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const curs = cursValid(url.searchParams.get('curs')) ? url.searchParams.get('curs') : gestio;
      const perm = await materiesPermeses(s, curs);
      const r = await cridaProg('inici', { curs, materies: perm.materies.map((m) => m.id_materia) });
      if (!r.ok) return json({ ok: false, error: 'prog_' + (r.error || 'error'), detall: r.detall || '' }, 502);
      const cursos = [...new Set([gestio, cfg.curs_publicat, curs, ...perm.cursos, ...(r.cursos || [])])].filter(cursValid).sort().reverse();
      const editable = (s.admin || curs === gestio) && (String(r.config.estat).toLowerCase() === 'obert' || s.admin);
      return json({
        ok: true, curs, curs_gestio: gestio, curs_publicat: cfg.curs_publicat, cursos, editable, admin: s.admin, email: s.email,
        estat: r.config.estat, missatge: r.config.missatge,
        departaments: perm.departaments, materies: perm.materies,
        criteris: r.criteris, competencies: r.competencies, info: r.info,
        competencies_digitals: r.competencies_digitals, origens: r.origens || [],
      });
    }

    if (req.method !== 'POST') return json({ ok: false, error: 'metode_no_permes' }, 405);
    let cos;
    try { cos = await req.json(); } catch { return json({ ok: false, error: 'peticio_invalida' }, 400); }
    const accio = String(cos.accio || '');

    if (accio === 'importacio') {
      const r = await cridaProg('importacio', { origen: String(cos.origen || '') });
      return json(r, r.ok ? 200 : 400);
    }

    const curs = String(cos.curs || '');
    const id = String(cos.id_materia || '');
    if (!cursValid(curs) || !id) return json({ ok: false, error: 'peticio_invalida' }, 400);
    const perm = await materiesPermeses(s, curs);
    const mat = perm.materies.find((m) => m.id_materia === id);
    if (!mat) return json({ ok: false, error: 'materia_no_permesa' }, 403);

    if (accio === 'materia') {
      const origen = cursValid(cos.curs_origen) ? cos.curs_origen : curs;
      const r = await cridaProg('materia', { curs: origen, id_materia: id });
      return json(r, r.ok ? 200 : 400);
    }

    if (accio === 'desa' || accio === 'esborra') {
      if (!s.admin && curs !== gestio) return json({ ok: false, error: 'curs_nomes_lectura' }, 403);
      const r = await cridaProg(accio, {
        curs, id_materia: id, departament: mat.departament, usuari: s.email, admin: s.admin,
        criteris: cos.criteris, competencies: cos.competencies, info: cos.info,
        data_anterior: cos.data_anterior || '', forca: !!cos.forca,
      });
      return json(r, r.ok ? 200 : (r.error === 'conflicte' ? 409 : 400));
    }

    return json({ ok: false, error: 'accio_desconeguda' }, 400);
  } catch (err) {
    console.error('[programacions-criteris]', err.codi || '', err.message);
    return json({ ok: false, error: err.codi || 'error_servidor', detall: err.detall || (err.codi ? '' : err.message) }, 500);
  }
};

export const config = { path: '/api/programacions/criteris' };
