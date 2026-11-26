export interface BcvRateResult {
  rate: number;
  updatedAt: string;
  source: string;
}

export async function fetchLiveBcvRate(): Promise<BcvRateResult> {
  // Primary source: DolarAPI Venezuela (Official BCV USD rate)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as {
        promedio?: number;
        fechaActualizacion?: string;
      };
      if (typeof data.promedio === 'number' && Number.isFinite(data.promedio) && data.promedio > 0) {
        return {
          rate: Number(data.promedio.toFixed(4)),
          updatedAt: data.fechaActualizacion || new Date().toISOString(),
          source: 'BCV Oficial (dolarapi.com)',
        };
      }
    }
  } catch {
    // Try fallback below
  }

  // Fallback source: Open ExchangeRate API (VES official reference)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error('No se pudo consultar la tasa BCV en este momento.');
    }
    const data = (await res.json()) as {
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    const ves = data.rates?.VES;
    if (typeof ves === 'number' && Number.isFinite(ves) && ves > 0) {
      return {
        rate: Number(ves.toFixed(4)),
        updatedAt: data.time_last_update_utc
          ? new Date(data.time_last_update_utc).toISOString()
          : new Date().toISOString(),
        source: 'Referencia Oficial VES',
      };
    }
    throw new Error('La respuesta de tasa BCV no contiene un valor válido.');
  } finally {
    clearTimeout(timer);
  }
}

export function formatBcvDate(isoString?: string): string {
  if (!isoString) return 'Sin sincronizar';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function isBcvRateFromToday(isoString?: string): boolean {
  if (!isoString) return false;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
