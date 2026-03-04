export type InventoryItem = {
  productId: string;
  name: string;
  stockLevel: number;
  warehouse: string;
  sku: string;
  reorderThreshold: number;
  lastRestocked: string;
};

export const mockInventory: Record<string, InventoryItem> = {
  "PROD-001": {
    productId: "PROD-001",
    name: "Wireless Noise-Cancelling Headphones",
    stockLevel: 45,
    warehouse: "WH-West",
    sku: "AUDIO-WNC-BLK",
    reorderThreshold: 10,
    lastRestocked: "2024-01-05",
  },
  "PROD-002": {
    productId: "PROD-002",
    name: "Mechanical Keyboard (RGB)",
    stockLevel: 12,
    warehouse: "WH-East",
    sku: "KB-MECH-RGB",
    reorderThreshold: 15,
    lastRestocked: "2024-01-08",
  },
  "PROD-003": {
    productId: "PROD-003",
    name: "USB-C Hub 7-in-1",
    stockLevel: 78,
    warehouse: "WH-Central",
    sku: "HUB-USBC-7P",
    reorderThreshold: 20,
    lastRestocked: "2024-01-10",
  },
  "PROD-004": {
    productId: "PROD-004",
    name: "Ergonomic Mouse",
    stockLevel: 3,
    warehouse: "WH-West",
    sku: "MOUSE-ERG-GRY",
    reorderThreshold: 10,
    lastRestocked: "2023-12-28",
  },
  "PROD-005": {
    productId: "PROD-005",
    name: "Standing Desk Mat",
    stockLevel: 0,
    warehouse: "WH-East",
    sku: "MAT-STAND-BLK",
    reorderThreshold: 5,
    lastRestocked: "2023-12-15",
  },
  "PROD-006": {
    productId: "PROD-006",
    name: "4K Webcam",
    stockLevel: 28,
    warehouse: "WH-Central",
    sku: "CAM-4K-USB",
    reorderThreshold: 8,
    lastRestocked: "2024-01-12",
  },
};
