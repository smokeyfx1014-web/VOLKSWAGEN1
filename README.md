<p align="center">
  <img src="public/assets/aistudio/vw-logo_3bdead53.png" alt="Dealership Emblem" width="76" />
</p>

<h1 align="center">Multi-Branch Automotive Dealership Platform</h1>

<p align="center">
  <strong>White-label multi-dealership showroom, MasterCars inventory, AI Licence Disc OCR, Careers &amp; 8-Role Staff RBAC CMS</strong><br />
  <sub>Supports 1, 2, 3, 4, or more Volkswagen branches under a single unified deployment (Vercel, Docker, or VPS)</sub>
</p>

![Dealership Showroom Hero](public/assets/aistudio/vwslider9_f252fed4.jpg)

---

## Overview & Core Capabilities

A single white-label codebase powers any Volkswagen dealership group—whether you run **1, 2, 3, 4, or more branches**—via dynamic hostname resolution (`src/context/DealershipContext.tsx`), Firestore corporate configuration (`/groupSettings/main`), or runtime `?branch=<id>` query overrides.

- **White-Label Group & Dynamic Branch Management**: Administrators configure their **Dealership Group Corporate Profile**, fallback SMTP & platform URLs, live `.env` / Vercel variable builder, and **add, edit, archive, restore, or safely delete dealership branches** inside `/admin` (`Group & Branches`).
- **Multi-Branch Runtime Resolution**: Automatically adapts dealership name, address, Google Maps embed, phone/WhatsApp links, trading hours, social links, SEO `<title>` / meta tags, and reference prefixes per active branch.
- **Master Group Inventory (`/vehicles`) & AI Licence Disc OCR**: Showcases New, Demo, MasterCars, and Used stock (including Hybrid & Electric filters), plus Gemini-powered Licence Disc scanning on Service & Parts forms to auto-fill VIN, Engine Code, and Registration Plate.
- **8-Role Staff Hierarchy & Timed IT Escalation Tickets (`/admin`)**:
  - **Group Administrator (`admin`)**: Full group-wide access across corporate settings, branches, staff roles, leads, careers, news, promotions, manual stock, and AutoTrader sync.
  - **IT Manager (`it_manager`)**: Group-wide branch/SMTP/AutoTrader setup, non-admin staff CRUD, and IT Escalation Ticket governance (approve timed access, resolve directly, reject, or revoke early).
  - **Branch Admin / Dealer Principal (`branch_admin`)**: Full branch-scoped operations (all branch leads, manual stock, branch campaigns, branch careers, read-only branch staff & tickets).
  - **Branch IT Agent (`it_agent`)**: Views branch readiness & submits timed role-escalation tickets reviewed by the IT Manager.
  - **Car Sales Executive (`agent`)**: Branch manual vehicles, branch `special`/`event` campaigns, and **Spotter Referral Leads**.
  - **Marketing Coordinator (`marketing`)**: Group-wide **Motoring News** and **Promotions** (`special`, `event`, `competition`).
  - **Parts Sales Executive (`parts`)**: Branch-scoped **Parts Leads** inbox and branch Parts specials.
  - **Service Booking Clerk (`service`)**: Branch-scoped **Service Leads** inbox and branch Service specials.
- **In-App & Printable Handover Manual**: Built-in `.env` / Vercel Environment Variable builder, API & App Password acquisition guide with examples, and troubleshooting guide inside `/admin` (plus [`HANDOVER_MANUAL.md`](./HANDOVER_MANUAL.md)).
- **Automatic Customer & Careers Emails (Nodemailer SMTP)**: Customer requests route automatically to branch department emails, and Careers status updates send from `careers@<location>volkswagen.co.za`.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons
- **Server / API**: Node.js 22+, Express 4 (`server.ts`, runs natively on Node 22 or via `tsx` in dev)
- **Database & Auth**: Google Firebase (Cloud Firestore + Firebase Authentication + `firestore.rules`)
- **Containers / Self-Hosting**: Included `/Dockerfile`, `/.dockerignore`, and full [`/DEPLOYMENT.md`](./DEPLOYMENT.md) data-center manual

