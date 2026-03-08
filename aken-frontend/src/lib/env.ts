const DEFAULT_DEV_API_URL = "http://localhost:5000";
const SAFE_PUBLIC_ENV_KEYS = new Set([
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_GA_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL",
  "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
]);

const PUBLIC_SECRET_KEY_PATTERN =
  /(SECRET|PASSWORD|TOKEN|PRIVATE|API_KEY|ACCESS_KEY|AUTH|JWT|MONGO|DATABASE|SMTP|WEBHOOK|STRIPE|RAZORPAY)/i;

function normalizeHttpUrl(rawValue: string | undefined): string {
  const value = (rawValue || "").trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function getNodeEnv() {
  return process.env.NODE_ENV || "development";
}

function getLeakedPublicEnvKeys() {
  return Object.keys(process.env)
    .filter((key) => key.startsWith("NEXT_PUBLIC_"))
    .filter((key) => !SAFE_PUBLIC_ENV_KEYS.has(key))
    .filter((key) => PUBLIC_SECRET_KEY_PATTERN.test(key))
    .sort();
}

export function getPublicApiBaseUrl() {
  const configuredUrl = normalizeHttpUrl(process.env.NEXT_PUBLIC_API_URL);
  if (configuredUrl) {
    return configuredUrl;
  }

  if (getNodeEnv() !== "production") {
    return DEFAULT_DEV_API_URL;
  }

  return "";
}

export function getPublicGaId() {
  const gaId = (process.env.NEXT_PUBLIC_GA_ID || "").trim();
  const validGaId = /^G-[A-Z0-9]+$/i;
  return validGaId.test(gaId) ? gaId : "";
}

export function getPublicGoogleAdsId() {
  const adsId = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "").trim();
  const validAdsId = /^AW-\d+$/i;
  return validAdsId.test(adsId) ? adsId : "";
}

export function getPublicGoogleAdsLeadLabel() {
  const label = (process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL || "").trim();
  const validLabel = /^[A-Za-z0-9_-]+$/;
  return validLabel.test(label) ? label : "";
}

export function getPublicGoogleAdsLeadSendTo() {
  const adsId = getPublicGoogleAdsId();
  const label = getPublicGoogleAdsLeadLabel();

  if (!adsId || !label) {
    return "";
  }

  return `${adsId}/${label}`;
}

export type PublicEnvCheckStatus = "ok" | "warning" | "error";

export type PublicEnvCheckItem = {
  key: string;
  status: PublicEnvCheckStatus;
  message: string;
};

export function getPublicEnvChecklist() {
  const checks: PublicEnvCheckItem[] = [];
  const nodeEnv = getNodeEnv();
  const isProduction = nodeEnv === "production";

  const apiUrl = normalizeHttpUrl(process.env.NEXT_PUBLIC_API_URL);
  checks.push({
    key: "NEXT_PUBLIC_API_URL",
    status: apiUrl ? "ok" : isProduction ? "error" : "warning",
    message: apiUrl
      ? "Frontend can reach backend API."
      : isProduction
        ? "Missing/invalid API URL. Lead forms and admin dashboards will fail."
        : "Using local fallback API URL in development.",
  });

  const gaIdRaw = (process.env.NEXT_PUBLIC_GA_ID || "").trim();
  const gaId = getPublicGaId();
  checks.push({
    key: "NEXT_PUBLIC_GA_ID",
    status: gaIdRaw
      ? gaId
        ? "ok"
        : "error"
      : "warning",
    message: gaIdRaw
      ? gaId
        ? "GA4 measurement ID is valid."
        : "GA4 ID format is invalid. Expected G-XXXXXXXXXX."
      : "GA4 ID is not configured.",
  });

  const adsIdRaw = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "").trim();
  const adsId = getPublicGoogleAdsId();
  checks.push({
    key: "NEXT_PUBLIC_GOOGLE_ADS_ID",
    status: adsIdRaw
      ? adsId
        ? "ok"
        : "error"
      : "warning",
    message: adsIdRaw
      ? adsId
        ? "Google Ads ID is valid."
        : "Google Ads ID format is invalid. Expected AW-123456789."
      : "Google Ads ID is not configured.",
  });

  const leadLabelRaw = (process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL || "").trim();
  const leadLabel = getPublicGoogleAdsLeadLabel();
  checks.push({
    key: "NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL",
    status: leadLabelRaw
      ? leadLabel
        ? "ok"
        : "error"
      : "warning",
    message: leadLabelRaw
      ? leadLabel
        ? "Google Ads lead label format is valid."
        : "Lead label format is invalid. Use only letters, numbers, '_' or '-'."
      : "Google Ads lead label is not configured.",
  });

  const siteVerificationRaw = (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "").trim();
  checks.push({
    key: "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION",
    status: siteVerificationRaw ? "ok" : "warning",
    message: siteVerificationRaw
      ? "Search Console verification token is present."
      : "Search Console verification token is not set.",
  });

  const leakedPublicKeys = getLeakedPublicEnvKeys();
  checks.push({
    key: "NEXT_PUBLIC_SECRET_SCAN",
    status: leakedPublicKeys.length ? "error" : "ok",
    message: leakedPublicKeys.length
      ? `Secret leak risk: remove ${leakedPublicKeys.join(", ")} immediately.`
      : "No exposed secrets found in public environment variables.",
  });

  return checks;
}

export function getEnvWarnings() {
  const warnings: string[] = [];

  if (!normalizeHttpUrl(process.env.NEXT_PUBLIC_API_URL)) {
    if (getNodeEnv() === "production") {
      warnings.push(
        "NEXT_PUBLIC_API_URL is missing or invalid. Lead forms will fail in production.",
      );
    }
  }

  const leakedPublicKeys = getLeakedPublicEnvKeys();
  if (leakedPublicKeys.length) {
    warnings.push(
      `Remove secret-like public env keys: ${leakedPublicKeys.join(", ")}. NEXT_PUBLIC_ values are exposed to every browser.`,
    );
  }

  const rawAdsId = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "").trim();
  const rawLeadLabel = (process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL || "").trim();
  const validAdsId = getPublicGoogleAdsId();
  const validLeadLabel = getPublicGoogleAdsLeadLabel();

  if (rawAdsId && !validAdsId) {
    warnings.push(
      "NEXT_PUBLIC_GOOGLE_ADS_ID is invalid. Expected format: AW-123456789.",
    );
  }

  if (rawLeadLabel && !validLeadLabel) {
    warnings.push(
      "NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL is invalid. Use only letters, numbers, '_' or '-'.",
    );
  }

  if (getNodeEnv() === "production") {
    if ((validAdsId && !validLeadLabel) || (!validAdsId && validLeadLabel)) {
      warnings.push(
        "Google Ads conversion setup is incomplete. Set both NEXT_PUBLIC_GOOGLE_ADS_ID and NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL.",
      );
    }
  }

  return warnings;
}
