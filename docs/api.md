# API Reference

Base URL: `http://localhost:8080/api`

All endpoints return JSON. Errors follow the shape `{ "error": "message", "code": "ERROR_CODE" }`.

Auth is via httpOnly cookies set on login. Include `credentials: 'include'` in all fetch/axios calls.

---

## Auth

### GET /api/auth/login-config/:roleRoute

Returns the login page configuration for a role portal. Public — no auth required.

**Parameters:**
- `roleRoute` — role route slug (e.g. `admin`, `user`, `subadmin`)

**Response 200:**
```json
{
  "roleRoute": "admin",
  "template": "centered",
  "bgImage": null,
  "logoUrl": null,
  "brandTitle": "Admin Portal",
  "brandSubtitle": null,
  "googleAuthEnabled": false,
  "roleColor": "#6366f1"
}
```

**Response 404:**
```json
{ "error": "Login portal \"badroute\" not found", "code": "NOT_FOUND" }
```

---

### POST /api/auth/login/:roleRoute

Authenticate a user through a role-scoped portal. Sets `access_token` and `refresh_token` httpOnly cookies on success.

Rate limited: 10 requests per minute per IP.

**Parameters:**
- `roleRoute` — role route slug

**Request body:**
```json
{
  "email": "admin@admin.com",
  "password": "changeme"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Super Admin",
    "email": "admin@admin.com",
    "avatarUrl": null,
    "isFounder": true
  },
  "role": {
    "name": "Super Admin",
    "slug": "super_admin",
    "route": "admin",
    "color": "#6366f1"
  },
  "redirectTo": "/admin"
}
```

**Response 401:**
```json
{ "error": "Invalid credentials", "code": "UNAUTHORIZED" }
```

**Response 403:**
```json
{ "error": "You do not have access to this portal", "code": "FORBIDDEN" }
```

**Response 404:**
```json
{ "error": "Login portal \"badroute\" not found", "code": "NOT_FOUND" }
```

**Response 422:**
```json
{
  "error": "Validation failed",
  "issues": { "email": ["Invalid email"] }
}
```

---

### POST /api/auth/refresh

Refresh the access token using the refresh token cookie. Issues new access + refresh tokens (rotation — old refresh token is revoked).

**Cookies required:** `refresh_token`

**Response 200:**
```json
{ "ok": true }
```

**Response 401:**
```json
{ "error": "Invalid refresh token", "code": "UNAUTHORIZED" }
```

---

### POST /api/auth/logout

Revoke the refresh token and clear both auth cookies.

**Cookies required:** `refresh_token`

**Response 200:**
```json
{ "ok": true }
```

---

### GET /api/auth/me

Get the currently authenticated user's profile, role, and permissions.

**Cookies required:** `access_token`

**Response 200:**
```json
{
  "user": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Super Admin",
    "email": "admin@admin.com",
    "avatarUrl": null,
    "isFounder": true
  },
  "role": {
    "name": "Super Admin",
    "slug": "super_admin",
    "route": "admin",
    "color": "#6366f1"
  },
  "permissions": ["*"]
}
```

**Response 401:**
```json
{ "error": "No access token", "code": "UNAUTHORIZED" }
```

---

### GET /api/auth/google/redirect

Initiates Google OAuth flow. Redirects to Google consent screen.

**Query parameters:**
- `roleRoute` (optional) — target role portal after OAuth completes (default: `dashboard`)

**Response:** 302 redirect to Google OAuth URL

---

### GET /api/auth/google/callback

Google OAuth callback. Handled server-side — creates/updates user, assigns default role if needed, sets auth cookies, redirects to dashboard.

**Response:** 302 redirect to `/<role.route>` on success, or `/login/user?error=google_failed` on failure.

---

## Health

### GET /api/health

Server health check. No auth required.

**Response 200:**
```json
{ "status": "ok" }
```

---

## Cookie Reference

| Cookie | TTL | Scope |
|--------|-----|-------|
| `access_token` | 15 minutes | All `/api/*` requests |
| `refresh_token` | 7 days | `POST /api/auth/refresh` and `POST /api/auth/logout` |

Both cookies are:
- `httpOnly: true` — not accessible via JavaScript
- `sameSite: strict` — CSRF protection
- `secure: true` in production

---

## Error Codes

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid access/refresh token |
| 403 | `FORBIDDEN` | Authenticated but insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 422 | — | Zod validation failure (see `issues` field) |
| 429 | — | Rate limit exceeded |
| 500 | — | Internal server error |

---

## Permissions Reference

Permissions follow the pattern `resource.action` or `resource.subresource.action`.

| Slug | Description |
|------|-------------|
| `users.view` | List and view users |
| `users.create` | Create new users |
| `users.update` | Update existing users |
| `users.delete` | Delete users |
| `roles.view` | View roles |
| `roles.manage` | Create, update, delete roles |
| `permissions.view` | View permissions |
| `permissions.manage` | Assign permissions to roles |
| `settings.view` | View app settings |
| `settings.manage` | Update app settings |
| `secrets.stripe.view` | Reveal Stripe secrets |
| `secrets.stripe.manage` | Create/update/delete Stripe secrets |
| `secrets.sendgrid.view` | Reveal SendGrid secrets |
| `secrets.sendgrid.manage` | Create/update/delete SendGrid secrets |
| `secrets.twilio.view` | Reveal Twilio secrets |
| `secrets.twilio.manage` | Create/update/delete Twilio secrets |
| `secrets.smtp.view` | Reveal SMTP secrets |
| `secrets.smtp.manage` | Create/update/delete SMTP secrets |
| `logs.view` | View activity and audit logs |
| `logs.export` | Export logs as CSV/JSON |
| `tickets.view` | View support tickets |
| `tickets.manage` | Manage support tickets |
| `tms.projects.manage` | Admin override for TMS projects |
| `tms.products.manage` | Manage TMS products |

> **Super Admin wildcard:** Users with `super_admin` role receive `permissions: ["*"]` — the wildcard bypasses all permission checks.
