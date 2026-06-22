import { buildServer } from './server.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';
import { startBaileys, stopBaileys } from './integrations/whatsapp/baileys.provider.js';

async function main() {
  const app = await buildServer();
  startScheduler();

  // En modo Baileys, conecta el dispositivo (mostrará el QR la primera vez).
  if (env.WHATSAPP_PROVIDER === 'baileys') {
    startBaileys().catch((err) => logger.error({ err }, 'No se pudo iniciar Baileys'));
  }

  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info(`🚀 API escuchando en http://${env.HOST}:${env.PORT}`);
  logger.info(`📡 Proveedor WhatsApp: ${env.WHATSAPP_PROVIDER}`);

  // Apagado ordenado: cierra cron, servidor y conexiones de DB.
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Apagando…');
    stopScheduler();
    await stopBaileys();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => void shutdown(sig));
  }
}

main().catch((err) => {
  logger.error({ err }, 'Fallo fatal en el arranque');
  process.exit(1);
});
