const Lead = require("../models/Lead");
const sendEmail = require("./sendEmail");

function escapeHtml(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAdminRecipients() {
  const csv = process.env.LEAD_ALERT_EMAILS || process.env.EMAIL_USER || "";
  return csv
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildAdminLeadEmail(lead) {
  const safeName = escapeHtml(lead.contactPerson || "");
  const safeEmail = escapeHtml(lead.email || "");
  const safeCompany = escapeHtml(lead.companyName || "");
  const safePhone = escapeHtml(lead.phone || "");
  const safeMessage = escapeHtml(lead.message || "");
  const safeOwner = escapeHtml(lead.owner || "Unassigned");
  const safeSource = escapeHtml(lead.utmSource || "direct");
  const safeMedium = escapeHtml(lead.utmMedium || "none");
  const safeCampaign = escapeHtml(lead.utmCampaign || "none");
  const safeLandingPage = escapeHtml(lead.landingPage || "-");

  return {
    subject: `New Lead: ${lead.companyName || "Website Enquiry"} (${safeSource})`,
    html: `
      <h2>New Lead Received</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Company:</strong> ${safeCompany}</p>
      <p><strong>Phone:</strong> ${safePhone}</p>
      <p><strong>Message:</strong> ${safeMessage}</p>
      <hr />
      <p><strong>Assigned Owner:</strong> ${safeOwner}</p>
      <p><strong>UTM Source:</strong> ${safeSource}</p>
      <p><strong>UTM Medium:</strong> ${safeMedium}</p>
      <p><strong>UTM Campaign:</strong> ${safeCampaign}</p>
      <p><strong>Landing Page:</strong> ${safeLandingPage}</p>
      <p><strong>Lead ID:</strong> ${lead._id}</p>
    `,
  };
}

function buildClientAckEmail(lead) {
  const safeName = escapeHtml(lead.contactPerson || "there");
  return {
    subject: "Thank you for contacting A K ENGINEERING",
    html: `
      <p>Dear ${safeName},</p>
      <p>Thank you for contacting A K ENGINEERING.</p>
      <p>We have received your enquiry and our team will contact you soon for technical discussion and quotation support.</p>
      <p>Regards,<br/>A K ENGINEERING Team</p>
    `,
  };
}

async function applyNotificationUpdate(leadId, update) {
  await Lead.updateOne({ _id: leadId }, update);
}

async function sendLeadNotificationEmails(leadId) {
  const lead = await Lead.findById(leadId).lean();
  if (!lead) {
    return {
      ok: false,
      reason: "LEAD_NOT_FOUND",
    };
  }

  await applyNotificationUpdate(leadId, {
    $inc: { "emailNotifications.attemptCount": 1 },
    $set: { "emailNotifications.lastAttemptAt": new Date() },
  });

  if (!sendEmail.isEmailConfigured()) {
    await applyNotificationUpdate(leadId, {
      $set: {
        "emailNotifications.lastError":
          "Email configuration is missing. Set SMTP or EMAIL_* environment variables.",
      },
    });

    return {
      ok: false,
      reason: "EMAIL_NOT_CONFIGURED",
    };
  }

  const patchSet = {};
  const errors = [];

  const adminRecipients = getAdminRecipients();
  const adminAlreadySent = Boolean(lead?.emailNotifications?.adminNotifiedAt);
  if (!adminAlreadySent && adminRecipients.length > 0) {
    try {
      const adminMail = buildAdminLeadEmail(lead);
      await sendEmail({
        to: adminRecipients.join(","),
        subject: adminMail.subject,
        html: adminMail.html,
      });
      console.log("Email notification sent (admin) for lead:", String(lead._id));
      patchSet["emailNotifications.adminNotifiedAt"] = new Date();
    } catch (error) {
      console.error(
        "Email notification error (admin) for lead:",
        String(lead._id),
        error,
      );
      errors.push(`admin:${error.message}`);
    }
  }

  const clientAlreadySent = Boolean(lead?.emailNotifications?.clientAcknowledgedAt);
  if (!clientAlreadySent && lead.email) {
    try {
      const clientMail = buildClientAckEmail(lead);
      await sendEmail({
        to: lead.email,
        subject: clientMail.subject,
        html: clientMail.html,
      });
      console.log(
        "Email notification sent (client acknowledgement) for lead:",
        String(lead._id),
      );
      patchSet["emailNotifications.clientAcknowledgedAt"] = new Date();
    } catch (error) {
      console.error(
        "Email notification error (client acknowledgement) for lead:",
        String(lead._id),
        error,
      );
      errors.push(`client:${error.message}`);
    }
  }

  if (errors.length > 0) {
    patchSet["emailNotifications.lastError"] = errors.join(" | ");
  } else {
    patchSet["emailNotifications.lastError"] = null;
  }

  await applyNotificationUpdate(leadId, { $set: patchSet });

  if (errors.length > 0) {
    console.error(
      "Lead email notifications processed with issues for lead:",
      String(leadId),
      errors,
    );
  } else {
    console.log("Lead email notifications complete for lead:", String(leadId));
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  sendLeadNotificationEmails,
};
