"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPublicApiBaseUrl,
  getPublicEnvChecklist,
  type PublicEnvCheckItem,
} from "@/lib/env";

type BackendEnvCheck = {
  key: string;
  category: string;
  severity: "critical" | "warning";
  status: "ok" | "missing" | "invalid" | "warning";
  message: string;
};

type BackendEnvDiagnostics = {
  nodeEnv: string;
  isProduction: boolean;
  checkedAt: string;
  checks: BackendEnvCheck[];
  summary: {
    criticalFailureCount: number;
    warningCount: number;
    readyForProduction: boolean;
  };
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

const API_BASE_URL = getPublicApiBaseUrl();

function getStatusChipClass(status: string) {
  if (status === "ok") {
    return "bg-green-700 text-green-100";
  }

  if (status === "warning") {
    return "bg-yellow-700 text-yellow-100";
  }

  return "bg-red-700 text-red-100";
}

function mapFrontendStatusToBackendStyle(status: PublicEnvCheckItem["status"]) {
  if (status === "error") {
    return "invalid";
  }

  return status;
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminSystemEnvPage() {
  const [backendData, setBackendData] = useState<BackendEnvDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState("");

  const frontendChecks = useMemo(() => getPublicEnvChecklist(), []);

  const loadBackendCheck = useCallback(async () => {
    if (!API_BASE_URL) {
      setError(
        "NEXT_PUBLIC_API_URL is missing. Cannot verify Render backend from frontend.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin-proxy/system/env-check`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiResponse<BackendEnvDiagnostics>;

      if (!response.ok) {
        throw new Error(payload.error?.message || "Unable to fetch backend env diagnostics.");
      }

      setBackendData(payload.data || null);
      setLastCheckedAt(new Date().toISOString());
    } catch (fetchError) {
      setBackendData(null);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to fetch backend env diagnostics.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBackendCheck();
  }, [loadBackendCheck]);

  const frontendErrorCount = frontendChecks.filter((item) => item.status === "error").length;
  const frontendWarningCount = frontendChecks.filter((item) => item.status === "warning").length;

  return (
    <main className="min-h-screen bg-black p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">Deployment Env Verification</h1>
            <p className="mt-2 text-gray-300">
              Verify Vercel (frontend) and Render (backend) environment setup safely.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void loadBackendCheck()}
              className="rounded-lg border border-white px-4 py-2 text-sm font-semibold hover:bg-white hover:text-black"
            >
              Re-check
            </button>
            <Link
              href="/admin/revenue"
              className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500 hover:text-white"
            >
              Revenue
            </Link>
            <Link
              href="/admin/projects"
              className="rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500 hover:text-white"
            >
              Projects
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Frontend Errors" value={String(frontendErrorCount)} />
          <MetricCard title="Frontend Warnings" value={String(frontendWarningCount)} />
          <MetricCard
            title="Backend Critical Failures"
            value={String(backendData?.summary.criticalFailureCount || 0)}
          />
          <MetricCard
            title="Backend Warnings"
            value={String(backendData?.summary.warningCount || 0)}
          />
        </section>

        <section className="mb-8 rounded-xl bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Last Checked</p>
          <p className="mt-2 text-xl font-semibold">{formatDate(lastCheckedAt)}</p>
          <p className="mt-1 text-sm text-gray-400">
            Backend Environment: {backendData?.nodeEnv || "unknown"} | Ready for Production:{" "}
            {backendData?.summary.readyForProduction ? "Yes" : "No"}
          </p>
        </section>

        {loading ? (
          <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-300">
            Checking environment...
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500 bg-red-950 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="mb-8 rounded-xl border border-gray-800">
              <div className="border-b border-gray-800 bg-gray-900 px-4 py-3">
                <h2 className="text-lg font-semibold">Vercel Frontend Public Env</h2>
              </div>
              <div className="divide-y divide-gray-800 bg-gray-950">
                {frontendChecks.map((check) => (
                  <div key={check.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-[240px] text-sm font-semibold text-white">
                      {check.key}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusChipClass(
                        mapFrontendStatusToBackendStyle(check.status),
                      )}`}
                    >
                      {check.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-300">{check.message}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-800">
              <div className="border-b border-gray-800 bg-gray-900 px-4 py-3">
                <h2 className="text-lg font-semibold">Render Backend Env</h2>
              </div>
              <div className="divide-y divide-gray-800 bg-gray-950">
                {backendData?.checks?.map((check) => (
                  <div key={check.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-[240px] text-sm font-semibold text-white">
                      {check.key}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusChipClass(
                        check.status,
                      )}`}
                    >
                      {check.status.toUpperCase()}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-gray-400">
                      {check.severity}
                    </span>
                    <span className="text-sm text-gray-300">{check.message}</span>
                  </div>
                )) || (
                  <div className="px-4 py-6 text-sm text-gray-400">
                    Backend diagnostics not available.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-900 p-5">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
