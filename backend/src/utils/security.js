const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// CRIT-2 FIX: JWT secrets MUST be set via environment variables.
// In production, missing secrets will cause immediate startup failure.
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('FATAL: JWT_SECRET environment variable is required in production'); })()
  : 'wellx989-dev-only-jwt-key-DO-NOT-USE-IN-PRODUCTION');

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is required in production'); })()
  : 'wellx989-dev-only-refresh-key-DO-NOT-USE-IN-PRODUCTION');

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password using bcrypt
 * @param {string} plainPassword 
 * @returns {Promise<string>}
 */
async function hashPassword(plainPassword) {
  if (!plainPassword || !String(plainPassword).trim()) {
    throw new Error('Password cannot be empty');
  }
  return await bcrypt.hash(String(plainPassword).trim(), SALT_ROUNDS);
}

/**
 * Compare plain text password against stored value.
 * Supports hybrid/legacy passwords: if stored password is plain text,
 * compares directly and flags `needsUpgrade: true` so it can be hashed on-the-fly.
 * @param {string} plainPassword 
 * @param {string} storedPassword 
 * @returns {Promise<{ valid: boolean, needsUpgrade: boolean }>}
 */
async function comparePassword(plainPassword, storedPassword) {
  if (!plainPassword || !storedPassword) {
    return { valid: false, needsUpgrade: false };
  }

  const cleanPlain = String(plainPassword).trim();
  const cleanStored = String(storedPassword).trim();

  // Check if storedPassword is a Bcrypt hash ($2a$, $2b$, or $2y$)
  const isBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(cleanStored);

  if (isBcryptHash) {
    try {
      const match = await bcrypt.compare(cleanPlain, cleanStored);
      return { valid: match, needsUpgrade: false };
    } catch (err) {
      return { valid: false, needsUpgrade: false };
    }
  }

  // Legacy plaintext match
  const match = (cleanPlain === cleanStored);
  return { valid: match, needsUpgrade: match };
}

/**
 * Sign an Access Token
 * @param {object} payload 
 * @param {string|number} expiresIn - Default '1d' for web, or custom like '15m'
 * @returns {string}
 */
function signAccessToken(payload, expiresIn = '1d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Sign a Refresh Token
 * @param {object} payload 
 * @param {string|number} expiresIn - Default '30d'
 * @returns {string}
 */
function signRefreshToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn });
}

/**
 * Verify an Access Token — CRIT-3 FIX: Legacy token regex backdoor REMOVED.
 * Only properly signed JWT tokens are accepted now.
 * @param {string} token 
 * @returns {object|null}
 */
function verifyAccessToken(token) {
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    // CRIT-3 FIX: No more legacy token pattern matching.
    // All legacy tokens (wellx989-jwt-admin-*, wellx989-jwt-employee-*, demo)
    // are now rejected. Users must re-authenticate with proper JWT tokens.
    return null;
  }
}

/**
 * Verify a Refresh Token
 * @param {string} token 
 * @returns {object|null}
 */
function verifyRefreshToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  // NOTE: JWT_SECRET is NOT exported — prevents accidental exposure in controllers
};
