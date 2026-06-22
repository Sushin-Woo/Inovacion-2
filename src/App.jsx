import React, { useState, useRef, useEffect } from "react";
import {
  ArrowLeft, Video, Phone, MoreVertical, Hammer, Bot,
  Smile, Paperclip, Camera, Send, Mic, CheckCheck,
  Wifi, BatteryFull, Calendar, MapPin, Clock, CheckCircle2, BarChart3,
} from "lucide-react";

// ───────────────────────────────────────────────────────────────────────
//  El maestro del segundo turno — Vista DUAL sincronizada
//  Izquierda: chat del CLIENTE   ·   Derecha: chat del TALLER (don Fernando)
//  Todo guionado (offline), sin API key: 100% a prueba de wifi.
// ───────────────────────────────────────────────────────────────────────

const now = () => {
  const d = new Date();
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
};
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const montoNum = (s) => parseInt(String(s).replace(/[^\d]/g, ""), 10) || 0;
const fmt = (n) => "$" + n.toLocaleString("es-CL");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fechaHoy() {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const d = new Date();
  return d.getDate() + " " + meses[d.getMonth()];
}

// Formato estilo WhatsApp: *negrita* y _cursiva_ (saltos por white-space).
function formatText(text) {
  const regex = /(\*[^*\n]+\*|_[^_\n]+_)/g;
  return text.split(regex).map((part, i) => {
    if (/^\*[^*\n]+\*$/.test(part)) return <strong key={i}>{part.slice(1, -1)}</strong>;
    if (/^_[^_\n]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// ── Catálogo con precio por material ────────────────────────────────────
const MUEBLES = {
  velador: { nombre: "velador", rango: "$35.000 y $58.000", precios: { pino: "$35.000", melamina: "$45.000", madera: "$58.000" } },
  closet: { nombre: "closet de 2 puertas", rango: "$180.000 y $290.000", precios: { pino: "$180.000", melamina: "$230.000", madera: "$290.000" } },
  escritorio: { nombre: "escritorio", rango: "$80.000 y $165.000", precios: { pino: "$80.000", melamina: "$115.000", madera: "$165.000" } },
  mesa: { nombre: "mesa de comedor", rango: "$150.000 y $350.000", precios: { pino: "$150.000", melamina: "$220.000", madera: "$350.000" } },
  cama: { nombre: "cama de 1,5 plaza", rango: "$120.000 y $205.000", precios: { pino: "$120.000", melamina: "$160.000", madera: "$205.000" } },
  repisa: { nombre: "repisa flotante", rango: "$22.000 y $38.000 por metro", nota: "por metro", precios: { pino: "$22.000", melamina: "$28.000", madera: "$38.000" } },
};

const COMUNAS = ["temuco", "padre las casas", "labranza", "pitrufquen", "freire", "villarrica", "gorbea", "loncoche", "nueva imperial", "carahue", "victoria", "lautaro", "angol", "pucon", "cunco"];

function detectarMueble(t) {
  if (t.includes("velador")) return "velador";
  if (t.includes("closet") || t.includes("ropero")) return "closet";
  if (t.includes("escritorio")) return "escritorio";
  if (t.includes("mesa") || t.includes("comedor")) return "mesa";
  if (t.includes("cama") || t.includes("respaldo")) return "cama";
  if (t.includes("repisa") || t.includes("estante")) return "repisa";
  return null;
}

function diaHabilProximo() {
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return dias[d.getDay()].replace(/^\w/, (c) => c.toUpperCase()) + " " + d.getDate() + " " + meses[d.getMonth()];
}
const tituloComuna = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// Crea un pedido nuevo y actualiza las estadísticas compartidas.
function crearPedido(ctx, shared) {
  const muebleKey = ctx.mueble || "closet";
  const material = ctx.material || "melamina";
  const m = MUEBLES[muebleKey];
  const precioN = montoNum(m.precios[material]);
  const anticipoN = Math.round(precioN / 2);
  const num = shared.nextNum++;
  const order = { num, muebleNom: m.nombre, material, precioN, anticipoN, estado: "En fabricación" };
  shared.orders.push(order);
  shared.stats.ventas += 1;
  shared.stats.ingreso += anticipoN;
  shared.stats.fabricando += 1;
  ctx.stage = "fabricacion";
  ctx.lastNum = num;
  return order;
}

// ── MOTOR DEL CLIENTE ───────────────────────────────────────────────────
function runCliente(rawText, ctxIn, shared) {
  const ctx = { ...ctxIn };
  const events = [];
  const t = norm(rawText);
  const has = (...w) => w.some((x) => t.includes(x));
  const dijoSi = has("si", "ya", "dale", "listo", "bueno", "obvio", "de una", "ok", "claro", "filo");
  const R = (reply) => ({ ctx, events, reply });

  if (ctx.pendiente === "agenda_dia") {
    ctx.pendiente = null; ctx.stage = "agendado";
    const found = COMUNAS.find((c) => t.includes(c));
    const lugar = found ? tituloComuna(found) : ctx.comuna || "tu domicilio";
    ctx.comuna = lugar;
    return R("¡Listo! Te dejo la visita agendada 👇\n[[CITA:" + diaHabilProximo() + " · 16:00 · " + lugar + "]]\nLlega el maestro Fernando a medir. Te mando un recordatorio el día antes 🔔");
  }

  if (ctx.pendiente === "reservar" && dijoSi) {
    ctx.pendiente = null;
    const order = crearPedido(ctx, shared);
    events.push({ type: "anticipo", order });
    return R("¡Genial! Reservé tu *" + order.muebleNom + "* (pedido *#" + order.num + "*) ✅\nAnticipo del 50%: *" + fmt(order.anticipoN) + "*\n\nTe dejo el QR para transferir 👇\n[[QR]]\nApenas llegue el pago te confirmo 🔨");
  }

  if (ctx.pendiente === "material") {
    const matKey = has("pino") ? "pino" : has("melamina") ? "melamina" : has("mdf") ? "melamina"
      : has("roble", "nativa", "rauli", "encino", "madera") ? "madera" : null;
    const m = ctx.mueble ? MUEBLES[ctx.mueble] : null;
    if (matKey && m) {
      ctx.pendiente = "reservar"; ctx.material = matKey;
      const matNom = matKey === "madera" ? "madera nativa" : matKey;
      const nota = m.nota ? " " + m.nota : "";
      return R("En *" + matNom + "* tu *" + m.nombre + "* queda en *" + m.precios[matKey] + "*" + nota + " 🪵\nIncluye armado y entrega en Temuco.\n\n¿Lo dejamos reservado? Con el *anticipo del 50%* aparto el material 😉");
    }
    if (has("cajon", "puerta", "grande", "chico", "pequeno", "medida", "metro", "plaza", "personas"))
      return R("¡Anotado! 📝 Para el precio exacto, ¿en qué material lo quieres?\n\n• *Pino* — económico\n• *Melamina* — intermedio\n• *Madera nativa* — premium");
  }

  if (has("que material", "materiales", "con que", "que madera", "tipo de madera", "maderas", "que ocupan", "que usan"))
    return R("Trabajamos con varios 🪵\n\n• *Pino:* económico y cálido\n• *Melamina:* resistente, muchos colores\n• *MDF enchapado:* fino para pintar\n• *Madera nativa* (roble/raulí): premium\n\n¿Para qué mueble? Así te recomiendo 😉");

  if (has("agendar", "reunion", "visita", "cuando pueden", "cuando vienen", "cuando podemos", "cita", "ir a ver", "a medir", "tomar medidas", "agenda")) {
    ctx.pendiente = "agenda_dia";
    return R("¡Claro! Vamos a medir sin costo 📋\nTengo este *" + diaHabilProximo() + " a las 16:00*, o el día que te acomode.\n\n¿En qué comuna estás y qué día te sirve?");
  }

  if (has("cuanto demora", "cuanto se demora", "cuanto tardan", "plazo", "tiempo de entrega", "cuando estaria", "demora", "cuanto tiempo"))
    return R("Depende del mueble 🔨\n\n• Chicos: *3 a 5 días*\n• Closet/escritorio: *7 a 10 días*\n• A medida grandes: *2 a 3 semanas*\n\nParte desde el anticipo 😉");

  if (has("garantia"))
    return R("Llevan *6 meses de garantía* por fallas de fabricación ✅ Lo arreglamos sin costo 🔨");

  if (has("formas de pago", "medios de pago", "como se paga", "como puedo pagar", "aceptan", "con tarjeta", "metodos de pago"))
    return R("Recibimos *transferencia, efectivo y tarjeta* 💳\nPartimos con *anticipo del 50%* (QR) y el saldo a la entrega. ¿Te paso el QR? 😉");

  if (has("donde estan", "direccion", "ubicacion", "donde quedan", "como llego"))
    return R("Estamos en el *Taller Saravia*, Labranza, Temuco 📍 Igual hacemos despacho y visitas a domicilio 🚚");
  if (has("horario", "a que hora", "atienden", "abren", "cierran"))
    return R("*Lun a Vie 9:00–19:00* y *Sáb hasta 14:00* 🕘 Por WhatsApp me escribes cuando quieras 😉");

  if (has("anticipo", "abono", "pagar", "pago", "transferir", "deposito", "reservar")) {
    ctx.pendiente = null;
    const order = crearPedido(ctx, shared);
    events.push({ type: "anticipo", order });
    return R("¡Perfecto! Reservé tu *" + order.muebleNom + "* (pedido *#" + order.num + "*) ✅\nAnticipo del 50%: *" + fmt(order.anticipoN) + "*\n\nTe dejo el QR 👇\n[[QR]]\nApenas llegue el pago te confirmo 🔨");
  }

  if (has("estado", "como va", "como viene", "como esta mi", "avance", "seguimiento", "cuando esta listo", "cuando estara", "va mi pedido", "mi pedido va", "listo mi pedido")) {
    const etapa = ctx.stage === "fabricacion" ? "En fabricación" : "Reunión agendada";
    const extra = ctx.stage === "fabricacion" ? "Entrega estimada: este *viernes* 😊" : "Ya tienes la visita agendada; después de medir parte la fabricación 🔨";
    return R("Tu pedido va avanzando 👇\n[[ESTADO:" + etapa + "]]\n" + extra);
  }

  if (has("resumen", "ventas del dia", "cuanto vendiste"))
    return R("Ese resumen lo revisa el equipo del taller 😅 Pero te ayudo con una *cotización*, tu *pedido* o *agendar* una visita. ¿Qué necesitas? 😉");

  if (has("cocina")) {
    ctx.mueble = null; ctx.pendiente = "agenda_dia";
    return R("¡Buenísimo! 🍽️ La cocina la cotizamos *por proyecto*, con visita técnica (cada espacio es distinto) 🙈\n\nPuedo ir a medir este *" + diaHabilProximo() + "*. ¿En qué comuna estás?");
  }

  const mueble = detectarMueble(t);
  if (mueble) {
    ctx.mueble = mueble; ctx.pendiente = "material";
    shared.stats.cotizaciones += 1;
    const m = MUEBLES[mueble];
    return R("Un *" + m.nombre + "* sale entre *" + m.rango + "*, según material y medidas 🪵\n\n¿Lo prefieres en *pino*, *melamina* o *madera*? Cuéntame medidas o si lleva cajones 😉");
  }

  if (has("cotiz", "presupuesto", "precio", "cuanto sale", "cuanto vale", "cuanto cuesta", "encargar", "mandar a hacer", "quiero un mueble", "hacer un mueble"))
    return R("¡De una! 🪵 ¿Qué mueble necesitas? (velador, closet, escritorio, mesa, repisa, cama…) Dime medidas y material y te doy el precio al tiro 😉");

  if (has("gracias", "vale", "perfecto", "genial") && !ctx.pendiente)
    return R("¡A ti! Cualquier cosa me escribes 🔨😉");

  return R("¡Hola! 👋 Soy *El maestro del segundo turno*, del Taller Saravia. Puedo *cotizar* un mueble, agendar una *visita*, contarte de *materiales* y *plazos*, o darte el *estado* de tu pedido. ¿Qué necesitas? 😉");
}

// ── MOTOR DEL TALLER (don Fernando) ─────────────────────────────────────
function runMaestro(rawText, ctxIn, shared) {
  const ctx = { ...ctxIn };
  const events = [];
  const t = norm(rawText);
  const has = (...w) => w.some((x) => t.includes(x));
  const R = (reply) => ({ ctx, events, reply });

  // Avisar a un cliente que su pedido está listo -> notifica al chat del cliente
  if (has("avisa", "avisale", "avisar", "esta listo", "ya esta", "retirar", "entregar", "listo el", "listo para")) {
    const numMatch = t.match(/\d{2,4}/);
    const num = numMatch ? numMatch[0]
      : shared.orders.length ? String(shared.orders[shared.orders.length - 1].num) : "128";
    const dia = has("manana") ? "mañana" : has("hoy") ? "hoy"
      : has("lunes") ? "lunes" : has("martes") ? "martes" : has("miercoles") ? "miércoles"
      : has("jueves") ? "jueves" : has("viernes") ? "viernes" : has("sabado") ? "sábado" : "viernes";
    const ord = shared.orders.find((o) => String(o.num) === num);
    if (ord) ord.estado = "Listo para entrega";
    events.push({ type: "avisar", num, dia });
    return R("✅ Listo, le avisé al cliente del *pedido #" + num + "* que estará listo para *" + dia + "*.\nLe llegó la notificación a su WhatsApp 📲");
  }

  if (has("resumen", "como vamos", "ventas del dia", "cierre del dia", "como va el dia", "del dia de hoy")) {
    const s = shared.stats;
    return R("Aquí va tu resumen, don Fernando 👇\n[[RESUMEN:" + s.cotizaciones + "|" + s.ventas + "|" + fmt(s.ingreso) + "|" + s.fabricando + "]]");
  }

  if (has("pedidos", "pendientes", "ordenes", "en cola", "que tengo")) {
    if (!shared.orders.length)
      return R("Por ahora no hay pedidos nuevos en la cola 📋\nApenas un cliente reserve, te aviso al tiro 🔔");
    const lista = shared.orders.map((o) => "• *#" + o.num + "* " + o.muebleNom + " (" + o.material + ") — " + o.estado).join("\n");
    return R("Pedidos en curso 📋\n\n" + lista);
  }

  if (has("stock", "inventario", "que queda", "material que queda"))
    return R("Estado del stock 📦\n\n⚠️ *Pegamento:* bajo (queda ~1 tarro)\n⚠️ *Tornillos:* bajos\n✅ *Melamina:* 2 planchas\n✅ *Pino:* suficiente\n\n¿Te encargo reponer pegamento y tornillos?");

  if (has("gasto", "boleta", "factura", "comprobante"))
    return R("Listo, registré el gasto 📸\n\n🧾 *Monto:* $48.500\n📦 *Categoría:* materiales (tableros y tornillos)\n\nLo sumé a los gastos del día ✅");

  return R("¡Hola don Fernando! 🛠️ Soy el asistente del taller. Te aviso de *pedidos* y *anticipos*, te paso el *resumen del día*, registro *gastos* y aviso a los clientes cuando un pedido está *listo*. ¿Qué necesitas?");
}

// ── Tarjetas dentro de los mensajes ─────────────────────────────────────
function parseCards(content) {
  const cards = [];
  let text = content;
  if (text.includes("[[QR]]")) { cards.push({ type: "qr" }); text = text.replace(/\[\[QR\]\]/g, ""); }
  text = text.replace(/\[\[CITA:([^\]]*)\]\]/g, (_, d) => { cards.push({ type: "cita", detail: d.trim() }); return ""; });
  text = text.replace(/\[\[ESTADO:([^\]]*)\]\]/g, (_, e) => { cards.push({ type: "estado", current: e.trim() }); return ""; });
  text = text.replace(/\[\[RESUMEN:([^\]]*)\]\]/g, (_, d) => {
    const p = d.split("|");
    cards.push({ type: "resumen", cot: p[0], ven: p[1], ing: p[2], fab: p[3] });
    return "";
  });
  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), cards };
}

