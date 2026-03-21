const express = require("express");
const { requireWebhookBearerToken } = require("../middleware/webhookAuth");
const { validateWhatsappWebhookRequest } = require("../middleware/validateWhatsappWebhook");
const {
  receiveWhatsAppWebhook,
  whatsappWebhookHealth,
} = require("../controllers/whatsappWebhookController");

const router = express.Router();

// Health endpoint (still requires auth to avoid leaking configuration details).
router.get(
  "/whatsapp/health",
  requireWebhookBearerToken({ envKey: "WHATSAPP_WEBHOOK_TOKEN" }),
  whatsappWebhookHealth,
);

// Receiver endpoint (used by your backend as an internal webhook target).
router.post(
  "/whatsapp",
  requireWebhookBearerToken({ envKey: "WHATSAPP_WEBHOOK_TOKEN" }),
  validateWhatsappWebhookRequest,
  receiveWhatsAppWebhook,
);

module.exports = router;
