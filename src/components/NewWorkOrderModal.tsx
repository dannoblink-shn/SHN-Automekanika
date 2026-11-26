import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { createWorkOrder } from '../services/workshopService';
import type {
  Customer,
  Mechanic,
  Vehicle,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
} from '../types/workshop';

interface NewWorkOrderModalProps {
  uid: string;
  customers: Customer[];
  vehicles: Vehicle[];
  mechanics: Mechanic[];
  existingOrders: WorkOrder[];
  onClose: () => void;
  onCreated?: (orderId: string) => void;
}

export function NewWorkOrderModal({
  uid,
  customers,
  vehicles,
  mechanics,
  existingOrders,
  onClose,
  onCreated,
}: NewWorkOrderModalProps) {
  const nextNumber = useMemo(() => {
    const nums = existingOrders
      .map((o) => parseInt(o.orderNumber.replace(/\D/g, ''), 10))
      .filter((n) => Number.isFinite(n));
    const max = nums.length > 0 ? Math.max(...nums) : 1040;
    return `OT-${max + 1}`;
  }, [existingOrders]);

  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const customerVehicles = useMemo(
    () => vehicles.filter((v) => v.customerId === customerId),
    [vehicles, customerId]
  );
  const [vehicleId, setVehicleId] = useState(customerVehicles[0]?.id ?? '');
  const [mechanicId, setMechanicId] = useState(mechanics[0]?.id ?? '');
  const [bay, setBay] = useState(mechanics[0]?.bay ?? 'Bahía 1');
  const [mileageIn, setMileageIn] = useState<number>(customerVehicles[0]?.mileage ?? 0);
  const [priority, setPriority] = useState<WorkOrderPriority>('Normal');
  const [status, setStatus] = useState<WorkOrderStatus>('Recibido');
  const [promisedDate, setPromisedDate] = useState(new Date().toISOString().slice(0, 10));
  const [symptom, setSymptom] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCustomerChange = (newCustomerId: string) => {
    setCustomerId(newCustomerId);
    const matches = vehicles.filter((v) => v.customerId === newCustomerId);
    const first = matches[0];
    setVehicleId(first?.id ?? '');
    setMileageIn(first?.mileage ?? 0);
  };

  const handleVehicleChange = (newVehicleId: string) => {
    setVehicleId(newVehicleId);
    const v = vehicles.find((item) => item.id === newVehicleId);
    if (v) setMileageIn(v.mileage);
  };

  const handleMechanicChange = (newMechanicId: string) => {
    setMechanicId(newMechanicId);
    const m = mechanics.find((item) => item.id === newMechanicId);
    if (m?.bay) setBay(m.bay);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const customer = customers.find((c) => c.id === customerId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const mechanic = mechanics.find((m) => m.id === mechanicId);

    if (!customer) {
      setFormError('Selecciona un cliente registrado.');
      return;
    }
    if (!vehicle) {
      setFormError('El cliente debe tener al menos un vehículo registrado.');
      return;
    }
    if (symptom.trim().length < 2) {
      setFormError('Describe el motivo de ingreso o falla reportada.');
      return;
    }

    setSaving(true);
    try {
      const id = await createWorkOrder(uid, {
        orderNumber: nextNumber,
        customerId: customer.id,
        customerName: customer.name,
        vehicleId: vehicle.id,
        vehicleSummary: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        plate: vehicle.plate,
        mechanicId: mechanic?.id ?? '',
        mechanicName: mechanic?.name ?? 'Sin asignar',
        bay: bay || 'Bahía 1',
        mileageIn,
        symptom: symptom.trim(),
        diagnosis: '',
        priority,
        status,
        promisedDate,
      });
      onCreated?.(id);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear la orden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#141821] border border-zinc-800 rounded-xl w-full max-w-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-100">
              Nueva orden de trabajo
            </h2>
            <p className="text-xs text-amber-400 font-mono mt-0.5">{nextNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          {customers.length === 0 || vehicles.length === 0 ? (
            <div className="p-4 rounded-lg bg-amber-950/50 border border-amber-900/70 text-xs text-amber-200 leading-relaxed">
              Para abrir una orden de trabajo primero registra al menos un cliente y su vehículo en la sección{' '}
              <span className="font-semibold">Clientes y vehículos</span>.
            </div>
          ) : null}

          {formError && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-900 text-xs text-red-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Cliente</label>
              <select
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Seleccionar cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Vehículo</label>
              <select
                value={vehicleId}
                onChange={(e) => handleVehicleChange(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Seleccionar vehículo...</option>
                {customerVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} — {v.year} {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Mecánico asignado
              </label>
              <select
                value={mechanicId}
                onChange={(e) => handleMechanicChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Sin asignar</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.bay || 'Sin bahía'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Bahía</label>
              <input
                type="text"
                value={bay}
                onChange={(e) => setBay(e.target.value)}
                maxLength={30}
                placeholder="Bahía 1"
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Kilometraje ingreso
              </label>
              <input
                type="number"
                min={0}
                max={2000000}
                value={mileageIn}
                onChange={(e) => setMileageIn(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Estado inicial</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkOrderStatus)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="Recibido">Recibido</option>
                <option value="Diagnóstico">Diagnóstico</option>
                <option value="En Reparación">En Reparación</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Prioridad</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="Normal">Normal</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Entrega estimada
              </label>
              <input
                type="date"
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Falla reportada / servicio solicitado
            </label>
            <textarea
              rows={3}
              required
              maxLength={500}
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              placeholder="Ej. Servicio de mantenimiento, revisión de tren delantero, falla de inyección..."
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-300 bg-[#0B0D11] border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || customers.length === 0 || vehicles.length === 0}
              className="px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Guardando...' : 'Crear orden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
