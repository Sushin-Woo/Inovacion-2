/**
 * Constantes de presentación del bot: saludo, opciones del menú y render del
 * menú. La LÓGICA conversacional (flujos paso a paso) vive en
 * conversation.service.ts; aquí solo está lo "estático".
 */

// Saludo idéntico al de la captura. WhatsApp usa *negrita* con asteriscos.
export const GREETING =
  '¡Hola! 👋 Soy *El maestro del segundo turno*, el asistente del Taller Saravia 🪚\n\n' +
  '¿En qué te ayudo hoy? Puedo *cotizar* un mueble, agendar una *visita* o darte el *estado* de tu pedido 😊';

export type FlowId = 'velador' | 'closet' | 'materiales' | 'cocina' | 'visita' | 'anticipo' | 'estado';

export interface MenuOption {
  n: number;
  flow: FlowId;
  label: string;
  /** Palabras clave para reconocer la opción por texto, no solo por número. */
  keywords: string[];
}

export const OPTIONS: MenuOption[] = [
  { n: 1, flow: 'velador', label: 'Cotizar velador', keywords: ['velador'] },
  { n: 2, flow: 'closet', label: 'Closet 2 puertas', keywords: ['closet', 'clóset', 'closet'] },
  { n: 3, flow: 'materiales', label: '¿Qué materiales?', keywords: ['material', 'materiales'] },
  { n: 4, flow: 'cocina', label: 'Cocina a medida', keywords: ['cocina'] },
  { n: 5, flow: 'visita', label: 'Agendar visita', keywords: ['agendar', 'visita'] },
  { n: 6, flow: 'anticipo', label: 'Pagar anticipo', keywords: ['anticipo', 'pagar', 'abono'] },
  { n: 7, flow: 'estado', label: 'Estado de mi pedido', keywords: ['estado', 'seguimiento'] },
];

/** Menú numerado (sustituye a los botones del demo). */
export function buildMenu(): string {
  const dígitos = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣'];
  const líneas = OPTIONS.map((o) => `${dígitos[o.n - 1]} ${o.label}`);
  return `Responde con el número de lo que necesitas:\n\n${líneas.join('\n')}`;
}

export const GREETING_WITH_MENU = `${GREETING}\n\n${buildMenu()}`;

/** Reconoce una opción del menú por número exacto o por palabra clave. */
export function matchOption(text: string): MenuOption | undefined {
  const lower = text.trim().toLowerCase();
  return OPTIONS.find((o) => {
    if (lower === String(o.n)) return true;
    if (new RegExp(`^${o.n}\\b`).test(lower)) return true;
    return o.keywords.some((k) => lower.includes(k));
  });
}
