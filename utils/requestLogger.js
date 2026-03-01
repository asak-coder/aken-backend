const crypto = require("crypto");

function createRequestId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildLogPayload(level, req, message, extra = {}) {
  return {
    ts: new Date().toISOString(),
    level,
    requestId: req?.requestId || null,
    method: req?.method || null,
    path: req?.originalUrl || req?.url || null,
    message,
    ...extra,
  };
}

function log(level, req, message, extra = {}) {
  const payload = buildLogPayload(level, req, message, extra);
  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

function requestIdMiddleware(req, res, next) {
  const incoming = req.headers["x-request-id"];
  req.requestId =
    typeof incoming === "string" && incoming.trim()
      ? incoming.trim()
      : createRequestId();

  res.setHeader("x-request-id", req.requestId);
  next();
}

module.exports = {
  createRequestId,
  log,
  requestIdMiddleware,
};
