import { create } from 'zustand';
import type { Quote, Order, OrderStatus, DailySummary } from '../types';
import { api, isApiConfigured } from '../services/api';
import { mockQuotes, mockOrders } from '../data/mockData';

/**
 * Estado del tablero (Zustand). Mantiene cotizaciones, pedidos y resumen.
 *
 * Estrategia de datos para el MVP:
 *  - Si VITE_API_URL está configurada, intenta cargar del backend.
 *  - Si no hay API o falla, usa datos mock (`source: 'mock'`) para que el
 *    dashboard sea demostrable igual. La UI muestra ese estado.
 */

interface BoardState {
  quotes: Quote[];
  orders: Order[];
  summary: DailySummary | null;
  loading: boolean;
  source: 'api' | 'mock' | 'idle';
  error: string | null;

  load: () => Promise<void>;
  advanceOrder: (id: string, status: OrderStatus) => Promise<void>;
  pairLabel: (qrCode: string, orderId: string) => Promise<Order>;
}

function loadMock(set: (partial: Partial<BoardState>) => void) {
  set({ quotes: mockQuotes, orders: mockOrders, source: 'mock', loading: false });
}

export const useBoardStore = create<BoardState>((set, get) => ({
  quotes: [],
  orders: [],
  summary: null,
  loading: false,
  source: 'idle',
  error: null,

  async load() {
    set({ loading: true, error: null });

    if (!isApiConfigured()) {
      loadMock(set);
      return;
    }

    try {
      const [quotes, orders, summary] = await Promise.all([
        api.listQuotes(),
        api.listOrders(),
        api.getTodaySummary().catch(() => null),
      ]);
      set({ quotes, orders, summary, source: 'api', loading: false });
    } catch (err) {
      // Fallback gracioso: seguimos operando con mock y avisamos.
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      loadMock(set);
      set({ error: `Sin conexión a la API (${msg}). Mostrando datos de ejemplo.` });
    }
  },

  async advanceOrder(id, status) {
    // Optimista: actualizamos local y, si hay API, persistimos.
    const prev = get().orders;
    set({ orders: prev.map((o) => (o.id === id ? { ...o, status } : o)) });
    if (get().source === 'api') {
      try {
        const updated = await api.advanceOrder(id, status);
        set({ orders: get().orders.map((o) => (o.id === id ? { ...o, ...updated } : o)) });
      } catch {
        set({ orders: prev, error: 'No se pudo actualizar el pedido.' });
      }
    }
  },

  async pairLabel(qrCode, orderId) {
    if (get().source === 'api') {
      await api.pairLabel(qrCode, orderId);
    }
    // Reflejo local del emparejado.
    const orders = get().orders.map((o) =>
      o.id === orderId ? { ...o, label: { id: 'local', qrCode } } : o,
    );
    set({ orders });
    const found = orders.find((o) => o.id === orderId);
    if (!found) throw new Error('Pedido no encontrado');
    return found;
  },
}));
