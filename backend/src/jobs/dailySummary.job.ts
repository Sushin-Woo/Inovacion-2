import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { sendTextMessage } from '../integrations/whatsapp/whatsapp.client.js';
import { sheetsSink } from '../modules/sheets/sheets.adapter.js';

/**
 * Resumen de cierre de jornada para el maestro (don Fernando).
 *
 * Consolida lo del día y arma un mensaje legible:
 *  - ventas del día (anticipos + saldos cobrados),
 *  - pedidos confirmados hoy,
 *  - pedidos pendientes de anticipo (siguen en BORRADOR),
 *  - pedidos en producción / listos.
 *
 * Reutilizable: lo llama el cron, pero también se expone por HTTP para que el
 * maestro pueda pedir "resumen del día" cuando quiera.
 */

function dayBounds(ref = new Date()): { start: Date; end: Date } {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(ref);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatCLP(n: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n);
}

export interface DailySummary {
  date: string;
  salesTotal: number;
  paymentsCount: number;
  confirmedToday: number;
  pendingDeposit: number;
  inProduction: number;
  ready: number;
  text: string;
}

export async function buildDailySummary(ref = new Date()): Promise<DailySummary> {
  const { start, end } = dayBounds(ref);
  const range = { gte: start, lte: end };

  const [paymentsAgg, paymentsCount, confirmedToday, pendingDeposit, inProduction, ready] =
    await Promise.all([
      prisma.payment.aggregate({ where: { paidAt: range }, _sum: { amount: true } }),
      prisma.payment.count({ where: { paidAt: range } }),
      prisma.order.count({ where: { confirmedAt: range, status: { not: OrderStatus.CANCELADO } } }),
      prisma.order.count({ where: { status: OrderStatus.BORRADOR } }),
      prisma.order.count({ where: { status: OrderStatus.EN_PRODUCCION } }),
      prisma.order.count({ where: { status: OrderStatus.LISTO } }),
    ]);

  const salesTotal = Number(paymentsAgg._sum.amount ?? 0);
  const dateStr = start.toLocaleDateString('es-CL', { timeZone: env.TZ });

  const text = [
    `🛠️ *Resumen del día — ${dateStr}*`,
    '',
    `💰 Ventas (pagos cobrados): ${formatCLP(salesTotal)} (${paymentsCount} pago/s)`,
    `✅ Pedidos confirmados hoy: ${confirmedToday}`,
    `⏳ Pendientes de anticipo: ${pendingDeposit}`,
    `🔨 En producción: ${inProduction}`,
    `📦 Listos para entrega: ${ready}`,
    '',
    'Buen descanso, don Fernando.',
  ].join('\n');

  return {
    date: start.toISOString().slice(0, 10),
    salesTotal,
    paymentsCount,
    confirmedToday,
    pendingDeposit,
    inProduction,
    ready,
    text,
  };
}

/** Ejecuta el resumen: lo manda al maestro y lo exporta a la planilla. */
export async function runDailySummary(ref = new Date()): Promise<DailySummary> {
  const summary = await buildDailySummary(ref);

  try {
    await sendTextMessage(env.MAESTRO_PHONE, summary.text);
  } catch (err) {
    logger.error({ err }, 'No se pudo enviar el resumen al maestro');
  }

  // Exportación modular a planilla (Noop si no está configurada).
  try {
    await sheetsSink.export('resumen_diario', [
      {
        fecha: summary.date,
        ventas: summary.salesTotal,
        pagos: summary.paymentsCount,
        confirmados: summary.confirmedToday,
        pendientes_anticipo: summary.pendingDeposit,
        en_produccion: summary.inProduction,
        listos: summary.ready,
      },
    ]);
  } catch (err) {
    logger.error({ err }, 'No se pudo exportar el resumen a la planilla');
  }

  logger.info({ date: summary.date }, 'Resumen diario procesado');
  return summary;
}
