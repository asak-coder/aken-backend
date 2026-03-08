"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function sanitizeNextPath(nextValue: string | null) {
  if (!nextValue) {
    return "/admin/leads";
  }

  // Take only first token before any whitespace/newlines to prevent polluted URLs like "%0A3".
  const trimmed = nextValue.trim().split(/\s+/)[0] || "";

  // Only allow internal admin routes.
  if (!trimmed.startsWith("/admin/")) {
    return "/admin/leads";
  }

  // Extra hardening: block protocol-relative or path traversal.
  if (trimmed.startsWith("//") || trimmed.includes("..")) {
    return "/admin/leads";
  }

  return trimmed;
}

function LoginPageInner() {
  const [email, setEmail] = useState("admin@aken.firm.in");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const nextValue = searchParams.get("next");
    return sanitizeNextPath(nextValue);
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;

    fetch("/api/admin-session", { cache: "no-store" })
      .then((res) => {
        if (!mounted) {
          return;
        }

        if (res.ok) {
          router.replace("/admin/leads");
        }
      })
      .catch(() => {
        // Ignore session check failures on initial load.
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      router.replace("/admin/leads");
    } else {
      setError(data.error || "Login failed.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-xl w-80">
        <h1 className="text-xl mb-4">Admin Login</h1>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Admin Email"
            className="w-full p-2 text-black rounded mb-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />

          <input
            type="password"
            placeholder="Enter Password"
            className="w-full p-2 text-black rounded mb-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black p-2 rounded disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        {error && <p className="text-red-500 mt-3">{error}</p>}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
