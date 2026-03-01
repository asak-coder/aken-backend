const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const Quotation = require("../models/Quotation");
const {
  validateCreateLead,
  validateLeadStatusUpdate,
  validateLeadUpdate,
  validateLeadOwnerUpdate,
} = require("../middleware/leadValidation");
const {
  leadCreateLimiter,
  leadMutationLimiter,
} = require("../middleware/rateLimiters");
const {
  resolveLeadOwnerAssignment,
} = require("../utils/ownerAssignment");
const {
  sendLeadNotificationEmails,
} = require("../utils/leadEmailNotifications");
const {
  sendLeadWhatsAppNotifications,
} = require("../utils/leadWhatsAppNotifications");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const { log } = require("../utils/requestLogger");

// ===============================
// POST - Create Lead
// ===============================
router.post("/", leadCreateLimiter, validateCreateLead, async (req, res) => {
  try {
    const ownerAssignment = await resolveLeadOwnerAssignment(
      req.validatedLead.owner,
    );
    const leadPayload = {
      ...req.validatedLead,
      ...ownerAssignment,
    };

    const lead = new Lead(leadPayload);
    await lead.save();

    // Non-blocking lead notifications (admin + client acknowledgement).
    sendLeadNotificationEmails(lead._id).catch((err) => {
      log("error", req, "Lead email notification failed", {
        leadId: String(lead._id),
        errMessage: err.message,
      });
    });
    sendLeadWhatsAppNotifications(lead._id).catch((err) => {
      log("error", req, "Lead WhatsApp notification failed", {
        leadId: String(lead._id),
        errMessage: err.message,
      });
    });

    return sendSuccess(res, req, {
      message: "Lead saved successfully",
      leadId: lead._id,
      owner: lead.owner,
      ownerId: lead.ownerId,
    }, 201);
  } catch (error) {
    return sendError(res, req, {
      statusCode: error.statusCode || 500,
      code: "LEAD_CREATE_FAILED",
      message: error.message || "Unable to create lead",
      err: error,
    });
  }
});


// ===============================
// GET - Fetch All Leads
// ===============================
router.get("/", async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    return sendSuccess(res, req, leads);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "LEAD_FETCH_FAILED",
      message: "Unable to fetch leads",
      err: error,
    });
  }
});
// CANONICAL: UPDATE LEAD STATUS
router.put("/:id/status", leadMutationLimiter, validateLeadStatusUpdate, async (req, res) => {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status: req.validatedStatus },
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      return sendError(res, req, {
        statusCode: 404,
        code: "LEAD_NOT_FOUND",
        message: "Lead not found",
      });
    }

    return sendSuccess(res, req, updatedLead);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "LEAD_STATUS_UPDATE_FAILED",
      message: "Unable to update lead status",
      err: error,
    });
  }
});
// CANONICAL: UPDATE LEAD OWNER
router.put("/:id/owner", leadMutationLimiter, validateLeadOwnerUpdate, async (req, res) => {
  try {
    const ownerAssignment = await resolveLeadOwnerAssignment(req.validatedOwner);
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      ownerAssignment,
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      return sendError(res, req, {
        statusCode: 404,
        code: "LEAD_NOT_FOUND",
        message: "Lead not found",
      });
    }

    return sendSuccess(res, req, updatedLead);
  } catch (error) {
    return sendError(res, req, {
      statusCode: error.statusCode || 500,
      code: "LEAD_OWNER_UPDATE_FAILED",
      message: error.message || "Unable to update lead owner",
      err: error,
    });
  }
});
// RETRY EMAIL NOTIFICATIONS FOR A LEAD (idempotent)
router.post("/:id/notifications/retry", leadMutationLimiter, async (req, res) => {
  try {
    const leadExists = await Lead.exists({ _id: req.params.id });
    if (!leadExists) {
      return sendError(res, req, {
        statusCode: 404,
        code: "LEAD_NOT_FOUND",
        message: "Lead not found",
      });
    }

    const result = await sendLeadNotificationEmails(req.params.id);
    return sendSuccess(res, req, {
      message: result.ok
        ? "Lead notifications processed successfully."
        : "Lead notifications processed with issues.",
      result,
    });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "LEAD_EMAIL_RETRY_FAILED",
      message: "Unable to retry lead email notifications",
      err: error,
    });
  }
});
// RETRY WHATSAPP NOTIFICATIONS FOR A LEAD (idempotent)
router.post("/:id/whatsapp/retry", leadMutationLimiter, async (req, res) => {
  try {
    const leadExists = await Lead.exists({ _id: req.params.id });
    if (!leadExists) {
      return sendError(res, req, {
        statusCode: 404,
        code: "LEAD_NOT_FOUND",
        message: "Lead not found",
      });
    }

    const result = await sendLeadWhatsAppNotifications(req.params.id);
    return sendSuccess(res, req, {
      message: result.ok
        ? "Lead WhatsApp notifications processed successfully."
        : "Lead WhatsApp notifications processed with issues.",
      result,
    });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "LEAD_WHATSAPP_RETRY_FAILED",
      message: "Unable to retry lead WhatsApp notifications",
      err: error,
    });
  }
});
// UPDATE LEAD DETAILS (status is intentionally excluded)
router.put("/:id", leadMutationLimiter, validateLeadUpdate, async (req, res) => {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.validatedLeadUpdate,
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      return sendError(res, req, {
        statusCode: 404,
        code: "LEAD_NOT_FOUND",
        message: "Lead not found",
      });
    }

    return sendSuccess(res, req, updatedLead);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "LEAD_UPDATE_FAILED",
      message: "Unable to update lead",
      err: error,
    });
  }
});
router.post("/:id/notes", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return sendError(res, req, {
        statusCode: 400,
        code: "INVALID_NOTE",
        message: "Note text is required.",
      });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return sendError(res, req, {
        statusCode: 404,
        code: "LEAD_NOT_FOUND",
        message: "Lead not found",
      });
    }

    lead.notes.push({
      text,
      addedBy: req.user?.id || "system",
    });

    await lead.save();
    return sendSuccess(res, req, { message: "Note added" });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "LEAD_NOTE_FAILED",
      message: "Unable to add note",
      err: error,
    });
  }
});
router.get("/client/:quotationNumber", async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      quotationNumber: req.params.quotationNumber,
    });

    if (!quotation) {
      return sendError(res, req, {
        statusCode: 404,
        code: "QUOTATION_NOT_FOUND",
        message: "Quotation not found",
      });
    }

    return sendSuccess(res, req, quotation);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "CLIENT_QUOTATION_FETCH_FAILED",
      message: "Unable to fetch client quotation",
      err: error,
    });
  }
});

module.exports = router;
