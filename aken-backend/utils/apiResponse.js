const { log } = require("./requestLogger");

function sendError(res, req, options = {}) {
  const statusCode = options.statusCode || 500;
  const code = options.code || "INTERNAL_ERROR";
  const message = options.message || "Internal server error";
  const details = options.details || null;
  const err = options.err || null;
  const context = options.context || {};

  if (err) {
    log("error", req, message, {
      code,
      statusCode,
      context,
      errMessage: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    });
  } else {
    log("warn", req, message, {
      code,
      statusCode,
      context,
    });
  }

  const payload = {
    success: false,
    error: {
      code,
      message,
    },
    requestId: req?.requestId || null,
  };

  if (details) {
    payload.error.details = details;
  }

  if (process.env.NODE_ENV !== "production" && err && err.stack) {
    payload.error.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
}

function sendSuccess(res, req, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    requestId: req?.requestId || null,
  });
}

module.exports = {
  sendError,
  sendSuccess,
};
