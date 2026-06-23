import { logger } from '../../lib/logger.js';
import { sanitizeText } from '../../utils/sanitize.js';
import {
  createQuickQuote,
  setQuoteEstimate,
  createProjectQuote,
} from '../quotes/quote.service.js';
import { getOrderByCode } from '../orders/order.service.js';
import { GREETING_WITH_MENU, buildMenu, matchOption } from './bot.service.js';
import type { Session } from './session.store.js';

/**
 * Motor conversacional (máquina de estados) del bot.
 *
 * Cada opción del menú abre un FLUJO que conversa de principio a fin:
 * pregunta → valida la respuesta → avanza → concluye con una acción real
 * (cotizar con precio, agendar visita, mostrar estado/anticipo).
 *
 * Maneja errores de entrada (respuestas inválidas) re-preguntando con una pista,
 * y comandos globales: *menú*, *cancelar*, *chao* y el saludo.
 *
 * Convención: la función muta `session` y devuelve el texto a enviar. Un
 * `reply: null` significa "no responder" (el bot está en silencio).
 */

export interface ConvContext {
  phone: string;
  name?: string;
}

export interface ConvResult {
  reply: string | null;
}

// --- Helpers de formato y parseo -------------------------------------------

const fmt = (n: number): string =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

const GREETING_RE = /\b(hola|holi|buenas|buenos? d[ií]as|buenas tardes|buenas noches)\b/i;
const GOODBYE_RE = /\b(chao|chaito|ad[ií]os|nos vemos|eso ser[ií]a todo|salir|terminar)\b/i;
const MENU_RE = /\b(men[uú]|inicio|volver|empezar|start)\b/i;
const CANCEL_RE = /\b(cancelar|cancela|atr[aá]s)\b/i;

type Material = 'pino' | 'melamina' | 'madera';

function parseMaterial(text: string): Material | null {
  const s = text.toLowerCase();
  if (s.includes('pino')) return 'pino';
  if (s.includes('melamina') || s.includes('melamín')) return 'melamina';
  if (s.includes('madera') || s.includes('nativa') || s.includes('roble')) return 'madera';
  return null;
}

function parseYesNo(text: string): boolean | null {
  const s = text.toLowerCase().trim();
  if (/^(s[ií]|sip|claro|obvio|ya|dale|con caj[oó]n|con)\b/.test(s) || s === 'si') return true;
  if (/^(no|nop|sin|nel|sin caj[oó]n)\b/.test(s)) return false;
  return null;
}

/** Normaliza códigos: "125", "ped 125", "PED-000125" -> "PED-000125". */
function normalizeOrderCode(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits) return `PED-${digits.padStart(6, '0')}`;
  return raw.trim().toUpperCase();
}

const VELADOR_PRICE: Record<Material, number> = { pino: 35000, melamina: 45000, madera: 70000 };
const CLOSET_PRICE: Record<Material, number> = { pino: 150000, melamina: 180000, madera: 320000 };
const CAJON_EXTRA = 8000;

const ORDER_STATUS_TEXT: Record<string, string> = {
  BORRADOR: '⏳ esperando el anticipo del 50% para confirmar',
  CONFIRMADO: '✅ confirmado, entra a la fila de producción',
  EN_PRODUCCION: '🔨 en producción',
  LISTO: '📦 listo para retiro/entrega',
  ENTREGADO: '🎉 entregado',
  CANCELADO: '❌ cancelado',
};

// Datos de transferencia (edítalos con los reales del taller).
const TRANSFER_INFO =
  '🏦 *Datos de transferencia:*\n' +
  'Taller Saravia\n' +
  'RUT 12.345.678-9\n' +
  'Cuenta Vista BancoEstado 123456789\n' +
  'pagos@tallersaravia.cl';

const CLOSING_CTA =
  '\n\n¿Algo más? Escribe *menú* para ver las opciones, o *chao* para terminar. 🙌';

// --- Acciones del cliente ---------------------------------------------------

function resetToMenu(session: Session): void {
  session.flow = undefined;
  session.step = undefined;
  session.data = {};
  session.retries = 0;
}

