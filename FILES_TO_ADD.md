# Files to Add — Directory Structure

## Root Level

Copy these files to your **project root** (`landlorder/`)

```
landlorder/
├── index.js                       ← FROM /mnt/user-data/outputs/
├── package.json                   ← FROM /mnt/user-data/outputs/
├── .env.example                   ← FROM /mnt/user-data/outputs/
├── .env                           ← CREATE: copy from .env.example and fill in values
├── STARTUP_GUIDE.md               ← FROM /mnt/user-data/outputs/ (reference)
└── PROJECT_STRUCTURE.md           ← FROM /mnt/user-data/outputs/ (reference)
```

---

## Database Directory

Create `db/` folder and add:

```
db/
├── pool.js                        ← ALREADY PROVIDED (use from uploads)
├── migrations.js                  ← ALREADY PROVIDED (use from uploads)
├── schema.sql                     ← ALREADY PROVIDED (use from uploads)
├── schema-additions.sql           ← FROM /mnt/user-data/outputs/
└── migrations/                    ← CREATE: empty folder (migrations go here)
```

---

## Routes Directory

Create `routes/` folder and add:

```
routes/
├── auth.js                        ← ALREADY PROVIDED (use from uploads)
├── users.js                       ← ALREADY PROVIDED (use from uploads)
├── reviews.js                     ← ALREADY PROVIDED (use from uploads)
├── billing.js                     ← ALREADY PROVIDED (use from uploads)
└── landlords.js                   ← FROM /mnt/user-data/outputs/
```

---

## Middleware Directory

Create `middleware/` folder and add:

```
middleware/
├── auth.js                        ← FROM /mnt/user-data/outputs/
└── requirePlan.js                 ← FROM /mnt/user-data/outputs/
```

---

## Services Directory

Create `services/` folder and add:

```
services/
└── stripe.js                      ← FROM /mnt/user-data/outputs/
```

---

## Frontend Directory

These files should already exist from your uploads:

```
(project root)/
├── main.jsx                       ← ALREADY PROVIDED
├── App.jsx                        ← ALREADY PROVIDED (may need revision)
├── App.css                        ← ALREADY PROVIDED
├── index.css                      ← ALREADY PROVIDED
└── LandLordTheme.jsx              ← ALREADY PROVIDED
```

---

## Complete Project Tree

After adding all files, your directory should look like:

```
landlorder/
│
├── index.js                           (Express server)
├── package.json                       (Dependencies)
├── .env                               (Your config — DON'T commit!)
├── .env.example                       (Template — DO commit)
│
├── STARTUP_GUIDE.md                   (Setup instructions)
├── PROJECT_STRUCTURE.md               (This overview)
├── FILES_TO_ADD.md                    (This file)
│
├── db/
│   ├── pool.js                        (PostgreSQL connection)
│   ├── migrations.js                  (Migration runner)
│   ├── schema.sql                     (Core tables)
│   ├── schema-additions.sql           (New tables)
│   └── migrations/                    (Individual migration files)
│       └── (empty initially)
│
├── routes/
│   ├── auth.js                        (Auth routes)
│   ├── users.js                       (User routes)
│   ├── reviews.js                     (Review routes)
│   ├── billing.js                     (Stripe routes)
│   └── landlords.js                   (Landlord routes)
│
├── middleware/
│   ├── auth.js                        (JWT middleware)
│   └── requirePlan.js                 (Plan checks)
│
├── services/
│   └── stripe.js                      (Stripe integration)
│
├── public/                            (Optional: static files)
│
├── src/                               (Optional: additional React code)
│   ├── components/                    (TODO: Build these!)
│   ├── pages/                         (TODO: Build these!)
│   ├── services/
│   │   └── api.js                     (TODO: API client wrapper)
│   └── App.jsx                        (Main component — revise!)
│
├── main.jsx                           (React entry point)
├── App.jsx                            (Main app component)
├── App.css
├── index.css
├── LandLordTheme.jsx                  (Theme component)
│
├── vite.config.js                     (Optional: if using Vite config)
├── README.md                          (Already provided)
└── node_modules/                      (Created by npm install)
```

---

## Step-by-Step Instructions

### Step 1: Organize Your Files

```bash
# Go to your project directory
cd landlorder

# Create the directories
mkdir -p db/migrations
mkdir -p routes
mkdir -p middleware
mkdir -p services
mkdir -p src/components
mkdir -p src/pages
mkdir -p src/services
```

### Step 2: Download Files from Outputs

From `/mnt/user-data/outputs/`, download these files:

