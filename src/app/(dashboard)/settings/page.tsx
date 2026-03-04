import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentSettingsForm } from "@/components/dashboard/agent-settings-form";
import { OrgInfoCard } from "@/components/dashboard/org-info-card";

export default async function SettingsPage() {
  const session = await auth();
  const orgId = session?.user?.orgId;

  const [org, agentSettings] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, plan: true, apiKey: true },
    }),
    prisma.agentSettings.findUnique({
      where: { orgId },
      select: { welcomeMessage: true, systemPrompt: true, enabledTools: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Configure your agent and manage API keys
      </p>

      <div className="mt-8">
        <Tabs defaultValue="agent">
          <TabsList className="mb-6">
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
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
                apiKey={org.apiKey}
              />
            ) : (
              <p className="text-sm text-zinc-400">Organization not found.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
