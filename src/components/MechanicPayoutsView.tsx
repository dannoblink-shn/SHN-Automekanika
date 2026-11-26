import { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, Percent, RotateCcw, Search, Users, Wallet, X } from 'lucide-react';
import {
  resetWorkOrderMechanicCommissionRate,
  updateShopCommissionRate,
  updateWorkOrderMechanicPayout,
} from '../services/workshopService';
import {
  computeMechanicPayout,
  convertUsdToVes,
  formatMoney,
  formatVES,
  type Mechanic,
  type Shop,
  type WorkOrder,
} from '../types/workshop';
import { PaymentStatusText, WorkOrderStatusText } from './StatusIndicator';

interface MechanicPayoutsViewProps {
  uid: string;
  shop: Shop;
  mechanics: Mechanic[];
  workOrders: WorkOrder[];
  onSelectOrder: (order: WorkOrder) => void;
}

const PRESET_RATES = [25, 30, 35, 40, 45, 50];

export function MechanicPayoutsView({
  uid,
  shop,
  mechanics,
  workOrders,
  onSelectOrder,
}: MechanicPayoutsViewProps) {
  const savedShopRate =
    typeof shop.mechanicCommissionRate === 'number' &&
    Number.isFinite(shop.mechanicCommissionRate)
      ? shop.mechanicCommissionRate
      : 35;

  const [baseRateInput, setBaseRateInput] = useState<string>(String(savedShopRate));
  const [savingShopRate, setSavingShopRate] = useState(false);
  const [shopRateSavedMsg, setShopRateSavedMsg] = useState(false);

  const [mechanicFilter, setMechanicFilter] = useState<string>('Todos');
  const [stageFilter, setStageFilter] = useState<'all' | 'completed' | 'active'>('all');
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [modalOrder, setModalOrder] = useState<WorkOrder | null>(null);

  useEffect(() => {
    setBaseRateInput(String(savedShopRate));
  }, [savedShopRate]);

  const effectiveBaseRate = useMemo(() => {
    const n = Number(baseRateInput);
    if (!Number.isFinite(n)) return savedShopRate;
    return Math.min(100, Math.max(0, Number(n.toFixed(2))));
  }, [baseRateInput, savedShopRate]);

  const rateChanged = Math.abs(effectiveBaseRate - savedShopRate) > 0.005;

  const handleSaveShopRate = async () => {
    setSavingShopRate(true);
    setShopRateSavedMsg(false);
    try {
      await updateShopCommissionRate(uid, effectiveBaseRate);
      setShopRateSavedMsg(true);
      setTimeout(() => setShopRateSavedMsg(false), 2500);
    } finally {
      setSavingShopRate(false);
    }
  };

  // Exclude cancelled orders from mechanic payroll calculations
  const nonCancelledOrders = useMemo(
    () => workOrders.filter((wo) => wo.status !== 'Cancelado'),
    [workOrders]
  );

  // Per-mechanic summary cards (only counts orders with assigned mechanic or shows unassigned bucket if exists)
  const mechanicSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        specialty: string;
        bay: string;
        defaultRate: number;
        vehicleCount: number;
        laborTotal: number;
        commissionTotal: number;
        paidTotal: number;
        remainingTotal: number;
      }
    >();

    for (const m of mechanics) {
      map.set(m.id, {
        id: m.id,
        name: m.name,
        specialty: m.specialty,
        bay: m.bay,
        defaultRate:
          typeof m.commissionRate === 'number' && Number.isFinite(m.commissionRate)
            ? m.commissionRate
            : effectiveBaseRate,
        vehicleCount: 0,
        laborTotal: 0,
        commissionTotal: 0,
        paidTotal: 0,
        remainingTotal: 0,
      });
    }

    for (const wo of nonCancelledOrders) {
      const key = wo.mechanicId || '__unassigned__';
      if (!map.has(key)) {
        if (key === '__unassigned__' && wo.laborTotal <= 0 && !wo.mechanicName) {
          continue;
        }
        map.set(key, {
          id: key,
          name: wo.mechanicName || 'Sin mecánico asignado',
          specialty: key === '__unassigned__' ? 'Por asignar técnico' : 'Técnico',
          bay: wo.bay || '—',
          defaultRate: effectiveBaseRate,
          vehicleCount: 0,
          laborTotal: 0,
          commissionTotal: 0,
          paidTotal: 0,
          remainingTotal: 0,
        });
      }
      const entry = map.get(key)!;
      const payout = computeMechanicPayout(wo, mechanics, effectiveBaseRate);
      entry.vehicleCount += 1;
      entry.laborTotal = Number((entry.laborTotal + wo.laborTotal).toFixed(2));
      entry.commissionTotal = Number((entry.commissionTotal + payout.commissionAmount).toFixed(2));
      entry.paidTotal = Number((entry.paidTotal + payout.paid).toFixed(2));
      entry.remainingTotal = Number((entry.remainingTotal + payout.remaining).toFixed(2));
    }

    return Array.from(map.values()).filter(
      (s) => s.id !== '__unassigned__' || s.vehicleCount > 0
    );
  }, [mechanics, nonCancelledOrders, effectiveBaseRate]);

  // Filtered vehicle rows
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return nonCancelledOrders
      .map((order) => ({
        order,
        payout: computeMechanicPayout(order, mechanics, effectiveBaseRate),
      }))
      .filter(({ order, payout }) => {
        if (mechanicFilter === '__unassigned__') {
          if (order.mechanicId) return false;
        } else if (mechanicFilter !== 'Todos') {
          if (order.mechanicId !== mechanicFilter) return false;
        }

        if (stageFilter === 'completed') {
          if (order.status !== 'Listo' && order.status !== 'Entregado') return false;
        } else if (stageFilter === 'active') {
          if (order.status === 'Entregado') return false;
        }

        if (payoutFilter === 'pending') {
          if (payout.commissionAmount <= 0 || payout.remaining <= 0.005) return false;
        } else if (payoutFilter === 'paid') {
          if (payout.status !== 'Pagado') return false;
        }

        if (!q) return true;
        return (
          order.orderNumber.toLowerCase().includes(q) ||
          order.plate.toLowerCase().includes(q) ||
          order.vehicleSummary.toLowerCase().includes(q) ||
          order.customerName.toLowerCase().includes(q) ||
          order.mechanicName.toLowerCase().includes(q)
        );
      });
  }, [
    nonCancelledOrders,
    mechanics,
    effectiveBaseRate,
    mechanicFilter,
    stageFilter,
    payoutFilter,
    searchTerm,
  ]);

  const totals = useMemo(() => {
    let labor = 0;
    let commission = 0;
    let paid = 0;
    let remaining = 0;
    for (const { order, payout } of filteredRows) {
      labor += order.laborTotal;
      commission += payout.commissionAmount;
      paid += payout.paid;
      remaining += payout.remaining;
    }
    return {
      labor: Number(labor.toFixed(2)),
      commission: Number(commission.toFixed(2)),
      paid: Number(paid.toFixed(2)),
      remaining: Number(remaining.toFixed(2)),
    };
  }, [filteredRows]);

  const handlePayFull = async (order: WorkOrder, rate: number, commissionAmount: number) => {
    setSavingOrderId(order.id);
    try {
      await updateWorkOrderMechanicPayout(
        uid,
        order.id,
        order.laborTotal,
        rate,
        commissionAmount
      );
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleResetOrderRate = async (order: WorkOrder) => {
    const mech = mechanics.find((m) => m.id === order.mechanicId);
    const fallbackRate =
      typeof mech?.commissionRate === 'number' && Number.isFinite(mech.commissionRate)
        ? mech.commissionRate
        : effectiveBaseRate;
    setSavingOrderId(order.id);
    try {
      await resetWorkOrderMechanicCommissionRate(
        uid,
        order.id,
        order.laborTotal,
        fallbackRate,
        order.mechanicPaid ?? 0
      );
    } finally {
      setSavingOrderId(null);
    }
  };

  const commissionVes = convertUsdToVes(totals.commission, shop.currency, shop.bcvRate);
  const paidVes = convertUsdToVes(totals.paid, shop.currency, shop.bcvRate);
  const remainingVes = convertUsdToVes(totals.remaining, shop.currency, shop.bcvRate);
  const laborVes = convertUsdToVes(totals.labor, shop.currency, shop.bcvRate);

  const liveModalOrder = modalOrder
    ? workOrders.find((w) => w.id === modalOrder.id) ?? modalOrder
    : null;

  return (
    <div className="space-y-6">
      {/* Top Percentage Configurator Bar */}
      <div className="bg-[#141821] border border-zinc-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-amber-400" />
            <h2 className="font-display text-base font-semibold text-zinc-100">
              Cálculo de pagos por Mano de Obra
            </h2>
          </div>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Calcula automáticamente lo que le corresponde cobrar al mecánico por cada vehículo asignado
            sobre la <span className="text-zinc-200 font-medium">Mano de obra</span> (sin incluir
            repuestos). Ajusta el porcentaje general o personaliza el % por vehículo o mecánico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-[#0B0D11] border border-zinc-800 rounded-lg">
            {PRESET_RATES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setBaseRateInput(String(preset))}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap ${
                  Math.abs(effectiveBaseRate - preset) < 0.01
                    ? 'bg-amber-400 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-[#0B0D11] border border-zinc-700 rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-zinc-400 whitespace-nowrap">% Variable:</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.5"
              aria-label="Porcentaje variable de mano de obra para mecánicos"
              value={baseRateInput}
              onChange={(e) => setBaseRateInput(e.target.value)}
              className="w-16 bg-transparent text-sm font-mono font-semibold text-amber-400 text-right focus:outline-none tabular-nums"
            />
            <span className="text-xs font-mono text-zinc-400">%</span>
          </div>

          {rateChanged && (
            <button
              type="button"
              disabled={savingShopRate}
              onClick={() => void handleSaveShopRate()}
              className="px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {savingShopRate ? 'Guardando...' : 'Guardar % base'}
            </button>
          )}

          {shopRateSavedMsg && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 whitespace-nowrap">
              <Check className="w-3.5 h-3.5" />
              Guardado ({savedShopRate}%)
            </span>
          )}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#141821] border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400">Mano de obra (vehículos filtrados)</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-zinc-100 tabular-nums">
            {formatMoney(totals.labor, shop.currency)}
          </p>
          {laborVes !== null && (
            <p className="mt-0.5 font-mono text-xs text-zinc-500 tabular-nums">
              {formatVES(laborVes)}
            </p>
          )}
        </div>

        <div className="bg-[#141821] border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400">
            Total correspondiente ({effectiveBaseRate}% base)
          </p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-amber-400 tabular-nums">
            {formatMoney(totals.commission, shop.currency)}
          </p>
          {commissionVes !== null && (
            <p className="mt-0.5 font-mono text-xs text-zinc-400 tabular-nums">
              {formatVES(commissionVes)}
            </p>
          )}
        </div>

        <div className="bg-[#141821] border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400">Ya pagado / abonado</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
            {formatMoney(totals.paid, shop.currency)}
          </p>
          {paidVes !== null && (
            <p className="mt-0.5 font-mono text-xs text-zinc-500 tabular-nums">
              {formatVES(paidVes)}
            </p>
          )}
        </div>

        <div className="bg-[#141821] border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400">Por pagar al equipo</p>
          <p
            className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
              totals.remaining > 0 ? 'text-amber-300' : 'text-emerald-400'
            }`}
          >
            {formatMoney(totals.remaining, shop.currency)}
          </p>
          {remainingVes !== null && (
            <p className="mt-0.5 font-mono text-xs text-zinc-400 tabular-nums">
              {formatVES(remainingVes)}
            </p>
          )}
        </div>
      </div>

      {/* Per-Mechanic Summary Cards */}
      {mechanicSummaries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-zinc-200">
              Resumen por mecánico
            </h3>
            {mechanicFilter !== 'Todos' && (
              <button
                type="button"
                onClick={() => setMechanicFilter('Todos')}
                className="text-xs font-medium text-amber-400 hover:text-amber-300"
              >
                Ver todos los mecánicos
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {mechanicSummaries.map((ms) => {
              const selected = mechanicFilter === ms.id;
              const remVes = convertUsdToVes(ms.remainingTotal, shop.currency, shop.bcvRate);
              return (
                <button
                  key={ms.id}
                  type="button"
                  onClick={() => setMechanicFilter(selected ? 'Todos' : ms.id)}
                  className={`text-left p-4 rounded-xl border transition-colors ${
                    selected
                      ? 'bg-zinc-800/80 border-amber-400/70'
                      : 'bg-[#141821] border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-100 truncate">{ms.name}</p>
                      <p className="text-xs text-zinc-400 truncate">
                        {ms.specialty} · {ms.bay || 'Sin bahía'}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-amber-400 shrink-0 tabular-nums">
                      {ms.defaultRate}%
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-zinc-800/80 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Vehículos</span>
                      <span className="font-mono font-semibold text-zinc-200 tabular-nums">
                        {ms.vehicleCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Le toca</span>
                      <span className="font-mono font-semibold text-zinc-100 tabular-nums">
                        {formatMoney(ms.commissionTotal, shop.currency)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-500 block">Por pagar</span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          ms.remainingTotal > 0 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {formatMoney(ms.remainingTotal, shop.currency)}
                      </span>
                      {remVes !== null && ms.remainingTotal > 0 && (
                        <span className="block font-mono text-[10px] text-zinc-500 tabular-nums">
                          {formatVES(remVes)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filtrar por mecánico"
            value={mechanicFilter}
            onChange={(e) => setMechanicFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#141821] border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-amber-400"
          >
            <option value="Todos">Todos los mecánicos</option>
            {mechanics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="__unassigned__">Sin mecánico asignado</option>
          </select>

          <div className="flex items-center gap-1 p-1 bg-[#141821] border border-zinc-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'Todos los vehículos' },
                { id: 'active', label: 'En taller' },
                { id: 'completed', label: 'Listos / Entregados' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStageFilter(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  stageFilter === opt.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#141821] border border-zinc-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'Todos los pagos' },
                { id: 'pending', label: 'Por pagar' },
                { id: 'paid', label: 'Pagados' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPayoutFilter(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  payoutFilter === opt.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-64 shrink-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar placa, vehículo, OT..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#141821] border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Assigned Vehicles & Mechanic Payout Table */}
      <div className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-12 text-center">
            {mechanics.length === 0 ? (
              <Users className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
            ) : (
              <Wallet className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
            )}
            <p className="text-sm font-semibold text-zinc-100">
              {nonCancelledOrders.length === 0
                ? 'No hay vehículos en órdenes de trabajo'
                : 'Sin vehículos que coincidan con este filtro'}
            </p>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              Asigna un mecánico y agrega conceptos de Mano de Obra en las órdenes de trabajo para
              ver cuánto le corresponde cobrar por cada vehículo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-[#0E1117]">
                  <th className="py-3 px-4">Orden / Estado</th>
                  <th className="py-3 px-4">Vehículo asignado</th>
                  <th className="py-3 px-4">Mecánico</th>
                  <th className="py-3 px-4 text-right">Mano de Obra</th>
                  <th className="py-3 px-4 text-right">% Com.</th>
                  <th className="py-3 px-4 text-right">Le toca cobrar</th>
                  <th className="py-3 px-4 text-right">Pago mecánico</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-sm">
                {filteredRows.map(({ order, payout }) => {
                  const rowCommissionVes = convertUsdToVes(
                    payout.commissionAmount,
                    shop.currency,
                    shop.bcvRate
                  );
                  const rowLaborVes = convertUsdToVes(
                    order.laborTotal,
                    shop.currency,
                    shop.bcvRate
                  );
                  const busy = savingOrderId === order.id;

                  return (
                    <tr key={order.id} className="hover:bg-zinc-800/35 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectOrder(order)}
                          className="font-mono text-xs font-semibold text-amber-400 hover:underline block"
                        >
                          {order.orderNumber}
                        </button>
                        <div className="mt-1">
                          <WorkOrderStatusText status={order.status} />
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-100 truncate max-w-[210px]">
                          {order.vehicleSummary}
                        </div>
                        <div className="text-xs text-zinc-400 truncate max-w-[210px]">
                          <span className="font-mono text-zinc-300">{order.plate}</span> ·{' '}
                          {order.customerName}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-zinc-200 font-medium truncate max-w-[160px]">
                          {order.mechanicName || 'Sin asignar'}
                        </div>
                        <div className="text-xs text-zinc-500">{order.bay || 'Sin bahía'}</div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="font-mono text-xs font-medium text-zinc-200 tabular-nums">
                          {formatMoney(order.laborTotal, shop.currency)}
                        </div>
                        {rowLaborVes !== null && order.laborTotal > 0 && (
                          <div className="font-mono text-[11px] text-zinc-500 tabular-nums">
                            {formatVES(rowLaborVes)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <span className="font-mono text-xs font-semibold text-zinc-200 tabular-nums">
                            {payout.rate}%
                          </span>
                          {payout.isCustomRate && (
                            <button
                              type="button"
                              disabled={busy}
                              title="Restablecer al porcentaje base"
                              onClick={() => void handleResetOrderRate(order)}
                              className="p-1 text-zinc-500 hover:text-amber-400 rounded"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {payout.isCustomRate ? 'Por vehículo' : 'Base'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="font-mono text-sm font-bold text-amber-400 tabular-nums">
                          {formatMoney(payout.commissionAmount, shop.currency)}
                        </div>
                        {rowCommissionVes !== null && payout.commissionAmount > 0 && (
                          <div className="font-mono text-[11px] text-zinc-400 tabular-nums">
                            {formatVES(rowCommissionVes)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {payout.commissionAmount <= 0 ? (
                          <span className="text-xs text-zinc-500">Sin mano de obra</span>
                        ) : (
                          <div>
                            <div className="flex justify-end">
                              <PaymentStatusText status={payout.status} />
                            </div>
                            <div className="font-mono text-[11px] text-zinc-400 tabular-nums mt-0.5">
                              {payout.remaining > 0
                                ? `Pagado: ${formatMoney(payout.paid, shop.currency)} · Resta ${formatMoney(payout.remaining, shop.currency)}`
                                : `Pagado: ${formatMoney(payout.paid, shop.currency)}`}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {payout.commissionAmount > 0 && payout.remaining > 0 && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handlePayFull(order, payout.rate, payout.commissionAmount)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-950 bg-emerald-400 rounded-md hover:bg-emerald-300 transition-colors disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Pagar
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setModalOrder(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            Ajustar
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

      {liveModalOrder && (
        <MechanicPayoutModal
          uid={uid}
          shop={shop}
          order={liveModalOrder}
          mechanics={mechanics}
          baseRate={effectiveBaseRate}
          onClose={() => setModalOrder(null)}
        />
      )}
    </div>
  );
}

function MechanicPayoutModal({
  uid,
  shop,
  order,
  mechanics,
  baseRate,
  onClose,
}: {
  uid: string;
  shop: Shop;
  order: WorkOrder;
  mechanics: Mechanic[];
  baseRate: number;
  onClose: () => void;
}) {
  const initialPayout = computeMechanicPayout(order, mechanics, baseRate);
  const [rateInput, setRateInput] = useState<string>(String(initialPayout.rate));
  const [paidInput, setPaidInput] = useState<string>(String(initialPayout.paid));
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'VES'>('USD');
  const [saving, setSaving] = useState(false);

  const hasBcv =
    shop.currency === 'USD' && typeof shop.bcvRate === 'number' && shop.bcvRate > 0;
  const bcvRate = hasBcv ? (shop.bcvRate as number) : 0;

  const cleanRate = useMemo(() => {
    const n = Number(rateInput);
    if (!Number.isFinite(n)) return initialPayout.rate;
    return Math.min(100, Math.max(0, Number(n.toFixed(2))));
  }, [rateInput, initialPayout.rate]);

  const targetCommission = Number(((order.laborTotal * cleanRate) / 100).toFixed(2));

  const parsedPaidUsd = useMemo(() => {
    const n = Number(paidInput);
    if (!Number.isFinite(n) || n < 0) return 0;
    if (inputCurrency === 'VES' && hasBcv) {
      return Number((n / bcvRate).toFixed(2));
    }
    return Number(n.toFixed(2));
  }, [paidInput, inputCurrency, hasBcv, bcvRate]);

  const remainingUsd = Math.max(0, Number((targetCommission - parsedPaidUsd).toFixed(2)));
  const targetVes = convertUsdToVes(targetCommission, shop.currency, shop.bcvRate);
  const remainingVes = convertUsdToVes(remainingUsd, shop.currency, shop.bcvRate);

  const handleSetFull = () => {
    if (inputCurrency === 'VES' && hasBcv) {
      setPaidInput(String(Number((targetCommission * bcvRate).toFixed(2))));
    } else {
      setPaidInput(String(targetCommission));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateWorkOrderMechanicPayout(
        uid,
        order.id,
        order.laborTotal,
        cleanRate,
        parsedPaidUsd
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141821] border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-zinc-100">
              Pago al mecánico · {order.orderNumber}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {order.mechanicName || 'Sin mecánico'} · {order.vehicleSummary} ({order.plate})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div className="p-3.5 bg-[#0E1117] border border-zinc-800 rounded-lg space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Mano de obra de la orden</span>
              <span className="font-mono font-medium text-zinc-200 tabular-nums">
                {formatMoney(order.laborTotal, shop.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-1 border-t border-zinc-800">
              <span className="text-zinc-200">Corresponde ({cleanRate}%)</span>
              <span className="font-mono text-amber-400 tabular-nums">
                {formatMoney(targetCommission, shop.currency)}
              </span>
            </div>
            {targetVes !== null && (
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Equivalente BCV</span>
                <span className="font-mono tabular-nums">{formatVES(targetVes)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                % Comisión para este vehículo
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-300">Monto pagado</label>
                {hasBcv && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = inputCurrency === 'USD' ? 'VES' : 'USD';
                      setInputCurrency(next);
                      if (next === 'VES') {
                        setPaidInput(String(Number((parsedPaidUsd * bcvRate).toFixed(2))));
                      } else {
                        setPaidInput(String(parsedPaidUsd));
                      }
                    }}
                    className="text-[11px] font-mono text-amber-400 hover:underline"
                  >
                    En {inputCurrency === 'USD' ? 'Bs.' : 'USD'}
                  </button>
                )}
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs p-3 bg-[#0B0D11] border border-zinc-800 rounded-lg">
            <div>
              <span className="text-zinc-400">Falta por pagar: </span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  remainingUsd > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {formatMoney(remainingUsd, shop.currency)}
              </span>
              {remainingVes !== null && remainingUsd > 0 && (
                <span className="font-mono text-zinc-500 ml-1.5">
                  ({formatVES(remainingVes)})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSetFull}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
            >
              Pagar 100%
            </button>
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
              {saving ? 'Guardando...' : 'Guardar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
