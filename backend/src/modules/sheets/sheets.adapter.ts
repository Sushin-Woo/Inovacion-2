import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

/**
 * Adaptador de planillas (Google Forms / Sheets).
 *
 * El piloto valida datos con herramientas simples. Para que más adelante se
 * pueda conectar sin reescribir la lógica de negocio, definimos un CONTRATO
 * (interfaz DataSink/DataSource) y dejamos implementaciones intercambiables:
 *  - NoopSink: por defecto (no hace nada, solo loguea).
 *  - WebhookSink: hace POST a un Apps Script / endpoint de Sheets.
 *
 * Cambiar de destino = cambiar la implementación inyectada, nada más.
 */

export interface ExportRow {
  [column: string]: string | number | boolean | null;
}

/** Destino de exportación de datos (push hacia una planilla). */
export interface DataSink {
  export(sheet: string, rows: ExportRow[]): Promise<void>;
}

/** Fuente de ingesta de datos (un Form/Sheet empuja filas hacia nosotros). */
export interface DataSource {
  readonly name: string;
}

class NoopSink implements DataSink {
  async export(sheet: string, rows: ExportRow[]): Promise<void> {
    logger.info({ sheet, count: rows.length }, '[sheets noop] export simulado');
  }
}

class WebhookSink implements DataSink {
  constructor(private readonly url: string) {}

  async export(sheet: string, rows: ExportRow[]): Promise<void> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.SHEETS_INGEST_TOKEN ? { 'X-Sheets-Token': env.SHEETS_INGEST_TOKEN } : {}),
      },
      body: JSON.stringify({ sheet, rows }),
    });
    if (!res.ok) {
      logger.error({ sheet, status: res.status }, 'Fallo exportando a planilla');
      throw new Error(`Sheets export failed: ${res.status}`);
    }
  }
}

/**
 * Factory: elige la implementación según configuración. Si hay
 * SHEETS_WEBHOOK_URL, exporta de verdad; si no, usa el Noop.
 */
export function createSink(): DataSink {
  if (env.SHEETS_WEBHOOK_URL) return new WebhookSink(env.SHEETS_WEBHOOK_URL);
  return new NoopSink();
}

export const sheetsSink: DataSink = createSink();
