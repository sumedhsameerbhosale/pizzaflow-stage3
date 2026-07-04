"use client";

import { useMemo, useState } from "react";
import {
  validateName,
  validatePhone,
  validateQuantity,
} from "@/lib/validators";
import { computeBill, type BillLine } from "@/lib/billing";
import type { MenuItem, PaymentMode, ExtractedOrderFields } from "@/lib/types";
import AssistantPanel from "./AssistantPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  function applyExtractedOrder(fields: ExtractedOrderFields) {
    if (fields.customerName !== undefined) setCustomerName(fields.customerName);
    if (fields.phone !== undefined) setPhone(fields.phone);
    if (fields.baseId !== undefined) setBaseId(fields.baseId);
    if (fields.pizzaId !== undefined) setPizzaId(fields.pizzaId);
    if (fields.toppingId !== undefined) setToppingId(fields.toppingId);
    if (fields.quantity !== undefined) setQuantity(String(fields.quantity));
    if (fields.paymentMode !== undefined) setPaymentMode(fields.paymentMode);
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
      <Card className="mx-auto max-w-xl border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-xl text-green-800">Order confirmed!</CardTitle>
          <p className="text-sm text-green-700">
            Order #{confirmation.id.slice(0, 8)} for {confirmation.customerName}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 rounded-md bg-white p-4 text-sm">
            {confirmation.items.map((item) => (
              <div key={item.category} className="flex justify-between">
                <span className="capitalize text-muted-foreground">
                  {item.category}: {item.name}
                </span>
                <span>{formatMoney(item.unitPrice)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1 text-muted-foreground">
              <span>Quantity</span>
              <span>x {confirmation.quantity}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatMoney(confirmation.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Discount ({(confirmation.discountRate * 100).toFixed(0)}%)</span>
              <span>-{formatMoney(confirmation.discountAmount)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>GST (18%)</span>
              <span>{formatMoney(confirmation.gstAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 text-base font-bold">
              <span>Total Paid</span>
              <span>{formatMoney(confirmation.grandTotal)}</span>
            </div>
            <div className="pt-1 text-muted-foreground">
              Payment: {confirmation.paymentMode}
            </div>
          </div>
          <Button
            onClick={startNewOrder}
            className="mt-4 w-full bg-green-700 text-white hover:bg-green-800"
          >
            Start another order
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-2">
        <fieldset className="space-y-4 rounded-xl border border-input bg-card p-4 ring-1 ring-foreground/10">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Customer details
          </legend>
          <div className="space-y-2">
            <Label htmlFor="customerName">Name</Label>
            <Input
              id="customerName"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
            />
            {fieldErrors.customerName && (
              <p className="text-sm text-destructive">{fieldErrors.customerName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
            />
            {fieldErrors.phone && (
              <p className="text-sm text-destructive">{fieldErrors.phone}</p>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-input bg-card p-4 ring-1 ring-foreground/10">
          <legend className="px-1 text-sm font-semibold text-foreground">
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
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (1-10)</Label>
            <Input
              id="quantity"
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-32"
            />
            {fieldErrors.quantity && (
              <p className="text-sm text-destructive">{fieldErrors.quantity}</p>
            )}
            <p className="text-xs text-muted-foreground">
              A 10% discount applies automatically for {discountQtyThreshold} or more pizzas.
            </p>
          </div>
        </fieldset>

        <fieldset className="space-y-2 rounded-xl border border-input bg-card p-4 ring-1 ring-foreground/10">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Payment mode
          </legend>
          <RadioGroup
            value={paymentMode}
            onValueChange={(v) => setPaymentMode(v as PaymentMode)}
            className="flex flex-row gap-6"
          >
            {PAYMENT_MODES.map((mode) => (
              <div key={mode} className="flex items-center gap-2">
                <RadioGroupItem value={mode} id={`payment-${mode}`} />
                <Label htmlFor={`payment-${mode}`}>{mode}</Label>
              </div>
            ))}
          </RadioGroup>
          {fieldErrors.paymentMode && (
            <p className="text-sm text-destructive">{fieldErrors.paymentMode}</p>
          )}
        </fieldset>

        {livePreview && <BillPreview bill={livePreview} />}

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={submitting} size="lg" className="w-full">
          {submitting ? "Placing order..." : "Place Order"}
        </Button>
      </form>

      <div className="lg:col-span-1">
        <AssistantPanel
          menu={{ bases, pizzas, toppings }}
          onApplyExtractedOrder={applyExtractedOrder}
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
    <div className="space-y-2">
      <Label htmlFor={`select-${label}`}>{label}</Label>
      <select
        id={`select-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Bill preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {bill.lines.map((line) => (
          <div key={line.label} className="flex justify-between text-muted-foreground">
            <span>
              {line.label}: {line.itemName}
            </span>
            <span>{formatMoney(line.unitPrice)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-1 text-muted-foreground">
          <span>Price per pizza</span>
          <span>{formatMoney(bill.unitTotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Quantity</span>
          <span>x {bill.quantity}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatMoney(bill.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Discount ({(bill.discountRate * 100).toFixed(0)}%)</span>
          <span>-{formatMoney(bill.discountAmount)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>GST (18%)</span>
          <span>{formatMoney(bill.gstAmount)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 text-base font-bold text-foreground">
          <span>Grand Total</span>
          <span>{formatMoney(bill.grandTotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
