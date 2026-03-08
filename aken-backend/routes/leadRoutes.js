const express = require("express");
const router = express.Router();
const { requireAdminSession, requireRole } = require("../middleware/adminAuth");
const { csrfProtection } = require("../middleware/csrf");
const Lead = require("../models/Lead");
const Project = require("../models/Project");
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

const LEAD_STATUS_ORDER = ["New", "Contacted", "Quoted", "Closed"];

function parseIntegerInRange(rawValue, defaultValue, min, max) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

function buildMonthTemplate(monthCount, now) {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  });
  const months = [];

  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const startDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const month = String(startDate.getMonth() + 1).padStart(2, "0");
    const key = `${startDate.getFullYear()}-${month}`;

    months.push({
      key,
      label: formatter.format(startDate),
      startDate,
    });
  }

  return months;
}

function normalizeGroupingValue(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function toTitleCase(value) {
  return String(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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
// GET - Lead Analytics Summary
// ===============================
router.get(
  "/analytics/summary",
  requireAdminSession,
  requireRole(["admin"]),
  async (req, res) => {
  try {
    const months = parseIntegerInRange(req.query.months, 6, 3, 24);
    const sourceLimit = parseIntegerInRange(req.query.sourceLimit, 8, 3, 20);
    const ownerLimit = parseIntegerInRange(req.query.ownerLimit, 8, 3, 20);

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthTemplate = buildMonthTemplate(months, now);
    const trendStart =
      monthTemplate[0]?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);

    const [analytics] = await Lead.aggregate([
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalLeads: { $sum: 1 },
                newLeads: {
                  $sum: { $cond: [{ $eq: ["$status", "New"] }, 1, 0] },
                },
                contactedLeads: {
                  $sum: { $cond: [{ $eq: ["$status", "Contacted"] }, 1, 0] },
                },
                quotedLeads: {
                  $sum: { $cond: [{ $eq: ["$status", "Quoted"] }, 1, 0] },
                },
                closedLeads: {
                  $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] },
                },
                wonRevenue: {
                  $sum: {
                    $cond: [
                      { $eq: ["$status", "Closed"] },
                      { $ifNull: ["$dealValue", 0] },
                      0,
                    ],
                  },
                },
                pipelineRevenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["New", "Contacted", "Quoted"]] },
                      { $ifNull: ["$dealValue", 0] },
                      0,
                    ],
                  },
                },
                weightedPipelineRevenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["New", "Contacted", "Quoted"]] },
                      {
                        $multiply: [
                          { $ifNull: ["$dealValue", 0] },
                          { $divide: [{ $ifNull: ["$probability", 50] }, 100] },
                        ],
                      },
                      0,
                    ],
                  },
                },
                last7DaysLeads: {
                  $sum: {
                    $cond: [{ $gte: ["$createdAt", sevenDaysAgo] }, 1, 0],
                  },
                },
                last30DaysLeads: {
                  $sum: {
                    $cond: [{ $gte: ["$createdAt", thirtyDaysAgo] }, 1, 0],
                  },
                },
              },
            },
            { $project: { _id: 0 } },
          ],
          statusDistribution: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          sourceDistribution: [
            {
              $project: {
                sourceNormalized: {
                  $toLower: {
                    $trim: { input: { $ifNull: ["$utmSource", ""] } },
                  },
                },
              },
            },
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: ["$sourceNormalized", ""] },
                    "direct",
                    "$sourceNormalized",
                  ],
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1, _id: 1 } },
            { $limit: sourceLimit },
          ],
          ownerDistribution: [
            {
              $project: {
                ownerNormalized: {
                  $trim: { input: { $ifNull: ["$owner", ""] } },
                },
              },
            },
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: ["$ownerNormalized", ""] },
                    "Unassigned",
                    "$ownerNormalized",
                  ],
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1, _id: 1 } },
            { $limit: ownerLimit },
          ],
          monthlyTrend: [
            { $match: { createdAt: { $gte: trendStart } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m",
                    date: "$createdAt",
                  },
                },
                leads: { $sum: 1 },
                quotedLeads: {
                  $sum: { $cond: [{ $eq: ["$status", "Quoted"] }, 1, 0] },
                },
                closedLeads: {
                  $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] },
                },
                wonRevenue: {
                  $sum: {
                    $cond: [
                      { $eq: ["$status", "Closed"] },
                      { $ifNull: ["$dealValue", 0] },
                      0,
                    ],
                  },
                },
                pipelineRevenue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["New", "Contacted", "Quoted"]] },
                      { $ifNull: ["$dealValue", 0] },
                      0,
                    ],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
          recentLeads: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                _id: 1,
                contactPerson: 1,
                companyName: 1,
                status: 1,
                owner: 1,
                utmSource: 1,
                dealValue: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const overviewDefaults = {
      totalLeads: 0,
      newLeads: 0,
      contactedLeads: 0,
      quotedLeads: 0,
      closedLeads: 0,
      wonRevenue: 0,
      pipelineRevenue: 0,
      weightedPipelineRevenue: 0,
      last7DaysLeads: 0,
      last30DaysLeads: 0,
    };

    const overviewRaw = analytics?.overview?.[0] || {};
    const overview = {
      ...overviewDefaults,
      ...overviewRaw,
    };

    const totalLeads = Number(overview.totalLeads) || 0;
    const closedLeads = Number(overview.closedLeads) || 0;
    const quotedLeads = Number(overview.quotedLeads) || 0;
    const wonRevenue = Number(overview.wonRevenue) || 0;

    const conversionRate = totalLeads === 0
      ? 0
      : Number(((closedLeads / totalLeads) * 100).toFixed(1));

    const quoteRate = totalLeads === 0
      ? 0
      : Number((((quotedLeads + closedLeads) / totalLeads) * 100).toFixed(1));

    const avgDealSize = closedLeads === 0
      ? 0
      : Number((wonRevenue / closedLeads).toFixed(2));

    const statusCounts = new Map();
    for (const item of analytics?.statusDistribution || []) {
      statusCounts.set(item._id, item.count);
    }

    const statusDistribution = LEAD_STATUS_ORDER.map((status) => {
      const count = Number(statusCounts.get(status)) || 0;
      return {
        status,
        count,
        percentage: totalLeads === 0
          ? 0
          : Number(((count / totalLeads) * 100).toFixed(1)),
      };
    });

    for (const item of analytics?.statusDistribution || []) {
      if (LEAD_STATUS_ORDER.includes(item._id)) {
        continue;
      }

      const count = Number(item.count) || 0;
      statusDistribution.push({
        status: normalizeGroupingValue(item._id, "Unknown"),
        count,
        percentage: totalLeads === 0
          ? 0
          : Number(((count / totalLeads) * 100).toFixed(1)),
      });
    }

    const sourceDistribution = (analytics?.sourceDistribution || []).map((item) => {
      const sourceKey = normalizeGroupingValue(item._id, "direct").toLowerCase();
      const source = sourceKey === "direct" ? "Direct / Unknown" : toTitleCase(sourceKey);
      const count = Number(item.count) || 0;
      return {
        source,
        count,
        percentage: totalLeads === 0
          ? 0
          : Number(((count / totalLeads) * 100).toFixed(1)),
      };
    });

    const ownerDistribution = (analytics?.ownerDistribution || []).map((item) => {
      const owner = normalizeGroupingValue(item._id, "Unassigned");
      const count = Number(item.count) || 0;
      return {
        owner,
        count,
        percentage: totalLeads === 0
          ? 0
          : Number(((count / totalLeads) * 100).toFixed(1)),
      };
    });

    const monthlyMap = new Map();
    for (const item of analytics?.monthlyTrend || []) {
      monthlyMap.set(item._id, item);
    }

    const monthlyTrend = monthTemplate.map((month) => {
      const item = monthlyMap.get(month.key) || {};
      const leads = Number(item.leads) || 0;
      const monthClosedLeads = Number(item.closedLeads) || 0;
      const monthQuotedLeads = Number(item.quotedLeads) || 0;

      return {
        month: month.label,
        key: month.key,
        leads,
        quotedLeads: monthQuotedLeads,
        closedLeads: monthClosedLeads,
        wonRevenue: Number(item.wonRevenue) || 0,
        pipelineRevenue: Number(item.pipelineRevenue) || 0,
        conversionRate: leads === 0
          ? 0
          : Number(((monthClosedLeads / leads) * 100).toFixed(1)),
      };
    });

    const recentLeadsRaw = analytics?.recentLeads || [];
    const recentLeadIds = recentLeadsRaw.map((lead) => lead._id).filter(Boolean);
    const projectsForRecentLeads = recentLeadIds.length > 0
      ? await Project.find({ leadId: { $in: recentLeadIds } })
          .select("leadId projectName status")
          .lean()
      : [];
    const projectByLeadId = new Map(
      projectsForRecentLeads.map((project) => [
        String(project.leadId),
        {
          projectId: project._id,
          projectName: project.projectName,
          projectStatus: project.status,
        },
      ]),
    );

    const recentLeads = recentLeadsRaw.map((lead) => ({
      ...lead,
      status: normalizeGroupingValue(lead.status, "New"),
      owner: normalizeGroupingValue(lead.owner, "Unassigned"),
      source: normalizeGroupingValue(lead.utmSource, "Direct / Unknown"),
      project: projectByLeadId.get(String(lead._id)) || null,
    }));

    return sendSuccess(res, req, {
      generatedAt: now.toISOString(),
      rangeMonths: months,
      overview: {
        ...overview,
        wonRevenue,
        pipelineRevenue: Number(overview.pipelineRevenue) || 0,
        weightedPipelineRevenue: Number(overview.weightedPipelineRevenue) || 0,
        conversionRate,
        quoteRate,
        avgDealSize,
      },
      statusDistribution,
      sourceDistribution,
      ownerDistribution,
      monthlyTrend,
      recentLeads,
    });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "LEAD_ANALYTICS_FETCH_FAILED",
      message: "Unable to fetch lead analytics",
      err: error,
    });
  }
});


