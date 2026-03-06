"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Document = {
  id: string;
  filename: string;
  status: string;
  chunkCount: number;
  createdAt: string;
};

const statusConfig = {
  processing: { label: "Processing", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  ready: { label: "Ready", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  error: { label: "Error", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

export function DocumentList({ documents }: { documents: Document[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDeleting(null);
    router.refresh();
  }

  if (documents.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No documents yet. Upload one above to get started.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {documents.map((doc) => {
        const status = statusConfig[doc.status as keyof typeof statusConfig] ??
          statusConfig.processing;
        return (
          <div
            key={doc.id}
            className="flex items-center gap-3 px-4 py-3"
          >
            <FileText
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {doc.filename}
              </p>
              <p className="text-xs text-muted-foreground">
                {doc.chunkCount > 0 ? `${doc.chunkCount} chunks` : "—"} ·{" "}
                {new Date(doc.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Badge
              className={cn(
                "shrink-0 border-0 text-xs font-medium",
                status.className
              )}
            >
              {status.label}
            </Badge>
            <button
              onClick={() => handleDelete(doc.id)}
              disabled={deleting === doc.id}
              aria-label={`Delete ${doc.filename}`}
              className="ml-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-red-600 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
