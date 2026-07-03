import type { OrderWithItems } from "@/lib/types";
import { detectAnomalies } from "@/lib/anomaly";
import AnomalyBadge from "./AnomalyBadge";

function formatMoney(n: number) {
  return `Rs. ${n.toFixed(2)}`;
}

export default function OrdersTable({
  orders,
  discountQtyThreshold,
}: {
  orders: OrderWithItems[];
  discountQtyThreshold: number;
}) {
  if (orders.length === 0) {
    return <p className="text-gray-500">No orders yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Timestamp</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Customer</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Items</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Payment</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Flags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => {
            const flags = detectAnomalies(
              {
                quantity: order.quantity,
                subtotal: order.subtotal,
                discountAmount: order.discount_amount,
                postDiscountTotal: order.post_discount_total,
                gstAmount: order.gst_amount,
                grandTotal: order.grand_total,
              },
              discountQtyThreshold
            );
            const itemsLabel = order.order_items
              .map((oi) => oi.item_name)
              .join(", ");
            return (
              <tr key={order.id}>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                  {new Date(order.created_at).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="font-medium text-gray-900">{order.customer_name}</div>
                  <div className="text-xs text-gray-500">{order.phone}</div>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {itemsLabel} (x{order.quantity})
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-900">
                  {formatMoney(order.grand_total)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                  {order.payment_mode}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <AnomalyBadge
                    orderId={order.id}
                    flags={flags}
                    quantity={order.quantity}
                    subtotal={order.subtotal}
                    discountAmount={order.discount_amount}
                    gstAmount={order.gst_amount}
                    grandTotal={order.grand_total}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
