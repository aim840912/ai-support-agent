import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { checkProductLimit } from "@/lib/plan/check-plan-limit";
import { NextRequest } from "next/server";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(100),
  stockLevel: z.number().int().min(0).default(0),
  warehouse: z.string().min(1).max(200),
  reorderThreshold: z.number().int().min(0).default(10),
  price: z.number().min(0).default(0),
});

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;

  try {
    const products = await prisma.product.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        sku: true,
        stockLevel: true,
        warehouse: true,
        reorderThreshold: true,
        price: true,
        createdAt: true,
      },
    });

    const data = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stockLevel: p.stockLevel,
      warehouse: p.warehouse,
      reorderThreshold: p.reorderThreshold,
      price: p.price,
      createdAt: p.createdAt.toISOString(),
    }));

    return Response.json(data);
  } catch (error) {
    console.error("[ProductsAPI GET]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;

  // Check plan limit before creating
  const limitResult = await checkProductLimit(orgId);
  if (!limitResult.allowed) {
    return Response.json({ error: limitResult.reason }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const { name, sku, stockLevel, warehouse, reorderThreshold, price } = parsed.data;

    // Check SKU uniqueness within the org (Prisma enforces global uniqueness,
    // but we give a clearer error here)
    const existing = await prisma.product.findFirst({ where: { sku, orgId } });
    if (existing) {
      return Response.json({ error: "A product with this SKU already exists" }, { status: 409 });
    }

    const product = await prisma.product.create({
      data: { name, sku, stockLevel, warehouse, reorderThreshold, price, orgId },
    });

    return Response.json(
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        stockLevel: product.stockLevel,
        warehouse: product.warehouse,
        reorderThreshold: product.reorderThreshold,
        price: product.price,
        createdAt: product.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ProductsAPI POST]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
