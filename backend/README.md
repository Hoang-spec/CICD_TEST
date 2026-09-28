# Atelier backend

Express API for the Material Kit storefront and dashboard. Start it with `npm run dev` from this directory. The API stores data in `data/db.json`; the file is created with demo data on first run.

Set `JWT_SECRET` to a long random value and `CLIENT_ORIGIN` to the frontend URL. The built-in demo accounts are `admin@example.com` / `Admin123` and `client@example.com` / `Client123`.

All protected routes use `Authorization: Bearer <token>`. Admin-only routes require signing in as the admin account.

## Routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create a client account |
| POST | `/api/auth/login` | Public | Sign in |
| GET | `/api/auth/me` | Signed in | Current account |
| GET | `/api/products` | Public | Catalog; supports `search` and `category` query parameters |
| GET | `/api/products/:id` | Public | Product details |
| POST | `/api/products` | Admin | Create a product |
| PATCH | `/api/products/:id` | Admin | Update product fields |
| DELETE | `/api/products/:id` | Admin | Delete or archive a product already in an order |
| POST | `/api/orders` | Signed in | Place an order; server calculates prices, shipping, total, and reserves stock |
| GET | `/api/orders` | Signed in | Own orders; admin sees all orders |
| GET | `/api/orders/:id` | Owner or admin | Order details |
| PATCH | `/api/orders/:id/status` | Admin | Move an order through its allowed statuses |
| GET | `/api/admin/customers` | Admin | Customer list with order counts and spend; supports `search` |
| GET | `/api/admin/dashboard` | Admin | Revenue, counts, low stock, best sellers, and latest orders |

Order status flow: `pending` → `processing` → `shipped` → `delivered`. Orders can be cancelled while pending or processing; cancellation restores reserved stock.

Product create/update accepts `name`, `category`, `description`, `price`, `oldPrice`, `image`, `accent`, `badge`, `stock`, and `active`.
