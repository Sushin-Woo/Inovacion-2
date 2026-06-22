import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  registerRoll,
  pairLabelToOrder,
  resolveLabel,
  countAvailable,
} from './label.service.js';

const rollSchema = z.object({
  codes: z.array(z.string().min(1)).min(1),
});

const pairSchema = z.object({
  qrCode: z.string().min(1),
  orderId: z.string().min(1),
});

export async function labelRoutes(app: FastifyInstance) {
  // Cargar los códigos del rollo preimpreso (el sistema NO los genera).
  app.post('/labels/roll', async (req, reply) => {
    const { codes } = rollSchema.parse(req.body);
    return reply.code(201).send(await registerRoll(codes));
  });

  // Emparejar un QR físico con un pedido.
  app.post('/labels/pair', async (req, reply) => {
    const { qrCode, orderId } = pairSchema.parse(req.body);
    return reply.send(await pairLabelToOrder(qrCode, orderId));
  });

  // Resolver un QR escaneado -> pedido.
  app.get('/labels/:qrCode', async (req, reply) => {
    const { qrCode } = req.params as { qrCode: string };
    const label = await resolveLabel(qrCode);
    if (!label) return reply.code(404).send({ error: 'not found' });
    return reply.send(label);
  });

  app.get('/labels/stats/available', async (_req, reply) => {
    return reply.send({ available: await countAvailable() });
  });
}
