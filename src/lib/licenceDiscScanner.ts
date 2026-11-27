export interface ExtractedLicenceDiscData {
  isValidLicenceDisc: boolean;
  vin: string;
  engineNumber: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: string;
  colour: string;
  discNumber: string;
  expiryDate: string;
  confidenceNote: string;
}

export type DiscRotationDegrees = 0 | 90 | 180 | 270;

export interface LicenceDiscScanResult {
  extracted: ExtractedLicenceDiscData;
  fileName: string;
  mimeType: string;
  appliedRotation?: DiscRotationDegrees;
  previewDataUrl?: string;
}

export interface ScanLicenceDiscOptions {
  rotateDegrees?: DiscRotationDegrees;
  autoRotate?: boolean;
  onStatusChange?: (status: string) => void;
}

const MAX_LICENCE_DISC_BYTES = 10 * 1024 * 1024;
const MAX_SCAN_IMAGE_DIMENSION = 1600;
const PREVIEW_MAX_DIMENSION = 320;

const ACCEPTED_DISC_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ACCEPTED_DISC_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.heic',
  '.heif',
]);

function isPdfFile(file: File, resolvedMime: string): boolean {
  if (resolvedMime === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

function hasUsefulDiscData(extracted: ExtractedLicenceDiscData): boolean {
  if (!extracted.isValidLicenceDisc) return false;
  return Boolean(extracted.vin || extracted.engineNumber || extracted.registrationNumber);
}

async function decodeImageForCanvas(
  file: File
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = objectUrl;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

async function prepareImagePayload(
  file: File,
  rotateDegrees: DiscRotationDegrees
): Promise<{ uploadBlob: Blob; uploadMime: string; previewDataUrl?: string }> {
  const decoded = await decodeImageForCanvas(file);
  try {
    const srcW = Math.max(1, decoded.width);
    const srcH = Math.max(1, decoded.height);
    const scale = Math.min(1, MAX_SCAN_IMAGE_DIMENSION / Math.max(srcW, srcH));
    const drawW = Math.max(1, Math.round(srcW * scale));
    const drawH = Math.max(1, Math.round(srcH * scale));
    const swapDims = rotateDegrees === 90 || rotateDegrees === 270;

    const canvas = document.createElement('canvas');
    canvas.width = swapDims ? drawH : drawW;
    canvas.height = swapDims ? drawW : drawH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { uploadBlob: file, uploadMime: file.type || 'image/jpeg' };
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotateDegrees * Math.PI) / 180);
    ctx.translate(-drawW / 2, -drawH / 2);
    decoded.draw(ctx, drawW, drawH);
    ctx.restore();

    const uploadBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );

    const previewScale = Math.min(1, PREVIEW_MAX_DIMENSION / Math.max(canvas.width, canvas.height));
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = Math.max(1, Math.round(canvas.width * previewScale));
    previewCanvas.height = Math.max(1, Math.round(canvas.height * previewScale));
    const pCtx = previewCanvas.getContext('2d');
    let previewDataUrl: string | undefined;
    if (pCtx) {
      pCtx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
      previewDataUrl = previewCanvas.toDataURL('image/jpeg', 0.82);
    }

    if (uploadBlob && uploadBlob.size > 0) {
      return {
        uploadBlob,
        uploadMime: 'image/jpeg',
        previewDataUrl,
      };
    }
    return {
      uploadBlob: file,
      uploadMime: file.type || 'image/jpeg',
      previewDataUrl,
    };
  } finally {
    decoded.cleanup();
  }
}

