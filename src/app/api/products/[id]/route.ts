import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest } from "next/server";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  stockLevel: z.number().int().min(0).optional(),
  warehouse: z.string().min(1).max(200).optional(),
  reorderThreshold: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const existing = await prisma.product.findFirst({ where: { id, orgId } });
    if (!existing) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stockLevel: product.stockLevel,
      warehouse: product.warehouse,
      reorderThreshold: product.reorderThreshold,
      price: product.price,
      createdAt: product.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[ProductsAPI PATCH/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const { id } = await context.params;

  try {
    const existing = await prisma.product.findFirst({ where: { id, orgId } });
    if (!existing) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    // Prevent deletion if the product is referenced by any order items
    const referencedByOrders = await prisma.orderItem.count({ where: { productId: id } });
    if (referencedByOrders > 0) {
      return Response.json(
        { error: "Cannot delete a product that is referenced by existing orders" },
        { status: 409 }
      );
    }

    await prisma.product.delete({ where: { id } });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[ProductsAPI DELETE/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
