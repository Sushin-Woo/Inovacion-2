/**
 * Tipos mínimos del payload de WhatsApp Cloud API (Meta) que nos interesan.
 * No modelamos todo el esquema, solo lo que el MVP consume.
 */
export interface WhatsAppTextMessage {
  from: string; // teléfono del cliente
  id: string; // id único del mensaje (para idempotencia)
  timestamp: string;
  type: 'text' | 'audio' | 'image' | 'interactive' | string;
  text?: { body: string };
  audio?: { id: string; mime_type: string };
}

export interface WhatsAppContact {
  wa_id: string;
  profile?: { name?: string };
}

export interface WhatsAppChangeValue {
  messaging_product: 'whatsapp';
  metadata?: { phone_number_id?: string };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppTextMessage[];
}

export interface WhatsAppWebhookBody {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{ value: WhatsAppChangeValue; field: string }>;
  }>;
}

/** Mensaje normalizado para uso interno tras parsear el webhook. */
export interface NormalizedInboundMessage {
  externalId: string;
  phone: string;
  name?: string;
  type: string;
  text?: string;
  audioId?: string;
}
