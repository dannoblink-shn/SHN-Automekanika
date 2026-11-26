import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  computePaymentSummary,
  convertUsdToVes,
  formatMoney,
  formatNumber,
  formatVES,
  type Customer,
  type Quote,
  type QuoteItem,
  type Shop,
  type Vehicle,
  type WorkOrder,
  type WorkOrderItem,
} from '../types/workshop';

const SHOP_LOGO_URL = '/assets/aistudio/Logo_ba3112ab.jfif';
let cachedLogoPromise: Promise<string | null> | null = null;

function getShopLogoDataUrl(): Promise<string | null> {
  if (cachedLogoPromise) return cachedLogoPromise;
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  cachedLogoPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || 1000;
        const h = img.naturalHeight || 545;
        // Crop tight around the centered shield emblem (approx 630x523 inside 1000x545)
        const sx = Math.round(w * 0.185);
        const sy = Math.round(h * 0.02);
        const sw = Math.round(w * 0.63);
        const sh = Math.round(h * 0.96);

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#F7F6F1';
        ctx.fillRect(0, 0, sw, sh);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = SHOP_LOGO_URL;
  });
  return cachedLogoPromise;
}

function getLastY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

function drawHeader(
  doc: jsPDF,
  shop: Shop,
  docLabel: string,
  docNumber: string,
  statusText: string,
  metaLine: string,
  logoDataUrl: string | null
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const shopName = shop.name || 'AutoMekanika SHN';

  // Dark carbon header band
  doc.setFillColor(11, 13, 17);
  doc.rect(0, 0, pageWidth, 36, 'F');

  // German flag precision stripe across bottom edge of header (Black / Red / Gold)
  const thirdW = pageWidth / 3;
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 34.5, thirdW, 1.5, 'F');
  doc.setFillColor(220, 38, 38);
  doc.rect(thirdW, 34.5, thirdW, 1.5, 'F');
  doc.setFillColor(250, 204, 21);
  doc.rect(thirdW * 2, 34.5, thirdW, 1.5, 'F');

  let textStartX = 31;

  if (logoDataUrl) {
    // Clean framed badge around official SHN AutoMekanika logo
    doc.setFillColor(247, 246, 241);
    doc.roundedRect(14, 5.5, 22, 18.2, 1.5, 1.5, 'F');
    doc.addImage(logoDataUrl, 'JPEG', 14.5, 6, 21, 17.2);
    doc.setDrawColor(63, 63, 70);
    doc.roundedRect(14, 5.5, 22, 18.2, 1.5, 1.5, 'S');
    textStartX = 40;
  } else {
    // Fallback German Flag Emblem
    doc.setFillColor(17, 19, 24);
    doc.roundedRect(14, 7.5, 13, 13, 1.5, 1.5, 'F');
    doc.setFillColor(17, 19, 24);
    doc.rect(14.5, 8, 12, 4, 'F');
    doc.setFillColor(220, 38, 38);
    doc.rect(14.5, 12, 12, 4, 'F');
    doc.setFillColor(250, 204, 21);
    doc.rect(14.5, 16, 12, 4, 'F');
    doc.setDrawColor(63, 63, 70);
    doc.roundedRect(14, 7.5, 13, 13, 1.5, 1.5, 'S');
  }

  // Shop name & contact
  doc.setTextColor(250, 250, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(shopName, textStartX, 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(212, 212, 216);
  const contactLine = [
    shop.address || 'Taller de Servicio Automotriz · Venezuela',
    shop.phone ? `Tel: ${shop.phone}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  doc.text(contactLine, textStartX, 19.5);

  const dateBcvLine = [
    `Emisión: ${new Date().toLocaleDateString('es-VE')}`,
    shop.bcvRate && shop.bcvRate > 0 ? `Tasa BCV: ${formatVES(shop.bcvRate)} / USD` : '',
  ]
    .filter(Boolean)
    .join('   ·   ');
  doc.setTextColor(250, 204, 21);
  doc.text(dateBcvLine, 14, 29.8);

  // Right aligned doc number
  doc.setTextColor(250, 204, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(docLabel, pageWidth - 14, 12.5, { align: 'right' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(docNumber, pageWidth - 14, 20.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(212, 212, 216);
  doc.text(`${statusText}${metaLine ? `  ·  ${metaLine}` : ''}`, pageWidth - 14, 29.8, {
    align: 'right',
  });
}

// Note: Client PDFs intentionally show ONLY client-facing sale prices (`unitPrice` / `subtotal`).
// Internal spare part costs (`costPrice`) and profit margins are strictly excluded.
export async function generateWorkOrderPdfReport(params: {
  shop: Shop;
  order: WorkOrder;
  customer?: Customer;
  vehicle?: Vehicle;
  items: WorkOrderItem[];
}): Promise<void> {
  const { shop, order, customer, vehicle, items } = params;
  const logoDataUrl = await getShopLogoDataUrl();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawHeader(
    doc,
    shop,
    'REPORTE DE ORDEN DE TRABAJO',
    order.orderNumber,
    `Estado: ${order.status}`,
    `Prioridad: ${order.priority}`,
    logoDataUrl
  );

  let y = 44;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: [228, 228, 231],
      lineWidth: 0.2,
      textColor: [24, 24, 27],
    },
    headStyles: {
      fillColor: [244, 244, 245],
      textColor: [39, 39, 42],
      fontStyle: 'bold',
    },
    head: [['Datos del Cliente', 'Datos del Vehículo y Servicio']],
    body: [
      [
        [
          `Nombre: ${customer?.name || order.customerName}`,
          `Teléfono: ${customer?.phone || 'No registrado'}`,
          `Correo: ${customer?.email || 'No registrado'}`,
          `C.I. / RIF: ${customer?.taxId || 'N/A'}`,
        ].join('\n'),
        [
          `Vehículo: ${vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : order.vehicleSummary}`,
          `Placa: ${order.plate}   ·   Kilometraje: ${formatNumber(order.mileageIn)} km`,
          `VIN / Serial: ${vehicle?.vin || 'N/A'}   ·   Combustible: ${vehicle?.fuelType || 'N/D'}`,
          `Técnico: ${order.mechanicName || 'Sin asignar'} (${order.bay || 'Sin bahía'})   ·   Entrega: ${order.promisedDate || 'N/D'}`,
        ].join('\n'),
      ],
    ],
  });

  y = getLastY(doc, y + 32) + 6;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: [228, 228, 231],
      lineWidth: 0.2,
      textColor: [24, 24, 27],
    },
    headStyles: {
      fillColor: [244, 244, 245],
      textColor: [39, 39, 42],
      fontStyle: 'bold',
    },
    head: [['Falla Reportada y Diagnóstico Técnico']],
    body: [
      [`Motivo de ingreso: ${order.symptom}`],
      [`Diagnóstico / Trabajos: ${order.diagnosis || 'Sin diagnóstico técnico adicional registrado.'}`],
    ],
  });

  y = getLastY(doc, y + 24) + 7;

  const laborItems = items.filter((i) => i.type === 'Mano de Obra');
  const partItems = items.filter((i) => i.type === 'Repuesto');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('Servicios Realizados (Mano de Obra)', 14, y);
  y += 2.5;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [24, 24, 27] },
    headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
    },
    head: [['Descripción del trabajo', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body:
      laborItems.length > 0
        ? laborItems.map((it) => [
            it.description,
            String(it.quantity),
            formatMoney(it.unitPrice, shop.currency),
            formatMoney(it.subtotal, shop.currency),
          ])
        : [['Sin servicios de mano de obra registrados', '—', '—', formatMoney(0, shop.currency)]],
  });

  y = getLastY(doc, y + 20) + 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('Piezas y Repuestos Utilizados', 14, y);
  y += 2.5;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [24, 24, 27] },
    headStyles: { fillColor: [63, 63, 70], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
    },
    head: [['Descripción de pieza / repuesto', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body:
      partItems.length > 0
        ? partItems.map((it) => [
            it.description,
            String(it.quantity),
            formatMoney(it.unitPrice, shop.currency),
            formatMoney(it.subtotal, shop.currency),
          ])
        : [['Sin piezas o repuestos registrados', '—', '—', formatMoney(0, shop.currency)]],
  });

  y = getLastY(doc, y + 20) + 8;

  if (y > 225) {
    doc.addPage();
    y = 20;
  }

  const totalVes = convertUsdToVes(order.totalAmount, shop.currency, shop.bcvRate);
  const payment = computePaymentSummary(order.totalAmount, order.amountPaid);

  const totalRows: Array<{ label: string; value: string; style?: 'total' | 'bcv' | 'balance' | 'paid' }> = [
    { label: 'Mano de obra:', value: formatMoney(order.laborTotal, shop.currency) },
    { label: 'Repuestos y piezas:', value: formatMoney(order.partsTotal, shop.currency) },
    { label: `IVA (${shop.taxRate}%):`, value: formatMoney(order.taxAmount, shop.currency) },
    { label: `TOTAL (${shop.currency}):`, value: formatMoney(order.totalAmount, shop.currency), style: 'total' },
  ];

  if (totalVes !== null) {
    totalRows.push({ label: 'Equivalente BCV (Bs.):', value: formatVES(totalVes), style: 'bcv' });
  }

  if (payment.paid > 0) {
    totalRows.push({
      label: 'Abonado:',
      value: formatMoney(payment.paid, shop.currency),
      style: 'paid',
    });
    if (payment.remaining > 0) {
      const remVes = convertUsdToVes(payment.remaining, shop.currency, shop.bcvRate);
      totalRows.push({
        label: 'Resta por pagar:',
        value: remVes !== null
          ? `${formatMoney(payment.remaining, shop.currency)} (${formatVES(remVes)})`
          : formatMoney(payment.remaining, shop.currency),
        style: 'balance',
      });
    } else {
      totalRows.push({
        label: 'Estado de pago:',
        value: 'PAGADO COMPLETO',
        style: 'paid',
      });
    }
  }

  autoTable(doc, {
    startY: y,
    margin: { left: pageWidth - 98, right: 14 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, textColor: [24, 24, 27] },
    columnStyles: {
      0: { halign: 'left', textColor: [82, 82, 91] },
      1: { halign: 'right', fontStyle: 'bold' },
    },
    body: totalRows.map((r) => [r.label, r.value]),
    didParseCell(hookData) {
      const rowMeta = totalRows[hookData.row.index];
      if (!rowMeta) return;
      if (rowMeta.style === 'total') {
        hookData.cell.styles.fillColor = [24, 24, 27];
        hookData.cell.styles.fontSize = 10;
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = 'bold';
      } else if (rowMeta.style === 'bcv') {
        hookData.cell.styles.fillColor = [254, 249, 195];
        hookData.cell.styles.fontSize = 9;
        hookData.cell.styles.textColor = [24, 24, 27];
        hookData.cell.styles.fontStyle = 'bold';
      } else if (rowMeta.style === 'paid') {
        hookData.cell.styles.textColor = [22, 163, 74];
        hookData.cell.styles.fontStyle = 'bold';
      } else if (rowMeta.style === 'balance') {
        hookData.cell.styles.fillColor = [254, 242, 242];
        hookData.cell.styles.textColor = [185, 28, 28];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const signY = Math.max(getLastY(doc, y + 32) + 18, 258);
  if (signY < 282) {
    doc.setDrawColor(161, 161, 170);
    doc.line(20, signY, 85, signY);
    doc.line(pageWidth - 85, signY, pageWidth - 20, signY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(82, 82, 91);
    doc.text(
      `Responsable · ${shop.name || 'AutoMekanika SHN'}`,
      52.5,
      signY + 5,
      { align: 'center' }
    );
    doc.text('Firma de Conformidad del Cliente', pageWidth - 52.5, signY + 5, { align: 'center' });
  }

  const safePlate = order.plate.replace(/[^a-zA-Z0-9_-]/g, '');
  doc.save(`AutoMekanikaSHN_${order.orderNumber}_${safePlate || 'OT'}.pdf`);
}

// Note: Client PDFs intentionally show ONLY client-facing sale prices (`unitPrice` / `subtotal`).
// Internal spare part costs (`costPrice`) and profit margins are strictly excluded.
export async function generateQuotePdfReport(params: {
  shop: Shop;
  quote: Quote;
  items: QuoteItem[];
}): Promise<void> {
  const { shop, quote, items } = params;
  const logoDataUrl = await getShopLogoDataUrl();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawHeader(
    doc,
    shop,
    'PRESUPUESTO DE SERVICIO',
    quote.quoteNumber,
    `Estado: ${quote.status}`,
    quote.validUntil ? `Vigencia: ${quote.validUntil}` : '',
    logoDataUrl
  );

  let y = 44;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: [228, 228, 231],
      lineWidth: 0.2,
      textColor: [24, 24, 27],
    },
    headStyles: {
      fillColor: [244, 244, 245],
      textColor: [39, 39, 42],
      fontStyle: 'bold',
    },
    head: [['Cliente', 'Vehículo Cotizado']],
    body: [
      [
        `Nombre: ${quote.customerName}\nTeléfono: ${quote.customerPhone || 'No especificado'}`,
        `Vehículo: ${quote.vehicleSummary}\nPlaca: ${quote.plate || 'Sin placa'}   ·   Válido hasta: ${quote.validUntil || '15 días'}`,
      ],
    ],
  });

  y = getLastY(doc, y + 24) + 7;

  const laborItems = items.filter((i) => i.type === 'Mano de Obra');
  const partItems = items.filter((i) => i.type === 'Repuesto');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('Trabajos / Mano de Obra Cotizada', 14, y);
  y += 2.5;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [24, 24, 27] },
    headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
    },
    head: [['Descripción del trabajo', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body:
      laborItems.length > 0
        ? laborItems.map((it) => [
            it.description,
            String(it.quantity),
            formatMoney(it.unitPrice, shop.currency),
            formatMoney(it.subtotal, shop.currency),
          ])
        : [['Sin trabajos agregados', '—', '—', formatMoney(0, shop.currency)]],
  });

  y = getLastY(doc, y + 20) + 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('Repuestos / Piezas Cotizadas', 14, y);
  y += 2.5;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [24, 24, 27] },
    headStyles: { fillColor: [63, 63, 70], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
    },
    head: [['Descripción del repuesto', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body:
      partItems.length > 0
        ? partItems.map((it) => [
            it.description,
            String(it.quantity),
            formatMoney(it.unitPrice, shop.currency),
            formatMoney(it.subtotal, shop.currency),
          ])
        : [['Sin repuestos agregados', '—', '—', formatMoney(0, shop.currency)]],
  });

  y = getLastY(doc, y + 20) + 7;

  if (quote.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(39, 39, 42);
    doc.text('Observaciones:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(82, 82, 91);
    const wrapped = doc.splitTextToSize(quote.notes, pageWidth - 28) as string[];
    doc.text(wrapped, 14, y + 4.5);
    y += 6 + wrapped.length * 4;
  }

  if (y > 225) {
    doc.addPage();
    y = 20;
  }

  const totalVes = convertUsdToVes(quote.totalAmount, shop.currency, shop.bcvRate);
  const payment = computePaymentSummary(quote.totalAmount, quote.amountPaid);

  const totalRows: Array<{ label: string; value: string; style?: 'total' | 'bcv' | 'balance' | 'paid' }> = [
    { label: 'Mano de obra:', value: formatMoney(quote.laborTotal, shop.currency) },
    { label: 'Repuestos:', value: formatMoney(quote.partsTotal, shop.currency) },
    { label: `IVA (${shop.taxRate}%):`, value: formatMoney(quote.taxAmount, shop.currency) },
    {
      label: `TOTAL ESTIMADO (${shop.currency}):`,
      value: formatMoney(quote.totalAmount, shop.currency),
      style: 'total',
    },
  ];

  if (totalVes !== null) {
    totalRows.push({ label: 'Equivalente BCV (Bs.):', value: formatVES(totalVes), style: 'bcv' });
  }

  if (payment.paid > 0) {
    totalRows.push({
      label: 'Abonado:',
      value: formatMoney(payment.paid, shop.currency),
      style: 'paid',
    });
    if (payment.remaining > 0) {
      const remVes = convertUsdToVes(payment.remaining, shop.currency, shop.bcvRate);
      totalRows.push({
        label: 'Resta por pagar:',
        value: remVes !== null
          ? `${formatMoney(payment.remaining, shop.currency)} (${formatVES(remVes)})`
          : formatMoney(payment.remaining, shop.currency),
        style: 'balance',
      });
    } else {
      totalRows.push({
        label: 'Estado de pago:',
        value: 'PAGADO COMPLETO',
        style: 'paid',
      });
    }
  }

  autoTable(doc, {
    startY: y,
    margin: { left: pageWidth - 98, right: 14 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, textColor: [24, 24, 27] },
    columnStyles: {
      0: { halign: 'left', textColor: [82, 82, 91] },
      1: { halign: 'right', fontStyle: 'bold' },
    },
    body: totalRows.map((r) => [r.label, r.value]),
    didParseCell(hookData) {
      const rowMeta = totalRows[hookData.row.index];
      if (!rowMeta) return;
      if (rowMeta.style === 'total') {
        hookData.cell.styles.fillColor = [24, 24, 27];
        hookData.cell.styles.fontSize = 10;
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = 'bold';
      } else if (rowMeta.style === 'bcv') {
        hookData.cell.styles.fillColor = [254, 249, 195];
        hookData.cell.styles.fontSize = 9;
        hookData.cell.styles.textColor = [24, 24, 27];
        hookData.cell.styles.fontStyle = 'bold';
      } else if (rowMeta.style === 'paid') {
        hookData.cell.styles.textColor = [22, 163, 74];
        hookData.cell.styles.fontStyle = 'bold';
      } else if (rowMeta.style === 'balance') {
        hookData.cell.styles.fillColor = [254, 242, 242];
        hookData.cell.styles.textColor = [185, 28, 28];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`AutoMekanikaSHN_Presupuesto_${quote.quoteNumber}.pdf`);
}
