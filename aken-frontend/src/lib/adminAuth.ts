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

/**
 * NOTE:
 * This file previously contained a demo "ADMIN_PASSWORD" based auth implementation.
 * The production admin auth for this repo now lives in the backend (Express) and uses
 * bcrypt + a JWT session stored in an HttpOnly cookie.
 *
 * Keep only the cookie name helper here for client/server usage in Next.js.
 */
