import type { FastifyInstance } from 'fastify';
import { handleVerify, handleEvent } from './webhook.controller.js';

/** Rutas del webhook de WhatsApp. */
export async function webhookRoutes(app: FastifyInstance) {
  app.get('/webhook/whatsapp', handleVerify);
  app.post('/webhook/whatsapp', handleEvent);
}
