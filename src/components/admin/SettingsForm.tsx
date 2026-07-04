"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { validateDiscountThreshold } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsForm({
  initialThreshold,
}: {
  initialThreshold: number;
}) {
  const [value, setValue] = useState(String(initialThreshold));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedThreshold, setSavedThreshold] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSavedThreshold(null);

    const result = validateDiscountThreshold(value);
    if (!result.ok) {
      setFieldError(result.error);
      return;
    }
    setFieldError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountQtyThreshold: result.value }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSaveError(data.error ?? "Could not save. Please try again.");
        return;
      }
      setSavedThreshold(data.settings.discount_qty_threshold);
      setValue(String(data.settings.discount_qty_threshold));
    } catch {
      setSaveError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Bulk discount threshold</CardTitle>
          <CardDescription>
            Takes effect immediately for new orders -- no deploy needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discount-threshold">Quantity threshold</Label>
              <Input
                id="discount-threshold"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-24"
              />
              {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
            </div>

            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            {savedThreshold !== null && (
              <Alert>
                <AlertDescription>
                  Saved -- discount now applies at quantity {savedThreshold} or more.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="size-4" />
            About this setting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            PizzaFlow automatically applies a 10% discount to any order whose
            quantity meets or exceeds this threshold. It&apos;s the same rule
            counter staff see on the order form (&quot;A 10% discount applies
            automatically for {value || initialThreshold} or more
            pizzas.&quot;), sourced from this single live value.
          </p>
          <p>
            Changing it here takes effect immediately for every new order --
            no code change or deploy required. Past orders are never
            recalculated, so adjusting the threshold has no effect on
            historical order history or reporting.
          </p>
          <p>
            Valid range is 1-10, matching the maximum quantity a single order
            can have.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
