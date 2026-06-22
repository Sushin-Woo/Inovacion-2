import { Hammer, Wifi, WifiOff } from 'lucide-react';
import { useBoardStore } from '../../store/useBoardStore';

export function Header() {
  const source = useBoardStore((s) => s.source);
  const online = source === 'api';

  return (
    <header className="sticky top-0 z-20 bg-acero-700 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <span className="rounded-lg bg-taller-500 p-2">
          <Hammer size={22} />
        </span>
        <div className="leading-tight">
          <h1 className="text-base font-extrabold sm:text-lg">El maestro del segundo turno</h1>
          <p className="text-[11px] text-acero-100">Panel del taller</p>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            online ? 'bg-emerald-500/90' : 'bg-madera-500/90'
          }`}
          title={online ? 'Conectado a la API' : 'Datos de ejemplo (sin API)'}
        >
          {online ? <Wifi size={13} /> : <WifiOff size={13} />}
          {online ? 'En línea' : 'Demo'}
        </span>
      </div>
    </header>
  );
}
