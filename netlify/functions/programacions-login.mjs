// POST /api/programacions/login  { credential }  →  { ok }  i galeta de sessió
// 1) Comprova a Google que l'ID token és vàlid, per a la nostra aplicació i del domini de l'escola.
// 2) Comprova al full de dades (pestanya «departaments», via el pont d'Apps Script, acció loginEmail)
//    que el correu hi consta. És la mateixa llista que dona accés al web de llibres.
import { cridaFull, creaToken, galeta, json } from '../lib/programacions.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'metode_no_permes' }, 405);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const domini = (process.env.GOOGLE_DOMINI || 'institutjoanmiro.cat').toLowerCase();
  if (!clientId) return json({ ok: false, error: 'google_no_configurat' }, 500);

  let credential = '';
  try { ({ credential = '' } = await req.json()); } catch { return json({ ok: false, error: 'peticio_invalida' }, 400); }
  if (!credential) return json({ ok: false, error: 'peticio_invalida' }, 400);

  try {
    const v = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    const info = await v.json();
    const email = String(info.email || '').toLowerCase();
    if (!v.ok || info.aud !== clientId || String(info.email_verified) !== 'true') {
      return json({ ok: false, error: 'google_token_invalid' }, 401);
    }
    if ((info.hd || '').toLowerCase() !== domini || !email.endsWith('@' + domini)) {
      return json({ ok: false, error: 'domini_no_permes', email }, 403);
    }
    const r = await cridaFull('loginEmail', { email });
    if (!r.ok) return json({ ok: false, error: r.error || 'sense_acces', email }, 403);
    return json({ ok: true, email }, 200, { 'Set-Cookie': galeta(creaToken(email)) });
  } catch (err) {
    console.error('[programacions-login]', err.message);
    return json({ ok: false, error: 'error_servidor' }, 500);
  }
};

export const config = { path: '/api/programacions/login' };
