import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChannelsCard, type TelegramChannelView } from "@/components/dashboard/channels-card";
import {
  WebhookEndpointsCard,
  type EndpointView,
} from "@/components/dashboard/webhook-endpoints-card";
import { getPublicBaseUrl, isPubliclyReachable } from "@/lib/public-url";
import { DELIVERY_HISTORY_LIMIT, FAILURE_THRESHOLD } from "@/lib/webhooks/dispatch";
import {
  ID_HEADER,
  EVENT_HEADER,
  TIMESTAMP_HEADER,
  SIGNATURE_HEADER,
} from "@/lib/webhook-signature";
import { logError } from "@/lib/error-logger";

export const metadata = {
  title: "Integrations",
  description: "Connect the support agent to the channels and tools you already use.",
};

const TABS = ["webhooks", "channels"] as const;
type TabValue = (typeof TABS)[number];

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const session = await auth();
  // Explicit guard — the proxy should already have redirected, but a Server
  // Component enforces auth independently rather than querying with "".
  if (!session?.user?.orgId) redirect("/login");

  const orgId = session.user.orgId;
  const role = session.user.role;
  const canEdit = role === "owner" || role === "admin";

  const publicBaseUrl = getPublicBaseUrl();
  const reachable = isPubliclyReachable(publicBaseUrl);

  // Webhooks first: automation is the headline of this page, and the channel
  // list is short enough to be one click away.
  const activeTab: TabValue = TABS.includes(tab as TabValue) ? (tab as TabValue) : "webhooks";

  try {
    const [channel, endpoints] = await Promise.all([
      prisma.telegramChannel.findUnique({
        where: { orgId },
        select: { botUsername: true, enabled: true, lastEventAt: true },
      }),
      prisma.webhookEndpoint.findMany({
        where: { orgId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          url: true,
          events: true,
          enabled: true,
          description: true,
          secret: true,
          lastStatus: true,
          lastFiredAt: true,
          failureCount: true,
          deliveries: {
            orderBy: { createdAt: "desc" },
            take: DELIVERY_HISTORY_LIMIT,
            select: {
              id: true,
              event: true,
              status: true,
              statusCode: true,
              durationMs: true,
              attempt: true,
              error: true,
              responseBody: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const telegram: TelegramChannelView = {
      connected: Boolean(channel),
      botUsername: channel?.botUsername ?? null,
      // The token is encrypted at rest and is never decrypted for display —
      // the bot username is the identifier that matters to the user anyway.
      tokenHint: channel ? "••••••••  (stored)" : null,
      enabled: channel?.enabled ?? false,
      lastEventAt: channel?.lastEventAt?.toISOString() ?? null,
    };

    const endpointViews: EndpointView[] = endpoints.map((endpoint) => ({
      ...endpoint,
      lastFiredAt: endpoint.lastFiredAt?.toISOString() ?? null,
      deliveries: endpoint.deliveries.map((delivery) => ({
        ...delivery,
        createdAt: delivery.createdAt.toISOString(),
      })),
    }));

    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect the support agent to the channels your customers use and the tools your team
            already runs.
          </p>
        </header>

        {/* The MCP tab lands in a later step. */}
        <Tabs defaultValue={activeTab}>
          <TabsList>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks" className="mt-6">
            <WebhookEndpointsCard
              endpoints={endpointViews}
              canEdit={canEdit}
              failureThreshold={FAILURE_THRESHOLD}
              headerNames={{
                id: ID_HEADER,
                event: EVENT_HEADER,
                timestamp: TIMESTAMP_HEADER,
                signature: SIGNATURE_HEADER,
              }}
            />
          </TabsContent>

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
