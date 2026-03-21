const { Resend } = require("resend");

let cachedClient = null;
let cachedClientKey = null;

function getResendConfig() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.EMAIL_FROM || "").trim();
  const sender = (process.env.EMAIL_SENDER || "").trim(); // fallback for convenience

  return {
    apiKey,
    from: from || sender || `"A K ENGINEERING" <contact@aken.firm.in>`,
  };
}

function isEmailConfigured() {
  const cfg = getResendConfig();
  return Boolean(cfg.apiKey);
}

function getResendClient() {
  const cfg = getResendConfig();
  const key = [Boolean(cfg.apiKey)].join("|");

  if (!cachedClient || cachedClientKey !== key) {
    if (!cfg.apiKey) {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    cachedClient = new Resend(cfg.apiKey);
    cachedClientKey = key;
  }

  return cachedClient;
}

function normalizeFrom(inputFrom) {
  // Requirement: sender identity must remain `contact@aken.firm.in`
  // Allow overriding display name via EMAIL_FROM, but keep the address if user misconfigures.
  const enforcedAddress = "contact@aken.firm.in";

  const from = String(inputFrom || "").trim();
  if (!from) {
    return `"A K ENGINEERING" <${enforcedAddress}>`;
  }

  // If from is just an email, wrap with display name.
  if (!from.includes("<") && from.includes("@")) {
    return `"A K ENGINEERING" <${from}>`;
  }

  // If configured address differs, hard-enforce the mailbox.
  // Example: "A K ENGINEERING" <someone@other.com> => "A K ENGINEERING" <contact@aken.firm.in>
  const match = from.match(/^(.*<)([^>]+)(>.*)$/);
  if (match) {
    const prefix = match[1];
    const suffix = match[3];
    return `${prefix}${enforcedAddress}${suffix}`;
  }

  return from;
}

function toSafeMailError(error) {
  if (!error) return null;

  // Resend SDK throws errors with various shapes; capture common fields without secrets.
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    type: error.type,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    details: error.details,
  };
}

/**
 * sendEmail(mailOptions)
 * Backward-compatible surface with prior Nodemailer usage.
 * Supports: to, subject, html, text, from, replyTo
 */
async function sendEmail(mailOptions) {
  const client = getResendClient();

  const finalOptions = {
    ...mailOptions,
    from: normalizeFrom(
      mailOptions.from || getResendConfig().from || `"A K ENGINEERING" <contact@aken.firm.in>`,
    ),
  };

  try {
    const payload = {
      from: finalOptions.from,
      to: String(finalOptions.to || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      subject: finalOptions.subject,
      html: finalOptions.html,
      text: finalOptions.text,
      reply_to: finalOptions.replyTo || finalOptions.reply_to,
    };

    const res = await client.emails.send(payload);

    // Keep parity with Nodemailer's "info"-ish return being truthy and loggable.
    return {
      provider: "resend",
      id: res?.data?.id || null,
      data: res?.data || null,
      error: res?.error || null,
    };
  } catch (error) {
    console.error("[mail] send failed", {
      to: finalOptions.to,
      subject: finalOptions.subject,
      from: finalOptions.from,
      provider: "resend",
      err: toSafeMailError(error),
    });
    throw error;
  }
}

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.isEmailConfigured = isEmailConfigured;
module.exports.toSafeMailError = toSafeMailError;
