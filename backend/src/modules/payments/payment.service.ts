import { Prisma, PaymentMethod, PaymentType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sanitizeText, sanitizeAmount } from '../../utils/sanitize.js';
import { recomputeOrderStatus } from '../orders/order.service.js';

export interface RegisterPaymentInput {
  orderId: string;
  amount: number;
  type?: PaymentType;
  method?: PaymentMethod;
  reference?: string;
}

/**
 * Registra un pago y reevalúa el estado del pedido.
 * Si es un ANTICIPO que completa el 50%, recomputeOrderStatus lo confirmará.
 *
 * Todo ocurre en una transacción: o se guarda el pago y se actualiza el
 * estado, o no pasa nada (consistencia financiera).
 */
export async function registerPayment(input: RegisterPaymentInput) {
  const amount = sanitizeAmount(input.amount);
  if (amount === null || amount <= 0) throw new Error('Monto de pago inválido');

  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new Error('Pedido no encontrado');

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        orderId: input.orderId,
        amount: new Prisma.Decimal(amount),
        type: input.type ?? PaymentType.ANTICIPO,
        method: input.method ?? PaymentMethod.TRANSFERENCIA,
        reference: input.reference ? sanitizeText(input.reference, 120) : null,
      },
    });
    return created;
  });

  // Reevaluación fuera de la transacción de escritura (lectura + posible update).
  const updatedOrder = await recomputeOrderStatus(input.orderId);

  return { payment, order: updatedOrder };
}
