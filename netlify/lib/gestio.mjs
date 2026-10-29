// GESTIO (àrea privada de gestió): utilitats comunes de les funcions gestio-*.
// - cridaGestio: crida l'Apps Script del full ijm_nucli_db (variables GESTIO_SCRIPT_URL i GESTIO_SCRIPT_SECRET).
// - Galeta de sessió signada (HttpOnly) amb el correu i la caducitat (8 h). Els permisos NO van a la galeta:
//   els calcula l'Apps Script a cada petició, així un canvi d'equips o de permisos té efecte de seguida.
import crypto from 'node:crypto';

export const GALETA = 'ijm_gestio';
const DURADA_S = 8 * 3600;
const secretSessio = () => process.env.GESTIO_SECRET || process.env.PROGRAMACIONS_SECRET;

export class ErrorCodi extends Error {
  constructor(codi, missatge, detall = '') { super(missatge); this.codi = codi; this.detall = detall; }
}

export async function cridaGestio(action, dades = {}) {
  const url = process.env.GESTIO_SCRIPT_URL, secret = process.env.GESTIO_SCRIPT_SECRET;
  if (!url || !secret) throw new ErrorCodi('gestio_no_configurat', 'Falten GESTIO_SCRIPT_URL / GESTIO_SCRIPT_SECRET');
  let resp;
  try {
    resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret, action, ...dades }), redirect: 'follow' });
  } catch (err) {
    throw new ErrorCodi('gestio_url_invalida', 'No es pot connectar amb GESTIO_SCRIPT_URL: ' + err.message);
  }
  const text = await resp.text();
  let r;
  try { r = JSON.parse(text); } catch {
    const titol = (text.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    throw new ErrorCodi('gestio_resposta_invalida', 'Resposta no JSON (HTTP ' + resp.status + ')', 'HTTP ' + resp.status + (titol ? ' · ' + titol.trim() : ''));
  }
  if (r && r.ok === false && ['no_autoritzat', 'accio_desconeguda', 'error_script'].includes(r.error)) {
    throw new ErrorCodi('gestio_' + r.error, 'ijm_nucli_db ha respost ' + r.error, r.detall || '');
  }
  return r;
}

const signa = (dades, secret) => crypto.createHmac('sha256', secret).update(dades).digest('base64url');

export function creaToken(email, secret = secretSessio(), ara = Date.now()) {
  if (!secret) throw new Error('Falta GESTIO_SECRET');
  const payload = Buffer.from(JSON.stringify({ e: email, exp: ara + DURADA_S * 1000 })).toString('base64url');
  return `${payload}.${signa(payload, secret)}`;
}

export function verificaToken(token, secret = secretSessio(), ara = Date.now()) {
  if (!token || !secret) return null;
  const [payload, firma] = String(token).split('.');
  if (!payload || !firma) return null;
  const a = Buffer.from(firma), b = Buffer.from(signa(payload, secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { e, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof e !== 'string' || typeof exp !== 'number' || exp <= ara) return null;
    return { email: e, exp };
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