---

## Quick Start: Handover, Vercel & Self-Hosting

> **Handover & Complete Setup Pack:** Read **[`HANDOVER_MANUAL.md`](./HANDOVER_MANUAL.md)** for step-by-step API & password acquisition (with examples), **Vercel (`*.vercel.app`) deployment**, and future error fixes. Read **[`DEPLOYMENT.md`](./DEPLOYMENT.md)** for Docker and Linux VM (PM2 + Nginx + SSL) infrastructure setup.

If you fork, clone, or hand over this repository for a new dealership group, **replace the original owner's Firebase project, administrator email, API keys, and branding** so the application runs 100% under the new owner's accounts.

### What You Will Need

1. **Node.js v22+** and **npm** *(Node 22+ is required for `node server.ts` in production; or use the included `Dockerfile`)*.
2. **Your own Google / Firebase account** *(free Spark plan works out of the box—no Blaze billing or private service-account keys needed)*.
3. **Firebase CLI** (`npm install -g firebase-tools`) to deploy `firestore.rules`.
4. *(Optional)* **Your own Decodo Web Data API key** if using automated live AutoTrader scraping (`POST /api/autotrader-scrape`). Even without it, staff can add vehicles manually or paste AutoTrader JSON/HTML inside `/admin`.

---

### Step 1: Clone & Install Dependencies

```bash
git clone <your-fork-url> dealership-platform
cd dealership-platform
npm install
```

### Step 2: Plug In Your Own Firebase Project

