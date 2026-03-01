const LEAD_STATUS_VALUES = ["New", "Contacted", "Quoted", "Closed"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_REGEX = /^[0-9+\-\s()]{7,20}$/;
const OWNER_ALLOWED_REGEX = /^[a-zA-Z0-9@ .,_-]{2,120}$/;

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

function validateCreateLead(req, res, next) {
  const contactPerson = sanitizeText(req.body.contactPerson);
  const email = sanitizeText(req.body.email).toLowerCase();
  const companyName = sanitizeText(req.body.companyName);
  const phone = sanitizeText(req.body.phone);
  const message = sanitizeText(req.body.message);
  const owner = req.body.owner !== undefined
    ? sanitizeText(req.body.owner)
    : undefined;

  const errors = [];

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

  if (owner !== undefined) {
    if (!OWNER_ALLOWED_REGEX.test(owner)) {
      errors.push(
        "owner must be 2-120 chars and contain only safe characters.",
      );
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors,
    });
  }

  req.validatedLead = {
    contactPerson,
    email,
    companyName,
    phone,
    message,
    owner,
  };

  return next();
}

function validateLeadStatusUpdate(req, res, next) {
  const status = sanitizeText(req.body.status);

  if (!LEAD_STATUS_VALUES.includes(status)) {
    return res.status(400).json({
      error: "Validation failed",
      details: [
        `status must be one of: ${LEAD_STATUS_VALUES.join(", ")}`,
      ],
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
    return res.status(400).json({
      error: "Validation failed",
      details: errors,
    });
  }

  req.validatedLeadUpdate = updatePayload;
  return next();
}

function validateLeadOwnerUpdate(req, res, next) {
  const owner = sanitizeText(req.body.owner);

  if (!owner) {
    return res.status(400).json({
      error: "Validation failed",
      details: ["owner is required."],
    });
  }

  if (!OWNER_ALLOWED_REGEX.test(owner)) {
    return res.status(400).json({
      error: "Validation failed",
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
