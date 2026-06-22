import {
  Zap,
  Ruler,
  QrCode,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Phone,
} from 'lucide-react';
import type { BoardCard, OrderStatus } from '../../types';
import { Badge } from '../ui/Badge';
import { formatCLP, formatDate, depositPaid, depositProgress, hasDeposit } from '../../lib/format';

interface Props {
  card: BoardCard;
  onAdvance?: (orderId: string, next: OrderStatus) => void;
  onLinkQr?: (orderId: string) => void;
}

// Siguiente estado en el flujo del taller (para el botón de avance).
const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  CONFIRMADO: { next: 'EN_PRODUCCION', label: 'A producción' },
  EN_PRODUCCION: { next: 'LISTO', label: 'Marcar listo' },
  LISTO: { next: 'ENTREGADO', label: 'Entregar' },
};

export function OrderCard({ card, onAdvance, onLinkQr }: Props) {
  if (card.kind === 'quote') {
    const q = card.quote;
    const esProyecto = q.type === 'PROYECTO';
    return (
      <article
        className={`rounded-xl bg-white p-3 shadow-card ring-1 ${
          esProyecto ? 'ring-acero-300' : 'ring-taller-300'
        } border-l-4 ${esProyecto ? 'border-acero-600' : 'border-taller-500'}`}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {esProyecto ? (
            <Badge tone="steel">
              <Ruler size={12} /> Por proyecto
            </Badge>
          ) : (
            <Badge tone="orange">
              <Zap size={12} /> Rápida
            </Badge>
          )}
          <span className="text-xs font-semibold text-gray-400">{formatDate(q.createdAt)}</span>
        </div>

        <h4 className="text-sm font-bold text-acero-900">{q.customer.name ?? 'Sin nombre'}</h4>
        <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{q.description}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {q.material && <Badge tone="wood">{q.material}</Badge>}
          {esProyecto && q.status === 'VISITA_AGENDADA' && <Badge tone="steel">Visita agendada</Badge>}
          {q.estimatedAmount != null && (
            <span className="ml-auto text-sm font-extrabold text-acero-800">
              {formatCLP(q.estimatedAmount)}
            </span>
          )}
        </div>
      </article>
    );
  }

  // --- Tarjeta de PEDIDO ---
  const o = card.order;
  const progress = depositProgress(o);
  const ok = hasDeposit(o);
  const esperandoAnticipo = o.status === 'BORRADOR';
  const advance = NEXT_STATUS[o.status];

  return (
    <article
      className={`rounded-xl bg-white p-3 shadow-card ring-1 ${
        esperandoAnticipo && !ok ? 'ring-2 ring-taller-400' : 'ring-acero-200'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold text-acero-700">{o.code}</span>
        <span className="text-xs font-semibold text-gray-400">{formatDate(o.createdAt)}</span>
      </div>

      <h4 className="text-sm font-bold text-acero-900">{o.customer.name ?? o.customer.phone}</h4>
      {o.description && <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{o.description}</p>}

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-gray-400">Total</span>
        <span className="text-base font-extrabold text-acero-900">{formatCLP(o.totalAmount)}</span>
      </div>

      {/* Barra de anticipo — clave del negocio (regla del 50%). */}
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold">
          <span className={ok ? 'text-emerald-700' : 'text-taller-700'}>
            Anticipo {formatCLP(depositPaid(o))} / {formatCLP(o.depositRequired)}
          </span>
          <span className={ok ? 'text-emerald-700' : 'text-taller-700'}>{progress}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all ${ok ? 'bg-emerald-500' : 'bg-taller-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {esperandoAnticipo && !ok && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-taller-700">
            <AlertTriangle size={13} /> Falta el 50% para confirmar
          </p>
        )}
      </div>

      {/* Estado de etiqueta QR. */}
      <div className="mt-2 flex items-center gap-2">
        {o.label ? (
          <Badge tone="green">
            <QrCode size={12} /> {o.label.qrCode}
          </Badge>
        ) : (
          <button
            type="button"
            onClick={() => onLinkQr?.(o.id)}
            className="inline-flex items-center gap-1 rounded-full bg-acero-100 px-2 py-0.5 text-xs font-bold text-acero-800 ring-1 ring-acero-300 hover:bg-acero-200"
          >
            <QrCode size={12} /> Vincular QR
          </button>
        )}
        <a
          href={`https://wa.me/${o.customer.phone}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
        >
          <Phone size={13} /> WhatsApp
        </a>
      </div>

      {/* Acción de avance de estado. */}
      {advance && (
        <button type="button" onClick={() => onAdvance?.(o.id, advance.next)} className="btn-steel mt-3 w-full">
          {advance.label} <ArrowRight size={16} />
        </button>
      )}
      {o.status === 'ENTREGADO' && (
        <div className="mt-3 flex items-center justify-center gap-1 text-sm font-bold text-emerald-700">
          <CheckCircle2 size={16} /> Entregado
        </div>
      )}
    </article>
  );
}
