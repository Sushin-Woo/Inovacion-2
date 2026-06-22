import { Prisma, OrderStatus, PaymentType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { sanitizeText, normalizePhone } from '../../utils/sanitize.js';

/**
 * Lógica de pedidos. Regla de negocio central:
 *   un pedido pasa a CONFIRMADO solo cuando el anticipo acumulado
 *   alcanza el % requerido (por defecto 50% del total).
 */

/** Genera un código legible y único tipo PED-000128. */
async function nextOrderCode(): Promise<string> {
  const count = await prisma.order.count();
  const n = (count + 1).toString().padStart(6, '0');
  return `PED-${n}`;
}

export interface CreateOrderInput {
  phone: string;
  name?: string;
  totalAmount: number;
  description?: string;
  quoteId?: string;
  currency?: string;
  /** Sobrescribe el ratio de anticipo (0.5 = 50%). */
  depositRatio?: number;
}

export async function createOrder(input: CreateOrderInput) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error('Teléfono inválido');
  if (!(input.totalAmount > 0)) throw new Error('totalAmount debe ser > 0');

  const customer = await prisma.customer.upsert({
    where: { phone },
    update: input.name ? { name: sanitizeText(input.name, 120) } : {},
    create: { phone, name: input.name ? sanitizeText(input.name, 120) : null },
  });

  const ratio = input.depositRatio ?? env.DEPOSIT_RATIO;
  const depositRequired = new Prisma.Decimal(input.totalAmount).mul(ratio);

  return prisma.order.create({
    data: {
      code: await nextOrderCode(),
      customerId: customer.id,
      quoteId: input.quoteId,
      totalAmount: new Prisma.Decimal(input.totalAmount),
      depositRequired,
      currency: input.currency ?? 'CLP',
      description: input.description ? sanitizeText(input.description) : null,
      status: OrderStatus.BORRADOR,
    },
  });
}

/** Suma de los anticipos registrados para un pedido. */
export async function totalDeposited(orderId: string): Promise<Prisma.Decimal> {
  const agg = await prisma.payment.aggregate({
    where: { orderId, type: PaymentType.ANTICIPO },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Prisma.Decimal(0);
}

/**
 * Reevalúa el estado del pedido según los anticipos acumulados.
 * Es idempotente: si ya cumple el umbral y sigue en BORRADOR, lo confirma.
 * Se llama después de registrar cada pago.
 */
export async function recomputeOrderStatus(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== OrderStatus.BORRADOR) return order;

  const deposited = await totalDeposited(orderId);
  if (deposited.greaterThanOrEqualTo(order.depositRequired)) {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CONFIRMADO, confirmedAt: new Date() },
    });
    logger.info(
      { code: updated.code, deposited: deposited.toString() },
      'Pedido CONFIRMADO: anticipo del 50% alcanzado',
    );
    return updated;
  }
  return order;
}

export async function advanceOrder(orderId: string, status: OrderStatus) {
  const data: Prisma.OrderUpdateInput = { status };
  if (status === OrderStatus.ENTREGADO) data.deliveredAt = new Date();
  return prisma.order.update({ where: { id: orderId }, data });
}

export async function getOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, payments: true, label: true, quote: true },
  });
}

export async function getOrderByCode(code: string) {
  return prisma.order.findUnique({
    where: { code },
    include: { customer: true, payments: true, label: true },
  });
}
