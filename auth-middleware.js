// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// middleware/auth.js — JWT Verification Middleware
//
// Verifies the JWT token in the Authorization header.
// If valid, attaches req.user = { userId, email } and proceeds.
// If invalid or missing, returns 401 Unauthorized.
//
// Usage in protected routes:
//   router.post('/api/reviews', auth, async (req, res) => {
//     const userId = req.user.userId;  // ✓ safely available
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────────────
// auth middleware: checks Authorization header and verifies JWT
// ─────────────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  // Extract the token from "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);  // Remove "Bearer " prefix

  try {
    // Verify the token using the same secret used to sign it
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to the request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email,  // optional — may not be in token depending on how you signed it
    };

    next();  // Proceed to the route handler

  } catch (err) {
    // jwt.verify throws if:
    //   - signature is invalid (wrong secret)
    //   - token is expired
    //   - token is malformed
    console.error('JWT verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = auth;
