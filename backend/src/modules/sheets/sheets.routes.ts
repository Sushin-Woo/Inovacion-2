import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { runDailySummary, buildDailySummary } from '../../jobs/dailySummary.job.js';
import { createQuickQuote } from '../quotes/quote.service.js';

/**
 * Rutas operativas: resumen del día (on-demand) e ingesta desde planillas.
 * La ingesta desde Google Forms/Sheets se autentica con un token compartido
 * (X-Sheets-Token) para no exponer la creación de cotizaciones sin control.
 */

const ingestSchema = z.object({
  phone: z.string().min(8),
  name: z.string().optional(),
  description: z.string().optional(),
  material: z.string().optional(),
});

export async function opsRoutes(app: FastifyInstance) {
  // Resumen del día sin enviarlo (solo cálculo) — útil para dashboards.
  app.get('/summary/today', async (_req, reply) => {
    return reply.send(await buildDailySummary());
  });

  // Forzar el envío del resumen al maestro (mismo que dispara el cron).
  app.post('/summary/run', async (_req, reply) => {
    return reply.send(await runDailySummary());
  });

  // Ingesta de cotizaciones desde una planilla / Google Form.
  app.post('/ingest/sheets/quote', async (req, reply) => {
    const token = req.headers['x-sheets-token'] as string | undefined;
    if (!env.SHEETS_INGEST_TOKEN || token !== env.SHEETS_INGEST_TOKEN) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const data = ingestSchema.parse(req.body);
    const quote = await createQuickQuote(data);
    return reply.code(201).send(quote);
  });
}
