import { useEffect, useState } from 'react';
import { LayoutGrid, QrCode, BarChart3 } from 'lucide-react';
import { Header } from './components/Layout/Header';
import { KanbanBoard } from './components/Kanban/KanbanBoard';
import { QrLinkModule } from './components/QR/QrLinkModule';
import { DailySummary } from './components/Summary/DailySummary';
import { useBoardStore } from './store/useBoardStore';

type Tab = 'tablero' | 'qr' | 'resumen';

const TABS: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'tablero', label: 'Pedidos', icon: LayoutGrid },
  { id: 'qr', label: 'Vincular QR', icon: QrCode },
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
];

export default function App() {
  const load = useBoardStore((s) => s.load);
  const error = useBoardStore((s) => s.error);
  const loading = useBoardStore((s) => s.loading);

  const [tab, setTab] = useState<Tab>('tablero');
  // Pedido preseleccionado al pulsar "Vincular QR" en una tarjeta.
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const goLinkQr = (orderId: string) => {
    setQrOrderId(orderId);
    setTab('qr');
  };

  return (
    <div className="min-h-screen pb-20 md:pb-6">
      <Header />

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-3">
          <div className="rounded-lg bg-madera-200 px-3 py-2 text-sm font-semibold text-madera-900">
            {error}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
        {loading && <p className="py-10 text-center text-gray-500">Cargando…</p>}

        {!loading && tab === 'tablero' && <KanbanBoard onLinkQr={goLinkQr} />}

        {!loading && tab === 'qr' && (
          <div className="mx-auto max-w-md">
            <QrLinkModule prefillOrderId={qrOrderId} onClose={() => setTab('tablero')} />
          </div>
        )}

        {!loading && tab === 'resumen' && (
          <div className="mx-auto max-w-2xl">
            <DailySummary />
          </div>
        )}
      </main>

      {/* Navegación inferior (mobile-first). En escritorio también sirve. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-acero-200 bg-white md:static md:mt-2 md:border-0 md:bg-transparent">
        <div className="mx-auto flex max-w-7xl">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition md:flex-row md:justify-center md:gap-2 md:py-2 ${
                  active ? 'text-taller-600' : 'text-gray-400 hover:text-acero-700'
                }`}
              >
                <Icon size={22} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
