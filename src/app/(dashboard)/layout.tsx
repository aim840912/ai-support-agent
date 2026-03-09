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
        <main className="flex-1 flex flex-col p-6 min-h-0 min-w-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
