import { type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  Icon: LucideIcon;
};

export function StatCard({ title, value, description, Icon }: StatCardProps) {
  return (
    <Card className="border border-zinc-200 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-zinc-400" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-zinc-900">{value}</div>
        {description && (
          <p className="mt-1 text-xs text-zinc-400">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
