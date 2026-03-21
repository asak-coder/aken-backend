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
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_* (preferred) or EMAIL_USER/EMAIL_PASS environment variables.",
    );
  }

  const smtp = getSmtpConfig();
  const hasSmtpConfig =
    Boolean(smtp.host) &&
    Boolean(smtp.port) &&
    Boolean(smtp.user) &&
    Boolean(smtp.pass);

  if (hasSmtpConfig) {
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      // Zoho/465 often benefits from an explicit connection timeout.
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
    });
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
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

async function sendEmail(mailOptions) {
  const transporter = getTransporter();
  const finalOptions = {
    ...mailOptions,
    from: mailOptions.from || getDefaultFromAddress(),
  };

  try {
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
