// GET /api/programacions/contingut → contingut privat (només amb sessió vàlida).
// El contingut NO és a cap fitxer públic: només el serveix aquesta funció.
// De moment és una pàgina «en construcció».
import { sessio, json } from '../lib/programacions.mjs';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async (req) => {
  const s = sessio(req);
  if (!s) return json({ ok: false, error: 'sessio_no_valida' }, 401);
  const html = `
    <svg class="uc__icon" aria-hidden="true" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 52h48"/><path d="M14 52V28h36v24"/><path d="M22 52V38h8v14"/><path d="M36 38h8v6h-8z"/>
      <path d="M10 28L32 12l22 16"/><path class="uc__crane" d="M46 8v12M40 8h16M54 8v5"/>
    </svg>
    <p class="uc__kicker">En construcció</p>
    <h2 class="uc__title">Programacions</h2>
    <p class="uc__text">Aquesta àrea encara no té contingut. Aviat hi trobareu les programacions didàctiques dels departaments.</p>`;
  return json({ ok: true, email: s.email, html });
};

export const config = { path: '/api/programacions/contingut' };
