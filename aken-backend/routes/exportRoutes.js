const express = require("express");

const router = express.Router();

const { requireAdminSession, requireRole } = require("../middleware/adminAuth");

const Lead = require("../models/Lead");
const Quotation = require("../models/Quotation");
const Project = require("../models/Project");
const Invoice = require("../models/Invoice");
const { sendError } = require("../utils/apiResponse");

const LEAD_STATUS = ["New", "Contacted", "Quoted", "Closed"];
const QUOTATION_STATUS = ["Draft", "Sent", "Approved", "Rejected"];
const PROJECT_STATUS = ["Planning", "In Progress", "Completed"];
const INVOICE_STATUS = ["Pending", "Partially Paid", "Paid"];

function sanitizeText(value, maxLength = 120) {
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

function toNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).replace(/\r?\n|\r/g, " ");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

function rowsToCsv(headers, rows) {
  const headerLine = headers.map((header) => escapeCsvValue(header)).join(",");
  const lines = rows.map((row) => row.map((value) => escapeCsvValue(value)).join(","));
  return `\uFEFF${[headerLine, ...lines].join("\r\n")}`;
}

function buildLeadFilter(req) {
  const filter = {};
  const status = sanitizeText(req.query.status, 20);
  const owner = sanitizeText(req.query.owner, 80);
  const source = sanitizeText(req.query.source, 120);

  if (status && LEAD_STATUS.includes(status)) {
    filter.status = status;
  }

  if (owner) {
    filter.owner = owner;
  }

  if (source) {
    filter.utmSource = source;
  }

  return filter;
}

function buildQuotationFilter(req) {
  const filter = {};
  const status = sanitizeText(req.query.status, 20);
  if (status && QUOTATION_STATUS.includes(status)) {
    filter.status = status;
  }
  return filter;
}

function buildProjectFilter(req) {
  const filter = {};
  const status = sanitizeText(req.query.status, 20);
  const owner = sanitizeText(req.query.owner, 80);

  if (status && PROJECT_STATUS.includes(status)) {
    filter.status = status;
  }

  if (owner) {
    filter.projectOwner = owner;
  }

  return filter;
}

function buildInvoiceFilter(req) {
  const filter = {};
  const status = sanitizeText(req.query.status, 20);
  if (status && INVOICE_STATUS.includes(status)) {
    filter.status = status;
  }
  return filter;
}

async function fetchLeadExportRows(req) {
  const leads = await Lead.find(buildLeadFilter(req)).sort({ createdAt: -1 }).lean();

  const headers = [
    "Lead ID",
    "Created At (UTC)",
    "Contact Person",
    "Company Name",
    "Email",
    "Phone",
    "Status",
    "Owner",
    "Deal Value",
    "Probability (%)",
    "UTM Source",
    "UTM Medium",
    "UTM Campaign",
    "Landing Page",
    "Referrer URL",
    "Message",
  ];

  const rows = leads.map((lead) => [
    String(lead._id || ""),
    formatDate(lead.createdAt),
    lead.contactPerson || "",
    lead.companyName || "",
    lead.email || "",
    lead.phone || "",
    lead.status || "",
    lead.owner || "",
    toNumber(lead.dealValue).toFixed(2),
    toNumber(lead.probability).toFixed(2),
    lead.utmSource || "",
    lead.utmMedium || "",
    lead.utmCampaign || "",
    lead.landingPage || "",
    lead.referrerUrl || "",
    lead.message || "",
  ]);

  return {
    headers,
    rows,
    filePrefix: "leads-export",
  };
}

async function fetchQuotationExportRows(req) {
  const quotations = await Quotation.find(buildQuotationFilter(req))
    .populate("leadId", "contactPerson companyName email")
    .sort({ createdAt: -1 })
    .lean();

  const headers = [
    "Quotation ID",
    "Created At (UTC)",
    "Quotation Number",
    "Client Contact",
    "Client Company",
    "Client Email",
    "Total Amount",
    "Status",
    "Valid Till (UTC)",
  ];

  const rows = quotations.map((quotation) => [
    String(quotation._id || ""),
    formatDate(quotation.createdAt),
    quotation.quotationNumber || "",
    quotation.leadId?.contactPerson || "",
    quotation.leadId?.companyName || "",
    quotation.leadId?.email || "",
    toNumber(quotation.totalAmount).toFixed(2),
    quotation.status || "",
    formatDate(quotation.validTill),
  ]);

  return {
    headers,
    rows,
    filePrefix: "quotations-export",
  };
}