/** Punto de entrada. Muta la sesión y devuelve el texto a responder. */
export async function handleConversation(
  rawText: string | undefined,
  session: Session,
  ctx: ConvContext,
): Promise<ConvResult> {
  const text = (rawText ?? '').trim();
  const lower = text.toLowerCase();

  // El saludo SIEMPRE abre/reabre la atención y lleva al menú.
  if (GREETING_RE.test(lower)) {
    session.active = true;
    resetToMenu(session);
    return { reply: GREETING_WITH_MENU };
  }

  // Sin sesión activa, el bot guarda silencio hasta el "hola".
  if (!session.active) return { reply: null };

  // Despedida: cierra la sesión.
  if (GOODBYE_RE.test(lower)) {
    session.active = false;
    return { reply: '¡Gracias por escribir! 🙌 Cuando quieras retomar, escríbeme *hola*. 👋' };
  }

  // Volver al menú / cancelar el flujo en curso.
  if (MENU_RE.test(lower) || CANCEL_RE.test(lower)) {
    const wasInFlow = Boolean(session.flow);
    resetToMenu(session);
    const head = wasInFlow ? 'Listo, lo dejamos hasta ahí. ' : '';
    return { reply: `${head}${buildMenu()}` };
  }

  // En el menú (sin flujo): interpretar la selección.
  if (!session.flow) {
    const option = matchOption(text);
    if (!option) {
      return {
        reply: `🤔 No te entendí. Respóndeme con el *número* de lo que necesitas (1-7) 👇\n\n${buildMenu()}`,
      };
    }
    return startFlow(option.flow, session, ctx);
  }

  // Dentro de un flujo: avanzar el paso.
  return runFlow(text, session, ctx);
}

// --- Arranque de cada flujo -------------------------------------------------

function startFlow(flow: NonNullable<Session['flow']>, session: Session, _ctx: ConvContext): ConvResult {
  session.flow = flow;
  session.retries = 0;
  session.data = {};

  switch (flow) {
    case 'velador':
      session.step = 'material';
      return {
        reply:
          '🪑 ¡Vamos con tu *velador*! ¿De qué material lo quieres?\n\n' +
          '• *pino* (económico)\n• *melamina*\n• *madera* (premium)',
      };
    case 'closet':
      session.step = 'material';
      return {
        reply:
          '🚪 ¡Buena, un *closet de 2 puertas*! Primero, ¿de qué material?\n\n' +
          '• *pino*\n• *melamina*\n• *madera*',
      };
    case 'materiales':
      // Informativo: no abre flujo, vuelve al menú.
      resetToMenu(session);
      return {
        reply:
          '🪵 *Materiales que trabajamos:*\n\n' +
          '• *Pino*: el más económico, ideal para muebles simples.\n' +
          '• *Melamina*: resistente y prolijo, muchos colores.\n' +
          '• *Madera nativa* (roble/raulí): premium, para piezas duraderas.\n\n' +
          'Escribe el *número* de lo que quieras hacer 👇\n\n' +
          buildMenu(),
      };
    case 'cocina':
      session.step = 'direccion';
      return {
        reply:
          '🍳 Una *cocina a medida* la cotizamos en terreno para medir bien.\n\n' +
          '¿Cuál es la *dirección* para la visita? (calle y número)',
      };
    case 'visita':
      session.step = 'direccion';
      return {
        reply: '📋 ¡Agendemos tu *visita a terreno*! ¿Cuál es la *dirección*? (calle y número)',
      };
    case 'anticipo':
      session.step = 'codigo';
      return {
        reply: '💰 Para registrar tu *anticipo*, dame el *número de pedido* (ej: PED-000125).',
      };
    case 'estado':
      session.step = 'codigo';
      return {
        reply: '📦 Dame el *número de tu pedido* (ej: PED-000125) y te digo en qué va.',
      };
    default:
      resetToMenu(session);
      return { reply: buildMenu() };
  }
}

// --- Avance de pasos --------------------------------------------------------

