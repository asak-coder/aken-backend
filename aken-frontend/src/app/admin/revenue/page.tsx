"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPublicApiBaseUrl } from "@/lib/env";

type SourceRow = {
  source: string;
  leads: number;
  pipelineValue: number;
  weightedValue: number;
};

type StageRow = {
  stage: string;
  count: number;
  value: number;
};

type TrendRow = {
  month: string;
  key: string;
  leadsCreated: number;
  pipelineValueAdded: number;
  weightedPipelineAdded: number;
  closedRevenueAdded: number;
  quotationCount: number;
  quotationSentValue: number;
  quotationApprovedValue: number;
  projectsBooked: number;
  projectBookedValue: number;
  projectCompletedValue: number;
  invoiceCount: number;
  invoicedAmount: number;
  receivedAmount: number;
};

type RevenueAnalytics = {
  generatedAt: string;
  rangeMonths: number;
  leads: {
    totalLeads: number;
    openLeadCount: number;
    closedLeadCount: number;
    openPipelineValue: number;
    weightedPipelineValue: number;
    closedRevenue: number;
  };
  quotations: {
    totalQuotations: number;
    draftCount: number;
    sentCount: number;
    approvedCount: number;
    rejectedCount: number;
    sentValue: number;
    approvedValue: number;
  };
  projects: {
    totalProjects: number;
    planningProjects: number;
    inProgressProjects: number;
    completedProjects: number;
    totalProjectValue: number;
    activeProjectValue: number;
    completedProjectValue: number;
  };
  invoices: {
    invoiceCount: number;
    invoicedAmount: number;
    receivedAmount: number;
    outstandingAmount: number;
  };
  pipeline: {
    totalValue: number;
    weightedValue: number;
    coverageRatio: number;
    closeRate: number;
    quoteApprovalRate: number;
    collectionRate: number;
    outstandingToPipelineRate: number;
  };
  sourceDistribution: SourceRow[];
  stageDistribution: StageRow[];
  monthlyTrend: TrendRow[];
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

function formatCurrency(value?: number) {
  if (!Number.isFinite(Number(value))) {
    return "INR 0";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatPercent(value?: number) {
  if (!Number.isFinite(Number(value))) {
    return "0.0%";
  }

  return `${Number(value).toFixed(1)}%`;
}

function summarizeHealth(data: RevenueAnalytics | null) {
  if (!data) {
    return {
      label: "No Data",
      className: "bg-gray-700 text-gray-200",
    };
  }

  const closeRate = Number(data.pipeline.closeRate || 0);
  const collectionRate = Number(data.pipeline.collectionRate || 0);
  const coverage = Number(data.pipeline.coverageRatio || 0);

  if (closeRate < 8 || collectionRate < 45 || coverage < 60) {
    return {
      label: "Revenue Risk High",
      className: "bg-red-700 text-red-100",
    };
  }

  if (closeRate < 15 || collectionRate < 65 || coverage < 100) {
    return {
      label: "Watch Revenue",
      className: "bg-yellow-600 text-yellow-100",
    };
  }

  return {
    label: "Revenue Healthy",
    className: "bg-green-700 text-green-100",
  };
}

export default function AdminRevenuePage() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<RevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async (rangeMonths: number) => {
    if (!API_BASE_URL) {
      setError(
        "NEXT_PUBLIC_API_URL is missing. Add it in frontend environment settings.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin-proxy/revenue/overview?months=${rangeMonths}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as ApiResponse<RevenueAnalytics>;

      if (!response.ok) {
        throw new Error(
          payload.error?.message || "Unable to load revenue analytics.",
        );
      }

      setData(payload.data || null);
    } catch (fetchError) {
      setData(null);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load revenue analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics(months);
  }, [months, loadAnalytics]);

  const health = useMemo(() => summarizeHealth(data), [data]);

  return (
    <main className="min-h-screen bg-black p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">Revenue & Pipeline Dashboard</h1>
            <p className="mt-2 text-gray-300">
              Monitor pipeline quality, conversion and collections in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${health.className}`}>
              {health.label}
            </span>
            <select
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              value={months}
              onChange={(event) => setMonths(Number(event.target.value))}
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
            <button
              onClick={() => void loadAnalytics(months)}
              className="rounded-lg border border-white px-4 py-2 text-sm font-semibold hover:bg-white hover:text-black"
            >
              Refresh
            </button>
            { }
            <a
              href="/api/admin-proxy/export/invoices?format=csv"
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
              Leads
            </Link>
            <Link
              href="/admin/quotations"
              className="rounded-lg border border-blue-400 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500 hover:text-white"
            >
              Quotations
            </Link>
            <Link
              href="/admin/projects"
              className="rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500 hover:text-white"
            >
              Projects
            </Link>
            <Link
              href="/admin/system"
              className="rounded-lg border border-fuchsia-400 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-500 hover:text-white"
            >
              System Check
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Open Pipeline"
            value={formatCurrency(data?.pipeline.totalValue)}
          />
          <MetricCard
            title="Weighted Pipeline"
            value={formatCurrency(data?.pipeline.weightedValue)}
          />
          <MetricCard
            title="Closed Revenue"
            value={formatCurrency(data?.leads.closedRevenue)}
          />
          <MetricCard
            title="Outstanding Invoice"
            value={formatCurrency(data?.invoices.outstandingAmount)}
          />
          <MetricCard
            title="Pipeline Coverage"
            value={formatPercent(data?.pipeline.coverageRatio)}
          />
          <MetricCard
            title="Lead Close Rate"
            value={formatPercent(data?.pipeline.closeRate)}
          />
          <MetricCard
            title="Quote Approval Rate"
            value={formatPercent(data?.pipeline.quoteApprovalRate)}
          />
          <MetricCard
            title="Collection Rate"
            value={formatPercent(data?.pipeline.collectionRate)}
          />
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total Leads" value={String(data?.leads.totalLeads || 0)} />
          <MetricCard
            title="Total Quotations"
            value={String(data?.quotations.totalQuotations || 0)}
          />
          <MetricCard
            title="Total Projects"
            value={String(data?.projects.totalProjects || 0)}
          />
          <MetricCard
            title="Total Invoices"
            value={String(data?.invoices.invoiceCount || 0)}
          />
        </section>

        {loading ? (
          <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-300">
            Loading revenue analytics...
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500 bg-red-950 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && !error && data ? (
          <>
            <section className="mb-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl bg-gray-900 p-5">
                <h2 className="mb-4 text-lg font-semibold">Top Pipeline Sources</h2>
                <div className="space-y-3">
                  {data.sourceDistribution.length === 0 ? (
                    <p className="text-sm text-gray-400">No source data available.</p>
                  ) : (
                    data.sourceDistribution.slice(0, 8).map((row) => (
                      <div key={row.source}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-gray-200">{row.source}</span>
                          <span className="text-gray-400">
                            Leads: {row.leads} | Weighted: {formatCurrency(row.weightedValue)}
                          </span>
                        </div>
                        <div className="h-2 rounded bg-gray-700">
                          <div
                            className="h-2 rounded bg-cyan-400"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  (row.weightedValue /
                                    Math.max(
                                      ...data.sourceDistribution.map((item) => item.weightedValue),
                                      1,
                                    )) *
                                    100,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-gray-900 p-5">
                <h2 className="mb-4 text-lg font-semibold">Lead Stage Value Mix</h2>
                <div className="space-y-3">
                  {data.stageDistribution.length === 0 ? (
                    <p className="text-sm text-gray-400">No stage data available.</p>
                  ) : (
                    data.stageDistribution.map((row) => (
                      <div key={row.stage} className="flex items-center justify-between text-sm">
                        <span className="text-gray-200">{row.stage}</span>
                        <span className="text-gray-400">
                          {row.count} leads | {formatCurrency(row.value)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-800">
              <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-950 text-left text-sm">
                  <thead className="bg-gray-900 text-gray-300">
                    <tr>
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3">Leads</th>
                      <th className="px-4 py-3">Pipeline Added</th>
                      <th className="px-4 py-3">Weighted Added</th>
                      <th className="px-4 py-3">Closed Revenue</th>
                      <th className="px-4 py-3">Quotation Sent</th>
                      <th className="px-4 py-3">Quotation Approved</th>
                      <th className="px-4 py-3">Projects Booked</th>
                      <th className="px-4 py-3">Invoiced</th>
                      <th className="px-4 py-3">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyTrend.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                          No trend data available.
                        </td>
                      </tr>
                    ) : (
                      data.monthlyTrend.map((row) => (
                        <tr key={row.key} className="border-t border-gray-800">
                          <td className="px-4 py-3 text-white">{row.month}</td>
                          <td className="px-4 py-3 text-gray-300">{row.leadsCreated}</td>
                          <td className="px-4 py-3 text-gray-200">
                            {formatCurrency(row.pipelineValueAdded)}
                          </td>
                          <td className="px-4 py-3 text-gray-200">
                            {formatCurrency(row.weightedPipelineAdded)}
                          </td>
                          <td className="px-4 py-3 text-gray-200">
                            {formatCurrency(row.closedRevenueAdded)}
                          </td>
                          <td className="px-4 py-3 text-gray-200">
                            {formatCurrency(row.quotationSentValue)}
                          </td>
                          <td className="px-4 py-3 text-gray-200">
                            {formatCurrency(row.quotationApprovedValue)}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{row.projectsBooked}</td>
                          <td className="px-4 py-3 text-gray-200">
                            {formatCurrency(row.invoicedAmount)}
                          </td>
                          <td className="px-4 py-3 text-gray-200">
                            {formatCurrency(row.receivedAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
