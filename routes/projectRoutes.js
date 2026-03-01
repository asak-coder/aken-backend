const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Lead = require("../models/Lead");
const Project = require("../models/Project");
const Material = require("../models/Material");
const LabourEntry = require("../models/LabourEntry");
const BOQ = require("../models/BOQ");
const Invoice = require("../models/Invoice");
const calculateMargin = require("../utils/marginCalculator");
const { leadMutationLimiter } = require("../middleware/rateLimiters");
const { sendError, sendSuccess } = require("../utils/apiResponse");

const PROJECT_STATUS_VALUES = ["Planning", "In Progress", "Completed"];
const SITE_STATUS_VALUES = [
  "Not Started",
  "Foundation",
  "Structure",
  "Cladding",
  "Finishing",
  "Completed",
];

function sanitizeText(value, maxLength = 180) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseMoney(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parseProgress(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, parsed));
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parsePositiveInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function isValidObjectId(value) {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

function toPercentage(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function sumBy(items, resolver) {
  return items.reduce((sum, item) => sum + parseMoney(resolver(item), 0), 0);
}

function computeTotalSpent(payload) {
  const categoryTotal =
    (payload.materialCost || 0) +
    (payload.labourCost || 0) +
    (payload.equipmentCost || 0) +
    (payload.otherCost || 0) +
    (payload.dailyExpense || 0);

  if (categoryTotal > 0) {
    return categoryTotal;
  }

  return payload.budgetSpent || 0;
}

function projectPayloadFromBody(body, mode = "create") {
  const errors = [];
  const payload = {};
  let hasSpendInput = false;

  const putTextField = (key, maxLength, required = false) => {
    if (body[key] === undefined) {
      if (required && mode === "create") {
        errors.push(`${key} is required.`);
      }
      return;
    }

    const value = sanitizeText(body[key], maxLength);
    if (!value) {
      if (required) {
        errors.push(`${key} cannot be empty.`);
      }
      return;
    }

    payload[key] = value;
  };

  putTextField("projectName", 180, true);
  putTextField("clientName", 180, true);
  putTextField("projectOwner", 80, false);

  if (body.projectValue !== undefined || mode === "create") {
    const value = parseMoney(body.projectValue, NaN);
    if (!Number.isFinite(value)) {
      errors.push("projectValue must be a non-negative number.");
    } else {
      payload.projectValue = value;
    }
  }

  if (body.status !== undefined) {
    const status = sanitizeText(body.status, 40);
    if (!PROJECT_STATUS_VALUES.includes(status)) {
      errors.push(`status must be one of: ${PROJECT_STATUS_VALUES.join(", ")}`);
    } else {
      payload.status = status;
    }
  }

  if (body.siteStatus !== undefined) {
    const siteStatus = sanitizeText(body.siteStatus, 40);
    if (!SITE_STATUS_VALUES.includes(siteStatus)) {
      errors.push(
        `siteStatus must be one of: ${SITE_STATUS_VALUES.join(", ")}`,
      );
    } else {
      payload.siteStatus = siteStatus;
    }
  }

  const moneyFields = [
    "budgetAllocated",
    "budgetSpent",
    "materialCost",
    "labourCost",
    "equipmentCost",
    "otherCost",
    "dailyExpense",
  ];

  for (const field of moneyFields) {
    if (body[field] === undefined) {
      continue;
    }

    const parsed = parseMoney(body[field], NaN);
    if (!Number.isFinite(parsed)) {
      errors.push(`${field} must be a non-negative number.`);
      continue;
    }

    payload[field] = parsed;
    hasSpendInput = true;
  }

  if (body.progressPercentage !== undefined) {
    const parsed = parseProgress(body.progressPercentage, NaN);
    if (!Number.isFinite(parsed)) {
      errors.push("progressPercentage must be between 0 and 100.");
    } else {
      payload.progressPercentage = parsed;
    }
  }

  if (body.startDate !== undefined) {
    const parsed = parseDate(body.startDate);
    if (!parsed) {
      errors.push("startDate must be a valid date.");
    } else {
      payload.startDate = parsed;
    }
  }

  if (body.expectedCompletion !== undefined) {
    const parsed = parseDate(body.expectedCompletion);
    if (!parsed) {
      errors.push("expectedCompletion must be a valid date.");
    } else {
      payload.expectedCompletion = parsed;
    }
  }

  if (body.leadId !== undefined) {
    if (!isValidObjectId(body.leadId)) {
      errors.push("leadId must be a valid ObjectId.");
    } else {
      payload.leadId = body.leadId;
    }
  }

  if (body.quotationId !== undefined) {
    if (!isValidObjectId(body.quotationId)) {
      errors.push("quotationId must be a valid ObjectId.");
    } else {
      payload.quotationId = body.quotationId;
    }
  }

  if (mode === "create" || hasSpendInput) {
    payload.totalSpent = computeTotalSpent(payload);
  }

  if (payload.status === "Completed") {
    payload.progressPercentage = 100;
    payload.siteStatus = "Completed";
  }

  if (errors.length > 0) {
    return { errors };
  }

  return { payload };
}

function buildProjectNameFromLead(lead) {
  const companyName = sanitizeText(lead.companyName || "Client", 120) || "Client";
  const today = new Date().toISOString().slice(0, 10);
  return `${companyName} Project ${today}`;
}

async function buildProjectMarginContext(project) {
  const [materials, labourEntries, boqRows, invoices] = await Promise.all([
    Material.find({ projectId: project._id })
      .select("plannedQty usedQty receivedQty rate")
      .lean(),
    LabourEntry.find({ projectId: project._id }).select("totalCost").lean(),
    BOQ.find({ projectId: project._id }).select("actualCost").lean(),
    Invoice.find({ projectId: project._id }).select("amount paidAmount").lean(),
  ]);

  const plannedMaterialCost = sumBy(materials, (item) => {
    return parseMoney(item.plannedQty, 0) * parseMoney(item.rate, 0);
  });

  const trackedMaterialCost = sumBy(materials, (item) => {
    const qty = parseMoney(item.usedQty, 0) || parseMoney(item.receivedQty, 0);
    return qty * parseMoney(item.rate, 0);
  });

  const trackedLabourCost = sumBy(labourEntries, (item) => item.totalCost);
  const trackedBoqCost = sumBy(boqRows, (item) => item.actualCost);

  const resolvedMaterialCost =
    parseMoney(project.materialCost, 0) > 0
      ? parseMoney(project.materialCost, 0)
      : trackedMaterialCost;

  const resolvedLabourCost =
    parseMoney(project.labourCost, 0) > 0
      ? parseMoney(project.labourCost, 0)
      : trackedLabourCost;

  const resolvedEquipmentCost = parseMoney(project.equipmentCost, 0);
  const resolvedOtherCost = parseMoney(project.otherCost, 0);
  const resolvedDailyExpense = parseMoney(project.dailyExpense, 0);

  const estimatedCostFromBreakdown =
    (parseMoney(project.materialCost, 0) > 0
      ? parseMoney(project.materialCost, 0)
      : plannedMaterialCost) +
    (parseMoney(project.labourCost, 0) > 0
      ? parseMoney(project.labourCost, 0)
      : trackedLabourCost) +
    resolvedEquipmentCost +
    resolvedOtherCost +
    resolvedDailyExpense;

  const actualCostFromBreakdown =
    resolvedMaterialCost +
    resolvedLabourCost +
    resolvedEquipmentCost +
    resolvedOtherCost +
    resolvedDailyExpense;

  const reconciledActualCost = Math.max(
    parseMoney(project.totalSpent, 0),
    actualCostFromBreakdown,
  );

  const estimatedCost =
    parseMoney(project.budgetAllocated, 0) > 0
      ? parseMoney(project.budgetAllocated, 0)
      : estimatedCostFromBreakdown;

  const invoicedAmount = sumBy(invoices, (item) => item.amount);
  const receivedAmount = sumBy(invoices, (item) => item.paidAmount);
  const outstandingAmount = Math.max(0, invoicedAmount - receivedAmount);

  const margin = calculateMargin(project, {
    estimatedCost,
    actualCost: reconciledActualCost,
    budgetAllocated: project.budgetAllocated,
    budgetSpent: reconciledActualCost,
    progressPercentage: project.progressPercentage,
  });

  return {
    margin,
    costBreakdown: {
      materialCost: resolvedMaterialCost,
      labourCost: resolvedLabourCost,
      equipmentCost: resolvedEquipmentCost,
      otherCost: resolvedOtherCost,
      dailyExpense: resolvedDailyExpense,
      totalCost: margin.actual.cost,
      plannedMaterialCost,
      trackedMaterialCost,
      trackedLabourCost,
      trackedBoqCost,
    },
    invoicing: {
      invoicedAmount,
      receivedAmount,
      outstandingAmount,
      collectionPercentage: toPercentage(receivedAmount, invoicedAmount),
      revenueRealizationPercentage: toPercentage(receivedAmount, margin.revenue),
    },
    dataSources: {
      materialsTracked: materials.length,
      labourEntriesTracked: labourEntries.length,
      boqRowsTracked: boqRows.length,
      invoicesTracked: invoices.length,
    },
  };
}

function riskScore(level) {
  if (level === "Loss") {
    return 4;
  }

  if (level === "High") {
    return 3;
  }

  if (level === "Watch") {
    return 2;
  }

  return 1;
}

router.get("/summary", async (req, res) => {
  try {
    const [summary, marginRows] = await Promise.all([
      Project.aggregate([
        {
          $group: {
            _id: null,
            totalProjects: { $sum: 1 },
            planningProjects: {
              $sum: { $cond: [{ $eq: ["$status", "Planning"] }, 1, 0] },
            },
            inProgressProjects: {
              $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] },
            },
            completedProjects: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
            },
            totalProjectValue: { $sum: { $ifNull: ["$projectValue", 0] } },
            totalSpent: { $sum: { $ifNull: ["$totalSpent", 0] } },
            averageProgress: { $avg: { $ifNull: ["$progressPercentage", 0] } },
          },
        },
        { $project: { _id: 0 } },
      ]),
      Project.find()
        .select("projectValue totalSpent budgetAllocated progressPercentage")
        .lean(),
    ]);

    const marginAggregate = marginRows.reduce(
      (acc, row) => {
        const margin = calculateMargin(row);
        acc.totalExpectedMargin += margin.expected.marginPercentage;
        acc.totalActualMargin += margin.actual.marginPercentage;

        if (margin.actual.profit < 0) {
          acc.lossMakingProjects += 1;
        }

        if (margin.signals.riskLevel === "High" || margin.signals.riskLevel === "Loss") {
          acc.highRiskProjects += 1;
        }

        return acc;
      },
      {
        totalExpectedMargin: 0,
        totalActualMargin: 0,
        lossMakingProjects: 0,
        highRiskProjects: 0,
      },
    );

    const marginDivisor = marginRows.length || 1;

    return sendSuccess(res, req, {
      totalProjects: Number(summary?.[0]?.totalProjects) || 0,
      planningProjects: Number(summary?.[0]?.planningProjects) || 0,
      inProgressProjects: Number(summary?.[0]?.inProgressProjects) || 0,
      completedProjects: Number(summary?.[0]?.completedProjects) || 0,
      totalProjectValue: Number(summary?.[0]?.totalProjectValue) || 0,
      totalSpent: Number(summary?.[0]?.totalSpent) || 0,
      averageProgress: Number(summary?.[0]?.averageProgress || 0).toFixed(1),
      averageExpectedMargin: Number(
        (marginAggregate.totalExpectedMargin / marginDivisor).toFixed(2),
      ),
      averageActualMargin: Number(
        (marginAggregate.totalActualMargin / marginDivisor).toFixed(2),
      ),
      highRiskProjects: marginAggregate.highRiskProjects,
      lossMakingProjects: marginAggregate.lossMakingProjects,
    });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "PROJECT_SUMMARY_FETCH_FAILED",
      message: "Unable to fetch project summary.",
      err: error,
    });
  }
});

