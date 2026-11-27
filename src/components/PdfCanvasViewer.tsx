import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from './ui/shadcn';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfCanvasViewerProps {
  pdfBytes: Uint8Array;
  fileName: string;
}

interface PdfPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

function PdfPageCanvas({ pdfDoc, pageNumber, scale }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    async function renderPage() {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const viewport = page.getViewport({ scale });
      const outputScale = dpr;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      renderTask = page.render({
        canvas,
        viewport,
        transform,
      });

      await renderTask.promise;
    }

    renderPage().catch((err: unknown) => {
      if (cancelled) return;
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        (err as { name?: string }).name === 'RenderingCancelledException'
      ) {
        return;
      }
      console.error('PDF page render error:', err);
    });

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber, scale]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="overflow-x-auto max-w-full rounded-lg border border-[#CBD5E1] bg-white shadow-sm">
        <canvas ref={canvasRef} className="block max-w-full h-auto" />
      </div>
      <span className="text-[11px] font-medium text-[#64748B]">Page {pageNumber}</span>
    </div>
  );
}

export function PdfCanvasViewer({ pdfBytes, fileName }: PdfCanvasViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(),
    });

    setLoading(true);
    setRenderError(null);
    setPdfDoc(null);
    setNumPages(0);

    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          void doc.cleanup();
          return;
        }
        loadedDoc = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      })
      .catch((err) => {
        if (cancelled) return;
        setRenderError(
          err instanceof Error ? err.message : `Unable to render PDF "${fileName}".`
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
      if (loadedDoc) {
        void loadedDoc.cleanup();
      }
    };
  }, [pdfBytes, fileName]);

  if (loading) {
    return (
      <div className="flex h-[56vh] items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#475569]">
        Rendering PDF pages...
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-xs text-red-900">
        {renderError}
      </div>
    );
  }

  if (!pdfDoc || numPages === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center text-xs text-[#475569]">
        No readable pages found in this PDF document.
      </div>
    );
  }

  const pageNumbers = Array.from({ length: numPages }, (_, idx) => idx + 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs">
        <span className="font-medium text-[#334155]">
          {numPages} {numPages === 1 ? 'page' : 'pages'} · Rendered directly in browser
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(2))))}
            disabled={scale <= 0.6}
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-12 text-center font-mono text-[11px] font-semibold text-[#091224]">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => setScale((s) => Math.min(2.2, Number((s + 0.2).toFixed(2))))}
            disabled={scale >= 2.2}
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="max-h-[62vh] overflow-y-auto rounded-xl border border-[#CBD5E1] bg-slate-100 p-4 space-y-5">
        {pageNumbers.map((pageNum) => (
          <PdfPageCanvas key={pageNum} pdfDoc={pdfDoc} pageNumber={pageNum} scale={scale} />
        ))}
      </div>
    </div>
  );
}
