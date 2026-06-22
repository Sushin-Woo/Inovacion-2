import { useState, useEffect } from 'react';
import { QrCode, Link2, CheckCircle2, X, ScanLine } from 'lucide-react';
import { useBoardStore } from '../../store/useBoardStore';

/**
 * Módulo de vinculación QR.
 * El maestro elige un pedido y digita/escanea el código del QR físico del rollo
 * preimpreso. El sistema NO genera códigos: solo empareja el id del QR con la
 * orden (coherente con el backend).
 *
 * `prefillOrderId` permite abrirlo ya apuntando a un pedido (desde la tarjeta).
 */
export function QrLinkModule({
  prefillOrderId,
  onClose,
}: {
  prefillOrderId?: string | null;
  onClose?: () => void;
}) {
  const orders = useBoardStore((s) => s.orders);
  const pairLabel = useBoardStore((s) => s.pairLabel);

  // Solo pedidos sin etiqueta aún.
  const sinEtiqueta = orders.filter((o) => !o.label);

  const [orderId, setOrderId] = useState(prefillOrderId ?? '');
  const [qrCode, setQrCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (prefillOrderId) setOrderId(prefillOrderId);
  }, [prefillOrderId]);

  async function handleLink() {
    if (!orderId || qrCode.trim().length < 2) {
      setStatus('error');
      setMessage('Elige un pedido y escribe el código del QR.');
      return;
    }
    setStatus('saving');
    try {
      const order = await pairLabel(qrCode.trim(), orderId);
      setStatus('ok');
      setMessage(`QR ${qrCode.trim()} vinculado a ${order.code}.`);
      setQrCode('');
      setOrderId('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'No se pudo vincular.');
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-acero-200">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-lg bg-acero-700 p-2 text-white">
          <QrCode size={20} />
        </span>
        <div className="leading-tight">
          <h3 className="text-base font-extrabold text-acero-900">Vincular etiqueta QR</h3>
          <p className="text-xs text-gray-500">Empareja el QR del rollo con un pedido</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        )}
      </div>

      <label className="mb-1 block text-sm font-bold text-acero-800">Pedido</label>
      <select
        value={orderId}
        onChange={(e) => setOrderId(e.target.value)}
        className="mb-3 w-full rounded-xl border-2 border-acero-200 bg-white px-3 py-2.5 text-base font-semibold focus:border-acero-500 focus:outline-none"
      >
        <option value="">— Selecciona un pedido —</option>
        {sinEtiqueta.map((o) => (
          <option key={o.id} value={o.id}>
            {o.code} · {o.customer.name ?? o.customer.phone}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-sm font-bold text-acero-800">Código del QR físico</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value.toUpperCase())}
            placeholder="QR-ROLL-0008"
            inputMode="text"
            autoCapitalize="characters"
            className="w-full rounded-xl border-2 border-acero-200 py-2.5 pl-10 pr-3 text-base font-mono font-bold tracking-wider focus:border-taller-500 focus:outline-none"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Escanea con la cámara o tecléalo tal como aparece en la etiqueta.
      </p>

      <button type="button" onClick={handleLink} disabled={status === 'saving'} className="btn-primary mt-3 w-full">
        <Link2 size={18} /> {status === 'saving' ? 'Vinculando…' : 'Vincular'}
      </button>

      {message && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
            status === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {status === 'ok' && <CheckCircle2 size={16} />}
          {message}
        </div>
      )}
    </div>
  );
}
