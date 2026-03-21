const { sendError } = require("../utils/apiResponse");

const ALLOWED_CHANNELS = new Set(["whatsapp"]);
const MAX_MESSAGE_LEN = 2000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function validatePhoneE164DigitsOnly(to) {
  // Your system normalizes to digits-only, countrycode + number (e.g., 9198xxxxxx).
  // Accept 10..15 digits to be safe.
  return /^\d{10,15}$/.test(to);
}

function validateWebhookPayload(body) {
  const errors = [];

  if (!isPlainObject(body)) {
    errors.push({ field: "body", message: "Body must be a JSON object." });
    return errors;
  }

  const channel = asString(body.channel).trim();
  const type = asString(body.type).trim();
  const to = asString(body.to).trim();
  const message = asString(body.message);
  const leadId = asString(body.leadId).trim();
  const metadata = body.metadata;

  if (!channel) errors.push({ field: "channel", message: "channel is required." });
  if (channel && !ALLOWED_CHANNELS.has(channel)) {
    errors.push({ field: "channel", message: "Unsupported channel." });
  }

  if (!type) errors.push({ field: "type", message: "type is required." });
  if (type && type.length > 80) errors.push({ field: "type", message: "type is too long." });

  if (!to) errors.push({ field: "to", message: "to is required." });
  if (to && !validatePhoneE164DigitsOnly(to)) {
    errors.push({ field: "to", message: "to must be digits-only (10..15 digits)." });
  }

  if (!message || !message.trim()) errors.push({ field: "message", message: "message is required." });
  if (message && message.length > MAX_MESSAGE_LEN) {
    errors.push({ field: "message", message: `message is too long (max ${MAX_MESSAGE_LEN}).` });
  }

  // leadId is required in your notification contract, but allow empty for future non-lead notifications if needed.
  if (!leadId) errors.push({ field: "leadId", message: "leadId is required." });
  if (leadId && leadId.length > 80) errors.push({ field: "leadId", message: "leadId is too long." });

  if (metadata !== undefined && metadata !== null && !isPlainObject(metadata)) {
    errors.push({ field: "metadata", message: "metadata must be an object if provided." });
  }

  return errors;
}

function validateWhatsappWebhookRequest(req, res, next) {
  const errors = validateWebhookPayload(req.body);

  if (errors.length > 0) {
    return sendError(res, req, {
      statusCode: 400,
      code: "INVALID_WEBHOOK_PAYLOAD",
      message: "Invalid webhook payload.",
      details: errors,
    });
  }

  return next();
}

module.exports = {
  validateWhatsappWebhookRequest,
  validateWebhookPayload,
};
