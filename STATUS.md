# PK Food — Application Status

> Last updated: 2026-09-14

## Overview

PK Food is an internal food ordering web app for NRS HQ staff. It lets employees browse
the PK Canteen menu, place orders — paying via Flutterwave or manual bank transfer — and
track delivery to their floor/office. Runners fulfill orders; admins manage the full
operation and get notified of new orders via Web Push and Telegram.

The app is live on an Ubuntu VPS, served via PM2 + Nginx, with the NestJS API on port 3000
and the React SPA served as a static build.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS + TypeScript (strict mode) |
| Database | PostgreSQL via Prisma ORM |
| Auth | Email + password with email verification; JWT sessions |
| Payments | Flutterwave (initialize, verify, webhook) + manual bank transfer with admin confirmation |
| Notifications | Web Push (VAPID) + Telegram bot, on new order / payment confirmed |
| File uploads | Cloudinary (food item images) |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + custom CSS variables |
| Charts | Recharts (AreaChart, BarChart, PieChart) |
| State | Zustand (cart) |
| Deployment | PM2 + Nginx on Ubuntu VPS, GitHub Actions CI auto-deploy on push to main |

---

## User Roles

| Role | Description |
|---|---|
| `STAFF` | Browse menu, manage cart, place orders, view order history, manage profile |
| `ADMIN` | Full admin panel — menu, vendors, orders, announcements, revenue dashboard |
| `RUNNER` | Read-only delivery queue, mark orders as delivered, view delivery history |

Login routes by role: ADMIN → `/admin`, RUNNER → `/runner`, STAFF → `/menu`.

---

## Database Schema

### Entities

- **User** — id, email, password (hashed), name, phone, role, floor, officeNumber, emailVerified, verifyToken, resetToken
- **Vendor** — id, name
- **MenuItem** — id, name, price, image (Cloudinary URL), vendorId, totalStock, onlineStock, status, category
- **Order** — id, reference, userId, deliveryFee, status, floor, officeNumber, phone, paymentMethod, paymentRef, transferReference, paid
- **OrderItem** — orderId, menuItemId, quantity, unitPrice (snapshot at order time)
- **Announcement** — id, type, message, active

### Enums

- **Role**: `STAFF`, `ADMIN`, `RUNNER`
- **ItemStatus**: `AVAILABLE`, `UNAVAILABLE`, `OUT_OF_STOCK`
- **OrderStatus**: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`
- **PaymentMethod**: `FLUTTERWAVE` (default), `BANK_TRANSFER`
- **FoodCategory**: `RICE`, `SWALLOW`, `PROTEIN`, `SIDES`, `PASTA`, `PASTRIES`, `BUFFET`, `DRINKS`
- **AnnouncementType**: `STATUS`, `GENERAL`
- **Floor**: `GF`, `F1` … `F16`

---

## Backend — API Endpoints

All responses follow `{ success, data, message }`. All routes except auth require a JWT
`Authorization: Bearer <token>` header.

### Auth — `/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register with email + password. Sends verification email |
| GET | `/auth/verify-email?token=` | Public | Verify email address |
| POST | `/auth/login` | Public | Login, returns JWT |
| POST | `/auth/resend-verification` | Public | Resend verification email |
| POST | `/auth/forgot-password` | Public | Send password reset link |
| POST | `/auth/reset-password` | Public | Reset password with token |
| GET | `/auth/me` | Any role | Get own profile |
| PATCH | `/auth/profile` | Any role | Update name, phone, floor, officeNumber |
| POST | `/auth/dev-token/:email` | Public (dev only) | Issue a JWT without email flow |

### Menu — `/menu`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/menu/items` | Any role | List available items (add `?all=true` for all including unavailable) |
| GET | `/menu/items/:id` | Any role | Get a single item |
| POST | `/menu/items` | ADMIN | Create menu item |
| PATCH | `/menu/items/:id` | ADMIN | Update menu item |
| DELETE | `/menu/items/:id` | ADMIN | Delete menu item |
| GET | `/menu/vendors` | Any role | List all vendors |
| POST | `/menu/vendors` | ADMIN | Create vendor |
| PATCH | `/menu/vendors/:id` | ADMIN | Rename vendor |
| DELETE | `/menu/vendors/:id` | ADMIN | Delete vendor |
| GET | `/menu/announcements` | Any role | List active announcements |
| GET | `/menu/announcements/all` | ADMIN | List all announcements (including inactive) |
| POST | `/menu/announcements` | ADMIN | Create announcement |
| PATCH | `/menu/announcements/:id/toggle` | ADMIN | Toggle active state |
| DELETE | `/menu/announcements/:id` | ADMIN | Delete announcement |

