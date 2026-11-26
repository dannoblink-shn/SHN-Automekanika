import type { Timestamp } from 'firebase/firestore';

export type CurrencyCode = 'USD' | 'VES' | 'EUR' | 'MXN' | 'COP' | 'ARS' | 'CLP' | 'PEN';
export type FuelType = 'Gasolina' | 'Diésel' | 'Híbrido' | 'Eléctrico' | 'GLP';
export type MechanicStatus = 'Disponible' | 'En Servicio' | 'Descanso';
export type PartCategory =
  | 'Filtros'
  | 'Frenos'
  | 'Lubricantes'
  | 'Motor'
  | 'Suspensión'
  | 'Eléctrico'
  | 'Neumáticos'
  | 'Otros';
export type WorkOrderPriority = 'Normal' | 'Urgente';
export type WorkOrderStatus =
  | 'Recibido'
  | 'Diagnóstico'
  | 'En Reparación'
  | 'Esperando Repuesto'
  | 'Listo'
  | 'Entregado'
  | 'Cancelado';
export type WorkOrderItemType = 'Mano de Obra' | 'Repuesto';
export type AppointmentStatus =
  | 'Programada'
  | 'Confirmada'
  | 'En Taller'
  | 'Completada'
  | 'Cancelada';

export type QuoteStatus = 'Borrador' | 'Enviado' | 'Aprobado' | 'Rechazado' | 'Convertido';
export type PaymentStatus = 'Pendiente' | 'Abonado' | 'Pagado';

