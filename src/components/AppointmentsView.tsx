import { useMemo, useState } from 'react';
import { ArrowRight, Calendar, Plus, Trash2, X } from 'lucide-react';
import {
  convertAppointmentToWorkOrder,
  createAppointment,
  deleteAppointment,
  updateAppointmentStatus,
} from '../services/workshopService';
import type {
  Appointment,
  AppointmentStatus,
  Customer,
  Vehicle,
  WorkOrder,
} from '../types/workshop';
import { AppointmentStatusText } from './StatusIndicator';

interface AppointmentsViewProps {
  uid: string;
  appointments: Appointment[];
  customers: Customer[];
  vehicles: Vehicle[];
  existingOrders: WorkOrder[];
  onOrderCreatedFromAppointment: (orderId: string) => void;
}

export function AppointmentsView({
  uid,
  appointments,
  customers,
  vehicles,
  existingOrders,
  onOrderCreatedFromAppointment,
}: AppointmentsViewProps) {
  const [filter, setFilter] = useState<AppointmentStatus | 'Todas'>('Todas');
  const [showModal, setShowModal] = useState(false);

  const sorted = useMemo(() => {
    return appointments
      .filter((a) => filter === 'Todas' || a.status === filter)
      .sort((a, b) =>
        `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`)
      );
  }, [appointments, filter]);

  const nextOrderNumber = useMemo(() => {
    const nums = existingOrders
      .map((o) => parseInt(o.orderNumber.replace(/\D/g, ''), 10))
      .filter((n) => Number.isFinite(n));
    const max = nums.length > 0 ? Math.max(...nums) : 1040;
    return `OT-${max + 1}`;
  }, [existingOrders]);

  const handleConvert = async (apt: Appointment) => {
    const veh = vehicles.find((v) => v.id === apt.vehicleId);
    const id = await convertAppointmentToWorkOrder(uid, apt, veh, nextOrderNumber);
    onOrderCreatedFromAppointment(id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#141821] border border-zinc-800 rounded-lg overflow-x-auto">
          {(['Todas', 'Programada', 'Confirmada', 'En Taller', 'Completada', 'Cancelada'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filter === st
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {st}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={customers.length === 0 || vehicles.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Agendar cita
        </button>
      </div>

      <div className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-100">Sin citas registradas</p>
            <p className="text-xs text-zinc-400 mt-1">
              Programa los próximos ingresos de vehículos por fecha, hora y bahía.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-[#0E1117]">
                  <th className="py-3 px-4">Fecha y hora</th>
                  <th className="py-3 px-4">Vehículo / Cliente</th>
                  <th className="py-3 px-4">Servicio solicitado</th>
                  <th className="py-3 px-4">Bahía</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-sm">
                {sorted.map((apt) => {
                  const isTerminal = apt.status === 'Completada' || apt.status === 'Cancelada';
                  return (
                    <tr key={apt.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-zinc-100 tabular-nums whitespace-nowrap">
                        <div>{apt.scheduledDate}</div>
                        <div className="text-zinc-400">{apt.scheduledTime} hrs</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-100">{apt.vehicleSummary}</div>
                        <div className="text-xs text-zinc-400">
                          <span className="font-mono">{apt.plate}</span> · {apt.customerName}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-zinc-100">{apt.serviceType}</div>
                        {apt.notes && (
                          <div className="text-xs text-zinc-400 truncate max-w-[240px]">
                            {apt.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-zinc-300 whitespace-nowrap">
                        {apt.bay || 'Por asignar'}
                      </td>
                      <td className="py-3 px-4">
                        <AppointmentStatusText status={apt.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {!isTerminal && apt.status === 'Programada' && (
                            <button
                              type="button"
                              onClick={() => void updateAppointmentStatus(uid, apt.id, 'Confirmada')}
                              className="px-2.5 py-1 text-xs font-medium text-zinc-200 border border-zinc-700 rounded-md hover:bg-zinc-800"
                            >
                              Confirmar
                            </button>
                          )}
                          {(apt.status === 'Programada' || apt.status === 'Confirmada') && (
                            <button
                              type="button"
                              onClick={() => void handleConvert(apt)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-md hover:bg-amber-300"
                            >
                              Ingresar a OT
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label="Eliminar cita"
                            onClick={() => void deleteAppointment(uid, apt.id)}
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
        )}
      </div>

      {showModal && (
        <AppointmentFormModal
          uid={uid}
          customers={customers}
          vehicles={vehicles}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function AppointmentFormModal({
  uid,
  customers,
  vehicles,
  onClose,
}: {
  uid: string;
  customers: Customer[];
  vehicles: Vehicle[];
  onClose: () => void;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const customerVehicles = useMemo(
    () => vehicles.filter((v) => v.customerId === customerId),
    [vehicles, customerId]
  );
  const [vehicleId, setVehicleId] = useState(customerVehicles[0]?.id ?? '');
  const [serviceType, setServiceType] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [bay, setBay] = useState('Bahía 1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    const first = vehicles.find((v) => v.customerId === id);
    setVehicleId(first?.id ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === customerId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!customer || !vehicle || serviceType.trim().length < 2) return;

    setSaving(true);
    try {
      await createAppointment(uid, {
        customerId: customer.id,
        customerName: customer.name,
        vehicleId: vehicle.id,
        vehicleSummary: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        plate: vehicle.plate,
        serviceType,
        scheduledDate,
        scheduledTime,
        bay,
        notes,
        status: 'Programada',
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#141821] border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-zinc-100">Agendar cita</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Cliente</label>
              <select
                required
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Vehículo</label>
              <select
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              >
                {customerVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} — {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Servicio solicitado</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              placeholder="Ej. Entonación, cambio de aceite, revisión de frenos..."
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Fecha</label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Hora</label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Bahía</label>
              <input
                type="text"
                maxLength={30}
                value={bay}
                onChange={(e) => setBay(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Notas</label>
            <textarea
              rows={2}
              maxLength={400}
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
              disabled={saving || !vehicleId}
              className="px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Agendar cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
