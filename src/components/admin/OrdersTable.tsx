import { Inbox } from "lucide-react";
import type { OrderWithItems } from "@/lib/types";
import { detectAnomalies } from "@/lib/anomaly";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-muted-foreground">
        <Inbox className="size-8" />
        <p>No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Timestamp</TableHead>
            <TableHead className="w-36">Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="w-24 text-right">Total</TableHead>
            <TableHead className="w-20">Payment</TableHead>
            <TableHead className="w-28">Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
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
              <TableRow key={order.id}>
                <TableCell className="whitespace-normal text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString()}
                  <br />
                  {new Date(order.created_at).toLocaleTimeString()}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="font-medium text-foreground">{order.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{order.phone}</div>
                </TableCell>
                <TableCell
                  className="max-w-0 truncate text-muted-foreground"
                  title={itemsLabel}
                >
                  {itemsLabel} (x{order.quantity})
                </TableCell>
                <TableCell className="text-right font-medium text-foreground">
                  {formatMoney(order.grand_total)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.payment_mode}
                </TableCell>
                <TableCell>
                  <AnomalyBadge
                    orderId={order.id}
                    flags={flags}
                    quantity={order.quantity}
                    subtotal={order.subtotal}
                    discountAmount={order.discount_amount}
                    gstAmount={order.gst_amount}
                    grandTotal={order.grand_total}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
