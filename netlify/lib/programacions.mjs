// Programacions (àrea privada): utilitats comunes de les funcions programacions-*.
// - cridaFull: crida al pont d'Apps Script del full de dades (el mateix que fa servir el web de llibres).
// - cridaProg: crida a l'Apps Script del full programacions_db (criteris de qualificació).
// - Galeta de sessió signada (HttpOnly) amb el correu, els departaments, si és admin i la caducitat (8 h).
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

export async function cridaProg(action, dades = {}) {
  const url = process.env.PROG_SCRIPT_URL;
  const secret = process.env.PROG_SCRIPT_SECRET;
  if (!url || !secret) throw new Error('Falten les variables PROG_SCRIPT_URL / PROG_SCRIPT_SECRET');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret, action, ...dades }),
    redirect: 'follow',
  });
  const text = await resp.text();
  try { return JSON.parse(text); } catch { throw new Error(`Resposta inesperada de l'Apps Script de programacions (HTTP ${resp.status})`); }
}

/** Curs escolar actual (de l'1 d'agost al 31 de juliol), p. ex. «2026-2027». Es pot fixar amb PROG_CURS. */
export function cursActual(ara = new Date()) {
  const fix = process.env.PROG_CURS;
  if (fix && /^\d{4}-\d{4}$/.test(fix)) return fix;
  const a = ara.getFullYear() - (ara.getMonth() < 7 ? 1 : 0);
  return `${a}-${a + 1}`;
}

const signa = (dades, secret) => crypto.createHmac('sha256', secret).update(dades).digest('base64url');

export function creaToken(email, departaments = [], admin = false, secret = process.env.PROGRAMACIONS_SECRET, ara = Date.now()) {
  if (!secret) throw new Error('Falta PROGRAMACIONS_SECRET');
  const payload = Buffer.from(JSON.stringify({ e: email, d: departaments, a: !!admin, exp: ara + DURADA_S * 1000 })).toString('base64url');
  return `${payload}.${signa(payload, secret)}`;
}

export function verificaToken(token, secret = process.env.PROGRAMACIONS_SECRET, ara = Date.now()) {
  if (!token || !secret) return null;
  const [payload, firma] = String(token).split('.');
  if (!payload || !firma) return null;
  const a = Buffer.from(firma), b = Buffer.from(signa(payload, secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { e, d, a, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof e !== 'string' || typeof exp !== 'number' || exp <= ara) return null;
    // Les sessions antigues (sense departaments) obliguen a tornar a entrar
    if (!Array.isArray(d)) return null;
    return { email: e, departaments: d.map(String), admin: !!a, exp };
  } catch { return null; }
}

export function sessio(req) {
  const c = req.headers.get('cookie') || '';
  const m = c.split(/;\s*/).find((x) => x.startsWith(GALETA + '='));
  return verificaToken(m ? decodeURIComponent(m.slice(GALETA.length + 1)) : null);
}

// ---------------------------------------------------------------------------------------------
// Matèries que pot gestionar l'usuari (pestanya materies de joanmiro_db, via el pont, acció «dades»).
// Es guarden 5 minuts a la memòria de la funció per no cridar el pont a cada desada.
const cau = new Map();
export async function materiesPermeses(s, curs) {
  const clau = `${curs}|${s.admin ? 'admin' : s.departaments.join(',')}`;
  const ara = Date.now();
  const c = cau.get(clau);
  if (c && c.fins > ara) return c.dades;
  const r = await cridaFull('dades', { departaments: s.departaments, curs, admin: s.admin });
  if (!r.ok) throw new Error('El pont de joanmiro_db ha respost: ' + (r.error || 'error'));
  const dades = {
    departaments: (r.departaments || []).map((d) => ({ id: d.id, nom: d.nom })),
    materies: (r.materies || []).map((m) => ({ id_materia: m.id_materia, nivell: m.nivell, materia: m.materia, tipus: m.tipus, departament: m.departament })),
    cursos: r.cursos || [],
  };
  cau.set(clau, { fins: ara + 5 * 60 * 1000, dades });
  return dades;
}

export const galeta = (valor, maxAge = DURADA_S) =>
  `${GALETA}=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
