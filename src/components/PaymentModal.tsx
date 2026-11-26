import { useMemo, useState } from 'react';
import { CheckCircle2, Wallet, X } from 'lucide-react';
import {
  computePaymentSummary,
  convertUsdToVes,
  formatMoney,
  formatVES,
  type Shop,
} from '../types/workshop';

interface PaymentModalProps {
  shop: Shop;
  docTypeLabel: 'Presupuesto' | 'Orden de trabajo';
  docNumber: string;
  customerName: string;
  vehicleSummary: string;
  totalAmount: number;
  currentAmountPaid?: number;
  currentPaymentNotes?: string;
  onSave: (amountPaid: number, paymentNotes: string) => Promise<void>;
  onClose: () => void;
}

export function PaymentModal({
  shop,
  docTypeLabel,
  docNumber,
  customerName,
  vehicleSummary,
  totalAmount,
  currentAmountPaid = 0,
  currentPaymentNotes = '',
  onSave,
  onClose,
}: PaymentModalProps) {
  const initialSummary = computePaymentSummary(totalAmount, currentAmountPaid);

  const [mode, setMode] = useState<'add' | 'set'>(initialSummary.paid > 0 && initialSummary.remaining > 0 ? 'add' : initialSummary.paid === 0 ? 'add' : 'set');
  const [inputAmount, setInputAmount] = useState<string>(
    initialSummary.remaining > 0 && mode === 'add' ? '' : String(initialSummary.paid)
  );
  const [inputCurrency, setInputCurrency] = useState<'SHOP' | 'VES'>('SHOP');
  const [notes, setNotes] = useState(currentPaymentNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUseBcvInput = shop.currency === 'USD' && Boolean(shop.bcvRate && shop.bcvRate > 0);

  const parsedShopAmount = useMemo(() => {
    const raw = Number(inputAmount);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    if (inputCurrency === 'VES' && canUseBcvInput && shop.bcvRate) {
      return Number((raw / shop.bcvRate).toFixed(2));
    }
    return Number(raw.toFixed(2));
  }, [inputAmount, inputCurrency, canUseBcvInput, shop.bcvRate]);

  const projectedPaid = useMemo(() => {
    if (mode === 'add') {
      return Number((initialSummary.paid + parsedShopAmount).toFixed(2));
    }
    return parsedShopAmount;
  }, [mode, initialSummary.paid, parsedShopAmount]);

  const projected = computePaymentSummary(totalAmount, projectedPaid);

  const totalVes = convertUsdToVes(totalAmount, shop.currency, shop.bcvRate);
  const paidVes = convertUsdToVes(projected.paid, shop.currency, shop.bcvRate);
  const remVes = convertUsdToVes(projected.remaining, shop.currency, shop.bcvRate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(projected.paid, notes.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkFullPaid = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave(Number(totalAmount.toFixed(2)), notes.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar como pagado.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#141821] border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 bg-[#0E1117] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="font-display text-base font-semibold text-zinc-100 truncate">
                Control de cobro · {docNumber}
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">
              {docTypeLabel} · {customerName} · {vehicleSummary}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar control de cobro"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/70 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Current / Projected Balance Strip */}
          <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#0E1117] border border-zinc-800 rounded-lg">
            <div>
              <p className="text-[11px] text-zinc-400">Total</p>
              <p className="font-mono text-sm font-semibold text-zinc-100 tabular-nums mt-0.5">
                {formatMoney(totalAmount, shop.currency)}
              </p>
              {totalVes !== null && (
                <p className="font-mono text-[11px] text-zinc-500 tabular-nums">
                  {formatVES(totalVes)}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-zinc-400">Abonado</p>
              <p className="font-mono text-sm font-semibold text-emerald-400 tabular-nums mt-0.5">
                {formatMoney(projected.paid, shop.currency)}
              </p>
              {paidVes !== null && (
                <p className="font-mono text-[11px] text-zinc-500 tabular-nums">
                  {formatVES(paidVes)}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-zinc-400">Falta por cancelar</p>
              <p
                className={`font-mono text-sm font-semibold tabular-nums mt-0.5 ${
                  projected.remaining > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {formatMoney(projected.remaining, shop.currency)}
              </p>
              {remVes !== null && (
                <p className="font-mono text-[11px] text-zinc-500 tabular-nums">
                  {formatVES(remVes)}
                </p>
              )}
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-[#0B0D11] border border-zinc-800 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setMode('add');
                  setInputAmount('');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'add'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sumar nuevo abono
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('set');
                  setInputCurrency('SHOP');
                  setInputAmount(String(initialSummary.paid));
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'set'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Editar total abonado
              </button>
            </div>

            {initialSummary.remaining > 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleMarkFullPaid()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-800/70 rounded-lg hover:bg-emerald-950 transition-colors whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marcar Pagado (100%)
              </button>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-zinc-300">
                {mode === 'add'
                  ? 'Monto del abono a sumar'
                  : 'Monto total abonado acumulado'}
              </label>
              {canUseBcvInput && (
                <div className="flex items-center gap-1 p-0.5 bg-[#0B0D11] border border-zinc-800 rounded-md">
                  <button
                    type="button"
                    onClick={() => setInputCurrency('SHOP')}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded ${
                      inputCurrency === 'SHOP'
                        ? 'bg-zinc-800 text-amber-400'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputCurrency('VES')}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded ${
                      inputCurrency === 'VES'
                        ? 'bg-zinc-800 text-amber-400'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Bs. (BCV)
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                step="0.01"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder={inputCurrency === 'VES' ? '0.00 Bs.' : '0.00'}
                className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded-lg focus:outline-none focus:border-amber-400"
              />
              {mode === 'add' && initialSummary.remaining > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (inputCurrency === 'VES' && shop.bcvRate) {
                      setInputAmount((initialSummary.remaining * shop.bcvRate).toFixed(2));
                    } else {
                      setInputAmount(initialSummary.remaining.toFixed(2));
                    }
                  }}
                  className="px-3 py-2 text-xs font-medium text-zinc-300 bg-[#0B0D11] border border-zinc-700 rounded-lg hover:bg-zinc-800 whitespace-nowrap"
                >
                  Restante exacto
                </button>
              )}
            </div>

            {inputCurrency === 'VES' && shop.bcvRate && parsedShopAmount > 0 && (
              <p className="text-[11px] font-mono text-zinc-400">
                Equivalente a {formatMoney(parsedShopAmount, shop.currency)} a tasa BCV Bs.{' '}
                {shop.bcvRate.toFixed(2)}
              </p>
            )}
          </div>

          {/* Payment Notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Referencia o método de pago (opcional)
            </label>
            <input
              type="text"
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Pago Móvil ref. 4821, Zelle, Efectivo USD..."
              className="w-full px-3 py-2 text-sm bg-[#0B0D11] text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded-lg focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
            {initialSummary.paid > 0 ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setMode('set');
                  setInputCurrency('SHOP');
                  setInputAmount('0');
                }}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                Reiniciar a $0
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-3">
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
                className="px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap"
              >
                {saving ? 'Guardando...' : 'Guardar cobro'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
