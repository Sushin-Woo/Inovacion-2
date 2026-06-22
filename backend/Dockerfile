# =============================================================================
# Dockerfile multi-stage optimizado para producción (Cloud VPS Contabo).
# - Imagen final mínima (node:slim), sin toolchain de build.
# - Usuario no-root.
# - Prisma Client generado en build; migraciones aplicadas al arrancar.
# =============================================================================

# ---- Stage 1: deps (instala TODAS las dependencias para compilar) ----
FROM node:20-slim AS deps
WORKDIR /app
# OpenSSL es requerido por Prisma en runtime/engine.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: build (genera Prisma Client y compila TypeScript) ----
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# Recorta a dependencias de producción para copiarlas a la imagen final.
RUN npm prune --omit=dev

# ---- Stage 3: runner (imagen final mínima) ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copia solo lo necesario para ejecutar.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# Usuario no-root (el usuario 'node' viene en la imagen oficial).
USER node

EXPOSE 3000

# Aplica migraciones pendientes y luego arranca. Idempotente y seguro en cada deploy.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