const ETAPAS = ["Cotización enviada", "Reunión agendada", "Visita y medición", "En fabricación", "Listo para entrega"];

// QR autocontenido (SVG), no depende de internet.
function qrMatrix(n, seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const m = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) m[r][c] = rnd() > 0.52 ? 1 : 0;
  const clearArea = (R, C) => { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const rr = R + r, cc = C + c; if (rr >= 0 && rr < n && cc >= 0 && cc < n) m[rr][cc] = 0; } };
  clearArea(0, 0); clearArea(0, n - 8); clearArea(n - 8, 0);
  const finder = (R, C) => { for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) { const b = r === 0 || r === 6 || c === 0 || c === 6; const i = r >= 2 && r <= 4 && c >= 2 && c <= 4; m[R + r][C + c] = b || i ? 1 : 0; } };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  return m;
}
const QR_N = 25, QR_PX = 6, QR_MATRIX = qrMatrix(QR_N, 20250612);

function FakeQR() {
  const size = QR_N * QR_PX;
  const rects = [];
  for (let r = 0; r < QR_N; r++) for (let c = 0; c < QR_N; c++)
    if (QR_MATRIX[r][c]) rects.push(<rect key={r + "-" + c} x={c * QR_PX} y={r * QR_PX} width={QR_PX} height={QR_PX} />);
  return (
    <div className="wa-qrcard">
      <div className="wa-qrhead"><Hammer size={15} color="#075E54" /><span>Pago de anticipo · Taller Saravia</span></div>
      <svg className="wa-qrsvg" width={size} height={size} viewBox={"0 0 " + size + " " + size} shapeRendering="crispEdges">
        <rect x="0" y="0" width={size} height={size} fill="#fff" /><g fill="#0b231f">{rects}</g>
      </svg>
      <div className="wa-qramount">Anticipo 50% — reserva tu pedido</div>
      <div className="wa-qrhint">Escanea con la app de tu banco para transferir</div>
    </div>
  );
}