async function postScanRequest(params: {
  body: Blob;
  uploadMime: string;
  fileName: string;
}): Promise<LicenceDiscScanResult> {
  const response = await fetch('/api/extract-licence-disc', {
    method: 'POST',
    headers: {
      'Content-Type': params.uploadMime,
      'x-file-name': encodeURIComponent(params.fileName),
    },
    body: params.body,
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<LicenceDiscScanResult> & {
    error?: string;
  };

  if (!response.ok || !payload.extracted) {
    throw new Error(
      payload.error ||
        (response.status === 404
          ? 'Licence disc extraction endpoint is currently unavailable.'
          : 'Unable to extract details from this licence disc.')
    );
  }

  return {
    extracted: payload.extracted,
    fileName: payload.fileName || params.fileName,
    mimeType: payload.mimeType || params.uploadMime,
  };
}

export async function scanVehicleLicenceDisc(
  file: File,
  options: ScanLicenceDiscOptions = {}
): Promise<LicenceDiscScanResult> {
  if (!file || file.size === 0) {
    throw new Error('Selected licence disc file is empty.');
  }
  if (file.size > MAX_LICENCE_DISC_BYTES) {
    throw new Error('Licence disc file exceeds the 10 MB limit.');
  }

  const mime = (file.type || '').toLowerCase().split(';')[0].trim();
  const dotIdx = file.name.lastIndexOf('.');
  const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : '';

  const isValidMime = ACCEPTED_DISC_MIME_TYPES.has(mime);
  const isValidExtFallback =
    (!mime || mime === 'application/octet-stream') && ACCEPTED_DISC_EXTENSIONS.has(ext);

  if (!isValidMime && !isValidExtFallback) {
    throw new Error(
      'Unsupported format. Please upload a photo (JPG, PNG, WebP, HEIC) or PDF of your vehicle licence disc.'
    );
  }

  const baseMime = isValidMime ? mime : 'application/octet-stream';
  if (isPdfFile(file, baseMime)) {
    options.onStatusChange?.('Scanning PDF disc...');
    return postScanRequest({
      body: file,
      uploadMime: baseMime,
      fileName: file.name,
    });
  }

  const initialRotation: DiscRotationDegrees = options.rotateDegrees ?? 0;
  const shouldAutoRotate = options.autoRotate !== false && options.rotateDegrees === undefined;
  const rotationsToTry: DiscRotationDegrees[] = shouldAutoRotate
    ? [initialRotation, 270, 90]
    : [initialRotation];

  let bestResult: LicenceDiscScanResult | null = null;

  for (let i = 0; i < rotationsToTry.length; i += 1) {
    const rotation = rotationsToTry[i];
    if (i === 0) {
      options.onStatusChange?.(
        rotation === 0 ? 'Scanning disc...' : `Rotating ${rotation}° & scanning...`
      );
    } else {
      options.onStatusChange?.(`Adjusting orientation (${rotation}°) & re-scanning...`);
    }

    let prepared: { uploadBlob: Blob; uploadMime: string; previewDataUrl?: string };
    try {
      prepared = await prepareImagePayload(file, rotation);
    } catch {
      prepared = { uploadBlob: file, uploadMime: baseMime };
    }

    const result = await postScanRequest({
      body: prepared.uploadBlob,
      uploadMime: prepared.uploadMime,
      fileName: file.name,
    });

    const enriched: LicenceDiscScanResult = {
      ...result,
      appliedRotation: rotation,
      previewDataUrl: prepared.previewDataUrl,
    };

    if (!bestResult) {
      bestResult = enriched;
    }

    if (hasUsefulDiscData(enriched.extracted)) {
      return enriched;
    }

    // Only auto-rotate further if browser canvas decoding actually worked
    if (prepared.uploadBlob === file) {
      break;
    }
  }

  return bestResult!;
}

export function buildCustomerAgentSummary(params: {
  requestKind: 'service' | 'parts';
  fullName: string;
  phone: string;
  email: string;
  branchName: string;
  vehicleLabel: string;
  vinNumber: string;
  engineNumber: string;
  vehicleReg: string;
  serviceType?: string;
  mileageKm?: string;
  preferredDate?: string;
  notes: string;
  scannedDisc: LicenceDiscScanResult | null;
}): string {
  const {
    requestKind,
    fullName,
    phone,
    email,
    branchName,
    vehicleLabel,
    vinNumber,
    engineNumber,
    vehicleReg,
    serviceType,
    mileageKm,
    preferredDate,
    notes,
    scannedDisc,
  } = params;

  const lines = [
    `Customer: ${fullName.trim()} | Mobile: ${phone.trim()} | Email: ${email.trim()}`,
    `Branch: ${branchName}`,
    `Vehicle: ${vehicleLabel || 'Identified by VIN'}`,
    `VIN: ${vinNumber.trim() || 'Not provided'}`,
    `Engine Code / No.: ${engineNumber.trim() || 'Not provided'}`,
    `Number Plate / Reg: ${vehicleReg.trim() || 'Not provided'}`,
  ];

  if (requestKind === 'service') {
    if (serviceType) lines.push(`Service Type: ${serviceType}`);
    if (mileageKm) lines.push(`Current Mileage: ${mileageKm.trim()} km`);
    if (preferredDate) lines.push(`Preferred Drop-Off: ${preferredDate}`);
    lines.push(`Customer Notes: ${notes.trim() || 'None'}`);
  } else {
    lines.push(`Part Needed: ${notes.trim()}`);
  }

  if (scannedDisc) {
    const ext = scannedDisc.extracted;
    const discMeta = [
      `File: ${scannedDisc.fileName}`,
      ext.make || ext.model ? `Disc Make/Model: ${[ext.make, ext.model].filter(Boolean).join(' ')}` : '',
      ext.colour ? `Colour: ${ext.colour}` : '',
      ext.discNumber ? `Disc No.: ${ext.discNumber}` : '',
      ext.expiryDate ? `Expiry: ${ext.expiryDate}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    lines.push(`Licence Disc Scan Auto-Fill: Verified (${discMeta})`);
  } else {
    lines.push('Licence Disc Scan: Not uploaded (entered manually)');
  }

  return lines.join('\n');
}
