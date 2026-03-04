import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar userEmail={session.user.email ?? undefined} />
      <SidebarInset>
        <header className="flex h-14 items-center border-b border-zinc-200 px-4">
          <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
        </header>
        <main className="flex-1 flex flex-col p-6 min-h-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
