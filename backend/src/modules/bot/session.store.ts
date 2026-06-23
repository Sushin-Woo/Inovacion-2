import type { FlowId } from './bot.service.js';

/**
 * Estado de conversación por cliente (en memoria).
 *
 * Guarda no solo si el chat está activo, sino el FLUJO en curso, el PASO actual
 * y los datos recolectados (material, medidas, etc.). Así el bot puede llevar
 * una conversación de varios turnos de principio a fin.
 *
 * En memoria basta para el MVP (una instancia). La interfaz (get/save/clear) se
 * mantiene estable por si luego se mueve a Redis/DB.
 */

export interface Session {
  active: boolean;
  expiresAt: number;
  /** Flujo en curso; undefined = el cliente está en el menú. */
  flow?: FlowId;
  /** Paso dentro del flujo. */
  step?: string;
  /** Datos recolectados durante el flujo. */
  data: Record<string, string>;
  /** Intentos inválidos consecutivos en el paso actual (para no frustrar). */
  retries: number;
}

const SESSIONS = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos de inactividad

function freshSession(): Session {
  return { active: false, expiresAt: 0, data: {}, retries: 0 };
}

/** Devuelve la sesión vigente del cliente (o una nueva inactiva si expiró). */
export function get(key: string): Session {
  const s = SESSIONS.get(key);
  if (s && Date.now() <= s.expiresAt) return s;
  if (s) SESSIONS.delete(key);
  return freshSession();
}

/** Persiste la sesión y renueva su vencimiento. */
export function save(key: string, session: Session): void {
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  SESSIONS.set(key, session);
}

/** Cierra y olvida la sesión. */
export function clear(key: string): void {
  SESSIONS.delete(key);
}
