const { sendError } = require("../utils/apiResponse");
const { CSRF_COOKIE_NAME } = require("../utils/authCookies");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
  const csrfHeader =
    req.headers["x-csrf-token"] || req.headers["x-csrf-token".toLowerCase()];

  const cookieValue = typeof csrfCookie === "string" ? csrfCookie : "";
  const headerValue = typeof csrfHeader === "string" ? csrfHeader : "";

  if (!cookieValue || !headerValue || cookieValue !== headerValue) {
    return sendError(res, req, {
      statusCode: 403,
      code: "CSRF_INVALID",
      message: "Security check failed. Please refresh and try again.",
    });
  }

  return next();
}

module.exports = {
  csrfProtection,
};
