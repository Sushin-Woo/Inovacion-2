import { PrismaClient, QuoteType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Datos de ejemplo para el piloto: un cliente, una cotización rápida y un rollo
 * de etiquetas QR preimpresas (simulando los códigos del rollo físico).
 */
async function main() {
  const cliente = await prisma.customer.upsert({
    where: { phone: '56911112222' },
    update: {},
    create: { phone: '56911112222', name: 'Cliente Demo' },
  });

  await prisma.quote.create({
    data: {
      customerId: cliente.id,
      type: QuoteType.RAPIDA,
      description: 'Velador de pino, 1 cajón',
      material: 'pino',
    },
  });

  await prisma.label.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      qrCode: `QR-ROLL-${(i + 1).toString().padStart(4, '0')}`,
    })),
    skipDuplicates: true,
  });

  // eslint-disable-next-line no-console
  console.log('Seed completado.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
