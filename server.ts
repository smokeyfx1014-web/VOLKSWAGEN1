import express, { type Request } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { type DecodedIdToken, getAuth } from 'firebase-admin/auth';
import {
  type ParsedAutoTraderVehicle,
  extractAutoTraderPaginationInfo,
  parseAutoTraderHtml,
  validateAutoTraderDealerUrl,
} from './src/lib/autotraderParser.ts';
import type { DealershipId, StaffRole } from './src/types/dealership.ts';

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

const BRANCH_META: Record<
  DealershipId,
  { name: string; domain: string; city: string }
> = {
  '1': {
    name: 'Newcastle Volkswagen',
    domain: 'https://www.newcastlevw.co.za',
    city: 'Newcastle',
  },
  '2': {
    name: 'Ermelo Volkswagen',
    domain: 'https://www.ermelovw.co.za',
    city: 'Ermelo',
  },
  '3': {
    name: 'Vryheid Volkswagen',
    domain: 'https://www.vryheidvw.co.za',
    city: 'Vryheid',
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

async function verifyAdminCaller(
  req: Request
): Promise<
  | { ok: true; decoded: DecodedIdToken }
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
    return { ok: true, decoded };
  }

  const [staffDoc, adminDoc] = await Promise.all([
    fetchOwnFirestoreDoc('staffUsers', decoded.uid, idToken).catch(() => null),
    fetchOwnFirestoreDoc('admins', decoded.uid, idToken).catch(() => null),
  ]);

  const isStaffAdmin =
    staffDoc?.fields?.role?.stringValue === 'admin' &&
    staffDoc?.fields?.active?.booleanValue === true;
  const isRosterAdmin = adminDoc?.fields?.role?.stringValue === 'admin';

  if (!isStaffAdmin && !isRosterAdmin) {
    return {
      ok: false,
      status: 403,
      error: 'Active dealership administrator privileges are required.',
    };
  }

  return { ok: true, decoded };
}

function resolveSafePortalUrl(
  req: Request,
  branchId: DealershipId | null
): string {
  const suffix = branchId ? `/admin?branch=${branchId}` : '/admin';
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return `${parsed.origin}${suffix}`;
      }
    } catch {
      // Fallback below
    }
  }

  const rawOrigin = req.headers.origin;
  if (typeof rawOrigin === 'string') {
    try {
      const parsedOrigin = new URL(rawOrigin);
      const host = parsedOrigin.hostname.toLowerCase();
      const isAllowedOrigin =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.run.app') ||
        host.endsWith('newcastlevw.co.za') ||
        host.endsWith('ermelovw.co.za') ||
        host.endsWith('vryheidvw.co.za');
      if (
        isAllowedOrigin &&
        (parsedOrigin.protocol === 'https:' || parsedOrigin.protocol === 'http:')
      ) {
        return `${parsedOrigin.origin}${suffix}`;
      }
    } catch {
      // Fallback below
    }
  }

  const fallbackDomain = branchId
    ? BRANCH_META[branchId].domain
    : BRANCH_META['1'].domain;
  return `${fallbackDomain}/admin`;
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