### Orders — `/orders`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/orders` | Any role | Place an order (validates stock, deducts onlineStock in a transaction) |
| GET | `/orders` | Any role | STAFF sees own orders; ADMIN sees all |
| GET | `/orders/:id` | Any role | Single order (STAFF restricted to own) |
| PATCH | `/orders/:id/status` | ADMIN, RUNNER | Advance order through FSM |
| GET | `/orders/queue` | ADMIN, RUNNER | Active delivery queue (CONFIRMED → IN_TRANSIT) |
| GET | `/orders/history` | ADMIN, RUNNER | Orders delivered today |

#### Order Status FSM

```
PENDING → CONFIRMED → PREPARING → READY → IN_TRANSIT → DELIVERED
    └──────── CANCELLED ◄──────────────────────────────┘
```

### Payments — `/payments`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/payments/initialize` | Any role | Initialize Flutterwave transaction, returns hosted payment link |
| GET | `/payments/verify/:transactionId` | Any role | Verify payment by Flutterwave transaction id |
| GET | `/payments/bank-details` | Any role | Get bank account details for manual transfer |
| POST | `/payments/bank-transfer` | Any role | Submit a manual bank transfer reference for an order (pending admin confirmation) |
| PATCH | `/payments/:orderId/confirm-manual` | ADMIN | Confirm a manual bank transfer, marks order paid + CONFIRMED |
| PATCH | `/payments/:orderId/reject-manual` | ADMIN | Reject a manual bank transfer, restores stock and cancels order |
| POST | `/webhooks/flutterwave` | Public | Flutterwave webhook (verifies `verif-hash` against `FLW_SECRET_HASH`, re-verifies transaction via API before crediting) |

### Notifications

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/push/public-key` | Any role | Get VAPID public key |
| POST | `/push/subscribe` | Any role | Register a Web Push subscription |
| POST | `/push/unsubscribe` | Any role | Remove a Web Push subscription |
| POST | `/telegram/generate-link` | Any role | Generate a one-time link code to bind a Telegram chat to the account |
| DELETE | `/telegram/link` | Any role | Unlink Telegram chat |
| POST | `/telegram/webhook` | Public | Telegram bot webhook (validates `TELEGRAM_WEBHOOK_SECRET`) |

New-order notifications fire once payment is confirmed (Flutterwave verify/webhook, or
admin manual confirmation) rather than at order creation, to avoid notifying on unpaid orders.

### Uploads — `/uploads`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/uploads/image` | ADMIN | Upload food item image to Cloudinary (max 5 MB, JPEG/PNG/WebP) |

---

## Frontend — Pages and Features

### Staff Flow

| Page | Route | Description |
|---|---|---|
| Login | `/login` | Email + password login; links to register, forgot password |
| Verify Email | `/verify-email` | Lands after clicking verification link |
| Forgot Password | `/forgot-password` | Request reset email |
| Reset Password | `/reset-password?token=` | Set new password |
| Menu | `/menu` | Browse all available items; category tabs (Rice, Swallow, Protein, Sides, Pasta, Pastries, Buffet, Drinks); inline cart sidebar; search by item name; add/update quantity; active order bar shows current order status |
| Cart | `/cart` | Review cart items; adjust quantities; see delivery fee breakdown; proceed to checkout |
| Checkout | `/checkout` | Confirm delivery floor + office + phone; choose Flutterwave (redirects to hosted payment page) or manual bank transfer (shows account details, submits transfer reference for admin review) |
| Order Confirmation | `/order-confirmation` | Post-payment success page; links to order history |
| My Orders | `/orders` | Full order history with status badges and item breakdowns |
| Profile | `/profile` | Update name, phone, floor, office number |

### Admin Panel — `/admin`

Collapsible sidebar navigation with 5 tabs:

