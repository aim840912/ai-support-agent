/**
 * Data Migration: Populate UserOrganization from existing User.orgId/role
 *
 * Run AFTER applying Migration A (add_user_organization schema migration):
 *
 *   pnpm prisma migrate deploy          # apply schema changes
 *   npx tsx prisma/seed-migration.ts    # run this data migration
 *
 * What this script does:
 *   1. For every User that has an orgId, creates a UserOrganization record
 *      (idempotent — skips users that already have a record via @@unique).
 *   2. Sets User.activeOrgId = User.orgId for all users where activeOrgId is null.
 *
 * Safe to re-run: upsert semantics prevent duplicate UserOrganization rows.
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting data migration: UserOrganization backfill...");

  // Step 1: Fetch all users that need backfilling
  const users = await prisma.user.findMany({
    select: { id: true, orgId: true, role: true, activeOrgId: true },
  });

  console.log(`Found ${users.length} users to process.`);

  let created = 0;
  let skipped = 0;
  let activeOrgUpdated = 0;

  for (const user of users) {
    // Create UserOrganization record (upsert = idempotent)
    const result = await prisma.userOrganization.upsert({
      where: { userId_orgId: { userId: user.id, orgId: user.orgId } },
      update: {}, // Already exists — no changes needed
      create: {
        userId: user.id,
        orgId: user.orgId,
        role: user.role,
      },
    });

    // Count whether a new record was created or skipped
    // (upsert doesn't directly tell us, but we can check createdAt proximity)
    const wasJustCreated = new Date().getTime() - result.createdAt.getTime() < 5000;
    if (wasJustCreated) {
      created++;
    } else {
      skipped++;
    }

    // Step 2: Set activeOrgId if not already set
    if (!user.activeOrgId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { activeOrgId: user.orgId },
      });
      activeOrgUpdated++;
    }
  }

  console.log(`Done.`);
  console.log(`  UserOrganization records created: ${created}`);
  console.log(`  UserOrganization records skipped (already existed): ${skipped}`);
  console.log(`  Users with activeOrgId set: ${activeOrgUpdated}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