router.get("/margin/overview", async (req, res) => {
  try {
    const [projects, invoiceAgg] = await Promise.all([
      Project.find()
        .select("projectName projectValue budgetAllocated totalSpent progressPercentage status")
        .lean(),
      Invoice.aggregate([
        {
          $group: {
            _id: null,
            invoicedAmount: { $sum: { $ifNull: ["$amount", 0] } },
            receivedAmount: { $sum: { $ifNull: ["$paidAmount", 0] } },
          },
        },
      ]),
    ]);

    const totals = {
      projects: projects.length,
      revenue: 0,
      expectedCost: 0,
      actualCost: 0,
      expectedProfit: 0,
      actualProfit: 0,
      expectedMarginPercentage: 0,
      actualMarginPercentage: 0,
      overBudgetProjects: 0,
      lossMakingProjects: 0,
    };

    const distribution = {
      Healthy: 0,
      Watch: 0,
      High: 0,
      Loss: 0,
    };

    const riskRows = [];

    for (const project of projects) {
      const margin = calculateMargin(project);

      totals.revenue += margin.revenue;
      totals.expectedCost += margin.expected.cost;
      totals.actualCost += margin.actual.cost;
      totals.expectedProfit += margin.expected.profit;
      totals.actualProfit += margin.actual.profit;

      if (margin.signals.overBudget) {
        totals.overBudgetProjects += 1;
      }

      if (margin.actual.profit < 0) {
        totals.lossMakingProjects += 1;
      }

      distribution[margin.signals.riskLevel] += 1;

      riskRows.push({
        projectId: project._id,
        projectName: project.projectName,
        projectValue: margin.revenue,
        totalCost: margin.actual.cost,
        profit: margin.actual.profit,
        actualMarginPercentage: margin.actual.marginPercentage,
        expectedMarginPercentage: margin.expected.marginPercentage,
        riskLevel: margin.signals.riskLevel,
        riskReasons: margin.signals.riskReasons,
        riskScore: riskScore(margin.signals.riskLevel),
      });
    }

    totals.expectedMarginPercentage = toPercentage(
      totals.expectedProfit,
      totals.revenue,
    );
    totals.actualMarginPercentage = toPercentage(
      totals.actualProfit,
      totals.revenue,
    );

    const invoiceTotals = invoiceAgg[0] || {};
    const invoicedAmount = parseMoney(invoiceTotals.invoicedAmount, 0);
    const receivedAmount = parseMoney(invoiceTotals.receivedAmount, 0);
    const outstandingAmount = Math.max(0, invoicedAmount - receivedAmount);

    const topRiskProjects = riskRows
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) {
          return b.riskScore - a.riskScore;
        }

        return a.actualMarginPercentage - b.actualMarginPercentage;
      })
      .slice(0, 8)
      .map(({ riskScore: _riskScore, ...row }) => row);

    return sendSuccess(res, req, {
      generatedAt: new Date().toISOString(),
      totals,
      distribution,
      topRiskProjects,
      invoicing: {
        invoicedAmount,
        receivedAmount,
        outstandingAmount,
        collectionPercentage: toPercentage(receivedAmount, invoicedAmount),
        revenueRealizationPercentage: toPercentage(receivedAmount, totals.revenue),
      },
    });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "PROJECT_MARGIN_OVERVIEW_FAILED",
      message: "Unable to fetch margin overview.",
      err: error,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1, 1, 5000);
    const limit = parsePositiveInteger(req.query.limit, 20, 1, 100);
    const skip = (page - 1) * limit;

    const filter = {};
    const status = sanitizeText(req.query.status, 40);
    const siteStatus = sanitizeText(req.query.siteStatus, 40);

    if (status && PROJECT_STATUS_VALUES.includes(status)) {
      filter.status = status;
    }

    if (siteStatus && SITE_STATUS_VALUES.includes(siteStatus)) {
      filter.siteStatus = siteStatus;
    }

    if (isValidObjectId(req.query.leadId)) {
      filter.leadId = req.query.leadId;
    }

    if (isValidObjectId(req.query.quotationId)) {
      filter.quotationId = req.query.quotationId;
    }

    const [items, totalItems] = await Promise.all([
      Project.find(filter)
        .populate("leadId", "contactPerson companyName status owner")
        .populate("quotationId", "quotationNumber status totalAmount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter),
    ]);

    const itemsWithMargin = items.map((item) => {
      const plain = item.toObject();
      const margin = calculateMargin(item);

      return {
        ...plain,
        marginSnapshot: {
          actualMarginPercentage: margin.actual.marginPercentage,
          actualProfit: margin.actual.profit,
          riskLevel: margin.signals.riskLevel,
        },
      };
    });

    return sendSuccess(res, req, {
      items: itemsWithMargin,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "PROJECT_FETCH_FAILED",
      message: "Unable to fetch projects.",
      err: error,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("leadId", "contactPerson companyName status owner")
      .populate("quotationId", "quotationNumber status totalAmount");

    if (!project) {
      return sendError(res, req, {
        statusCode: 404,
        code: "PROJECT_NOT_FOUND",
        message: "Project not found.",
      });
    }

    return sendSuccess(res, req, project);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "PROJECT_DETAIL_FETCH_FAILED",
      message: "Unable to fetch project details.",
      err: error,
    });
  }
});

