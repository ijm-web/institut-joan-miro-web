// POST /api/gestio/api  { accio, ... }  (cal sessió)
// Reenvia la petició a ijm_nucli_db amb el correu de la sessió. Qui pot fer què ho decideix l'Apps Script
// (equips → permisos per mòdul), de manera que aquí no hi ha cap regla de permisos duplicada.
import { sessio, json, cridaGestio } from '../lib/gestio.mjs';

const ACCIONS = ['inici', 'dades', 'desa', 'esborra', 'camps_desa', 'permisos', 'permisos_desa', 'equips', 'equips_desa', 'membres_desa', 'permisos_matriu_desa', 'tanca_curs', 'versio', 'nou_professor', 'alta_professor', 'entrada_alumnes', 'entrada_nova', 'historial_fila', 'retards_desa', 'equip_esborra', 'amonestacio_form', 'amonestacio_nova', 'amonestacio_pdf', 'amonestacions_config', 'consell_pdf', 'consell_config', 'curriculum_genera', 'curriculum_divideix', 'curriculum_classes_desa', 'curriculum_separa', 'desiderata_dades', 'desiderata_desa', 'desiderata_analisi', 'departaments', 'departaments_desa', 'curriculum_aplica_desiderata', 'horaris_dades', 'horaris_marc_desa', 'horaris_exporta', 'horaris_aules_desa', 'horaris_regles_desa', 'horaris_subgrups_desa', 'horaris_sessions_desa', 'horaris_professorat_desa', 'curriculum_professorat', 'hores_lectives_desa'];

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'metode_no_permes' }, 405);
  const s = sessio(req);
  if (!s) return json({ ok: false, error: 'sessio_no_valida' }, 401);
  let cos;
  try { cos = await req.json(); } catch { return json({ ok: false, error: 'peticio_invalida' }, 400); }
  const accio = String(cos.accio || '');
  if (!ACCIONS.includes(accio)) return json({ ok: false, error: 'accio_desconeguda' }, 400);
  const { accio: _a, email: _e, secret: _s, action: _x, ...dades } = cos;
  try {
    const r = await cridaGestio(accio, { ...dades, email: s.email });
    const status = r.ok ? 200 : (r.error === 'sense_acces' || r.error === 'sense_permis' ? 403 : r.error === 'conflicte' ? 409 : 400);
    return json(r, status);
  } catch (err) {
    console.error('[gestio-api]', accio, err.codi || '', err.message);
    return json({ ok: false, error: err.codi || 'error_servidor', detall: err.detall || (err.codi ? '' : err.message) }, 500);
  }
};

export const config = { path: '/api/gestio/api' };
