import { User } from 'firebase/auth';
import { CareerDocumentRef } from '../types/dealership';

const MAX_CAREER_DOC_BYTES = 10 * 1024 * 1024; // 10 MB

const ACCEPTED_CAREER_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const ACCEPTED_CAREER_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

export type CareerDocKind = 'resume' | 'qualification' | 'idCopy' | 'licence';

export async function uploadCareerDocument(
  file: File,
  _docKind: CareerDocKind
): Promise<CareerDocumentRef> {
  if (!file || file.size === 0) {
    throw new Error('Selected document file is empty.');
  }
  if (file.size > MAX_CAREER_DOC_BYTES) {
    throw new Error('Document exceeds the 10 MB limit. Please upload a smaller PDF or image.');
  }

  const mime = (file.type || '').toLowerCase().split(';')[0].trim();
  const dotIdx = file.name.lastIndexOf('.');
  const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : '';

  const isValidMime = ACCEPTED_CAREER_MIME_TYPES.has(mime);
  const isValidExtFallback =
    (!mime || mime === 'application/octet-stream') && ACCEPTED_CAREER_EXTENSIONS.has(ext);

  if (!isValidMime && !isValidExtFallback) {
    throw new Error(
      'Unsupported file format. Please upload PDF, DOC, DOCX, PNG, JPG, or WebP.'
    );
  }

  const uploadMime = isValidMime ? mime : 'application/octet-stream';
  const response = await fetch('/api/upload-career-doc', {
    method: 'POST',
    headers: {
      'Content-Type': uploadMime,
      'x-file-name': encodeURIComponent(file.name),
    },
    body: file,
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<CareerDocumentRef> & {
    error?: string;
  };

  if (!response.ok || !payload.url) {
    throw new Error(
      payload.error ||
        (response.status === 404
          ? 'Document upload endpoint is currently unavailable.'
          : 'Failed to upload document.')
    );
  }

  return {
    url: payload.url,
    fileName: payload.fileName || file.name,
    mimeType: payload.mimeType || uploadMime,
    sizeBytes: typeof payload.sizeBytes === 'number' ? payload.sizeBytes : file.size,
  };
}

export async function downloadProtectedCareerDoc(
  docUrl: string,
  fileName: string,
  user: User | null
): Promise<void> {
  if (!user) {
    throw new Error('Administrator sign-in is required to download applicant documents.');
  }
  if (!docUrl.startsWith('/api/career-doc/')) {
    throw new Error('Invalid applicant document reference.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(docUrl, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const errPayload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errPayload.error || `Unable to download document (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName || docUrl.split('/').pop() || 'applicant-document';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

export type CareerDocPreviewResult =
  | { kind: 'image'; blobUrl: string; fileName: string; mimeType: string }
  | { kind: 'pdf'; pdfBytes: Uint8Array; fileName: string; mimeType: string }
  | { kind: 'text'; text: string; fileName: string; mimeType: string }
  | { kind: 'unsupported'; fileName: string; mimeType: string; reason: string };

export async function fetchProtectedCareerDocPreview(
  docUrl: string,
  fileName: string,
  mimeType: string,
  user: User | null
): Promise<CareerDocPreviewResult> {
  if (!user) {
    throw new Error('Administrator sign-in is required to view applicant documents.');
  }
  if (!docUrl.startsWith('/api/career-doc/')) {
    throw new Error('Invalid applicant document reference.');
  }

  const lowerName = fileName.toLowerCase();
  const lowerUrl = docUrl.toLowerCase();
  const cleanMime = (mimeType || '').toLowerCase().split(';')[0].trim();

  const isDocx =
    cleanMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx') ||
    lowerUrl.endsWith('.docx');

  const isLegacyDoc =
    cleanMime === 'application/msword' ||
    (lowerName.endsWith('.doc') && !lowerName.endsWith('.docx')) ||
    (lowerUrl.endsWith('.doc') && !lowerUrl.endsWith('.docx'));

  if (isLegacyDoc) {
    return {
      kind: 'unsupported',
      fileName,
      mimeType: cleanMime || 'application/msword',
      reason:
        'Legacy Microsoft Word (.doc) binary files cannot be rendered inline in browsers. Please use Download Copy below to open this document.',
    };
  }

  const idToken = await user.getIdToken();

  if (isDocx) {
    const response = await fetch(`${docUrl}?preview=text`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!response.ok) {
      const errPayload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(errPayload.error || `Unable to preview document (HTTP ${response.status}).`);
    }
    const payload = (await response.json()) as {
      previewType?: string;
      text?: string;
    };
    if (payload.previewType === 'text') {
      return {
        kind: 'text',
        text: (payload.text || '').trim(),
        fileName,
        mimeType:
          cleanMime || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }
    return {
      kind: 'unsupported',
      fileName,
      mimeType: cleanMime || 'application/octet-stream',
      reason: 'No inline preview is available for this document format.',
    };
  }

  const response = await fetch(`${docUrl}?disposition=inline`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const errPayload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errPayload.error || `Unable to preview document (HTTP ${response.status}).`);
  }

  const contentTypeHeader = (response.headers.get('content-type') || '').toLowerCase();
  const isPdf =
    cleanMime === 'application/pdf' ||
    contentTypeHeader.includes('pdf') ||
    lowerName.endsWith('.pdf') ||
    lowerUrl.endsWith('.pdf');

  if (isPdf) {
    const arrayBuffer = await response.arrayBuffer();
    return {
      kind: 'pdf',
      pdfBytes: new Uint8Array(arrayBuffer),
      fileName,
      mimeType: 'application/pdf',
    };
  }

  const rawBlob = await response.blob();

  const isImage =
    cleanMime.startsWith('image/') ||
    rawBlob.type.toLowerCase().startsWith('image/') ||
    /\.(png|jpe?g|webp)$/i.test(lowerName) ||
    /\.(png|jpe?g|webp)$/i.test(lowerUrl);

  if (isImage) {
    return {
      kind: 'image',
      blobUrl: URL.createObjectURL(rawBlob),
      fileName,
      mimeType: cleanMime || rawBlob.type || 'image/png',
    };
  }

  return {
    kind: 'unsupported',
    fileName,
    mimeType: cleanMime || rawBlob.type || 'application/octet-stream',
    reason: 'This document type cannot be previewed directly. Use Download Copy below.',
  };
}