router.post("/", leadMutationLimiter, async (req, res) => {
  try {
    const { payload, errors } = projectPayloadFromBody(req.body, "create");

    if (errors?.length) {
      return sendError(res, req, {
        statusCode: 400,
        code: "PROJECT_VALIDATION_FAILED",
        message: "Validation failed.",
        details: errors,
      });
    }

    const project = await Project.create(payload);
    return sendSuccess(res, req, project, 201);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "PROJECT_CREATE_FAILED",
      message: "Unable to create project.",
      err: error,
    });
  }
});

router.post("/from-lead/:leadId", leadMutationLimiter, async (req, res) => {
  try {
    const leadId = req.params.leadId;
    if (!isValidObjectId(leadId)) {
      return sendError(res, req, {
        statusCode: 400,
        code: "INVALID_LEAD_ID",
        message: "leadId is invalid.",
      });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return sendError(res, req, {
        statusCode: 404,
        code: "LEAD_NOT_FOUND",
        message: "Lead not found.",
      });
    }

    if (lead.status !== "Closed") {
      return sendError(res, req, {
        statusCode: 409,
        code: "LEAD_NOT_CLOSED",
        message: "Only Closed leads can be converted to projects.",
      });
    }

    const existingProject = await Project.findOne({ leadId: lead._id });
    if (existingProject) {
      return sendSuccess(res, req, {
        alreadyExists: true,
        project: existingProject,
      });
    }

    const project = await Project.create({
      leadId: lead._id,
      projectName: buildProjectNameFromLead(lead),
      clientName: sanitizeText(lead.companyName || "Unknown Client", 180),
      projectOwner: sanitizeText(lead.owner || "Unassigned", 80) || "Unassigned",
      projectValue: parseMoney(lead.dealValue, 0),
      status: "Planning",
      siteStatus: "Not Started",
      progressPercentage: 0,
      startDate: new Date(),
    });

    return sendSuccess(res, req, {
      alreadyExists: false,
      project,
    }, 201);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "PROJECT_LEAD_CONVERT_FAILED",
      message: "Unable to convert lead to project.",
      err: error,
    });
  }
});

