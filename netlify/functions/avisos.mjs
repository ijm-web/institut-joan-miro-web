// PAS 81 · Pàgina pública Avisos (/avisos.html): subscripció a les notificacions del web, sense compte ni dades personals.
// GET  /api/avisos → { ok, clau } (clau pública VAPID; ok:false si encara no està configurat)
// POST /api/avisos  { accio: 'subscriu' | 'baixa' | 'estat', subscripcio: { endpoint, keys: { p256dh, auth } }, temes, idioma }
// Es desa al full notificacions_db (via l'Apps Script de GESTIO): l'adreça tècnica del navegador, les claus i els cursos.
import { cridaGestio, json } from '../lib/gestio.mjs';
import { clauPublica, endpointValid } from '../lib/avisos.mjs';

const CURSOS = ['1ESO', '2ESO', '3ESO', '4ESO', '1BAT', '2BAT'];
// Límit de peticions per adreça IP (a la memòria de la funció; prou per evitar abusos senzills)
const FINESTRA = 10 * 60 * 1000, MAX = 30;
const comptes = new Map();
function massa(ip) {
  const ara = Date.now(), c = comptes.get(ip);
  if (!c || c.fins < ara) { comptes.set(ip, { n: 1, fins: ara + FINESTRA }); if (comptes.size > 5000) comptes.clear(); return false; }
  c.n += 1; return c.n > MAX;
}

export default async (req, context) => {
  if (req.method === 'GET') {
    const clau = clauPublica();
    return json(clau ? { ok: true, clau } : { ok: false, error: 'no_configurat' });
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'metode_no_permes' }, 405);
  if (massa((context && context.ip) || req.headers.get('x-nf-client-connection-ip') || '')) return json({ ok: false, error: 'massa_peticions' }, 429);
  if (!clauPublica()) return json({ ok: false, error: 'no_configurat' }, 503);
  let cos;
  try { const t = await req.text(); if (t.length > 4000) throw new Error('massa gran'); cos = JSON.parse(t); } catch { return json({ ok: false, error: 'peticio_invalida' }, 400); }
  const accio = String(cos.accio || ''), s = cos.subscripcio || {}, keys = s.keys || {};
  if (!['subscriu', 'baixa', 'estat'].includes(accio)) return json({ ok: false, error: 'peticio_invalida' }, 400);
  if (!endpointValid(s.endpoint)) return json({ ok: false, error: 'subscripcio_invalida' }, 400);
  const dades = { endpoint: s.endpoint };
  if (accio === 'subscriu') Object.assign(dades, {
    p256dh: String(keys.p256dh || '').slice(0, 200), auth: String(keys.auth || '').slice(0, 64),
    temes: (Array.isArray(cos.temes) ? cos.temes : []).filter((t) => CURSOS.includes(t)),
    idioma: ['ca', 'es', 'en'].includes(cos.idioma) ? cos.idioma : 'ca',
  });
  try {
    const r = await cridaGestio('notificacions_' + accio, dades);
    return json(r.ok ? { ok: true, subscrit: r.subscrit, temes: r.temes || [] } : { ok: false, error: r.error || 'error' }, r.ok ? 200 : 400);
  } catch (err) {
    console.error('[avisos]', accio, err.codi || '', err.message);
    return json({ ok: false, error: err.codi || 'error_servidor' }, 500);
  }
};

export const config = { path: '/api/avisos' };
