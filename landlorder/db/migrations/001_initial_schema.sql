-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration: 001_initial_schema
-- Description: Create initial tables (users, landlords, reviews)
-- Created: 2026-07-02
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- EXTENSION: enables UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: users
-- Purpose: stores registered user accounts
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: landlords
-- Purpose: stores each landlord or property listing
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS landlords (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                      TEXT NOT NULL,
  company                   TEXT,
  address                   TEXT NOT NULL,
  city                      TEXT,
  state                     TEXT,
  zip                       TEXT,
  country                   TEXT,
  place_id                  TEXT UNIQUE,
  lat                       NUMERIC(9,6),
  lng                       NUMERIC(9,6),
  formatted_address         TEXT,
  avg_rating                NUMERIC(3,2) DEFAULT 0,
  review_count              INT DEFAULT 0,
  has_property_manager      TEXT,
  property_manager_name     TEXT,
  landlord_in_state         TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: reviews
-- Purpose: one row per tenant review
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id       UUID REFERENCES landlords(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  rating            INT CHECK (rating BETWEEN 1 AND 5),
  text              TEXT NOT NULL,
  communication     INT CHECK (communication BETWEEN 1 AND 5),
  maintenance       INT CHECK (maintenance BETWEEN 1 AND 5),
  fairness          INT CHECK (fairness BETWEEN 1 AND 5),
  anonymous         BOOLEAN DEFAULT TRUE,
  flagged           BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FUNCTION: update_landlord_rating
-- Purpose: recalculates avg_rating and review_count on the
-- landlords table whenever a review is inserted, updated, or deleted
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION update_landlord_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE landlords SET
    avg_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM reviews
      WHERE landlord_id = NEW.landlord_id
        AND flagged = FALSE
    ),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE landlord_id = NEW.landlord_id
        AND flagged = FALSE
    )
  WHERE id = NEW.landlord_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TRIGGER: wires the function to the reviews table
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DROP TRIGGER IF EXISTS after_review_insert ON reviews;
CREATE TRIGGER after_review_insert
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_landlord_rating();

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reviews_landlord_id ON reviews(landlord_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_landlords_place_id ON landlords(place_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);