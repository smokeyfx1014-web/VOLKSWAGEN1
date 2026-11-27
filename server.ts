import express, { type Request } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import nodemailer from 'nodemailer';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { type DecodedIdToken, getAuth } from 'firebase-admin/auth';
import {
  type ParsedAutoTraderVehicle,
  extractAutoTraderPaginationInfo,
  parseAutoTraderHtml,
  validateAutoTraderDealerUrl,
} from './src/lib/autotraderParser.ts';
import { deriveBranchCareersEmail } from './src/lib/careerEmail.ts';
import type { DealershipId } from './src/types/dealership.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);

const BOOTSTRAPPED_ADMIN_EMAIL = 'smokeyfx1014@gmail.com';
const MAX_PAGES_PER_DEALER = 4;
const VALID_UID_RE = /^[a-zA-Z0-9_-]{2,128}$/;

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
  authDomain?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const candidates = [
    path.resolve(__dirname, 'firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, 'utf8');
      return JSON.parse(raw) as FirebaseAppletConfig;
    }
  }
  throw new Error('firebase-applet-config.json not found in server runtime directory.');
}

function ensureWritableDir(preferredDir: string, fallbackSubdir: string): string {
  if (!process.env.VERCEL) {
    try {
      fs.mkdirSync(preferredDir, { recursive: true });
      return preferredDir;
    } catch {
      // Fall back to OS temporary directory when container root is read-only
    }
  }
  const tmpDir = path.join(os.tmpdir(), 'vw-dealership-storage', fallbackSubdir);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

const firebaseConfig = loadFirebaseConfig();
// Initialize Admin Auth with projectId ONLY (ID token verification requires zero IAM roles)
const adminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);

interface FirestoreRestValue {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string | number;
  doubleValue?: number;
  timestampValue?: string;
  nullValue?: string;
  mapValue?: {
    fields?: Record<string, FirestoreRestValue>;
  };
}

interface FirestoreRestDoc {
  fields?: Record<string, FirestoreRestValue>;
}

async function fetchOwnFirestoreDoc(
  collectionName: 'admins' | 'staffUsers',
  uid: string,
  idToken: string
): Promise<FirestoreRestDoc | null> {
  if (!VALID_UID_RE.test(uid)) return null;
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(
    firebaseConfig.firestoreDatabaseId
  )}/documents/${collectionName}/${encodeURIComponent(uid)}`;

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return (await response.json()) as FirestoreRestDoc;
}

interface VerifiedPortalCaller {
  ok: true;
  decoded: DecodedIdToken;
  isGroupAdmin: boolean;
  isItManager: boolean;
  isBranchAdmin: boolean;
  isItAgent: boolean;
  baseRole: string;
  effectiveRole: string;
  effectiveBranchId: string | null;
}

const VALID_ESCALATABLE_ROLES = new Set(['branch_admin', 'agent', 'parts', 'service', 'marketing']);

async function verifyPortalCaller(
  req: Request
): Promise<VerifiedPortalCaller | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.authorization ?? '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    return { ok: false, status: 401, error: 'Missing Firebase Authentication Bearer token.' };
  }

  const idToken = tokenMatch[1];
  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired Firebase authentication token.' };
  }

  if (
    decoded.email_verified &&
    decoded.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
  ) {
    return {
      ok: true,
      decoded,
      isGroupAdmin: true,
      isItManager: false,
      isBranchAdmin: false,
      isItAgent: false,
      baseRole: 'admin',
      effectiveRole: 'admin',
      effectiveBranchId: null,
    };
  }

  const [staffDoc, adminDoc] = await Promise.all([
    fetchOwnFirestoreDoc('staffUsers', decoded.uid, idToken).catch(() => null),
    fetchOwnFirestoreDoc('admins', decoded.uid, idToken).catch(() => null),
  ]);

  const staffRole = staffDoc?.fields?.role?.stringValue ?? '';
  const staffActive = staffDoc?.fields?.active?.booleanValue === true;
  const allocatedBranch = staffDoc?.fields?.allocatedDealershipId?.stringValue ?? null;
  const isStaffAdmin = staffRole === 'admin' && staffActive;
  const isRosterAdmin = adminDoc?.fields?.role?.stringValue === 'admin';
  const isGroupAdmin = isStaffAdmin || isRosterAdmin;
  const isItManager = staffActive && staffRole === 'it_manager';
  const isItAgent = staffActive && staffRole === 'it_agent';

  let effectiveRole = isGroupAdmin ? 'admin' : staffRole;
  let effectiveBranchId = allocatedBranch;

  if (!isGroupAdmin && isItAgent) {
    const escFields = staffDoc?.fields?.activeEscalation?.mapValue?.fields;
    const grantedRole = escFields?.grantedRole?.stringValue ?? '';
    const escBranch = escFields?.dealershipId?.stringValue ?? null;
    const expiresIso = escFields?.expiresAt?.timestampValue ?? '';
    const expiresMs = expiresIso ? Date.parse(expiresIso) : 0;
    if (
      VALID_ESCALATABLE_ROLES.has(grantedRole) &&
      Number.isFinite(expiresMs) &&
      expiresMs > Date.now()
    ) {
      effectiveRole = grantedRole;
      if (escBranch) effectiveBranchId = escBranch;
    }
  }

  const isBranchAdmin =
    !isGroupAdmin && !isItManager && staffActive && effectiveRole === 'branch_admin';

  const isAuthorizedStaff =
    isGroupAdmin ||
    (staffActive &&
      [
        'branch_admin',
        'it_manager',
        'it_agent',
        'agent',
        'marketing',
        'parts',
        'service',
      ].includes(effectiveRole));

  if (!isAuthorizedStaff) {
    return {
      ok: false,
      status: 403,
      error: 'Active dealership staff privileges are required.',
    };
  }

  return {
    ok: true,
    decoded,
    isGroupAdmin,
    isItManager,
    isBranchAdmin,
    isItAgent,
    baseRole: isGroupAdmin ? 'admin' : staffRole,
    effectiveRole,
    effectiveBranchId,
  };
}

const UPLOAD_CATEGORIES = new Set(['logos', 'promotions', 'vehicles', 'news']);
const IMAGE_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
};
const VIDEO_MIME_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};
const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_CAREER_DOC_BYTES = 10 * 1024 * 1024;

const CAREER_DOC_MIME_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
};

const CAREER_EXT_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const MAX_LICENCE_DISC_BYTES = 10 * 1024 * 1024;
const LICENCE_DISC_MIME_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};
const LICENCE_DISC_EXT_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

const VALID_CAREER_FILENAME_RE = /^[a-zA-Z0-9._-]+$/;

const EMAIL_SIMPLE_RE = /^[^\s@<>()[\],;:"\\]+@[^\s@<>()[\],;:"\\]+\.[^\s@<>()[\],;:"\\]{2,}$/;
const VALID_LEAD_TYPES = new Set([
  'test-drive',
  'service',
  'parts',
  'spotter',
  'finance',
  'vehicle-inquiry',
  'contact',
  'event-rsvp',
  'competition-entry',
  'job-application',
]);
const VALID_BRANCH_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

const LEAD_TYPE_LABELS: Record<string, string> = {
  'test-drive': 'Test Drive Request',
  service: 'Service Booking Request',
  parts: 'Parts Enquiry',
  spotter: 'Spotter Referral Lead',
  finance: 'Finance Application',
  'vehicle-inquiry': 'Vehicle Sales Enquiry',
  contact: 'General Contact Enquiry',
  'event-rsvp': 'Event RSVP',
  'competition-entry': 'Competition Entry',
  'job-application': 'Career Job Application',
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripCrlf(raw: string): string {
  return raw.replace(/[\r\n]+/g, ' ').trim();
}

function sanitizeEmailAddr(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = stripCrlf(raw).slice(0, 140);
  if (!cleaned || !EMAIL_SIMPLE_RE.test(cleaned)) return null;
  return cleaned;
}

async function fetchPublicFirestoreDoc(
  collectionPath: 'groupSettings' | 'dealerships',
  docId: string
): Promise<FirestoreRestDoc | null> {
  if (!VALID_BRANCH_ID_RE.test(docId)) return null;
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(
    firebaseConfig.firestoreDatabaseId
  )}/documents/${collectionPath}/${encodeURIComponent(docId)}`;

  const response = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) return null;
  return (await response.json()) as FirestoreRestDoc;
}

