import crypto from "crypto";

type AdminSessionPayload = {
  sub: "admin";
  iat: number;
  exp: number;
  sid: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getAuthSecret() {
  const configuredSecret = (process.env.ADMIN_AUTH_SECRET || "").trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-only-insecure-admin-auth-secret-change-me";
  }

  return "";
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${pad}`, "base64").toString("utf8");
}

function hmacSha256(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeCompare(valueA: string, valueB: string) {
  const hashA = crypto.createHash("sha256").update(valueA).digest();
  const hashB = crypto.createHash("sha256").update(valueB).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function getAdminCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-aken_admin_session"
    : "aken_admin_session";
}

export function getAdminSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

export function hasValidAdminAuthConfig() {
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  const secret = getAuthSecret();
  return Boolean(password && secret);
}

export function isValidAdminCredentials(username: string, password: string) {
  const expectedUsername = (process.env.ADMIN_USERNAME || "admin").trim();
  const expectedPassword = (process.env.ADMIN_PASSWORD || "").trim();

  if (!expectedPassword) {
    return false;
  }

  return (
    safeCompare(username.trim().toLowerCase(), expectedUsername.toLowerCase()) &&
    safeCompare(password, expectedPassword)
  );
}

export function createAdminSessionToken() {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("ADMIN_AUTH_SECRET is missing.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    sub: "admin",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    sid: crypto.randomBytes(16).toString("hex"),
  };

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacSha256(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string) {
  const secret = getAuthSecret();
  if (!secret) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, incomingSignature] = parts;
  const expectedSignature = hmacSha256(`${encodedHeader}.${encodedPayload}`, secret);
  if (!safeCompare(incomingSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminSessionPayload;
    if (!payload || payload.sub !== "admin") {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
