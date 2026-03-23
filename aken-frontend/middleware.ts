import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-aken_admin_session" : "aken_admin_session";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

function buildLoginRedirect(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin/*
  if (!isAdminPath(pathname)) {
    return NextResponse.next();
  }

  // Allow the login page always.
  if (isAdminLoginPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;

  // If no session cookie, force login.
  if (!token) {
    return buildLoginRedirect(req);
  }

  // We intentionally do not verify JWT signature in edge middleware (no backend secret here).
  // Backend is the source of truth via /api/admin-session and protected /api/* routes.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
