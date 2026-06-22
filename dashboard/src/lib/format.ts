import type { Order } from '../types';

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export const formatCLP = (n: number): string => CLP.format(n ?? 0);

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

/** Suma de anticipos de un pedido. */
export function depositPaid(order: Order): number {
  return order.payments
    .filter((p) => p.type === 'ANTICIPO')
    .reduce((acc, p) => acc + Number(p.amount), 0);
}

/** % de anticipo cubierto (0–100), acotado. */
export function depositProgress(order: Order): number {
  if (!order.depositRequired) return 0;
  const ratio = depositPaid(order) / Number(order.depositRequired);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/** ¿Ya alcanzó el 50% (o el mínimo requerido) de anticipo? */
export function hasDeposit(order: Order): boolean {
  return depositPaid(order) >= Number(order.depositRequired);
}
