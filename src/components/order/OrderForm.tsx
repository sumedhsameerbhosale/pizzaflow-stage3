"use client";

import { useMemo, useState } from "react";
import {
  validateName,
  validatePhone,
  validateQuantity,
} from "@/lib/validators";
import { computeBill, type BillLine } from "@/lib/billing";
import type { MenuItem, PaymentMode } from "@/lib/types";
import AssistantPanel from "./AssistantPanel";

type Props = {
  bases: MenuItem[];
  pizzas: MenuItem[];
  toppings: MenuItem[];
  discountQtyThreshold: number;
};

type OrderConfirmation = {
  id: string;
  createdAt: string;
  customerName: string;
  phone: string;
  items: { category: string; name: string; unitPrice: number }[];
  quantity: number;
  unitTotal: number;
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  postDiscountTotal: number;
  gstAmount: number;
  grandTotal: number;
  paymentMode: string;
};

const PAYMENT_MODES: PaymentMode[] = ["Cash", "Card", "UPI"];

function formatMoney(n: number) {
  return `Rs. ${n.toFixed(2)}`;
}

export default function OrderForm({
  bases,
  pizzas,
  toppings,
  discountQtyThreshold,
}: Props) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [baseId, setBaseId] = useState(bases[0]?.id ?? "");
  const [pizzaId, setPizzaId] = useState(pizzas[0]?.id ?? "");
  const [toppingId, setToppingId] = useState(toppings[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [paymentMode, setPaymentMode] = useState<PaymentMode | "">("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(
    null
  );

  const selectedBase = bases.find((b) => b.id === baseId);
  const selectedPizza = pizzas.find((p) => p.id === pizzaId);
  const selectedTopping = toppings.find((t) => t.id === toppingId);

  const livePreview = useMemo(() => {
    const qtyResult = validateQuantity(quantity);
    if (!qtyResult.ok || !selectedBase || !selectedPizza || !selectedTopping) {
      return null;
    }
    const lines: BillLine[] = [
      { label: "Base", itemName: selectedBase.name, unitPrice: selectedBase.price },
      { label: "Pizza", itemName: selectedPizza.name, unitPrice: selectedPizza.price },
      { label: "Topping", itemName: selectedTopping.name, unitPrice: selectedTopping.price },
    ];
    return computeBill(lines, qtyResult.value, discountQtyThreshold);
  }, [quantity, selectedBase, selectedPizza, selectedTopping, discountQtyThreshold]);

  function validateFieldsBeforeSubmit(): boolean {
    const errors: Record<string, string> = {};
    const nameResult = validateName(customerName);
    if (!nameResult.ok) errors.customerName = nameResult.error;
    const phoneResult = validatePhone(phone);
    if (!phoneResult.ok) errors.phone = phoneResult.error;
    const qtyResult = validateQuantity(quantity);
    if (!qtyResult.ok) errors.quantity = qtyResult.error;
    if (!paymentMode) errors.paymentMode = "Please select a payment mode.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validateFieldsBeforeSubmit()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          baseId,
          pizzaId,
          toppingId,
          quantity,
          paymentMode,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.field) {
          setFieldErrors((prev) => ({ ...prev, [data.field]: data.error }));
        } else {
          setSubmitError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      setConfirmation(data.order);
    } catch {
      setSubmitError(
        "Could not reach the server. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startNewOrder() {
    setConfirmation(null);
    setCustomerName("");
    setPhone("");
    setQuantity("1");
    setPaymentMode("");
    setFieldErrors({});
    setSubmitError(null);
  }

  if (confirmation) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-green-200 bg-green-50 p-6">
        <h2 className="text-xl font-bold text-green-800">Order confirmed!</h2>
        <p className="mt-1 text-sm text-green-700">
          Order #{confirmation.id.slice(0, 8)} for {confirmation.customerName}
        </p>
        <div className="mt-4 space-y-1 rounded-md bg-white p-4 text-sm">
          {confirmation.items.map((item) => (
            <div key={item.category} className="flex justify-between">
              <span className="capitalize text-gray-600">
                {item.category}: {item.name}
              </span>
              <span>{formatMoney(item.unitPrice)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1 text-gray-600">
            <span>Quantity</span>
            <span>x {confirmation.quantity}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatMoney(confirmation.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Discount ({(confirmation.discountRate * 100).toFixed(0)}%)</span>
            <span>-{formatMoney(confirmation.discountAmount)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>GST (18%)</span>
            <span>{formatMoney(confirmation.gstAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <span>Total Paid</span>
            <span>{formatMoney(confirmation.grandTotal)}</span>
          </div>
          <div className="pt-1 text-gray-600">
            Payment: {confirmation.paymentMode}
          </div>
        </div>
        <button
          onClick={startNewOrder}
          className="mt-4 w-full rounded-md bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800"
        >
          Start another order
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-2">
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold text-gray-700">
            Customer details
          </legend>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="e.g. Rahul Sharma"
            />
            {fieldErrors.customerName && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.customerName}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="10-digit mobile number"
            />
            {fieldErrors.phone && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold text-gray-700">
            Build your pizza
          </legend>
          <MenuSelect label="Base" items={bases} value={baseId} onChange={setBaseId} />
          <MenuSelect label="Pizza" items={pizzas} value={pizzaId} onChange={setPizzaId} />
          <MenuSelect
            label="Topping"
            items={toppings}
            value={toppingId}
            onChange={setToppingId}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Quantity (1-10)
            </label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-32 rounded-md border px-3 py-2"
            />
            {fieldErrors.quantity && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.quantity}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              A 10% discount applies automatically for {discountQtyThreshold} or more pizzas.
            </p>
          </div>
        </fieldset>

        <fieldset className="space-y-2 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold text-gray-700">
            Payment mode
          </legend>
          <div className="flex gap-4">
            {PAYMENT_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paymentMode"
                  value={mode}
                  checked={paymentMode === mode}
                  onChange={() => setPaymentMode(mode)}
                />
                {mode}
              </label>
            ))}
          </div>
          {fieldErrors.paymentMode && (
            <p className="text-sm text-red-600">{fieldErrors.paymentMode}</p>
          )}
        </fieldset>

        {livePreview && <BillPreview bill={livePreview} />}

        {submitError && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent px-4 py-3 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Placing order..." : "Place Order"}
        </button>
      </form>

      <div className="lg:col-span-1">
        <AssistantPanel
          menu={{ bases, pizzas, toppings }}
        />
      </div>
    </div>
  );
}

function MenuSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: MenuItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border px-3 py-2"
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} - {formatMoney(item.price)}
          </option>
        ))}
      </select>
    </div>
  );
}

function BillPreview({ bill }: { bill: ReturnType<typeof computeBill> }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-4 text-sm">
      <h3 className="mb-2 font-semibold text-gray-800">Bill preview</h3>
      {bill.lines.map((line) => (
        <div key={line.label} className="flex justify-between text-gray-600">
          <span>
            {line.label}: {line.itemName}
          </span>
          <span>{formatMoney(line.unitPrice)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t pt-1 text-gray-600">
        <span>Price per pizza</span>
        <span>{formatMoney(bill.unitTotal)}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Quantity</span>
        <span>x {bill.quantity}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Subtotal</span>
        <span>{formatMoney(bill.subtotal)}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Discount ({(bill.discountRate * 100).toFixed(0)}%)</span>
        <span>-{formatMoney(bill.discountAmount)}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>GST (18%)</span>
        <span>{formatMoney(bill.gstAmount)}</span>
      </div>
      <div className="mt-1 flex justify-between border-t pt-1 text-base font-bold text-gray-900">
        <span>Grand Total</span>
        <span>{formatMoney(bill.grandTotal)}</span>
      </div>
    </div>
  );
}