function CitaCard({ detail }) {
  const parts = detail.split("·").map((s) => s.trim());
  return (
    <div className="wa-card">
      <div className="wa-card-head wa-card-ok"><CheckCircle2 size={16} /><span>Reunión agendada</span></div>
      <div className="wa-card-rows">
        <div className="wa-card-row"><Calendar size={15} /><span>{parts[0] || "Por confirmar"}</span></div>
        {parts[1] && <div className="wa-card-row"><Clock size={15} /><span>{parts[1]}</span></div>}
        {parts[2] && <div className="wa-card-row"><MapPin size={15} /><span>{parts[2]}</span></div>}
      </div>
      <div className="wa-card-foot">Visita técnica sin costo · Taller Saravia</div>
    </div>
  );
}

function EstadoCard({ current }) {
  let cur = ETAPAS.findIndex((e) => e.toLowerCase().includes(current.toLowerCase()));
  if (cur < 0) cur = 1;
  return (
    <div className="wa-card">
      <div className="wa-card-head"><Hammer size={15} color="#075E54" /><span>Estado del pedido</span></div>
      <div className="wa-steps">
        {ETAPAS.map((e, i) => {
          const estado = i < cur ? "done" : i === cur ? "active" : "pending";
          return (
            <div className={"wa-step " + estado} key={i}>
              <span className="wa-step-dot" /><span className="wa-step-label">{e}</span>
            </div>
          );
        })}
      </div>
      <div className="wa-card-foot">Taller Saravia</div>
    </div>
  );
}

