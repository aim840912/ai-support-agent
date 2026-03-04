import { FileText, ExternalLink } from "lucide-react";

type SourceItem = {
  source: string; // filename or URL
  relevanceScore?: number;
  content?: string; // snippet
};

type SourcesListProps = {
  sources: SourceItem[];
};

export function SourcesList({ sources }: SourcesListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-medium text-zinc-400">Sources</p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-600"
            title={s.content ?? s.source}
          >
            <FileText className="w-3 h-3 shrink-0 text-zinc-400" aria-hidden="true" />
            <span className="max-w-[160px] truncate">{s.source}</span>
            {s.relevanceScore !== undefined && (
              <span className="text-zinc-400">
                {Math.round(s.relevanceScore * 100)}%
              </span>
            )}
            <ExternalLink className="w-3 h-3 shrink-0 text-zinc-400" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}
