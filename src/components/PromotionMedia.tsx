import React from 'react';
import { Play } from 'lucide-react';
import { isVideoMedia } from '../lib/mediaUpload';
import { cn } from '../lib/utils';

interface PromotionMediaProps {
  src: string;
  alt: string;
  mediaType?: 'image' | 'video';
  className?: string;
  hoverZoom?: boolean;
  showVideoBadge?: boolean;
}

export function PromotionMedia({
  src,
  alt,
  mediaType,
  className,
  hoverZoom = false,
  showVideoBadge = true,
}: PromotionMediaProps) {
  const isVideo = isVideoMedia(src, mediaType);

  if (isVideo) {
    return (
      <div className="relative h-full w-full bg-[#091224]">
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          aria-label={alt}
          className={cn('h-full w-full object-cover', className)}
        />
        {showVideoBadge && (
          <span className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-[#091224]/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-xs">
            <Play className="h-2.5 w-2.5 fill-current" />
            <span>Video</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn(
        'h-full w-full object-cover',
        hoverZoom && 'transition-transform duration-500 ease-out group-hover:scale-105',
        className
      )}
    />
  );
}
