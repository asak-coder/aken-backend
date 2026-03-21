const nodemailer = require("nodemailer");

let cachedTransporter = null;
let cachedTransporterKey = null;

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || "").trim();
  const portRaw = (process.env.SMTP_PORT || "").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const pass = process.env.SMTP_PASS || "";
  const secureRaw = (process.env.SMTP_SECURE || "").trim();

  return {
    host,
    port: portRaw ? Number(portRaw) : null,
    secure: String(secureRaw || "false").toLowerCase() === "true",
    user,
    pass,
  };
}

function isEmailConfigured() {
  const smtp = getSmtpConfig();
  const hasSmtpConfig =
    Boolean(smtp.host) &&
    Boolean(smtp.port) &&
    Boolean(smtp.user) &&
    Boolean(smtp.pass);

  // Production requirement: Zoho SMTP only.
  if (process.env.NODE_ENV === "production") {
    return hasSmtpConfig;
  }

  // Allow legacy local/testing config in non-production.
  const hasGmailStyleConfig =
    Boolean(process.env.EMAIL_USER) && Boolean(process.env.EMAIL_PASS);

  return hasSmtpConfig || hasGmailStyleConfig;
}

function getDefaultFromAddress() {
  const explicitFrom = process.env.EMAIL_FROM;
  if (explicitFrom) {
    return explicitFrom;
  }

  const senderUser = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
  return senderUser
    ? `"A K ENGINEERING" <${senderUser}>`
    : `"A K ENGINEERING" <no-reply@aken.firm.in>`;
}

function createTransporter() {
  const smtp = getSmtpConfig();
  const hasSmtpConfig =
    Boolean(smtp.host) &&
    Boolean(smtp.port) &&
    Boolean(smtp.user) &&
    Boolean(smtp.pass);

  // Production requirement: SMTP only (Zoho). Fail closed.
  if (process.env.NODE_ENV === "production") {
    assertProductionZohoSmtpOrThrow();
  }

  if (!hasSmtpConfig) {
    // Allow legacy local/testing config in non-production only.
    if (Boolean(process.env.EMAIL_USER) && Boolean(process.env.EMAIL_PASS)) {
      return nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    }

    throw new Error(
      "Email is not configured. Set SMTP_* (preferred) or EMAIL_USER/EMAIL_PASS for local testing.",
    );
  }

  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
  });
}

function getTransporterCacheKey() {
  const smtp = getSmtpConfig();
  return [
    smtp.host,
    smtp.port,
    smtp.secure,
    smtp.user,
    Boolean(smtp.pass),
    (process.env.EMAIL_SERVICE || "").trim(),
    Boolean(process.env.EMAIL_USER),
    Boolean(process.env.EMAIL_PASS),
  ].join("|");
}

function getTransporter() {
  const key = getTransporterCacheKey();
  if (!cachedTransporter || cachedTransporterKey !== key) {
    cachedTransporter = createTransporter();
    cachedTransporterKey = key;
  }

  return cachedTransporter;
}

function toSafeMailError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    command: error.command,
    response: error.response,
    responseCode: error.responseCode,
    rejected: error.rejected,
    rejectedErrors: error.rejectedErrors,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  };
}

function assertProductionZohoSmtpOrThrow() {
  if (process.env.NODE_ENV !== "production") return;

  const smtp = getSmtpConfig();
  const missing = [];
  if (!smtp.host) missing.push("SMTP_HOST");
  if (!smtp.port) missing.push("SMTP_PORT");
  if (!smtp.user) missing.push("SMTP_USER");
  if (!smtp.pass) missing.push("SMTP_PASS");

  if (missing.length > 0) {
    throw new Error(
      `Email is not configured for production. Missing: ${missing.join(", ")}.`,
    );
  }

  const host = String(smtp.host || "").toLowerCase();
  // Enforce Zoho SMTP only (per requirement). Example: smtppro.zoho.in
  if (!host.includes("zoho.")) {
    throw new Error(
      "Invalid SMTP_HOST for production. Zoho SMTP is required (e.g. smtppro.zoho.in).",
    );
  }
}

async function sendEmail(mailOptions) {
  const transporter = getTransporter();
  const finalOptions = {
    ...mailOptions,
    from: mailOptions.from || getDefaultFromAddress(),
  };

  try {
    // Verify is expensive; only do it when explicitly requested (e.g. diagnosis)
    // or when running in production with VERBOSE_EMAIL_LOGS enabled.
    if (String(process.env.EMAIL_VERIFY_ON_SEND || "").toLowerCase() === "true") {
      await transporter.verify();
    }

    return await transporter.sendMail(finalOptions);
  } catch (error) {
    // High-signal structured log, without secrets.
    console.error("[mail] send failed", {
      to: finalOptions.to,
      subject: finalOptions.subject,
      from: finalOptions.from,
      smtpHost: (process.env.SMTP_HOST || "").trim() || null,
      smtpPort: (process.env.SMTP_PORT || "").trim() || null,
      smtpSecure: String(process.env.SMTP_SECURE || "").trim() || null,
      err: toSafeMailError(error),
    });
    throw error;
  }
}

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.isEmailConfigured = isEmailConfigured;
module.exports.toSafeMailError = toSafeMailError;
