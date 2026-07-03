import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/admin/AdminNav";
import InsightsCard from "@/components/admin/InsightsCard";
import { computeInsightStats, narrateInsights } from "@/lib/insights";
import type { OrderWithItems } from "@/lib/types";

export default async function AdminInsightsPage() {
  const supabase = await createClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  const stats = computeInsightStats((orders ?? []) as OrderWithItems[]);
  const narration = await narrateInsights(stats);

  return (
    <>
      <AdminNav active="insights" />
      <h1 className="mb-4 text-xl font-bold text-gray-900">Sales &amp; Ops Insights</h1>
      {error ? (
        <p className="text-red-600">Could not load orders: {error.message}</p>
      ) : (
        <InsightsCard stats={stats} narration={narration.ok ? narration.text : null} />
      )}
    </>
  );
}
