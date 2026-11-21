import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { AssetAspectRatio, AssetSlotSpec } from '../types/dealership';
import { cn } from '../lib/utils';

interface DealershipImageProps {
  asset: AssetSlotSpec;
  alt: string;
  className?: string;
  aspectClassName?: string;
  priority?: boolean;
  zoomOnHover?: boolean;
  compactLabel?: boolean;
}

const ASPECT_CLASSES: Record<AssetAspectRatio, string> = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-4/3',
  '3:2': 'aspect-3/2',
  '16:10': 'aspect-16/10',
  '1:1': 'aspect-square',
};

export function DealershipImage({
  asset,
  alt,
  className,
  aspectClassName,
  priority = false,
  zoomOnHover = true,
  compactLabel = false,
}: DealershipImageProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showRealImage = Boolean(asset.src) && !imgFailed;
  const isDark = asset.tone === 'dark';

  return (
    <div
      className={cn(
        'group/img relative w-full overflow-hidden select-none',
        aspectClassName ?? ASPECT_CLASSES[asset.aspectRatio],
        isDark
          ? 'bg-linear-to-br from-[#001E50] via-[#062B66] to-[#0A1628]'
          : 'bg-linear-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E8EEF5]',
        className
      )}
    >
      {showRealImage ? (
        <img
          src={asset.src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={cn(
            'h-full w-full object-cover object-center transition-transform duration-500 ease-out',
            zoomOnHover && 'group-hover/img:scale-[1.03]'
          )}
        />
      ) : (
        <div
          aria-label={`Image placeholder: ${alt}`}
          className={cn(
            'relative flex h-full w-full flex-col justify-between p-4 sm:p-5 transition-transform duration-500 ease-out',
            isDark ? 'blueprint-grid-dark text-white' : 'blueprint-grid text-[#091224]',
            zoomOnHover && 'group-hover/img:scale-[1.03]'
          )}
        >
          {/* Architectural corner crosshairs */}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-3 border border-dashed rounded-lg',
              isDark ? 'border-white/15' : 'border-[#001E50]/15'
            )}
          />

          {/* Top Metadata Strip */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tracking-tight">
            <span
              className={cn(
                'font-semibold',
                isDark ? 'text-white/90' : 'text-[#001E50]'
              )}
            >
              ASSET SLOT · {asset.slotId}
            </span>
            <span className={cn(isDark ? 'text-white/65' : 'text-[#475569]')}>
              {asset.aspectRatio} · {asset.dimensions}
            </span>
          </div>

          {/* Center Subject Guidance */}
          <div className="relative z-10 mx-auto my-auto flex max-w-md flex-col items-center text-center px-2">
            <div
              className={cn(
                'mb-2.5 flex h-10 w-10 items-center justify-center rounded-full border',
                isDark
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-[#001E50]/15 bg-white text-[#001E50] shadow-xs'
              )}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
            </div>
            {!compactLabel && (
              <p
                className={cn(
                  'text-xs sm:text-[13px] leading-relaxed font-medium',
                  isDark ? 'text-white/85' : 'text-[#334155]'
                )}
              >
                {asset.subject}
              </p>
            )}
          </div>

          {/* Bottom File Insertion Path */}
          <div className="relative z-10 flex items-center justify-between gap-2 text-[11px] font-mono">
            <span
              className={cn(
                'truncate',
                isDark ? 'text-white/70' : 'text-[#475569]'
              )}
              title={asset.targetPath}
            >
              Insert: {asset.targetPath}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
