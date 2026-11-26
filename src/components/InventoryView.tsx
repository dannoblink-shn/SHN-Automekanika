import { useMemo, useState } from 'react';
import { Minus, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { adjustPartStock, createPart, deletePart, updatePart } from '../services/workshopService';
import {
  convertUsdToVes,
  formatMoney,
  formatVES,
  PART_CATEGORIES,
  type Part,
  type PartCategory,
  type Shop,
} from '../types/workshop';

interface InventoryViewProps {
  uid: string;
  shop: Shop;
  parts: Part[];
}

export function InventoryView({ uid, shop, parts }: InventoryViewProps) {
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | 'Todas'>('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<{ open: boolean; editing: Part | null }>({
    open: false,
    editing: null,
  });

  const filteredParts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return parts.filter((p) => {
      if (categoryFilter !== 'Todas' && p.category !== categoryFilter) return false;
      if (stockFilter === 'low' && !(p.stock > 0 && p.stock <= p.minStock)) return false;
      if (stockFilter === 'out' && p.stock !== 0) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
      );
    });
  }, [parts, categoryFilter, stockFilter, searchTerm]);

  const lowCount = parts.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const outCount = parts.filter((p) => p.stock === 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#141821] border border-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                stockFilter === 'all'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todos ({parts.length})
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                stockFilter === 'low'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Stock bajo ({lowCount})
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('out')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                stockFilter === 'out'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sin stock ({outCount})
            </button>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as PartCategory | 'Todas')}
            className="px-3 py-2 text-xs font-medium bg-[#141821] text-zinc-200 border border-zinc-800 rounded-lg"
          >
            <option value="Todas">Todas las categorías</option>
            {PART_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar SKU, nombre, estante..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#141821] text-zinc-100 placeholder:text-zinc-500 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setModal({ open: true, editing: null })}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nuevo repuesto
          </button>
        </div>
      </div>

      <div className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
        {filteredParts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-100">
              {parts.length === 0 ? 'Inventario vacío' : 'Sin coincidencias'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Agrega filtros, lubricantes, pastillas y repuestos para asignarlos a órdenes y presupuestos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-[#0E1117]">
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Repuesto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Ubicación</th>
                  <th className="py-3 px-4 text-right">Costo</th>
                  <th className="py-3 px-4 text-right">Precio venta</th>
                  <th className="py-3 px-4 text-center">Existencia</th>
                  <th className="py-3 px-4 text-right w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-sm">
                {filteredParts.map((part) => {
                  const isOut = part.stock === 0;
                  const isLow = part.stock > 0 && part.stock <= part.minStock;
                  const saleVes = convertUsdToVes(part.salePrice, shop.currency, shop.bcvRate);
                  return (
                    <tr key={part.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-amber-400 whitespace-nowrap">
                        {part.sku}
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-100">{part.name}</td>
                      <td className="py-3 px-4 text-xs text-zinc-400">{part.category}</td>
                      <td className="py-3 px-4 font-mono text-xs text-zinc-400">
                        {part.location || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                        {formatMoney(part.costPrice, shop.currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-xs font-semibold text-zinc-100">
                          {formatMoney(part.salePrice, shop.currency)}
                        </div>
                        {saleVes !== null && (
                          <div className="text-[11px] text-zinc-400">{formatVES(saleVes)}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            aria-label="Restar unidad"
                            disabled={part.stock <= 0}
                            onClick={() => void adjustPartStock(uid, part.id, Math.max(0, part.stock - 1))}
                            className="p-1 text-zinc-400 hover:text-zinc-100 border border-zinc-700 rounded hover:bg-zinc-800 disabled:opacity-40"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span
                            className={`font-mono text-xs font-semibold tabular-nums min-w-[42px] text-center ${
                              isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-zinc-100'
                            }`}
                          >
                            {part.stock}
                          </span>
                          <button
                            type="button"
                            aria-label="Sumar unidad"
                            onClick={() => void adjustPartStock(uid, part.id, part.stock + 1)}
                            className="p-1 text-zinc-400 hover:text-zinc-100 border border-zinc-700 rounded hover:bg-zinc-800"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Editar repuesto"
                            onClick={() => setModal({ open: true, editing: part })}
                            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Eliminar repuesto"
                            onClick={() => void deletePart(uid, part.id)}
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
        <PartFormModal
          uid={uid}
          editing={modal.editing}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}
    </div>
  );
}

function PartFormModal({
  uid,
  editing,
  onClose,
}: {
  uid: string;
  editing: Part | null;
  onClose: () => void;
}) {
  const [sku, setSku] = useState(editing?.sku ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState<PartCategory>(editing?.category ?? 'Filtros');
  const [stock, setStock] = useState(editing?.stock ?? 0);
  const [minStock, setMinStock] = useState(editing?.minStock ?? 2);
  const [costPrice, setCostPrice] = useState(editing?.costPrice ?? 0);
  const [salePrice, setSalePrice] = useState(editing?.salePrice ?? 0);
  const [location, setLocation] = useState(editing?.location ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || name.trim().length < 2) return;
    setSaving(true);
    try {
      const payload = { sku, name, category, stock, minStock, costPrice, salePrice, location };
      if (editing) {
        await updatePart(uid, editing.id, payload);
      } else {
        await createPart(uid, payload);
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
            {editing ? 'Editar repuesto' : 'Nuevo repuesto'}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">SKU / Código</label>
              <input
                type="text"
                required
                maxLength={40}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Nombre del repuesto
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PartCategory)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              >
                {PART_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Ubicación en almacén
              </label>
              <input
                type="text"
                maxLength={40}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Estante A-2"
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Stock actual</label>
              <input
                type="number"
                required
                min={0}
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Stock mínimo</label>
              <input
                type="number"
                required
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Costo</label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Precio venta</label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg"
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
