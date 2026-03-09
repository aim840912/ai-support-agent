"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OrderDetail } from "./order-detail";

export type Order = {
  id: string;
  orderNumber: string;
  status: string;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  totalPrice: number;
  customerId: string | null;
  ticketCount: number;
  itemCount: number;
  createdAt: string;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  processing: {
    label: "Processing",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  shipped: {
    label: "Shipped",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  delivered: {
    label: "Delivered",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
};

type Props = {
  orders: Order[];
  activeStatus?: string;
};

export function OrderList({ orders, activeStatus }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleStatusChange(value: string) {
    const params = new URLSearchParams();
    if (value !== "all") params.set("status", value);
    router.push(`/orders?${params.toString()}`);
  }

  return (
    <>
      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by status:</span>
        <Select value={activeStatus ?? "all"} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-44" aria-label="Filter orders by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <ShoppingCart className="mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">No orders yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Orders will appear here once created.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-medium text-muted-foreground">Order #</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">
                  Total
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">
                  Items
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Customer
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const status = statusConfig[order.status] ?? {
                  label: order.status,
                  className: "bg-muted text-foreground",
                };

                return (
                  <TableRow
                    key={order.id}
                    className={cn("cursor-pointer hover:bg-accent")}
                    onClick={() => setSelectedId(order.id)}
                  >
                    <TableCell className="font-mono text-xs font-medium text-foreground">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("border-0 text-xs font-medium", status.className)}>
                          {status.label}
                        </Badge>
                        {order.ticketCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {order.ticketCount} ticket{order.ticketCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-foreground">
                      ${order.totalPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {order.itemCount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.customerId ?? (
                        <span className="italic text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground/70">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <OrderDetail
        orderId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdate={() => router.refresh()}
      />
    </>
  );
}
