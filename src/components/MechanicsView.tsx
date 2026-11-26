import { useState } from 'react';
import { Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import {
  createMechanic,
  deleteMechanic,
  updateMechanic,
  updateMechanicStatus,
} from '../services/workshopService';
import type { Mechanic, MechanicStatus, WorkOrder } from '../types/workshop';
import { MechanicStatusText } from './StatusIndicator';

interface MechanicsViewProps {
  uid: string;
  mechanics: Mechanic[];
  workOrders: WorkOrder[];
  defaultCommissionRate?: number;
}

export function MechanicsView({
  uid,
  mechanics,
  workOrders,
  defaultCommissionRate = 35,
}: MechanicsViewProps) {
  const [modal, setModal] = useState<{ open: boolean; editing: Mechanic | null }>({
    open: false,
    editing: null,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">
          Administra técnicos, especialidades y asignación de bahías en el taller.
        </p>
        <button
          type="button"
          onClick={() => setModal({ open: true, editing: null })}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo mecánico
        </button>
      </div>

      <div className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
        {mechanics.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-100">Sin mecánicos registrados</p>
            <p className="text-xs text-zinc-400 mt-1">
              Da de alta a tu equipo técnico para asignar órdenes de trabajo y bahías.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-[#0E1117]">
                  <th className="py-3 px-4">Técnico</th>
                  <th className="py-3 px-4">Especialidad</th>
                  <th className="py-3 px-4">Bahía asignada</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">% Mano de obra</th>
                  <th className="py-3 px-4 text-right">Órdenes activas</th>
                  <th className="py-3 px-4 text-right w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-sm">
                {mechanics.map((mech) => {
                  const activeCount = workOrders.filter(
                    (o) =>
                      o.mechanicId === mech.id &&
                      o.status !== 'Entregado' &&
                      o.status !== 'Cancelado'
                  ).length;
                  const hasCustomRate =
                    typeof mech.commissionRate === 'number' &&
                    Number.isFinite(mech.commissionRate);
                  return (
                    <tr key={mech.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-100">{mech.name}</div>
                        <div className="text-xs font-mono text-zinc-400">{mech.phone || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{mech.specialty}</td>
                      <td className="py-3 px-4 text-xs text-zinc-300">{mech.bay || 'Sin asignar'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <MechanicStatusText status={mech.status} />
                          <select
                            aria-label={`Cambiar estado de ${mech.name}`}
                            value={mech.status}
                            onChange={(e) =>
                              void updateMechanicStatus(uid, mech.id, e.target.value as MechanicStatus)
                            }
                            className="px-2 py-1 text-xs bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-200"
                          >
                            <option value="Disponible">Disponible</option>
                            <option value="En Servicio">En Servicio</option>
                            <option value="Descanso">Descanso</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        <span className="font-semibold text-amber-400">
                          {hasCustomRate ? mech.commissionRate : defaultCommissionRate}%
                        </span>
                        <span className="block text-[10px] text-zinc-500">
                          {hasCustomRate ? 'Individual' : 'Base taller'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-zinc-100 tabular-nums">
                        {activeCount}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Editar mecánico"
                            onClick={() => setModal({ open: true, editing: mech })}
                            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Eliminar mecánico"
                            onClick={() => void deleteMechanic(uid, mech.id)}
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

      {modal.open && (
        <MechanicFormModal
          uid={uid}
          editing={modal.editing}
          defaultCommissionRate={defaultCommissionRate}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}
    </div>
  );
}

function MechanicFormModal({
  uid,
  editing,
  defaultCommissionRate,
  onClose,
}: {
  uid: string;
  editing: Mechanic | null;
  defaultCommissionRate: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [specialty, setSpecialty] = useState(editing?.specialty ?? '');
  const [bay, setBay] = useState(editing?.bay ?? 'Bahía 1');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [status, setStatus] = useState<MechanicStatus>(editing?.status ?? 'Disponible');
  const [commissionInput, setCommissionInput] = useState<string>(
    typeof editing?.commissionRate === 'number' ? String(editing.commissionRate) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || specialty.trim().length < 2) return;
    setSaving(true);
    try {
      const parsedComm =
        commissionInput.trim() === '' ? undefined : Number(commissionInput);
      const basePayload = {
        name,
        specialty,
        bay,
        phone,
        status,
      };
      if (editing) {
        await updateMechanic(uid, editing.id, {
          ...basePayload,
          commissionRate:
            typeof parsedComm === 'number' && Number.isFinite(parsedComm) ? parsedComm : null,
        });
      } else {
        await createMechanic(uid, {
          ...basePayload,
          ...(typeof parsedComm === 'number' && Number.isFinite(parsedComm)
            ? { commissionRate: parsedComm }
            : {}),
        });
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
            {editing ? 'Editar mecánico' : 'Nuevo mecánico'}
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
            <label className="block text-xs font-medium text-zinc-300 mb-1">Nombre completo</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Especialidad</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ej. Motor, Diagnóstico electrónico, Suspensión"
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Bahía asignada</label>
              <input
                type="text"
                maxLength={30}
                value={bay}
                onChange={(e) => setBay(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Teléfono</label>
              <input
                type="text"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MechanicStatus)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              >
                <option value="Disponible">Disponible</option>
                <option value="En Servicio">En Servicio</option>
                <option value="Descanso">Descanso</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                % Mano de obra (opcional)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value)}
                placeholder={`Base: ${defaultCommissionRate}%`}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded-lg"
              />
            </div>
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
