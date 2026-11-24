import express, { type Request } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { type DecodedIdToken, getAuth } from 'firebase-admin/auth';
import {
  type ParsedAutoTraderVehicle,
  extractAutoTraderPaginationInfo,
  parseAutoTraderHtml,
  validateAutoTraderDealerUrl,
} from './src/lib/autotraderParser.ts';
import type { DealershipId } from './src/types/dealership.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);

const BOOTSTRAPPED_ADMIN_EMAIL = 'smokeydhlamini@gmail.com';
const MAX_PAGES_PER_DEALER = 4;
const VALID_UID_RE = /^[a-zA-Z0-9_-]{2,128}$/;

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

const firebaseConfig = loadFirebaseConfig();
// Initialize Admin Auth with projectId ONLY (ID token verification requires zero IAM roles)
const adminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);

interface FirestoreRestDoc {
  fields?: Record<string, { stringValue?: string; booleanValue?: boolean }>;
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

async function verifyPortalCaller(
  req: Request,
  requireAdmin: boolean
): Promise<
  | { ok: true; decoded: DecodedIdToken; isAdmin: boolean }
  | { ok: false; status: number; error: string }
> {
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
    return { ok: true, decoded, isAdmin: true };
  }

  const [staffDoc, adminDoc] = await Promise.all([
    fetchOwnFirestoreDoc('staffUsers', decoded.uid, idToken).catch(() => null),
    fetchOwnFirestoreDoc('admins', decoded.uid, idToken).catch(() => null),
  ]);

  const staffRole = staffDoc?.fields?.role?.stringValue ?? '';
  const staffActive = staffDoc?.fields?.active?.booleanValue === true;
  const isStaffAdmin = staffRole === 'admin' && staffActive;
  const isRosterAdmin = adminDoc?.fields?.role?.stringValue === 'admin';
  const isAdmin = isStaffAdmin || isRosterAdmin;

  if (requireAdmin && !isAdmin) {
    return {
      ok: false,
      status: 403,
      error: 'Active dealership administrator privileges are required.',
    };
  }

  const isAuthorizedStaff =
    isAdmin ||
    (staffActive && ['agent', 'marketing', 'parts', 'service'].includes(staffRole));

  if (!isAuthorizedStaff) {
    return {
      ok: false,
      status: 403,
      error: 'Active dealership staff privileges are required to upload media.',
    };
  }

  return { ok: true, decoded, isAdmin };
}

async function verifyAdminCaller(
  req: Request
): Promise<
  | { ok: true; decoded: DecodedIdToken }
  | { ok: false; status: number; error: string }
> {
  const result = await verifyPortalCaller(req, true);
  if (!result.ok) return result;
  return { ok: true, decoded: result.decoded };
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

async function createServer() {
  const app = express();
  const uploadsRoot = path.resolve(__dirname, 'uploads');
  fs.mkdirSync(uploadsRoot, { recursive: true });

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

        const authCheck = await verifyPortalCaller(req, requireAdmin);
        if (!authCheck.ok) {
          res.status(authCheck.status).json({ error: authCheck.error });
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

  app.use(express.json({ limit: '1mb' }));

  app.post('/api/autotrader-scrape', async (req, res) => {
    try {
      const authCheck = await verifyAdminCaller(req);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ error: authCheck.error });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

void createServer();
