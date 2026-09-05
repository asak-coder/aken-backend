"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf";

export default function AdminShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin-logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders("POST"),
        },
      });
    } catch {
      // proceed to redirect
    }
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen bg-black p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-6 flex flex-wrap items-center gap-3 text-xs">
          <Link href="/admin/leads" className="rounded border border-gray-600 px-2 py-1 text-gray-300 hover:bg-gray-800">Leads</Link>
          <Link href="/admin/projects" className="rounded border border-gray-600 px-2 py-1 text-gray-300 hover:bg-gray-800">Projects</Link>
          <Link href="/admin/quotations" className="rounded border border-gray-600 px-2 py-1 text-gray-300 hover:bg-gray-800">Quotations</Link>
          <Link href="/admin/revenue" className="rounded border border-gray-600 px-2 py-1 text-gray-300 hover:bg-gray-800">Revenue</Link>
          <Link href="/admin/system" className="rounded border border-gray-600 px-2 py-1 text-gray-300 hover:bg-gray-800">System</Link>
          <button type="button" onClick={() => void handleLogout()} disabled={loggingOut} className="ml-2 rounded border border-red-500 px-3 py-1 text-red-400 hover:bg-red-900 hover:text-white disabled:opacity-50">
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </nav>
        <div className="mb-8">
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-gray-300">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
