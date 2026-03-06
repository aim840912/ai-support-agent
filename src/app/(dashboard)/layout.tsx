import { auth } from "@/auth";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth guard is handled by middleware (src/middleware.ts).
  // We still fetch the session to pass user info to the sidebar.
  const session = await auth();

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar userEmail={session?.user?.email ?? undefined} />
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
