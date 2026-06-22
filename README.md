# El maestro del segundo turno — Demo (vista dual sincronizada)

Simulación de WhatsApp para la presentación de Innovación y Emprendimiento II.
Muestra DOS chats lado a lado, sincronizados en vivo:

- **📱 Vista del cliente** (izquierda): cotiza, agenda visita, paga anticipo, ve el estado.
- **🛠️ Vista del taller / don Fernando** (derecha): recibe los pedidos y anticipos,
  pide el resumen del día, ve el stock, registra gastos y avisa a los clientes
  cuando un pedido está listo.

Lo que pasa en un chat se refleja en el otro:
- El cliente paga el anticipo  →  al taller le llega la notificación y se crea el pedido.
- El taller pide el resumen     →  las cifras suben con lo que el cliente acaba de hacer.
- El taller dice "avísale al pedido #128 que el viernes está listo"  →  le llega el aviso al cliente.

Todo es **offline y guionado**: NO necesita API key ni internet. A prueba de wifi.

## 1. Requisitos
- Node.js 18 o superior (revisa con `node -v`).
  - Debian: `sudo apt install nodejs npm`  (o nvm si quieres una versión más nueva).

## 2. Correr
```bash
npm install
npm run dev
```
Se abre en http://localhost:5173 (si no abre solo, pega esa URL en el navegador).
Para detener: Ctrl+C.  Para la presentación: F11 (pantalla completa).

## 3. Guion sugerido para la demo
1. En el CLIENTE: toca "Cotizar velador" o "Closet 2 puertas".
2. Responde el material (pino / melamina / madera) → te da el precio de ese material.
3. Di "ya dale" o toca "Pagar anticipo" → sale el QR y al TALLER le llega el anticipo.
4. En el TALLER: toca "Resumen del día" → mira cómo subieron las cifras.
5. En el TALLER: toca "Avisar pedido listo" → al CLIENTE le llega el aviso.

## Personalizar (todo en src/App.jsx)
- Precios por material: objeto `MUEBLES`.
- Botones del cliente / taller: `QUICK_CLIENTE` y `QUICK_MAESTRO`.
- Respuestas y lógica: funciones `runCliente` y `runMaestro`.
- Cifras iniciales del resumen: `shared` dentro del componente `App`.
