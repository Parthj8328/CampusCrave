# CampusCrave — Product Requirements Document

## Original Problem Statement
Campus Digital Canteen Pre-Ordering System built for high-concurrency peak breaks. Delivered as an Expo React Native app that also runs on web (mobile-first). Three roles: STUDENT, KITCHEN_STAFF, ADMIN.

## Architecture
- **Frontend:** Expo Router (React Native + TypeScript), works on iOS/Android/web. TanStack Query (polling for live updates), Zustand (cart), react-native-keyboard-controller, react-native-qrcode-svg, @react-native-vector-icons/ionicons, expo-image, expo-linear-gradient.
- **Backend:** FastAPI (single `server.py`, all routes under `/api`). JWT auth (pwdlib/argon2). MongoDB (Motor).
- **Concurrency:** Slot overbooking prevented via atomic `find_one_and_update` on the slot doc (`booked < capacity`) — works on standalone MongoDB, verified with 10 parallel orders.
- **Design:** `/app/design_guidelines.json` → tokens in `/app/frontend/src/theme.ts` (Terracotta brand, warm off-white surfaces).

## User Personas
- **Student:** wants to skip the lunch queue; browses menu, picks a 15-min pickup slot, pays (mock), tracks order + shows QR at counter.
- **Kitchen Staff:** works the peak rush; needs a glanceable queue, batch prep totals, 1-tap status advance, fast 86'ing.
- **Admin:** manages the catalog, throttles slot capacity, reads sales/rush analytics.

## Core Requirements (static)
1. Dynamic menu grouped by category + Veg/Non-Veg filter + real-time out-of-stock & time-window badges.
2. 15-min pickup slots with live capacity (OPEN/FILLING/FULL) and sold-out handling.
3. Multi-item cart, mock payment (UPI/Campus Card/Cash), unique Pickup Token + QR.
4. Live order tracker stepper: PLACED → PREPARING → READY_FOR_PICKUP → COLLECTED.
5. KDS Kanban queue sorted by slot, batch aggregator, 1-click advance with 3s Undo.
6. Fast out-of-stock (86) toggle.
7. Admin menu CRUD with time-based availability; per-slot capacity throttling.
8. Sales & rush analytics: daily revenue, peak intervals, top sellers.
9. JWT RBAC across all three roles.

## Implemented (2026-06-11)- ✅ JWT auth (login/register/me), role selection on sign-up, demo accounts seeded.
- ✅ Menu API with computed availability; 12 seeded items across 3 categories.
- ✅ Slots API (16 slots, 11:00–15:00); admin capacity throttling.
- ✅ Orders: server-side pricing, atomic slot reservation (no overbooking), token + QR.
- ✅ Student screens: menu (search/filter/stepper/floating cart), checkout (slots + payment), tracker (QR + stepper), My Orders.
- ✅ Kitchen screens: KDS queue + batch aggregator + advance + Undo bar; stock 86 toggle.
- ✅ Admin screens: analytics (revenue/peak/top sellers with charts), menu CRUD modal, slot throttling.
- ✅ Tested: 24/24 backend pytest pass (incl. concurrency); all frontend role flows pass.

### Iteration 2 (2026-06-11)
- ✅ **Reorder in one tap** — Orders list + tracker button; only available items re-added, skipped ones toasted.
- ✅ **Live WebSocket push** — `/api/ws?order_id=` broadcasts status changes; tracker shows LIVE badge and updates instantly (polling kept as fallback). Verified over public `wss://` ingress.
- ✅ **Ratings & feedback** — 5-star + comment after COLLECTED (409 guard, own-order only); admin dashboard shows avg rating + recent feedback.
- ✅ **Daily slot reset** — `ensure_slots_current()` resets `booked` when the stored slot-day changes (meta doc), called on startup, GET /slots and order create.
- ✅ Tested: 9/9 iteration-2 backend pytest pass + full frontend verification.

## Test Credentials
See `/app/memory/test_credentials.md` (all: `password123`).

## Backlog / Next
- **P1:** Real-time WebSocket push (currently polling).
- **P1:** Scheduled slot reset per day / date-scoped slots.
- **P2:** Order rating & favorites; reorder-in-one-tap.
- **P2:** Migrate `shadow*` → `boxShadow`, FastAPI `on_event` → lifespan (cosmetic/deprecation cleanup).
- **P2:** Real payment gateway (Stripe/Razorpay) if moving beyond sandbox.
