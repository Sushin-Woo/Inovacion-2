import { LabelStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sanitizeText } from '../../utils/sanitize.js';

/**
 * Gestión de etiquetas QR.
 *
 * CONTEXTO IMPORTANTE: los QR vienen en un rollo PREIMPRESO; el taller NO tiene
 * impresora. Por lo tanto el sistema nunca genera ni imprime códigos: solo
 * EMPAREJA el id del QR físico (qrCode) con una orden digital.
 *
 * Flujo: se cargan los códigos del rollo (registerRoll) como DISPONIBLE y luego
 * el taller escanea/teclea uno y lo asocia a un pedido (pairLabelToOrder).
 */

/**
 * Carga un lote de códigos del rollo. Idempotente: ignora los ya cargados.
 * Devuelve cuántos se crearon nuevos.
 */
export async function registerRoll(codes: string[]): Promise<{ created: number }> {
  const clean = Array.from(
    new Set(codes.map((c) => sanitizeText(c, 120)).filter((c) => c.length > 0)),
  );
  if (clean.length === 0) return { created: 0 };

  const result = await prisma.label.createMany({
    data: clean.map((qrCode) => ({ qrCode })),
    skipDuplicates: true,
  });
  return { created: result.count };
}

/**
 * Empareja un QR físico con un pedido. Validaciones:
 *  - el QR debe existir y estar DISPONIBLE,
 *  - el pedido no debe tener ya otra etiqueta.
 * Atómico para evitar que dos escaneos tomen el mismo código.
 */
export async function pairLabelToOrder(qrCode: string, orderId: string) {
  const code = sanitizeText(qrCode, 120);

  return prisma.$transaction(async (tx) => {
    const label = await tx.label.findUnique({ where: { qrCode: code } });
    if (!label) throw new Error('Ese código QR no existe en el rollo cargado');
    if (label.status !== LabelStatus.DISPONIBLE || label.orderId) {
      throw new Error('Ese código QR ya está asignado o anulado');
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { label: true },
    });
    if (!order) throw new Error('Pedido no encontrado');
    if (order.label) throw new Error('El pedido ya tiene una etiqueta asignada');

    return tx.label.update({
      where: { id: label.id },
      data: {
        orderId,
        status: LabelStatus.ASIGNADA,
        assignedAt: new Date(),
      },
      include: { order: true },
    });
  });
}

/** Resuelve un QR escaneado a su pedido (para ver el estado en el taller). */
export async function resolveLabel(qrCode: string) {
  return prisma.label.findUnique({
    where: { qrCode: sanitizeText(qrCode, 120) },
    include: { order: { include: { customer: true, payments: true } } },
  });
}

export async function countAvailable(): Promise<number> {
  return prisma.label.count({ where: { status: LabelStatus.DISPONIBLE } });
}
