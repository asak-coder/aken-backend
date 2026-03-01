const express = require("express");

const router = express.Router();

const { sendSuccess, sendError } = require("../utils/apiResponse");
const { getBackendEnvDiagnostics } = require("../utils/envValidation");

router.get("/env-check", async (req, res) => {
  try {
    const diagnostics = getBackendEnvDiagnostics();
    return sendSuccess(res, req, diagnostics);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "SYSTEM_ENV_CHECK_FAILED",
      message: "Unable to compute environment diagnostics.",
      err: error,
    });
  }
});

module.exports = router;

