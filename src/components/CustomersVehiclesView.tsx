import { useMemo, useState } from 'react';
import { Banknote, Car, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import {
  createCustomer,
  createVehicle,
  deleteCustomer,
  deleteVehicle,
  updateCustomer,
  updateQuotePayment,
  updateVehicle,
  updateWorkOrderPayment,
} from '../services/workshopService';
import {
  computePaymentSummary,
  convertUsdToVes,
  formatMoney,
  formatNumber,
  formatVES,
  FUEL_TYPES,
  type Customer,
  type FuelType,
  type Quote,
  type Shop,
  type Vehicle,
  type WorkOrder,
} from '../types/workshop';
import { PaymentModal } from './PaymentModal';
import { PaymentStatusText, QuoteStatusText, WorkOrderStatusText } from './StatusIndicator';

interface CustomersVehiclesViewProps {
  uid: string;
  shop: Shop;
  customers: Customer[];
  vehicles: Vehicle[];
  workOrders: WorkOrder[];
  quotes: Quote[];
  onSelectOrder: (order: WorkOrder) => void;
}

type PaymentTarget =
  | { kind: 'quote'; quote: Quote }
  | { kind: 'order'; order: WorkOrder };

export function CustomersVehiclesView({
  uid,
  shop,
  customers,
  vehicles,
  workOrders,
  quotes,
  onSelectOrder,
}: CustomersVehiclesViewProps) {
  const [tab, setTab] = useState<'customers' | 'vehicles'>('customers');
  const [searchTerm, setSearchTerm] = useState('');

  const [customerModal, setCustomerModal] = useState<{ open: boolean; editing: Customer | null }>({
    open: false,
    editing: null,
  });
  const [vehicleModal, setVehicleModal] = useState<{
    open: boolean;
    editing: Vehicle | null;
    preselectedCustomerId?: string;
  }>({ open: false, editing: null });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.taxId.toLowerCase().includes(q)
    );
  }, [customers, searchTerm]);

  const filteredVehicles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.customerName.toLowerCase().includes(q) ||
        v.vin.toLowerCase().includes(q)
    );
  }, [vehicles, searchTerm]);

  const liveSelectedCustomer = useMemo(() => {
    if (!selectedCustomer) return null;
    return customers.find((c) => c.id === selectedCustomer.id) ?? selectedCustomer;
  }, [customers, selectedCustomer]);

  const getCustomerQuotes = (customer: Customer) => {
    const normalizedName = customer.name.trim().toLowerCase();
    return quotes.filter(
      (q) =>
        q.customerId === customer.id ||
        (!q.customerId && q.customerName.trim().toLowerCase() === normalizedName)
    );
  };

  const getCustomerAccountSummary = (customer: Customer) => {
    const activeOrders = workOrders.filter(
      (w) => w.customerId === customer.id && w.status !== 'Cancelado'
    );
    const standaloneQuotes = getCustomerQuotes(customer).filter(
      (q) => q.status !== 'Convertido' && q.status !== 'Rechazado'
    );

    let total = 0;
    let paid = 0;
    let balance = 0;

    for (const wo of activeOrders) {
      const s = computePaymentSummary(wo.totalAmount, wo.amountPaid);
      total += wo.totalAmount;
      paid += s.paid;
      balance += s.remaining;
    }
    for (const q of standaloneQuotes) {
      const s = computePaymentSummary(q.totalAmount, q.amountPaid);
      total += q.totalAmount;
      paid += s.paid;
      balance += s.remaining;
    }

    return {
      total: Number(total.toFixed(2)),
      paid: Number(paid.toFixed(2)),
      balance: Number(balance.toFixed(2)),
      hasDocs: activeOrders.length > 0 || standaloneQuotes.length > 0,
    };
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#141821] border border-zinc-800 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'customers'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Clientes ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('vehicles')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'vehicles'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Vehículos ({vehicles.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                tab === 'customers' ? 'Buscar cliente, teléfono...' : 'Buscar placa, marca, modelo...'
              }
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#141821] text-zinc-100 placeholder:text-zinc-500 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {tab === 'customers' ? (
            <button
              type="button"
              onClick={() => setCustomerModal({ open: true, editing: null })}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nuevo cliente
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setVehicleModal({ open: true, editing: null })}
              disabled={customers.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nuevo vehículo
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
        {tab === 'customers' ? (
          filteredCustomers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-100">
                {customers.length === 0 ? 'Sin clientes registrados' : 'Sin coincidencias'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Registra propietarios o flotas para asociar sus vehículos y órdenes de servicio.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-[#0E1117]">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Correo</th>
                    <th className="py-3 px-4">C.I. / RIF</th>
                    <th className="py-3 px-4 text-right">Vehículos</th>
                    <th className="py-3 px-4 text-right">Saldo pendiente</th>
                    <th className="py-3 px-4 text-right w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-sm">
                  {filteredCustomers.map((customer) => {
                    const count = vehicles.filter((v) => v.customerId === customer.id).length;
                    const account = getCustomerAccountSummary(customer);
                    const balanceVes = convertUsdToVes(account.balance, shop.currency, shop.bcvRate);
                    return (
                      <tr
                        key={customer.id}
                        onClick={() => setSelectedCustomer(customer)}
                        className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-zinc-100">{customer.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-zinc-300 whitespace-nowrap">
                          {customer.phone}
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-400">{customer.email || '—'}</td>
                        <td className="py-3 px-4 font-mono text-xs text-zinc-400">
                          {customer.taxId || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-zinc-100 tabular-nums">
                          {count}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {!account.hasDocs ? (
                            <span className="text-xs text-zinc-500">—</span>
                          ) : account.balance <= 0 ? (
                            <div>
                              <span className="text-xs font-medium text-emerald-400">Al día</span>
                              {account.paid > 0 && (
                                <div className="font-mono text-[11px] text-zinc-500 tabular-nums">
                                  Pagado: {formatMoney(account.paid, shop.currency)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="font-mono text-xs font-semibold text-amber-400 tabular-nums">
                                Falta: {formatMoney(account.balance, shop.currency)}
                              </div>
                              <div className="font-mono text-[11px] text-zinc-400 tabular-nums">
                                {account.paid > 0
                                  ? `Abonado: ${formatMoney(account.paid, shop.currency)}`
                                  : balanceVes !== null
                                  ? formatVES(balanceVes)
                                  : 'Pendiente'}
                              </div>
                            </div>
                          )}
                        </td>
                        <td
                          className="py-3 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Editar cliente"
                              onClick={() => setCustomerModal({ open: true, editing: customer })}
                              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Eliminar cliente"
                              onClick={() => void deleteCustomer(uid, customer.id)}
                              className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md hover:bg-red-950/50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : filteredVehicles.length === 0 ? (
          <div className="p-12 text-center">
            <Car className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-100">
              {vehicles.length === 0 ? 'Sin vehículos registrados' : 'Sin coincidencias'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Asocia vehículos a tus clientes para llevar un control exacto de kilometraje y reparaciones.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-[#0E1117]">
                  <th className="py-3 px-4">Placa</th>
                  <th className="py-3 px-4">Vehículo</th>
                  <th className="py-3 px-4">Propietario</th>
                  <th className="py-3 px-4">Combustible</th>
                  <th className="py-3 px-4 text-right">Kilometraje</th>
                  <th className="py-3 px-4 text-right w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-sm">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-amber-400 whitespace-nowrap">
                      {vehicle.plate}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-100">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </div>
                      <div className="text-xs text-zinc-400 font-mono">
                        {vehicle.color || 'Color N/D'} {vehicle.vin ? `· VIN ${vehicle.vin}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">{vehicle.customerName}</td>
                    <td className="py-3 px-4 text-xs text-zinc-400">{vehicle.fuelType}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-zinc-100 tabular-nums whitespace-nowrap">
                      {formatNumber(vehicle.mileage)} km
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Editar vehículo"
                          onClick={() => setVehicleModal({ open: true, editing: vehicle })}
                          className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Eliminar vehículo"
                          onClick={() => void deleteVehicle(uid, vehicle.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md hover:bg-red-950/50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Detail Drawer */}
      {liveSelectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-[#141821] h-full border-l border-zinc-800 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-semibold text-zinc-100">
                  {liveSelectedCustomer.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                  {liveSelectedCustomer.phone}
                  {liveSelectedCustomer.email ? ` · ${liveSelectedCustomer.email}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                aria-label="Cerrar ficha"
                className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

              {(() => {
                const account = getCustomerAccountSummary(liveSelectedCustomer);
                const balanceVes = convertUsdToVes(account.balance, shop.currency, shop.bcvRate);
                const customerQuotes = getCustomerQuotes(liveSelectedCustomer);
                const customerOrders = workOrders.filter(
                  (w) => w.customerId === liveSelectedCustomer.id
                );

                return (
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {liveSelectedCustomer.notes && (
                      <div className="p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-lg text-xs text-zinc-300 leading-relaxed">
                        {liveSelectedCustomer.notes}
                      </div>
                    )}

                    {/* Customer Financial Summary */}
                    <div className="p-4 bg-[#0E1117] border border-zinc-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-display text-sm font-semibold text-zinc-100">
                          Estado de cuenta del cliente
                        </h4>
                        {account.hasDocs && (
                          <span
                            className={`text-xs font-semibold ${
                              account.balance <= 0 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {account.balance <= 0 ? 'Solvente' : 'Saldo pendiente'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="p-2.5 bg-[#141821] border border-zinc-800 rounded-lg">
                          <span className="text-zinc-500 block">Facturado</span>
                          <span className="font-mono font-semibold text-zinc-100 tabular-nums mt-0.5 block">
                            {formatMoney(account.total, shop.currency)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-[#141821] border border-zinc-800 rounded-lg">
                          <span className="text-zinc-500 block">Abonado</span>
                          <span className="font-mono font-semibold text-emerald-400 tabular-nums mt-0.5 block">
                            {formatMoney(account.paid, shop.currency)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-[#141821] border border-zinc-800 rounded-lg">
                          <span className="text-zinc-500 block">Falta cancelar</span>
                          <span
                            className={`font-mono font-semibold tabular-nums mt-0.5 block ${
                              account.balance > 0 ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {formatMoney(account.balance, shop.currency)}
                          </span>
                          {balanceVes !== null && account.balance > 0 && (
                            <span className="font-mono text-[10px] text-zinc-400 tabular-nums block">
                              {formatVES(balanceVes)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Vehicles */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-display text-sm font-semibold text-zinc-100">
                          Vehículos registrados
                        </h4>
                        <button
                          type="button"
                          onClick={() =>
                            setVehicleModal({
                              open: true,
                              editing: null,
                              preselectedCustomerId: liveSelectedCustomer.id,
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Agregar vehículo
                        </button>
                      </div>
                      <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg bg-[#0E1117]">
                        {vehicles.filter((v) => v.customerId === liveSelectedCustomer.id).length === 0 ? (
                          <p className="p-4 text-xs text-zinc-500">Sin vehículos asociados.</p>
                        ) : (
                          vehicles
                            .filter((v) => v.customerId === liveSelectedCustomer.id)
                            .map((v) => (
                              <div key={v.id} className="p-3.5 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-zinc-100">
                                    {v.year} {v.make} {v.model}
                                  </p>
                                  <p className="text-xs font-mono text-zinc-400 mt-0.5">
                                    {v.plate} · {formatNumber(v.mileage)} km · {v.fuelType}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setVehicleModal({ open: true, editing: v })}
                                  className="text-xs text-zinc-300 hover:text-amber-400 font-medium"
                                >
                                  Editar
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Customer Quotes + Payment Action */}
                    <div>
                      <h4 className="font-display text-sm font-semibold text-zinc-100 mb-3">
                        Presupuestos del cliente
                      </h4>
                      <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg bg-[#0E1117]">
                        {customerQuotes.length === 0 ? (
                          <p className="p-4 text-xs text-zinc-500">
                            No tiene presupuestos registrados.
                          </p>
                        ) : (
                          customerQuotes.map((q) => {
                            const pay = computePaymentSummary(q.totalAmount, q.amountPaid);
                            const balVes = convertUsdToVes(pay.remaining, shop.currency, shop.bcvRate);
                            return (
                              <div key={q.id} className="p-3.5 flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-amber-400">
                                      {q.quoteNumber}
                                    </span>
                                    <QuoteStatusText status={q.status} />
                                    {q.status !== 'Rechazado' && (
                                      <PaymentStatusText status={pay.status} />
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-400 truncate">
                                    {q.vehicleSummary}
                                    {q.plate ? ` · ${q.plate}` : ''}
                                  </p>
                                  <div className="font-mono text-[11px] text-zinc-400 tabular-nums space-x-2">
                                    <span>Total: {formatMoney(q.totalAmount, shop.currency)}</span>
                                    <span>· Abonado: {formatMoney(pay.paid, shop.currency)}</span>
                                    {pay.remaining > 0 && (
                                      <span className="text-amber-400">
                                        · Falta: {formatMoney(pay.remaining, shop.currency)}
                                        {balVes !== null ? ` (${formatVES(balVes)})` : ''}
                                      </span>
                                    )}
                                  </div>
                                  {q.paymentNotes && (
                                    <p className="text-[11px] text-zinc-500 truncate">
                                      Ref: {q.paymentNotes}
                                    </p>
                                  )}
                                </div>
                                {q.status !== 'Rechazado' && (
                                  <button
                                    type="button"
                                    onClick={() => setPaymentTarget({ kind: 'quote', quote: q })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-md hover:bg-emerald-900/50 transition-colors whitespace-nowrap shrink-0"
                                  >
                                    <Banknote className="w-3.5 h-3.5" />
                                    Cobro / Abono
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Work Orders History + Payment Action */}
                    <div>
                      <h4 className="font-display text-sm font-semibold text-zinc-100 mb-3">
                        Historial de órdenes
                      </h4>
                      <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg bg-[#0E1117]">
                        {customerOrders.length === 0 ? (
                          <p className="p-4 text-xs text-zinc-500">
                            Aún no tiene órdenes de trabajo.
                          </p>
                        ) : (
                          customerOrders.map((wo) => {
                            const pay = computePaymentSummary(wo.totalAmount, wo.amountPaid);
                            const balVes = convertUsdToVes(pay.remaining, shop.currency, shop.bcvRate);
                            return (
                              <div
                                key={wo.id}
                                className="p-3.5 flex items-start justify-between gap-3 hover:bg-zinc-800/30 transition-colors"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomer(null);
                                    onSelectOrder(wo);
                                  }}
                                  className="min-w-0 flex-1 text-left space-y-1"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-amber-400">
                                      {wo.orderNumber}
                                    </span>
                                    <WorkOrderStatusText status={wo.status} />
                                    {wo.status !== 'Cancelado' && (
                                      <PaymentStatusText status={pay.status} />
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-400 truncate">
                                    {wo.vehicleSummary} · {wo.symptom}
                                  </p>
                                  <div className="font-mono text-[11px] text-zinc-400 tabular-nums space-x-2">
                                    <span>Total: {formatMoney(wo.totalAmount, shop.currency)}</span>
                                    <span>· Abonado: {formatMoney(pay.paid, shop.currency)}</span>
                                    {pay.remaining > 0 && (
                                      <span className="text-amber-400">
                                        · Falta: {formatMoney(pay.remaining, shop.currency)}
                                        {balVes !== null ? ` (${formatVES(balVes)})` : ''}
                                      </span>
                                    )}
                                  </div>
                                </button>
                                {wo.status !== 'Cancelado' && (
                                  <button
                                    type="button"
                                    onClick={() => setPaymentTarget({ kind: 'order', order: wo })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-md hover:bg-emerald-900/50 transition-colors whitespace-nowrap shrink-0"
                                  >
                                    <Banknote className="w-3.5 h-3.5" />
                                    Cobro / Abono
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      {customerModal.open && (
        <CustomerFormModal
          uid={uid}
          editing={customerModal.editing}
          onClose={() => setCustomerModal({ open: false, editing: null })}
        />
      )}

      {vehicleModal.open && (
        <VehicleFormModal
          uid={uid}
          customers={customers}
          editing={vehicleModal.editing}
          preselectedCustomerId={vehicleModal.preselectedCustomerId}
          onClose={() => setVehicleModal({ open: false, editing: null })}
        />
      )}

      {paymentTarget && (
        <PaymentModal
          shop={shop}
          docTypeLabel={paymentTarget.kind === 'quote' ? 'Presupuesto' : 'Orden de trabajo'}
          docNumber={
            paymentTarget.kind === 'quote'
              ? paymentTarget.quote.quoteNumber
              : paymentTarget.order.orderNumber
          }
          customerName={
            paymentTarget.kind === 'quote'
              ? paymentTarget.quote.customerName
              : paymentTarget.order.customerName
          }
          vehicleSummary={
            paymentTarget.kind === 'quote'
              ? `${paymentTarget.quote.vehicleSummary}${
                  paymentTarget.quote.plate ? ` · ${paymentTarget.quote.plate}` : ''
                }`
              : `${paymentTarget.order.vehicleSummary} · ${paymentTarget.order.plate}`
          }
          totalAmount={
            paymentTarget.kind === 'quote'
              ? paymentTarget.quote.totalAmount
              : paymentTarget.order.totalAmount
          }
          currentAmountPaid={
            paymentTarget.kind === 'quote'
              ? paymentTarget.quote.amountPaid
              : paymentTarget.order.amountPaid
          }
          currentPaymentNotes={
            paymentTarget.kind === 'quote'
              ? paymentTarget.quote.paymentNotes
              : paymentTarget.order.paymentNotes
          }
          onSave={async (amountPaid, paymentNotes) => {
            if (paymentTarget.kind === 'quote') {
              await updateQuotePayment(
                uid,
                paymentTarget.quote.id,
                paymentTarget.quote.totalAmount,
                amountPaid,
                paymentNotes
              );
            } else {
              await updateWorkOrderPayment(
                uid,
                paymentTarget.order.id,
                paymentTarget.order.totalAmount,
                amountPaid,
                paymentNotes
              );
            }
          }}
          onClose={() => setPaymentTarget(null)}
        />
      )}
    </div>
  );
}

function CustomerFormModal({
  uid,
  editing,
  onClose,
}: {
  uid: string;
  editing: Customer | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [taxId, setTaxId] = useState(editing?.taxId ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || phone.trim().length < 5) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCustomer(uid, editing.id, { name, phone, email, taxId, notes });
      } else {
        await createCustomer(uid, { name, phone, email, taxId, notes });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141821] border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-zinc-100">
            {editing ? 'Editar cliente' : 'Nuevo cliente'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Nombre completo / Empresa
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Teléfono</label>
              <input
                type="text"
                required
                minLength={5}
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+58 412 000 0000"
                className="w-full px-3 py-2 text-sm font-mono bg-[#0B0D11] text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">C.I. / RIF</label>
              <input
                type="text"
                maxLength={40}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="V-12345678 / J-..."
                className="w-full px-3 py-2 text-sm font-mono bg-[#0B0D11] text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              maxLength={120}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Notas</label>
            <textarea
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-300 bg-[#0B0D11] border border-zinc-700 rounded-lg hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VehicleFormModal({
  uid,
  customers,
  editing,
  preselectedCustomerId,
  onClose,
}: {
  uid: string;
  customers: Customer[];
  editing: Vehicle | null;
  preselectedCustomerId?: string;
  onClose: () => void;
}) {
  const [customerId, setCustomerId] = useState(
    editing?.customerId ?? preselectedCustomerId ?? customers[0]?.id ?? ''
  );
  const [plate, setPlate] = useState(editing?.plate ?? '');
  const [make, setMake] = useState(editing?.make ?? '');
  const [model, setModel] = useState(editing?.model ?? '');
  const [year, setYear] = useState(editing?.year ?? new Date().getFullYear());
  const [vin, setVin] = useState(editing?.vin ?? '');
  const [color, setColor] = useState(editing?.color ?? '');
  const [fuelType, setFuelType] = useState<FuelType>(editing?.fuelType ?? 'Gasolina');
  const [mileage, setMileage] = useState(editing?.mileage ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const owner = customers.find((c) => c.id === customerId);
    if (!owner || plate.trim().length < 2) return;
    setSaving(true);
    try {
      const payload = {
        customerId: owner.id,
        customerName: owner.name,
        plate,
        make,
        model,
        year,
        vin,
        color,
        fuelType,
        mileage,
      };
      if (editing) {
        await updateVehicle(uid, editing.id, payload);
      } else {
        await createVehicle(uid, payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141821] border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-zinc-100">
            {editing ? 'Editar vehículo' : 'Registrar vehículo'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Propietario</label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Placa</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={20}
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Marca</label>
              <input
                type="text"
                required
                maxLength={50}
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Modelo</label>
              <input
                type="text"
                required
                maxLength={60}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Año</label>
              <input
                type="number"
                required
                min={1950}
                max={2035}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Kilometraje</label>
              <input
                type="number"
                required
                min={0}
                max={2000000}
                value={mileage}
                onChange={(e) => setMileage(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Color</label>
              <input
                type="text"
                maxLength={30}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Combustible</label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as FuelType)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              >
                {FUEL_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              VIN / Serial de carrocería
            </label>
            <input
              type="text"
              maxLength={30}
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono uppercase bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-300 bg-[#0B0D11] border border-zinc-700 rounded-lg hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
