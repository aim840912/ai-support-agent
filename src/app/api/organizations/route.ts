import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { generateApiKey, hashApiKey } from "@/lib/api-key";
import { logError } from "@/lib/error-logger";
import { createRateLimiter, checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// 5 org creations per user per hour — prevents org-spam abuse
const createOrgLimiter = createRateLimiter({ limit: 5, window: "1h" });

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

/**
 * GET /api/organizations
 *
 * Returns the list of all organizations the authenticated user belongs to,
 * with their role in each org and a flag indicating the currently active org.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const memberships = await prisma.userOrganization.findMany({
      where: { userId: session.user.id },
      include: {
        org: { select: { id: true, name: true, plan: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      memberships.map((m) => ({
        id: m.org.id,
        name: m.org.name,
        plan: m.org.plan,
        role: m.role,
        isActive: m.orgId === session.user.orgId,
      }))
    );
  } catch (error) {
    logError("[Organizations GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/organizations
 * Body: { name: string }
 *
 * Creates a new organization for the authenticated user.
 * The user becomes the owner and their activeOrgId is switched to the new org.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit by userId — prevents org-spam (e.g. bulk org creation via script)
  const rl = await checkRateLimit(createOrgLimiter, `create-org:${session.user.id}`);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await request.json();
    const parsed = createOrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { name } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const rawApiKey = generateApiKey();
      const org = await tx.organization.create({
        data: { name, apiKey: rawApiKey, apiKeyHash: hashApiKey(rawApiKey) },
      });

      // Create membership as owner
      await tx.userOrganization.create({
        data: { userId: session.user.id, orgId: org.id, role: "owner" },
      });

      // Switch user's active org to the newly created org
      await tx.user.update({
        where: { id: session.user.id },
        data: { activeOrgId: org.id },
      });

      return org;
    });

    return NextResponse.json(
      { id: result.id, name: result.name, plan: result.plan, role: "owner", isActive: true },
      { status: 201 }
    );
  } catch (error) {
    logError("[Organizations POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
