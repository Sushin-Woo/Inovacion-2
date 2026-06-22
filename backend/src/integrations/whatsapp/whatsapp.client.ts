import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type {
  WhatsAppWebhookBody,
  NormalizedInboundMessage,
} from './whatsapp.types.js';

/**
 * Punto único de ENVÍO de mensajes. Despacha según WHATSAPP_PROVIDER:
 *  - 'baileys' : usa el "sender" que registra el provider de Baileys al
 *                conectarse (registerBaileysSender). Si aún no conecta, dry-run.
 *  - 'cloud'   : usa la Cloud API de Meta (abajo). Sin credenciales -> dry-run.
 */
type Sender = (to: string, body: string) => Promise<void>;
let baileysSender: Sender | null = null;

/** El provider de Baileys llama esto cuando la sesión queda lista. */
export function registerBaileysSender(fn: Sender): void {
  baileysSender = fn;
}

export async function sendTextMessage(to: string, body: string): Promise<void> {
  if (env.WHATSAPP_PROVIDER === 'baileys') {
    if (!baileysSender) {
      logger.info({ to, body }, '[whatsapp dry-run] Baileys aún no conectado');
      return;
    }
    await baileysSender(to, body);
    return;
  }
  return sendCloudTextMessage(to, body);
}

/** Envío vía Cloud API de Meta. */
async function sendCloudTextMessage(to: string, body: string): Promise<void> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    logger.info({ to, body }, '[whatsapp dry-run] mensaje no enviado (faltan credenciales)');
    return;
  }

  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    logger.error({ to, status: res.status, detail }, 'Fallo al enviar mensaje de WhatsApp');
    throw new Error(`WhatsApp send failed: ${res.status}`);
  }
}

/**
 * Aplana el payload de Meta (entry[].changes[].value.messages[]) en una lista
 * de mensajes normalizados, fáciles de procesar por la lógica de negocio.
 */
export function extractInboundMessages(
  body: WhatsAppWebhookBody,
): NormalizedInboundMessage[] {
  const out: NormalizedInboundMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contactName = value.contacts?.[0]?.profile?.name;
      for (const msg of value.messages ?? []) {
        out.push({
          externalId: msg.id,
          phone: msg.from,
          name: contactName,
          type: msg.type,
          text: msg.text?.body,
          audioId: msg.audio?.id,
        });
      }
    }
  }
  return out;
}
