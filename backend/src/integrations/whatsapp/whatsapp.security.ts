import crypto from 'node:crypto';
import { env } from '../../config/env.js';

/**
 * Seguridad del webhook de WhatsApp (Meta Cloud API).
 *
 * Dos mecanismos:
 *  1. Handshake de verificación (GET): Meta envía hub.verify_token; debe
 *     coincidir con el WHATSAPP_VERIFY_TOKEN que registramos.
 *  2. Firma de cada POST: Meta firma el cuerpo crudo con HMAC-SHA256 usando el
 *     App Secret y lo envía en la cabecera X-Hub-Signature-256. Recalculamos y
 *     comparamos en tiempo constante. Sin firma válida => 401.
 */

const SIGNATURE_PREFIX = 'sha256=';

/** Verificación del handshake GET. */
export function verifyHandshake(params: {
  mode?: string;
  token?: string;
  challenge?: string;
}): string | null {
  // Sin verify token configurado (p.ej. modo Baileys) no hay handshake válido.
  if (!env.WHATSAPP_VERIFY_TOKEN) return null;
  if (params.mode === 'subscribe' && params.token === env.WHATSAPP_VERIFY_TOKEN) {
    return params.challenge ?? '';
  }
  return null;
}

/**
 * Valida la firma HMAC-SHA256 del cuerpo CRUDO (Buffer tal como llegó).
 * Importante: hay que firmar el raw body, no el JSON re-serializado.
 */
export function isValidSignature(rawBody: Buffer, signatureHeader?: string): boolean {
  // Sin app secret (modo Baileys) no se puede ni se debe validar firma -> rechaza.
  if (!env.WHATSAPP_APP_SECRET) return false;
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) return false;

  const expected = crypto
    .createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  const received = signatureHeader.slice(SIGNATURE_PREFIX.length);

  // Comparación en tiempo constante para evitar timing attacks.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(received, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
