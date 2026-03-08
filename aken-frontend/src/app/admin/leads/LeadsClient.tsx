"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AnalyticsOverview = {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  quotedLeads: number;
  closedLeads: number;
  wonRevenue: number;
  pipelineRevenue: number;
  weightedPipelineRevenue: number;
  last7DaysLeads: number;
  last30DaysLeads: number;
  conversionRate: number;
  quoteRate: number;
  avgDealSize: number;
};

type StatusDistributionItem = {
  status: string;
  count: number;
  percentage: number;
};

type SourceDistributionItem = {
  source: string;
  count: number;
  percentage: number;
};

type OwnerDistributionItem = {
  owner: string;
  count: number;
  percentage: number;
};

type MonthlyTrendItem = {
  month: string;
  key: string;
  leads: number;
  quotedLeads: number;
  closedLeads: number;
  wonRevenue: number;
  pipelineRevenue: number;
  conversionRate: number;
};

type RecentLeadItem = {
  _id: string;
  contactPerson?: string;
  companyName?: string;
  status?: string;
  owner?: string;
  source?: string;
  dealValue?: number;
  createdAt?: string;
  project?: {
    projectId?: string;
    projectName?: string;
    projectStatus?: string;
  } | null;
};

type LeadAnalytics = {
  generatedAt: string;
  rangeMonths: number;
  overview: AnalyticsOverview;
  statusDistribution: StatusDistributionItem[];
  sourceDistribution: SourceDistributionItem[];
  ownerDistribution: OwnerDistributionItem[];
  monthlyTrend: MonthlyTrendItem[];
  recentLeads: RecentLeadItem[];
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: {
    message?: string;
    code?: string;
  };
};

