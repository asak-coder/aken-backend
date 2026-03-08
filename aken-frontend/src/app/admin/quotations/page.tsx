"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPublicApiBaseUrl } from "@/lib/env";

type LeadSummary = {
  contactPerson?: string;
  companyName?: string;
  email?: string;
};

type Quotation = {
  _id: string;
  quotationNumber?: string;
  leadId?: LeadSummary | string | null;
  totalAmount?: number;
  status?: string;
  validTill?: string;
  createdAt?: string;
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  requestId?: string | null;
  error?: {
    code?: string;
    message?: string;
  };
};

const API_BASE_URL = getPublicApiBaseUrl();

function formatCurrency(amount?: number) {
  if (typeof amount !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusClass(status?: string) {
  if (status === "Approved") {
    return "bg-green-100 text-green-700";
  }

  if (status === "Rejected") {
    return "bg-red-100 text-red-700";
  }

  if (status === "Sent") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-gray-200 text-gray-700";
}

function getLeadData(leadId?: LeadSummary | string | null) {
  if (!leadId || typeof leadId === "string") {
    return null;
  }

  return leadId;
}

export default function AdminQuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [convertingId, setConvertingId] = useState("");

  const loadQuotations = useCallback(async () => {
    if (!API_BASE_URL) {
      setError(
        "NEXT_PUBLIC_API_URL is missing. Set it in your frontend environment file.",
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin-proxy/quotations`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch quotations");
      }

      const payload = (await response.json()) as ApiResponse<Quotation[]> | Quotation[];
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      setQuotations(list);
    } catch {
      setError("Could not load quotations. Please try again.");
      setQuotations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuotations();
  }, [loadQuotations]);

  const convertToProject = useCallback(async (quotationId: string) => {
    if (!API_BASE_URL || !quotationId) {
      return;
    }

    setConvertingId(quotationId);
    setActionMessage("");

    try {
      const response = await fetch(`/api/admin-proxy/quotations/${quotationId}/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json()) as ApiResponse<{
        alreadyExists?: boolean;
      }>;

      if (!response.ok) {
        const message =
          "error" in payload && payload.error?.message
            ? payload.error.message
            : "Could not convert quotation to project.";
        throw new Error(message);
      }

      const alreadyExists = Boolean(payload.data?.alreadyExists);

      setActionMessage(
        alreadyExists
          ? "Project already existed for this quotation."
          : "Quotation converted to project successfully.",
      );

      await loadQuotations();
    } catch (convertError) {
      setActionMessage(
        convertError instanceof Error
          ? convertError.message
          : "Could not convert quotation to project.",
      );
    } finally {
      setConvertingId("");
    }
  }, [loadQuotations]);

  const dashboardStats = useMemo(() => {
    const approvedCount = quotations.filter(
      (quotation) => quotation.status === "Approved",
    ).length;
    const sentCount = quotations.filter(
      (quotation) => quotation.status === "Sent",
    ).length;
    const totalValue = quotations.reduce((sum, quotation) => {
      return sum + (quotation.totalAmount ?? 0);
    }, 0);

    return {
      totalCount: quotations.length,
      approvedCount,
      sentCount,
      totalValue,
    };
  }, [quotations]);

  return (
    <main className="min-h-screen bg-black p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">Quotation Dashboard</h1>
            <p className="mt-2 text-gray-300">
              Monitor generated quotations and follow up with clients.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadQuotations()}
              className="rounded-lg border border-white px-5 py-2 text-sm font-semibold hover:bg-white hover:text-black"
            >
              Refresh
            </button>
            { }
            <a
              href="/api/admin-proxy/export/quotations?format=csv"
              className="rounded-lg border border-lime-400 px-4 py-2 text-sm font-semibold text-lime-200 hover:bg-lime-500 hover:text-white"
              download
              rel="nofollow"
            >
              Export Excel
            </a>
            <Link
              href="/admin/leads"
              className="rounded-lg border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500 hover:text-white"
            >
              Lead Analytics
            </Link>
            <Link
              href="/admin/projects"
              className="rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500 hover:text-white"
            >
              Projects
            </Link>
            <Link
              href="/admin/revenue"
              className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500 hover:text-white"
            >
              Revenue
            </Link>
            <Link
              href="/admin/system"
              className="rounded-lg border border-fuchsia-400 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-500 hover:text-white"
            >
              System Check
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Total Quotations</p>
            <p className="mt-2 text-2xl font-bold">{dashboardStats.totalCount}</p>
          </div>

          <div className="rounded-xl bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Sent</p>
            <p className="mt-2 text-2xl font-bold">{dashboardStats.sentCount}</p>
          </div>

          <div className="rounded-xl bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Approved</p>
            <p className="mt-2 text-2xl font-bold">{dashboardStats.approvedCount}</p>
          </div>

          <div className="rounded-xl bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Pipeline Value</p>
            <p className="mt-2 text-2xl font-bold">
              {formatCurrency(dashboardStats.totalValue)}
            </p>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-300">
            Loading quotations...
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500 bg-red-950 p-4 text-red-300">
            {error}
          </div>
        ) : null}

        {actionMessage ? (
          <div className="mb-6 rounded-xl border border-cyan-500 bg-cyan-950 p-4 text-cyan-100">
            {actionMessage}
          </div>
        ) : null}

        {!isLoading && !error ? (
          <section className="overflow-hidden rounded-xl border border-gray-800">
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-950 text-left text-sm">
                <thead className="bg-gray-900 text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Quotation No.</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Valid Till</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {quotations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                        No quotations found.
                      </td>
                    </tr>
                  ) : (
                    quotations.map((quotation) => {
                      const lead = getLeadData(quotation.leadId);
                      return (
                        <tr key={quotation._id} className="border-t border-gray-800">
                          <td className="px-4 py-3 font-semibold text-white">
                            {quotation.quotationNumber || "Not assigned"}
                          </td>

                          <td className="px-4 py-3 text-gray-200">
                            {lead?.contactPerson || "-"}
                          </td>

                          <td className="px-4 py-3 text-gray-300">
                            {lead?.companyName || "-"}
                          </td>

                          <td className="px-4 py-3 text-gray-200">
                            {formatCurrency(quotation.totalAmount)}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                quotation.status,
                              )}`}
                            >
                              {quotation.status || "Draft"}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-gray-300">
                            {formatDate(quotation.validTill)}
                          </td>

                          <td className="px-4 py-3 text-gray-300">
                            {formatDate(quotation.createdAt)}
                          </td>

                          <td className="px-4 py-3">
                            {quotation.status === "Rejected" ? (
                              <span className="text-xs text-gray-500">Not eligible</span>
                            ) : (
                              <button
                                onClick={() => void convertToProject(quotation._id)}
                                disabled={convertingId === quotation._id}
                                className="rounded border border-emerald-400 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                              >
                                {convertingId === quotation._id
                                  ? "Converting..."
                                  : "Convert to Project"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
