// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// middleware/requirePlan.js — Plan Feature Gates
//
// Middleware factories that check if a user's current plan
// has a specific feature enabled (can_respond, can_claim, etc.)
// or if they've used up their annual quota (reviews, listings).
//
// Usage (feature gate):
//   router.post('/reviews/:id/respond', auth, requirePlan('can_respond'), handler)
//
// Usage (quota):
//   router.post('/reviews', auth, requireReviewQuota, handler)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const pool = require('../db/pool');

// ─────────────────────────────────────────────────────────────────
// requirePlan(featureName): checks if plan has feature enabled
// ─────────────────────────────────────────────────────────────────
const requirePlan = (featureName) => {
  return async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT
           p.${featureName}
         FROM subscriptions s
         LEFT JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = $1`,
        [req.user.userId]
      );

      if (!rows.length) {
        return res.status(403).json({
          error: `This feature requires a paid plan`,
          feature: featureName,
        });
      }

      const hasFeature = rows[0][featureName];
      if (!hasFeature) {
        return res.status(403).json({
          error: `Your current plan does not include this feature`,
          feature: featureName,
          required_plan: 'landlord_pro',
        });
      }

      next();

    } catch (err) {
      console.error('requirePlan error:', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  };
};

// ─────────────────────────────────────────────────────────────────
// requireReviewQuota: enforces annual review limit
// ─────────────────────────────────────────────────────────────────
const requireReviewQuota = async (req, res, next) => {
  try {
    // Get the user's plan
    const planRow = await pool.query(
      `SELECT p.max_reviews
       FROM subscriptions s
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1`,
      [req.user.userId]
    );

    if (!planRow.rows.length) {
      return res.status(403).json({ error: 'Subscription not found' });
    }

    const maxReviews = planRow.rows[0].max_reviews;

    // NULL = unlimited (paid plans)
    if (maxReviews === null) {
      return next();
    }

    // Count reviews submitted this calendar year
    const countRow = await pool.query(
      `SELECT COUNT(*) FROM usage_events
       WHERE user_id = $1
         AND event_type = 'review_submitted'
         AND created_at >= date_trunc('year', NOW())`,
      [req.user.userId]
    );

    const reviewsThisYear = parseInt(countRow.rows[0].count);

    if (reviewsThisYear >= maxReviews) {
      return res.status(403).json({
        error: `Review limit reached for this year`,
        used: reviewsThisYear,
        limit: maxReviews,
        resets: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
      });
    }

    next();

  } catch (err) {
    console.error('requireReviewQuota error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────
// requireListingQuota: enforces annual listing limit
// ─────────────────────────────────────────────────────────────────
const requireListingQuota = async (req, res, next) => {
  try {
    const planRow = await pool.query(
      `SELECT p.max_listings
       FROM subscriptions s
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1`,
      [req.user.userId]
    );

    if (!planRow.rows.length) {
      return res.status(403).json({ error: 'Subscription not found' });
    }

    const maxListings = planRow.rows[0].max_listings;

    if (maxListings === null) {
      return next();  // Unlimited
    }

    const countRow = await pool.query(
      `SELECT COUNT(*) FROM usage_events
       WHERE user_id = $1
         AND event_type = 'listing_added'
         AND created_at >= date_trunc('year', NOW())`,
      [req.user.userId]
    );

    const listingsThisYear = parseInt(countRow.rows[0].count);

    if (listingsThisYear >= maxListings) {
      return res.status(403).json({
        error: `Listing limit reached for this year`,
        used: listingsThisYear,
        limit: maxListings,
        resets: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
      });
    }

    next();

  } catch (err) {
    console.error('requireListingQuota error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  requirePlan,
  requireReviewQuota,
  requireListingQuota,
};
