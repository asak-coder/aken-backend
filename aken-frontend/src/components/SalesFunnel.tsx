"use client";

interface Lead {
  status?: string;
}

export default function SalesFunnel({ leads }: { leads: Lead[] }) {
  const stages = ["New", "Contacted", "Quoted", "Won"];

  const counts = stages.map(
    (stage) => leads.filter((l) => l.status === stage).length
  );

  return (
    <div className="bg-gray-900 p-6 rounded-xl mt-8">
      <h2 className="text-xl font-bold mb-4">Sales Funnel</h2>
      {stages.map((stage, index) => (
        <div key={stage} className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span>{stage}</span>
            <span>{counts[index]}</span>
          </div>
          <div className="w-full bg-gray-700 h-4 rounded">
            <div
              className="bg-blue-500 h-4 rounded"
              style={{
                width: `${counts[0] === 0 ? 0 : (counts[index] / counts[0]) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
}