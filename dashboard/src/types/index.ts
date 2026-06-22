// Tipos del dominio — alineados con el backend (prisma/schema.prisma).

export type QuoteType = 'RAPIDA' | 'PROYECTO';

export type QuoteStatus =
  | 'RECIBIDA'
  | 'EN_REVISION'
  | 'VISITA_AGENDADA'
  | 'COTIZADA'
  | 'ACEPTADA'
  | 'RECHAZADA'
  | 'EXPIRADA';

export type OrderStatus =
  | 'BORRADOR'
  | 'CONFIRMADO'
  | 'EN_PRODUCCION'
  | 'LISTO'
  | 'ENTREGADO'
  | 'CANCELADO';

export interface Customer {
  id: string;
  phone: string;
  name?: string | null;
}

export interface Quote {
  id: string;
  type: QuoteType;
  status: QuoteStatus;
  description?: string | null;
  material?: string | null;
  estimatedAmount?: number | null;
  customer: Customer;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  type: 'ANTICIPO' | 'SALDO' | 'AJUSTE';
  paidAt: string;
}

export interface Label {
  id: string;
  qrCode: string;
}

export interface Order {
  id: string;
  code: string;
  status: OrderStatus;
  totalAmount: number;
  depositRequired: number;
  description?: string | null;
  customer: Customer;
  payments: Payment[];
  label?: Label | null;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  salesTotal: number;
  paymentsCount: number;
  confirmedToday: number;
  pendingDeposit: number;
  inProduction: number;
  ready: number;
  text: string;
}

// ----------------------------------------------------------------------------
// Modelo de tablero: unificamos cotizaciones y pedidos en "tarjetas" para el
// Kanban, porque una columna (Nuevas Cotizaciones) muestra Quotes y el resto
// muestra Orders.
// ----------------------------------------------------------------------------

export type ColumnId = 'cotizaciones' | 'anticipo' | 'produccion' | 'listos';

export interface QuoteCard {
  kind: 'quote';
  quote: Quote;
}

export interface OrderCard {
  kind: 'order';
  order: Order;
}

export type BoardCard = QuoteCard | OrderCard;
