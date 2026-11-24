# Self-Hosting & Data-Center Deployment Manual

This guide explains how any Volkswagen dealership group—or an independent hosting partner—can isolate, configure, build, and deploy this platform onto **your own Firebase account**, **your own domain names**, and **your own infrastructure** (on-premise data centers, VMware/Proxmox VMs, bare-metal Linux servers, Docker hosts, or cloud platforms).

Nothing in production depends on the original developer's accounts, APIs, or mail servers.

---

## Table of Contents

1. [Architecture & Prerequisites](#1-architecture--prerequisites)
2. [Owner-Account Isolation (Mandatory Before Go-Live)](#2-owner-account-isolation-mandatory-before-go-live)
3. [Environment Variables (`.env`)](#3-environment-variables-env)
4. [Option A — Docker & Docker Compose (Data Centers & Containers)](#4-option-a--docker--docker-compose-data-centers--containers)
5. [Option B — Bare-Metal Linux VM with PM2 & Nginx Reverse Proxy](#5-option-b--bare-metal-linux-vm-with-pm2--nginx-reverse-proxy)
6. [Option C — Static Hosting (`dist/` on Apache / Nginx / Firebase Hosting)](#6-option-c--static-hosting-dist-on-apache--nginx--firebase-hosting)
7. [Post-Deployment Dealership Group & Multi-Branch Onboarding (`/admin`)](#7-post-deployment-dealership-group--multi-branch-onboarding-admin)
8. [Verification & Ongoing Operations](#8-verification--ongoing-operations)

---

## 1. Architecture & Prerequisites

- **Runtime**: Node.js **v22.x or newer** (Express 4 `server.ts` executes directly via Node 22 native TypeScript support—no build transpile step required for the server).
- **Frontend Bundle**: Compiled Vite + React 19 SPA emitted into `dist/`.
- **Database & Auth**: Google Cloud Firestore + Firebase Authentication (Spark free tier works without billing or private service-account keys).
- **Reverse Proxy (recommended for multi-branch domains)**: Nginx, HAProxy, or Traefik forwarding the original `Host` header so a single running instance serves 1, 2, 3, 4, or more dealership websites simultaneously.

---

## 2. Owner-Account Isolation (Mandatory Before Go-Live)

Before deploying for a new dealership group, replace every reference to the original developer's Firebase project, administrator email, and optional scraper key.

### 2.1 Provision Your Own Firebase Project

1. Sign in to [Firebase Console](https://console.firebase.google.com/) under your dealership group's Google account and create a new project.
2. Go to **Build → Firestore Database → Create database**, select your closest region (e.g. `africa-south1` for South Africa or `europe-west1`), and start in **Production mode**.
3. Go to **Build → Authentication → Sign-in method** and enable:
   - **Google** (for primary Administrator SSO sign-in)
   - **Email/Password** (for staff users: Agents, Marketing, Parts, Service, and additional Admins)
4. Go to **Authentication → Settings → Authorized domains** and add:
   - `localhost` (for local testing)
   - Every production domain you plan to route to this app (e.g. `www.yourvwbranch1.co.za`, `www.yourvwbranch2.co.za`).
5. Go to **Project Settings → General → Your apps → Web (`</>`)**, register a Web App, and replace **`/firebase-applet-config.json`**:

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

> Both the React browser app (`src/lib/firebase.ts`) and Express backend (`server.ts`) read `/firebase-applet-config.json`. Updating this single file rewires both client and server to your Firebase project.

### 2.2 Replace the Bootstrapped Owner Administrator Email

Replace `smokeydhlamini@gmail.com` in **all three files** with your group's verified Google Administrator email:

| File | Symbol / Line to Update |
| :--- | :--- |
| `/firestore.rules` | `request.auth.token.email == 'smokeydhlamini@gmail.com'` |
| `/src/lib/firebase.ts` | `export const BOOTSTRAPPED_ADMIN_EMAIL = 'smokeydhlamini@gmail.com';` |
| `/server.ts` | `const BOOTSTRAPPED_ADMIN_EMAIL = 'smokeydhlamini@gmail.com';` |

### 2.3 Validate and Deploy `firestore.rules`

Run the included security rules linter before deploying:

```bash
npx eslint firestore.rules
```

Create or update `firebase.json` in the project root:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

*(If you created a named Firestore database instead of `(default)`, add `"database": "YOUR_DB_ID"` inside `"firestore"`.)*

Deploy the rules to **your** project:

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules
```

### 2.4 Update HTML Metadata & Public Brand Assets

- Replace `<title>`, `<meta name="description">`, `og:title`, `og:description`, and favicon in `/index.html`, plus `name` and `description` in `/metadata.json`.
- Replace default brand imagery in `/public/assets/aistudio/` (or upload new logos and adjust URLs directly in the Admin Portal once deployed).

---

## 3. Environment Variables (`.env`)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `3000` | Port Express listens on inside the container/server |
| `APP_URL` | No | `http://localhost:3000` | Public canonical URL of your deployment |
| `DECODO_API_KEY` | No | *(empty)* | Optional server-side Decodo Web Data API key for automated AutoTrader scraping (`POST /api/autotrader-scrape`). Never prefix with `VITE_`. |

> **No SMTP or Email API credentials are required.** When an Administrator creates a staff user in `/admin`, the portal generates a ready-to-send welcome message containing the sign-in link, username (email), role scope, and temporary password with one-click **Send via WhatsApp**, **Open Email App (`mailto:`)**, and **Copy** buttons.

---

## 4. Option A — Docker & Docker Compose (Data Centers & Containers)

The included `/Dockerfile` uses a clean multi-stage `node:22-alpine` build:
- **Builder stage**: runs `npm ci` and `npm run build` (`vite build` → `dist/`).
- **Runner stage**: installs production-only dependencies (`npm ci --omit=dev`), copies `dist/`, `server.ts`, `firebase-applet-config.json`, `src/lib/autotraderParser.ts`, and `src/types/dealership.ts`, exposes port `3000`, includes a `HEALTHCHECK`, and starts `node server.ts`.

> **Important:** Update `/firebase-applet-config.json`, `BOOTSTRAPPED_ADMIN_EMAIL`, `/index.html`, and `/metadata.json` **before** building the Docker image because Vite compiles frontend config into `dist/` at build time.

### Build & Run with Docker CLI

```bash
docker build -t vw-dealership-platform:latest .

docker run -d \
  --name vw-dealership \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  vw-dealership-platform:latest
```

Verify container health:

```bash
docker ps
curl -I http://127.0.0.1:3000/
```

### Deploy with Docker Compose

Create `docker-compose.yml` on your data-center host:

```yaml
services:
  dealership-web:
    build: .
    container_name: vw-dealership-platform
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: 3000
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

Start or rebuild cleanly with zero manual dependency tweaks:

```bash
docker compose up -d --build
```

Place Nginx or Traefik in front of `127.0.0.1:3000` (see Section 5.3) to terminate HTTPS for all dealership domains.

---

## 5. Option B — Bare-Metal Linux VM with PM2 & Nginx Reverse Proxy

Use this path on Ubuntu Server (`22.04` / `24.04`), Debian, or RHEL/AlmaLinux VMs inside your corporate data center.

### 5.1 Install Node.js 22 LTS & Build

```bash
# Ubuntu / Debian example using NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

node -v   # Confirm v22.x or newer

sudo mkdir -p /var/www/dealership-platform
sudo chown "$USER":"$USER" /var/www/dealership-platform
cd /var/www/dealership-platform

git clone <your-repo-url> .
cp .env.example .env
# Edit .env, firebase-applet-config.json, and BOOTSTRAPPED_ADMIN_EMAIL first

npm ci
npm run lint
npm run build
```

### 5.2 Keep the Server Running with PM2

Install PM2 globally and create `/var/www/dealership-platform/ecosystem.config.cjs`:

```bash
sudo npm install -g pm2
```

```js
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'vw-dealership-platform',
      script: 'server.ts',
      interpreter: 'node',
      cwd: '/var/www/dealership-platform',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

Start and persist across server reboots:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # Run the systemd command printed by PM2
pm2 status
```

### 5.3 Configure Nginx Reverse Proxy + Multi-Domain SSL

A single instance can serve **1, 2, 3, 4, or more branch domains** simultaneously because `DealershipContext` inspects `window.location.hostname` and matches it against each branch's `domain` stored in Firestore.

Create `/etc/nginx/sites-available/dealership-platform`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name
        branch1.yourgroup.co.za www.branch1.yourgroup.co.za
        branch2.yourgroup.co.za www.branch2.yourgroup.co.za
        branch3.yourgroup.co.za www.branch3.yourgroup.co.za
        branch4.yourgroup.co.za www.branch4.yourgroup.co.za;

    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Preserve original Host header so runtime branch detection works
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 90s;
    }
}
```

Enable the site, test Nginx syntax, and issue Let's Encrypt TLS certificates with Certbot:

```bash
sudo ln -s /etc/nginx/sites-available/dealership-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Provision TLS certificates for all configured dealership domains
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx \
  -d branch1.yourgroup.co.za -d www.branch1.yourgroup.co.za \
  -d branch2.yourgroup.co.za -d www.branch2.yourgroup.co.za \
  -d branch3.yourgroup.co.za -d www.branch3.yourgroup.co.za \
  -d branch4.yourgroup.co.za -d www.branch4.yourgroup.co.za
```

---

## 6. Option C — Static Hosting (`dist/` on Apache / Nginx / Firebase Hosting)

If you prefer pure static web hosting without Node.js at runtime:

1. Run `npm run build` to compile `dist/`.
2. Deploy `dist/` to:
   - **Firebase Hosting**: `firebase deploy --only hosting,firestore:rules` (ensure `"rewrites": [{ "source": "**", "destination": "/index.html" }]` is in `firebase.json`).
   - **Apache / cPanel**: upload the contents of `dist/` into `public_html/`. `public/.htaccess` is automatically copied into `dist/` to handle SPA routes (`/vehicles`, `/admin`, `/service`, etc.).
   - **Nginx static site**: add `try_files $uri $uri/ /index.html;` inside `location /`.

> **Note:** Static hosting does not run the Express `POST /api/autotrader-scrape` endpoint. Staff continue to manage inventory seamlessly via manual vehicle creation and the built-in **Paste AutoTrader JSON / HTML** importer inside `/admin`.

---

## 7. Post-Deployment Dealership Group & Multi-Branch Onboarding (`/admin`)

Once your instance is live and reachable over HTTPS:

1. Navigate to `https://your-primary-domain/admin` and click **Administrator Google Sign-In** using the Google account you configured in Section 2.2.
2. Click **Seed / Reset Default Group Data** in the Admin header to initialize `/groupSettings/main`, baseline branches, sample campaigns, and news (or skip straight to registering your own branches).
3. Open **Group & Branches** in the Admin Portal:
   - **Dealership Group Corporate Profile**: Configure your `Group Name`, `Legal Entity`, `FSP Number`, `Compliance Officer`, `Compliance Email`, `VW Roadside Assist` numbers, `Test Drive Hours Summary`, `Group Logo URL`, `VW Emblem URL`, `YouTube Channel`, and `Default Fallback Branch`.
   - **Register New Dealership Branch**: Click **Add Branch** to register as many branches as your group operates (**1, 2, 3, 4, or more**)—complete with branch ID, 2–4 letter Reference Code (e.g. `DBN`, `PMB`, `PTA`), domain name, physical/postal address, contact details, trading hours, social links, and optional AutoTrader Dealer ID.
   - **Archive or Safely Remove Default Branches**: Archive branches you don't need immediately, or permanently delete unused branches once no vehicles, branch-scoped promotions, or assigned staff reference them (built-in dependency protection prevents orphan records).
4. Open **Users & Roles → Add Staff User** to onboard your dealership team across all 5 roles:
   - **Administrator** *(Group-Wide)*
   - **Car Sales Agent** *(Branch-Scoped Vehicles & Branch Specials/Events)*
   - **Marketing Coordinator** *(Group-Wide Motoring News, Specials, Events & Competitions)*
   - **Parts Sales Executive** *(Branch-Scoped Parts Leads & Department Specials)*
   - **Service Booking Clerk** *(Branch-Scoped Service Leads & Department Specials)*
5. Use the one-click **Send via WhatsApp**, **Open Email App**, or **Copy Welcome Message** buttons after creating each account to hand over login details and temporary passwords.

---

## 8. Verification & Ongoing Operations

Before handing the live site to staff and customers, confirm:

- [ ] Visiting each branch domain (or `/?branch=<id>`) displays the correct dealership name, address, phone numbers, social links, and SEO tags.
- [ ] Submitting a Service Booking, Parts Inquiry, Finance Application, and Vehicle Inquiry creates a lead in `/admin` under the corresponding branch.
- [ ] Signing in as each non-admin role (`agent`, `marketing`, `parts`, `service`) enforces first-login password setup and isolates portal access to that role's authorized scope.
- [ ] All Firebase Console **Authorized domains** include every live branch domain (`www.` and apex domains).
- [ ] Automated HTTPS certificate renewal (`certbot renew --dry-run`) succeeds on bare-metal/Nginx hosts.
