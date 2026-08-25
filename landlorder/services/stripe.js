// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// services/stripe.js — Stripe API Integration
//
// Handles:
//   - Creating checkout sessions for upgrades
//   - Creating customer portal sessions for billing management
//   - Mapping Stripe price IDs to local plan IDs
//   - Webhook signature verification (exported to billing.js)
//
// Requires environment variables:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL
//   STRIPE_PRICE_BUSINESS_MONTHLY, STRIPE_PRICE_BUSINESS_ANNUAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const Stripe = require('stripe');
const pool = require('../db/pool');

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',  // use the latest stable API version
});

// ─────────────────────────────────────────────────────────────────
// Price ID → Plan ID mapping
// Maps Stripe price IDs to local plan identifiers
// ─────────────────────────────────────────────────────────────────
const priceToPlanMap = {
  [process.env.STRIPE_PRICE_PRO_MONTHLY]:       'landlord_pro',
  [process.env.STRIPE_PRICE_PRO_ANNUAL]:        'landlord_pro',
  [process.env.STRIPE_PRICE_BUSINESS_MONTHLY]:  'landlord_business',
  [process.env.STRIPE_PRICE_BUSINESS_ANNUAL]:   'landlord_business',
};

const getPlanFromPrice = (priceId) => {
  return priceToPlanMap[priceId] || 'tenant';
};

// ─────────────────────────────────────────────────────────────────
// createCheckoutSession(userId, email, priceId)
// Creates a Stripe Checkout session for a user to upgrade.
// Returns { url: 'https://checkout.stripe.com/...' }
// ─────────────────────────────────────────────────────────────────
const createCheckoutSession = async (userId, email, priceId) => {
  // Verify this is a valid price ID
  if (!Object.keys(priceToPlanMap).includes(priceId)) {
    throw new Error(`Invalid price ID: ${priceId}`);
  }

  try {
    // First, ensure a subscription row exists for this user
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id)
       VALUES ($1, 'tenant')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const session = await stripe.checkout.sessions.create({
      customer_email: email,

      mode: 'subscription',
      // mode = 'subscription' for recurring charges
      // (as opposed to mode = 'payment' for one-time purchases)

      line_items: [
        {
          price: priceId,
          // Stripe price ID — already configured in Stripe Dashboard
          quantity: 1,
        },
      ],

      success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL}/billing/cancel`,

      metadata: {
        landlorder_user_id: userId,
        // Custom metadata so webhook knows which user this is
      },
    });

    return session;

  } catch (err) {
    console.error('Checkout session error:', err.message);
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────
// createPortalSession(userId)
// Creates a Stripe Customer Portal link for billing management.
// Returns { url: 'https://billing.stripe.com/...' }
// ─────────────────────────────────────────────────────────────────
const createPortalSession = async (userId) => {
  try {
    // Get the user's Stripe customer ID from the subscriptions table
    const { rows } = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    if (!rows.length || !rows[0].stripe_customer_id) {
      throw new Error('User has no active Stripe customer ID');
    }

    const customerId = rows[0].stripe_customer_id;

    // Create a portal session for this customer
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/billing/manage`,
    });

    return session;

  } catch (err) {
    console.error('Portal session error:', err.message);
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────
// Helper: Update user's Stripe customer ID after checkout
// Called by the webhook when checkout.session.completed fires
// ─────────────────────────────────────────────────────────────────
const updateStripeCustomerId = async (userId, customerId) => {
  await pool.query(
    'UPDATE subscriptions SET stripe_customer_id = $1 WHERE user_id = $2',
    [customerId, userId]
  );
};

module.exports = {
  stripe,
  getPlanFromPrice,
  createCheckoutSession,
  createPortalSession,
  updateStripeCustomerId,
};
