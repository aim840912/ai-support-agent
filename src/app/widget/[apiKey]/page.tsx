import { prisma } from "@/lib/db";
import { widgetKeyWhere } from "@/lib/org-auth";
import { WidgetChatInterface } from "@/components/widget/widget-chat-interface";
import { notFound } from "next/navigation";

export default async function WidgetPage({ params }: { params: Promise<{ apiKey: string }> }) {
  const { apiKey } = await params;

  // Validate the API key and fetch org + agent settings. The lookup condition
  // is shared with /api/widget/chat; only the projection differs here.
  const org = await prisma.organization.findFirst({
    where: widgetKeyWhere(apiKey),
    select: {
      id: true,
      name: true,
      agentSettings: {
        select: { welcomeMessage: true },
      },
    },
  });

  if (!org) {
    notFound();
  }

  const welcomeMessage = org.agentSettings?.welcomeMessage ?? "Hi! How can I help you today?";

  return <WidgetChatInterface apiKey={apiKey} welcomeMessage={welcomeMessage} orgName={org.name} />;
}
