import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  ParsedAutoTraderVehicle,
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

interface FirebaseAppletConfig {
  projectId: string;
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
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/autotrader-scrape', async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? '';
      const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!tokenMatch) {
        res.status(401).json({ error: 'Missing Firebase Authentication Bearer token.' });
        return;
      }

      const decoded = await adminAuth.verifyIdToken(tokenMatch[1]);
      if (
        !decoded.email_verified ||
        decoded.email?.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL
      ) {
        res.status(403).json({
          error: 'Verified dealership administrator account required to trigger AutoTrader scrape.',
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

      const results = [];
      for (const branch of rawBranches) {
        if (branch.id !== '1' && branch.id !== '2' && branch.id !== '3') {
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
