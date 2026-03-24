import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auth guard is handled by proxy (src/proxy.ts).
  // We fetch the session and active org name to pass to the sidebar.
  const session = await auth();

  // Resolve the org name for the initial SSR render of OrgSwitcher.
  // The client component will re-fetch the full list after hydration.
  let orgName: string | undefined;
  if (session?.user?.orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { name: true },
    });
    orgName = org?.name ?? undefined;
  }

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar userEmail={session?.user?.email ?? undefined} orgName={orgName} />
      <SidebarInset>
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
          <ThemeToggle />
        </header>
        {session?.user?.isDemo && (
          <div
            className="shrink-0 px-4 py-2.5 text-sm text-center bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
            role="status"
            aria-live="polite"
          >
            Demo mode — read-only access.{" "}
            <Link href="/register" className="font-medium underline hover:no-underline">
              Create a free account
            </Link>{" "}
            to build your own.
          </div>
        )}
        <main className="flex-1 flex flex-col p-6 min-h-0 min-w-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
