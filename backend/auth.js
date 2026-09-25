const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// In a real deployment, set JWT_SECRET in your environment instead of
// relying on this fallback — see server/.env.example.
const JWT_SECRET = process.env.JWT_SECRET || "otherwise-dev-secret-change-me";
const TOKEN_TTL = "30d";

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function checkPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function issueToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Attaches req.userId if a valid Bearer token is present. Does not reject
// the request either way — routes decide for themselves whether a given
// action requires a signed-in user (see requireAuth below).
function attachUser(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.userId = payload.sub;
    } catch (e) {
      // invalid/expired token — treat the request as anonymous
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: "Sign in required." });
  next();
}

module.exports = { hashPassword, checkPassword, issueToken, attachUser, requireAuth };
