import { useMemo } from 'react';
import { Inbox, Wallet, Hammer, PackageCheck } from 'lucide-react';
import type { BoardCard, Order, Quote } from '../../types';
import { useBoardStore } from '../../store/useBoardStore';
import { KanbanColumn } from './KanbanColumn';

/**
 * Reparte cotizaciones y pedidos en las 4 columnas del flujo del taller:
 *   1. Nuevas Cotizaciones  -> Quotes activas (Rápida / Por proyecto)
 *   2. Esperando Anticipo    -> Orders en BORRADOR (resalta < 50%)
 *   3. En Producción         -> Orders CONFIRMADO / EN_PRODUCCION
 *   4. Listos / Entregados   -> Orders LISTO / ENTREGADO
 */
function bucketize(quotes: Quote[], orders: Order[]) {
  const activeQuotes = quotes.filter(
    (q) => !['ACEPTADA', 'RECHAZADA', 'EXPIRADA'].includes(q.status),
  );

  const cotizaciones: BoardCard[] = activeQuotes.map((quote) => ({ kind: 'quote', quote }));
  const anticipo: BoardCard[] = [];
  const produccion: BoardCard[] = [];
  const listos: BoardCard[] = [];

  for (const order of orders) {
    const card: BoardCard = { kind: 'order', order };
    if (order.status === 'BORRADOR') anticipo.push(card);
    else if (order.status === 'CONFIRMADO' || order.status === 'EN_PRODUCCION') produccion.push(card);
    else if (order.status === 'LISTO' || order.status === 'ENTREGADO') listos.push(card);
  }

  return { cotizaciones, anticipo, produccion, listos };
}

export function KanbanBoard({ onLinkQr }: { onLinkQr?: (orderId: string) => void }) {
  const quotes = useBoardStore((s) => s.quotes);
  const orders = useBoardStore((s) => s.orders);
  const advanceOrder = useBoardStore((s) => s.advanceOrder);

  const cols = useMemo(() => bucketize(quotes, orders), [quotes, orders]);

  return (
    // Móvil: scroll horizontal con snap (una columna a la vez).
    // Escritorio/tablet ancha: grilla de 4 columnas.
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4">
      <KanbanColumn
        title="Nuevas Cotizaciones"
        subtitle="Rápida / Por proyecto"
        icon={<Inbox size={18} />}
        accent="bg-acero-700 text-white"
        cards={cols.cotizaciones}
        onLinkQr={onLinkQr}
      />
      <KanbanColumn
        title="Esperando Anticipo"
        subtitle="Falta el 50% de abono"
        icon={<Wallet size={18} />}
        accent="bg-taller-500 text-white"
        cards={cols.anticipo}
        onAdvance={advanceOrder}
        onLinkQr={onLinkQr}
      />
      <KanbanColumn
        title="En Producción"
        subtitle="Pedidos confirmados"
        icon={<Hammer size={18} />}
        accent="bg-madera-700 text-white"
        cards={cols.produccion}
        onAdvance={advanceOrder}
        onLinkQr={onLinkQr}
      />
      <KanbanColumn
        title="Listos / Entregados"
        icon={<PackageCheck size={18} />}
        accent="bg-emerald-700 text-white"
        cards={cols.listos}
        onAdvance={advanceOrder}
        onLinkQr={onLinkQr}
      />
    </div>
  );
}
