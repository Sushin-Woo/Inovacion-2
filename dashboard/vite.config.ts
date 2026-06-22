import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El `base` se controla por entorno para soportar dos destinos de deploy:
//  - Vercel / dominio raíz:   VITE_BASE="/"        (por defecto)
//  - GitHub Pages (subruta):  VITE_BASE="/<repo>/"
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  server: { port: 5174, host: true },
  // mode disponible por si se necesita lógica condicional en el futuro.
  define: { __APP_MODE__: JSON.stringify(mode) },
}));
