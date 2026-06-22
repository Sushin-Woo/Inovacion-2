import type { Quote, Order, DailySummary, OrderStatus } from '../types';

/**
 * Capa de servicios REST. Único punto de contacto con el backend (backend/).
 * - La URL base viene de VITE_API_URL (variable de entorno pública).
 * - Si no hay API configurada o falla la conexión, el store cae a datos mock
 *   para que el MVP siga siendo demostrable sin backend levantado.
 *
 * NOTA de seguridad: aquí NO se guardan secretos. Cualquier credencial sensible
 * vive en el backend; el navegador solo conoce la URL pública de la API.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export const isApiConfigured = (): boolean => BASE_URL.length > 0;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.error ?? detail;
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(detail, res.status);
  }
  // 204 sin cuerpo
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // --- Cotizaciones ---
  listQuotes: () => request<Quote[]>('/quotes'),

  // --- Pedidos ---
  // El backend aún no expone GET /orders (lista); se deja preparado el contrato.
  listOrders: () => request<Order[]>('/orders'),
  getOrder: (id: string) => request<Order>(`/orders/${id}`),
  getOrderByCode: (code: string) =>
    request<Order>(`/orders/code/${encodeURIComponent(code)}`),

  advanceOrder: (id: string, status: OrderStatus) =>
    request<Order>(`/orders/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  registerPayment: (
    id: string,
    payload: { amount: number; type?: string; method?: string; reference?: string },
  ) =>
    request(`/orders/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // --- Etiquetas QR ---
  pairLabel: (qrCode: string, orderId: string) =>
    request('/labels/pair', {
      method: 'POST',
      body: JSON.stringify({ qrCode, orderId }),
    }),

  // --- Resumen diario ---
  getTodaySummary: () => request<DailySummary>('/summary/today'),
};