async function fetchProjectExportRows(req) {
  const projects = await Project.find(buildProjectFilter(req))
    .populate("leadId", "contactPerson companyName status owner")
    .populate("quotationId", "quotationNumber status totalAmount")
    .sort({ createdAt: -1 })
    .lean();

  const headers = [
    "Project ID",
    "Created At (UTC)",
    "Project Name",
    "Client Name",
    "Project Owner",
    "Status",
    "Site Status",
    "Progress (%)",
    "Project Value",
    "Budget Allocated",
    "Total Spent",
    "Lead Company",
    "Lead Status",
    "Quotation Number",
    "Quotation Status",
  ];

  const rows = projects.map((project) => [
    String(project._id || ""),
    formatDate(project.createdAt),
    project.projectName || "",
    project.clientName || "",
    project.projectOwner || "",
    project.status || "",
    project.siteStatus || "",
    toNumber(project.progressPercentage).toFixed(2),
    toNumber(project.projectValue).toFixed(2),
    toNumber(project.budgetAllocated).toFixed(2),
    toNumber(project.totalSpent).toFixed(2),
    project.leadId?.companyName || "",
    project.leadId?.status || "",
    project.quotationId?.quotationNumber || "",
    project.quotationId?.status || "",
  ]);

  return {
    headers,
    rows,
    filePrefix: "projects-export",
  };
}

async function fetchInvoiceExportRows(req) {
  const invoices = await Invoice.find(buildInvoiceFilter(req))
    .populate("projectId", "projectName clientName projectOwner status")
    .sort({ createdAt: -1 })
    .lean();

  const headers = [
    "Invoice ID",
    "Created At (UTC)",
    "Invoice Number",
    "Project Name",
    "Client Name",
    "Project Owner",
    "Project Status",
    "Invoice Amount",
    "Paid Amount",
    "Due Amount",
    "Invoice Status",
    "Due Date (UTC)",
  ];

  const rows = invoices.map((invoice) => {
    const amount = toNumber(invoice.amount);
    const paidAmount = toNumber(invoice.paidAmount);
    const dueAmount = Math.max(0, amount - paidAmount);

    return [
      String(invoice._id || ""),
      formatDate(invoice.createdAt),
      invoice.invoiceNumber || "",
      invoice.projectId?.projectName || "",
      invoice.projectId?.clientName || "",
      invoice.projectId?.projectOwner || "",
      invoice.projectId?.status || "",
      amount.toFixed(2),
      paidAmount.toFixed(2),
      dueAmount.toFixed(2),
      invoice.status || "",
      formatDate(invoice.dueDate),
    ];
  });

  return {
    headers,
    rows,
    filePrefix: "invoices-export",
  };
}

const EXPORT_FETCHERS = {
  leads: fetchLeadExportRows,
  quotations: fetchQuotationExportRows,
  projects: fetchProjectExportRows,
  invoices: fetchInvoiceExportRows,
};

router.get(
  "/:entity",
  requireAdminSession,
  requireRole(["admin"]),
  async (req, res) => {
  try {
    const entity = sanitizeText(req.params.entity, 30).toLowerCase();
    const format = sanitizeText(req.query.format, 10).toLowerCase() || "csv";

    if (format !== "csv") {
      return sendError(res, req, {
        statusCode: 400,
        code: "EXPORT_FORMAT_NOT_SUPPORTED",
        message: "Only csv format is supported for Excel export.",
      });
    }

    const fetcher = EXPORT_FETCHERS[entity];
    if (!fetcher) {
      return sendError(res, req, {
        statusCode: 404,
        code: "EXPORT_ENTITY_NOT_SUPPORTED",
        message: "Export entity is not supported.",
      });
    }

    const exportPayload = await fetcher(req);
    const csv = rowsToCsv(exportPayload.headers, exportPayload.rows);
    const datePart = new Date().toISOString().slice(0, 10);
    const filename = `${exportPayload.filePrefix}-${datePart}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "EXPORT_FAILED",
      message: "Unable to export data.",
      err: error,
    });
  }
});

module.exports = router;