**Root level:**
- `index.js` → copy to `landlorder/index.js`
- `package.json` → copy to `landlorder/package.json`
- `.env.example` → copy to `landlorder/.env.example`
- `STARTUP_GUIDE.md` → copy to `landlorder/STARTUP_GUIDE.md`

**Schema:**
- `schema-additions.sql` → copy to `landlorder/db/schema-additions.sql`

**Routes:**
- `landlords-routes.js` → copy to `landlorder/routes/landlords.js`

**Middleware:**
- `auth-middleware.js` → copy to `landlorder/middleware/auth.js`
- `requirePlan-middleware.js` → copy to `landlorder/middleware/requirePlan.js`

**Services:**
- `stripe-service.js` → copy to `landlorder/services/stripe.js`

### Step 3: Copy Existing Files

Copy these files you already have to the correct locations:

**From uploads to db/:**
- `pool.js` → `landlorder/db/pool.js`
- `migrations.js` → `landlorder/db/migrations.js`
- `schema.sql` → `landlorder/db/schema.sql`

**From uploads to routes/:**
- `auth.js` → `landlorder/routes/auth.js`
- `users.js` → `landlorder/routes/users.js`
- `reviews.js` → `landlorder/routes/reviews.js`
- `billing.js` → `landlorder/routes/billing.js`

**Frontend (root level):**
- `main.jsx` → `landlorder/main.jsx`
- `App.jsx` → `landlorder/App.jsx` (or `src/App.jsx`)
- `App.css` → `landlorder/App.css` (or `src/App.css`)
- `index.css` → `landlorder/index.css`
- `LandLordTheme.jsx` → `landlorder/LandLordTheme.jsx` (or `src/LandLordTheme.jsx`)

### Step 4: Create `.env`

```bash
# Copy the template
cp .env.example .env

# Edit it
nano .env
# Fill in your actual values:
# - DATABASE_URL
# - JWT_SECRET
# - STRIPE_SECRET_KEY
# - etc.
```

### Step 5: Install Dependencies

```bash
npm install
```

### Step 6: Initialize Database

```bash
# If using local PostgreSQL
psql landlorder < db/schema.sql
psql landlorder < db/schema-additions.sql

# If using hosted database (Railway, Supabase, etc)
psql $DATABASE_URL < db/schema.sql
psql $DATABASE_URL < db/schema-additions.sql
```

### Step 7: Test Backend Startup

```bash
npm run dev

# Should output:
# ╔════════════════════════════════════════╗
# ║  🏠  LandLORDER Server Started         ║
# ║  🌐  http://localhost:3000            ║
# ...
```

### Step 8: Add Frontend Components (TODO)

Create files like:

```
src/components/SearchBar.jsx
src/components/ReviewForm.jsx
src/components/ReviewList.jsx
src/pages/Home.jsx
src/pages/LandlordDetail.jsx
src/pages/Dashboard.jsx
src/services/api.js
```

See `STARTUP_GUIDE.md` section 7 for guidance.

---

## Files NOT to Commit to Git

Add to `.gitignore`:

```
.env                    (Your secret keys!)
node_modules/           (npm install creates this)
dist/                   (Vite build output)
.DS_Store               (macOS)
*.log
.vscode/                (Optional: IDE settings)
```

---

## Verification Checklist

After adding all files:

- [ ] `npm install` runs without errors
- [ ] `npm run dev` starts the backend server
- [ ] Database has all tables: `psql landlorder -c "\dt"`
- [ ] `.env` has all required variables filled in
- [ ] `curl http://localhost:3000/api/auth/register` works
- [ ] Frontend loads at `http://localhost:5173`

---

## Quick Copy-Paste Commands

If you're comfortable with bash:

```bash
# Copy from outputs to your project
cp /mnt/user-data/outputs/index.js ./
cp /mnt/user-data/outputs/package.json ./
cp /mnt/user-data/outputs/.env.example ./
cp /mnt/user-data/outputs/schema-additions.sql ./db/
cp /mnt/user-data/outputs/landlords-routes.js ./routes/landlords.js
cp /mnt/user-data/outputs/auth-middleware.js ./middleware/auth.js
cp /mnt/user-data/outputs/requirePlan-middleware.js ./middleware/requirePlan.js
cp /mnt/user-data/outputs/stripe-service.js ./services/stripe.js

# Create .env from template
cp .env.example .env

# Install
npm install

# Initialize DB
psql landlorder < db/schema.sql
psql landlorder < db/schema-additions.sql

# Start
npm run dev
```

---

**That's it! Your project should now be ready to run.** 🚀

For detailed setup instructions, see `STARTUP_GUIDE.md`.
For full project overview, see `PROJECT_STRUCTURE.md`.
