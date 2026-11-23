// PAS 81 · NOTIFICACIONS: utilitats comunes de les funcions avisos (pàgina pública Avisos) i gestio-avisos-envia (GESTIO).
// Claus VAPID a les variables d'entorn de Netlify (mai al repositori): VAPID_PUBLIC, VAPID_PRIVATE i VAPID_SUBJECT
// (mailto:… o https://…). La pública va al navegador; la privada només la fa servir avisos-envia.
export const clauPublica = () => (process.env.VAPID_PUBLIC || process.env.VAPID_PUBLIC_KEY || '').trim();
export const clauPrivada = () => (process.env.VAPID_PRIVATE || process.env.VAPID_PRIVATE_KEY || '').trim();
export const subjecteVapid = () => {
  const s = (process.env.VAPID_SUBJECT || '').trim();
  return /^(mailto:|https:\/\/)/.test(s) ? s : 'https://institutjoanmiro.cat';
};
// Només s'accepten adreces dels serveis de notificacions dels navegadors (Chrome/Edge/Android, Firefox, Safari/iOS,
// Windows): així ningú no pot fer que el servidor enviï peticions a una altra adreça.
const SERVEIS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function endpointValid(e) {
  if (typeof e !== 'string' || e.length > 1000) return false;
  try { const u = new URL(e); return u.protocol === 'https:' && SERVEIS.some((r) => r.test(u.hostname)); } catch { return false; }
}
