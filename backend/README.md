# El maestro del segundo turno — API (MVP)

Backend del asistente virtual de WhatsApp para una mueblería. Maneja
cotizaciones, pedidos con anticipo, etiquetado QR y un resumen diario para el
maestro (don Fernando).

> Este backend vive en `backend/` y es independiente del demo React/Vite que
> está en la raíz del repo (la simulación offline para la presentación).

## Stack

- **Node.js 20 + TypeScript** (ESM)
- **Fastify 5** — webhooks y REST
- **Prisma ORM + PostgreSQL** (SQLite opcional para pruebas)
- **node-cron** — resumen diario programado
- **Zod** — validación de entorno y de payloads
- **pino** — logging estructurado

## Arquitectura

Código modular por dominio, pensado para que cada pieza se pueda cambiar sin
tocar el resto (incluida la conexión futura a planillas):

```
src/
  config/env.ts              Validación estricta de variables de entorno (Zod)
  lib/                       prisma (singleton), logger
  utils/sanitize.ts          Saneamiento de payloads no confiables
  integrations/whatsapp/     Cliente + tipos + seguridad (firma HMAC, handshake)
  modules/
    webhook/                 Recepción de eventos de WhatsApp
    quotes/                  Cotización RÁPIDA y POR PROYECTO (+ visita a terreno)
    orders/                  Pedidos + regla del 50% de anticipo
    payments/                Registro de pagos
    labels/                  Emparejado de QR físico (rollo preimpreso) ↔ pedido
    sheets/                  Adaptador modular Google Forms/Sheets + rutas ops
  jobs/                      Resumen diario + scheduler (cron)
  server.ts / index.ts       Wiring de Fastify y arranque
prisma/schema.prisma         Modelo de datos
```

## Flujos de negocio

### 1. Cotización (dos modalidades)
- **Rápida**: nace de un audio/mensaje del cliente. El webhook crea la
  cotización automáticamente; también `POST /quotes/quick`.
- **Por proyecto** (mueble a medida): `POST /quotes/project` agenda una **visita
  a terreno** de forma atómica (cotización + `SiteVisit`).

### 2. Regla del 50% de anticipo
Un pedido nace en `BORRADOR`. Al registrar pagos (`POST /orders/:id/payments`),
`recomputeOrderStatus` suma los anticipos; cuando alcanzan
`depositRequired` (= `DEPOSIT_RATIO`, por defecto 50% del total), el pedido pasa
a **CONFIRMADO**. Es idempotente y transaccional.

### 3. Etiquetas QR (rollo preimpreso)
El taller **no imprime**: los QR vienen en un rollo. Se cargan los códigos
(`POST /labels/roll`) como `DISPONIBLE` y luego se **emparejan** con un pedido
(`POST /labels/pair`). El sistema solo asocia el id físico del QR con la orden
digital; nunca genera códigos.

### 4. Resumen diario para el maestro
Cron (`DAILY_SUMMARY_CRON`, por defecto 20:00) consolida ventas del día y
pedidos pendientes y se lo envía por WhatsApp. También on-demand:
`GET /summary/today` (cálculo) y `POST /summary/run` (envía).

### 5. Flexibilidad de datos (planillas)
`modules/sheets/sheets.adapter.ts` define un contrato `DataSink`/`DataSource`
con implementaciones intercambiables (Noop / Webhook). Ingesta entrante desde
Forms/Sheets vía `POST /ingest/sheets/quote` autenticada con `X-Sheets-Token`.

## Seguridad (by design)

- **Webhook de WhatsApp**: handshake GET con `WHATSAPP_VERIFY_TOKEN` + validación
  de **firma HMAC-SHA256** (`X-Hub-Signature-256`) sobre el **cuerpo crudo**,
  comparada en tiempo constante. Sin firma válida → 401.
- **Saneamiento** de todo texto/teléfono/monto entrante.
- **Idempotencia** de eventos por `externalId` (evita reprocesar reintentos).
- `@fastify/helmet` (cabeceras) y `@fastify/rate-limit`.
- Secretos solo por entorno (`env.ts` valida; nada hardcodeado). `.env` ignorado
  por git; en VPS se inyectan como secretos.

## Puesta en marcha

### Opción A — Docker (recomendada, incluye Postgres)

```bash
cp .env.example .env        # completa WHATSAPP_* y MAESTRO_PHONE
docker compose up --build   # levanta db + api, aplica migraciones
```

### Opción B — Local

```bash
cp .env.example .env
npm install
# Necesitas un Postgres corriendo (o usa: docker compose up db)
npm run prisma:migrate      # crea el esquema
npm run db:seed             # datos de ejemplo (opcional)
npm run dev                 # API en http://localhost:3000
```

Health check: `GET /health`.

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/webhook/whatsapp` | Handshake / recepción de eventos (firmados) |
| POST | `/quotes/quick` | Cotización rápida |
| POST | `/quotes/project` | Cotización por proyecto + visita a terreno |
| POST | `/quotes/:id/estimate` | El maestro fija el monto |
| POST | `/orders` | Crear pedido (calcula anticipo requerido) |
| POST | `/orders/:id/payments` | Registrar pago (confirma al llegar al 50%) |
| POST | `/orders/:id/status` | Avanzar estado del pedido |
| POST | `/labels/roll` | Cargar códigos del rollo preimpreso |
| POST | `/labels/pair` | Emparejar QR físico ↔ pedido |
| GET | `/labels/:qrCode` | Resolver QR escaneado → pedido |
| GET | `/summary/today` | Resumen del día (cálculo) |
| POST | `/summary/run` | Enviar resumen al maestro ahora |
| POST | `/ingest/sheets/quote` | Ingesta desde Forms/Sheets (token) |

## Despliegue en Contabo VPS

1. `git clone` del repo en el VPS.
2. Crear `.env` (fuera de git) con secretos reales.
3. `docker compose up -d --build`.
4. Exponer el puerto 3000 detrás de un reverse proxy con TLS (Caddy/Nginx) y
   configurar la URL pública del webhook en el panel de Meta.

> Las migraciones se aplican solas en cada arranque (`prisma migrate deploy`).
