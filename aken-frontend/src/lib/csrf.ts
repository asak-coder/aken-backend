/**
 * Client-side CSRF token utility for admin requests.
 *
 * The backend sets a non-HttpOnly cookie named "aken_csrf" containing a
 * cryptographic token. For every unsafe (POST/PUT/PATCH/DELETE) admin
 * request, the frontend must send the same value back via the
 * X-CSRF-Token header. This module reads the cookie and provides the
 * token to callers.
 */

const CSRF_COOKIE_NAME = "aken_csrf";

/**
 * Read a cookie value by name from document.cookie (browser only).
 * Returns "" if the cookie is not found.
 */
function getCookieValue(name: string): string {
  if (typeof document === "undefined") return "";

  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return "";

  return decodeURIComponent(match.split("=").slice(1).join("="));
}

/**
 * Return the current CSRF token from the browser cookie.
 * Returns "" if not available (e.g. server-side or cookie not set).
 */
export function getCsrfToken(): string {
  return getCookieValue(CSRF_COOKIE_NAME);
}

/**
 * Build headers object that includes X-CSRF-Token for unsafe methods.
 * Safe methods (GET, HEAD, OPTIONS) do not need the header.
 */
export function csrfHeaders(method?: string): Record<string, string> {
  const safe = ["GET", "HEAD", "OPTIONS"];
  const m = (method || "GET").toUpperCase();
  if (safe.includes(m)) return {};

  const token = getCsrfToken();
  if (!token) return {};

  return { "X-CSRF-Token": token };
}