async function fetchFirestoreCollection(
  collectionPath: 'dealerships',
  idToken?: string
): Promise<Array<FirestoreRestDoc & { name?: string }>> {
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(
    firebaseConfig.firestoreDatabaseId
  )}/documents/${collectionPath}?pageSize=100`;

  const response = await fetch(endpoint, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    documents?: Array<FirestoreRestDoc & { name?: string }>;
  };
  return Array.isArray(data.documents) ? data.documents : [];
}

const VALID_SMTP_PASS_KEY_RE = /^SMTP_PASS(?:_[A-Z0-9_]{1,40})?$/;

function deriveBranchSmtpPassKey(branchId: string, configuredKey?: string): string {
  const cleanedConfigured = (configuredKey || '').trim().toUpperCase();
  if (cleanedConfigured && VALID_SMTP_PASS_KEY_RE.test(cleanedConfigured)) {
    return cleanedConfigured;
  }
  const normalizedBranch =
    branchId
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'MAIN';
  return `SMTP_PASS_BRANCH_${normalizedBranch}`;
}

function getSmtpConfig(groupDoc?: FirestoreRestDoc | null) {
  const groupHost = stripCrlf(groupDoc?.fields?.smtpHost?.stringValue || '');
  const rawGroupPort = groupDoc?.fields?.smtpPort;
  const parsedGroupPort = Number(rawGroupPort?.integerValue ?? rawGroupPort?.doubleValue ?? 0);
  const groupUser = sanitizeEmailAddr(groupDoc?.fields?.smtpUser?.stringValue);
  const groupFrom = stripCrlf(groupDoc?.fields?.smtpFrom?.stringValue || '');
  const groupDefaultNotify = sanitizeEmailAddr(groupDoc?.fields?.defaultNotifyEmail?.stringValue);
  const rawGroupPassKey = stripCrlf(groupDoc?.fields?.smtpPassEnvKey?.stringValue || '').toUpperCase();
  const passEnvKey = VALID_SMTP_PASS_KEY_RE.test(rawGroupPassKey) ? rawGroupPassKey : 'SMTP_PASS';

  const host = stripCrlf(process.env.SMTP_HOST || groupHost || 'smtp.gmail.com');
  const port = Number(
    process.env.SMTP_PORT ||
      (Number.isFinite(parsedGroupPort) && parsedGroupPort >= 1 && parsedGroupPort <= 65535
        ? Math.round(parsedGroupPort)
        : 465)
  );
  const user =
    sanitizeEmailAddr(process.env.SMTP_USER) || groupUser || BOOTSTRAPPED_ADMIN_EMAIL;
  const pass = (process.env[passEnvKey] || process.env.SMTP_PASS || '').trim();
  const fromRaw = stripCrlf(process.env.SMTP_FROM || groupFrom || '');
  const from = fromRaw || `Dealership Requests <${user}>`;
  const defaultNotify =
    sanitizeEmailAddr(process.env.DEFAULT_LEAD_NOTIFY_EMAIL) ||
    groupDefaultNotify ||
    BOOTSTRAPPED_ADMIN_EMAIL;

  return {
    configured: Boolean(pass && pass !== 'YOUR_GMAIL_APP_PASSWORD'),
    passEnvKey,
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    secure: (Number.isFinite(port) && port > 0 ? port : 465) === 465,
    user,
    pass,
    from,
    defaultNotify,
  };
}

function resolveBranchSmtpConfig(
  branchId: string,
  branchDoc: FirestoreRestDoc | null,
  groupDoc?: FirestoreRestDoc | null
) {
  const globalSmtp = getSmtpConfig(groupDoc);
  const branchName = stripCrlf(branchDoc?.fields?.name?.stringValue || `Branch ${branchId}`);
  const branchHost = stripCrlf(branchDoc?.fields?.smtpHost?.stringValue || '');
  const rawPortField = branchDoc?.fields?.smtpPort;
  const parsedBranchPort = Number(rawPortField?.integerValue ?? rawPortField?.doubleValue ?? 0);
  const branchUser = sanitizeEmailAddr(branchDoc?.fields?.smtpUser?.stringValue);
  const branchFrom = stripCrlf(branchDoc?.fields?.smtpFrom?.stringValue || '');
  const branchDefaultNotify = sanitizeEmailAddr(
    branchDoc?.fields?.defaultNotifyEmail?.stringValue
  );
  const branchPassKey = deriveBranchSmtpPassKey(
    branchId,
    branchDoc?.fields?.smtpPassEnvKey?.stringValue
  );

  const specificPass = (process.env[branchPassKey] || '').trim();
  const hasSpecificSecret = Boolean(specificPass && specificPass !== 'YOUR_GMAIL_APP_PASSWORD');

  const configuredHost = branchHost || globalSmtp.host;
  const configuredPort =
    Number.isFinite(parsedBranchPort) && parsedBranchPort >= 1 && parsedBranchPort <= 65535
      ? Math.round(parsedBranchPort)
      : globalSmtp.port;
  const configuredUser = branchUser || globalSmtp.user;
  const configuredFrom = branchFrom || `${branchName} <${configuredUser}>`;
  const sharesGlobalMailbox =
    !branchUser || branchUser.toLowerCase() === globalSmtp.user.toLowerCase();
  const branchSecretConfigured =
    hasSpecificSecret || (sharesGlobalMailbox && globalSmtp.configured);

  let activeHost = configuredHost;
  let activePort = configuredPort;
  let activeSecure = configuredPort === 465;
  let activeUser = configuredUser;
  let activePass = '';
  let activeFrom = configuredFrom;
  let usedFallback = false;

  if (hasSpecificSecret) {
    activePass = specificPass;
  } else if (sharesGlobalMailbox && globalSmtp.configured) {
    activePass = globalSmtp.pass;
  } else if (globalSmtp.configured) {
    activePass = globalSmtp.pass;
    activeHost = globalSmtp.host;
    activePort = globalSmtp.port;
    activeSecure = globalSmtp.secure;
    activeUser = globalSmtp.user;
    activeFrom = globalSmtp.from;
    usedFallback = true;
  }

  return {
    globalConfigured: globalSmtp.configured,
    globalDefaultNotify: globalSmtp.defaultNotify,
    branchPassKey,
    branchSecretConfigured,
    effectiveReady: Boolean(activePass),
    usedFallback,
    host: activeHost,
    port: activePort,
    secure: activeSecure,
    user: activeUser,
    pass: activePass,
    from: activeFrom,
    branchConfiguredHost: configuredHost,
    branchConfiguredPort: configuredPort,
    branchConfiguredUser: configuredUser,
    branchConfiguredFrom: configuredFrom,
    branchDefaultNotify,
  };
}

function resolveBranchEmailField(leadType: string): string {
  switch (leadType) {
    case 'service':
      return 'serviceNotifyEmail';
    case 'parts':
      return 'partsNotifyEmail';
    case 'test-drive':
    case 'vehicle-inquiry':
    case 'spotter':
      return 'salesNotifyEmail';
    case 'finance':
      return 'financeNotifyEmail';
    default:
      return 'generalNotifyEmail';
  }
}

const leadNotifyBuckets = new Map<string, number[]>();
function allowLeadEmailRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxPerWindow = 10;
  const recent = (leadNotifyBuckets.get(ip) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= maxPerWindow) {
    leadNotifyBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  leadNotifyBuckets.set(ip, recent);
  return true;
}

const careerUploadBuckets = new Map<string, number[]>();
function allowCareerUploadRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxPerWindow = 25;
  const recent = (careerUploadBuckets.get(ip) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= maxPerWindow) {
    careerUploadBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  careerUploadBuckets.set(ip, recent);
  return true;
}

const licenceScanBuckets = new Map<string, number[]>();
function allowLicenceScanRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxPerWindow = 45;
  const recent = (licenceScanBuckets.get(ip) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= maxPerWindow) {
    licenceScanBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  licenceScanBuckets.set(ip, recent);
  return true;
}

let cachedGeminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  if (!cachedGeminiClient) {
    cachedGeminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedGeminiClient;
}

interface ScrapeBranchInput {
  id: DealershipId;
  name: string;
  autotraderDealerId: string;
  autotraderUrl: string;
  syncEnabled: boolean;
}

function buildDecodoAuthHeader(apiKey: string, mode: 'bearer' | 'basic'): string {
  const trimmed = apiKey.trim();
  if (mode === 'basic') {
    const token = /^Basic\s+/i.test(trimmed)
      ? trimmed
      : trimmed.includes(':')
      ? `Basic ${Buffer.from(trimmed).toString('base64')}`
      : `Basic ${trimmed}`;
    return token;
  }
  return /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

async function fetchDecodoPageHtml(pageUrl: string, apiKey: string): Promise<string> {
  const payload = JSON.stringify({
    url: pageUrl,
    proxy_pool: 'premium',
    headless: 'html',
  });

  const attempt = async (mode: 'bearer' | 'basic') => {
    const response = await fetch('https://data.decodo.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: buildDecodoAuthHeader(apiKey, mode),
      },
      body: payload,
      signal: AbortSignal.timeout(45000),
    });
    return response;
  };

  let response = await attempt('bearer');
  if (response.status === 401 || response.status === 403) {
    response = await attempt('basic');
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `Decodo API returned HTTP ${response.status}${errText ? `: ${errText.slice(0, 180)}` : ''}`
    );
  }

  const json = (await response.json()) as {
    results?: Array<{ content?: string }>;
    content?: string;
  };
  return json.results?.[0]?.content ?? json.content ?? '';
}

export async function createApp(options: { isServerless?: boolean } = {}) {
  const app = express();
  const uploadsRoot = ensureWritableDir(path.resolve(__dirname, 'uploads'), 'uploads');

  app.use(
    '/uploads',
    (req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (req.path.toLowerCase().endsWith('.svg')) {
        res.setHeader(
          'Content-Security-Policy',
          "sandbox; default-src 'none'; style-src 'unsafe-inline'"
        );
      }
      next();
    },
    express.static(uploadsRoot, { maxAge: '7d', index: false })
  );

  app.post(
    '/api/upload-media',
    express.raw({ type: '*/*', limit: '26mb' }),
    async (req, res) => {
      try {
        const rawCategory = String(req.query.category || 'promotions').trim().toLowerCase();
        const category = UPLOAD_CATEGORIES.has(rawCategory) ? rawCategory : 'promotions';
        const requireAdmin = category === 'logos';

        const authCheck = await verifyPortalCaller(req);
        if (!authCheck.ok) {
          res.status(authCheck.status).json({ error: authCheck.error });
          return;
        }
        if (requireAdmin && !authCheck.isGroupAdmin) {
          res.status(403).json({ error: 'Group Administrator privileges are required to upload group logos.' });
          return;
        }
        if (
          authCheck.effectiveRole === 'it_agent'
        ) {
          res.status(403).json({ error: 'IT Agents require an active temporary role escalation to upload catalog media.' });
          return;
        }

        const mime = String(req.headers['content-type'] || '')
          .toLowerCase()
          .split(';')[0]
          .trim();
        const imageExt = IMAGE_MIME_EXT[mime];
        const videoExt = VIDEO_MIME_EXT[mime];

        if (!imageExt && !(category === 'promotions' && videoExt)) {
          res.status(400).json({
            error:
              category === 'promotions'
                ? 'Unsupported file type. Upload PNG, JPG, WebP, SVG, GIF, AVIF, MP4, WebM, or MOV.'
                : 'Unsupported image type. Upload PNG, JPG, WebP, SVG, GIF, or AVIF.',
          });
          return;
        }

        const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (fileBuffer.length === 0) {
          res.status(400).json({ error: 'Uploaded file is empty.' });
          return;
        }

        const isVideo = Boolean(videoExt);
        const maxBytes = isVideo ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
        if (fileBuffer.length > maxBytes) {
          res.status(413).json({
            error: isVideo
              ? 'Video file exceeds the 25 MB limit.'
              : 'Image file exceeds the 8 MB limit.',
          });
          return;
        }

        let originalName = 'media';
        try {
          originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'media'));
        } catch {
          originalName = String(req.headers['x-file-name'] || 'media');
        }
        const safeStem =
          path
            .basename(originalName, path.extname(originalName))
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || 'asset';

        const ext = imageExt || videoExt;
        const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeStem}${ext}`;
        const categoryDir = path.join(uploadsRoot, category);
        fs.mkdirSync(categoryDir, { recursive: true });
        fs.writeFileSync(path.join(categoryDir, filename), fileBuffer);

        res.status(201).json({
          url: `/uploads/${category}/${filename}`,
          mediaType: isVideo ? 'video' : 'image',
          mimeType: mime,
          sizeBytes: fileBuffer.length,
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Unable to save uploaded media file.',
        });
      }
    }
  );

  const careerUploadsDir = ensureWritableDir(
    path.resolve(__dirname, 'private_uploads', 'careers'),
    'private_careers'
  );

  app.post(
    '/api/upload-career-doc',
    express.raw({ type: '*/*', limit: '11mb' }),
    async (req, res) => {
      try {
        const clientIp =
          String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
            .split(',')[0]
            .trim();
        if (!allowCareerUploadRateLimit(clientIp)) {
          res.status(429).json({
            error: 'Too many document uploads from this address. Please wait a few minutes and try again.',
          });
          return;
        }

        let originalName = 'document';
        try {
          originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'document'));
        } catch {
          originalName = String(req.headers['x-file-name'] || 'document');
        }
        const safeOriginalBase = path.basename(originalName);
        const origExt = path.extname(safeOriginalBase).toLowerCase();

        const rawMime = String(req.headers['content-type'] || '')
          .toLowerCase()
          .split(';')[0]
          .trim();

        let ext = CAREER_DOC_MIME_EXT[rawMime] || '';
        let resolvedMime = ext ? rawMime : '';
        if (!ext && (!rawMime || rawMime === 'application/octet-stream') && CAREER_EXT_MIME[origExt]) {
          ext = origExt;
          resolvedMime = CAREER_EXT_MIME[origExt];
        }

        if (!ext) {
          res.status(400).json({
            error:
              'Unsupported document type. Please upload PDF, DOC, DOCX, PNG, JPG, or WebP files.',
          });
          return;
        }

        const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (fileBuffer.length === 0) {
          res.status(400).json({ error: 'Uploaded document is empty.' });
          return;
        }
        if (fileBuffer.length > MAX_CAREER_DOC_BYTES) {
          res.status(413).json({ error: 'Document exceeds the 10 MB file size limit.' });
          return;
        }

        const safeStem =
          path
            .basename(safeOriginalBase, path.extname(safeOriginalBase))
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || 'doc';

        const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeStem}${ext}`;
        const destPath = path.resolve(careerUploadsDir, filename);
        if (!destPath.startsWith(careerUploadsDir + path.sep)) {
          res.status(400).json({ error: 'Invalid destination path.' });
          return;
        }

        fs.writeFileSync(destPath, fileBuffer);
        const cleanDisplayName = safeOriginalBase.replace(/[\r\n]+/g, ' ').slice(0, 180) || filename;

        res.status(201).json({
          url: `/api/career-doc/${filename}`,
          fileName: cleanDisplayName,
          mimeType: resolvedMime || 'application/octet-stream',
          sizeBytes: fileBuffer.length,
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Unable to store uploaded applicant document.',
        });
      }
    }
  );

  app.get('/api/career-doc/:filename', async (req, res) => {
    try {
      const authCheck = await verifyPortalCaller(req);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }
      if (!authCheck.isGroupAdmin && !authCheck.isItManager && !authCheck.isBranchAdmin) {
        res.status(403).json({
          error: 'Group Admin, IT Manager, or Branch Admin privileges are required to inspect applicant documents.',
        });
        return;
      }

      const rawFilename = String(req.params.filename || '').trim();
      const safeFilename = path.basename(rawFilename);
      if (
        !safeFilename ||
        safeFilename !== rawFilename ||
        !VALID_CAREER_FILENAME_RE.test(safeFilename)
      ) {
        res.status(400).json({ error: 'Invalid document filename.' });
        return;
      }

      const resolvedPath = path.resolve(careerUploadsDir, safeFilename);
      if (!resolvedPath.startsWith(careerUploadsDir + path.sep)) {
        res.status(400).json({ error: 'Invalid document path.' });
        return;
      }
      if (!fs.existsSync(resolvedPath)) {
        res.status(404).json({ error: 'Applicant document not found.' });
        return;
      }

      const ext = path.extname(safeFilename).toLowerCase();
      const previewMode = req.query.preview === 'text';

      if (previewMode) {
        if (ext === '.docx') {
          const result = await mammoth.extractRawText({ path: resolvedPath });
          res.setHeader('Cache-Control', 'no-store');
          res.json({
            previewType: 'text',
            text: result.value || '',
            fileName: safeFilename,
          });
          return;
        }
        res.setHeader('Cache-Control', 'no-store');
        res.json({
          previewType: 'unsupported',
          text: '',
          fileName: safeFilename,
        });
        return;
      }

      const mime = CAREER_EXT_MIME[ext] || 'application/octet-stream';
      const downloadName = safeFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `${disposition}; filename="${downloadName}"`);
      res.sendFile(resolvedPath);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to retrieve applicant document.',
      });
    }
  });

  app.post(
    '/api/extract-licence-disc',
    express.raw({ type: '*/*', limit: '11mb' }),
    async (req, res) => {
      try {
        const clientIp =
          String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
            .split(',')[0]
            .trim();
        if (!allowLicenceScanRateLimit(clientIp)) {
          res.status(429).json({
            error: 'Too many licence disc scan attempts. Please wait a few minutes and try again.',
          });
          return;
        }

        let originalName = 'licence-disc';
        try {
          originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'licence-disc'));
        } catch {
          originalName = String(req.headers['x-file-name'] || 'licence-disc');
        }
        const safeOriginalBase = path.basename(originalName);
        const origExt = path.extname(safeOriginalBase).toLowerCase();

        const rawMime = String(req.headers['content-type'] || '')
          .toLowerCase()
          .split(';')[0]
          .trim();

        let ext = LICENCE_DISC_MIME_EXT[rawMime] || '';
        let resolvedMime = ext ? (rawMime === 'image/jpg' ? 'image/jpeg' : rawMime) : '';
        if (
          !ext &&
          (!rawMime || rawMime === 'application/octet-stream') &&
          LICENCE_DISC_EXT_MIME[origExt]
        ) {
          ext = origExt;
          resolvedMime = LICENCE_DISC_EXT_MIME[origExt];
        }

        if (!ext || !resolvedMime) {
          res.status(400).json({
            error:
              'Unsupported file format. Upload a clear JPG, PNG, WebP, HEIC photo or PDF of your vehicle licence disc.',
          });
          return;
        }

        const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (fileBuffer.length === 0) {
          res.status(400).json({ error: 'Uploaded licence disc file is empty.' });
          return;
        }
        if (fileBuffer.length > MAX_LICENCE_DISC_BYTES) {
          res.status(413).json({ error: 'File exceeds the 10 MB size limit.' });
          return;
        }

        let ai: GoogleGenAI;
        try {
          ai = getGeminiClient();
        } catch {
          res.status(503).json({
            error:
              'Automatic licence disc scanning is currently unavailable because GEMINI_API_KEY is not configured in server secrets.',
          });
          return;
        }

        const licenceDiscPromptConfig = {
          systemInstruction: [
            'You extract structured vehicle data from South African eNaTIS Motor Vehicle Licence Discs (round windscreen discs) and vehicle registration certificates.',
            'Photos may be taken in landscape, portrait, or rotated 90/180/270 degrees (text running vertically or upside down). Read the disc accurately regardless of rotation.',
            'Accuracy & eNaTIS field mapping rules:',
            '1. VIN / Chassis No.: Usually 17 uppercase alphanumeric characters (ISO VINs never contain letters I, O, or Q). Remove any spaces or hyphens.',
            '2. Engine no. / Enjinnr.: Extract the exact alphanumeric engine number/code printed beneath or beside "Engine no./Enjinnr." (e.g. "CZC509367").',
            '3. Licence no. / Lisensienr. (registrationNumber): Extract ONLY the vehicle number plate printed next to "Licence no. / Lisensienr." (e.g. "BM67BMZN", "NN 45210", "CA 123-456") in uppercase. Do NOT confuse it with "Veh. register no. / Vrt.registernr." (such as "GRF715K").',
            '4. Make & Model/Description: Fix spaced dot-matrix/laser printing in makes (e.g. "AUD I" -> "Audi", "VOLKSWAGE N" -> "Volkswagen") and extract body/model description (e.g. "Hatchback", "Polo Vivo").',
            '5. Year: Leave empty string "" unless the vehicle model/manufacture/first-registration year is explicitly printed. NEVER use the year from "Date of test / Datum van toets" or "Date of expiry / Vervaldatum" as the vehicle year.',
            '6. Disc Number ("NO. ... NR."): Extract the alphanumeric control number (e.g. "20310049GCZ5").',
            '7. Expiry Date: Extract "Date of expiry/Vervaldatum" (YYYY-MM-DD if visible).',
            '8. Set isValidLicenceDisc to false only if the file is clearly unrelated (e.g. selfie, blank page, unreadable blur) and explain briefly in confidenceNote.',
          ].join('\n'),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isValidLicenceDisc: {
                type: Type.BOOLEAN,
                description: 'True if the image/PDF shows a vehicle licence disc or registration card.',
              },
              vin: {
                type: Type.STRING,
                description: 'VIN / Chassis number (uppercase, no spaces). Empty string if illegible.',
              },
              engineNumber: {
                type: Type.STRING,
                description: 'Engine number / engine code printed on the disc. Empty string if not visible.',
              },
              registrationNumber: {
                type: Type.STRING,
                description: 'Vehicle licence/registration plate number (from Licence no./Lisensienr.). Empty string if not visible.',
              },
              make: {
                type: Type.STRING,
                description: 'Vehicle make (e.g. Volkswagen, Audi, Porsche).',
              },
              model: {
                type: Type.STRING,
                description: 'Vehicle model/series or body description.',
              },
              year: {
                type: Type.STRING,
                description: '4-digit vehicle model year if explicitly printed, otherwise empty string (do not use expiry/test date).',
              },
              colour: {
                type: Type.STRING,
                description: 'Vehicle colour if printed, otherwise empty string.',
              },
              discNumber: {
                type: Type.STRING,
                description: 'Licence disc control number (NO. ... NR.) if visible.',
              },
              expiryDate: {
                type: Type.STRING,
                description: 'Licence disc expiry date (YYYY-MM-DD or printed format).',
              },
              confidenceNote: {
                type: Type.STRING,
                description: 'Short note if glare, blur, or missing characters occurred, or empty string.',
              },
            },
            required: [
              'isValidLicenceDisc',
              'vin',
              'engineNumber',
              'registrationNumber',
              'make',
              'model',
              'year',
              'colour',
              'discNumber',
              'expiryDate',
              'confidenceNote',
            ],
          },
        };

        const modelAttempts: Array<{ model: string; delayMs: number }> = [
          { model: 'gemini-4-hydrogen', delayMs: 0 },
          { model: 'gemini-4-hydrogen', delayMs: 650 },
          { model: 'gemini-3.1-flash-lite', delayMs: 250 },
          { model: 'gemini-3.1-flash-lite', delayMs: 700 },
        ];

        const base64ImageData = fileBuffer.toString('base64');
        let responseText: string | undefined;
        let lastErr: unknown;

        for (const attempt of modelAttempts) {
          if (attempt.delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, attempt.delayMs));
          }
          try {
            const response = await ai.models.generateContent({
              model: attempt.model,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: resolvedMime,
                      data: base64ImageData,
                    },
                  },
                  {
                    text: 'Extract all vehicle identification fields from this South African motor vehicle licence disc (or registration document). Note the image may be sideways or rotated—orient mentally so all labels read left-to-right. Return clean JSON matching the schema. Do not invent values that are not visible.',
                  },
                ],
              },
              config: licenceDiscPromptConfig,
            });
            responseText = response.text;
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            const rawErrMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
            const isPermanentAuthError =
              rawErrMsg.includes('permission_denied') ||
              rawErrMsg.includes('api_key_invalid') ||
              rawErrMsg.includes('invalid_argument');
            if (isPermanentAuthError) {
              throw err;
            }
          }
        }

        if (lastErr) {
          throw lastErr;
        }

        const rawJsonText = (responseText ?? '{}').trim();
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(rawJsonText) as Record<string, unknown>;
        } catch {
          res.status(502).json({
            error:
              'Could not read structured vehicle data from that file. Try clicking "Rotate 90° & Re-Scan" or upload a clearer photo.',
          });
          return;
        }

        const cleanStr = (v: unknown, maxLen: number) =>
          typeof v === 'string' ? stripCrlf(v).slice(0, maxLen) : '';
        const normalizeMake = (raw: string) => {
          const compact = raw.replace(/\s+/g, ' ').trim();
          const noSpaces = compact.replace(/\s+/g, '').toUpperCase();
          if (noSpaces === 'AUDI') return 'Audi';
          if (noSpaces === 'VOLKSWAGEN' || noSpaces === 'VW') return 'Volkswagen';
          if (noSpaces === 'PORSCHE') return 'Porsche';
          if (noSpaces === 'SKODA') return 'Škoda';
          if (noSpaces === 'SEAT') return 'SEAT';
          return compact;
        };
        const rawYear = cleanStr(parsed.year, 12);
        const yearMatch = rawYear.match(/\b(19\d{2}|20\d{2})\b/);
        const expiryStr = cleanStr(parsed.expiryDate, 32);
        const expiryYearMatch = expiryStr.match(/\b(20\d{2})\b/);
        const candidateYear = yearMatch ? yearMatch[1] : '';
        // Guard against the model accidentally copying the future disc expiry year into vehicle year
        const safeVehicleYear =
          candidateYear &&
          (!expiryYearMatch || Number(candidateYear) < Number(expiryYearMatch[1])) &&
          Number(candidateYear) <= new Date().getFullYear() + 1
            ? candidateYear
            : '';

        const extracted = {
          isValidLicenceDisc: Boolean(parsed.isValidLicenceDisc),
          vin: cleanStr(parsed.vin, 24)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 17),
          engineNumber: cleanStr(parsed.engineNumber, 40)
            .toUpperCase()
            .replace(/[^A-Z0-9-]/g, ''),
          registrationNumber: cleanStr(parsed.registrationNumber, 24)
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim(),
          make: normalizeMake(cleanStr(parsed.make, 48)),
          model: cleanStr(parsed.model, 80).replace(/\s*\/\s*/g, ' / '),
          year: safeVehicleYear,
          colour: cleanStr(parsed.colour, 32),
          discNumber: cleanStr(parsed.discNumber, 40).toUpperCase().replace(/\s+/g, ''),
          expiryDate: expiryStr,
          confidenceNote: cleanStr(parsed.confidenceNote, 200),
        };

        res.status(200).json({
          extracted,
          fileName: safeOriginalBase.replace(/[\r\n]+/g, ' ').slice(0, 180) || 'licence-disc',
          mimeType: resolvedMime,
        });
      } catch (err) {
        const rawMessage =
          err instanceof Error ? err.message : 'Unable to extract licence disc details.';
        let extractedErrMessage = rawMessage;
        try {
          const parsedErr = JSON.parse(rawMessage) as {
            error?: { message?: string; code?: number; status?: string };
          };
          if (parsedErr?.error?.message) {
            extractedErrMessage = parsedErr.error.message;
          }
        } catch {
          // keep rawMessage if not JSON
        }
        const lowerMsg = rawMessage.toLowerCase();
        if (lowerMsg.includes('permission_denied') || lowerMsg.includes('api_key_invalid')) {
          res.status(502).json({
            error: 'Gemini API key rejected. Please verify GEMINI_API_KEY in Settings > Secrets.',
          });
          return;
        }
        if (
          lowerMsg.includes('unavailable') ||
          lowerMsg.includes('503') ||
          lowerMsg.includes('high demand') ||
          lowerMsg.includes('overloaded')
        ) {
          res.status(503).json({
            error:
              'The licence disc AI scanner is temporarily busy due to high demand. Please click "Re-Scan Disc" in a few seconds, or fill in your VIN / Engine Code manually below.',
          });
          return;
        }
        if (lowerMsg.includes('resource_exhausted') || lowerMsg.includes('429')) {
          res.status(429).json({
            error:
              'Licence disc scanner quota is temporarily busy. Please wait a moment and try again, or enter details manually.',
          });
          return;
        }
        res.status(502).json({
          error:
            extractedErrMessage.length > 180
              ? 'Unable to scan this licence disc right now. Please try again or enter details manually.'
              : extractedErrMessage,
        });
      }
    }
  );

  app.use(express.json({ limit: '1mb' }));

  app.post('/api/autotrader-scrape', async (req, res) => {
    try {
      const authCheck = await verifyPortalCaller(req);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }
      if (!authCheck.isGroupAdmin && !authCheck.isItManager) {
        res.status(403).json({
          error: 'Group Administrator or IT Manager privileges are required to run AutoTrader sync.',
        });
        return;
      }

      const decodoApiKey = process.env.DECODO_API_KEY?.trim();
      if (!decodoApiKey || decodoApiKey === 'MY_DECODO_API_KEY') {
        res.status(503).json({
          code: 'MISSING_API_KEY',
          error:
            'DECODO_API_KEY is not configured in server secrets. Add DECODO_API_KEY in AI Studio Secrets, or use "Paste AutoTrader JSON" to import listings right away.',
        });
        return;
      }

      const rawBranches = Array.isArray(req.body?.branches)
        ? (req.body.branches as ScrapeBranchInput[])
        : [];

      const VALID_BRANCH_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
      const results = [];
      for (const branch of rawBranches) {
        if (!branch?.id || !VALID_BRANCH_ID_RE.test(branch.id)) {
          continue;
        }
        if (!branch.syncEnabled || !branch.autotraderUrl?.trim()) {
          results.push({
            branchId: branch.id,
            branchName: branch.name || `Branch ${branch.id}`,
            dealerId: branch.autotraderDealerId || '',
            skipped: true,
            skipReason: !branch.syncEnabled
              ? 'AutoTrader sync disabled for this branch.'
              : 'No AutoTrader Dealer URL configured.',
            pagesScraped: 0,
            listings: [] as ParsedAutoTraderVehicle[],
          });
          continue;
        }

        let validatedBaseUrl: string;
        try {
          validatedBaseUrl = validateAutoTraderDealerUrl(branch.autotraderUrl);
        } catch (err) {
          results.push({
            branchId: branch.id,
            branchName: branch.name || `Branch ${branch.id}`,
            dealerId: branch.autotraderDealerId || '',
            skipped: false,
            pagesScraped: 0,
            listings: [] as ParsedAutoTraderVehicle[],
            error: err instanceof Error ? err.message : 'Invalid AutoTrader URL.',
          });
          continue;
        }

        const seenIds = new Set<string>();
        const branchListings: ParsedAutoTraderVehicle[] = [];
        let pagesScraped = 0;
        let maxPageTarget = MAX_PAGES_PER_DEALER;
        let branchError: string | undefined;

        for (let page = 1; page <= maxPageTarget; page++) {
          const pageUrl = page === 1 ? validatedBaseUrl : `${validatedBaseUrl}?page=${page}`;
          try {
            const html = await fetchDecodoPageHtml(pageUrl, decodoApiKey);
            pagesScraped += 1;

            if (page === 1) {
              const { pageCount } = extractAutoTraderPaginationInfo(html);
              maxPageTarget = Math.min(MAX_PAGES_PER_DEALER, Math.max(1, pageCount));
            }

            const parsed = parseAutoTraderHtml(html, {
              id: branch.id,
              autotraderDealerId: branch.autotraderDealerId || '',
            });
            const freshOnPage = parsed.filter((item) => !seenIds.has(item.externalListingId));
            if (freshOnPage.length === 0) {
              break;
            }
            for (const item of freshOnPage) {
              seenIds.add(item.externalListingId);
              branchListings.push(item);
            }
          } catch (err) {
            branchError =
              err instanceof Error ? err.message : 'Failed to fetch AutoTrader page via Decodo.';
            break;
          }
        }

        results.push({
          branchId: branch.id,
          branchName: branch.name || `Branch ${branch.id}`,
          dealerId: branch.autotraderDealerId || '',
          skipped: false,
          pagesScraped,
          listings: branchListings,
          error: branchError,
        });
      }

      res.json({
        syncedAtIso: new Date().toISOString(),
        branches: results,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to execute AutoTrader scrape.',
      });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      runtime: process.env.VERCEL ? 'vercel' : 'node',
      projectId: firebaseConfig.projectId,
    });
  });

  app.get('/api/system-status', async (req, res) => {
    const authCheck = await verifyPortalCaller(req);
    if (!authCheck.ok) {
      res.status(authCheck.status).json({ error: authCheck.error });
      return;
    }
    if (
      !authCheck.isGroupAdmin &&
      !authCheck.isItManager &&
      !authCheck.isBranchAdmin &&
      !authCheck.isItAgent
    ) {
      res.status(403).json({ error: 'Administrator or IT privileges are required to inspect platform readiness.' });
      return;
    }

    const tokenMatch = (req.headers.authorization ?? '').match(/^Bearer\s+(.+)$/i);
    const idToken = tokenMatch?.[1];

    const [groupDoc, branchDocs] = await Promise.all([
      fetchPublicFirestoreDoc('groupSettings', 'main').catch(() => null),
      fetchFirestoreCollection('dealerships', idToken).catch(() => []),
    ]);

    const smtp = getSmtpConfig(groupDoc);
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    const decodoKey = (process.env.DECODO_API_KEY || '').trim();
    const appUrlEnv = stripCrlf(process.env.APP_URL || '');
    const groupSiteUrl = stripCrlf(groupDoc?.fields?.primarySiteUrl?.stringValue || '');

    const branches = branchDocs
      .map((docItem) => {
        const docId =
          docItem.fields?.id?.stringValue ||
          (docItem.name ? docItem.name.split('/').pop() || '' : '');
        if (!docId) return null;
        const resolved = resolveBranchSmtpConfig(docId, docItem, groupDoc);
        return {
          branchId: docId,
          branchName: stripCrlf(docItem.fields?.name?.stringValue || `Branch ${docId}`),
          branchPassKey: resolved.branchPassKey,
          branchSecretConfigured: resolved.branchSecretConfigured,
          effectiveReady: resolved.effectiveReady,
          configuredHost: resolved.branchConfiguredHost,
          configuredPort: resolved.branchConfiguredPort,
          configuredUser: resolved.branchConfiguredUser,
          configuredFrom: resolved.branchConfiguredFrom,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    res.json({
      runtime: process.env.VERCEL ? 'vercel' : 'node',
      ephemeralStorage: Boolean(process.env.VERCEL),
      port: PORT,
      appUrlConfigured: Boolean(appUrlEnv || groupSiteUrl),
      appUrlValue: appUrlEnv || groupSiteUrl || `http://localhost:${PORT}`,
      firebase: {
        projectId: firebaseConfig.projectId,
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
        authDomain: firebaseConfig.authDomain || `${firebaseConfig.projectId}.firebaseapp.com`,
      },
      apis: {
        gemini: {
          configured: Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY'),
          envVar: 'GEMINI_API_KEY',
          label: 'Google Gemini API (Licence Disc Scanner)',
        },
        decodo: {
          configured: Boolean(decodoKey && decodoKey !== 'MY_DECODO_API_KEY'),
          envVar: 'DECODO_API_KEY',
          label: 'Decodo Web Data API (Optional AutoTrader Sync)',
        },
        globalSmtp: {
          configured: smtp.configured,
          envVar: smtp.passEnvKey,
          host: smtp.host,
          port: smtp.port,
          user: smtp.user,
          from: smtp.from,
          defaultNotify: smtp.defaultNotify,
        },
      },
      branches,
    });
  });

  app.get('/api/email-status', async (req, res) => {
    const authCheck = await verifyPortalCaller(req);
    if (!authCheck.ok) {
      res.status(authCheck.status).json({ error: authCheck.error });
      return;
    }
    if (
      !authCheck.isGroupAdmin &&
      !authCheck.isItManager &&
      !authCheck.isBranchAdmin &&
      !authCheck.isItAgent
    ) {
      res.status(403).json({ error: 'Administrator or IT privileges are required to inspect SMTP status.' });
      return;
    }
    const groupDoc = await fetchPublicFirestoreDoc('groupSettings', 'main').catch(() => null);
    const smtp = getSmtpConfig(groupDoc);
    const rawBranchId = typeof req.query.branchId === 'string' ? req.query.branchId.trim() : '';
    let branchStatus: {
      branchId: string;
      branchPassKey: string;
      branchSecretConfigured: boolean;
      effectiveReady: boolean;
      configuredHost: string;
      configuredPort: number;
      configuredUser: string;
      configuredFrom: string;
    } | null = null;

    if (rawBranchId && VALID_BRANCH_ID_RE.test(rawBranchId)) {
      const branchDoc = await fetchPublicFirestoreDoc('dealerships', rawBranchId).catch(() => null);
      const resolved = resolveBranchSmtpConfig(rawBranchId, branchDoc, groupDoc);
      branchStatus = {
        branchId: rawBranchId,
        branchPassKey: resolved.branchPassKey,
        branchSecretConfigured: resolved.branchSecretConfigured,
        effectiveReady: resolved.effectiveReady,
        configuredHost: resolved.branchConfiguredHost,
        configuredPort: resolved.branchConfiguredPort,
        configuredUser: resolved.branchConfiguredUser,
        configuredFrom: resolved.branchConfiguredFrom,
      };
    }

    res.json({
      configured: smtp.configured,
      host: smtp.host,
      port: smtp.port,
      senderEmail: smtp.user,
      defaultRecipient: smtp.defaultNotify,
      branchStatus,
    });
  });

  app.post('/api/notify-lead/test', async (req, res) => {
    try {
      const authCheck = await verifyPortalCaller(req);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }

      const branchId =
        typeof req.body?.branchId === 'string' && VALID_BRANCH_ID_RE.test(req.body.branchId)
          ? req.body.branchId
          : '1';

      const isAllowedForBranch =
        authCheck.isGroupAdmin ||
        authCheck.isItManager ||
        ((authCheck.isBranchAdmin || authCheck.isItAgent) && authCheck.effectiveBranchId === branchId);
      if (!isAllowedForBranch) {
        res.status(403).json({
          error: 'You are not authorized to dispatch test emails for this dealership branch.',
        });
        return;
      }
      const [branchDoc, groupDoc] = await Promise.all([
        fetchPublicFirestoreDoc('dealerships', branchId).catch(() => null),
        fetchPublicFirestoreDoc('groupSettings', 'main').catch(() => null),
      ]);

      const resolvedSmtp = resolveBranchSmtpConfig(branchId, branchDoc, groupDoc);
      if (!resolvedSmtp.branchSecretConfigured) {
        res.status(503).json({
          error: `Branch SMTP password secret "${resolvedSmtp.branchPassKey}" is not configured in server Secrets / .env yet for ${resolvedSmtp.branchConfiguredUser}. Add ${resolvedSmtp.branchPassKey} in Settings -> Secrets (or .env) and retry.`,
        });
        return;
      }

      const targetEmail =
        sanitizeEmailAddr(req.body?.targetEmail) ||
        sanitizeEmailAddr(branchDoc?.fields?.defaultNotifyEmail?.stringValue) ||
        sanitizeEmailAddr(branchDoc?.fields?.salesNotifyEmail?.stringValue) ||
        sanitizeEmailAddr(groupDoc?.fields?.defaultNotifyEmail?.stringValue) ||
        resolvedSmtp.globalDefaultNotify;
      const branchName = stripCrlf(
        branchDoc?.fields?.name?.stringValue || `Branch ${branchId}`
      );
      const groupName = stripCrlf(
        groupDoc?.fields?.groupName?.stringValue || 'Dealership Group'
      );

      const transporter = nodemailer.createTransport({
        host: resolvedSmtp.host,
        port: resolvedSmtp.port,
        secure: resolvedSmtp.secure,
        auth: { user: resolvedSmtp.user, pass: resolvedSmtp.pass },
      });

      await transporter.sendMail({
        from: resolvedSmtp.from,
        to: targetEmail,
        subject: `[${groupName}] Test Email Notification Connected — ${branchName}`,
        text: `Your dealership email notification server is connected.\n\nBranch: ${branchName}\nSMTP Host: ${resolvedSmtp.host}:${resolvedSmtp.port}\nFrom: ${resolvedSmtp.from}\nSMTP User: ${resolvedSmtp.user}\nRecipient: ${targetEmail}\nGroup: ${groupName}\n`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #001E50; color: #ffffff; padding: 20px 24px;">
              <p style="margin: 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.8;">${escapeHtml(groupName)}</p>
              <h2 style="margin: 6px 0 0; font-size: 18px;">Branch Email Server Connected — ${escapeHtml(branchName)}</h2>
            </div>
            <div style="padding: 20px 24px; color: #0f172a; font-size: 14px; line-height: 1.6;">
              <p style="margin-top: 0;">Your branch Nodemailer SMTP connection is verified and ready to dispatch customer requests.</p>
              <p><strong>From Header:</strong> ${escapeHtml(resolvedSmtp.from)}<br/>
              <strong>SMTP Server:</strong> ${escapeHtml(resolvedSmtp.host)}:${resolvedSmtp.port}<br/>
              <strong>SMTP Login:</strong> ${escapeHtml(resolvedSmtp.user)}<br/>
              <strong>Test Recipient:</strong> ${escapeHtml(targetEmail)}</p>
            </div>
          </div>
        `,
      });

      res.json({ sent: true, to: targetEmail, from: resolvedSmtp.from, user: resolvedSmtp.user });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Unable to dispatch test email via SMTP.',
      });
    }
  });

  app.post('/api/notify-lead', async (req, res) => {
    try {
      const clientIp =
        String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
          .split(',')[0]
          .trim();
      if (!allowLeadEmailRateLimit(clientIp)) {
        res.status(429).json({ error: 'Too many notification requests. Please wait a few minutes.' });
        return;
      }

      const leadType = typeof req.body?.leadType === 'string' ? req.body.leadType.trim() : '';
      const fullName = stripCrlf(String(req.body?.fullName || '')).slice(0, 120);
      const phone = stripCrlf(String(req.body?.phone || '')).slice(0, 30);
      const customerEmail = sanitizeEmailAddr(req.body?.email);
      const subject = stripCrlf(String(req.body?.subject || '')).slice(0, 200);
      const details = String(req.body?.details || '').trim().slice(0, 6000);
      const leadId = stripCrlf(String(req.body?.leadId || '')).slice(0, 128);
      const submittedAtDealershipId =
        typeof req.body?.submittedAtDealershipId === 'string' &&
        VALID_BRANCH_ID_RE.test(req.body.submittedAtDealershipId)
          ? req.body.submittedAtDealershipId
          : '1';
      const homeDealershipId =
        typeof req.body?.homeDealershipId === 'string' &&
        VALID_BRANCH_ID_RE.test(req.body.homeDealershipId)
          ? req.body.homeDealershipId
          : null;

      if (!VALID_LEAD_TYPES.has(leadType) || fullName.length < 2 || phone.length < 7 || !customerEmail || subject.length < 2) {
        res.status(400).json({ error: 'Invalid lead notification payload.' });
        return;
      }

      // Resolve authoritative SMTP settings and recipient routing strictly from Firestore (never trust client-supplied target email)
      const [submittedBranchDoc, homeBranchDoc, groupDoc] = await Promise.all([
        fetchPublicFirestoreDoc('dealerships', submittedAtDealershipId).catch(() => null),
        homeDealershipId && homeDealershipId !== submittedAtDealershipId
          ? fetchPublicFirestoreDoc('dealerships', homeDealershipId).catch(() => null)
          : Promise.resolve(null),
        fetchPublicFirestoreDoc('groupSettings', 'main').catch(() => null),
      ]);

      const resolvedSmtp = resolveBranchSmtpConfig(submittedAtDealershipId, submittedBranchDoc, groupDoc);
      if (!resolvedSmtp.effectiveReady) {
        res.status(202).json({
          delivered: false,
          skipped: true,
          reason: `Server email password (${resolvedSmtp.branchPassKey} or SMTP_PASS) is not configured yet.`,
        });
        return;
      }

      const deptField = resolveBranchEmailField(leadType);
      const groupDefaultEmail =
        sanitizeEmailAddr(groupDoc?.fields?.defaultNotifyEmail?.stringValue) ||
        resolvedSmtp.globalDefaultNotify;
      const branchFallbackEmail =
        resolvedSmtp.branchDefaultNotify ||
        sanitizeEmailAddr(submittedBranchDoc?.fields?.generalNotifyEmail?.stringValue) ||
        groupDefaultEmail;

      const recipients = new Set<string>();
      const primaryDeptEmail =
        sanitizeEmailAddr(submittedBranchDoc?.fields?.[deptField]?.stringValue) ||
        branchFallbackEmail;
      recipients.add(primaryDeptEmail);

      if (homeBranchDoc) {
        const homeDeptEmail =
          sanitizeEmailAddr(homeBranchDoc.fields?.[deptField]?.stringValue) ||
          sanitizeEmailAddr(homeBranchDoc.fields?.defaultNotifyEmail?.stringValue);
        if (homeDeptEmail) {
          recipients.add(homeDeptEmail);
        }
      }

      const toList = Array.from(recipients);
      const branchName = stripCrlf(
        submittedBranchDoc?.fields?.name?.stringValue || `Branch ${submittedAtDealershipId}`
      );
      const homeBranchName = homeBranchDoc
        ? stripCrlf(homeBranchDoc.fields?.name?.stringValue || `Branch ${homeDealershipId}`)
        : homeDealershipId && homeDealershipId === submittedAtDealershipId
        ? branchName
        : null;
      const groupName = stripCrlf(
        groupDoc?.fields?.groupName?.stringValue || 'Dealership Group'
      );
      const leadLabel = LEAD_TYPE_LABELS[leadType] || 'Customer Request';

      const transporter = nodemailer.createTransport({
        host: resolvedSmtp.host,
        port: resolvedSmtp.port,
        secure: resolvedSmtp.secure,
        auth: { user: resolvedSmtp.user, pass: resolvedSmtp.pass },
      });

      const emailSubject = `[${branchName}] New ${leadLabel}: ${subject}`;
      const detailsHtml = escapeHtml(details || 'No additional notes provided.').replace(
        /\n/g,
        '<br/>'
      );

      await transporter.sendMail({
        from: resolvedSmtp.from,
        to: toList.join(', '),
        replyTo: `${fullName} <${customerEmail}>`,
        subject: emailSubject,
        text: [
          `${groupName} — ${leadLabel}`,
          `Branch: ${branchName}`,
          homeBranchName && homeBranchName !== branchName
            ? `Vehicle / Target Branch: ${homeBranchName}`
            : '',
          leadId ? `Reference: ${leadId}` : '',
          '',
          `Customer Name: ${fullName}`,
          `Phone: ${phone}`,
          `Email: ${customerEmail}`,
          `Subject: ${subject}`,
          '',
          'Request Details:',
          details || 'No additional notes provided.',
        ]
          .filter(Boolean)
          .join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
            <div style="background: #001E50; color: #ffffff; padding: 20px 24px;">
              <p style="margin: 0; font-size: 11px; letter-spacing: 1.4px; text-transform: uppercase; opacity: 0.85;">${escapeHtml(groupName)} · ${escapeHtml(branchName)}</p>
              <h2 style="margin: 6px 0 0; font-size: 20px;">New ${escapeHtml(leadLabel)}</h2>
            </div>
            <div style="padding: 24px; color: #0f172a; font-size: 14px; line-height: 1.6;">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
                <tr>
                  <td style="padding: 6px 0; color: #475569; width: 165px;"><strong>Customer Name:</strong></td>
                  <td style="padding: 6px 0;">${escapeHtml(fullName)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #475569;"><strong>Phone Number:</strong></td>
                  <td style="padding: 6px 0;"><a href="tel:${escapeHtml(phone)}" style="color: #00437A; text-decoration: none;">${escapeHtml(phone)}</a></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #475569;"><strong>Customer Email:</strong></td>
                  <td style="padding: 6px 0;"><a href="mailto:${escapeHtml(customerEmail)}" style="color: #00437A; text-decoration: none;">${escapeHtml(customerEmail)}</a></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #475569;"><strong>Submitted Branch:</strong></td>
                  <td style="padding: 6px 0;">${escapeHtml(branchName)}</td>
                </tr>
                ${
                  homeBranchName && homeBranchName !== branchName
                    ? `<tr>
                  <td style="padding: 6px 0; color: #475569;"><strong>Holding / Target Branch:</strong></td>
                  <td style="padding: 6px 0;">${escapeHtml(homeBranchName)}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 6px 0; color: #475569;"><strong>Subject:</strong></td>
                  <td style="padding: 6px 0;">${escapeHtml(subject)}</td>
                </tr>
              </table>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
                <p style="margin: 0 0 6px; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Request Details</p>
                <p style="margin: 0; font-size: 14px; color: #1e293b;">${detailsHtml}</p>
              </div>

              <p style="margin: 18px 0 0; font-size: 12px; color: #64748b;">
                Hit <strong>Reply</strong> in your email app to reply directly to ${escapeHtml(fullName)} (${escapeHtml(customerEmail)}).
                ${leadId ? ` Lead ID: ${escapeHtml(leadId)}` : ''}
              </p>
            </div>
          </div>
        `,
      });

      res.status(200).json({ delivered: true, recipients: toList });
    } catch (err) {
      res.status(500).json({
        delivered: false,
        error: err instanceof Error ? err.message : 'Unable to send notification email.',
      });
    }
  });

  const VALID_JOB_APPLICATION_STATUSES = new Set([
    'new',
    'shortlisted',
    'interview',
    'rejected',
    'archived',
  ]);

  app.post('/api/career-status-email', async (req, res) => {
    try {
      const authCheck = await verifyPortalCaller(req);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
        return;
      }
      if (!authCheck.isGroupAdmin && !authCheck.isItManager && !authCheck.isBranchAdmin) {
        res.status(403).json({
          error: 'Group Admin, IT Manager, or Branch Admin privileges are required to send applicant updates.',
        });
        return;
      }

      const candidateEmail = sanitizeEmailAddr(req.body?.candidateEmail);
      const candidateName = stripCrlf(String(req.body?.candidateName || '')).slice(0, 120);
      const jobTitle = stripCrlf(String(req.body?.jobTitle || '')).slice(0, 160);
      const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
      const subject = stripCrlf(String(req.body?.subject || '')).slice(0, 200);
      const messageBody = String(req.body?.messageBody || '').trim().slice(0, 6000);
      const rawAptitudeUrl = stripCrlf(String(req.body?.aptitudeTestUrl || '')).slice(0, 500);
      const interviewDate = stripCrlf(String(req.body?.interviewDate || '')).slice(0, 80);
      const interviewTime = stripCrlf(String(req.body?.interviewTime || '')).slice(0, 80);
      const interviewLocation = stripCrlf(String(req.body?.interviewLocation || '')).slice(0, 240);
      const interviewerContact = stripCrlf(String(req.body?.interviewerContact || '')).slice(0, 160);

      if (
        !candidateEmail ||
        candidateName.length < 2 ||
        jobTitle.length < 2 ||
        !VALID_JOB_APPLICATION_STATUSES.has(status) ||
        subject.length < 2 ||
        messageBody.length < 10
      ) {
        res.status(400).json({
          error:
            'Please provide a valid candidate email, candidate name, position title, status, subject, and message draft.',
        });
        return;
      }

      let validatedAptitudeUrl = '';
      if (rawAptitudeUrl) {
        try {
          const parsedUrl = new URL(rawAptitudeUrl);
          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            res.status(400).json({
              error: 'Assessment / Aptitude Test URL must start with https:// or http://.',
            });
            return;
          }
          validatedAptitudeUrl = parsedUrl.toString();
        } catch {
          res.status(400).json({
            error: 'Assessment / Aptitude Test URL is not a valid web address.',
          });
          return;
        }
      }

      const groupDoc = await fetchPublicFirestoreDoc('groupSettings', 'main').catch(() => null);
      const defaultBranchIdRaw = stripCrlf(groupDoc?.fields?.defaultBranchId?.stringValue || '1');
      const fallbackBranchId = VALID_BRANCH_ID_RE.test(defaultBranchIdRaw) ? defaultBranchIdRaw : '1';
      const requestedBranchId =
        typeof req.body?.branchId === 'string' && VALID_BRANCH_ID_RE.test(req.body.branchId)
          ? req.body.branchId
          : authCheck.isBranchAdmin && authCheck.effectiveBranchId
          ? authCheck.effectiveBranchId
          : fallbackBranchId;

      if (
        authCheck.isBranchAdmin &&
        authCheck.effectiveBranchId &&
        requestedBranchId !== authCheck.effectiveBranchId
      ) {
        res.status(403).json({
          error: 'Branch Admins can only dispatch applicant status emails for their allocated branch.',
        });
        return;
      }

      const branchDoc = await fetchPublicFirestoreDoc('dealerships', requestedBranchId).catch(
        () => null
      );
      const resolvedSmtp = resolveBranchSmtpConfig(requestedBranchId, branchDoc, groupDoc);

      const branchName = stripCrlf(
        branchDoc?.fields?.name?.stringValue || `Branch ${requestedBranchId}`
      );
      const branchCity = stripCrlf(branchDoc?.fields?.city?.stringValue || '');
      const branchDomain = stripCrlf(branchDoc?.fields?.domain?.stringValue || '');
      const groupName = stripCrlf(
        groupDoc?.fields?.groupName?.stringValue || 'Dealership Group'
      );

      const careersEmail = deriveBranchCareersEmail({
        name: branchName,
        city: branchCity,
        domain: branchDomain,
      });

      if (!resolvedSmtp.effectiveReady) {
        res.status(202).json({
          delivered: false,
          skipped: true,
          from: careersEmail,
          reason: `Server email password (${resolvedSmtp.branchPassKey} or SMTP_PASS) is not configured yet.`,
        });
        return;
      }

      const fromHeader = `${branchName} Careers <${careersEmail}>`;
      const transporter = nodemailer.createTransport({
        host: resolvedSmtp.host,
        port: resolvedSmtp.port,
        secure: resolvedSmtp.secure,
        auth: { user: resolvedSmtp.user, pass: resolvedSmtp.pass },
      });

      const statusBadgeMap: Record<string, string> = {
        new: 'Application Received',
        shortlisted: 'Shortlisted Candidate',
        interview: 'Interview Invitation',
        rejected: 'Application Update',
        archived: 'Application Update',
      };
      const statusHeading = statusBadgeMap[status] || 'Application Update';

      const escapedMessageHtml = escapeHtml(messageBody).replace(/\n/g, '<br/>');

      const testBlockText =
        status === 'shortlisted' && validatedAptitudeUrl
          ? `\n\nOnline Aptitude / Assessment Link:\n${validatedAptitudeUrl}`
          : '';

      const interviewLinesText =
        status === 'interview' &&
        (interviewDate || interviewTime || interviewLocation || interviewerContact)
          ? [
              '',
              'Interview Schedule Details:',
              interviewDate ? `Date: ${interviewDate}` : '',
              interviewTime ? `Time: ${interviewTime}` : '',
              interviewLocation ? `Location: ${interviewLocation}` : '',
              interviewerContact ? `Contact: ${interviewerContact}` : '',
            ]
              .filter(Boolean)
              .join('\n')
          : '';

      const testBlockHtml =
        status === 'shortlisted' && validatedAptitudeUrl
          ? `
            <div style="margin-top: 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px;">
              <p style="margin: 0 0 8px; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #00437A;">Aptitude / Pre-Interview Assessment</p>
              <p style="margin: 0 0 12px; font-size: 13px; color: #1e293b;">Please complete your assessment using the link below:</p>
              <a href="${escapeHtml(validatedAptitudeUrl)}" style="display: inline-block; background: #001E50; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 13px; padding: 10px 18px; border-radius: 6px;">Open Assessment Link</a>
            </div>`
          : '';

      const interviewBlockHtml =
        status === 'interview' &&
        (interviewDate || interviewTime || interviewLocation || interviewerContact)
          ? `
            <div style="margin-top: 20px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px;">
              <p style="margin: 0 0 10px; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #001E50;">Interview Schedule Details</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #0f172a;">
                ${interviewDate ? `<tr><td style="padding: 4px 0; width: 110px; color: #475569;"><strong>Date:</strong></td><td style="padding: 4px 0;">${escapeHtml(interviewDate)}</td></tr>` : ''}
                ${interviewTime ? `<tr><td style="padding: 4px 0; color: #475569;"><strong>Time:</strong></td><td style="padding: 4px 0;">${escapeHtml(interviewTime)}</td></tr>` : ''}
                ${interviewLocation ? `<tr><td style="padding: 4px 0; color: #475569;"><strong>Location:</strong></td><td style="padding: 4px 0;">${escapeHtml(interviewLocation)}</td></tr>` : ''}
                ${interviewerContact ? `<tr><td style="padding: 4px 0; color: #475569;"><strong>Contact:</strong></td><td style="padding: 4px 0;">${escapeHtml(interviewerContact)}</td></tr>` : ''}
              </table>
            </div>`
          : '';

      await transporter.sendMail({
        from: fromHeader,
        to: `${candidateName} <${candidateEmail}>`,
        replyTo: careersEmail,
        subject,
        text: `${messageBody}${testBlockText}${interviewLinesText}\n\n---\n${branchName} Careers (${careersEmail})\n${groupName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
            <div style="background: #001E50; color: #ffffff; padding: 20px 24px;">
              <p style="margin: 0; font-size: 11px; letter-spacing: 1.4px; text-transform: uppercase; opacity: 0.85;">${escapeHtml(groupName)} · ${escapeHtml(branchName)} Careers</p>
              <h2 style="margin: 6px 0 0; font-size: 20px;">${escapeHtml(statusHeading)} — ${escapeHtml(jobTitle)}</h2>
            </div>
            <div style="padding: 24px; color: #0f172a; font-size: 14px; line-height: 1.65;">
              <p style="margin: 0; color: #1e293b;">${escapedMessageHtml}</p>
              ${testBlockHtml}
              ${interviewBlockHtml}
              <p style="margin: 22px 0 0; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                Sent by <strong>${escapeHtml(branchName)} Careers</strong> (<a href="mailto:${escapeHtml(careersEmail)}" style="color: #00437A; text-decoration: none;">${escapeHtml(careersEmail)}</a>).
              </p>
            </div>
          </div>
        `,
      });

      res.status(200).json({
        delivered: true,
        from: careersEmail,
        to: candidateEmail,
      });
    } catch (err) {
      res.status(500).json({
        delivered: false,
        error: err instanceof Error ? err.message : 'Unable to send candidate status update email.',
      });
    }
  });

  if (!options.isServerless) {
    if (!isProduction) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(__dirname, 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(__filename) &&
  !process.env.VERCEL;

if (isDirectExecution) {
  void createApp().then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  });
}