async function createServer() {
  const app = express();
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

  app.post('/api/send-staff-welcome', async (req, res) => {
    try {
      const authCheck = await verifyAdminCaller(req);
      if (!authCheck.ok) {
        res.status(authCheck.status).json({ sent: false, error: authCheck.error });
        return;
      }

      const body = req.body as {
        fullName?: unknown;
        recipientEmail?: unknown;
        role?: unknown;
        allocatedDealershipId?: unknown;
        temporaryPassword?: unknown;
      };

      const fullName =
        typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 120) : '';
      const recipientEmail =
        typeof body.recipientEmail === 'string'
          ? body.recipientEmail.trim().toLowerCase().slice(0, 140)
          : '';
      const role: StaffRole = body.role === 'admin' ? 'admin' : 'agent';
      const rawBranch = body.allocatedDealershipId;
      const allocatedDealershipId: DealershipId | null =
        rawBranch === '1' || rawBranch === '2' || rawBranch === '3' ? rawBranch : null;
      const temporaryPassword =
        typeof body.temporaryPassword === 'string' ? body.temporaryPassword : '';

      if (fullName.length < 2) {
        res.status(400).json({ sent: false, error: 'Valid staff full name is required.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
        res.status(400).json({ sent: false, error: 'Valid staff work email is required.' });
        return;
      }
      if (temporaryPassword.length < 8 || temporaryPassword.length > 128) {
        res.status(400).json({
          sent: false,
          error: 'Temporary password must be between 8 and 128 characters.',
        });
        return;
      }

      const branchInfo = allocatedDealershipId
        ? BRANCH_META[allocatedDealershipId]
        : { name: 'All Asaf Auto Sales VW Dealerships', domain: '', city: 'Group' };
      const roleLabel =
        role === 'admin'
          ? 'Administrator (Full Group Access)'
          : `Car Sales Agent — ${branchInfo.name}`;
      const capabilitiesSummary =
        role === 'admin'
          ? 'Manage staff users and permissions, sync AutoTrader inventory, configure branch details, publish group promotions/events, and track customer leads across Newcastle, Ermelo, and Vryheid.'
          : `Add and manage vehicles, monthly specials, and dealership events exclusively for ${branchInfo.name}.`;
      const portalUrl = resolveSafePortalUrl(req, allocatedDealershipId);
      const senderBranchName = allocatedDealershipId
        ? branchInfo.name
        : 'Newcastle Volkswagen · Asaf Auto Sales';

      const subject = `Welcome to ${branchInfo.name} — Your Dealership Portal Access`;
      const textBody = [
        `Hello ${fullName},`,
        '',
        `Welcome to the ${branchInfo.name} team (Asaf Auto Sales Pty Ltd · Docrat Group). Your staff portal account has been created so you can begin managing dealership content right away.`,
        '',
        `Role: ${roleLabel}`,
        `Permissions: ${capabilitiesSummary}`,
        '',
        '--- Your Sign-In Credentials ---',
        `Portal URL: ${portalUrl}`,
        `Username (Work Email): ${recipientEmail}`,
        `Temporary Password: ${temporaryPassword}`,
        '',
        'First-Time Sign-In Instructions:',
        '1. Open the Portal URL above and enter your Work Email and Temporary Password.',
        '2. On first sign-in, you will be prompted to create your own personal password before accessing your workspace.',
        '',
        `Regards,`,
        `${senderBranchName} Administration`,
      ].join('\n');

      const htmlBody = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,Segoe UI,Arial,sans-serif;color:#091224;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background:#001E50;padding:24px 28px;color:#FFFFFF;">
              <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#93C5FD;font-weight:600;">
                Asaf Auto Sales (Pty) Ltd · Docrat Group
              </p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;line-height:1.3;">
                Welcome to ${escapeHtml(branchInfo.name)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:14px;line-height:1.6;color:#334155;">
              <p style="margin:0 0 14px;">Hello <strong style="color:#091224;">${escapeHtml(fullName)}</strong>,</p>
              <p style="margin:0 0 18px;">
                Your dealership portal account is ready. Use the temporary credentials below to sign in and configure your personal password.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
                <tr>
                  <td style="padding:4px 0;font-size:12px;color:#64748B;">Assigned Role</td>
                  <td style="padding:4px 0;font-size:13px;font-weight:600;color:#001E50;text-align:right;">${escapeHtml(roleLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:12px;color:#64748B;">Username (Work Email)</td>
                  <td style="padding:4px 0;font-size:13px;font-family:monospace;font-weight:600;color:#091224;text-align:right;">${escapeHtml(recipientEmail)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:12px;color:#64748B;">Temporary Password</td>
                  <td style="padding:4px 0;font-size:13px;font-family:monospace;font-weight:700;color:#001E50;text-align:right;">${escapeHtml(temporaryPassword)}</td>
                </tr>
              </table>
              <p style="margin:0 0 18px;font-size:13px;color:#475569;">
                <strong style="color:#091224;">What you can do:</strong> ${escapeHtml(capabilitiesSummary)}
              </p>
              <p style="margin:0 0 22px;">
                <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#001E50;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:13px;padding:12px 22px;border-radius:8px;">
                  Sign In &amp; Set Your Password
                </a>
              </p>
              <p style="margin:0;font-size:12px;color:#64748B;">
                Portal link: <a href="${escapeHtml(portalUrl)}" style="color:#00437A;">${escapeHtml(portalUrl)}</a><br />
                For security, you will be required to replace your temporary password upon first sign-in.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const resendKey = process.env.RESEND_API_KEY?.trim();
      const mailFrom =
        process.env.MAIL_FROM?.trim() || `${senderBranchName} <noreply@newcastlevw.co.za>`;

      if (resendKey) {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: mailFrom,
            to: [recipientEmail],
            subject,
            text: textBody,
            html: htmlBody,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!resendRes.ok) {
          const detail = await resendRes.text().catch(() => '');
          res.status(502).json({
            sent: false,
            reason: 'DELIVERY_FAILED',
            message: `Resend email service returned HTTP ${resendRes.status}${
              detail ? `: ${detail.slice(0, 140)}` : ''
            }`,
          });
          return;
        }

        res.json({
          sent: true,
          provider: 'resend',
          message: `Welcome email automatically sent to ${recipientEmail}.`,
        });
        return;
      }

      const smtpHost = process.env.SMTP_HOST?.trim();
      const smtpUser = process.env.SMTP_USER?.trim();
      const smtpPass = process.env.SMTP_PASS?.trim();
      if (smtpHost && smtpUser && smtpPass) {
        const smtpPort = Number(process.env.SMTP_PORT || 587);
        const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: process.env.MAIL_FROM?.trim() || smtpUser,
          to: recipientEmail,
          subject,
          text: textBody,
          html: htmlBody,
        });

        res.json({
          sent: true,
          provider: 'smtp',
          message: `Welcome email automatically sent to ${recipientEmail}.`,
        });
        return;
      }

      res.json({
        sent: false,
        reason: 'NO_MAIL_PROVIDER',
        message:
          'No automated mail provider (RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS) is configured on the server yet. Use the 1-click Email or WhatsApp buttons below to deliver the welcome message.',
      });
    } catch (err) {
      res.status(502).json({
        sent: false,
        reason: 'DELIVERY_FAILED',
        message:
          err instanceof Error
            ? err.message
            : 'Unable to send staff welcome email right now.',
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
