"use client";

interface Lead {
  dealValue?: number;
  status?: string;
}

export default function KPICards({ leads }: { leads: Lead[] }) {
  const totalLeads = leads.length;

  const totalWonRevenue = leads
    .filter((l) => l.status === "Won")
    .reduce((sum, l) => sum + (l.dealValue || 0), 0);

  const totalPipelineRevenue = leads
    .filter(
      (l) =>
        l.status === "New" ||
        l.status === "Contacted" ||
        l.status === "Qualified"
    )
    .reduce((sum, l) => sum + (l.dealValue || 0), 0);

  const conversionRate =
    totalLeads === 0
      ? 0
      : (
          (leads.filter((l) => l.status === "Won").length /
            totalLeads) *
          100
        ).toFixed(1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card title="Total Leads" value={totalLeads} />
      <Card title="Won Revenue (₹)" value={totalWonRevenue.toLocaleString()} />
      <Card
        title="Pipeline Revenue (₹)"
        value={totalPipelineRevenue.toLocaleString()}
      />
      <Card title="Conversion Rate (%)" value={conversionRate} />
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-gray-900 p-6 rounded-xl shadow-lg">
      <h3 className="text-gray-400 text-sm mb-2">{title}</h3>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
