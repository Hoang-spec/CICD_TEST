# Atelier API — PostgreSQL

Express API for the storefront and dashboard. All application records are stored in PostgreSQL; the old `data/db.json` is no longer read at runtime.

## Local development

From the repository root, `docker compose up --build -d` starts PostgreSQL, applies versioned migrations, seeds the catalog/admin, and starts API and Next.js. Open http://localhost:3000. Local admin: `admin@gmail.com` / `admin123`. Register your own client account; the old hardcoded client login has been removed.

For running Node directly, provision PostgreSQL, copy `.env.example` to `.env` and set `DATABASE_URL`, then:

```sh
npm ci
npm run migrate
npm run seed
npm run dev
```

Run the frontend with `npm run dev` from the repository root. Next proxies `/api/*` to `http://127.0.0.1:4000`. For Docker builds set `API_INTERNAL_URL=http://backend:4000` at build time. This internal URL is never used directly by a browser.

## Authentication and data

The API issues a 7-day HttpOnly session cookie; only a hash is stored in `sessions`. Production cookies require HTTPS. Frontend writes send `X-Atelier-Request: 1`; mutations reject unapproved Origin values. Use the frontend origin configured in `CLIENT_ORIGIN` exactly. Logout deletes the session; password change deletes all the user's sessions. Admin permissions are read from the database on every protected request.

Money is exact `numeric(14,2)` in SQL and decimal strings in responses. Currency is USD. COD is supported; card/OAuth/password-reset email/avatar upload are not implemented. Notification preferences persist but do not send messages.

Lists return `{data,pagination:{page,pageSize,total}}`, with default size 20 and maximum 100. Errors return `{error,requestId}` and validation may add `fields`. Frontend converts decimal text only for display/estimates. Final amounts always come from the server.

## Endpoints

| Routes | Access |
| --- | --- |
| POST `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Public (logout is idempotent) |
| GET `/api/auth/me` | Signed in |
| PATCH `/api/users/me`, POST `/api/users/me/change-password` | Signed in |
| GET/PATCH `/api/users/me/notification-preferences` | Signed in |
| GET `/api/categories`, `/api/products`, `/api/products/:id` | Public, active catalog |
| GET `/api/admin/products` | Admin, includes archived products |
| POST `/api/products`, PATCH/DELETE `/api/products/:id` | Admin; delete archives |
| POST `/api/admin/products/:id/stock-adjustments` | Admin; `{delta,reason}` |
| POST `/api/orders` | Signed in; `Idempotency-Key` required |
| GET `/api/orders`, `/api/orders/:id` | Own orders; admin sees all |
| PATCH `/api/orders/:id/status` | Admin |
| GET `/api/admin/customers`, `/api/admin/dashboard` | Admin |
| GET `/api/health`, `/api/ready` | Liveness, DB readiness |

Product lists accept `search` and `category`; customer list accepts `search`; order list accepts `status`. Dashboard uses delivered-order totals as completed sales, exposes non-cancelled placed order value separately, and does not claim payment collection.

Product edits do not accept stock. Use a stock adjustment with an integer delta and a reason. Checkout uses row locks, computes exact totals from database prices, records inventory movements and snapshots, and commits atomically. Cancellation locks the order and restores stock once. Valid states: pending → processing → shipped → delivered; pending/processing → cancelled.

## Tests

Use a dedicated PostgreSQL test database, never the application database:

```sh
TEST_DATABASE_URL=postgres://user:password@localhost:5432/atelier_test npm test
```

Tests use an isolated schema and remove it afterward. They cover concurrent checkout/cancellation, idempotency, permissions, snapshots, totals, validation and session revocation.

## Existing JSON data

Back up the source file and stop writes before importing into an **empty, migrated, unseeded** PostgreSQL database:

```sh
npm run migrate
npm run import:json -- /path/to/db.json
npm run import:json -- /path/to/db.json --apply
```

Default mode only validates the file. Apply uses one transaction and refuses a nonempty target. IDs, bcrypt hashes, snapshots and current stock are preserved; stock is not deducted again. Card demo orders, malformed hashes, duplicate IDs/emails, invalid totals and broken references are rejected for manual review; the importer does not silently rewrite them. No localStorage data is imported. The checked-in JSON is retained unchanged for review/backup, not used by the app.
