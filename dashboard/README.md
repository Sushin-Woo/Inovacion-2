# Dashboard del taller — "El maestro del segundo turno"

SPA administrativa **mobile-first** para que el carpintero gestione pedidos
desde el celular/tablet en el taller. Consume la API de [`../backend`](../backend).

> Vive en `dashboard/`, separado del demo de presentación (raíz del repo) y del
> backend (`backend/`). Los tres conviven sin pisarse.

## Stack

- **React 18 + Vite + TypeScript**
- **Tailwind CSS 3** — paleta "workshop-friendly" de alto contraste
- **Lucide React** — iconografía
- **Zustand** — estado del MVP (con fallback a datos mock)

## Estructura

```
dashboard/
  index.html
  tailwind.config.js          Paleta personalizada (madera / taller / acero)
  vite.config.ts              base configurable para Vercel o GitHub Pages
  .env.example                VITE_API_URL, VITE_BASE
  vercel.json                 Deploy en Vercel (SPA rewrites)
  src/
    main.tsx / App.tsx        Shell + navegación por pestañas
    index.css                 Tailwind + componentes (.btn, etc.)
    types/index.ts            Tipos del dominio (alineados al backend)
    lib/format.ts             CLP, fechas, % de anticipo
    services/api.ts           Capa REST (único punto hacia el backend)
    store/useBoardStore.ts    Estado Zustand (API o mock)
    data/mockData.ts          Datos de ejemplo (demo sin backend)
    components/
      Layout/Header.tsx
      Kanban/KanbanBoard.tsx     Reparte cotizaciones/pedidos en 4 columnas
      Kanban/KanbanColumn.tsx
      Kanban/OrderCard.tsx       Tarjeta de cotización y de pedido
      QR/QrLinkModule.tsx        Vinculación de QR físico ↔ pedido
      Summary/DailySummary.tsx   Réplica del resumen que manda el bot
      ui/Badge.tsx
```

## Secciones

1. **Tablero Kanban** — 4 columnas del flujo real:
   - **Nuevas Cotizaciones**: diferencia visual *Rápida* (naranja, rayo) vs
     *Por proyecto* (azul acero, regla).
   - **Esperando Anticipo**: resalta en naranja los pedidos sin el 50% de abono,
     con barra de progreso del anticipo.
   - **En Producción** y **Listos / Entregados** con botón de avance de estado.
2. **Vinculación QR** — elegir pedido + digitar/escanear el código del rollo
   preimpreso. Solo empareja (no genera códigos), igual que el backend.
3. **Resumen del día** — métricas visuales (ventas, pagos, pendientes…) que
   replican lo que el bot envía por WhatsApp.

## Diseño workshop-friendly

- Paleta de **alto contraste** (madera, naranja "taller", azul "acero") legible
  bajo sol o polvo. Definida en `tailwind.config.js`.
- **Mobile-first**: navegación inferior, columnas con scroll horizontal + snap
  en móvil y grilla de 4 en tablet/escritorio, botones táctiles grandes.

## Puesta en marcha

```bash
cd dashboard
cp .env.example .env      # define VITE_API_URL (o déjalo vacío para modo demo)
npm install
npm run dev               # http://localhost:5174
```

Sin `VITE_API_URL` el dashboard funciona con **datos mock** (etiqueta "Demo" en
la barra). Con la API levantada (`../backend`), carga datos reales.

## Despliegue seguro

- **Vercel**: importa el repo, root del proyecto = `dashboard/`. Define
  `VITE_API_URL` en *Environment Variables*. `vercel.json` ya maneja el SPA.
- **GitHub Pages**: workflow en `../.github/workflows/deploy-dashboard.yml`.
  Define las *Variables* de Actions `VITE_API_URL` y `VITE_BASE`
  (p.ej. `/Inovacion-2/`).

> **Seguridad**: todo lo que empieza con `VITE_` queda embebido en el bundle del
> navegador y es público. **No pongas secretos aquí**. Las credenciales (tokens
> de WhatsApp, DB, etc.) viven solo en el backend; el dashboard únicamente
> conoce la URL pública de la API.
