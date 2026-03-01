const express = require("express");

const router = express.Router();

const Lead = require("../models/Lead");
const Quotation = require("../models/Quotation");
const Project = require("../models/Project");
const Invoice = require("../models/Invoice");
const { sendError, sendSuccess } = require("../utils/apiResponse");

function parseIntegerInRange(rawValue, defaultValue, min, max) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

function toNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function toPercentage(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(1));
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

function normalizeSource(value) {
  if (typeof value !== "string") {
    return "direct";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "direct";
  }

  return normalized;
}

function sourceLabel(value) {
  if (value === "direct") {
    return "Direct / Unknown";
  }

  return String(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildMapByKey(items, key = "_id") {
  const map = new Map();
  for (const item of items || []) {
    map.set(String(item?.[key] || ""), item);
  }

  return map;
}

router.get("/overview", async (req, res) => {
  try {
    const months = parseIntegerInRange(req.query.months, 6, 3, 24);
    const sourceLimit = parseIntegerInRange(req.query.sourceLimit, 8, 3, 20);

    const now = new Date();
    const monthTemplate = buildMonthTemplate(months, now);
    const trendStart =
      monthTemplate[0]?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);

    const [leadAgg, quotationAgg, projectAgg, invoiceAgg] = await Promise.all([
      Lead.aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalLeads: { $sum: 1 },
                  openLeadCount: {
                    $sum: {
                      $cond: [{ $in: ["$status", ["New", "Contacted", "Quoted"]] }, 1, 0],
                    },
                  },
                  closedLeadCount: {
                    $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] },
                  },
                  openPipelineValue: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["New", "Contacted", "Quoted"]] },
                        { $ifNull: ["$dealValue", 0] },
                        0,
                      ],
                    },
                  },
                  weightedPipelineValue: {
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
                  closedRevenue: {
                    $sum: {
                      $cond: [
                        { $eq: ["$status", "Closed"] },
                        { $ifNull: ["$dealValue", 0] },
                        0,
                      ],
                    },
                  },
                },
              },
              { $project: { _id: 0 } },
            ],
            sourceDistribution: [
              {
                $project: {
                  source: {
                    $toLower: {
                      $trim: { input: { $ifNull: ["$utmSource", ""] } },
                    },
                  },
                  dealValue: { $ifNull: ["$dealValue", 0] },
                  weightedValue: {
                    $multiply: [
                      { $ifNull: ["$dealValue", 0] },
                      { $divide: [{ $ifNull: ["$probability", 50] }, 100] },
                    ],
                  },
                  isOpen: { $in: ["$status", ["New", "Contacted", "Quoted"]] },
                },
              },
              {
                $group: {
                  _id: {
                    $cond: [{ $eq: ["$source", ""] }, "direct", "$source"],
                  },
                  leads: { $sum: 1 },
                  pipelineValue: {
                    $sum: {
                      $cond: ["$isOpen", "$dealValue", 0],
                    },
                  },
                  weightedValue: {
                    $sum: {
                      $cond: ["$isOpen", "$weightedValue", 0],
                    },
                  },
                },
              },
              { $sort: { weightedValue: -1, leads: -1, _id: 1 } },
              { $limit: sourceLimit },
            ],
            stageDistribution: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                  value: { $sum: { $ifNull: ["$dealValue", 0] } },
                },
              },
              { $sort: { count: -1, _id: 1 } },
            ],
            monthly: [
              { $match: { createdAt: { $gte: trendStart } } },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: "%Y-%m",
                      date: "$createdAt",
                    },
                  },
                  leadsCreated: { $sum: 1 },
                  pipelineValueAdded: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["New", "Contacted", "Quoted"]] },
                        { $ifNull: ["$dealValue", 0] },
                        0,
                      ],
                    },
                  },
                  weightedPipelineAdded: {
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
                  closedRevenueAdded: {
                    $sum: {
                      $cond: [
                        { $eq: ["$status", "Closed"] },
                        { $ifNull: ["$dealValue", 0] },
                        0,
                      ],
                    },
                  },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),
      Quotation.aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalQuotations: { $sum: 1 },
                  draftCount: {
                    $sum: { $cond: [{ $eq: ["$status", "Draft"] }, 1, 0] },
                  },
                  sentCount: {
                    $sum: { $cond: [{ $eq: ["$status", "Sent"] }, 1, 0] },
                  },
                  approvedCount: {
                    $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
                  },
                  rejectedCount: {
                    $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] },
                  },
                  sentValue: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["Sent", "Approved"]] },
                        { $ifNull: ["$totalAmount", 0] },
                        0,
                      ],
                    },
                  },
                  approvedValue: {
                    $sum: {
                      $cond: [
                        { $eq: ["$status", "Approved"] },
                        { $ifNull: ["$totalAmount", 0] },
                        0,
                      ],
                    },
                  },
                },
              },
              { $project: { _id: 0 } },
            ],
            monthly: [
              { $match: { createdAt: { $gte: trendStart } } },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: "%Y-%m",
                      date: "$createdAt",
                    },
                  },
                  quotationCount: { $sum: 1 },
                  sentValue: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["Sent", "Approved"]] },
                        { $ifNull: ["$totalAmount", 0] },
                        0,
                      ],
                    },
                  },
                  approvedValue: {
                    $sum: {
                      $cond: [
                        { $eq: ["$status", "Approved"] },
                        { $ifNull: ["$totalAmount", 0] },
                        0,
                      ],
                    },
                  },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),
      Project.aggregate([
        {
          $facet: {
            totals: [
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
                  activeProjectValue: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["Planning", "In Progress"]] },
                        { $ifNull: ["$projectValue", 0] },
                        0,
                      ],
                    },
                  },
                  completedProjectValue: {
                    $sum: {
                      $cond: [
                        { $eq: ["$status", "Completed"] },
                        { $ifNull: ["$projectValue", 0] },
                        0,
                      ],
                    },
                  },
                },
              },
              { $project: { _id: 0 } },
            ],
            monthly: [
              { $match: { createdAt: { $gte: trendStart } } },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: "%Y-%m",
                      date: "$createdAt",
                    },
                  },
                  projectsBooked: { $sum: 1 },
                  bookedValue: { $sum: { $ifNull: ["$projectValue", 0] } },
                  completedValue: {
                    $sum: {
                      $cond: [
                        { $eq: ["$status", "Completed"] },
                        { $ifNull: ["$projectValue", 0] },
                        0,
                      ],
                    },
                  },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),
      Invoice.aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  invoiceCount: { $sum: 1 },
                  invoicedAmount: { $sum: { $ifNull: ["$amount", 0] } },
                  receivedAmount: { $sum: { $ifNull: ["$paidAmount", 0] } },
                },
              },
              { $project: { _id: 0 } },
            ],
            monthly: [
              { $match: { createdAt: { $gte: trendStart } } },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: "%Y-%m",
                      date: "$createdAt",
                    },
                  },
                  invoiceCount: { $sum: 1 },
                  invoicedAmount: { $sum: { $ifNull: ["$amount", 0] } },
                  receivedAmount: { $sum: { $ifNull: ["$paidAmount", 0] } },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),
    ]);

    const leadTotalsRaw = leadAgg?.[0]?.totals?.[0] || {};
    const quotationTotalsRaw = quotationAgg?.[0]?.totals?.[0] || {};
    const projectTotalsRaw = projectAgg?.[0]?.totals?.[0] || {};
    const invoiceTotalsRaw = invoiceAgg?.[0]?.totals?.[0] || {};

    const leads = {
      totalLeads: toNumber(leadTotalsRaw.totalLeads),
      openLeadCount: toNumber(leadTotalsRaw.openLeadCount),
      closedLeadCount: toNumber(leadTotalsRaw.closedLeadCount),
      openPipelineValue: toNumber(leadTotalsRaw.openPipelineValue),
      weightedPipelineValue: toNumber(leadTotalsRaw.weightedPipelineValue),
      closedRevenue: toNumber(leadTotalsRaw.closedRevenue),
    };

    const quotations = {
      totalQuotations: toNumber(quotationTotalsRaw.totalQuotations),
      draftCount: toNumber(quotationTotalsRaw.draftCount),
      sentCount: toNumber(quotationTotalsRaw.sentCount),
      approvedCount: toNumber(quotationTotalsRaw.approvedCount),
      rejectedCount: toNumber(quotationTotalsRaw.rejectedCount),
      sentValue: toNumber(quotationTotalsRaw.sentValue),
      approvedValue: toNumber(quotationTotalsRaw.approvedValue),
    };

    const projects = {
      totalProjects: toNumber(projectTotalsRaw.totalProjects),
      planningProjects: toNumber(projectTotalsRaw.planningProjects),
      inProgressProjects: toNumber(projectTotalsRaw.inProgressProjects),
      completedProjects: toNumber(projectTotalsRaw.completedProjects),
      totalProjectValue: toNumber(projectTotalsRaw.totalProjectValue),
      activeProjectValue: toNumber(projectTotalsRaw.activeProjectValue),
      completedProjectValue: toNumber(projectTotalsRaw.completedProjectValue),
    };

    const invoices = {
      invoiceCount: toNumber(invoiceTotalsRaw.invoiceCount),
      invoicedAmount: toNumber(invoiceTotalsRaw.invoicedAmount),
      receivedAmount: toNumber(invoiceTotalsRaw.receivedAmount),
    };
    invoices.outstandingAmount = Math.max(
      0,
      invoices.invoicedAmount - invoices.receivedAmount,
    );

    const pipeline = {
      totalValue: leads.openPipelineValue,
      weightedValue: leads.weightedPipelineValue,
      coverageRatio: toPercentage(leads.weightedPipelineValue, Math.max(1, leads.closedRevenue)),
      closeRate: toPercentage(leads.closedLeadCount, Math.max(1, leads.totalLeads)),
      quoteApprovalRate: toPercentage(
        quotations.approvedCount,
        Math.max(1, quotations.sentCount + quotations.approvedCount + quotations.rejectedCount),
      ),
      collectionRate: toPercentage(invoices.receivedAmount, Math.max(1, invoices.invoicedAmount)),
      outstandingToPipelineRate: toPercentage(
        invoices.outstandingAmount,
        Math.max(1, leads.openPipelineValue),
      ),
    };

    const sourceDistribution = (leadAgg?.[0]?.sourceDistribution || []).map((row) => {
      const source = normalizeSource(row._id);
      return {
        source: sourceLabel(source),
        leads: toNumber(row.leads),
        pipelineValue: toNumber(row.pipelineValue),
        weightedValue: toNumber(row.weightedValue),
      };
    });

    const stageDistribution = (leadAgg?.[0]?.stageDistribution || []).map((row) => ({
      stage: typeof row._id === "string" && row._id ? row._id : "Unknown",
      count: toNumber(row.count),
      value: toNumber(row.value),
    }));

    const leadMonthlyMap = buildMapByKey(leadAgg?.[0]?.monthly || []);
    const quotationMonthlyMap = buildMapByKey(quotationAgg?.[0]?.monthly || []);
    const projectMonthlyMap = buildMapByKey(projectAgg?.[0]?.monthly || []);
    const invoiceMonthlyMap = buildMapByKey(invoiceAgg?.[0]?.monthly || []);

    const monthlyTrend = monthTemplate.map((month) => {
      const leadRow = leadMonthlyMap.get(month.key) || {};
      const quotationRow = quotationMonthlyMap.get(month.key) || {};
      const projectRow = projectMonthlyMap.get(month.key) || {};
      const invoiceRow = invoiceMonthlyMap.get(month.key) || {};

      return {
        month: month.label,
        key: month.key,
        leadsCreated: toNumber(leadRow.leadsCreated),
        pipelineValueAdded: toNumber(leadRow.pipelineValueAdded),
        weightedPipelineAdded: toNumber(leadRow.weightedPipelineAdded),
        closedRevenueAdded: toNumber(leadRow.closedRevenueAdded),
        quotationCount: toNumber(quotationRow.quotationCount),
        quotationSentValue: toNumber(quotationRow.sentValue),
        quotationApprovedValue: toNumber(quotationRow.approvedValue),
        projectsBooked: toNumber(projectRow.projectsBooked),
        projectBookedValue: toNumber(projectRow.bookedValue),
        projectCompletedValue: toNumber(projectRow.completedValue),
        invoiceCount: toNumber(invoiceRow.invoiceCount),
        invoicedAmount: toNumber(invoiceRow.invoicedAmount),
        receivedAmount: toNumber(invoiceRow.receivedAmount),
      };
    });

    return sendSuccess(res, req, {
      generatedAt: now.toISOString(),
      rangeMonths: months,
      leads,
      quotations,
      projects,
      invoices,
      pipeline,
      sourceDistribution,
      stageDistribution,
      monthlyTrend,
    });
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "REVENUE_ANALYTICS_FAILED",
      message: "Unable to fetch revenue and pipeline analytics.",
      err: error,
    });
  }
});

module.exports = router;