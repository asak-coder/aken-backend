const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authLoginLimiter } = require("../middleware/rateLimiters");
const { sendError, sendSuccess } = require("../utils/apiResponse");

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

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return sendError(res, req, {
        statusCode: 401,
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid credentials.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, req, {
        statusCode: 401,
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid credentials.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return sendError(res, req, {
        statusCode: 500,
        code: "AUTH_CONFIG_ERROR",
        message: "JWT secret is not configured.",
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return sendSuccess(res, req, { token, role: user.role });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "AUTH_LOGIN_FAILED",
      message: "Unable to process login.",
      err: error,
    });
  }
});

module.exports = router;