async function runFlow(text: string, session: Session, ctx: ConvContext): Promise<ConvResult> {
  switch (session.flow) {
    case 'velador':
      return flowVelador(text, session, ctx);
    case 'closet':
      return flowCloset(text, session, ctx);
    case 'cocina':
      return flowProyecto(text, session, ctx, 'Cocina a medida');
    case 'visita':
      return flowProyecto(text, session, ctx, 'Visita a terreno');
    case 'anticipo':
      return flowAnticipo(text, session);
    case 'estado':
      return flowEstado(text, session);
    default:
      resetToMenu(session);
      return { reply: buildMenu() };
  }
}

function retry(session: Session, msg: string): ConvResult {
  session.retries += 1;
  const hint = session.retries >= 2 ? '\n\n(Escribe *cancelar* para volver al menú.)' : '';
  return { reply: msg + hint };
}

async function flowVelador(text: string, session: Session, ctx: ConvContext): Promise<ConvResult> {
  if (session.step === 'material') {
    const material = parseMaterial(text);
    if (!material) return retry(session, '🤔 No reconocí el material. Escribe *pino*, *melamina* o *madera*.');
    session.data.material = material;
    session.retries = 0;
    session.step = 'cajon';
    return { reply: `👍 Anotado *${material}*. ¿Lo quieres *con cajón*? (sí / no)` };
  }

  if (session.step === 'cajon') {
    const yes = parseYesNo(text);
    if (yes === null) return retry(session, '🙏 ¿Con cajón? Respóndeme *sí* o *no*.');
    const material = session.data.material as Material;
    const price = VELADOR_PRICE[material] + (yes ? CAJON_EXTRA : 0);
    const desc = `Velador de ${material}${yes ? ' con cajón' : ''}`;

    await saveQuoteWithEstimate(ctx, desc, material, price);
    resetToMenu(session);
    return {
      reply:
        `📋 *Cotización lista:*\n${desc}\n*Total estimado: ${fmt(price)}*\n\n` +
        'Para confirmar tu pedido se necesita el *50% de anticipo*. ' +
        'Escribe *6* (Pagar anticipo) cuando quieras.' +
        CLOSING_CTA,
    };
  }

  resetToMenu(session);
  return { reply: buildMenu() };
}

async function flowCloset(text: string, session: Session, ctx: ConvContext): Promise<ConvResult> {
  if (session.step === 'material') {
    const material = parseMaterial(text);
    if (!material) return retry(session, '🤔 No reconocí el material. Escribe *pino*, *melamina* o *madera*.');
    session.data.material = material;
    session.retries = 0;
    session.step = 'medidas';
    return { reply: '📏 Perfecto. ¿Qué *medidas* aprox? (alto x ancho, ej: 200x120 cm)' };
  }

  if (session.step === 'medidas') {
    if (!/\d/.test(text)) return retry(session, '📐 Pásame las medidas con números, ej: *200x120 cm*.');
    session.data.medidas = sanitizeText(text, 120);
    const material = session.data.material as Material;
    const price = CLOSET_PRICE[material];
    const desc = `Closet 2 puertas, ${material}, ${session.data.medidas}`;

    await saveQuoteWithEstimate(ctx, desc, material, price);
    resetToMenu(session);
    return {
      reply:
        `📋 *Cotización estimada:*\n${desc}\n*Desde ${fmt(price)}* (se ajusta según diseño final)\n\n` +
        'Para confirmar se pide el *50% de anticipo*.' +
        CLOSING_CTA,
    };
  }

  resetToMenu(session);
  return { reply: buildMenu() };
}

async function flowProyecto(
  text: string,
  session: Session,
  ctx: ConvContext,
  tipo: string,
): Promise<ConvResult> {
  if (session.step === 'direccion') {
    if (text.trim().length < 5) return retry(session, '🏠 Necesito una *dirección* válida (calle y número).');
    session.data.direccion = sanitizeText(text, 200);
    session.retries = 0;
    session.step = 'dia';
    return { reply: '📅 ¿Qué *día y hora* te acomoda para la visita?' };
  }

  if (session.step === 'dia') {
    if (text.trim().length < 3) return retry(session, '🕐 Dime un *día y hora* aprox (ej: jueves en la tarde).');
    session.data.dia = sanitizeText(text, 120);

    await saveProjectVisit(ctx, tipo, session.data.direccion ?? '', session.data.dia);
    resetToMenu(session);
    return {
      reply:
        `✅ ¡Listo! Dejé agendada tu *visita* para *${tipo.toLowerCase()}*:\n` +
        `📍 ${session.data.direccion}\n🗓️ ${session.data.dia}\n\n` +
        'El maestro la confirma y llega a medir. ' +
        'Cualquier ajuste, escríbeme.' +
        CLOSING_CTA,
    };
  }

  resetToMenu(session);
  return { reply: buildMenu() };
}

