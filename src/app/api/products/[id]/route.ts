import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest } from "next/server";
import { logError } from "@/lib/error-logger";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  stockLevel: z.number().int().min(0).optional(),
  warehouse: z.string().min(1).max(200).optional(),
  reorderThreshold: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    // updateMany with orgId — atomic authorization + mutation, eliminates TOCTOU
    // race between the previous findFirst (with orgId) and update (with id only).
    const updateResult = await prisma.product.updateMany({
      where: { id, orgId },
      data: parsed.data,
    });

    if (updateResult.count === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    // Fetch updated record for response — updateMany does not return updated rows.
    const product = await prisma.product.findUnique({
      where: { id },
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

    return Response.json({
      id: product!.id,
      name: product!.name,
      sku: product!.sku,
      stockLevel: product!.stockLevel,
      warehouse: product!.warehouse,
      reorderThreshold: product!.reorderThreshold,
      price: product!.price.toNumber(),
      createdAt: product!.createdAt.toISOString(),
    });
  } catch (error) {
    logError("[ProductsAPI PATCH/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;
  const { id } = await context.params;

  try {
    // Check for existing order references first (informational guard)
    const referencedByOrders = await prisma.orderItem.count({ where: { productId: id } });
    if (referencedByOrders > 0) {
      return Response.json(
        { error: "Cannot delete a product that is referenced by existing orders" },
        { status: 409 }
      );
    }

    // deleteMany with orgId — atomic authorization + deletion, eliminates TOCTOU
    // race between the previous findFirst (with orgId) and delete (with id only).
    const deleteResult = await prisma.product.deleteMany({ where: { id, orgId } });

    if (deleteResult.count === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logError("[ProductsAPI DELETE/:id]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
