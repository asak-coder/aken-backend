"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Lead {
  status?: string;
}

export default function StatusDonutChart({ leads }: { leads: Lead[] }) {
  const statusCounts = {
    New: 0,
    Contacted: 0,
    Quoted: 0,
    Won: 0,
    Lost: 0,
  };

  leads.forEach((lead) => {
    if (lead.status && statusCounts.hasOwnProperty(lead.status)) {
      statusCounts[lead.status as keyof typeof statusCounts]++;
    }
  });

  const data = {
    labels: Object.keys(statusCounts),
    datasets: [
      {
        data: Object.values(statusCounts),
      },
    ],
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl mt-8">
      <h2 className="text-xl font-bold mb-4">Lead Status Distribution</h2>
      <Doughnut data={data} />
    </div>
  );
}
