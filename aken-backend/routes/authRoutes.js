const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { authLoginLimiter } = require("../middleware/rateLimiters");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const {
  signSessionToken,
  setSessionCookie,
  clearSessionCookie,
  issueCsrfToken,
  setCsrfCookie,
} = require("../utils/authCookies");
const { requireAdminSession } = require("../middleware/adminAuth");
const { csrfProtection } = require("../middleware/csrf");

const router = express.Router();

router.post("/login", authLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, req, {
        statusCode: 400,
        code: "LOGIN_INPUT_INVALID",
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() }).select(
      "+passwordHash",
    );
    if (!user) {
      return sendError(res, req, {
        statusCode: 401,
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid credentials.",
      });
    }

    const isMatch = user.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    if (!isMatch) {
      return sendError(res, req, {
        statusCode: 401,
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid credentials.",
      });
    }

    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    const token = signSessionToken({ id: user._id, role: user.role });

    setSessionCookie(res, token);
    const csrfToken = issueCsrfToken();
    setCsrfCookie(res, csrfToken);

    return sendSuccess(res, req, {
      role: user.role,
      csrfToken,
    });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "AUTH_LOGIN_FAILED",
      message: "Unable to process login.",
      err: error,
    });
  }
});

router.post("/logout", requireAdminSession, csrfProtection, (_req, res) => {
  clearSessionCookie(res);
  // Clear CSRF cookie by overwriting with an empty value and 0 maxAge.
  res.cookie("aken_csrf", "", {
    httpOnly: false,
    secure: String(process.env.NODE_ENV || "").toLowerCase() === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res.status(200).json({ success: true });
});

router.get("/session", requireAdminSession, (req, res) => {
  // Issue a fresh CSRF token to the client for subsequent unsafe requests.
  const csrfToken = issueCsrfToken();
  setCsrfCookie(res, csrfToken);

  return sendSuccess(res, req, {
    authenticated: true,
    user: { id: req.user.id, role: req.user.role },
    csrfToken,
  });
});

module.exports = router;