export type NavSection =
  | 'dashboard'
  | 'orders'
  | 'quotes'
  | 'appointments'
  | 'customers'
  | 'inventory'
  | 'mechanics'
  | 'payouts'
  | 'settings';

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  address: string;
  taxRate: number;
  currency: CurrencyCode;
  baysCount: number;
  bcvRate?: number;
  bcvUpdatedAt?: string;
  bcvSource?: string;
  mechanicCommissionRate?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Customer {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  email: string;
  taxId: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Vehicle {
  id: string;
  ownerId: string;
  customerId: string;
  customerName: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  color: string;
  fuelType: FuelType;
  mileage: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Mechanic {
  id: string;
  ownerId: string;
  name: string;
  specialty: string;
  bay: string;
  phone: string;
  status: MechanicStatus;
  commissionRate?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Part {
  id: string;
  ownerId: string;
  sku: string;
  name: string;
  category: PartCategory;
  stock: number;
  minStock: number;
  costPrice: number;
  salePrice: number;
  location: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WorkOrder {
  id: string;
  ownerId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehicleSummary: string;
  plate: string;
  mechanicId: string;
  mechanicName: string;
  bay: string;
  mileageIn: number;
  symptom: string;
  diagnosis: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  promisedDate: string;
  laborTotal: number;
  partsTotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid?: number;
  paymentStatus?: PaymentStatus;
  paymentNotes?: string;
  mechanicCommissionRate?: number;
  mechanicPaid?: number;
  mechanicPaymentStatus?: PaymentStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WorkOrderItem {
  id: string;
  ownerId: string;
  orderId: string;
  type: WorkOrderItemType;
  partId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  subtotal: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Appointment {
  id: string;
  ownerId: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehicleSummary: string;
  plate: string;
  serviceType: string;
  scheduledDate: string;
  scheduledTime: string;
  bay: string;
  notes: string;
  status: AppointmentStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Quote {
  id: string;
  ownerId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleId: string;
  vehicleSummary: string;
  plate: string;
  validUntil: string;
  notes: string;
  status: QuoteStatus;
  convertedOrderId: string;
  laborTotal: number;
  partsTotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid?: number;
  paymentStatus?: PaymentStatus;
  paymentNotes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface QuoteItem {
  id: string;
  ownerId: string;
  quoteId: string;
  type: WorkOrderItemType;
  partId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  subtotal: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const QUOTE_STATUSES: QuoteStatus[] = [
  'Borrador',
  'Enviado',
  'Aprobado',
  'Rechazado',
  'Convertido',
];

export const WORK_ORDER_STAGES: WorkOrderStatus[] = [
  'Recibido',
  'Diagnóstico',
  'En Reparación',
  'Esperando Repuesto',
  'Listo',
  'Entregado',
  'Cancelado',
];

export const ACTIVE_WORK_ORDER_STAGES: WorkOrderStatus[] = [
  'Recibido',
  'Diagnóstico',
  'En Reparación',
  'Esperando Repuesto',
  'Listo',
];

export const PART_CATEGORIES: PartCategory[] = [
  'Filtros',
  'Frenos',
  'Lubricantes',
  'Motor',
  'Suspensión',
  'Eléctrico',
  'Neumáticos',
  'Otros',
];

export const FUEL_TYPES: FuelType[] = [
  'Gasolina',
  'Diésel',
  'Híbrido',
  'Eléctrico',
  'GLP',
];

export const CURRENCIES: CurrencyCode[] = ['USD', 'VES', 'EUR', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];

export function computePaymentSummary(
  totalAmount: number,
  amountPaid?: number
): { paid: number; remaining: number; status: PaymentStatus } {
  const safeTotal = Number.isFinite(totalAmount) && totalAmount > 0 ? Number(totalAmount.toFixed(2)) : 0;
  const safePaid =
    typeof amountPaid === 'number' && Number.isFinite(amountPaid) && amountPaid > 0
      ? Number(amountPaid.toFixed(2))
      : 0;
  const remaining = Math.max(0, Number((safeTotal - safePaid).toFixed(2)));

  let status: PaymentStatus = 'Pendiente';
  if (safePaid > 0 && (safeTotal === 0 || remaining <= 0.005)) {
    status = 'Pagado';
  } else if (safePaid > 0) {
    status = 'Abonado';
  }

  return { paid: safePaid, remaining, status };
}

export function computeMechanicPayout(
  order: Pick<WorkOrder, 'laborTotal' | 'mechanicId' | 'mechanicCommissionRate' | 'mechanicPaid'>,
  mechanics: Mechanic[],
  shopDefaultRate = 35
): {
  rate: number;
  isCustomRate: boolean;
  commissionAmount: number;
  paid: number;
  remaining: number;
  status: PaymentStatus;
} {
  const assignedMechanic = mechanics.find((m) => m.id === order.mechanicId);
  const hasOrderOverride =
    typeof order.mechanicCommissionRate === 'number' &&
    Number.isFinite(order.mechanicCommissionRate);
  const rawRate = hasOrderOverride
    ? (order.mechanicCommissionRate as number)
    : typeof assignedMechanic?.commissionRate === 'number' &&
        Number.isFinite(assignedMechanic.commissionRate)
      ? assignedMechanic.commissionRate
      : shopDefaultRate;
  const rate = Math.min(100, Math.max(0, Number(rawRate.toFixed(2))));
  const safeLabor =
    Number.isFinite(order.laborTotal) && order.laborTotal > 0 ? order.laborTotal : 0;
  const commissionAmount = Number(((safeLabor * rate) / 100).toFixed(2));
  const summary = computePaymentSummary(commissionAmount, order.mechanicPaid);
  return {
    rate,
    isCustomRate: hasOrderOverride,
    commissionAmount,
    paid: summary.paid,
    remaining: summary.remaining,
    status: summary.status,
  };
}

export function formatMoney(amount: number, currency: CurrencyCode = 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (currency === 'VES') {
    return formatVES(safe);
  }
  const localeMap: Record<Exclude<CurrencyCode, 'VES'>, string> = {
    USD: 'en-US',
    EUR: 'es-ES',
    MXN: 'es-MX',
    COP: 'es-CO',
    ARS: 'es-AR',
    CLP: 'es-CL',
    PEN: 'es-PE',
  };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'CLP' || currency === 'COP' ? 0 : 2,
    maximumFractionDigits: currency === 'CLP' || currency === 'COP' ? 0 : 2,
  }).format(safe);
}

export function formatVES(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `Bs. ${new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)}`;
}

export function convertUsdToVes(
  amount: number,
  currency: CurrencyCode,
  bcvRate?: number
): number | null {
  if (currency !== 'USD' || !bcvRate || !Number.isFinite(bcvRate) || bcvRate <= 0) {
    return null;
  }
  const safe = Number.isFinite(amount) ? amount : 0;
  return Number((safe * bcvRate).toFixed(2));
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('es-VE').format(Number.isFinite(val) ? val : 0);
}
