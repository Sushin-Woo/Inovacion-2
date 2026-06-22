/**
 * Utilidades de saneamiento de payloads.
 *
 * Principio: todo dato que entra por un webhook o por una planilla externa es
 * NO confiable. Antes de persistirlo o reenviarlo lo limpiamos para evitar
 * inyección de control characters, payloads gigantes y normalizamos teléfonos.
 */

const MAX_TEXT_LENGTH = 4096;

const TAB = 9;
const LINE_FEED = 10;
const CARRIAGE_RETURN = 13;
const SPACE = 32;
const DEL = 127;
const C1_END = 159;

/**
 * ¿Es un carácter de control no permitido? Bloquea C0 (0-31) y C1 (127-159),
 * dejando pasar tab, salto de línea y retorno de carro. Hacerlo por code point
 * (en vez de un regex con bytes crudos) mantiene el fuente 100% ASCII.
 */
function isDisallowedControl(code: number): boolean {
  if (code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN) return false;
  return code < SPACE || (code >= DEL && code <= C1_END);
}

/** Quita caracteres de control, recorta espacios y limita la longitud. */
export function sanitizeText(input: unknown, maxLength = MAX_TEXT_LENGTH): string {
  if (typeof input !== 'string') return '';
  let out = '';
  for (const ch of input.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isDisallowedControl(code)) out += ch;
  }
  return out.trim().slice(0, maxLength);
}

/**
 * Normaliza un número de teléfono a formato E.164 simplificado (solo dígitos,
 * sin el '+'). Devuelve null si no parece un teléfono válido.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Valida y normaliza un monto monetario no negativo. */
export function sanitizeAmount(input: unknown): number | null {
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(n) || n < 0) return null;
  // Redondeo a 2 decimales para evitar arrastre de floats.
  return Math.round(n * 100) / 100;
}
