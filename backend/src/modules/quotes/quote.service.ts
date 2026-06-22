import { Prisma, QuoteStatus, QuoteType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sanitizeText, normalizePhone } from '../../utils/sanitize.js';

/**
 * Lógica de cotizaciones. Soporta las dos modalidades del negocio:
 *  - RAPIDA: el cliente manda audio/mensaje y se cotiza directo.
 *  - PROYECTO: mueble a medida; requiere agendar una visita a terreno.
 */

async function upsertCustomer(rawPhone: string, name?: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error('Teléfono inválido');
  return prisma.customer.upsert({
    where: { phone },
    update: name ? { name: sanitizeText(name, 120) } : {},
    create: { phone, name: name ? sanitizeText(name, 120) : null },
  });
}

export interface CreateQuickQuoteInput {
  phone: string;
  name?: string;
  description?: string;
  audioUrl?: string;
  material?: string;
}

/** Cotización RÁPIDA: nace de un mensaje/audio del cliente. */
export async function createQuickQuote(input: CreateQuickQuoteInput) {
  const customer = await upsertCustomer(input.phone, input.name);
  return prisma.quote.create({
    data: {
      customerId: customer.id,
      type: QuoteType.RAPIDA,
      status: QuoteStatus.RECIBIDA,
      description: input.description ? sanitizeText(input.description) : null,
      audioUrl: input.audioUrl ? sanitizeText(input.audioUrl, 1024) : null,
      material: input.material ? sanitizeText(input.material, 120) : null,
    },
  });
}

export interface CreateProjectQuoteInput {
  phone: string;
  name?: string;
  description?: string;
  visit: {
    scheduledAt: Date;
    address: string;
    notes?: string;
  };
}

/**
 * Cotización POR PROYECTO: crea la cotización y agenda la visita a terreno
 * de forma atómica. La cotización queda en VISITA_AGENDADA.
 */
export async function createProjectQuote(input: CreateProjectQuoteInput) {
  const customer = await upsertCustomer(input.phone, input.name);
  return prisma.quote.create({
    data: {
      customerId: customer.id,
      type: QuoteType.PROYECTO,
      status: QuoteStatus.VISITA_AGENDADA,
      description: input.description ? sanitizeText(input.description) : null,
      siteVisit: {
        create: {
          scheduledAt: input.visit.scheduledAt,
          address: sanitizeText(input.visit.address, 512),
          notes: input.visit.notes ? sanitizeText(input.visit.notes) : null,
        },
      },
    },
    include: { siteVisit: true },
  });
}

/** El maestro define el monto estimado y la cotización pasa a COTIZADA. */
export async function setQuoteEstimate(quoteId: string, amount: number, currency = 'CLP') {
  return prisma.quote.update({
    where: { id: quoteId },
    data: {
      estimatedAmount: new Prisma.Decimal(amount),
      currency,
      status: QuoteStatus.COTIZADA,
    },
  });
}

export async function markQuoteAccepted(quoteId: string) {
  return prisma.quote.update({
    where: { id: quoteId },
    data: { status: QuoteStatus.ACEPTADA },
  });
}

export async function listQuotes(status?: QuoteStatus) {
  return prisma.quote.findMany({
    where: status ? { status } : undefined,
    include: { customer: true, siteVisit: true },
    orderBy: { createdAt: 'desc' },
  });
}
