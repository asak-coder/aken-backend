const crypto = require("crypto");
const { sendError } = require("../utils/apiResponse");
const { log } = require("../utils/requestLogger");

function safeHash(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function parseBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || "").trim();
  if (!header) return null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  return token.length ? token : null;
}

function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function requireWebhookBearerToken(options = {}) {
  const envKey = options.envKey || "WHATSAPP_WEBHOOK_TOKEN";

  return function webhookBearerTokenMiddleware(req, res, next) {
    const configured = String(process.env[envKey] || "").trim();

    // If token isn't configured, fail closed in production; allow in dev for local testing.
    if (!configured) {
      if (process.env.NODE_ENV === "production") {
        log("warn", req, "Webhook auth rejected (missing server token config)", {
          envKey,
          ip: req.ip,
        });
        return sendError(res, req, {
          statusCode: 503,
          code: "WEBHOOK_AUTH_NOT_CONFIGURED",
          message: "Webhook authentication is not configured.",
        });
      }

      return next();
    }

    const token = parseBearerToken(req.headers.authorization);

    if (!token) {
      log("warn", req, "Webhook auth rejected (missing bearer token)", {
        envKey,
        ip: req.ip,
      });
      return sendError(res, req, {
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Missing bearer token.",
      });
    }

    if (!timingSafeEqualString(token, configured)) {
      log("warn", req, "Webhook auth rejected (invalid bearer token)", {
        envKey,
        ip: req.ip,
        tokenHash: safeHash(token),
      });
      return sendError(res, req, {
        statusCode: 403,
        code: "FORBIDDEN",
        message: "Invalid bearer token.",
      });
    }

    return next();
  };
}

module.exports = {
  requireWebhookBearerToken,
};
