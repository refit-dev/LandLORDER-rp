# LandLORDER!

Rate and review your landlord. React (Vite) frontend + Express/Postgres API, with Supabase for auth and Stripe for billing.

See the repo root's `README.md` for licensing/ownership.

## Stack

- **Frontend** — React 19 + Vite, in `src/`. Talks to Supabase directly for auth (register/login/magic-link) and to the Express API for everything else (search, reviews, billing).
- **Backend** — Express API in `index.js` + `routes/`, `middleware/`, `services/`. Verifies Supabase-issued tokens (`middleware/auth.js`) — it never issues its own credentials.
- **Database** — Postgres, accessed via `pg` (`db/pool.js`). Migrations in `db/migrations/*.sql` run automatically on server startup (`db/migrations.js`), tracked in a `migrations_log` table.
- **Billing** — Stripe Checkout + Customer Portal (`services/stripe.js`, `routes/billing.js`), gated per-plan via `middleware/requirePlan.js`.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in real values — see below
```

Apply the database schema (migrations run automatically on server boot, but you need a database for them to run against):

```bash
# Local Postgres
createdb landlorder
# Or point DATABASE_URL at any Postgres instance, including Supabase's own

npm run dev:server   # starts the Express API on :3001 (runs pending migrations first)
```

In a second terminal:

```bash
npm run dev:client   # starts the Vite dev server on :5173
```

`GET http://localhost:3001/health` should return `{"status":"ok",...}` once the backend is up.

### Environment variables

See `.env.example` for the full list. In short:

- `VITE_*` vars are read by the **frontend** (Vite only exposes vars prefixed `VITE_` to browser code).
- Everything else is read by the **backend** only.
- `SUPABASE_SERVICE_KEY` bypasses Row Level Security — required on the server, must never reach the frontend bundle.
- Auth is Supabase-only: the frontend calls Supabase directly for signup/login/magic-link; the backend only verifies the resulting token.

## Deployment (split: Vercel + Railway/Render)

### Backend — Railway or Render
- Root directory: `landlorder`
- Build command: `npm install`
- Start command: `npm start`
- Env vars: `DATABASE_URL` (usually provisioned automatically by the host's Postgres add-on), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_BUSINESS_MONTHLY`, `STRIPE_PRICE_BUSINESS_ANNUAL`, `FRONTEND_URL` (your deployed Vercel URL), `NODE_ENV=production`.
- Register the Stripe webhook endpoint (`https://your-api-host/api/billing/webhook`) in the Stripe dashboard and set `STRIPE_WEBHOOK_SECRET` from it.

### Frontend — Vercel
- Root directory: `landlorder`
- Framework preset: Vite
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_PLACES_KEY`, `VITE_API_BASE` (your deployed backend URL + `/api`).

### Not automated here
Creating the Railway/Render project, the Vercel project, a production Postgres database, and Stripe products/prices are all manual steps in those services' own dashboards.
