import { ArrowRight, Calendar, Database, Package, RefreshCw, Wrench } from 'lucide-react';
import { formatBcvDate } from '../services/bcvService';
import {
  ACTIVE_WORK_ORDER_STAGES,
  convertUsdToVes,
  formatMoney,
  formatNumber,
  formatVES,
  type Appointment,
  type NavSection,
  type Part,
  type Shop,
  type WorkOrder,
  type WorkOrderStatus,
} from '../types/workshop';
import { AppointmentStatusText, PriorityText, WorkOrderStatusText } from './StatusIndicator';

interface DashboardViewProps {
  shop: Shop;
  workOrders: WorkOrder[];
  appointments: Appointment[];
  parts: Part[];
  customersCount: number;
  onNavigate: (section: NavSection, filterStatus?: WorkOrderStatus) => void;
  onSelectOrder: (order: WorkOrder) => void;
  onSeedDemo: () => Promise<void>;
  seeding: boolean;
  onSyncBcv: () => Promise<void>;
  syncingBcv: boolean;
}

export function DashboardView({
  shop,
  workOrders,
  appointments,
  parts,
  customersCount,
  onNavigate,
  onSelectOrder,
  onSeedDemo,
  seeding,
  onSyncBcv,
  syncingBcv,
}: DashboardViewProps) {
  const activeOrders = workOrders.filter(
    (o) => o.status !== 'Entregado' && o.status !== 'Cancelado'
  );
  const readyOrders = workOrders.filter((o) => o.status === 'Listo');
  const deliveredRevenue = workOrders
    .filter((o) => o.status === 'Entregado' || o.status === 'Listo')
    .reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const deliveredRevenueVes = convertUsdToVes(deliveredRevenue, shop.currency, shop.bcvRate);
  const lowStockParts = parts.filter((p) => p.stock <= p.minStock);

  const stageCounts = ACTIVE_WORK_ORDER_STAGES.map((stage) => ({
    stage,
    count: workOrders.filter((o) => o.status === stage).length,
  }));

  const upcomingAppointments = appointments
    .filter((a) => a.status === 'Programada' || a.status === 'Confirmada')
    .sort((a, b) =>
      `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`)
    )
    .slice(0, 5);

  const isBrandNew = workOrders.length === 0 && customersCount === 0 && parts.length === 0;

  return (
    <div className="space-y-8">
      {isBrandNew && (
        <div className="bg-[#141821] border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-100">
              {shop.name || 'AutoMekanika SHN'} está listo para operar
            </h2>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Registra tus clientes, vehículos, presupuestos u órdenes manualmente, o carga datos de ejemplo para explorar todo el flujo del taller.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSeedDemo()}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Database className="w-4 h-4" />
            {seeding ? 'Cargando datos...' : 'Cargar datos de ejemplo'}
          </button>
        </div>
      )}

      {/* 4-Column KPI Strip (including live BCV rate) */}
      <div className="bg-[#141821] border border-zinc-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-400">Órdenes activas en taller</p>
          <p className="mt-2 font-display text-2xl font-bold text-zinc-100 tabular-nums">
            {formatNumber(activeOrders.length)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 tabular-nums">
            {readyOrders.length} listas para entrega · {shop.baysCount} bahías
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-zinc-400">Facturación lista / entregada</p>
          <p className="mt-2 font-display text-2xl font-bold text-zinc-100 font-mono tabular-nums">
            {formatMoney(deliveredRevenue, shop.currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-400 font-mono tabular-nums">
            {deliveredRevenueVes !== null
              ? `${formatVES(deliveredRevenueVes)} (BCV)`
              : `IVA configurado: ${shop.taxRate}%`}
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-zinc-400">Tasa BCV del día</p>
            <button
              type="button"
              onClick={() => void onSyncBcv()}
              disabled={syncingBcv}
              title="Actualizar tasa BCV"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${syncingBcv ? 'animate-spin' : ''}`} />
              {syncingBcv ? 'Actualizando' : 'Actualizar'}
            </button>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-amber-400 font-mono tabular-nums">
            {shop.bcvRate && shop.bcvRate > 0 ? formatVES(shop.bcvRate) : '—'}
          </p>
          <p className="mt-1 text-xs text-zinc-500 tabular-nums">
            1 USD · {formatBcvDate(shop.bcvUpdatedAt)}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-zinc-400">Alertas de inventario</p>
          <p
            className={`mt-2 font-display text-2xl font-bold tabular-nums ${
              lowStockParts.length > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {formatNumber(lowStockParts.length)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 tabular-nums">
            {formatNumber(parts.length)} repuestos en catálogo
          </p>
        </div>
      </div>

      {/* Stage Pipeline Strip */}
      <section className="bg-[#141821] border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-display text-base font-semibold text-zinc-100">
            Flujo actual por etapa
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
          >
            Ver tablero completo
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stageCounts.map(({ stage, count }) => (
            <button
              key={stage}
              type="button"
              onClick={() => onNavigate('orders', stage)}
              className="text-left p-3.5 rounded-lg bg-[#0E1117] border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <WorkOrderStatusText status={stage} />
              </div>
              <p className="mt-2 font-mono text-xl font-semibold text-zinc-100 tabular-nums">
                {count}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Main Split: Active Work Orders + Appointments & Low Stock */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-7 bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
            <h2 className="font-display text-base font-semibold text-zinc-100">
              Órdenes en curso
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-100 whitespace-nowrap"
            >
              Todas ({workOrders.length})
            </button>
          </div>

          {activeOrders.length === 0 ? (
            <div className="p-8 text-center">
              <Wrench className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-200">Sin órdenes activas</p>
              <p className="text-xs text-zinc-500 mt-1">
                Crea una nueva orden de trabajo desde el botón superior para comenzar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-[#0E1117]">
                    <th className="py-2.5 px-4">Orden</th>
                    <th className="py-2.5 px-4">Vehículo / Cliente</th>
                    <th className="py-2.5 px-4">Estado</th>
                    <th className="py-2.5 px-4">Prioridad</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-sm">
                  {activeOrders.slice(0, 6).map((order) => {
                    const ves = convertUsdToVes(order.totalAmount, shop.currency, shop.bcvRate);
                    return (
                      <tr
                        key={order.id}
                        onClick={() => onSelectOrder(order)}
                        className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4 font-mono text-xs font-semibold text-amber-400 whitespace-nowrap">
                          {order.orderNumber}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-zinc-100 truncate max-w-[220px]">
                            {order.vehicleSummary}
                          </div>
                          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                            <span className="font-mono">{order.plate}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate max-w-[150px]">{order.customerName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <WorkOrderStatusText status={order.status} />
                        </td>
                        <td className="py-2.5 px-4">
                          <PriorityText priority={order.priority} />
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="text-xs font-semibold text-zinc-100">
                            {formatMoney(order.totalAmount, shop.currency)}
                          </div>
                          {ves !== null && (
                            <div className="text-[11px] text-zinc-400">{formatVES(ves)}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="xl:col-span-5 space-y-6">
          {/* Upcoming Appointments */}
          <section className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
              <h2 className="font-display text-base font-semibold text-zinc-100">
                Próximas citas
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('appointments')}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-100 whitespace-nowrap"
              >
                Ver agenda
              </button>
            </div>
            {upcomingAppointments.length === 0 ? (
              <div className="p-6 text-center">
                <Calendar className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No hay citas próximas programadas.</p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/80">
                {upcomingAppointments.map((apt) => (
                  <li key={apt.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">
                        {apt.serviceType}
                      </p>
                      <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono tabular-nums">
                          {apt.scheduledDate} {apt.scheduledTime}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{apt.plate}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{apt.customerName}</span>
                      </p>
                    </div>
                    <AppointmentStatusText status={apt.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Low Stock Alerts */}
          <section className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
              <h2 className="font-display text-base font-semibold text-zinc-100">
                Stock crítico en inventario
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-100 whitespace-nowrap"
              >
                Inventario
              </button>
            </div>
            {lowStockParts.length === 0 ? (
              <div className="p-6 text-center">
                <Package className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">
                  Todos los repuestos superan su nivel mínimo de stock.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/80">
                {lowStockParts.slice(0, 5).map((part) => (
                  <li key={part.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">{part.name}</p>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">
                        {part.sku} · {part.location || 'Sin ubicación'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          part.stock === 0 ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {part.stock} uds
                      </span>
                      <p className="text-[11px] text-zinc-500 tabular-nums">
                        Mín: {part.minStock}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