// ===============================
// GET - Fetch All Leads
// ===============================
router.get("/", requireAdminSession, requireRole(["admin"]), async (req, res) => {
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
router.put(
  "/:id/status",
  requireAdminSession,
  requireRole(["admin"]),
  csrfProtection,
  leadMutationLimiter,
  validateLeadStatusUpdate,
  async (req, res) => {
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
router.put(
  "/:id/owner",
  requireAdminSession,
  requireRole(["admin"]),
  csrfProtection,
  leadMutationLimiter,
  validateLeadOwnerUpdate,
  async (req, res) => {
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
router.post(
  "/:id/notifications/retry",
  requireAdminSession,
  requireRole(["admin"]),
  csrfProtection,
  leadMutationLimiter,
  async (req, res) => {
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
router.post(
  "/:id/whatsapp/retry",
  requireAdminSession,
  requireRole(["admin"]),
  csrfProtection,
  leadMutationLimiter,
  async (req, res) => {
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
router.put(
  "/:id",
  requireAdminSession,
  requireRole(["admin"]),
  csrfProtection,
  leadMutationLimiter,
  validateLeadUpdate,
  async (req, res) => {
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
router.post(
  "/:id/notes",
  requireAdminSession,
  requireRole(["admin"]),
  csrfProtection,
  async (req, res) => {
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
router.get(
  "/client/:quotationNumber",
  requireAdminSession,
  requireRole(["admin"]),
  async (req, res) => {
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
  },
);

module.exports = router;
