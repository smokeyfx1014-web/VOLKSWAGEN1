import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  RotateCw,
  ScanLine,
  Upload,
  X,
} from 'lucide-react';
import {
  DiscRotationDegrees,
  LicenceDiscScanResult,
  scanVehicleLicenceDisc,
} from '../lib/licenceDiscScanner';
import { cn } from '../lib/utils';
import { Button } from './ui/shadcn';

interface LicenceDiscUploaderProps {
  mode: 'service' | 'parts';
  scannedDisc: LicenceDiscScanResult | null;
  onScanComplete: (result: LicenceDiscScanResult) => void;
  onClearScan: () => void;
}

export function LicenceDiscUploader({
  mode,
  scannedDisc,
  onScanComplete,
  onClearScan,
}: LicenceDiscUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<DiscRotationDegrees>(0);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Scanning disc...');
  const [scanError, setScanError] = useState<string | null>(null);

  const runScan = async (
    file: File,
    options?: { rotateDegrees?: DiscRotationDegrees; autoRotate?: boolean }
  ) => {
    setScanning(true);
    setScanError(null);
    setScanStatus('Scanning disc...');
    try {
      const result = await scanVehicleLicenceDisc(file, {
        ...options,
        onStatusChange: (status) => setScanStatus(status),
      });
      setRotation(result.appliedRotation ?? 0);
      onScanComplete(result);
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Unable to read licence disc details. Please upload a clearer photo or fill in fields below.'
      );
    } finally {
      setScanning(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setLastFile(file);
    setRotation(0);
    await runScan(file, { autoRotate: true });
  };

  const handleRotateAndRescan = async () => {
    if (!lastFile || scanning) return;
    const nextRotation = (((rotation + 90) % 360) as DiscRotationDegrees);
    setRotation(nextRotation);
    await runScan(lastFile, { rotateDegrees: nextRotation, autoRotate: false });
  };

  const handleRetryLastFile = async () => {
    if (!lastFile || scanning) return;
    await runScan(lastFile, { autoRotate: true });
  };

  const isImageLoaded = Boolean(
    lastFile &&
      !lastFile.name.toLowerCase().endsWith('.pdf') &&
      lastFile.type !== 'application/pdf'
  );

  const ext = scannedDisc?.extracted;

  return (
    <div className="rounded-xl border border-[#CFE0F5] bg-[#EFF6FF]/70 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#001E50]">
            <ScanLine className="h-4 w-4 text-[#00437A]" />
            <span>Upload Vehicle Licence Disc (Optional Auto-Fill)</span>
          </p>
          <p className="text-[11px] leading-relaxed text-[#334155]">
            Snap or upload a photo or PDF of your windscreen licence disc to auto-fill your{' '}
            <strong className="text-[#091224]">VIN, Engine Code, Number Plate &amp; Model</strong>{' '}
            for our {mode === 'service' ? 'Service Advisor' : 'Parts Agent'}—portrait or landscape photos work automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={(e) => void handleFileSelected(e.target.files?.[0])}
          />
          {isImageLoaded && (scannedDisc || scanError) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={scanning}
              onClick={() => void handleRotateAndRescan()}
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Rotate 90° &amp; Re-Scan</span>
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={scanning}
            onClick={() => inputRef.current?.click()}
          >
            {scanning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{scanStatus}</span>
              </>
            ) : scannedDisc ? (
              <>
                <Camera className="h-3.5 w-3.5" />
                <span>Re-Scan Disc</span>
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                <span>Upload / Scan Disc</span>
              </>
            )}
          </Button>
          {scannedDisc && !scanning && (
            <button
              type="button"
              onClick={() => {
                setScanError(null);
                setLastFile(null);
                setRotation(0);
                onClearScan();
              }}
              aria-label="Clear scanned licence disc"
              title="Clear scanned licence disc"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:text-red-700 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {scanError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{scanError}</span>
          </div>
          {lastFile && !scanning && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRetryLastFile()}
            >
              Try Again
            </Button>
          )}
        </div>
      )}

      {ext && !scanning && (
        <div
          className={cn(
            'rounded-lg border bg-white p-3.5 text-xs space-y-2',
            ext.isValidLicenceDisc ? 'border-emerald-200' : 'border-amber-300 bg-amber-50/50'
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 font-semibold',
                ext.isValidLicenceDisc ? 'text-emerald-800' : 'text-amber-900'
              )}
            >
              {ext.isValidLicenceDisc ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              <span>
                {ext.isValidLicenceDisc
                  ? `Extracted from "${scannedDisc.fileName}" — form auto-filled below`
                  : `Checked "${scannedDisc.fileName}" — verify fields below`}
              </span>
            </span>
            {ext.expiryDate && (
              <span className="font-mono text-[11px] text-[#475569]">
                Disc Expiry: {ext.expiryDate}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {scannedDisc.previewDataUrl && (
              <img
                src={scannedDisc.previewDataUrl}
                alt="Scanned vehicle licence disc preview"
                className="h-20 w-20 shrink-0 rounded-lg border border-[#E2E8F0] object-cover bg-[#F8FAFC]"
              />
            )}
            <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-1.5 font-mono text-[11px] text-[#334155] sm:grid-cols-2">
              <p>
                <strong className="font-sans text-[#091224]">VIN:</strong>{' '}
                {ext.vin || 'Not detected'}
              </p>
              <p>
                <strong className="font-sans text-[#091224]">Engine No.:</strong>{' '}
                {ext.engineNumber || 'Not detected'}
              </p>
              <p>
                <strong className="font-sans text-[#091224]">Number Plate:</strong>{' '}
                {ext.registrationNumber || 'Not detected'}
              </p>
              <p>
                <strong className="font-sans text-[#091224]">Vehicle:</strong>{' '}
                {[ext.year, ext.make, ext.model].filter(Boolean).join(' ') || 'Not detected'}
              </p>
              {ext.colour && (
                <p>
                  <strong className="font-sans text-[#091224]">Colour:</strong> {ext.colour}
                </p>
              )}
              {ext.discNumber && (
                <p>
                  <strong className="font-sans text-[#091224]">Disc No.:</strong> {ext.discNumber}
                </p>
              )}
            </div>
          </div>

          {ext.confidenceNote && (
            <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
              Note: {ext.confidenceNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