router.put("/:id", leadMutationLimiter, async (req, res) => {
  try {
    const { payload, errors } = projectPayloadFromBody(req.body, "update");

    if (errors?.length) {
      return sendError(res, req, {
        statusCode: 400,
        code: "PROJECT_VALIDATION_FAILED",
        message: "Validation failed.",
        details: errors,
      });
    }

    if (Object.keys(payload).length === 0) {
      return sendError(res, req, {
        statusCode: 400,
        code: "PROJECT_UPDATE_EMPTY",
        message: "No valid fields provided for update.",
      });
    }

    const project = await Project.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!project) {
      return sendError(res, req, {
        statusCode: 404,
        code: "PROJECT_NOT_FOUND",
        message: "Project not found.",
      });
    }

    return sendSuccess(res, req, project);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "PROJECT_UPDATE_FAILED",
      message: "Unable to update project.",
      err: error,
    });
  }
});

router.get("/:id/margin", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return sendError(res, req, {
        statusCode: 404,
        code: "PROJECT_NOT_FOUND",
        message: "Project not found.",
      });
    }

    const context = await buildProjectMarginContext(project);

    return sendSuccess(res, req, {
      projectId: project._id,
      projectName: project.projectName,
      status: project.status,
      ...context.margin,
      costBreakdown: context.costBreakdown,
      invoicing: context.invoicing,
      dataSources: context.dataSources,
    });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "PROJECT_MARGIN_FAILED",
      message: "Unable to calculate project margin.",
      err: error,
    });
  }
});

module.exports = router;