import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getOrgUsage } from "@/lib/plan/check-plan-limit";
import { ProductList } from "@/components/dashboard/product-list";
import { logError } from "@/lib/error-logger";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const { orgId } = session.user;

  try {
    const [org, products] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true },
      }),
      prisma.product.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const usage = await getOrgUsage(orgId, org?.plan);
    const planLimit = usage.limits.products;
    const canAddMore = planLimit === -1 || products.length < planLimit;

    const serialized = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stockLevel: p.stockLevel,
      warehouse: p.warehouse,
      reorderThreshold: p.reorderThreshold,
      price: p.price.toNumber(),
      createdAt: p.createdAt.toISOString(),
    }));

    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your product inventory for AI-powered stock queries
        </p>

        <div className="mt-8">
          <ProductList products={serialized} canAddMore={canAddMore} planLimit={planLimit} />
        </div>
      </div>
    );
  } catch (error) {
    logError("[ProductsPage]", error);
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your product inventory for AI-powered stock queries
        </p>
        <p className="mt-8 text-sm text-destructive">
          Failed to load products. Please try again later.
        </p>
      </div>
    );
  }
}
