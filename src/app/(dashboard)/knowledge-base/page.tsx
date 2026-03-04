import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { DocumentList } from "@/components/dashboard/document-list";

export default async function KnowledgeBasePage() {
  const session = await auth();

  const documents = await prisma.document.findMany({
    where: { orgId: session?.user?.orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      status: true,
      chunkCount: true,
      createdAt: true,
    },
  });

  // Serialize dates for client components
  const serialized = documents.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Knowledge Base</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Upload documents to train your AI support agent
      </p>

      <div className="mt-8 space-y-6">
        <UploadDropzone />
        <DocumentList documents={serialized} />
      </div>
    </div>
  );
}
