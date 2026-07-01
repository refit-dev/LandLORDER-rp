-- EXTENSION: enables UUID generation
-- UUIDs are used as primary keys instead of auto-increment integers
-- Why UUIDs? They can be generated anywhere, never expose record count,
-- and are safe to expose in URLs (e.g. /landlords/3f2b1a...)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: users
-- Purpose: stores registered user accounts
-- Note: if using Supabase Auth, Supabase manages this
--       table for you — you may not need to create it
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- PRIMARY KEY = each row has a unique ID, used to link to reviews
  -- DEFAULT uuid_generate_v4() = Postgres generates the UUID automatically

  email         TEXT UNIQUE NOT NULL,
  -- UNIQUE = no two users can share an email address
  -- NOT NULL = email is required, can't be left blank

  password_hash TEXT NOT NULL,
  -- Stores the bcrypt hash, NOT the real password
  -- Even if DB is leaked, passwords can't be reversed

  created_at    TIMESTAMPTZ DEFAULT NOW()
  -- TIMESTAMPTZ = timestamp with timezone (always stored as UTC)
  -- DEFAULT NOW() = automatically set to current time on insert
);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: landlords
-- Purpose: stores each landlord or property listing
-- avg_rating and review_count are auto-maintained
-- by the trigger below — never update them manually
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE landlords (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,       -- landlord's full name or property name
  company       TEXT,                -- management company (nullable — not all have one)
  address       TEXT NOT NULL,       -- street address from Google Places
  city          TEXT,                -- parsed from Google Places result
  state         TEXT,                -- 2-letter abbreviation e.g. "NY"
  zip           TEXT,                -- postal code
  country       TEXT,                -- e.g. "US"
  place_id      TEXT UNIQUE,         -- Google Places ID — UNIQUE prevents duplicate addresses
  lat           NUMERIC(9,6),        -- latitude  e.g. 40.712776 (9 digits, 6 decimal)
  lng           NUMERIC(9,6),        -- longitude e.g. -74.005974
  formatted_address TEXT,            -- full human-readable string from Google

  avg_rating    NUMERIC(3,2) DEFAULT 0,
  -- NUMERIC(3,2) = up to 3 digits total, 2 after decimal → max 9.99
  -- Automatically recalculated by the trigger on every review change

  review_count  INT DEFAULT 0,
  -- Automatically incremented/decremented by trigger
  -- Cached here so we don't need COUNT(*) on every page load

  -- Extra fields added for LandLORDER!:
  has_property_manager  TEXT,        -- "yes" | "no" | "unknown"
  property_manager_name TEXT,        -- name/company of the manager (nullable)
  landlord_in_state     TEXT,        -- "yes" | "no" | "unknown"

  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: reviews
-- Purpose: one row per tenant review
-- Linked to landlords and users via foreign keys
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  landlord_id   UUID REFERENCES landlords(id) ON DELETE CASCADE,
  -- REFERENCES landlords(id) = foreign key — must match a real landlord UUID
  -- ON DELETE CASCADE = if the landlord is deleted, all their reviews are deleted too

  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  -- ON DELETE SET NULL = if a user deletes their account, reviews stay
  -- but user_id becomes NULL (review remains, author anonymised)

  rating        INT CHECK (rating BETWEEN 1 AND 5),
  -- CHECK constraint = Postgres rejects any value outside 1–5 at the DB level
  -- Protects data integrity even if frontend/backend validation is bypassed

  text          TEXT NOT NULL,       -- the written review body

  -- Category sub-ratings (optional — same 1–5 constraint)
  communication INT CHECK (communication BETWEEN 1 AND 5),
  maintenance   INT CHECK (maintenance BETWEEN 1 AND 5),
  fairness      INT CHECK (fairness BETWEEN 1 AND 5),

  anonymous     BOOLEAN DEFAULT TRUE,
  -- TRUE = hide the user's email in API responses
  -- Backend query uses CASE WHEN anonymous THEN NULL ELSE email END

  flagged       BOOLEAN DEFAULT FALSE,
  -- TRUE = review is hidden from all public queries
  -- Set by POST /reviews/:id/flag, cleared by admin

  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FUNCTION: update_landlord_rating
-- Purpose: recalculates avg_rating and review_count on the
-- landlords table whenever a review is inserted, updated, or deleted
-- This runs INSIDE Postgres — no extra API call needed
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION update_landlord_rating()
RETURNS TRIGGER AS $$  -- $$ = start of function body in PL/pgSQL
BEGIN
  UPDATE landlords SET

    avg_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)  -- AVG of all ratings, rounded to 2 decimal places
      FROM reviews
      WHERE landlord_id = NEW.landlord_id    -- NEW = the row just inserted/updated
        AND flagged = FALSE                  -- exclude flagged reviews from the average
    ),

    review_count = (
      SELECT COUNT(*)                        -- total number of non-flagged reviews
      FROM reviews
      WHERE landlord_id = NEW.landlord_id
        AND flagged = FALSE
    )

  WHERE id = NEW.landlord_id;  -- only update the specific landlord this review belongs to
  RETURN NEW;                  -- required by Postgres — returns the row to complete the operation
END;
$$ LANGUAGE plpgsql;           -- tells Postgres this is written in PL/pgSQL (Postgres's own language)


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TRIGGER: wires the function to the reviews table
-- Fires AFTER any INSERT, UPDATE, or DELETE on reviews
-- FOR EACH ROW = runs once per affected row (not once per query)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TRIGGER after_review_insert
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_landlord_rating();
