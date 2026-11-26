import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Banknote,
  FileDown,
  Plus,
  Printer,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { generateWorkOrderPdfReport } from '../services/pdfReportService';
import {
  addWorkOrderItem,
  deleteWorkOrder,
  getWorkOrderItemsOnce,
  removeWorkOrderItem,
  updateWorkOrderDetails,
  updateWorkOrderPayment,
} from '../services/workshopService';
import {
  computePaymentSummary,
  convertUsdToVes,
  formatMoney,
  formatNumber,
  formatVES,
  WORK_ORDER_STAGES,
  type Customer,
  type Mechanic,
  type Part,
  type Shop,
  type Vehicle,
  type WorkOrder,
  type WorkOrderItem,
  type WorkOrderItemType,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '../types/workshop';
import { PaymentModal } from './PaymentModal';
import { SHOP_LOGO_PATH } from './BrandLogo';
import { PaymentStatusText, PriorityText, WorkOrderStatusText } from './StatusIndicator';

interface WorkOrdersViewProps {
  uid: string;
  shop: Shop;
  orders: WorkOrder[];
  customers: Customer[];
  vehicles: Vehicle[];
  mechanics: Mechanic[];
  parts: Part[];
  initialFilter?: WorkOrderStatus | 'Todas';
  selectedOrder: WorkOrder | null;
  onSelectOrder: (order: WorkOrder | null) => void;
  onOpenNewOrder: () => void;
}

export function WorkOrdersView({
  uid,
  shop,
  orders,
  customers,
  vehicles,
  mechanics,
  parts,
  initialFilter = 'Todas',
  selectedOrder,
  onSelectOrder,
  onOpenNewOrder,
}: WorkOrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'Todas'>(initialFilter);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<WorkOrder | null>(null);

  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'Todas' && order.status !== statusFilter) return false;
      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        order.plate.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.vehicleSummary.toLowerCase().includes(q) ||
        order.mechanicName.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, searchTerm]);

  const liveSelectedOrder = useMemo(() => {
    if (!selectedOrder) return null;
    return orders.find((o) => o.id === selectedOrder.id) ?? selectedOrder;
  }, [orders, selectedOrder]);

  const handleExportRowPdf = async (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    setDownloadingId(order.id);
    try {
      const items = await getWorkOrderItemsOnce(uid, order.id);
      const customer = customers.find((c) => c.id === order.customerId);
      const vehicle = vehicles.find((v) => v.id === order.vehicleId);
      await generateWorkOrderPdfReport({ shop, order, customer, vehicle, items });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter & Search Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#141821] border border-zinc-800 rounded-lg overflow-x-auto">
          {(['Todas', ...WORK_ORDER_STAGES] as const).map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setStatusFilter(stage)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === stage
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {stage}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar OT, placa, cliente..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-[#141821] border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
            <h3 className="font-display text-sm font-semibold text-zinc-100">
              {orders.length === 0 ? 'Aún no hay órdenes de trabajo' : 'Sin coincidencias para este filtro'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              {orders.length === 0
                ? 'Registra la primera orden de servicio cuando ingrese un vehículo al taller.'
                : 'Prueba limpiando la búsqueda o seleccionando otra etapa del flujo.'}
            </p>
            {orders.length === 0 && (
              <button
                type="button"
                onClick={onOpenNewOrder}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Crear primera orden
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-[#0E1117]">
                  <th className="py-3 px-4">Orden</th>
                  <th className="py-3 px-4">Vehículo / Placa</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Mecánico / Bahía</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Prioridad</th>
                  <th className="py-3 px-4">Entrega</th>
                  <th className="py-3 px-4 text-right">Total / Cobro</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-sm">
                {filteredOrders.map((order) => {
                  const vesEquiv = convertUsdToVes(order.totalAmount, shop.currency, shop.bcvRate);
                  const pay = computePaymentSummary(order.totalAmount, order.amountPaid);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-amber-400 whitespace-nowrap">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-100 truncate max-w-[210px]">
                          {order.vehicleSummary}
                        </div>
                        <div className="text-xs font-mono text-zinc-400">
                          {order.plate} · {formatNumber(order.mileageIn)} km
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 truncate max-w-[170px]">
                        {order.customerName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-zinc-200 truncate max-w-[150px]">
                          {order.mechanicName || 'Sin asignar'}
                        </div>
                        <div className="text-xs text-zinc-500">{order.bay || 'Sin bahía'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <WorkOrderStatusText status={order.status} />
                      </td>
                      <td className="py-3 px-4">
                        <PriorityText priority={order.priority} />
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                        {order.promisedDate || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-zinc-100 tabular-nums">
                          {formatMoney(order.totalAmount, shop.currency)}
                        </div>
                        {vesEquiv !== null && (
                          <div className="font-mono text-[11px] text-zinc-500 tabular-nums mt-0.5">
                            {formatVES(vesEquiv)}
                          </div>
                        )}
                        {order.status !== 'Cancelado' && (
                          <div className="mt-1 flex items-center justify-end gap-1.5">
                            <PaymentStatusText status={pay.status} />
                            {pay.status === 'Abonado' && (
                              <span className="font-mono text-[11px] text-amber-400 tabular-nums">
                                · Falta {formatMoney(pay.remaining, shop.currency)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          {order.status !== 'Cancelado' && (
                            <button
                              type="button"
                              onClick={() => setPaymentOrder(order)}
                              title="Registrar pago o abono"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-md hover:bg-emerald-900/50 transition-colors"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              Cobro
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={downloadingId === order.id}
                            onClick={(e) => void handleExportRowPdf(e, order)}
                            title="Descargar reporte PDF"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            {downloadingId === order.id ? '...' : 'PDF'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {liveSelectedOrder && (
        <WorkOrderDetailDrawer
          uid={uid}
          shop={shop}
          order={liveSelectedOrder}
          customer={customers.find((c) => c.id === liveSelectedOrder.customerId)}
          vehicle={vehicles.find((v) => v.id === liveSelectedOrder.vehicleId)}
          mechanics={mechanics}
          parts={parts}
          onClose={() => onSelectOrder(null)}
        />
      )}

      {paymentOrder && (
        <PaymentModal
          shop={shop}
          docTypeLabel="Orden de trabajo"
          docNumber={paymentOrder.orderNumber}
          customerName={paymentOrder.customerName}
          vehicleSummary={`${paymentOrder.vehicleSummary} · ${paymentOrder.plate}`}
          totalAmount={paymentOrder.totalAmount}
          currentAmountPaid={paymentOrder.amountPaid}
          currentPaymentNotes={paymentOrder.paymentNotes}
          onSave={async (amountPaid, paymentNotes) => {
            await updateWorkOrderPayment(
              uid,
              paymentOrder.id,
              paymentOrder.totalAmount,
              amountPaid,
              paymentNotes
            );
          }}
          onClose={() => setPaymentOrder(null)}
        />
      )}
    </div>
  );
}

interface WorkOrderDetailDrawerProps {
  uid: string;
  shop: Shop;
  order: WorkOrder;
  customer?: Customer;
  vehicle?: Vehicle;
  mechanics: Mechanic[];
  parts: Part[];
  onClose: () => void;
}

function WorkOrderDetailDrawer({
  uid,
  shop,
  order,
  customer,
  vehicle,
  mechanics,
  parts,
  onClose,
}: WorkOrderDetailDrawerProps) {
  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [status, setStatus] = useState<WorkOrderStatus>(order.status);
  const [mechanicId, setMechanicId] = useState(order.mechanicId);
  const [bay, setBay] = useState(order.bay);
  const [priority, setPriority] = useState<WorkOrderPriority>(order.priority);
  const [promisedDate, setPromisedDate] = useState(order.promisedDate);
  const [mileageIn, setMileageIn] = useState(order.mileageIn);
  const [symptom, setSymptom] = useState(order.symptom);
  const [diagnosis, setDiagnosis] = useState(order.diagnosis);
  const [savingDetails, setSavingDetails] = useState(false);

  const [itemType, setItemType] = useState<WorkOrderItemType>('Mano de Obra');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [itemCostPrice, setItemCostPrice] = useState(0);
  const [addingItem, setAddingItem] = useState(false);

  const [showPrint, setShowPrint] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isTerminal = order.status === 'Entregado' || order.status === 'Cancelado';
  const totalVes = convertUsdToVes(order.totalAmount, shop.currency, shop.bcvRate);
  const paySummary = computePaymentSummary(order.totalAmount, order.amountPaid);
  const balanceVes = convertUsdToVes(paySummary.remaining, shop.currency, shop.bcvRate);

  const internalPartsStats = useMemo(() => {
    let costTotal = 0;
    let saleTotal = 0;
    for (const item of items) {
      if (item.type === 'Repuesto') {
        costTotal += item.quantity * (item.costPrice ?? 0);
        saleTotal += item.subtotal;
      }
    }
    return {
      costTotal: Number(costTotal.toFixed(2)),
      saleTotal: Number(saleTotal.toFixed(2)),
      profit: Number((saleTotal - costTotal).toFixed(2)),
    };
  }, [items]);

  useEffect(() => {
    setStatus(order.status);
    setMechanicId(order.mechanicId);
    setBay(order.bay);
    setPriority(order.priority);
    setPromisedDate(order.promisedDate);
    setMileageIn(order.mileageIn);
    setSymptom(order.symptom);
    setDiagnosis(order.diagnosis);
  }, [order]);

  useEffect(() => {
    const itemsPath = `shops/${uid}/workOrders/${order.id}/items`;
    const q = query(
      collection(db, 'shops', uid, 'workOrders', order.id, 'items'),
      where('ownerId', '==', uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<WorkOrderItem, 'id'>),
          }))
          .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
        setItems(list);
        setLoadingItems(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, itemsPath);
      }
    );
    return () => unsub();
  }, [uid, order.id]);

  const handleSelectPart = (partId: string) => {
    setSelectedPartId(partId);
    const p = parts.find((item) => item.id === partId);
    if (p) {
      setItemDesc(p.name);
      setItemPrice(p.salePrice);
      setItemCostPrice(p.costPrice);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSavingDetails(true);
    const mech = mechanics.find((m) => m.id === mechanicId);
    try {
      await updateWorkOrderDetails(uid, order.id, {
        mechanicId,
        mechanicName: mech?.name ?? 'Sin asignar',
        bay,
        diagnosis,
        priority,
        promisedDate,
        mileageIn,
        symptom,
        status,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemDesc.trim().length < 2) return;
    setActionError(null);
    setAddingItem(true);
    const part = itemType === 'Repuesto' ? parts.find((p) => p.id === selectedPartId) : undefined;
    try {
      await addWorkOrderItem(
        uid,
        order.id,
        items,
        shop.taxRate,
        {
          type: itemType,
          partId: part?.id ?? '',
          description: itemDesc.trim(),
          quantity: itemQty,
          unitPrice: itemPrice,
          costPrice: itemType === 'Repuesto' ? itemCostPrice : 0,
        },
        part?.stock,
        order.amountPaid ?? 0
      );
      setItemDesc('');
      setSelectedPartId('');
      setItemQty(1);
      setItemPrice(0);
      setItemCostPrice(0);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo agregar el concepto.');
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (item: WorkOrderItem) => {
    setActionError(null);
    try {
      await removeWorkOrderItem(uid, order.id, item, items, shop.taxRate, order.amountPaid ?? 0);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el concepto.');
    }
  };

  const handleDeleteOrder = async () => {
    setActionError(null);
    try {
      await deleteWorkOrder(uid, order.id);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar la orden.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-end">
      <div className="w-full max-w-2xl bg-[#141821] h-full border-l border-zinc-800 flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-[#0E1117] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-amber-400">
                {order.orderNumber}
              </span>
              <WorkOrderStatusText status={order.status} />
            </div>
            <p className="text-xs text-zinc-400 mt-1 truncate">
              {order.vehicleSummary} · <span className="font-mono text-zinc-300">{order.plate}</span> ·{' '}
              {order.customerName}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loadingItems}
              onClick={() => {
                void generateWorkOrderPdfReport({ shop, order, customer, vehicle, items });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <FileDown className="w-3.5 h-3.5" />
              Descargar PDF
            </button>
            <button
              type="button"
              onClick={() => setShowPrint(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle"
              className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {actionError && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/70 text-xs text-red-300">
              {actionError}
            </div>
          )}

          {isTerminal && (
            <div className="p-3.5 rounded-lg bg-[#0E1117] border border-zinc-800 text-xs text-zinc-300">
              Esta orden se encuentra en estado terminal (<span className="font-semibold text-zinc-100">{order.status}</span>) y su registro histórico está cerrado.
            </div>
          )}

          {/* Details Form */}
          <form onSubmit={(e) => void handleSaveDetails(e)} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-zinc-100">
                Datos técnicos y diagnóstico
              </h3>
              {!isTerminal && (
                <button
                  type="submit"
                  disabled={savingDetails}
                  className="px-3.5 py-1.5 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {savingDetails ? 'Guardando...' : 'Guardar cambios'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Estado</label>
                <select
                  value={status}
                  disabled={isTerminal}
                  onChange={(e) => setStatus(e.target.value as WorkOrderStatus)}
                  className="w-full px-3 py-2 text-sm bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 disabled:bg-zinc-900/60 disabled:text-zinc-500 focus:outline-none focus:border-amber-400"
                >
                  {WORK_ORDER_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Mecánico</label>
                <select
                  value={mechanicId}
                  disabled={isTerminal}
                  onChange={(e) => {
                    setMechanicId(e.target.value);
                    const m = mechanics.find((item) => item.id === e.target.value);
                    if (m?.bay) setBay(m.bay);
                  }}
                  className="w-full px-3 py-2 text-sm bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 disabled:bg-zinc-900/60 disabled:text-zinc-500 focus:outline-none focus:border-amber-400"
                >
                  <option value="">Sin asignar</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Bahía</label>
                <input
                  type="text"
                  disabled={isTerminal}
                  value={bay}
                  onChange={(e) => setBay(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 disabled:bg-zinc-900/60 disabled:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Prioridad</label>
                <select
                  value={priority}
                  disabled={isTerminal}
                  onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
                  className="w-full px-3 py-2 text-sm bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 disabled:bg-zinc-900/60 disabled:text-zinc-500 focus:outline-none focus:border-amber-400"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Entrega estimada</label>
                <input
                  type="date"
                  disabled={isTerminal}
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 disabled:bg-zinc-900/60 disabled:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Kilometraje</label>
                <input
                  type="number"
                  disabled={isTerminal}
                  value={mileageIn}
                  onChange={(e) => setMileageIn(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 disabled:bg-zinc-900/60 disabled:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Falla reportada por el cliente
              </label>
              <textarea
                rows={2}
                disabled={isTerminal}
                maxLength={500}
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 resize-none disabled:bg-zinc-900/60 disabled:text-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Diagnóstico y notas técnicas
              </label>
              <textarea
                rows={3}
                disabled={isTerminal}
                maxLength={800}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Hallazgos de inspección, códigos OBD-II, recomendaciones..."
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 resize-none disabled:bg-zinc-900/60 disabled:text-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {!isTerminal && (status === 'Entregado' || status === 'Cancelado') && (
              <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900/60 rounded-lg px-3 py-2">
                Al guardar con estado {status}, la orden quedará cerrada definitivamente.
              </p>
            )}
          </form>

          {/* Line Items Section */}
          <div className="border-t border-zinc-800 pt-6 space-y-4">
            <h3 className="font-display text-sm font-semibold text-zinc-100">
              Conceptos de mano de obra y repuestos
            </h3>

            {loadingItems ? (
              <div className="space-y-2">
                <div className="h-9 bg-zinc-800/60 rounded-lg animate-pulse" />
                <div className="h-9 bg-zinc-800/60 rounded-lg animate-pulse" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3">
                No se han agregado cargos ni repuestos a esta orden.
              </p>
            ) : (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0E1117] border-b border-zinc-800 text-zinc-400">
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Descripción</th>
                      <th className="py-2 px-3 text-right">Cant.</th>
                      <th className="py-2 px-3 text-right">P. Unit.</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                      {!isTerminal && <th className="py-2 px-2 w-8" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 px-3 text-zinc-400 whitespace-nowrap">{item.type}</td>
                        <td className="py-2 px-3 text-zinc-100 font-medium">{item.description}</td>
                        <td className="py-2 px-3 text-right font-mono text-zinc-300 tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-zinc-300 tabular-nums">
                          <div>{formatMoney(item.unitPrice, shop.currency)}</div>
                          {item.type === 'Repuesto' && (item.costPrice ?? 0) > 0 && (
                            <div
                              className="text-[10px] text-zinc-500 font-mono"
                              title="Costo interno (no se muestra en PDF)"
                            >
                              Costo: {formatMoney(item.costPrice ?? 0, shop.currency)}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-zinc-100 tabular-nums">
                          {formatMoney(item.subtotal, shop.currency)}
                        </td>
                        {!isTerminal && (
                          <td className="py-2 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => void handleRemoveItem(item)}
                              aria-label="Eliminar concepto"
                              className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Item Form */}
            {!isTerminal && (
              <form
                onSubmit={(e) => void handleAddItem(e)}
                className="p-4 bg-[#0E1117] border border-zinc-800 rounded-lg space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-0.5 bg-[#0B0D11] border border-zinc-800 rounded-md">
                    {(['Mano de Obra', 'Repuesto'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setItemType(t);
                          setSelectedPartId('');
                          setItemDesc('');
                          setItemPrice(0);
                          setItemCostPrice(0);
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                          itemType === t
                            ? 'bg-zinc-800 text-zinc-100'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {itemType === 'Repuesto' && (
                    <select
                      value={selectedPartId}
                      onChange={(e) => handleSelectPart(e.target.value)}
                      className="flex-1 min-w-[200px] px-2.5 py-1.5 text-xs bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-100"
                    >
                      <option value="">Opcional: elegir del inventario...</option>
                      {parts.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.sku} — {p.name} ({p.stock} disp.)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className={itemType === 'Repuesto' ? 'sm:col-span-4' : 'sm:col-span-6'}>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      {itemType === 'Mano de Obra' ? 'Descripción del servicio' : 'Repuesto'}
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={150}
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                      placeholder={
                        itemType === 'Mano de Obra'
                          ? 'Descripción del servicio o trabajo...'
                          : 'Nombre del repuesto...'
                      }
                      className="w-full px-3 py-1.5 text-xs bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Cant.
                    </label>
                    <input
                      type="number"
                      min={0.1}
                      step="0.5"
                      required
                      value={itemQty}
                      onChange={(e) => setItemQty(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-100"
                    />
                  </div>
                  {itemType === 'Repuesto' && (
                    <div className="sm:col-span-2">
                      <label
                        className="block text-[11px] font-medium text-zinc-400 mb-1"
                        title="Solo uso interno; no sale en PDF"
                      >
                        Costo (interno)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={itemCostPrice}
                        onChange={(e) => setItemCostPrice(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-300"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      {itemType === 'Repuesto' ? 'Precio venta' : 'Precio'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={itemPrice}
                      onChange={(e) => setItemPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addingItem}
                    className="sm:col-span-2 px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-md hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {addingItem ? '...' : 'Agregar'}
                  </button>
                </div>
              </form>
            )}

            {/* Financial Summary & Client Payment Tracking */}
            <div className="border-t border-zinc-800 pt-5 space-y-4">
              {internalPartsStats.costTotal > 0 && (
                <div className="p-3 bg-[#0E1117] border border-zinc-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-zinc-300 font-medium">
                      Rentabilidad interna en repuestos
                    </span>
                    <span className="text-zinc-500 ml-1.5">(uso interno · no aparece en PDF)</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono tabular-nums">
                    <span className="text-zinc-400">
                      Costo: {formatMoney(internalPartsStats.costTotal, shop.currency)}
                    </span>
                    <span className="text-zinc-300">
                      Venta: {formatMoney(internalPartsStats.saleTotal, shop.currency)}
                    </span>
                    <span
                      className={`font-semibold ${
                        internalPartsStats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      Ganancia: {formatMoney(internalPartsStats.profit, shop.currency)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-3">
                  {order.status !== 'Cancelado' && (
                    <div className="p-3.5 bg-[#0E1117] border border-zinc-800 rounded-lg space-y-2 sm:min-w-[270px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-zinc-400">Estado de cobro</span>
                        <PaymentStatusText status={paySummary.status} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">Abonado</span>
                        <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                          {formatMoney(paySummary.paid, shop.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">Falta por cancelar</span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            paySummary.remaining > 0 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {formatMoney(paySummary.remaining, shop.currency)}
                        </span>
                      </div>
                      {balanceVes !== null && paySummary.remaining > 0 && (
                        <div className="flex justify-between text-[11px] text-zinc-500">
                          <span>Saldo en Bs. (BCV)</span>
                          <span className="font-mono tabular-nums">{formatVES(balanceVes)}</span>
                        </div>
                      )}
                      {order.paymentNotes && (
                        <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/80">
                          Ref: {order.paymentNotes}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-md hover:bg-emerald-900/50 transition-colors whitespace-nowrap"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        Registrar pago / abono
                      </button>
                    </div>
                  )}

                  {order.status !== 'Entregado' && (
                    confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">¿Eliminar esta orden?</span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteOrder()}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium"
                      >
                        Eliminar orden
                      </button>
                    )
                  )}
                </div>

                <div className="w-full sm:w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Mano de obra</span>
                    <span className="font-mono text-zinc-200 tabular-nums">
                      {formatMoney(order.laborTotal, shop.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Repuestos</span>
                    <span className="font-mono text-zinc-200 tabular-nums">
                      {formatMoney(order.partsTotal, shop.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>IVA ({shop.taxRate}%)</span>
                    <span className="font-mono text-zinc-200 tabular-nums">
                      {formatMoney(order.taxAmount, shop.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-zinc-100 border-t border-zinc-800 pt-2">
                    <span>Total</span>
                    <span className="font-mono text-amber-400 tabular-nums">
                      {formatMoney(order.totalAmount, shop.currency)}
                    </span>
                  </div>
                  {totalVes !== null && shop.bcvRate && (
                    <div className="flex justify-between text-xs text-zinc-400 pt-0.5">
                      <span>Equiv. BCV (Bs. {shop.bcvRate.toFixed(2)})</span>
                      <span className="font-mono font-medium text-zinc-200 tabular-nums">
                        {formatVES(totalVes)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Invoice / Work Order Preview Modal (white paper document for print) */}
      {showPrint && (
        <div className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-zinc-900 border border-zinc-300 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
            {/* German Flag Accent Bar */}
            <div className="h-1.5 flex w-full">
              <div className="flex-1 bg-zinc-950" />
              <div className="flex-1 bg-red-600" />
              <div className="flex-1 bg-amber-400" />
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5">
                <div className="flex items-center gap-3.5">
                  <img
                    src={SHOP_LOGO_PATH}
                    alt="Logo AutoMekanika SHN"
                    className="w-16 h-14 object-cover object-center rounded-md border border-zinc-200 bg-[#F7F6F1] shrink-0"
                  />
                  <div>
                    <h2 className="font-display text-xl font-bold text-zinc-950">
                      {shop.name || 'AutoMekanika SHN'}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {shop.address || 'Taller de Servicio Automotriz'}
                      {shop.phone ? ` · Tel. ${shop.phone}` : ''}
                    </p>
                    {shop.bcvRate && shop.bcvRate > 0 && (
                      <p className="text-[11px] font-mono text-zinc-500 mt-1">
                        Tasa BCV ref.: Bs. {shop.bcvRate.toFixed(2)} / USD
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-bold text-zinc-950">{order.orderNumber}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Estado: {order.status}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-zinc-500">Cliente</p>
                  <p className="font-semibold text-zinc-900 mt-0.5">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Vehículo</p>
                  <p className="font-semibold text-zinc-900 mt-0.5">
                    {order.vehicleSummary} · <span className="font-mono">{order.plate}</span>
                  </p>
                  <p className="text-zinc-500 font-mono">
                    Kilometraje: {formatNumber(order.mileageIn)} km
                  </p>
                </div>
              </div>

              <div className="text-xs space-y-2 border-t border-b border-zinc-200 py-4">
                <div>
                  <span className="font-semibold text-zinc-700">Motivo de ingreso: </span>
                  <span className="text-zinc-600">{order.symptom}</span>
                </div>
                {order.diagnosis && (
                  <div>
                    <span className="font-semibold text-zinc-700">Diagnóstico técnico: </span>
                    <span className="text-zinc-600">{order.diagnosis}</span>
                  </div>
                )}
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="py-2">Concepto</th>
                    <th className="py-2">Tipo</th>
                    <th className="py-2 text-right">Cant.</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 font-medium text-zinc-900">{it.description}</td>
                      <td className="py-2 text-zinc-600">{it.type}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{it.quantity}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {formatMoney(it.subtotal, shop.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Mano de obra</span>
                    <span className="font-mono tabular-nums">
                      {formatMoney(order.laborTotal, shop.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Repuestos</span>
                    <span className="font-mono tabular-nums">
                      {formatMoney(order.partsTotal, shop.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>IVA ({shop.taxRate}%)</span>
                    <span className="font-mono tabular-nums">
                      {formatMoney(order.taxAmount, shop.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-zinc-950 border-t border-zinc-200 pt-2">
                    <span>Total</span>
                    <span className="font-mono tabular-nums">
                      {formatMoney(order.totalAmount, shop.currency)}
                    </span>
                  </div>
                  {totalVes !== null && (
                    <div className="flex justify-between text-xs font-semibold text-zinc-700 pt-0.5">
                      <span>Equivalente BCV</span>
                      <span className="font-mono tabular-nums">{formatVES(totalVes)}</span>
                    </div>
                  )}
                  {paySummary.paid > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-zinc-700 border-t border-zinc-200 pt-1.5 mt-1.5">
                        <span>Abonado</span>
                        <span className="font-mono tabular-nums">
                          {formatMoney(paySummary.paid, shop.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-zinc-950">
                        <span>
                          {paySummary.remaining <= 0 ? 'Estado de pago' : 'Resta por pagar'}
                        </span>
                        <span className="font-mono tabular-nums">
                          {paySummary.remaining <= 0
                            ? 'PAGADO COMPLETO'
                            : formatMoney(paySummary.remaining, shop.currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 no-print">
                <button
                  type="button"
                  onClick={() => setShowPrint(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void generateWorkOrderPdfReport({ shop, order, customer, vehicle, items });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Descargar PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-lg hover:bg-zinc-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir documento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPaymentModal && (
        <PaymentModal
          shop={shop}
          docTypeLabel="Orden de trabajo"
          docNumber={order.orderNumber}
          customerName={order.customerName}
          vehicleSummary={`${order.vehicleSummary} · ${order.plate}`}
          totalAmount={order.totalAmount}
          currentAmountPaid={order.amountPaid}
          currentPaymentNotes={order.paymentNotes}
          onSave={async (amountPaid, paymentNotes) => {
            await updateWorkOrderPayment(
              uid,
              order.id,
              order.totalAmount,
              amountPaid,
              paymentNotes
            );
          }}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
}
