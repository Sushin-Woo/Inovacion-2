import { pino } from 'pino';
import { env } from '../config/env.js';

/**
 * Logger central (pino). En desarrollo usa pino-pretty para legibilidad;
 * en producción emite JSON estructurado (ideal para agregadores de logs).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  // Nunca loguear secretos ni cuerpos completos de webhooks por defecto.
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-hub-signature-256"]', '*.accessToken'],
    censor: '[redacted]',
  },
});
