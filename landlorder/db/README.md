# Database Migrations Guide

This directory contains all database schema migrations for LandLORDER.

## Overview

Migrations allow you to:
- ✅ Track all schema changes with version control
- ✅ Deploy confidently without manual SQL
- ✅ Rollback mistakes (if you create undo migrations)
- ✅ Share schema changes with your team
- ✅ Run migrations automatically on startup

## How It Works

1. **Migration files** in `migrations/` are numbered: `001_description.sql`, `002_description.sql`, etc.
2. **On startup**, `index.js` calls `runMigrations()` which:
   - Creates a `migrations_log` table (tracks what's been run)
   - Reads all `.sql` files in `migrations/`
   - Compares to `migrations_log` to find new migrations
   - Executes pending migrations in order, with transactions
   - Logs success/failure for each one

3. **Safety**: Each migration runs in a transaction. If it fails, it rolls back automatically.

## Creating a New Migration

### 1. Create a file with the next number

```bash
# If the last migration is 001_initial_schema.sql, create:
touch landlorder/db/migrations/002_add_user_roles.sql
```

### 2. Write your migration

Always use `IF NOT EXISTS` / `IF EXISTS` for safety:

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration: 002_add_user_roles
-- Description: Add role column to users table
-- Created: 2026-07-02
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Add new column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Create enum for valid roles (if supported)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'verified', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

### 3. Commit and push

```bash
git add landlorder/db/migrations/002_add_user_roles.sql
git commit -m "Add user roles migration"
git push
```

### 4. Migration runs automatically on next startup

The app calls `runMigrations()` before starting the server. Check the console for:

```
🔄 Starting database migrations...
✓ Migrations log table ready
✓ Found 1 previously executed migrations
📋 Running 1 pending migration(s)...

  ↳ Running: 002_add_user_roles.sql
    ✓ 002_add_user_roles.sql completed

✅ All migrations completed successfully
```

## Viewing Migration History

Check `migrations_log` table to see what's been run:

```bash
psql $DATABASE_URL
# Inside psql:
SELECT * FROM migrations_log ORDER BY executed_at;
```

Or programmatically:

```javascript
const { getMigrationHistory } = require('./db/migrations');
const history = await getMigrationHistory();
console.log(history);
```

## Best Practices

### ✅ DO

- Use `IF NOT EXISTS` / `IF EXISTS` — migrations can be re-run in dev
- Make migrations **small and focused** — one feature per migration
- Add comments explaining **why** you're making changes
- Test migrations locally before pushing to production
- Use transactions — they're automatic in the runner
- Name migrations descriptively: `003_add_email_verification.sql`

### ❌ DON'T

- Drop tables without a specific reason (data loss!)
- Run raw SQL in production — use migrations instead
- Edit old migrations — create a new one to fix mistakes
- Skip version numbers (001, 002, 004 is wrong — breaks ordering)
- Use user-specific SQL that won't work across environments

## Example: Adding a Column

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration: 003_add_verification_status
-- Description: Add email verification tracking to users
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Add columns
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add index for queries like "find unverified users"
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
```

## Example: Creating an Undo Migration

If you need to undo a previous migration, create a new migration file:

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration: 004_drop_verification_status
-- Description: Removes email_verified columns (reverting 003)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE users 
  DROP COLUMN IF EXISTS email_verified,
  DROP COLUMN IF EXISTS verified_at;

DROP INDEX IF EXISTS idx_users_email_verified;
```

**Don't edit the original migration — just create a new one.**

## Troubleshooting

### Migration failed and marked as failed

Check the error in `migrations_log`:

```sql
SELECT * FROM migrations_log WHERE status = 'failed';
```

Once fixed, you can delete the failed entry:

```sql
DELETE FROM migrations_log WHERE migration_name = '002_add_user_roles.sql';
```

Then restart the app.

### Migrations won't run on production

Ensure:
1. `DATABASE_URL` environment variable is set
2. Database user has permission to create/alter tables
3. No other process is running migrations at the same time
4. Check logs for specific error

### Want to reset everything locally?

```bash
# Drop all tables (DEV ONLY!)
dropdb landlorder
createdb landlorder

# On app startup, all migrations will re-run
```

## Related Files

- `pool.js` — PostgreSQL connection pool
- `migrations.js` — Migration runner (called by index.js)
- `schema.sql` — Original schema (now split into migrations)
- `migrations/` — Individual migration files

## For Teams

When pulling code with new migrations:

1. Pull the code
2. The migrations run **automatically** on `npm run dev` or `npm start`
3. Check console to verify success
4. If you need to debug: check `migrations_log` table