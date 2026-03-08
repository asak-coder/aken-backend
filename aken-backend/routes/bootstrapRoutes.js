const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const rateLimit = require("express-rate-limit");

const router = express.Router();

function isBootstrapAllowed(userCount) {
  // Allowed when there are 0 users, OR when BOOTSTRAP_SECRET is configured and provided.
  return userCount === 0;
}

function isAdminResetAllowed() {
  // Admin-reset is a dangerous endpoint.
  // Keep it DISABLED by default and only enable temporarily when needed.
  const enabled =
    String(process.env.ENABLE_ADMIN_RESET || "").trim().toLowerCase() === "true";
  const token = String(process.env.ADMIN_RESET_TOKEN || "").trim();
  return enabled && Boolean(token);
}

const adminResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin reset attempts. Please wait 15 minutes." },
});

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

router.post("/admin", async (req, res) => {
  try {
    const requestedSecret =
      typeof req.headers["x-bootstrap-secret"] === "string"
        ? req.headers["x-bootstrap-secret"]
        : "";

    const configuredSecret = String(process.env.BOOTSTRAP_SECRET || "").trim();

    const userCount = await User.countDocuments();
    const allowedByEmptyDb = isBootstrapAllowed(userCount);
    const allowedBySecret =
      configuredSecret &&
      requestedSecret &&
      constantTimeEqual(configuredSecret, requestedSecret);

    if (!allowedByEmptyDb && !allowedBySecret) {
      return sendError(res, req, {
        statusCode: 403,
        code: "BOOTSTRAP_FORBIDDEN",
        message:
          "Bootstrap is disabled. It is only allowed on a fresh database (0 users) or with BOOTSTRAP_SECRET.",
      });
    }

    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "Admin";

    if (!email || !password) {
      return sendError(res, req, {
        statusCode: 400,
        code: "BOOTSTRAP_INPUT_INVALID",
        message: "email and password are required.",
      });
    }

    // Hard guard: only allow the specific first admin email configured.
    const allowedEmail = String(process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
    if (allowedEmail && email !== allowedEmail) {
      return sendError(res, req, {
        statusCode: 400,
        code: "BOOTSTRAP_EMAIL_NOT_ALLOWED",
        message: "This email is not allowed for admin bootstrap.",
      });
    }

    if (String(password).length < 12) {
      return sendError(res, req, {
        statusCode: 400,
        code: "BOOTSTRAP_PASSWORD_WEAK",
        message: "Password must be at least 12 characters.",
      });
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return sendError(res, req, {
        statusCode: 409,
        code: "BOOTSTRAP_USER_EXISTS",
        message: "A user with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: "admin",
      lastLoginAt: null,
    });

    return sendSuccess(
      res,
      req,
      {
        message: "Admin created successfully.",
        user: { id: user._id, email: user.email, role: user.role },
      },
      201,
    );
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "BOOTSTRAP_FAILED",
      message: "Unable to bootstrap admin.",
      err: error,
    });
  }
});

router.post("/admin-reset", adminResetLimiter, async (req, res) => {
  try {
    const requestedToken =
      typeof req.headers["x-admin-reset-token"] === "string"
        ? req.headers["x-admin-reset-token"]
        : "";

    if (!isAdminResetAllowed()) {
      return sendError(res, req, {
        statusCode: 403,
        code: "ADMIN_RESET_DISABLED",
        message: "Admin reset is disabled.",
      });
    }

    const configuredToken = String(process.env.ADMIN_RESET_TOKEN || "").trim();

    if (!configuredToken || !requestedToken || !constantTimeEqual(configuredToken, requestedToken)) {
      return sendError(res, req, {
        statusCode: 403,
        code: "ADMIN_RESET_FORBIDDEN",
        message: "Admin reset is disabled or token is invalid.",
      });
    }

    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "Admin";

    if (!email || !password) {
      return sendError(res, req, {
        statusCode: 400,
        code: "ADMIN_RESET_INPUT_INVALID",
        message: "email and password are required.",
      });
    }

    if (String(password).length < 12) {
      return sendError(res, req, {
        statusCode: 400,
        code: "ADMIN_RESET_PASSWORD_WEAK",
        message: "Password must be at least 12 characters.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Prefer updating existing admin user. If none, create one.
    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      existingAdmin.email = email;
      existingAdmin.name = name;
      existingAdmin.passwordHash = passwordHash;
      existingAdmin.lastLoginAt = null;
      await existingAdmin.save();

      // NOTE: We do NOT attempt to mutate process.env in production.
      // Render will re-inject env vars on restart. To disable, set:
      // ENABLE_ADMIN_RESET=false (and/or rotate ADMIN_RESET_TOKEN).

      return sendSuccess(res, req, {
        message: "Admin credentials reset successfully.",
        user: { id: existingAdmin._id, email: existingAdmin.email, role: existingAdmin.role },
      });
    }

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: "admin",
      lastLoginAt: null,
    });

    // NOTE: We do NOT attempt to mutate process.env in production.
    // Render will re-inject env vars on restart. To disable, set:
    // ENABLE_ADMIN_RESET=false (and/or rotate ADMIN_RESET_TOKEN).

    return sendSuccess(
      res,
      req,
      {
        message: "Admin created successfully.",
        user: { id: user._id, email: user.email, role: user.role },
      },
      201,
    );
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "ADMIN_RESET_FAILED",
      message: "Unable to reset admin credentials.",
      err: error,
    });
  }
});

module.exports = router;
