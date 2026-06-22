import { useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  CheckCircle2,
  Clock,
  Hammer,
  PackageCheck,
  MessageCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { formatCLP, depositPaid, hasDeposit } from '../../lib/format';

/**
 * Resumen del día — replica visualmente lo que el bot manda al maestro por
 * WhatsApp. Si la API entregó un summary lo usa; si no, lo calcula desde el
 * estado local (modo mock) para que siempre muestre algo coherente.
 */

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl p-3 ${tone}`}>
      <span className="rounded-lg bg-white/30 p-2">{icon}</span>
      <div className="leading-tight">
        <div className="text-xl font-extrabold">{value}</div>
        <div className="text-xs font-semibold opacity-90">{label}</div>
      </div>
    </div>
  );
}

export function DailySummary() {
  const orders = useBoardStore((s) => s.orders);
  const summary = useBoardStore((s) => s.summary);

  // Cálculo local de respaldo (cuando no hay summary de la API).
  const local = useMemo(() => {
    const today = new Date().toDateString();
    const paidToday = orders.flatMap((o) =>
      o.payments.filter((p) => new Date(p.paidAt).toDateString() === today),
    );
    return {
      salesTotal: paidToday.reduce((acc, p) => acc + Number(p.amount), 0),
      paymentsCount: paidToday.length,
      confirmedToday: orders.filter((o) => o.status === 'CONFIRMADO').length,
      pendingDeposit: orders.filter((o) => o.status === 'BORRADOR' && !hasDeposit(o)).length,
      inProduction: orders.filter((o) => o.status === 'EN_PRODUCCION').length,
      ready: orders.filter((o) => o.status === 'LISTO').length,
    };
  }, [orders]);

  const data = summary ?? local;

  const pendientes = orders
    .filter((o) => o.status === 'BORRADOR' && !hasDeposit(o))
    .slice(0, 4);

  return (
    <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-acero-200">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-lg bg-emerald-600 p-2 text-white">
          <MessageCircle size={20} />
        </span>
        <div className="leading-tight">
          <h3 className="text-base font-extrabold text-acero-900">Resumen del día</h3>
          <p className="text-xs text-gray-500">Lo que el bot le envía a don Fernando</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Metric
          icon={<TrendingUp size={18} className="text-emerald-700" />}
          label="Ventas de hoy"
          value={formatCLP(data.salesTotal)}
          tone="bg-emerald-100 text-emerald-900"
        />
        <Metric
          icon={<Receipt size={18} className="text-acero-700" />}
          label="Pagos recibidos"
          value={data.paymentsCount}
          tone="bg-acero-100 text-acero-900"
        />
        <Metric
          icon={<CheckCircle2 size={18} className="text-emerald-700" />}
          label="Confirmados hoy"
          value={data.confirmedToday}
          tone="bg-madera-100 text-madera-900"
        />
        <Metric
          icon={<Clock size={18} className="text-taller-700" />}
          label="Pendientes de anticipo"
          value={data.pendingDeposit}
          tone="bg-taller-100 text-taller-900"
        />
        <Metric
          icon={<Hammer size={18} className="text-madera-800" />}
          label="En producción"
          value={data.inProduction}
          tone="bg-madera-100 text-madera-900"
        />
        <Metric
          icon={<PackageCheck size={18} className="text-emerald-700" />}
          label="Listos para entregar"
          value={data.ready}
          tone="bg-emerald-100 text-emerald-900"
        />
      </div>

      {pendientes.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-extrabold text-taller-700">⏳ Tareas: cobrar anticipo</h4>
          <ul className="space-y-1.5">
            {pendientes.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-lg bg-taller-50 px-3 py-2 text-sm ring-1 ring-taller-200"
              >
                <span className="font-bold text-acero-900">
                  {o.code} · {o.customer.name ?? o.customer.phone}
                </span>
                <span className="font-mono text-xs font-bold text-taller-700">
                  {formatCLP(depositPaid(o))} / {formatCLP(o.depositRequired)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
