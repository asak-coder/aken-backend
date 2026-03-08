"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPublicApiBaseUrl } from "@/lib/env";

type ProjectSummary = {
  totalProjects: number;
  planningProjects: number;
  inProgressProjects: number;
  completedProjects: number;
  totalProjectValue: number;
  totalSpent: number;
  averageProgress: number | string;
  averageExpectedMargin?: number;
  averageActualMargin?: number;
  highRiskProjects?: number;
  lossMakingProjects?: number;
};

type ProjectItem = {
  _id: string;
  projectName: string;
  clientName: string;
  projectOwner?: string;
  projectValue: number;
  totalSpent?: number;
  status: "Planning" | "In Progress" | "Completed";
  siteStatus?: string;
  progressPercentage?: number;
  createdAt?: string;
  marginSnapshot?: {
    actualMarginPercentage?: number;
    actualProfit?: number;
    riskLevel?: "Healthy" | "Watch" | "High" | "Loss";
  };
};

type ProjectsPayload = {
  items: ProjectItem[];
  pagination?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

type MarginOverview = {
  generatedAt: string;
  totals: {
    projects: number;
    revenue: number;
    expectedCost: number;
    actualCost: number;
    expectedProfit: number;
    actualProfit: number;
    expectedMarginPercentage: number;
    actualMarginPercentage: number;
    overBudgetProjects: number;
    lossMakingProjects: number;
  };
  distribution: {
    Healthy: number;
    Watch: number;
    High: number;
    Loss: number;
  };
  topRiskProjects: Array<{
    projectId: string;
    projectName: string;
    projectValue: number;
    totalCost: number;
    profit: number;
    actualMarginPercentage: number;
    expectedMarginPercentage: number;
    riskLevel: "Healthy" | "Watch" | "High" | "Loss";
    riskReasons: string[];
  }>;
  invoicing: {
    invoicedAmount: number;
    receivedAmount: number;
    outstandingAmount: number;
    collectionPercentage: number;
    revenueRealizationPercentage: number;
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

function formatCurrency(value?: number) {
  if (!Number.isFinite(Number(value))) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
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

function formatPercent(value?: number) {
  if (!Number.isFinite(Number(value))) {
    return "0.0%";
  }

  return `${Number(value).toFixed(1)}%`;
}

function getStatusClass(status?: string) {
  if (status === "Completed") {
    return "bg-green-100 text-green-700";
  }

  if (status === "In Progress") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-gray-200 text-gray-700";
}

function getRiskClass(risk?: string) {
  if (risk === "Loss") {
    return "bg-red-100 text-red-700";
  }

  if (risk === "High") {
    return "bg-orange-100 text-orange-700";
  }

  if (risk === "Watch") {
    return "bg-yellow-100 text-yellow-800";
  }

  return "bg-emerald-100 text-emerald-700";
}

export default function AdminProjectsPage() {
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [marginOverview, setMarginOverview] = useState<MarginOverview | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!API_BASE_URL) {
      setError(
        "NEXT_PUBLIC_API_URL is missing. Add it in frontend environment settings.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const statusQuery =
      statusFilter !== "All" ? `&status=${encodeURIComponent(statusFilter)}` : "";

    try {
      const [summaryRes, projectsRes, marginRes] = await Promise.all([
        fetch(`/api/admin-proxy/projects/summary`, {
          cache: "no-store",
        }),
        fetch(`/api/admin-proxy/projects?limit=50${statusQuery}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin-proxy/projects/margin/overview`, {
          cache: "no-store",
        }),
      ]);

      const summaryJson = (await summaryRes.json()) as ApiResponse<ProjectSummary>;
      const projectsJson = (await projectsRes.json()) as ApiResponse<ProjectsPayload>;
      const marginJson = (await marginRes.json()) as ApiResponse<MarginOverview>;

      if (!summaryRes.ok) {
        throw new Error(
          summaryJson.error?.message || "Unable to load project summary.",
        );
      }

      if (!projectsRes.ok) {
        throw new Error(projectsJson.error?.message || "Unable to load projects.");
      }

      if (!marginRes.ok) {
        throw new Error(
          marginJson.error?.message || "Unable to load project margin overview.",
        );
      }

      setSummary(summaryJson.data || null);
      setProjects(projectsJson.data?.items || []);
      setMarginOverview(marginJson.data || null);
    } catch (fetchError) {
      setSummary(null);
      setMarginOverview(null);
      setProjects([]);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load project dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const healthBadge = useMemo(() => {
    const marginPct = Number(marginOverview?.totals.actualMarginPercentage || 0);
    const overBudget = Number(marginOverview?.totals.overBudgetProjects || 0);

    if (!marginOverview) {
      return { label: "No Data", className: "bg-gray-700 text-gray-200" };
    }

    if (marginPct < 0 || overBudget > 0) {
      return { label: "High Margin Risk", className: "bg-red-700 text-red-100" };
    }

    if (marginPct < 12) {
      return { label: "Watch Margin", className: "bg-yellow-600 text-yellow-100" };
    }

    return { label: "Healthy Margin", className: "bg-green-700 text-green-100" };
  }, [marginOverview]);

  return (
    <main className="min-h-screen bg-black p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">Project Management Dashboard</h1>
            <p className="mt-2 text-gray-300">
              Track execution projects converted from closed leads and approved quotations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${healthBadge.className}`}
            >
              {healthBadge.label}
            </span>
            <select
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Planning">Planning</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            <button
              onClick={() => void loadData()}
              className="rounded-lg border border-white px-4 py-2 text-sm font-semibold hover:bg-white hover:text-black"
            >
              Refresh
            </button>
            { }
            <a
              href="/api/admin-proxy/export/projects?format=csv"
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
              href="/admin/quotations"
              className="rounded-lg border border-blue-400 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500 hover:text-white"
            >
              Quotations
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

        <section className="mb-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard title="Total Projects" value={String(summary?.totalProjects || 0)} />
          <MetricCard title="Planning" value={String(summary?.planningProjects || 0)} />
          <MetricCard
            title="In Progress"
            value={String(summary?.inProgressProjects || 0)}
          />
          <MetricCard title="Completed" value={String(summary?.completedProjects || 0)} />
          <MetricCard
            title="Total Value"
            value={formatCurrency(summary?.totalProjectValue)}
          />
          <MetricCard title="Total Spent" value={formatCurrency(summary?.totalSpent)} />
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Expected Margin"
            value={formatPercent(marginOverview?.totals.expectedMarginPercentage)}
          />
          <MetricCard
            title="Actual Margin"
            value={formatPercent(marginOverview?.totals.actualMarginPercentage)}
          />
          <MetricCard
            title="Loss Making"
            value={String(marginOverview?.totals.lossMakingProjects || 0)}
          />
          <MetricCard
            title="Over Budget"
            value={String(marginOverview?.totals.overBudgetProjects || 0)}
          />
          <MetricCard
            title="Outstanding Invoice"
            value={formatCurrency(marginOverview?.invoicing.outstandingAmount)}
          />
        </section>

        <section className="mb-8 rounded-xl bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Average Progress</p>
          <p className="mt-2 text-2xl font-bold">
            {Number(summary?.averageProgress || 0).toFixed(1)}%
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Collection Rate: {formatPercent(marginOverview?.invoicing.collectionPercentage)}
          </p>
        </section>

        {!loading && !error && marginOverview ? (
          <section className="mb-8 rounded-xl bg-gray-900 p-5">
            <h2 className="mb-4 text-lg font-semibold">Top Margin Risk Projects</h2>
            {marginOverview.topRiskProjects.length === 0 ? (
              <p className="text-sm text-gray-400">No risk projects found.</p>
            ) : (
              <div className="space-y-3">
                {marginOverview.topRiskProjects.slice(0, 5).map((project) => (
                  <div
                    key={project.projectId}
                    className="flex flex-wrap items-center justify-between rounded-lg bg-gray-800 p-3"
                  >
                    <div>
                      <p className="font-semibold text-white">{project.projectName}</p>
                      <p className="text-xs text-gray-400">
                        Profit: {formatCurrency(project.profit)} | Margin: {formatPercent(project.actualMarginPercentage)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getRiskClass(
                        project.riskLevel,
                      )}`}
                    >
                      {project.riskLevel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {loading ? (
          <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-300">
            Loading projects...
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500 bg-red-950 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <section className="overflow-hidden rounded-xl border border-gray-800">
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-950 text-left text-sm">
                <thead className="bg-gray-900 text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Spent</th>
                    <th className="px-4 py-3">Margin</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Site Stage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                        No projects found.
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => (
                      <tr key={project._id} className="border-t border-gray-800">
                        <td className="px-4 py-3 font-semibold text-white">
                          {project.projectName}
                        </td>
                        <td className="px-4 py-3 text-gray-200">{project.clientName}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {project.projectOwner || "Unassigned"}
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {formatCurrency(project.projectValue)}
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {formatCurrency(project.totalSpent)}
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {formatPercent(project.marginSnapshot?.actualMarginPercentage)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getRiskClass(
                              project.marginSnapshot?.riskLevel,
                            )}`}
                          >
                            {project.marginSnapshot?.riskLevel || "Healthy"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {Number(project.progressPercentage || 0).toFixed(0)}%
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {project.siteStatus || "Not Started"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                              project.status,
                            )}`}
                          >
                            {project.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {formatDate(project.createdAt)}
                        </td>
                      </tr>
                    ))
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

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-900 p-5">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
