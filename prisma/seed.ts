/**
 * Seed script for development/demo data.
 * Mirrors the structure from src/lib/ai/mock-data/ but persists to Postgres.
 *
 * Run: pnpm prisma db seed
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local so seed can access DATABASE_URL in local development
try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {
  // rely on environment variables already set
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Find the first org to seed data for
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!org) {
    console.warn(
      "No organization found. Register an account first, then re-run seed."
    );
    return;
  }

  console.log(`Seeding data for org: ${org.name} (${org.id})`);

  // ── Products ──────────────────────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: "AUDIO-WNC-BLK" },
      update: {},
      create: {
        name: "Wireless Noise-Cancelling Headphones",
        sku: "AUDIO-WNC-BLK",
        stockLevel: 45,
        warehouse: "WH-West",
        reorderThreshold: 10,
        price: 299.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "KB-MECH-RGB" },
      update: {},
      create: {
        name: "Mechanical Keyboard (RGB)",
        sku: "KB-MECH-RGB",
        stockLevel: 12,
        warehouse: "WH-East",
        reorderThreshold: 15,
        price: 149.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HUB-USBC-7P" },
      update: {},
      create: {
        name: "USB-C Hub 7-in-1",
        sku: "HUB-USBC-7P",
        stockLevel: 78,
        warehouse: "WH-Central",
        reorderThreshold: 20,
        price: 49.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "MOUSE-ERG-GRY" },
      update: {},
      create: {
        name: "Ergonomic Mouse",
        sku: "MOUSE-ERG-GRY",
        stockLevel: 3,
        warehouse: "WH-West",
        reorderThreshold: 10,
        price: 79.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "MAT-STAND-BLK" },
      update: {},
      create: {
        name: "Standing Desk Mat",
        sku: "MAT-STAND-BLK",
        stockLevel: 0,
        warehouse: "WH-East",
        reorderThreshold: 5,
        price: 59.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "CAM-4K-USB" },
      update: {},
      create: {
        name: "4K Webcam",
        sku: "CAM-4K-USB",
        stockLevel: 28,
        warehouse: "WH-Central",
        reorderThreshold: 8,
        price: 199.99,
        orgId: org.id,
      },
    }),
  ]);

  const [headphones, keyboard, hub, mouse, mat, webcam] = products;

  console.log(`Seeded ${products.length} products`);

  // ── Orders ────────────────────────────────────────────────────────────────
  const orders = await Promise.all([
    prisma.order.upsert({
      where: { orderNumber: "ORD-001" },
      update: {},
      create: {
        orderNumber: "ORD-001",
        status: "delivered",
        trackingNumber: "1Z999AA10123456784",
        estimatedDelivery: new Date("2024-01-15"),
        totalPrice: 299.99,
        customerId: "CUST-001",
        orgId: org.id,
        createdAt: new Date("2024-01-10"),
        items: {
          create: {
            productId: headphones.id,
            quantity: 1,
            unitPrice: 299.99,
          },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-002" },
      update: {},
      create: {
        orderNumber: "ORD-002",
        status: "shipped",
        trackingNumber: "1Z999AA10123456785",
        estimatedDelivery: new Date("2024-01-20"),
        totalPrice: 149.99,
        orgId: org.id,
        createdAt: new Date("2024-01-16"),
        items: {
          create: {
            productId: keyboard.id,
            quantity: 1,
            unitPrice: 149.99,
          },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-003" },
      update: {},
      create: {
        orderNumber: "ORD-003",
        status: "processing",
        estimatedDelivery: new Date("2024-01-22"),
        totalPrice: 99.98,
        orgId: org.id,
        createdAt: new Date("2024-01-18"),
        items: {
          create: {
            productId: hub.id,
            quantity: 2,
            unitPrice: 49.99,
          },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-004" },
      update: {},
      create: {
        orderNumber: "ORD-004",
        status: "pending",
        totalPrice: 79.99,
        orgId: org.id,
        createdAt: new Date("2024-01-19"),
        items: {
          create: {
            productId: mouse.id,
            quantity: 1,
            unitPrice: 79.99,
          },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-005" },
      update: {},
      create: {
        orderNumber: "ORD-005",
        status: "cancelled",
        totalPrice: 59.99,
        orgId: org.id,
        createdAt: new Date("2024-01-12"),
        items: {
          create: {
            productId: mat.id,
            quantity: 1,
            unitPrice: 59.99,
          },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-006" },
      update: {},
      create: {
        orderNumber: "ORD-006",
        status: "shipped",
        trackingNumber: "1Z999AA10123456786",
        estimatedDelivery: new Date("2024-01-21"),
        totalPrice: 199.99,
        orgId: org.id,
        createdAt: new Date("2024-01-17"),
        items: {
          create: {
            productId: webcam.id,
            quantity: 1,
            unitPrice: 199.99,
          },
        },
      },
    }),
  ]);

  console.log(`Seeded ${orders.length} orders`);

  // ── Tickets ───────────────────────────────────────────────────────────────
  const tickets = await Promise.all([
    prisma.ticket.upsert({
      where: { ticketNumber: "TKT-1000" },
      update: {},
      create: {
        ticketNumber: "TKT-1000",
        subject: "Headphones not pairing",
        description: "Cannot pair with Bluetooth on MacBook Pro.",
        priority: "medium",
        status: "in_progress",
        orderId: orders[0].id,
        orgId: org.id,
        createdAt: new Date("2024-01-16"),
      },
    }),
  ]);

  console.log(`Seeded ${tickets.length} tickets`);
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
