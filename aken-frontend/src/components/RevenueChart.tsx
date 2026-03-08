"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

interface Lead {
  dealValue?: number;
  status?: string;
  createdAt: string;
}

export default function RevenueChart({ leads }: { leads: Lead[] }) {
  const monthlyWon: Record<string, number> = {};
  const monthlyPipeline: Record<string, number> = {};

  leads.forEach((lead) => {
    const date = new Date(lead.createdAt);
    const month = date.toLocaleString("default", { month: "short" });

    const value = lead.dealValue || 0;

    if (lead.status === "Won") {
      monthlyWon[month] = (monthlyWon[month] || 0) + value;
    }

    if (
      lead.status === "New" ||
      lead.status === "Contacted" ||
      lead.status === "Qualified"
    ) {
      monthlyPipeline[month] =
        (monthlyPipeline[month] || 0) + value;
    }
  });

  const allMonths = Array.from(
    new Set([...Object.keys(monthlyWon), ...Object.keys(monthlyPipeline)])
  );

  const wonData = allMonths.map((m) => monthlyWon[m] || 0);
  const pipelineData = allMonths.map((m) => monthlyPipeline[m] || 0);

  const data = {
    labels: allMonths,
    datasets: [
      {
        label: "Won Revenue (₹)",
        data: wonData,
        tension: 0.4,
      },
      {
        label: "Pipeline Revenue (₹)",
        data: pipelineData,
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl mt-8">
      <h2 className="text-xl font-bold mb-4">
        Pipeline vs Won Revenue
      </h2>
      <Line data={data} />
    </div>
  );
}
