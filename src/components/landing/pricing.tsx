import Link from "next/link";
import { Check, X } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/plan/limits";

type PricingFeature = {
  label: string;
  free: string | boolean;
  pro: string | boolean;
};

const { free, pro } = PLAN_LIMITS;

/** Renders a numeric limit; -1 means unlimited. */
const limit = (n: number) => (n === -1 ? "Unlimited" : n.toLocaleString());

// Numeric rows read from PLAN_LIMITS so the table can never drift from the
// limits actually enforced at runtime.
const features: PricingFeature[] = [
  { label: "Knowledge base documents", free: limit(free.documents), pro: limit(pro.documents) },
  {
    label: "Conversations / month",
    free: limit(free.conversationsPerMonth),
    pro: limit(pro.conversationsPerMonth),
  },
  {
    label: "Messages / conversation",
    free: limit(free.messagesPerConversation),
    pro: limit(pro.messagesPerConversation),
  },
  { label: "Products in inventory", free: limit(free.products), pro: limit(pro.products) },
  { label: "Team members", free: limit(free.teamMembers), pro: limit(pro.teamMembers) },
  { label: "AI tools: KB search", free: true, pro: true },
  { label: "AI tools: Order lookup", free: true, pro: true },
  { label: "AI tools: Inventory check", free: false, pro: true },
  { label: "AI tools: Ticket creation", free: false, pro: true },
  { label: "Analytics dashboard", free: true, pro: true },
  { label: "Embeddable chat widget", free: true, pro: true },
  { label: "Email support", free: false, pro: true },
];

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-foreground" aria-label="Included" />
    ) : (
      <X className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Not included" />
    );
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

export function Pricing() {
  return (
    <section className="bg-background px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-xl border border-border">
          {/* Header */}
          <div className="grid grid-cols-3 border-b border-border bg-muted/40">
            <div className="p-4 text-sm font-medium text-muted-foreground">Feature</div>
            <div className="border-l border-border p-4 text-center">
              <div className="text-sm font-semibold text-foreground">Free</div>
              <div className="mt-0.5 text-xs text-muted-foreground">$0 / month</div>
            </div>
            <div className="border-l border-border bg-primary/5 p-4 text-center">
              <div className="text-sm font-semibold text-foreground">Pro</div>
              <div className="mt-0.5 text-xs text-muted-foreground">$29 / month</div>
            </div>
          </div>

          {/* Rows */}
          {features.map(({ label, free, pro }, i) => (
            <div
              key={label}
              className={`grid grid-cols-3 border-b border-border last:border-0 ${
                i % 2 === 0 ? "bg-background" : "bg-muted/20"
              }`}
            >
              <div className="flex items-center px-4 py-3 text-sm text-muted-foreground">
                {label}
              </div>
              <div className="flex items-center justify-center border-l border-border px-4 py-3">
                <FeatureValue value={free} />
              </div>
              <div className="flex items-center justify-center border-l border-border bg-primary/5 px-4 py-3">
                <FeatureValue value={pro} />
              </div>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6">
          <Link
            href="/register"
            className="flex items-center justify-center rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/register"
            className="flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            Start Pro trial
          </Link>
        </div>
      </div>
    </section>
  );
}
