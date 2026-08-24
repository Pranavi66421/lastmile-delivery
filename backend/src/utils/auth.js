const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lastmile_jwt_secret_change_in_prod_2026';
const JWT_EXPIRY = '12h';

// Password Hashing Helper using native pbkdf2
function hashPassword(password) {
  const salt = 'think_lastmile_salt_123';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

module.exports = {
  JWT_SECRET,
  hashPassword,
  signToken
};
