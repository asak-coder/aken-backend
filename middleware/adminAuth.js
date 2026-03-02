const { sendError } = require("../utils/apiResponse");
const { getTokenFromRequest, verifySessionToken } = require("../utils/authCookies");

function requireAdminSession(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return sendError(res, req, {
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Login required.",
      });
    }

    const decoded = verifySessionToken(token);
    req.user = decoded;

    return next();
  } catch (error) {
    return sendError(res, req, {
      statusCode: 401,
      code: "AUTH_INVALID_SESSION",
      message: "Invalid or expired session. Please login again.",
      err: error,
    });
  }
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return sendError(res, req, {
        statusCode: 403,
        code: "AUTH_FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
    }

    return next();
  };
}

module.exports = {
  requireAdminSession,
  requireRole,
};
