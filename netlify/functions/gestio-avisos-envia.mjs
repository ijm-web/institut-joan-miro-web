// PAS 81/83 · GESTIO › Notificacions: envia un avís (cal sessió i administració del mòdul, ho comprova l'Apps Script).
// PAS 83: per trossos, perquè una funció de Netlify té 10 s com a màxim (2.000 dispositius no hi caben d'un sol cop).
//   POST { accio: 'inicia', titol, text, url, temes } → l'Apps Script valida i registra l'avís («enviant») → { id, destinataris }
//   POST { accio: 'tros', id }  → els 400 dispositius següents: s'envien (100 alhora) i se'n desa el resultat
//                                → { enviats, total, acabat, lliurats, fallits, caducades, detall }
//   POST { accio: 'atura', id } → l'avís queda «aturat» (els pendents ja no el reben)
//   GET                         → estat de les claus VAPID (PAS 82)
// La clau privada VAPID només és aquí (variable d'entorn). Les subscripcions que responen 404/410 s'esborren.
import webpush from 'web-push';
import { sessio, json, cridaGestio } from '../lib/gestio.mjs';
import { clauPublica, clauPrivada, subjecteVapid, endpointValid, comprovaVapid, servei } from '../lib/avisos.mjs';

const ALHORA = 100;        // enviaments simultanis
const TTL = 3 * 24 * 3600; // si el dispositiu està apagat, el servei guarda l'avís fins a 3 dies

export async function enviaTots(subs, avis, envia = webpush.sendNotification) {
  const payload = JSON.stringify({ titol: avis.titol, text: avis.text, url: avis.url || '/' });
  let lliurats = 0, fallits = 0, seguent = 0; const caducades = [], errors = {};
  const un = async (s) => {
    try {
      if (!endpointValid(s.endpoint)) throw Object.assign(new Error('adreça no vàlida'), { statusCode: 410 });
      await envia({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL, urgency: 'high', timeout: 6000 });
      lliurats += 1;
    } catch (e) {
      fallits += 1;
      const st = e && e.statusCode;
      if (st === 404 || st === 410) caducades.push(s.endpoint);
      // PAS 82: per què ha fallat (servei, codi i resposta), al registre de Netlify i a l'historial de GESTIO
      const det = servei(s.endpoint) + ' ' + (st || 'xarxa') + ' ' + String((e && (e.body || e.message)) || '').replace(/\s+/g, ' ').slice(0, 160);
      errors[det] = (errors[det] || 0) + 1;
      console.error('[gestio-avisos-envia] fallit:', det);
    }
  };
  // Sempre n'hi ha ALHORA en curs (cap no espera el més lent d'una tanda)
  await Promise.all(Array.from({ length: Math.min(ALHORA, subs.length) }, async () => { while (seguent < subs.length) await un(subs[seguent++]); }));
  const detall = Object.keys(errors).slice(0, 4).map((k) => (errors[k] > 1 ? errors[k] + '× ' : '') + k.trim()).join(' · ');
  return { lliurats, fallits, caducades, detall };
}

const estat = (r) => (r.ok ? 200 : r.error === 'sense_permis' ? 403 : 400);

export default async (req) => {
  const s = sessio(req);
  if (!s) return json({ ok: false, error: 'sessio_no_valida' }, 401);
  // PAS 82 · GET: estat de la configuració (claus i remitent), per al mòdul de GESTIO. Cap secret: només si és correcte.
  if (req.method === 'GET') { const v = comprovaVapid(); return json({ ok: true, vapid: v.ok ? 'correcte' : v.error, subjecte: subjecteVapid(), subjecte_propi: subjecteVapid() === String(process.env.VAPID_SUBJECT || '').replace(/["'\s]/g, '') }); }
  if (req.method !== 'POST') return json({ ok: false, error: 'metode_no_permes' }, 405);
  let cos;
  try { cos = await req.json(); } catch { return json({ ok: false, error: 'peticio_invalida' }, 400); }
  const accio = cos.accio || 'inicia';
  try {
    if (accio === 'atura') { const r = await cridaGestio('notificacions_atura', { email: s.email, id: cos.id }); return json(r, estat(r)); }
    const v = comprovaVapid();
    if (!v.ok) return json({ ok: false, error: v.error }, 503);
    if (accio === 'inicia') {
      const r = await cridaGestio('notificacions_prepara', { email: s.email, titol: cos.titol, text: cos.text, url: cos.url, temes: cos.temes });
      return json(r, estat(r));
    }
    if (accio !== 'tros') return json({ ok: false, error: 'peticio_invalida' }, 400);
    const t = await cridaGestio('notificacions_tros', { email: s.email, id: cos.id });
    if (!t.ok) return json(t, estat(t));
    webpush.setVapidDetails(subjecteVapid(), clauPublica(), clauPrivada());
    const subs = t.subs || [];
    const r = subs.length ? await enviaTots(subs, t.avis) : { lliurats: 0, fallits: 0, caducades: [], detall: '' };
    const d = await cridaGestio('notificacions_resultat', { email: s.email, id: t.id, cursor: subs.length ? subs[subs.length - 1].id : '', n: subs.length, ...r });
    return json(d, estat(d));
  } catch (err) {
    console.error('[gestio-avisos-envia]', accio, err.codi || '', err.message);
    return json({ ok: false, error: err.codi || 'error_servidor', detall: err.detall || (err.codi ? '' : err.message) }, 500);
  }
};

export const config = { path: '/api/gestio/avisos-envia' };
