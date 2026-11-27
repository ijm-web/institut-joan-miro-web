// PAS 95 · Funció programada (cada 15 minuts): posa a la cua els informes setmanals que toquen i envia els correus
// pendents de GESTIO (vegeu netlify/lib/correus.mjs). No té adreça pública.
import { processaCua } from '../lib/correus.mjs';

export default async () => {
  try {
    const r = await processaCua({ max: 15 });
    if (!r.ok || r.enviats || r.errors) console.log('[gestio-correus-programat]', JSON.stringify(r));
  } catch (err) {
    console.error('[gestio-correus-programat]', err.codi || '', err.message);
  }
};

export const config = { schedule: '*/15 * * * *' };
