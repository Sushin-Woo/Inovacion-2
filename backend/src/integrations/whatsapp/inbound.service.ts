import { MessageDirection } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { handleConversation } from '../../modules/bot/conversation.service.js';
import * as sessions from '../../modules/bot/session.store.js';
import { sendTextMessage } from './whatsapp.client.js';
import { sanitizeText } from '../../utils/sanitize.js';
import type { NormalizedInboundMessage } from './whatsapp.types.js';

/**
 * Procesamiento de un mensaje entrante, INDEPENDIENTE del proveedor.
 * Lo usan tanto el webhook de la Cloud API como el provider de Baileys.
 *
 *  - Idempotencia por externalId (no reprocesar/responder dos veces el mismo).
 *  - Registro del mensaje.
 *  - El motor conversacional (con estado por cliente) decide la respuesta.
 */
export async function handleInboundMessage(
  msg: NormalizedInboundMessage,
  rawPayload?: unknown,
): Promise<void> {
  logger.info({ phone: msg.phone, type: msg.type, text: msg.text }, '📩 Mensaje entrante');

  // 1) Persistencia + idempotencia. Si la DB falla, NO bloqueamos la respuesta:
  //    preferimos que el bot conteste aunque no haya podido registrar nada.
  try {
    const existing = await prisma.webhookEvent.findUnique({
      where: { externalId: msg.externalId },
    });
    if (existing) {
      logger.info({ externalId: msg.externalId }, 'Mensaje ya procesado; no respondo de nuevo');
      return;
    }

    await prisma.webhookEvent.create({
      data: {
        externalId: msg.externalId,
        payload: (rawPayload ?? {}) as object,
        processedAt: new Date(),
      },
    });

    await prisma.message.create({
      data: {
        direction: MessageDirection.ENTRANTE,
        body: msg.text ? sanitizeText(msg.text) : null,
        externalId: msg.externalId,
        mediaUrl: msg.audioId ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, '⚠️  No pude registrar el mensaje en la DB (¿Postgres arriba/migrado?). Respondo igual.');
  }

  // 2) El motor conversacional decide la respuesta según la sesión del cliente.
  //    La sesión se lleva por chat (chatJid), es decir, por cliente.
  const sessionKey = msg.chatJid ?? msg.phone;
  const session = sessions.get(sessionKey);

  let reply: string | null;
  try {
    const result = await handleConversation(msg.text, session, {
      phone: msg.phone,
      name: msg.name,
    });
    reply = result.reply;
  } catch (err) {
    logger.error({ err }, 'Error en el motor conversacional');
    reply = 'Uy, tuve un problema 😅. Escribe *menú* para volver a empezar.';
  }

  // Persistir/limpiar la sesión según quedó tras la conversación.
  if (session.active) sessions.save(sessionKey, session);
  else sessions.clear(sessionKey);

  // Sesión inactiva y sin respuesta: el bot guarda silencio (espera "hola").
  if (reply === null) {
    logger.info({ sessionKey }, '🤫 Sesión inactiva; el bot espera un "hola"');
    return;
  }

  // 3) Respuesta automática al cliente — al JID original (soporta @lid).
  const replyTo = msg.chatJid ?? msg.phone;
  try {
    await sendTextMessage(replyTo, reply);
    logger.info({ replyTo }, '📤 Respuesta enviada');
  } catch (err) {
    logger.error({ err, replyTo }, '❌ No se pudo ENVIAR la respuesta del bot');
    return;
  }

  // 4) Registrar la salida (best-effort).
  try {
    await prisma.message.create({
      data: { direction: MessageDirection.SALIENTE, body: reply, customerId: null },
    });
  } catch {
    /* la DB ya se reportó arriba */
  }
}
