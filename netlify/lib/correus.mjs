// PAS 95 · Cua de correus de GESTIO. L'Apps Script no envia correus: posa cada missatge a la pestanya «correus»
// d'ijm_nucli_db i aquí es demanen (correus_pendents), s'envien per SMTP des del compte no-reply@ i se'n torna el
// resultat (correus_resultat). Variables d'entorn (Netlify): SMTP_USER (no-reply@institutjoanmiro.cat), SMTP_PASS
// (contrasenya d'aplicació del compte), opcionals SMTP_HOST (smtp.gmail.com), SMTP_PORT (465) i SMTP_FROM.
import nodemailer from 'nodemailer';
import { cridaGestio } from './gestio.mjs';

export function smtpConfigurat() { return !!(process.env.SMTP_USER && process.env.SMTP_PASS); }

export function transport() {
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 8000, socketTimeout: 12000 });
}

export const remitent = () => process.env.SMTP_FROM || `"Institut Joan Miró · GESTIO" <${process.env.SMTP_USER}>`;

// Envia els correus pendents (com a molt «max») i en desa el resultat. envia() es pot substituir a les proves.
export async function processaCua({ max = 15, envia } = {}) {
  if (!smtpConfigurat()) return { ok: false, error: 'smtp_no_configurat' };
  const r = await cridaGestio('correus_pendents', { max });
  if (!r.ok) return r;
  const correus = r.correus || [];
  if (!correus.length) return { ok: true, enviats: 0, errors: 0, nous: r.nous || 0 };
  let t = null;
  const fes = envia || ((m) => { t = t || transport(); return t.sendMail(m); });
  const resultats = [];
  for (const c of correus) {
    try {
      await fes({ from: remitent(), to: c.a, subject: c.assumpte, html: c.html, text: c.text, headers: { 'Auto-Submitted': 'auto-generated' } });
      resultats.push({ id: c.id, ok: true });
    } catch (err) {
      console.error('[gestio-correus] no enviat:', c.id, err && err.message);
      resultats.push({ id: c.id, ok: false, error: String((err && err.message) || err).slice(0, 300) });
    }
  }
  if (t) t.close();
  await cridaGestio('correus_resultat', { resultats });
  return { ok: true, enviats: resultats.filter((x) => x.ok).length, errors: resultats.filter((x) => !x.ok).length, nous: r.nous || 0 };
}
