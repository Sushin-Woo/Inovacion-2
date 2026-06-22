import type { ReactNode } from 'react';

type Tone = 'wood' | 'orange' | 'steel' | 'green' | 'red' | 'gray';

const tones: Record<Tone, string> = {
  wood: 'bg-madera-200 text-madera-900',
  orange: 'bg-taller-100 text-taller-800 ring-1 ring-taller-300',
  steel: 'bg-acero-100 text-acero-800 ring-1 ring-acero-300',
  green: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
  red: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  gray: 'bg-gray-200 text-gray-700',
};

export function Badge({
  tone = 'gray',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
