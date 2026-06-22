import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OrderStatus, PaymentMethod, PaymentType } from '@prisma/client';
import { createOrder, getOrder, getOrderByCode, advanceOrder } from './order.service.js';
import { registerPayment } from '../payments/payment.service.js';

const createSchema = z.object({
  phone: z.string().min(8),
  name: z.string().optional(),
  totalAmount: z.number().positive(),
  description: z.string().optional(),
  quoteId: z.string().optional(),
  currency: z.string().optional(),
  depositRatio: z.number().min(0).max(1).optional(),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  type: z.nativeEnum(PaymentType).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  reference: z.string().optional(),
});

const advanceSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export async function orderRoutes(app: FastifyInstance) {
  app.post('/orders', async (req, reply) => {
    const data = createSchema.parse(req.body);
    return reply.code(201).send(await createOrder(data));
  });

  app.get('/orders/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const order = await getOrder(id);
    if (!order) return reply.code(404).send({ error: 'not found' });
    return reply.send(order);
  });

  app.get('/orders/code/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const order = await getOrderByCode(code);
    if (!order) return reply.code(404).send({ error: 'not found' });
    return reply.send(order);
  });

  // Registrar un pago. Si el anticipo alcanza el 50%, el pedido se confirma.
  app.post('/orders/:id/payments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = paymentSchema.parse(req.body);
    const result = await registerPayment({ orderId: id, ...data });
    return reply.code(201).send(result);
  });

  // Avanzar estado (en producción, listo, entregado...).
  app.post('/orders/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = advanceSchema.parse(req.body);
    return reply.send(await advanceOrder(id, status));
  });
}
