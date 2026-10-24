// Programacions de matèries (àrea privada Programacions). De moment, només ESO.
//
// GET  /api/programacions/materies?curs=2026-2027
//      → matèries d'ESO dels departaments de l'usuari (joanmiro_db) + programacions, criteris de qualificació,
//        competències, textos (criteri per aprovar, recuperació) i textos comuns (programacions_db)
// POST /api/programacions/materies  { accio, ... }
//      accio = desa     { curs, id_materia, programacio{}, data_anterior, forca? }
//              esborra  { curs, id_materia }
//              materia  { curs, id_materia, curs_origen, id_origen? }   (programació d'un altre curs o d'una altra matèria, per copiar-la)
//
// Permisos: els mateixos que la Gestió Criteris de Qualificació (departaments de l'usuari, curs de gestió,
// config › estat). Les competències i els criteris de qualificació es gestionen a /api/programacions/criteris.
import { sessio, json, cridaProg, configProg, materiesPermeses } from '../lib/programacions.mjs';

const cursValid = (c) => /^\d{4}-\d{4}$/.test(String(c || ''));
const esESO = (m) => /^ESO/.test(String((m && m.nivell) || ''));

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
      const materies = perm.materies.filter(esESO);
      const r = await cridaProg('prog_inici', { curs, materies: materies.map((m) => m.id_materia) });
      if (!r.ok) return json({ ok: false, error: 'prog_' + (r.error || 'error'), detall: r.detall || '' }, 502);
      const cursos = [...new Set([gestio, cfg.curs_publicat, curs, ...perm.cursos, ...(r.cursos || [])])].filter(cursValid).sort().reverse();
      const editable = (s.admin || curs === gestio) && (String(r.config.estat).toLowerCase() === 'obert' || s.admin);
      return json({
        ok: true, curs, curs_gestio: gestio, curs_publicat: cfg.curs_publicat, cursos, editable, admin: s.admin, email: s.email,
        estat: r.config.estat, missatge: r.config.missatge,
        departaments: perm.departaments, materies,
        programacions: r.programacions || [], textos: r.textos || {},
        criteris: r.criteris, competencies: r.competencies, info: r.info, competencies_digitals: r.competencies_digitals,
      });
    }

    if (req.method !== 'POST') return json({ ok: false, error: 'metode_no_permes' }, 405);
    let cos;
    try { cos = await req.json(); } catch { return json({ ok: false, error: 'peticio_invalida' }, 400); }
    const accio = String(cos.accio || '');
    const curs = String(cos.curs || '');
    const id = String(cos.id_materia || '');
    if (!cursValid(curs) || !id) return json({ ok: false, error: 'peticio_invalida' }, 400);
    const perm = await materiesPermeses(s, curs);
    const mat = perm.materies.find((m) => m.id_materia === id);
    if (!mat) return json({ ok: false, error: 'materia_no_permesa' }, 403);
    if (!esESO(mat)) return json({ ok: false, error: 'nomes_eso' }, 400);

    if (accio === 'materia') {
      // Es pot copiar d'una altra matèria permesa (del mateix curs o de l'anterior)
      const origen = cursValid(cos.curs_origen) ? cos.curs_origen : curs;
      const idOrigen = String(cos.id_origen || id);
      if (idOrigen !== id) {
        const permO = await materiesPermeses(s, origen);
        if (!permO.materies.some((m) => m.id_materia === idOrigen)) return json({ ok: false, error: 'materia_no_permesa' }, 403);
      }
      const r = await cridaProg('prog_materia', { curs: origen, id_materia: idOrigen });
      return json(r, r.ok ? 200 : 400);
    }

    if (accio === 'desa' || accio === 'esborra') {
      if (!s.admin && curs !== gestio) return json({ ok: false, error: 'curs_nomes_lectura' }, 403);
      const r = await cridaProg(accio === 'desa' ? 'prog_desa' : 'prog_esborra', {
        curs, id_materia: id, departament: mat.departament, usuari: s.email, admin: s.admin,
        programacio: cos.programacio || {}, data_anterior: cos.data_anterior || '', forca: !!cos.forca,
      });
      return json(r, r.ok ? 200 : (r.error === 'conflicte' ? 409 : 400));
    }

    return json({ ok: false, error: 'accio_desconeguda' }, 400);
  } catch (err) {
    console.error('[programacions-materies]', err.codi || '', err.message);
    return json({ ok: false, error: err.codi || 'error_servidor', detall: err.detall || (err.codi ? '' : err.message) }, 500);
  }
};

export const config = { path: '/api/programacions/materies' };
