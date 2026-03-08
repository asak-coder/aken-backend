import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getBackendUrl() {
  const url = (process.env.BACKEND_API_URL || "").trim();
  return url || "http://localhost:5000";
}

export async function POST(req: NextRequest) {
  const targetUrl = `${getBackendUrl().replace(/\/$/, "")}/api/leads`;

  // Only forward what we must.
  const contentType = req.headers.get("content-type") || "application/json";

  let body: BodyInit | undefined;
  try {
    const arrayBuffer = await req.arrayBuffer();
    body = arrayBuffer.byteLength ? arrayBuffer : undefined;
  } catch {
    body = undefined;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "content-type": contentType,
      },
      body,
      cache: "no-store",
    });

    // Pass through status + response body; prevent caching.
    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": upstreamRes.headers.get("content-type") || "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Lead service temporarily unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
