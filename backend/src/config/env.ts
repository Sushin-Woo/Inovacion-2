import 'dotenv/config';
import { z } from 'zod';

/**
 * Validación estricta de variables de entorno con Zod.
 * La app NO arranca si falta una variable crítica o si tiene un formato inválido:
 * preferimos "fail-fast" en el boot antes que errores difusos en producción.
 *
 * Pensado para inyección segura de secretos (deployment keys / Docker secrets):
 * solo se leen de process.env, nunca se hardcodean.
 */

// En un .env, una variable vacía (FOO=) llega como "" (no undefined), lo que
// rompe validaciones de formato como .url(). Tratamos "" como "no definida".
const optionalUrl = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().url().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),

  // --- Proveedor de WhatsApp ---
  //  - 'cloud'   : API oficial de Meta (webhook + firma HMAC). Producción seria.
  //  - 'baileys' : librería no oficial (vincula escaneando un QR, como WhatsApp
  //                Web). Ideal para piloto/clase sin trámite de Meta Business.
  WHATSAPP_PROVIDER: z.enum(['cloud', 'baileys']).default('cloud'),
  // Carpeta donde Baileys persiste la sesión (para no re-escanear el QR).
  WHATSAPP_SESSION_DIR: z.string().default('./wa-session'),

  // --- WhatsApp Cloud API (Meta) — solo requeridas si WHATSAPP_PROVIDER=cloud ---
  // Token que TÚ defines y registras en el panel de Meta para el handshake GET.
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  // App Secret de la app de Meta: con él se valida la firma X-Hub-Signature-256.
  WHATSAPP_APP_SECRET: z.string().optional(),
  // Token de acceso para enviar mensajes salientes.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),

  // Número de WhatsApp del maestro (don Fernando), destino del resumen diario.
  MAESTRO_PHONE: z.string().min(8, 'MAESTRO_PHONE es obligatorio'),

  // --- Reglas de negocio ---
  // Fracción de anticipo requerida para confirmar (0.5 = 50%).
  DEPOSIT_RATIO: z.coerce.number().min(0).max(1).default(0.5),

  // --- Cron del resumen diario ---
  // Formato cron de 5 campos. Por defecto 20:00 todos los días.
  DAILY_SUMMARY_CRON: z.string().default('0 20 * * *'),
  TZ: z.string().default('America/Santiago'),

  // --- Adaptador de planillas (Google Forms/Sheets) — opcional ---
  SHEETS_WEBHOOK_URL: optionalUrl,
  // Token compartido para autenticar la ingesta entrante desde Forms/Sheets.
  SHEETS_INGEST_TOKEN: z.string().optional(),
}).superRefine((val, ctx) => {
  // Las credenciales de Meta solo son obligatorias en modo 'cloud'.
  if (val.WHATSAPP_PROVIDER === 'cloud') {
    if (!val.WHATSAPP_APP_SECRET || val.WHATSAPP_APP_SECRET.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WHATSAPP_APP_SECRET'],
        message: 'requerido (>=10 chars) cuando WHATSAPP_PROVIDER=cloud',
      });
    }
    if (!val.WHATSAPP_VERIFY_TOKEN || val.WHATSAPP_VERIFY_TOKEN.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WHATSAPP_VERIFY_TOKEN'],
        message: 'requerido (>=10 chars) cuando WHATSAPP_PROVIDER=cloud',
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n❌ Configuración de entorno inválida:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
