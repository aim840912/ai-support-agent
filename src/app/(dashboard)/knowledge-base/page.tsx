import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { DocumentList } from "@/components/dashboard/document-list";
import { PlanLimitBanner } from "@/components/dashboard/plan-limit-banner";
import { getPlanLimits } from "@/lib/plan/limits";

export default async function KnowledgeBasePage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  const orgId = session.user.orgId;

  try {
    const [org, documents] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true },
      }),
      prisma.document.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          status: true,
          chunkCount: true,
          createdAt: true,
        },
      }),
    ]);

    const plan = org?.plan ?? "free";
    const limits = getPlanLimits(plan);

    // Serialize dates for client components
    const serialized = documents.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    }));

    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Knowledge Base</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload documents to train your AI support agent
        </p>

        <div className="mt-8 space-y-4">
          <PlanLimitBanner
            resource="Documents"
            current={documents.length}
            limit={limits.documents}
            plan={plan}
          />
          <UploadDropzone />
          <DocumentList documents={serialized} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("[KnowledgeBasePage]", error);
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Knowledge Base</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload documents to train your AI support agent
        </p>
        <p className="mt-8 text-sm text-destructive">
          Failed to load knowledge base. Please try again later.
        </p>
      </div>
    );
  }
}
