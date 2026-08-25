-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: plans
-- Purpose: billing tiers (free, landlord_pro, etc)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS plans (
  id                TEXT PRIMARY KEY,
  -- 'tenant', 'landlord_pro', 'landlord_business', etc.

  name              TEXT NOT NULL,
  -- "Tenant (Free)", "Landlord Pro", etc.

  price_monthly     NUMERIC(10,2),
  price_annual      NUMERIC(10,2),

  -- Feature gates (what this plan includes)
  max_reviews       INT DEFAULT 3,
  max_listings      INT DEFAULT 0,
  can_respond       BOOLEAN DEFAULT FALSE,
  can_claim         BOOLEAN DEFAULT FALSE,
  has_analytics     BOOLEAN DEFAULT FALSE,
  has_api           BOOLEAN DEFAULT FALSE,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate plans
INSERT INTO plans (id, name, price_monthly, price_annual, max_reviews, max_listings, can_respond, can_claim, has_analytics, has_api)
VALUES
  ('tenant', 'Tenant (Free)', 0, 0, 3, 0, FALSE, FALSE, FALSE, FALSE),
  ('landlord_pro', 'Landlord Pro', 9.99, 99.99, NULL, 1, TRUE, TRUE, TRUE, FALSE),
  ('landlord_business', 'Landlord Business', 29.99, 299.99, NULL, NULL, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: subscriptions
-- Purpose: tracks billing status for each user
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS subscriptions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                   TEXT NOT NULL DEFAULT 'tenant' REFERENCES plans(id),

  status                    TEXT DEFAULT 'active',
  -- 'active', 'past_due', 'cancelled'

  stripe_customer_id        TEXT,
  stripe_subscription_id    TEXT UNIQUE,
  stripe_price_id           TEXT,

  billing_period            TEXT DEFAULT 'monthly',
  -- 'monthly' or 'annual'

  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN DEFAULT FALSE,
  -- If TRUE, subscription will cancel when period ends (but still active until then)

  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: usage_events
-- Purpose: tracks user actions for quota enforcement
-- (one row per action: review_submitted, listing_added)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS usage_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  event_type        TEXT NOT NULL,
  -- 'review_submitted', 'listing_added'

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: review_responses
-- Purpose: landlord responses to tenant reviews
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS review_responses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  review_id         UUID NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  -- UNIQUE = only one response per review

  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The landlord/manager responding

  text              TEXT NOT NULL,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_responses_review_id ON review_responses(review_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLE: landlord_profiles
-- Purpose: claims + ownership verification for landlords
-- A user can own multiple landlord profiles
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS landlord_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  landlord_id       UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  verified          BOOLEAN DEFAULT FALSE,
  -- TRUE = admin has confirmed this user owns this landlord
  -- Allows responding to reviews, analytics, etc.

  verified_at       TIMESTAMPTZ,
  verified_by       UUID REFERENCES users(id),
  -- Admin who verified ownership

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (landlord_id, user_id)
  -- One user can't claim the same landlord twice
);

CREATE INDEX IF NOT EXISTS idx_landlord_profiles_user_id ON landlord_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_landlord_profiles_verified ON landlord_profiles(verified);
