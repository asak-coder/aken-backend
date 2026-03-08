const STORAGE_KEY = "akeng_lead_attribution";
const ATTR_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
];

function getCurrentPath() {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.pathname}${window.location.search}`;
}

function parseAttributionFromSearch() {
  if (typeof window === "undefined") {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const output = {};

  for (const key of ATTR_KEYS) {
    const value = params.get(key);
    if (value) {
      output[key] = value.trim();
    }
  }

  return output;
}

function getStoredAttribution() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function saveStoredAttribution(payload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures on private mode or blocked storage.
  }
}

export function persistAttributionFromUrl() {
  if (typeof window === "undefined") {
    return {};
  }

  const currentPath = getCurrentPath();
  const fromSearch = parseAttributionFromSearch();
  const existing = getStoredAttribution();
  const merged = { ...existing };

  if (!merged.firstLandingPage) {
    merged.firstLandingPage = currentPath;
  }

  for (const key of ATTR_KEYS) {
    if (!merged[key] && fromSearch[key]) {
      merged[key] = fromSearch[key];
    }
  }

  merged.lastLandingPage = currentPath;
  merged.lastSeenAt = new Date().toISOString();

  saveStoredAttribution(merged);
  return merged;
}

function trimMax(value, max) {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  return value.trim().slice(0, max);
}

export function getLeadAttributionPayload() {
  if (typeof window === "undefined") {
    return {};
  }

  const stored = persistAttributionFromUrl();
  const payload = {};

  const map = [
    ["utmSource", "utm_source", 120],
    ["utmMedium", "utm_medium", 120],
    ["utmCampaign", "utm_campaign", 120],
    ["utmTerm", "utm_term", 120],
    ["utmContent", "utm_content", 120],
    ["gclid", "gclid", 200],
    ["fbclid", "fbclid", 200],
    ["msclkid", "msclkid", 200],
  ];

  for (const [targetKey, sourceKey, maxLen] of map) {
    const value = trimMax(stored[sourceKey], maxLen);
    if (value) {
      payload[targetKey] = value;
    }
  }

  const landingPage = trimMax(stored.firstLandingPage || getCurrentPath(), 300);
  const referrerUrl = trimMax(window.document.referrer, 500);

  if (landingPage) {
    payload.landingPage = landingPage;
  }

  if (referrerUrl) {
    payload.referrerUrl = referrerUrl;
  }

  return payload;
}
