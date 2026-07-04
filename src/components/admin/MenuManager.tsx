"use client";

import { useState } from "react";
import { Pencil, Eye, EyeOff, Check, X } from "lucide-react";
import { validateMenuItemName, validateMenuItemPrice } from "@/lib/validators";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Add item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="flex gap-3">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as MenuCategory)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <Input
                type="text"
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
              />
              <Input
                type="text"
                placeholder="Price"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-28"
              />
            </div>
            {nameFieldError && <p className="text-sm text-destructive">{nameFieldError}</p>}
            {priceFieldError && <p className="text-sm text-destructive">{priceFieldError}</p>}
            <Button type="submit" disabled={adding}>
              {adding ? "Adding..." : "Add item"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {CATEGORIES.map((category) => (
        <div key={category}>
          <h2 className="mb-2 font-medium text-foreground">{CATEGORY_LABELS[category]}</h2>
          <Card>
            <ul className="divide-y">
              {items
                .filter((item) => item.category === category)
                .map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {editingId === item.id ? (
                      <>
                        <Input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="text"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={saving}
                        >
                          <Check />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className={`flex-1 ${!item.is_active ? "text-muted-foreground" : ""}`}>
                          {item.name}
                        </span>
                        <span className={`w-24 ${!item.is_active ? "text-muted-foreground" : ""}`}>
                          {formatMoney(item.price)}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                          <Pencil />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(item)}
                          className={
                            item.is_active
                              ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                              : "text-green-700 hover:bg-green-50 hover:text-green-700"
                          }
                        >
                          {item.is_active ? <EyeOff /> : <Eye />}
                          {item.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </>
                    )}
                  </li>
                ))}
            </ul>
          </Card>
          {editingId && editError && items.some((i) => i.id === editingId) && (
            <p className="mt-1 text-sm text-destructive">{editError}</p>
          )}
        </div>
      ))}
    </div>
  );
}
