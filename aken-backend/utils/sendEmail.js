const nodemailer = require("nodemailer");

let cachedTransporter = null;

function isEmailConfigured() {
  const hasSmtpConfig =
    Boolean(process.env.SMTP_HOST) &&
    Boolean(process.env.SMTP_PORT) &&
    Boolean(process.env.SMTP_USER) &&
    Boolean(process.env.SMTP_PASS);

  const hasGmailStyleConfig =
    Boolean(process.env.EMAIL_USER) && Boolean(process.env.EMAIL_PASS);

  return hasSmtpConfig || hasGmailStyleConfig;
}

function getDefaultFromAddress() {
  const explicitFrom = process.env.EMAIL_FROM;
  if (explicitFrom) {
    return explicitFrom;
  }

  const senderUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  return senderUser
    ? `"A K ENGINEERING" <${senderUser}>`
    : `"A K ENGINEERING" <no-reply@aken.firm.in>`;
}

function createTransporter() {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_* or EMAIL_USER/EMAIL_PASS environment variables.",
    );
  }

  const hasSmtpConfig =
    Boolean(process.env.SMTP_HOST) &&
    Boolean(process.env.SMTP_PORT) &&
    Boolean(process.env.SMTP_USER) &&
    Boolean(process.env.SMTP_PASS);

  if (hasSmtpConfig) {
    const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
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

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = createTransporter();
  }

  return cachedTransporter;
}

async function sendEmail(mailOptions) {
  const transporter = getTransporter();
  const finalOptions = {
    ...mailOptions,
    from: mailOptions.from || getDefaultFromAddress(),
  };

  return transporter.sendMail(finalOptions);
}

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.isEmailConfigured = isEmailConfigured;
