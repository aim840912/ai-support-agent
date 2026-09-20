import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChannelsCard, type TelegramChannelView } from "@/components/dashboard/channels-card";
import { getPublicBaseUrl, isPubliclyReachable } from "@/lib/public-url";
import { logError } from "@/lib/error-logger";

export const metadata = {
  title: "Integrations",
  description: "Connect the support agent to the channels and tools you already use.",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await searchParams;
  const session = await auth();
  // Explicit guard — the proxy should already have redirected, but a Server
  // Component enforces auth independently rather than querying with "".
  if (!session?.user?.orgId) redirect("/login");

  const orgId = session.user.orgId;
  const role = session.user.role;
  const canEdit = role === "owner" || role === "admin";

  const publicBaseUrl = getPublicBaseUrl();
  const reachable = isPubliclyReachable(publicBaseUrl);

  try {
    const channel = await prisma.telegramChannel.findUnique({
      where: { orgId },
      select: { botUsername: true, enabled: true, lastEventAt: true },
    });

    const telegram: TelegramChannelView = {
      connected: Boolean(channel),
      botUsername: channel?.botUsername ?? null,
      // The token is encrypted at rest and is never decrypted for display —
      // the bot username is the identifier that matters to the user anyway.
      tokenHint: channel ? "••••••••  (stored)" : null,
      enabled: channel?.enabled ?? false,
      lastEventAt: channel?.lastEventAt?.toISOString() ?? null,
    };

    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect the support agent to the channels your customers use and the tools your team
            already runs.
          </p>
        </header>

        {/* Webhooks and MCP tabs land in later steps; one tab keeps this honest. */}
        <Tabs defaultValue="channels">
          <TabsList>
            <TabsTrigger value="channels">Channels</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="mt-6">
            <ChannelsCard
              telegram={telegram}
              publicBaseUrl={publicBaseUrl}
              reachable={reachable}
              canEdit={canEdit}
            />
          </TabsContent>
        </Tabs>

        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Only owners and admins can change integration settings.
          </p>
        )}
      </div>
    );
  } catch (error) {
    logError("[IntegrationsPage]", error);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Could not load integration settings. Please refresh the page.
        </p>
      </div>
    );
  }
}
