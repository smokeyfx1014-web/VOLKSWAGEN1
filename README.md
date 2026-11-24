<p align="center">
  <img src="public/assets/aistudio/vw-logo_3bdead53.png" alt="Dealership Emblem" width="76" />
</p>

<h1 align="center">Multi-Branch Automotive Dealership Platform</h1>

<p align="center">
  <strong>White-label multi-dealership showroom, MasterCars inventory, Finance, Aftersales &amp; 5-Role Staff RBAC CMS</strong><br />
  <sub>Supports 1, 2, 3, 4, or more Volkswagen branches under a single unified deployment</sub>
</p>

![Dealership Showroom Hero](public/assets/aistudio/vwslider9_f252fed4.jpg)

---

## Overview & Core Capabilities

A single white-label codebase powers any Volkswagen dealership group—whether you run **1, 2, 3, 4, or more branches**—via dynamic hostname resolution (`src/context/DealershipContext.tsx`), Firestore corporate configuration (`/groupSettings/main`), or runtime `?branch=<id>` query overrides.

- **White-Label Group & Dynamic Branch Management**: Administrators can register their own **Dealership Group Corporate Profile** (Group Name, Legal Entity, FSP Number, Compliance Officer/Email, Roadside numbers, Group Logos, Default Branch) and **add, edit, archive, restore, or safely delete dealership branches** directly inside `/admin` (`Group & Branches`). Deleting a branch is automatically blocked while vehicles, branch promotions, or assigned staff still reference it; archiving hides a branch cleanly while preserving audit history.
- **Multi-Branch Runtime Resolution**: Automatically adapts dealership name, address, Google Maps embed, phone/WhatsApp links, trading hours, social links, SEO `<title>` / meta tags, and reference prefixes per active branch.
- **Master Group Inventory (`/vehicles`)**: Showcases New, Used, and MasterCars stock with multi-image carousels, gearbox & fuel badges, holding-branch filters, and dual lead attribution (`submittedAtDealershipId` + `homeDealershipId`).
- **5-Role Role-Based Staff Portal (`/admin`)**:
  - **Administrator (`admin`)**: Full group-wide access across corporate settings, branches, staff users, leads, news, promotions, manual stock, and AutoTrader sync/import.
  - **Car Sales Agent (`agent`)**: Branch-scoped access to manual vehicles (`source == 'manual'`) and branch `special` / `event` campaigns.
  - **Marketing Coordinator (`marketing`)**: Group-wide management of **Motoring News** (`newsArticles`) and **Promotions** (`special`, `event`, `competition` across Master Group and all branches).
  - **Parts Sales Executive (`parts`)**: Branch-scoped **Parts Leads** inbox (status updates only, no deletion) and branch department `special` campaigns.
  - **Service Booking Clerk (`service`)**: Branch-scoped **Service Leads** inbox (status updates only, no deletion) and branch department `special` campaigns.
- **First-Login Password Gate & One-Click Welcome Onboarding**: New staff receive a generated temporary password and must choose a personal password on first sign-in. After adding a staff member, `/admin` generates a ready-to-send welcome message with one-click **WhatsApp**, **Email App (`mailto:`)**, and **Copy** buttons (no SMTP or email API keys required).
- **Aftersales, Finance & Campaign Management**: Validated Service & Parts booking forms, test-drive hour rules, interactive ZAR finance calculator, auto-archiving campaigns, and Motoring News.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons
- **Server / API**: Node.js 22+, Express 4 (`server.ts`, runs natively on Node 22 or via `tsx` in dev)
- **Database & Auth**: Google Firebase (Cloud Firestore + Firebase Authentication + `firestore.rules`)
- **Containers / Self-Hosting**: Included `/Dockerfile`, `/.dockerignore`, and full [`/DEPLOYMENT.md`](./DEPLOYMENT.md) data-center manual

---

## Quick Start: Forking or Deploying Under Your Own Accounts

> **Need the complete Docker, PM2 + Nginx, multi-domain TLS/SSL, and data-center manual?** Read [`DEPLOYMENT.md`](./DEPLOYMENT.md).

If you fork or clone this repository for your own dealership group, **replace the original owner's Firebase project, administrator email, optional API keys, and branding** so the application runs 100% under your own infrastructure and accounts.

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
| `APP_URL` | Optional | Public URL of your site | `https://www.yourdealership.co.za` |
| `DECODO_API_KEY` | Optional | Your own Decodo API key for `/api/autotrader-scrape` | Leave blank if unused; never prefix with `VITE_` |

> **No email/SMTP environment variables are needed.** Welcome messages with temporary passwords are handed off via one-click **WhatsApp**, **Email App**, or **Copy** inside `/admin`.

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
- [ ] Created your own `.env` (no original owner keys or secrets).
- [ ] Configured your Group Corporate Profile, branches, and staff accounts inside `/admin` (`Group & Branches` and `Users & Roles`).
