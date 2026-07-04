"use client";

import { useState } from "react";
import { validateMenuItemName, validateMenuItemPrice } from "@/lib/validators";
import type { MenuCategory, MenuItem } from "@/lib/types";

const CATEGORIES: MenuCategory[] = ["base", "pizza", "topping"];
const CATEGORY_LABELS: Record<MenuCategory, string> = {
  base: "Base",
  pizza: "Pizza",
  topping: "Topping",
};

function formatMoney(n: number) {
  return `Rs. ${n.toFixed(2)}`;
}

export default function MenuManager({ initialItems }: { initialItems: MenuItem[] }) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [error, setError] = useState<string | null>(null);

  const [newCategory, setNewCategory] = useState<MenuCategory>("pizza");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [nameFieldError, setNameFieldError] = useState<string | null>(null);
  const [priceFieldError, setPriceFieldError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const nameResult = validateMenuItemName(newName);
    if (!nameResult.ok) {
      setNameFieldError(nameResult.error);
      return;
    }
    setNameFieldError(null);

    const priceResult = validateMenuItemPrice(newPrice);
    if (!priceResult.ok) {
      setPriceFieldError(priceResult.error);
      return;
    }
    setPriceFieldError(null);

    setAdding(true);
    try {
      const res = await fetch("/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newCategory,
          name: nameResult.value,
          price: priceResult.value,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Could not add the item. Please try again.");
        return;
      }
      setItems((prev) => [...prev, data.item as MenuItem]);
      setNewName("");
      setNewPrice("");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    setEditError(null);

    const nameResult = validateMenuItemName(editName);
    if (!nameResult.ok) {
      setEditError(nameResult.error);
      return;
    }
    const priceResult = validateMenuItemPrice(editPrice);
    if (!priceResult.ok) {
      setEditError(priceResult.error);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: nameResult.value, price: priceResult.value }),
      });
      const data = await res.json();
      if (!data.ok) {
        setEditError(data.error ?? "Could not save changes. Please try again.");
        return;
      }
      setItems((prev) => prev.map((it) => (it.id === id ? (data.item as MenuItem) : it)));
      setEditingId(null);
    } catch {
      setEditError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: MenuItem) {
    setError(null);
    try {
      const res = await fetch("/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Could not update the item. Please try again.");
        return;
      }
      setItems((prev) => prev.map((it) => (it.id === item.id ? (data.item as MenuItem) : it)));
    } catch {
      setError("Could not reach the server. Please try again.");
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleAdd} className="max-w-lg space-y-4 rounded-lg border p-6">
        <h2 className="font-medium text-gray-900">Add item</h2>
        <div className="flex gap-3">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as MenuCategory)}
            className="rounded-md border px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2"
          />
          <input
            type="text"
            placeholder="Price"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="w-28 rounded-md border px-3 py-2"
          />
        </div>
        {nameFieldError && <p className="text-sm text-red-600">{nameFieldError}</p>}
        {priceFieldError && <p className="text-sm text-red-600">{priceFieldError}</p>}
        <button
          type="submit"
          disabled={adding}
          className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add item"}
        </button>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}

      {CATEGORIES.map((category) => (
        <div key={category}>
          <h2 className="mb-2 font-medium text-gray-900">{CATEGORY_LABELS[category]}</h2>
          <ul className="divide-y rounded-lg border">
            {items
              .filter((item) => item.category === category)
              .map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  {editingId === item.id ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 rounded-md border px-2 py-1"
                      />
                      <input
                        type="text"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-24 rounded-md border px-2 py-1"
                      />
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={saving}
                        className="rounded-md bg-accent px-3 py-1 text-sm text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-md px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 ${!item.is_active ? "text-gray-400" : ""}`}>
                        {item.name}
                      </span>
                      <span className={`w-24 ${!item.is_active ? "text-gray-400" : ""}`}>
                        {formatMoney(item.price)}
                      </span>
                      <button
                        onClick={() => startEdit(item)}
                        className="rounded-md px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`rounded-md px-3 py-1 text-sm ${
                          item.is_active
                            ? "text-red-700 hover:bg-red-50"
                            : "text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {item.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </>
                  )}
                </li>
              ))}
          </ul>
          {editingId && editError && items.some((i) => i.id === editingId) && (
            <p className="mt-1 text-sm text-red-600">{editError}</p>
          )}
        </div>
      ))}
    </div>
  );
}
