function getNodeEnv() {
  return (process.env.NODE_ENV || "development").trim().toLowerCase();
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function isBooleanLike(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "false";
}

function isSupabaseUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;

  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isServiceRoleKeyLike(value) {
  const normalized = String(value || "").trim();
  // Supabase service-role JWT keys are long base64/JWT strings.
  return normalized.length >= 40;
}

function getBackendEnvDiagnostics() {
  const nodeEnv = getNodeEnv();
  const isProduction = nodeEnv === "production";
  const checks = [];

  const supabaseUrl = process.env.SUPABASE_URL;
  checks.push({
    key: "SUPABASE_URL",
    category: "database",
    severity: "critical",
    status: hasValue("SUPABASE_URL")
      ? isSupabaseUrl(supabaseUrl)
        ? "ok"
        : "invalid"
      : "missing",
    message: hasValue("SUPABASE_URL")
      ? isSupabaseUrl(supabaseUrl)
        ? "Supabase project URL is configured."
        : "SUPABASE_URL format looks invalid. Expected https://<project-ref>.supabase.co."
      : "SUPABASE_URL is missing.",
  });

  checks.push({
    key: "SUPABASE_SERVICE_ROLE_KEY",
    category: "database",
    severity: "critical",
    status: hasValue("SUPABASE_SERVICE_ROLE_KEY")
      ? isServiceRoleKeyLike(process.env.SUPABASE_SERVICE_ROLE_KEY)
        ? "ok"
        : "invalid"
      : "missing",
    message: hasValue("SUPABASE_SERVICE_ROLE_KEY")
      ? isServiceRoleKeyLike(process.env.SUPABASE_SERVICE_ROLE_KEY)
        ? "Supabase service-role key is configured."
        : "SUPABASE_SERVICE_ROLE_KEY looks too short. Expected the full JWT service-role key."
      : "SUPABASE_SERVICE_ROLE_KEY is missing.",
  });

  const corsOrigins = parseList(process.env.CORS_ORIGINS);
  const frontendUrl = String(process.env.FRONTEND_URL || "").trim();
  const combinedOrigins = [...corsOrigins, ...(frontendUrl ? [frontendUrl] : [])];
  const hasCorsConfig = combinedOrigins.length > 0;
  const hasWildcardCors = combinedOrigins.some((origin) => origin === "*" || origin.includes("*"));

  checks.push({
    key: "CORS_ORIGINS/FRONTEND_URL",
    category: "security",
    severity: isProduction ? "critical" : "warning",
    status: hasCorsConfig
      ? hasWildcardCors && isProduction
        ? "invalid"
        : "ok"
      : isProduction
        ? "missing"
        : "warning",
    message: hasCorsConfig
      ? hasWildcardCors && isProduction
        ? "Wildcard CORS is not allowed in production."
        : "Allowed origins are configured."
      : isProduction
        ? "Set CORS_ORIGINS or FRONTEND_URL in production."
        : "CORS_ORIGINS/FRONTEND_URL not set. Local defaults will be used.",
  });

  checks.push({
    key: "JWT_SECRET",
    category: "security",
    severity: "warning",
    status: hasValue("JWT_SECRET") ? "ok" : "warning",
    message: hasValue("JWT_SECRET")
      ? "JWT secret is configured."
      : "JWT_SECRET is missing. /api/auth login token flow will fail.",
  });

  const hasSmtpFullConfig =
    hasValue("SMTP_HOST") &&
    hasValue("SMTP_PORT") &&
    hasValue("SMTP_USER") &&
    hasValue("SMTP_PASS");
  const hasLegacyEmailConfig = hasValue("EMAIL_USER") && hasValue("EMAIL_PASS");
  const hasPartialSmtp =
    hasValue("SMTP_HOST") ||
    hasValue("SMTP_PORT") ||
    hasValue("SMTP_USER") ||
    hasValue("SMTP_PASS");

  checks.push({
    key: "SMTP_* / EMAIL_*",
    category: "notifications",
    severity: "warning",
    status: hasSmtpFullConfig || hasLegacyEmailConfig
      ? "ok"
      : hasPartialSmtp
        ? "invalid"
        : "warning",
    message: hasSmtpFullConfig || hasLegacyEmailConfig
      ? "Email notifications are configured."
      : hasPartialSmtp
        ? "SMTP config is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS."
        : "Email notifications are not configured.",
  });

  checks.push({
    key: "WHATSAPP_WEBHOOK_URL",
    category: "notifications",
    severity: "warning",
    status: hasValue("WHATSAPP_WEBHOOK_URL")
      ? "ok"
      : hasValue("WHATSAPP_WEBHOOK_TOKEN")
        ? "invalid"
        : "warning",
    message: hasValue("WHATSAPP_WEBHOOK_URL")
      ? "WhatsApp webhook is configured."
      : hasValue("WHATSAPP_WEBHOOK_TOKEN")
        ? "WHATSAPP_WEBHOOK_TOKEN is set but WHATSAPP_WEBHOOK_URL is missing."
        : "WhatsApp webhook is not configured.",
  });

  checks.push({
    key: "QUOTATION_GENERATE_PDF",
    category: "operations",
    severity: "warning",
    status:
      process.env.QUOTATION_GENERATE_PDF === undefined
        ? "ok"
        : isBooleanLike(process.env.QUOTATION_GENERATE_PDF)
          ? "ok"
          : "invalid",
    message:
      process.env.QUOTATION_GENERATE_PDF === undefined
        ? "QUOTATION_GENERATE_PDF is not set. Default true will be used."
        : isBooleanLike(process.env.QUOTATION_GENERATE_PDF)
          ? "QUOTATION_GENERATE_PDF format is valid."
          : "QUOTATION_GENERATE_PDF must be true or false.",
  });

  const criticalFailures = checks.filter(
    (check) => check.severity === "critical" && (check.status === "missing" || check.status === "invalid"),
  );
  const warnings = checks.filter(
    (check) => check.severity === "warning" && check.status !== "ok",
  );

  return {
    nodeEnv,
    isProduction,
    checkedAt: new Date().toISOString(),
    checks,
    summary: {
      criticalFailureCount: criticalFailures.length,
      warningCount: warnings.length,
      readyForProduction: criticalFailures.length === 0,
    },
  };
}

function assertBackendEnvForStartup() {
  const diagnostics = getBackendEnvDiagnostics();
  if (diagnostics.isProduction && !diagnostics.summary.readyForProduction) {
    const issues = diagnostics.checks
      .filter((check) => check.severity === "critical" && check.status !== "ok")
      .map((check) => `${check.key}: ${check.message}`);

    const error = new Error(
      `Production environment validation failed: ${issues.join(" | ")}`,
    );
    error.code = "ENV_VALIDATION_FAILED";
    throw error;
  }

  return diagnostics;
}

module.exports = {
  getBackendEnvDiagnostics,
  assertBackendEnvForStartup,
};
