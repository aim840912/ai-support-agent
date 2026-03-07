import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentSettingsForm } from "@/components/dashboard/agent-settings-form";
import { OrgInfoCard } from "@/components/dashboard/org-info-card";
import { PlanUsageSection } from "@/components/dashboard/plan-usage-section";
import { TeamMembers } from "@/components/dashboard/team-members";
import { getOrgUsage } from "@/lib/plan/check-plan-limit";
import { UpgradeSuccessToast } from "@/components/dashboard/upgrade-button";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; upgraded?: string }>;
}) {
  const { upgraded } = await searchParams;
  const session = await auth();
  // Explicit guard — don't silently fall back to empty orgId and query with "".
  // Middleware should have already redirected, but defense-in-depth requires
  // this Server Component to enforce auth independently.
  if (!session?.user?.orgId) redirect("/login");
  const orgId = session.user.orgId;

  try {
    // Fetch org, agent settings, team members, and pending invitations in parallel.
    // Pass org.plan to getOrgUsage so it can skip a redundant DB round-trip.
    const [org, agentSettings, members, invitations] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, plan: true, apiKey: true, stripeCustomerId: true },
      }),
      prisma.agentSettings.findUnique({
        where: { orgId },
        select: { welcomeMessage: true, systemPrompt: true, enabledTools: true },
      }),
      prisma.user.findMany({
        where: { orgId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.invitation.findMany({
        where: { orgId, expires: { gte: new Date() } },
        select: { id: true, email: true, role: true, expires: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const usage = await getOrgUsage(orgId, org?.plan);

    // Generate Stripe Customer Portal URL for Pro users
    let stripePortalUrl: string | undefined;
    if (org?.plan === "pro" && org.stripeCustomerId) {
      try {
        const origin = process.env.AUTH_URL ?? "http://localhost:3000";
        const portalSession = await getStripeClient().billingPortal.sessions.create({
          customer: org.stripeCustomerId,
          return_url: `${origin}/settings?tab=plan`,
        });
        stripePortalUrl = portalSession.url;
      } catch {
        // Non-fatal — portal URL simply won't show if Stripe is misconfigured
      }
    }

    return (
      <div>
        {upgraded === "true" && <UpgradeSuccessToast />}
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your agent and manage API keys
        </p>

        <div className="mt-8">
          <Tabs defaultValue="agent">
            <TabsList className="mb-6">
              <TabsTrigger value="agent">Agent</TabsTrigger>
              <TabsTrigger value="organization">Organization</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="plan">Plan & Usage</TabsTrigger>
            </TabsList>

            <TabsContent value="agent">
              <AgentSettingsForm
                welcomeMessage={
                  agentSettings?.welcomeMessage ??
                  "Hi! I'm your AI support assistant. How can I help you today?"
                }
                systemPrompt={agentSettings?.systemPrompt ?? ""}
                enabledTools={
                  agentSettings?.enabledTools ?? ["searchKnowledgeBase"]
                }
              />
            </TabsContent>

            <TabsContent value="organization">
              {org ? (
                <OrgInfoCard
                  orgName={org.name}
                  plan={org.plan}
                  maskedApiKey={org.apiKey.slice(0, 8) + "..."}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Organization not found.</p>
              )}
            </TabsContent>

            <TabsContent value="team">
              <TeamMembers
                members={members.map((m) => ({
                  id: m.id,
                  name: m.name,
                  email: m.email,
                  role: m.role,
                  joinedAt: m.createdAt.toISOString(),
                }))}
                invitations={invitations.map((inv) => ({
                  id: inv.id,
                  email: inv.email,
                  role: inv.role,
                  expires: inv.expires.toISOString(),
                  sentAt: inv.createdAt.toISOString(),
                }))}
                currentUserId={session.user.id!}
                currentUserRole={session.user.role ?? "member"}
                canInviteMore={
                  usage.limits.teamMembers === -1 ||
                  members.length < usage.limits.teamMembers
                }
                planLimit={usage.limits.teamMembers}
              />
            </TabsContent>

            <TabsContent value="plan">
              <PlanUsageSection usage={usage} stripePortalUrl={stripePortalUrl} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  } catch (error) {
    console.error("[SettingsPage]", error);
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your agent and manage API keys
        </p>
        <p className="mt-8 text-sm text-destructive">
          Failed to load settings. Please try again later.
        </p>
      </div>
    );
  }
}
