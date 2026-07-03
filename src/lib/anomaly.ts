/**
 * Deterministic billing-anomaly detection (AI feature 3, rule-based
 * first pass). Runs synchronously against already-fetched order rows,
 * zero network calls -- per Stage 1's own philosophy, "discount logic
 * and GST calculation are deterministic business rules," so whether an
 * order's numbers are correct is never delegated to an LLM. The LLM
 * (see openrouter.ts + /api/ai/anomaly-explain) only narrates flags
 * that this module has already raised.
 */

import { DISCOUNT_QTY_THRESHOLD } from "./billing";

export type AnomalyFlag = {
  code: "DISCOUNT_MISMATCH" | "GST_MISMATCH" | "GRAND_TOTAL_MISMATCH";
  message: string;
};

export type OrderForAnomalyCheck = {
  quantity: number;
  subtotal: number;
  discountAmount: number;
  postDiscountTotal: number;
  gstAmount: number;
  grandTotal: number;
};

const DISCOUNT_RATE = 0.1;
const GST_RATE = 0.18;
const TOLERANCE = 0.01;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Known limitation: this re-evaluates orders against the CURRENT
 * discount threshold (default arg, or an explicit override passed by
 * the caller e.g. from the live app_settings value). If the threshold
 * changes, historical orders placed under a different threshold may be
 * flagged even though they were correct under the rules at the time --
 * a production system would snapshot the applicable threshold per
 * order. See README "Known simplifications".
 */
export function detectAnomalies(
  order: OrderForAnomalyCheck,
  discountQtyThreshold: number = DISCOUNT_QTY_THRESHOLD
): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];

  const expectedDiscount =
    order.quantity >= discountQtyThreshold
      ? round2(order.subtotal * DISCOUNT_RATE)
      : 0;
  if (Math.abs(order.discountAmount - expectedDiscount) > TOLERANCE) {
    flags.push({
      code: "DISCOUNT_MISMATCH",
      message: `Expected discount ~₹${expectedDiscount.toFixed(2)} for quantity ${order.quantity}, order shows ₹${order.discountAmount.toFixed(2)}.`,
    });
  }

  const expectedGst = round2(order.postDiscountTotal * GST_RATE);
  if (Math.abs(order.gstAmount - expectedGst) > TOLERANCE) {
    flags.push({
      code: "GST_MISMATCH",
      message: `Expected GST ~₹${expectedGst.toFixed(2)} (18% of post-discount total), order shows ₹${order.gstAmount.toFixed(2)}.`,
    });
  }

  const expectedGrand = round2(order.postDiscountTotal + order.gstAmount);
  if (Math.abs(order.grandTotal - expectedGrand) > TOLERANCE) {
    flags.push({
      code: "GRAND_TOTAL_MISMATCH",
      message: `Grand total ₹${order.grandTotal.toFixed(2)} does not match post-discount total + GST (₹${expectedGrand.toFixed(2)}).`,
    });
  }

  return flags;
}
