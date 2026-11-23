import React, { useEffect, useMemo, useState } from 'react';
import { Car, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface VehicleImageSliderProps {
  images: string[];
  alt: string;
  badge?: React.ReactNode;
  aspectClassName?: string;
  className?: string;
}

export function VehicleImageSlider({
  images,
  alt,
  badge,
  aspectClassName = 'aspect-4/3',
  className,
}: VehicleImageSliderProps) {
  const validImages = useMemo(
    () =>
      Array.from(
        new Set(
          (images ?? [])
            .map((src) => (typeof src === 'string' ? src.trim() : ''))
            .filter(Boolean)
        )
      ),
    [images]
  );

  const imagesKey = validImages.join('|');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCurrentIndex(0);
  }, [imagesKey]);

  const total = validImages.length;
  const safeIndex = total > 0 ? Math.min(currentIndex, total - 1) : 0;
  const activeSrc = total > 0 ? validImages[safeIndex] : '';
  const hasFailed = !activeSrc || Boolean(failedUrls[activeSrc]);

  const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden border-b border-[#E2E8F0] bg-[#F1F5F9]',
        aspectClassName,
        className
      )}
    >
      {hasFailed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#F1F5F9] to-[#E2E8F0] p-6 text-center">
          <Car className="h-8 w-8 text-[#001E50]/45" aria-hidden="true" />
          <span className="max-w-[220px] truncate text-xs font-medium text-[#475569]">
            {alt}
          </span>
        </div>
      ) : (
        <img
          src={activeSrc}
          alt={total > 1 ? `${alt} (photo ${safeIndex + 1} of ${total})` : alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() =>
            setFailedUrls((prev) => ({ ...prev, [activeSrc]: true }))
          }
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      )}

      {badge}

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous vehicle photo"
            className="absolute top-1/2 left-2.5 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#001E50] shadow-sm backdrop-blur-xs transition-all duration-150 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001E50] cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Next vehicle photo"
            className="absolute top-1/2 right-2.5 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#001E50] shadow-sm backdrop-blur-xs transition-all duration-150 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001E50] cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <span className="pointer-events-none absolute right-2.5 bottom-2.5 z-10 rounded bg-black/65 px-2 py-0.5 font-mono text-[11px] font-medium text-white tabular-nums backdrop-blur-xs">
            {safeIndex + 1} / {total}
          </span>
        </>
      )}
    </div>
  );
}
