import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QuoteStatus } from '@prisma/client';
import {
  createQuickQuote,
  createProjectQuote,
  setQuoteEstimate,
  markQuoteAccepted,
  listQuotes,
} from './quote.service.js';

const quickSchema = z.object({
  phone: z.string().min(8),
  name: z.string().optional(),
  description: z.string().optional(),
  audioUrl: z.string().optional(),
  material: z.string().optional(),
});

const projectSchema = z.object({
  phone: z.string().min(8),
  name: z.string().optional(),
  description: z.string().optional(),
  visit: z.object({
    scheduledAt: z.coerce.date(),
    address: z.string().min(3),
    notes: z.string().optional(),
  }),
});

const estimateSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional(),
});

export async function quoteRoutes(app: FastifyInstance) {
  // Cotización rápida (audio/mensaje).
  app.post('/quotes/quick', async (req, reply) => {
    const data = quickSchema.parse(req.body);
    const quote = await createQuickQuote(data);
    return reply.code(201).send(quote);
  });

  // Cotización por proyecto (agenda visita a terreno).
  app.post('/quotes/project', async (req, reply) => {
    const data = projectSchema.parse(req.body);
    const quote = await createProjectQuote(data);
    return reply.code(201).send(quote);
  });

  // El maestro fija el monto estimado.
  app.post('/quotes/:id/estimate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { amount, currency } = estimateSchema.parse(req.body);
    const quote = await setQuoteEstimate(id, amount, currency);
    return reply.send(quote);
  });

  app.post('/quotes/:id/accept', async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send(await markQuoteAccepted(id));
  });

  app.get('/quotes', async (req, reply) => {
    const { status } = req.query as { status?: QuoteStatus };
    return reply.send(await listQuotes(status));
  });
}
