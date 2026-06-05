# RBAC MERN Platform

Production-ready Role-Based Access Control platform built with the MERN stack. Features multi-role user accounts, role-scoped login portals, JWT authentication, Google OAuth, customizable login page templates, role-based color theming, dynamic settings, encrypted secrets management, and a self-hosted AI chatbot.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    nginx :8080                       │
│  /api/*  →  Express :5000                           │
│  /ai/*   →  Express → Python AI :8001               │
│  /*      →  Vite React SPA :5173                    │
└─────────────────────────────────────────────────────┘
         │              │              │
    MongoDB :27017   Express      React + Vite
```

**Services:**
| Service | Technology | Purpose |
|---------|-----------|---------|
| `nginx` | nginx:alpine | Reverse proxy (port 8080) |
| `server` | Node 24 + Express 5 | REST API |
| `client` | React 19 + Vite 6 | Single-page app |
| `mongo` | MongoDB 8 | Database |
| `ai` | Python 3.12 + FastAPI | AI chatbot service (stub in v1) |

## Tech Stack

- **Frontend:** React 19, Vite 6, React Router v7, Tailwind CSS v4, shadcn/ui, Zustand
- **Backend:** Express 5, Mongoose 8, Zod, Passport.js
- **Auth:** JWT (httpOnly cookies), Google OAuth2, bcrypt
- **Database:** MongoDB 8
- **Container:** Docker + Docker Compose

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended)
- OR: Node.js 24+, MongoDB 8, Python 3.12

## Quick Start (Docker)

### 1. Clone and configure

```bash
git clone <repo-url>
cd rbac-mern
cp server/.env.example server/.env
```

### 2. Generate secrets

```bash
node -e "
const c = require('crypto');
console.log('JWT_ACCESS_SECRET=' + c.randomBytes(32).toString('hex'));
console.log('JWT_REFRESH_SECRET=' + c.randomBytes(32).toString('hex'));
console.log('SECRETS_ENCRYPTION_KEY=' + c.randomBytes(32).toString('hex'));
"
```

Copy the output into `server/.env`.

### 3. Start all services

```bash
docker compose up --build
```

First boot downloads images (~5 min). Subsequent starts are fast.

### 4. Seed the database

```bash
docker compose exec server npm run seed
```

Expected output:
```
✓ Permissions seeded
✓ Roles seeded
✓ Admin user created: admin@admin.com
✓ Admin role assigned
✓ Settings seeded
✓ Secrets seeded
Seed complete.
```

### 5. Open the app

| URL | Portal |
|-----|--------|
| http://localhost:8080/login/admin | Admin login |
| http://localhost:8080/login/user | User login |
| http://localhost:8080/login/subadmin | Sub-admin login |

**Default admin credentials:** `admin@admin.com` / `changeme`

> Change the password immediately after first login.

## Environment Variables

All variables go in `server/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✓ | MongoDB connection string |
| `JWT_ACCESS_SECRET` | ✓ | Secret for access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | ✓ | Secret for refresh tokens (min 32 chars) |
| `SECRETS_ENCRYPTION_KEY` | ✓ | AES-256 key for secrets (64 hex chars = 32 bytes) |
| `GOOGLE_CLIENT_ID` | optional | Enables Google OAuth |
| `GOOGLE_CLIENT_SECRET` | optional | Enables Google OAuth |
| `GOOGLE_CALLBACK_URL` | optional | OAuth callback URL |
| `SEED_ADMIN_EMAIL` | optional | Admin email (default: admin@admin.com) |
| `SEED_ADMIN_PASSWORD` | optional | Admin password (default: changeme) |

## Login Portals

Each role has its own login URL based on its `route` field:

```
/login/admin      →  Admin dashboard  (/admin)
/login/user       →  User dashboard   (/dashboard)
/login/subadmin   →  Sub-admin        (/subadmin)
```

Login page templates (configured per-role in Admin → Settings → Login Pages):
- **centered** — card centred on page with optional background image
- **modal** — frosted-glass overlay with blurred backdrop
- **split** — left brand panel + right form

## Role Color Theming

Each role has an accent color that drives the entire UI when that role is active — sidebar header, active nav items, button fills, focus rings. Set in Admin → Roles → Edit Role.

Default colors:
- Super Admin: `#6366f1` (indigo)
- User: `#10b981` (emerald)
- Sub Admin: `#f59e0b` (amber)

## Multi-Role Accounts

A single user can hold multiple roles. Each role has its own login portal. Users logging in via `/login/admin` must have the admin role assigned — they cannot access a portal for a role they don't hold.

## Seeded Data

After running `npm run seed`:

- **3 roles:** `super_admin`, `user`, `subadmin`
- **24 permissions** across: Users, Roles, Settings, Secrets, Logs, Support, TMS
- **15 app settings** (appearance, auth, email, third-party)
- **6 secret stubs** (Stripe, SendGrid, Twilio, SMTP)
- **1 admin user** from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`

## Development (without Docker)

```bash
# Terminal 1 — MongoDB (or use Atlas)
mongod

# Terminal 2 — API server
cd server
cp .env.example .env   # fill in values
npm install
npm run dev

# Terminal 3 — React client
cd client
npm install
npm run dev

# Open: http://localhost:5173
```

> In local dev without nginx, the Vite server handles requests. API calls go to `/api/*` which Vite proxies to the server. Add to `vite.config.ts`:
> ```ts
> server: { proxy: { '/api': 'http://localhost:5000' } }
> ```

## Project Structure

```
rbac-mern/
├── client/          # React 19 + Vite SPA
│   └── src/
│       ├── components/ui/   # shadcn/ui primitives
│       ├── components/layout/  # AppShell, Sidebar
│       ├── pages/           # Route-level pages
│       ├── stores/          # Zustand state
│       ├── hooks/           # usePermission, useTheme
│       └── router/          # Routes + AuthGuard
├── server/          # Express 5 API
│   └── src/
│       ├── models/          # Mongoose schemas
│       ├── routes/          # Express routers
│       ├── controllers/     # HTTP handlers
│       ├── services/        # Business logic
│       ├── middleware/      # Auth, rate limiting
│       ├── lib/             # JWT, cookies, errors
│       └── seed/            # Database bootstrap
├── ai/              # Python FastAPI chatbot (stub)
├── nginx/           # Reverse proxy config
├── docker-compose.yml
└── docs/
    ├── api.md       # API reference
    └── superpowers/ # Design specs and plans
```

## Sub-projects Roadmap

| # | Feature | Status |
|---|---------|--------|
| 1 | Foundation + Auth | ✅ Complete |
| 2 | Core RBAC (role-permission assignment) | Pending |
| 3 | Admin Dashboard UI | Pending |
| 4 | Security (MFA, trusted devices, IP allowlist) | Pending |
| 5 | Audit & Activity Logs | Pending |
| 6 | Multi-tenancy / Organizations | Pending |
| 7 | Webhooks | Pending |
| 8 | Billing & Plans | Pending |
| 9 | Approval Requests + Role Templates | Pending |
| 10 | Support Tickets | Pending |
| 11 | FluxHaven TMS | Pending |
| 12 | AI Chatbot (Python + Gemma) | Pending |

## Running Tests

```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test
```

## License

MIT
