// PAS 95 · POST /api/gestio/correus (amb sessió): envia ara els correus pendents de la cua (p. ex. després de «Envia ara»).
// GET: si l'enviament de correus està configurat (sense dir cap secret).
import { sessio, json } from '../lib/gestio.mjs';
import { processaCua, smtpConfigurat } from '../lib/correus.mjs';

export default async (req) => {
  const s = sessio(req);
  if (!s) return json({ ok: false, error: 'sessio_no_valida' }, 401);
  if (req.method === 'GET') return json({ ok: true, smtp: smtpConfigurat() });
  if (req.method !== 'POST') return json({ ok: false, error: 'metode_no_permes' }, 405);
  try {
    const r = await processaCua({ max: 15 });
    return json(r, r.ok ? 200 : 503);
  } catch (err) {
    console.error('[gestio-correus]', err.codi || '', err.message);
    return json({ ok: false, error: err.codi || 'error_servidor', detall: err.detall || (err.codi ? '' : err.message) }, 500);
  }
};

export const config = { path: '/api/gestio/correus' };
