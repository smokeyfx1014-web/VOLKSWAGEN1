import { auth } from './firebase';

export type MediaUploadCategory = 'logos' | 'promotions' | 'vehicles' | 'news';
export type UploadedMediaType = 'image' | 'video';

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

export function isVideoMedia(
  src: string | null | undefined,
  mediaType?: 'image' | 'video'
): boolean {
  if (mediaType === 'video') return true;
  if (!src) return false;
  return VIDEO_URL_RE.test(src.trim());
}

export async function uploadDealershipMedia(
  file: File,
  category: MediaUploadCategory
): Promise<{ url: string; mediaType: UploadedMediaType }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in to upload images or videos.');
  }

  const mime = (file.type || '').toLowerCase().split(';')[0].trim();
  const isImage = IMAGE_MIME_TYPES.has(mime);
  const isVideo = VIDEO_MIME_TYPES.has(mime);

  if (category !== 'promotions' && isVideo) {
    throw new Error('Video uploads are supported for Specials, Events, and Competitions only.');
  }
  if (!isImage && !(category === 'promotions' && isVideo)) {
    throw new Error(
      category === 'promotions'
        ? 'Unsupported file format. Please upload PNG, JPG, WebP, SVG, GIF, AVIF, MP4, WebM, or MOV.'
        : 'Unsupported image format. Please upload PNG, JPG, WebP, SVG, GIF, or AVIF.'
    );
  }

  if (isImage && file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image exceeds 8 MB limit. Please compress or resize before uploading.');
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    throw new Error('Video exceeds 25 MB limit. Please trim or compress to MP4/WebM under 25 MB.');
  }
  if (file.size === 0) {
    throw new Error('Selected file is empty.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`/api/upload-media?category=${encodeURIComponent(category)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': mime,
      'x-file-name': encodeURIComponent(file.name),
    },
    body: file,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    url?: string;
    mediaType?: UploadedMediaType;
    error?: string;
  };

  if (!response.ok || !payload.url) {
    throw new Error(
      payload.error ||
        (response.status === 404
          ? 'Media upload endpoint is unavailable on static-only hosting. Paste a hosted URL instead.'
          : 'Failed to upload media file.')
    );
  }

  return {
    url: payload.url,
    mediaType: payload.mediaType ?? (isVideo ? 'video' : 'image'),
  };
}
