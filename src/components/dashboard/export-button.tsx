"use client";

import { useState } from "react";
import { Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type Props = {
  /** Optionally pre-filter by source when exporting */
  activeSource?: string;
};

export function ExportButton({ activeSource }: Props) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport(format: "csv" | "json") {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (activeSource) params.set("source", activeSource);

      const res = await fetch(`/api/conversations/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed");

      // Trigger browser download via a transient anchor element
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `conversations.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export conversations. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          aria-label="Export conversations"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
