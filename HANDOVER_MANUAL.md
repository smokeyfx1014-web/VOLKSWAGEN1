# Complete System Setup, API Acquisition & Handover Manual

This manual documents **everything required to set up, configure, deploy, operate, and troubleshoot** the Multi-Branch Volkswagen Dealership Platform—from scratch on **Vercel (`*.vercel.app`)**, **Docker**, or a **Linux VPS**—with zero dependency on the original developer's accounts.

> **Interactive In-App Version:** Sign into `/admin` as Group Administrator or IT Manager and click **Setup Manual & .env / APIs** (or open **Group & Branches → Open .env Builder & Handover Manual**) to generate your live `.env` / Vercel variable list and export a customized HTML/PDF handover pack.

---

## Table of Contents

1. [What You Need Before Starting (Checklist)](#1-what-you-need-before-starting-checklist)
2. [Step-by-Step: Acquiring Every API Key, Config & Password (With Examples)](#2-step-by-step-acquiring-every-api-key-config--password-with-examples)
3. [Complete Environment Variables Reference (`.env` & Vercel)](#3-complete-environment-variables-reference-env--vercel)
4. [Deploying & Testing on Vercel (`*.vercel.app`)](#4-deploying--testing-on-vercel-vercelapp)
5. [Alternative Hosting: Docker & Linux VPS (PM2 + Nginx)](#5-alternative-hosting-docker--linux-vps-pm2--nginx)
6. [First-Run Group & Multi-Branch Registration (`/admin`)](#6-first-run-group--multi-branch-registration-admin)
7. [8-Role Staff Hierarchy & IT Escalation Tickets](#7-8-role-staff-hierarchy--it-escalation-tickets)
8. [Error Troubleshooting & Future Maintenance Playbook](#8-error-troubleshooting--future-maintenance-playbook)

---

## 1. What You Need Before Starting (Checklist)

| Requirement | Purpose | Cost / Plan |
| :--- | :--- | :--- |
| **Node.js v22 LTS+** & **npm** | Builds the Vite React 19 SPA and runs `server.ts` natively | Free / Open Source |
| **Firebase Project** | Cloud Firestore database, Firebase Authentication (Google + Email/Password), and `firestore.rules` | Spark (Free Tier) works out of the box |
| **Google Gemini API Key** (`GEMINI_API_KEY`) | Powers AI Licence Disc OCR scanning on Service Booking & Parts Request forms | Free tier for testing / Pay-as-you-go for production |
| **Outgoing SMTP Mailbox** (`SMTP_PASS`) | Dispatches lead alerts, test emails, and candidate Career status updates via Nodemailer | Gmail (Free), Google Workspace, M365, or cPanel domain mail |
| **Decodo API Key** (`DECODO_API_KEY`) | *(Optional)* Automated live AutoTrader stock scraping | Optional (Manual stock & JSON/HTML paste are free) |
| **Hosting Platform** | Vercel (`*.vercel.app`), Docker host, Cloud Run, Railway, or Ubuntu VM | Vercel Hobby/Pro or VPS |

---

## 2. Step-by-Step: Acquiring Every API Key, Config & Password (With Examples)

### 2.1 Firebase Project, Firestore DB & `firebase-applet-config.json` (Required)

1. Open [Firebase Console](https://console.firebase.google.com/) signed in with the **new owner's Google account** and click **Add project**.
2. Go to **Build → Firestore Database → Create database**, select your region (e.g., `africa-south1` for South Africa or `europe-west1`), and start in **Production mode**.
3. Go to **Build → Authentication → Sign-in method** and enable:
   - **Google** (for Group Administrator SSO login)
   - **Email/Password** (for staff accounts: Branch Admin, IT Manager, IT Agent, Sales, Marketing, Parts, Service)
4. Go to **Authentication → Settings → Authorized domains** and add **every** domain where the app will run:
   - `localhost`
   - Your Vercel URL (e.g., `your-dealership.vercel.app`)
   - Every branch custom domain (e.g., `www.newcastlevw.co.za`, `www.ermelovw.co.za`)
5. Open **Project Settings → General → Your apps → Web (`</>`)**, register a Web App, and replace **`/firebase-applet-config.json`**.

**Example of what the acquired `firebase-applet-config.json` looks like:**

```json
{
  "projectId": "my-vw-group-prod",
  "appId": "1:973970975978:web:cd9841f21883f9c9c53b93",
  "apiKey": "AIzaSyDKCcn-ExampleFirebaseWebKey123456",
  "authDomain": "my-vw-group-prod.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "my-vw-group-prod.firebasestorage.app",
  "messagingSenderId": "973970975978",
  "measurementId": "",
  "oAuthClientId": "",
  "recaptchaSiteKey": ""
}
```

> *(Note: Unlike `GEMINI_API_KEY`, the Firebase Web `apiKey` in `firebase-applet-config.json` is an intended public client identifier protected by `firestore.rules` and Authorized Domains.)*

6. **Update the Bootstrapped Group Owner Email** (`BOOTSTRAPPED_ADMIN_EMAIL`) to the new owner's verified Google email in **all 3 files**:
   - `/firestore.rules` (`request.auth.token.email == 'owner@yourdomain.co.za'`)
   - `/src/lib/firebase.ts` (`export const BOOTSTRAPPED_ADMIN_EMAIL = 'owner@yourdomain.co.za';`)
   - `/server.ts` (`const BOOTSTRAPPED_ADMIN_EMAIL = 'owner@yourdomain.co.za';`)
7. **Lint & Deploy Security Rules:**
   ```bash
   npx eslint firestore.rules
   npm install -g firebase-tools
   firebase login
   firebase use YOUR_FIREBASE_PROJECT_ID
   firebase deploy --only firestore:rules
   ```
   *(Ensure `firebase.json` specifies `"database": "YOUR_DB_ID"` inside `"firestore"` if using a named Firestore database instead of `(default)`.)*

---

### 2.2 Google Gemini API Key — `GEMINI_API_KEY` (Required for Licence Disc Scanner)

Used exclusively on the server (`POST /api/extract-licence-disc`) to read South African eNaTIS licence discs (VIN, Engine Code, Licence Plate, Make/Model) regardless of image rotation.

1. Open [Google AI Studio API Keys](https://aistudio.google.com/apikey) signed into Google.
2. Click **Create API key**, choose or create a Google Cloud project, and copy the key.
3. Add it strictly to server `.env`, **Vercel → Settings → Environment Variables**, or **AI Studio → Settings → Secrets** as `GEMINI_API_KEY`.

**Example of what the acquired key looks like:**
```env
GEMINI_API_KEY="AIzaSyD4xK9pQ2wR7mN8vB3cF6hJ1lM0nP5tY"
```
*(Typically ~39 characters beginning with `AIzaSy`.)*

---

### 2.3 Outgoing Email (Nodemailer SMTP) — `SMTP_PASS` & `SMTP_PASS_BRANCH_*`

Choose the provider used by your dealership group or branch:

#### Option A: Gmail or Google Workspace (`smtp.gmail.com`, Port `465`)
1. Sign into the sending Google account (e.g. `web@yourbranch.co.za` or group Gmail).
2. Go to **Google Account → Security → 2-Step Verification** and turn it **ON** (App Passwords are hidden until 2FA is enabled).
3. In the Google Account search bar, search **App passwords**.
4. Enter a name like `VW Dealership Website` and click **Create**.
5. **What the acquired password looks like:** a 16-character code in 4 groups:
   `abcd efgh ijkl mnop` *(paste with or without spaces into `SMTP_PASS`)*.

#### Option B: Custom Dealership Domain / cPanel / Domains.co.za / Xneelo (`mail.yourdomain.co.za`, Port `465`)
1. Log into **cPanel** or **DirectAdmin** → **Email Accounts → Create**.
2. Create a dedicated sender mailbox such as `web@ladysmithvw.co.za` with a strong 16+ character password.
3. Click **Connect Devices / Manual Settings** to confirm the outgoing host (`mail.ladysmithvw.co.za`) and SSL/TLS port (`465`).
4. **What the acquired password looks like:** your chosen mailbox password (e.g., `VwL@dysmith!2026Mail`).

#### Option C: Microsoft 365 / Exchange Online (`smtp.office365.com`, Port `587`)
1. Open **Microsoft 365 Admin Center → Users → Active users** and select your sender mailbox (`web@yourbranch.co.za`).
2. Go to **Mail → Manage email apps** and enable **Authenticated SMTP**.
3. If Security Defaults / MFA applies, generate an **App Password** under the mailbox's Security Info page.

---

### 2.4 Decodo Web Data API — `DECODO_API_KEY` *(Optional)*

Only required if you want automated live scraping from AutoTrader (`POST /api/autotrader-scrape`). **Manual stock creation and Paste AutoTrader JSON / HTML work 100% without Decodo.**

1. Create an account at [Decodo](https://www.decodo.com/) and activate a **Web Scraping API** subscription.
2. Open **Dashboard → Scraping API → API Keys / Authentication** and generate your token or `username:password` credentials.
3. **What the acquired credential looks like:**
   - Either `Basic dXNlcm5hbWU6cGFzc3dvcmQ=` (Base64 Basic auth) or `Bearer decodo_live_...` or `username:password`.

---

## 3. Complete Environment Variables Reference (`.env` & Vercel)

| Variable | Required? | Secret? | Example Value | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `PORT` | Local/VPS | No | `3000` | Port Express listens on locally or in Docker |
| `APP_URL` | Recommended | No | `https://your-vw.vercel.app` | Canonical public URL of the website |
| `GEMINI_API_KEY` | For Disc Scan | **YES** | `AIzaSyD4xK...` | Licence Disc OCR extraction on Service & Parts forms |
| `DECODO_API_KEY` | Optional | **YES** | `Basic dXNl...` | Automated AutoTrader dealer scraping |
| `SMTP_HOST` | For Email | No | `smtp.gmail.com` | Group fallback outgoing mail hostname |
| `SMTP_PORT` | For Email | No | `465` | `465` (SSL/TLS) or `587` (STARTTLS) |
| `SMTP_USER` | For Email | No | `noreply@yourvw.co.za` | Group fallback sender email login |
| `SMTP_PASS` | For Email | **YES** | `abcd efgh ijkl mnop` | Group fallback mailbox password / App Password |
| `SMTP_FROM` | Recommended | No | `VW Group <noreply@yourvw.co.za>` | Display header shown in recipient inboxes |
| `DEFAULT_LEAD_NOTIFY_EMAIL` | Recommended | No | `leads@yourvw.co.za` | Final fallback inbox if branch department email is missing |
| `SMTP_PASS_BRANCH_<ID>` | Per-Branch Mail | **YES** | `BranchMailboxPass!99` | Dedicated secret for a branch's custom `SMTP_USER` (exact key name shown in `/admin`) |

---

## 4. Deploying & Testing on Vercel (`*.vercel.app`)

This repository includes `/vercel.json` and `/api/index.ts`, which compile the Vite SPA to `dist/` and run all Express `/api/*` routes through Vercel Serverless Functions.

1. Push the repository (with **your updated** `/firebase-applet-config.json` and `BOOTSTRAPPED_ADMIN_EMAIL`) to GitHub, GitLab, or Bitbucket.
2. Open [Vercel → New Project](https://vercel.com/new) and import your repository.
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Before or right after deploying, go to **Project → Settings → Environment Variables** and add every variable from Section 3 (`GEMINI_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `DEFAULT_LEAD_NOTIFY_EMAIL`, any `SMTP_PASS_BRANCH_*`, and optional `DECODO_API_KEY`).
4. Click **Deploy** and note your live URL (for example `https://newcastle-vw.vercel.app`).
5. **CRITICAL:** Open **Firebase Console → Authentication → Settings → Authorized domains** and add `newcastle-vw.vercel.app` (and any preview or custom domains).
6. Set `APP_URL` in Vercel Environment Variables to `https://newcastle-vw.vercel.app` and trigger a **Redeploy**.

### Important Notes When Testing on Vercel
- **Serverless Storage:** Vercel functions do not persist local disk across cold starts; uploaded logos (`uploads/`) and career applicant CVs (`private_uploads/`) write to `/tmp` temporarily. For permanent multi-GB file persistence in production, deploy via **Option A (Docker)** or **Option B (Linux VM + PM2 + Nginx)** in `DEPLOYMENT.md` (or wire Firebase Storage).
- **Upload Body Limit:** Vercel serverless functions cap request bodies at **4.5 MB**; keep uploaded test files under 4 MB when testing on Vercel (Docker/VPS supports up to 8 MB images, 10 MB PDFs, and 25 MB videos).

---

## 5. Alternative Hosting: Docker & Linux VPS (PM2 + Nginx)

See **`DEPLOYMENT.md`** for full step-by-step instructions covering:
- **Option A — Docker & Docker Compose** (with persistent `/app/uploads` volume and health checks)
- **Option B — Bare-Metal Linux VM (Ubuntu) + PM2 + Nginx Reverse Proxy + Certbot Let's Encrypt SSL** (supports serving multiple branch domains simultaneously from one instance)
- **Option C — Static Hosting (`dist/`)**

---

## 6. First-Run Group & Multi-Branch Registration (`/admin`)

1. Open `https://your-live-domain/admin` and click **Administrator Google Sign-In** using your `BOOTSTRAPPED_ADMIN_EMAIL` Google account.
2. Click **Seed / Reset Default Group Data** (for first-time setup) or go straight to **Group & Branches**.
3. Under **Dealership Group Corporate Profile**, update:
   - Group Name, Legal Entity, FSP Number, Compliance Officer & Email
   - `Default Lead Notification Email`, `Primary Website / Vercel Hosting URL (APP_URL)`
   - Group Fallback Outgoing Mail (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`) and API toggles (`GEMINI_API_KEY` Licence Disc Scanner, `DECODO_API_KEY` AutoTrader Sync)
   - Click **Save Group Profile**, then check **Setup Manual & .env / APIs** to confirm every key shows **Connected**.
4. Click **Add New Branch** to register each branch (`1..N`):
   - Branch ID/Slug, Name, Short Name, Booking Prefix (`LVW`), Production Domain, Legal Entity, FSP Number, Address, Trading Hours
   - **All 5 Department Notification Emails** (Sales, Service, Parts, Finance, General)
   - **Branch Outgoing Email Server (Nodemailer SMTP)**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` (e.g. `web@ladysmithvw.co.za`), `SMTP_FROM`, `DEFAULT_LEAD_NOTIFY_EMAIL`, and secret variable name (`SMTP_PASS_BRANCH_...`)
   - Optional **AutoTrader Dealer ID & URL**
   - Add the branch's domain to **Firebase Console → Authorized domains** and add its `SMTP_PASS_BRANCH_*` secret to `.env` / Vercel Env, then click **Send Branch Test Email**.

---

## 7. 8-Role Staff Hierarchy & IT Escalation Tickets

Create staff accounts under **Users & Roles → Add Staff User** (supports one-click WhatsApp/Email welcome onboarding and forced first-login password setup):

| Role ID | Label | Scope & Responsibilities |
| :--- | :--- | :--- |
| `admin` | **Group Administrator** | Full group-wide access: `/groupSettings/main`, all branches, staff roles (including Admin/IT Manager), permanent deletes, all leads/careers/inventory/IT tickets |
| `it_manager` | **IT Manager** | Group-wide technical setup, branch SMTP & AutoTrader management, non-admin staff CRUD, and IT Escalation ticket governance (Approve timed access / Resolve / Reject / Revoke) |
| `branch_admin` | **Branch Admin / Dealer Principal** | Full operational control for their allocated branch: all branch leads, manual stock, branch specials/events/competitions, branch career applications, read-only branch staff & IT tickets |
| `it_agent` | **Branch IT Agent** | Views branch overview & SMTP readiness and submits **IT Escalation Tickets** requesting timed elevated role access (automatically reverts on server when timer expires) |
| `agent` | **Car Sales Executive** | Branch manual vehicles, branch specials/events, and **Spotter Referral Leads** |
| `marketing` | **Marketing Coordinator** | Group-wide Motoring News, Specials, Events & Competitions |
| `parts` | **Parts Sales Executive** | Branch **Parts Leads** inbox and branch Parts specials |
| `service` | **Service Booking Clerk** | Branch **Service Leads** inbox and branch Service specials |

---

## 8. Error Troubleshooting & Future Maintenance Playbook

| Error Message / Symptom | Likely Cause | How to Fix |
| :--- | :--- | :--- |
| `Firebase: Error (auth/unauthorized-domain)` | The live `*.vercel.app` or custom branch domain is not registered in Firebase Auth | Firebase Console → **Authentication → Settings → Authorized domains** → Add the exact hostname (no `https://`). |
| `FirebaseError: Missing or insufficient permissions` / `PERMISSION_DENIED` | `BOOTSTRAPPED_ADMIN_EMAIL` mismatch, rules not deployed, inactive staff doc, or expired IT escalation | Confirm identical admin email in `firestore.rules`, `src/lib/firebase.ts`, and `server.ts`; run `firebase deploy --only firestore:rules`; check `/staffUsers/{uid}` has `active: true`. |
| `503: Automatic licence disc scanning is currently unavailable (GEMINI_API_KEY)` | `GEMINI_API_KEY` missing or invalid on server | Generate key at `aistudio.google.com/apikey`, add `GEMINI_API_KEY` in Vercel Env / `.env`, restart/redeploy. |
| `The licence disc AI scanner is temporarily busy (503 high demand)` | Temporary Gemini upstream load | Wait a few seconds and click **Re-Scan Disc**, or click **Rotate 90° & Re-Scan** if the disc photo is sideways. |
| `Waiting for SMTP_PASS` or `535-5.7.8 Username and Password not accepted` | Missing secret, 2FA disabled on Gmail, or M365 SMTP disabled | Enable 2-Step Verification on Google and create a 16-char **App Password**; in M365 enable **Authenticated SMTP**; confirm `SMTP_PASS` / `SMTP_PASS_BRANCH_*` matches `/admin`. |
| `404 NOT_FOUND` when refreshing `/admin` or `/vehicles` on Vercel | Missing SPA rewrite rules | Ensure `/vercel.json` exists in repo root and redeploy. |
| `413 Payload Too Large` on Vercel uploads | Vercel serverless limit is 4.5 MB | Upload images/PDFs under 4 MB on Vercel, or host `server.ts` via Docker/VPS. |
| `Quota exceeded for quota metric 'Free daily read units'` | Firebase Spark daily quota hit | Quota resets daily (midnight Pacific), or upgrade Firebase to Blaze pay-as-you-go. |
| `AutoTrader scrape failed` / `DECODO_API_KEY missing` | Decodo token missing/expired or AutoTrader blocked request | Add valid `DECODO_API_KEY`, or use **Paste AutoTrader JSON / HTML** or **Manual Vehicle Entry** in `/admin`. |
