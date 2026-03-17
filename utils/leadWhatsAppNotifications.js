const Lead = require("../models/Lead");
const {
  sendWhatsAppViaWebhook,
  isWhatsAppConfigured,
} = require("./whatsappWebhook");

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.startsWith("91") && digits.length === 12) {
    return digits;
  }

  if (digits.length === 10) {
    const countryCode = (process.env.DEFAULT_COUNTRY_CODE || "91").replace(/\D/g, "");
    return `${countryCode}${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }

  return null;
}

function buildFallbackUrl(to, message) {
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

function getAdminRecipients() {
  return (process.env.WHATSAPP_ADMIN_RECIPIENTS || "")
    .split(",")
    .map((item) => normalizePhone(item))
    .filter(Boolean);
}

function shouldSendClientAck() {
  return String(process.env.WHATSAPP_SEND_CLIENT_ACK || "false").toLowerCase() === "true";
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendWithRetry(payload, options = {}) {
  const maxAttempts = options.maxAttempts || 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await sendWhatsAppViaWebhook(payload);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await wait(400 * attempt);
      }
    }
  }

  throw lastError;
}

function buildAdminMessage(lead) {
  return [
    "New Lead Alert - A K ENGINEERING",
    `Name: ${lead.contactPerson || "-"}`,
    `Company: ${lead.companyName || "-"}`,
    `Phone: ${lead.phone || "-"}`,
    `Source: ${lead.utmSource || "direct"}`,
    `Campaign: ${lead.utmCampaign || "none"}`,
    `Owner: ${lead.owner || "Unassigned"}`,
    `Lead ID: ${lead._id}`,
  ].join("\n");
}

function buildClientAckMessage(lead) {
  return [
    `Dear ${lead.contactPerson || "Customer"},`,
    "Thank you for contacting A K ENGINEERING.",
    "We have received your enquiry and our team will contact you shortly.",
  ].join("\n");
}

async function applyUpdate(leadId, update) {
  await Lead.updateOne({ _id: leadId }, update);
}

async function sendLeadWhatsAppNotifications(leadId) {
  const lead = await Lead.findById(leadId).lean();
  if (!lead) {
    return { ok: false, reason: "LEAD_NOT_FOUND" };
  }

  await applyUpdate(leadId, {
    $inc: { "whatsappNotifications.attemptCount": 1 },
    $set: { "whatsappNotifications.lastAttemptAt": new Date() },
  });

  if (!isWhatsAppConfigured()) {
    await applyUpdate(leadId, {
      $set: {
        "whatsappNotifications.lastError":
          "WhatsApp webhook is not configured. Set WHATSAPP_WEBHOOK_URL.",
      },
    });
    return { ok: false, reason: "WHATSAPP_NOT_CONFIGURED" };
  }

  const errors = [];
  const patchSet = {};

  const adminAlreadySent = Boolean(lead?.whatsappNotifications?.adminNotifiedAt);
  const adminRecipients = getAdminRecipients();
  const adminMessage = buildAdminMessage(lead);

  if (!adminAlreadySent && adminRecipients.length > 0) {
    for (const to of adminRecipients) {
      try {
        await sendWithRetry({
          channel: "whatsapp",
          type: "lead_admin_alert",
          to,
          message: adminMessage,
          leadId: String(lead._id),
          metadata: {
            source: lead.utmSource || "direct",
            campaign: lead.utmCampaign || "",
          },
        });
        console.log(
          "WhatsApp notification sent (admin) for lead:",
          String(lead._id),
          "to:",
          String(to),
        );
      } catch (error) {
        const fallback = buildFallbackUrl(to, adminMessage);
        console.error(
          "WhatsApp notification error (admin) for lead:",
          String(lead._id),
          "to:",
          String(to),
          error,
        );
        errors.push(`admin:${to}:${error.message}`);
        patchSet["whatsappNotifications.lastFallbackUrl"] = fallback;
      }
    }

    if (!errors.some((entry) => entry.startsWith("admin:"))) {
      patchSet["whatsappNotifications.adminNotifiedAt"] = new Date();
    }
  }

  const clientAlreadySent = Boolean(lead?.whatsappNotifications?.clientAcknowledgedAt);
  const clientTo = normalizePhone(lead.phone);
  const clientMessage = buildClientAckMessage(lead);

  if (shouldSendClientAck() && !clientAlreadySent && clientTo) {
    try {
      await sendWithRetry({
        channel: "whatsapp",
        type: "lead_client_ack",
        to: clientTo,
        message: clientMessage,
        leadId: String(lead._id),
      });
      console.log(
        "WhatsApp notification sent (client acknowledgement) for lead:",
        String(lead._id),
        "to:",
        String(clientTo),
      );
      patchSet["whatsappNotifications.clientAcknowledgedAt"] = new Date();
    } catch (error) {
      const fallback = buildFallbackUrl(clientTo, clientMessage);
      console.error(
        "WhatsApp notification error (client acknowledgement) for lead:",
        String(lead._id),
        "to:",
        String(clientTo),
        error,
      );
      errors.push(`client:${clientTo}:${error.message}`);
      patchSet["whatsappNotifications.lastFallbackUrl"] = fallback;
    }
  }

  patchSet["whatsappNotifications.lastError"] = errors.length
    ? errors.join(" | ")
    : null;

  await applyUpdate(leadId, { $set: patchSet });

  if (errors.length > 0) {
    console.error(
      "Lead WhatsApp notifications processed with issues for lead:",
      String(leadId),
      errors,
    );
  } else {
    console.log("Lead WhatsApp notifications complete for lead:", String(leadId));
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  sendLeadWhatsAppNotifications,
};
