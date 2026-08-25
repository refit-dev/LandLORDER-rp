// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// index.js — Express Server Entry Point
//
// Initializes:
//   1. Environment variables (.env)
//   2. Database migrations
//   3. Middleware (CORS, body parsing)
//   4. Routes (auth, users, landlords, reviews, billing)
//   5. Stripe webhook (mounted before express.json!)
//   6. Error handling
//   7. Server startup on PORT
//
// To run:
//   npm install
//   node index.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─────────────────────────────────────────────────────────────────
// Step 1: Load environment variables from .env file
// ─────────────────────────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { runMigrations } = require('./db/migrations');

// ─────────────────────────────────────────────────────────────────
// Step 2: Initialize Express app
// ─────────────────────────────────────────────────────────────────
const app = express();

// ─────────────────────────────────────────────────────────────────
// Step 3: CORS configuration
// Allow frontend to make requests from different origins
// ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  // 5173 is Vite's default dev port
  credentials: true,
}));

// ─────────────────────────────────────────────────────────────────
// Step 4: STRIPE WEBHOOK (mounted BEFORE express.json()!)
// ⚠️  CRITICAL: Stripe webhook verification needs the raw request body.
// express.json() parses the body, destroying it for signature verification.
// This is why the webhook is mounted first, with express.raw().
// ─────────────────────────────────────────────────────────────────
const { router: billingRouter, webhookHandler } = require('./routes/billing');

app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);
// Now safe to add express.json() for all other routes

// ─────────────────────────────────────────────────────────────────
// Step 5: Body parsing middleware
// Parse JSON and URL-encoded request bodies
// ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────────
// Step 6: Mount route files
// ─────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const usersRoutes    = require('./routes/users');
const landlordRoutes = require('./routes/landlords');
const reviewsRoutes  = require('./routes/reviews');

app.use('/api/auth',      authRoutes);
app.use('/api/users',     usersRoutes);
app.use('/api/landlords', landlordRoutes);
app.use('/api/reviews',   reviewsRoutes);
app.use('/api/billing',   billingRouter);
// Note: /api/billing/webhook was already mounted above

// ─────────────────────────────────────────────────────────────────
// Step 7: Serve frontend (after API routes)
// In production, Vite builds to dist/ and we serve that.
// In dev, Vite dev server runs on :5173 separately (see vite.config.js)
// ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, 'dist');
  app.use(express.static(frontendPath));

  // SPA fallback: all non-API routes go to index.html (React Router)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ─────────────────────────────────────────────────────────────────
// Step 8: Error handling middleware
// Catches errors from routes and sends JSON response
// ─────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─────────────────────────────────────────────────────────────────
// Step 9: Run migrations and start server
// ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    // Run pending migrations on startup
    console.log('🔄 Running database migrations...');
    await runMigrations();

    // Start listening
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║                                        ║
║  🏠  LandLORDER Server Started         ║
║  🌐  http://localhost:${PORT}                ║
║  📡  API:  /api/*                      ║
║  💾  DB:  ${process.env.DATABASE_URL ? '✓' : '✗'}                    ║
║                                        ║
╚════════════════════════════════════════╝
      `);
    });

  } catch (err) {
    console.error('❌ Server startup failed:', err.message);
    process.exit(1);
  }
})();

// ─────────────────────────────────────────────────────────────────
// Graceful shutdown on SIGTERM (Docker, Kubernetes, etc.)
// ─────────────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
