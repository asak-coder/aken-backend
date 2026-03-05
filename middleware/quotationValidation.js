const { sendError } = require("../utils/apiResponse");

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

function isValidObjectIdLike(value) {
  // Accept mongoose ObjectId string (24 hex chars). We avoid importing mongoose here.
  return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
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
      amount !== null && amount >= 0 ? Math.min(amount, 9_999_999_999) : computedAmount;

    sanitizedItems.push({
      description,
      quantity,
      rate,
      amount: finalAmount,
    });
  }

  // Always compute subtotal on backend to avoid tampering.
  const subtotal = sanitizedItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  const gstRate = toNumberOrNull(body.gstRate);
  const gst = toNumberOrNull(body.gst);
  const totalAmount = toNumberOrNull(body.totalAmount);

  const normalizedGstRate =
    gstRate === null ? 18 : Math.min(28, Math.max(0, gstRate)); // default 18%, cap 28%

  const computedGst = Number(((subtotal * normalizedGstRate) / 100).toFixed(2));
  const finalGst = gst !== null && gst >= 0 ? Math.min(gst, 9_999_999_999) : computedGst;

  const computedTotal = Number((subtotal + finalGst).toFixed(2));
  const finalTotal =
    totalAmount !== null && totalAmount >= 0
      ? Math.min(totalAmount, 9_999_999_999)
      : computedTotal;

  // Replace req.body with sanitized/normalized fields to keep DB clean.
  req.body = {
    ...body,
    quotationNumber,
    clientEmail: clientEmail || undefined,
    leadId: body.leadId ? String(body.leadId) : undefined,
    items: sanitizedItems,
    subtotal,
    gstRate: normalizedGstRate,
    gst: finalGst,
    totalAmount: finalTotal,
  };

  return next();
}

module.exports = {
  quotationValidation,
};
