import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Globe,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type {
  DealershipGroupProfile,
  DealershipRecord,
  SystemStatusResponse,
} from '../types/dealership';
import { Button, Dialog, Input, Label } from './ui/shadcn';

type ManualTab = 'env-builder' | 'acquire-apis' | 'hosting' | 'troubleshooting';

interface SystemHandoverManualModalProps {
  open: boolean;
  initialTab?: ManualTab;
  onClose: () => void;
  groupProfile: Omit<DealershipGroupProfile, 'id' | 'updatedAt' | 'updatedBy'>;
  branches: DealershipRecord[];
  systemStatus: SystemStatusResponse | null;
  loadingStatus?: boolean;
  onRefreshStatus?: () => void;
  onUpdateGroupDraft?: (
    patch: Partial<Omit<DealershipGroupProfile, 'id' | 'updatedAt' | 'updatedBy'>>
  ) => void;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold',
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      <span>{label}</span>
    </span>
  );
}

export function SystemHandoverManualModal({
  open,
  initialTab = 'env-builder',
  onClose,
  groupProfile,
  branches,
  systemStatus,
  loadingStatus,
  onRefreshStatus,
  onUpdateGroupDraft,
}: SystemHandoverManualModalProps) {
  const [activeTab, setActiveTab] = useState<ManualTab>(initialTab);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customAppUrl, setCustomAppUrl] = useState('');
  const [customPort, setCustomPort] = useState('3000');
  const [includeGemini, setIncludeGemini] = useState(
    groupProfile.licenceScannerEnabled ?? true
  );
  const [includeDecodo, setIncludeDecodo] = useState(
    groupProfile.autotraderSyncDefault ?? true
  );

  const effectiveAppUrl = (
    customAppUrl.trim() ||
    groupProfile.primarySiteUrl?.trim() ||
    systemStatus?.appUrlValue ||
    'https://your-dealership.vercel.app'
  ).replace(/\/+$/, '');
  const effectivePort = customPort.trim() || '3000';
  const effectiveSmtpHost = groupProfile.smtpHost?.trim() || 'smtp.gmail.com';
  const effectiveSmtpPort = String(groupProfile.smtpPort || 465);
  const effectiveSmtpUser =
    groupProfile.smtpUser?.trim() ||
    groupProfile.complianceEmail?.trim() ||
    'noreply@yourdealership.co.za';
  const effectiveSmtpFrom =
    groupProfile.smtpFrom?.trim() ||
    `${groupProfile.groupName || 'Dealership Group'} <${effectiveSmtpUser}>`;
  const effectiveDefaultNotify =
    groupProfile.defaultNotifyEmail?.trim() ||
    groupProfile.complianceEmail?.trim() ||
    'leads@yourdealership.co.za';

  const branchSecretEntries = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ branchId: string; branchName: string; key: string; user: string; connected: boolean }> = [];
    for (const branch of branches) {
      const normalized =
        branch.id
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'MAIN';
      const key = (branch.smtpPassEnvKey || `SMTP_PASS_BRANCH_${normalized}`).trim().toUpperCase();
      if (key === 'SMTP_PASS' || seen.has(key)) continue;
      seen.add(key);
      const statusMatch = systemStatus?.branches?.find((b) => b.branchId === branch.id);
      list.push({
        branchId: branch.id,
        branchName: branch.name,
        key,
        user: branch.smtpUser?.trim() || `web@${branch.domain?.replace(/^www\./, '') || 'branch.co.za'}`,
        connected: Boolean(statusMatch?.branchSecretConfigured),
      });
    }
    return list;
  }, [branches, systemStatus]);

  const generatedEnvBlock = useMemo(() => {
    const lines = [
      `# ==============================================================================`,
      `# ${groupProfile.groupName || 'Volkswagen Dealership Group'} — Server Environment (.env / Vercel)`,
      `# SECURITY: Keep secrets ONLY in .env, Vercel Env Variables, or AI Studio Secrets.`,
      `# Never prefix secret keys with VITE_ and never commit real .env files to Git.`,
      `# ==============================================================================`,
      ``,
      `# 1. Server Port & Public Application URL`,
      `PORT="${effectivePort}"`,
      `APP_URL="${effectiveAppUrl}"`,
      ``,
      `# 2. Google Gemini API Key (Licence Disc OCR Scanner on Service & Parts forms)`,
      includeGemini
        ? `GEMINI_API_KEY="PASTE_YOUR_GEMINI_API_KEY_HERE"`
        : `# GEMINI_API_KEY="" # (Optional: disabled in group settings)`,
      ``,
      `# 3. Decodo Web Data API Key (Optional: Automated AutoTrader Dealer Scraping)`,
      includeDecodo
        ? `DECODO_API_KEY="PASTE_YOUR_DECODO_TOKEN_OR_LEAVE_BLANK"`
        : `# DECODO_API_KEY="" # (Optional: use Manual Stock or Paste JSON/HTML)`,
      ``,
      `# 4. Group Default Outgoing Email (Nodemailer SMTP)`,
      `SMTP_HOST="${effectiveSmtpHost}"`,
      `SMTP_PORT="${effectiveSmtpPort}"`,
      `SMTP_USER="${effectiveSmtpUser}"`,
      `SMTP_PASS="PASTE_16_CHAR_GMAIL_APP_OR_MAILBOX_PASSWORD"`,
      `SMTP_FROM="${effectiveSmtpFrom}"`,
      `DEFAULT_LEAD_NOTIFY_EMAIL="${effectiveDefaultNotify}"`,
    ];

    if (branchSecretEntries.length > 0) {
      lines.push('');
      lines.push(`# 5. Per-Branch Mailbox Passwords (only needed when a branch uses its own SMTP_USER)`);
      for (const b of branchSecretEntries) {
        lines.push(`# ${b.branchName} (${b.user})`);
        lines.push(`${b.key}="PASTE_BRANCH_MAILBOX_PASSWORD_HERE"`);
      }
    }

    return lines.join('\n');
  }, [
    groupProfile.groupName,
    effectivePort,
    effectiveAppUrl,
    includeGemini,
    includeDecodo,
    effectiveSmtpHost,
    effectiveSmtpPort,
    effectiveSmtpUser,
    effectiveSmtpFrom,
    effectiveDefaultNotify,
    branchSecretEntries,
  ]);

  const vercelVariablesTable = useMemo(() => {
    const rows = [
      {
        key: 'APP_URL',
        value: effectiveAppUrl,
        secret: false,
        required: 'Recommended',
        purpose: 'Public https://*.vercel.app or custom production URL',
      },
      {
        key: 'GEMINI_API_KEY',
        value: '<Acquire from aistudio.google.com/apikey (starts with AIzaSy...)>',
        secret: true,
        required: 'Required for Licence Disc Scan',
        purpose: 'Extracts VIN, Engine Code & Plate from Service/Parts disc photos',
      },
      {
        key: 'DECODO_API_KEY',
        value: '<Acquire from dashboard.decodo.com or leave blank>',
        secret: true,
        required: 'Optional',
        purpose: 'Automated AutoTrader scraping (manual & JSON paste work without it)',
      },
      {
        key: 'SMTP_HOST',
        value: effectiveSmtpHost,
        secret: false,
        required: 'Required for Email',
        purpose: 'Default outgoing mail server (e.g. smtp.gmail.com, smtp.office365.com)',
      },
      {
        key: 'SMTP_PORT',
        value: effectiveSmtpPort,
        secret: false,
        required: 'Required for Email',
        purpose: '465 (SSL/TLS) or 587 (STARTTLS)',
      },
      {
        key: 'SMTP_USER',
        value: effectiveSmtpUser,
        secret: false,
        required: 'Required for Email',
        purpose: 'Group default outgoing sender mailbox address',
      },
      {
        key: 'SMTP_PASS',
        value: '<16-char Gmail App Password or mailbox password>',
        secret: true,
        required: 'Required for Email',
        purpose: 'Authenticates Nodemailer SMTP_USER on the server',
      },
      {
        key: 'SMTP_FROM',
        value: effectiveSmtpFrom,
        secret: false,
        required: 'Recommended',
        purpose: 'Display name & address shown in agent inboxes',
      },
      {
        key: 'DEFAULT_LEAD_NOTIFY_EMAIL',
        value: effectiveDefaultNotify,
        secret: false,
        required: 'Recommended',
        purpose: 'Fallback recipient if a branch department email is empty',
      },
      ...branchSecretEntries.map((b) => ({
        key: b.key,
        value: `<Mailbox/App password for ${b.user}>`,
        secret: true,
        required: `Branch (${b.branchName})`,
        purpose: `Allows ${b.branchName} to send from ${b.user}`,
      })),
    ];
    return rows;
  }, [
    effectiveAppUrl,
    effectiveSmtpHost,
    effectiveSmtpPort,
    effectiveSmtpUser,
    effectiveSmtpFrom,
    effectiveDefaultNotify,
    branchSecretEntries,
  ]);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // Clipboard blocked
    }
  };

  const buildFullManualMarkdown = (): string => {
    const firebaseProj = systemStatus?.firebase.projectId || 'YOUR_FIREBASE_PROJECT_ID';
    const firebaseDb = systemStatus?.firebase.firestoreDatabaseId || '(default)';
    const branchRows = branches
      .map(
        (b) =>
          `| ${b.id} | ${b.name} | ${b.domain} | ${b.smtpUser || '-'} | \`${
            b.smtpPassEnvKey || `SMTP_PASS_BRANCH_${b.id.toUpperCase()}`
          }\` | ${b.autotraderDealerId || 'Manual'} |`
      )
      .join('\n');

    return `# ${groupProfile.groupName || 'Dealership Group'} — Complete System Handover & Operations Manual

**Generated:** ${new Date().toISOString().slice(0, 10)}
**Legal Entity:** ${groupProfile.legalEntity} (FSP ${groupProfile.fspNumber})
**Firebase Project:** \`${firebaseProj}\` · **Database ID:** \`${firebaseDb}\`

---

## 1. System Prerequisites & Accounts Needed
Before deploying or handing over the platform, confirm you have:
1. **Node.js v22 LTS or newer** & **npm** (required for \`server.ts\`).
2. **Firebase Project** (Spark free tier works—create at https://console.firebase.google.com).
3. **Google Gemini API Key** (\`GEMINI_API_KEY\`) for Licence Disc OCR scanning (https://aistudio.google.com/apikey).
4. **Outgoing Mail Account (SMTP)** via Google Workspace/Gmail, Microsoft 365, or cPanel/Domains.co.za.
5. *(Optional)* **Decodo Web Data API Key** (\`DECODO_API_KEY\`) for automated AutoTrader scraping.
6. **Hosting Platform Account**: **Vercel** (\`*.vercel.app\`), Docker host, or Linux VPS (PM2 + Nginx).

---

## 2. Environment Variables Template (\`.env\` / Vercel Environment Variables)

> **Security Rule:** Never paste real passwords or API keys into Firestore, frontend code, or \`VITE_*\` variables. Set them strictly in \`.env\`, **Vercel -> Project -> Settings -> Environment Variables**, or **AI Studio -> Settings -> Secrets**.

\`\`\`env
${generatedEnvBlock}
\`\`\`

---

## 3. Step-by-Step Guide: How to Acquire Every API Key & Password

### 3.1 Firebase Project & Security Rules
1. Open [Firebase Console](https://console.firebase.google.com/) and create/open your project.
2. Enable **Build -> Firestore Database** (Production mode).
3. Open **Build -> Authentication -> Sign-in method** and enable **Google** and **Email/Password**.
4. Open **Authentication -> Settings -> Authorized domains** and add:
   - \`localhost\`
   - Your Vercel URL (e.g. \`your-dealership.vercel.app\`)
   - Every branch custom domain (e.g. \`www.newcastlevw.co.za\`, \`www.ermelovw.co.za\`)
5. Under **Project Settings -> General -> Your apps -> Web (</>)**, copy your config JSON into \`/firebase-applet-config.json\`.
   - **What it looks like:**
     \`\`\`json
     {
       "projectId": "my-vw-dealership-12345",
       "appId": "1:123456789012:web:abc123def456",
       "apiKey": "AIzaSyExampleFirebaseWebKey1234567890",
       "authDomain": "my-vw-dealership-12345.firebaseapp.com",
       "firestoreDatabaseId": "(default)",
       "storageBucket": "my-vw-dealership-12345.firebasestorage.app",
       "messagingSenderId": "123456789012"
     }
     \`\`\`
6. Update \`BOOTSTRAPPED_ADMIN_EMAIL\` to the new Group Owner Google email in:
   - \`/firestore.rules\`
   - \`/src/lib/firebase.ts\`
   - \`/server.ts\`
7. Validate and deploy security rules:
   \`\`\`bash
   npx eslint firestore.rules
   npm install -g firebase-tools
   firebase login
   firebase use YOUR_FIREBASE_PROJECT_ID
   firebase deploy --only firestore:rules
   \`\`\`

### 3.2 Google Gemini API Key (\`GEMINI_API_KEY\`)
Used server-side by \`POST /api/extract-licence-disc\` to read South African eNaTIS licence discs (VIN, Engine Code, Number Plate, Make/Model).
1. Go to [Google AI Studio API Keys](https://aistudio.google.com/apikey) signed in with your Google account.
2. Click **Create API key**, select or create a Google Cloud project, and copy the generated key.
3. **What it looks like:** A ~39-character string starting with \`AIzaSy\`, e.g. \`AIzaSyD4xK9pQ2wR7mN8vB3cF6hJ1lM0nP5tY\`.
4. Add it as \`GEMINI_API_KEY\` in \`.env\` or Vercel Environment Variables.

### 3.3 Nodemailer SMTP Passwords (\`SMTP_PASS\` & \`SMTP_PASS_BRANCH_*\`)
#### Option A: Gmail / Google Workspace (\`smtp.gmail.com\`, Port \`465\`)
1. Turn **ON** **2-Step Verification** in **Google Account -> Security**.
2. Search **App passwords** in Google Account search bar.
3. Enter app name \`Dealership Website\` and click **Create**.
4. **What it looks like:** A 16-character code in 4 groups like \`abcd efgh ijkl mnop\` (remove spaces or paste directly).
5. Save as \`SMTP_PASS\` (or \`SMTP_PASS_BRANCH_<ID>\` for a branch mailbox).

#### Option B: Custom Domain / cPanel (\`mail.yourdomain.co.za\`, Port \`465\`)
1. Log into cPanel / DirectAdmin -> **Email Accounts -> Create** (e.g. \`web@ladysmithvw.co.za\`).
2. Click **Connect Devices** to confirm hostname (\`mail.ladysmithvw.co.za\`, Port \`465\` SSL/TLS).
3. Save that mailbox password in \`SMTP_PASS_BRANCH_<ID>\`.

#### Option C: Microsoft 365 (\`smtp.office365.com\`, Port \`587\`)
1. In **Microsoft 365 Admin Center -> Active Users**, select the sender mailbox.
2. Under **Mail -> Manage email apps**, tick **Authenticated SMTP**.
3. If MFA is active, create an App Password under Security Info.

### 3.4 Decodo Web Data API (\`DECODO_API_KEY\` — Optional)
Only required if you want automated one-click AutoTrader scraping. Manual vehicle creation and **Paste AutoTrader JSON / HTML** work without any API key.
1. Sign up at [Decodo](https://www.decodo.com/) and activate a **Web Scraping API** plan.
2. Open **Dashboard -> Scraping API -> Authentication / API Keys** to generate credentials.
3. **What it looks like:** Either a Bearer token string or Base64/Basic credential (\`Basic dXNlcjpwYXNz\` or \`username:password\`).

---

## 4. Registered Branches & Email Secret Mapping

| Branch ID | Branch Name | Domain | Sender (\`SMTP_USER\`) | Secret Key Name | AutoTrader ID |
| :--- | :--- | :--- | :--- | :--- | :--- |
${branchRows || '| 1 | Default Branch | www.example.co.za | web@example.co.za | `SMTP_PASS` | - |'}

---

## 5. Deploying & Testing on Vercel (\`*.vercel.app\`)

This repository includes \`/vercel.json\` and \`/api/index.ts\` so both the Vite SPA and all Express \`/api/*\` endpoints run on Vercel.
1. Push your repository to GitHub / GitLab / Bitbucket.
2. Open [Vercel](https://vercel.com/new) -> **Import Project** -> Framework Preset: **Vite** (leave Build Command as \`npm run build\` and Output Directory as \`dist\`).
3. In **Project -> Settings -> Environment Variables**, add every key from Section 2 above (\`GEMINI_API_KEY\`, \`SMTP_HOST\`, \`SMTP_PORT\`, \`SMTP_USER\`, \`SMTP_PASS\`, \`SMTP_FROM\`, \`DEFAULT_LEAD_NOTIFY_EMAIL\`, plus branch \`SMTP_PASS_BRANCH_*\` secrets and optional \`DECODO_API_KEY\`).
4. Deploy and copy your live URL (e.g. \`https://your-dealership.vercel.app\`).
5. **CRITICAL:** Add \`your-dealership.vercel.app\` inside **Firebase Console -> Authentication -> Settings -> Authorized domains**.
6. Update \`APP_URL\` in Vercel Environment Variables to your live URL and trigger a Redeploy.
7. **Important Vercel Notes:**
   - Vercel serverless functions enforce a **4.5 MB** request body limit and have ephemeral \`/tmp\` filesystem storage (not persistent across serverless cold starts).
   - For permanent multi-MB image/CV uploads in production, host \`server.ts\` on a persistent Node/Docker container (Cloud Run, Railway, Render, DigitalOcean, or on-premise VM) with a mounted \`/uploads\` + \`/private_uploads\` volume.

---

## 6. Staff Hierarchy & Roles (8 Tiers)
1. **Group Administrator (\`admin\`)**: Full group control, \`/groupSettings/main\`, permanent deletes, creating Admins/IT Managers.
2. **Group IT Manager (\`it_manager\`)**: Manages branches, SMTP/AutoTrader tech setup, non-admin staff accounts, and IT Escalation tickets.
3. **Branch Admin / Dealer Principal (\`branch_admin\`)**: Full control for their assigned branch (leads, manual stock, branch specials, careers, read-only branch staff & tickets).
4. **Branch IT Agent (\`it_agent\`)**: Views branch readiness & submits timed role-escalation tickets approved by the IT Manager.
5. **Car Sales Executive (\`agent\`)**: Manages branch manual stock, branch specials/events, and **Spotter Referral Leads**.
6. **Marketing Coordinator (\`marketing\`)**: Group-wide Motoring News, Specials, Events & Competitions.
7. **Parts Sales Executive (\`parts\`)**: Branch Parts Leads inbox & Parts Specials.
8. **Service Booking Clerk (\`service\`)**: Branch Service Leads inbox & Service Specials.

---

## 7. Future Error Troubleshooting & Quick Fixes

| Error / Symptom | Root Cause | Step-by-Step Fix |
| :--- | :--- | :--- |
| \`auth/unauthorized-domain\` on Google Sign-In | Live \`*.vercel.app\` or branch domain is missing from Firebase Auth | Firebase Console -> Authentication -> Settings -> Authorized domains -> Add domain. |
| \`Missing or insufficient permissions\` / \`PERMISSION_DENIED\` | Wrong \`BOOTSTRAPPED_ADMIN_EMAIL\`, undeployed rules, or inactive staff profile | Match admin email across \`firestore.rules\`, \`src/lib/firebase.ts\`, \`server.ts\`; run \`firebase deploy --only firestore:rules\`; check \`/staffUsers/{uid}\` has \`active: true\`. |
| \`503 GEMINI_API_KEY not configured\` on Disc Scan | Missing or placeholder \`GEMINI_API_KEY\` | Generate key at \`aistudio.google.com/apikey\`, add to Vercel Env / \`.env\`, restart/redeploy. |
| \`Waiting for SMTP_PASS\` or \`535 Authentication failed\` | Missing secret, 2FA off on Gmail, or M365 SMTP disabled | Enable 2FA & create 16-char Gmail App Password; enable Authenticated SMTP in M365; check \`SMTP_PASS\` / \`SMTP_PASS_BRANCH_*\`. |
| \`404 NOT_FOUND\` when refreshing \`/admin\` on Vercel | Missing SPA rewrite rules | Ensure \`/vercel.json\` is committed at repo root with rewrites to \`/api/index\` and \`/index.html\`. |
| \`Quota exceeded\` on Firestore | Daily Spark free-tier read/write quota reached | Resets daily at midnight Pacific Time, or upgrade Firebase project to Blaze pay-as-you-go. |
| Applicant CV/PDF fails to load after Vercel cold start | Serverless \`/tmp\` wiped on idle container | Use persistent Docker/VM hosting with disk volume for long-term applicant file retention. |
`;
  };

  const downloadManual = (format: 'html' | 'md' | 'env') => {
    const slug = (groupProfile.groupName || 'dealership-group')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'dealership-group';

    if (format === 'env') {
      const blob = new Blob([generatedEnvBlock], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.env.template`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (format === 'md') {
      const blob = new Blob([buildFullManualMarkdown()], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SYSTEM-HANDOVER-MANUAL-${slug}.md`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const branchRowsHtml = branches
      .map(
        (b) => `<tr>
          <td><code>${escapeHtmlText(b.id)}</code></td>
          <td><strong>${escapeHtmlText(b.name)}</strong></td>
          <td><code>${escapeHtmlText(b.domain)}</code></td>
          <td><code>${escapeHtmlText(b.smtpUser || '-')}</code></td>
          <td><code>${escapeHtmlText(b.smtpPassEnvKey || `SMTP_PASS_BRANCH_${b.id.toUpperCase()}`)}</code></td>
          <td>${escapeHtmlText(b.autotraderDealerId || 'Manual')}</td>
        </tr>`
      )
      .join('');

    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtmlText(groupProfile.groupName || 'Dealership Group')} — System Handover &amp; Setup Manual</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 960px; margin: 32px auto; padding: 0 24px; }
    .hero { background: #001E50; color: #ffffff; padding: 28px 32px; border-radius: 14px; margin-bottom: 24px; }
    .hero p { margin: 0 0 6px; font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; opacity: 0.85; }
    .hero h1 { margin: 0; font-size: 26px; }
    h2 { color: #001E50; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 30px; }
    h3 { color: #00437A; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 9px 11px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; color: #091224; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    code { padding: 2px 5px; font-size: 12px; }
    pre { padding: 14px 16px; overflow-x: auto; font-size: 12px; }
    .warn { background: #fffbeb; border-left: 4px solid #d97706; padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-size: 13px; }
    .info { background: #eff6ff; border-left: 4px solid #00437A; padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-size: 13px; }
    @media print { .no-print { display: none; } body { margin: 12px; } }
  </style>
</head>
<body>
  <div class="hero">
    <p>${escapeHtmlText(groupProfile.legalEntity)} · FSP ${escapeHtmlText(groupProfile.fspNumber)}</p>
    <h1>${escapeHtmlText(groupProfile.groupName || 'Dealership Group')} — Complete System Handover Manual</h1>
    <p style="margin-top: 10px; opacity: 0.92; text-transform: none; letter-spacing: 0;">Includes API &amp; Password Acquisition, <code>.env</code> Setup, Vercel Hosting, Branch Registration &amp; Error Troubleshooting</p>
  </div>
  <p class="no-print" style="font-size: 12px; color: #64748b;">Tip: Press <strong>Ctrl+P</strong> (Windows) or <strong>Cmd+P</strong> (Mac) and choose <strong>Save as PDF</strong> to create a PDF handover pack.</p>

  <h2>1. Complete Environment Variables Template (.env / Vercel)</h2>
  <div class="warn"><strong>Security Rule:</strong> Never store raw passwords or API keys in public database fields or <code>VITE_*</code> variables. Add them only inside server <code>.env</code>, Vercel <strong>Settings &rarr; Environment Variables</strong>, or AI Studio <strong>Settings &rarr; Secrets</strong>.</div>
  <pre>${escapeHtmlText(generatedEnvBlock)}</pre>

  <h2>2. How to Acquire Every API Key &amp; Password (With Examples)</h2>
  <h3>2.1 Firebase Project, Auth &amp; Firestore Security Rules</h3>
  <ol>
    <li>Create your project at <strong>console.firebase.google.com</strong> and create a Firestore Database (Production mode).</li>
    <li>Enable <strong>Google</strong> and <strong>Email/Password</strong> under Authentication &rarr; Sign-in method.</li>
    <li>Add <code>localhost</code>, your Vercel URL (e.g. <code>your-site.vercel.app</code>), and every branch domain to <strong>Authentication &rarr; Settings &rarr; Authorized domains</strong>.</li>
    <li>Copy your Web App JSON config into <code>/firebase-applet-config.json</code>. Example format:<br/><code>{"projectId":"my-vw-group","appId":"1:973970...:web:cd9841...","apiKey":"AIzaSy...","authDomain":"my-vw-group.firebaseapp.com","firestoreDatabaseId":"(default)"}</code></li>
    <li>Replace <code>BOOTSTRAPPED_ADMIN_EMAIL</code> in <code>/firestore.rules</code>, <code>/src/lib/firebase.ts</code>, and <code>/server.ts</code>, then run <code>npx eslint firestore.rules &amp;&amp; firebase deploy --only firestore:rules</code>.</li>
  </ol>

  <h3>2.2 Google Gemini API Key (<code>GEMINI_API_KEY</code>)</h3>
  <ol>
    <li>Open <strong>aistudio.google.com/apikey</strong> and click <strong>Create API key</strong>.</li>
    <li><strong>Example of acquired key:</strong> <code>AIzaSyD4xK9pQ2wR7mN8vB3cF6hJ1lM0nP5tY</code> (~39 characters starting with <code>AIzaSy</code>).</li>
    <li>Powers automatic Licence Disc OCR scanning on Service Bookings and Parts Requests.</li>
  </ol>

  <h3>2.3 Nodemailer SMTP Mail Passwords (<code>SMTP_PASS</code> &amp; <code>SMTP_PASS_BRANCH_*</code>)</h3>
  <ul>
    <li><strong>Gmail / Google Workspace:</strong> Enable 2-Step Verification &rarr; Google Account Search &rarr; <strong>App passwords</strong> &rarr; Create. Looks like: <code>abcd efgh ijkl mnop</code> (16 characters). Use host <code>smtp.gmail.com</code>, port <code>465</code>.</li>
    <li><strong>Custom Domain / cPanel:</strong> Create mailbox e.g. <code>web@ladysmithvw.co.za</code> in cPanel Email Accounts. Use outgoing host <code>mail.ladysmithvw.co.za</code>, port <code>465</code>.</li>
    <li><strong>Microsoft 365:</strong> Enable <strong>Authenticated SMTP</strong> under Active Users &rarr; Mail &rarr; Manage email apps. Use host <code>smtp.office365.com</code>, port <code>587</code>.</li>
  </ul>

  <h3>2.4 Decodo Web Data API (<code>DECODO_API_KEY</code> — Optional)</h3>
  <p>Only needed for automated AutoTrader scraping. Manual vehicle entry and <em>Paste AutoTrader JSON / HTML</em> work without it. Looks like a Bearer token or Base64/<code>username:password</code> credential from <code>dashboard.decodo.com</code>.</p>

  <h2>3. Registered Branches &amp; Secret Key Map</h2>
  <table>
    <thead><tr><th>ID</th><th>Branch</th><th>Domain</th><th>Sender Email</th><th>Secret Key Name</th><th>AutoTrader ID</th></tr></thead>
    <tbody>${branchRowsHtml}</tbody>
  </table>

  <h2>4. Hosting on Vercel (<code>*.vercel.app</code>)</h2>
  <ol>
    <li>Import the repository in Vercel (Framework Preset: <strong>Vite</strong>). Included <code>vercel.json</code> and <code>/api/index.ts</code> wire both the React SPA and Express <code>/api/*</code> backend.</li>
    <li>Paste all variables from Section 1 into <strong>Vercel &rarr; Project &rarr; Settings &rarr; Environment Variables</strong>.</li>
    <li>Deploy, copy your <code>https://*.vercel.app</code> URL, and add it to <strong>Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains</strong>.</li>
    <li>Note: Vercel functions use ephemeral <code>/tmp</code> storage and a 4.5 MB upload body cap. For permanent multi-MB media/CV file persistence, use Docker or a Linux VM (see <code>DEPLOYMENT.md</code>).</li>
  </ol>

  <h2>5. Troubleshooting &amp; Error Fixes</h2>
  <table>
    <thead><tr><th>Error / Symptom</th><th>Cause</th><th>Fix</th></tr></thead>
    <tbody>
      <tr><td><code>auth/unauthorized-domain</code></td><td>Vercel or custom domain not allowlisted in Firebase Auth</td><td>Add the exact hostname inside Firebase Console &rarr; Authentication &rarr; Authorized domains.</td></tr>
      <tr><td><code>PERMISSION_DENIED</code></td><td>Rules out of sync, wrong admin email, or expired IT escalation</td><td>Verify admin email in 3 files, re-deploy <code>firestore.rules</code>, confirm <code>staffUsers/{uid}.active == true</code>.</td></tr>
      <tr><td><code>503 GEMINI_API_KEY missing</code></td><td>Server environment missing Gemini key</td><td>Set <code>GEMINI_API_KEY</code> in Vercel Env / <code>.env</code> and redeploy/restart.</td></tr>
      <tr><td><code>535 SMTP Authentication failed</code></td><td>Wrong password, Gmail 2FA off, or M365 SMTP blocked</td><td>Use a 16-char Gmail App Password or enable M365 Authenticated SMTP for that sender mailbox.</td></tr>
      <tr><td><code>404</code> on page refresh in Vercel</td><td>SPA rewrite missing</td><td>Verify <code>vercel.json</code> is present in project root.</td></tr>
    </tbody>
  </table>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SYSTEM-HANDOVER-MANUAL-${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="System Setup, API Acquisition & Handover Manual"
      subtitle="Everything needed to configure environment variables, acquire APIs & passwords, deploy to Vercel or self-hosted servers, and resolve future errors."
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-5 text-sm text-[#334155]">
        {/* Top Action & Export Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#001E50]">
              <BookOpen className="h-4 w-4" />
              <span>Complete Handover Pack · {groupProfile.groupName || 'Dealership Group'}</span>
              {systemStatus && (
                <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-[#00437A] border border-[#BFDBFE]">
                  Runtime: {systemStatus.runtime.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-xs text-[#1E3A8A]">
              Use the configurator below to build your exact <code>.env</code> or Vercel variable set, then download the printable Handover Manual for your team or client.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onRefreshStatus && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingStatus}
                onClick={onRefreshStatus}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loadingStatus && 'animate-spin')} />
                <span>Check Live Keys</span>
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => downloadManual('html')}>
              <Download className="h-3.5 w-3.5" />
              <span>Download Manual (HTML / PDF)</span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadManual('md')}>
              <FileText className="h-3.5 w-3.5" />
              <span>Download (.md)</span>
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#E2E8F0] pb-3">
          {[
            { id: 'env-builder' as const, label: '.env & Vercel Env Builder', icon: FileCode2 },
            { id: 'acquire-apis' as const, label: 'Acquire APIs & Passwords', icon: KeyRound },
            { id: 'hosting' as const, label: 'Vercel & Server Hosting', icon: Cloud },
            { id: 'troubleshooting' as const, label: 'Error Fixes & Manual', icon: Wrench },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer',
                  activeTab === tab.id
                    ? 'bg-[#001E50] text-white'
                    : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:border-[#001E50]'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: .env & VERCEL ENV BUILDER */}
        {activeTab === 'env-builder' && (
          <div className="space-y-5">
            {/* Live Server Readiness Overview */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-[#091224] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#001E50]" />
                  <span>Live Server Environment &amp; API Readiness Check</span>
                </h3>
                <span className="text-[11px] text-[#64748B]">
                  Reads server status only — secret values are never sent to the browser
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 space-y-1">
                  <p className="text-[11px] font-mono font-semibold text-[#475569]">GEMINI_API_KEY</p>
                  <StatusPill
                    ok={Boolean(systemStatus?.apis.gemini.configured)}
                    label={systemStatus?.apis.gemini.configured ? 'Connected' : 'Missing in Server Env'}
                  />
                  <p className="text-[11px] text-[#64748B]">Licence Disc OCR Scanner</p>
                </div>

                <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 space-y-1">
                  <p className="text-[11px] font-mono font-semibold text-[#475569]">SMTP_PASS</p>
                  <StatusPill
                    ok={Boolean(systemStatus?.apis.globalSmtp.configured)}
                    label={systemStatus?.apis.globalSmtp.configured ? 'Connected' : 'Missing in Server Env'}
                  />
                  <p className="text-[11px] text-[#64748B]">Group Fallback Mailer</p>
                </div>

                <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 space-y-1">
                  <p className="text-[11px] font-mono font-semibold text-[#475569]">DECODO_API_KEY</p>
                  <StatusPill
                    ok={Boolean(systemStatus?.apis.decodo.configured)}
                    label={systemStatus?.apis.decodo.configured ? 'Connected' : 'Optional / Not Set'}
                  />
                  <p className="text-[11px] text-[#64748B]">AutoTrader Live Scrape</p>
                </div>

                <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 space-y-1">
                  <p className="text-[11px] font-mono font-semibold text-[#475569]">FIREBASE PROJECT</p>
                  <StatusPill
                    ok={Boolean(systemStatus?.firebase.projectId)}
                    label={systemStatus?.firebase.projectId || 'Configured'}
                  />
                  <p className="text-[11px] text-[#64748B] truncate">
                    DB: {systemStatus?.firebase.firestoreDatabaseId || 'default'}
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Non-Secret Configuration Form */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-[#091224]">
                  Step 1 — Configure Hosting &amp; Mail Parameters (Generates Your <code>.env</code> &amp; Vercel List)
                </h3>
                <p className="text-xs text-[#64748B]">
                  Update non-secret host URLs and outgoing mail defaults here. Secret passwords and API keys stay strictly in your server <code>.env</code>, Vercel <strong>Environment Variables</strong>, or AI Studio <strong>Secrets</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label>Public Deployment URL (APP_URL)</Label>
                  <Input
                    value={customAppUrl || groupProfile.primarySiteUrl || ''}
                    placeholder="https://newcastle-vw.vercel.app or https://www.newcastlevw.co.za"
                    onChange={(e) => {
                      setCustomAppUrl(e.target.value);
                      onUpdateGroupDraft?.({ primarySiteUrl: e.target.value });
                    }}
                  />
                </div>
                <div>
                  <Label>Server Port (PORT)</Label>
                  <Input
                    value={customPort}
                    placeholder="3000"
                    onChange={(e) => setCustomPort(e.target.value.replace(/[^0-9]/g, '') || '3000')}
                  />
                </div>
                <div>
                  <Label>Group SMTP Host (SMTP_HOST)</Label>
                  <Input
                    value={groupProfile.smtpHost ?? effectiveSmtpHost}
                    placeholder="smtp.gmail.com"
                    onChange={(e) => onUpdateGroupDraft?.({ smtpHost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Group SMTP Port (SMTP_PORT)</Label>
                  <Input
                    type="number"
                    value={groupProfile.smtpPort ?? Number(effectiveSmtpPort)}
                    onChange={(e) =>
                      onUpdateGroupDraft?.({ smtpPort: Number(e.target.value) || 465 })
                    }
                  />
                </div>
                <div>
                  <Label>Group Sender Email (SMTP_USER)</Label>
                  <Input
                    type="email"
                    value={groupProfile.smtpUser ?? ''}
                    placeholder="noreply@yourdealership.co.za"
                    onChange={(e) => onUpdateGroupDraft?.({ smtpUser: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#091224] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGemini}
                    onChange={(e) => {
                      setIncludeGemini(e.target.checked);
                      onUpdateGroupDraft?.({ licenceScannerEnabled: e.target.checked });
                    }}
                  />
                  <span>Enable AI Licence Disc Scanner (<code>GEMINI_API_KEY</code>)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#091224] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDecodo}
                    onChange={(e) => {
                      setIncludeDecodo(e.target.checked);
                      onUpdateGroupDraft?.({ autotraderSyncDefault: e.target.checked });
                    }}
                  />
                  <span>Enable Automated AutoTrader Sync (<code>DECODO_API_KEY</code>)</span>
                </label>
              </div>
            </div>

            {/* Generated .env Block */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#091224] p-4 text-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <Lock className="h-4 w-4" />
                  <span>Generated .env / Server Secrets Template</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadManual('env')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20 cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download .env.template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText('full-env', generatedEnvBlock)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-[#001E50] hover:bg-slate-100 cursor-pointer"
                  >
                    {copiedKey === 'full-env' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedKey === 'full-env' ? 'Copied Full .env!' : 'Copy Full .env'}</span>
                  </button>
                </div>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-slate-200 font-mono">
                {generatedEnvBlock}
              </pre>
            </div>

            {/* Vercel Key-Value Checklist Table */}
            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-[#091224]">
                Vercel Project Settings &rarr; Environment Variables Reference
              </h3>
              <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#091224] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Variable Name</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Example / Configured Value</th>
                      <th className="px-3 py-2 font-semibold">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] bg-white">
                    {vercelVariablesTable.map((row) => (
                      <tr key={row.key}>
                        <td className="px-3 py-2 font-mono font-semibold text-[#001E50] whitespace-nowrap">
                          {row.key}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              row.secret
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {row.secret ? 'Secret' : 'Config'}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-[#334155] break-all">
                          {row.value}
                        </td>
                        <td className="px-3 py-2 text-[#475569]">{row.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACQUIRE APIS & PASSWORDS */}
        {activeTab === 'acquire-apis' && (
          <div className="space-y-4">
            {/* 1. Firebase */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-[#091224] flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#001E50]" />
                  <span>1. Firebase Database, Authentication &amp; Rules (Required)</span>
                </h3>
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#00437A] hover:underline"
                >
                  <span>Open Firebase Console</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-xs text-[#334155]">
                <li>Create a Firebase Project &rarr; <strong>Build &rarr; Firestore Database</strong> (Production mode, e.g. <code>africa-south1</code> or <code>europe-west1</code>).</li>
                <li>Open <strong>Authentication &rarr; Sign-in method</strong> and enable <strong>Google</strong> and <strong>Email/Password</strong>.</li>
                <li>Open <strong>Authentication &rarr; Settings &rarr; Authorized domains</strong> and add <code>localhost</code>, your Vercel domain (<code>*.vercel.app</code>), and every branch domain.</li>
                <li>Under <strong>Project Settings &rarr; General &rarr; Your apps &rarr; Web (&lt;/&gt;)</strong>, copy the config JSON into <code>/firebase-applet-config.json</code>.</li>
                <li>Replace <code>BOOTSTRAPPED_ADMIN_EMAIL</code> in <code>/firestore.rules</code>, <code>/src/lib/firebase.ts</code>, and <code>/server.ts</code>, then run <code>npx eslint firestore.rules &amp;&amp; firebase deploy --only firestore:rules</code>.</li>
              </ol>
              <div className="rounded-lg border border-[#CBD5E1] bg-white p-3 text-[11px]">
                <p className="font-semibold text-[#091224] mb-1">Example of what acquired Firebase config looks like:</p>
                <pre className="overflow-x-auto font-mono text-[11px] text-[#1e293b]">
{`{
  "projectId": "my-vw-group-prod",
  "appId": "1:973970975978:web:cd9841f21883f9c9c53b93",
  "apiKey": "AIzaSyDKCcn-ExampleFirebaseWebKey123",
  "authDomain": "my-vw-group-prod.firebaseapp.com",
  "firestoreDatabaseId": "(default)"
}`}
                </pre>
              </div>
            </div>

            {/* 2. Gemini API Key */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-[#091224] flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#001E50]" />
                  <span>2. Google Gemini API Key (<code>GEMINI_API_KEY</code> — Licence Disc Scanner)</span>
                </h3>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#00437A] hover:underline"
                >
                  <span>Open Google AI Studio Keys</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-xs text-[#334155]">
                <li>Visit <strong>aistudio.google.com/apikey</strong> and click <strong>Create API key</strong>.</li>
                <li>Link a Google Cloud project (Free tier works for testing; enable Cloud Billing on the project for higher production rate limits).</li>
                <li>Copy the key and store it strictly in server <code>.env</code> / Vercel Environment Variables as <code>GEMINI_API_KEY</code>.</li>
              </ol>
              <div className="rounded-lg border border-[#CBD5E1] bg-white p-3 text-[11px]">
                <p className="font-semibold text-[#091224] mb-1">Example of what an acquired Gemini API key looks like:</p>
                <code className="font-mono text-[#001E50]">AIzaSyD4xK9pQ2wR7mN8vB3cF6hJ1lM0nP5tY</code>
                <span className="ml-2 text-[#64748B]">(~39 characters starting with <code>AIzaSy</code>)</span>
              </div>
            </div>

            {/* 3. Nodemailer SMTP */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5">
              <h3 className="font-display text-sm font-semibold text-[#091224] flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#001E50]" />
                <span>3. Outgoing Email Passwords (<code>SMTP_PASS</code> &amp; <code>SMTP_PASS_BRANCH_*</code>)</span>
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-xs">
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 space-y-1.5">
                  <p className="font-semibold text-[#091224]">Gmail / Google Workspace</p>
                  <p>Host: <code>smtp.gmail.com</code> · Port: <code>465</code></p>
                  <p className="text-[#475569]">Enable 2-Step Verification &rarr; search <strong>App passwords</strong> &rarr; Create.</p>
                  <p className="text-[11px]"><strong>Looks like:</strong> <code>abcd efgh ijkl mnop</code> (16 chars)</p>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 space-y-1.5">
                  <p className="font-semibold text-[#091224]">cPanel / Domains.co.za / Xneelo</p>
                  <p>Host: <code>mail.yourdomain.co.za</code> · Port: <code>465</code></p>
                  <p className="text-[#475569]">Create <code>web@branch.co.za</code> in cPanel Email Accounts.</p>
                  <p className="text-[11px]"><strong>Looks like:</strong> Your mailbox password (16+ chars)</p>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 space-y-1.5">
                  <p className="font-semibold text-[#091224]">Microsoft 365 / Exchange</p>
                  <p>Host: <code>smtp.office365.com</code> · Port: <code>587</code></p>
                  <p className="text-[#475569]">Enable <strong>Authenticated SMTP</strong> under Admin Center &rarr; Mail Apps.</p>
                  <p className="text-[11px]"><strong>Looks like:</strong> Mailbox or M365 App Password</p>
                </div>
              </div>
            </div>

            {/* 4. Decodo */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-[#091224] flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#001E50]" />
                  <span>4. Decodo Web Data API (<code>DECODO_API_KEY</code> — Optional)</span>
                </h3>
                <a
                  href="https://dashboard.decodo.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#00437A] hover:underline"
                >
                  <span>Open Decodo Dashboard</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-xs text-[#334155]">
                Only needed if you run automated live AutoTrader scraping. Manual vehicle entry and <strong>Paste AutoTrader JSON / HTML</strong> work 100% free without Decodo.
              </p>
              <div className="rounded-lg border border-[#CBD5E1] bg-white p-3 text-[11px]">
                <p className="font-semibold text-[#091224] mb-1">Example of what an acquired Decodo credential looks like:</p>
                <code className="font-mono text-[#001E50]">Basic U3VwZXJVc2VyOlN1cGVyUGFzcw==</code> or <code className="font-mono text-[#001E50]">username:password</code>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HOSTING ON VERCEL & SELF-HOSTING */}
        {activeTab === 'hosting' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-4 space-y-3">
              <h3 className="font-display text-sm font-semibold text-[#091224] flex items-center gap-2">
                <Cloud className="h-4 w-4 text-[#001E50]" />
                <span>Deploying to Vercel (<code>*.vercel.app</code>) — Step-by-Step</span>
              </h3>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#334155]">
                <li>Push this codebase to GitHub / GitLab / Bitbucket. Notice <code>/vercel.json</code> and <code>/api/index.ts</code> are already pre-configured for Vercel.</li>
                <li>In <strong>Vercel &rarr; Add New Project</strong>, import your repository and confirm Framework Preset is <strong>Vite</strong> (Build Command: <code>npm run build</code>, Output Directory: <code>dist</code>).</li>
                <li>Open <strong>Settings &rarr; Environment Variables</strong> in Vercel and add all keys generated in Tab 1 (<code>GEMINI_API_KEY</code>, <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>SMTP_FROM</code>, <code>DEFAULT_LEAD_NOTIFY_EMAIL</code>, branch <code>SMTP_PASS_BRANCH_*</code> secrets, <code>APP_URL</code>).</li>
                <li>Deploy and copy your assigned domain (e.g. <code>https://your-dealership.vercel.app</code>).</li>
                <li><strong>MANDATORY FIREBASE STEP:</strong> Open <strong>Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains</strong> and add <code>your-dealership.vercel.app</code> (otherwise Google Login displays <code>auth/unauthorized-domain</code>).</li>
              </ol>
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <strong>Important Vercel Serverless Notes:</strong> Vercel functions have a <strong>4.5 MB</strong> upload payload limit and ephemeral <code>/tmp</code> disk storage (uploaded logos or career CVs clear when serverless instances recycle). For long-term file persistence or 8–25 MB video uploads in production, host <code>server.ts</code> with <strong>Docker</strong>, <strong>Cloud Run</strong>, <strong>Railway</strong>, or a <strong>Linux VPS (PM2 + Nginx)</strong>.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
                <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-[#091224] flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-[#001E50]" />
                  <span>Option B — Docker / Data Center</span>
                </h4>
                <p className="text-xs text-[#475569]">
                  Includes multi-stage <code>Dockerfile</code> (Node 22 Alpine) with persistent <code>/app/uploads</code> volume.
                </p>
                <pre className="overflow-x-auto rounded bg-[#091224] p-2.5 text-[11px] text-slate-200 font-mono">
{`cp .env.example .env
docker build -t vw-dealership .
docker run -d -p 3000:3000 --env-file .env \\
  -v $(pwd)/uploads:/app/uploads vw-dealership`}
                </pre>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
                <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-[#091224] flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-[#001E50]" />
                  <span>Option C — Linux VM (PM2 + Nginx)</span>
                </h4>
                <p className="text-xs text-[#475569]">
                  A single server instance serves 1..N branch domains via Nginx <code>Host</code> header forwarding + Certbot SSL.
                </p>
                <pre className="overflow-x-auto rounded bg-[#091224] p-2.5 text-[11px] text-slate-200 font-mono">
{`npm ci && npm run build
NODE_ENV=production node server.ts`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TROUBLESHOOTING & FUTURE ERROR FIXES */}
        {activeTab === 'troubleshooting' && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#091224] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold w-1/4">Error / Symptom</th>
                    <th className="px-3.5 py-2.5 font-semibold w-1/4">Why It Happens</th>
                    <th className="px-3.5 py-2.5 font-semibold w-1/2">Exact Fix Steps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] bg-white">
                  <tr>
                    <td className="px-3.5 py-2.5 font-mono text-red-700 font-semibold">auth/unauthorized-domain</td>
                    <td className="px-3.5 py-2.5">Domain (e.g. <code>*.vercel.app</code>) is not allowlisted in Firebase Auth.</td>
                    <td className="px-3.5 py-2.5">Open Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains &rarr; add the exact domain.</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-mono text-red-700 font-semibold">PERMISSION_DENIED / Missing permissions</td>
                    <td className="px-3.5 py-2.5">Admin email mismatch, rules not deployed, disabled staff account, or expired IT escalation.</td>
                    <td className="px-3.5 py-2.5">Match <code>BOOTSTRAPPED_ADMIN_EMAIL</code> in <code>firestore.rules</code>, <code>src/lib/firebase.ts</code>, and <code>server.ts</code>; run <code>firebase deploy --only firestore:rules</code>; verify <code>staffUsers/&#123;uid&#125;.active == true</code>.</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-mono text-amber-800 font-semibold">503 GEMINI_API_KEY missing</td>
                    <td className="px-3.5 py-2.5">Gemini key missing or invalid in server environment.</td>
                    <td className="px-3.5 py-2.5">Create key at <code>aistudio.google.com/apikey</code>, add <code>GEMINI_API_KEY</code> to Vercel Env / <code>.env</code>, and redeploy/restart.</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-mono text-amber-800 font-semibold">535 SMTP auth failed / Waiting for SMTP_PASS</td>
                    <td className="px-3.5 py-2.5">Regular Gmail password used instead of App Password, M365 SMTP disabled, or branch key missing.</td>
                    <td className="px-3.5 py-2.5">Enable 2FA on Google and use a 16-char App Password; enable Authenticated SMTP in Microsoft 365; check exact key name (e.g. <code>SMTP_PASS_BRANCH_...</code>).</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-mono text-amber-800 font-semibold">404 NOT_FOUND on /admin refresh (Vercel)</td>
                    <td className="px-3.5 py-2.5">Vercel needs SPA rewrite rules for client routes.</td>
                    <td className="px-3.5 py-2.5">Keep <code>/vercel.json</code> at the repository root and redeploy.</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-mono text-amber-800 font-semibold">413 Payload Too Large (Vercel)</td>
                    <td className="px-3.5 py-2.5">Vercel caps serverless function bodies at 4.5 MB.</td>
                    <td className="px-3.5 py-2.5">Compress images/PDFs under 4 MB on Vercel, or host <code>server.ts</code> via Docker/VPS (supports 8–25 MB).</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-mono text-amber-800 font-semibold">Firestore Quota exceeded</td>
                    <td className="px-3.5 py-2.5">Daily Spark free-tier read/write quota reached.</td>
                    <td className="px-3.5 py-2.5">Wait for daily Pacific midnight reset or upgrade Firebase project to Blaze pay-as-you-go.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#334155]">
              <strong>Also Included in Repository Root:</strong> Share <code>HANDOVER_MANUAL.md</code>, <code>DEPLOYMENT.md</code>, <code>README.md</code>, and <code>.env.example</code> directly with your IT handover recipient.
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3">
          <span className="text-xs text-[#64748B]">
            Non-secret config saves to Firestore; private secrets stay strictly in <code>.env</code> / Vercel Env / Secrets.
          </span>
          <Button type="button" onClick={onClose}>
            <CheckCircle2 className="h-4 w-4" />
            <span>Close Manual</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
