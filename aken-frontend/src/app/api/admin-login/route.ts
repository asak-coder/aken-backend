import { NextRequest, NextResponse } from "next/server";

const FAILED_LOGIN_DELAY_MS = 700;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackendUrl() {
  const url = (process.env.BACKEND_API_URL || "").trim();
  return url || "http://localhost:5000";
}

export async function POST(req: NextRequest) {
  let identifier = "";
  let password = "";

  try {
    const body = await req.json();
    identifier = String(body?.identifier || "").trim();
    password = String(body?.password || "");
  } catch {
    const response = NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (!identifier || !password) {
    const response = NextResponse.json(
      { error: "Email/username and password are required." },
      { status: 400 },
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // Call backend login and COPY its Set-Cookie header to the browser response.
  // IMPORTANT: `credentials: "include"` here does NOT forward cookies to the browser,
  // because this fetch happens server-side (Vercel). We must pass Set-Cookie ourselves.
  const backendRes = await fetch(`${getBackendUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  if (!backendRes.ok) {
    await sleep(FAILED_LOGIN_DELAY_MS);
    // Do not leak backend error details to client.
    const response = NextResponse.json(
      { error: "Invalid credentials." },
      { status: backendRes.status },
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const data = await backendRes.json().catch(() => ({}));

  const response = NextResponse.json({ success: true, ...data?.data });
  response.headers.set("Cache-Control", "no-store");

  const setCookie = backendRes.headers.get("set-cookie");
  if (setCookie) {
    // Forward backend HttpOnly cookie to the browser.
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
