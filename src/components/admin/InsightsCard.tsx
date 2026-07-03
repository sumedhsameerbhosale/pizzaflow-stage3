import type { InsightStats } from "@/lib/insights";

function formatMoney(n: number) {
  return `Rs. ${n.toFixed(2)}`;
}

export default function InsightsCard({
  stats,
  narration,
}: {
  stats: InsightStats;
  narration: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Best-selling pizza"
          value={stats.bestSeller ? stats.bestSeller.name : "Not enough data"}
          sub={stats.bestSeller ? `${stats.bestSeller.count} orders` : undefined}
        />
        <StatCard
          label="Peak order time"
          value={stats.peakHour ? `${stats.peakHour.dayLabel}` : "Not enough data"}
          sub={stats.peakHour ? `${stats.peakHour.hourLabel} (${stats.peakHour.count} orders)` : undefined}
        />
        <StatCard
          label="Discount given (all time)"
          value={formatMoney(stats.totalDiscountGiven)}
          sub={`${stats.discountedOrderCount} of ${stats.totalOrders} orders discounted`}
        />
      </div>

      <div className="rounded-lg border bg-gray-50 p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">AI Summary</h3>
        {narration ? (
          <p className="text-sm text-gray-800">{narration}</p>
        ) : (
          <p className="text-sm text-gray-500">
            AI narration unavailable right now -- the numbers above are
            computed directly from the database and are unaffected.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
