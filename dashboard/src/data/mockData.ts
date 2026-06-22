import type { Quote, Order } from '../types';

// Datos de demostración para usar sin backend (o si la API no responde).
// Reflejan el guion del taller: cotizaciones rápidas / por proyecto y pedidos
// en distintas etapas de anticipo y producción.

const now = new Date();
const iso = (daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

export const mockQuotes: Quote[] = [
  {
    id: 'q1',
    type: 'RAPIDA',
    status: 'RECIBIDA',
    description: 'Velador de pino, 1 cajón. Mandó audio.',
    material: 'pino',
    estimatedAmount: null,
    customer: { id: 'c1', phone: '56911112222', name: 'Marta Soto' },
    createdAt: iso(0),
  },
  {
    id: 'q2',
    type: 'PROYECTO',
    status: 'VISITA_AGENDADA',
    description: 'Closet empotrado 3 puertas, dormitorio principal.',
    material: 'melamina',
    estimatedAmount: null,
    customer: { id: 'c2', phone: '56933334444', name: 'Don Hugo' },
    createdAt: iso(1),
  },
  {
    id: 'q3',
    type: 'RAPIDA',
    status: 'COTIZADA',
    description: 'Repisa flotante 1.2m.',
    material: 'pino',
    estimatedAmount: 38000,
    customer: { id: 'c3', phone: '56955556666', name: 'Javiera' },
    createdAt: iso(0),
  },
];

export const mockOrders: Order[] = [
  {
    id: 'o1',
    code: 'PED-000125',
    status: 'BORRADOR',
    totalAmount: 180000,
    depositRequired: 90000,
    description: 'Mesa de comedor 6 puestos, roble.',
    customer: { id: 'c4', phone: '56977778888', name: 'Familia Rojas' },
    payments: [{ id: 'p1', amount: 40000, type: 'ANTICIPO', paidAt: iso(0) }],
    label: null,
    createdAt: iso(2),
  },
  {
    id: 'o2',
    code: 'PED-000126',
    status: 'BORRADOR',
    totalAmount: 95000,
    depositRequired: 47500,
    description: 'Velador melamina blanco.',
    customer: { id: 'c5', phone: '56922221111', name: 'Cris' },
    payments: [],
    label: null,
    createdAt: iso(1),
  },
  {
    id: 'o3',
    code: 'PED-000127',
    status: 'CONFIRMADO',
    totalAmount: 220000,
    depositRequired: 110000,
    description: 'Escritorio en L con cajonera.',
    customer: { id: 'c6', phone: '56944445555', name: 'Estudio Lara' },
    payments: [{ id: 'p2', amount: 110000, type: 'ANTICIPO', paidAt: iso(1) }],
    label: { id: 'l1', qrCode: 'QR-ROLL-0007' },
    createdAt: iso(3),
  },
  {
    id: 'o4',
    code: 'PED-000124',
    status: 'EN_PRODUCCION',
    totalAmount: 150000,
    depositRequired: 75000,
    description: 'Cómoda 4 cajones.',
    customer: { id: 'c7', phone: '56966667777', name: 'Paula' },
    payments: [{ id: 'p3', amount: 75000, type: 'ANTICIPO', paidAt: iso(4) }],
    label: { id: 'l2', qrCode: 'QR-ROLL-0003' },
    createdAt: iso(5),
  },
  {
    id: 'o5',
    code: 'PED-000122',
    status: 'LISTO',
    totalAmount: 60000,
    depositRequired: 30000,
    description: 'Repisa de baño.',
    customer: { id: 'c8', phone: '56988889999', name: 'Tomás' },
    payments: [{ id: 'p4', amount: 60000, type: 'ANTICIPO', paidAt: iso(6) }],
    label: { id: 'l3', qrCode: 'QR-ROLL-0001' },
    createdAt: iso(7),
  },
  {
    id: 'o6',
    code: 'PED-000120',
    status: 'ENTREGADO',
    totalAmount: 45000,
    depositRequired: 22500,
    description: 'Banqueta de taller.',
    customer: { id: 'c9', phone: '56900001111', name: 'Vecino Luis' },
    payments: [{ id: 'p5', amount: 45000, type: 'ANTICIPO', paidAt: iso(9) }],
    label: { id: 'l4', qrCode: 'QR-ROLL-0002' },
    createdAt: iso(10),
  },
];
