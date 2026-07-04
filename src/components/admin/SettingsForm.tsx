"use client";

import { useState } from "react";
import { validateDiscountThreshold } from "@/lib/validators";

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
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4 rounded-lg border p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Bulk discount quantity threshold
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Orders with this quantity of pizzas or more automatically get a 10%
          discount. Takes effect immediately for new orders -- no deploy
          needed.
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-2 w-24 rounded-md border px-3 py-2"
        />
        {fieldError && <p className="mt-1 text-sm text-red-600">{fieldError}</p>}
      </div>

      {saveError && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{saveError}</p>
      )}
      {savedThreshold !== null && (
        <p className="rounded-md bg-green-50 p-2 text-sm text-green-700">
          Saved -- discount now applies at quantity {savedThreshold} or more.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
