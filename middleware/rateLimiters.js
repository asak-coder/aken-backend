const rateLimit = require("express-rate-limit");

const isProduction = process.env.NODE_ENV === "production";

function byEnvironment(productionValue, developmentValue) {
  return isProduction ? productionValue : developmentValue;
}

function buildLimiter({ windowMs, max, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { error: message },
  });
}

const apiLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: byEnvironment(300, 3000),
  message: "Too many API requests. Please try again shortly.",
});

const leadCreateLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: byEnvironment(8, 200),
  message: "Too many enquiries from this IP. Please wait 10 minutes.",
});

const leadMutationLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: byEnvironment(80, 1000),
  message: "Too many lead updates. Please wait and try again.",
});

const authLoginLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: byEnvironment(5, 100),
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please wait 15 minutes.",
});

module.exports = {
  apiLimiter,
  leadCreateLimiter,
  leadMutationLimiter,
  authLoginLimiter,
};
