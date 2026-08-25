# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo contains **LandLORDER!** ("rate and review your landlord"), owned by App-4-Dat, LLC. The community edition is AGPL-3.0-licensed; commercial/SaaS use requires a separate license (see [README.md](README.md)) — keep this in mind before adding permissive-license dependencies or suggesting a proprietary fork.

The repo is in a messy, mid-migration state: it contains **two divergent implementations** of the same product plus a pile of unmerged staging files at the root. There is no single "the app" — check which subproject a task actually concerns before editing.

### 1. `landlorder/` — Express + Vite/React app (primary backend)
A self-contained app with its own `package.json`:
- `index.js` — Express API entry point (Supabase-token auth, rate limiting, migrations-on-boot)
- `routes/` — `users.js`, `landlords.js`, `reviews.js`, `billing.js` (Stripe checkout/portal/webhook). There is no `routes/auth.js` — Supabase owns signup/login directly from the frontend, so the backend has no `/api/auth` route.
- `middleware/` — `auth.js` (verifies the Supabase-issued bearer token via `supabase.auth.getUser()`, then upserts a local `users`/`subscriptions` row on first sight of that user), `requirePlan.js` (plan/quota gating, reads the `subscriptions`/`plans` tables)
- `services/stripe.js` — Stripe helper functions used by `routes/billing.js`
- `db/` — `pool.js` (pg connection pool), `migrations.js` (runs pending migrations from `db/migrations/` on startup, tracked in a `migrations_log` table), `schema.sql` (core tables), `schema-additions.sql` (plans/subscriptions/etc., also captured in migration `003_billing_and_supabase_auth.sql`)
- `src/` — the actual React frontend (`App.jsx`, `LandLordTheme.jsx`) served by Vite in dev
- Package name is also `landlorder`; do not confuse this `package.json` with the one at the repo root.

**Runnable as of 2026-08-21** — the issues below were present at one point but are fixed in the current tree; re-check `package.json`/`vite.config.js` yourself before trusting this if it's been a while:
- No `"type": "module"` in `package.json` anymore, so `index.js`'s CommonJS `require()`/`module.exports` work fine.
- `dependencies` now includes `express`, `cors`, `dotenv`, `pg`, `stripe`, `express-rate-limit` alongside the frontend packages.
- `package.json` has a `"start": "node index.js"` script (also `dev:server`) that runs the Express backend; `dev:client`/`build`/`preview` remain Vite-only. [start.sh](start.sh) at repo root runs `cd landlorder && npm install && npm start` — note this starts **only the backend** (port 3001 via `PORT` in `.env`), not the Vite frontend; run `npm run dev:client` separately for that.
- `routes/landlords.js` has no filename issue (no stray space).
- `vite.config.js` is a clean, minimal `defineConfig`.
- `db/schema-additions.sql` is present in `landlorder/db/`.

### 2. `landlorder-web/` — Next.js + Supabase rewrite (newer, minimal)
A separate Next.js 16 / React 19 / TypeScript app using Supabase (`@supabase/ssr`) instead of the custom Express/JWT/Postgres stack:
- `app/` — App Router (`layout.tsx`, `page.tsx`)
- `utils/supabase/server.ts` — Supabase server client factory (reads `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- Only a client/middleware/server Supabase util trio and a root page exist so far; most app functionality is unbuilt.
- This looks like it's meant to replace `landlorder/`'s frontend (and possibly its backend, via Supabase) rather than coexist with it long-term — don't assume both are meant to ship together without checking with the user.

### 3. Repo-root loose files — unmerged staging area
`auth-middleware.js`, `requirePlan-middleware.js`, `landlords-routes.js`, `stripe-service.js`, `schema-additions.sql`, plus a root-level `index.js`/`package.json` (Express deps: express, pg, bcryptjs, jsonwebtoken, stripe, uuid) are **not wired into either app** — they're drop-in replacements staged for manual copying into `landlorder/`, per [FILES_TO_ADD.md](FILES_TO_ADD.md):
- `landlords-routes.js` → `landlorder/routes/landlords.js`
- `auth-middleware.js` → `landlorder/middleware/auth.js`
- `requirePlan-middleware.js` → `landlorder/middleware/requirePlan.js`
- `stripe-service.js` → `landlorder/services/stripe.js` (new dir)
- `schema-additions.sql` → `landlorder/db/schema-additions.sql`

The root `index.js` also has the same `require()` vs no `"type": "module"` mismatch to check before treating it as runnable. `FILES_TO_ADD.md`, `PROJECT_STRUCTURE.md`, `STARTUP_GUIDE.md`, and `WHAT_WAS_CREATED.md` are planning docs written against an *intended* file layout, not a description of current working code — treat their checklists as a to-do list, not as fact about what exists.

## Commands

There is no root-level build/lint/test tooling that spans the whole repo — each subproject is independent.

**`landlorder/` (Vite/React frontend + Express backend, run separately):**
```bash
cd landlorder
npm install
npm run dev:client  # Vite dev server (frontend only, port 5173)
npm run dev:server  # Express API (backend only, port 3001 via PORT in .env)
npm start           # same as dev:server; what start.sh and Railway use
npm run build       # Vite production build
npm run preview     # Preview the production build
```
No test runner or lint script is configured despite `eslint` being a devDependency (no `lint` script in `package.json`, and `eslint.config.js` exists but isn't wired to an npm script).

**`landlorder-web/` (Next.js):**
```bash
cd landlorder-web
npm install
npm run dev       # next dev
npm run build     # next build
npm run start     # next start
npm run lint      # next lint
```
No test runner configured.

There are no automated tests anywhere in the repository currently.

## Environment variables

`landlorder/` backend (see `landlorder/.env.example` for the full annotated list): `NODE_ENV`, `PORT`, `DATABASE_URL` (Postgres), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (used server-side by `middleware/auth.js` to verify frontend-issued Supabase tokens — no `JWT_SECRET` anymore), `FRONTEND_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` (4 price IDs for Pro/Business monthly/annual). Frontend (Vite-exposed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_PLACES_KEY`, `VITE_API_BASE`.

`landlorder-web/` (see `landlorder-web/.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Architecture notes specific to this codebase

- The Stripe webhook route (`/api/billing/webhook`) must stay mounted with `express.raw({ type: 'application/json' })` *before* the general `express.json()` body parser — Stripe signature verification needs the raw body. Both `index.js` variants (root and `landlorder/`) already do this; preserve the ordering if you touch billing routes.
- Migrations run automatically on server boot (`db/migrations.js` against `db/migrations/*.sql`, tracked in `migrations_log`) — there is no separate `npm run migrate` command.
- API routes are grouped by resource under `/api/*` (`auth`, `users`, `landlords`, `reviews`, `billing`); reviews are nested under both `/api/landlords/:id/reviews` (list/create) and `/api/reviews/:id/...` (flag/respond).
