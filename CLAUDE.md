# PK Food — NRS Internal Food Ordering App

## What this is

Internal web app for NRS HQ staff to order food from PK Canteen and have it
delivered to their floor/office. Like Glovo but inside one building.

## Stack

- Backend: NestJS + TypeScript (strict mode)
- Database: PostgreSQL via Prisma ORM
- Auth: Magic link via email, restricted to @nrs.gov.ng domain
- Payments: Paystack (initialize + verify + webhook)
- File uploads: Cloudinary (food item images)
- Frontend: React (Vite) — same monorepo under /client
- Deployment target: Ubuntu VPS via PM2 + Nginx

## Strict rules

- All TypeScript must be strictly typed — no `any`, no implicit types
- No raw SQL — use Prisma only
- All API responses must use a consistent shape: `{ success, data, message }`
- Env vars accessed only through a validated config service, never process.env directly

## Roles

- STAFF — browse menu, cart, place order, view history
- ADMIN — full admin panel: menu, inventory, orders, announcements
- RUNNER — read-only delivery queue, can mark orders as delivered

## Core entities

- User (role, floor, officeNumber, email)
- Vendor (name, items)
- MenuItem (name, price, image, vendorId, totalStock, onlineStock, status)
- Order (userId, items, deliveryFee, status, floor, officeNumber)
- OrderItem (orderId, menuItemId, quantity, unitPrice)
- Announcement (type: STATUS | GENERAL, message, active)

## Delivery fee logic

- Phase 1: flat ₦300 per order (configurable via env: DELIVERY_FEE)
- Phase 2: Paystack in-app payment (already integrated from day 1 — just behind a feature flag)

## Paystack integration

- Initialize payment: POST /payments/initialize
- Verify payment: GET /payments/verify/:reference
- Webhook: POST /webhooks/paystack — must verify x-paystack-signature
- Amount always in kobo (multiply naira × 100)

## What to build for demo (tonight)

1. Auth (magic link, @nrs.gov.ng gate)
2. Menu browsing (staff view)
3. Cart + checkout with Paystack payment initialized
4. Order confirmation page
5. Admin: add menu item, view orders, update order status
6. Runner: delivery queue view, mark as delivered
7. Paystack webhook handler

## Out of scope for demo

- Push notifications
- Reporting dashboard
- Vendor management UI
- WhatsApp fallback
