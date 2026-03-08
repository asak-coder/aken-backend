import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getBackendUrl() {
  const url = (process.env.BACKEND_API_URL || "").trim();
  return url || "http://localhost:5000";
}

function buildTargetUrl(pathParts: string[] | undefined, search: string) {
  const base = getBackendUrl().replace(/\/$/, "");
  const path = (pathParts || []).map((part) => encodeURIComponent(part)).join("/");
  return `${base}/api/${path}${search || ""}`;
}

async function proxyRequest(req: NextRequest, pathParts: string[] | undefined) {
  const targetUrl = buildTargetUrl(pathParts, new URL(req.url).search);

  // Forward minimal safe headers.
  const headers = new Headers();
  const csrf = req.headers.get("x-csrf-token");
  if (csrf) {
    headers.set("x-csrf-token", csrf);
  }
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  // Read body only when needed.
  let body: BodyInit | undefined = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const arrayBuffer = await req.arrayBuffer();
    body = arrayBuffer.byteLength ? arrayBuffer : undefined;
  }

  // IMPORTANT:
  // This runs server-side (Vercel). `credentials: "include"` does NOT forward
  // the browser cookies to the backend. We must explicitly pass the Cookie header.
  const cookie = req.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }

  const backendRes = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
  });

  // NOTE: To avoid `ERR_CONTENT_DECODING_FAILED` we do NOT forward compressed
  // responses (br/gzip) across proxy boundaries. We fetch as identity, and we
  // also strip any upstream content-encoding headers.
  const raw = await backendRes.arrayBuffer();

  const resHeaders = new Headers(backendRes.headers);
  resHeaders.set("Cache-Control", "no-store");
  resHeaders.delete("content-encoding");
  resHeaders.delete("content-length");

  return new NextResponse(raw, {
    status: backendRes.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const resolved = await params;
  return proxyRequest(req, resolved.path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const resolved = await params;
  return proxyRequest(req, resolved.path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const resolved = await params;
  return proxyRequest(req, resolved.path);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const resolved = await params;
  return proxyRequest(req, resolved.path);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const resolved = await params;
  return proxyRequest(req, resolved.path);
}
