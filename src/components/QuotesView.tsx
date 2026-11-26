import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  FileDown,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { generateQuotePdfReport } from '../services/pdfReportService';
import {
  convertQuoteToWorkOrder,
  deleteQuote,
  getQuoteItemsOnce,
  saveQuoteWithItems,
  updateQuotePayment,
  updateQuoteStatus,
  type QuoteDraftItem,
} from '../services/workshopService';
import {
  computePaymentSummary,
  convertUsdToVes,
  formatMoney,
  formatVES,
  QUOTE_STATUSES,
  type Customer,
  type Part,
  type Quote,
  type QuoteItem,
  type QuoteStatus,
  type Shop,
  type Vehicle,
  type WorkOrder,
} from '../types/workshop';
import { PaymentModal } from './PaymentModal';
import { PaymentStatusText, QuoteStatusText } from './StatusIndicator';

interface QuotesViewProps {
  uid: string;
  shop: Shop;
  quotes: Quote[];
  customers: Customer[];
  vehicles: Vehicle[];
  parts: Part[];
  existingOrders: WorkOrder[];
  onOrderConverted: (orderId: string) => void;
}

export function QuotesView({
  uid,
  shop,
  quotes,
  customers,
  vehicles,
  parts,
  existingOrders,
  onOrderConverted,
}: QuotesViewProps) {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'Todos'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [editorState, setEditorState] = useState<{
    open: boolean;
    editingQuote: Quote | null;
    initialItems: QuoteItem[];
  }>({ open: false, editingQuote: null, initialItems: [] });
  const [paymentQuote, setPaymentQuote] = useState<Quote | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredQuotes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (statusFilter !== 'Todos' && quote.status !== statusFilter) return false;
      if (!q) return true;
      return (
        quote.quoteNumber.toLowerCase().includes(q) ||
        quote.customerName.toLowerCase().includes(q) ||
        quote.vehicleSummary.toLowerCase().includes(q) ||
        quote.plate.toLowerCase().includes(q)
      );
    });
  }, [quotes, statusFilter, searchTerm]);

  const nextQuoteNumber = useMemo(() => {
    const nums = quotes
      .map((q) => parseInt(q.quoteNumber.replace(/\D/g, ''), 10))
      .filter((n) => Number.isFinite(n));
    const max = nums.length > 0 ? Math.max(...nums) : 2000;
    return `P-${max + 1}`;
  }, [quotes]);

  const nextOrderNumber = useMemo(() => {
    const nums = existingOrders
      .map((o) => parseInt(o.orderNumber.replace(/\D/g, ''), 10))
      .filter((n) => Number.isFinite(n));
    const max = nums.length > 0 ? Math.max(...nums) : 1040;
    return `OT-${max + 1}`;
  }, [existingOrders]);

  const handleOpenEdit = async (quote: Quote) => {
    setBusyId(quote.id);
    try {
      const items = await getQuoteItemsOnce(uid, quote.id);
      setEditorState({ open: true, editingQuote: quote, initialItems: items });
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadPdf = async (quote: Quote) => {
    setBusyId(quote.id);
    try {
      const items = await getQuoteItemsOnce(uid, quote.id);
      await generateQuotePdfReport({ shop, quote, items });
    } finally {
      setBusyId(null);
    }
  };

  const handleConvert = async (quote: Quote) => {
    setBusyId(quote.id);
    try {
      const items = await getQuoteItemsOnce(uid, quote.id);
      const orderId = await convertQuoteToWorkOrder(uid, quote, items, nextOrderNumber);
      onOrderConverted(orderId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#141821] border border-zinc-800 rounded-lg overflow-x-auto">
          {(['Todos', ...QUOTE_STATUSES] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar folio, cliente, placa..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#141821] border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setEditorState({ open: true, editingQuote: null, initialItems: [] })
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Crear presupuesto
          </button>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden">
        {filteredQuotes.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
            <h3 className="font-display text-sm font-semibold text-zinc-100">
              {quotes.length === 0
                ? 'Aún no hay presupuestos creados'
                : 'Sin coincidencias para este filtro'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              Arma cotizaciones de {shop.name || 'AutoMekanika SHN'} agregando repuestos 1 por 1 con su costo interno y precio de venta, registra abonos y exporta el PDF sin mostrar costos.
            </p>
            {quotes.length === 0 && (
              <button
                type="button"
                onClick={() =>
                  setEditorState({ open: true, editingQuote: null, initialItems: [] })
                }
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Crear primer presupuesto
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-[#0E1117]">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Cliente / Vehículo</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Cobro / Saldo</th>
                  <th className="py-3 px-4 text-right">Mano de obra</th>
                  <th className="py-3 px-4 text-right">Repuestos</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-sm">
                {filteredQuotes.map((quote) => {
                  const isConverted = quote.status === 'Convertido';
                  const isRejected = quote.status === 'Rechazado';
                  const isBusy = busyId === quote.id;
                  const totalVes = convertUsdToVes(quote.totalAmount, shop.currency, shop.bcvRate);
                  const payment = computePaymentSummary(quote.totalAmount, quote.amountPaid);

                  return (
                    <tr key={quote.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-amber-400">
                          {quote.quoteNumber}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-500 mt-0.5">
                          {quote.validUntil || '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-100 truncate max-w-[200px]">
                          {quote.customerName}
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                          <span className="truncate max-w-[150px]">{quote.vehicleSummary}</span>
                          {quote.plate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-zinc-300">{quote.plate}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isConverted ? (
                          <QuoteStatusText status={quote.status} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <QuoteStatusText status={quote.status} />
                            <select
                              aria-label={`Estado de ${quote.quoteNumber}`}
                              value={quote.status}
                              onChange={(e) =>
                                void updateQuoteStatus(uid, quote.id, e.target.value as QuoteStatus)
                              }
                              className="px-2 py-1 text-xs bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-200"
                            >
                              <option value="Borrador">Borrador</option>
                              <option value="Enviado">Enviado</option>
                              <option value="Aprobado">Aprobado</option>
                              <option value="Rechazado">Rechazado</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <PaymentStatusText status={payment.status} />
                        <div className="text-[11px] font-mono tabular-nums mt-0.5 text-zinc-400">
                          {payment.status === 'Pagado' ? (
                            <span className="text-emerald-400/90">
                              Abonado: {formatMoney(payment.paid, shop.currency)}
                            </span>
                          ) : payment.paid > 0 ? (
                            <span>
                              Abono: {formatMoney(payment.paid, shop.currency)} ·{' '}
                              <span className="text-amber-400">
                                Falta: {formatMoney(payment.remaining, shop.currency)}
                              </span>
                            </span>
                          ) : (
                            <span>Falta: {formatMoney(payment.remaining, shop.currency)}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-zinc-300 tabular-nums whitespace-nowrap">
                        {formatMoney(quote.laborTotal, shop.currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-zinc-300 tabular-nums whitespace-nowrap">
                        {formatMoney(quote.partsTotal, shop.currency)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-zinc-100 tabular-nums">
                          {formatMoney(quote.totalAmount, shop.currency)}
                        </div>
                        {totalVes !== null && (
                          <div className="font-mono text-[11px] text-zinc-400 tabular-nums mt-0.5">
                            {formatVES(totalVes)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {!isRejected && (
                            <button
                              type="button"
                              onClick={() => setPaymentQuote(quote)}
                              title="Registrar pago o abono del cliente"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-800/70 rounded-md hover:bg-emerald-950 transition-colors"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              Cobro
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDownloadPdf(quote)}
                            title="Descargar PDF"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 rounded-md hover:bg-zinc-800 disabled:opacity-50"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            PDF
                          </button>

                          {!isConverted && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleConvert(quote)}
                              title="Convertir a Orden de Trabajo"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-md hover:bg-amber-300 disabled:opacity-50"
                            >
                              Pasar a OT
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          {!isConverted && (
                            <button
                              type="button"
                              aria-label="Editar presupuesto"
                              disabled={isBusy}
                              onClick={() => void handleOpenEdit(quote)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!isConverted && (
                            <button
                              type="button"
                              aria-label="Eliminar presupuesto"
                              onClick={() => void deleteQuote(uid, quote.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-400 rounded-md hover:bg-red-950/50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {editorState.open && (
        <QuoteEditorModal
          uid={uid}
          shop={shop}
          customers={customers}
          vehicles={vehicles}
          parts={parts}
          defaultQuoteNumber={nextQuoteNumber}
          editingQuote={editorState.editingQuote}
          initialItems={editorState.initialItems}
          onClose={() =>
            setEditorState({ open: false, editingQuote: null, initialItems: [] })
          }
        />
      )}

      {paymentQuote && (
        <PaymentModal
          shop={shop}
          docTypeLabel="Presupuesto"
          docNumber={paymentQuote.quoteNumber}
          customerName={paymentQuote.customerName}
          vehicleSummary={paymentQuote.vehicleSummary}
          totalAmount={paymentQuote.totalAmount}
          currentAmountPaid={paymentQuote.amountPaid}
          currentPaymentNotes={paymentQuote.paymentNotes}
          onSave={(paid, paymentNotes) =>
            updateQuotePayment(uid, paymentQuote.id, paymentQuote.totalAmount, paid, paymentNotes)
          }
          onClose={() => setPaymentQuote(null)}
        />
      )}
    </div>
  );
}

interface QuoteEditorModalProps {
  uid: string;
  shop: Shop;
  customers: Customer[];
  vehicles: Vehicle[];
  parts: Part[];
  defaultQuoteNumber: string;
  editingQuote: Quote | null;
  initialItems: QuoteItem[];
  onClose: () => void;
}

function QuoteEditorModal({
  uid,
  shop,
  customers,
  vehicles,
  parts,
  defaultQuoteNumber,
  editingQuote,
  initialItems,
  onClose,
}: QuoteEditorModalProps) {
  const defaultValidity = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  }, []);

  const [customerId, setCustomerId] = useState(editingQuote?.customerId ?? '');
  const [customerName, setCustomerName] = useState(editingQuote?.customerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(editingQuote?.customerPhone ?? '');
  const [vehicleId, setVehicleId] = useState(editingQuote?.vehicleId ?? '');
  const [vehicleSummary, setVehicleSummary] = useState(editingQuote?.vehicleSummary ?? '');
  const [plate, setPlate] = useState(editingQuote?.plate ?? '');
  const [validUntil, setValidUntil] = useState(editingQuote?.validUntil ?? defaultValidity);
  const [status, setStatus] = useState<QuoteStatus>(editingQuote?.status ?? 'Borrador');
  const [notes, setNotes] = useState(editingQuote?.notes ?? '');
  const [amountPaid, setAmountPaid] = useState<number>(editingQuote?.amountPaid ?? 0);
  const [paymentNotes, setPaymentNotes] = useState<string>(editingQuote?.paymentNotes ?? '');

  const [items, setItems] = useState<QuoteDraftItem[]>(() =>
    initialItems.map((it) => ({
      id: it.id,
      type: it.type,
      partId: it.partId,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      costPrice: it.costPrice ?? 0,
    }))
  );

  // Separate 1-by-1 inputs for Repuestos (with internal Costo + client Sale Price)
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partDesc, setPartDesc] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [partCostPrice, setPartCostPrice] = useState(0);
  const [partSalePrice, setPartSalePrice] = useState(0);

  // Separate 1-by-1 inputs for Trabajos (Mano de Obra)
  const [laborDesc, setLaborDesc] = useState('');
  const [laborQty, setLaborQty] = useState(1);
  const [laborPrice, setLaborPrice] = useState(0);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customerVehicles = useMemo(
    () => (customerId ? vehicles.filter((v) => v.customerId === customerId) : []),
    [vehicles, customerId]
  );

  useEffect(() => {
    if (editingQuote) return;
    if (customers.length > 0 && !customerId && !customerName) {
      // Leave blank by default
    }
  }, [customers, customerId, customerName, editingQuote]);

  const handleSelectCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find((item) => item.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone);
      const firstVeh = vehicles.find((v) => v.customerId === c.id);
      if (firstVeh) {
        setVehicleId(firstVeh.id);
        setVehicleSummary(`${firstVeh.year} ${firstVeh.make} ${firstVeh.model}`);
        setPlate(firstVeh.plate);
      } else {
        setVehicleId('');
        setVehicleSummary('');
        setPlate('');
      }
    } else {
      setVehicleId('');
    }
  };

  const handleSelectVehicle = (id: string) => {
    setVehicleId(id);
    const v = vehicles.find((item) => item.id === id);
    if (v) {
      setVehicleSummary(`${v.year} ${v.make} ${v.model}`);
      setPlate(v.plate);
    }
  };

  const handlePickInventoryPart = (id: string) => {
    setSelectedPartId(id);
    const p = parts.find((item) => item.id === id);
    if (p) {
      setPartDesc(p.name);
      setPartCostPrice(p.costPrice);
      setPartSalePrice(p.salePrice);
    }
  };

  const handleAddPartOneByOne = () => {
    if (partDesc.trim().length < 2) return;
    setItems((prev) => [
      ...prev,
      {
        type: 'Repuesto',
        partId: selectedPartId,
        description: partDesc.trim(),
        quantity: Math.max(0.01, Number(partQty) || 1),
        costPrice: Math.max(0, Number(partCostPrice) || 0),
        unitPrice: Math.max(0, Number(partSalePrice) || 0),
      },
    ]);
    setSelectedPartId('');
    setPartDesc('');
    setPartQty(1);
    setPartCostPrice(0);
    setPartSalePrice(0);
  };

  const handleAddLaborOneByOne = () => {
    if (laborDesc.trim().length < 2) return;
    setItems((prev) => [
      ...prev,
      {
        type: 'Mano de Obra',
        partId: '',
        description: laborDesc.trim(),
        quantity: Math.max(0.01, Number(laborQty) || 1),
        costPrice: 0,
        unitPrice: Math.max(0, Number(laborPrice) || 0),
      },
    ]);
    setLaborDesc('');
    setLaborQty(1);
    setLaborPrice(0);
  };

  const handleUpdateItemField = (
    index: number,
    field: 'quantity' | 'unitPrice' | 'costPrice' | 'description',
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItemAt = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const partRows = items
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.type === 'Repuesto');

  const laborRows = items
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.type === 'Mano de Obra');

  const totals = useMemo(() => {
    let laborTotal = 0;
    let partsTotal = 0;
    let partsCostTotal = 0;
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      const sub = qty * (Number(it.unitPrice) || 0);
      if (it.type === 'Mano de Obra') {
        laborTotal += sub;
      } else {
        partsTotal += sub;
        partsCostTotal += qty * (Number(it.costPrice) || 0);
      }
    }
    const subtotal = laborTotal + partsTotal;
    const taxAmount = Number(((subtotal * shop.taxRate) / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));
    const partsProfit = Number((partsTotal - partsCostTotal).toFixed(2));
    return {
      laborTotal,
      partsTotal,
      partsCostTotal: Number(partsCostTotal.toFixed(2)),
      partsProfit,
      taxAmount,
      totalAmount,
    };
  }, [items, shop.taxRate]);

  const totalVes = convertUsdToVes(totals.totalAmount, shop.currency, shop.bcvRate);
  const paymentSummary = computePaymentSummary(totals.totalAmount, amountPaid);

  const handleSave = async (downloadPdfAfter: boolean) => {
    setFormError(null);
    if (customerName.trim().length < 2) {
      setFormError('Ingresa el nombre del cliente o selecciona uno existente.');
      return;
    }
    if (vehicleSummary.trim().length < 2) {
      setFormError('Ingresa el vehículo (ej. 2021 Toyota Corolla) o selecciona uno existente.');
      return;
    }
    if (items.length === 0) {
      setFormError('Agrega al menos un repuesto o trabajo antes de guardar el presupuesto.');
      return;
    }

    setSaving(true);
    try {
      const quoteNumber = editingQuote?.quoteNumber ?? defaultQuoteNumber;
      const savedId = await saveQuoteWithItems(
        uid,
        shop.taxRate,
        {
          id: editingQuote?.id,
          quoteNumber,
          customerId,
          customerName,
          customerPhone,
          vehicleId,
          vehicleSummary,
          plate,
          validUntil,
          notes,
          status,
          amountPaid,
          paymentNotes,
        },
        items,
        initialItems.map((it) => it.id)
      );

      if (downloadPdfAfter) {
        const fakeQuote: Quote = {
          id: savedId,
          ownerId: uid,
          quoteNumber,
          customerId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          vehicleId,
          vehicleSummary: vehicleSummary.trim(),
          plate: plate.trim().toUpperCase(),
          validUntil,
          notes: notes.trim(),
          status,
          convertedOrderId: '',
          laborTotal: totals.laborTotal,
          partsTotal: totals.partsTotal,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          amountPaid: paymentSummary.paid,
          paymentStatus: paymentSummary.status,
          paymentNotes: paymentNotes.trim(),
        };
        const pdfItems: QuoteItem[] = items.map((it, idx) => ({
          id: it.id ?? `tmp_${idx}`,
          ownerId: uid,
          quoteId: savedId,
          type: it.type,
          partId: it.partId,
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          subtotal: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
        }));
        await generateQuotePdfReport({ shop, quote: fakeQuote, items: pdfItems });
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar el presupuesto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#141821] border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* German tricolor precision line */}
        <div className="h-[3px] flex w-full shrink-0">
          <div className="flex-1 bg-zinc-950" />
          <div className="flex-1 bg-red-600" />
          <div className="flex-1 bg-amber-400" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-[#0E1117] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-base font-semibold text-zinc-100">
                {editingQuote
                  ? `Editar presupuesto ${editingQuote.quoteNumber}`
                  : `Nuevo presupuesto · ${defaultQuoteNumber}`}
              </h2>
              <span className="text-xs font-mono text-amber-400">
                {shop.name || 'AutoMekanika SHN'}
              </span>
              {shop.bcvRate && shop.bcvRate > 0 && (
                <span className="text-xs font-mono text-zinc-400 tabular-nums">
                  · Tasa BCV: Bs. {shop.bcvRate.toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Agrega repuestos 1 por 1 con su costo interno y precio de venta (el costo no aparece en el PDF).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar editor"
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/70 text-xs text-red-300">
              {formError}
            </div>
          )}

          {/* Client & Vehicle Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 p-4 bg-[#0E1117] border border-zinc-800 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-zinc-200">Datos del cliente</h3>
                {customers.length > 0 && (
                  <select
                    value={customerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-200 max-w-[190px]"
                  >
                    <option value="">Cliente nuevo / manual</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del cliente *"
                  className="px-3 py-1.5 text-sm bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  maxLength={30}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Teléfono"
                  className="px-3 py-1.5 text-sm font-mono bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="space-y-3 p-4 bg-[#0E1117] border border-zinc-800 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-zinc-200">Datos del vehículo</h3>
                {customerVehicles.length > 0 && (
                  <select
                    value={vehicleId}
                    onChange={(e) => handleSelectVehicle(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-200 max-w-[190px]"
                  >
                    <option value="">Escribir vehículo manual</option>
                    {customerVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate} — {v.make} {v.model}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={vehicleSummary}
                  onChange={(e) => setVehicleSummary(e.target.value)}
                  placeholder="Año Marca Modelo *"
                  className="sm:col-span-2 px-3 py-1.5 text-sm bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  maxLength={20}
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="Placa"
                  className="px-3 py-1.5 text-sm font-mono uppercase bg-[#0B0D11] border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Section 1: Repuestos 1 por 1 (with Costo interno vs Precio venta) */}
          <section className="border border-zinc-800 rounded-xl overflow-hidden bg-[#0E1117]/60">
            <div className="px-4 py-3 bg-[#0E1117] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-zinc-100">
                  1. Repuestos y piezas (agregar 1 por 1)
                </h3>
                <p className="text-[11px] text-zinc-400">
                  El costo de repuesto es uso interno del taller y nunca sale reflejado en el PDF.
                </p>
              </div>
              <div className="text-right font-mono text-xs tabular-nums">
                <span className="font-semibold text-amber-400">
                  Venta: {formatMoney(totals.partsTotal, shop.currency)}
                </span>
                {totals.partsCostTotal > 0 && (
                  <span className="text-zinc-400 ml-3">
                    Costo: {formatMoney(totals.partsCostTotal, shop.currency)} · Margen:{' '}
                    <span className={totals.partsProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {formatMoney(totals.partsProfit, shop.currency)}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Quick add part row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                {parts.length > 0 && (
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Inventario (opcional)
                    </label>
                    <select
                      value={selectedPartId}
                      onChange={(e) => handlePickInventoryPart(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100"
                    >
                      <option value="">Repuesto manual...</option>
                      {parts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name} ({formatMoney(p.salePrice, shop.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={parts.length > 0 ? 'sm:col-span-4' : 'sm:col-span-7'}>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Nombre del repuesto
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    value={partDesc}
                    onChange={(e) => setPartDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPartOneByOne();
                      }
                    }}
                    placeholder="Ej. Juego de pastillas delanteras"
                    className="w-full px-3 py-2 text-xs bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Cant.</label>
                  <input
                    type="number"
                    min={0.1}
                    step="1"
                    value={partQty}
                    onChange={(e) => setPartQty(Number(e.target.value))}
                    className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Costo (interno)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={partCostPrice}
                    onChange={(e) => setPartCostPrice(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-300"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-medium text-amber-400 mb-1">
                    P. Venta
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={partSalePrice}
                    onChange={(e) => setPartSalePrice(Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPartOneByOne();
                      }
                    }}
                    className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100"
                  />
                </div>
                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddPartOneByOne}
                    disabled={partDesc.trim().length < 2}
                    aria-label="Agregar repuesto"
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {partRows.length > 0 && (
                <div className="border border-zinc-800 rounded-lg overflow-hidden bg-[#141821]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0E1117] border-b border-zinc-800 text-zinc-400">
                        <th className="py-2 px-3">Repuesto</th>
                        <th className="py-2 px-3 text-right w-16">Cant.</th>
                        <th className="py-2 px-3 text-right w-24">Costo unit.</th>
                        <th className="py-2 px-3 text-right w-24 text-amber-400">Precio venta</th>
                        <th className="py-2 px-3 text-right w-24">Subtotal</th>
                        <th className="py-2 px-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {partRows.map(({ item, index }) => (
                        <tr key={index}>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) =>
                                handleUpdateItemField(index, 'description', e.target.value)
                              }
                              className="w-full px-2 py-1 text-xs bg-transparent text-zinc-100 border border-transparent hover:border-zinc-700 focus:border-amber-400 focus:bg-[#0B0D11] rounded focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              min={0.1}
                              step="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItemField(index, 'quantity', Number(e.target.value))
                              }
                              className="w-16 px-2 py-1 text-right text-xs font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.costPrice ?? 0}
                              onChange={(e) =>
                                handleUpdateItemField(index, 'costPrice', Number(e.target.value))
                              }
                              className="w-20 px-2 py-1 text-right text-xs font-mono tabular-nums bg-[#0B0D11] text-zinc-400 border border-zinc-800 rounded"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateItemField(index, 'unitPrice', Number(e.target.value))
                              }
                              className="w-20 px-2 py-1 text-right text-xs font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-zinc-100 tabular-nums">
                            {formatMoney(
                              (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
                              shop.currency
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemAt(index)}
                              aria-label="Quitar repuesto"
                              className="p-1 text-zinc-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Trabajos / Mano de obra 1 por 1 */}
          <section className="border border-zinc-800 rounded-xl overflow-hidden bg-[#0E1117]/60">
            <div className="px-4 py-3 bg-[#0E1117] border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="font-display text-sm font-semibold text-zinc-100">
                  2. Trabajos y mano de obra (agregar 1 por 1)
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-amber-400 tabular-nums">
                Subtotal: {formatMoney(totals.laborTotal, shop.currency)}
              </span>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Descripción del trabajo o servicio a realizar
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    value={laborDesc}
                    onChange={(e) => setLaborDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLaborOneByOne();
                      }
                    }}
                    placeholder="Ej. Reemplazo de pastillas y rectificado de discos delanteros"
                    className="w-full px-3 py-2 text-xs bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Cant.</label>
                  <input
                    type="number"
                    min={0.1}
                    step="0.5"
                    value={laborQty}
                    onChange={(e) => setLaborQty(Number(e.target.value))}
                    className="w-full px-2 py-2 text-xs font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Precio</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={laborPrice}
                    onChange={(e) => setLaborPrice(Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLaborOneByOne();
                      }
                    }}
                    className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100"
                  />
                </div>
                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddLaborOneByOne}
                    disabled={laborDesc.trim().length < 2}
                    aria-label="Agregar trabajo"
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {laborRows.length > 0 && (
                <div className="border border-zinc-800 rounded-lg overflow-hidden bg-[#141821]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0E1117] border-b border-zinc-800 text-zinc-400">
                        <th className="py-2 px-3">Trabajo / Mano de obra</th>
                        <th className="py-2 px-3 text-right w-20">Cant.</th>
                        <th className="py-2 px-3 text-right w-28">Precio unit.</th>
                        <th className="py-2 px-3 text-right w-28">Subtotal</th>
                        <th className="py-2 px-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {laborRows.map(({ item, index }) => (
                        <tr key={index}>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) =>
                                handleUpdateItemField(index, 'description', e.target.value)
                              }
                              className="w-full px-2 py-1 text-xs bg-transparent text-zinc-100 border border-transparent hover:border-zinc-700 focus:border-amber-400 focus:bg-[#0B0D11] rounded focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              min={0.1}
                              step="0.5"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItemField(index, 'quantity', Number(e.target.value))
                              }
                              className="w-16 px-2 py-1 text-right text-xs font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateItemField(index, 'unitPrice', Number(e.target.value))
                              }
                              className="w-24 px-2 py-1 text-right text-xs font-mono tabular-nums bg-[#0B0D11] text-zinc-100 border border-zinc-700 rounded"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-zinc-100 tabular-nums">
                            {formatMoney(
                              (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
                              shop.currency
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemAt(index)}
                              aria-label="Quitar trabajo"
                              className="p-1 text-zinc-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Meta, Payment & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-7 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Válido hasta
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Estado</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as QuoteStatus)}
                    className="w-full px-3 py-2 text-sm bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="Borrador">Borrador</option>
                    <option value="Enviado">Enviado</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Rechazado">Rechazado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-zinc-400">
                      Abonado por el cliente
                    </label>
                    {totals.totalAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmountPaid(totals.totalAmount)}
                        className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        Marcar 100% pago
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Nota de pago / abono
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Pago Móvil, Zelle, Efectivo..."
                    className="w-full px-3 py-2 text-sm bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Observaciones y condiciones
                </label>
                <textarea
                  rows={2}
                  maxLength={800}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Garantía, tiempos de entrega de repuestos, notas para el cliente..."
                  className="w-full px-3 py-2 text-sm bg-[#0B0D11] border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="md:col-span-5 space-y-3">
              <div className="p-4 bg-[#0E1117] border border-zinc-800 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Mano de obra ({laborRows.length})</span>
                  <span className="font-mono text-zinc-200 tabular-nums">
                    {formatMoney(totals.laborTotal, shop.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Repuestos venta ({partRows.length})</span>
                  <span className="font-mono text-zinc-200 tabular-nums">
                    {formatMoney(totals.partsTotal, shop.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>IVA ({shop.taxRate}%)</span>
                  <span className="font-mono text-zinc-200 tabular-nums">
                    {formatMoney(totals.taxAmount, shop.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-zinc-100 border-t border-zinc-800 pt-2.5">
                  <span>Total estimado</span>
                  <span className="font-mono text-amber-400 tabular-nums">
                    {formatMoney(totals.totalAmount, shop.currency)}
                  </span>
                </div>
                {totalVes !== null && shop.bcvRate && (
                  <div className="flex justify-between text-xs text-zinc-400 pt-0.5">
                    <span>Equiv. BCV (Bs. {shop.bcvRate.toFixed(2)})</span>
                    <span className="font-mono font-semibold text-zinc-200 tabular-nums">
                      {formatVES(totalVes)}
                    </span>
                  </div>
                )}
                <div className="border-t border-zinc-800 pt-2 space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>Abonado</span>
                    <span className="font-mono text-emerald-400 tabular-nums">
                      {formatMoney(paymentSummary.paid, shop.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-300 font-semibold">
                    <span>Falta por cancelar</span>
                    <span
                      className={`font-mono tabular-nums ${
                        paymentSummary.remaining > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatMoney(paymentSummary.remaining, shop.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {totals.partsCostTotal > 0 && (
                <div className="p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-xl space-y-1.5 text-xs">
                  <p className="text-[11px] font-medium text-zinc-400">
                    Rentabilidad interna (no aparece en PDF)
                  </p>
                  <div className="flex justify-between text-zinc-400">
                    <span>Costo total repuestos</span>
                    <span className="font-mono text-zinc-200 tabular-nums">
                      {formatMoney(totals.partsCostTotal, shop.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-zinc-300">Ganancia en repuestos</span>
                    <span
                      className={`font-mono tabular-nums ${
                        totals.partsProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatMoney(totals.partsProfit, shop.currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 flex flex-wrap items-center justify-end gap-3 shrink-0 bg-[#0E1117]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-800 whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave(false)}
            className="px-4 py-2 text-sm font-medium text-zinc-100 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? 'Guardando...' : 'Guardar presupuesto'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" />
            Guardar y descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
