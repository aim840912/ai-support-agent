"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ProductFormDialog } from "./product-form-dialog";

export type Product = {
  id: string;
  name: string;
  sku: string;
  stockLevel: number;
  warehouse: string;
  reorderThreshold: number;
  price: number;
  createdAt: string;
};

type Props = {
  products: Product[];
  canAddMore: boolean;
  planLimit: number;
};

export function ProductList({ products, canAddMore, planLimit }: Props) {
  const router = useRouter();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(productId: string) {
    setDeletingId(productId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Delete failed");
        }
        toast.success("Product deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete product.");
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <>
      {/* Header actions */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} / {planLimit === -1 ? "unlimited" : planLimit} products
        </p>
        <Button
          size="sm"
          onClick={() => setIsCreating(true)}
          disabled={!canAddMore}
          aria-label="Add new product"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Product
        </Button>
      </div>

      {!canAddMore && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          You&apos;ve reached the product limit for your plan ({planLimit} products). Upgrade to Pro
          for up to 1,000 products.
        </div>
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <Package className="mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">No products yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add products to your inventory so the AI agent can check stock levels.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">SKU</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">
                  Price
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">
                  Stock
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Warehouse
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isLowStock = product.stockLevel <= product.reorderThreshold;
                const isDeleting = deletingId === product.id && isPending;

                return (
                  <TableRow key={product.id} className={cn("group", isDeleting && "opacity-50")}>
                    <TableCell className="text-sm font-medium text-foreground">
                      {product.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {product.sku}
                    </TableCell>
                    <TableCell className="text-right text-sm text-foreground">
                      ${product.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm text-foreground">{product.stockLevel}</span>
                        {isLowStock && (
                          <Badge className="border-0 bg-red-100 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            Low
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {product.warehouse}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${product.name}`}
                          onClick={() => setEditingProduct(product)}
                          className="h-7 w-7 p-0 hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete ${product.name}`}
                              disabled={isDeleting}
                              className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove the product from your inventory.
                                Products referenced by existing orders cannot be deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(product.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog
        open={isCreating}
        product={null}
        onClose={() => setIsCreating(false)}
        onSuccess={() => {
          setIsCreating(false);
          router.refresh();
        }}
      />

      <ProductFormDialog
        open={!!editingProduct}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSuccess={() => {
          setEditingProduct(null);
          router.refresh();
        }}
      />
    </>
  );
}
