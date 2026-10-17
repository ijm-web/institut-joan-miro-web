// POST /api/programacions/sortir → esborra la galeta de sessió
import { galeta, json } from '../lib/programacions.mjs';

export default async () => json({ ok: true }, 200, { 'Set-Cookie': galeta('', 0) });

export const config = { path: '/api/programacions/sortir' };
