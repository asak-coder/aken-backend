import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getBackendUrl() {
  const url = (process.env.BACKEND_API_URL || "").trim();
  return url || "http://localhost:5000";
}

function appendSetCookieHeaders(nextRes: NextResponse, backendRes: Response) {
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

export async function GET(req: NextRequest) {
  try {
    const backendRes = await fetch(`${getBackendUrl()}/api/auth/session`, {
      method: "GET",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
      cache: "no-store",
    });

    if (!backendRes.ok) {
      const response = NextResponse.json(
        { authenticated: false },
        { status: 200 },
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const data = await backendRes.json().catch(() => ({}));

    const response = NextResponse.json(
      { ...data?.data, authenticated: true },
      { status: 200 },
    );
    response.headers.set("Cache-Control", "no-store");

    appendSetCookieHeaders(response, backendRes);

    return response;
  } catch {
    const response = NextResponse.json(
      { authenticated: false },
      { status: 200 },
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
