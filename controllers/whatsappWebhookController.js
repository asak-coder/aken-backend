const crypto = require("crypto");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { log } = require("../utils/requestLogger");

function redact(value, maxLen = 48) {
  const str = String(value || "");
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}…`;
}

function hash(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

async function receiveWhatsAppWebhook(req, res) {
  // Payload already validated by middleware.
  const { channel, type, to, message, leadId, metadata } = req.body || {};

  // Safe logging: no message body (PII), only lengths/hashes.
  log("info", req, "WhatsApp webhook received", {
    channel,
    type,
    leadId: redact(leadId, 32),
    toMasked: redact(to, 6),
    toHash: hash(to),
    messageLen: String(message || "").length,
    hasMetadata: Boolean(metadata),
  });

  // Mock/dispatcher: place for actual provider integration later.
  // For now we treat this endpoint as an internal receiver used by your own backend.
  // If you later integrate Meta WhatsApp Business API, you can dispatch here.

  return sendSuccess(res, req, {
    statusCode: 200,
    message: "Webhook accepted.",
    data: {
      accepted: true,
      channel,
      type,
      leadId: String(leadId),
    },
  });
}

function whatsappWebhookHealth(req, res) {
  return sendSuccess(res, req, {
    statusCode: 200,
    message: "WhatsApp webhook receiver is up.",
    data: {
      auth: "bearer",
      requiredEnv: ["WHATSAPP_WEBHOOK_TOKEN"],
    },
  });
}

module.exports = {
  receiveWhatsAppWebhook,
  whatsappWebhookHealth,
};
