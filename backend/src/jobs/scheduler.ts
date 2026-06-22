import cron from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { runDailySummary } from './dailySummary.job.js';

/**
 * Programación de tareas. Centraliza los cron jobs para poder arrancarlos /
 * detenerlos limpiamente junto con el servidor.
 */
const tasks: cron.ScheduledTask[] = [];

export function startScheduler(): void {
  if (!cron.validate(env.DAILY_SUMMARY_CRON)) {
    logger.error({ cron: env.DAILY_SUMMARY_CRON }, 'DAILY_SUMMARY_CRON inválido; cron deshabilitado');
    return;
  }

  const task = cron.schedule(
    env.DAILY_SUMMARY_CRON,
    () => {
      runDailySummary().catch((err) => logger.error({ err }, 'Fallo en cron resumen diario'));
    },
    { timezone: env.TZ },
  );

  tasks.push(task);
  logger.info(
    { cron: env.DAILY_SUMMARY_CRON, tz: env.TZ },
    'Scheduler iniciado: resumen diario programado',
  );
}

export function stopScheduler(): void {
  for (const t of tasks) t.stop();
  tasks.length = 0;
}