| Tab | Capabilities |
|---|---|
| **Orders** | View all orders; search by name/email/office/floor; filter by status; update status via FSM buttons; see full item breakdown per order; confirm or reject pending bank transfers |
| **Menu** | View all items; search by name; filter by category; filter by vendor; toggle list/grid view; select mode with animated checkboxes; bulk delete; add item (name, price, category, vendor, stock, image upload); edit item inline; delete item |
| **Vendors** | View all vendors; add vendor; rename vendor; delete vendor |
| **Announcements** | View all announcements (STATUS or GENERAL type); toggle active/inactive; create announcement; delete announcement |
| **Revenue** | KPI cards (total revenue, average order, active orders, delivered today); area chart of revenue over last 7 days; horizontal bar chart of revenue by vendor; donut pie chart of order status distribution; top items table by order count |

### Runner Flow

| Page | Route | Description |
|---|---|---|
| Runner Queue | `/runner` | Live delivery queue (auto-refreshes); shows order details — customer name, floor, office, phone, items, total value, time in queue; warns on orders waiting > 15 minutes; advance status button (Confirm → Preparing → Ready → In Transit → Delivered); logout |
| Runner History | `/runner-history` | Orders delivered today; totals summary |

---

## Delivery Fee

Flat ₦300 per order, configurable via the `DELIVERY_FEE` environment variable. The fee is
included in both the Flutterwave initialization amount and the total shown for bank transfer.

---

## Payments

- **Flutterwave**: `POST /payments/initialize` creates a transaction (`tx_ref` = order id) and
  returns a hosted payment link. `GET /payments/verify/:transactionId` and the
  `/webhooks/flutterwave` webhook both re-verify the transaction against the Flutterwave API
  before marking an order paid — the webhook alone is never trusted.
- **Bank transfer**: staff submit a transfer reference against an order; the order is held as
  unpaid/PENDING until an admin confirms (`confirm-manual`, marks paid + CONFIRMED, fires
  notification) or rejects (`reject-manual`, restores stock, cancels order) it.
- Webhook signature is checked via the `verif-hash` header against `FLW_SECRET_HASH`.

---

## Key Technical Details

- **Stock management**: `onlineStock` is decremented atomically in a Prisma transaction when an order is placed. If stock hits 0, item status auto-flips to `OUT_OF_STOCK`.
- **Email**: Verification and password reset emails sent via Resend (SMTP-compatible).
- **Notifications**: Web Push (VAPID) and a Telegram bot both notify on payment confirmation (not on raw order creation), to avoid double-firing across the webhook/verify race.
- **Webhook charset fix**: Telegram (and previously Paystack) webhook bodies had their `Content-Type: charset=UTF-8` normalized before body-parser validation to fix a UTF-8 parsing error.
- **Image uploads**: Cloudinary via the `/uploads/image` endpoint; URLs stored on `MenuItem.image`.
- **JWT auth**: HS256, expiry configurable via `JWT_EXPIRES_IN` env var.
- **Domain gate**: Auth service enforces `@nrs.gov.ng` email domain on registration.
- **Config**: All env vars accessed through a validated `ConfigService` — no `process.env` in business logic.
- **Response shape**: `ResponseInterceptor` wraps all controller returns as `{ success: true, data, message }`.
- **Mobile layout**: Bottom navigation bar fixed at bottom; admin sidebar adjusts `bottom` with `env(safe-area-inset-bottom)` to avoid overlap.

---

## Deployment

```
/pk-food
  /client    → React SPA, built to /client/dist, served by Nginx
  /server    → NestJS API, compiled to /server/dist, run via PM2
  ecosystem.config.js  → PM2 config (app: pk-food-server, port 3000)
```

VPS deploy steps:
```bash
git stash && git pull origin main
cd client && npm install && npm run build
cd ../server && npm install && npm run build
pm2 restart pk-food-server --update-env
```

Note: `git stash` is required before every pull because the VPS `package-lock.json` diverges
locally. `--update-env` is required after `.env` changes — PM2 caches env vars and won't pick
up edits on a plain restart. CI (GitHub Actions) auto-deploys to the VPS on push to `main`,
including Prisma migrations.

---

## Not Yet Built

The following are out of scope for the current version:

- Scheduled / pre-order functionality (items available only on certain days or by advance booking)
- Push notifications
- Analytics / reporting dashboard beyond the basic revenue tab
- Vendor management UI (API exists, frontend shows read-only list)
- WhatsApp order fallback
