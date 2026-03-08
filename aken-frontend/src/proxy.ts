import { NextRequest, NextResponse } from "next/server";

const LOGIN_PATH = "/admin/login";
const DEFAULT_ADMIN_REDIRECT = "/admin/leads";

async function isAdminAuthenticated(request: NextRequest) {
  // Source of truth: our own session endpoint, which proxies to backend.
  // This avoids duplicating token formats and secrets in Edge middleware.
  const origin = request.nextUrl.origin;

  try {
    const sessionRes = await fetch(`${origin}/api/admin-session`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      cache: "no-store",
    });

    return sessionRes.ok;
  } catch {
    return false;
  }
}

function buildLoginRedirect(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = LOGIN_PATH;
  redirectUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(redirectUrl);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = await isAdminAuthenticated(request);

  if (pathname === LOGIN_PATH) {
    if (isAuthenticated) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = DEFAULT_ADMIN_REDIRECT;
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return buildLoginRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
