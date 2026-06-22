import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

/**
 * Cliente Prisma único (singleton). Evita agotar el pool de conexiones por
 * recargas en caliente durante el desarrollo (tsx watch).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
