import Fastify, { type FastifyError } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { webhookRoutes } from './modules/webhook/webhook.routes.js';
import { quoteRoutes } from './modules/quotes/quote.routes.js';
import { orderRoutes } from './modules/orders/order.routes.js';
import { labelRoutes } from './modules/labels/label.routes.js';
import { opsRoutes } from './modules/sheets/sheets.routes.js';

export async function buildServer() {
  const app = Fastify({ loggerInstance: logger, trustProxy: true });

  // Cabeceras de seguridad por defecto.
  await app.register(helmet, { contentSecurityPolicy: false });

  // Límite de tasa global: mitiga abuso/fuerza bruta sobre los endpoints.
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  // Parser JSON que CONSERVA el cuerpo crudo (necesario para validar la firma
  // HMAC del webhook de WhatsApp: hay que firmar exactamente lo que llegó).
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body: Buffer, done) => {
      (req as typeof req & { rawBody?: Buffer }).rawBody = body;
      try {
        done(null, body.length ? JSON.parse(body.toString('utf8')) : {});
      } catch {
        done(new Error('JSON inválido'), undefined);
      }
    },
  );

  // Manejo de errores: errores de validación Zod -> 400 legible.
  app.setErrorHandler((error: FastifyError, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    logger.error({ err: error }, 'Error no controlado');
    const status = error.statusCode ?? 500;
    return reply.code(status).send({
      error: status >= 500 ? 'internal_error' : error.message,
    });
  });

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // Rutas de negocio.
  await app.register(webhookRoutes);
  await app.register(quoteRoutes);
  await app.register(orderRoutes);
  await app.register(labelRoutes);
  await app.register(opsRoutes);

  return app;
}

export { env };
