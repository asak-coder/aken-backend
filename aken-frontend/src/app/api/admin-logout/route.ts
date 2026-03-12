import { NextRequest, NextResponse } from "next/server";

function getBackendUrl() {
  const url = (process.env.BACKEND_API_URL || "").trim();
  return url || "http://localhost:5000";
}

function appendSetCookieHeaders(nextRes: NextResponse, backendRes: Response) {
  // Node/undici exposes multiple Set-Cookie headers via getSetCookie()
  // (supported in Next.js runtime = nodejs).
  const anyHeaders = backendRes.headers as unknown as {
    getSetCookie?: () => string[];
  };

  const cookies =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : (() => {
          const single = backendRes.headers.get("set-cookie");
          return single ? [single] : [];
        })();

  for (const cookie of cookies) {
    if (cookie) nextRes.headers.append("set-cookie", cookie);
  }
}

export async function POST(req: NextRequest) {
  // Server-side route: we MUST forward Cookie + CSRF header to backend explicitly.
  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const csrf = req.headers.get("x-csrf-token");
  if (csrf) headers.set("x-csrf-token", csrf);

  try {
    const backendRes = await fetch(`${getBackendUrl()}/api/auth/logout`, {
      method: "POST",
      headers,
      cache: "no-store",
    });

    const response = NextResponse.json(
      { success: backendRes.ok },
      { status: backendRes.ok ? 200 : 200 },
    );
    response.headers.set("Cache-Control", "no-store");

    // Forward backend cookie clears (Set-Cookie) to the browser response.
    appendSetCookieHeaders(response, backendRes);

    return response;
  } catch (err) {
    console.error("[admin-logout] backend fetch failed", err);
    const response = NextResponse.json({ success: false }, { status: 200 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
