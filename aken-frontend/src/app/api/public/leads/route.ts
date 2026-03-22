import { NextRequest, NextResponse } from "next/server";

type AppError = Error & {
  statusCode?: number;
  code?: string;
};

export const runtime = "nodejs";

function normalizeBackendBaseUrl(rawValue: string | undefined) {
  const value = (rawValue || "").trim();
  if (!value) return "";

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

function isLocalhostTarget(target: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(target);
}

function getBackendBaseUrlOrThrow() {
  const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase();
  const isProduction = nodeEnv === "production";
  const backendBaseUrl = normalizeBackendBaseUrl(process.env.BACKEND_API_URL);

  if (!backendBaseUrl) {
    const error = new Error("BACKEND_API_URL is missing or invalid.");
    // @ts-expect-error custom metadata
    error.statusCode = 500;
    // @ts-expect-error custom metadata
    error.code = isProduction ? "BACKEND_API_URL_MISSING" : "BACKEND_API_URL_INVALID";
    throw error;
  }

  if (isLocalhostTarget(backendBaseUrl)) {
    const error = new Error("BACKEND_API_URL must not point to localhost.");
    // @ts-expect-error custom metadata
    error.statusCode = 500;
    // @ts-expect-error custom metadata
    error.code = isProduction
      ? "BACKEND_API_URL_LOCALHOST_FORBIDDEN"
      : "BACKEND_API_URL_LOCALHOST";
    throw error;
  }

  return backendBaseUrl;
}

export async function POST(req: NextRequest) {
  let targetUrl = "";

  try {
    const backendBaseUrl = getBackendBaseUrlOrThrow();
    targetUrl = `${backendBaseUrl}/api/leads`;
  } catch (error) {
    const err = error as AppError;
    const statusCode = Number(err?.statusCode) || 500;
    const code = String(err?.code || "BACKEND_PROXY_MISCONFIGURED");

    console.error("[public-leads-proxy] misconfigured", {
      code,
      statusCode,
      backendApiUrl: (process.env.BACKEND_API_URL || "").trim() || null,
      nodeEnv: process.env.NODE_ENV || "development",
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message: "Server is misconfigured. Please try again later.",
        },
      },
      { status: statusCode, headers: { "Cache-Control": "no-store" } },
    );
  }

  const contentType = req.headers.get("content-type") || "application/json";

  let body: BodyInit | undefined;
  try {
    const arrayBuffer = await req.arrayBuffer();
    body = arrayBuffer.byteLength ? arrayBuffer : undefined;
  } catch {
    body = undefined;
  }

  const requestId = crypto.randomUUID();

  try {
    console.log("[public-leads-proxy] upstream request", {
      requestId,
      targetUrl,
      contentType,
    });

    const upstreamRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "content-type": contentType,
        "x-request-id": requestId,
      },
      body,
      cache: "no-store",
    });

    console.log("[public-leads-proxy] upstream response", {
      requestId,
      targetUrl,
      status: upstreamRes.status,
      ok: upstreamRes.ok,
    });

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": upstreamRes.headers.get("content-type") || "application/json",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    const err = error as AppError;

    console.error("[public-leads-proxy] upstream fetch failed", {
      requestId,
      targetUrl,
      message: err?.message,
      name: err?.name,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Lead service temporarily unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
    );
  }
}
