import { NextRequest, NextResponse } from "next/server";

type AppError = Error & {
  statusCode?: number;
  code?: string;
};

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

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

async function readBody(req: NextRequest) {
  try {
    const arrayBuffer = await req.arrayBuffer();
    return arrayBuffer.byteLength ? arrayBuffer : undefined;
  } catch {
    return undefined;
  }
}

function jsonError(status: number, code: string, message: string, requestId?: string) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(requestId ? { "x-request-id": requestId } : {}),
      },
    },
  );
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  let targetUrl = "";

  try {
    const backendBaseUrl = getBackendBaseUrlOrThrow();
    targetUrl = `${backendBaseUrl}/api/leads`;
  } catch (error) {
    const err = error as AppError;
    const statusCode = Number(err?.statusCode) || 500;
    const code = String(err?.code || "BACKEND_PROXY_MISCONFIGURED");

    console.error("[public-leads-proxy] misconfigured", {
      requestId,
      code,
      statusCode,
      backendApiUrl: (process.env.BACKEND_API_URL || "").trim() || null,
      nodeEnv: process.env.NODE_ENV || "development",
    });

    return jsonError(statusCode, code, "Server is misconfigured. Please try again later.", requestId);
  }

  const contentType = req.headers.get("content-type") || "application/json";
  const body = await readBody(req);

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

    const resHeaders = new Headers();
    resHeaders.set("Cache-Control", "no-store");
    resHeaders.set("x-request-id", requestId);
    resHeaders.set("Content-Type", upstreamRes.headers.get("content-type") || "application/json");

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (error) {
    const err = error as AppError;

    console.error("[public-leads-proxy] upstream fetch failed", {
      requestId,
      targetUrl,
      message: err?.message,
      name: err?.name,
    });

    return jsonError(503, "UPSTREAM_UNAVAILABLE", "Lead service temporarily unavailable.", requestId);
  }
}
