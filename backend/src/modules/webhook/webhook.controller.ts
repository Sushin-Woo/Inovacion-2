import type { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../../lib/logger.js';
import {
  verifyHandshake,
  isValidSignature,
} from '../../integrations/whatsapp/whatsapp.security.js';
import { extractInboundMessages } from '../../integrations/whatsapp/whatsapp.client.js';
import { handleInboundMessage } from '../../integrations/whatsapp/inbound.service.js';
import type { WhatsAppWebhookBody } from '../../integrations/whatsapp/whatsapp.types.js';

/** GET: handshake de verificación de Meta. */
export async function handleVerify(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as Record<string, string>;
  const challenge = verifyHandshake({
    mode: q['hub.mode'],
    token: q['hub.verify_token'],
    challenge: q['hub.challenge'],
  });

  if (challenge === null) {
    logger.warn('Handshake de webhook rechazado (token inválido)');
    return reply.code(403).send('Forbidden');
  }
  return reply.code(200).send(challenge);
}

/**
 * POST: recepción de eventos.
 * Seguridad: se valida la firma HMAC sobre el cuerpo CRUDO antes de procesar.
 * Idempotencia: cada mensaje se registra por externalId; los repetidos se
 * ignoran (Meta reintenta si no recibe 200 a tiempo).
 */
export async function handleEvent(req: FastifyRequest, reply: FastifyReply) {
  const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody;
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  if (!rawBody || !isValidSignature(rawBody, signature)) {
    logger.warn('Firma de webhook inválida; payload descartado');
    return reply.code(401).send({ error: 'invalid signature' });
  }

  // Responder rápido a Meta; procesar luego evita timeouts y reintentos.
  reply.code(200).send({ received: true });

  const body = req.body as WhatsAppWebhookBody;
  const messages = extractInboundMessages(body);

  for (const msg of messages) {
    try {
      await handleInboundMessage(msg, body);
    } catch (err) {
      logger.error({ err, externalId: msg.externalId }, 'Error procesando mensaje entrante');
    }
  }
}
