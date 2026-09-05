"use strict";

const { sendError } = require("../utils/apiResponse");
const {
  computeQuotationTotals,
  MAX_ITEM_AMOUNT,
} = require("../utils/quotationTotals");

function toStringOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_REGEX = /^[0-9a-f]{24}$/i;

function isValidObjectIdLike(value) {
  // Accept legacy ObjectId strings (24 hex) or PostgreSQL UUIDs (36 chars).
  return typeof value === "string" &&
    (OBJECT_ID_REGEX.test(value) || UUID_V4_REGEX.test(value));
}

function quotationValidation(req, res, next) {
  const body = req.body || {};

  // Basic shape checks
  if (typeof body !== "object" || Array.isArray(body)) {
    return sendError(res, req, {
      statusCode: 400,
      code: "QUOTATION_INPUT_INVALID",
      message: "Invalid quotation payload.",
    });
  }

  // leadId is optional, but if present it must look like an ObjectId.
  if (body.leadId && !isValidObjectIdLike(String(body.leadId))) {
    return sendError(res, req, {
      statusCode: 400,
      code: "QUOTATION_LEAD_INVALID",
      message: "Invalid leadId.",
    });
  }

  const quotationNumber = toStringOrEmpty(body.quotationNumber);
  if (quotationNumber && quotationNumber.length > 64) {
    return sendError(res, req, {
      statusCode: 400,
      code: "QUOTATION_NUMBER_TOO_LONG",
      message: "Quotation number is too long.",
    });
  }

  const clientEmail = toStringOrEmpty(body.clientEmail);
  if (clientEmail && clientEmail.length > 120) {
    return sendError(res, req, {
      statusCode: 400,
      code: "QUOTATION_CLIENT_EMAIL_INVALID",
      message: "Client email is too long.",
    });
  }

  // Items are required for a meaningful quotation.
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return sendError(res, req, {
      statusCode: 400,
      code: "QUOTATION_ITEMS_REQUIRED",
      message: "Quotation items are required.",
    });
  }

  if (body.items.length > 200) {
    return sendError(res, req, {
      statusCode: 400,
      code: "QUOTATION_ITEMS_TOO_MANY",
      message: "Too many quotation items.",
    });
  }

  const sanitizedItems = [];
  for (let i = 0; i < body.items.length; i += 1) {
    const item = body.items[i];

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return sendError(res, req, {
        statusCode: 400,
        code: "QUOTATION_ITEM_INVALID",
        message: `Invalid item at index ${i}.`,
      });
    }

    const description = toStringOrEmpty(item.description);
    if (!description || description.length > 500) {
      return sendError(res, req, {
        statusCode: 400,
        code: "QUOTATION_ITEM_DESCRIPTION_INVALID",
        message: `Invalid description at index ${i}.`,
      });
    }

    const quantity = toNumberOrNull(item.quantity);
    const rate = toNumberOrNull(item.rate);
    const amount = toNumberOrNull(item.amount);

    // quantity and rate required; amount can be supplied or calculated by backend.
    if (quantity === null || quantity <= 0 || quantity > 1_000_000) {
      return sendError(res, req, {
        statusCode: 400,
        code: "QUOTATION_ITEM_QUANTITY_INVALID",
        message: `Invalid quantity at index ${i}.`,
      });
    }

    if (rate === null || rate < 0 || rate > 1_000_000_000) {
      return sendError(res, req, {
        statusCode: 400,
        code: "QUOTATION_ITEM_RATE_INVALID",
        message: `Invalid rate at index ${i}.`,
      });
    }

    const computedAmount = Number((quantity * rate).toFixed(2));
    const finalAmount =
      amount !== null && amount >= 0 ? Math.min(amount, MAX_ITEM_AMOUNT) : computedAmount;

    sanitizedItems.push({
      description,
      quantity,
      rate,
      amount: finalAmount,
    });
  }

  // NOTE (F1 fix): `body.totalAmount` is deliberately NEVER read here.
  // The client cannot influence the stored total. `subtotal`, `gst` and
  // `totalAmount` are derived server-side by computeQuotationTotals, which
  // guarantees `totalAmount = subtotal + gst` — satisfying the Phase 2
  // CHECK constraint `quotations_total_integrity`.
  const gstRate = toNumberOrNull(body.gstRate);
  const gst = toNumberOrNull(body.gst);

  const totals = computeQuotationTotals({
    items: sanitizedItems,
    gstRate,
    gst,
  });

  // Replace req.body with sanitized/normalized fields to keep DB clean.
  // `totalAmount` is spread from `body` for compatibility when present, then
  // ALWAYS overwritten with the server-computed value below. Order matters:
  // later keys win.
  req.body = {
    ...body,
    quotationNumber,
    clientEmail: clientEmail || undefined,
    leadId: body.leadId ? String(body.leadId) : undefined,
    items: sanitizedItems,
    subtotal: totals.subtotal,
    gstRate: totals.gstRate,
    gst: totals.gst,
    totalAmount: totals.totalAmount,
  };

  return next();
}

module.exports = {
  quotationValidation,
};
