const express = require("express");
const router = express.Router();

const { requireAdminSession, requireRole } = require("../middleware/adminAuth");
const { csrfProtection } = require("../middleware/csrf");
const { quotationCreateLimiter, quotationConvertLimiter } = require("../middleware/rateLimiters");

const Quotation = require("../models/Quotation");
const Project = require("../models/Project");
const Lead = require("../models/Lead");
const generatePDF = require("../utils/generateQuotationPDF");
const sendEmail = require("../utils/sendEmail");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const { log } = require("../utils/requestLogger");
const { quotationValidation } = require("../middleware/quotationValidation");
const { mapDuplicateKeyError } = require("../utils/duplicateKeyError");
const { createProjectSafely } = require("../utils/projectConversion");

router.post(
  "/:id/convert",
  requireAdminSession,
  requireRole(["admin"]),
  csrfProtection,
  quotationConvertLimiter,
  async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate("leadId");
    if (!quotation) {
      return sendError(res, req, {
        statusCode: 404,
        code: "QUOTATION_NOT_FOUND",
        message: "Quotation not found",
      });
    }

    // Fast path: cheap already-exists check for the common (non-racing) case.
    const existingProject = await Project.findOne({ quotationId: quotation._id });
    if (existingProject) {
      return sendSuccess(res, req, {
        alreadyExists: true,
        project: existingProject,
      });
    }

    const lead = quotation.leadId?._id
      ? await Lead.findById(quotation.leadId._id)
      : null;

    // Concurrency-safe insert (F3): if a concurrent request committed first
    // (either this quotation, or the lead path /from-lead/:leadId for the same
    // lead), SQLSTATE 23505 is mapped back to the established alreadyExists
    // response. Re-read by quotationId first, then fall back to the lead's
    // project so a cross-endpoint winner is returned, not an error.
    const result = await createProjectSafely({
      payload: {
        quotationId: quotation._id,
        leadId: lead?._id || null,
        projectName: `Project - ${quotation.quotationNumber || quotation._id}`,
        clientName:
          quotation.leadId?.companyName || req.body?.clientName || "Unknown Client",
        projectOwner: lead?.owner || "Unassigned",
        projectValue: quotation.totalAmount || 0,
      },
      findExisting: async () => {
        const byQuotation = await Project.findOne({ quotationId: quotation._id });
        if (byQuotation) {
          return byQuotation;
        }

        if (lead) {
          return Project.findOne({ leadId: lead._id });
        }

        return null;
      },
    });

    if (result.duplicateConflict) {
      // Unique conflict but the winning row was not (yet) observable. Keep the
      // race out of the 500 path with a stable, documented duplicate response.
      return sendError(res, req, {
        statusCode: 409,
        code: "DUPLICATE_PROJECT_FOR_LEAD",
        message:
          "A project for this lead already exists. Re-fetch the project list to see it.",
        err: result.error,
      });
    }

    // Winner-only side effects: the losing request must not re-write the
    // quotation/lead rows (no audit churn, no lost updates on status).
    if (!result.alreadyExists) {
      quotation.status = "Approved";
      await quotation.save({ validateBeforeSave: false });

      if (lead && lead.status !== "Closed") {
        lead.status = "Closed";
        await lead.save();
      }
    }

    return sendSuccess(res, req, {
      alreadyExists: result.alreadyExists,
      project: result.project,
    });
  } catch (error) {
    const duplicate = mapDuplicateKeyError(error, "quotations");
    if (duplicate) {
      return sendError(res, req, {
        statusCode: duplicate.statusCode,
        code: duplicate.code,
        message: duplicate.message,
        flat: true,
        err: error,
      });
    }

    return sendError(res, req, {
      statusCode: 500,
      code: "QUOTATION_CONVERT_FAILED",
      message: "Unable to convert quotation to project.",
      err: error,
    });
  }
});

router.post(
  "/",
  requireAdminSession,
  requireRole(["admin"]),
  csrfProtection,
  quotationCreateLimiter,
  quotationValidation,
  async (req, res) => {
  try {
    const quotation = await Quotation.create(req.body);

    const shouldGeneratePdf =
      String(process.env.QUOTATION_GENERATE_PDF || "true").toLowerCase() === "true";
    const clientEmail = req.body?.clientEmail;

    let pdfBuffer = null;
    if (shouldGeneratePdf && clientEmail && sendEmail.isEmailConfigured()) {
      pdfBuffer = await generatePDF(quotation);
    }

    if (clientEmail && sendEmail.isEmailConfigured()) {
      try {
        const mailOptions = {
          to: clientEmail,
          subject: `Quotation ${quotation.quotationNumber || quotation._id}`,
          text: "Please find attached quotation.",
        };

        if (pdfBuffer) {
          mailOptions.attachments = [
            {
              filename: "quotation.pdf",
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ];
        }

        await sendEmail(mailOptions);
      } catch (error) {
        log("error", req, "Quotation email delivery failed", {
          quotationId: String(quotation._id),
          errMessage: error.message,
        });
      }
    }

    return sendSuccess(res, req, quotation, 201);
  } catch (error) {
    const duplicate = mapDuplicateKeyError(error, "quotations");
    if (duplicate) {
      return sendError(res, req, {
        statusCode: duplicate.statusCode,
        code: duplicate.code,
        message: duplicate.message,
        flat: true,
        err: error,
      });
    }

    return sendError(res, req, {
      statusCode: 500,
      code: "QUOTATION_CREATE_FAILED",
      message: "Unable to create quotation.",
      err: error,
    });
  }
});

router.get("/", requireAdminSession, requireRole(["admin"]), async (req, res) => {
  try {
    const quotations = await Quotation.find().populate("leadId");
    return sendSuccess(res, req, quotations);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "QUOTATION_FETCH_FAILED",
      message: "Unable to fetch quotations.",
      err: error,
    });
  }
});

module.exports = router;
