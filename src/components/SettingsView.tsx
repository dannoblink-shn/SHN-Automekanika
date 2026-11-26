import { useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { formatBcvDate } from '../services/bcvService';
import { updateShopSettings } from '../services/workshopService';
import { CURRENCIES, formatVES, type CurrencyCode, type Shop } from '../types/workshop';

interface SettingsViewProps {
  uid: string;
  shop: Shop;
  onSyncBcv: () => Promise<void>;
  syncingBcv: boolean;
  bcvError: string | null;
}

export function SettingsView({
  uid,
  shop,
  onSyncBcv,
  syncingBcv,
  bcvError,
}: SettingsViewProps) {
  const [name, setName] = useState(shop.name);
  const [phone, setPhone] = useState(shop.phone);
  const [address, setAddress] = useState(shop.address);
  const [taxRate, setTaxRate] = useState(shop.taxRate);
  const [currency, setCurrency] = useState<CurrencyCode>(shop.currency);
  const [baysCount, setBaysCount] = useState(shop.baysCount);
  const [mechanicCommissionRate, setMechanicCommissionRate] = useState<number>(
    shop.mechanicCommissionRate ?? 35
  );
  const [bcvRateInput, setBcvRateInput] = useState<string>(
    shop.bcvRate ? String(shop.bcvRate) : ''
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    setName(shop.name);
    setPhone(shop.phone);
    setAddress(shop.address);
    setTaxRate(shop.taxRate);
    setCurrency(shop.currency);
    setBaysCount(shop.baysCount);
    setMechanicCommissionRate(shop.mechanicCommissionRate ?? 35);
    if (shop.bcvRate) {
      setBcvRateInput(String(shop.bcvRate));
    }
  }, [shop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setSaving(true);
    setSavedMsg(false);
    try {
      const parsedBcv = Number(bcvRateInput);
      const bcvChanged =
        Number.isFinite(parsedBcv) && parsedBcv > 0 && parsedBcv !== shop.bcvRate;

      await updateShopSettings(uid, {
        name,
        phone,
        address,
        taxRate,
        currency,
        baysCount,
        mechanicCommissionRate,
        ...(bcvChanged
          ? {
              bcvRate: parsedBcv,
              bcvUpdatedAt: new Date().toISOString(),
              bcvSource: 'Ajuste manual',
            }
          : {}),
      });
      setSavedMsg(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* BCV Sync Card */}
      <div className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-100">
              Tasa oficial BCV (Venezuela)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Se utiliza para mostrar el equivalente en Bolívares (Bs.) en presupuestos, órdenes de trabajo y PDFs.
            </p>
          </div>
          <button
            type="button"
            disabled={syncingBcv}
            onClick={() => void onSyncBcv()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingBcv ? 'animate-spin' : ''}`} />
            {syncingBcv ? 'Consultando BCV...' : 'Actualizar tasa BCV'}
          </button>
        </div>

        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-400">Valor vigente</p>
            <p className="mt-1 font-mono text-2xl font-bold text-amber-400 tabular-nums">
              {shop.bcvRate && shop.bcvRate > 0 ? `${formatVES(shop.bcvRate)} / USD` : 'Sin tasa cargada'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {shop.bcvSource || 'Banco Central de Venezuela'} · Actualizado:{' '}
              {formatBcvDate(shop.bcvUpdatedAt)}
            </p>
          </div>
          {bcvError && (
            <p className="text-xs text-red-300 bg-red-950/60 border border-red-900 rounded-lg px-3 py-2">
              {bcvError}
            </p>
          )}
        </div>
      </div>

      {/* Workshop Configuration Form */}
      <div className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="font-display text-base font-semibold text-zinc-100">
            Configuración del taller
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Estos datos aparecen en el encabezado de tus presupuestos y reportes PDF.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Nombre comercial del taller
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="AutoMekanika SHN"
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Teléfono</label>
              <input
                type="text"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+58 412 000 0000"
                className="w-full px-3 py-2 text-sm font-mono bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Dirección</label>
              <input
                type="text"
                maxLength={200}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Caracas / Valencia / Maracaibo, Venezuela"
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Moneda base</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} className="bg-[#141821]">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">IVA (%)</label>
              <input
                type="number"
                min={0}
                max={50}
                step="0.5"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Bahías</label>
              <input
                type="number"
                min={1}
                max={50}
                value={baysCount}
                onChange={(e) => setBaysCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                % Mecánicos
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={mechanicCommissionRate}
                onChange={(e) => setMechanicCommissionRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tasa BCV (Bs.)</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={bcvRateInput}
                onChange={(e) => setBcvRateInput(e.target.value)}
                placeholder="Ej. 922.56"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-4">
            <div>
              {savedMsg && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  Configuración guardada
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
