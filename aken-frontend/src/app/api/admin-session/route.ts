import { NextRequest, NextResponse } from "next/server";

function getBackendUrl() {
  const url = (process.env.BACKEND_API_URL || "").trim();
  return url || "http://localhost:5000";
}

export async function GET(req: NextRequest) {
  const backendRes = await fetch(`${getBackendUrl()}/api/auth/session`, {
    method: "GET",
    headers: {
      // Forward browser cookies to backend so it can validate session.
      cookie: req.headers.get("cookie") || "",
    },
  });

  if (!backendRes.ok) {
    const response = NextResponse.json({ authenticated: false }, { status: backendRes.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const data = await backendRes.json().catch(() => ({}));

  const response = NextResponse.json({ ...data?.data, authenticated: true });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
