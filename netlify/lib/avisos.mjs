// PAS 81 · NOTIFICACIONS: utilitats comunes de les funcions avisos (pàgina pública Avisos) i gestio-avisos-envia (GESTIO).
// Claus VAPID a les variables d'entorn de Netlify (mai al repositori): VAPID_PUBLIC, VAPID_PRIVATE i VAPID_SUBJECT
// (mailto:… o https://…). La pública va al navegador; la privada només la fa servir avisos-envia.
import crypto from 'node:crypto';

// PAS 82: les claus es netegen (espais, cometes, salts de línia o «=» finals copiats per error)
const neta = (v) => String(v || '').replace(/["'\s]/g, '').replace(/=+$/, '');
export const clauPublica = () => neta(process.env.VAPID_PUBLIC || process.env.VAPID_PUBLIC_KEY);
export const clauPrivada = () => neta(process.env.VAPID_PRIVATE || process.env.VAPID_PRIVATE_KEY);
export const subjecteVapid = () => {
  const s = String(process.env.VAPID_SUBJECT || '').replace(/["'\s]/g, '');
  return /^mailto:[^@]+@[^@]+\.[a-z]{2,}$/i.test(s) || /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s) ? s : 'https://institutjoanmiro.cat';
};
// PAS 82: comprova que les dues claus són vàlides i que fan parella (si no, cap servei de notificacions accepta els
// avisos: Apple respon 403 i Google 403/401). Torna { ok } o { ok:false, error }.
export function comprovaVapid() {
  const pub = clauPublica(), priv = clauPrivada();
  if (!pub || !priv) return { ok: false, error: 'vapid_no_configurat' };
  try {
    const bPub = Buffer.from(pub, 'base64url'), bPriv = Buffer.from(priv, 'base64url');
    if (bPub.length !== 65 || bPub[0] !== 4 || bPriv.length !== 32) return { ok: false, error: 'vapid_invalid' };
    const e = crypto.createECDH('prime256v1'); e.setPrivateKey(bPriv);
    return e.getPublicKey().equals(bPub) ? { ok: true } : { ok: false, error: 'vapid_no_coincideixen' };
  } catch { return { ok: false, error: 'vapid_invalid' }; }
}
// Només s'accepten adreces dels serveis de notificacions dels navegadors (Chrome/Edge/Android, Firefox, Safari/iOS,
// Windows): així ningú no pot fer que el servidor enviï peticions a una altra adreça.
const SERVEIS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function endpointValid(e) {
  if (typeof e !== 'string' || e.length > 1000) return false;
  try { const u = new URL(e); return u.protocol === 'https:' && SERVEIS.some((r) => r.test(u.hostname)); } catch { return false; }
}
export const servei = (e) => { try { const h = new URL(e).hostname; return /apple/.test(h) ? 'Apple' : /google/.test(h) ? 'Google' : /mozilla/.test(h) ? 'Mozilla' : /windows/.test(h) ? 'Microsoft' : h; } catch { return '?'; } };
