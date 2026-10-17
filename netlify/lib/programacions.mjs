// Programacions (àrea privada): utilitats comunes de les funcions programacions-*.
// - cridaFull: crida al pont d'Apps Script del full de dades (el mateix que fa servir el web de llibres).
// - Galeta de sessió signada (HttpOnly) amb el correu de l'usuari i la caducitat (8 h).
import crypto from 'node:crypto';

export const GALETA = 'ijm_prog';
const DURADA_S = 8 * 3600;

export async function cridaFull(action, dades = {}) {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new Error('Falten les variables APPS_SCRIPT_URL / APPS_SCRIPT_SECRET');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret, action, ...dades }),
    redirect: 'follow',
  });
  const text = await resp.text();
  try { return JSON.parse(text); } catch { throw new Error(`Resposta inesperada de l'Apps Script (HTTP ${resp.status})`); }
}

const signa = (dades, secret) => crypto.createHmac('sha256', secret).update(dades).digest('base64url');

export function creaToken(email, secret = process.env.PROGRAMACIONS_SECRET, ara = Date.now()) {
  if (!secret) throw new Error('Falta PROGRAMACIONS_SECRET');
  const payload = Buffer.from(JSON.stringify({ e: email, exp: ara + DURADA_S * 1000 })).toString('base64url');
  return `${payload}.${signa(payload, secret)}`;
}

export function verificaToken(token, secret = process.env.PROGRAMACIONS_SECRET, ara = Date.now()) {
  if (!token || !secret) return null;
  const [payload, firma] = String(token).split('.');
  if (!payload || !firma) return null;
  const a = Buffer.from(firma), b = Buffer.from(signa(payload, secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { e, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof e === 'string' && typeof exp === 'number' && exp > ara ? { email: e, exp } : null;
  } catch { return null; }
}

export function sessio(req) {
  const c = req.headers.get('cookie') || '';
  const m = c.split(/;\s*/).find((x) => x.startsWith(GALETA + '='));
  return verificaToken(m ? decodeURIComponent(m.slice(GALETA.length + 1)) : null);
}

export const galeta = (valor, maxAge = DURADA_S) =>
  `${GALETA}=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