1. Open [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. Go to **Build → Firestore Database → Create database**, select your region, and start in **Production mode**.
3. Go to **Build → Authentication → Sign-in method** and enable **Google** and **Email/Password**. Under **Authentication → Settings → Authorized domains**, add `localhost` plus all your production domains.
4. Register a **Web App (`</>`)** in **Project Settings** and replace **`/firebase-applet-config.json`**:

```json
{
  "projectId": "YOUR_FIREBASE_PROJECT_ID",
  "appId": "YOUR_FIREBASE_WEB_APP_ID",
  "apiKey": "YOUR_FIREBASE_WEB_API_KEY",
  "authDomain": "YOUR_FIREBASE_PROJECT_ID.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "YOUR_FIREBASE_PROJECT_ID.firebasestorage.app",
  "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
  "measurementId": "",
  "oAuthClientId": "",
  "recaptchaSiteKey": ""
}
```

### Step 3: Replace the Bootstrapped Owner Administrator Email

Replace `smokeydhlamini@gmail.com` with your own verified Google Administrator email in **all three files**:

| File | Symbol / Line to Replace | Change To |
| :--- | :--- | :--- |
| `/firestore.rules` | `request.auth.token.email == 'smokeydhlamini@gmail.com'` | `'your-admin@yourdomain.com'` |
| `/src/lib/firebase.ts` | `export const BOOTSTRAPPED_ADMIN_EMAIL = 'smokeydhlamini@gmail.com';` | `'your-admin@yourdomain.com'` |
| `/server.ts` | `const BOOTSTRAPPED_ADMIN_EMAIL = 'smokeydhlamini@gmail.com';` | `'your-admin@yourdomain.com'` |

### Step 4: Validate & Deploy Firestore Security Rules

```bash
npx eslint firestore.rules
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules
```

*(Ensure `firebase.json` includes `"firestore": { "rules": "firestore.rules" }`, and specify `"database": "YOUR_DB_ID"` if using a named Firestore database instead of `(default)`.)*

### Step 5: Configure `.env`

```bash
cp .env.example .env
```

| Variable | Required? | Purpose | Example |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | Port for Express (`server.ts`) | `3000` |
| `APP_URL` | Recommended | Public URL of your site | `https://your-vw.vercel.app` |
| `GEMINI_API_KEY` | For Disc Scan | Google Gemini key (`aistudio.google.com/apikey`) for Service/Parts Licence Disc OCR | `AIzaSyD4xK...` (never prefix with `VITE_`) |
| `DECODO_API_KEY` | Optional | Decodo Web Data API key for `/api/autotrader-scrape` | Leave blank if unused; never prefix with `VITE_` |
| `SMTP_HOST` | Optional | Outgoing mail server host (defaults to `smtp.gmail.com`) | `smtp.gmail.com` or `smtp.office365.com` |
| `SMTP_PORT` | Optional | Outgoing SMTP port (`465` SSL/TLS or `587` STARTTLS) | `465` |
| `SMTP_USER` | Recommended | SMTP login email (defaults to `BOOTSTRAPPED_ADMIN_EMAIL` if omitted) | `noreply@yourdealership.co.za` |
| `SMTP_PASS` | Required for Email Alerts | Server-only SMTP password or 16-char Gmail App Password (never prefix with `VITE_`). Each branch can also define its own secret key (e.g. `SMTP_PASS_BRANCH_LADYSMITH`). | Store in `.env`, Vercel Env, or AI Studio **Secrets** |
| `SMTP_FROM` | Optional | Friendly From header (defaults to `Dealership Requests <SMTP_USER>`) | `Your VW Group <noreply@yourdealership.co.za>` |
| `DEFAULT_LEAD_NOTIFY_EMAIL` | Optional | Emergency fallback recipient if branch/group emails are empty | `leads@yourdealership.co.za` |

> Staff welcome onboarding still requires zero email credentials (using one-click **WhatsApp**, **Email App**, or **Copy**). Every branch configures its own outgoing identity (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `DEFAULT_LEAD_NOTIFY_EMAIL`), and `/admin` provides both a **Dealer Principal Email Setup Guide** and the complete **System Setup & Handover Manual** (`.html` / `.md` / `.env.template`).

### Step 6: Update Static Fallbacks & Run Locally

1. Update `<title>`, `<meta>`, and favicon in `/index.html` and app name/description in `/metadata.json`.
2. Replace brand images in `/public/assets/aistudio/` as needed, and optionally update baseline defaults in `/src/data/dealership.ts` (`DEFAULT_GROUP_PROFILE` and `DEFAULT_DEALERSHIPS`).
3. Start the dev server:

```bash
npm run dev
```

4. Visit `http://localhost:3000/admin`, sign in with your bootstrapped Google Administrator email, and use **Group & Branches** to customize your **Dealership Group Corporate Profile** and add, edit, archive, or remove branches (`1..4+`), then add your team under **Users & Roles**.

### Step 7: Production Build & Data-Center Deployment

```bash
npm run lint
npm run build
```

For complete instructions on deploying via **Docker / Docker Compose**, **Linux VM + PM2 + Nginx Reverse Proxy & Let's Encrypt SSL**, or **Static Hosting (`dist/`)**, see **[`DEPLOYMENT.md`](./DEPLOYMENT.md)**.

---

### Pre-Launch Isolation Checklist

- [ ] Replaced `/firebase-applet-config.json` with **your own** Firebase project credentials and database ID.
- [ ] Replaced `smokeydhlamini@gmail.com` in `/firestore.rules`, `/src/lib/firebase.ts`, and `/server.ts`.
- [ ] Validated (`npx eslint firestore.rules`) and deployed `/firestore.rules` to **your** Firebase project.
- [ ] Enabled **Google** + **Email/Password** authentication and registered your live domains in Firebase Console.
- [ ] Created your own `.env` (no original owner keys, passwords, or secrets).
- [ ] Configured `SMTP_USER` / `SMTP_PASS` in `.env` (or AI Studio Secrets) and verified **Send Test Email** in `/admin` → **Group & Branches**.
- [ ] Configured your Group Corporate Profile (including `Default Lead Notification Email`), branches (including all 5 required department routing emails), and staff accounts inside `/admin` (`Group & Branches` and `Users & Roles`).
