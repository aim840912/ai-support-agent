"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

type OrderTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
};

type OrderDetailData = {
  id: string;
  orderNumber: string;
  status: string;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  totalPrice: number;
  customerId: string | null;
  createdAt: string;
  items: OrderItem[];
  tickets: OrderTicket[];
};

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  shipped: { label: "Shipped", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

type Props = {
  orderId: string | null;
  onClose: () => void;
  onUpdate: () => void;
};

export function OrderDetail({ orderId, onClose, onUpdate }: Props) {
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingInput, setTrackingInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = async (open: boolean) => {
    if (!open) {
      onClose();
      setOrder(null);
      setTrackingInput("");
      return;
    }
    if (orderId && open) {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error("Failed to load order");
        const data = await res.json();
        setOrder(data);
        setTrackingInput(data.trackingNumber ?? "");
      } catch {
        toast.error("Failed to load order details.");
        onClose();
      } finally {
        setLoading(false);
      }
    }
  };

  function handleStatusChange(newStatus: string) {
    if (!order) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Update failed");
        setOrder((prev) => prev ? { ...prev, status: newStatus } : prev);
        toast.success("Status updated");
        onUpdate();
      } catch {
        toast.error("Failed to update status.");
      }
    });
  }

  function handleSaveTracking() {
    if (!order) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingNumber: trackingInput.trim() }),
        });
        if (!res.ok) throw new Error("Update failed");
        setOrder((prev) => prev ? { ...prev, trackingNumber: trackingInput.trim() } : prev);
        toast.success("Tracking number saved");
        onUpdate();
      } catch {
        toast.error("Failed to save tracking number.");
      }
    });
  }

  const status = order ? (statusConfig[order.status] ?? { label: order.status, className: "bg-muted text-foreground" }) : null;

  return (
    <Dialog open={!!orderId} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {order ? `Order ${order.orderNumber}` : "Order Details"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : order ? (
          <div className="space-y-5">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2">
              {status && (
                <Badge className={cn("border-0 text-xs font-medium", status.className)}>
                  {status.label}
                </Badge>
              )}
              {order.customerId && (
                <span className="text-xs text-muted-foreground">
                  Customer: <span className="font-mono">{order.customerId}</span>
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(order.createdAt).toLocaleString()}
              </span>
            </div>

            {/* Status update */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Select
                value={order.status}
                onValueChange={handleStatusChange}
                disabled={isPending}
              >
                <SelectTrigger className="w-44" aria-label="Update order status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tracking number */}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="tracking-number">Tracking Number</Label>
                <Input
                  id="tracking-number"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="e.g. 1Z999AA10123456784"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveTracking}
                disabled={isPending || trackingInput === (order.trackingNumber ?? "")}
              >
                Save
              </Button>
            </div>

            {/* Items table */}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Order Items</p>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-medium text-muted-foreground">Product</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">SKU</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground text-right">Qty</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground text-right">Unit</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm text-foreground">{item.productName}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                        <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">${item.subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-right text-sm font-semibold text-foreground">
                Total: ${order.totalPrice.toFixed(2)}
              </p>
            </div>

            {/* Related tickets */}
            {order.tickets.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Related Tickets</p>
                <div className="space-y-1.5">
                  {order.tickets.map((ticket) => (
                    <div key={ticket.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
                      <span className="flex-1 truncate text-foreground">{ticket.subject}</span>
                      <Badge className="border-0 text-xs">{ticket.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
