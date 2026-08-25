# LandLORDER — Complete Startup Guide

This guide walks you through setting up and running the LandLORDER backend and frontend from scratch.

## Prerequisites

You'll need:
- **Node.js** 16+ (check: `node -v`)
- **npm** 8+ (check: `npm -v`)
- **PostgreSQL** 12+ (local or hosted, e.g., Railway, Supabase)
- **Stripe account** (free tier works for testing: https://stripe.com)
- **Google Places API key** (https://console.cloud.google.com)

---

## 1. Database Setup

### Option A: Local PostgreSQL

```bash
# Install PostgreSQL (macOS)
brew install postgresql@15

# Start the service
brew services start postgresql@15

# Create the database
createdb landlorder

# Test the connection
psql landlorder -c "SELECT NOW();"
```

### Option B: Hosted (Railway or Supabase)

1. Go to [Railway.app](https://railway.app) or [Supabase](https://supabase.com)
2. Create a new PostgreSQL database
3. Copy the connection string (will look like `postgresql://user:pass@host:5432/db`)

---

## 2. Backend Setup

### Clone and Install

```bash
# 1. Navigate to your project root
cd landlorder

# 2. Install dependencies
npm install
```

### Configure Environment

```bash
# 1. Copy the example env file
cp .env.example .env

# 2. Edit .env with your actual credentials
nano .env
```

**Required variables to fill in:**

| Variable | Where to Get It |
|----------|-----------------|
| `DATABASE_URL` | From PostgreSQL setup above |
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → "Secret key" |
| `STRIPE_WEBHOOK_SECRET` | [Stripe Dashboard](https://dashboard.stripe.com/webhooks) → Create endpoint for `http://localhost:3000/api/billing/webhook` |
| `STRIPE_PRICE_*` | Create products in Stripe Dashboard, then copy Price IDs |
| `GOOGLE_PLACES_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Create API key |
| `FRONTEND_URL` | `http://localhost:5173` (Vite default) for dev |

### Initialize Database Schema

Run the SQL to create all tables:

```bash
# Using psql directly
psql landlorder < db/schema.sql
psql landlorder < schema-additions.sql

# OR using psql with connection string
psql $DATABASE_URL < db/schema.sql
psql $DATABASE_URL < schema-additions.sql
```

### Start the Backend

```bash
npm run dev
# or: node index.js

# You should see:
# ╔════════════════════════════════════════╗
# ║  🏠  LandLORDER Server Started         ║
# ║  🌐  http://localhost:3000            ║
# ...
```

The backend is now running on `http://localhost:3000` and will automatically run database migrations on startup.

---

## 3. Frontend Setup

### File Structure

You should have:
```
landlorder/
├── main.jsx              (entry point)
├── App.jsx               (main component — needs content!)
├── App.css
├── index.css
├── LandLordTheme.jsx     (theme/styling)
└── (other components)
```

### Install Frontend Dependencies

Already done in step 2 (`npm install`), but make sure `vite` and `react` are in `package.json`.

### Start Vite Dev Server

```bash
npm run dev
# This starts TWO servers:
#   - Backend: http://localhost:3000
#   - Frontend: http://localhost:5173

# Open browser to http://localhost:5173
```

---

## 4. File Checklist

### Backend Files (should exist in `/routes`)

- ✅ `routes/auth.js` — Register/login (provided)
- ✅ `routes/users.js` — User profile/quota (provided)
- ✅ `routes/reviews.js` — Review CRUD (provided)
- ✅ `routes/billing.js` — Stripe checkout/portal (provided)
- ✅ `routes/landlords.js` — Search/create/claim properties (provided)

### Middleware Files (should exist in `/middleware`)

- ✅ `middleware/auth.js` — JWT verification (provided)
- ✅ `middleware/requirePlan.js` — Plan feature gates (provided)

### Service Files (should exist in `/services`)

- ✅ `services/stripe.js` — Stripe API integration (provided)

### DB Files (should exist in `/db`)

- ✅ `db/pool.js` — PostgreSQL connection pool (provided)
- ✅ `db/migrations.js` — Migration runner (provided)
- ✅ `db/schema.sql` — Initial schema (provided)
- ✅ `db/schema-additions.sql` — Additional tables (provided)
- ✅ `db/migrations/` — Empty directory (migrations go here)

### Root Files

- ✅ `index.js` — Express app entry point (provided)
- ✅ `package.json` — Dependencies and scripts (provided)
- ✅ `.env` — Environment variables (you create from `.env.example`)
- ✅ `.env.example` — Template (provided)

### Frontend Files (need to be filled in or created)

- ❓ `App.jsx` — **TODO**: Build main app pages/routes
- ✅ `main.jsx` — Entry point (provided)
- ✅ `App.css` — Styling (provided, but is Vite template)
- ✅ `index.css` — Global styles (provided, but is Vite template)
- ❓ `LandLordTheme.jsx` — **TODO**: Custom theme/styling component
- ❓ API client code — **TODO**: Fetch wrapper for `/api/*` calls

---

## 5. Testing the Setup

### Test Backend Endpoints

```bash
# 1. Health check (should return current time)
curl http://localhost:3000/api/auth/register -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Should get a JWT token back

# 2. Test with the token
TOKEN="eyJhbGc..."  # from response above
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

### Test Frontend

1. Open `http://localhost:5173`
2. You should see the Vite welcome screen (or your custom `App.jsx`)
3. Check browser console for any errors

### Test Database Migrations

```bash
# Check migrations table
psql $DATABASE_URL -c "SELECT * FROM migrations_log;"

# Should show all migrations that ran on startup
```

---

## 6. Common Issues & Fixes

### Issue: `DATABASE_URL is not set`
**Fix:** Make sure `.env` exists and has `DATABASE_URL=...`

```bash
# Check if .env exists
ls -la .env

# If not, create it
cp .env.example .env
nano .env
```

### Issue: `Connection refused` to PostgreSQL
**Fix:** Ensure PostgreSQL is running

```bash
# Check if PostgreSQL is running (macOS)
brew services list | grep postgresql

# Start if not running
brew services start postgresql@15
```

### Issue: `STRIPE_SECRET_KEY is undefined`
**Fix:** Check your `.env` file has the correct value

```bash
# Print to verify
echo $STRIPE_SECRET_KEY

# If empty, add it to .env
```

### Issue: Frontend can't reach backend at localhost:3000
**Fix:** Make sure both servers are running, check CORS

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
npm run dev

# Check that FRONTEND_URL in .env matches where frontend runs (http://localhost:5173)
```

### Issue: Migrations fail on startup
**Fix:** Check the migrations_log table for errors

```bash
psql $DATABASE_URL
SELECT * FROM migrations_log WHERE status = 'failed';
```

If a migration is marked failed, you can delete it and retry:

```sql
DELETE FROM migrations_log WHERE migration_name = '001_initial_schema.sql';
```

Then restart the backend — the migration will re-run.

---

## 7. Next Steps

### Frontend Development

1. **Build pages** in `App.jsx` and React components
2. **Create API client** (e.g., `services/api.js`) to call `/api/*`
3. **Add routing** (React Router) to navigate between pages
4. **Style** using the provided CSS variables in `index.css`

### Backend Enhancements

1. **Landlords route**: Fully implement with Google Places search integration
2. **Admin routes**: Add endpoints for user/review moderation
3. **Email notifications**: Send emails on new reviews, claims, etc.
4. **Webhooks**: Handle Stripe webhook events for subscription changes

### Deployment

- **Backend**: Deploy to Railway, Heroku, or AWS
- **Frontend**: Deploy to Vercel, Netlify, or GitHub Pages
- **Database**: Use Railway, Supabase, or AWS RDS

---

## 8. Development Commands

```bash
# Start backend (with auto-reload on file changes)
npm run dev

# Build frontend for production
npm run build

# Preview production build locally
npm run preview

# Run migrations only (without starting server)
node -e "const m = require('./db/migrations'); m.runMigrations();"

# Check migration history
node -e "const m = require('./db/migrations'); m.getMigrationHistory().then(console.log);"
```

---

## 9. Stripe Setup Walkthrough

### Create Products and Prices

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. **Products** → **Create product**
   - Name: "Landlord Pro Monthly"
   - Pricing: $9.99/month (recurring)
3. Copy the Price ID (e.g., `price_1234...`)
4. Repeat for:
   - Landlord Pro Annual ($99.99/year)
   - Landlord Business Monthly ($29.99/month)
   - Landlord Business Annual ($299.99/year)
5. Add these IDs to `.env`:
   ```
   STRIPE_PRICE_PRO_MONTHLY=price_1234...
   STRIPE_PRICE_PRO_ANNUAL=price_5678...
   ...
   ```

### Setup Webhook

1. **Webhooks** → **Add endpoint**
   - URL: `http://localhost:3000/api/billing/webhook` (or your production URL)
   - Events: Select all `customer.subscription.*` and `checkout.session.completed`, `invoice.payment_*`
2. Copy the **Signing secret**
3. Add to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_1234...
   ```

### Testing Stripe Locally

Use Stripe CLI to forward webhook events to your local machine:

```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/billing/webhook

# Get test payment method
stripe test

# Use card: 4242 4242 4242 4242 (test card that always succeeds)
```

---

## Support & Documentation

- **Express.js**: https://expressjs.com
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Stripe API**: https://stripe.com/docs/api
- **Vite**: https://vitejs.dev
- **React**: https://react.dev

---

**You're ready to go! 🚀**

Start with `npm install`, set up `.env`, initialize the database, then `npm run dev`.
