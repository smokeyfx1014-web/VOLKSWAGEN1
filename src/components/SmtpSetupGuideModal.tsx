import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Lock,
  Mail,
  Server,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button, Dialog } from './ui/shadcn';

type ProviderId = 'domain' | 'google' | 'microsoft';

export interface SmtpPresetSelection {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpFrom: string;
}

interface SmtpSetupGuideModalProps {
  open: boolean;
  onClose: () => void;
  branchName?: string;
  branchDomain?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpFrom?: string;
  defaultNotifyEmail?: string;
  smtpPassEnvKey?: string;
  onApplyPreset?: (preset: SmtpPresetSelection) => void;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractCleanDomain(rawDomain?: string): string {
  const cleaned = (rawDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '');
  return cleaned || 'ladysmithvolkswagen.co.za';
}

export function SmtpSetupGuideModal({
  open,
  onClose,
  branchName,
  branchDomain,
  smtpHost,
  smtpPort,
  smtpUser,
  smtpFrom,
  defaultNotifyEmail,
  smtpPassEnvKey,
  onApplyPreset,
}: SmtpSetupGuideModalProps) {
  const [provider, setProvider] = useState<ProviderId>('domain');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const safeBranchName = branchName?.trim() || 'Ladysmith Volkswagen';
  const cleanDomain = extractCleanDomain(branchDomain);
  const exampleUser = smtpUser?.trim() || `web@${cleanDomain}`;
  const exampleHost =
    smtpHost?.trim() ||
    (provider === 'google'
      ? 'smtp.gmail.com'
      : provider === 'microsoft'
      ? 'smtp.office365.com'
      : `mail.${cleanDomain}`);
  const examplePort = smtpPort || (provider === 'microsoft' ? 587 : 465);
  const exampleFrom = smtpFrom?.trim() || `${safeBranchName} <${exampleUser}>`;
  const exampleDefaultNotify = defaultNotifyEmail?.trim() || `leads@${cleanDomain}`;
  const passEnvVar = smtpPassEnvKey?.trim() || 'SMTP_PASS_BRANCH_LADYSMITH';

  const envSnippet = useMemo(
    () =>
      [
        `# Outgoing Mail Config for ${safeBranchName}`,
        `# Save non-secret settings in Admin -> Group & Branches, and keep ${passEnvVar} strictly in Server Secrets / .env:`,
        `SMTP_HOST="${exampleHost}"`,
        `SMTP_PORT="${examplePort}"`,
        `SMTP_USER="${exampleUser}"`,
        `${passEnvVar}="PASTE_MAILBOX_OR_APP_PASSWORD_HERE"`,
        `SMTP_FROM="${exampleFrom}"`,
        `DEFAULT_LEAD_NOTIFY_EMAIL="${exampleDefaultNotify}"`,
      ].join('\n'),
    [
      safeBranchName,
      exampleHost,
      examplePort,
      exampleUser,
      passEnvVar,
      exampleFrom,
      exampleDefaultNotify,
    ]
  );

  const copyToClipboard = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const buildMarkdownGuide = (): string => {
    return `# Dealership Email Setup Guide (Nodemailer SMTP)
Branch: ${safeBranchName}
Website Domain: ${cleanDomain}

---

## 1. Purpose of Each Email Field

1. **SMTP_HOST** — Outgoing mail server address (where your dealership emails are hosted).
   - Custom Domain / cPanel (Domains.co.za, Xneelo, Afrihost): \`mail.${cleanDomain}\`
   - Google Workspace / Gmail: \`smtp.gmail.com\`
   - Microsoft 365 (Exchange Online): \`smtp.office365.com\`
   - *Current value for this branch:* \`${exampleHost}\`

2. **SMTP_PORT** — Secure outgoing mail port.
   - \`465\` = SSL/TLS encrypted (recommended for Gmail & cPanel / DirectAdmin).
   - \`587\` = STARTTLS encrypted (recommended for Microsoft 365).
   - *Current value for this branch:* \`${examplePort}\`

3. **SMTP_USER** — Dedicated branch sending mailbox username.
   - Recommendation: Ask IT to create a dedicated no-reply/web sender mailbox such as \`web@${cleanDomain}\` so outgoing leads pass SPF/DMARC checks and never lock if a staff member leaves.
   - *Current value for this branch:* \`${exampleUser}\`

4. **SMTP_PASS (${passEnvVar})** — Server-only mailbox password or App Password.
   - **Security Rule:** NEVER put this password in public website settings or share it in chat. Add it inside **Settings -> Secrets** (AI Studio) or your server's \`.env\` file under \`${passEnvVar}\` (or \`SMTP_PASS\` for a single-branch server).

5. **SMTP_FROM** — Display name and email address shown in the agent's inbox.
   - Format: \`Dealership Name <mailbox@domain.co.za>\`
   - *Current value for this branch:* \`${exampleFrom}\`

6. **DEFAULT_LEAD_NOTIFY_EMAIL** — Branch fallback receiver inbox.
   - Used if a specific department email (Sales, Service, Parts, Finance, General) is ever unavailable.
   - *Current value for this branch:* \`${exampleDefaultNotify}\`

---

## 2. Step-by-Step Setup by Email Provider

### Option A: Dealership Domain / cPanel / Xneelo / Domains.co.za (Recommended for \`web@${cleanDomain}\`)
1. Log into your hosting control panel (**cPanel** or **DirectAdmin**) for \`${cleanDomain}\`.
2. Go to **Email Accounts -> Create**.
3. Create mailbox: \`web@${cleanDomain}\` with a strong 16+ character password.
4. Click **Connect Devices / Mail Client Manual Settings** to confirm the **Outgoing SMTP Host** (usually \`mail.${cleanDomain}\`) and **Port 465 (SSL/TLS)**.
5. Enter \`SMTP_HOST\`, \`SMTP_PORT\`, \`SMTP_USER\`, \`SMTP_FROM\`, and \`DEFAULT_LEAD_NOTIFY_EMAIL\` in the Dealership Admin Portal.
6. Add \`${passEnvVar}\` with that mailbox password inside your server's \`.env\` or **Settings -> Secrets**.

### Option B: Google Workspace or Gmail (\`smtp.gmail.com\`)
1. Sign into the Google account you want to send from (e.g. \`${exampleUser}\`).
2. Go to **Google Account -> Security -> 2-Step Verification** and turn it **ON** (App Passwords will not appear until 2-Step Verification is active).
3. In the Google Account search bar, search **App Passwords**.
4. Create an app name like \`VW Website Nodemailer\` and click **Create**.
5. Google shows a **16-character yellow password** (e.g. \`abcd efgh ijkl mnop\`). Copy it without spaces.
6. Set \`SMTP_HOST=smtp.gmail.com\`, \`SMTP_PORT=465\`, and paste the 16-character code into server secret \`${passEnvVar}\`.

### Option C: Microsoft 365 / Exchange Online (\`smtp.office365.com\`)
1. Ask your Microsoft 365 IT administrator to open **Microsoft 365 Admin Center -> Users -> Active users**.
2. Select \`web@${cleanDomain}\` (recommended shared/service mailbox with Exchange license).
3. Open **Mail -> Manage email apps** and ensure **Authenticated SMTP** is ticked (**Enabled**).
4. If Security Defaults / MFA blocks basic SMTP auth, generate a Microsoft App Password or allow Authenticated SMTP for that dedicated sender mailbox.
5. Set \`SMTP_HOST=smtp.office365.com\`, \`SMTP_PORT=587\`, and save the password in \`${passEnvVar}\`.

---

## 3. Server Environment Snippet (\`.env\`)

\`\`\`env
${envSnippet}
\`\`\`

---

## 4. Final Verification
1. Save the branch inside **Admin Portal -> Group & Branches**.
2. Restart/reload your hosting environment if you just added \`${passEnvVar}\` to \`.env\` or Secrets.
3. Click **Refresh Status** and then **Send Branch Test Email** inside **Group & Branches** to confirm live delivery.
`;
  };

  const downloadGuideFile = (format: 'html' | 'md') => {
    const fileSlug = safeBranchName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'dealership-branch';

    if (format === 'md') {
      const blob = new Blob([buildMarkdownGuide()], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SMTP-Email-Setup-Guide-${fileSlug}.md`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtmlText(safeBranchName)} — Dealer Principal Email Setup Guide</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 860px; margin: 32px auto; padding: 0 24px; }
    .header { background: #001E50; color: #fff; padding: 28px 32px; border-radius: 14px; margin-bottom: 24px; }
    .header p { margin: 0 0 6px; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.85; }
    .header h1 { margin: 0; font-size: 24px; }
    h2 { color: #001E50; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 28px; }
    h3 { color: #00437A; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; color: #091224; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    code { padding: 2px 6px; font-size: 13px; }
    pre { padding: 14px 16px; overflow-x: auto; font-size: 13px; }
    .note { background: #eff6ff; border-left: 4px solid #00437A; padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-size: 14px; }
    .print-tip { font-size: 12px; color: #64748b; margin-top: 8px; }
    @media print { .no-print { display: none; } body { margin: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <p>Volkswagen Dealership Group · Dealer Principal &amp; IT Setup Manual</p>
    <h1>Outgoing Email (Nodemailer SMTP) Setup Guide</h1>
    <p style="margin-top: 10px; opacity: 0.95; text-transform: none; letter-spacing: 0;">Branch: <strong>${escapeHtmlText(safeBranchName)}</strong> &nbsp;|&nbsp; Domain: <strong>${escapeHtmlText(cleanDomain)}</strong></p>
  </div>

  <p class="no-print print-tip">Tip: Press <strong>Ctrl+P</strong> (Windows) or <strong>Cmd+P</strong> (Mac) and choose <strong>Save as PDF</strong> to share this guide as a PDF.</p>

  <div class="note">
    <strong>Why set up a dedicated branch mailbox?</strong> When a customer submits a Test Drive, Service Booking, Parts Enquiry, or Finance Application, your server emails the branch agent directly from <code>${escapeHtmlText(exampleFrom)}</code> so every notification looks official and passes spam/DMARC filters.
  </div>

  <h2>1. What Each Setting Means (With Examples)</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Variable</th>
        <th style="width: 44%;">What It Is &amp; Recommendation</th>
        <th style="width: 32%;">Recommended Example</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>SMTP_HOST</code></td>
        <td>Your branch's outgoing mail server hostname. Ask your hosting/IT provider or pick Gmail/M365 below.</td>
        <td><code>${escapeHtmlText(exampleHost)}</code><br/><small>(Gmail: <code>smtp.gmail.com</code> · M365: <code>smtp.office365.com</code>)</small></td>
      </tr>
      <tr>
        <td><code>SMTP_PORT</code></td>
        <td>Encrypted mail port. Use <strong>465</strong> for SSL/TLS (cPanel / Gmail) or <strong>587</strong> for STARTTLS (Microsoft 365).</td>
        <td><code>${examplePort}</code></td>
      </tr>
      <tr>
        <td><code>SMTP_USER</code></td>
        <td>Dedicated sender email login. Create a mailbox like <code>web@${escapeHtmlText(cleanDomain)}</code> rather than a personal staff address.</td>
        <td><code>${escapeHtmlText(exampleUser)}</code></td>
      </tr>
      <tr>
        <td><code>SMTP_PASS</code><br/><small>(<code>${escapeHtmlText(passEnvVar)}</code>)</small></td>
        <td><strong>Secret Password:</strong> Mailbox password (cPanel/M365) or 16-character App Password (Gmail). Stored strictly in server Secrets / <code>.env</code>—never in the public database.</td>
        <td>Save inside AI Studio <strong>Settings &rarr; Secrets</strong> or your server <code>.env</code> file.</td>
      </tr>
      <tr>
        <td><code>SMTP_FROM</code></td>
        <td>Sender display name &amp; email shown in the dealership agent's inbox.</td>
        <td><code>${escapeHtmlText(exampleFrom)}</code></td>
      </tr>
      <tr>
        <td><code>DEFAULT_LEAD_NOTIFY_EMAIL</code></td>
        <td>Branch fallback inbox that receives leads if a department address is missing or unassigned.</td>
        <td><code>${escapeHtmlText(exampleDefaultNotify)}</code></td>
      </tr>
    </tbody>
  </table>

  <h2>2. Step-by-Step Instructions by Email Provider</h2>

  <h3>Option A — Your Dealership Domain / cPanel / Domains.co.za / Xneelo (Recommended)</h3>
  <ol>
    <li>Ask your website/hosting administrator to log into <strong>cPanel</strong> or <strong>DirectAdmin</strong> for <code>${escapeHtmlText(cleanDomain)}</code>.</li>
    <li>Open <strong>Email Accounts &rarr; Create</strong> and create <code>web@${escapeHtmlText(cleanDomain)}</code> with a strong password.</li>
    <li>Open <strong>Connect Devices / Mail Client Manual Settings</strong> for that mailbox and note the <strong>Outgoing SMTP Server</strong> (usually <code>mail.${escapeHtmlText(cleanDomain)}</code>) and <strong>Port 465 (SSL/TLS)</strong>.</li>
    <li>Enter Host, Port, User, From, and Default Lead Email in the Admin Portal Branch form.</li>
    <li>Give your server administrator the secret key name <code>${escapeHtmlText(passEnvVar)}</code> and mailbox password to place in server Secrets / <code>.env</code>.</li>
  </ol>

  <h3>Option B — Google Workspace / Gmail (<code>smtp.gmail.com</code>)</h3>
  <ol>
    <li>Sign into the Google account used for outgoing website notifications.</li>
    <li>Open <strong>Google Account &rarr; Security &rarr; 2-Step Verification</strong> and switch it <strong>ON</strong>.</li>
    <li>Search <strong>App Passwords</strong> in your Google Account settings.</li>
    <li>Enter a label (e.g. <em>${escapeHtmlText(safeBranchName)} Website</em>) and click <strong>Create</strong>.</li>
    <li>Copy the <strong>16-character App Password</strong> (without spaces) into server secret <code>${escapeHtmlText(passEnvVar)}</code>, using host <code>smtp.gmail.com</code> and port <code>465</code>.</li>
  </ol>

  <h3>Option C — Microsoft 365 / Exchange Online (<code>smtp.office365.com</code>)</h3>
  <ol>
    <li>In <strong>Microsoft 365 Admin Center</strong>, open <strong>Users &rarr; Active users</strong> and create or select <code>web@${escapeHtmlText(cleanDomain)}</code>.</li>
    <li>Go to <strong>Mail &rarr; Manage email apps</strong> and enable <strong>Authenticated SMTP</strong>.</li>
    <li>Use host <code>smtp.office365.com</code>, port <code>587</code>, and store the mailbox password (or App Password if MFA applies) in <code>${escapeHtmlText(passEnvVar)}</code>.</li>
  </ol>

  <h2>3. Ready-to-Use Server Environment Block</h2>
  <pre>${escapeHtmlText(envSnippet)}</pre>

  <h2>4. Verify Live Delivery</h2>
  <ol>
    <li>Save the branch in <strong>Admin Portal &rarr; Group &amp; Branches</strong>.</li>
    <li>Ensure <code>${escapeHtmlText(passEnvVar)}</code> is saved in AI Studio <strong>Settings &rarr; Secrets</strong> or your server <code>.env</code> file.</li>
    <li>Click <strong>Refresh Status</strong> and <strong>Send Branch Test Email</strong> inside <strong>Group &amp; Branches</strong>.</li>
  </ol>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dealer-Principal-Email-Setup-Guide-${fileSlug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Branch Email (Nodemailer SMTP) Setup Guide"
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-5 text-sm text-[#334155]">
        {/* Top summary + Download buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#001E50]">
              <BookOpen className="h-4 w-4" />
              <span>Dealer Principal &amp; IT Quick-Start Manual</span>
            </div>
            <p className="text-xs text-[#1E3A8A]">
              Preparing email settings for <strong>{safeBranchName}</strong> (<code>{cleanDomain}</code>). Download this guide to share with your Dealer Principal or IT provider.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => downloadGuideFile('html')}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Guide (HTML / Print PDF)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadGuideFile('md')}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Download IT Guide (.md)</span>
            </Button>
          </div>
        </div>

        {/* Provider Tabs */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
            Step 1 — Choose Your Branch Email Provider
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'domain' as const, label: 'Dealership Domain / cPanel (Recommended)' },
              { id: 'google' as const, label: 'Google Workspace / Gmail' },
              { id: 'microsoft' as const, label: 'Microsoft 365 / Exchange' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setProvider(tab.id)}
                className={cn(
                  'rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer',
                  provider === tab.id
                    ? 'bg-[#001E50] text-white'
                    : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:border-[#001E50]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
            {provider === 'domain' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display text-sm font-semibold text-[#091224]">
                    Custom Dealership Domain (cPanel / Xneelo / Domains.co.za / DirectAdmin)
                  </h4>
                  {onApplyPreset && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onApplyPreset({
                          smtpHost: `mail.${cleanDomain}`,
                          smtpPort: 465,
                          smtpUser: `web@${cleanDomain}`,
                          smtpFrom: `${safeBranchName} <web@${cleanDomain}>`,
                        })
                      }
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span>Apply Domain Preset</span>
                    </Button>
                  )}
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#334155]">
                  <li>Log into your domain&apos;s hosting panel (e.g. <strong>cPanel</strong> or <strong>Domains.co.za</strong>) and open <strong>Email Accounts &rarr; Create</strong>.</li>
                  <li>Create a dedicated sender mailbox such as <code>web@{cleanDomain}</code> with a strong 16+ character password.</li>
                  <li>Click <strong>Connect Devices / Manual Settings</strong> to confirm the outgoing server: typically <code>mail.{cleanDomain}</code> on Port <code>465</code> (SSL/TLS) or <code>587</code> (STARTTLS).</li>
                  <li>Store the mailbox password on the server under secret variable <code>{passEnvVar}</code>.</li>
                </ol>
              </>
            )}

            {provider === 'google' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display text-sm font-semibold text-[#091224]">
                    Google Workspace or Gmail (<code>smtp.gmail.com</code> · Port 465)
                  </h4>
                  {onApplyPreset && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onApplyPreset({
                          smtpHost: 'smtp.gmail.com',
                          smtpPort: 465,
                          smtpUser: smtpUser?.trim() || `web@${cleanDomain}`,
                          smtpFrom: `${safeBranchName} <${smtpUser?.trim() || `web@${cleanDomain}`}>`,
                        })
                      }
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span>Apply Gmail / Workspace Preset</span>
                    </Button>
                  )}
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#334155]">
                  <li>Sign into the Google mailbox you want to send from (e.g. <code>web@{cleanDomain}</code> or your group Gmail).</li>
                  <li>Open <strong>Google Account &rarr; Security &rarr; 2-Step Verification</strong> and enable it (App Passwords are hidden until 2-Step Verification is ON).</li>
                  <li>Search <strong>App Passwords</strong> in your Google Account settings, create one named <em>{safeBranchName} Website</em>, and copy the <strong>16-character password</strong> (no spaces).</li>
                  <li>Set <code>SMTP_HOST</code> to <code>smtp.gmail.com</code>, <code>SMTP_PORT</code> to <code>465</code>, and save the 16-character code in server secret <code>{passEnvVar}</code>.</li>
                </ol>
              </>
            )}

            {provider === 'microsoft' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display text-sm font-semibold text-[#091224]">
                    Microsoft 365 / Exchange Online (<code>smtp.office365.com</code> · Port 587)
                  </h4>
                  {onApplyPreset && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onApplyPreset({
                          smtpHost: 'smtp.office365.com',
                          smtpPort: 587,
                          smtpUser: `web@${cleanDomain}`,
                          smtpFrom: `${safeBranchName} <web@${cleanDomain}>`,
                        })
                      }
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span>Apply Microsoft 365 Preset</span>
                    </Button>
                  )}
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#334155]">
                  <li>Ask your Microsoft 365 IT admin to open <strong>Microsoft 365 Admin Center &rarr; Users &rarr; Active users</strong> and select <code>web@{cleanDomain}</code>.</li>
                  <li>Under <strong>Mail &rarr; Manage email apps</strong>, ensure <strong>Authenticated SMTP</strong> is checked (enabled).</li>
                  <li>If MFA blocks standard passwords, create an App Password for that dedicated sender mailbox.</li>
                  <li>Set <code>SMTP_HOST</code> to <code>smtp.office365.com</code>, <code>SMTP_PORT</code> to <code>587</code>, and store its password in server secret <code>{passEnvVar}</code>.</li>
                </ol>
              </>
            )}
          </div>
        </div>

        {/* Field-by-field breakdown */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
            Step 2 — What Every Environment Variable Does (Examples &amp; Recommendations)
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#091224] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold">Variable</th>
                  <th className="px-3.5 py-2.5 font-semibold">Plain-English Meaning &amp; Recommendation</th>
                  <th className="px-3.5 py-2.5 font-semibold">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] bg-white">
                <tr>
                  <td className="px-3.5 py-2.5 font-mono font-semibold text-[#001E50]">SMTP_HOST</td>
                  <td className="px-3.5 py-2.5">Address of your branch&apos;s outgoing mail server.</td>
                  <td className="px-3.5 py-2.5 font-mono">mail.{cleanDomain}</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono font-semibold text-[#001E50]">SMTP_PORT</td>
                  <td className="px-3.5 py-2.5">Encrypted mail port: <strong>465</strong> (SSL/TLS) or <strong>587</strong> (STARTTLS).</td>
                  <td className="px-3.5 py-2.5 font-mono">465</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono font-semibold text-[#001E50]">SMTP_USER</td>
                  <td className="px-3.5 py-2.5">Dedicated branch sender login (avoid personal staff emails).</td>
                  <td className="px-3.5 py-2.5 font-mono">web@{cleanDomain}</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono font-semibold text-[#001E50]">SMTP_PASS</td>
                  <td className="px-3.5 py-2.5">
                    Mailbox / App Password kept securely in Server Secrets or <code>.env</code> as <code>{passEnvVar}</code> (never saved in public Firestore).
                  </td>
                  <td className="px-3.5 py-2.5 font-mono">{passEnvVar}</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono font-semibold text-[#001E50]">SMTP_FROM</td>
                  <td className="px-3.5 py-2.5">Friendly dealership name + email shown to your sales/service agents.</td>
                  <td className="px-3.5 py-2.5 font-mono">{safeBranchName} &lt;web@{cleanDomain}&gt;</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono font-semibold text-[#001E50]">DEFAULT_LEAD_NOTIFY_EMAIL</td>
                  <td className="px-3.5 py-2.5">Branch fallback receiver inbox if a department email is missing.</td>
                  <td className="px-3.5 py-2.5 font-mono">leads@{cleanDomain}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Security & Secret Snippet */}
        <div className="rounded-xl border border-[#E2E8F0] bg-[#091224] p-4 text-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              <span>Server Secret Snippet for {safeBranchName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copyToClipboard('secret-key', passEnvVar)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20 cursor-pointer"
              >
                {copiedKey === 'secret-key' ? (
                  <Check className="h-3 w-3 text-emerald-300" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
                <span>
                  {copiedKey === 'secret-key' ? 'Copied Key Name!' : `Copy ${passEnvVar}`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void copyToClipboard('env-block', envSnippet)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-[#001E50] hover:bg-slate-100 cursor-pointer"
              >
                {copiedKey === 'env-block' ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>{copiedKey === 'env-block' ? 'Copied .env Block!' : 'Copy Full .env Block'}</span>
              </button>
            </div>
          </div>

          <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-slate-200 font-mono">
            {envSnippet}
          </pre>

          <p className="text-[11px] text-slate-300 flex items-start gap-2">
            <Server className="h-3.5 w-3.5 mt-0.5 shrink-0 text-sky-300" />
            <span>
              In AI Studio, open <strong>Settings &rarr; Secrets</strong> and add <strong>{passEnvVar}</strong>. When self-hosting on Docker, PM2, or a data-center VM, paste this block into your server&apos;s <code>.env</code> file. After saving, click <strong>Send Branch Test Email</strong> in <strong>Group &amp; Branches</strong>.
            </span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3">
          <div className="flex items-center gap-2 text-xs text-[#475569]">
            <Mail className="h-4 w-4 text-[#001E50]" />
            <span>Multi-branch ready: each branch sends under its own identity.</span>
          </div>
          <Button type="button" onClick={onClose}>
            <CheckCircle2 className="h-4 w-4" />
            <span>Done</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
