import { useState } from 'react';
import { Calendar, ClipboardList, FileText, Package, ShieldCheck, Wrench } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface AuthScreenProps {
  onSignIn: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function AuthScreen({ onSignIn, loading, error }: AuthScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0D11] text-zinc-100 flex flex-col justify-center p-4 sm:p-8">
      <div className="max-w-6xl w-full mx-auto bg-[#141821] border border-zinc-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Top German tricolor precision bar across container */}
        <div className="lg:col-span-12 h-[3px] grid grid-cols-3">
          <div className="bg-zinc-950" />
          <div className="bg-red-600" />
          <div className="bg-amber-400" />
        </div>

        {/* Left Column: Sign-In & Capabilities */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between gap-10">
          <div>
            <div className="mb-10">
              <BrandLogo name="AutoMekanika SHN" showSubtext />
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50 leading-[1.15] [text-wrap:balance] mb-4">
              Control técnico y presupuestos para tu taller automotriz
            </h1>
            <p className="text-base text-zinc-400 leading-relaxed max-w-xl mb-8">
              Administra órdenes de trabajo, presupuestos detallados pieza por pieza, historial vehicular, inventario y equivalencia diaria en Bolívares a tasa oficial BCV.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 border-t border-zinc-800 pt-7 mb-8">
              <div className="flex items-start gap-3">
                <ClipboardList className="w-4 h-4 text-amber-400 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Órdenes de trabajo</h2>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Control desde recepción hasta entrega con reporte técnico descargable en PDF.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Presupuestos y Tasa BCV</h2>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Repuestos y mano de obra 1 por 1 con conversión actualizada en Bolívares al BCV.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package className="w-4 h-4 text-amber-400 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Control de repuestos</h2>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Descuento automático de almacén y alertas de existencia mínima.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Agenda y bahías</h2>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Convierte citas programadas o presupuestos aprobados en órdenes con un clic.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="text-xs text-red-300 bg-red-950/60 border border-red-900 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void onSignIn()}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 active:bg-amber-500 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.39 0 3.41 2.64 1.46 6.49l3.67 2.85C6.01 6.77 8.76 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.52-1.14 2.82-2.4 3.68l3.71 2.88c2.17-2 3.71-4.95 3.71-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.13 14.66A7.19 7.19 0 0 1 4.75 12c0-.93.16-1.82.38-2.66L1.46 6.49A11.97 11.97 0 0 0 0 12c0 1.94.46 3.77 1.46 5.51l3.67-2.85z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.93l-3.71-2.88c-1.07.72-2.45 1.15-4.22 1.15-3.24 0-5.99-1.77-7.13-4.34l-3.67 2.85C3.41 21.36 7.39 24 12 24z"
                />
              </svg>
              {loading ? 'Conectando...' : 'Iniciar sesión con Google'}
            </button>

            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>Tus datos se almacenan aislados en tu espacio privado de AutoMekanika SHN.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Editorial Workshop Bay Image */}
        <div className="lg:col-span-6 relative min-h-[280px] lg:min-h-[560px] bg-[#0B0D11]">
          {!imgFailed ? (
            <img
              src="/src/assets/images/hero_workshop_bay_1795583323628.jpg"
              alt="Bahía de servicio automotriz de AutoMekanika SHN equipada con elevador hidráulico"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover lg:absolute lg:inset-0 opacity-85"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#0F1218] via-[#171C26] to-[#0B0D11] text-zinc-300">
              <Wrench className="w-12 h-12 text-amber-400 mb-3" />
              <p className="text-sm font-medium">Bahía Técnica · AutoMekanika SHN</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D11] via-[#0B0D11]/40 to-transparent pointer-events-none" />
          <div className="absolute bottom-6 left-6 right-6 text-white">
            <p className="text-xs font-medium text-amber-400 mb-1">
              AutoMekanika SHN · Precisión y servicio automotriz
            </p>
            <p className="text-sm text-zinc-200 max-w-md leading-relaxed">
              Cada vehículo ingresado cuenta con historial trazable de repuestos, mano de obra y presupuestos con tasa BCV actualizada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
