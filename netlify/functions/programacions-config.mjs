// GET /api/programacions/config → client ID de Google per pintar el botó d'entrada (dada pública)
import { json } from '../lib/programacions.mjs';

export default async () => json({
  ok: !!process.env.GOOGLE_CLIENT_ID,
  google_client_id: process.env.GOOGLE_CLIENT_ID || '',
  domini: process.env.GOOGLE_DOMINI || 'institutjoanmiro.cat',
});

export const config = { path: '/api/programacions/config' };
