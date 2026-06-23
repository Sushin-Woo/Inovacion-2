import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { registerBaileysSender } from './whatsapp.client.js';
import { handleInboundMessage } from './inbound.service.js';
import type { NormalizedInboundMessage } from './whatsapp.types.js';

/**
 * Proveedor de WhatsApp basado en Baileys (no oficial).
 *
 * Se conecta como un "dispositivo vinculado": al arrancar muestra un QR en la
 * terminal que el maestro escanea desde su teléfono (WhatsApp > Dispositivos
 * vinculados). La sesión se guarda en WHATSAPP_SESSION_DIR para no re-escanear.
 *
 * NOTA: es una integración no oficial; úsala con un número de prueba para el
 * piloto/clase. No requiere cuenta de Meta Business.
 */

let sock: WASocket | null = null;

/** phone (solo dígitos) -> JID de WhatsApp. */
function toJid(phone: string): string {
  return phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
}

function extractText(msg: WAMessage): string | undefined {
  const m = msg.message;
  if (!m) return undefined;
  return m.conversation ?? m.extendedTextMessage?.text ?? undefined;
}

/** Antigüedad del mensaje en segundos (messageTimestamp puede ser number o Long). */
function ageSeconds(msg: WAMessage): number {
  const raw = msg.messageTimestamp;
  const ts = typeof raw === 'number' ? raw : Number(raw?.toNumber?.() ?? raw ?? 0);
  if (!ts) return 0;
  return Date.now() / 1000 - ts;
}

// Solo respondemos a mensajes recientes. Evita contestar el historial que llega
// como 'append' al reconectar.
const MAX_AGE_SECONDS = 90;

export async function startBaileys(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(env.WHATSAPP_SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    // Baileys espera un logger tipo pino; el nuestro lo es.
    logger: logger.child({ mod: 'baileys' }) as never,
  });

  // Registra el "sender" para que sendTextMessage() pueda enviar por aquí.
  registerBaileysSender(async (to, body) => {
    if (!sock) throw new Error('Baileys no está conectado');
    await sock.sendMessage(toJid(to), { text: body });
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // eslint-disable-next-line no-console
      console.log('\n📲 Escanea este QR en WhatsApp > Dispositivos vinculados:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      logger.info('✅ WhatsApp (Baileys) conectado');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
        ?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      logger.warn({ statusCode }, 'WhatsApp (Baileys) desconectado');
      if (!loggedOut) {
        // Reintento de reconexión (no si la sesión fue cerrada desde el teléfono).
        setTimeout(() => void startBaileys(), 3000);
      } else {
        logger.error('Sesión cerrada. Borra WHATSAPP_SESSION_DIR y re-escanea el QR.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    logger.info({ type, count: messages.length }, '🔔 messages.upsert recibido');
    // Procesamos 'notify' (tiempo real) y 'append' (algunos clientes los entregan
    // así). El filtro de antigüedad evita responder mensajes viejos del historial.
    if (type !== 'notify' && type !== 'append') return;
    for (const m of messages) {
      try {
        // Ignora mensajes propios, de grupos y de estados.
        if (!m.message || m.key.fromMe) continue;
        const jid = m.key.remoteJid ?? '';
        if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue;

        const age = ageSeconds(m);
        if (age > MAX_AGE_SECONDS) {
          logger.info({ from: jid, age: Math.round(age) }, 'mensaje antiguo, ignorado');
          continue;
        }

        const text = extractText(m);
        const isAudio = Boolean(m.message.audioMessage);
        if (!text && !isAudio) continue; // por ahora solo texto/audio

        const norm: NormalizedInboundMessage = {
          externalId: m.key.id ?? `${jid}-${m.messageTimestamp}`,
          phone: jid.split('@')[0],
          // Responder al JID original (puede ser @lid; no se puede rearmar).
          chatJid: jid,
          name: m.pushName ?? undefined,
          type: isAudio ? 'audio' : 'text',
          text,
          audioId: isAudio ? (m.key.id ?? undefined) : undefined,
        };

        await handleInboundMessage(norm, { provider: 'baileys', id: m.key.id });
      } catch (err) {
        logger.error({ err }, 'Error procesando mensaje de Baileys');
      }
    }
  });
}

export async function stopBaileys(): Promise<void> {
  if (sock) {
    sock.end(undefined);
    sock = null;
  }
}
