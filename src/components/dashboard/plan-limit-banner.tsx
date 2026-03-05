import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type Props = {
  resource: string;
  current: number;
  limit: number;
  plan: string;
};

/**
 * Banner shown when an org is at or near their plan limit.
 * Displayed as a server component — pass usage data from the page.
 */
export function PlanLimitBanner({ resource, current, limit, plan }: Props) {
  const isAtLimit = current >= limit;
  const isNearLimit = !isAtLimit && current >= Math.floor(limit * 0.8);

  if (!isAtLimit && !isNearLimit) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
        isAtLimit
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <span className="font-medium">
          {isAtLimit ? `${resource} limit reached` : `Approaching ${resource} limit`}
        </span>
        {" — "}
        {current} / {limit} used on the {plan} plan.{" "}
        {plan === "free" && (
          <Link
            href="/settings?tab=organization"
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Upgrade to Pro
          </Link>
        )}
      </div>
    </div>
  );
}
