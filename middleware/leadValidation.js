const { sendError } = require("../utils/apiResponse");

const LEAD_STATUS_VALUES = ["New", "Contacted", "Quoted", "Closed"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_REGEX = /^[0-9+\-\s()]{7,20}$/;
const OWNER_ALLOWED_REGEX = /^[a-zA-Z0-9@ .,_-]{2,120}$/;
const LEAD_ATTRIBUTION_FIELDS = [
  { key: "utmSource", max: 120, aliases: ["utm_source"] },
  { key: "utmMedium", max: 120, aliases: ["utm_medium"] },
  { key: "utmCampaign", max: 120, aliases: ["utm_campaign"] },
  { key: "utmTerm", max: 120, aliases: ["utm_term"] },
  { key: "utmContent", max: 120, aliases: ["utm_content"] },
  { key: "gclid", max: 200, aliases: [] },
  { key: "fbclid", max: 200, aliases: [] },
  { key: "msclkid", max: 200, aliases: [] },
  { key: "landingPage", max: 300, aliases: ["landing_page"] },
  { key: "referrerUrl", max: 500, aliases: ["referrer_url"] },
];

function sanitizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateEmail(email) {
  return EMAIL_REGEX.test(email);
}

function validatePhone(phone) {
  if (!PHONE_ALLOWED_REGEX.test(phone)) {
    return false;
  }

  const digitsOnlyLength = phone.replace(/\D/g, "").length;
  return digitsOnlyLength >= 7 && digitsOnlyLength <= 15;
}

function getBodyValueByAliases(body, fieldConfig) {
  if (body[fieldConfig.key] !== undefined) {
    return body[fieldConfig.key];
  }

  for (const alias of fieldConfig.aliases) {
    if (body[alias] !== undefined) {
      return body[alias];
    }
  }

  return undefined;
}

function extractLeadAttribution(body, errors) {
  const attribution = {};

  for (const field of LEAD_ATTRIBUTION_FIELDS) {
    const rawValue = getBodyValueByAliases(body, field);

    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    const value = sanitizeText(String(rawValue));
    if (!value) {
      continue;
    }

    if (value.length > field.max) {
      errors.push(`${field.key} must be <= ${field.max} characters.`);
      continue;
    }

    attribution[field.key] = value;
  }

  return attribution;
}

function validateCreateLead(req, res, next) {
  const contactPerson = sanitizeText(req.body.contactPerson);
  const email = sanitizeText(req.body.email).toLowerCase();
  const companyName = sanitizeText(req.body.companyName);
  const phone = sanitizeText(req.body.phone);
  const message = sanitizeText(req.body.message);

  const errors = [];
  const attribution = extractLeadAttribution(req.body, errors);

  if (!contactPerson || contactPerson.length > 100) {
    errors.push("contactPerson is required and must be <= 100 characters.");
  }

  if (!email || email.length > 150 || !validateEmail(email)) {
    errors.push("Valid email is required.");
  }

  if (!companyName || companyName.length > 150) {
    errors.push("companyName is required and must be <= 150 characters.");
  }

  if (!phone || !validatePhone(phone)) {
    errors.push("Valid phone is required.");
  }

  if (!message || message.length > 2000) {
    errors.push("message is required and must be <= 2000 characters.");
  }

  if (errors.length > 0) {
    return sendError(res, req, {
      statusCode: 400,
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      details: errors,
    });
  }

  req.validatedLead = {
    contactPerson,
    email,
    companyName,
    phone,
    message,
    ...attribution,
  };

  return next();
}

function validateLeadStatusUpdate(req, res, next) {
  const status = sanitizeText(req.body.status);

  if (!LEAD_STATUS_VALUES.includes(status)) {
    return sendError(res, req, {
      statusCode: 400,
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      details: [`status must be one of: ${LEAD_STATUS_VALUES.join(", ")}`],
    });
  }

  req.validatedStatus = status;
  return next();
}

function validateLeadUpdate(req, res, next) {
  const errors = [];
  const updatePayload = {};

  if (req.body.contactPerson !== undefined) {
    const value = sanitizeText(req.body.contactPerson);
    if (!value || value.length > 100) {
      errors.push("contactPerson must be between 1 and 100 characters.");
    } else {
      updatePayload.contactPerson = value;
    }
  }

  if (req.body.email !== undefined) {
    const value = sanitizeText(req.body.email).toLowerCase();
    if (!value || value.length > 150 || !validateEmail(value)) {
      errors.push("email must be valid.");
    } else {
      updatePayload.email = value;
    }
  }

  if (req.body.companyName !== undefined) {
    const value = sanitizeText(req.body.companyName);
    if (!value || value.length > 150) {
      errors.push("companyName must be between 1 and 150 characters.");
    } else {
      updatePayload.companyName = value;
    }
  }

  if (req.body.phone !== undefined) {
    const value = sanitizeText(req.body.phone);
    if (!validatePhone(value)) {
      errors.push("phone must be valid.");
    } else {
      updatePayload.phone = value;
    }
  }

  if (req.body.message !== undefined) {
    const value = sanitizeText(req.body.message);
    if (!value || value.length > 2000) {
      errors.push("message must be between 1 and 2000 characters.");
    } else {
      updatePayload.message = value;
    }
  }

  if (req.body.status !== undefined) {
    errors.push("Use PUT /api/leads/:id/status to update lead status.");
  }

  if (req.body.owner !== undefined) {
    errors.push("Use PUT /api/leads/:id/owner to update lead owner.");
  }

  for (const field of LEAD_ATTRIBUTION_FIELDS) {
    if (getBodyValueByAliases(req.body, field) !== undefined) {
      errors.push(
        `${field.key} is system-captured. It cannot be manually updated.`,
      );
    }
  }

  if (req.body.dealValue !== undefined) {
    const value = Number(req.body.dealValue);
    if (!Number.isFinite(value) || value < 0) {
      errors.push("dealValue must be a non-negative number.");
    } else {
      updatePayload.dealValue = value;
    }
  }

  if (req.body.probability !== undefined) {
    const value = Number(req.body.probability);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      errors.push("probability must be a number between 0 and 100.");
    } else {
      updatePayload.probability = value;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    errors.push("No valid fields were provided for update.");
  }

  if (errors.length > 0) {
    return sendError(res, req, {
      statusCode: 400,
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      details: errors,
    });
  }

  req.validatedLeadUpdate = updatePayload;
  return next();
}

function validateLeadOwnerUpdate(req, res, next) {
  const owner = sanitizeText(req.body.owner);

  if (!owner) {
    return sendError(res, req, {
      statusCode: 400,
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      details: ["owner is required."],
    });
  }

  if (!OWNER_ALLOWED_REGEX.test(owner)) {
    return sendError(res, req, {
      statusCode: 400,
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      details: ["owner must be 2-120 chars and contain only safe characters."],
    });
  }

  req.validatedOwner = owner;
  return next();
}

module.exports = {
  validateCreateLead,
  validateLeadStatusUpdate,
  validateLeadUpdate,
  validateLeadOwnerUpdate,
};
