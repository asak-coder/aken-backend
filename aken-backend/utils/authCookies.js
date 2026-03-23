const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const SESSION_COOKIE_NAME =
  String(process.env.NODE_ENV || "").toLowerCase() === "production"
    ? "__Host-aken_admin_session"
    : "aken_admin_session";
const CSRF_COOKIE_NAME = "aken_csrf";

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim().length < 32) {
    const error = new Error("JWT_SECRET is missing or too short (min 32 chars).");
    error.code = "JWT_SECRET_INVALID";
    throw error;
  }
  return secret;
}

function getCookieBaseOptions() {
  return {
    httpOnly: true,
    secure: isProduction(), // must be true in production (HTTPS)
    sameSite: "lax", // protects against CSRF on most cross-site requests
    path: "/",
  };
}

function getCookieDomain() {
  // IMPORTANT:
  // - If you use a __Host- cookie, you MUST NOT set a Domain attribute.
  // - This setup (frontend on Vercel, backend on Render) uses a Next.js server
  //   route as a same-origin "cookie setter", so host-only cookies are ideal.
  //
  // Only allow COOKIE_DOMAIN when not using __Host-.
  if (SESSION_COOKIE_NAME.startsWith("__Host-")) {
    return undefined;
  }

  // If you later want cross-subdomain cookies, set COOKIE_DOMAIN=.example.com (careful).
  const domain = process.env.COOKIE_DOMAIN;
  return domain ? String(domain).trim() : undefined;
}

function setSessionCookie(res, token) {
  const opts = {
    ...getCookieBaseOptions(),
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  };

  const domain = getCookieDomain();
  if (domain) opts.domain = domain;

  res.cookie(SESSION_COOKIE_NAME, token, opts);
}

function clearSessionCookie(res) {
  const opts = { ...getCookieBaseOptions(), maxAge: 0 };
  const domain = getCookieDomain();
  if (domain) opts.domain = domain;

  res.clearCookie(SESSION_COOKIE_NAME, opts);
}

function issueCsrfToken() {
  // Cryptographically-strong CSRF token.
  return crypto.randomBytes(32).toString("hex");
}

function setCsrfCookie(res, csrfToken) {
  const opts = {
    httpOnly: false, // must be readable by JS to send back in header
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  };

  const domain = getCookieDomain();
  if (domain) opts.domain = domain;

  res.cookie(CSRF_COOKIE_NAME, csrfToken, opts);
}

function getTokenFromRequest(req) {
  const raw = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function verifySessionToken(token) {
  const secret = requireJwtSecret();
  return jwt.verify(token, secret);
}

function signSessionToken(payload) {
  const secret = requireJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "1d" });
}

module.exports = {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  setSessionCookie,
  clearSessionCookie,
  setCsrfCookie,
  issueCsrfToken,
  getTokenFromRequest,
  verifySessionToken,
  signSessionToken,
  isProduction,
};
