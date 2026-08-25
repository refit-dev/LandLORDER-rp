// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// routes/landlords.js — Landlord Search, Create, Claim
//
// GET  /api/landlords/search         — search by name/address (public)
// GET  /api/landlords/:id            — get landlord details (public)
// POST /api/landlords                — create new landlord listing (public)
// POST /api/landlords/:id/claim      — claim a property (auth)
// GET  /api/landlords/claimed        — get user's claimed properties (auth)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const { requireListingQuota } = require('../middleware/requirePlan');

// ── GET /api/landlords/search ─────────────────────────────────────
// Searches landlords by name or address using full-text or ILIKE.
// Public — no auth required.
router.get('/search', async (req, res) => {
  const { q, lat, lng, radius } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query (q) is required' });
  }

  try {
    let sql = `
      SELECT id, name, company, address, city, state, zip,
             formatted_address, lat, lng, avg_rating, review_count
      FROM landlords
      WHERE name ILIKE $1 OR address ILIKE $1 OR company ILIKE $1
    `;
    const params = [`%${q}%`];

    // Optional: filter by distance if lat/lng provided
    if (lat && lng && radius) {
      sql += ` AND (
        6371 * acos(
          cos(radians($2)) * cos(radians(lat)) *
          cos(radians(lng) - radians($3)) +
          sin(radians($2)) * sin(radians(lat))
        ) < $4
      )`;
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(radius));
    }

    sql += ` ORDER BY review_count DESC LIMIT 20`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);

  } catch (err) {
    console.error('Landlord search error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/landlords/:id ────────────────────────────────────────
// Gets full details of a specific landlord including reviews.
// Public — no auth required.
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, company, address, city, state, zip, country,
              formatted_address, lat, lng, place_id,
              avg_rating, review_count,
              has_property_manager, property_manager_name,
              landlord_in_state, created_at
       FROM landlords
       WHERE id = $1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error('Get landlord error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/landlords ───────────────────────────────────────────
// Creates a new landlord listing in the database.
// Public — anyone can add a landlord (first review/listing).
// Expects Google Places data (address, lat/lng, place_id).
router.post('/', async (req, res) => {
  const {
    name, company, address, city, state, zip, country,
    formatted_address, lat, lng, place_id,
    has_property_manager, property_manager_name, landlord_in_state
  } = req.body;

  if (!name || !address) {
    return res.status(400).json({ error: 'Name and address are required' });
  }

  try {
    // Check if this place_id already exists (prevents duplicates)
    if (place_id) {
      const existing = await pool.query(
        'SELECT id FROM landlords WHERE place_id = $1',
        [place_id]
      );
      if (existing.rows.length) {
        return res.status(409).json({
          error: 'This property is already listed',
          id: existing.rows[0].id,
        });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO landlords
         (name, company, address, city, state, zip, country,
          formatted_address, lat, lng, place_id,
          has_property_manager, property_manager_name, landlord_in_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        name, company, address, city, state, zip, country,
        formatted_address,
        lat ? parseFloat(lat) : null,
        lng ? parseFloat(lng) : null,
        place_id,
        has_property_manager,
        property_manager_name,
        landlord_in_state,
      ]
    );

    res.status(201).json(rows[0]);

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This property is already listed' });
    }
    console.error('Create landlord error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/landlords/:id/claim ─────────────────────────────────
// Claims a landlord property for verified ownership/management.
// Requires: auth + claim feature + quota.
// Sets up a landlord_profile row (pending verification).
router.post('/:id/claim', auth, requireListingQuota, async (req, res) => {
  try {
    // Check if landlord exists
    const landlord = await pool.query(
      'SELECT id FROM landlords WHERE id = $1',
      [req.params.id]
    );
    if (!landlord.rows.length) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    // Check if user already claimed this property
    const existing = await pool.query(
      'SELECT id FROM landlord_profiles WHERE landlord_id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'You have already claimed this property' });
    }

    // Create claim (pending verification)
    const { rows } = await pool.query(
      `INSERT INTO landlord_profiles (landlord_id, user_id, verified)
       VALUES ($1, $2, FALSE)
       RETURNING *`,
      [req.params.id, req.user.userId]
    );

    // Record usage event for quota
    await pool.query(
      `INSERT INTO usage_events (user_id, event_type)
       VALUES ($1, 'listing_added')`,
      [req.user.userId]
    );

    res.status(201).json({
      ...rows[0],
      message: 'Property claimed. Verification pending.',
    });

  } catch (err) {
    console.error('Claim property error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/landlords/claimed ────────────────────────────────────
// Gets all properties claimed by the current user.
// Requires: auth.
router.get('/user/claimed', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         lp.id, lp.landlord_id, lp.verified, lp.verified_at,
         l.name, l.address, l.city, l.state, l.formatted_address,
         l.avg_rating, l.review_count
       FROM landlord_profiles lp
       JOIN landlords l ON lp.landlord_id = l.id
       WHERE lp.user_id = $1
       ORDER BY lp.created_at DESC`,
      [req.user.userId]
    );

    res.json(rows);

  } catch (err) {
    console.error('Get claimed properties error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
