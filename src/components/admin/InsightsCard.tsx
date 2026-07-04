import { Sparkles } from "lucide-react";
import type { InsightStats } from "@/lib/insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

      <Alert>
        <Sparkles />
        <AlertTitle>AI Summary</AlertTitle>
        <AlertDescription>
          {narration ??
            "AI narration unavailable right now -- the numbers above are computed directly from the database and are unaffected."}
        </AlertDescription>
      </Alert>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