function ResumenCard({ cot, ven, ing, fab }) {
  return (
    <div className="wa-card">
      <div className="wa-card-head"><BarChart3 size={15} color="#075E54" /><span>Resumen del día · {fechaHoy()}</span></div>
      <div className="wa-res-grid">
        <div className="wa-res-item"><span className="wa-res-num">{cot}</span><span className="wa-res-lbl">Cotizaciones</span></div>
        <div className="wa-res-item"><span className="wa-res-num">{ven}</span><span className="wa-res-lbl">Ventas cerradas</span></div>
        <div className="wa-res-item"><span className="wa-res-num">{ing}</span><span className="wa-res-lbl">Ingreso del día</span></div>
        <div className="wa-res-item"><span className="wa-res-num">{fab}</span><span className="wa-res-lbl">En fabricación</span></div>
      </div>
      <div className="wa-res-alert">⚠️ Stock bajo: pegamento y tornillos</div>
      <div className="wa-res-alert">📦 Mañana entregar: pedido #124 (mesa)</div>
    </div>
  );
}

// ── Panel de chat reutilizable ──────────────────────────────────────────
function ChatPanel({ label, title, AvatarIcon, avatarBg, messages, quickReplies, onSend, isTyping, clock }) {
  const [input, setInput] = useState("");
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isTyping]);

  const send = (txt) => {
    const c = (txt || "").trim();
    if (!c || isTyping) return;
    onSend(c);
    setInput("");
  };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } };
  const hasText = input.trim().length > 0;

  return (
    <div className="wa-col">
      <div className="wa-label">{label}</div>
      <div className="wa-phone">
        <div className="wa-statusbar">
          <span className="wa-clock">{clock}</span>
          <div className="wa-status-icons"><span className="wa-net">5G</span><Wifi size={14} /><BatteryFull size={18} /></div>
        </div>

        <div className="wa-header">
          <ArrowLeft size={22} className="wa-hicon" />
          <div className="wa-avatar" style={{ background: avatarBg }}><AvatarIcon size={20} color="#fff" /></div>
          <div className="wa-contact">
            <div className="wa-name">{title}</div>
            <div className="wa-presence">{isTyping ? "escribiendo…" : "en línea"}</div>
          </div>
          <Video size={21} className="wa-hicon" />
          <Phone size={19} className="wa-hicon" />
          <MoreVertical size={20} className="wa-hicon" />
        </div>

        <div className="wa-chat" ref={chatRef}>
          <div className="wa-date"><span>HOY</span></div>
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const parsed = isUser ? { text: m.content, cards: [] } : parseCards(m.content);
            return (
              <React.Fragment key={i}>
                {parsed.text && (
                  <div className={"wa-row " + (isUser ? "out" : "in")}>
                    <div className={"wa-bubble " + (isUser ? "out" : "in")}>
                      <div className="wa-text">{formatText(parsed.text)}</div>
                      <div className="wa-meta"><span className="wa-time">{m.time}</span>{isUser && <CheckCheck size={15} color="#34B7F1" />}</div>
                    </div>
                  </div>
                )}
                {parsed.cards.map((card, ci) => (
                  <div className="wa-row in" key={ci}>
                    <div className="wa-bubble in wa-qrbubble">
                      {card.type === "qr" && <FakeQR />}
                      {card.type === "cita" && <CitaCard detail={card.detail} />}
                      {card.type === "estado" && <EstadoCard current={card.current} />}
                      {card.type === "resumen" && <ResumenCard cot={card.cot} ven={card.ven} ing={card.ing} fab={card.fab} />}
                      <div className="wa-meta"><span className="wa-time">{m.time}</span></div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
          {isTyping && (
            <div className="wa-row in">
              <div className="wa-bubble in wa-typing">
                <span className="wa-dot" style={{ animationDelay: "0s" }} />
                <span className="wa-dot" style={{ animationDelay: "0.18s" }} />
                <span className="wa-dot" style={{ animationDelay: "0.36s" }} />
              </div>
            </div>
          )}
        </div>

        <div className="wa-chips">
          {quickReplies.map((q, i) => (
            <button key={i} className="wa-chip" disabled={isTyping} onClick={() => send(q.send)}>{q.label}</button>
          ))}
        </div>

        <div className="wa-inputbar">
          <div className="wa-pill">
            <Smile size={23} color="#54656F" />
            <input ref={inputRef} className="wa-input" placeholder="Mensaje" value={input}
              disabled={isTyping} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} />
            <Paperclip size={21} color="#54656F" style={{ transform: "rotate(-45deg)" }} />
            <Camera size={21} color="#54656F" />
          </div>
          <button className="wa-send" disabled={isTyping} onClick={() => (hasText ? send(input) : null)}>
            {hasText ? <Send size={20} color="#fff" /> : <Mic size={21} color="#fff" />}
          </button>
        </div>
      </div>
    </div>
  );
}

const WELCOME_CLIENTE = "¡Hola! 👋 Soy *El maestro del segundo turno*, el asistente del Taller Saravia 🪵\n\n¿En qué te ayudo hoy? Puedo *cotizar* un mueble, agendar una *visita* o darte el *estado* de tu pedido 😉";
const WELCOME_MAESTRO = "¡Hola don Fernando! 🛠️ Soy el asistente del taller.\n\nTe aviso de *pedidos* y *anticipos* apenas entren, te paso el *resumen del día*, registro *gastos* y aviso a los clientes cuando un pedido está *listo*. ¿Qué necesitas?";

const QUICK_CLIENTE = [
  { label: "Cotizar velador 🪵", send: "Hola, quiero cotizar un velador" },
  { label: "Closet 2 puertas", send: "¿Cuánto sale un closet de 2 puertas?" },
  { label: "¿Qué materiales? 🪵", send: "¿Qué materiales usan?" },
  { label: "Cocina a medida", send: "Quiero una cocina completa a medida" },
  { label: "Agendar visita 📋", send: "¿Cuándo podemos agendar una reunión?" },
  { label: "Pagar anticipo 💰", send: "Listo, quiero pagar el anticipo del 50%" },
  { label: "Estado de mi pedido", send: "¿Cómo va mi pedido?" },
];

const QUICK_MAESTRO = [
  { label: "Resumen del día 📊", send: "Dame el resumen del día" },
  { label: "Pedidos pendientes 📋", send: "¿Qué pedidos tengo pendientes?" },
  { label: "Avisar pedido listo ✅", send: "Avísale al pedido #128 que el viernes está listo" },
  { label: "Ver stock 📦", send: "¿Cómo está el stock?" },
  { label: "Registrar gasto 📸", send: "Voy a registrar un gasto, te mando la boleta" },
];

const notifAnticipo = (o) =>
  "🔔 *¡Nuevo anticipo recibido!*\nPedido *#" + o.num + "* — " + o.muebleNom + " (" + o.material + ")\n💰 " + fmt(o.anticipoN) + " (50% de " + fmt(o.precioN) + ")\nMaterial apartado, entra a producción 🔨";
const notifListo = (num, dia) =>
  "¡Hola! 🎉 Tu *pedido #" + num + "* ya está listo.\nPuedes pasar a retirarlo el *" + dia + "* 📦\n¡Te esperamos en el Taller Saravia!";

export default function App() {
  const [cliMsgs, setCliMsgs] = useState([{ role: "assistant", content: WELCOME_CLIENTE, time: now() }]);
  const [maeMsgs, setMaeMsgs] = useState([{ role: "assistant", content: WELCOME_MAESTRO, time: now() }]);
  const [cliTyping, setCliTyping] = useState(false);
  const [maeTyping, setMaeTyping] = useState(false);
  const [clock, setClock] = useState(now());

  const cliCtx = useRef({ mueble: null, material: null, pendiente: null, comuna: null, stage: null });
  const maeCtx = useRef({});
  const shared = useRef({ nextNum: 128, orders: [], stats: { cotizaciones: 6, ventas: 2, ingreso: 360000, fabricando: 4 } });

  useEffect(() => {
    const t = setInterval(() => setClock(now()), 15000);
    return () => clearInterval(t);
  }, []);

  const sendCliente = async (text) => {
    setCliMsgs((p) => [...p, { role: "user", content: text, time: now() }]);
    setCliTyping(true);
    const r = runCliente(text, cliCtx.current, shared.current);
    cliCtx.current = r.ctx;
    await wait(850);
    setCliMsgs((p) => [...p, { role: "assistant", content: r.reply, time: now() }]);
    setCliTyping(false);
    for (const ev of r.events) {
      if (ev.type === "anticipo") {
        setMaeTyping(true);
        await wait(750);
        setMaeMsgs((p) => [...p, { role: "assistant", content: notifAnticipo(ev.order), time: now() }]);
        setMaeTyping(false);
      }
    }
  };

  const sendMaestro = async (text) => {
    setMaeMsgs((p) => [...p, { role: "user", content: text, time: now() }]);
    setMaeTyping(true);
    const r = runMaestro(text, maeCtx.current, shared.current);
    maeCtx.current = r.ctx;
    await wait(850);
    setMaeMsgs((p) => [...p, { role: "assistant", content: r.reply, time: now() }]);
    setMaeTyping(false);
    for (const ev of r.events) {
      if (ev.type === "avisar") {
        setCliTyping(true);
        await wait(750);
        setCliMsgs((p) => [...p, { role: "assistant", content: notifListo(ev.num, ev.dia), time: now() }]);
        setCliTyping(false);
      }
    }
  };

  return (
    <div className="wa-stage">
      <style>{CSS}</style>
      <div className="wa-stage-head">
        <div className="wa-stage-title">El maestro del segundo turno</div>
        <div className="wa-stage-sub">Cliente ⇆ Taller · sincronizado en vivo</div>
      </div>
      <div className="wa-panels">
        <ChatPanel
          label="📱 Vista del CLIENTE"
          title="El maestro del segundo turno"
          AvatarIcon={Hammer}
          avatarBg="linear-gradient(145deg,#b5832e,#8a5e1c)"
          messages={cliMsgs}
          quickReplies={QUICK_CLIENTE}
          onSend={sendCliente}
          isTyping={cliTyping}
          clock={clock}
        />
        <ChatPanel
          label="🛠️ Vista del TALLER · don Fernando"
          title="Asistente · Taller Saravia"
          AvatarIcon={Bot}
          avatarBg="linear-gradient(145deg,#0a8f6f,#075E54)"
          messages={maeMsgs}
          quickReplies={QUICK_MAESTRO}
          onSend={sendMaestro}
          isTyping={maeTyping}
          clock={clock}
        />
      </div>
      <div className="wa-stage-foot">Lo que pasa en un chat se refleja en el otro · prototipo offline</div>
    </div>
  );
}

const CSS = `
.wa-stage{min-height:100vh;display:flex;flex-direction:column;align-items:center;gap:14px;
  padding:20px 12px 28px;box-sizing:border-box;
  background:linear-gradient(160deg,#e3e8ef 0%,#cdd5e0 100%);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.wa-stage-head{text-align:center}
.wa-stage-title{font-size:19px;font-weight:800;color:#1f2c38;letter-spacing:-.2px}
.wa-stage-sub{font-size:13px;color:#5a6675;margin-top:2px}
.wa-stage-foot{font-size:12px;color:#5a6675;text-align:center}
.wa-panels{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;align-items:flex-start;width:100%}
.wa-col{display:flex;flex-direction:column;align-items:center;gap:8px}
.wa-label{font-size:13px;font-weight:700;color:#33424f}

.wa-phone{position:relative;width:360px;max-width:94vw;height:74vh;max-height:740px;min-height:520px;
  background:#ECE5DD;border-radius:32px;overflow:hidden;display:flex;flex-direction:column;
  box-shadow:0 24px 56px -14px rgba(20,30,50,.5),0 0 0 10px #161617,0 0 0 12px #303033;}

.wa-statusbar{flex-shrink:0;background:#075E54;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:6px 18px 4px;font-size:12px;font-weight:600}
.wa-status-icons{display:flex;align-items:center;gap:6px}
.wa-net{font-size:11px;font-weight:700}

.wa-header{flex-shrink:0;background:#075E54;color:#fff;display:flex;align-items:center;gap:9px;padding:7px 11px 9px}
.wa-hicon{flex-shrink:0;opacity:.96;cursor:pointer}
.wa-avatar{width:39px;height:39px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.wa-contact{flex:1;min-width:0;line-height:1.18}
.wa-name{font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-presence{font-size:12px;color:#bfe6df}

.wa-chat{flex:1;overflow-y:auto;padding:10px 8px 8px;background-color:#ECE5DD;
  background-image:radial-gradient(rgba(0,0,0,.028) 1px,transparent 1px);background-size:18px 18px}
.wa-date{display:flex;justify-content:center;margin:2px 0 8px}
.wa-date span{background:#E4ECF1;color:#54656F;font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:8px;box-shadow:0 1px 0.5px rgba(0,0,0,.1)}

.wa-row{display:flex;padding:1.5px 4px}
.wa-row.in{justify-content:flex-start}
.wa-row.out{justify-content:flex-end}
.wa-bubble{position:relative;max-width:82%;padding:6px 9px 5px;margin-top:3px;border-radius:9px;box-shadow:0 1px 0.6px rgba(0,0,0,.14);color:#111b21;animation:waPop .17s ease-out}
.wa-bubble.in{background:#fff;border-top-left-radius:0}
.wa-bubble.out{background:#DCF8C6;border-top-right-radius:0}
.wa-bubble.in::before{content:"";position:absolute;left:-8px;top:0;width:0;height:0;border-top:8px solid #fff;border-left:8px solid transparent}
.wa-bubble.out::before{content:"";position:absolute;right:-8px;top:0;width:0;height:0;border-top:8px solid #DCF8C6;border-right:8px solid transparent}
.wa-text{font-size:14.4px;line-height:1.36;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}
.wa-text strong{font-weight:700}
.wa-meta{display:flex;align-items:center;justify-content:flex-end;gap:3px;margin-top:1px}
.wa-time{font-size:10.5px;color:#667781}
@keyframes waPop{from{opacity:0;transform:translateY(5px) scale(.985)}to{opacity:1;transform:none}}

.wa-typing{display:flex;align-items:center;gap:4px;padding:10px 12px}
.wa-dot{width:7px;height:7px;border-radius:50%;background:#9aa7ad;display:inline-block;animation:waDot 1.2s infinite ease-in-out}
@keyframes waDot{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-4px);opacity:1}}

.wa-qrbubble{padding:9px 9px 5px}
.wa-qrcard{display:flex;flex-direction:column;align-items:center;gap:7px;width:200px;max-width:60vw}
.wa-qrhead{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:#075E54;text-align:center}
.wa-qrsvg{width:160px;height:160px;background:#fff;border:6px solid #fff;border-radius:8px;box-shadow:0 0 0 1px #e6e6e6}
.wa-qramount{font-size:12.5px;font-weight:600;color:#111b21;text-align:center}
.wa-qrhint{font-size:11px;color:#667781;text-align:center;line-height:1.3}

.wa-card{display:flex;flex-direction:column;gap:8px;width:222px;max-width:66vw}
.wa-card-head{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#075E54}
.wa-card-head.wa-card-ok{color:#1f9d57}
.wa-card-rows{display:flex;flex-direction:column;gap:6px}
.wa-card-row{display:flex;align-items:center;gap:8px;font-size:13px;color:#111b21}
.wa-card-row svg{color:#54656F;flex-shrink:0}
.wa-card-foot{font-size:10.5px;color:#667781;border-top:1px solid #eee;padding-top:6px}
.wa-steps{display:flex;flex-direction:column}
.wa-step{display:flex;align-items:center;gap:10px;position:relative;padding:5px 0}
.wa-step-dot{width:11px;height:11px;border-radius:50%;flex-shrink:0;border:2px solid #c4ccd0;background:#fff;z-index:1}
.wa-step:not(:last-child)::before{content:"";position:absolute;left:4.5px;top:17px;width:2px;height:calc(100% - 7px);background:#dfe5e8}
.wa-step.done .wa-step-dot{background:#25D366;border-color:#25D366}
.wa-step.done:not(:last-child)::before{background:#25D366}
.wa-step.active .wa-step-dot{background:#075E54;border-color:#075E54;box-shadow:0 0 0 3px rgba(7,94,84,.18)}
.wa-step-label{font-size:12.5px;color:#54656F}
.wa-step.done .wa-step-label{color:#111b21}
.wa-step.active .wa-step-label{color:#075E54;font-weight:700}

.wa-res-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.wa-res-item{background:#f3f7f5;border-radius:9px;padding:8px 9px;display:flex;flex-direction:column;gap:1px}
.wa-res-num{font-size:17px;font-weight:800;color:#075E54;line-height:1.1}
.wa-res-lbl{font-size:10.5px;color:#667781}
.wa-res-alert{font-size:11.5px;color:#8a6d00;background:#FCF4CB;border-radius:7px;padding:5px 8px}

.wa-chips{flex-shrink:0;display:flex;flex-wrap:wrap;gap:6px;padding:8px 9px;background:#ECE5DD;border-top:1px solid rgba(0,0,0,.05)}
.wa-chip{white-space:nowrap;cursor:pointer;background:#fff;color:#075E54;font-size:12px;font-weight:500;border:1px solid rgba(7,94,84,.28);border-radius:16px;padding:6px 11px;transition:background .12s,transform .12s}
.wa-chip:hover:not(:disabled){background:#f2fbf6}
.wa-chip:active:not(:disabled){transform:scale(.97)}
.wa-chip:disabled{opacity:.45;cursor:default}

.wa-inputbar{flex-shrink:0;display:flex;align-items:center;gap:7px;padding:7px 9px;background:#F0F0F0}
.wa-pill{flex:1;display:flex;align-items:center;gap:7px;background:#fff;border-radius:22px;padding:0 10px;min-height:43px;box-shadow:0 1px 1px rgba(0,0,0,.05)}
.wa-input{flex:1;min-width:0;border:none;outline:none;background:transparent;font-size:15px;color:#111b21;padding:9px 2px;font-family:inherit}
.wa-input::placeholder{color:#8c98a0}
.wa-send{flex-shrink:0;width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;background:#075E54;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .12s,background .12s}
.wa-send:hover:not(:disabled){background:#0a6d61}
.wa-send:active:not(:disabled){transform:scale(.93)}
.wa-send:disabled{opacity:.6;cursor:default}

@media (max-width:780px){
  .wa-phone{height:80vh}
}
`;
