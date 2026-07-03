/**
 * Pure pricing/discount/GST math -- no I/O. Direct TypeScript port of
 * Stage 2's billing.py, same constants and rounding order, so bills
 * computed here are provably identical to the console MVP.
 */

export const GST_RATE = 0.18;
export const DISCOUNT_RATE = 0.1;
export const DISCOUNT_QTY_THRESHOLD = 5;

export type BillLine = {
  label: "Base" | "Pizza" | "Topping";
  itemName: string;
  unitPrice: number;
};

export type Bill = {
  lines: BillLine[];
  quantity: number;
  unitTotal: number;
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  postDiscountTotal: number;
  gstAmount: number;
  grandTotal: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeBill(
  lines: BillLine[],
  quantity: number,
  discountQtyThreshold: number = DISCOUNT_QTY_THRESHOLD
): Bill {
  const unitTotal = lines.reduce((sum, l) => sum + l.unitPrice, 0);
  const subtotal = unitTotal * quantity;

  const discountRate = quantity >= discountQtyThreshold ? DISCOUNT_RATE : 0;
  const discountAmount = round2(subtotal * discountRate);

  const postDiscountTotal = round2(subtotal - discountAmount);
  const gstAmount = round2(postDiscountTotal * GST_RATE);
  const grandTotal = round2(postDiscountTotal + gstAmount);

  return {
    lines,
    quantity,
    unitTotal: round2(unitTotal),
    subtotal: round2(subtotal),
    discountRate,
    discountAmount,
    postDiscountTotal,
    gstAmount,
    grandTotal,
  };
}
