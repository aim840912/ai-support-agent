-- Migration A: Multi-org support
-- Adds UserOrganization join table and User.activeOrgId.
-- Also fixes pre-existing Decimal column type drift (DoublePrecision -> Decimal).

-- AlterTable: Fix Decimal column types (pre-existing schema drift)
ALTER TABLE "Order" ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable: Add activeOrgId to User (nullable FK to Organization)
ALTER TABLE "User" ADD COLUMN "activeOrgId" TEXT;

-- CreateTable: UserOrganization join table (1 user : N orgs)
CREATE TABLE "UserOrganization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserOrganization_userId_idx" ON "UserOrganization"("userId");

-- CreateIndex
CREATE INDEX "UserOrganization_orgId_idx" ON "UserOrganization"("orgId");

-- CreateIndex: Enforce one membership record per user-org pair
CREATE UNIQUE INDEX "UserOrganization_userId_orgId_key" ON "UserOrganization"("userId", "orgId");

-- AddForeignKey: User.activeOrgId -> Organization.id (SET NULL on delete)
ALTER TABLE "User" ADD CONSTRAINT "User_activeOrgId_fkey" FOREIGN KEY ("activeOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: UserOrganization.userId -> User.id (CASCADE delete)
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: UserOrganization.orgId -> Organization.id (CASCADE delete)
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
