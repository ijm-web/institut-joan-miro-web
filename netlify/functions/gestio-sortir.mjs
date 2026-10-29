// POST /api/gestio/sortir → esborra la galeta de sessió
import { galeta, json } from '../lib/gestio.mjs';

export default async () => json({ ok: true }, 200, { 'Set-Cookie': galeta('', 0) });

export const config = { path: '/api/gestio/sortir' };
