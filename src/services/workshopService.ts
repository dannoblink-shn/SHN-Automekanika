import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  computePaymentSummary,
  type Appointment,
  type AppointmentStatus,
  type CurrencyCode,
  type Customer,
  type FuelType,
  type Mechanic,
  type MechanicStatus,
  type Part,
  type PartCategory,
  type PaymentStatus,
  type Quote,
  type QuoteItem,
  type QuoteStatus,
  type Shop,
  type Vehicle,
  type WorkOrder,
  type WorkOrderItem,
  type WorkOrderItemType,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '../types/workshop';

function sanitizeStr(val: string, maxLen: number): string {
  return (val ?? '').trim().slice(0, maxLen);
}

function clampNum(val: number, min: number, max: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export async function ensureShopExists(uid: string): Promise<Shop> {
  const shopPath = `shops/${uid}`;
  const shopRef = doc(db, 'shops', uid);
  try {
    const snap = await getDoc(shopRef);
    if (snap.exists()) {
      const existingData = snap.data() as Omit<Shop, 'id'>;
      const isLegacyDefaultName =
        existingData.name === 'Taller Axis' || /^Taller\s+\w+$/i.test(existingData.name || '');
      if (isLegacyDefaultName && !('bcvRate' in existingData)) {
        await updateDoc(shopRef, {
          name: 'AutoMekanika SHN',
          currency: 'USD' as CurrencyCode,
          updatedAt: serverTimestamp(),
        });
        const refreshed = await getDoc(shopRef);
        return { id: refreshed.id, ...(refreshed.data() as Omit<Shop, 'id'>) };
      }
      return { id: snap.id, ...existingData };
    }
    const payload = {
      ownerId: uid,
      name: 'AutoMekanika SHN',
      phone: '',
      address: '',
      taxRate: 16,
      currency: 'USD' as CurrencyCode,
      baysCount: 4,
      mechanicCommissionRate: 35,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(shopRef, payload);
    const created = await getDoc(shopRef);
    return { id: created.id, ...(created.data() as Omit<Shop, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, shopPath);
  }
}

export async function updateShopSettings(
  uid: string,
  data: {
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
  }
): Promise<void> {
  const path = `shops/${uid}`;
  try {
    const updatePayload: Record<string, unknown> = {
      name: sanitizeStr(data.name, 100),
      phone: sanitizeStr(data.phone, 30),
      address: sanitizeStr(data.address, 200),
      taxRate: clampNum(data.taxRate, 0, 50),
      currency: data.currency,
      baysCount: Math.round(clampNum(data.baysCount, 1, 50)),
      updatedAt: serverTimestamp(),
    };
    if (
      typeof data.mechanicCommissionRate === 'number' &&
      Number.isFinite(data.mechanicCommissionRate)
    ) {
      updatePayload.mechanicCommissionRate = Number(
        clampNum(data.mechanicCommissionRate, 0, 100).toFixed(2)
      );
    }
    if (typeof data.bcvRate === 'number' && Number.isFinite(data.bcvRate) && data.bcvRate > 0) {
      updatePayload.bcvRate = clampNum(data.bcvRate, 0.01, 1000000);
      updatePayload.bcvUpdatedAt = sanitizeStr(data.bcvUpdatedAt || new Date().toISOString(), 50);
      updatePayload.bcvSource = sanitizeStr(data.bcvSource || 'Manual', 60);
    }
    await updateDoc(doc(db, 'shops', uid), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateShopCommissionRate(uid: string, rate: number): Promise<void> {
  const path = `shops/${uid}`;
  try {
    await updateDoc(doc(db, 'shops', uid), {
      mechanicCommissionRate: Number(clampNum(rate, 0, 100).toFixed(2)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateShopBcvRate(
  uid: string,
  rate: number,
  updatedAt: string,
  source: string
): Promise<void> {
  const path = `shops/${uid}`;
  try {
    await updateDoc(doc(db, 'shops', uid), {
      bcvRate: clampNum(rate, 0.01, 1000000),
      bcvUpdatedAt: sanitizeStr(updatedAt, 50),
      bcvSource: sanitizeStr(source, 60),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Customers ---
export async function createCustomer(
  uid: string,
  data: { name: string; phone: string; email: string; taxId: string; notes: string }
): Promise<string> {
  const id = generateId('cus');
  const path = `shops/${uid}/customers/${id}`;
  try {
    await setDoc(doc(db, 'shops', uid, 'customers', id), {
      ownerId: uid,
      name: sanitizeStr(data.name, 100),
      phone: sanitizeStr(data.phone, 30),
      email: sanitizeStr(data.email, 120),
      taxId: sanitizeStr(data.taxId, 40),
      notes: sanitizeStr(data.notes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCustomer(
  uid: string,
  customerId: string,
  data: { name: string; phone: string; email: string; taxId: string; notes: string }
): Promise<void> {
  const path = `shops/${uid}/customers/${customerId}`;
  try {
    await updateDoc(doc(db, 'shops', uid, 'customers', customerId), {
      name: sanitizeStr(data.name, 100),
      phone: sanitizeStr(data.phone, 30),
      email: sanitizeStr(data.email, 120),
      taxId: sanitizeStr(data.taxId, 40),
      notes: sanitizeStr(data.notes, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomer(uid: string, customerId: string): Promise<void> {
  const path = `shops/${uid}/customers/${customerId}`;
  try {
    await deleteDoc(doc(db, 'shops', uid, 'customers', customerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Vehicles ---
export async function createVehicle(
  uid: string,
  data: {
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
  }
): Promise<string> {
  const id = generateId('veh');
  const path = `shops/${uid}/vehicles/${id}`;
  try {
    await setDoc(doc(db, 'shops', uid, 'vehicles', id), {
      ownerId: uid,
      customerId: data.customerId,
      customerName: sanitizeStr(data.customerName, 100),
      plate: sanitizeStr(data.plate.toUpperCase(), 20),
      make: sanitizeStr(data.make, 50),
      model: sanitizeStr(data.model, 60),
      year: Math.round(clampNum(data.year, 1950, 2035)),
      vin: sanitizeStr(data.vin.toUpperCase(), 30),
      color: sanitizeStr(data.color, 30),
      fuelType: data.fuelType,
      mileage: Math.round(clampNum(data.mileage, 0, 2000000)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateVehicle(
  uid: string,
  vehicleId: string,
  data: {
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
  }
): Promise<void> {
  const path = `shops/${uid}/vehicles/${vehicleId}`;
  try {
    await updateDoc(doc(db, 'shops', uid, 'vehicles', vehicleId), {
      customerId: data.customerId,
      customerName: sanitizeStr(data.customerName, 100),
      plate: sanitizeStr(data.plate.toUpperCase(), 20),
      make: sanitizeStr(data.make, 50),
      model: sanitizeStr(data.model, 60),
      year: Math.round(clampNum(data.year, 1950, 2035)),
      vin: sanitizeStr(data.vin.toUpperCase(), 30),
      color: sanitizeStr(data.color, 30),
      fuelType: data.fuelType,
      mileage: Math.round(clampNum(data.mileage, 0, 2000000)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteVehicle(uid: string, vehicleId: string): Promise<void> {
  const path = `shops/${uid}/vehicles/${vehicleId}`;
  try {
    await deleteDoc(doc(db, 'shops', uid, 'vehicles', vehicleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Mechanics ---
export async function createMechanic(
  uid: string,
  data: {
    name: string;
    specialty: string;
    bay: string;
    phone: string;
    status: MechanicStatus;
    commissionRate?: number;
  }
): Promise<string> {
  const id = generateId('mec');
  const path = `shops/${uid}/mechanics/${id}`;
  const payload: Record<string, unknown> = {
    ownerId: uid,
    name: sanitizeStr(data.name, 80),
    specialty: sanitizeStr(data.specialty, 80),
    bay: sanitizeStr(data.bay, 30),
    phone: sanitizeStr(data.phone, 30),
    status: data.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (typeof data.commissionRate === 'number' && Number.isFinite(data.commissionRate)) {
    payload.commissionRate = Number(clampNum(data.commissionRate, 0, 100).toFixed(2));
  }
  try {
    await setDoc(doc(db, 'shops', uid, 'mechanics', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateMechanic(
  uid: string,
  mechanicId: string,
  data: {
    name: string;
    specialty: string;
    bay: string;
    phone: string;
    status: MechanicStatus;
    commissionRate?: number | null;
  }
): Promise<void> {
  const path = `shops/${uid}/mechanics/${mechanicId}`;
  const payload: Record<string, unknown> = {
    name: sanitizeStr(data.name, 80),
    specialty: sanitizeStr(data.specialty, 80),
    bay: sanitizeStr(data.bay, 30),
    phone: sanitizeStr(data.phone, 30),
    status: data.status,
    updatedAt: serverTimestamp(),
  };
  if (data.commissionRate === null) {
    payload.commissionRate = deleteField();
  } else if (typeof data.commissionRate === 'number' && Number.isFinite(data.commissionRate)) {
    payload.commissionRate = Number(clampNum(data.commissionRate, 0, 100).toFixed(2));
  }
  try {
    await updateDoc(doc(db, 'shops', uid, 'mechanics', mechanicId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateMechanicStatus(
  uid: string,
  mechanicId: string,
  status: MechanicStatus
): Promise<void> {
  const path = `shops/${uid}/mechanics/${mechanicId}`;
  try {
    await updateDoc(doc(db, 'shops', uid, 'mechanics', mechanicId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMechanic(uid: string, mechanicId: string): Promise<void> {
  const path = `shops/${uid}/mechanics/${mechanicId}`;
  try {
    await deleteDoc(doc(db, 'shops', uid, 'mechanics', mechanicId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Parts ---
export async function createPart(
  uid: string,
  data: {
    sku: string;
    name: string;
    category: PartCategory;
    stock: number;
    minStock: number;
    costPrice: number;
    salePrice: number;
    location: string;
  }
): Promise<string> {
  const id = generateId('prt');
  const path = `shops/${uid}/parts/${id}`;
  try {
    await setDoc(doc(db, 'shops', uid, 'parts', id), {
      ownerId: uid,
      sku: sanitizeStr(data.sku.toUpperCase(), 40),
      name: sanitizeStr(data.name, 120),
      category: data.category,
      stock: clampNum(data.stock, 0, 100000),
      minStock: clampNum(data.minStock, 0, 100000),
      costPrice: clampNum(data.costPrice, 0, 1000000),
      salePrice: clampNum(data.salePrice, 0, 1000000),
      location: sanitizeStr(data.location, 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePart(
  uid: string,
  partId: string,
  data: {
    sku: string;
    name: string;
    category: PartCategory;
    stock: number;
    minStock: number;
    costPrice: number;
    salePrice: number;
    location: string;
  }
): Promise<void> {
  const path = `shops/${uid}/parts/${partId}`;
  try {
    await updateDoc(doc(db, 'shops', uid, 'parts', partId), {
      sku: sanitizeStr(data.sku.toUpperCase(), 40),
      name: sanitizeStr(data.name, 120),
      category: data.category,
      stock: clampNum(data.stock, 0, 100000),
      minStock: clampNum(data.minStock, 0, 100000),
      costPrice: clampNum(data.costPrice, 0, 1000000),
      salePrice: clampNum(data.salePrice, 0, 1000000),
      location: sanitizeStr(data.location, 40),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adjustPartStock(uid: string, partId: string, newStock: number): Promise<void> {
  const path = `shops/${uid}/parts/${partId}`;
  try {
    await updateDoc(doc(db, 'shops', uid, 'parts', partId), {
      stock: clampNum(newStock, 0, 100000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePart(uid: string, partId: string): Promise<void> {
  const path = `shops/${uid}/parts/${partId}`;
  try {
    await deleteDoc(doc(db, 'shops', uid, 'parts', partId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Work Orders ---
export async function createWorkOrder(
  uid: string,
  data: {
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
  }
): Promise<string> {
  const id = generateId('wo');
  const path = `shops/${uid}/workOrders/${id}`;
  try {
    await setDoc(doc(db, 'shops', uid, 'workOrders', id), {
      ownerId: uid,
      orderNumber: sanitizeStr(data.orderNumber, 30),
      customerId: data.customerId,
      customerName: sanitizeStr(data.customerName, 100),
      vehicleId: data.vehicleId,
      vehicleSummary: sanitizeStr(data.vehicleSummary, 120),
      plate: sanitizeStr(data.plate.toUpperCase(), 20),
      mechanicId: data.mechanicId,
      mechanicName: sanitizeStr(data.mechanicName, 80),
      bay: sanitizeStr(data.bay, 30),
      mileageIn: Math.round(clampNum(data.mileageIn, 0, 2000000)),
      symptom: sanitizeStr(data.symptom, 500),
      diagnosis: sanitizeStr(data.diagnosis, 800),
      priority: data.priority,
      status: data.status,
      promisedDate: sanitizeStr(data.promisedDate, 30),
      laborTotal: 0,
      partsTotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      amountPaid: 0,
      paymentStatus: 'Pendiente' as PaymentStatus,
      paymentNotes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWorkOrderPayment(
  uid: string,
  orderId: string,
  totalAmount: number,
  amountPaid: number,
  paymentNotes = ''
): Promise<void> {
  const path = `shops/${uid}/workOrders/${orderId}`;
  const cleanPaid = clampNum(amountPaid, 0, 10000000);
  const { status } = computePaymentSummary(totalAmount, cleanPaid);
  try {
    await updateDoc(doc(db, 'shops', uid, 'workOrders', orderId), {
      amountPaid: Number(cleanPaid.toFixed(2)),
      paymentStatus: status,
      paymentNotes: sanitizeStr(paymentNotes, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWorkOrderMechanicPayout(
  uid: string,
  orderId: string,
  laborTotal: number,
  commissionRate: number,
  mechanicPaid: number
): Promise<void> {
  const path = `shops/${uid}/workOrders/${orderId}`;
  const cleanRate = Number(clampNum(commissionRate, 0, 100).toFixed(2));
  const cleanPaid = Number(clampNum(mechanicPaid, 0, 10000000).toFixed(2));
  const safeLabor = Number.isFinite(laborTotal) && laborTotal > 0 ? laborTotal : 0;
  const commissionAmount = Number(((safeLabor * cleanRate) / 100).toFixed(2));
  const { status } = computePaymentSummary(commissionAmount, cleanPaid);

  try {
    await updateDoc(doc(db, 'shops', uid, 'workOrders', orderId), {
      mechanicCommissionRate: cleanRate,
      mechanicPaid: cleanPaid,
      mechanicPaymentStatus: status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function resetWorkOrderMechanicCommissionRate(
  uid: string,
  orderId: string,
  laborTotal: number,
  fallbackRate: number,
  mechanicPaid: number
): Promise<void> {
  const path = `shops/${uid}/workOrders/${orderId}`;
  const cleanPaid = Number(clampNum(mechanicPaid, 0, 10000000).toFixed(2));
  const safeLabor = Number.isFinite(laborTotal) && laborTotal > 0 ? laborTotal : 0;
  const commissionAmount = Number(((safeLabor * fallbackRate) / 100).toFixed(2));
  const { status } = computePaymentSummary(commissionAmount, cleanPaid);

  try {
    await updateDoc(doc(db, 'shops', uid, 'workOrders', orderId), {
      mechanicCommissionRate: deleteField(),
      mechanicPaid: cleanPaid,
      mechanicPaymentStatus: status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWorkOrderStatus(
  uid: string,
  orderId: string,
  status: WorkOrderStatus
): Promise<void> {
  const path = `shops/${uid}/workOrders/${orderId}`;
  try {
    await updateDoc(doc(db, 'shops', uid, 'workOrders', orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWorkOrderDetails(
  uid: string,
  orderId: string,
  data: {
    mechanicId: string;
    mechanicName: string;
    bay: string;
    diagnosis: string;
    priority: WorkOrderPriority;
    promisedDate: string;
    mileageIn: number;
    symptom: string;
    status: WorkOrderStatus;
  }
): Promise<void> {
  const path = `shops/${uid}/workOrders/${orderId}`;
  try {
    await updateDoc(doc(db, 'shops', uid, 'workOrders', orderId), {
      mechanicId: data.mechanicId,
      mechanicName: sanitizeStr(data.mechanicName, 80),
      bay: sanitizeStr(data.bay, 30),
      diagnosis: sanitizeStr(data.diagnosis, 800),
      priority: data.priority,
      promisedDate: sanitizeStr(data.promisedDate, 30),
      mileageIn: Math.round(clampNum(data.mileageIn, 0, 2000000)),
      symptom: sanitizeStr(data.symptom, 500),
      status: data.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWorkOrder(uid: string, orderId: string): Promise<void> {
  const path = `shops/${uid}/workOrders/${orderId}`;
  try {
    await deleteDoc(doc(db, 'shops', uid, 'workOrders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Work Order Items + Totals Sync ---
function computeTotals(items: Array<{ type: WorkOrderItemType; subtotal: number }>, taxRate: number) {
  let laborTotal = 0;
  let partsTotal = 0;
  for (const item of items) {
    if (item.type === 'Mano de Obra') laborTotal += item.subtotal;
    else partsTotal += item.subtotal;
  }
  const subtotal = laborTotal + partsTotal;
  const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));
  return {
    laborTotal: Number(laborTotal.toFixed(2)),
    partsTotal: Number(partsTotal.toFixed(2)),
    taxAmount,
    totalAmount,
  };
}

export async function addWorkOrderItem(
  uid: string,
  orderId: string,
  existingItems: WorkOrderItem[],
  taxRate: number,
  newItem: {
    type: WorkOrderItemType;
    partId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number;
  },
  partCurrentStock?: number,
  currentAmountPaid?: number
): Promise<void> {
  const itemId = generateId('itm');
  const itemPath = `shops/${uid}/workOrders/${orderId}/items/${itemId}`;
  const quantity = clampNum(newItem.quantity, 0.01, 10000);
  const unitPrice = clampNum(newItem.unitPrice, 0, 1000000);
  const costPrice = clampNum(newItem.costPrice ?? 0, 0, 1000000);
  const subtotal = Number((quantity * unitPrice).toFixed(2));

  const totals = computeTotals(
    [...existingItems, { type: newItem.type, subtotal }],
    taxRate
  );

  const orderUpdate: Record<string, unknown> = {
    ...totals,
    updatedAt: serverTimestamp(),
  };
  if (typeof currentAmountPaid === 'number' && Number.isFinite(currentAmountPaid)) {
    orderUpdate.paymentStatus = computePaymentSummary(totals.totalAmount, currentAmountPaid).status;
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'shops', uid, 'workOrders', orderId, 'items', itemId), {
      ownerId: uid,
      orderId,
      type: newItem.type,
      partId: newItem.partId,
      description: sanitizeStr(newItem.description, 150),
      quantity,
      unitPrice,
      costPrice,
      subtotal,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'shops', uid, 'workOrders', orderId), orderUpdate);
    if (newItem.type === 'Repuesto' && newItem.partId && typeof partCurrentStock === 'number') {
      batch.update(doc(db, 'shops', uid, 'parts', newItem.partId), {
        stock: clampNum(partCurrentStock - quantity, 0, 100000),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, itemPath);
  }
}

export async function removeWorkOrderItem(
  uid: string,
  orderId: string,
  itemToRemove: WorkOrderItem,
  allItems: WorkOrderItem[],
  taxRate: number,
  currentAmountPaid?: number
): Promise<void> {
  const itemPath = `shops/${uid}/workOrders/${orderId}/items/${itemToRemove.id}`;
  const remaining = allItems.filter((i) => i.id !== itemToRemove.id);
  const totals = computeTotals(remaining, taxRate);

  const orderUpdate: Record<string, unknown> = {
    ...totals,
    updatedAt: serverTimestamp(),
  };
  if (typeof currentAmountPaid === 'number' && Number.isFinite(currentAmountPaid)) {
    orderUpdate.paymentStatus = computePaymentSummary(totals.totalAmount, currentAmountPaid).status;
  }

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'shops', uid, 'workOrders', orderId, 'items', itemToRemove.id));
    batch.update(doc(db, 'shops', uid, 'workOrders', orderId), orderUpdate);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, itemPath);
  }
}

// --- Appointments ---
export async function createAppointment(
  uid: string,
  data: {
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
  }
): Promise<string> {
  const id = generateId('apt');
  const path = `shops/${uid}/appointments/${id}`;
  try {
    await setDoc(doc(db, 'shops', uid, 'appointments', id), {
      ownerId: uid,
      customerId: data.customerId,
      customerName: sanitizeStr(data.customerName, 100),
      vehicleId: data.vehicleId,
      vehicleSummary: sanitizeStr(data.vehicleSummary, 120),
      plate: sanitizeStr(data.plate.toUpperCase(), 20),
      serviceType: sanitizeStr(data.serviceType, 120),
      scheduledDate: sanitizeStr(data.scheduledDate, 20),
      scheduledTime: sanitizeStr(data.scheduledTime, 10),
      bay: sanitizeStr(data.bay, 30),
      notes: sanitizeStr(data.notes, 400),
      status: data.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAppointmentStatus(
  uid: string,
  appointmentId: string,
  status: AppointmentStatus
): Promise<void> {
  const path = `shops/${uid}/appointments/${appointmentId}`;
  try {
    await updateDoc(doc(db, 'shops', uid, 'appointments', appointmentId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAppointment(uid: string, appointmentId: string): Promise<void> {
  const path = `shops/${uid}/appointments/${appointmentId}`;
  try {
    await deleteDoc(doc(db, 'shops', uid, 'appointments', appointmentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function convertAppointmentToWorkOrder(
  uid: string,
  appointment: Appointment,
  vehicle: Vehicle | undefined,
  orderNumber: string
): Promise<string> {
  const orderId = generateId('wo');
  const path = `shops/${uid}/workOrders/${orderId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'shops', uid, 'workOrders', orderId), {
      ownerId: uid,
      orderNumber: sanitizeStr(orderNumber, 30),
      customerId: appointment.customerId,
      customerName: appointment.customerName,
      vehicleId: appointment.vehicleId,
      vehicleSummary: appointment.vehicleSummary,
      plate: appointment.plate,
      mechanicId: '',
      mechanicName: 'Sin asignar',
      bay: appointment.bay || 'Bahía 1',
      mileageIn: vehicle?.mileage ?? 0,
      symptom: sanitizeStr(
        appointment.notes
          ? `${appointment.serviceType}: ${appointment.notes}`
          : appointment.serviceType,
        500
      ),
      diagnosis: '',
      priority: 'Normal' as WorkOrderPriority,
      status: 'Recibido' as WorkOrderStatus,
      promisedDate: appointment.scheduledDate,
      laborTotal: 0,
      partsTotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      amountPaid: 0,
      paymentStatus: 'Pendiente' as PaymentStatus,
      paymentNotes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'shops', uid, 'appointments', appointment.id), {
      status: 'En Taller' as AppointmentStatus,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getWorkOrderItemsOnce(uid: string, orderId: string): Promise<WorkOrderItem[]> {
  const path = `shops/${uid}/workOrders/${orderId}/items`;
  try {
    const snap = await getDocs(
      query(collection(db, 'shops', uid, 'workOrders', orderId, 'items'), where('ownerId', '==', uid))
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<WorkOrderItem, 'id'>) }))
      .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// --- Quotes (Presupuestos) ---
export interface QuoteDraftItem {
  id?: string;
  type: WorkOrderItemType;
  partId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
}

export async function getQuoteItemsOnce(uid: string, quoteId: string): Promise<QuoteItem[]> {
  const path = `shops/${uid}/quotes/${quoteId}/items`;
  try {
    const snap = await getDocs(
      query(collection(db, 'shops', uid, 'quotes', quoteId, 'items'), where('ownerId', '==', uid))
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<QuoteItem, 'id'>) }))
      .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveQuoteWithItems(
  uid: string,
  taxRate: number,
  data: {
    id?: string;
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
    amountPaid?: number;
    paymentNotes?: string;
  },
  items: QuoteDraftItem[],
  previousItemIds: string[] = []
): Promise<string> {
  const quoteId = data.id || generateId('quo');
  const path = `shops/${uid}/quotes/${quoteId}`;

  const preparedItems = items.map((item) => {
    const quantity = clampNum(item.quantity, 0.01, 10000);
    const unitPrice = clampNum(item.unitPrice, 0, 1000000);
    const costPrice = clampNum(item.costPrice ?? 0, 0, 1000000);
    const subtotal = Number((quantity * unitPrice).toFixed(2));
    return {
      ...item,
      quantity,
      unitPrice,
      costPrice,
      subtotal,
      description: sanitizeStr(item.description, 150),
    };
  });

  const totals = computeTotals(preparedItems, taxRate);
  const amountPaid = Number(clampNum(data.amountPaid ?? 0, 0, 10000000).toFixed(2));
  const paymentStatus = computePaymentSummary(totals.totalAmount, amountPaid).status;
  const paymentNotes = sanitizeStr(data.paymentNotes ?? '', 200);

  try {
    const batch = writeBatch(db);
    const quoteRef = doc(db, 'shops', uid, 'quotes', quoteId);

    if (data.id) {
      batch.update(quoteRef, {
        customerId: data.customerId,
        customerName: sanitizeStr(data.customerName, 100),
        customerPhone: sanitizeStr(data.customerPhone, 30),
        vehicleId: data.vehicleId,
        vehicleSummary: sanitizeStr(data.vehicleSummary, 120),
        plate: sanitizeStr(data.plate.toUpperCase(), 20),
        validUntil: sanitizeStr(data.validUntil, 30),
        notes: sanitizeStr(data.notes, 800),
        status: data.status,
        ...totals,
        amountPaid,
        paymentStatus,
        paymentNotes,
        updatedAt: serverTimestamp(),
      });
      for (const oldId of previousItemIds) {
        batch.delete(doc(db, 'shops', uid, 'quotes', quoteId, 'items', oldId));
      }
    } else {
      batch.set(quoteRef, {
        ownerId: uid,
        quoteNumber: sanitizeStr(data.quoteNumber, 30),
        customerId: data.customerId,
        customerName: sanitizeStr(data.customerName, 100),
        customerPhone: sanitizeStr(data.customerPhone, 30),
        vehicleId: data.vehicleId,
        vehicleSummary: sanitizeStr(data.vehicleSummary, 120),
        plate: sanitizeStr(data.plate.toUpperCase(), 20),
        validUntil: sanitizeStr(data.validUntil, 30),
        notes: sanitizeStr(data.notes, 800),
        status: data.status,
        convertedOrderId: '',
        ...totals,
        amountPaid,
        paymentStatus,
        paymentNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const item of preparedItems) {
      const itemId = generateId('qit');
      batch.set(doc(db, 'shops', uid, 'quotes', quoteId, 'items', itemId), {
        ownerId: uid,
        quoteId,
        type: item.type,
        partId: item.partId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        subtotal: item.subtotal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return quoteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateQuotePayment(
  uid: string,
  quoteId: string,
  totalAmount: number,
  amountPaid: number,
  paymentNotes = ''
): Promise<void> {
  const path = `shops/${uid}/quotes/${quoteId}`;
  const cleanPaid = clampNum(amountPaid, 0, 10000000);
  const { status } = computePaymentSummary(totalAmount, cleanPaid);
  try {
    await updateDoc(doc(db, 'shops', uid, 'quotes', quoteId), {
      amountPaid: Number(cleanPaid.toFixed(2)),
      paymentStatus: status,
      paymentNotes: sanitizeStr(paymentNotes, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateQuoteStatus(
  uid: string,
  quoteId: string,
  status: QuoteStatus
): Promise<void> {
  const path = `shops/${uid}/quotes/${quoteId}`;
  try {
    await updateDoc(doc(db, 'shops', uid, 'quotes', quoteId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteQuote(uid: string, quoteId: string): Promise<void> {
  const path = `shops/${uid}/quotes/${quoteId}`;
  try {
    const items = await getQuoteItemsOnce(uid, quoteId);
    const batch = writeBatch(db);
    for (const item of items) {
      batch.delete(doc(db, 'shops', uid, 'quotes', quoteId, 'items', item.id));
    }
    batch.delete(doc(db, 'shops', uid, 'quotes', quoteId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function convertQuoteToWorkOrder(
  uid: string,
  quote: Quote,
  quoteItems: QuoteItem[],
  orderNumber: string
): Promise<string> {
  const orderId = generateId('wo');
  const path = `shops/${uid}/workOrders/${orderId}`;
  try {
    const batch = writeBatch(db);

    let customerId = quote.customerId;
    if (!customerId) {
      customerId = generateId('cus');
      const cleanPhone = sanitizeStr(quote.customerPhone, 30);
      batch.set(doc(db, 'shops', uid, 'customers', customerId), {
        ownerId: uid,
        name: sanitizeStr(quote.customerName, 100),
        phone: cleanPhone.length >= 5 ? cleanPhone : '0000000000',
        email: '',
        taxId: '',
        notes: `Registrado automáticamente desde presupuesto ${quote.quoteNumber}.`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    let vehicleId = quote.vehicleId;
    if (!vehicleId) {
      vehicleId = generateId('veh');
      const partsSummary = quote.vehicleSummary.trim().split(' ');
      const maybeYear = parseInt(partsSummary[0] ?? '', 10);
      const year = Number.isFinite(maybeYear) && maybeYear >= 1950 && maybeYear <= 2035 ? maybeYear : new Date().getFullYear();
      const make = partsSummary.length > 1 && Number.isFinite(maybeYear) ? partsSummary[1] : partsSummary[0] || 'Vehículo';
      const model = partsSummary.slice(Number.isFinite(maybeYear) ? 2 : 1).join(' ') || 'General';
      batch.set(doc(db, 'shops', uid, 'vehicles', vehicleId), {
        ownerId: uid,
        customerId,
        customerName: sanitizeStr(quote.customerName, 100),
        plate: sanitizeStr((quote.plate || 'SIN-PLACA').toUpperCase(), 20),
        make: sanitizeStr(make, 50),
        model: sanitizeStr(model, 60),
        year,
        vin: '',
        color: '',
        fuelType: 'Gasolina' as FuelType,
        mileage: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'shops', uid, 'workOrders', orderId), {
      ownerId: uid,
      orderNumber: sanitizeStr(orderNumber, 30),
      customerId,
      customerName: sanitizeStr(quote.customerName, 100),
      vehicleId,
      vehicleSummary: sanitizeStr(quote.vehicleSummary, 120),
      plate: sanitizeStr((quote.plate || 'SIN-PLACA').toUpperCase(), 20),
      mechanicId: '',
      mechanicName: 'Sin asignar',
      bay: 'Bahía 1',
      mileageIn: 0,
      symptom: sanitizeStr(
        quote.notes ? `Presupuesto ${quote.quoteNumber}: ${quote.notes}` : `Orden generada desde presupuesto ${quote.quoteNumber}`,
        500
      ),
      diagnosis: '',
      priority: 'Normal' as WorkOrderPriority,
      status: 'Recibido' as WorkOrderStatus,
      promisedDate: quote.validUntil || new Date().toISOString().slice(0, 10),
      laborTotal: quote.laborTotal,
      partsTotal: quote.partsTotal,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      amountPaid: clampNum(quote.amountPaid ?? 0, 0, 10000000),
      paymentStatus: computePaymentSummary(quote.totalAmount, quote.amountPaid).status,
      paymentNotes: sanitizeStr(quote.paymentNotes ?? '', 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const item of quoteItems) {
      const woItemId = generateId('itm');
      batch.set(doc(db, 'shops', uid, 'workOrders', orderId, 'items', woItemId), {
        ownerId: uid,
        orderId,
        type: item.type,
        partId: item.partId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: clampNum(item.costPrice ?? 0, 0, 1000000),
        subtotal: item.subtotal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.update(doc(db, 'shops', uid, 'quotes', quote.id), {
      status: 'Convertido' as QuoteStatus,
      convertedOrderId: orderId,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Demo Data Seeder ---
export async function seedDemoWorkshopData(uid: string, taxRate: number): Promise<void> {
  const path = `shops/${uid}`;
  const today = new Date();
  const fmtDate = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  try {
    const batch = writeBatch(db);

    // Customers
    const c1 = 'cus_demo_1';
    const c2 = 'cus_demo_2';
    const c3 = 'cus_demo_3';
    const customers: Array<{ id: string; data: Omit<Customer, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> }> = [
      {
        id: c1,
        data: {
          name: 'Alejandro Mendoza',
          phone: '+52 55 4189 2210',
          email: 'a.mendoza@correo.mx',
          taxId: 'MEAL840312H10',
          notes: 'Prefiere confirmación de presupuesto por teléfono antes de cambiar piezas.',
        },
      },
      {
        id: c2,
        data: {
          name: 'Logística Norte S.A.',
          phone: '+52 55 8820 4401',
          email: 'flota@logisticanorte.mx',
          taxId: 'LNO190522TR4',
          notes: 'Cuenta de flotilla comercial. Facturación mensual consolidada.',
        },
      },
      {
        id: c3,
        data: {
          name: 'Sofía Herrera',
          phone: '+52 55 3011 7742',
          email: 'sofia.herrera@correo.mx',
          taxId: '',
          notes: 'Cliente frecuente desde 2024.',
        },
      },
    ];
    for (const c of customers) {
      batch.set(doc(db, 'shops', uid, 'customers', c.id), {
        ownerId: uid,
        ...c.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Vehicles
    const v1 = 'veh_demo_1';
    const v2 = 'veh_demo_2';
    const v3 = 'veh_demo_3';
    const v4 = 'veh_demo_4';
    const vehicles: Array<{ id: string; data: Omit<Vehicle, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> }> = [
      {
        id: v1,
        data: {
          customerId: c1,
          customerName: 'Alejandro Mendoza',
          plate: 'PJK-482-A',
          make: 'Mazda',
          model: 'CX-5 Touring',
          year: 2022,
          vin: 'JM3KFBCM8N0123456',
          color: 'Gris Titanio',
          fuelType: 'Gasolina',
          mileage: 48200,
        },
      },
      {
        id: v2,
        data: {
          customerId: c2,
          customerName: 'Logística Norte S.A.',
          plate: 'LF-9012-B',
          make: 'Volkswagen',
          model: 'Crafter Cargo',
          year: 2021,
          vin: 'WV1ZZZSYZM9045120',
          color: 'Blanco',
          fuelType: 'Diésel',
          mileage: 112450,
        },
      },
      {
        id: v3,
        data: {
          customerId: c3,
          customerName: 'Sofía Herrera',
          plate: 'NRM-731-C',
          make: 'Toyota',
          model: 'Corolla Hybrid',
          year: 2023,
          vin: 'JTDBR32E409871234',
          color: 'Plata',
          fuelType: 'Híbrido',
          mileage: 26800,
        },
      },
      {
        id: v4,
        data: {
          customerId: c2,
          customerName: 'Logística Norte S.A.',
          plate: 'LF-9045-B',
          make: 'Ford',
          model: 'Transit Van',
          year: 2020,
          vin: 'WF0EXXTTRELS10293',
          color: 'Blanco',
          fuelType: 'Diésel',
          mileage: 145300,
        },
      },
    ];
    for (const v of vehicles) {
      batch.set(doc(db, 'shops', uid, 'vehicles', v.id), {
        ownerId: uid,
        ...v.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Mechanics
    const m1 = 'mec_demo_1';
    const m2 = 'mec_demo_2';
    const m3 = 'mec_demo_3';
    const mechanics: Array<{ id: string; data: Omit<Mechanic, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> }> = [
      {
        id: m1,
        data: {
          name: 'Roberto Salazar',
          specialty: 'Motor y Diagnóstico OBD-II',
          bay: 'Bahía 1',
          phone: '55-1204-8811',
          status: 'En Servicio',
        },
      },
      {
        id: m2,
        data: {
          name: 'Diego Morales',
          specialty: 'Frenos, Suspensión y Dirección',
          bay: 'Bahía 2',
          phone: '55-9941-2034',
          status: 'En Servicio',
        },
      },
      {
        id: m3,
        data: {
          name: 'Elena Ríos',
          specialty: 'Electricidad y Sistemas Híbridos',
          bay: 'Bahía 3',
          phone: '55-7740-1192',
          status: 'Disponible',
        },
      },
    ];
    for (const m of mechanics) {
      batch.set(doc(db, 'shops', uid, 'mechanics', m.id), {
        ownerId: uid,
        ...m.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Parts
    const p1 = 'prt_demo_1';
    const p2 = 'prt_demo_2';
    const p3 = 'prt_demo_3';
    const p4 = 'prt_demo_4';
    const p5 = 'prt_demo_5';
    const parts: Array<{ id: string; data: Omit<Part, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> }> = [
      {
        id: p1,
        data: {
          sku: 'ACE-5W30-5L',
          name: 'Aceite Sintético 5W-30 (Garrafa 5L)',
          category: 'Lubricantes',
          stock: 14,
          minStock: 6,
          costPrice: 520,
          salePrice: 890,
          location: 'Estante A-1',
        },
      },
      {
        id: p2,
        data: {
          sku: 'BRK-CER-MZD',
          name: 'Juego Pastillas Cerámicas Delanteras',
          category: 'Frenos',
          stock: 2,
          minStock: 4,
          costPrice: 780,
          salePrice: 1350,
          location: 'Estante B-3',
        },
      },
      {
        id: p3,
        data: {
          sku: 'FLT-AIR-VWC',
          name: 'Filtro de Aire Heavy Duty Diésel',
          category: 'Filtros',
          stock: 1,
          minStock: 3,
          costPrice: 310,
          salePrice: 560,
          location: 'Estante A-4',
        },
      },
      {
        id: p4,
        data: {
          sku: 'FLT-OIL-TOY',
          name: 'Filtro de Aceite OEM Toyota / Mazda',
          category: 'Filtros',
          stock: 18,
          minStock: 5,
          costPrice: 115,
          salePrice: 240,
          location: 'Estante A-2',
        },
      },
      {
        id: p5,
        data: {
          sku: 'SUS-AM-TRN',
          name: 'Amortiguador Delantero Reforzado',
          category: 'Suspensión',
          stock: 0,
          minStock: 2,
          costPrice: 1450,
          salePrice: 2390,
          location: 'Estante C-1',
        },
      },
    ];
    for (const p of parts) {
      batch.set(doc(db, 'shops', uid, 'parts', p.id), {
        ownerId: uid,
        ...p.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Work Orders + Items
    const wo1 = 'wo_demo_1';
    const wo2 = 'wo_demo_2';
    const wo3 = 'wo_demo_3';
    const wo4 = 'wo_demo_4';

    const calc = (labor: number, partsCost: number) => {
      const tax = Number((((labor + partsCost) * taxRate) / 100).toFixed(2));
      return {
        laborTotal: labor,
        partsTotal: partsCost,
        taxAmount: tax,
        totalAmount: Number((labor + partsCost + tax).toFixed(2)),
      };
    };

    const wo1Totals = calc(950, 1350);
    batch.set(doc(db, 'shops', uid, 'workOrders', wo1), {
      ownerId: uid,
      orderNumber: 'OT-1041',
      customerId: c1,
      customerName: 'Alejandro Mendoza',
      vehicleId: v1,
      vehicleSummary: '2022 Mazda CX-5 Touring',
      plate: 'PJK-482-A',
      mechanicId: m2,
      mechanicName: 'Diego Morales',
      bay: 'Bahía 2',
      mileageIn: 48200,
      symptom: 'Rechinido en frenos delanteros al frenar a baja velocidad y vibración leve en volante.',
      diagnosis: 'Pastillas delanteras con 15% de vida útil y discos con cristalización superficial. Requiere rectificado y cambio de balatas.',
      priority: 'Normal',
      status: 'En Reparación',
      promisedDate: fmtDate(0),
      ...wo1Totals,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'shops', uid, 'workOrders', wo1, 'items', 'itm_demo_1'), {
      ownerId: uid,
      orderId: wo1,
      type: 'Mano de Obra',
      partId: '',
      description: 'Cambio de balatas delanteras y rectificado de discos',
      quantity: 1,
      unitPrice: 950,
      subtotal: 950,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'shops', uid, 'workOrders', wo1, 'items', 'itm_demo_2'), {
      ownerId: uid,
      orderId: wo1,
      type: 'Repuesto',
      partId: p2,
      description: 'Juego Pastillas Cerámicas Delanteras',
      quantity: 1,
      unitPrice: 1350,
      subtotal: 1350,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const wo2Totals = calc(650, 0);
    batch.set(doc(db, 'shops', uid, 'workOrders', wo2), {
      ownerId: uid,
      orderNumber: 'OT-1042',
      customerId: c2,
      customerName: 'Logística Norte S.A.',
      vehicleId: v2,
      vehicleSummary: '2021 Volkswagen Crafter Cargo',
      plate: 'LF-9012-B',
      mechanicId: m1,
      mechanicName: 'Roberto Salazar',
      bay: 'Bahía 1',
      mileageIn: 112450,
      symptom: 'Testigo Check Engine encendido y pérdida de potencia en subida.',
      diagnosis: 'Código P0299 detectado en escáner. Revisando manguera de intercooler y válvula EGR.',
      priority: 'Urgente',
      status: 'Diagnóstico',
      promisedDate: fmtDate(1),
      ...wo2Totals,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'shops', uid, 'workOrders', wo2, 'items', 'itm_demo_3'), {
      ownerId: uid,
      orderId: wo2,
      type: 'Mano de Obra',
      partId: '',
      description: 'Diagnóstico computarizado OBD-II y prueba de presión turbo',
      quantity: 1,
      unitPrice: 650,
      subtotal: 650,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const wo3Totals = calc(850, 1130);
    batch.set(doc(db, 'shops', uid, 'workOrders', wo3), {
      ownerId: uid,
      orderNumber: 'OT-1040',
      customerId: c3,
      customerName: 'Sofía Herrera',
      vehicleId: v3,
      vehicleSummary: '2023 Toyota Corolla Hybrid',
      plate: 'NRM-731-C',
      mechanicId: m3,
      mechanicName: 'Elena Ríos',
      bay: 'Bahía 3',
      mileageIn: 26800,
      symptom: 'Servicio preventivo de 25,000 km e inspección de sistema híbrido.',
      diagnosis: 'Batería híbrida y sistema de enfriamiento inversor dentro de parámetros nominales. Aceite y filtro reemplazados.',
      priority: 'Normal',
      status: 'Listo',
      promisedDate: fmtDate(0),
      ...wo3Totals,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'shops', uid, 'workOrders', wo3, 'items', 'itm_demo_4'), {
      ownerId: uid,
      orderId: wo3,
      type: 'Mano de Obra',
      partId: '',
      description: 'Servicio mayor 25,000 km + inspección híbrida',
      quantity: 1,
      unitPrice: 850,
      subtotal: 850,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'shops', uid, 'workOrders', wo3, 'items', 'itm_demo_5'), {
      ownerId: uid,
      orderId: wo3,
      type: 'Repuesto',
      partId: p1,
      description: 'Aceite Sintético 5W-30 (Garrafa 5L)',
      quantity: 1,
      unitPrice: 890,
      subtotal: 890,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'shops', uid, 'workOrders', wo3, 'items', 'itm_demo_6'), {
      ownerId: uid,
      orderId: wo3,
      type: 'Repuesto',
      partId: p4,
      description: 'Filtro de Aceite OEM Toyota / Mazda',
      quantity: 1,
      unitPrice: 240,
      subtotal: 240,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const wo4Totals = calc(1200, 1450);
    batch.set(doc(db, 'shops', uid, 'workOrders', wo4), {
      ownerId: uid,
      orderNumber: 'OT-1039',
      customerId: c2,
      customerName: 'Logística Norte S.A.',
      vehicleId: v4,
      vehicleSummary: '2020 Ford Transit Van',
      plate: 'LF-9045-B',
      mechanicId: m2,
      mechanicName: 'Diego Morales',
      bay: 'Bahía 4',
      mileageIn: 145300,
      symptom: 'Alineación, balanceo y revisión de suspensión trasera.',
      diagnosis: 'Alineación completada y reemplazo de bujes traseros.',
      priority: 'Normal',
      status: 'Entregado',
      promisedDate: fmtDate(-1),
      ...wo4Totals,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Appointments
    batch.set(doc(db, 'shops', uid, 'appointments', 'apt_demo_1'), {
      ownerId: uid,
      customerId: c1,
      customerName: 'Alejandro Mendoza',
      vehicleId: v1,
      vehicleSummary: '2022 Mazda CX-5 Touring',
      plate: 'PJK-482-A',
      serviceType: 'Alineación y Balanceo',
      scheduledDate: fmtDate(1),
      scheduledTime: '09:30',
      bay: 'Bahía 2',
      notes: 'Cliente solicita entrega antes de las 14:00 hrs.',
      status: 'Confirmada',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'shops', uid, 'appointments', 'apt_demo_2'), {
      ownerId: uid,
      customerId: c2,
      customerName: 'Logística Norte S.A.',
      vehicleId: v4,
      vehicleSummary: '2020 Ford Transit Van',
      plate: 'LF-9045-B',
      serviceType: 'Cambio de Amortiguadores',
      scheduledDate: fmtDate(2),
      scheduledTime: '11:00',
      bay: 'Bahía 4',
      notes: 'Confirmar llegada de amortiguador reforzado en inventario.',
      status: 'Programada',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
