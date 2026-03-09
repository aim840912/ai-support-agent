export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export type Order = {
  orderId: string;
  status: OrderStatus;
  product: string;
  quantity: number;
  price: number;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  createdAt: string;
};

export const mockOrders: Record<string, Order> = {
  "ORD-001": {
    orderId: "ORD-001",
    status: "delivered",
    product: "Wireless Noise-Cancelling Headphones",
    quantity: 1,
    price: 299.99,
    trackingNumber: "1Z999AA10123456784",
    estimatedDelivery: "2024-01-15",
    createdAt: "2024-01-10",
  },
  "ORD-002": {
    orderId: "ORD-002",
    status: "shipped",
    product: "Mechanical Keyboard (RGB)",
    quantity: 1,
    price: 149.99,
    trackingNumber: "1Z999AA10123456785",
    estimatedDelivery: "2024-01-20",
    createdAt: "2024-01-16",
  },
  "ORD-003": {
    orderId: "ORD-003",
    status: "processing",
    product: "USB-C Hub 7-in-1",
    quantity: 2,
    price: 49.99,
    trackingNumber: null,
    estimatedDelivery: "2024-01-22",
    createdAt: "2024-01-18",
  },
  "ORD-004": {
    orderId: "ORD-004",
    status: "pending",
    product: "Ergonomic Mouse",
    quantity: 1,
    price: 79.99,
    trackingNumber: null,
    estimatedDelivery: null,
    createdAt: "2024-01-19",
  },
  "ORD-005": {
    orderId: "ORD-005",
    status: "cancelled",
    product: "Standing Desk Mat",
    quantity: 1,
    price: 59.99,
    trackingNumber: null,
    estimatedDelivery: null,
    createdAt: "2024-01-12",
  },
  "ORD-006": {
    orderId: "ORD-006",
    status: "shipped",
    product: "4K Webcam",
    quantity: 1,
    price: 199.99,
    trackingNumber: "1Z999AA10123456786",
    estimatedDelivery: "2024-01-21",
    createdAt: "2024-01-17",
  },
};