const DEFAULT_OVERVIEW: AnalyticsOverview = {
  totalLeads: 0,
  newLeads: 0,
  contactedLeads: 0,
  quotedLeads: 0,
  closedLeads: 0,
  wonRevenue: 0,
  pipelineRevenue: 0,
  weightedPipelineRevenue: 0,
  last7DaysLeads: 0,
  last30DaysLeads: 0,
  conversionRate: 0,
  quoteRate: 0,
  avgDealSize: 0,
};

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return "INR 0";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${value.toFixed(1)}%`;
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getPayload(
  payload: ApiEnvelope<LeadAnalytics> | LeadAnalytics,
): LeadAnalytics | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("overview" in payload) {
    return payload as LeadAnalytics;
  }

  if ("data" in payload && payload.data && typeof payload.data === "object") {
    return payload.data as LeadAnalytics;
  }

  return null;
}

export default function LeadsClient() {
  const [rangeMonths, setRangeMonths] = useState(6);
  const [analytics, setAnalytics] = useState<LeadAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [convertingLeadId, setConvertingLeadId] = useState("");

  const loadAnalytics = useCallback(async (months: number) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin-proxy/leads/analytics/summary?months=${months}`,
        {
          cache: "no-store",
        },
      );

      const json = (await response.json()) as
        | ApiEnvelope<LeadAnalytics>
        | LeadAnalytics;
      if (!response.ok) {
        throw new Error(
          json && "error" in json
            ? json.error?.message || "Unable to load analytics."
            : "Unable to load analytics.",
        );
      }

      const parsed = getPayload(json);
      if (!parsed) {
        throw new Error("Analytics payload is invalid.");
      }

      setAnalytics(parsed);
    } catch (fetchError) {
      setAnalytics(null);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load analytics right now.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const convertLeadToProject = useCallback(
    async (leadId: string) => {
      if (!leadId) {
        return;
      }

      setConvertingLeadId(leadId);
      setActionMessage("");

      try {
        const response = await fetch(
          `/api/admin-proxy/projects/from-lead/${leadId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        const json = (await response.json()) as ApiEnvelope<{
          alreadyExists?: boolean;
          project?: {
            projectName?: string;
          };
        }>;

        if (!response.ok) {
          throw new Error(
            json.error?.message || "Could not convert lead to project.",
          );
        }

        const projectName = json.data?.project?.projectName || "Project";
        if (json.data?.alreadyExists) {
          setActionMessage(`Project already exists: ${projectName}`);
        } else {
          setActionMessage(`Project created successfully: ${projectName}`);
        }

        await loadAnalytics(rangeMonths);
      } catch (convertError) {
        setActionMessage(
          convertError instanceof Error
            ? convertError.message
            : "Could not convert lead to project.",
        );
      } finally {
        setConvertingLeadId("");
      }
    },
    [loadAnalytics, rangeMonths],
  );

  useEffect(() => {
    void loadAnalytics(rangeMonths);
  }, [rangeMonths, loadAnalytics]);

  const overview = analytics?.overview || DEFAULT_OVERVIEW;
  const maxMonthlyLeads = Math.max(
    ...((analytics?.monthlyTrend || []).map((month) => month.leads)),
    1,
  );

  return (
    <main className="min-h-screen bg-black p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">
              Lead Analytics Dashboard
            </h1>
            <p className="mt-2 text-gray-300">
              Track conversion performance, source quality and owner workload.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              value={rangeMonths}
              onChange={(event) => setRangeMonths(Number(event.target.value))}
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>

            <button
              onClick={() => void loadAnalytics(rangeMonths)}
              className="rounded-lg border border-white px-4 py-2 text-sm font-semibold hover:bg-white hover:text-black"
            >
              Refresh
            </button>
            { }
            <a
              href="/api/admin-proxy/export/leads?format=csv"
              className="rounded-lg border border-lime-400 px-4 py-2 text-sm font-semibold text-lime-200 hover:bg-lime-500 hover:text-white"
              download
              rel="nofollow"
            >
              Export Excel
            </a>

            <Link
              href="/admin/quotations"
              className="rounded-lg border border-blue-400 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500 hover:text-white"
            >
              Quotation Dashboard
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

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total Leads" value={String(overview.totalLeads)} />
          <MetricCard
            title="Conversion Rate"
            value={formatPercent(overview.conversionRate)}
          />
          <MetricCard
            title="Quote Readiness"
            value={formatPercent(overview.quoteRate)}
          />
          <MetricCard
            title="Leads in Last 30 Days"
            value={String(overview.last30DaysLeads)}
          />
          <MetricCard
            title="Closed Revenue"
            value={formatCurrency(overview.wonRevenue)}
          />
          <MetricCard
            title="Pipeline Revenue"
            value={formatCurrency(overview.pipelineRevenue)}
          />
          <MetricCard
            title="Weighted Pipeline"
            value={formatCurrency(overview.weightedPipelineRevenue)}
          />
          <MetricCard
            title="Average Closed Deal"
            value={formatCurrency(overview.avgDealSize)}
          />
        </section>

        {loading ? (
          <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-300">
            Loading lead analytics...
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500 bg-red-950 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {actionMessage ? (
          <div className="mb-6 rounded-xl border border-cyan-500 bg-cyan-950 p-4 text-cyan-100">
            {actionMessage}
          </div>
        ) : null}

        {!loading && !error && analytics ? (
          <>
            <section className="mb-8 grid gap-6 lg:grid-cols-3">
              <div className="rounded-xl bg-gray-900 p-5">
                <h2 className="mb-4 text-lg font-semibold">Lead Status Mix</h2>
                <BarList
                  items={analytics.statusDistribution}
                  labelKey="status"
                  valueKey="count"
                />
              </div>

              <div className="rounded-xl bg-gray-900 p-5">
                <h2 className="mb-4 text-lg font-semibold">Lead Sources</h2>
                <BarList
                  items={analytics.sourceDistribution}
                  labelKey="source"
                  valueKey="count"
                />
              </div>

              <div className="rounded-xl bg-gray-900 p-5">
                <h2 className="mb-4 text-lg font-semibold">Owner Workload</h2>
                <BarList
                  items={analytics.ownerDistribution}
                  labelKey="owner"
                  valueKey="count"
                />
              </div>
            </section>

            <section className="mb-8 rounded-xl bg-gray-900 p-5">
              <h2 className="mb-4 text-lg font-semibold">Monthly Trend</h2>
              <div className="space-y-3">
                {analytics.monthlyTrend.map((month) => {
                  const width = Math.max(
                    0,
                    Math.min(100, (month.leads / maxMonthlyLeads) * 100),
                  );

                  return (
                    <div key={month.key}>
                      <div className="mb-1 flex items-center justify-between text-sm text-gray-300">
                        <span>{month.month}</span>
                        <span>
                          Leads: {month.leads} | Closed: {month.closedLeads} | CR:{" "}
                          {formatPercent(month.conversionRate)}
                        </span>
                      </div>
                      <div className="h-2 rounded bg-gray-700">
                        <div
                          className="h-2 rounded bg-cyan-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-gray-800">
              <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-950 text-left text-sm">
                  <thead className="bg-gray-900 text-gray-300">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Deal Value</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentLeads.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-gray-400"
                        >
                          No leads available yet.
                        </td>
                      </tr>
                    ) : (
                      analytics.recentLeads.map((lead) => (
                        <tr key={lead._id} className="border-t border-gray-800">
                          <td className="px-4 py-3 text-gray-300">
                            {formatDate(lead.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-white">
                            {lead.contactPerson || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-200">
                            {lead.companyName || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-200">
                            {lead.status || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-200">
                            {lead.owner || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {lead.source || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-200">
                            {typeof lead.dealValue === "number"
                              ? formatCurrency(lead.dealValue)
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {lead.project?.projectId ? (
                              <span className="rounded bg-green-900 px-2 py-1 text-xs text-green-200">
                                {lead.project.projectStatus || "Project Created"}
                              </span>
                            ) : lead.status === "Closed" ? (
                              <button
                                onClick={() => void convertLeadToProject(lead._id)}
                                disabled={convertingLeadId === lead._id}
                                className="rounded border border-emerald-400 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                              >
                                {convertingLeadId === lead._id
                                  ? "Creating..."
                                  : "Create Project"}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-500">
                                Close lead first
                              </span>
                            )}
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

function BarList<
  T extends {
    percentage?: number;
    [key: string]: string | number | undefined;
  }
>({
  items,
  labelKey,
  valueKey,
}: {
  items: T[];
  labelKey: keyof T;
  valueKey: keyof T;
}) {
  const safeItems = items.slice(0, 10);

  if (safeItems.length === 0) {
    return <p className="text-sm text-gray-400">No data available.</p>;
  }

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => {
        const label = String(item[labelKey] || "-");
        const value = Number(item[valueKey] || 0);
        const percentage = Number(item.percentage || 0);
        const width = Math.max(0, Math.min(100, percentage));

        return (
          <div key={`${label}-${index}`}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-200">{label}</span>
              <span className="text-gray-400">
                {value} ({formatPercent(percentage)})
              </span>
            </div>
            <div className="h-2 rounded bg-gray-700">
              <div
                className="h-2 rounded bg-blue-400"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
