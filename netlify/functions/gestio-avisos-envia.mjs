// PAS 81 · GESTIO › Notificacions: envia un avís (cal sessió i administració del mòdul, ho comprova l'Apps Script).
// POST /api/gestio/avisos-envia { titol, text, url, temes }
// 1) L'Apps Script valida l'avís, el registra i torna els destinataris (notificacions_prepara). 2) S'envia a cada
// navegador amb la clau privada VAPID (només aquí, variable d'entorn). 3) Es desa el resultat i s'esborren les
// subscripcions que ja no existeixen (respostes 404/410 del servei de notificacions).
import webpush from 'web-push';
import { sessio, json, cridaGestio } from '../lib/gestio.mjs';
import { clauPublica, clauPrivada, subjecteVapid, endpointValid } from '../lib/avisos.mjs';

const LOT = 50;            // enviaments simultanis
const TTL = 3 * 24 * 3600; // si el dispositiu està apagat, el servei guarda l'avís fins a 3 dies

export async function enviaTots(subs, avis, envia = webpush.sendNotification) {
  const payload = JSON.stringify({ titol: avis.titol, text: avis.text, url: avis.url || '/' });
  let lliurats = 0, fallits = 0; const caducades = [];
  for (let i = 0; i < subs.length; i += LOT) {
    const res = await Promise.allSettled(subs.slice(i, i + LOT).map((s) => {
      if (!endpointValid(s.endpoint)) return Promise.reject(Object.assign(new Error('adreça no vàlida'), { statusCode: 410 }));
      return envia({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL, urgency: 'high' });
    }));
    res.forEach((r, j) => {
      if (r.status === 'fulfilled') { lliurats += 1; return; }
      fallits += 1;
      const st = r.reason && r.reason.statusCode;
      if (st === 404 || st === 410) caducades.push(subs[i + j].endpoint);
    });
  }
  return { lliurats, fallits, caducades };
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'metode_no_permes' }, 405);
  const s = sessio(req);
  if (!s) return json({ ok: false, error: 'sessio_no_valida' }, 401);
  if (!clauPublica() || !clauPrivada()) return json({ ok: false, error: 'vapid_no_configurat' }, 503);
  let cos;
  try { cos = await req.json(); } catch { return json({ ok: false, error: 'peticio_invalida' }, 400); }
  try {
    const p = await cridaGestio('notificacions_prepara', { email: s.email, titol: cos.titol, text: cos.text, url: cos.url, temes: cos.temes });
    if (!p.ok) return json(p, p.error === 'sense_permis' ? 403 : 400);
    webpush.setVapidDetails(subjecteVapid(), clauPublica(), clauPrivada());
    const r = await enviaTots(p.subs || [], p.avis);
    const d = await cridaGestio('notificacions_resultat', { email: s.email, id: p.id, ...r });
    return json({ ...d, ok: true, enviat: { id: p.id, destinataris: (p.subs || []).length, lliurats: r.lliurats, fallits: r.fallits, caducades: r.caducades.length } });
  } catch (err) {
    console.error('[gestio-avisos-envia]', err.codi || '', err.message);
    return json({ ok: false, error: err.codi || 'error_servidor', detall: err.detall || (err.codi ? '' : err.message) }, 500);
  }
};

export const config = { path: '/api/gestio/avisos-envia' };
