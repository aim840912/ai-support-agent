"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Product } from "./product-list";

type Props = {
  open: boolean;
  product: Product | null; // null = create mode, non-null = edit mode
  onClose: () => void;
  onSuccess: () => void;
};

type FormState = {
  name: string;
  sku: string;
  stockLevel: string;
  warehouse: string;
  reorderThreshold: string;
  price: string;
};

const emptyForm: FormState = {
  name: "",
  sku: "",
  stockLevel: "0",
  warehouse: "",
  reorderThreshold: "10",
  price: "0",
};

export function ProductFormDialog({ open, product, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();

  // Sync form when product changes (edit mode) or reset on create
  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        stockLevel: String(product.stockLevel),
        warehouse: product.warehouse,
        reorderThreshold: String(product.reorderThreshold),
        price: String(product.price),
      });
    } else {
      setForm(emptyForm);
    }
  }, [product, open]);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const payload = {
          name: form.name.trim(),
          sku: form.sku.trim(),
          stockLevel: parseInt(form.stockLevel, 10) || 0,
          warehouse: form.warehouse.trim(),
          reorderThreshold: parseInt(form.reorderThreshold, 10) || 10,
          price: parseFloat(form.price) || 0,
        };

        const url = product ? `/api/products/${product.id}` : "/api/products";
        const method = product ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to save product");
        }

        toast.success(product ? "Product updated" : "Product created");
        onSuccess();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save product.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {product ? "Edit Product" : "New Product"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Widget Pro 3000"
              required
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="product-sku">SKU</Label>
              <Input
                id="product-sku"
                value={form.sku}
                onChange={(e) => handleChange("sku", e.target.value)}
                placeholder="WP-3000"
                required
                maxLength={100}
                // SKU cannot be changed after creation
                disabled={!!product}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-price">Price ($)</Label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => handleChange("price", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-warehouse">Warehouse</Label>
            <Input
              id="product-warehouse"
              value={form.warehouse}
              onChange={(e) => handleChange("warehouse", e.target.value)}
              placeholder="Main Warehouse"
              required
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="product-stock">Stock Level</Label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                step="1"
                value={form.stockLevel}
                onChange={(e) => handleChange("stockLevel", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-threshold">Reorder Threshold</Label>
              <Input
                id="product-threshold"
                type="number"
                min="0"
                step="1"
                value={form.reorderThreshold}
                onChange={(e) => handleChange("reorderThreshold", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : product ? "Save Changes" : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
