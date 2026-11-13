import jwt from 'jsonwebtoken';
import 'dotenv/config';

// In production set JWT_SECRET in server/.env. The fallback is for local development only.
export const JWT_SECRET = process.env.JWT_SECRET || 'bookable-dev-secret-change-me';
const EXPIRES = '7d';

export const signToken = (user) => jwt.sign({ sub: String(user._id), u: user.username }, JWT_SECRET, { expiresIn: EXPIRES });

// Requires "Authorization: Bearer <token>"; sets req.userId.
export function requireAuth(req, res, next) {
  const h = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

// Optional auth: sets req.userId if a valid token is provided; proceeds as guest otherwise.
export function optionalAuth(req, res, next) {
  const h = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next();
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
  } catch {
    req.userId = null;
  }
  next();
}