async function flowAnticipo(text: string, session: Session): Promise<ConvResult> {
  if (session.step === 'codigo') {
    const code = normalizeOrderCode(text);
    const order = await safeGetOrder(code);
    if (!order) {
      return retry(session, `😕 No encontré el pedido *${code}*. Revisa el número (ej: PED-000125).`);
    }
    const deposited = order.payments
      .filter((p) => p.type === 'ANTICIPO')
      .reduce((acc, p) => acc + Number(p.amount), 0);
    const required = Number(order.depositRequired);
    const falta = Math.max(0, required - deposited);
    resetToMenu(session);

    const estado =
      falta === 0
        ? '🎉 ¡Tu anticipo ya está cubierto! El pedido está confirmado.'
        : `Anticipo requerido (50%): *${fmt(required)}*\nAbonado: *${fmt(deposited)}*\nFalta: *${fmt(falta)}*`;

    return {
      reply:
        `💰 *Pedido ${order.code}* — ${order.customer.name ?? ''}\n` +
        `Total: ${fmt(Number(order.totalAmount))}\n${estado}\n\n` +
        (falta > 0 ? `${TRANSFER_INFO}\n\nCuando transfieras, envíame el *comprobante* por aquí. 🙌` : '') +
        CLOSING_CTA,
    };
  }

  resetToMenu(session);
  return { reply: buildMenu() };
}

async function flowEstado(text: string, session: Session): Promise<ConvResult> {
  if (session.step === 'codigo') {
    const code = normalizeOrderCode(text);
    const order = await safeGetOrder(code);
    if (!order) {
      return retry(session, `😕 No encontré el pedido *${code}*. Revisa el número (ej: PED-000125).`);
    }
    resetToMenu(session);
    const estado = ORDER_STATUS_TEXT[order.status] ?? order.status;
    return {
      reply:
        `📦 *Pedido ${order.code}*\n${order.description ?? ''}\n\n` +
        `Estado: ${estado}\n` +
        `Total: ${fmt(Number(order.totalAmount))}` +
        CLOSING_CTA,
    };
  }

  resetToMenu(session);
  return { reply: buildMenu() };
}

// --- Acciones con la base de datos (best-effort) ----------------------------
// Si la DB falla, NO rompemos la conversación: el cliente igual recibe su
// cotización/respuesta y solo logueamos el problema.

async function saveQuoteWithEstimate(
  ctx: ConvContext,
  description: string,
  material: string,
  price: number,
): Promise<void> {
  try {
    const quote = await createQuickQuote({
      phone: ctx.phone,
      name: ctx.name,
      description,
      material,
    });
    await setQuoteEstimate(quote.id, price);
  } catch (err) {
    logger.error({ err }, 'No se pudo guardar la cotización (respondo igual)');
  }
}

async function saveProjectVisit(
  ctx: ConvContext,
  tipo: string,
  direccion: string,
  dia: string,
): Promise<void> {
  try {
    await createProjectQuote({
      phone: ctx.phone,
      name: ctx.name,
      description: `${tipo}. Preferencia de visita: ${dia}`,
      visit: {
        // Sin parseo de fecha real: agendamos tentativa y guardamos el texto.
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        address: direccion,
        notes: `Día/hora pedido por el cliente: ${dia}`,
      },
    });
  } catch (err) {
    logger.error({ err }, 'No se pudo agendar la visita (respondo igual)');
  }
}

async function safeGetOrder(code: string) {
  try {
    return await getOrderByCode(code);
  } catch (err) {
    logger.error({ err }, 'Error consultando pedido');
    return null;
  }
}
