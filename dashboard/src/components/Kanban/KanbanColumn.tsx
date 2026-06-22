import type { ReactNode } from 'react';
import type { BoardCard, OrderStatus } from '../../types';
import { OrderCard } from './OrderCard';

interface Props {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  accent: string; // clases de color para la cabecera
  cards: BoardCard[];
  onAdvance?: (orderId: string, next: OrderStatus) => void;
  onLinkQr?: (orderId: string) => void;
}

export function KanbanColumn({ title, subtitle, icon, accent, cards, onAdvance, onLinkQr }: Props) {
  return (
    <section
      className="flex w-[85vw] max-w-sm shrink-0 snap-start flex-col rounded-xl bg-madera-50 ring-1 ring-madera-200 md:w-full md:max-w-none"
    >
      <header className={`flex items-center gap-2 rounded-t-xl px-3 py-2.5 ${accent}`}>
        {icon}
        <div className="leading-tight">
          <h3 className="text-sm font-extrabold">{title}</h3>
          {subtitle && <p className="text-[11px] opacity-80">{subtitle}</p>}
        </div>
        <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-sm font-extrabold">
          {cards.length}
        </span>
      </header>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
        {cards.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-gray-400">Sin pedidos aquí</p>
        ) : (
          cards.map((card) => (
            <OrderCard
              key={card.kind === 'quote' ? `q-${card.quote.id}` : `o-${card.order.id}`}
              card={card}
              onAdvance={onAdvance}
              onLinkQr={onLinkQr}
            />
          ))
        )}
      </div>
    </section>
  );
}
