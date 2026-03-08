import { NextResponse } from "next/server";

function getBackendUrl() {
  const url = (process.env.BACKEND_API_URL || "").trim();
  return url || "http://localhost:5000";
}

export async function POST() {
  // Call backend to clear cookies.
  await fetch(`${getBackendUrl()}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => null);

  const response = NextResponse.json({ success: true });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
