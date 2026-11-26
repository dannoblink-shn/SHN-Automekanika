import { useState } from 'react';

export const SHOP_LOGO_PATH = '/assets/aistudio/Logo_ba3112ab.jfif';

interface BrandLogoProps {
  name?: string;
  compact?: boolean;
  showSubtext?: boolean;
}

export function BrandLogo({
  name = 'AutoMekanika SHN',
  compact = false,
  showSubtext = false,
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className={`relative shrink-0 rounded-lg bg-[#F6F5F0] border border-zinc-700/80 overflow-hidden flex items-center justify-center shadow-xs ${
          compact ? 'w-11 h-9' : 'w-14 h-11'
        }`}
      >
        {!imgError ? (
          <img
            src={SHOP_LOGO_PATH}
            alt={`Logo ${name}`}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center scale-[1.06]"
          />
        ) : (
          <svg
            viewBox="0 0 40 40"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect x="0" y="0" width="40" height="13.5" fill="#0D0F14" />
            <rect x="0" y="13.5" width="40" height="13" fill="#DC2626" />
            <rect x="0" y="26.5" width="40" height="13.5" fill="#FACC15" />
          </svg>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-display text-sm sm:text-base font-bold tracking-tight text-zinc-100 truncate">
            {name}
          </span>
        </div>
        {showSubtext ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex h-1 w-6 rounded-xs overflow-hidden shrink-0" aria-hidden="true">
              <span className="flex-1 bg-zinc-950 border-y border-zinc-700" />
              <span className="flex-1 bg-red-600" />
              <span className="flex-1 bg-amber-400" />
            </span>
            <span className="text-[11px] text-zinc-400 truncate">Servicio Automotriz</span>
          </div>
        ) : (
          <div className="flex h-[3px] w-10 mt-1 rounded-xs overflow-hidden" aria-hidden="true">
            <span className="flex-1 bg-zinc-800" />
            <span className="flex-1 bg-red-600" />
            <span className="flex-1 bg-amber-400" />
          </div>
        )}
      </div>
    </div>
  );
}
