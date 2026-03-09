import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuickStartCardProps = {
  enabledTools: string[];
  hasDocuments: boolean;
};

type Capability = {
  key: string;
  label: string;
  description: string;
  requiresDocuments?: boolean;
};

const CAPABILITIES: Capability[] = [
  {
    key: "getOrderStatus",
    label: "Check Order Status",
    description: 'Try: "What\'s the status of ORD-001?"',
  },
  {
    key: "checkInventory",
    label: "Look Up Inventory",
    description: 'Try: "Is the Ergonomic Mouse in stock?"',
  },
  {
    key: "createTicket",
    label: "Create Support Tickets",
    description: "Describe any issue to create a ticket",
  },
  {
    key: "searchKnowledgeBase",
    label: "Search Knowledge Base",
    description: "Upload documents to enable this",
    requiresDocuments: true,
  },
];

type StatusDot = "green" | "amber" | "gray";

function getStatus(
  cap: Capability,
  enabledTools: string[],
  hasDocuments: boolean
): { dot: StatusDot; label: string } {
  const isEnabled = enabledTools.includes(cap.key);

  // Tool not available on current plan
  if (!isEnabled) {
    return { dot: "gray", label: "Pro plan" };
  }

  // Tool enabled but requires documents that haven't been uploaded yet
  if (cap.requiresDocuments && !hasDocuments) {
    return { dot: "amber", label: "Upload docs to enable" };
  }

  return { dot: "green", label: "Available" };
}

const DOT_CLASSES: Record<StatusDot, string> = {
  green: "bg-green-500",
  amber: "bg-amber-400",
  gray: "bg-muted-foreground/40",
};

export function QuickStartCard({ enabledTools, hasDocuments }: QuickStartCardProps) {
  return (
    <Card className="border border-border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Quick Start</CardTitle>
        <p className="text-sm text-muted-foreground">Your AI agent can do these right now:</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {CAPABILITIES.map((cap) => {
          const { dot, label } = getStatus(cap, enabledTools, hasDocuments);
          return (
            <div key={cap.key} className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[dot]}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{cap.label}</p>
                <p className="text-xs text-muted-foreground">{cap.description}</p>
              </div>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{label}</span>
            </div>
          );
        })}

        <div className="pt-2">
          <Link
            href="/playground"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try in Playground
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
