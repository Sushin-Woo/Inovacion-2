import { MessageDirection } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { createQuickQuote } from '../../modules/quotes/quote.service.js';
import { sanitizeText } from '../../utils/sanitize.js';
import type { NormalizedInboundMessage } from './whatsapp.types.js';

/**
 * Procesamiento de un mensaje entrante, INDEPENDIENTE del proveedor.
 * Lo usan tanto el webhook de la Cloud API como el provider de Baileys.
 *
 *  - Idempotencia por externalId (no reprocesar el mismo mensaje).
 *  - Registro del mensaje.
 *  - Flujo "cotización rápida": un texto/audio inicia una cotización.
 */
export async function handleInboundMessage(
  msg: NormalizedInboundMessage,
  rawPayload?: unknown,
): Promise<void> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { externalId: msg.externalId },
  });
  if (existing) return;

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

  if (msg.type === 'text' || msg.type === 'audio') {
    await createQuickQuote({
      phone: msg.phone,
      name: msg.name,
      description: msg.text,
      audioUrl: msg.audioId ? `whatsapp-media:${msg.audioId}` : undefined,
    });
  }

  logger.info({ externalId: msg.externalId, type: msg.type }, 'Mensaje entrante procesado');
}
